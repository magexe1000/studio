#!/usr/bin/env node
/**
 * publish-bundle — produces a Capgo-compatible OTA bundle from the
 * latest `vite build` output, places it inside the deployment's
 * static directory, and updates `version.json` with an absolute
 * download URL so the APK can find it.
 *
 * Run AFTER `vite build` (e.g. via `pnpm build && pnpm bundle:publish`).
 *
 * Inputs (env vars):
 *   OTA_BASE_URL   — required for native OTA. The PUBLIC URL of the
 *                    static host that will serve the bundle, e.g.
 *                    `https://magexe1000.github.io/Chordex` (GitHub
 *                    Pages) or `https://chordex.replit.app`. The
 *                    script writes `${OTA_BASE_URL}/bundles/bundle-X.Y.Z.zip`
 *                    into `version.json`. If unset, the script still
 *                    zips the bundle but logs a warning and leaves
 *                    `downloadUrl` blank — useful for dry runs.
 *
 *   OTA_OUTPUT_DIR — optional. When set, the script ALSO copies the
 *                    finished `version.json` and the bundle zip into
 *                    `${OTA_OUTPUT_DIR}/version.json` and
 *                    `${OTA_OUTPUT_DIR}/bundles/bundle-X.Y.Z.zip`.
 *                    Use this to drop a Pages-ready release straight
 *                    into your `docs/` folder (or any static host's
 *                    publish dir) so all you have to do afterwards
 *                    is `git add docs && git commit && git push`.
 *                    Path is resolved relative to the chord-app
 *                    package root.
 *
 * Outputs:
 *   dist/public/bundles/bundle-<version>.zip
 *   dist/public/version.json   (overwritten with downloadUrl appended)
 *   ${OTA_OUTPUT_DIR}/...      (mirror copy, only when env var set)
 *
 * Implementation notes:
 *   - The zip is created via the `archiver` npm package — pure JS, so
 *     this script runs identically on Windows, macOS, Linux, and CI
 *     without depending on a system `zip` binary.
 *   - The `bundles/` directory itself is excluded from the zip's
 *     contents so successive bundles don't accumulate inside each
 *     other (every bundle would otherwise embed every prior bundle).
 *   - We never delete old bundle zips automatically. Old versions stay
 *     downloadable so a partial rollout doesn't strand users on a
 *     bundle whose URL just disappeared.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist/public');
const bundlesDir = path.join(distDir, 'bundles');
const versionJsonPath = path.join(distDir, 'version.json');
const appVersionPath = path.join(root, 'src/lib/appVersion.ts');
const changelogPath = path.join(root, 'CHANGELOG.md');

// ── Read version from the source of truth ─────────────────────────────
const src = fs.readFileSync(appVersionPath, 'utf8');
const versionMatch = src.match(/export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  console.error('publish-bundle: ✗ could not find APP_VERSION in src/lib/appVersion.ts');
  process.exit(1);
}
const version = versionMatch[1];

// ── Pull the matching section out of CHANGELOG.md ─────────────────────
//
// The changelog is the SOURCE OF TRUTH for what each release contains.
// We parse the section whose heading matches the current APP_VERSION
// and ship its bullet list as version.json's `changelog` field.
//
// Format expected (see CHANGELOG.md for the full spec):
//   ## 3.0.3
//   - first change
//   - second change
//
//   ## 3.0.2
//   - ...
//
// Resolution rules:
//   - Heading match is exact ("## X.Y.Z" — no "v" prefix).
//   - Body extends from the heading down to the next "## " or EOF.
//   - We strip the leading "- " from each bullet and normalize to "• "
//     so the in-app modal renders bullets consistently with prior
//     hand-written entries.
//   - If no matching section exists, we WARN and fall back to the
//     generic "Version X.Y.Z" string. The release still goes out so a
//     forgotten changelog entry doesn't block a hot-fix, but the log
//     line makes the omission impossible to miss.
function readChangelogForVersion(v) {
  if (!fs.existsSync(changelogPath)) {
    console.warn(`publish-bundle: ⚠ CHANGELOG.md not found — using generic message.`);
    return `Version ${v}`;
  }
  const text = fs.readFileSync(changelogPath, 'utf8');
  // Escape regex metachars in the version string (defensive — in
  // practice semver only uses [0-9.] but a typo'd suffix shouldn't
  // explode the regex).
  const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // JS regex doesn't have \Z (end-of-string anchor). Use a negative
  // lookahead `(?![\s\S])` instead so the LAST section in the file
  // (which has no `## ` after it) still matches.
  const re = new RegExp(
    `^##\\s+${esc}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
    'm',
  );
  const match = text.match(re);
  if (!match) {
    console.warn(
      `publish-bundle: ⚠ no \`## ${v}\` section in CHANGELOG.md — using generic message.`,
    );
    console.warn('  Add an entry to CHANGELOG.md before the next release so the modal');
    console.warn('  shows the actual changes shipped in this bundle.');
    return `Version ${v}`;
  }
  // Pull bullets only (lines that start with "- "). Multi-line bullets
  // (continuation indented under a "- ") get joined back onto the
  // bullet so the modal renders them as one paragraph each.
  const lines = match[1].split('\n');
  const bullets = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*-\s+/.test(line)) {
      if (current) bullets.push(current);
      current = '• ' + line.replace(/^\s*-\s+/, '').trim();
    } else if (/^\s+\S/.test(line) && current) {
      // Continuation of the previous bullet.
      current += ' ' + line.trim();
    } else if (line.trim() === '' && current) {
      bullets.push(current);
      current = null;
    }
    // Anything else (stray prose, blank lines before any bullet) is ignored.
  }
  if (current) bullets.push(current);
  if (bullets.length === 0) {
    console.warn(
      `publish-bundle: ⚠ section \`## ${v}\` has no bullets — using generic message.`,
    );
    return `Version ${v}`;
  }
  return bullets.join('\n');
}

const changelog = readChangelogForVersion(version);

// ── Sanity-check the build output ─────────────────────────────────────
if (!fs.existsSync(distDir)) {
  console.error(`publish-bundle: ✗ ${distDir} does not exist — run \`pnpm build\` first.`);
  process.exit(1);
}
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error(`publish-bundle: ✗ ${distDir}/index.html missing — build looks broken.`);
  process.exit(1);
}

// ── Make the bundles directory + zip the build ────────────────────────
fs.mkdirSync(bundlesDir, { recursive: true });
const zipName = `bundle-${version}.zip`;
const zipPath = path.join(bundlesDir, zipName);
// Remove any prior file with the same name so an aborted prior run
// can't leave us with a half-written zip.
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

// Allow the orchestrator (release-gh-pages.mjs) to point us at a
// DIFFERENT directory containing a clean (no-BASE_PATH) build for the
// OTA zip — while leaving `distDir` itself as the Pages-flavoured
// build (with `/Chordex/` baked into asset URLs). Without this the
// OTA bundle would carry the Pages base path and every asset request
// inside the native WebView would 404 → the dreaded "all gray"
// post-update screen.
const bundleSourceDir = (process.env.BUNDLE_SOURCE_DIR ?? '').trim()
  ? path.resolve(root, process.env.BUNDLE_SOURCE_DIR.trim())
  : distDir;
if (bundleSourceDir !== distDir) {
  if (!fs.existsSync(path.join(bundleSourceDir, 'index.html'))) {
    console.error(
      `publish-bundle: ✗ BUNDLE_SOURCE_DIR=${bundleSourceDir} has no index.html.`,
    );
    process.exit(1);
  }
  console.log(`publish-bundle: → zipping from ${path.relative(root, bundleSourceDir)} (snapshot)`);
}

// Use archiver (pure-Node, cross-platform) so this script runs on
// Windows dev machines as well as Replit/Linux/Mac without needing
// the system `zip` binary. Archive paths are rooted at the bundle's
// WebView root (no leading "dist/public/"). Exclude bundles/ AND
// version.json — bundles must not contain a stale copy of themselves,
// and version.json is regenerated below.
await new Promise((resolve, reject) => {
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  output.on('close', resolve);
  output.on('error', reject);
  archive.on('error', reject);
  archive.pipe(output);
  // OTA_SLIM=1 excludes the drum-sample tree from the bundle. The
  // samples are seeded into the device's Data dir on first launch
  // (see src/lib/assetCache.ts) so they don't need to ride along on
  // every OTA — shrinks normal releases from ~53 MB to ~5 MB.
  // The audio-manifest.json must stay in the bundle so the seeder
  // (running in OLDER versions, before they get this slim build) can
  // still find it on the first slim install.
  const slim = process.env.OTA_SLIM === '1';
  const ignore = ['bundles/**', 'version.json'];
  if (slim) {
    ignore.push('drums/**');
    console.log('publish-bundle: → OTA_SLIM=1 — excluding drums/** from bundle');
  }
  archive.glob('**/*', {
    cwd: bundleSourceDir,
    dot: false,
    ignore,
  });
  archive.finalize();
});

const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`publish-bundle: ✓ created ${path.relative(root, zipPath)} (${sizeKb} KB)`);

// ── Update version.json with the absolute download URL ────────────────
const otaBase = (process.env.OTA_BASE_URL ?? '').trim().replace(/\/$/, '');
const existing = fs.existsSync(versionJsonPath)
  ? JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'))
  : { mandatory: false };

// Always re-stamp version + changelog from the source of truth. The
// previous behaviour of preserving whatever was already in version.json
// meant the changelog drifted across releases (it was hand-edited once
// and never updated again). Now every release writes the matching
// section from CHANGELOG.md, so the modal always shows the changes
// the user is actually about to receive.
existing.changelog = changelog;

if (!otaBase) {
  // Strip any stale downloadUrl from a prior run — otherwise the APK
  // would happily try to download a bundle from the OLD deployment URL
  // that no longer points at this version's zip.
  if (existing.downloadUrl) {
    delete existing.downloadUrl;
    console.warn('publish-bundle: ⚠ removed stale downloadUrl from version.json (OTA_BASE_URL unset).');
  }
  console.warn('publish-bundle: ⚠ OTA_BASE_URL not set — leaving downloadUrl blank.');
  console.warn('  The web PWA will still update via service-worker reload, but the');
  console.warn('  Android APK will NOT be able to fetch this bundle.');
} else {
  // Three possible bundle-hosting strategies:
  //
  //   1. USE_GH_RELEASES=1  → upload zip as a GitHub Release asset
  //      (recommended for ongoing development; keeps the repo small
  //      because release assets don't live in git history at all).
  //   2. GitHub Pages base   → fall back to raw.githubusercontent
  //      (legacy path; the zip is committed to docs/bundles/).
  //   3. Anything else       → assume the bundle is reachable at
  //      `${OTA_BASE_URL}/bundles/${zipName}` (e.g. self-hosted CDN).
  const useReleases = process.env.USE_GH_RELEASES === '1';
  const ghPages = otaBase.match(/^https:\/\/([^.]+)\.github\.io(?:\/([^/?#]+))?$/i);

  if (useReleases) {
    if (!ghPages && !process.env.GITHUB_REPO) {
      console.error('publish-bundle: ✗ USE_GH_RELEASES=1 but cannot derive owner/repo.');
      console.error('  Either point OTA_BASE_URL at a https://USER.github.io/REPO URL,');
      console.error('  or set GITHUB_REPO=USER/REPO explicitly.');
      process.exit(1);
    }
    let user, repo;
    if (process.env.GITHUB_REPO) {
      [user, repo] = process.env.GITHUB_REPO.split('/');
    } else {
      user = ghPages[1];
      repo = ghPages[2] ?? `${user}.github.io`;
    }
    const tag = `v${version}`;
    const slug = `${user}/${repo}`;

    // Does a release with this tag already exist? If yes, just upload
    // (with --clobber so re-runs are idempotent). If no, create it
    // first with the changelog as the body, then upload the zip.
    const view = spawnSync('gh', ['release', 'view', tag, '-R', slug], {
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
    if (view.status !== 0) {
      console.log(`publish-bundle: → creating GitHub Release ${tag} on ${slug}`);
      // Write the release notes to a temp file and pass --notes-file
      // instead of --notes. Inline --notes is parsed by the shell and
      // any special character in the changelog (em-dash, bullets,
      // backticks, parentheses) can blow up cmd / PowerShell quoting.
      // A file sidesteps the entire shell-quoting problem.
      const notesPath = path.join(root, 'dist', `release-notes-${version}.txt`);
      fs.writeFileSync(notesPath, changelog, 'utf8');
      const create = spawnSync(
        'gh',
        ['release', 'create', tag, '-R', slug, '--title', tag, '--notes-file', notesPath],
        { stdio: 'inherit', shell: process.platform === 'win32' },
      );
      try { fs.unlinkSync(notesPath); } catch { /* noop */ }
      if (create.status !== 0) {
        console.error(`publish-bundle: ✗ \`gh release create\` failed (exit ${create.status}).`);
        console.error('  Is the GitHub CLI installed and authenticated?  Try: gh auth status');
        process.exit(create.status ?? 1);
      }
    } else {
      console.log(`publish-bundle: → release ${tag} already exists; uploading asset`);
    }
    const upload = spawnSync(
      'gh',
      ['release', 'upload', tag, zipPath, '-R', slug, '--clobber'],
      { stdio: 'inherit', shell: process.platform === 'win32' },
    );
    if (upload.status !== 0) {
      console.error(`publish-bundle: ✗ \`gh release upload\` failed (exit ${upload.status}).`);
      process.exit(upload.status ?? 1);
    }
    existing.downloadUrl = `https://github.com/${slug}/releases/download/${tag}/${zipName}`;
    console.log(`publish-bundle: ✓ downloadUrl = ${existing.downloadUrl} (GitHub Release)`);
  } else if (ghPages) {
    // Legacy: zip lives in docs/bundles/, fetched via raw.githubusercontent.
    const user = ghPages[1];
    const repo = ghPages[2] ?? `${user}.github.io`;
    existing.downloadUrl = `https://raw.githubusercontent.com/${user}/${repo}/main/docs/bundles/${zipName}`;
    console.log(`publish-bundle: ✓ downloadUrl = ${existing.downloadUrl} (raw.github bypass)`);
  } else {
    existing.downloadUrl = `${otaBase}/bundles/${zipName}`;
    console.log(`publish-bundle: ✓ downloadUrl = ${existing.downloadUrl}`);
  }
}

// Always re-stamp the version field so a manually-edited version.json
// (e.g. for a banner demo) doesn't ship.
existing.version = version;

fs.writeFileSync(versionJsonPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
console.log(`publish-bundle: ✓ wrote ${path.relative(root, versionJsonPath)}`);

// ── Optional mirror to a static-host publish dir (e.g. ./docs) ────────
const mirrorDir = (process.env.OTA_OUTPUT_DIR ?? '').trim();
if (mirrorDir) {
  const absMirror = path.resolve(root, mirrorDir);
  const mirrorBundlesDir = path.join(absMirror, 'bundles');
  fs.mkdirSync(mirrorBundlesDir, { recursive: true });

  // Mirror the ENTIRE built PWA (index.html, assets, icons, manifest…)
  // into the static-host publish dir so GitHub Pages can serve the web
  // version of the app, not just the OTA bundle zip. Without this the
  // Pages URL 404s for everything except `version.json` and the bundle
  // zips, which makes browser-based testing impossible AND breaks the
  // PWA install path. Skip the `bundles/` subtree (mirrored separately
  // below) so we don't recurse a 50 MB zip into the diff.
  function copyTree(srcRoot, dstRoot, skip = new Set()) {
    for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const s = path.join(srcRoot, entry.name);
      const d = path.join(dstRoot, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(d, { recursive: true });
        copyTree(s, d, skip);
      } else if (entry.isFile()) {
        fs.copyFileSync(s, d);
      }
    }
  }
  copyTree(distDir, absMirror, new Set(['bundles', 'version.json']));

  // When uploading to GitHub Releases we deliberately SKIP mirroring
  // the zip into docs/bundles/. That's the whole point of the GH
  // Releases path — the zip stays out of git history so the repo
  // never grows by tens of MB per release. version.json (a few hundred
  // bytes) is the only OTA file that still ships through Pages.
  if (process.env.USE_GH_RELEASES !== '1') {
    // Copy (not move) the zip — keep dist/public intact so any local
    // PWA/preview still works.
    const mirrorZipPath = path.join(mirrorBundlesDir, zipName);
    fs.copyFileSync(zipPath, mirrorZipPath);
    console.log(`publish-bundle:   - ${path.relative(path.resolve(root, '../..'), mirrorZipPath)}`);
  }

  // Copy version.json AFTER it has been re-stamped above.
  const mirrorVersionJson = path.join(absMirror, 'version.json');
  fs.copyFileSync(versionJsonPath, mirrorVersionJson);

  // Friendly relative paths in the log so the developer can see
  // exactly what to `git add`.
  const repoRoot = path.resolve(root, '../..');
  const relMirror = path.relative(repoRoot, absMirror);
  console.log(`publish-bundle: ✓ mirrored release into ${relMirror}/`);
  console.log(`publish-bundle:   - ${path.relative(repoRoot, mirrorVersionJson)}`);
  console.log(`publish-bundle: → next: \`git add ${relMirror} && git commit -m "ota ${version}" && git push\``);
}

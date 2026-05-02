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
 *   - The zip is created with the system `zip` command. Replit's
 *     deploy environment ships zip; on Windows-only dev machines this
 *     script will fail with a clear error and a pointer to install zip.
 *   - The `bundles/` directory itself is excluded from the zip's
 *     contents so successive bundles don't accumulate inside each
 *     other (every bundle would otherwise embed every prior bundle).
 *   - We never delete old bundle zips automatically. Old versions stay
 *     downloadable so a partial rollout doesn't strand users on a
 *     bundle whose URL just disappeared.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist/public');
const bundlesDir = path.join(distDir, 'bundles');
const versionJsonPath = path.join(distDir, 'version.json');
const appVersionPath = path.join(root, 'src/lib/appVersion.ts');

// ── Read version from the source of truth ─────────────────────────────
const src = fs.readFileSync(appVersionPath, 'utf8');
const versionMatch = src.match(/export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  console.error('publish-bundle: ✗ could not find APP_VERSION in src/lib/appVersion.ts');
  process.exit(1);
}
const version = versionMatch[1];

// ── Sanity-check the build output ─────────────────────────────────────
if (!fs.existsSync(distDir)) {
  console.error(`publish-bundle: ✗ ${distDir} does not exist — run \`pnpm build\` first.`);
  process.exit(1);
}
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error(`publish-bundle: ✗ ${distDir}/index.html missing — build looks broken.`);
  process.exit(1);
}

// ── Verify zip is available before we mutate anything ─────────────────
try {
  execSync('zip -v', { stdio: 'ignore' });
} catch {
  console.error('publish-bundle: ✗ system `zip` command not found.');
  console.error('  Install it (e.g. `apt install zip`, `brew install zip`) and retry.');
  process.exit(1);
}

// ── Make the bundles directory + zip the build ────────────────────────
fs.mkdirSync(bundlesDir, { recursive: true });
const zipName = `bundle-${version}.zip`;
const zipPath = path.join(bundlesDir, zipName);
// Remove any prior file with the same name so an aborted prior run
// can't leave us with a half-written zip.
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

// Run zip from inside dist/public so paths inside the archive are
// rooted at the bundle's WebView root (no leading "dist/public/").
// Exclude bundles/ AND version.json — bundles must not contain a
// stale copy of themselves, and version.json is regenerated below.
execSync(
  `zip -rq "${zipPath}" . -x "bundles/*" "version.json"`,
  { cwd: distDir, stdio: 'inherit' },
);

const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`publish-bundle: ✓ created ${path.relative(root, zipPath)} (${sizeKb} KB)`);

// ── Update version.json with the absolute download URL ────────────────
const otaBase = (process.env.OTA_BASE_URL ?? '').trim().replace(/\/$/, '');
const existing = fs.existsSync(versionJsonPath)
  ? JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'))
  : { version, changelog: `Version ${version}`, mandatory: false };

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
  existing.downloadUrl = `${otaBase}/bundles/${zipName}`;
  console.log(`publish-bundle: ✓ downloadUrl = ${existing.downloadUrl}`);
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

  // Copy (not move) the zip — keep dist/public intact so any local
  // PWA/preview still works.
  const mirrorZipPath = path.join(mirrorBundlesDir, zipName);
  fs.copyFileSync(zipPath, mirrorZipPath);

  // Copy version.json AFTER it has been re-stamped above.
  const mirrorVersionJson = path.join(absMirror, 'version.json');
  fs.copyFileSync(versionJsonPath, mirrorVersionJson);

  // Friendly relative paths in the log so the developer can see
  // exactly what to `git add`.
  const repoRoot = path.resolve(root, '../..');
  const relMirror = path.relative(repoRoot, absMirror);
  console.log(`publish-bundle: ✓ mirrored release into ${relMirror}/`);
  console.log(`publish-bundle:   - ${path.relative(repoRoot, mirrorVersionJson)}`);
  console.log(`publish-bundle:   - ${path.relative(repoRoot, mirrorZipPath)}`);
  console.log(`publish-bundle: → next: \`git add ${relMirror} && git commit -m "ota ${version}" && git push\``);
}

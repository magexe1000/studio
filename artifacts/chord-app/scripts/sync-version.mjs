#!/usr/bin/env node
/**
 * sync-version — keeps `public/version.json` in lockstep with the
 * bundle's `APP_VERSION` (and `APP_CHANGELOG`) so the two cannot
 * drift. Run automatically before every `vite build` via the
 * `prebuild` npm hook; safe to run by hand too.
 *
 * Source of truth:  src/lib/appVersion.ts  (APP_VERSION, APP_CHANGELOG)
 * Generates:        public/version.json     ({ version, changelog, mandatory })
 *
 * Implementation note: we parse the TS source with a regex rather
 * than spinning up a TS compiler. The constants are intentionally
 * trivial string / array literals so a one-line regex is robust.
 * If the format ever changes, this script will exit non-zero (loud
 * failure) instead of silently writing the wrong version.
 *
 * ─── Flags ─────────────────────────────────────────────────────────
 * --preserve-newer   DEV-ONLY OTA OVERRIDE.
 *   When set, if `public/version.json` already exists AND its
 *   `version` field is a STRICTLY-VALID semver that compares greater
 *   than `APP_VERSION`, the existing file is left untouched. This
 *   lets a developer hand-edit `public/version.json` to a higher
 *   version (with a custom changelog) to demo the in-app
 *   UpdateIndicator without every `pnpm dev` restart wiping it.
 *
 *   The `prebuild` hook must NOT pass this flag — production builds
 *   require strict lockstep so the shipped APK reports its real
 *   version. Only the `predev` hook passes it.
 *
 *   Any malformed / non-strict-semver value in the existing file is
 *   treated as a parse failure and the file is rewritten — preserve
 *   only kicks in for unambiguously-newer, strict versions.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'src/lib/appVersion.ts');
const outPath = path.join(root, 'public/version.json');

const preserveNewer = process.argv.includes('--preserve-newer');

// Strict semver parser — anchored end-to-end so values like
// "3.1.0junk", "3.1.0.1", or "v3.1.0" are rejected (return null).
// We only need core MAJOR.MINOR.PATCH for the preserve check; any
// prerelease / build metadata is treated as "not a clean release"
// and falls through to a rewrite.
function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function semverGt(a, b) {
  const x = parseSemver(a), y = parseSemver(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) {
    if (x[i] > y[i]) return true;
    if (x[i] < y[i]) return false;
  }
  return false;
}

const src = fs.readFileSync(sourcePath, 'utf8');

const versionMatch = src.match(/export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  console.error(`sync-version: ✗ could not find APP_VERSION in ${sourcePath}`);
  console.error('  Expected:  export const APP_VERSION = \'X.Y.Z\';');
  process.exit(1);
}
const version = versionMatch[1];

const changelogMatch = src.match(/export\s+const\s+APP_CHANGELOG\s*=\s*\[([\s\S]*?)\]\s*;/);
let changelog;
if (!changelogMatch) {
  // No APP_CHANGELOG export defined at all — fine, fall back to a
  // generic "Version X.Y.Z" notice rather than failing the build.
  changelog = `Version ${version}`;
} else {
  // APP_CHANGELOG IS defined → parse it. If parsing yields nothing,
  // the upstream format has drifted and silently shipping a stale or
  // empty changelog would be worse than failing loudly. Exit non-zero
  // so the developer knows to either fix the format or update this
  // script to handle the new shape.
  const lines = changelogMatch[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    // strip trailing comma + surrounding quotes
    .map((l) => l.replace(/,$/, ''))
    .map((l) => {
      const m = l.match(/^['"`](.*)['"`]$/);
      return m ? m[1] : null;
    })
    .filter((s) => typeof s === 'string' && s.length > 0);
  if (lines.length === 0) {
    console.error(`sync-version: ✗ APP_CHANGELOG is exported in ${sourcePath} but no entries could be parsed.`);
    console.error('  Expected each entry on its own line as a quoted string literal:');
    console.error('    export const APP_CHANGELOG = [');
    console.error("      'Some user-facing change.',");
    console.error("      'Another change.',");
    console.error('    ];');
    console.error('  If the array intentionally uses a different shape (template literals, inline format, computed values),');
    console.error('  update scripts/sync-version.mjs to handle it.');
    process.exit(1);
  }
  changelog = lines.map((s) => `• ${s}`).join('\n');
}

const payload = {
  version,
  changelog,
  mandatory: false,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });

if (preserveNewer && fs.existsSync(outPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    if (existing && typeof existing.version === 'string' && semverGt(existing.version, version)) {
      console.log(
        `sync-version: ↷ kept existing ${path.relative(root, outPath)} (version=${existing.version} > APP_VERSION=${version}) — dev OTA override.`,
      );
      process.exit(0);
    }
  } catch {
    /* malformed file — fall through and rewrite */
  }
}

fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`sync-version: ✓ wrote ${path.relative(root, outPath)} (version=${version})`);

// Sync package.json version
const pkgPath = path.join(root, 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.version !== version) {
      pkg.version = version;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log(`sync-version: ✓ updated package.json version to ${version}`);
    }
  } catch (err) {
    console.error('sync-version: ✗ failed to sync package.json:', err);
  }
}

// Sync android/app/build.gradle versionName
const gradlePath = path.join(root, 'android/app/build.gradle');
if (fs.existsSync(gradlePath)) {
  try {
    let gradleSrc = fs.readFileSync(gradlePath, 'utf8');
    const gradlePat = /versionName\s+["']([^"']+)["']/;
    if (gradlePat.test(gradleSrc)) {
      gradleSrc = gradleSrc.replace(gradlePat, `versionName "${version}"`);
      fs.writeFileSync(gradlePath, gradleSrc, 'utf8');
      console.log(`sync-version: ✓ updated android/app/build.gradle versionName to ${version}`);
    }
  } catch (err) {
    console.error('sync-version: ✗ failed to sync android/app/build.gradle:', err);
  }
}

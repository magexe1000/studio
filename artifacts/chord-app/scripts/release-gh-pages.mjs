#!/usr/bin/env node
/**
 * release-gh-pages — cross-platform orchestrator that produces BOTH a
 * GitHub Pages deployment (under `docs/`) AND a Capgo OTA bundle zip.
 *
 * The two artifacts have CONTRADICTORY base-path requirements:
 *
 *   - GitHub Pages serves the project at `https://USER.github.io/REPO/`,
 *     so every asset URL emitted in `index.html` must be prefixed with
 *     `/REPO/` (Vite's `base` option). Without this, Pages 404s every
 *     chunk and the page renders the inline splash forever.
 *
 *   - The OTA bundle is unpacked into the native WebView's local file
 *     root. There is NO `/REPO/` segment in that root — assets must
 *     resolve at `/assets/...`. If a `/REPO/`-flavoured build ships in
 *     the bundle, every asset 404s after Capgo swaps the bundle in and
 *     the user sees the post-update "all gray" screen.
 *
 * Solution: build TWICE.
 *
 *   1. Build with NO BASE_PATH → clean. Snapshot to `dist/_ota_snapshot/`.
 *   2. Build with BASE_PATH=/REPO/ → Pages-flavoured. This is `dist/public/`.
 *   3. Run publish-bundle pointed at the snapshot for the zip, but at
 *      `dist/public/` for the docs/ mirror — so the docs site has the
 *      Pages prefix and the bundle does not.
 *
 * Usage:
 *   $env:OTA_BASE_URL = "https://USER.github.io/REPO"   # PowerShell
 *   pnpm release:gh-pages
 */
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');

const otaBase = (process.env.OTA_BASE_URL ?? '').trim();
if (!otaBase) {
  console.error('release-gh-pages: ✗ OTA_BASE_URL is not set.');
  console.error('  Set it to your GitHub Pages URL before running this script, e.g.');
  console.error('    PowerShell: $env:OTA_BASE_URL = "https://magexe1000.github.io/Chordex"');
  console.error('    bash:       export OTA_BASE_URL=https://magexe1000.github.io/Chordex');
  process.exit(1);
}

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd: pkgRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Derive `/REPO/` from the OTA base URL so the same script works for
// any user/repo combination. A trailing slash is required so Vite
// emits `/REPO/assets/...` not `/REPOassets/...`.
let basePath = '/';
try {
  const u = new URL(otaBase);
  basePath = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
} catch {
  basePath = '/';
}

const distDir         = path.join(pkgRoot, 'dist', 'public');
const snapshotDir     = path.join(pkgRoot, 'dist', '_ota_snapshot');

// ── PASS 1: clean build for the OTA bundle ────────────────────────────
console.log(
  `release-gh-pages: → PASS 1 — clean build (no BASE_PATH) for OTA bundle`,
);
run('pnpm', ['build'], {
  VITE_OTA_BASE_URL: otaBase,
  // Explicitly clear BASE_PATH in case the shell already had one set.
  BASE_PATH: '/',
});

// Snapshot the clean dist/public to a sibling dir BEFORE pass 2
// overwrites it with the Pages-flavoured build.
if (existsSync(snapshotDir)) rmSync(snapshotDir, { recursive: true, force: true });
console.log(`release-gh-pages: → snapshotting clean build to ${path.relative(pkgRoot, snapshotDir)}`);
cpSync(distDir, snapshotDir, { recursive: true });

// ── PASS 2: Pages-flavoured build (with BASE_PATH) for docs/ ──────────
console.log(
  `release-gh-pages: → PASS 2 — BASE_PATH=${basePath} build for GitHub Pages`,
);
run('pnpm', ['build'], {
  VITE_OTA_BASE_URL: otaBase,
  BASE_PATH: basePath,
});

// ── PASS 3: zip from snapshot, mirror Pages build to docs/ ────────────
console.log(
  'release-gh-pages: → publish-bundle (zip from snapshot, mirror Pages build to ../../docs)',
);
run('node', ['scripts/publish-bundle.mjs'], {
  OTA_BASE_URL: otaBase,
  OTA_OUTPUT_DIR: '../../docs',
  // Tell publish-bundle to zip the CLEAN snapshot for the OTA bundle.
  // The version.json + docs mirror still come from dist/public (the
  // Pages build) so the published web site keeps its `/REPO/` prefix.
  BUNDLE_SOURCE_DIR: 'dist/_ota_snapshot',
  // Upload the zip as a GitHub Release asset instead of committing it
  // into docs/bundles/. Keeps the repo small as releases pile up.
  // Set USE_GH_RELEASES=0 to fall back to the legacy raw.github path.
  USE_GH_RELEASES: process.env.USE_GH_RELEASES ?? '1',
});

// Clean up snapshot — keeps `dist/` tidy and avoids confusion next time.
console.log('release-gh-pages: → cleaning up snapshot dir');
rmSync(snapshotDir, { recursive: true, force: true });

console.log('release-gh-pages: ✓ done.');

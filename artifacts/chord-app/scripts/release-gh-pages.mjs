#!/usr/bin/env node
/**
 * release-gh-pages — cross-platform orchestrator that runs `pnpm build`
 * followed by `publish-bundle.mjs`, mirroring the result into
 * `../../docs/` so it can be committed and served by GitHub Pages.
 *
 * Why a JS wrapper instead of a one-line npm script?
 *   - The previous script used POSIX inline env-var syntax
 *     (`OTA_BASE_URL=foo node ...`) which fails on Windows cmd/PowerShell.
 *   - Spawning Node here lets us set env vars and run subcommands
 *     identically on every OS, with no `cross-env` dependency needed.
 *
 * Usage:
 *   $env:OTA_BASE_URL = "https://USER.github.io/REPO"   # PowerShell
 *   pnpm release:gh-pages
 *
 *   OTA_BASE_URL=https://USER.github.io/REPO pnpm release:gh-pages   # bash
 *
 * The OTA_BASE_URL env var MUST be set — without it the published
 * bundle has no absolute download URL and the APK can't fetch it.
 */
import { spawnSync } from 'node:child_process';
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

// CRITICAL: Vite reads VITE_OTA_BASE_URL at build time and bakes the
// resolved value into the JS bundle that ships inside the APK. Without
// this the native OTA checker has nowhere to look and silently disables
// itself — the banner never appears on the phone. We set it here so a
// release-time rebuild always has the right URL pinned.
//
// ALSO CRITICAL: when serving from GitHub Pages at a project subpath
// (e.g. https://USER.github.io/REPO), Vite must build with
// `base: "/REPO/"` so every asset URL in the emitted index.html is
// rewritten from `/assets/foo.js` → `/REPO/assets/foo.js`. Without
// this the splash screen renders (it's inline in index.html) but every
// downstream chunk 404s and the page stays gray. We derive the basePath
// from OTA_BASE_URL automatically so the release script remains a
// single source of truth.
let basePath = '/';
try {
  const u = new URL(otaBase);
  // u.pathname is `/REPO` for `https://user.github.io/REPO`, or `/`
  // for a user/org root site. Trailing slash MUST be present so
  // Vite emits `/REPO/assets/...` not `/REPOassets/...`.
  basePath = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
} catch {
  basePath = '/';
}
console.log(`release-gh-pages: → pnpm build (BASE_PATH=${basePath}, VITE_OTA_BASE_URL=${otaBase})`);
run('pnpm', ['build'], {
  VITE_OTA_BASE_URL: otaBase,
  BASE_PATH: basePath,
});

console.log('release-gh-pages: → publish-bundle.mjs (mirroring into ../../docs)');
run('node', ['scripts/publish-bundle.mjs'], {
  OTA_BASE_URL: otaBase,
  OTA_OUTPUT_DIR: '../../docs',
});

console.log('release-gh-pages: ✓ done.');

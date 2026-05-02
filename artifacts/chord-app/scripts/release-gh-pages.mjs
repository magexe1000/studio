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

console.log('release-gh-pages: → pnpm build');
run('pnpm', ['build']);

console.log('release-gh-pages: → publish-bundle.mjs (mirroring into ../../docs)');
run('node', ['scripts/publish-bundle.mjs'], {
  OTA_BASE_URL: otaBase,
  OTA_OUTPUT_DIR: '../../docs',
});

console.log('release-gh-pages: ✓ done.');

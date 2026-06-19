#!/usr/bin/env node
/**
 * build-audio-manifest — walks `public/drums/` and writes
 * `public/audio-manifest.json` listing every file with a leading "/".
 *
 * The manifest is consumed by `src/lib/assetCache.ts` on first native
 * launch to seed the persistent Data-directory cache. Generated as a
 * prebuild step so it always reflects the current state of the
 * `public/drums/` tree without anyone having to remember to re-run it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const drumsDir = path.join(root, 'public/drums');
const outPath = path.join(root, 'public/audio-manifest.json');

if (!fs.existsSync(drumsDir)) {
  console.warn('build-audio-manifest: ⚠ public/drums/ missing — writing empty manifest.');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), files: [] }, null, 2) + '\n',
  );
  process.exit(0);
}

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile()) {
      // Convert absolute filesystem path → web-root-relative URL.
      // path.relative gives `drums/realistic/.../foo.opus` on POSIX
      // and `drums\realistic\...` on Windows; normalise to forward
      // slashes so the manifest is portable.
      const rel = path
        .relative(path.join(root, 'public'), full)
        .split(path.sep)
        .join('/');
      files.push(`/${rel}`);
    }
  }
}
walk(drumsDir);

// Sort for deterministic output — keeps git diffs of the manifest
// minimal when only a handful of files change.
files.sort();

const manifest = {
  generatedAt: new Date().toISOString(),
  files,
};
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  `build-audio-manifest: ✓ wrote ${path.relative(root, outPath)} (${files.length} files)`,
);

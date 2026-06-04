#!/usr/bin/env node
/**
 * sync-version — keeps `public/version.json` in lockstep with the
 * bundle's `APP_VERSION` (and `APP_CHANGELOG`) so the two cannot
 * drift. Run automatically before every `vite build` via the
 * `prebuild` npm hook; safe to run by hand too.
 *
 * Source of truth:  CHANGELOG.md (repo root) & src/lib/appVersion.ts
 * Generates:        public/version.json     ({ version, changelog, releaseNotes, mandatory })
 *                   repo-root/release-notes.md (Markdown release notes)
 * Updates:          src/lib/appVersion.ts   (APP_CHANGELOG_SECTIONS)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '../..');
const sourcePath = path.join(root, 'src/lib/appVersion.ts');
const outPath = path.join(root, 'public/version.json');

const preserveNewer = process.argv.includes('--preserve-newer');

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

// 1. Synchronize CHANGELOG.md from repo root if present
const rootChangelogPath = path.join(repoRoot, 'CHANGELOG.md');
const localChangelogPath = path.join(root, 'CHANGELOG.md');
if (fs.existsSync(rootChangelogPath)) {
  fs.copyFileSync(rootChangelogPath, localChangelogPath);
  console.log(`sync-version: ✓ synchronized local CHANGELOG.md from repo root`);
}

// 2. Get version from src/lib/appVersion.ts
const src = fs.readFileSync(sourcePath, 'utf8');
const versionMatch = src.match(/export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  console.error(`sync-version: ✗ could not find APP_VERSION in ${sourcePath}`);
  console.error("  Expected:  export const APP_VERSION = 'X.Y.Z';");
  process.exit(1);
}
const version = versionMatch[1];

// 3. Open and parse CHANGELOG.md
if (!fs.existsSync(localChangelogPath)) {
  console.error(`sync-version: ✗ Release blocked: CHANGELOG.md not found at ${localChangelogPath}`);
  process.exit(1);
}

const changelogText = fs.readFileSync(localChangelogPath, 'utf8');
const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const re = new RegExp(
  `^##\\s+${esc}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
  'm'
);
const match = changelogText.match(re);

if (!match) {
  console.error(`\x1b[31msync-version: ✗ Release blocked: missing changelog entry for version ${version} in CHANGELOG.md. Add real release notes before publishing.\x1b[0m`);
  process.exit(1);
}

const sectionContent = match[1].trim();
if (!sectionContent) {
  console.error(`\x1b[31msync-version: ✗ Release blocked: changelog entry for version ${version} is empty. Add real release notes before publishing.\x1b[0m`);
  process.exit(1);
}

if (sectionContent.toLowerCase() === `version ${version}`.toLowerCase() ||
    sectionContent.toLowerCase() === `release v${version}`.toLowerCase() ||
    sectionContent.toLowerCase() === `version: ${version}`.toLowerCase()) {
  console.error(`\x1b[31msync-version: ✗ Release blocked: changelog entry for version ${version} contains only generic placeholder text. Add real release notes before publishing.\x1b[0m`);
  process.exit(1);
}

// Extract bullets and structure by category (Added, Improved, Fixed)
const categories = {
  added: [],
  improved: [],
  fixed: []
};

const lines = sectionContent.split('\n');
let currentCategory = null;
const flatBullets = [];

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;

  // Detect category headings
  const hMatch = line.match(/^###\s+(Added|Improved|Fixed|Changes|Bug\s*Fixes|Fixes)\b/i);
  if (hMatch) {
    const heading = hMatch[1].toLowerCase();
    if (heading.startsWith('add')) {
      currentCategory = 'added';
    } else if (heading.startsWith('improv')) {
      currentCategory = 'improved';
    } else if (heading.startsWith('fix') || heading.startsWith('bug')) {
      currentCategory = 'fixed';
    } else {
      currentCategory = null;
    }
    continue;
  }

  // Detect bullets starting with - or *
  const bMatch = line.match(/^[-*]\s+(.*)$/);
  if (bMatch) {
    const bulletContent = bMatch[1].trim();
    if (currentCategory) {
      categories[currentCategory].push(bulletContent);
    }
    flatBullets.push(bulletContent);
  }
}

if (flatBullets.length === 0) {
  console.error(`\x1b[31msync-version: ✗ Release blocked: changelog entry for version ${version} has no meaningful bullet points. Add real release notes before publishing.\x1b[0m`);
  process.exit(1);
}

const changelog = flatBullets.map(b => `• ${b}`).join('\n');
const releaseNotes = {
  added: categories.added.length > 0 ? categories.added : undefined,
  improved: categories.improved.length > 0 ? categories.improved : undefined,
  fixed: categories.fixed.length > 0 ? categories.fixed : undefined
};

console.log(`sync-version: ✓ Validated changelog for version ${version}. Found ${flatBullets.length} bullets.`);

// 4. Write to release-notes.md in repo root for GitHub Release usage
const releaseNotesMdPath = path.join(repoRoot, 'release-notes.md');
fs.writeFileSync(releaseNotesMdPath, sectionContent + '\n', 'utf8');
console.log(`sync-version: ✓ Wrote repo-root/release-notes.md`);

// 5. Rewrite APP_CHANGELOG_SECTIONS in src/lib/appVersion.ts
let tsSections = 'export const APP_CHANGELOG_SECTIONS: ChangelogSection[] = [\n';
if (categories.added.length > 0) {
  tsSections += '  {\n    heading: "Added",\n    items: [\n' + categories.added.map(i => `      ${JSON.stringify(i)},`).join('\n') + '\n    ],\n  },\n';
}
if (categories.improved.length > 0) {
  tsSections += '  {\n    heading: "Improved",\n    items: [\n' + categories.improved.map(i => `      ${JSON.stringify(i)},`).join('\n') + '\n    ],\n  },\n';
}
if (categories.fixed.length > 0) {
  tsSections += '  {\n    heading: "Fixed",\n    items: [\n' + categories.fixed.map(i => `      ${JSON.stringify(i)},`).join('\n') + '\n    ],\n  },\n';
}
tsSections += '];';

const changelogSectionsPat = /export\s+const\s+APP_CHANGELOG_SECTIONS:\s*ChangelogSection\[\]\s*=\s*\[([\s\S]*?)\]\s*;/;
if (changelogSectionsPat.test(src)) {
  const updatedSrc = src.replace(changelogSectionsPat, tsSections);
  if (updatedSrc !== src) {
    fs.writeFileSync(sourcePath, updatedSrc, 'utf8');
    console.log(`sync-version: ✓ updated APP_CHANGELOG_SECTIONS in ${path.relative(root, sourcePath)}`);
  }
} else {
  console.warn(`sync-version: ⚠ Could not find APP_CHANGELOG_SECTIONS pattern in ${sourcePath}`);
}

const payload = {
  version,
  changelog,
  releaseNotes,
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

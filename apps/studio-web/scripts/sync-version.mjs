#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '../..');
const sourcePath = path.join(repoRoot, 'packages/studio-core/src/lib/appVersion.ts');
const outPath = path.join(root, 'public/version.json');
const localChangelogPath = path.join(root, 'CHANGELOG.md');

// 1. Synchronize CHANGELOG.md from repo root if present
const rootChangelogPath = path.join(repoRoot, 'CHANGELOG.md');
if (fs.existsSync(rootChangelogPath)) {
  fs.copyFileSync(rootChangelogPath, localChangelogPath);
  console.log(`sync-version (web): ✓ synchronized local CHANGELOG.md from repo root`);
}

// 2. Get version from src/lib/appVersion.ts
if (!fs.existsSync(sourcePath)) {
  console.error(`sync-version (web): ✗ could not find appVersion.ts at ${sourcePath}`);
  process.exit(1);
}
const src = fs.readFileSync(sourcePath, 'utf8');

let gitCommitSha = 'unknown';
try {
  gitCommitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch (e) {
  console.warn('sync-version (web): ⚠ Could not get git commit SHA:', e.message);
}
const buildTimestamp = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

const versionMatch = src.match(/export\s+const\s+WEB_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  console.error(`sync-version (web): ✗ could not find WEB_VERSION in ${sourcePath}`);
  process.exit(1);
}
const version = versionMatch[1];

// 3. Open and parse CHANGELOG.md if exists
let changelog = '';
let releaseNotes = undefined;
if (fs.existsSync(localChangelogPath)) {
  const changelogText = fs.readFileSync(localChangelogPath, 'utf8');
  const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^##\\s+${esc}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'm');
  const match = changelogText.match(re);
  if (match) {
    const sectionContent = match[1].trim();
    const flatBullets = [];
    const categories = { added: [], improved: [], fixed: [], changed: [] };
    const lines = sectionContent.split('\n');
    let currentCategory = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const hMatch = line.match(/^###\s+(Added|Improved|Fixed|Changes|Bug\s*Fixes|Fixes|Changed)\b/i);
      if (hMatch) {
        const heading = hMatch[1].toLowerCase();
        if (heading.startsWith('add')) currentCategory = 'added';
        else if (heading.startsWith('improv')) currentCategory = 'improved';
        else if (heading.startsWith('fix') || heading.startsWith('bug')) currentCategory = 'fixed';
        else if (heading.startsWith('change')) currentCategory = 'changed';
        else currentCategory = null;
        continue;
      }
      const bMatch = line.match(/^[-*]\s+(.*)$/);
      if (bMatch) {
        const bulletContent = bMatch[1].trim();
        if (currentCategory) categories[currentCategory].push(bulletContent);
        flatBullets.push(bulletContent);
      }
    }
    changelog = flatBullets.map(b => `• ${b}`).join('\n');
    releaseNotes = {
      added: categories.added.length > 0 ? categories.added : undefined,
      improved: categories.improved.length > 0 ? categories.improved : undefined,
      fixed: categories.fixed.length > 0 ? categories.fixed : undefined,
      changed: categories.changed.length > 0 ? categories.changed : undefined
    };
  }
}

const payload = {
  platform: 'web',
  version,
  commit: gitCommitSha,
  releasedAt: buildTimestamp,
  buildTimestamp,
  updateMode: 'refresh',
  changelog,
  whatsNew: changelog,
  releaseNotes,
  mandatory: false,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(`sync-version (web): ✓ wrote ${path.relative(root, outPath)} (version=${version})`);

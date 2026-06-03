#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs, { cpSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgRoot, '../..');

const otaBase = 'https://studio-30f44.web.app';
const firebasePublicDir = path.join(repoRoot, 'firebase-public');
const firebaseOtaDir = path.join(firebasePublicDir, 'ota');

// ── Auto-bump APP_VERSION in src/lib/appVersion.ts ────────────────────
const appVersionPath = path.join(pkgRoot, 'src', 'lib', 'appVersion.ts');
let version = '0.0.0';
if (existsSync(appVersionPath)) {
  const versionSrc = readFileSync(appVersionPath, 'utf8');
  const versionMatch = versionSrc.match(/export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (versionMatch) {
    const currentVersion = versionMatch[1];
    version = currentVersion;
    
    // Check if custom version is passed via command line (e.g., --version 3.0.79)
    const versionArgIndex = process.argv.indexOf('--version');
    const noBump = process.argv.includes('--no-bump');
    let nextVersion = null;
    if (noBump) {
      nextVersion = currentVersion;
    } else if (versionArgIndex !== -1 && process.argv[versionArgIndex + 1]) {
      nextVersion = process.argv[versionArgIndex + 1];
    } else {
      // Auto-increment the patch version (rolling over from 99 to minor version)
      const parts = currentVersion.split('.');
      if (parts.length === 3 && parts.every(p => /^\d+$/.test(p))) {
        if (parts[2] === '99') {
          parts[1] = String(Number(parts[1]) + 1);
          parts[2] = '0';
        } else {
          parts[2] = String(Number(parts[2]) + 1);
        }
        nextVersion = parts.join('.');
      }
    }
    
    if (nextVersion && nextVersion !== currentVersion) {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      let newSrc = versionSrc;
      newSrc = newSrc.replace(
        /export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/,
        `export const APP_VERSION = '${nextVersion}'`
      );
      newSrc = newSrc.replace(
        /export\s+const\s+APP_VERSION_DATE\s*=\s*['"]([^'"]+)['"]\s*;\s*\/\/\s*[^\r\n]*/,
        `export const APP_VERSION_DATE = '${dateString}'; // ${nextVersion}`
      );
      
      writeFileSync(appVersionPath, newSrc, 'utf8');
      console.log(`release-firebase: → Auto-bumped version in appVersion.ts: ${currentVersion} → ${nextVersion} (date: ${dateString})`);
      version = nextVersion;
    } else {
      console.log(`release-firebase: → Keeping current version ${currentVersion}`);
    }
  } else {
    console.warn(`release-firebase: ⚠ Could not find APP_VERSION in ${appVersionPath}`);
  }
} else {
  console.warn(`release-firebase: ⚠ ${appVersionPath} does not exist. Skipping auto-bump.`);
}

// Update other version configurations
console.log('release-firebase: → Running version-sync...');
const syncResult = spawnSync('node', ['scripts/sync-version.mjs'], {
  cwd: pkgRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (syncResult.status !== 0) {
  process.exit(syncResult.status ?? 1);
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

// ── Build PWA for Firebase ──────────────────────────────────────────
console.log(`release-firebase: → Building Vite application for Firebase Hosting...`);
run('pnpm', ['build'], {
  VITE_OTA_BASE_URL: otaBase,
  BASE_PATH: '/',
});

const distDir = path.join(pkgRoot, 'dist', 'public');
if (!existsSync(distDir)) {
  console.error(`release-firebase: ✗ Build output ${distDir} does not exist.`);
  process.exit(1);
}

// Make sure target directories exist
mkdirSync(firebaseOtaDir, { recursive: true });

// ── Build the OTA Zip bundle ─────────────────────────────────────────
const zipName = `studio-ota-${version}.zip`;
const zipPath = path.join(firebaseOtaDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);

console.log(`release-firebase: → Zipping OTA bundle to ${path.relative(repoRoot, zipPath)}`);

await new Promise((resolve, reject) => {
  const writeStream = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  writeStream.on('close', resolve);
  writeStream.on('error', reject);
  archive.on('error', reject);
  archive.pipe(writeStream);
  
  const slim = process.env.OTA_SLIM !== '0';
  const ignore = ['bundles/**', 'version.json', 'app-release.json'];
  if (slim) {
    ignore.push('drums/**');
    console.log('release-firebase: → OTA_SLIM=1 (default) — excluding drums/** from bundle');
  }
  archive.glob('**/*', {
    cwd: distDir,
    dot: false,
    ignore,
  });
  archive.finalize();
});

const sizeKb = (statSync(zipPath).size / 1024).toFixed(1);
console.log(`release-firebase: ✓ Created bundle zip (${sizeKb} KB)`);

// ── Copy all web assets into the Firebase public directory ────────────
console.log(`release-firebase: → Copying assets from dist/public to firebase-public`);
function copyTree(srcRoot, dstRoot, skip = new Set()) {
  for (const entry of readdirSync(srcRoot, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const s = path.join(srcRoot, entry.name);
    const d = path.join(dstRoot, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(d, { recursive: true });
      copyTree(s, d, skip);
    } else if (entry.isFile()) {
      copyFileSync(s, d);
    }
  }
}
copyTree(distDir, firebasePublicDir, new Set(['bundles', 'version.json', 'app-release.json']));

// ── Parse CHANGELOG.md for the current version ───────────────────────
const changelogPath = path.join(pkgRoot, 'CHANGELOG.md');
let changelog = `Version ${version}`;
if (existsSync(changelogPath)) {
  const text = readFileSync(changelogPath, 'utf8');
  const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `^##\\s+${esc}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
    'm',
  );
  const match = text.match(re);
  if (match) {
    const lines = match[1].split('\n');
    const bullets = [];
    let current = null;
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^\s*-\s+/.test(line)) {
        if (current) bullets.push(current);
        current = '• ' + line.replace(/^\s*-\s+/, '').trim();
      } else if (/^\s+\S/.test(line) && current) {
        current += ' ' + line.trim();
      } else if (line.trim() === '' && current) {
        bullets.push(current);
        current = null;
      }
    }
    if (current) bullets.push(current);
    if (bullets.length > 0) {
      changelog = bullets.join('\n');
    }
  }
}

// ── Update version.json with the absolute Firebase download URL ────────
const versionJsonPath = path.join(firebasePublicDir, 'version.json');
const existing = existsSync(versionJsonPath)
  ? JSON.parse(readFileSync(versionJsonPath, 'utf8'))
  : { mandatory: false };

existing.version = version;
existing.changelog = changelog;
existing.downloadUrl = `${otaBase}/ota/${zipName}`;

writeFileSync(versionJsonPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
console.log(`release-firebase: ✓ Wrote ${path.relative(repoRoot, versionJsonPath)}`);

console.log('release-firebase: ✓ Done.');

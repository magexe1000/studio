#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs, { cpSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync, copyFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgRoot, '../..');

// Load .env file if it exists in pkgRoot
const envPath = path.join(pkgRoot, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  }
}

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

// Validate Supabase build configuration
console.log('release-firebase: → Validating build gates...');
const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const syncBackendProvider = (process.env.VITE_SYNC_BACKEND_PROVIDER || '').trim();

if (!supabaseUrl || !supabaseAnonKey || syncBackendProvider !== 'supabase-realtime') {
  console.error('\x1b[31mrelease-firebase: ✗ Supabase config missing. Refusing to build a Supabase sync release.\x1b[0m');
  console.error(`VITE_SUPABASE_URL present: ${supabaseUrl ? 'Yes' : 'No'}`);
  console.error(`VITE_SUPABASE_ANON_KEY present: ${supabaseAnonKey ? 'Yes' : 'No'}`);
  console.error(`VITE_SYNC_BACKEND_PROVIDER: ${syncBackendProvider}`);
  process.exit(1);
}

const supabaseHost = (() => {
  try { return new URL(supabaseUrl).host; } catch (_) { return 'invalid-url'; }
})();
console.log('release-firebase: VITE_SUPABASE_URL present: Yes');
console.log(`release-firebase: VITE_SUPABASE_URL host: ${supabaseHost}`);
console.log('release-firebase: VITE_SUPABASE_ANON_KEY present: Yes');
console.log(`release-firebase: VITE_SUPABASE_ANON_KEY length: ${supabaseAnonKey.length}`);
console.log(`release-firebase: VITE_SUPABASE_ANON_KEY prefix: ${supabaseAnonKey.slice(0, 8)}`);
console.log(`release-firebase: VITE_SYNC_BACKEND_PROVIDER: ${syncBackendProvider}`);

console.log('release-firebase: ✓ Supabase build gate validation passed.');

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

console.log('release-firebase: → Running AppInstaller contract validation...');
const validateResult = spawnSync('node', ['scripts/validate-app-installer.mjs', '--allow-missing-apk'], {
  cwd: pkgRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (validateResult.status !== 0) {
  console.error('release-firebase: ✗ AppInstaller contract validation failed!');
  process.exit(validateResult.status ?? 1);
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

// Zipping OTA bundle is disabled. All updates are delivered as complete signed APKs.

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

// ── Parse and Validate CHANGELOG.md for the current version ───────────
const changelogPath = path.join(pkgRoot, 'CHANGELOG.md');
if (!existsSync(changelogPath)) {
  console.error(`release-firebase: ✗ Release blocked: CHANGELOG.md not found at ${changelogPath}`);
  process.exit(1);
}

const changelogText = readFileSync(changelogPath, 'utf8');
const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const re = new RegExp(
  `^##\\s+${esc}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
  'm'
);
const match = changelogText.match(re);

if (!match) {
  console.error(`\x1b[31mrelease-firebase: ✗ Release blocked: missing changelog entry for version ${version} in CHANGELOG.md. Add real release notes before publishing.\x1b[0m`);
  process.exit(1);
}

const sectionContent = match[1].trim();
if (!sectionContent) {
  console.error(`\x1b[31mrelease-firebase: ✗ Release blocked: changelog entry for version ${version} is empty. Add real release notes before publishing.\x1b[0m`);
  process.exit(1);
}

if (sectionContent.toLowerCase() === `version ${version}`.toLowerCase() ||
    sectionContent.toLowerCase() === `release v${version}`.toLowerCase() ||
    sectionContent.toLowerCase() === `version: ${version}`.toLowerCase()) {
  console.error(`\x1b[31mrelease-firebase: ✗ Release blocked: changelog entry for version ${version} contains only generic placeholder text. Add real release notes before publishing.\x1b[0m`);
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
  console.error(`\x1b[31mrelease-firebase: ✗ Release blocked: changelog entry for version ${version} has no meaningful bullet points. Add real release notes before publishing.\x1b[0m`);
  process.exit(1);
}

// For version.json changelog
const changelog = flatBullets.map(b => `• ${b}`).join('\n');
const releaseNotes = {
  added: categories.added.length > 0 ? categories.added : undefined,
  improved: categories.improved.length > 0 ? categories.improved : undefined,
  fixed: categories.fixed.length > 0 ? categories.fixed : undefined
};

console.log(`release-firebase: ✓ Validated changelog for version ${version}. Found ${flatBullets.length} bullets.`);

// Write to release-notes.md in repo root for GitHub Release usage
const releaseNotesMdPath = path.join(repoRoot, 'release-notes.md');
writeFileSync(releaseNotesMdPath, sectionContent + '\n', 'utf8');
console.log(`release-firebase: ✓ Wrote ${path.relative(repoRoot, releaseNotesMdPath)}`);

// ── Update version.json ────────────────────────────────────────────────
const versionJsonPath = path.join(firebasePublicDir, 'version.json');
const existing = existsSync(versionJsonPath)
  ? JSON.parse(readFileSync(versionJsonPath, 'utf8'))
  : { mandatory: false };

existing.version = version;
existing.changelog = changelog;
existing.releaseNotes = releaseNotes;
if (existing.downloadUrl) delete existing.downloadUrl; // Strip any legacy OTA downloadUrl

writeFileSync(versionJsonPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
console.log(`release-firebase: ✓ Wrote ${path.relative(repoRoot, versionJsonPath)}`);

// Helper to compute SHA-256 of a file
function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// =========================================================================
// ── 15-STEP RELEASE ORCHESTRATION PIPELINE ────────────────────────────────
// =========================================================================
console.log('\n=== STARTING 15-STEP RELEASE ORCHESTRATION ===\n');

// crypto is imported at the top level

// Step 1: Build Frontend (already executed via Vite build earlier in this script)
console.log('Step 1/15: Build Frontend ... [DONE]');

// Step 2: Sync Capacitor
console.log('Step 2/15: Sync Capacitor...');
run('npx', ['cap', 'sync', 'android']);

// Step 3: Build signed Android release APK
console.log('Step 3/15: Build signed Android release APK...');

// Guard: reject hardcoded local JDK paths in committed Gradle config
const gradlePropsPath = path.join(pkgRoot, 'android', 'gradle.properties');
if (existsSync(gradlePropsPath)) {
  const gp = readFileSync(gradlePropsPath, 'utf8');
  const badPatterns = [
    /org\.gradle\.java\.home\s*=\s*C:/i,
    /org\.gradle\.java\.home\s*=\s*\/Users\//,
    /org\.gradle\.java\.home\s*=\s*\/home\//,
    /Eclipse Adoptium/i,
    /Program Files/i,
  ];
  for (const pat of badPatterns) {
    if (pat.test(gp)) {
      console.error(`\\x1b[31mrelease-firebase: ✗ Hardcoded org.gradle.java.home detected in gradle.properties.\\x1b[0m`);
      console.error('  Do not commit local JDK paths. Use JAVA_HOME from the environment instead.');
      console.error(`  Matched pattern: ${pat}`);
      process.exit(1);
    }
  }
  console.log('release-firebase: ✓ No hardcoded Java paths in gradle.properties');
}
const gradleCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
const gradleArgs = ['assembleRelease', '-x', 'lint', '-x', 'lintVitalRelease', '--stacktrace'];
const gradleCwd = path.join(pkgRoot, 'android');
const gradleEnv = { ...process.env };
if (gradleEnv.GITHUB_TOKEN === 'github_pat_antigravitydummytoken') {
  delete gradleEnv.GITHUB_TOKEN;
}

console.log(`release-firebase: Gradle command: ${gradleCmd} ${gradleArgs.join(' ')}`);
console.log(`release-firebase: Gradle cwd: ${gradleCwd}`);
console.log(`release-firebase: ANDROID_HOME: ${gradleEnv.ANDROID_HOME || '(not set)'}`);
console.log(`release-firebase: JAVA_HOME: ${gradleEnv.JAVA_HOME || '(not set)'}`);
console.log(`release-firebase: ANDROID_KEYSTORE_PASSWORD present: ${gradleEnv.ANDROID_KEYSTORE_PASSWORD ? 'Yes' : 'No'}`);
console.log(`release-firebase: ANDROID_KEY_ALIAS present: ${gradleEnv.ANDROID_KEY_ALIAS ? 'Yes' : 'No'}`);
console.log(`release-firebase: ANDROID_KEY_PASSWORD present: ${gradleEnv.ANDROID_KEY_PASSWORD ? 'Yes' : 'No'}`);

// Ensure gradlew is executable on Linux/macOS (defensive — the git
// index already has 100755, but some checkout tools strip the bit).
if (process.platform !== 'win32') {
  const gradlewPath = path.join(gradleCwd, 'gradlew');
  try {
    chmodSync(gradlewPath, 0o755);
    console.log(`release-firebase: chmod +x ${gradlewPath}`);
  } catch (e) {
    console.warn(`release-firebase: ⚠ chmod failed: ${e.message}`);
  }
}

const gradleResult = spawnSync(gradleCmd, gradleArgs, {
  cwd: gradleCwd,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: gradleEnv
});
if (gradleResult.status !== 0) {
  console.error(`release-firebase: ✗ Gradle build failed with exit code ${gradleResult.status}`);
  if (gradleResult.error) {
    console.error(`release-firebase: Gradle spawn error: ${gradleResult.error.message}`);
    if (gradleResult.error.code === 'EACCES') {
      console.error('release-firebase: ✗ Gradle wrapper is not executable.');
      console.error('  Fix: git update-index --chmod=+x artifacts/chord-app/android/gradlew');
      console.error('  And ensure CI runs: chmod +x ./gradlew before Gradle.');
    }
  }
  if (gradleResult.signal) {
    console.error(`release-firebase: Gradle killed by signal: ${gradleResult.signal}`);
  }
  console.error(`release-firebase: Hint — check Gradle logs at: ${path.join(gradleCwd, 'app', 'build', 'reports')}`);
  process.exit(gradleResult.status ?? 1);
}

// Step 4: Validate AppInstaller native plugin
console.log('Step 4/15: Validate AppInstaller native plugin...');
const appInstallerValidateResult = spawnSync('node', ['scripts/validate-app-installer.mjs'], {
  cwd: pkgRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (appInstallerValidateResult.status !== 0) {
  console.error('release-firebase: ✗ AppInstaller contract validation failed!');
  process.exit(appInstallerValidateResult.status ?? 1);
}

// Step 5: Validate APK metadata
console.log('Step 5/15: Validate APK metadata...');
let gradleVersionName = '';
let gradleVersionCode = 0;
const gradlePath = path.join(pkgRoot, 'android/app/build.gradle');
if (existsSync(gradlePath)) {
  const gradleSrc = readFileSync(gradlePath, 'utf8');
  const nameMatch = gradleSrc.match(/versionName\s+['"]([^'"]+)['"]/);
  const codeMatch = gradleSrc.match(/versionCode\s+(\d+)/);
  if (nameMatch) gradleVersionName = nameMatch[1];
  if (codeMatch) gradleVersionCode = parseInt(codeMatch[1], 10);
}
console.log(`release-firebase: build.gradle versionName = ${gradleVersionName}, versionCode = ${gradleVersionCode}`);
if (gradleVersionName !== version) {
  console.error(`release-firebase: ✗ versionName mismatch! build.gradle: ${gradleVersionName}, package.json: ${version}`);
  process.exit(1);
}

// Step 6: Generate local APK SHA-256
console.log('Step 6/15: Generate local APK SHA-256...');
const localApkPath = path.join(pkgRoot, 'android/app/build/outputs/apk/release/app-release.apk');
if (!existsSync(localApkPath)) {
  console.error(`release-firebase: ✗ APK not found at ${localApkPath}`);
  process.exit(1);
}
const localApkSha = computeSha256(localApkPath);
console.log(`release-firebase: Local APK SHA-256 = ${localApkSha}`);

// Step 7: Create GitHub Release tag if missing
console.log('Step 7/15: Create GitHub Release tag if missing...');
const tag = `v${version}`;
const titleText = `Studio v${version}`;
const releaseNotesFile = path.join(repoRoot, 'release-notes.md');

const runGh = (args) => {
  const env = { ...process.env };
  if (env.GITHUB_TOKEN === 'github_pat_antigravitydummytoken') {
    delete env.GITHUB_TOKEN;
  }
  return spawnSync('gh', args, {
    cwd: repoRoot,
    stdio: 'pipe',
    shell: process.platform === 'win32',
    env
  });
};

const viewRes = runGh(['release', 'view', tag, '--repo', 'MAGEXE1000/Studio']);
if (viewRes.status !== 0) {
  console.log(`release-firebase: Release ${tag} not found. Creating it...`);
  const createRes = runGh(['release', 'create', tag, '--title', titleText, '--notes-file', releaseNotesFile, '--repo', 'MAGEXE1000/Studio']);
  if (createRes.status !== 0) {
    console.error(`release-firebase: ✗ Failed to create GitHub Release: ${createRes.stderr.toString()}`);
    process.exit(1);
  }
} else {
  console.log(`release-firebase: Release ${tag} already exists. Updating notes...`);
  runGh(['release', 'edit', tag, '--notes-file', releaseNotesFile, '--repo', 'MAGEXE1000/Studio']);
}

// Step 8: Upload APK asset with exact expected name
console.log('Step 8/15: Upload APK asset with exact expected name...');
const uploadApkName = `studio-${version}.apk`;
const uploadShaName = `studio-${version}.sha256`;
const localUploadApkPath = path.join(repoRoot, uploadApkName);
const localUploadShaPath = path.join(repoRoot, uploadShaName);

copyFileSync(localApkPath, localUploadApkPath);
writeFileSync(localUploadShaPath, `${localApkSha}  ${uploadApkName}\n`, 'utf8');

const uploadRes = runGh(['release', 'upload', tag, localUploadApkPath, localUploadShaPath, '--clobber', '--repo', 'MAGEXE1000/Studio']);
if (uploadRes.status !== 0) {
  console.error(`release-firebase: ✗ Failed to upload APK asset to GitHub: ${uploadRes.stderr.toString()}`);
  process.exit(1);
}
console.log(`release-firebase: ✓ Uploaded assets ${uploadApkName} and ${uploadShaName}`);

try {
  rmSync(localUploadApkPath);
  rmSync(localUploadShaPath);
} catch (_) {}

// Step 9: Verify GitHub Release asset URL returns HTTP 200
console.log('Step 9/15: Verify GitHub Release asset URL returns HTTP 200...');
const githubApkUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`;

const checkUrl = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    return res.status;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`release-firebase: ⚠ Fetch error for ${url}:`, err.message);
    return 0;
  }
};

let status = await checkUrl(githubApkUrl);
console.log(`release-firebase: URL status for ${githubApkUrl} = ${status}`);
if (status !== 200) {
  console.error(`release-firebase: ✗ APK URL returned non-200 status code: ${status}`);
  process.exit(1);
}

// Step 10: Verify downloaded APK SHA-256 matches expected
console.log('Step 10/15: Verify downloaded APK SHA-256 matches expected...');
const downloadPath = path.join(pkgRoot, `.release-temp-verify-${version}.apk`);
const downloadFile = async (url, dest) => {
  let attempts = 5;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const buffer = await res.arrayBuffer();
      writeFileSync(dest, Buffer.from(buffer));
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.warn(`release-firebase: ⚠ Download attempt ${i} failed. Retrying in ${i * 2}s... Error: ${err.message || err}`);
      await new Promise(r => setTimeout(r, i * 2000));
    }
  }
};

try {
  console.log(`release-firebase: Downloading APK from ${githubApkUrl} to verify SHA...`);
  await downloadFile(githubApkUrl, downloadPath);
  const downloadedSha = computeSha256(downloadPath);
  rmSync(downloadPath);
  console.log(`release-firebase: Downloaded APK SHA-256 = ${downloadedSha}`);
  if (downloadedSha !== localApkSha) {
    console.error(`release-firebase: ✗ SHA-256 mismatch! Expected ${localApkSha}, got ${downloadedSha}`);
    process.exit(1);
  }
  console.log('release-firebase: ✓ Downloaded APK SHA matches local APK SHA exactly!');
} catch (err) {
  console.error('release-firebase: ✗ Download or verification failed:', err);
  if (existsSync(downloadPath)) rmSync(downloadPath);
  process.exit(1);
}

// Step 11: Generate version.json and app-release.json using verified URL/SHA
console.log('Step 11/15: Generate version.json and app-release.json using verified URL/SHA...');
const generateResult = spawnSync('node', ['scripts/generate-release-metadata.mjs'], {
  cwd: pkgRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (generateResult.status !== 0) {
  console.error('release-firebase: ✗ Metadata generation script failed!');
  process.exit(generateResult.status ?? 1);
}

// Step 12: Deploy Firebase Hosting
console.log('Step 12/15: Deploy Firebase Hosting...');
const fbDeployResult = spawnSync('npx', ['firebase-tools', 'deploy', '--project', 'studio-30f44', '--only', 'hosting'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (fbDeployResult.status !== 0) {
  console.error('release-firebase: ✗ Firebase deploy failed!');
  process.exit(fbDeployResult.status ?? 1);
}

// Step 13: Re-fetch deployed version.json and app-release.json
console.log('Step 13/15: Re-fetch deployed version.json and app-release.json...');
const deployedVersionUrl = `https://studio-30f44.web.app/version.json`;
const deployedAppReleaseUrl = `https://studio-30f44.web.app/app-release.json`;

const fetchJson = async (url) => {
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

let deployedVer, deployedAppRelease;
try {
  deployedVer = await fetchJson(deployedVersionUrl);
  deployedAppRelease = await fetchJson(deployedAppReleaseUrl);
  console.log('release-firebase: Deployed version.json version =', deployedVer.version);
  console.log('release-firebase: Deployed app-release.json version =', deployedAppRelease.version);
} catch (err) {
  console.error('release-firebase: ✗ Failed to fetch deployed metadata files:', err);
  process.exit(1);
}

// Step 14: Re-validate their APK URL and SHA
console.log('Step 14/15: Re-validate their APK URL and SHA...');
if (deployedVer.version !== version || deployedAppRelease.version !== version) {
  console.error(`release-firebase: ✗ Deployed version mismatch! Expected ${version}`);
  process.exit(1);
}
if (deployedAppRelease.sha256 !== localApkSha || deployedVer.sha256 !== localApkSha) {
  console.error(`release-firebase: ✗ Deployed SHA-256 mismatch! Deployed: ${deployedAppRelease.sha256}, Expected: ${localApkSha}`);
  process.exit(1);
}
const deployedApkUrlStatus = await checkUrl(deployedVer.apkUrl || deployedAppRelease.download_url);
if (deployedApkUrlStatus !== 200) {
  console.error(`release-firebase: ✗ Deployed APK URL is unreachable (HTTP ${deployedApkUrlStatus})`);
  process.exit(1);
}
console.log('release-firebase: ✓ Deployed metadata validated successfully!');

// Step 15: Print final release report
console.log('\n================================================================');
console.log('Step 15/15: Print final release report');
console.log('================================================================');
console.log(`Release Status:   SUCCESSFUL`);
console.log(`Version Released: ${version}`);
console.log(`Version Code:     ${gradleVersionCode}`);
console.log(`APK Download URL: ${githubApkUrl}`);
console.log(`APK SHA-256:      ${localApkSha}`);
console.log(`PWA Deployed:     https://studio-30f44.web.app/`);
console.log('================================================================\n');


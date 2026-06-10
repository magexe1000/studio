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

// ── Early Validation Checks ──────────────────────────────────────────
console.log('release-firebase: → Running early validation checks...');

// A. GH_TOKEN check
const ghToken = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim();
if (!ghToken || ghToken === 'github_pat_antigravitydummytoken') {
  console.error('\x1b[31mrelease-firebase: ✗ GITHUB_TOKEN / GH_TOKEN env variable is missing or invalid. Refusing to start release pipeline.\x1b[0m');
  process.exit(1);
}
console.log('release-firebase: ✓ GH_TOKEN presence validated.');

// B. CHANGELOG entry check
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

const categories = {
  added: [],
  improved: [],
  fixed: [],
  changed: []
};

const lines = sectionContent.split('\n');
let currentCategory = null;
const flatBullets = [];

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;

  const hMatch = line.match(/^###\s+(Added|Improved|Fixed|Changes|Bug\s*Fixes|Fixes|Changed)\b/i);
  if (hMatch) {
    const heading = hMatch[1].toLowerCase();
    if (heading.startsWith('add')) {
      currentCategory = 'added';
    } else if (heading.startsWith('improv')) {
      currentCategory = 'improved';
    } else if (heading.startsWith('fix') || heading.startsWith('bug')) {
      currentCategory = 'fixed';
    } else if (heading.startsWith('change')) {
      currentCategory = 'changed';
    } else {
      currentCategory = null;
    }
    continue;
  }

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

const changelog = flatBullets.map(b => `• ${b}`).join('\n');
const releaseNotes = {
  added: categories.added.length > 0 ? categories.added : undefined,
  improved: categories.improved.length > 0 ? categories.improved : undefined,
  fixed: categories.fixed.length > 0 ? categories.fixed : undefined,
  changed: categories.changed.length > 0 ? categories.changed : undefined
};

console.log(`release-firebase: ✓ Validated changelog for version ${version}. Found ${flatBullets.length} bullets.`);

// Write to release-notes.md in repo root
const releaseNotesMdPath = path.join(repoRoot, 'release-notes.md');
writeFileSync(releaseNotesMdPath, sectionContent + '\n', 'utf8');
console.log(`release-firebase: ✓ Wrote ${path.relative(repoRoot, releaseNotesMdPath)}`);

// Write temp notes file
const tempNotesPath = path.join(pkgRoot, '.release-temp-notes.json');
writeFileSync(tempNotesPath, JSON.stringify({ changelog, releaseNotes, description: changelog }, null, 2) + '\n', 'utf8');
console.log(`release-firebase: ✓ Wrote temporary notes to ${tempNotesPath}`);

// C. Verify versionName consistency
let gradleVersionName = '';
const gradlePath = path.join(pkgRoot, 'android/app/build.gradle');
if (existsSync(gradlePath)) {
  const gradleSrc = readFileSync(gradlePath, 'utf8');
  const nameMatch = gradleSrc.match(/versionName\s+['"]([^'"]+)['"]/);
  if (nameMatch) gradleVersionName = nameMatch[1];
}
if (gradleVersionName !== version) {
  console.error(`release-firebase: ✗ versionName mismatch! build.gradle: ${gradleVersionName}, package.json: ${version}`);
  process.exit(1);
}
console.log(`release-firebase: ✓ versionName is consistent: ${version}`);

// D. Check for hardcoded java home in gradle.properties
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
      console.error(`\x1b[31mrelease-firebase: ✗ Hardcoded org.gradle.java.home detected in gradle.properties.\x1b[0m`);
      console.error('  Do not commit local JDK paths. Use JAVA_HOME from the environment instead.');
      process.exit(1);
    }
  }
}
console.log('release-firebase: ✓ gradle.properties JVM configuration validated.');

// E. Chmod safety for gradlew
const gradleCwd = path.join(pkgRoot, 'android');
if (process.platform !== 'win32') {
  const gradlewPath = path.join(gradleCwd, 'gradlew');
  try {
    chmodSync(gradlewPath, 0o755);
    console.log(`release-firebase: chmod +x ${gradlewPath}`);
  } catch (e) {
    console.warn(`release-firebase: ⚠ chmod failed: ${e.message}`);
  }
}
console.log('release-firebase: ✓ gradlew permissions verified.');

// F. Validate Supabase build configuration
const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const syncBackendProvider = (process.env.VITE_SYNC_BACKEND_PROVIDER || '').trim();

if (!supabaseUrl || !supabaseAnonKey || syncBackendProvider !== 'supabase-realtime') {
  console.error('\x1b[31mrelease-firebase: ✗ Supabase config missing. Refusing to build a Supabase sync release.\x1b[0m');
  process.exit(1);
}
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

// ── Signing preflight — fail fast before expensive builds ───────────
const releaseType = process.env.RELEASE_TYPE || 'both';
if (process.env.CI && releaseType !== 'ota') {
  console.log('release-firebase: → Running signing preflight...');
  const ksPath = path.join(pkgRoot, 'android', 'app', 'release.keystore');
  const ksAlias = (process.env.ANDROID_KEY_ALIAS || '').trim();
  const ksPwd = (process.env.ANDROID_KEYSTORE_PASSWORD || '').trim();
  const expectedSig = (process.env.EXPECTED_SIGNATURE_SHA256 || '').replace(/:/g, '').toLowerCase().trim();

  console.log(`release-firebase: ANDROID_KEYSTORE_PASSWORD present: ${ksPwd ? 'Yes' : 'No'}`);
  console.log(`release-firebase: ANDROID_KEY_ALIAS present: ${ksAlias ? 'Yes' : 'No'}`);
  console.log(`release-firebase: ANDROID_KEY_PASSWORD present: ${process.env.ANDROID_KEY_PASSWORD ? 'Yes' : 'No'}`);
  console.log(`release-firebase: EXPECTED_SIGNATURE_SHA256: ${expectedSig || '(not set)'}`);
  console.log(`release-firebase: release.keystore exists: ${existsSync(ksPath) ? 'Yes' : 'No'}`);

  if (!existsSync(ksPath)) {
    console.error('\x1b[31mrelease-firebase: ✗ Signing preflight failed: release.keystore not found.\x1b[0m');
    console.error(`  Expected at: ${ksPath}`);
    console.error('  Ensure ANDROID_KEYSTORE_BASE64 is configured and the Decode step ran before this script.');
    process.exit(1);
  }
  if (!ksPwd || !ksAlias || !expectedSig) {
    console.error('\x1b[31mrelease-firebase: ✗ Signing preflight failed: missing signing env vars.\x1b[0m');
    process.exit(1);
  }

  // Extract certificate fingerprint from keystore using keytool
  try {
    const keytoolResult = spawnSync('keytool', [
      '-list', '-v',
      '-keystore', ksPath,
      '-alias', ksAlias,
      '-storepass', ksPwd,
    ], { encoding: 'utf8', timeout: 15000 });

    const keytoolOut = (keytoolResult.stdout || '') + (keytoolResult.stderr || '');
    const sha256Match = keytoolOut.match(/SHA256:\s+([A-Fa-f0-9:]+)/);
    if (!sha256Match) {
      console.error('\x1b[31mrelease-firebase: ✗ Signing preflight failed: could not extract SHA-256 from keytool output.\x1b[0m');
      // Print non-secret keytool output for debugging
      const safeLines = keytoolOut.split('\n').filter(l =>
        /alias|SHA256|valid|owner|issuer|entry type|certificate/i.test(l)
      );
      if (safeLines.length) console.error(safeLines.join('\n'));
      process.exit(1);
    }
    const actualFingerprint = sha256Match[1].replace(/:/g, '').toLowerCase();
    console.log(`release-firebase: Keystore alias "${ksAlias}" certificate SHA-256: ${actualFingerprint}`);
    
    const targetSig = process.env.REINSTALL_REQUIRED === 'true'
      ? '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206'
      : expectedSig;
      
    console.log(`release-firebase: Expected production SHA-256:                     ${targetSig}`);

    if (actualFingerprint !== targetSig) {
      console.error('\x1b[31mrelease-firebase: ✗ Signing preflight FAILED: keystore certificate does not match production fingerprint.\x1b[0m');
      console.error(`  Keystore fingerprint: ${actualFingerprint}`);
      console.error(`  Expected fingerprint: ${targetSig}`);
      console.error('');
      console.error('  The ANDROID_KEYSTORE_BASE64 secret contains the wrong keystore,');
      console.error('  or ANDROID_KEY_ALIAS points to the wrong alias.');
      console.error('');
      console.error('  Fix: update ANDROID_KEYSTORE_BASE64 in GitHub Secrets with the');
      console.error('  production keystore that signs with the expected fingerprint.');
      process.exit(1);
    }
    console.log('release-firebase: ✓ Signing preflight passed — keystore matches production certificate.');
  } catch (err) {
    console.error(`\x1b[31mrelease-firebase: ✗ Signing preflight error: ${err.message}\x1b[0m`);
    process.exit(1);
  }
} else {
  console.log('release-firebase: ⚠ Skipping signing preflight (not in CI).');
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

// (Changelog has been validated and parsed early)

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
if (releaseType !== 'ota') {
  run('npx', ['cap', 'sync', 'android']);
} else {
  console.log('Step 2/15: Sync Capacitor ... [SKIPPED - OTA mode]');
}

// Step 3: Build signed Android release APK
console.log('Step 3/15: Build signed Android release APK...');
if (releaseType !== 'ota') {
  const gradleCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
  const gradleArgs = ['assembleRelease', '-x', 'lint', '-x', 'lintVitalRelease', '--stacktrace'];
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
} else {
  console.log('Step 3/15: Build signed Android release APK ... [SKIPPED - OTA mode]');
}

// Step 4: Validate AppInstaller native plugin
console.log('Step 4/15: Validate AppInstaller native plugin...');
if (releaseType !== 'ota') {
  const appInstallerValidateResult = spawnSync('node', ['scripts/validate-app-installer.mjs'], {
    cwd: pkgRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (appInstallerValidateResult.status !== 0) {
    console.error('release-firebase: ✗ AppInstaller contract validation failed!');
    process.exit(appInstallerValidateResult.status ?? 1);
  }
} else {
  console.log('Step 4/15: Validate AppInstaller native plugin ... [SKIPPED - OTA mode]');
}

// Step 5: Validate APK metadata
console.log('Step 5/15: Validate APK metadata...');
if (releaseType !== 'ota') {
  gradleVersionName = '';
  let gradleVersionCode = 0;
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
} else {
  console.log('Step 5/15: Validate APK metadata ... [SKIPPED - OTA mode]');
}

// Step 6: Generate local APK SHA-256
console.log('Step 6/15: Generate local APK SHA-256...');
let localApkSha = '';
if (releaseType !== 'ota') {
  const localApkPath = path.join(pkgRoot, 'android/app/build/outputs/apk/release/app-release.apk');
  if (!existsSync(localApkPath)) {
    console.error(`release-firebase: ✗ APK not found at ${localApkPath}`);
    process.exit(1);
  }
  localApkSha = computeSha256(localApkPath);
  console.log(`release-firebase: Local APK SHA-256 = ${localApkSha}`);
} else {
  console.log('Step 6/15: Generate local APK SHA-256 ... [SKIPPED - OTA mode]');
}

// Step 7: Create GitHub Release tag if missing
console.log('Step 7/15: Create GitHub Release tag if missing...');
if (releaseType !== 'ota') {
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
} else {
  console.log('Step 7/15: Create GitHub Release tag if missing ... [SKIPPED - OTA mode]');
}

// Step 8: Upload APK asset with exact expected name
console.log('Step 8/15: Upload APK asset with exact expected name...');
if (releaseType !== 'ota') {
  const tag = `v${version}`;
  const uploadApkName = `studio-${version}.apk`;
  const uploadShaName = `studio-${version}.sha256`;
  const localUploadApkPath = path.join(repoRoot, uploadApkName);
  const localUploadShaPath = path.join(repoRoot, uploadShaName);

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
} else {
  console.log('Step 8/15: Upload APK asset with exact expected name ... [SKIPPED - OTA mode]');
}

// Step 9: Verify GitHub Release asset URL returns HTTP 200
console.log('Step 9/15: Verify GitHub Release asset URL returns HTTP 200...');
if (releaseType !== 'ota') {
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
} else {
  console.log('Step 9/15: Verify GitHub Release asset URL returns HTTP 200 ... [SKIPPED - OTA mode]');
}

// Step 10: Verify downloaded APK SHA-256 matches expected
console.log('Step 10/15: Verify downloaded APK SHA-256 matches expected...');
if (releaseType !== 'ota') {
  const githubApkUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`;
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
} else {
  console.log('Step 10/15: Verify downloaded APK SHA-256 matches expected ... [SKIPPED - OTA mode]');
}

// Step 11: Generate version.json and app-release.json using verified URL/SHA
console.log('Step 11/15: Generate version.json and app-release.json using verified URL/SHA...');
const generateResult = spawnSync('node', ['scripts/generate-release-metadata.mjs'], {
  cwd: pkgRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, RELEASE_TYPE: releaseType },
});
if (generateResult.status !== 0) {
  console.error('release-firebase: ✗ Metadata generation script failed!');
  process.exit(generateResult.status ?? 1);
}

// Step 12: Deploy Firebase Hosting
// In CI, deployment is handled by the workflow's FirebaseExtended/action-hosting-deploy
// action using the FIREBASE_SERVICE_ACCOUNT secret. The script only deploys locally.
if (process.env.CI) {
  console.log('Step 12/15: Deploy Firebase Hosting... [SKIPPED — CI workflow handles deployment via service account]');
} else {
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
}

// Steps 13-14: Re-fetch and validate deployed metadata
// In CI, these run as a separate workflow step AFTER the Firebase deploy action.
if (process.env.CI) {
  console.log('Step 13/15: Re-fetch deployed metadata... [SKIPPED — CI workflow verifies post-deploy]');
  console.log('Step 14/15: Re-validate deployed APK URL and SHA... [SKIPPED — CI workflow verifies post-deploy]');
} else {
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
}

// Step 15: Print final release report
console.log('\n================================================================');
console.log('Step 15/15: Print final release report');
console.log('================================================================');
console.log(`Release Status:   ${process.env.CI ? 'BUILD SUCCESSFUL (deploy pending via CI workflow)' : 'SUCCESSFUL'}`);
console.log(`Version Released: ${version}`);
console.log(`Version Code:     ${gradleVersionCode}`);
console.log(`APK Download URL: ${githubApkUrl}`);
console.log(`APK SHA-256:      ${localApkSha}`);
console.log(`PWA Deployed:     ${process.env.CI ? '(pending — CI workflow deploys next)' : 'https://studio-30f44.web.app/'}`);
console.log('================================================================\n');


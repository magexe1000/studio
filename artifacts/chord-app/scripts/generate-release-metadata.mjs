import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');

const releaseType = 'apk';

console.log('generate-release-metadata: → Running AppInstaller contract validation...');
const args = ['scripts/validate-app-installer.mjs'];
if (releaseType === 'ota') {
  args.push('--allow-missing-apk');
}
const validateResult = spawnSync('node', args, {
  cwd: appRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (validateResult.status !== 0) {
  const status = validateResult.status;
  if (status === 10) {
    console.error('generate-release-metadata: ✗ AppInstaller contract validation failed!');
  } else if (status === 11) {
    console.error('generate-release-metadata: ✗ Path or temporary file setup failed!');
  } else if (status === 12) {
    console.error('generate-release-metadata: ✗ Previous APK download failed!');
  } else if (status === 13) {
    console.error('generate-release-metadata: ✗ Release validation failed (e.g. versionCode, package, or signatures)!');
  } else {
    console.error(`generate-release-metadata: ✗ Validation script failed with exit code ${status}`);
  }
  process.exit(status ?? 1);
}

const appVersionPath = path.join(appRoot, 'src/lib/appVersion.ts');
const versionJsonPath = path.join(repoRoot, 'firebase-public/version.json');
const appReleaseJsonPath = path.join(repoRoot, 'firebase-public/app-release.json');

// Get version from appVersion.ts
const src = fs.readFileSync(appVersionPath, 'utf8');
const versionMatch = src.match(/export\s+const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  console.error('generate-release-metadata: ✗ could not find APP_VERSION');
  process.exit(1);
}
const version = versionMatch[1];

// Read changelog description and releaseNotes from temp notes JSON if it exists, otherwise from version.json
let description = `Release v${version}`;
let releaseNotes = undefined;
const tempNotesPath = path.join(appRoot, '.release-temp-notes.json');

if (fs.existsSync(tempNotesPath)) {
  try {
    const tempNotes = JSON.parse(fs.readFileSync(tempNotesPath, 'utf8'));
    if (tempNotes.changelog) {
      description = tempNotes.changelog;
    }
    if (tempNotes.releaseNotes) {
      releaseNotes = tempNotes.releaseNotes;
    }
    console.log('generate-release-metadata: ✓ Loaded release notes from .release-temp-notes.json');
  } catch (err) {
    console.warn('generate-release-metadata: ⚠ Could not parse .release-temp-notes.json', err);
  }
} else if (fs.existsSync(versionJsonPath)) {
  try {
    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    if (versionJson.changelog) {
      description = versionJson.changelog;
    }
    if (versionJson.releaseNotes) {
      releaseNotes = versionJson.releaseNotes;
    }
  } catch (err) {
    console.warn('generate-release-metadata: ⚠ Could not parse version.json', err);
  }
}

// Validate that the description is not generic
if (description.toLowerCase() === `version ${version}`.toLowerCase() ||
    description.toLowerCase() === `release v${version}`.toLowerCase() ||
    description.toLowerCase() === `version: ${version}`.toLowerCase()) {
  console.error(`\x1b[31mgenerate-release-metadata: ✗ Release blocked: version.json contains generic/placeholder changelog info. Add real release notes before publishing.\x1b[0m`);
  process.exit(1);
}


// Compute SHA-256 hash of APK and copy to Firebase Hosting mirror
const apkPath = path.join(appRoot, 'android/app/build/outputs/apk/release/app-release.apk');
let sha256 = '';
let apkSizeBytes = 0;

if (releaseType !== 'ota') {
  if (!fs.existsSync(apkPath)) {
    console.error(`generate-release-metadata: ✗ APK not found at ${apkPath}`);
    process.exit(1);
  }

  // Compute SHA-256 and size in bytes
  const fileBuffer = fs.readFileSync(apkPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  sha256 = hashSum.digest('hex');
  apkSizeBytes = fs.statSync(apkPath).size;
  console.log(`generate-release-metadata: Computed APK SHA-256 = ${sha256}, size = ${apkSizeBytes} bytes`);

  // Copy to Firebase Hosting paths
  try {
    const firebaseApkDir = path.join(repoRoot, 'firebase-public/apk');
    fs.mkdirSync(firebaseApkDir, { recursive: true });

    // Clean up old bin and apk files to prevent clutter on deployment
    if (fs.existsSync(firebaseApkDir)) {
      const files = fs.readdirSync(firebaseApkDir);
      for (const file of files) {
        if (file.endsWith('.bin') || file.endsWith('.apk')) {
          fs.unlinkSync(path.join(firebaseApkDir, file));
          console.log(`generate-release-metadata: Cleaned up old file: ${file}`);
        }
      }
    }

    const versionApkPath = path.join(firebaseApkDir, `studio-${version}.apk`);
    const latestApkPath = path.join(firebaseApkDir, 'studio-latest.apk');

    fs.copyFileSync(apkPath, versionApkPath);
    console.log(`generate-release-metadata: ✓ Copied APK to ${versionApkPath}`);

    fs.copyFileSync(apkPath, latestApkPath);
    console.log(`generate-release-metadata: ✓ Copied APK to ${latestApkPath}`);

    // Dynamic firebase.json update to add redirects and ignores for the apk files
    try {
      const firebaseJsonPath = path.join(repoRoot, 'firebase.json');
      if (fs.existsSync(firebaseJsonPath)) {
        const fbJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
        if (fbJson.hosting) {
          // 1. Ensure **/*.apk is in the ignore array
          fbJson.hosting.ignore = fbJson.hosting.ignore || [];
          if (!fbJson.hosting.ignore.includes('**/*.apk')) {
            fbJson.hosting.ignore.push('**/*.apk');
          }

          // 2. Ensure redirects array exists
          fbJson.hosting.redirects = fbJson.hosting.redirects || [];
          const redirects = fbJson.hosting.redirects;

          // 3. Update or insert studio-latest.apk redirect
          const latestDest = `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`;
          const latestIdx = redirects.findIndex(r => r.source === '/apk/studio-latest.apk');
          const latestRule = {
            "source": "/apk/studio-latest.apk",
            "destination": latestDest,
            "type": 302
          };
          if (latestIdx !== -1) {
            redirects[latestIdx] = latestRule;
          } else {
            redirects.unshift(latestRule);
          }

          // 4. Update or insert studio-:version.apk redirect
          const versionDest = "https://github.com/MAGEXE1000/Studio/releases/download/v:version/studio-:version.apk";
          const versionIdx = redirects.findIndex(r => r.source === '/apk/studio-:version.apk');
          const versionRule = {
            "source": "/apk/studio-:version.apk",
            "destination": versionDest,
            "type": 302
          };
          if (versionIdx !== -1) {
            redirects[versionIdx] = versionRule;
          } else {
            redirects.push(versionRule);
          }

          fs.writeFileSync(firebaseJsonPath, JSON.stringify(fbJson, null, 2) + '\n', 'utf8');
          console.log(`generate-release-metadata: ✓ Dynamically updated redirects and ignores in firebase.json for version ${version}`);
        }
      }
    } catch (err) {
      console.warn('generate-release-metadata: ⚠ Could not dynamically update firebase.json redirects/ignores:', err);
    }
  } catch (err) {
    console.error('generate-release-metadata: ✗ Failed to copy APK to Firebase Hosting:', err);
    process.exit(1);
  }
} else {
  if (fs.existsSync(apkPath)) {
    const fileBuffer = fs.readFileSync(apkPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    sha256 = hashSum.digest('hex');
    console.log(`generate-release-metadata: Computed APK SHA-256 = ${sha256}`);
  } else {
    console.warn(`generate-release-metadata: ⚠ APK not found at ${apkPath}`);
  }
}

// Parse versionCode from build.gradle
let versionCode = 0;
try {
  const gradlePath = path.join(appRoot, 'android/app/build.gradle');
  if (fs.existsSync(gradlePath)) {
    const gradleSrc = fs.readFileSync(gradlePath, 'utf8');
    const codeMatch = gradleSrc.match(/versionCode\s+(\d+)/);
    if (codeMatch) {
      versionCode = parseInt(codeMatch[1], 10);
    }
  }
} catch (err) {
  console.warn('generate-release-metadata: ⚠ Could not parse versionCode from build.gradle:', err);
}

// Get signature
const expectedSignature = process.env.EXPECTED_SIGNATURE_SHA256 || '90:0C:F2:59:18:5C:81:10:0C:DA:8B:B0:85:71:FA:23:55:2E:97:89:13:1C:F0:7A:8F:40:56:E4:D4:12:92:06';
let signatures = expectedSignature.replace(/:/g, '').toLowerCase();
const reinstallRequired = process.env.REINSTALL_REQUIRED === 'true';

if (reinstallRequired) {
  signatures = '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206';
}

// Get previous required version code and version name to carry forward if releaseType is 'ota'
let requiredApkVersion = version;
let requiredVersionCode = versionCode;
let prevVersionCode = 0;
let prevData = null;

try {
  if (fs.existsSync(appReleaseJsonPath)) {
    prevData = JSON.parse(fs.readFileSync(appReleaseJsonPath, 'utf8'));
  } else {
    const liveRes = await fetch('https://studio-30f44.web.app/app-release.json');
    if (liveRes.ok) {
      prevData = await liveRes.json();
    }
  }

  if (prevData) {
    prevVersionCode = prevData.versionCode || 0;
    if (releaseType === 'ota') {
      requiredApkVersion = prevData.required_apk_version || prevData.requiredApkVersion || prevData.version;
      requiredVersionCode = prevData.required_version_code || prevData.requiredVersionCode || prevData.versionCode;
    }
  }
} catch (err) {
  console.warn('generate-release-metadata: ⚠ Could not fetch previous required version code, defaulting to current version.', err);
}

const androidMetadata = {
  platform: 'android',
  version: version,
  versionName: version,
  version_code: versionCode,
  versionCode: versionCode,
  packageName: 'com.chordex.app',
  update_type: 'apk',
  updateType: 'apk',
  download_url: `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`,
  apkUrl: `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`,
  manual_download_url: `https://studio-30f44.web.app/apk/studio-${version}.apk`,
  fallback_download_url: `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`,
  sha256: sha256,
  apkSha256: sha256,
  apkSizeBytes: apkSizeBytes,
  description: description,
  whatsNew: description,
  changelog: description,
  releaseNotes: releaseNotes,
  required_version_code: versionCode,
  requiredVersionCode: versionCode,
  signatures: signatures,
  installMode: reinstallRequired ? 'reinstall-required' : 'normal-update',
  reinstallRequired: reinstallRequired ? true : false,
  signatureChanged: reinstallRequired ? true : false
};

if (reinstallRequired) {
  androidMetadata.previousSignatureSha256 = '58b9bf2de5064c62ac3ca181b5608fe135c6894a8359ff6588e19218cd384764';
  androidMetadata.newSignatureSha256 = '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206';
}

// Get commit SHA and build timestamp from appVersion.ts if present
const commitMatch = src.match(/export\s+const\s+APP_COMMIT_SHA\s*=\s*['"]([^'"]+)['"]/);
const gitCommitSha = commitMatch ? commitMatch[1] : 'unknown';

const timestampMatch = src.match(/export\s+const\s+APP_BUILD_TIMESTAMP\s*=\s*['"]([^'"]+)['"]/);
const buildTimestamp = timestampMatch ? timestampMatch[1] : new Date().toLocaleString('en-US', { timeZoneName: 'short' });

const webMetadata = {
  platform: 'web',
  version: version,
  commit: gitCommitSha,
  releasedAt: buildTimestamp,
  buildTimestamp: buildTimestamp,
  updateMode: 'refresh',
  description: description,
  whatsNew: description,
  changelog: description,
  releaseNotes: releaseNotes,
  mandatory: false
};

// Validate the constructed metadata before writing
if (prevVersionCode && prevData && prevData.version !== version && versionCode <= prevVersionCode) {
  console.error(`generate-release-metadata: ✗ versionCode (${versionCode}) must be greater than previous versionCode (${prevVersionCode})!`);
  process.exit(1);
}

// Validate against GitHub Pages URLs in Android metadata
const urlRegex = /https?:\/\/[^\s"]+/g;
const jsonStr = JSON.stringify(androidMetadata);
const matches = jsonStr.match(urlRegex) || [];
for (const url of matches) {
  const cleanUrl = url.replace(/[",}]/g, '').trim();
  if (cleanUrl.includes('github.io') || cleanUrl.includes('gh-pages')) {
    console.error(`\x1b[31mgenerate-release-metadata: ✗ GitHub Pages URL detected in release metadata: ${cleanUrl}\x1b[0m`);
    process.exit(1);
  }
  if (cleanUrl.includes('github.com') && !cleanUrl.startsWith('https://github.com/MAGEXE1000/Studio/releases/download/')) {
    console.error(`\x1b[31mgenerate-release-metadata: ✗ Invalid GitHub URL detected in release metadata (only official releases/download/ paths are allowed): ${cleanUrl}\x1b[0m`);
    process.exit(1);
  }
}
console.log('generate-release-metadata: ✓ Metadata URLs successfully validated (no GitHub Pages URLs detected)');

try {
  fs.writeFileSync(appReleaseJsonPath, JSON.stringify(androidMetadata, null, 2) + '\n', 'utf8');
  // Also write to dist/public in case we rebuild
  const publicReleasePath = path.join(appRoot, 'dist/public/app-release.json');
  fs.mkdirSync(path.dirname(publicReleasePath), { recursive: true });
  fs.writeFileSync(publicReleasePath, JSON.stringify(androidMetadata, null, 2) + '\n', 'utf8');

  console.log(`generate-release-metadata: ✓ Wrote firebase-public/app-release.json and dist/public/app-release.json`);

  // Synchronize version.json files with Web metadata
  const syncVersionJson = (filePath) => {
    // Check if parent directory exists or if we should create it
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    try {
      fs.writeFileSync(filePath, JSON.stringify(webMetadata, null, 2) + '\n', 'utf8');
      console.log(`generate-release-metadata: ✓ Synchronized ${path.basename(filePath)} with Web-safe metadata`);
    } catch (err) {
      console.warn(`generate-release-metadata: ⚠ Could not update ${filePath}:`, err);
    }
  };

  syncVersionJson(versionJsonPath);
  syncVersionJson(path.join(appRoot, 'dist/public/version.json'));
  syncVersionJson(path.join(appRoot, 'public/version.json'));
} catch (err) {
  console.error(`\x1b[31mgenerate-release-metadata: ✗ Metadata generation failure: ${err.message}\x1b[0m`);
  process.exit(1);
}


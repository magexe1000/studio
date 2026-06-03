import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');

const releaseType = process.env.RELEASE_TYPE || 'both';

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
  console.error('generate-release-metadata: ✗ AppInstaller contract validation failed!');
  process.exit(validateResult.status ?? 1);
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

// Read changelog description from firebase-public/version.json
let description = `Release v${version}`;
if (fs.existsSync(versionJsonPath)) {
  try {
    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    if (versionJson.changelog) {
      description = versionJson.changelog;
    }
  } catch (err) {
    console.warn('generate-release-metadata: ⚠ Could not parse version.json', err);
  }
}

// Compute SHA-256 hash of APK and copy to Firebase Hosting mirror
const apkPath = path.join(appRoot, 'android/app/build/outputs/apk/debug/app-debug.apk');
let sha256 = '';

if (releaseType !== 'ota') {
  if (!fs.existsSync(apkPath)) {
    console.error(`generate-release-metadata: ✗ APK not found at ${apkPath}`);
    process.exit(1);
  }

  // Compute SHA-256
  const fileBuffer = fs.readFileSync(apkPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  sha256 = hashSum.digest('hex');
  console.log(`generate-release-metadata: Computed APK SHA-256 = ${sha256}`);

  // Copy to Firebase Hosting paths
  try {
    const firebaseApkDir = path.join(repoRoot, 'firebase-public/apk');
    fs.mkdirSync(firebaseApkDir, { recursive: true });

    // Clean up old apk files to prevent Firebase Hosting Spark block on deployment
    if (fs.existsSync(firebaseApkDir)) {
      const files = fs.readdirSync(firebaseApkDir);
      for (const file of files) {
        if (file.endsWith('.apk')) {
          fs.unlinkSync(path.join(firebaseApkDir, file));
          console.log(`generate-release-metadata: Cleaned up old APK file to avoid Spark plan restrictions: ${file}`);
        }
      }
    }

    const versionApkPath = path.join(firebaseApkDir, `studio-${version}.bin`);
    const latestApkPath = path.join(firebaseApkDir, 'studio-latest.bin');

    fs.copyFileSync(apkPath, versionApkPath);
    console.log(`generate-release-metadata: ✓ Copied APK as bin to ${versionApkPath}`);

    fs.copyFileSync(apkPath, latestApkPath);
    console.log(`generate-release-metadata: ✓ Copied APK as bin to ${latestApkPath}`);

    // Dynamic firebase.json update to add headers for the specific version's bin file
    try {
      const firebaseJsonPath = path.join(repoRoot, 'firebase.json');
      if (fs.existsSync(firebaseJsonPath)) {
        const fbJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
        if (fbJson.hosting && Array.isArray(fbJson.hosting.headers)) {
          const headers = fbJson.hosting.headers;
          const sourcePattern = `/apk/studio-${version}.bin`;
          
          // Remove existing rule for this version if present
          const existingIdx = headers.findIndex(h => h.source === sourcePattern);
          if (existingIdx !== -1) {
            headers.splice(existingIdx, 1);
          }
          
          // Construct the new rule
          const newRule = {
            "source": sourcePattern,
            "headers": [
              {
                "key": "Content-Type",
                "value": "application/vnd.android.package-archive"
              },
              {
                "key": "Content-Disposition",
                "value": `attachment; filename="studio-${version}.apk"`
              },
              {
                "key": "Cache-Control",
                "value": "public, max-age=31536000, immutable"
              }
            ]
          };
          
          // Find /apk/*.bin index to insert before it, ensuring precedence
          const catchAllIdx = headers.findIndex(h => h.source === '/apk/*.bin');
          if (catchAllIdx !== -1) {
            headers.splice(catchAllIdx, 0, newRule);
          } else {
            headers.push(newRule);
          }
          
          fs.writeFileSync(firebaseJsonPath, JSON.stringify(fbJson, null, 2) + '\n', 'utf8');
          console.log(`generate-release-metadata: ✓ Dynamically updated firebase.json headers for ${sourcePattern}`);
        }
      }
    } catch (err) {
      console.warn('generate-release-metadata: ⚠ Could not dynamically update firebase.json:', err);
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

const metadata = {
  created_at: new Date().toISOString(),
  version: version,
  description: description,
  download_url: `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`,
  manual_download_url: `https://studio-30f44.web.app/apk/studio-${version}.bin`,
  fallback_download_url: `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`,
  downloadUrl: `https://studio-30f44.web.app/ota/studio-ota-${version}.zip`,
  signature_download_url: "",
  sha256: sha256,
  update_type: releaseType
};

fs.writeFileSync(appReleaseJsonPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
// Also write to dist/public in case we rebuild
const publicReleasePath = path.join(appRoot, 'dist/public/app-release.json');
fs.mkdirSync(path.dirname(publicReleasePath), { recursive: true });
fs.writeFileSync(publicReleasePath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');

console.log(`generate-release-metadata: ✓ Wrote firebase-public/app-release.json and dist/public/app-release.json`);

// Synchronize version.json files with APK metadata
const syncVersionJson = (filePath) => {
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      data.apkUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`;
      data.manualApkUrl = `https://studio-30f44.web.app/apk/studio-${version}.bin`;
      data.fallbackApkUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/studio-${version}.apk`;
      data.sha256 = sha256;
      data.updateType = releaseType;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`generate-release-metadata: ✓ Synchronized ${path.basename(filePath)} with APK metadata`);
    } catch (err) {
      console.warn(`generate-release-metadata: ⚠ Could not update ${filePath}:`, err);
    }
  }
};

syncVersionJson(versionJsonPath);
syncVersionJson(path.join(appRoot, 'dist/public/version.json'));
syncVersionJson(path.join(appRoot, 'public/version.json'));


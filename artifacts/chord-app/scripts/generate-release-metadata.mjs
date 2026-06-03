import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '../../..');

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

// Compute SHA-256 hash of APK
const apkPath = path.join(appRoot, 'android/app/build/outputs/apk/debug/app-debug.apk');
let sha256 = '';
if (fs.existsSync(apkPath)) {
  const fileBuffer = fs.readFileSync(apkPath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  sha256 = hashSum.digest('hex');
  console.log(`generate-release-metadata: Computed APK SHA-256 = ${sha256}`);
} else {
  console.warn(`generate-release-metadata: ⚠ APK not found at ${apkPath}`);
}

const releaseType = process.env.RELEASE_TYPE || 'both';

const metadata = {
  created_at: new Date().toISOString(),
  version: version,
  description: description,
  download_url: `https://github.com/MAGEXE1000/Studio/releases/download/v${version}/Studio-${version}.apk`,
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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const paths = {
  webPkg: path.join(repoRoot, 'apps/studio-web/package.json'),
  androidPkg: path.join(repoRoot, 'apps/studio-android/package.json'),
  appVersionTs: path.join(repoRoot, 'packages/studio-core/src/lib/appVersion.ts'),
  buildGradle: path.join(repoRoot, 'apps/studio-android/android/app/build.gradle')
};

console.log('=== RUNNING VERSION CONSISTENCY CHECK ===');

// 1. Read Web package version
if (!fs.existsSync(paths.webPkg)) {
  console.error(`Error: Web package.json not found at ${paths.webPkg}`);
  process.exit(1);
}
const webPkgJson = JSON.parse(fs.readFileSync(paths.webPkg, 'utf8'));
const webPkgVersion = webPkgJson.version;
console.log(`Web package.json version: ${webPkgVersion}`);

// 2. Read Android package version
if (!fs.existsSync(paths.androidPkg)) {
  console.error(`Error: Android package.json not found at ${paths.androidPkg}`);
  process.exit(1);
}
const androidPkgJson = JSON.parse(fs.readFileSync(paths.androidPkg, 'utf8'));
const androidPkgVersion = androidPkgJson.version;
console.log(`Android package.json version: ${androidPkgVersion}`);

// 3. Read appVersion.ts runtime versions
if (!fs.existsSync(paths.appVersionTs)) {
  console.error(`Error: appVersion.ts not found at ${paths.appVersionTs}`);
  process.exit(1);
}
const appVersionSrc = fs.readFileSync(paths.appVersionTs, 'utf8');
const webVersionMatch = appVersionSrc.match(/export\s+const\s+WEB_VERSION\s*=\s*['"]([^'"]+)['"]/);
const nativeVersionMatch = appVersionSrc.match(/export\s+const\s+NATIVE_VERSION\s*=\s*['"]([^'"]+)['"]/);

if (!webVersionMatch || !nativeVersionMatch) {
  console.error('Error: Could not parse WEB_VERSION or NATIVE_VERSION from appVersion.ts');
  process.exit(1);
}
const webRuntimeVersion = webVersionMatch[1];
const androidRuntimeVersion = nativeVersionMatch[1];
console.log(`appVersion.ts WEB_VERSION: ${webRuntimeVersion}`);
console.log(`appVersion.ts NATIVE_VERSION: ${androidRuntimeVersion}`);

// 4. Read Gradle versionName & versionCode
if (!fs.existsSync(paths.buildGradle)) {
  console.error(`Error: build.gradle not found at ${paths.buildGradle}`);
  process.exit(1);
}
const gradleSrc = fs.readFileSync(paths.buildGradle, 'utf8');
const gradleVersionNameMatch = gradleSrc.match(/versionName\s+['"]([^'"]+)['"]/);
const gradleVersionCodeMatch = gradleSrc.match(/versionCode\s+(\d+)/);

if (!gradleVersionNameMatch || !gradleVersionCodeMatch) {
  console.error('Error: Could not parse versionName or versionCode from build.gradle');
  process.exit(1);
}
const gradleVersionName = gradleVersionNameMatch[1];
const gradleVersionCode = parseInt(gradleVersionCodeMatch[1], 10);
console.log(`build.gradle versionName: ${gradleVersionName}`);
console.log(`build.gradle versionCode: ${gradleVersionCode}`);

// === VALIDATIONS ===

let failed = false;

// Web Consistency
if (webPkgVersion !== webRuntimeVersion) {
  console.error(`\x1b[31mError: Web package version (${webPkgVersion}) and Web runtime version (${webRuntimeVersion}) disagree!\x1b[0m`);
  failed = true;
} else {
  console.log('✓ Web version consistency verified.');
}

// Android Consistency
if (androidPkgVersion !== androidRuntimeVersion) {
  console.error(`\x1b[31mError: Android package version (${androidPkgVersion}) and appVersion NATIVE_VERSION (${androidRuntimeVersion}) disagree!\x1b[0m`);
  failed = true;
}
if (androidRuntimeVersion !== gradleVersionName) {
  console.error(`\x1b[31mError: appVersion NATIVE_VERSION (${androidRuntimeVersion}) and Gradle versionName (${gradleVersionName}) disagree!\x1b[0m`);
  failed = true;
}

if (!failed) {
  console.log('✓ Android version consistency verified.');
  console.log('\x1b[32m=== VERSION CONSISTENCY CHECK PASSED ===\x1b[0m');
  process.exit(0);
} else {
  console.error('\x1b[31m=== VERSION CONSISTENCY CHECK FAILED ===\x1b[0m');
  process.exit(1);
}

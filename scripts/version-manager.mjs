#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const appVersionPath = path.join(repoRoot, 'packages/studio-core/src/lib/appVersion.ts');

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function updateWeb(version) {
  if (!parseSemver(version)) {
    console.error(`Error: Invalid web version format "${version}". Must be strict X.Y.Z semver.`);
    process.exit(1);
  }

  // 1. Update packages/studio-core/src/lib/appVersion.ts
  if (fs.existsSync(appVersionPath)) {
    let content = fs.readFileSync(appVersionPath, 'utf8');
    content = content.replace(
      /export\s+const\s+WEB_VERSION\s*=\s*['"]([^'"]+)['"]/,
      `export const WEB_VERSION = '${version}'`
    );
    fs.writeFileSync(appVersionPath, content, 'utf8');
    console.log(`✓ Updated WEB_VERSION in appVersion.ts to: ${version}`);
  } else {
    console.error(`Error: appVersion.ts not found at ${appVersionPath}`);
    process.exit(1);
  }

  // 2. Update apps/studio-web/package.json
  const webPkgPath = path.join(repoRoot, 'apps/studio-web/package.json');
  if (fs.existsSync(webPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(webPkgPath, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(webPkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`✓ Updated apps/studio-web/package.json version to: ${version}`);
  }
}

function updateAndroid(versionName, versionCode) {
  if (!parseSemver(versionName)) {
    console.error(`Error: Invalid Android versionName format "${versionName}". Must be strict X.Y.Z semver.`);
    process.exit(1);
  }

  const code = parseInt(versionCode, 10);
  if (isNaN(code) || code <= 0) {
    console.error(`Error: Invalid Android versionCode "${versionCode}". Must be a positive integer.`);
    process.exit(1);
  }

  // 1. Update packages/studio-core/src/lib/appVersion.ts
  if (fs.existsSync(appVersionPath)) {
    let content = fs.readFileSync(appVersionPath, 'utf8');
    content = content.replace(
      /export\s+const\s+NATIVE_VERSION\s*=\s*['"]([^'"]+)['"]/,
      `export const NATIVE_VERSION = '${versionName}'`
    );
    fs.writeFileSync(appVersionPath, content, 'utf8');
    console.log(`✓ Updated NATIVE_VERSION in appVersion.ts to: ${versionName}`);
  } else {
    console.error(`Error: appVersion.ts not found at ${appVersionPath}`);
    process.exit(1);
  }

  // 2. Update apps/studio-android/package.json
  const androidPkgPath = path.join(repoRoot, 'apps/studio-android/package.json');
  if (fs.existsSync(androidPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(androidPkgPath, 'utf8'));
    pkg.version = versionName;
    fs.writeFileSync(androidPkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`✓ Updated apps/studio-android/package.json version to: ${versionName}`);
  }

  // 3. Update apps/studio-android/android/app/build.gradle
  const gradlePath = path.join(repoRoot, 'apps/studio-android/android/app/build.gradle');
  if (fs.existsSync(gradlePath)) {
    let gradle = fs.readFileSync(gradlePath, 'utf8');
    
    // Update versionCode
    gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${code}`);
    // Update versionName
    gradle = gradle.replace(/versionName\s+["']([^"']+)["']/, `versionName "${versionName}"`);
    
    fs.writeFileSync(gradlePath, gradle, 'utf8');
    console.log(`✓ Updated apps/studio-android/android/app/build.gradle (versionName: ${versionName}, versionCode: ${code})`);
  } else {
    console.warn(`⚠ Gradle file not found at ${gradlePath}. Skip native file update.`);
  }
}

// CLI entry point
const args = process.argv.slice(2);
const platform = args[0];

if (platform === 'web') {
  const ver = args[2] || args[1]; // handle `--`
  if (!ver || ver.startsWith('-')) {
    console.error('Usage: pnpm version:web -- <version>');
    process.exit(1);
  }
  updateWeb(ver);
} else if (platform === 'android') {
  const nameIndex = args.indexOf('--name');
  const codeIndex = args.indexOf('--code');
  
  if (nameIndex === -1 || codeIndex === -1 || !args[nameIndex + 1] || !args[codeIndex + 1]) {
    console.error('Usage: pnpm version:android --name <versionName> --code <versionCode>');
    process.exit(1);
  }
  
  updateAndroid(args[nameIndex + 1], args[codeIndex + 1]);
} else {
  console.error('Error: Unknown platform. Must be "web" or "android".');
  console.error('Usage:');
  console.error('  pnpm version:web -- <version>');
  console.error('  pnpm version:android --name <versionName> --code <versionCode>');
  process.exit(1);
}

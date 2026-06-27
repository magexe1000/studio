#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// 1. Authoritative Expected Fingerprint
const appVersionPath = path.join(repoRoot, 'packages/studio-core/src/lib/appVersion.ts');
if (!fs.existsSync(appVersionPath)) {
  console.error(`✗ Authoritative config not found at: ${appVersionPath}`);
  process.exit(1);
}
const appVersionSrc = fs.readFileSync(appVersionPath, 'utf8');
const expectedSigMatch = appVersionSrc.match(/export\s+const\s+PRODUCTION_SIGNING_SHA256\s*=\s*['"]([^'"]+)['"]/);
if (!expectedSigMatch) {
  console.error('✗ Unable to parse PRODUCTION_SIGNING_SHA256 from appVersion.ts');
  process.exit(1);
}
const EXPECTED_FINGERPRINT = expectedSigMatch[1].toLowerCase().replace(/:/g, '').trim();
console.log(`Authoritative production fingerprint: ${EXPECTED_FINGERPRINT}`);

// 2. Scan firebase-public/apk/ for all APKs
const apkDir = path.join(repoRoot, 'firebase-public/apk');
if (!fs.existsSync(apkDir)) {
  console.log('✓ No firebase-public/apk directory found. Skipping deployment signatures validation.');
  process.exit(0);
}

const files = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));
if (files.length === 0) {
  console.log('✓ No release APK files found in firebase-public/apk.');
  process.exit(0);
}

console.log(`Found ${files.length} APK files in firebase-public/apk/ to verify...`);

for (const file of files) {
  const filePath = path.join(apkDir, file);
  console.log(`Verifying: ${file}...`);

  // Run keytool to print certificate fingerprints
  const keytoolResult = spawnSync('keytool', [
    '-printcert', '-jarfile', filePath
  ], { encoding: 'utf8' });

  if (keytoolResult.status !== 0) {
    console.error(`✗ Keytool verification failed for APK: ${file}`);
    console.error(keytoolResult.stderr || keytoolResult.stdout);
    process.exit(1);
  }

  const keytoolOut = keytoolResult.stdout || '';
  const sha256Match = keytoolOut.match(/SHA256:\s*([A-Fa-f0-9:]+)/);
  if (!sha256Match) {
    console.error(`✗ Could not parse SHA-256 certificate digest from keytool for: ${file}`);
    console.error(keytoolOut);
    process.exit(1);
  }

  const fingerprint = sha256Match[1].toLowerCase().replace(/:/g, '').trim();
  console.log(`  SHA-256 Signature: ${fingerprint}`);

  if (fingerprint !== EXPECTED_FINGERPRINT) {
    console.error(`::error::✗ SIGNATURE MISMATCH DETECTED for APK: ${file}`);
    console.error(`  Expected: ${EXPECTED_FINGERPRINT}`);
    console.error(`  Found:    ${fingerprint}`);
    console.error(`\nCRITICAL ERROR: Refusing to publish or deploy. This APK was signed with the wrong key!`);
    process.exit(1);
  }
  console.log(`  ✓ Signature matches production exactly.`);
}

console.log('✓ All release APK signature verifications passed successfully!');
process.exit(0);

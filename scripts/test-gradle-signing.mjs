import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const androidDir = path.join(repoRoot, 'apps/studio-android/android');

// On local dev systems, if JAVA_HOME points to a JDK version Gradle doesn't support (like JDK 25),
// try to fall back to adoptium JDK 21 if it is installed.
if (process.platform === 'win32') {
  const jdk21Path = 'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.11.10-hotspot';
  if (fs.existsSync(jdk21Path)) {
    process.env.JAVA_HOME = jdk21Path;
  }
}

console.log('=== RUNNING GRADLE SIGNING REGRESSION TESTS ===');

const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
const gradlewPath = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

if (process.platform !== 'win32') {
  try {
    fs.chmodSync(gradlewPath, 0o755);
    console.log(`✓ Marked ${gradlewPath} as executable.`);
  } catch (err) {
    console.warn(`Warning: Failed to chmod ${gradlewPath}:`, err.message);
  }
}

// Case A: PR CI debug build configuration check
console.log('Testing Case A: PR CI debug configuration...');
const caseAEnv = {
  ...process.env,
  CI: 'true',
  ANDROID_KEYSTORE_PASSWORD: '',
  ANDROID_KEY_PASSWORD: '',
  ANDROID_KEY_ALIAS: ''
};
delete caseAEnv.STUDIO_PRODUCTION_RELEASE;

const resA = spawnSync(gradlew, ['help'], {
  cwd: androidDir,
  env: caseAEnv,
  shell: true,
});
if (resA.status !== 0) {
  console.error('Case A failed execution details:');
  console.error('status:', resA.status);
  console.error('error:', resA.error);
  console.error('stdout:', resA.stdout?.toString());
  console.error('stderr:', resA.stderr?.toString());
}
assert.strictEqual(resA.status, 0, 'Case A should succeed configuration check without production signing secrets.');
console.log('✓ Case A passed (PR CI debug configuration successfully processed).');

// Case B: Explicit production release without secrets (must fail closed)
console.log('Testing Case B: Production release without secrets (fail-closed)...');
const caseBEnv = {
  ...process.env,
  STUDIO_PRODUCTION_RELEASE: 'true',
  ANDROID_KEYSTORE_PASSWORD: '',
  ANDROID_KEY_PASSWORD: '',
  ANDROID_KEY_ALIAS: ''
};

const resB = spawnSync(gradlew, ['help'], {
  cwd: androidDir,
  env: caseBEnv,
  shell: true,
});
if (resB.status === 0) {
  console.error('Case B failed execution details:');
  console.error('status:', resB.status);
  console.error('stdout:', resB.stdout?.toString());
  console.error('stderr:', resB.stderr?.toString());
}
assert.notStrictEqual(resB.status, 0, 'Case B should fail configuration check when STUDIO_PRODUCTION_RELEASE=true but signing secrets are missing.');
console.log('✓ Case B passed (Production release without secrets correctly failed closed).');

// Case C: Production release with wrong signer
console.log('Testing Case C: Production release signature validation (fail-closed)...');
// If we have a local debug APK, we can mock validate-app-installer test
const apkPath = path.join(repoRoot, 'apps/studio-android/android/app/build/outputs/apk/debug/app-debug.apk');
if (fs.existsSync(apkPath)) {
  // Copy the debug APK temporarily to the release folder path checked by validate-app-installer
  const releaseApkDir = path.join(repoRoot, 'apps/studio-android/android/app/build/outputs/apk/release');
  if (!fs.existsSync(releaseApkDir)) {
    fs.mkdirSync(releaseApkDir, { recursive: true });
  }
  const tempReleaseApkPath = path.join(releaseApkDir, 'app-release.apk');
  fs.copyFileSync(apkPath, tempReleaseApkPath);
  
  try {
    const caseCEnv = {
      ...process.env,
      STUDIO_PRODUCTION_RELEASE: 'true',
      RELEASE_TYPE: 'apk'
    };
    
    const resC = spawnSync('node', ['scripts/validate-app-installer.mjs'], {
      cwd: path.join(repoRoot, 'apps/studio-android'),
      env: caseCEnv,
      shell: process.platform === 'win32',
    });
    
    assert.notStrictEqual(resC.status, 0, 'Case C should fail validation when release APK is signed with a non-production key (e.g. debug key).');
    console.log('✓ Case C passed (Invalid production signer fingerprint correctly rejected).');
  } finally {
    try {
      fs.unlinkSync(tempReleaseApkPath);
    } catch (e) {
      // ignore
    }
  }
} else {
  console.log('Skipping Case C check (No local debug APK built to test against).');
}

console.log('\x1b[32m=== ALL GRADLE SIGNING REGRESSION TESTS PASSED ===\x1b[0m');
process.exit(0);

import assert from 'node:assert';

// 1. Version Parser Function (from release-firebase.mjs)
function parseNativeVersion(fileContent) {
  const matches = [...fileContent.matchAll(/export\s+const\s+NATIVE_VERSION\s*=\s*['"]([^'"]+)['"]/g)];
  if (matches.length !== 1) {
    throw new Error('Unable to resolve NATIVE_VERSION from appVersion.ts');
  }
  const versionStr = matches[0][1];
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (!semverRegex.test(versionStr)) {
    throw new Error(`Invalid semantic version format for NATIVE_VERSION: ${versionStr}`);
  }
  return versionStr;
}

// 2. Changelog Validation Function (simplified from release-firebase.mjs)
function validateChangelog(changelogText, version) {
  const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `^##\\s+${esc}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`,
    'm'
  );
  const match = changelogText.match(re);
  if (!match) {
    throw new Error(`missing changelog entry for version ${version} in CHANGELOG.md`);
  }
  const sectionContent = match[1].trim();
  if (!sectionContent) {
    throw new Error(`changelog entry for version ${version} is empty`);
  }
  return true;
}

// 3. Metadata Cross-check Function (simplified from release-firebase.mjs)
function crossCheckMetadata(nativeVersion, gradleVersionName, gradleApplicationId, prevVersionCode, gradleVersionCode) {
  if (gradleVersionName !== nativeVersion) {
    throw new Error(`NATIVE_VERSION (${nativeVersion}) differs from build.gradle versionName (${gradleVersionName})!`);
  }
  if (gradleApplicationId !== 'com.chordex.app') {
    throw new Error(`package name (${gradleApplicationId}) differs from com.chordex.app!`);
  }
  if (prevVersionCode && gradleVersionCode <= prevVersionCode) {
    throw new Error(`versionCode (${gradleVersionCode}) is not greater than the previous release (${prevVersionCode})!`);
  }
  return true;
}

// === RUNNING TESTS ===

console.log('Running Release Pipeline Regression Tests...\n');

// --- Test A ---
console.log('Running Test A: Correct parsing of NATIVE_VERSION when dynamic APP_VERSION is present...');
const testASrc = `
export const NATIVE_VERSION = '3.6.33';
export const WEB_VERSION = '4.0.0';
export const APP_VERSION =
  Capacitor.isNativePlatform() ? NATIVE_VERSION : WEB_VERSION;
`;
const versionA = parseNativeVersion(testASrc);
assert.strictEqual(versionA, '3.6.33', 'Test A Failed: Version mismatch');
console.log('✓ Test A Passed (resolved version: ' + versionA + ')');

// --- Test B ---
console.log('\nRunning Test B: Missing NATIVE_VERSION...');
const testBSrc = `
export const WEB_VERSION = '4.0.0';
export const APP_VERSION = '4.0.0';
`;
try {
  parseNativeVersion(testBSrc);
  assert.fail('Test B Failed: Did not throw error for missing NATIVE_VERSION');
} catch (e) {
  assert.match(e.message, /Unable to resolve NATIVE_VERSION/, 'Test B Failed: Incorrect error message');
  console.log('✓ Test B Passed (correctly failed with: ' + e.message + ')');
}

// --- Test C ---
console.log('\nRunning Test C: NATIVE_VERSION and Gradle versionName differ...');
try {
  crossCheckMetadata('3.6.33', '3.6.32', 'com.chordex.app', 59, 60);
  assert.fail('Test C Failed: Did not throw error for versionName mismatch');
} catch (e) {
  assert.match(e.message, /differs from build.gradle versionName/, 'Test C Failed: Incorrect error message');
  console.log('✓ Test C Passed (correctly failed with: ' + e.message + ')');
}

// --- Test D ---
console.log('\nRunning Test D: 3.6.33 changelog entry exists...');
const testChangelog = `
# Changelog

## 3.6.33
- Bug fixes and improvements.
- Support Stagex navigation.

## 3.6.32
- Previous version notes.
`;
try {
  const pass = validateChangelog(testChangelog, '3.6.33');
  assert.strictEqual(pass, true);
  console.log('✓ Test D Passed (changelog validation passed)');
} catch (e) {
  assert.fail('Test D Failed: ' + e.message);
}

console.log('\nAll regression tests passed successfully!');

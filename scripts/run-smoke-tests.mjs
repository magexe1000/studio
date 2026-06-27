import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

console.log('=== RUNNING REPOSITORY SMOKE TESTS ===');

// Helper to check existence
function fileExists(p, msg) {
  assert(fs.existsSync(p), `Missing expected file: ${p}. ${msg}`);
}

try {
  // 1. Web entry load & setup validations
  console.log('Running Web App Smoke Tests...');
  const webAppPath = path.join(repoRoot, 'apps/studio-web/src/App.tsx');
  fileExists(webAppPath, 'Web router root component must exist.');
  
  const webAppSrc = fs.readFileSync(webAppPath, 'utf8');
  assert(webAppSrc.includes('StudioLandingPage'), 'Web App router must include StudioLandingPage.');
  assert(webAppSrc.includes("route === '/'"), 'Web App router must include public landing route.');
  assert(!webAppSrc.includes('BottomNav'), 'Web App router must not use Android BottomNav shell.');
  assert(!webAppSrc.includes('safe-area-inset-top'), 'Web App must not hardcode Android native safe area top insets.');
  console.log('✓ Web App Smoke Tests passed.');

  // 2. Android entry load & setup validations
  console.log('Running Android App Smoke Tests...');
  const androidAppPath = path.join(repoRoot, 'apps/studio-android/src/App.tsx');
  fileExists(androidAppPath, 'Android router root component must exist.');
  
  const androidAppSrc = fs.readFileSync(androidAppPath, 'utf8');
  assert(!androidAppSrc.includes('StudioLandingPage'), 'Android App router must exclude StudioLandingPage.');
  assert(androidAppSrc.includes('BottomNav'), 'Android App router must use Android BottomNav shell.');
  assert(androidAppSrc.includes('safe-area-inset-top'), 'Android App must utilize native safe area top insets.');
  assert(androidAppSrc.includes("navigateTo"), 'Android App must use navigateTo.');
  assert(!androidAppSrc.includes("route === '/'"), 'Android App router must not check route for public landing root.');
  console.log('✓ Android App Smoke Tests passed.');

  // 3. Capacitor webDir validation
  console.log('Running Capacitor Configuration Tests...');
  const capConfigPath = path.join(repoRoot, 'apps/studio-android/capacitor.config.ts');
  fileExists(capConfigPath, 'Capacitor config file must exist.');
  
  const capConfigSrc = fs.readFileSync(capConfigPath, 'utf8');
  assert(capConfigSrc.includes("webDir: '../../dist/android-web'"), 'Capacitor config must target dist/android-web output directory.');
  console.log('✓ Capacitor Configuration Tests passed.');

  // 4. Run automated version consistency checks
  console.log('Running Version Consistency Tests...');
  execSync('node scripts/verify-versions-consistency.mjs', { stdio: 'inherit', cwd: repoRoot });
  console.log('✓ Version Consistency Tests passed.');

  // 5. Run import boundary checks
  console.log('Running Import Boundary Tests...');
  execSync('node scripts/enforce-import-boundaries.mjs', { stdio: 'inherit', cwd: repoRoot });
  console.log('✓ Import Boundary Tests passed.');

  // 6. Run bundle separation assertions
  console.log('Running Bundle Separation Tests...');
  execSync('node scripts/verify-bundle-separation.mjs', { stdio: 'inherit', cwd: repoRoot });
  console.log('✓ Bundle Separation Tests passed.');

  // 7. Run Gradle signing regression tests
  console.log('Running Gradle Signing Regression Tests...');
  execSync('node scripts/test-gradle-signing.mjs', { stdio: 'inherit', cwd: repoRoot });
  console.log('✓ Gradle Signing Regression Tests passed.');

  // 7b. Run Updater Regression Tests
  console.log('Running Updater Regression Tests...');
  execSync('node --import ./scripts/esm-resolver.js scripts/run-updater-regression-tests.mjs', { stdio: 'inherit', cwd: repoRoot });
  console.log('✓ Updater Regression Tests passed.');

  // 8. Run Chord Normalization & Resolution Tests
  console.log('Running Chord Normalization & Resolution Tests...');
  const chordsModulePath = path.join(repoRoot, 'packages/studio-core/dist/src/data/chords.js');
  fileExists(chordsModulePath, 'TypeScript must compile chords.ts to dist/src/data/chords.js first.');
  
  const chordsModuleUrl = `file://${chordsModulePath.replace(/\\/g, '/')}`;
  const { normalizeChordName, getChordByName } = await import(chordsModuleUrl);
  
  const tests = [
    { input: 'Dó', expected: 'C' },
    { input: 'Rém', expected: 'Dm' },
    { input: 'Sol7', expected: 'G7' },
    { input: 'Lámaj7', expected: 'Amaj7' },
    { input: 'Sib', expected: 'Bb' },
    { input: 'Fá#', expected: 'F#' },
    { input: 'Réb', expected: 'Db' },
    { input: 'Dó/E', expected: 'C/E' },
    { input: 'C / E', expected: 'C/E' },
    { input: 'F# m7', expected: 'F#m7' },
    { input: 'C7M', expected: 'Cmaj7' },
    { input: 'CM7', expected: 'Cmaj7' },
    { input: 'C7maj', expected: 'Cmaj7' },
    { input: 'Cº', expected: 'Cdim' },
    { input: 'C°', expected: 'Cdim' },
    { input: 'C*', expected: 'Caug' },
    { input: 'C+', expected: 'Caug' },
    { input: 'C(no5)', expected: 'C' }
  ];
  
  for (const { input, expected } of tests) {
    const res = normalizeChordName(input);
    assert.strictEqual(res, expected, `Normalization failed: "${input}" -> expected "${expected}", got "${res}"`);
  }
  
  // Verify slash chord resolution / fallback checks
  const resolvedBase = getChordByName(normalizeChordName('C/E').split('/')[0]);
  assert(resolvedBase !== undefined, 'Slash chord base C must exist in database.');
  
  // Verify that an unknown chord returns undefined
  const unresolved = getChordByName(normalizeChordName('completely-unknown-chord-xyz'));
  assert.strictEqual(unresolved, undefined, 'Unknown chord should return undefined.');
  
  // Verify min13 is generated and resolves
  const min13Resolved = getChordByName('Am13');
  assert(min13Resolved !== undefined, 'Generated minor 13th (Am13) must exist in database.');
  assert.strictEqual(min13Resolved.type, 'min13', 'Am13 must be classified under min13 type.');
  
  console.log('✓ Chord Normalization & Resolution Tests passed.');

  console.log('\x1b[32m=== ALL SMOKE TESTS PASSED SUCCESSFULLY ===\x1b[0m');
  process.exit(0);
} catch (error) {
  console.error('\x1b[31m=== SMOKE TESTS FAILED ===\x1b[0m');
  console.error(error.stack || error);
  process.exit(1);
}

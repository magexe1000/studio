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

  console.log('\x1b[32m=== ALL SMOKE TESTS PASSED SUCCESSFULLY ===\x1b[0m');
  process.exit(0);
} catch (error) {
  console.error('\x1b[31m=== SMOKE TESTS FAILED ===\x1b[0m');
  console.error(error.stack || error);
  process.exit(1);
}

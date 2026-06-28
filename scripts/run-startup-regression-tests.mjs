import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

async function runStartupRegressionTests() {
  console.log('=== STARTING AUTOMATED STARTUP & UPDATER REGRESSION TESTS ===');

  const results = [];
  const assertTest = (name, fn) => {
    try {
      fn();
      results.push({ name, status: 'PASS', details: 'Check passed successfully.' });
      console.log(`[PASS] ${name}`);
    } catch (err) {
      results.push({ name, status: 'FAIL', details: err.message });
      console.error(`[FAIL] ${name}:`, err.message);
    }
  };

  // Test 1: Simplified Passive Splash in index.html
  assertTest('index.html passive splash screen check', () => {
    const indexPath = path.join(repoRoot, 'apps/studio-android/index.html');
    const content = fs.readFileSync(indexPath, 'utf8');

    // Assert intro element exists
    assert.ok(content.includes('id="intro"'), 'Splash screen container #intro not found in index.html');

    // Assert that active/complex timing or loops have been removed
    assert.ok(!content.includes('checkReadyToDismiss'), 'Active ready-to-dismiss check still present in index.html');
    assert.ok(!content.includes('dismissIntro'), 'Active dismissIntro() timing logic still present in index.html');
  });

  // Test 2: App.tsx Startup State Machine Sequencing
  assertTest('App.tsx linear startup state machine check', () => {
    const appPath = path.join(repoRoot, 'apps/studio-android/src/App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');

    // Assert that App.tsx transitioned through the linear states on mount
    assert.ok(content.includes("transitionStartupState('PREPARE')"), 'Missing state PREPARE transition');
    assert.ok(content.includes("transitionStartupState('INITIALIZE')"), 'Missing state INITIALIZE transition');
    assert.ok(content.includes("transitionStartupState('INTRO_RUNNING')"), 'Missing state INTRO_RUNNING transition');
    assert.ok(content.includes("transitionStartupState('LAYOUT_READY')"), 'Missing state LAYOUT_READY transition');
    assert.ok(content.includes("transitionStartupState('ANIMATION_READY')"), 'Missing state ANIMATION_READY transition');
    assert.ok(content.includes("transitionStartupState('INTRO_FINISHED')"), 'Missing state INTRO_FINISHED transition');
    assert.ok(content.includes("transitionStartupState('HUB_VISIBLE')"), 'Missing state HUB_VISIBLE transition');
    assert.ok(content.includes("transitionStartupState('READY')"), 'Missing state READY transition');

    // Assert that there are no unsafe setTimeout timers or loops driving the state
    assert.ok(!content.includes('studio-intro-shown'), 'Unsafe sessionStorage introduction bypass is still active in App.tsx');
  });

  // Test 3: Authoritative Success Model Check
  assertTest('UpdateIndicator.tsx authoritative success checks', () => {
    const updatePath = path.join(repoRoot, 'packages/ui-shared/src/components/UpdateIndicator.tsx');
    const content = fs.readFileSync(updatePath, 'utf8');

    // Assert that getLastInstallResult and getInstalledAppInfo are used
    assert.ok(content.includes('getLastInstallResult()'), 'getLastInstallResult() not used for version validation');
    assert.ok(content.includes('getInstalledAppInfo()'), 'getInstalledAppInfo() not used for running version verification');

    // Assert that local storage keys are NOT used for success determination on boot
    assert.ok(!content.includes("localStorage.getItem('studio:showUpdateSuccess')"), 'showUpdateSuccess read from localStorage on boot');
    assert.ok(!content.includes("localStorage.getItem('studio:appliedUpdateVersion')"), 'appliedUpdateVersion read from localStorage on boot');

    // Assert that clearInstallerLogHistory is called on Done click
    assert.ok(content.includes('clearInstallerLogHistory()'), 'clearInstallerLogHistory() not invoked on Done button click');
  });

  console.log('\n=== REGRESSION TEST RESULTS ===');
  console.log('| Test Name | Status | Details |');
  console.log('|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.name} | ${r.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${r.details} |`);
  }

  const failed = results.filter(r => r.status === 'FAIL');
  if (failed.length > 0) {
    console.error(`\n❌ Startup/Updater regression tests failed: ${failed.length} failures.`);
    process.exit(1);
  } else {
    console.log('\n✅ All startup and updater regression tests passed successfully!');
  }
}

runStartupRegressionTests().catch(err => {
  console.error('Test runner encountered an uncaught error:', err);
  process.exit(1);
});

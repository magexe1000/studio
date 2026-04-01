/**
 * patch-android.cjs
 *
 * Applies all post-cap-sync fixes automatically:
 *   1. Adds android:enableOnBackInvokedCallback="true" to AndroidManifest.xml
 *      (enables the Android 13+ predictive back gesture)
 *   2. Removes :capacitor-status-bar from capacitor.settings.gradle
 *   3. Removes :capacitor-status-bar from app/capacitor.build.gradle
 *
 * Run via:  pnpm --filter @workspace/chord-app run android:patch
 * Or as part of the full sync:  pnpm --filter @workspace/chord-app run android:sync
 */

const fs   = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, 'android');

function patchFile(filePath, label, patchFn) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP  ${label} — file not found (run cap sync first)`);
    return;
  }
  const before = fs.readFileSync(filePath, 'utf8');
  const after  = patchFn(before);
  if (after === before) {
    console.log(`  OK    ${label} — already patched`);
  } else {
    fs.writeFileSync(filePath, after, 'utf8');
    console.log(`  FIXED ${label}`);
  }
}

console.log('\nPatching Android project…\n');

// ── 1. AndroidManifest.xml ────────────────────────────────────────────────
patchFile(
  path.join(androidDir, 'app/src/main/AndroidManifest.xml'),
  'AndroidManifest.xml  (predictive back gesture)',
  (src) => {
    if (src.includes('enableOnBackInvokedCallback')) return src; // already there
    return src.replace(
      /(<application\b)/,
      '$1\n        android:enableOnBackInvokedCallback="true"'
    );
  }
);

// ── 2. capacitor.settings.gradle ─────────────────────────────────────────
patchFile(
  path.join(androidDir, 'capacitor.settings.gradle'),
  'capacitor.settings.gradle  (remove status-bar)',
  (src) => src.split('\n').filter(l => !l.includes(':capacitor-status-bar')).join('\n')
);

// ── 3. app/capacitor.build.gradle ────────────────────────────────────────
patchFile(
  path.join(androidDir, 'app/capacitor.build.gradle'),
  'app/capacitor.build.gradle  (remove status-bar)',
  (src) => src.split('\n').filter(l => !l.includes(':capacitor-status-bar')).join('\n')
);

console.log('\nDone. Ready to build:\n  .\\gradlew.bat clean assembleDebug\n');

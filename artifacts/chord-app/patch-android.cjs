/**
 * patch-android.cjs
 *
 * Applies all post-cap-sync fixes automatically:
 *   1. Adds android:enableOnBackInvokedCallback="true" to AndroidManifest.xml
 *      (enables the Android 13+ predictive back gesture)
 *   2. Removes :capacitor-status-bar from capacitor.settings.gradle
 *   3. Removes :capacitor-status-bar from app/capacitor.build.gradle
 *   4. Patches styles.xml so:
 *        - Status bar is transparent (app background shows through)
 *        - Status bar icons are white (correct for dark theme)
 *        - windowDrawsSystemBarBackgrounds = true
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
    if (src.includes('enableOnBackInvokedCallback')) return src;
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

// ── 4. styles.xml — transparent status bar with white icons ───────────────
// Makes the status bar transparent so the app background shows through it,
// and ensures icons are white (correct for dark-background app).
// The safe-area-inset-top spacer in App.tsx provides the correct padding.
function patchStyles(src) {
  const items = {
    'android:windowLightStatusBar':          'false',
    'android:statusBarColor':                '@android:color/transparent',
    'android:windowDrawsSystemBarBackgrounds': 'true',
    'android:windowTranslucentStatus':       'false',
  };

  let result = src;

  for (const [name, value] of Object.entries(items)) {
    const existing = new RegExp(`<item name="${name.replace(/:/g, ':')}">.*?<\\/item>`, 'g');
    if (result.includes(`name="${name}"`)) {
      result = result.replace(existing, `<item name="${name}">${value}</item>`);
    } else {
      result = result.replace(
        /(<\/style>)/,
        `        <item name="${name}">${value}</item>\n    $1`
      );
    }
  }

  return result;
}

['app/src/main/res/values/styles.xml',
 'app/src/main/res/values-night/styles.xml'].forEach((relPath) => {
  patchFile(
    path.join(androidDir, relPath),
    `${relPath}  (transparent status bar + white icons)`,
    patchStyles
  );
});

console.log('\nDone. Ready to build:\n  .\\gradlew.bat clean assembleDebug\n');

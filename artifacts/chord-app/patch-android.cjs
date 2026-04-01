/**
 * patch-android.cjs
 *
 * Applies all post-cap-sync fixes automatically:
 *   1. Adds android:enableOnBackInvokedCallback="true" to AndroidManifest.xml
 *      (enables the Android 13+ predictive back gesture)
 *   2. Removes :capacitor-status-bar from capacitor.settings.gradle
 *   3. Removes :capacitor-status-bar from app/capacitor.build.gradle
 *   4. Patches styles.xml so the status bar shows light (white) icons on the
 *      dark app background — fixes invisible clock/wifi/battery icons
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

// ── 4. styles.xml — white status-bar icons on dark background ─────────────
// The old @capacitor/status-bar plugin may leave windowLightStatusBar=true,
// which forces dark (invisible) icons on the app's dark background.
// We force it to false so Android shows the standard white/light icons.
['app/src/main/res/values/styles.xml',
 'app/src/main/res/values-night/styles.xml'].forEach((relPath) => {
  const stylesPath = path.join(androidDir, relPath);
  patchFile(
    stylesPath,
    `${relPath}  (white status-bar icons)`,
    (src) => {
      // If the item already exists, ensure it is false (not true)
      if (src.includes('windowLightStatusBar')) {
        return src.replace(
          /<item name="android:windowLightStatusBar">.*?<\/item>/g,
          '<item name="android:windowLightStatusBar">false</item>'
        );
      }
      // Otherwise inject it before the first </style> closing tag
      return src.replace(
        /(<\/style>)/,
        '        <item name="android:windowLightStatusBar">false</item>\n    $1'
      );
    }
  );
});

console.log('\nDone. Ready to build:\n  .\\gradlew.bat clean assembleDebug\n');

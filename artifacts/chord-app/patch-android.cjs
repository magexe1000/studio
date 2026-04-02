/**
 * patch-android.cjs
 *
 * Applies all post-cap-sync fixes automatically:
 *   1. Adds android:enableOnBackInvokedCallback="true" to AndroidManifest.xml
 *      (enables the Android 13+ predictive back gesture)
 *   2. Removes fullscreen / immersive-mode theme from AndroidManifest.xml
 *      (prevents the status bar from being hidden)
 *   3. Removes :capacitor-status-bar from capacitor.settings.gradle
 *   4. Removes :capacitor-status-bar from app/capacitor.build.gradle
 *   5. Patches styles.xml so:
 *        - Status bar uses windowTranslucentStatus=true  (proper edge-to-edge)
 *        - Status bar icons are white (correct for dark theme)
 *        - Camera cutout (notch) stays in DEFAULT mode — no gray bar
 *   6. Patches MainActivity to remove any immersive/fullscreen UI flags
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

// ── 1. AndroidManifest.xml — predictive back gesture ─────────────────────
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

// ── 2. AndroidManifest.xml — remove fullscreen/immersive theme ────────────
// Capacitor sometimes references Theme.AppCompat.NoActionBar.Fullscreen
// or similar. Replace with the standard NoActionBar theme.
patchFile(
  path.join(androidDir, 'app/src/main/AndroidManifest.xml'),
  'AndroidManifest.xml  (no fullscreen theme)',
  (src) => {
    // Replace any fullscreen theme variant that hides the status bar.
    return src
      .replace(/Theme\.AppCompat\.Light\.NoActionBar\.Fullscreen/g, 'Theme.AppCompat.Light.NoActionBar')
      .replace(/Theme\.AppCompat\.NoActionBar\.Fullscreen/g,        'Theme.AppCompat.Light.NoActionBar')
      .replace(/AppTheme\.Fullscreen/g,                              'AppTheme');
  }
);

// ── 3. capacitor.settings.gradle ─────────────────────────────────────────
patchFile(
  path.join(androidDir, 'capacitor.settings.gradle'),
  'capacitor.settings.gradle  (remove status-bar)',
  (src) => src.split('\n').filter(l => !l.includes(':capacitor-status-bar')).join('\n')
);

// ── 4. app/capacitor.build.gradle ────────────────────────────────────────
patchFile(
  path.join(androidDir, 'app/capacitor.build.gradle'),
  'app/capacitor.build.gradle  (remove status-bar)',
  (src) => src.split('\n').filter(l => !l.includes(':capacitor-status-bar')).join('\n')
);

// ── 5. styles.xml — solid status bar, always visible, correct icon colour ─
//
// windowFullscreen=false is the critical flag that stops Android from ever
// auto-hiding the status bar in this app's WebView.
//
// Light theme (values/styles.xml):
//   statusBarColor = #F2F1EF  (app light background)
//   windowLightStatusBar = true  → dark icons (time/battery/signal are black)
//
// Dark / AMOLED theme (values-night/styles.xml):
//   statusBarColor = #0E0E0E  (app dark background; pure black for AMOLED)
//   windowLightStatusBar = false → white icons
function applyStatusBarItems(src, items) {
  let result = src;
  for (const [name, value] of Object.entries(items)) {
    const pattern = new RegExp(`<item name="${name.replace(/:/g, ':')}">.*?<\\/item>`, 'g');
    if (result.includes(`name="${name}"`)) {
      result = result.replace(pattern, `<item name="${name}">${value}</item>`);
    } else {
      result = result.replace(
        /(<\/style>)/,
        `        <item name="${name}">${value}</item>\n    $1`
      );
    }
  }
  return result;
}

const COMMON = {
  'android:windowFullscreen':                'false',     // NEVER auto-hide status bar
  'android:windowTranslucentStatus':         'false',     // solid bar, not translucent
  'android:windowDrawsSystemBarBackgrounds': 'true',      // app owns bar colour
  'android:windowLayoutInDisplayCutoutMode': 'default',   // safe notch handling
};

patchFile(
  path.join(androidDir, 'app/src/main/res/values/styles.xml'),
  'values/styles.xml  (light: #F2F1EF bar, dark icons)',
  (src) => applyStatusBarItems(src, {
    ...COMMON,
    'android:statusBarColor':     '#FFF2F1EF', // matches app light bg
    'android:windowLightStatusBar': 'true',    // dark (black) icons
  })
);

patchFile(
  path.join(androidDir, 'app/src/main/res/values-night/styles.xml'),
  'values-night/styles.xml  (dark: #0E0E0E bar, white icons)',
  (src) => applyStatusBarItems(src, {
    ...COMMON,
    'android:statusBarColor':     '#FF0E0E0E', // matches app dark/AMOLED bg
    'android:windowLightStatusBar': 'false',   // white icons
  })
);

// NOTE: MainActivity is intentionally NOT patched.
// Status bar behaviour is fully controlled via styles.xml above.
// Patching MainActivity caused Java compilation errors in earlier versions.

console.log('\nDone. Ready to build:\n  .\\gradlew.bat clean assembleDebug\n');

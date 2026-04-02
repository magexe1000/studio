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

// ── 5. styles.xml — solid status bar that is always visible ──────────────
//
// The transparent/translucent approach caused a grey bar with no icons because
// the WebView content blended with the dark app background making icons invisible,
// then Android showed a grey letterbox when focus changed.
//
// Fix: solid dark status bar (#0E0E0E matches the app background).
//   - Status bar is always rendered with a solid background → icons always visible
//   - windowDrawsSystemBarBackgrounds=true → app owns the bar color
//   - windowTranslucentStatus=false → no edge-to-edge confusion
//   - windowLightStatusBar=false → white icons (correct for dark background)
//   - windowLayoutInDisplayCutoutMode=default → safe notch handling
//
// The safe-area-inset-top spacer in App.tsx becomes 0px (WebView is below the
// bar, not behind it) which is correct — no overlap, no grey bar.
function patchStyles(src) {
  const items = {
    'android:windowLightStatusBar':            'false',     // white icons on dark bg
    'android:statusBarColor':                  '#FF0E0E0E', // solid dark — matches app bg
    'android:windowTranslucentStatus':         'false',     // not translucent
    'android:windowDrawsSystemBarBackgrounds': 'true',      // app owns bar colour
    'android:windowLayoutInDisplayCutoutMode': 'default',   // safe notch handling
  };

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

['app/src/main/res/values/styles.xml',
 'app/src/main/res/values-night/styles.xml'].forEach((relPath) => {
  patchFile(
    path.join(androidDir, relPath),
    `${relPath}  (translucent status bar + white icons + default cutout)`,
    patchStyles
  );
});

// NOTE: MainActivity is intentionally NOT patched.
// Status bar behaviour is fully controlled via styles.xml above.
// Patching MainActivity caused Java compilation errors in earlier versions.

console.log('\nDone. Ready to build:\n  .\\gradlew.bat clean assembleDebug\n');

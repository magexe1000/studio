/**
 * patch-android.cjs
 *
 * Applies all post-cap-sync fixes automatically:
 *   1. Adds android:enableOnBackInvokedCallback="true" to AndroidManifest.xml
 *   2. Removes fullscreen theme references from AndroidManifest.xml
 *   3. Patches values/styles.xml  (windowFullscreen=false, draws system bar backgrounds)
 *   4. Creates + patches values-night/styles.xml (same items, dark-mode icon colour)
 *   5. Writes a clean MainActivity.java that permanently prevents fullscreen mode
 *
 * Note: The @capacitor/status-bar plugin is intentionally kept — it controls
 * the actual bar colour and icon style at runtime from JavaScript.
 *
 * Run via:  node patch-android.cjs
 */

const fs   = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, 'android');

function patchFile(filePath, label, patchFn) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP  ${label} — file not found`);
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

// ── 2. AndroidManifest.xml — strip any fullscreen theme ──────────────────
patchFile(
  path.join(androidDir, 'app/src/main/AndroidManifest.xml'),
  'AndroidManifest.xml  (no fullscreen theme)',
  (src) => src
    .replace(/Theme\.AppCompat\.Light\.NoActionBar\.Fullscreen/g, 'Theme.AppCompat.Light.NoActionBar')
    .replace(/Theme\.AppCompat\.NoActionBar\.Fullscreen/g,        'Theme.AppCompat.Light.NoActionBar')
    .replace(/AppTheme\.Fullscreen/g,                              'AppTheme')
);

// ── 3 & 4. styles.xml ─────────────────────────────────────────────────────
//
// windowFullscreen=false            → status bar NEVER auto-hides
// windowDrawsSystemBarBackgrounds=true → app can control bar colour via plugin
// windowTranslucentStatus=false     → no grey translucent overlay
// windowLayoutInDisplayCutoutMode=default → safe notch handling
//
// The @capacitor/status-bar plugin sets the actual colour + icon style at
// runtime based on the user's chosen theme (light / dark / AMOLED).

function applyItems(src, items) {
  let result = src;
  for (const [name, value] of Object.entries(items)) {
    const pat = new RegExp(`<item name="${name}">.*?<\\/item>`, 'g');
    if (result.includes(`name="${name}"`)) {
      result = result.replace(pat, `<item name="${name}">${value}</item>`);
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
  'android:windowFullscreen':                'false',
  'android:windowTranslucentStatus':         'false',
  'android:windowDrawsSystemBarBackgrounds': 'true',
  'android:windowLayoutInDisplayCutoutMode': 'default',
  'android:windowSplashScreenAnimationDuration': '0',
  'android:windowSplashScreenBackground':    '#111116',
};

patchFile(
  path.join(androidDir, 'app/src/main/res/values/styles.xml'),
  'values/styles.xml  (no fullscreen, plugin controls bar colour)',
  (src) => applyItems(src, { ...COMMON, 'android:windowLightStatusBar': 'true' })
);

const nightDir  = path.join(androidDir, 'app/src/main/res/values-night');
const nightFile = path.join(nightDir, 'styles.xml');
if (!fs.existsSync(nightDir))  fs.mkdirSync(nightDir, { recursive: true });
if (!fs.existsSync(nightFile)) {
  fs.writeFileSync(nightFile,
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
    </style>
</resources>
`, 'utf8');
  console.log('  CREATED values-night/styles.xml');
}
patchFile(
  nightFile,
  'values-night/styles.xml  (no fullscreen, white icons for dark mode)',
  (src) => applyItems(src, { ...COMMON, 'android:windowLightStatusBar': 'false' })
);

// ── 5. Write a clean MainActivity.java ───────────────────────────────────
// Written fresh every time (not patched) so there is zero risk of broken syntax.
// clearFlags(FLAG_FULLSCREEN) ensures the status bar can never be hidden.
// NOTE: Do NOT call setDecorFitsSystemWindows here — the StatusBar plugin
//       manages overlay mode (overlay:true/false) via its own API.
const mainActivityPath = path.join(
  androidDir,
  'app/src/main/java/com/chordex/app/MainActivity.java'
);

const mainActivityContent =
`package com.chordex.app;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Dismiss the Android 12+ splash screen immediately so the app
        // animation plays right away without a separate launch screen.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSplashScreen().setOnExitAnimationListener(
                splashScreenView -> splashScreenView.remove()
            );
        }
        super.onCreate(savedInstanceState);
        // Status bar must always be visible — never allow fullscreen mode.
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            // Re-assert non-fullscreen if anything tried to change it.
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        }
    }
}
`;

if (fs.existsSync(mainActivityPath)) {
  fs.writeFileSync(mainActivityPath, mainActivityContent, 'utf8');
  console.log('  FIXED MainActivity.java  (status bar always visible)');
} else {
  console.warn('  SKIP  MainActivity.java  — file not found (run cap sync first)');
}

console.log('\nDone. Ready to build:\n  .\\gradlew.bat assembleDebug\n');

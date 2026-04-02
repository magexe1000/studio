/**
 * patch-android.cjs
 *
 * Applies all post-cap-sync fixes automatically:
 *   1. Adds android:enableOnBackInvokedCallback="true" to AndroidManifest.xml
 *   2. Removes fullscreen theme references from AndroidManifest.xml
 *   3. Removes :capacitor-status-bar from capacitor.settings.gradle
 *   4. Removes :capacitor-status-bar from app/capacitor.build.gradle
 *   5. Patches values/styles.xml  (light theme  → beige bar, dark icons)
 *   6. Creates + patches values-night/styles.xml (dark theme → dark bar, white icons)
 *   7. Writes a clean MainActivity.java that permanently prevents fullscreen mode
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

// ── 3. capacitor.settings.gradle ─────────────────────────────────────────
patchFile(
  path.join(androidDir, 'capacitor.settings.gradle'),
  'capacitor.settings.gradle  (remove status-bar plugin)',
  (src) => src.split('\n').filter(l => !l.includes(':capacitor-status-bar')).join('\n')
);

// ── 4. app/capacitor.build.gradle ────────────────────────────────────────
patchFile(
  path.join(androidDir, 'app/capacitor.build.gradle'),
  'app/capacitor.build.gradle  (remove status-bar plugin)',
  (src) => src.split('\n').filter(l => !l.includes(':capacitor-status-bar')).join('\n')
);

// ── 5 & 6. styles.xml — solid status bar, correct icon colour ─────────────
//
// windowFullscreen=false  → status bar NEVER auto-hides
// windowDrawsSystemBarBackgrounds=true  → app owns the bar colour
// windowTranslucentStatus=false  → solid bar, not a grey translucent overlay
// windowLayoutInDisplayCutoutMode=default  → safe notch handling
//
// Light  (values/styles.xml):       bar=#F2F1EF, dark icons (black clock/battery)
// Dark   (values-night/styles.xml): bar=#0E0E0E, white icons
//
// values-night is created from scratch if Capacitor didn't generate it.

function applyItems(src, items) {
  let result = src;
  for (const [name, value] of Object.entries(items)) {
    const pat = new RegExp(`<item name="${name}">.*?<\\/item>`, 'g');
    if (result.includes(`name="${name}"`)) {
      result = result.replace(pat, `<item name="${name}">${value}</item>`);
    } else {
      // Insert before the first </style> closing tag
      result = result.replace(
        /(<\/style>)/,
        `        <item name="${name}">${value}</item>\n    $1`
      );
    }
  }
  return result;
}

// Transparent status bar — app background shows through it seamlessly.
// windowDrawsSystemBarBackgrounds=true: app owns what's behind the bar.
// windowTranslucentStatus=false:        we use explicit transparent colour, not a grey overlay.
// windowFullscreen=false:               bar is NEVER hidden.
// windowLayoutInDisplayCutoutMode=default: safe notch handling.
const COMMON = {
  'android:windowFullscreen':                'false',
  'android:windowTranslucentStatus':         'false',
  'android:windowDrawsSystemBarBackgrounds': 'true',
  'android:windowLayoutInDisplayCutoutMode': 'default',
  'android:statusBarColor':                  '@android:color/transparent',
};

// Light theme — dark (black) icons so they're readable on a light bg
patchFile(
  path.join(androidDir, 'app/src/main/res/values/styles.xml'),
  'values/styles.xml  (transparent bar, dark icons for light mode)',
  (src) => applyItems(src, {
    ...COMMON,
    'android:windowLightStatusBar': 'true',
  })
);

// Dark / AMOLED theme — white icons on dark bg.
// Create values-night/styles.xml if Capacitor didn't generate it.
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
  'values-night/styles.xml  (transparent bar, white icons for dark mode)',
  (src) => applyItems(src, {
    ...COMMON,
    'android:windowLightStatusBar': 'false',
  })
);

// ── 7. Write a clean MainActivity.java ───────────────────────────────────
// Written fresh every time (not patched) so there is zero risk of broken syntax.
// clearFlags(FLAG_FULLSCREEN) + onWindowFocusChanged ensures the status bar
// can never be hidden, even if the WebView tries to request fullscreen.
const mainActivityPath = path.join(
  androidDir,
  'app/src/main/java/com/chordex/app/MainActivity.java'
);

const mainActivityContent =
`package com.chordex.app;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Status bar must always be visible — never allow fullscreen mode.
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        // Edge-to-edge: WebView draws behind the transparent status bar.
        // The app uses env(safe-area-inset-top) in CSS to pad content correctly.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
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

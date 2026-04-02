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

// ── 5. styles.xml — proper transparent status bar ────────────────────────
//
// Root cause of "gray bar without icons":
//   windowTranslucentStatus=false + statusBarColor=transparent
//   causes Android to show a gray letterbox behind the status bar with no icons.
//
// Fix: use windowTranslucentStatus=true — the OS renders a natural translucent
// overlay; the WebView content draws behind it; env(safe-area-inset-top) gives
// the correct padding value so the app content is never obscured.
//
// windowLayoutInDisplayCutoutMode=default: notch area shows the status bar
// normally; content never intrudes into the cutout.
function patchStyles(src) {
  const items = {
    'android:windowLightStatusBar':            'false',           // white icons on dark bg
    'android:statusBarColor':                  '@android:color/transparent',
    'android:windowTranslucentStatus':         'true',            // FIX: was false → gray bar
    'android:windowLayoutInDisplayCutoutMode': 'default',         // FIX: safe notch handling
  };

  // Keys that conflict with the correct approach — remove them if present.
  const remove = ['android:windowDrawsSystemBarBackgrounds'];

  let result = src;

  // Remove conflicting items.
  for (const name of remove) {
    result = result.replace(
      new RegExp(`\\s*<item name="${name.replace(/:/g, ':')}">[^<]*<\\/item>`, 'g'),
      ''
    );
  }

  // Set / update desired items.
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

// ── 6. MainActivity — remove immersive / fullscreen UI flags ──────────────
// Capacitor WebView can call setSystemUiVisibility with FULLSCREEN / IMMERSIVE
// flags. Comment out those lines so the status bar is always visible.
function patchMainActivity(src) {
  // Work line-by-line so we comment out the whole statement, not just a token.
  const BAD_PATTERNS = [
    /FLAG_FULLSCREEN/,
    /SYSTEM_UI_FLAG_FULLSCREEN/,
    /SYSTEM_UI_FLAG_IMMERSIVE/,
    /SYSTEM_UI_FLAG_IMMERSIVE_STICKY/,
    /\.hide\(WindowInsets\.Type\.statusBars/,
    /\.setSystemBarsBehavior\(/,
    /setSystemUiVisibility\(/,
  ];

  return src
    .split('\n')
    .map(line => {
      const shouldComment = BAD_PATTERNS.some(p => p.test(line));
      if (shouldComment && !line.trim().startsWith('//')) {
        return line.replace(/^(\s*)/, '$1// [chordex-patch] ');
      }
      return line;
    })
    .join('\n');
}

['app/src/main/java/com/chordex/app/MainActivity.java',
 'app/src/main/java/com/chordex/app/MainActivity.kt'].forEach((relPath) => {
  const fullPath = path.join(androidDir, relPath);
  if (fs.existsSync(fullPath)) {
    patchFile(fullPath, `${relPath}  (remove fullscreen/immersive flags)`, patchMainActivity);
  }
});

console.log('\nDone. Ready to build:\n  .\\gradlew.bat clean assembleDebug\n');

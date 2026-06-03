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

// ── 1b. AndroidManifest.xml — legacy external storage (Android 10) ──────────
patchFile(
  path.join(androidDir, 'app/src/main/AndroidManifest.xml'),
  'AndroidManifest.xml  (legacy external storage for Android 10)',
  (src) => {
    if (src.includes('requestLegacyExternalStorage')) return src;
    return src.replace(
      /(<application\b)/,
      '$1\n        android:requestLegacyExternalStorage="true"'
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

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

import java.io.File;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {

    private static final String OTA_WORK_NAME = "studio_ota_check";
    
    // Cached shared file payload for cold starts
    public static JSObject lastSharedFile = null;
    private Uri sharedFileUriToProcess = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Intercept file sharing intent BEFORE calling super.onCreate to prevent Bridge from redirecting
        handleIncomingIntent(getIntent());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSplashScreen().setOnExitAnimationListener(
                splashScreenView -> splashScreenView.remove()
            );
        }
        // CRITICAL: Custom local Capacitor plugins in the app package MUST be registered
        // manually in MainActivity. Do not remove or rename this plugin registration.
        registerPlugin(AppInstallerPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        scheduleOtaBackgroundCheck();

        // Custom WebChromeClient to automatically grant WebView permission requests (e.g. getUserMedia microphone)
        // This bypasses any site-level permission blocks inside WebView once OS permission is granted.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setWebChromeClient(new com.getcapacitor.BridgeWebChromeClient(this.bridge) {
                @Override
                public void onPermissionRequest(final android.webkit.PermissionRequest request) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            request.grant(request.getResources());
                        }
                    });
                }
            });
        }

        // Process any cold boot shared file
        if (sharedFileUriToProcess != null) {
            processIncomingFile(sharedFileUriToProcess);
            sharedFileUriToProcess = null;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        
        String action = intent.getAction();
        Uri data = intent.getData();
        Uri targetUri = null;

        if (Intent.ACTION_VIEW.equals(action) && data != null) {
            String scheme = data.getScheme();
            if ("content".equals(scheme) || "file".equals(scheme)) {
                intent.setData(null);
                intent.setAction(Intent.ACTION_MAIN);
                targetUri = data;
            }
        } else if (Intent.ACTION_SEND.equals(action) && intent.getType() != null) {
            Uri streamUri = (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (streamUri != null) {
                intent.setAction(Intent.ACTION_MAIN);
                intent.removeExtra(Intent.EXTRA_STREAM);
                targetUri = streamUri;
            }
        }

        if (targetUri != null) {
            processIncomingFile(targetUri);
        }
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri data = intent.getData();

        if (Intent.ACTION_VIEW.equals(action) && data != null) {
            String scheme = data.getScheme();
            if ("content".equals(scheme) || "file".equals(scheme)) {
                intent.setData(null); // Prevent BridgeActivity from loading this file path directly as a webpage
                intent.setAction(Intent.ACTION_MAIN);
                sharedFileUriToProcess = data;
            }
        } else if (Intent.ACTION_SEND.equals(action) && intent.getType() != null) {
            Uri streamUri = (Uri) intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (streamUri != null) {
                intent.setAction(Intent.ACTION_MAIN);
                intent.removeExtra(Intent.EXTRA_STREAM);
                sharedFileUriToProcess = streamUri;
            }
        }
    }

    private void processIncomingFile(Uri uri) {
        try {
            String fileName = getFileName(uri);
            String mimeType = getContentResolver().getType(uri);
            if (mimeType == null) {
                mimeType = "";
            }

            JSObject fileObj = new JSObject();
            fileObj.put("fileName", fileName);

            if (fileName.endsWith(".json") || mimeType.contains("json")) {
                // Read text contents
                java.io.InputStream inputStream = getContentResolver().openInputStream(uri);
                java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(inputStream));
                StringBuilder stringBuilder = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    stringBuilder.append(line);
                }
                inputStream.close();
                String jsonContent = stringBuilder.toString();

                fileObj.put("type", "json");
                fileObj.put("data", jsonContent);
                lastSharedFile = fileObj;

                triggerJsEvent("chordex:shared-json", jsonContent, fileName);
            } else {
                // Copy to cache directory
                java.io.InputStream inputStream = getContentResolver().openInputStream(uri);
                File cacheDir = getCacheDir();
                File tempFile = new File(cacheDir, "shared_" + System.currentTimeMillis() + "_" + fileName);
                java.io.OutputStream outputStream = new java.io.FileOutputStream(tempFile);
                byte[] buffer = new byte[1024];
                int read;
                while ((read = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, read);
                }
                inputStream.close();
                outputStream.close();

                String filePath = tempFile.getAbsolutePath();
                fileObj.put("type", "audio");
                fileObj.put("data", filePath);
                lastSharedFile = fileObj;

                triggerJsEvent("chordex:shared-audio", filePath, fileName);
            }
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "Failed to process shared file: " + e.getMessage());
        }
    }

    private String getFileName(Uri uri) {
        String result = null;
        if ("content".equals(uri.getScheme())) {
            android.database.Cursor cursor = getContentResolver().query(uri, null, null, null, null);
            try {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                    if (index >= 0) {
                        result = cursor.getString(index);
                    }
                }
            } catch (Exception e) {
                android.util.Log.w("MainActivity", "Failed to query filename: " + e.getMessage());
            } finally {
                if (cursor != null) cursor.close();
            }
        }
        if (result == null) {
            result = uri.getPath();
            int cut = result.lastIndexOf('/');
            if (cut != -1) {
                result = result.substring(cut + 1);
            }
        }
        return result;
    }

    private void triggerJsEvent(final String eventName, final String data, final String fileName) {
        if (this.bridge == null || this.bridge.getWebView() == null) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    String escapedData = data.replace("\\\\", "\\\\\\\\").replace("'", "\\\\'").replace("\\\\n", "\\\\\\\\n").replace("\\\\r", "\\\\\\\\r");
                    String escapedFileName = fileName.replace("\\\\", "\\\\\\\\").replace("'", "\\\\'");
                    String js = "window.dispatchEvent(new CustomEvent('" + eventName + "', { detail: { data: '" + escapedData + "', fileName: '" + escapedFileName + "' } }));";
                    MainActivity.this.bridge.getWebView().evaluateJavascript(js, null);
                } catch (Exception e) {
                    android.util.Log.e("MainActivity", "Failed to evaluate JS: " + e.getMessage());
                }
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        }
    }

    private void scheduleOtaBackgroundCheck() {
        try {
            Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
            PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                    OtaCheckWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();
            WorkManager.getInstance(this).enqueueUniquePeriodicWork(
                OTA_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            );
        } catch (Exception e) {
            android.util.Log.w("MainActivity", "OTA background work failed to schedule: " + e.getMessage());
        }
    }
}
`;

if (fs.existsSync(mainActivityPath)) {
  fs.writeFileSync(mainActivityPath, mainActivityContent, 'utf8');
  console.log('  FIXED MainActivity.java  (status bar + OTA background worker)');
} else {
  console.warn('  SKIP  MainActivity.java  — file not found (run cap sync first)');
}

// ── 6. Ensure WorkManager dependency is in app/build.gradle ─────────────
patchFile(
  path.join(androidDir, 'app/build.gradle'),
  'app/build.gradle  (androidx.work dependency)',
  (src) => {
    if (src.includes('androidx.work:work-runtime')) return src;
    return src.replace(
      /(implementation "com\.google\.firebase:firebase-auth:\$firebaseAuthVersion"\s*\n)/,
      '$1    implementation "androidx.work:work-runtime:2.9.1"\n'
    );
  }
);

// ── 7. Ensure ListenableFuture stub is in app/build.gradle ──────────────
// WorkManager 2.9's Worker base class exposes ListenableFuture in its
// public API, so javac requires the class at compile time. Without this
// stub the build fails with "cannot access ListenableFuture".
patchFile(
  path.join(androidDir, 'app/build.gradle'),
  'app/build.gradle  (listenablefuture stub)',
  (src) => {
    if (src.includes('com.google.guava:listenablefuture')) return src;
    return src.replace(
      /(implementation "androidx\.work:work-runtime:[^"]+"\s*\n)/,
      '$1    implementation "com.google.guava:listenablefuture:1.0"\n'
    );
  }
);

console.log('\nDone. Ready to build:\n  .\\gradlew.bat assembleDebug\n');

package com.chordex.app;

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
                    String escapedData = data.replace("\\", "\\\\").replace("'", "\\'").replace("\\n", "\\\\n").replace("\\r", "\\\\r");
                    String escapedFileName = fileName.replace("\\", "\\\\").replace("'", "\\'");
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

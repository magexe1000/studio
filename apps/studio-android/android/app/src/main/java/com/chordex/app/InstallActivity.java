package com.chordex.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Bundle;
import android.util.Log;

public class InstallActivity extends Activity {
    private static final String TAG = "InstallActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "[INSTRUMENTATION] [NATIVE] InstallActivity.onCreate ENTER");
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Log.d(TAG, "[INSTRUMENTATION] [NATIVE] InstallActivity.onNewIntent ENTER");
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) {
            Log.e(TAG, "[INSTRUMENTATION] [NATIVE] InstallActivity: Received null intent. Finishing.");
            finish();
            return;
        }

        String action = intent.getAction();
        Log.d(TAG, "[INSTRUMENTATION] [NATIVE] InstallActivity: Received action: " + action);

        boolean shouldFinish = true;

        if ("com.chordex.app.SESSION_API_PACKAGE_INSTALLED".equals(action)) {
            int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
            String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            String otherPackageName = intent.getStringExtra(PackageInstaller.EXTRA_OTHER_PACKAGE_NAME);

            Log.d(TAG, "[INSTRUMENTATION] [NATIVE] InstallActivity status: " + status + ", message: " + message);

            // Forward to InstallReceiver via broadcast to preserve SharedPreferences, logs, and Capacitor callbacks.
            Intent receiverIntent = new Intent(this, InstallReceiver.class);
            receiverIntent.setAction(action);
            receiverIntent.putExtras(intent);
            sendBroadcast(receiverIntent);
            Log.d(TAG, "[INSTRUMENTATION] [NATIVE] Forwarded intent to InstallReceiver via broadcast");

            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                Log.d(TAG, "[INSTRUMENTATION] [NATIVE] Status is STATUS_PENDING_USER_ACTION. Preparing confirmation intent.");
                Intent confirmIntent = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirmIntent != null) {
                    try {
                        confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        Log.d(TAG, "[INSTRUMENTATION] [NATIVE] Launching confirmation activity (system dialog)...");
                        startActivity(confirmIntent);
                        Log.d(TAG, "[INSTRUMENTATION] [NATIVE] Confirmation activity launched successfully.");
                        shouldFinish = false; // Do NOT finish yet; keep this activity alive behind the system dialog
                    } catch (Exception e) {
                        Log.e(TAG, "[INSTRUMENTATION] [NATIVE] Failed to launch confirmation activity", e);
                        shouldFinish = true;
                    }
                } else {
                    Log.e(TAG, "[INSTRUMENTATION] [NATIVE] Error: EXTRA_INTENT was null in pending user action.");
                    shouldFinish = true;
                }
            } else {
                Log.d(TAG, "[INSTRUMENTATION] [NATIVE] Status is " + status + ". Finishing helper activity.");
                shouldFinish = true;
            }
        }

        if (shouldFinish) {
            Log.d(TAG, "[INSTRUMENTATION] [NATIVE] InstallActivity.finish() called");
            finish();
        } else {
            Log.d(TAG, "[INSTRUMENTATION] [NATIVE] InstallActivity keeping alive in background.");
        }
    }
}

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
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) {
            finish();
            return;
        }

        String action = intent.getAction();
        Log.d(TAG, "handleIntent: action=" + action);

        if ("com.chordex.app.SESSION_API_PACKAGE_INSTALLED".equals(action)) {
            int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
            String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            String otherPackageName = intent.getStringExtra(PackageInstaller.EXTRA_OTHER_PACKAGE_NAME);

            Log.d(TAG, "Install status: " + status + ", message: " + message);

            // Forward to InstallReceiver via broadcast to preserve the existing logging, SharedPreferences, and Capacitor callbacks.
            Intent receiverIntent = new Intent(this, InstallReceiver.class);
            receiverIntent.setAction(action);
            receiverIntent.putExtras(intent);
            sendBroadcast(receiverIntent);

            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                Intent confirmIntent = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirmIntent != null) {
                    try {
                        confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(confirmIntent);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to launch confirmation activity", e);
                    }
                }
            }
        }
        finish();
    }
}

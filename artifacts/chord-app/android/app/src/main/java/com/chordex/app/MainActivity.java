package com.chordex.app;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.BridgeActivity;

import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {

    /** Unique name for the background OTA poll. Re-using the same name
     *  with KEEP policy means the schedule survives across app launches
     *  without piling up duplicate workers. */
    private static final String OTA_WORK_NAME = "studio_ota_check";

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

        scheduleOtaBackgroundCheck();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            // Re-assert non-fullscreen if anything tried to change it.
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        }
    }

    /**
     * Register the periodic background OTA check with WorkManager.
     * Runs every 15 minutes (Android's minimum) when the device has a
     * network connection, even if the app process is dead. Uses KEEP
     * so we don't reset the timer every time the user opens the app.
     */
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
            // Failure here must never block app launch.
            android.util.Log.w("MainActivity", "OTA background work failed to schedule: " + e.getMessage());
        }
    }
}

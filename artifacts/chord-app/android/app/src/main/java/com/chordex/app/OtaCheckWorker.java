package com.chordex.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Background WorkManager worker that polls the self-hosted OTA
 * version manifest and posts a system notification if a new bundle is
 * available — even when the app is not running.
 *
 * Scheduled from {@link MainActivity#onCreate} as a unique periodic
 * work request with a 15-minute interval (Android's minimum) and a
 * "network connected" constraint.
 *
 * State is shared with the JS side through the {@code CapacitorStorage}
 * SharedPreferences file — the same file backing
 * {@code @capacitor/preferences}. The JS side writes the same keys via
 * {@code nativePrefs.ts}.
 */
public class OtaCheckWorker extends Worker {

    private static final String TAG = "OtaCheckWorker";

    /** URLs of the self-hosted version manifest, in priority order.
     *
     *  raw.githubusercontent.com is the FAST PATH — it serves the file
     *  within seconds of a `git push`, while GitHub Pages (Fastly CDN)
     *  can take 2–3 minutes to flush. We try raw first; if it fails
     *  (private repo, network blocked, branch rename), we fall back to
     *  the Pages URL. Whichever returns a higher semver wins. */
    private static final String[] VERSION_URLS = new String[] {
        "https://studio-30f44.web.app/app-release.json",
        "https://studio-30f44.web.app/version.json",
    };

    /** Capacitor's default SharedPreferences group used by the
     *  {@code @capacitor/preferences} plugin. Must match the JS side. */
    private static final String PREFS_FILE = "CapacitorStorage";

    /** Keys mirrored from {@code src/lib/nativePrefs.ts → NATIVE_PREFS}. */
    private static final String KEY_REMOTE_SEEN          = "studio_ota.remote_seen";
    private static final String KEY_INSTALLED            = "studio_ota.installed_version";
    /** "true" / "false" — when "false", the user has explicitly
     *  silenced update notifications via Settings → Updater. We must
     *  NEVER post a system notification in that case, even with the
     *  app fully closed. JS mirrors this on every toggle change. */
    private static final String KEY_NOTIFICATIONS_ENABLED = "studio_ota.notifications_enabled";

    private static final String CHANNEL_ID   = "studio_ota_updates";
    private static final String CHANNEL_NAME = "Studio updates";

    public OtaCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            String remote = fetchRemoteVersion();
            if (remote == null || remote.isEmpty()) {
                return Result.success();
            }
            Context ctx = getApplicationContext();
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE);
            String installed = prefs.getString(KEY_INSTALLED, null);
            String alreadySeen = prefs.getString(KEY_REMOTE_SEEN, null);

            // Don't notify if the user is already on this version or
            // if we've already surfaced this version in any UI.
            if (alreadySeen != null && compareSemver(remote, alreadySeen) <= 0) {
                return Result.success();
            }
            if (installed != null && compareSemver(remote, installed) <= 0) {
                // User is current — silently update the seen marker so
                // we don't post on the next tick either.
                prefs.edit().putString(KEY_REMOTE_SEEN, remote).apply();
                return Result.success();
            }

            // Honor the user's "Update notifications" toggle. When
            // explicitly set to "false", stay silent — but still
            // advance the seen marker so we don't accumulate a backlog
            // of "missed" notifications that all fire the moment the
            // user re-enables the toggle.
            String notifEnabled = prefs.getString(KEY_NOTIFICATIONS_ENABLED, "true");
            if ("false".equalsIgnoreCase(notifEnabled)) {
                prefs.edit().putString(KEY_REMOTE_SEEN, remote).apply();
                return Result.success();
            }

            postNotification(ctx, remote);
            prefs.edit().putString(KEY_REMOTE_SEEN, remote).apply();
            return Result.success();
        } catch (Exception e) {
            Log.w(TAG, "OTA check failed: " + e.getMessage());
            // Retry on the next periodic tick — no need for explicit retry.
            return Result.success();
        }
    }

    /** Fetch the JSON manifest and pull out the {@code version} field.
     *  Tries each URL in {@link #VERSION_URLS} in order; the first one
     *  that responds with a parseable semver wins. We do NOT race them
     *  in parallel here (the worker runs at most once every 15 min, so
     *  the latency budget is generous and serial is simpler). */
    private String fetchRemoteVersion() {
        String best = null;
        for (String base : VERSION_URLS) {
            String v = fetchOne(base);
            if (v == null) continue;
            if (best == null || compareSemver(v, best) > 0) best = v;
        }
        return best;
    }

    private String fetchOne(String base) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(base + "?t=" + System.currentTimeMillis());
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Cache-Control", "no-cache");
            conn.setRequestProperty("Pragma", "no-cache");
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) return null;
            StringBuilder body = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                String line;
                while ((line = r.readLine()) != null) body.append(line);
            }
            JSONObject json = new JSONObject(body.toString());
            String v = json.optString("version", "");
            return v.trim().isEmpty() ? null : v.trim();
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** Post a tap-to-open notification announcing the new version. */
    private void postNotification(Context ctx, String version) {
        NotificationManager nm =
            (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // Android 8+: ensure the channel exists before posting.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = nm.getNotificationChannel(CHANNEL_ID);
            if (channel == null) {
                channel = new NotificationChannel(
                    CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_DEFAULT);
                channel.setDescription("Notifies when a new Studio update is available.");
                nm.createNotificationChannel(channel);
            }
        }

        // Tap → reopens the app at MainActivity.
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = null;
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            pi = PendingIntent.getActivity(ctx, 0, launch, flags);
        }

        // Read native version to determine update type
        String nativeVersion = "0.0.0";
        try {
            nativeVersion = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionName;
        } catch (Exception e) {
            Log.w(TAG, "Failed to get native version name: " + e.getMessage());
        }

        boolean isNativeUpgrade = compareSemver(version, nativeVersion) > 0;
        // Detect system locale for English vs Spanish
        boolean isEs = java.util.Locale.getDefault().getLanguage().equals("es");

        String title;
        String body;
        if (isNativeUpgrade) {
            title = isEs ? "Actualización de Sistema Studio (APK)" : "Studio Native System Update (APK)";
            body = isEs 
                ? "La versión " + version + " requiere reinstalar la APK para aplicar cambios de permisos y seguridad."
                : "Version " + version + " requires reinstalling the APK for native system and permission fixes.";
        } else {
            title = isEs ? "Actualización de Interfaz Studio (OTA)" : "Studio Interface Update (OTA)";
            body = isEs
                ? "La versión " + version + " está lista. ¡Cambios visuales aplicados al instante en segundo plano!"
                : "Version " + version + " UI improvements are ready. Applied instantly in the background!";
        }

        // v3.0.57: Use a dedicated info-style notification icon ("i" in
        // a circle) instead of the launcher icon. Android tints status-
        // bar icons to white, so the colored launcher icon was rendering
        // as an unrecognizable blob. Falls back to the launcher icon
        // only if the dedicated drawable is missing.
        int icon = R.drawable.ic_notification_info;
        if (icon == 0) {
            try {
                icon = ctx.getPackageManager()
                    .getApplicationInfo(ctx.getPackageName(), 0).icon;
                if (icon == 0) icon = android.R.drawable.stat_sys_download_done;
            } catch (PackageManager.NameNotFoundException e) {
                icon = android.R.drawable.stat_sys_download_done;
            }
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        if (pi != null) b.setContentIntent(pi);

        // Stable id derived from the version so the same release can't
        // produce two visible notifications, but a future release will.
        nm.notify(notificationId(version), b.build());
    }

    /** Stable, non-negative 31-bit hash of the version string. */
    private static int notificationId(String s) {
        int h = 0;
        for (int i = 0; i < s.length(); i++) {
            h = ((h << 5) - h) + s.charAt(i);
        }
        return h & 0x7fffffff;
    }

    /** Compare two semver-ish strings ("3.0.10" vs "3.0.9"). Missing
     *  parts are treated as 0; non-numeric parts compare as 0. Returns
     *  negative if {@code a < b}, positive if {@code a > b}, 0 if equal. */
    static int compareSemver(String a, String b) {
        String[] pa = a.replaceFirst("^[vV]", "").split("\\.");
        String[] pb = b.replaceFirst("^[vV]", "").split("\\.");
        int n = Math.max(pa.length, pb.length);
        for (int i = 0; i < n; i++) {
            int ai = i < pa.length ? parseIntSafe(pa[i]) : 0;
            int bi = i < pb.length ? parseIntSafe(pb[i]) : 0;
            if (ai != bi) return Integer.compare(ai, bi);
        }
        return 0;
    }

    private static int parseIntSafe(String s) {
        try {
            // Strip any pre-release suffix like "1-rc.1" → "1".
            int dash = s.indexOf('-');
            if (dash >= 0) s = s.substring(0, dash);
            return Integer.parseInt(s.trim());
        } catch (Exception e) {
            return 0;
        }
    }
}

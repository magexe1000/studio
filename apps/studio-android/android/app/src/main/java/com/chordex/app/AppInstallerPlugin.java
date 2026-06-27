package com.chordex.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import android.Manifest;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKeys;
import java.io.File;
import java.net.URI;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.app.PendingIntent;
import android.content.pm.PackageInstaller;
import android.util.Log;

@CapacitorPlugin(
    name = "AppInstaller",
    permissions = {
        @Permission(
            alias = "images",
            strings = { Manifest.permission.READ_MEDIA_IMAGES }
        ),
        @Permission(
            alias = "audio",
            strings = { Manifest.permission.READ_MEDIA_AUDIO }
        ),
        @Permission(
            alias = "video",
            strings = { Manifest.permission.READ_MEDIA_VIDEO }
        ),
        @Permission(
            alias = "storage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
        )
    }
)
// CRITICAL WARNING:
// This plugin name "AppInstaller" and its methods:
// - downloadApk
// - verifyApkSha256
// - installApk
// - openInstallPermissionSettings
// are a permanent native-to-JS bridge contract.
// Do NOT rename this plugin.
// Do NOT remove this plugin.
// Do NOT change the method signatures or names.
// The Studio OTA/APK update flow depends on this native bridge to function.
public class AppInstallerPlugin extends Plugin {

    private static int callIdCounter = 0;
    
    public static int downloadApkCallCount = 0;
    public static int downloadAndInstallApkCallCount = 0;
    public static int verifySha256CallCount = 0;
    public static int installApkCallCount = 0;
    public static int triggerInstallationCallCount = 0;
    public static int sessionCreateCallCount = 0;
    public static int sessionWriteCallCount = 0;
    public static int sessionFsyncCallCount = 0;
    public static int sessionCommitCallCount = 0;

    private static int nextCallId() {
        synchronized (AppInstallerPlugin.class) {
            return ++callIdCounter;
        }
    }
    
    public static void logNativeInstrumentation(Context context, String methodName, int callId, String event, String details) {
        String threadName = Thread.currentThread().getName();
        long threadId = Thread.currentThread().getId();
        String message = String.format("[%s] Call #%d [Thread: %s (id: %d)] Details: %s", event, callId, threadName, threadId, details);
        Log.d("INSTRUMENTATION", "NATIVE: " + methodName + " " + message);
        if (context != null) {
            InstallReceiver.appendLog(context, "[INSTRUMENTATION] " + methodName, 0, message, context.getPackageName(), null);
        }
    }

    private SharedPreferences getSecurePreferences() throws Exception {
        Context context = getContext();
        String masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC);
        return EncryptedSharedPreferences.create(
            "secure_prefs",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }

    @PluginMethod
    public void notifyAppReady(PluginCall call) {
        MainActivity.isWebViewReady = true;
        call.resolve();
    }

    @PluginMethod
    public void getSharedFile(PluginCall call) {
        if (MainActivity.lastSharedFile != null) {
            call.resolve(MainActivity.lastSharedFile);
            MainActivity.lastSharedFile = null; // Clear after delivery
        } else {
            JSObject empty = new JSObject();
            empty.put("none", true);
            call.resolve(empty);
        }
    }

    @PluginMethod
    public void setSecureValue(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null) {
            call.reject("key is required");
            return;
        }
        try {
            SharedPreferences prefs = getSecurePreferences();
            if (value == null) {
                prefs.edit().remove(key).apply();
            } else {
                prefs.edit().putString(key, value).apply();
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to write to secure storage: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getSecureValue(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("key is required");
            return;
        }
        try {
            SharedPreferences prefs = getSecurePreferences();
            String val = prefs.getString(key, null);
            JSObject result = new JSObject();
            result.put("value", val);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read from secure storage: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void removeSecureValue(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("key is required");
            return;
        }
        try {
            SharedPreferences prefs = getSecurePreferences();
            prefs.edit().remove(key).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to delete from secure storage: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void verifySha256(PluginCall call) {
        verifySha256CallCount++;
        int callId = nextCallId();
        String path = call.getString("filePath");
        String expectedHash = call.getString("expectedHash");
        logNativeInstrumentation(getContext(), "verifySha256", callId, "ENTER", "filePath=" + path + ", expectedHash=" + expectedHash + " (total calls: " + verifySha256CallCount + ")");
        if (path == null || expectedHash == null) {
            logNativeInstrumentation(getContext(), "verifySha256", callId, "EXIT", "Rejected: missing filePath or expectedHash");
            call.reject("filePath and expectedHash are required");
            return;
        }
        try {
            File file;
            if (path.startsWith("file://")) {
                try {
                    file = new File(new java.net.URI(path));
                } catch (Exception e) {
                    file = new File(path.substring(7));
                }
            } else {
                file = new File(path);
            }
            if (!file.exists()) {
                logNativeInstrumentation(getContext(), "verifySha256", callId, "EXIT", "Rejected: file does not exist: " + file.getAbsolutePath());
                call.reject("File does not exist: " + file.getAbsolutePath());
                return;
            }
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            java.io.InputStream fis = new java.io.FileInputStream(file);
            byte[] buffer = new byte[8192];
            int count;
            while ((count = fis.read(buffer)) > 0) {
                digest.update(buffer, 0, count);
            }
            fis.close();
            byte[] hash = digest.digest();
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            String computedHash = hexString.toString();
            boolean matches = computedHash.equalsIgnoreCase(expectedHash);
            
            JSObject result = new JSObject();
            result.put("matches", matches);
            result.put("computedHash", computedHash);
            logNativeInstrumentation(getContext(), "verifySha256", callId, "EXIT", "matches=" + matches + ", computedHash=" + computedHash);
            call.resolve(result);
        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("matches", false);
            result.put("computedHash", "ERROR: " + e.getMessage());
            logNativeInstrumentation(getContext(), "verifySha256", callId, "EXIT", "Exception: " + e.getMessage());
            call.resolve(result);
        }
    }

    @PluginMethod
    public void verifyApkSha256(PluginCall call) {
        verifySha256(call);
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        try {
            Context context = getContext();
            JSObject result = new JSObject();
            result.put("manufacturer", Build.MANUFACTURER);
            result.put("model", Build.MODEL);
            result.put("androidVersion", Build.VERSION.RELEASE);
            result.put("sdkInt", Build.VERSION.SDK_INT);
            
            // Architecture
            String abis = "";
            if (Build.SUPPORTED_ABIS != null && Build.SUPPORTED_ABIS.length > 0) {
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < Build.SUPPORTED_ABIS.length; i++) {
                    if (i > 0) sb.append(", ");
                    sb.append(Build.SUPPORTED_ABIS[i]);
                }
                abis = sb.toString();
            } else {
                abis = Build.CPU_ABI;
            }
            result.put("architecture", abis);

            // Device Locale
            result.put("deviceLocale", java.util.Locale.getDefault().toString());

            // Storage availability
            try {
                File path = context.getFilesDir();
                android.os.StatFs stat = new android.os.StatFs(path.getPath());
                long blockSize = stat.getBlockSizeLong();
                long availableBlocks = stat.getAvailableBlocksLong();
                long freeBytes = availableBlocks * blockSize;
                result.put("storageAvailable", (freeBytes / (1024 * 1024)) + " MB free");
            } catch (Exception e) {
                result.put("storageAvailable", "Unknown (Error)");
            }

            // Network state
            try {
                android.net.ConnectivityManager cm = (android.net.ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                android.net.NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
                if (activeNetwork != null && activeNetwork.isConnectedOrConnecting()) {
                    result.put("networkState", activeNetwork.getTypeName() + " (" + activeNetwork.getSubtypeName() + ")");
                } else {
                    result.put("networkState", "Disconnected / Offline");
                }
            } catch (Exception e) {
                result.put("networkState", "Unknown (Error)");
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                result.put("canRequestPackageInstalls", context.getPackageManager().canRequestPackageInstalls());
            } else {
                result.put("canRequestPackageInstalls", true);
            }
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get device info: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getLastInstallResult(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(InstallReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            JSObject result = new JSObject();
            result.put("statusCode", prefs.getInt("last_status_code", -999));
            result.put("statusMessage", prefs.getString("last_status_message", ""));
            result.put("packageName", prefs.getString("last_other_package", ""));
            result.put("timestamp", prefs.getLong("last_status_timestamp", 0));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read last install result: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getInstallerLogHistory(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(InstallReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            String logHistory = prefs.getString("installer_log_history", "[]");
            JSObject result = new JSObject();
            result.put("logs", logHistory);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read installer log history: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearInstallerLogHistory(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(InstallReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString("installer_log_history", "[]")
                .putInt("last_status_code", -999)
                .putString("last_status_message", "")
                .apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear installer log history: " + e.getMessage());
        }
    }

    @PluginMethod
    public void appendLog(PluginCall call) {
        String stage = call.getString("stage");
        Integer status = call.getInt("status");
        String message = call.getString("message");
        String packageName = call.getString("packageName");
        String exceptionStack = call.getString("exceptionStack");
        if (stage == null) {
            call.reject("stage is required");
            return;
        }
        try {
            InstallReceiver.appendLog(getContext(), stage, status != null ? status : 0, message, packageName, exceptionStack);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to append log: " + e.getMessage());
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        installApkCallCount++;
        int callId = nextCallId();
        String path = call.getString("filePath");
        logNativeInstrumentation(getContext(), "installApk", callId, "ENTER", "filePath=" + path + " (total calls: " + installApkCallCount + ")");
        if (path == null) {
            logNativeInstrumentation(getContext(), "installApk", callId, "EXIT", "Rejected: missing filePath");
            call.reject("filePath is required");
            return;
        }

        try {
            File file;
            if (path.startsWith("file://")) {
                try {
                    file = new File(new URI(path));
                } catch (Exception e) {
                    file = new File(path.substring(7));
                }
            } else {
                file = new File(path);
            }

            if (!file.exists()) {
                logNativeInstrumentation(getContext(), "installApk", callId, "EXIT", "Rejected: file does not exist: " + file.getAbsolutePath());
                call.reject("File does not exist: " + file.getAbsolutePath());
                return;
            }

            logNativeInstrumentation(getContext(), "installApk", callId, "EXIT", "Launching triggerInstallation for file: " + file.getAbsolutePath());
            triggerInstallation(file, call);
        } catch (Exception e) {
            logNativeInstrumentation(getContext(), "installApk", callId, "EXIT", "Exception: " + e.getMessage());
            call.reject("Failed to install APK: " + e.getMessage(), e);
        }
    }

    private File downloadFileWithResume(String urlString, String fileName, int callId, String methodTag) throws Exception {
        java.io.InputStream input = null;
        java.io.RandomAccessFile output = null;
        java.net.HttpURLConnection connection = null;
        try {
            File cacheDir = getContext().getExternalCacheDir();
            if (cacheDir == null) {
                cacheDir = getContext().getCacheDir();
            }
            if (fileName == null || fileName.isEmpty()) {
                fileName = "update.apk";
            }
            File apkFile = new File(cacheDir, fileName);
            
            long existingLength = 0;
            if (apkFile.exists()) {
                existingLength = apkFile.length();
                logNativeInstrumentation(getContext(), methodTag, callId, "STEP", "Found existing file of size: " + existingLength + " bytes");
            }
            
            java.net.URL url = new java.net.URL(urlString);
            connection = (java.net.HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(true);
            
            // Set range header if we want to resume
            if (existingLength > 0) {
                connection.setRequestProperty("Range", "bytes=" + existingLength + "-");
            }
            
            int redirectCount = 0;
            int status = connection.getResponseCode();
            while ((status == java.net.HttpURLConnection.HTTP_MOVED_TEMP
                    || status == java.net.HttpURLConnection.HTTP_MOVED_PERM
                    || status == 301 || status == 302 || status == 307 || status == 308)
                    && redirectCount < 8) {
                String newUrl = connection.getHeaderField("Location");
                if (newUrl == null) break;
                
                url = new java.net.URL(newUrl);
                connection = (java.net.HttpURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(true);
                if (existingLength > 0) {
                    connection.setRequestProperty("Range", "bytes=" + existingLength + "-");
                }
                status = connection.getResponseCode();
                redirectCount++;
            }

            boolean isResume = (status == 206); // HTTP_PARTIAL
            if (status != java.net.HttpURLConnection.HTTP_OK && !isResume) {
                // If resume request failed (e.g. 416 Range Not Satisfiable), clear the file and restart from 0
                if (existingLength > 0) {
                    logNativeInstrumentation(getContext(), methodTag, callId, "STEP", "Range request failed (status " + status + "). Restarting from scratch.");
                    apkFile.delete();
                    existingLength = 0;
                    connection = (java.net.HttpURLConnection) url.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    status = connection.getResponseCode();
                    if (status != java.net.HttpURLConnection.HTTP_OK) {
                        throw new Exception("Server returned non-OK status: " + status);
                    }
                } else {
                    throw new Exception("Server returned non-OK status: " + status);
                }
            }

            long totalBytesRead = isResume ? existingLength : 0;
            long fileLength = connection.getContentLength();
            if (fileLength > 0) {
                fileLength += totalBytesRead; // Total size is content length + existing
            }
            
            logNativeInstrumentation(getContext(), methodTag, callId, "STEP", "Connected. Status: " + status + ", Total file size: " + fileLength + " bytes");
            input = new java.io.BufferedInputStream(connection.getInputStream());
            
            output = new java.io.RandomAccessFile(apkFile, "rw");
            if (isResume) {
                output.seek(existingLength);
            } else {
                output.setLength(0); // Truncate existing file if starting new download
            }

            byte[] data = new byte[8192];
            int count;
            int lastProgress = 0;
            
            while ((count = input.read(data)) != -1) {
                totalBytesRead += count;
                output.write(data, 0, count);
                
                if (fileLength > 0) {
                    int progress = (int) (totalBytesRead * 100 / fileLength);
                    if (progress > lastProgress) {
                        lastProgress = progress;
                        JSObject progressObj = new JSObject();
                        progressObj.put("progress", progress);
                        notifyListeners("apkDownloadProgress", progressObj);
                    }
                }
            }

            output.close();
            input.close();
            return apkFile;
        } finally {
            try {
                if (output != null) output.close();
                if (input != null) input.close();
            } catch (Exception ignored) {}
        }
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        downloadAndInstallApkCallCount++;
        int callId = nextCallId();
        String urlString = call.getString("url");
        logNativeInstrumentation(getContext(), "downloadAndInstallApk", callId, "ENTER", "url=" + urlString + " (total calls: " + downloadAndInstallApkCallCount + ")");
        if (urlString == null) {
            logNativeInstrumentation(getContext(), "downloadAndInstallApk", callId, "EXIT", "Rejected: missing url");
            call.reject("url is required");
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                int threadCallId = callId;
                logNativeInstrumentation(getContext(), "downloadAndInstallApk", threadCallId, "STEP", "Download/Install thread started");
                try {
                    String fileName = call.getString("fileName");
                    File apkFile = downloadFileWithResume(urlString, fileName, threadCallId, "downloadAndInstallApk");
                    logNativeInstrumentation(getContext(), "downloadAndInstallApk", threadCallId, "EXIT", "Success. Triggering installation for: " + apkFile.getAbsolutePath());
                    triggerInstallation(apkFile, call);
                } catch (Exception e) {
                    logNativeInstrumentation(getContext(), "downloadAndInstallApk", threadCallId, "EXIT", "Exception: " + e.getMessage());
                    call.reject("Download failed: " + e.getMessage(), e);
                }
            }
        }).start();
    }

    @PluginMethod
    public void downloadApk(PluginCall call) {
        downloadApkCallCount++;
        int callId = nextCallId();
        String urlString = call.getString("url");
        logNativeInstrumentation(getContext(), "downloadApk", callId, "ENTER", "url=" + urlString + " (total calls: " + downloadApkCallCount + ")");
        if (urlString == null) {
            logNativeInstrumentation(getContext(), "downloadApk", callId, "EXIT", "Rejected: missing url");
            call.reject("url is required");
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                int threadCallId = callId;
                logNativeInstrumentation(getContext(), "downloadApk", threadCallId, "STEP", "Download thread started");
                try {
                    String fileName = call.getString("fileName");
                    File apkFile = downloadFileWithResume(urlString, fileName, threadCallId, "downloadApk");
                    logNativeInstrumentation(getContext(), "downloadApk", threadCallId, "EXIT", "Success. filePath=" + apkFile.getAbsolutePath());
                    JSObject ret = new JSObject();
                    ret.put("filePath", apkFile.getAbsolutePath());
                    call.resolve(ret);
                } catch (Exception e) {
                    logNativeInstrumentation(getContext(), "downloadApk", threadCallId, "EXIT", "Exception: " + e.getMessage());
                    call.reject("Download failed: " + e.getMessage(), e);
                }
            }
        }).start();
    }

    @PluginMethod
    public void installApkDirect(PluginCall call) {
        int callId = nextCallId();
        String filePath = call.getString("filePath");
        logNativeInstrumentation(getContext(), "installApkDirect", callId, "ENTER", "filePath=" + filePath);
        if (filePath == null) {
            logNativeInstrumentation(getContext(), "installApkDirect", callId, "EXIT", "Rejected: missing filePath");
            call.reject("filePath is required");
            return;
        }

        try {
            File file = new File(filePath);
            if (!file.exists()) {
                throw new Exception("APK file not found at path: " + filePath);
            }

            Context context = getContext();
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                String authority = context.getPackageName() + ".fileprovider";
                apkUri = androidx.core.content.FileProvider.getUriForFile(context, authority, file);
            } else {
                apkUri = Uri.fromFile(file);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            
            // On Android 8.0+ request unknown sources if we don't have it
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.getPackageManager().canRequestPackageInstalls()) {
                    Intent settingsIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(settingsIntent);
                    logNativeInstrumentation(context, "installApkDirect", callId, "EXIT", "Redirected to unknown sources settings");
                    call.reject("Please enable install permission for this app and try again.");
                    return;
                }
            }

            context.startActivity(intent);
            logNativeInstrumentation(context, "installApkDirect", callId, "EXIT", "Direct install activity launched");
            call.resolve();
        } catch (Exception e) {
            logNativeInstrumentation(getContext(), "installApkDirect", callId, "EXIT", "Exception: " + e.getMessage());
            call.reject("Direct install failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            result.put("value", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            result.put("value", true);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void openUnknownAppSourcesSettings(PluginCall call) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent settingsIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(settingsIntent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open settings: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        openUnknownAppSourcesSettings(call);
    }

    private void triggerInstallation(File file, PluginCall call) {
        Context context = getContext();
        triggerInstallationCallCount++;
        int callId = nextCallId();
        logNativeInstrumentation(context, "triggerInstallation", callId, "ENTER", "file=" + file.getAbsolutePath() + " (total calls: " + triggerInstallationCallCount + ")");
        try {
            // Reset previous results and store session start time in prefs
            SharedPreferences prefs = context.getSharedPreferences(InstallReceiver.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putLong("session_start_time", System.currentTimeMillis())
                .putInt("last_status_code", -999)
                .putString("last_status_message", "installation_in_progress")
                .putString("last_other_package", "")
                .putLong("last_status_timestamp", System.currentTimeMillis())
                .apply();

            // Check for INSTALL_PACKAGES permission on Android 8.0+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.getPackageManager().canRequestPackageInstalls()) {
                    Intent settingsIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(settingsIntent);
                    logNativeInstrumentation(context, "triggerInstallation", callId, "EXIT", "Rejected: missing REQUEST_INSTALL_PACKAGES permission");
                    call.reject("Please enable install permission for this app and try again.");
                    InstallReceiver.appendLog(context, "Install Failure", -2, "Missing unknown sources permission", null, null);
                    return;
                }
            }

            // Use PackageInstaller Session API
            PackageInstaller packageInstaller = context.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(
                    PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // setRequestDowngrade(true) was added in API level 34.
                // Call via reflection to support compiling against older SDK platforms.
                try {
                    java.lang.reflect.Method setRequestDowngradeMethod = 
                        params.getClass().getMethod("setRequestDowngrade", boolean.class);
                    setRequestDowngradeMethod.invoke(params, true);
                    InstallReceiver.appendLog(context, "PackageInstaller Session Setup", 0, "Successfully setRequestDowngrade(true) via reflection", null, null);
                } catch (Exception e) {
                    InstallReceiver.appendLog(context, "PackageInstaller Session Setup", -1, "Failed to setRequestDowngrade(true) via reflection: " + e.getMessage(), null, null);
                }
            }
            
            // Re-use file size if available
            if (file.length() > 0) {
                params.setSize(file.length());
            }

            sessionCreateCallCount++;
            logNativeInstrumentation(context, "triggerInstallation", callId, "STEP", "Calling PackageInstaller.createSession() call #" + sessionCreateCallCount);
            int sessionId = packageInstaller.createSession(params);
            logNativeInstrumentation(context, "triggerInstallation", callId, "STEP", "Session.create() success. sessionId=" + sessionId);
            InstallReceiver.appendLog(context, "PackageInstaller Session Created", 0, "Session ID: " + sessionId, null, null);

            logNativeInstrumentation(context, "triggerInstallation", callId, "STEP", "Opening Session: sessionId=" + sessionId);
            PackageInstaller.Session session = packageInstaller.openSession(sessionId);
            
            sessionWriteCallCount++;
            logNativeInstrumentation(context, "triggerInstallation", callId, "STEP", "Session.write() call #" + sessionWriteCallCount + " start. Opening output stream.");
            java.io.OutputStream out = session.openWrite("studio_install", 0, -1);
            java.io.FileInputStream fis = new java.io.FileInputStream(file);
            byte[] buffer = new byte[65536];
            int count;
            long bytesWritten = 0;
            while ((count = fis.read(buffer)) != -1) {
                out.write(buffer, 0, count);
                bytesWritten += count;
            }
            fis.close();
            out.flush();
            logNativeInstrumentation(context, "triggerInstallation", callId, "STEP", "Session.write() finished. Total bytes written: " + bytesWritten);
            InstallReceiver.appendLog(context, "Package Written", 0, "Bytes written: " + file.length(), null, null);

            sessionFsyncCallCount++;
            logNativeInstrumentation(context, "triggerInstallation", callId, "STEP", "Session.fsync() call #" + sessionFsyncCallCount + " start");
            session.fsync(out);
            out.close();
            logNativeInstrumentation(context, "triggerInstallation", callId, "STEP", "Session.fsync() finished");
            InstallReceiver.appendLog(context, "Package Synced", 0, "fsync completed", null, null);
            
            Intent intent = new Intent(context, InstallReceiver.class);
            intent.setAction("com.chordex.app.SESSION_API_PACKAGE_INSTALLED");
            
            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                pendingFlags |= PendingIntent.FLAG_MUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context, 
                    sessionId, 
                    intent, 
                    pendingFlags
            );
            
            sessionCommitCallCount++;
            logNativeInstrumentation(context, "triggerInstallation", callId, "STEP", "Session.commit() call #" + sessionCommitCallCount + " start. Calling session.commit()");
            InstallReceiver.appendLog(context, "Session Commit Started", 0, "Calling session.commit()", null, null);
            session.commit(pendingIntent.getIntentSender());
            session.close();
            logNativeInstrumentation(context, "triggerInstallation", callId, "STEP", "Session.commit() finished and session closed");
            InstallReceiver.appendLog(context, "Session Commit Finished", 0, "Session committed and closed", null, null);
            
            Log.d("AppInstallerPlugin", "Installation session committed: sessionId=" + sessionId);
            JSObject result = new JSObject();
            result.put("sessionId", sessionId);
            logNativeInstrumentation(context, "triggerInstallation", callId, "EXIT", "Success: sessionId=" + sessionId);
            call.resolve(result);
        } catch (Exception e) {
            Log.e("AppInstallerPlugin", "Failed to trigger installation via PackageInstaller", e);
            logNativeInstrumentation(context, "triggerInstallation", callId, "EXIT", "Exception: " + e.getMessage() + "\nStack: " + Log.getStackTraceString(e));
            InstallReceiver.appendLog(context, "Install Failure", -3, "Exception: " + e.getMessage(), null, Log.getStackTraceString(e));
            call.reject("Failed to trigger installation: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getApkDetails(PluginCall call) {
        String path = call.getString("filePath");
        if (path == null) {
            call.reject("filePath is required");
            return;
        }
        try {
            File file;
            if (path.startsWith("file://")) {
                try {
                    file = new File(new URI(path));
                } catch (Exception e) {
                    file = new File(path.substring(7));
                }
            } else {
                file = new File(path);
            }

            if (!file.exists()) {
                call.reject("File does not exist: " + file.getAbsolutePath());
                return;
            }

            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            
            int flags = PackageManager.GET_SIGNATURES;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                flags = PackageManager.GET_SIGNING_CERTIFICATES;
            }
            
            PackageInfo info = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
            if (info == null) {
                call.reject("Failed to parse APK: " + file.getAbsolutePath());
                return;
            }

            JSObject result = new JSObject();
            result.put("packageName", info.packageName);
            result.put("versionName", info.versionName);
            
            long versionCode = info.versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = info.getLongVersionCode();
            }
            result.put("versionCode", versionCode);

            String sha256 = "";
            Signature[] signatures = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (info.signingInfo != null) {
                    if (info.signingInfo.hasMultipleSigners()) {
                        signatures = info.signingInfo.getApkContentsSigners();
                    } else {
                        signatures = info.signingInfo.getSigningCertificateHistory();
                    }
                }
            } else {
                signatures = info.signatures;
            }

            if (signatures != null && signatures.length > 0) {
                byte[] cert = signatures[0].toByteArray();
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
                byte[] publicKey = md.digest(cert);
                StringBuilder hexString = new StringBuilder();
                for (byte b : publicKey) {
                    String append = Integer.toHexString(0xFF & b);
                    if (append.length() == 1) hexString.append('0');
                    hexString.append(append);
                }
                sha256 = hexString.toString().toLowerCase();
            }
            result.put("signatures", sha256);

            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read APK details: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void inspectApk(PluginCall call) {
        String path = call.getString("filePath");
        if (path == null) {
            call.reject("filePath is required");
            return;
        }
        try {
            File file;
            if (path.startsWith("file://")) {
                try {
                    file = new File(new URI(path));
                } catch (Exception e) {
                    file = new File(path.substring(7));
                }
            } else {
                file = new File(path);
            }

            JSObject result = new JSObject();
            if (!file.exists()) {
                result.put("isValidApk", false);
                result.put("isUniversalApk", false);
                result.put("packageName", "");
                result.put("versionName", "");
                result.put("versionCode", 0);
                result.put("signingSha256", "");
                result.put("debuggable", false);
                result.put("minSdk", 0);
                result.put("targetSdk", 0);
                call.resolve(result);
                return;
            }

            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            
            int flags = PackageManager.GET_SIGNATURES;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                flags = PackageManager.GET_SIGNING_CERTIFICATES;
            }
            
            PackageInfo info = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
            if (info == null) {
                result.put("isValidApk", false);
                result.put("packageName", "");
                result.put("versionName", "");
                result.put("versionCode", 0);
                result.put("signingSha256", "");
                result.put("debuggable", false);
                result.put("minSdk", 0);
                result.put("targetSdk", 0);
                call.resolve(result);
                return;
            }

            result.put("isValidApk", true);
            boolean isUniversal = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                if (info.splitNames != null && info.splitNames.length > 0) {
                    isUniversal = false;
                }
            }
            result.put("isUniversalApk", isUniversal);
            result.put("packageName", info.packageName);
            result.put("versionName", info.versionName);
            
            long versionCode = info.versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = info.getLongVersionCode();
            }
            result.put("versionCode", versionCode);

            // Min and target SDK
            int minSdk = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                if (info.applicationInfo != null) {
                    minSdk = info.applicationInfo.minSdkVersion;
                }
            }
            int targetSdk = 0;
            if (info.applicationInfo != null) {
                targetSdk = info.applicationInfo.targetSdkVersion;
            }
            result.put("minSdk", minSdk);
            result.put("targetSdk", targetSdk);

            // Debuggable flag
            boolean debuggable = false;
            if (info.applicationInfo != null) {
                debuggable = (info.applicationInfo.flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            }
            result.put("debuggable", debuggable);

            String sha256 = "";
            Signature[] signatures = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (info.signingInfo != null) {
                    if (info.signingInfo.hasMultipleSigners()) {
                        signatures = info.signingInfo.getApkContentsSigners();
                    } else {
                        signatures = info.signingInfo.getSigningCertificateHistory();
                    }
                }
            } else {
                signatures = info.signatures;
            }

            if (signatures != null && signatures.length > 0) {
                byte[] cert = signatures[0].toByteArray();
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
                byte[] publicKey = md.digest(cert);
                StringBuilder hexString = new StringBuilder();
                for (byte b : publicKey) {
                    String append = Integer.toHexString(0xFF & b);
                    if (append.length() == 1) hexString.append('0');
                    hexString.append(append);
                }
                sha256 = hexString.toString().toLowerCase();
            }
            result.put("signingSha256", sha256);

            call.resolve(result);
        } catch (Exception e) {
            JSObject errorResult = new JSObject();
            errorResult.put("isValidApk", false);
            errorResult.put("isUniversalApk", false);
            errorResult.put("error", e.getMessage());
            call.resolve(errorResult);
        }
    }

    @PluginMethod
    public void getInstalledAppDetails(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();
            
            int flags = PackageManager.GET_SIGNATURES;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                flags = PackageManager.GET_SIGNING_CERTIFICATES;
            }
            
            PackageInfo info = pm.getPackageInfo(packageName, flags);
            JSObject result = new JSObject();
            result.put("packageName", info.packageName);
            result.put("versionName", info.versionName);
            
            long versionCode = info.versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = info.getLongVersionCode();
            }
            result.put("versionCode", versionCode);

            String sha256 = "";
            Signature[] signatures = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (info.signingInfo != null) {
                    if (info.signingInfo.hasMultipleSigners()) {
                        signatures = info.signingInfo.getApkContentsSigners();
                    } else {
                        signatures = info.signingInfo.getSigningCertificateHistory();
                    }
                }
            } else {
                signatures = info.signatures;
            }

            if (signatures != null && signatures.length > 0) {
                byte[] cert = signatures[0].toByteArray();
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
                byte[] publicKey = md.digest(cert);
                StringBuilder hexString = new StringBuilder();
                for (byte b : publicKey) {
                    String append = Integer.toHexString(0xFF & b);
                    if (append.length() == 1) hexString.append('0');
                    hexString.append(append);
                }
                sha256 = hexString.toString().toLowerCase();
            }
            result.put("signatures", sha256);

            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read installed app details: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void getInstalledAppInfo(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            String packageName = context.getPackageName();
            
            int flags = PackageManager.GET_SIGNATURES;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                flags = PackageManager.GET_SIGNING_CERTIFICATES;
            }
            
            PackageInfo info = pm.getPackageInfo(packageName, flags);
            JSObject result = new JSObject();
            result.put("packageName", info.packageName);
            result.put("versionName", info.versionName);
            
            long versionCode = info.versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = info.getLongVersionCode();
            }
            result.put("versionCode", versionCode);

            boolean debuggable = false;
            if (info.applicationInfo != null) {
                debuggable = (info.applicationInfo.flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            }
            result.put("debuggable", debuggable);

            String sha256 = "";
            Signature[] signatures = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (info.signingInfo != null) {
                    if (info.signingInfo.hasMultipleSigners()) {
                        signatures = info.signingInfo.getApkContentsSigners();
                    } else {
                        signatures = info.signingInfo.getSigningCertificateHistory();
                    }
                }
            } else {
                signatures = info.signatures;
            }

            if (signatures != null && signatures.length > 0) {
                byte[] cert = signatures[0].toByteArray();
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
                byte[] publicKey = md.digest(cert);
                StringBuilder hexString = new StringBuilder();
                for (byte b : publicKey) {
                    String append = Integer.toHexString(0xFF & b);
                    if (append.length() == 1) hexString.append('0');
                    hexString.append(append);
                }
                sha256 = hexString.toString().toLowerCase();
            }
            result.put("signingSha256", sha256);

            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read installed app info: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void readFirstBytes(PluginCall call) {
        String path = call.getString("filePath");
        Integer bytesCount = call.getInt("count", 4);
        if (path == null) {
            call.reject("filePath is required");
            return;
        }
        try {
            File file;
            if (path.startsWith("file://")) {
                try {
                    file = new File(new java.net.URI(path));
                } catch (Exception e) {
                    file = new File(path.substring(7));
                }
            } else {
                file = new File(path);
            }
            if (!file.exists()) {
                call.reject("File does not exist");
                return;
            }
            java.io.FileInputStream fis = new java.io.FileInputStream(file);
            byte[] buffer = new byte[bytesCount];
            int read = fis.read(buffer);
            fis.close();
            
            StringBuilder hexString = new StringBuilder();
            for (int i = 0; i < read; i++) {
                String hex = Integer.toHexString(0xff & buffer[i]);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            JSObject result = new JSObject();
            result.put("hex", hexString.toString());
            result.put("ascii", new String(buffer, 0, read, "UTF-8"));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to read first bytes: " + e.getMessage());
        }
    }
}

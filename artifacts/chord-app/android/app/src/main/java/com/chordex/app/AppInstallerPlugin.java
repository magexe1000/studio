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
        String path = call.getString("filePath");
        String expectedHash = call.getString("expectedHash");
        if (path == null || expectedHash == null) {
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
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Verification failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void verifyApkSha256(PluginCall call) {
        verifySha256(call);
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("manufacturer", Build.MANUFACTURER);
            result.put("model", Build.MODEL);
            result.put("androidVersion", Build.VERSION.RELEASE);
            result.put("sdkInt", Build.VERSION.SDK_INT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                result.put("canRequestPackageInstalls", getContext().getPackageManager().canRequestPackageInstalls());
            } else {
                result.put("canRequestPackageInstalls", true);
            }
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get device info: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
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

            triggerInstallation(file, call);
        } catch (Exception e) {
            call.reject("Failed to install APK: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null) {
            call.reject("url is required");
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                java.io.InputStream input = null;
                java.io.OutputStream output = null;
                java.net.HttpURLConnection connection = null;
                try {
                    java.net.URL url = new java.net.URL(urlString);
                    connection = (java.net.HttpURLConnection) url.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    
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
                        status = connection.getResponseCode();
                        redirectCount++;
                    }

                    if (status != java.net.HttpURLConnection.HTTP_OK) {
                        throw new Exception("Server returned non-OK status: " + status);
                    }

                    int fileLength = connection.getContentLength();
                    input = new java.io.BufferedInputStream(connection.getInputStream());
                    
                    File cacheDir = getContext().getExternalCacheDir();
                    if (cacheDir == null) {
                        cacheDir = getContext().getCacheDir();
                    }
                    // Clean stale cached files
                    File[] files = cacheDir.listFiles();
                    if (files != null) {
                        for (File f : files) {
                            String name = f.getName();
                            if (name.equals("update.apk") || (name.startsWith("studio-update-") && name.endsWith(".apk"))) {
                                try {
                                    f.delete();
                                } catch (Exception ignored) {}
                            }
                        }
                    }
                    String fileName = call.getString("fileName");
                    if (fileName == null || fileName.isEmpty()) {
                        fileName = "update.apk";
                    }
                    File apkFile = new File(cacheDir, fileName);
                    
                    output = new java.io.FileOutputStream(apkFile);

                    byte[] data = new byte[4096];
                    long total = 0;
                    int count;
                    int lastProgress = 0;
                    
                    while ((count = input.read(data)) != -1) {
                        total += count;
                        output.write(data, 0, count);
                        
                        if (fileLength > 0) {
                            int progress = (int) (total * 100 / fileLength);
                            if (progress > lastProgress) {
                                lastProgress = progress;
                                JSObject progressObj = new JSObject();
                                progressObj.put("progress", progress);
                                notifyListeners("apkDownloadProgress", progressObj);
                            }
                        }
                    }

                    output.flush();
                    output.close();
                    input.close();

                    triggerInstallation(apkFile, call);

                } catch (Exception e) {
                    try {
                        if (output != null) output.close();
                        if (input != null) input.close();
                    } catch (Exception ignored) {}
                    call.reject("Download failed: " + e.getMessage(), e);
                }
            }
        }).start();
    }

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null) {
            call.reject("url is required");
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                java.io.InputStream input = null;
                java.io.OutputStream output = null;
                java.net.HttpURLConnection connection = null;
                try {
                    java.net.URL url = new java.net.URL(urlString);
                    connection = (java.net.HttpURLConnection) url.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    
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
                        status = connection.getResponseCode();
                        redirectCount++;
                    }

                    if (status != java.net.HttpURLConnection.HTTP_OK) {
                        throw new Exception("Server returned non-OK status: " + status);
                    }

                    int fileLength = connection.getContentLength();
                    input = new java.io.BufferedInputStream(connection.getInputStream());
                    
                    File cacheDir = getContext().getExternalCacheDir();
                    if (cacheDir == null) {
                        cacheDir = getContext().getCacheDir();
                    }
                    // Clean stale cached files
                    File[] files = cacheDir.listFiles();
                    if (files != null) {
                        for (File f : files) {
                            String name = f.getName();
                            if (name.equals("update.apk") || (name.startsWith("studio-update-") && name.endsWith(".apk"))) {
                                try {
                                    f.delete();
                                } catch (Exception ignored) {}
                            }
                        }
                    }
                    String fileName = call.getString("fileName");
                    if (fileName == null || fileName.isEmpty()) {
                        fileName = "update.apk";
                    }
                    File apkFile = new File(cacheDir, fileName);
                    
                    output = new java.io.FileOutputStream(apkFile);

                    byte[] data = new byte[4096];
                    long total = 0;
                    int count;
                    int lastProgress = 0;
                    
                    while ((count = input.read(data)) != -1) {
                        total += count;
                        output.write(data, 0, count);
                        
                        if (fileLength > 0) {
                            int progress = (int) (total * 100 / fileLength);
                            if (progress > lastProgress) {
                                lastProgress = progress;
                                JSObject progressObj = new JSObject();
                                progressObj.put("progress", progress);
                                notifyListeners("apkDownloadProgress", progressObj);
                            }
                        }
                    }

                    output.flush();
                    output.close();
                    input.close();

                    JSObject result = new JSObject();
                    result.put("filePath", apkFile.getAbsolutePath());
                    call.resolve(result);

                } catch (Exception e) {
                    try {
                        if (output != null) output.close();
                        if (input != null) input.close();
                    } catch (Exception ignored) {}
                    call.reject("Download failed: " + e.getMessage(), e);
                }
            }
        }).start();
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
        try {
            Context context = getContext();
            
            // Check for INSTALL_PACKAGES permission on Android 8.0+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.getPackageManager().canRequestPackageInstalls()) {
                    Intent settingsIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(settingsIntent);
                    call.reject("Please enable install permission for this app and try again.");
                    return;
                }
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                String authority = context.getPackageName() + ".fileprovider";
                apkUri = FileProvider.getUriForFile(context, authority, file);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                apkUri = Uri.fromFile(file);
            }

            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
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
    // Trigger Android release build for signing certificate reset - attempt 2
}

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
                    File apkFile = new File(cacheDir, "update.apk");
                    if (apkFile.exists()) {
                        apkFile.delete();
                    }
                    
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
                    File apkFile = new File(cacheDir, "update.apk");
                    if (apkFile.exists()) {
                        apkFile.delete();
                    }
                    
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
}

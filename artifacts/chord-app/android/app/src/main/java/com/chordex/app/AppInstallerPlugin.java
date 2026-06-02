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
            Context context = getContext();
            File file;
            if (path.startsWith("file://")) {
                file = new File(new URI(path));
            } else {
                file = new File(path);
            }

            if (!file.exists()) {
                call.reject("File does not exist: " + file.getAbsolutePath());
                return;
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
            call.reject("Failed to install APK: " + e.getMessage(), e);
        }
    }
}

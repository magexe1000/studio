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
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.net.URI;

@CapacitorPlugin(name = "AppInstaller")
public class AppInstallerPlugin extends Plugin {

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

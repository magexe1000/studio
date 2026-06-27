package com.chordex.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.util.Log;

public class InstallReceiver extends BroadcastReceiver {
    private static final String TAG = "InstallReceiver";
    public static final String PREFS_NAME = "studio_installer_prefs";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        
        String action = intent.getAction();
        Log.d(TAG, "onReceive: action=" + action);
        
        if ("com.chordex.app.SESSION_API_PACKAGE_INSTALLED".equals(action)) {
            int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
            String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            String otherPackageName = intent.getStringExtra(PackageInstaller.EXTRA_OTHER_PACKAGE_NAME);
            
            Log.d(TAG, "Install status: " + status + ", message: " + message + ", package: " + otherPackageName);
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putInt("last_status_code", status);
            editor.putString("last_status_message", message != null ? message : "");
            editor.putString("last_other_package", otherPackageName != null ? otherPackageName : "");
            editor.putLong("last_status_timestamp", System.currentTimeMillis());
            
            // Push this event to local logging history (last 20 sessions)
            String logHistory = prefs.getString("installer_log_history", "[]");
            try {
                org.json.JSONArray array = new org.json.JSONArray(logHistory);
                org.json.JSONObject newLog = new org.json.JSONObject();
                newLog.put("timestamp", System.currentTimeMillis());
                newLog.put("status", status);
                newLog.put("message", message != null ? message : "");
                newLog.put("packageName", otherPackageName != null ? otherPackageName : "");
                
                // Add to start of array
                org.json.JSONArray newArray = new org.json.JSONArray();
                newArray.put(newLog);
                for (int i = 0; i < array.length() && i < 19; i++) {
                    newArray.put(array.get(i));
                }
                editor.putString("installer_log_history", newArray.toString());
            } catch (Exception e) {
                Log.e(TAG, "Failed to update installer log history", e);
            }
            
            editor.apply();
        }
    }
}

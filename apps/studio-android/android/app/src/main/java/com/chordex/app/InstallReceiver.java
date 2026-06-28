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
    
    public static void appendLog(Context context, String stage, int status, String message, String packageName, String exceptionStack) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String logHistory = prefs.getString("installer_log_history", "[]");
            org.json.JSONArray array = new org.json.JSONArray(logHistory);
            
            org.json.JSONObject newLog = new org.json.JSONObject();
            long now = System.currentTimeMillis();
            newLog.put("timestamp", now);
            newLog.put("stage", stage);
            newLog.put("status", status);
            newLog.put("message", message != null ? message : "");
            newLog.put("packageName", packageName != null ? packageName : "");
            newLog.put("exceptionStack", exceptionStack != null ? exceptionStack : "");
            
            long sessionStart = prefs.getLong("session_start_time", 0);
            long elapsed = sessionStart > 0 ? (now - sessionStart) : 0;
            newLog.put("elapsedTimeMs", elapsed);
            
            String explanation = getHumanReadableExplanation(stage, status, message);
            newLog.put("explanation", explanation);
            
            org.json.JSONArray newArray = new org.json.JSONArray();
            newArray.put(newLog);
            for (int i = 0; i < array.length() && i < 49; i++) {
                newArray.put(array.get(i));
            }
            prefs.edit().putString("installer_log_history", newArray.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to append log", e);
        }
    }
    
    private static String getHumanReadableExplanation(String stage, int status, String message) {
        if ("Install Success".equals(stage)) {
            return "The update completed successfully. The application will restart.";
        }
        if ("User Cancelled".equals(stage) || status == PackageInstaller.STATUS_FAILURE_ABORTED) {
            return "The installation was cancelled by the user.";
        }
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            return "System update confirmation dialog is displayed. Waiting for user action.";
        }
        if (status == 5) { // STATUS_FAILURE_CONFLICT
            return "Signature mismatch or conflicting package name. A clean reinstall is required.";
        }
        if (status == 7) { // STATUS_FAILURE_INCOMPATIBLE
            return "Version downgrade is not allowed by the system.";
        }
        if (status == 6) { // STATUS_FAILURE_STORAGE
            return "Installation failed due to insufficient storage space.";
        }
        if (status == 2) { // STATUS_FAILURE_BLOCKED
            return "Installation blocked by administrator policy or system settings.";
        }
        if (message != null && !message.isEmpty()) {
            return message;
        }
        return "Stage: " + stage + " status: " + status;
    }
    
    private static int receiverCallIdCounter = 0;
    public static int onReceiveCallCount = 0;
    
    private static int nextCallId() {
        synchronized (InstallReceiver.class) {
            return ++receiverCallIdCounter;
        }
    }
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        onReceiveCallCount++;
        int callId = nextCallId();
        
        String action = intent.getAction();
        Log.d(TAG, "[INSTRUMENTATION] [NATIVE] InstallReceiver.onReceive: action=" + action);
        
        String threadInfo = String.format("Thread: %s (id: %d)", Thread.currentThread().getName(), Thread.currentThread().getId());
        appendLog(context, "[INSTRUMENTATION] InstallReceiver.onReceive", 0, "Call #" + callId + " [" + threadInfo + "] ENTER Action: " + action + " (total calls: " + onReceiveCallCount + ")", null, null);
        
        if ("com.chordex.app.SESSION_API_PACKAGE_INSTALLED".equals(action)) {
            int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
            String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            String otherPackageName = intent.getStringExtra(PackageInstaller.EXTRA_OTHER_PACKAGE_NAME);
            
            Log.d(TAG, "[INSTRUMENTATION] [NATIVE] InstallReceiver status: " + status + ", message: " + message + ", package: " + otherPackageName);
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putInt("last_status_code", status);
            editor.putString("last_status_message", message != null ? message : "");
            editor.putString("last_other_package", otherPackageName != null ? otherPackageName : "");
            editor.putLong("last_status_timestamp", System.currentTimeMillis());
            if (status >= 0) {
                editor.putBoolean("installation_active", false);
            }
            editor.apply();
            
            if (AppInstallerPlugin.instance != null) {
                com.getcapacitor.JSObject eventData = new com.getcapacitor.JSObject();
                eventData.put("status", status);
                eventData.put("message", message != null ? message : "");
                eventData.put("packageName", otherPackageName != null ? otherPackageName : "");
                Log.d(TAG, "[INSTRUMENTATION] [NATIVE] Emitting status " + status + " to JS");
                AppInstallerPlugin.instance.emitInstallStatus(eventData);
            } else {
                Log.w(TAG, "[INSTRUMENTATION] [NATIVE] AppInstallerPlugin.instance is null. Cannot emit status to JS.");
            }
            
            appendLog(context, "Broadcast Received", status, message, otherPackageName, null);
            
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                appendLog(context, "Installer dialog displayed", status, "System confirmation screen requested (handled by InstallActivity)", otherPackageName, null);
            } else if (status == PackageInstaller.STATUS_SUCCESS) {
                appendLog(context, "User Accepted", status, "User accepted installation", otherPackageName, null);
                appendLog(context, "Install Success", status, "Update installation complete", otherPackageName, null);
            } else if (status == PackageInstaller.STATUS_FAILURE_ABORTED) {
                appendLog(context, "User Cancelled", status, "User cancelled installation", otherPackageName, null);
            } else {
                appendLog(context, "Install Failure", status, "PackageInstaller reported failure: " + message, otherPackageName, null);
            }
        }
        appendLog(context, "[INSTRUMENTATION] InstallReceiver.onReceive", 0, "Call #" + callId + " EXIT", null, null);
    }
}

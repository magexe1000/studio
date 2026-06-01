package com.chordex.app;

import android.os.Build;
import android.window.BackEvent;
import android.window.OnBackAnimationCallback;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PredictiveBack")
public class PredictiveBackPlugin extends Plugin {

    private OnBackInvokedCallback backCallback = null;
    private boolean isRegistered = false;

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        
        if (Build.VERSION.SDK_INT >= 34) { // Android 14+
            getBridge().getActivity().runOnUiThread(() -> {
                try {
                    OnBackInvokedDispatcher dispatcher = getBridge().getActivity().getOnBackInvokedDispatcher();
                    if (enabled) {
                        if (!isRegistered) {
                            if (backCallback == null) {
                                backCallback = new OnBackAnimationCallback() {
                                    @Override
                                    public void onBackStarted(BackEvent backEvent) {
                                        JSObject data = new JSObject();
                                        data.put("progress", backEvent.getProgress());
                                        data.put("touchX", backEvent.getTouchX());
                                        data.put("touchY", backEvent.getTouchY());
                                        data.put("edge", backEvent.getSwipeEdge() == BackEvent.EDGE_LEFT ? "left" : "right");
                                        notifyListeners("backStarted", data);
                                    }

                                    @Override
                                    public void onBackProgressed(BackEvent backEvent) {
                                        JSObject data = new JSObject();
                                        data.put("progress", backEvent.getProgress());
                                        data.put("touchX", backEvent.getTouchX());
                                        data.put("touchY", backEvent.getTouchY());
                                        data.put("edge", backEvent.getSwipeEdge() == BackEvent.EDGE_LEFT ? "left" : "right");
                                        notifyListeners("backProgressed", data);
                                    }

                                    @Override
                                    public void onBackInvoked() {
                                        // Gesture committed!
                                        // Trigger standard activity back press programmatically by casting to ComponentActivity.
                                        if (getBridge().getActivity() instanceof androidx.activity.ComponentActivity) {
                                            ((androidx.activity.ComponentActivity) getBridge().getActivity())
                                                .getOnBackPressedDispatcher().onBackPressed();
                                        } else {
                                            getBridge().getActivity().onBackPressed();
                                        }
                                    }

                                    @Override
                                    public void onBackCancelled() {
                                        notifyListeners("backCancelled", new JSObject());
                                    }
                                };
                            }
                            dispatcher.registerOnBackInvokedCallback(
                                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                                backCallback
                            );
                            isRegistered = true;
                        }
                    } else {
                        if (isRegistered && backCallback != null) {
                            dispatcher.unregisterOnBackInvokedCallback(backCallback);
                            isRegistered = false;
                        }
                    }
                    call.resolve();
                } catch (Exception e) {
                    call.reject("Failed to set predictive back enabled: " + e.getMessage());
                }
            });
        } else {
            // No-op on older Android versions
            call.resolve();
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (Build.VERSION.SDK_INT >= 34 && isRegistered && backCallback != null) {
            try {
                OnBackInvokedDispatcher dispatcher = getBridge().getActivity().getOnBackInvokedDispatcher();
                dispatcher.unregisterOnBackInvokedCallback(backCallback);
            } catch (Exception ignored) {}
        }
        super.handleOnDestroy();
    }
}

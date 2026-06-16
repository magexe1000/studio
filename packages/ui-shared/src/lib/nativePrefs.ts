/**
 * Thin async wrapper around `@capacitor/preferences`.
 *
 * On native (Android APK) this writes to the `CapacitorStorage`
 * SharedPreferences file — the same file our background WorkManager
 * worker (`OtaCheckWorker.java`) reads when deciding whether to fire
 * the "Studio update available" notification with the app closed.
 *
 * On web it falls back to localStorage so existing flows keep
 * working in the dev preview / PWA. All operations are best-effort —
 * a failure must never break the JS caller.
 */

import { Capacitor } from '@capacitor/core';

function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

/** Read a single string value. Returns `null` if not present or on error. */
export async function nativeGet(key: string): Promise<string | null> {
  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value ?? null;
    } catch {
      return null;
    }
  }
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Write a single string value. Best-effort; errors are swallowed. */
export async function nativeSet(key: string, value: string): Promise<void> {
  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
      return;
    } catch {
      /* fall through to localStorage so something still persists */
    }
  }
  try { localStorage.setItem(key, value); } catch { /* quota / privacy */ }
}

/** Keys used by both JS and the Android background worker. Keep in
 *  sync with `OtaCheckWorker.java`. */
export const NATIVE_PREFS = {
  /** Latest remote version that the user has either been notified about
   *  in-app, fired an OS notification for, or actively installed. The
   *  background worker uses this to decide whether to post a system
   *  notification — it only posts when remote > this value. */
  OTA_REMOTE_SEEN: 'studio_ota.remote_seen',
  /** The bundle version currently running on the user's device. JS
   *  writes this on every boot so the native worker has a baseline
   *  even if the user hasn't opened the app since the last OTA. */
  OTA_INSTALLED: 'studio_ota.installed_version',
  /** Whether OTA notifications are enabled by the user. */
  OTA_NOTIFICATIONS_ENABLED: 'studio_ota.notifications_enabled',
} as const;

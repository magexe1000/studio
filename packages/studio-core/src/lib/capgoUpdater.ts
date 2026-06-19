/**
 * Capgo over-the-air updater bridge.
 * ──────────────────────────────────
 * Thin wrapper around `@capgo/capacitor-updater` that:
 *
 *   1. Lazy-imports the plugin so the web bundle never loads native code.
 *   2. Exposes a small surface tailored to our use case — we self-host
 *      bundles via the deployment's static directory and trigger
 *      downloads from the in-app update banner.
 *
 * Flow on a real device:
 *   - On app start, `notifyAppReady()` marks the *running* bundle as
 *     healthy. If we never call it within the plugin's grace window,
 *     the plugin assumes the bundle is broken and rolls back to the
 *     previous one (this is what makes OTA safe — a botched JS bundle
 *     can't brick the install).
 *   - When the user taps "Reload" on the UpdateIndicator, we call
 *     `applyUpdate({ url, version })` which downloads the zip in the
 *     foreground, atomically swaps the WebView root, and reloads the
 *     app onto the new bundle.
 *
 * On web (PWA / dev preview / preview iframe) all of these are no-ops —
 * the existing `window.location.reload()` flow handles the swap via
 * the service worker's cache.
 */

import { Capacitor } from '@capacitor/core';
import { nativeSet, NATIVE_PREFS } from './nativePrefs';
import { APP_VERSION, compareSemver } from './appVersion';

export type RuntimePlatform = 'web' | 'android-native';

export function getRuntimePlatform(): RuntimePlatform {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      return 'android-native';
    }
  } catch {}
  return 'web';
}

export function isWebRuntime(): boolean {
  return getRuntimePlatform() === 'web';
}

export function isAndroidNativeRuntime(): boolean {
  return getRuntimePlatform() === 'android-native';
}

export function shouldUseWebUpdater(): boolean {
  return isWebRuntime();
}

export function shouldUseAndroidApkUpdater(): boolean {
  return isAndroidNativeRuntime();
}

/** True only inside a Capacitor-wrapped native shell (Android APK). */
export function isNative(): boolean {
  return isAndroidNativeRuntime();
}

/**
 * Mark the currently-running bundle as healthy. MUST be called once
 * per app launch — otherwise the Capgo plugin's watchdog will roll the
 * bundle back on the next start, thinking it crashed.
 *
 * Safe to call from web — it's a no-op when not running natively.
 * Errors are swallowed: if the plugin isn't installed correctly the
 * worst case is the user stays on the same bundle.
 */
export async function notifyBundleReady(): Promise<void> {
  // OTA updates have been completely removed. This is a safe no-op.
  return Promise.resolve();
}

export interface ApplyUpdateOptions {
  /** Absolute URL to a Capgo-compatible bundle ZIP. */
  url: string;
  /** Semver of the bundle being downloaded — used as the bundle's id. */
  version: string;
  /** Optional progress callback (0..1). */
  onProgress?: (pct: number) => void;
}

export interface ApplyUpdateResult {
  ok: boolean;
  /** Populated on failure with a short, user-facing reason. */
  error?: string;
}

/**
 * Download and activate a new bundle. On native, this:
 *   1. Downloads the zip from `url` in the foreground (with progress).
 *   2. Calls `set()` to make it the active bundle.
 *   3. Reloads the WebView so the new code starts running.
 *
 * On web, returns `{ ok: false, error: 'not native' }` — callers should
 * fall back to `window.location.reload()`. We deliberately do NOT
 * silently succeed here, because the caller needs to know whether the
 * Capgo path actually ran.
 *
 * Errors on native are surfaced as `{ ok: false, error }` so the UI
 * can decide whether to fall back to a plain reload (works for users
 * who happen to have a fast service-worker update cached) or show a
 * "couldn't update" toast.
 */
/* ──────────────────────────────────────────────────────────────────── *
 * Local notifications for OTA availability.                            *
 * ──────────────────────────────────────────────────────────────────── */

/**
 * localStorage key recording the most recent remote version we've
 * already fired a notification for. Prevents the user from getting
 * spammed every time the OTA check runs (i.e. on every app launch).
 *
 * The value is overwritten only when a brand-new remote version is
 * detected, so a future bump (e.g. 3.0.3 → 3.0.4) will surface a fresh
 * notification.
 */
const NOTIFIED_VERSION_KEY = 'studio:notifiedUpdateVersion';

function readNotifiedVersion(): string | null {
  try {
    return localStorage.getItem(NOTIFIED_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeNotifiedVersion(v: string): void {
  try {
    localStorage.setItem(NOTIFIED_VERSION_KEY, v);
  } catch {
    /* quota / privacy mode — silently ignore */
  }
  // Mirror to native SharedPreferences so the Android WorkManager
  // background worker (`OtaCheckWorker.java`) doesn't fire a duplicate
  // OS notification for a version the user has already seen in-app.
  void nativeSet(NATIVE_PREFS.OTA_REMOTE_SEEN, v);
}

/**
 * In-flight guard. localStorage dedup catches the case where the user
 * has already been notified about this version on a previous launch,
 * but two near-simultaneous OTA checks (e.g. visibility change racing
 * the initial mount) can BOTH pass the localStorage check before
 * either has had a chance to write. The set tracks versions whose
 * notification flow is currently mid-await so the second caller
 * short-circuits cleanly.
 */
const inFlightNotifications = new Set<string>();

/**
 * Fire an OS-level notification announcing a new bundle is available.
 * The notification body includes the version number so the user knows
 * exactly what they're being offered before opening the app.
 *
 *   - On NATIVE (Android APK): uses @capacitor/local-notifications,
 *     requesting POST_NOTIFICATIONS at first call (Android 13+ requires
 *     runtime grant).
 *   - On WEB (PWA / browser): falls back to the standard Notification
 *     API, also requesting permission lazily.
 *   - DEDUP: a notification only fires ONCE per unique remote version.
 *     Subsequent OTA checks that report the same version stay silent.
 *   - All errors are swallowed — a failed notification never blocks the
 *     update banner UI from appearing in-app.
 */
export async function notifyOtaAvailable(version: string): Promise<void> {
  // OTA updates have been completely removed. This is a safe no-op.
  return Promise.resolve();
}

/**
 * Ask the user for permission to post system notifications, ONCE,
 * at app launch. Called from main.tsx so the OS dialog appears the
 * first time the user opens the app — they don't have to wait for an
 * OTA update to be detected for the prompt to show.
 *
 *   - On NATIVE (Android APK): uses @capacitor/local-notifications.
 *     Only prompts when the current state is 'prompt' or
 *     'prompt-with-rationale'. If the user already granted or already
 *     denied, this is a no-op (we don't re-prompt the same user).
 *   - On WEB (PWA / browser): uses the standard Notification API,
 *     same gate (only when state is 'default').
 *   - All errors are swallowed — a failed permission check should never
 *     block the app from booting.
 */
export async function ensureNotificationPermission(): Promise<void> {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'prompt' || status.display === 'prompt-with-rationale') {
        await LocalNotifications.requestPermissions();
      }
    } catch (err) {
      console.warn('[notifications] permission request failed:', err);
    }
    return;
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch (err) {
    console.warn('[notifications] web permission request failed:', err);
  }
}

/** Stable, non-negative 31-bit hash. Java/Android-friendly notification id. */
function hash31(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h & 0x7fffffff;
}

export async function applyUpdate(
  options: ApplyUpdateOptions,
): Promise<ApplyUpdateResult> {
  return { ok: false, error: 'OTA updates are disabled in this version.' };
}

/**
 * Smoothly fades the screen to black using a full-screen transition,
 * then invokes the given reload/restart callback.
 */
export async function fadeToBlackAndReload(
  reloadCallback: () => void | Promise<void>
): Promise<void> {
  const overlay = document.createElement('div');
  overlay.id = 'update-fade-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.backgroundColor = '#000000';
  overlay.style.zIndex = '999999';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)';
  overlay.style.pointerEvents = 'all';
  document.body.appendChild(overlay);

  // Trigger layout to ensure opacity transition runs
  overlay.getBoundingClientRect();
  overlay.style.opacity = '1';

  // Set a safety watchdog timer. If the web view fails to reload or restart
  // and terminate the JavaScript environment within 6 seconds, we fade the overlay out
  // and clean it up to prevent the user from being locked on a black screen.
  const safetyTimer = setTimeout(() => {
    console.warn('[fadeToBlackAndReload] Reload safety watchdog triggered. Removing black overlay.');
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
    }, 500);
  }, 6000);

  // Wait for the transition to finish
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Perform the reload
  try {
    await reloadCallback();
  } catch (err) {
    clearTimeout(safetyTimer);
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
    }, 500);
    throw err;
  }
}


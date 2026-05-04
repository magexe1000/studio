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
 * On web (PWA / dev preview / Replit iframe) all of these are no-ops —
 * the existing `window.location.reload()` flow handles the swap via
 * the service worker's cache.
 */

import { Capacitor } from '@capacitor/core';
import { nativeSet, NATIVE_PREFS } from './nativePrefs';
import { APP_VERSION, compareSemver } from './appVersion';

/** True only inside a Capacitor-wrapped native shell (Android APK). */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
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
  if (!isNative()) return;
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

    // STALE-BUNDLE GUARD ───────────────────────────────────────────────
    // When the user installs a NEWER APK over a device that already has
    // an OLDER Capgo bundle persisted in app data, Capgo will keep
    // serving the persisted (older) bundle on next boot — so the user
    // sees the version they thought they just upgraded past. Detect
    // this and roll back to the APK's bundled assets so the freshly
    // installed APK actually runs.
    try {
      const active = await CapacitorUpdater.current();
      // `current()` returns `{ bundle: { version, id, ... }, native }`.
      // The "builtin" bundle reports id "builtin" — never reset that.
      const activeVer = active?.bundle?.version;
      const activeId  = active?.bundle?.id;
      if (
        activeId &&
        activeId !== 'builtin' &&
        typeof activeVer === 'string' &&
        compareSemver(APP_VERSION, activeVer) > 0
      ) {
        console.warn(
          `[capgo] APK ${APP_VERSION} is newer than active bundle ${activeVer} — resetting to builtin.`,
        );
        await CapacitorUpdater.reset();
        // reset() reloads to builtin, so anything below this won't run.
        return;
      }
    } catch (err) {
      console.warn('[capgo] stale-bundle guard skipped:', err);
    }

    await CapacitorUpdater.notifyAppReady();
  } catch (err) {
    console.warn('[capgo] notifyAppReady failed (continuing):', err);
  }
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
  if (!version) return;
  // Canonicalize so trivially-different formats ("3.0.3 ", "v3.0.3")
  // can't slip past the dedup. Empty after trim → bail out.
  const v = version.trim();
  if (!v) return;
  if (readNotifiedVersion() === v) return;
  // In-flight guard: a second concurrent caller for the same version
  // short-circuits without racing the permission/schedule pipeline.
  if (inFlightNotifications.has(v)) return;
  inFlightNotifications.add(v);

  try {
    if (isNative()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        // Android 13+ requires explicit grant of POST_NOTIFICATIONS.
        // checkPermissions() returns 'granted' / 'denied' / 'prompt'.
        // If the user has previously denied, don't re-prompt — that
        // re-runs the system permission dialog every launch and is
        // hostile UX. We just stay silent on this version.
        let display = (await LocalNotifications.checkPermissions()).display;
        if (display === 'prompt' || display === 'prompt-with-rationale') {
          display = (await LocalNotifications.requestPermissions()).display;
        }
        if (display !== 'granted') return;
        await LocalNotifications.schedule({
          notifications: [
            {
              // 32-bit signed positive id — Android rejects negatives
              // and overflow values. Using a stable hash of the
              // version means the same version can never produce two
              // simultaneous visible notifications even if dedup misfires.
              id: hash31(`ota:${v}`),
              title: 'Studio update available',
              body: `Version ${v} is ready to install.`,
              // Tiny delay so the notification fires from the system
              // scheduler (more reliable than "show now" on some OEMs).
              schedule: { at: new Date(Date.now() + 200) },
              // NOTE: no `smallIcon` — the plugin falls back to the
              // app icon, which is always present. Specifying a name
              // that doesn't exist as a drawable causes the schedule
              // to fail silently and the user sees nothing.
            },
          ],
        });
        writeNotifiedVersion(v);
      } catch (err) {
        console.warn('[ota] local notification failed:', err);
      }
      return;
    }

    // Web fallback — same behaviour via the browser's Notification API.
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
      new Notification('Studio update available', {
        body: `Version ${v} is ready to install.`,
        tag: `ota:${v}`,
      });
      writeNotifiedVersion(v);
    } catch (err) {
      console.warn('[ota] web notification failed:', err);
    }
  } finally {
    inFlightNotifications.delete(v);
  }
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
  if (!isNative()) return { ok: false, error: 'not native' };
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    // Listen for download progress so the UI can render a bar.
    let progressListener: { remove: () => Promise<void> } | undefined;
    if (options.onProgress) {
      const cb = options.onProgress;
      progressListener = await CapacitorUpdater.addListener(
        'download',
        (info: { percent?: number }) => {
          if (typeof info?.percent === 'number') {
            cb(Math.max(0, Math.min(1, info.percent / 100)));
          }
        },
      );
    }
    try {
      const downloaded = await CapacitorUpdater.download({
        url: options.url,
        version: options.version,
      });
      // Mark the new bundle as the next-to-load and reload.
      await CapacitorUpdater.set({ id: downloaded.id });
      // `set()` already reloads, but call reload() defensively in case
      // the plugin's behaviour drifts in a future version.
      try {
        await CapacitorUpdater.reload();
      } catch {
        /* set() handled the reload */
      }
      return { ok: true };
    } finally {
      if (progressListener) {
        try {
          await progressListener.remove();
        } catch {
          /* ignore cleanup errors */
        }
      }
    }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Unknown OTA error';
    console.error('[capgo] applyUpdate failed:', err);
    return { ok: false, error: msg };
  }
}

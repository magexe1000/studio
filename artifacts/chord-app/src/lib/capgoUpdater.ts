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

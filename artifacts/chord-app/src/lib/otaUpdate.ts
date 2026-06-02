/**
 * Over-the-air update checker.
 *
 * Compares the bundle version (from `lib/appVersion`) against a
 * remote `version.json` file shipped alongside the app. The remote
 * file is the single source of "what's the latest released version".
 *
 * Behaviour:
 *  - On app boot, fetch `<base>version.json` once with a short timeout.
 *  - If `remote.version > local APP_VERSION`, expose `updateAvailable`
 *    state to the UI (a tiny indicator surfaces this in the Hub).
 *  - On every launch we compare the bundled `APP_VERSION` against a
 *    `lastSeenVersion` stored in localStorage. If the bundle has
 *    advanced since last launch, the user just received an update —
 *    show the changelog modal, then write the new version back.
 *  - Every failure path (offline, malformed JSON, missing file,
 *    parse error) is swallowed silently. Updates are best-effort.
 *
 * Single source of truth: the bundle's `APP_VERSION` is the *current*
 * version (what the user has installed). The remote `version.json` is
 * the *latest* version the team has shipped. The OTA system never
 * accepts a version from any other source.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION, compareSemver, normalizeSemver } from './appVersion';
import { isNative, notifyOtaAvailable } from './capgoUpdater';
import { nativeSet, NATIVE_PREFS } from './nativePrefs';
import { useChordStore } from '../store/useChordStore';
import { logActivity } from './activityLogger';

let cachedNativeVersion: string | null = null;
export async function getNativeVersion(): Promise<string | null> {
  if (cachedNativeVersion) return cachedNativeVersion;
  if (!isNative()) return null;
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    cachedNativeVersion = info.version;
    return cachedNativeVersion;
  } catch (err) {
    console.warn('[ota] Failed to get native version:', err);
    return null;
  }
}


function getSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function removeSessionItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const LAST_SEEN_KEY = 'studio:lastSeenVersion';
const FETCH_TIMEOUT_MS = 6000;
/** How often to re-check for updates while the app is open and visible.
 *  60 s — short enough that a release is detected the first time the
 *  user touches the phone after publishing, long enough to be invisible
 *  on battery. The native WorkManager worker (`OtaCheckWorker.java`)
 *  handles the background path. */
const FOREGROUND_POLL_MS = 60 * 1000;

export interface RemoteVersionInfo {
  version: string;
  changelog?: string;
  mandatory?: boolean;
  /**
   * Absolute URL to a Capgo-compatible zip of the new bundle. Only
   * present in releases published with `scripts/publish-bundle.mjs`.
   * Used by the Capgo updater on native (Android APK). Web ignores it
   * — service-worker reload handles bundle swaps in the browser.
   */
  downloadUrl?: string;
  updateType?: 'ota' | 'apk' | 'both' | 'none';
  apkUrl?: string;
  apkSha256?: string;
  releaseNotes?: string[];
}

export interface OtaState {
  /** True when remote > local. */
  updateAvailable: boolean;
  /** Latest version reported by the server, if we successfully fetched. */
  remoteVersion: string | null;
  /** Server-provided release notes for the new version. */
  changelog: string | null;
  /** Server-provided "users must update" flag. */
  mandatory: boolean;
  /** Absolute URL to the Capgo bundle zip, if the server published one. */
  downloadUrl: string | null;
  /** True until the first fetch resolves (used to gate UI shimmer). */
  loading: boolean;
}

const INITIAL_STATE: OtaState = {
  updateAvailable: false,
  remoteVersion: null,
  changelog: null,
  mandatory: false,
  downloadUrl: null,
  loading: true,
};

/**
 * Resolve every URL we should try in order to discover the latest
 * `version.json`. We return a LIST so a slow/stale CDN can be raced
 * against a fast/fresh origin — `fetchRemoteVersion` takes the first
 * one that responds successfully.
 *
 * Sources in priority order:
 *
 *   1. `VITE_OTA_VERSION_URL` (explicit override) — if set, it's the
 *      ONLY source we try. Lets ops point at any custom endpoint
 *      (e.g. a small Cloudflare worker).
 *   2. raw.githubusercontent.com (DERIVED, fast path) — when
 *      `VITE_OTA_BASE_URL` looks like `https://USER.github.io/REPO`,
 *      the source files live in the same repo's `docs/` folder. The
 *      raw.githubusercontent.com endpoint serves them within seconds
 *      of a push, vs. GitHub Pages' Fastly which can take 2–3 minutes
 *      to flush. This is the difference between "instant" and
 *      "user reloads four times before the banner shows".
 *   3. `<VITE_OTA_BASE_URL>/version.json` (fallback) — the actual
 *      Pages URL, in case the repo is private or the raw endpoint is
 *      blocked.
 *   4. `<BASE_URL>version.json` on web — same-origin, no auth needed.
 *
 * Every URL is cache-busted with a unique `?t=` query and fetched with
 * `cache: 'no-store'` so neither the browser nor Fastly can hand us a
 * stale entry.
 */
function versionJsonUrls(): string[] {
  const t = Date.now();
  const override = (import.meta.env.VITE_OTA_VERSION_URL as string | undefined)?.trim();
  if (override) {
    const sep = override.includes('?') ? '&' : '?';
    return [`${override}${sep}t=${t}`];
  }

  const remoteBase = (import.meta.env.VITE_OTA_BASE_URL as string | undefined)?.replace(/\/$/, '');
  const urls: string[] = [];

  if (remoteBase) {
    // GitHub Pages → derive a sibling raw.githubusercontent URL.
    // Match both `https://USER.github.io/REPO` and `https://USER.github.io`
    // (user/organization site). The repo for a project site IS the path
    // segment; for a user site it's `USER.github.io`.
    const m = remoteBase.match(/^https:\/\/([^.]+)\.github\.io(?:\/([^/?#]+))?$/i);
    if (m) {
      const user = m[1];
      const repo = m[2] ?? `${user}.github.io`;
      // The publish script writes to `docs/`, served by Pages from the
      // repo root. So the source file is at `docs/version.json` on the
      // default branch. We try `main` first, fall back to `master`.
      urls.push(
        `https://raw.githubusercontent.com/${user}/${repo}/main/docs/version.json?t=${t}`,
        `https://raw.githubusercontent.com/${user}/${repo}/master/docs/version.json?t=${t}`,
      );
    }
    urls.push(`${remoteBase}/version.json?t=${t}`);
  }

  // Web / PWA / dev preview / iframe — same-origin always works.
  if (!isNative()) {
    const localBase = import.meta.env.BASE_URL || '/';
    urls.push(`${localBase}version.json?t=${t}`);
  }

  if (urls.length === 0 && isNative()) {
    console.error(
      '[ota] VITE_OTA_BASE_URL is not set — OTA update checks are disabled on native. ' +
        'Rebuild with VITE_OTA_BASE_URL=https://your-deployment.example.com.',
    );
  }

  return urls;
}

/**
 * Try one specific URL. Returns the parsed manifest, or `null` for any
 * failure (HTTP error, abort, malformed JSON, missing required field).
 * Never throws.
 */
async function fetchOne(
  url: string,
  signal: AbortSignal,
): Promise<RemoteVersionInfo | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal,
      // NOTE: do NOT add Cache-Control / Pragma headers here. They are
      // NOT in the CORS-safelisted request-header list, so they would
      // upgrade this simple GET to a preflighted OPTIONS request —
      // raw.githubusercontent.com does not respond to OPTIONS for
      // arbitrary paths, and the fetch silently fails with a CORS
      // error. The `?t=Date.now()` cache buster on the URL is enough
      // to defeat browser/CDN caching without triggering preflight.
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== 'object') return null;
    const obj = json as Record<string, unknown>;
    if (typeof obj.version !== 'string' || !obj.version.trim()) return null;
    return {
      version: obj.version,
      changelog: typeof obj.changelog === 'string' ? obj.changelog : undefined,
      mandatory: obj.mandatory === true,
      downloadUrl:
        typeof obj.downloadUrl === 'string' && /^https?:\/\//.test(obj.downloadUrl)
          ? obj.downloadUrl
          : undefined,
      updateType: (obj.updateType === 'ota' || obj.updateType === 'apk' || obj.updateType === 'both' || obj.updateType === 'none') ? obj.updateType : undefined,
      apkUrl: typeof obj.apkUrl === 'string' ? obj.apkUrl : undefined,
      apkSha256: typeof obj.apkSha256 === 'string' ? obj.apkSha256 : undefined,
      releaseNotes: Array.isArray(obj.releaseNotes) ? (obj.releaseNotes.filter(item => typeof item === 'string') as string[]) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the remote version manifest. Tries every URL returned by
 * `versionJsonUrls()` IN PARALLEL and returns whichever response
 * reports the HIGHEST semver. Racing in parallel (vs. sequentially)
 * means the slow GH-Pages CDN can never be the bottleneck — the
 * faster raw.githubusercontent endpoint will almost always win, and
 * if the repo is private and that 404s, the Pages fallback still
 * resolves on its own clock.
 *
 * Resolves to `null` only when EVERY source failed. Never throws.
 */
export async function fetchRemoteVersion(
  signal?: AbortSignal,
): Promise<RemoteVersionInfo | null> {
  const urls = versionJsonUrls();
  if (urls.length === 0) return null;

  const ctrl = signal ? null : new AbortController();
  const sig = signal ?? ctrl!.signal;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null;

  try {
    // Race all URL fetches in parallel, resolving immediately on the first
    // successful fetch of a valid version to bypass slow Pages CDNs and master 404s.
    return await new Promise<RemoteVersionInfo | null>((resolve) => {
      let resolved = false;
      let failedCount = 0;
      const total = urls.length;

      urls.forEach((url) => {
        fetchOne(url, sig)
          .then((res) => {
            if (resolved) return;
            if (res) {
              resolved = true;
              resolve(res);
            } else {
              failedCount++;
              if (failedCount === total) {
                resolve(null);
              }
            }
          })
          .catch(() => {
            if (resolved) return;
            failedCount++;
            if (failedCount === total) {
              resolve(null);
            }
          });
      });
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Best-effort: compare the remote version against the bundle's version
 * and return whether an update is available. All errors swallowed.
 */
export type OtaUpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'applied' | 'dismissed' | 'error';

export interface CentralizedOtaState {
  updateState: OtaUpdateState;
  updateAvailable: boolean;
  remoteVersion: string | null;
  changelog: string | null;
  mandatory: boolean;
  downloadUrl: string | null;
  loading: boolean;
  progress: number;
  error: string | null;
  updateType: 'ota' | 'apk' | 'both' | 'none';
  apkUrl: string | null;
  apkSha256: string | null;
  releaseNotes: string[] | null;
  statusText: string | null;
}

let globalOtaState: CentralizedOtaState = {
  updateState: 'idle',
  updateAvailable: false,
  remoteVersion: null,
  changelog: null,
  mandatory: false,
  downloadUrl: null,
  loading: true,
  progress: 0,
  error: null,
  updateType: 'none',
  apkUrl: null,
  apkSha256: null,
  releaseNotes: null,
  statusText: null,
};

const stateListeners = new Set<(state: CentralizedOtaState) => void>();

function updateGlobalState(updates: Partial<CentralizedOtaState>) {
  globalOtaState = { ...globalOtaState, ...updates };
  stateListeners.forEach((l) => l(globalOtaState));
}

let activeCheckPromise: Promise<CentralizedOtaState> | null = null;
let activeDownloadPromise: Promise<void> | null = null;
let activeApplyPromise: Promise<void> | null = null;

/**
 * Centralized checkForUpdate: racing fetches in parallel, resolving
 * immediately, checking seen/dismissed locks, and locking concurrent requests.
 */
export function checkForUpdate(isManual = false): Promise<CentralizedOtaState> {
  // 1. Synchronously return if check is already running
  if (activeCheckPromise) return activeCheckPromise;

  // 2. Synchronous early return if check is unnecessary
  if (globalOtaState.updateState === 'downloading' || 
      globalOtaState.updateState === 'ready' || 
      globalOtaState.updateState === 'applied') {
    return Promise.resolve(globalOtaState);
  }

  // 3. Clear session storage locks on manual checks so the modal always auto-opens
  if (isManual) {
    removeSessionItem('studio:laterUpdateVersion');
    removeSessionItem('studio:autoOpenedUpdateVersion');
  }

  activeCheckPromise = (async () => {
    updateGlobalState({ updateState: 'checking', loading: true });
    try {
      const remote = await fetchRemoteVersion();
      if (!remote) {
        updateGlobalState({ updateState: 'idle', updateAvailable: false, loading: false });
        return globalOtaState;
      }

      const cmp = compareSemver(remote.version, APP_VERSION);
      let updateType: 'ota' | 'apk' | 'both' | 'none' = 'none';
      let apkUrl: string | null = null;

      if (cmp > 0) {
        if (remote.updateType === 'apk' || remote.updateType === 'both' || remote.updateType === 'ota') {
          updateType = remote.updateType;
        } else if (isNative()) {
          const natVer = await getNativeVersion();
          if (natVer && compareSemver(remote.version, natVer) > 0) {
            updateType = remote.downloadUrl ? 'both' : 'apk';
          } else {
            updateType = 'ota';
          }
        } else {
          updateType = 'ota';
        }
      }

      if (updateType === 'none') {
        updateGlobalState({ updateState: 'idle', updateAvailable: false, updateType: 'none', loading: false });
        return globalOtaState;
      }

      if (updateType === 'apk' || updateType === 'both') {
        if (remote.apkUrl) {
          apkUrl = remote.apkUrl;
        } else {
          const { resolveApkUrl } = await import('./apkDownloader');
          apkUrl = await resolveApkUrl(remote.version);
        }
      }

      // Check if already applied or dismissed in persistent storage
      const applied = localStorage.getItem('studio:appliedUpdateVersion');
      if (applied === remote.version) {
        updateGlobalState({ updateState: 'applied', updateAvailable: false, updateType, loading: false });
        return globalOtaState;
      }

      const dismissed = getSessionItem('studio:laterUpdateVersion');
      const isDismissed = dismissed === remote.version;

      updateGlobalState({
        updateState: isDismissed ? 'dismissed' : 'available',
        updateAvailable: true,
        remoteVersion: remote.version,
        changelog: remote.changelog ?? null,
        mandatory: remote.mandatory === true,
        downloadUrl: remote.downloadUrl ?? null,
        updateType,
        apkUrl,
        apkSha256: remote.apkSha256 ?? null,
        releaseNotes: remote.releaseNotes ?? null,
        loading: false,
      });

      // System notification if never seen and not already dismissed
      const notified = localStorage.getItem('studio:notifiedUpdateVersion');
      if (notified !== remote.version && !isDismissed) {
        await notifyOtaAvailable(remote.version);
      }

      return globalOtaState;
    } catch (err) {
      console.warn('[OTA] Check failed:', err);
      updateGlobalState({ updateState: 'error', error: String(err), loading: false });
      return globalOtaState;
    } finally {
      activeCheckPromise = null;
    }
  })();

  return activeCheckPromise;
}

/**
 * Centralized downloadUpdate: locks the download process and mirrors progress globally.
 */
export function downloadUpdate(): Promise<void> {
  if (activeDownloadPromise) return activeDownloadPromise;

  const { updateType, apkUrl, downloadUrl, remoteVersion } = globalOtaState;

  if (globalOtaState.updateState === 'ready' || globalOtaState.updateState === 'applied') {
    if (updateType === 'apk' || updateType === 'both') {
      const downloadedPath = localStorage.getItem('studio:downloadedApkPath');
      if (downloadedPath) {
        return Promise.resolve();
      }
    } else {
      // Safety check: if native, verify the bundle ID actually exists, otherwise force re-download
      const downloadedId = localStorage.getItem('studio:downloadedBundleId');
      if (!isNative() || downloadedId) {
        return Promise.resolve();
      }
    }
  }

  if (!isNative()) {
    // Web: instant download/ready transition (handled on apply reload)
    updateGlobalState({ updateState: 'ready', progress: 1.0 });
    return Promise.resolve();
  }

  if (updateType === 'both') {
    if (!apkUrl || !downloadUrl || !remoteVersion) {
      updateGlobalState({ updateState: 'error', error: 'Missing OTA or APK update URL' });
      return Promise.reject(new Error('Missing OTA or APK update URL'));
    }

    activeDownloadPromise = (async () => {
      updateGlobalState({ updateState: 'downloading', progress: 0.01, statusText: 'Downloading app update', error: null });
      try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
        const { downloadApk } = await import('./apkDownloader');

        // 1. Download OTA bundle (allocated to first 20% of progress bar)
        let otaProgress = 0;
        const progressListener = await CapacitorUpdater.addListener(
          'download',
          (info: { percent?: number }) => {
            if (typeof info?.percent === 'number') {
              otaProgress = Math.max(0, Math.min(1, info.percent / 100));
              updateGlobalState({ 
                progress: otaProgress * 0.2,
                statusText: 'Downloading app update'
              });
            }
          },
        );

        let downloadedBundle;
        try {
          downloadedBundle = await CapacitorUpdater.download({
            url: downloadUrl,
            version: remoteVersion,
          });
          updateGlobalState({ progress: 0.2 });
        } finally {
          if (progressListener) {
            await progressListener.remove().catch(() => {});
          }
        }

        // 2. Download APK (allocated to remaining 80% of progress bar)
        const filePath = await downloadApk(apkUrl, (percent) => {
          const apkProgress = Math.max(0, Math.min(1, percent / 100));
          updateGlobalState({ 
            progress: 0.2 + apkProgress * 0.8,
            statusText: 'Downloading system update'
          });
        });

        updateGlobalState({ progress: 1.0, statusText: 'Preparing update' });
        await new Promise((resolve) => setTimeout(resolve, 800));

        updateGlobalState({ statusText: 'Verifying update' });
        await new Promise((resolve) => setTimeout(resolve, 800));

        updateGlobalState({ statusText: 'Ready to install', updateState: 'ready' });
        localStorage.setItem('studio:downloadedApkPath', filePath);
        localStorage.setItem('studio:downloadedBundleId', downloadedBundle.id);
      } catch (err) {
        console.error('[OTA] Both update failed:', err);
        updateGlobalState({ 
          updateState: 'error', 
          error: err instanceof Error ? err.message : 'Download failed',
          statusText: null
        });
        throw err;
      } finally {
        activeDownloadPromise = null;
      }
    })();
    return activeDownloadPromise;
  }

  if (updateType === 'apk') {
    if (!apkUrl) {
      updateGlobalState({ updateState: 'error', error: 'No APK download URL available' });
      return Promise.reject(new Error('No APK download URL available'));
    }

    activeDownloadPromise = (async () => {
      updateGlobalState({ updateState: 'downloading', progress: 0.01, statusText: 'Downloading app update', error: null });
      try {
        const { downloadApk } = await import('./apkDownloader');
        
        const filePath = await downloadApk(apkUrl, (percent) => {
          updateGlobalState({ 
            progress: Math.max(0, Math.min(1, percent / 100)),
            statusText: 'Downloading app update'
          });
        });

        updateGlobalState({ progress: 1.0, statusText: 'Preparing update' });
        await new Promise((resolve) => setTimeout(resolve, 800));

        updateGlobalState({ statusText: 'Verifying update' });
        await new Promise((resolve) => setTimeout(resolve, 800));

        updateGlobalState({ statusText: 'Ready to install', updateState: 'ready' });
        localStorage.setItem('studio:downloadedApkPath', filePath);
        localStorage.removeItem('studio:downloadedBundleId');
      } catch (err) {
        console.error('[OTA] APK download failed:', err);
        updateGlobalState({ 
          updateState: 'error', 
          error: err instanceof Error ? err.message : 'Download failed',
          statusText: null
        });
        throw err;
      } finally {
        activeDownloadPromise = null;
      }
    })();
    return activeDownloadPromise;
  }

  if (!downloadUrl || !remoteVersion) {
    updateGlobalState({ updateState: 'error', error: 'No download URL available' });
    return Promise.reject(new Error('No download URL available'));
  }

  activeDownloadPromise = (async () => {
    updateGlobalState({ updateState: 'downloading', progress: 0, error: null });
    try {
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

      let progressListener: { remove: () => Promise<void> } | undefined;
      progressListener = await CapacitorUpdater.addListener(
        'download',
        (info: { percent?: number }) => {
          if (typeof info?.percent === 'number') {
            updateGlobalState({ progress: Math.max(0, Math.min(1, info.percent / 100)) });
          }
        },
      );

      try {
        const downloaded = await CapacitorUpdater.download({
          url: downloadUrl,
          version: remoteVersion,
        });
        updateGlobalState({ progress: 1.0, updateState: 'ready' });
        localStorage.setItem('studio:downloadedBundleId', downloaded.id);
        localStorage.removeItem('studio:downloadedApkPath');
      } finally {
        if (progressListener) {
          await progressListener.remove().catch(() => {});
        }
      }
    } catch (err) {
      console.error('[OTA] Download failed:', err);
      updateGlobalState({ updateState: 'error', error: err instanceof Error ? err.message : 'Download failed' });
      throw err; // Re-throw to prevent caller from proceeding to applyUpdate
    } finally {
      activeDownloadPromise = null;
    }
  })();

  return activeDownloadPromise;
}

/**
 * Centralized applyUpdate: locks activation, saves history, and reloads WebView.
 */
export function applyUpdate(): Promise<void> {
  if (activeApplyPromise) return activeApplyPromise;

  const { remoteVersion, updateType } = globalOtaState;
  if (!remoteVersion) return Promise.resolve();

  activeApplyPromise = (async () => {
    if (updateType === 'apk' || updateType === 'both') {
      updateGlobalState({ updateState: 'applied' });
      localStorage.setItem('studio:appliedUpdateVersion', remoteVersion);
      if (updateType === 'both') {
        logActivity('ota_install', `Installing OTA app update (v${remoteVersion})`, 'Studio');
        logActivity('apk_install', `Installing APK system update (v${remoteVersion})`, 'Studio');
      } else {
        logActivity('apk_install', `Installing APK system update (v${remoteVersion})`, 'Studio');
      }
      try {
        const filePath = localStorage.getItem('studio:downloadedApkPath');
        if (!filePath) {
          throw new Error('No downloaded APK path found.');
        }

        // If both updates are downloaded, configure the Capgo bundle ID so that
        // the native wrapper is immediately configured to load the new OTA build on restart.
        const downloadedId = localStorage.getItem('studio:downloadedBundleId');
        if (updateType === 'both' && downloadedId) {
          try {
            const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
            await CapacitorUpdater.set({ id: downloadedId });
          } catch (e) {
            console.warn('[OTA] Failed to set Capgo bundle in both-update (ignoring):', e);
          }
        }

        const { AppInstaller } = await import('./apkDownloader');
        await AppInstaller.installApk({ filePath });
      } catch (err) {
        console.error('[OTA] APK install failed:', err);
        updateGlobalState({ 
          updateState: 'error', 
          error: err instanceof Error ? err.message : 'Installation failed' 
        });
        localStorage.removeItem('studio:appliedUpdateVersion');
        throw err;
      } finally {
        activeApplyPromise = null;
      }
      return;
    }

    updateGlobalState({ updateState: 'applied' });
    localStorage.setItem('studio:appliedUpdateVersion', remoteVersion);
    logActivity('ota_install', `Installing OTA app update (v${remoteVersion})`, 'Studio');

    if (isNative()) {
      try {
        const downloadedId = localStorage.getItem('studio:downloadedBundleId');
        if (!downloadedId) {
          throw new Error('No downloaded bundle found.');
        }

        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
        const { fadeToBlackAndReload } = await import('./capgoUpdater');

        await fadeToBlackAndReload(async () => {
          await CapacitorUpdater.set({ id: downloadedId });
          try {
            await CapacitorUpdater.reload();
          } catch {
            /* reload handled by set() */
          }
        });
      } catch (err) {
        console.error('[OTA] Apply failed:', err);
        updateGlobalState({ updateState: 'error', error: err instanceof Error ? err.message : 'Apply failed' });
        localStorage.removeItem('studio:appliedUpdateVersion');
        throw err; // Re-throw to propagate exception
      } finally {
        activeApplyPromise = null;
      }
    } else {
      // Web: clear caches and reload page
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        /* ignore */
      }
      const { fadeToBlackAndReload } = await import('./capgoUpdater');
      await fadeToBlackAndReload(() => {
        window.location.reload();
      });
    }
  })();

  return activeApplyPromise;
}

/**
 * Centralized dismissUpdate: saves state in persistent storage.
 */
export function dismissUpdate(): void {
  const { remoteVersion } = globalOtaState;
  if (!remoteVersion) return;
  setSessionItem('studio:laterUpdateVersion', remoteVersion);
  updateGlobalState({ updateState: 'dismissed' });
}

/**
 * Centralized markUpdateSeen: tracks seen versions.
 */
export function markUpdateSeen(): void {
  const { remoteVersion } = globalOtaState;
  if (!remoteVersion) return;
  localStorage.setItem('studio:notifiedUpdateVersion', remoteVersion);
  void nativeSet(NATIVE_PREFS.OTA_REMOTE_SEEN, remoteVersion);
}

export interface UseOtaUpdateResult extends CentralizedOtaState {
  checkNow: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  markUpdateSeen: () => void;
}

export function useOtaUpdate(): UseOtaUpdateResult {
  const [state, setState] = useState<CentralizedOtaState>(globalOtaState);
  const autoCheck = useChordStore((s) => s.settings.otaAutoCheck ?? true);
  const autoCheckRef = useRef(autoCheck);

  useEffect(() => {
    autoCheckRef.current = autoCheck;
  }, [autoCheck]);

  useEffect(() => {
    const listener = (newState: CentralizedOtaState) => {
      setState(newState);
    };
    stateListeners.add(listener);

    // Initial check on mount
    if (globalOtaState.updateState === 'idle') {
      void checkForUpdate();
    }

    const runCheck = () => {
      if (!autoCheckRef.current) return;
      void checkForUpdate();
    };

    // 2a. Web visibility, focus, pageshow, online listeners
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        runCheck();
      }
    };
    const onFocus = () => { runCheck(); };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      window.addEventListener('pageshow', onFocus);
      window.addEventListener('online', onFocus);
    }

    // 2b. Native (Capacitor) State change listeners
    let nativeListener: { remove: () => Promise<void> } | undefined;
    if (isNative()) {
      void (async () => {
        try {
          const { App } = await import('@capacitor/app');
          nativeListener = await App.addListener('appStateChange', (s) => {
            if (s.isActive) runCheck();
          });
        } catch {
          /* plugin unavailable */
        }
      })();
    }

    // 3. Periodic foreground poll
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePoll = () => {
      pollTimer = setTimeout(async () => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          runCheck();
        }
        if (stateListeners.has(listener)) schedulePoll();
      }, FOREGROUND_POLL_MS);
    };
    schedulePoll();

    // Mirror current installed bundle version as baseline
    void nativeSet(NATIVE_PREFS.OTA_INSTALLED, APP_VERSION);

    return () => {
      stateListeners.delete(listener);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('pageshow', onFocus);
        window.removeEventListener('online', onFocus);
      }
      if (pollTimer) clearTimeout(pollTimer);
      if (nativeListener) void nativeListener.remove().catch(() => {});
    };
  }, []);

  const checkNow = async () => {
    await checkForUpdate(true);
  };

  return {
    ...state,
    checkNow,
    downloadUpdate,
    applyUpdate,
    dismissUpdate,
    markUpdateSeen,
  };
}

/* ──────────────────────────────────────────────────────────────────── *
 * Post-update changelog detection.                                     *
 * ──────────────────────────────────────────────────────────────────── */

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}

/**
 * Determines whether THIS launch is the first one after an update.
 * Pure function — call once on mount; gating UI state lives in the
 * `usePostUpdateChangelog` hook below.
 *
 * Logic:
 *  - No prior record → first install ever, don't show a changelog.
 *  - Recorded version < APP_VERSION → user just upgraded, show it.
 *  - Recorded version >= APP_VERSION → already seen this version.
 */
export function detectJustUpdated(): { justUpdated: boolean; from: string | null } {
  const last = readLastSeen();
  if (last === null) return { justUpdated: false, from: null };
  // Defensive: if some past write corrupted the entry (foreign code,
  // a manual edit, schema change), treat it as a fresh baseline so
  // change detection can't get permanently wedged returning 0/equal.
  if (normalizeSemver(last) === null) {
    writeLastSeen(APP_VERSION);
    return { justUpdated: false, from: null };
  }
  return {
    justUpdated: compareSemver(APP_VERSION, last) > 0,
    from: last,
  };
}

/**
 * React hook for the post-update changelog modal.
 *
 *  - On first ever launch: silently records APP_VERSION and shows nothing.
 *  - On a launch where the bundle has advanced: returns `show: true`
 *    so the modal renders. Caller must invoke `dismiss()` to close it
 *    AND write the new version to localStorage so it doesn't re-show.
 *  - Calling `dismiss()` is what persists the new version. If the
 *    user reloads before dismissing, the modal will appear again —
 *    that's intentional, we want them to see it at least once.
 */
export function usePostUpdateChangelog(): {
  show: boolean;
  fromVersion: string | null;
  toVersion: string;
  dismiss: () => void;
} {
  const [show, setShow] = useState(false);
  const [fromVersion, setFromVersion] = useState<string | null>(null);
  const showChangelog = useChordStore((s) => s.settings.otaShowChangelog ?? true);

  useEffect(() => {
    const { justUpdated, from } = detectJustUpdated();
    if (justUpdated) {
      // Even when the user has opted out of the auto-shown sheet, we
      // still want to advance lastSeen so the modal doesn't "build up"
      // and surface the next time they re-enable the toggle.
      if (showChangelog) {
        setFromVersion(from);
        setShow(true);
      } else {
        writeLastSeen(APP_VERSION);
      }
    } else if (from === null) {
      // First install — record current version so future updates
      // produce a clean diff against this baseline.
      writeLastSeen(APP_VERSION);
    }
    // If `from >= APP_VERSION`, do nothing — already up to date.
  }, [showChangelog]);

  const dismiss = () => {
    writeLastSeen(APP_VERSION);
    setShow(false);
  };

  return { show, fromVersion, toVersion: APP_VERSION, dismiss };
}

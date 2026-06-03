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

export let otaDebugLogs: {
  appVersion: string;
  nativeApkVersion: string | null;
  currentOtaVersion: string | null;
  fetchedVersionJson: string | null;
  fetchedAppReleaseJson: string | null;
  compareResult: number | null;
  updateType: string | null;
  finalDecision: string | null;
  downloadStatus: string | null;
  installError: string | null;
  shaVerification: string | null;
  fileDetails: string | null;
  installerLaunchStatus: string | null;
  lastExceptionStackTrace: string | null;
  appInstallerAvailable: boolean;
  registeredPlugins: string;
  pluginMethodCheck: string;
  finalUpdatePath: string;
  downloadApkAvailable: boolean;
  verifyApkSha256Available: boolean;
  installApkAvailable: boolean;
  openInstallPermissionSettingsAvailable: boolean;
} = {
  appVersion: APP_VERSION,
  nativeApkVersion: null,
  currentOtaVersion: null,
  fetchedVersionJson: null,
  fetchedAppReleaseJson: null,
  compareResult: null,
  updateType: null,
  finalDecision: null,
  downloadStatus: null,
  installError: null,
  shaVerification: null,
  fileDetails: null,
  installerLaunchStatus: null,
  lastExceptionStackTrace: null,
  appInstallerAvailable: false,
  registeredPlugins: '[]',
  pluginMethodCheck: 'N/A',
  finalUpdatePath: 'N/A',
  downloadApkAvailable: false,
  verifyApkSha256Available: false,
  installApkAvailable: false,
  openInstallPermissionSettingsAvailable: false,
};

export interface OtaDiagnostics {
  exceptionMessage: string | null;
  failureReason: string | null;
  downloadUrl: string | null;
  apkPath: string | null;
  fileSize: string | null;
  shaExpected: string | null;
  shaCalculated: string | null;
  installerResult: string | null;
  permissionState: string | null;
  androidVersion: string | null;
  deviceModel: string | null;
  timestamp: string | null;
}

export let otaDiagnostics: OtaDiagnostics = {
  exceptionMessage: null,
  failureReason: null,
  downloadUrl: null,
  apkPath: null,
  fileSize: null,
  shaExpected: null,
  shaCalculated: null,
  installerResult: null,
  permissionState: null,
  androidVersion: null,
  deviceModel: null,
  timestamp: null,
};

export function isAppInstallerAvailable(): boolean {
  const cap = (window as any).Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function' && !cap.isNativePlatform()) {
    return false;
  }
  const isPluginAvail = cap.isPluginAvailable?.('AppInstaller') ?? false;
  if (!isPluginAvail) return false;
  const plugin = cap.Plugins?.AppInstaller;
  if (!plugin) return false;

  return (
    typeof plugin.downloadApk === 'function' &&
    (typeof plugin.verifyApkSha256 === 'function' || typeof plugin.verifySha256 === 'function') &&
    typeof plugin.installApk === 'function' &&
    (typeof plugin.openInstallPermissionSettings === 'function' || typeof plugin.openUnknownAppSourcesSettings === 'function')
  );
}

export async function populateDiagnostics(err: any, reason: string) {
  try {
    const timestamp = new Date().toISOString();
    let manufacturer = 'Web Browser';
    let model = typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A';
    let androidVersion = 'N/A';
    let permissionState = 'N/A';

    if (isNative()) {
      try {
        const { AppInstaller } = await import('./apkDownloader');
        const deviceInfo = await AppInstaller.getDeviceInfo();
        manufacturer = deviceInfo.manufacturer;
        model = deviceInfo.model;
        androidVersion = `${deviceInfo.androidVersion} (API ${deviceInfo.sdkInt})`;
        permissionState = `canRequestPackageInstalls: ${deviceInfo.canRequestPackageInstalls}`;
      } catch (e) {
        console.warn('[OTA] Failed to get native device info for diagnostics:', e);
        permissionState = 'Error querying permission';
      }
    }

    const apkPath = localStorage.getItem('studio:downloadedApkPath') || 'N/A';
    let fileSize = 'N/A';
    if (isNative() && apkPath && apkPath !== 'N/A') {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        const info = await Filesystem.stat({ path: apkPath });
        fileSize = `${(info.size / (1024 * 1024)).toFixed(2)} MB (${info.size} bytes)`;
      } catch {
        fileSize = 'File not found or unreadable';
      }
    }

    const shaCalculated = otaDebugLogs.shaVerification === 'SUCCESS' ? (globalOtaState.apkSha256 || 'N/A') : 'N/A';

    otaDiagnostics.exceptionMessage = err instanceof Error ? err.message : String(err);
    otaDiagnostics.failureReason = reason + (err instanceof Error && err.stack ? `\nStack: ${err.stack}` : '');
    otaDiagnostics.downloadUrl = globalOtaState.apkUrl || globalOtaState.downloadUrl || 'N/A';
    otaDiagnostics.apkPath = apkPath;
    otaDiagnostics.fileSize = fileSize;
    otaDiagnostics.shaExpected = globalOtaState.apkSha256 || 'N/A';
    otaDiagnostics.shaCalculated = shaCalculated;
    otaDiagnostics.installerResult = otaDebugLogs.installError || 'N/A';
    otaDiagnostics.permissionState = permissionState;
    otaDiagnostics.androidVersion = androidVersion;
    otaDiagnostics.deviceModel = `${manufacturer} ${model}`;
    otaDiagnostics.timestamp = timestamp;
  } catch (diagErr) {
    console.error('[OTA] Failed to populate diagnostics:', diagErr);
  }
}

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

function getStoredList(key: string): string[] {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

function addToStoredList(key: string, value: string) {
  try {
    const list = getStoredList(key);
    if (!list.includes(value)) {
      list.push(value);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch (err) {
    console.warn(`[OTA] Failed to write key ${key} to storage`, err);
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
   * present in releases published with `scripts/release-firebase.mjs`.
   * Used by the Capgo updater on native (Android APK). Web ignores it
   * — service-worker reload handles bundle swaps in the browser.
   */
  downloadUrl?: string;
  updateType?: 'ota' | 'apk' | 'both' | 'none';
  apkUrl?: string;
  apkSha256?: string;
  manualApkUrl?: string;
  fallbackApkUrl?: string;
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
 *   2. `VITE_OTA_BASE_URL` (or Firebase Hosting default base URL fallback)
 *      which queries `app-release.json` and `version.json`.
 *   3. Same-origin paths on web / PWA.
 *
 * Every URL is cache-busted with a unique `?t=` query and fetched with
 * `cache: 'no-store'` so neither the browser nor CDN can hand us a
 * stale entry.
 */
function versionJsonUrls(): string[] {
  const t = Date.now();
  const override = (import.meta.env.VITE_OTA_VERSION_URL as string | undefined)?.trim();
  if (override) {
    const sep = override.includes('?') ? '&' : '?';
    return [`${override}${sep}t=${t}`];
  }

  const remoteBase = (import.meta.env.VITE_OTA_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'https://studio-30f44.web.app';
  const urls: string[] = [];

  urls.push(`${remoteBase}/app-release.json?t=${t}`);
  urls.push(`${remoteBase}/version.json?t=${t}`);

  // Web / PWA / dev preview / iframe — same-origin always works.
  if (!isNative()) {
    const localBase = import.meta.env.BASE_URL || '/';
    urls.push(`${localBase}app-release.json?t=${t}`);
    urls.push(`${localBase}version.json?t=${t}`);
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
    });
    if (!res.ok) {
      if (url.includes('version.json')) otaDebugLogs.fetchedVersionJson = `HTTP Error ${res.status}`;
      if (url.includes('app-release.json')) otaDebugLogs.fetchedAppReleaseJson = `HTTP Error ${res.status}`;
      return null;
    }
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== 'object') {
      if (url.includes('version.json')) otaDebugLogs.fetchedVersionJson = 'Malformed JSON';
      if (url.includes('app-release.json')) otaDebugLogs.fetchedAppReleaseJson = 'Malformed JSON';
      return null;
    }
    const obj = json as Record<string, unknown>;
    if (typeof obj.version !== 'string' || !obj.version.trim()) {
      if (url.includes('version.json')) otaDebugLogs.fetchedVersionJson = 'Missing version field';
      if (url.includes('app-release.json')) otaDebugLogs.fetchedAppReleaseJson = 'Missing version field';
      return null;
    }
    
    if (url.includes('version.json')) {
      otaDebugLogs.fetchedVersionJson = obj.version;
    } else if (url.includes('app-release.json')) {
      otaDebugLogs.fetchedAppReleaseJson = obj.version;
    }

    // Map new app-release.json fields to RemoteVersionInfo fields
    const changelog = typeof obj.description === 'string' ? obj.description : (typeof obj.changelog === 'string' ? obj.changelog : undefined);
    const downloadUrl = typeof obj.downloadUrl === 'string' ? obj.downloadUrl : (typeof obj.ota_download_url === 'string' ? obj.ota_download_url : undefined);
    const updateType = (obj.update_type === 'ota' || obj.update_type === 'apk' || obj.update_type === 'both' || obj.update_type === 'none') 
      ? obj.update_type 
      : ((obj.updateType === 'ota' || obj.updateType === 'apk' || obj.updateType === 'both' || obj.updateType === 'none') ? obj.updateType : undefined);
    const apkUrl = typeof obj.download_url === 'string' ? obj.download_url : (typeof obj.apkUrl === 'string' ? obj.apkUrl : undefined);
    const apkSha256 = typeof obj.sha256 === 'string' ? obj.sha256 : (typeof obj.apkSha256 === 'string' ? obj.apkSha256 : undefined);
    const manualApkUrl = typeof obj.manual_download_url === 'string' ? obj.manual_download_url : (typeof obj.manualApkUrl === 'string' ? obj.manualApkUrl : undefined);
    const fallbackApkUrl = typeof obj.fallback_download_url === 'string' ? obj.fallback_download_url : (typeof obj.fallbackApkUrl === 'string' ? obj.fallbackApkUrl : undefined);
    
    return {
      version: obj.version,
      changelog,
      mandatory: obj.mandatory === true,
      downloadUrl,
      updateType,
      apkUrl,
      apkSha256,
      manualApkUrl,
      fallbackApkUrl,
      releaseNotes: Array.isArray(obj.releaseNotes) ? (obj.releaseNotes.filter(item => typeof item === 'string') as string[]) : undefined,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (url.includes('version.json')) otaDebugLogs.fetchedVersionJson = `Error: ${errMsg}`;
    if (url.includes('app-release.json')) otaDebugLogs.fetchedAppReleaseJson = `Error: ${errMsg}`;
    return null;
  }
}

/**
 * Fetch the remote version manifest. Tries every URL returned by
 * `versionJsonUrls()` IN PARALLEL and returns whichever response
 * resolves first. Racing in parallel ensures we bypass any slow caching
 * and get the latest version from Firebase Hosting.
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
    // successful fetch of a version strictly newer than local APP_VERSION.
    // Otherwise, collect them and fallback to the best response once all complete.
    return await new Promise<RemoteVersionInfo | null>((resolve) => {
      let resolved = false;
      let failedCount = 0;
      let fallbackRes: RemoteVersionInfo | null = null;
      const total = urls.length;

      urls.forEach((url) => {
        fetchOne(url, sig)
          .then((res) => {
            if (resolved) return;
            if (res) {
              if (compareSemver(res.version, APP_VERSION) > 0) {
                resolved = true;
                resolve(res);
              } else {
                fallbackRes = res;
                failedCount++;
                if (failedCount === total) {
                  resolve(fallbackRes);
                }
              }
            } else {
              failedCount++;
              if (failedCount === total) {
                resolve(fallbackRes);
              }
            }
          })
          .catch(() => {
            if (resolved) return;
            failedCount++;
            if (failedCount === total) {
              resolve(fallbackRes);
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
export type OtaUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'manual_apk_required'
  | 'downloading_ota'
  | 'downloading_apk'
  | 'verifying_apk'
  | 'ready_to_install'
  | 'installing'
  | 'completed'
  | 'failed';

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
  manualApkUrl: string | null;
  fallbackApkUrl: string | null;
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
  manualApkUrl: null,
  fallbackApkUrl: null,
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
  if (globalOtaState.updateState === 'downloading_ota' || 
      globalOtaState.updateState === 'downloading_apk' || 
      globalOtaState.updateState === 'verifying_apk' || 
      globalOtaState.updateState === 'ready_to_install' || 
      globalOtaState.updateState === 'installing' || 
      globalOtaState.updateState === 'completed') {
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
      let remote = await fetchRemoteVersion();
      const mockOta = getSessionItem('studio:mockOtaResponse');
      if (mockOta) {
        try {
          remote = JSON.parse(mockOta);
          console.log('[OTA DEBUG] Using mock remote response:', remote);
        } catch (e) {
          console.warn('[OTA] Failed to parse mock response:', e);
        }
      }
      const natVer = await getNativeVersion();
      const appliedList = getStoredList('studio:appliedVersions');
      const installedList = getStoredList('studio:installedVersions');
      const dismissedList = getStoredList('studio:dismissedVersions');
      const notifiedList = getStoredList('studio:notifiedVersions');
      const laterVersion = getSessionItem('studio:laterUpdateVersion');
      const urlsTried = versionJsonUrls();

      // Populate debug logs baseline
      otaDebugLogs.appVersion = APP_VERSION;
      otaDebugLogs.nativeApkVersion = natVer || 'N/A';
      if (isNative()) {
        try {
          const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
          const active = await CapacitorUpdater.current();
          otaDebugLogs.currentOtaVersion = active?.bundle?.version || 'builtin';
        } catch {
          otaDebugLogs.currentOtaVersion = 'Error';
        }

        // Pre-fill AppInstaller diagnostics
        try {
          const cap = (window as any).Capacitor;
          const isNativePlat = cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
          const registry = cap?.Plugins ? Object.keys(cap.Plugins) : [];
          otaDebugLogs.registeredPlugins = JSON.stringify(registry);
          
          const appInstallerExists = cap ? cap.isPluginAvailable?.('AppInstaller') ?? false : false;
          otaDebugLogs.appInstallerAvailable = appInstallerExists;
          
          if (appInstallerExists) {
            const plugin = cap.Plugins.AppInstaller;
            otaDebugLogs.downloadApkAvailable = typeof plugin?.downloadApk === 'function';
            otaDebugLogs.verifyApkSha256Available = typeof plugin?.verifyApkSha256 === 'function' || typeof plugin?.verifySha256 === 'function';
            otaDebugLogs.installApkAvailable = typeof plugin?.installApk === 'function';
            otaDebugLogs.openInstallPermissionSettingsAvailable = typeof plugin?.openInstallPermissionSettings === 'function' || typeof plugin?.openUnknownAppSourcesSettings === 'function';
            
            const methods = {
              downloadApk: otaDebugLogs.downloadApkAvailable,
              verifyApkSha256: otaDebugLogs.verifyApkSha256Available,
              installApk: otaDebugLogs.installApkAvailable,
              openInstallPermissionSettings: otaDebugLogs.openInstallPermissionSettingsAvailable,
            };
            otaDebugLogs.pluginMethodCheck = Object.entries(methods)
              .map(([name, exists]) => `${name}: ${exists ? 'YES' : 'NO'}`)
              .join(', ');
            otaDebugLogs.installerLaunchStatus = `REGISTERED: AppInstaller is present in registry. Methods match.`;
          } else {
            otaDebugLogs.downloadApkAvailable = false;
            otaDebugLogs.verifyApkSha256Available = false;
            otaDebugLogs.installApkAvailable = false;
            otaDebugLogs.openInstallPermissionSettingsAvailable = false;
            otaDebugLogs.pluginMethodCheck = isNativePlat ? 'Plugin not found' : 'N/A (Web)';
            otaDebugLogs.installerLaunchStatus = `MISSING: AppInstaller not registered. Plugins: ${registry.join(', ')}`;
          }
        } catch (registryErr: any) {
          otaDebugLogs.pluginMethodCheck = 'Check failed';
          otaDebugLogs.installerLaunchStatus = `Registry check failed: ${registryErr?.message || String(registryErr)}`;
        }
      } else {
        otaDebugLogs.currentOtaVersion = 'N/A (Web)';
      }

      console.log('[OTA DEBUG] checkForUpdate started:', {
        installedBundleVersion: APP_VERSION,
        nativeApkVersion: natVer,
        remoteFetched: remote,
        urlsTried,
        caches: {
          appliedList,
          installedList,
          dismissedList,
          notifiedList,
          laterVersion
        }
      });

      if (!remote) {
        console.log('[OTA DEBUG] Skip: fetchRemoteVersion returned null.');
        otaDebugLogs.compareResult = null;
        otaDebugLogs.updateType = null;
        otaDebugLogs.finalDecision = 'Skip: fetchRemoteVersion returned null';
        updateGlobalState({ updateState: 'idle', updateAvailable: false, loading: false });
        return globalOtaState;
      }

      const cmp = compareSemver(remote.version, APP_VERSION);
      otaDebugLogs.compareResult = cmp;

      let updateType: 'ota' | 'apk' | 'both' | 'none' = 'none';
      let apkUrl: string | null = null;
      let manualApkUrl: string | null = null;
      let fallbackApkUrl: string | null = null;

      if (cmp > 0) {
        if (remote.updateType === 'apk' || remote.updateType === 'both' || remote.updateType === 'ota') {
          updateType = remote.updateType;
        } else if (isNative()) {
          if (natVer && compareSemver(remote.version, natVer) > 0) {
            updateType = remote.downloadUrl ? 'both' : 'apk';
          } else {
            updateType = 'ota';
          }
        } else {
          updateType = 'ota';
        }
      }

      otaDebugLogs.updateType = updateType;

      if (updateType === 'none') {
        console.log('[OTA DEBUG] Skip: updateType evaluated to "none" because remote.version <= APP_VERSION or other platform reason.', {
          remoteVersion: remote.version,
          comparisonCmp: cmp,
          updateType
        });
        otaDebugLogs.finalDecision = `Skip: updateType is 'none' (remote.version=${remote.version} <= APP_VERSION=${APP_VERSION})`;
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
        manualApkUrl = remote.manualApkUrl || `https://studio-30f44.web.app/apk/studio-${remote.version}.bin`;
        fallbackApkUrl = remote.fallbackApkUrl || apkUrl;
      }

      // Check if already applied or dismissed in persistent storage
      const inApplied = appliedList.includes(remote.version);
      const inInstalled = installedList.includes(remote.version);
      const cmpC = compareSemver(remote.version, APP_VERSION) <= 0;
      if (inApplied || inInstalled || cmpC) {
        console.log('[OTA DEBUG] Skip: Version already processed or not newer.', {
          version: remote.version,
          inApplied,
          inInstalled,
          compareSemverLEZero: cmpC,
          comparison: compareSemver(remote.version, APP_VERSION)
        });
        otaDebugLogs.finalDecision = `Skip: Already processed (inApplied=${inApplied}, inInstalled=${inInstalled}, cmpC=${cmpC})`;
        updateGlobalState({ updateState: 'idle', updateAvailable: false, updateType, loading: false });
        return globalOtaState;
      }

      const cap = (window as any).Capacitor;
      const isNativePlat = cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
      
      // Determine final update path
      let finalPath: 'OTA only' | 'APK automatic' | 'manual APK required' | 'no update' = 'no update';
      if (updateType === 'ota') {
        finalPath = 'OTA only';
      } else if (updateType === 'apk' || updateType === 'both') {
        if (isNativePlat) {
          const avail = isAppInstallerAvailable();
          finalPath = avail ? 'APK automatic' : 'manual APK required';
        } else {
          finalPath = 'manual APK required';
        }
      }
      otaDebugLogs.finalUpdatePath = finalPath;

      const isDismissed = dismissedList.includes(remote.version) || laterVersion === remote.version;
      
      let nextState: OtaUpdateState = (isNative() && (updateType === 'apk' || updateType === 'both') && !isAppInstallerAvailable())
        ? 'manual_apk_required'
        : 'available';
      
      otaDebugLogs.finalDecision = `Show: ${nextState === 'manual_apk_required' ? 'Manual APK Update Required' : 'Available'} (isDismissed=${isDismissed})`;

      console.log('[OTA DEBUG] Showing Update:', {
        version: remote.version,
        updateType,
        isDismissed,
        apkUrl,
        downloadUrl: remote.downloadUrl,
        nextState
      });

      updateGlobalState({
        updateState: nextState,
        updateAvailable: true,
        remoteVersion: remote.version,
        changelog: remote.changelog ?? null,
        mandatory: remote.mandatory === true,
        downloadUrl: remote.downloadUrl ?? null,
        updateType,
        apkUrl,
        apkSha256: remote.apkSha256 ?? null,
        manualApkUrl,
        fallbackApkUrl,
        releaseNotes: remote.releaseNotes ?? null,
        loading: false,
      });

      // System notification if never seen and not already dismissed
      if (!notifiedList.includes(remote.version) && !isDismissed) {
        addToStoredList('studio:notifiedVersions', remote.version);
        await notifyOtaAvailable(remote.version);
      }
      return globalOtaState;
    } catch (err) {
      console.warn('[OTA] Check failed:', err);
      updateGlobalState({ updateState: 'failed', error: String(err), loading: false });
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
  const ver = remoteVersion || '';

  if (globalOtaState.updateState === 'ready_to_install' || globalOtaState.updateState === 'completed') {
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

  if (isNative() && (updateType === 'apk' || updateType === 'both')) {
    if (!isAppInstallerAvailable()) {
      otaDebugLogs.finalDecision = 'Manual update required (AppInstaller missing)';
      otaDebugLogs.downloadStatus = 'Error: AppInstaller missing';
      updateGlobalState({ updateState: 'manual_apk_required' });
      return Promise.reject(new Error('AppInstaller is missing. Manual update required.'));
    }
  }

  if (!isNative()) {
    // Web: instant download/ready transition (handled on apply reload)
    updateGlobalState({ updateState: 'ready_to_install', progress: 1.0 });
    return Promise.resolve();
  }

  if (updateType === 'both') {
    if (!apkUrl || !downloadUrl || !remoteVersion) {
      otaDebugLogs.downloadStatus = 'Error: Missing URL(s)';
      updateGlobalState({ updateState: 'failed', error: 'Missing OTA or APK update URL' });
      return Promise.reject(new Error('Missing OTA or APK update URL'));
    }

    activeDownloadPromise = (async () => {
      otaDebugLogs.downloadStatus = `Update started: both\nOTA URL: ${downloadUrl}\nAPK URL: ${apkUrl}`;
      updateGlobalState({ updateState: 'downloading_apk', progress: 0.01, statusText: 'Downloading update', error: null });
      try {
        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
        const { downloadApk } = await import('./apkDownloader');

        // 1. Download OTA bundle (allocated to first 20% of progress bar)
        otaDebugLogs.downloadStatus += `\nOTA download started...`;
        let otaProgress = 0;
        const progressListener = await CapacitorUpdater.addListener(
          'download',
          (info: { percent?: number }) => {
            if (typeof info?.percent === 'number') {
              otaProgress = Math.max(0, Math.min(1, info.percent / 100));
              updateGlobalState({ 
                progress: otaProgress * 0.2,
                statusText: 'Downloading update'
              });
            }
          },
        );

        let downloadedBundle;
        try {
          downloadedBundle = await CapacitorUpdater.download({
            url: downloadUrl,
            version: ver,
          });
          otaDebugLogs.downloadStatus += `\nOTA download completed. Bundle ID: ${downloadedBundle.id}`;
          updateGlobalState({ progress: 0.2 });
        } finally {
          if (progressListener) {
            await progressListener.remove().catch(() => {});
          }
        }

        // 2. Download APK (allocated to remaining 80% of progress bar)
        otaDebugLogs.downloadStatus += `\nAPK download started...`;
        const filePath = await downloadApk(apkUrl, (percent) => {
          const apkProgress = Math.max(0, Math.min(1, percent / 100));
          updateGlobalState({ 
            progress: 0.2 + apkProgress * 0.8,
            statusText: 'Downloading update'
          });
        });
        otaDebugLogs.downloadStatus += `\nAPK download completed. Path: ${filePath}`;

        // Compute/Verify SHA-256 if expected hash is available
        const expectedHash = globalOtaState.apkSha256;
        if (expectedHash) {
          otaDebugLogs.downloadStatus += `\nStarting SHA verification (Expected: ${expectedHash})...`;
          updateGlobalState({ updateState: 'verifying_apk', statusText: 'Verifying package' });
          const { verifyApkSha256 } = await import('./apkDownloader');
          const isValid = await verifyApkSha256(filePath, expectedHash);
          otaDebugLogs.shaVerification = isValid ? 'SUCCESS' : 'FAILED';
          if (!isValid) {
            throw new Error('APK hash verification failed (corrupted download)');
          }
        } else {
          otaDebugLogs.shaVerification = 'SKIPPED (No expected hash)';
        }

        // Get file details
        try {
          const { Filesystem } = await import('@capacitor/filesystem');
          const info = await Filesystem.stat({ path: filePath });
          otaDebugLogs.fileDetails = `Size: ${info.size} bytes\nURI: ${info.uri}`;
        } catch (statErr) {
          otaDebugLogs.fileDetails = `Error reading file stats: ${statErr instanceof Error ? statErr.message : String(statErr)}`;
        }

        updateGlobalState({ progress: 1.0, statusText: 'Downloading update' });
        await new Promise((resolve) => setTimeout(resolve, 300));

        updateGlobalState({ statusText: 'Ready to install', updateState: 'ready_to_install' });
        localStorage.setItem('studio:downloadedApkPath', filePath);
        localStorage.setItem('studio:downloadedBundleId', downloadedBundle.id);
        addToStoredList('studio:downloadedVersions', ver);
      } catch (err) {
        console.error('[OTA] Both update failed:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = (err instanceof Error && err.stack ? err.stack : null);
        otaDebugLogs.installError = `Download/Verify Exception: ${errMsg}\nStack: ${errStack || ''}`;
        otaDebugLogs.lastExceptionStackTrace = errStack;
        otaDebugLogs.installerLaunchStatus = 'FAILED';
        await populateDiagnostics(err, 'Both OTA/APK update download or verification failed');
        updateGlobalState({ 
          updateState: 'failed', 
          error: errMsg,
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
      otaDebugLogs.downloadStatus = 'Error: Missing APK URL';
      updateGlobalState({ updateState: 'failed', error: 'No APK download URL available' });
      return Promise.reject(new Error('No APK download URL available'));
    }

    activeDownloadPromise = (async () => {
      otaDebugLogs.downloadStatus = `Update started: apk\nAPK URL: ${apkUrl}`;
      updateGlobalState({ updateState: 'downloading_apk', progress: 0.01, statusText: 'Downloading update', error: null });
      try {
        const { downloadApk } = await import('./apkDownloader');
        
        otaDebugLogs.downloadStatus += `\nAPK download started...`;
        const filePath = await downloadApk(apkUrl, (percent) => {
          updateGlobalState({ 
            progress: Math.max(0, Math.min(1, percent / 100)),
            statusText: 'Downloading update'
          });
        });
        otaDebugLogs.downloadStatus += `\nAPK download completed. Path: ${filePath}`;

        // Compute/Verify SHA-256 if expected hash is available
        const expectedHash = globalOtaState.apkSha256;
        if (expectedHash) {
          otaDebugLogs.downloadStatus += `\nStarting SHA verification (Expected: ${expectedHash})...`;
          updateGlobalState({ updateState: 'verifying_apk', statusText: 'Verifying package' });
          const { verifyApkSha256 } = await import('./apkDownloader');
          const isValid = await verifyApkSha256(filePath, expectedHash);
          otaDebugLogs.shaVerification = isValid ? 'SUCCESS' : 'FAILED';
          if (!isValid) {
            throw new Error('APK hash verification failed (corrupted download)');
          }
        } else {
          otaDebugLogs.shaVerification = 'SKIPPED (No expected hash)';
        }

        // Get file details
        try {
          const { Filesystem } = await import('@capacitor/filesystem');
          const info = await Filesystem.stat({ path: filePath });
          otaDebugLogs.fileDetails = `Size: ${info.size} bytes\nURI: ${info.uri}`;
        } catch (statErr) {
          otaDebugLogs.fileDetails = `Error reading file stats: ${statErr instanceof Error ? statErr.message : String(statErr)}`;
        }

        updateGlobalState({ progress: 1.0, statusText: 'Downloading update' });
        await new Promise((resolve) => setTimeout(resolve, 300));

        updateGlobalState({ statusText: 'Ready to install', updateState: 'ready_to_install' });
        localStorage.setItem('studio:downloadedApkPath', filePath);
        localStorage.removeItem('studio:downloadedBundleId');
        addToStoredList('studio:downloadedVersions', ver);
      } catch (err) {
        console.error('[OTA] APK download failed:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = (err instanceof Error && err.stack ? err.stack : null);
        otaDebugLogs.installError = `Download/Verify Exception: ${errMsg}\nStack: ${errStack || ''}`;
        otaDebugLogs.lastExceptionStackTrace = errStack;
        otaDebugLogs.installerLaunchStatus = 'FAILED';
        await populateDiagnostics(err, 'APK download or verification failed');
        updateGlobalState({ 
          updateState: 'failed', 
          error: errMsg,
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
    otaDebugLogs.downloadStatus = 'Error: Missing downloadUrl';
    updateGlobalState({ updateState: 'failed', error: 'No download URL available' });
    return Promise.reject(new Error('No download URL available'));
  }

  activeDownloadPromise = (async () => {
    otaDebugLogs.downloadStatus = `Update started: ota\nOTA URL: ${downloadUrl}`;
    updateGlobalState({ updateState: 'downloading_ota', progress: 0, error: null });
    try {
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

      otaDebugLogs.downloadStatus += `\nOTA download started...`;
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
          version: ver,
        });
        otaDebugLogs.downloadStatus += `\nOTA download completed. Bundle ID: ${downloaded.id}`;
        updateGlobalState({ progress: 1.0, updateState: 'ready_to_install' });
        localStorage.setItem('studio:downloadedBundleId', downloaded.id);
        localStorage.removeItem('studio:downloadedApkPath');
        addToStoredList('studio:downloadedVersions', ver);
      } finally {
        if (progressListener) {
          await progressListener.remove().catch(() => {});
        }
      }
    } catch (err) {
      console.error('[OTA] Download failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = (err instanceof Error && err.stack ? err.stack : null);
      otaDebugLogs.installError = `Download Exception: ${errMsg}\nStack: ${errStack || ''}`;
      otaDebugLogs.lastExceptionStackTrace = errStack;
      otaDebugLogs.installerLaunchStatus = 'FAILED';
      await populateDiagnostics(err, 'OTA bundle download failed');
      updateGlobalState({ updateState: 'failed', error: errMsg });
      throw err;
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
      updateGlobalState({ updateState: 'installing' });
      localStorage.setItem('studio:appliedUpdateVersion', remoteVersion);
      addToStoredList('studio:installedVersions', remoteVersion);
      addToStoredList('studio:appliedVersions', remoteVersion);
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
            otaDebugLogs.installError = `Both-update: setting Capgo bundle ID: ${downloadedId}`;
            const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
            await CapacitorUpdater.set({ id: downloadedId });
            otaDebugLogs.installError += `\nCapgo bundle ID set successfully.`;
          } catch (e) {
            console.warn('[OTA] Failed to set Capgo bundle in both-update (ignoring):', e);
            otaDebugLogs.installError += `\nWarning: Failed to set Capgo bundle ID: ${e instanceof Error ? e.message : String(e)}`;
          }
        }

        const { AppInstaller } = await import('./apkDownloader');
        otaDebugLogs.installError = (otaDebugLogs.installError || '') + `\nLaunching APK installer intent for file: ${filePath}`;
        updateGlobalState({ statusText: 'Launching APK installer' });

        await AppInstaller.installApk({ filePath });
        
        otaDebugLogs.installError += `\nAPK installer intent launched successfully!`;
        otaDebugLogs.installerLaunchStatus = 'SUCCESS';
        otaDebugLogs.lastExceptionStackTrace = 'None';
        updateGlobalState({ statusText: 'APK installer launched' });
      } catch (err) {
        console.error('[OTA] APK install failed:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = (err instanceof Error && err.stack ? err.stack : null);
        otaDebugLogs.installError = (otaDebugLogs.installError || '') + `\nAPK Install Exception: ${errMsg}\nStack: ${errStack || ''}`;
        otaDebugLogs.installerLaunchStatus = 'FAILED';
        otaDebugLogs.lastExceptionStackTrace = errStack;
        await populateDiagnostics(err, 'APK installation failed');
        updateGlobalState({ 
          updateState: 'failed', 
          error: errMsg,
          statusText: 'Installation failed'
        });
        localStorage.removeItem('studio:appliedUpdateVersion');
        throw err;
      } finally {
        activeApplyPromise = null;
      }
      return;
    }

    updateGlobalState({ updateState: 'installing' });
    localStorage.setItem('studio:appliedUpdateVersion', remoteVersion);
    addToStoredList('studio:installedVersions', remoteVersion);
    addToStoredList('studio:appliedVersions', remoteVersion);
    logActivity('ota_install', `Installing OTA app update (v${remoteVersion})`, 'Studio');

    if (isNative()) {
      try {
        const downloadedId = localStorage.getItem('studio:downloadedBundleId');
        if (!downloadedId) {
          throw new Error('No downloaded bundle found.');
        }

        const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
        const { fadeToBlackAndReload } = await import('./capgoUpdater');

        otaDebugLogs.installError = `Applying OTA bundle ID: ${downloadedId}`;
        updateGlobalState({ statusText: 'Applying OTA bundle' });

        await fadeToBlackAndReload(async () => {
          await CapacitorUpdater.set({ id: downloadedId });
          try {
            await CapacitorUpdater.reload();
          } catch {
            /* reload handled by set() */
          }
        });
        
        otaDebugLogs.installError += `\nOTA bundle applied and reload triggered.`;
        otaDebugLogs.installerLaunchStatus = 'SUCCESS';
        otaDebugLogs.lastExceptionStackTrace = 'None';
        updateGlobalState({ statusText: 'OTA reload triggered', updateState: 'completed' });
      } catch (err) {
        console.error('[OTA] Apply failed:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = (err instanceof Error && err.stack ? err.stack : null);
        otaDebugLogs.installError = `OTA Apply Exception: ${errMsg}\nStack: ${errStack || ''}`;
        otaDebugLogs.installerLaunchStatus = 'FAILED';
        otaDebugLogs.lastExceptionStackTrace = errStack;
        await populateDiagnostics(err, 'OTA apply failed');
        updateGlobalState({ 
          updateState: 'failed', 
          error: errMsg,
          statusText: 'OTA apply failed'
        });
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
  const { remoteVersion, updateType } = globalOtaState;
  if (!remoteVersion) return;
  setSessionItem('studio:laterUpdateVersion', remoteVersion);
  const isApkFlow = updateType === 'apk' || updateType === 'both';
  const nextState = (isNative() && isApkFlow && !isAppInstallerAvailable()) ? 'manual_apk_required' : 'available';
  updateGlobalState({ updateState: nextState });
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

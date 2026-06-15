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
import { isNative, notifyOtaAvailable, shouldUseAndroidApkUpdater } from './capgoUpdater';
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
  remoteUpdateType: string | null;
  otaBlockedBecauseApkRequired: boolean;
  apkEligibilityResult: string;
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
  installedVersionCode: number | null;
  requiredApkVersion: string | null;
  requiredVersionCode: number | null;
  nativeApkBehind: boolean;
  apkUpdateRequired: boolean;
  pendingOtaBundleId: string | null;
  staleOtaCleared: boolean;
  capgoSetBlocked: boolean;
  triggerComponent: string | null;
  finalPathExecuted: 'OTA applied' | 'APK installer launched' | 'blocked due to APK required' | 'N/A';
  installedPackageName: string | null;
  installedVersionName: string | null;
  installedSigningSha256: string | null;
  installedDebuggable: boolean | null;
  downloadedPackageName: string | null;
  downloadedVersionName: string | null;
  downloadedVersionCode: number | null;
  downloadedSigningSha256: string | null;
  downloadedDebuggable: boolean | null;
  downloadedApkPath: string | null;
  downloadedApkSize: string | null;
  downloadedApkSha256: string | null;
  downloadedIsValidApk: boolean | null;
  downloadedIsUniversalApk: boolean | null;
  eligibilityPackageNameMatch: boolean | null;
  eligibilitySigningMatch: boolean | null;
  eligibilityVersionCodeHigher: boolean | null;
  eligibilityReleaseBuild: boolean | null;
  eligibilityValidApk: boolean | null;
  eligibilityFinalInstall: string | null;
  eligibilityReason: string | null;
  updateDecision: string | null;
  updateDecisionReason: string | null;
  remoteVersionCode: number | null;
  versionComparisonResult: string | null;
  nativePlatformDetected: boolean | null;
  platformDetected: string | null;
  apkMetadataValid: boolean | null;
  apkUrlPresent: boolean | null;
  apkShaPresent: boolean | null;
  skippedDismissedState: string | null;
  releaseChannel: string | null;
  rolloutEligibility: string | null;
} = {
  appVersion: APP_VERSION,
  nativeApkVersion: null,
  currentOtaVersion: null,
  fetchedVersionJson: null,
  fetchedAppReleaseJson: null,
  compareResult: null,
  updateType: null,
  remoteUpdateType: null,
  otaBlockedBecauseApkRequired: false,
  apkEligibilityResult: 'N/A',
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
  installedVersionCode: null,
  requiredApkVersion: null,
  requiredVersionCode: null,
  nativeApkBehind: false,
  apkUpdateRequired: false,
  pendingOtaBundleId: null,
  staleOtaCleared: false,
  capgoSetBlocked: false,
  triggerComponent: null,
  finalPathExecuted: 'N/A',
  installedPackageName: null,
  installedVersionName: null,
  installedSigningSha256: null,
  installedDebuggable: null,
  downloadedPackageName: null,
  downloadedVersionName: null,
  downloadedVersionCode: null,
  downloadedSigningSha256: null,
  downloadedDebuggable: null,
  downloadedApkPath: null,
  downloadedApkSize: null,
  downloadedApkSha256: null,
  downloadedIsValidApk: null,
  downloadedIsUniversalApk: null,
  eligibilityPackageNameMatch: null,
  eligibilitySigningMatch: null,
  eligibilityVersionCodeHigher: null,
  eligibilityReleaseBuild: null,
  eligibilityValidApk: null,
  eligibilityFinalInstall: null,
  eligibilityReason: null,
  updateDecision: null,
  updateDecisionReason: null,
  remoteVersionCode: null,
  versionComparisonResult: null,
  nativePlatformDetected: null,
  platformDetected: null,
  apkMetadataValid: null,
  apkUrlPresent: null,
  apkShaPresent: null,
  skippedDismissedState: null,
  releaseChannel: null,
  rolloutEligibility: null,
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

export interface StructuredReleaseNotes {
  added?: string[];
  improved?: string[];
  fixed?: string[];
  changed?: string[];
}

export interface RemoteVersionInfo {
  version: string;
  /** Flat user-facing changelog string, separated by newlines. */
  changelog?: string;
  /** Mandatory update flag — disables the "Later" button. */
  mandatory: boolean;
  /** Absolute OTA zip bundle URL. Missing on APK-only updates
   * — service-worker reload handles bundle swaps in the browser.
   */
  downloadUrl?: string;
  updateType?: 'ota' | 'apk' | 'both' | 'none';
  apkUrl?: string;
  apkSha256?: string;
  manualApkUrl?: string;
  fallbackApkUrl?: string;
  releaseNotes?: string[] | StructuredReleaseNotes;
  requiredApkVersion?: string;
  requiredVersionCode?: number;
  versionCode?: number;
  platform?: string;
  reinstallRequired?: boolean;
  signatureChanged?: boolean;
  previousSignatureSha256?: string;
  newSignatureSha256?: string;
  installMode?: 'reinstall-required';
  packageName?: string;
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

  if (shouldUseAndroidApkUpdater()) {
    urls.push(`${remoteBase}/app-release.json?t=${t}`);
  } else {
    // Web / PWA / dev preview / iframe — same-origin only.
    // Querying the Firebase production domain causes updates to be falsely detected on staging / Netlify hosts.
    // Web / PWA same-origin cache-busting check - v2
    const localBase = import.meta.env.BASE_URL || '/';
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
    
    const reinstallRequired = !!(obj.reinstallRequired || obj.reinstall_required);
    const signatureChanged = !!(obj.signatureChanged || obj.signature_changed);
    const previousSignatureSha256 = typeof obj.previousSignatureSha256 === 'string' ? obj.previousSignatureSha256 : (typeof obj.previous_signature_sha256 === 'string' ? obj.previous_signature_sha256 : undefined);
    const newSignatureSha256 = typeof obj.newSignatureSha256 === 'string' ? obj.newSignatureSha256 : (typeof obj.new_signature_sha256 === 'string' ? obj.new_signature_sha256 : undefined);
    const installMode = (obj.installMode === 'reinstall-required' || obj.install_mode === 'reinstall-required') ? 'reinstall-required' : undefined;
    const packageName = typeof obj.packageName === 'string' ? obj.packageName : (typeof obj.package_name === 'string' ? obj.package_name : undefined);
    
    const requiredApkVersion = typeof obj.required_apk_version === 'string'
      ? obj.required_apk_version
      : (typeof obj.requiredApkVersion === 'string' ? obj.requiredApkVersion : undefined);
    const requiredVersionCode = typeof obj.required_version_code === 'number'
      ? obj.required_version_code
      : (typeof obj.requiredVersionCode === 'number' ? obj.requiredVersionCode : (typeof obj.required_version_code === 'string' ? parseInt(obj.required_version_code, 10) : (typeof obj.requiredVersionCode === 'string' ? parseInt(obj.requiredVersionCode, 10) : undefined)));
    const versionCode = typeof obj.versionCode === 'number'
      ? obj.versionCode
      : (typeof obj.version_code === 'number' ? obj.version_code : (typeof obj.versionCode === 'string' ? parseInt(obj.versionCode, 10) : (typeof obj.version_code === 'string' ? parseInt(obj.version_code, 10) : undefined)));

    let parsedReleaseNotes: string[] | StructuredReleaseNotes | undefined = undefined;
    if (obj.releaseNotes) {
      if (Array.isArray(obj.releaseNotes)) {
        parsedReleaseNotes = obj.releaseNotes.filter((item: any) => typeof item === 'string') as string[];
      } else if (typeof obj.releaseNotes === 'object') {
        const rnObj = obj.releaseNotes as any;
        const notesObj: StructuredReleaseNotes = {};
        if (Array.isArray(rnObj.added)) {
          notesObj.added = rnObj.added.filter((item: any) => typeof item === 'string') as string[];
        }
        if (Array.isArray(rnObj.improved)) {
          notesObj.improved = rnObj.improved.filter((item: any) => typeof item === 'string') as string[];
        }
        if (Array.isArray(rnObj.fixed)) {
          notesObj.fixed = rnObj.fixed.filter((item: any) => typeof item === 'string') as string[];
        }
        if (Array.isArray(rnObj.changed)) {
          notesObj.changed = rnObj.changed.filter((item: any) => typeof item === 'string') as string[];
        }
        if (notesObj.added || notesObj.improved || notesObj.fixed || notesObj.changed) {
          parsedReleaseNotes = notesObj;
        }
      }
    }

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
      releaseNotes: parsedReleaseNotes,
      requiredApkVersion,
      requiredVersionCode,
      versionCode,
      platform: typeof obj.platform === 'string' ? obj.platform : undefined,
      reinstallRequired,
      signatureChanged,
      previousSignatureSha256,
      newSignatureSha256,
      installMode,
      packageName,
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
  | 'failed'
  | 'signature_mismatch'
  | 'versionCode_low';

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
  remoteUpdateType: 'ota' | 'apk' | 'both' | 'none';
  otaBlockedBecauseApkRequired: boolean;
  apkUrl: string | null;
  apkSha256: string | null;
  manualApkUrl: string | null;
  fallbackApkUrl: string | null;
  releaseNotes: string[] | StructuredReleaseNotes | null;
  statusText: string | null;
  requiredApkVersion: string | null;
  requiredVersionCode: number | null;
  nativeApkBehind: boolean;
  apkUpdateRequired: boolean;
  pendingOtaBundleId: string | null;
  staleOtaCleared: boolean;
  capgoSetBlocked: boolean;
  triggerComponent: string | null;
  finalPathExecuted: 'OTA applied' | 'APK installer launched' | 'blocked due to APK required' | 'N/A';
  reinstallRequired: boolean;
  signatureChanged: boolean;
  previousSignatureSha256: string | null;
  newSignatureSha256: string | null;
  installMode: 'reinstall-required' | null;
  packageName: string | null;
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
  remoteUpdateType: 'none',
  otaBlockedBecauseApkRequired: false,
  apkUrl: null,
  apkSha256: null,
  manualApkUrl: null,
  fallbackApkUrl: null,
  releaseNotes: null,
  statusText: null,
  requiredApkVersion: null,
  requiredVersionCode: null,
  nativeApkBehind: false,
  apkUpdateRequired: false,
  pendingOtaBundleId: null,
  staleOtaCleared: false,
  capgoSetBlocked: false,
  triggerComponent: null,
  finalPathExecuted: 'N/A',
  reinstallRequired: false,
  signatureChanged: false,
  previousSignatureSha256: null,
  newSignatureSha256: null,
  installMode: null,
  packageName: null,
};

const stateListeners = new Set<(state: CentralizedOtaState) => void>();

function updateGlobalState(updates: Partial<CentralizedOtaState>) {
  globalOtaState = { ...globalOtaState, ...updates };
  stateListeners.forEach((l) => l(globalOtaState));
}

export function resetOtaUpdateState() {
  updateGlobalState({
    updateState: 'idle',
    updateAvailable: false,
    remoteVersion: null,
    changelog: null,
    mandatory: false,
    downloadUrl: null,
    error: null,
    progress: 0,
    updateType: 'none',
    remoteUpdateType: 'none',
    otaBlockedBecauseApkRequired: false,
    apkUrl: null,
    apkSha256: null,
    manualApkUrl: null,
    fallbackApkUrl: null,
    releaseNotes: null,
    requiredApkVersion: null,
    requiredVersionCode: null,
    nativeApkBehind: false,
    apkUpdateRequired: false,
    pendingOtaBundleId: null,
    staleOtaCleared: false,
    capgoSetBlocked: false,
    triggerComponent: null,
    finalPathExecuted: 'N/A',
  });
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
      try {
        otaDebugLogs.pendingOtaBundleId = localStorage.getItem('studio:downloadedBundleId') || 'None';
      } catch (_) {
        otaDebugLogs.pendingOtaBundleId = 'Error';
      }
      otaDebugLogs.staleOtaCleared = false;
      otaDebugLogs.capgoSetBlocked = false;
      otaDebugLogs.triggerComponent = isManual ? 'Developer Options (Manual Check)' : 'Auto Poll / System';
      otaDebugLogs.finalPathExecuted = 'N/A';

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

      let installedVersionCode = 0;
      let installedSignature = '';
      if (isNative()) {
        try {
          const { AppInstaller } = await import('./apkDownloader');
          const installedDetails = await AppInstaller.getInstalledAppDetails();
          installedVersionCode = installedDetails.versionCode;
          installedSignature = (installedDetails.signatures || '').replace(/:/g, '').toLowerCase().trim();
        } catch (err) {
          console.warn('[OTA] Failed to query installed details:', err);
        }
      }

      let nativeApkBehind = false;
      let apkUpdateRequired = false;
      let staleOtaCleared = true;

      // Ensure old Capgo OTA state is completely cleared
      try {
        localStorage.removeItem('studio:downloadedBundleId');
      } catch (_) {}

      const isNativePlat = isNative();
      const targetVersionCode = remote.versionCode ?? remote.requiredVersionCode;
      
      const apkUrlPresent = !!(remote.apkUrl || remote.downloadUrl);
      const apkShaPresent = !!remote.apkSha256;
      const apkMetadataValid = !!(remote.version && remote.platform === 'android' && apkUrlPresent && apkShaPresent);
      
      const isDismissed = dismissedList.includes(remote.version) || laterVersion === remote.version;
      const skippedDismissedState = isDismissed ? 'skipped_by_user' : 'not_skipped';
      
      const releaseChannel = (remote as any).releaseChannel || (remote as any).channel || 'production';
      const rolloutEligibility = (remote as any).rollout !== undefined ? `${(remote as any).rollout}%` : '100%';

      let versionComparisonResult = 'same_version';
      if (isNativePlat) {
        if (targetVersionCode && installedVersionCode > 0) {
          if (targetVersionCode > installedVersionCode) {
            versionComparisonResult = 'remote_version_higher';
          } else if (targetVersionCode < installedVersionCode) {
            versionComparisonResult = 'remote_version_lower';
          } else {
            versionComparisonResult = 'same_version';
          }
        } else {
          const sCmp = compareSemver(remote.version, APP_VERSION);
          versionComparisonResult = sCmp > 0 ? 'remote_version_higher' : (sCmp < 0 ? 'remote_version_lower' : 'same_version');
        }
      } else {
        const sCmp = compareSemver(remote.version, APP_VERSION);
        versionComparisonResult = sCmp > 0 ? 'remote_version_higher' : (sCmp < 0 ? 'remote_version_lower' : 'same_version');
      }

      const isUpgrade = isNativePlat
        ? (targetVersionCode && installedVersionCode > 0
            ? targetVersionCode > installedVersionCode
            : compareSemver(remote.version, APP_VERSION) > 0)
        : compareSemver(remote.version, APP_VERSION) > 0;

      if (isUpgrade) {
        nativeApkBehind = true;
        apkUpdateRequired = true;
        
        // Clear stale cached APK path if the cached version name is different from target remote version
        const downloadedPath = localStorage.getItem('studio:downloadedApkPath');
        if (downloadedPath && !downloadedPath.includes(`studio-update-${remote.version}.apk`)) {
          localStorage.removeItem('studio:downloadedApkPath');
        }
      }

      let updateType: 'ota' | 'apk' | 'both' | 'none' = 'none';
      if (isUpgrade) {
        updateType = 'apk';
      }

      const updateAvailable = isUpgrade;

      let decisionReason = 'no_update_same_version';
      if (isUpgrade) {
        decisionReason = 'upgrade_available';
      } else {
        if (!isNativePlat) {
          decisionReason = 'native_platform_not_detected';
        } else if (remote.platform !== 'android') {
          decisionReason = 'wrong_platform';
        } else if (!apkUrlPresent) {
          decisionReason = 'missing_apk_url';
        } else if (!apkShaPresent) {
          decisionReason = 'missing_apk_sha';
        } else if (isDismissed) {
          decisionReason = 'skipped_by_user';
        } else if (versionComparisonResult === 'remote_version_lower') {
          decisionReason = 'remote_version_lower';
        } else if (versionComparisonResult === 'same_version') {
          decisionReason = 'no_update_same_version';
        } else {
          decisionReason = 'unsupported_update_mode';
        }
      }

      otaDebugLogs.installedVersionCode = installedVersionCode;
      otaDebugLogs.requiredApkVersion = remote.requiredApkVersion || 'N/A';
      otaDebugLogs.requiredVersionCode = remote.requiredVersionCode || null;
      otaDebugLogs.nativeApkBehind = nativeApkBehind;
      otaDebugLogs.apkUpdateRequired = apkUpdateRequired;
      otaDebugLogs.staleOtaCleared = staleOtaCleared;

      otaDebugLogs.updateType = updateType;
      otaDebugLogs.remoteUpdateType = remote.updateType || 'none';
      const otaBlockedBecauseApkRequired = false;
      otaDebugLogs.otaBlockedBecauseApkRequired = otaBlockedBecauseApkRequired;
      otaDebugLogs.apkEligibilityResult = 'N/A';

      otaDebugLogs.updateDecision = updateType;
      otaDebugLogs.updateDecisionReason = decisionReason;
      otaDebugLogs.remoteVersionCode = targetVersionCode || null;
      otaDebugLogs.versionComparisonResult = versionComparisonResult;
      otaDebugLogs.nativePlatformDetected = isNativePlat;
      otaDebugLogs.platformDetected = remote.platform || 'web';
      otaDebugLogs.apkMetadataValid = apkMetadataValid;
      otaDebugLogs.apkUrlPresent = apkUrlPresent;
      otaDebugLogs.apkShaPresent = apkShaPresent;
      otaDebugLogs.skippedDismissedState = skippedDismissedState;
      otaDebugLogs.releaseChannel = releaseChannel;
      otaDebugLogs.rolloutEligibility = rolloutEligibility;

      // Update global context mirroring variables
      updateGlobalState({
        pendingOtaBundleId: null,
        staleOtaCleared,
        capgoSetBlocked: false,
        triggerComponent: otaDebugLogs.triggerComponent,
        finalPathExecuted: 'N/A'
      });

      let apkUrl: string | null = null;
      let manualApkUrl: string | null = null;
      let fallbackApkUrl: string | null = null;

      if (updateType === 'none') {
        console.log('[OTA DEBUG] Skip: updateType evaluated to "none" because remote.version <= APP_VERSION and no APK update required.', {
          remoteVersion: remote.version,
          updateType
        });
        otaDebugLogs.finalDecision = `Skip: updateType is 'none' (remote.version=${remote.version} <= APP_VERSION=${APP_VERSION})`;
        updateGlobalState({
          updateState: 'idle',
          updateAvailable: false,
          updateType: 'none',
          remoteUpdateType: remote.updateType || 'none',
          otaBlockedBecauseApkRequired: false,
          loading: false,
          requiredApkVersion: remote.requiredApkVersion ?? null,
          requiredVersionCode: remote.requiredVersionCode ?? null,
          nativeApkBehind,
          apkUpdateRequired,
          reinstallRequired: false,
          signatureChanged: false,
          previousSignatureSha256: null,
          newSignatureSha256: null,
          installMode: null,
          packageName: null,
        });
        return globalOtaState;
      }

      if (remote.apkUrl) {
        apkUrl = remote.apkUrl;
      } else {
        const { resolveApkUrl } = await import('./apkDownloader');
        apkUrl = await resolveApkUrl(remote.version);
      }
      manualApkUrl = remote.manualApkUrl || `https://studio-30f44.web.app/apk/studio-${remote.version}.apk`;
      fallbackApkUrl = remote.fallbackApkUrl || apkUrl;

      const shouldSkip = !isUpgrade;

      if (shouldSkip) {
        console.log('[OTA DEBUG] Skip: No upgrade required.', {
          version: remote.version,
          isUpgrade
        });
        otaDebugLogs.finalDecision = `Skip: No upgrade required (isUpgrade=false)`;
        updateGlobalState({
          updateState: 'idle',
          updateAvailable: false,
          updateType,
          remoteUpdateType: remote.updateType || 'none',
          otaBlockedBecauseApkRequired,
          loading: false,
          requiredApkVersion: remote.requiredApkVersion ?? null,
          requiredVersionCode: remote.requiredVersionCode ?? null,
          nativeApkBehind,
          apkUpdateRequired,
          reinstallRequired: false,
          signatureChanged: false,
          previousSignatureSha256: null,
          newSignatureSha256: null,
          installMode: null,
          packageName: null,
        });
        return globalOtaState;
      }

      // Determine final update path
      let finalPath: 'OTA only' | 'APK first' | 'both: APK first then OTA' | 'manual recovery required' | 'no update' = 'no update';
      if (!updateAvailable) {
        finalPath = 'no update';
      } else if (isNative()) {
        const isAppInstallerAvail = isAppInstallerAvailable();
        finalPath = isAppInstallerAvail ? 'APK first' : 'manual recovery required';
      } else {
        finalPath = 'manual recovery required';
      }
      otaDebugLogs.finalUpdatePath = finalPath;

      // isDismissed already computed above
      
      let nextState: OtaUpdateState = (isNative() && !isAppInstallerAvailable())
        ? 'manual_apk_required'
        : 'available';
      
      otaDebugLogs.finalDecision = `Show: ${nextState === 'manual_apk_required' ? 'Manual APK Update Required' : 'Available'} (isDismissed=${isDismissed})`;

      console.log('[OTA DEBUG] Showing Update:', {
        version: remote.version,
        updateType,
        isDismissed,
        apkUrl,
        nextState,
        apkUpdateRequired
      });

      let clientReinstallRequired = false;
      if (remote.reinstallRequired || remote.installMode === 'reinstall-required') {
        const cleanNewSig = (remote.newSignatureSha256 || '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206').replace(/:/g, '').toLowerCase().trim();
        if (isNative() && installedSignature && installedSignature !== cleanNewSig) {
          clientReinstallRequired = true;
        }
      }

      updateGlobalState({
        updateState: nextState,
        updateAvailable: true,
        remoteVersion: remote.version,
        changelog: remote.changelog ?? null,
        mandatory: remote.mandatory === true,
        downloadUrl: null,
        updateType,
        remoteUpdateType: remote.updateType || 'none',
        otaBlockedBecauseApkRequired,
        apkUrl,
        apkSha256: remote.apkSha256 ?? null,
        manualApkUrl,
        fallbackApkUrl,
        releaseNotes: remote.releaseNotes ?? null,
        loading: false,
        requiredApkVersion: remote.requiredApkVersion ?? null,
        requiredVersionCode: remote.requiredVersionCode ?? null,
        nativeApkBehind,
        apkUpdateRequired,
        reinstallRequired: clientReinstallRequired,
        signatureChanged: remote.signatureChanged === true,
        previousSignatureSha256: remote.previousSignatureSha256 ?? null,
        newSignatureSha256: remote.newSignatureSha256 ?? null,
        installMode: remote.installMode ?? null,
        packageName: remote.packageName ?? null,
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

export async function runEligibilityCheck(filePath: string): Promise<boolean> {
  try {
    const { checkApkEligibility } = await import('./apkDownloader');
    const el = await checkApkEligibility(filePath);
    
    // Populate installed app info
    otaDebugLogs.installedPackageName = el.installed?.packageName ?? null;
    otaDebugLogs.installedVersionName = el.installed?.versionName ?? null;
    otaDebugLogs.installedVersionCode = el.installed?.versionCode ?? null;
    otaDebugLogs.installedSigningSha256 = el.installed?.signingSha256 ?? null;
    otaDebugLogs.installedDebuggable = el.installed?.debuggable ?? null;

    // Populate downloaded APK info
    otaDebugLogs.downloadedPackageName = el.downloaded?.packageName ?? null;
    otaDebugLogs.downloadedVersionName = el.downloaded?.versionName ?? null;
    otaDebugLogs.downloadedVersionCode = el.downloaded?.versionCode ?? null;
    otaDebugLogs.downloadedSigningSha256 = el.downloaded?.signingSha256 ?? null;
    otaDebugLogs.downloadedDebuggable = el.downloaded?.debuggable ?? null;
    otaDebugLogs.downloadedApkPath = filePath;
    otaDebugLogs.downloadedIsValidApk = el.downloaded?.isValidApk ?? null;
    otaDebugLogs.downloadedIsUniversalApk = el.downloaded?.isUniversalApk ?? null;
    
    // Get file size from filesystem
    try {
      const { Filesystem } = await import('@capacitor/filesystem');
      const info = await Filesystem.stat({ path: filePath });
      otaDebugLogs.downloadedApkSize = `${(info.size / (1024 * 1024)).toFixed(2)} MB (${info.size} bytes)`;
    } catch {
      otaDebugLogs.downloadedApkSize = 'N/A';
    }
    otaDebugLogs.downloadedApkSha256 = globalOtaState.apkSha256 ?? null;

    // Populate eligibility checks
    if (el.installed && el.downloaded) {
      otaDebugLogs.eligibilityPackageNameMatch = el.installed.packageName === el.downloaded.packageName;
      otaDebugLogs.eligibilitySigningMatch = el.installed.signingSha256.replace(/:/g, '').toLowerCase() === el.downloaded.signingSha256.replace(/:/g, '').toLowerCase();
      otaDebugLogs.eligibilityVersionCodeHigher = el.downloaded.versionCode > el.installed.versionCode;
      otaDebugLogs.eligibilityReleaseBuild = el.downloaded.debuggable === false;
      otaDebugLogs.eligibilityValidApk = el.downloaded.isValidApk === true;
    } else {
      otaDebugLogs.eligibilityPackageNameMatch = null;
      otaDebugLogs.eligibilitySigningMatch = null;
      otaDebugLogs.eligibilityVersionCodeHigher = null;
      otaDebugLogs.eligibilityReleaseBuild = null;
      otaDebugLogs.eligibilityValidApk = null;
    }
    
    otaDebugLogs.eligibilityFinalInstall = el.eligible ? 'can install' : 'cannot install';
    otaDebugLogs.eligibilityReason = el.reason ?? null;
    otaDebugLogs.apkEligibilityResult = el.eligible ? 'eligible' : (el.reason ?? 'unknown');

    if (!el.eligible) {
      if (el.reason === 'signature_mismatch') {
        updateGlobalState({ updateState: 'signature_mismatch' });
      } else if (el.reason === 'versionCode_low') {
        updateGlobalState({ updateState: 'versionCode_low' });
      } else {
        updateGlobalState({
          updateState: 'failed',
          error: el.errorDetails || 'APK eligibility validation failed.'
        });
      }
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[OTA] Eligibility helper check failed:', err);
    otaDebugLogs.eligibilityFinalInstall = 'cannot install';
    otaDebugLogs.eligibilityReason = 'parse_failed';
    otaDebugLogs.apkEligibilityResult = 'parse_failed';
    updateGlobalState({
      updateState: 'failed',
      error: err instanceof Error ? err.message : String(err)
    });
    return false;
  }
}

/**
 * Centralized downloadUpdate: locks the download process and mirrors progress globally.
 */
export function downloadUpdate(trigger?: string): Promise<void> {
  if (activeDownloadPromise) return activeDownloadPromise;

  if (trigger) {
    otaDebugLogs.triggerComponent = trigger;
    updateGlobalState({ triggerComponent: trigger });
  }

  const { apkUrl, remoteVersion } = globalOtaState;
  const ver = remoteVersion || '';

  if (globalOtaState.updateState === 'ready_to_install' || globalOtaState.updateState === 'completed') {
    const downloadedPath = localStorage.getItem('studio:downloadedApkPath');
    if (downloadedPath) {
      return Promise.resolve();
    }
  }

  if (isNative()) {
    if (!isAppInstallerAvailable()) {
      otaDebugLogs.finalDecision = 'Manual update required (AppInstaller missing)';
      otaDebugLogs.downloadStatus = 'Error: AppInstaller missing';
      updateGlobalState({ updateState: 'manual_apk_required' });
      return Promise.reject(new Error('AppInstaller is missing. Manual update required.'));
    }
  }

  if (!isNative()) {
    // Web: clear service workers, caches, and reload page with cache-buster
    void (async () => {
      try {
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
      } catch (e) {
        console.warn('Failed to clear cache/sw before reload:', e);
      } finally {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('upd', Date.now().toString());
          window.location.href = url.toString();
        } catch {
          window.location.reload();
        }
      }
    })();
    return Promise.resolve();
  }

  if (!apkUrl) {
    otaDebugLogs.downloadStatus = 'Error: Missing APK URL';
    updateGlobalState({ updateState: 'failed', error: 'No APK download URL available' });
    return Promise.reject(new Error('No APK download URL available'));
  }

  activeDownloadPromise = (async () => {
    // Clear stale path for different versions before starting the download
    const downloadedPath = localStorage.getItem('studio:downloadedApkPath');
    if (downloadedPath && !downloadedPath.includes(`studio-update-${ver}.apk`)) {
      localStorage.removeItem('studio:downloadedApkPath');
    }
    
    otaDebugLogs.downloadStatus = `Update started: apk\nAPK URL: ${apkUrl}`;
    updateGlobalState({ updateState: 'downloading_apk', progress: 0.01, statusText: 'Downloading update', error: null });
    try {
      const { downloadApk } = await import('./apkDownloader');
      
      otaDebugLogs.downloadStatus += `\nAPK download started...`;
      const fileName = `studio-update-${ver}.apk`;
      const filePath = await downloadApk(apkUrl, fileName, (percent) => {
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

      otaDebugLogs.downloadStatus += `\nRunning pre-install eligibility check...`;
      const isEligible = await runEligibilityCheck(filePath);
      if (!isEligible) {
        throw new Error('Eligibility validation failed: ' + (otaDebugLogs.eligibilityReason || 'unknown'));
      }

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

/**
 * Centralized applyUpdate: locks activation, saves history, and reloads WebView.
 */
export function applyUpdate(trigger?: string): Promise<void> {
  if (activeApplyPromise) return activeApplyPromise;

  const { remoteVersion } = globalOtaState;
  if (!remoteVersion) return Promise.resolve();

  if (trigger) {
    otaDebugLogs.triggerComponent = trigger;
    updateGlobalState({ triggerComponent: trigger });
  }

  activeApplyPromise = (async () => {
    if (!isNative()) {
      otaDebugLogs.finalPathExecuted = 'N/A';
      try {
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
      } catch (e) {
        console.warn('Failed to clear cache/sw before reload:', e);
      } finally {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('upd', Date.now().toString());
          window.location.href = url.toString();
        } catch {
          window.location.reload();
        }
      }
      return;
    }

    updateGlobalState({ updateState: 'installing' });
    localStorage.setItem('studio:appliedUpdateVersion', remoteVersion);
    addToStoredList('studio:installedVersions', remoteVersion);
    addToStoredList('studio:appliedVersions', remoteVersion);
    logActivity('apk_install', `Installing APK system update (v${remoteVersion})`, 'Studio');
    try {
      const filePath = localStorage.getItem('studio:downloadedApkPath');
      if (!filePath) {
        throw new Error('No downloaded APK path found.');
      }

      const { AppInstaller, checkApkEligibility } = await import('./apkDownloader');
      otaDebugLogs.installError = (otaDebugLogs.installError || '') + `\nChecking APK eligibility for: ${filePath}`;
      updateGlobalState({ statusText: 'Verifying update eligibility' });

      const isEligible = await runEligibilityCheck(filePath);
      if (!isEligible) {
        throw new Error('Eligibility validation failed: ' + (otaDebugLogs.eligibilityReason || 'unknown'));
      }

      otaDebugLogs.installError += `\nAPK is eligible. Launching APK installer intent for file: ${filePath}`;
      updateGlobalState({ statusText: 'Launching APK installer' });

      await AppInstaller.installApk({ filePath });
      
      otaDebugLogs.installError += `\nAPK installer intent launched successfully!`;
      otaDebugLogs.installerLaunchStatus = 'SUCCESS';
      otaDebugLogs.lastExceptionStackTrace = 'None';
      otaDebugLogs.finalPathExecuted = 'APK installer launched';
      updateGlobalState({ 
        updateState: 'idle', 
        updateAvailable: false,
        statusText: 'APK installer launched',
        finalPathExecuted: 'APK installer launched'
      });
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
  downloadUpdate: (trigger?: string) => Promise<void>;
  applyUpdate: (trigger?: string) => Promise<void>;
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

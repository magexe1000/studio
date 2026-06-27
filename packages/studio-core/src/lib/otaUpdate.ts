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
  magicHeaderCheck: string | null;
  downloadSourcesConfigured: string | null;
  currentDownloadSource: string | null;
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
  magicHeaderCheck: null,
  downloadSourcesConfigured: null,
  currentDownloadSource: null,
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
  architecture?: string | null;
  deviceLocale?: string | null;
  storageAvailable?: string | null;
  networkState?: string | null;
  statusCode?: number | null;
  statusText?: string | null;
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
  architecture: null,
  deviceLocale: null,
  storageAvailable: null,
  networkState: null,
  statusCode: null,
  statusText: null,
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
        
        otaDiagnostics.architecture = deviceInfo.architecture || 'N/A';
        otaDiagnostics.deviceLocale = deviceInfo.deviceLocale || 'N/A';
        otaDiagnostics.storageAvailable = deviceInfo.storageAvailable || 'N/A';
        otaDiagnostics.networkState = deviceInfo.networkState || 'N/A';
      } catch (e) {
        console.warn('[OTA] Failed to get native device info for diagnostics:', e);
        permissionState = 'Error querying permission';
      }
    }

    const apkPath = otaDebugLogs.downloadedApkPath || localStorage.getItem('studio:downloadedApkPath') || 'N/A';
    let fileSize = 'N/A';
    let magicHeader = 'N/A';

    if (isNative() && apkPath && apkPath !== 'N/A') {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        const info = await Filesystem.stat({ path: apkPath });
        fileSize = `${(info.size / (1024 * 1024)).toFixed(2)} MB (${info.size} bytes)`;

        // Read magic header (first 4 bytes)
        try {
          const { AppInstaller } = await import('./apkDownloader');
          const firstBytes = await AppInstaller.readFirstBytes({ filePath: apkPath, count: 4 });
          const matchesPK = firstBytes.hex.toLowerCase().startsWith('504b');
          magicHeader = `Hex: ${firstBytes.hex}, ASCII: ${firstBytes.ascii} (Matches PK/ZIP: ${matchesPK})`;
          otaDebugLogs.magicHeaderCheck = magicHeader;
        } catch (hErr) {
          console.warn('[OTA] Failed to read magic bytes:', hErr);
          magicHeader = `Failed to read: ${hErr instanceof Error ? hErr.message : String(hErr)}`;
          otaDebugLogs.magicHeaderCheck = magicHeader;
        }

        // Run eligibility check to populate downloaded/installed details if not already done
        if (!otaDebugLogs.downloadedPackageName) {
          const { checkApkEligibility } = await import('./apkDownloader');
          const el = await checkApkEligibility(apkPath);
          
          otaDebugLogs.installedPackageName = el.installed?.packageName ?? null;
          otaDebugLogs.installedVersionName = el.installed?.versionName ?? null;
          otaDebugLogs.installedVersionCode = el.installed?.versionCode ?? null;
          otaDebugLogs.installedSigningSha256 = el.installed?.signingSha256 ?? null;
          otaDebugLogs.installedDebuggable = el.installed?.debuggable ?? null;

          otaDebugLogs.downloadedPackageName = el.downloaded?.packageName ?? null;
          otaDebugLogs.downloadedVersionName = el.downloaded?.versionName ?? null;
          otaDebugLogs.downloadedVersionCode = el.downloaded?.versionCode ?? null;
          otaDebugLogs.downloadedSigningSha256 = el.downloaded?.signingSha256 ?? null;
          otaDebugLogs.downloadedDebuggable = el.downloaded?.debuggable ?? null;
          otaDebugLogs.downloadedApkPath = apkPath;
          otaDebugLogs.downloadedIsValidApk = el.downloaded?.isValidApk ?? null;
          otaDebugLogs.downloadedIsUniversalApk = el.downloaded?.isUniversalApk ?? null;
          
          if (el.installed && el.downloaded) {
            otaDebugLogs.eligibilityPackageNameMatch = el.installed.packageName === el.downloaded.packageName;
            otaDebugLogs.eligibilitySigningMatch = el.installed.signingSha256.replace(/:/g, '').toLowerCase() === el.downloaded.signingSha256.replace(/:/g, '').toLowerCase();
            otaDebugLogs.eligibilityVersionCodeHigher = el.downloaded.versionCode > el.installed.versionCode;
            otaDebugLogs.eligibilityReleaseBuild = el.downloaded.debuggable === false;
            otaDebugLogs.eligibilityValidApk = el.downloaded.isValidApk === true;
          }
          otaDebugLogs.eligibilityFinalInstall = el.eligible ? 'can install' : 'cannot install';
          otaDebugLogs.eligibilityReason = el.reason ?? null;
        }
      } catch (fErr) {
        console.warn('[OTA] Failed to query file details:', fErr);
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
  | 'waiting_for_user'
  | 'downloading'
  | 'verifying'
  | 'ready_to_install'
  | 'installing'
  | 'installed'
  | 'completed'
  | 'failed'
  | 'manual_apk_required'
  | 'signature_mismatch'
  | 'versionCode_low'
  | 'reinstall_warning'
  | 'preparing'
  | 'enteringProgressScreen'
  | 'downloading_ota'
  | 'downloading_apk'
  | 'verifying_apk'
  | 'readyForInstallPrompt'
  | 'waitingForUserInstallConfirmation'
  | 'installedOrReady';

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
  consecutiveFailures: number;
  activeFallback: string | null;
  recoveryMode: boolean;
  diagnosticsReport: string | null;
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
  consecutiveFailures: 0,
  activeFallback: null,
  recoveryMode: false,
  diagnosticsReport: null,
};

const stateListeners = new Set<(state: CentralizedOtaState) => void>();

const VALID_TRANSITIONS: Record<OtaUpdateState, OtaUpdateState[]> = {
  idle: ['checking', 'preparing'],
  checking: ['available', 'idle', 'failed', 'manual_apk_required'],
  available: ['waiting_for_user', 'failed', 'idle'],
  waiting_for_user: ['downloading', 'failed', 'idle', 'preparing'],
  downloading: ['verifying', 'failed', 'idle'],
  verifying: ['ready_to_install', 'failed', 'signature_mismatch', 'versionCode_low', 'reinstall_warning', 'idle'],
  ready_to_install: ['installing', 'failed', 'idle'],
  installing: ['installed', 'failed', 'idle'],
  installed: ['completed', 'failed', 'idle'],
  completed: ['idle'],
  
  failed: ['checking', 'idle'],
  manual_apk_required: ['checking', 'idle'],
  signature_mismatch: ['checking', 'idle'],
  versionCode_low: ['checking', 'idle'],
  reinstall_warning: ['checking', 'idle'],

  preparing: ['checking', 'idle', 'downloading_ota', 'downloading_apk', 'failed', 'enteringProgressScreen'],
  enteringProgressScreen: ['downloading_ota', 'downloading_apk', 'failed', 'idle'],
  downloading_ota: ['verifying_apk', 'ready_to_install', 'failed', 'idle'],
  downloading_apk: ['verifying_apk', 'ready_to_install', 'failed', 'idle'],
  verifying_apk: ['ready_to_install', 'failed', 'idle'],
  readyForInstallPrompt: ['waitingForUserInstallConfirmation', 'installing', 'failed', 'idle', 'installedOrReady'],
  waitingForUserInstallConfirmation: ['installing', 'failed', 'idle'],
  installedOrReady: ['completed', 'failed', 'idle'],
};

let stalledTimer: ReturnType<typeof setTimeout> | null = null;

function manageStalledTimer(nextState: OtaUpdateState, progress: number) {
  if (stalledTimer) {
    clearTimeout(stalledTimer);
    stalledTimer = null;
  }

  const transientStates: OtaUpdateState[] = ['checking', 'downloading', 'verifying', 'installing'];
  if (transientStates.includes(nextState)) {
    let timeoutMs = 15000; // 15s default
    if (nextState === 'downloading') {
      timeoutMs = 20000; // 20s
    } else if (nextState === 'installing') {
      timeoutMs = 60000; // 60s
    }

    const lastProgress = progress;
    stalledTimer = setTimeout(async () => {
      // If we are downloading and progress has advanced, do not count as stalled
      if (nextState === 'downloading' && globalOtaState.progress > lastProgress) {
        // Re-schedule the timer since progress is active
        manageStalledTimer(nextState, globalOtaState.progress);
        return;
      }

      console.warn(`[OTA STALL DETECT] Update stalled in state "${nextState}".`);
      void logProgressStage('[OTA STALL DETECT]', `Stall detected in state ${nextState} (Timeout: ${timeoutMs}ms). Triggering auto-recovery.`);

      const currentFailures = Number(localStorage.getItem('studio:consecutiveInstallFailures') || 0) + 1;
      localStorage.setItem('studio:consecutiveInstallFailures', String(currentFailures));
      updateGlobalState({ consecutiveFailures: currentFailures });

      let errorMsg = 'Operation timed out.';
      if (nextState === 'checking') {
        errorMsg = 'Connection timed out while checking for updates. Release server is unreachable.';
      } else if (nextState === 'downloading') {
        errorMsg = 'Download stalled. Mirror connection was dropped or timed out.';
      } else if (nextState === 'verifying') {
        errorMsg = 'Verification timed out. Check filesystem permissions or try manual download.';
      } else if (nextState === 'installing') {
        errorMsg = 'Installation timed out. Android PackageInstaller failed to commit session.';
      }

      const recovery = currentFailures >= 3;
      // Trigger transition to failed
      transitionToState('failed', `Stalled timer expired in state ${nextState}`);
      updateGlobalState({
        error: errorMsg,
        loading: false,
        recoveryMode: recovery
      });
    }, timeoutMs);
  }
}

let transitionIdCounter = 0;
let executionId = Math.random().toString(36).substring(2, 10);

export function transitionToState(nextState: OtaUpdateState, reason: string): boolean {
  const currentState = globalOtaState.updateState;
  if (currentState === nextState) {
    return true; // No-op, allow redundant state sets without violation
  }

  const allowed = VALID_TRANSITIONS[currentState] || [];
  const isValid = allowed.includes(nextState);

  const transitionId = ++transitionIdCounter;
  const stack = new Error().stack || '';
  const callerLine = stack.split('\n')[2] || 'unknown';

  console.log(
    `[STATE_TRANSITION] ID: ${transitionId} | ExecID: ${executionId} | ` +
    `Current: ${currentState} -> Next: ${nextState} | ` +
    `Caller: ${callerLine.trim()} | Reason: ${reason} | Timestamp: ${Date.now()}`
  );

  if (!isValid) {
    console.error(
      `[STATE_TRANSITION_VIOLATION] Blocked invalid transition: ` +
      `${currentState} -> ${nextState}. Reason: ${reason}. Caller: ${callerLine.trim()}`
    );
    void logProgressStage(
      'State transition violation',
      `Blocked transition: ${currentState} -> ${nextState}. Reason: ${reason}. Caller: ${callerLine.trim()}`
    );
    return false;
  }

  // Update state variable bypass
  globalOtaState = { ...globalOtaState, updateState: nextState };
  
  // Manage stalled timer for transient states
  manageStalledTimer(nextState, globalOtaState.progress);

  // Notify listeners
  stateListeners.forEach((l) => l(globalOtaState));
  return true;
}

function updateGlobalState(updates: Partial<CentralizedOtaState>) {
  if ('updateState' in updates && updates.updateState !== globalOtaState.updateState) {
    console.warn(`[WARNING] Direct updateState change attempted in updateGlobalState: ${updates.updateState}. Use transitionToState instead.`);
    // Omit updateState from direct mutations to enforce transitionToState
    const { updateState, ...rest } = updates;
    globalOtaState = { ...globalOtaState, ...rest };
  } else {
    globalOtaState = { ...globalOtaState, ...updates };
  }
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
    consecutiveFailures: 0,
    activeFallback: null,
    recoveryMode: false,
    diagnosticsReport: null,
  });
}

export async function logProgressStage(stage: string, message?: string, exceptionStack?: string) {
  if (isNative() && isAppInstallerAvailable()) {
    try {
      const { AppInstaller } = await import('./apkDownloader');
      await AppInstaller.appendLog({
        stage,
        status: 0,
        message: message || '',
        exceptionStack: exceptionStack || '',
        packageName: globalOtaState.packageName || 'com.chordex.app'
      });
    } catch (e) {
      console.warn('[OTA] Failed to write progress stage log:', e);
    }
  }
}

// Instrumentation counters
export let checkForUpdateCallCount = 0;
export let downloadUpdateCallCount = 0;
export let applyUpdateCallCount = 0;
export let eligibilityCheckCallCount = 0;
export let shaVerifyCallCount = 0;

let checkCallIdCounter = 0;
export function nextJsCallId(): number {
  return ++checkCallIdCounter;
}

let activeCheckPromise: Promise<CentralizedOtaState> | null = null;
let activeDownloadPromise: Promise<void> | null = null;
let activeApplyPromise: Promise<void> | null = null;

let lastCheckedTime = 0;
const MIN_AUTO_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes rate limit for auto updates

/**
 * Centralized checkForUpdate: racing fetches in parallel, resolving
 * immediately, checking seen/dismissed locks, and locking concurrent requests.
 */
export function checkForUpdate(isManual = false): Promise<CentralizedOtaState> {
  checkForUpdateCallCount++;
  const callId = nextJsCallId();
  const callerError = new Error();
  const stack = callerError.stack || 'No stack trace';
  
  // Try to find the exact React component or event handler from the stack trace
  const callerLine = stack.split('\n')[2] || 'unknown';
  
  console.log(`[INSTRUMENTATION] checkForUpdate ENTER Call #${callId} (isManual=${isManual}, total calls: ${checkForUpdateCallCount}) Caller: ${callerLine}`);
  void logProgressStage('[INSTRUMENTATION] checkForUpdate ENTER', `Call #${callId} isManual=${isManual} caller=${callerLine}`);

  // 1. Synchronously return if check is already running
  if (activeCheckPromise) {
    console.log(`[INSTRUMENTATION] checkForUpdate EXIT Call #${callId} (Early return: activeCheckPromise is running)`);
    void logProgressStage('[INSTRUMENTATION] checkForUpdate EXIT', `Call #${callId} early exit (activeCheckPromise running)`);
    return activeCheckPromise;
  }

  // Rate limit non-manual auto updates to avoid infinite loops on focus changes, etc.
  if (!isManual) {
    const now = Date.now();
    if (now - lastCheckedTime < MIN_AUTO_CHECK_INTERVAL_MS) {
      console.log(`[INSTRUMENTATION] checkForUpdate EXIT Call #${callId} (Early return: rate limited)`);
      void logProgressStage('[INSTRUMENTATION] checkForUpdate EXIT', `Call #${callId} early exit (rate limited)`);
      return Promise.resolve(globalOtaState);
    }
  }

  // 2. Synchronous early return if check is unnecessary
  const cannotCheck = globalOtaState.updateState === 'preparing' ||
      globalOtaState.updateState === 'enteringProgressScreen' ||
      globalOtaState.updateState === 'downloading' ||
      globalOtaState.updateState === 'verifying' ||
      globalOtaState.updateState === 'installing' ||
      globalOtaState.updateState === 'downloading_ota' || 
      globalOtaState.updateState === 'downloading_apk' || 
      globalOtaState.updateState === 'verifying_apk';
  
  if (cannotCheck || (!isManual && (
      globalOtaState.updateState === 'readyForInstallPrompt' ||
      globalOtaState.updateState === 'waitingForUserInstallConfirmation' ||
      globalOtaState.updateState === 'installedOrReady' ||
      globalOtaState.updateState === 'ready_to_install' || 
      globalOtaState.updateState === 'completed'))) {
    console.log(`[INSTRUMENTATION] checkForUpdate EXIT Call #${callId} (Early return: already in state "${globalOtaState.updateState}")`);
    void logProgressStage('[INSTRUMENTATION] checkForUpdate EXIT', `Call #${callId} early exit (state is ${globalOtaState.updateState})`);
    return Promise.resolve(globalOtaState);
  }

  // 3. Clear session storage locks on manual checks so the modal always auto-opens
  if (isManual) {
    removeSessionItem('studio:laterUpdateVersion');
    removeSessionItem('studio:autoOpenedUpdateVersion');
    localStorage.removeItem('studio:consecutiveInstallFailures');
    updateGlobalState({
      consecutiveFailures: 0,
      recoveryMode: false,
      error: null,
      progress: 0,
      updateState: 'checking',
      loading: true,
    });
  }

  activeCheckPromise = (async () => {
    // Check last native install result
    if (isNative() && isAppInstallerAvailable()) {
      try {
        const { AppInstaller } = await import('./apkDownloader');
        const result = await AppInstaller.getLastInstallResult();
        console.log('[OTA DEBUG] Last install result status:', result);
        
        if (result && result.statusCode !== -999 && result.statusCode !== 0) {
          let errMsg = result.statusMessage || `PackageInstaller error: status ${result.statusCode}`;
          let category: 'signature_mismatch' | 'versionCode_low' | 'cancelled' | 'failed' = 'failed';
          
          if (result.statusCode === 3) {
            category = 'cancelled';
            errMsg = 'User cancelled the installation';
          } else if (result.statusCode === 5) {
            category = 'signature_mismatch';
            errMsg = 'Signature mismatch or conflicting package name. Uninstalling the old app and installing the new one might be required.';
          } else if (result.statusCode === 7) {
            category = 'versionCode_low';
            errMsg = 'Version downgrade is not allowed by the system.';
          }

          // Populate diagnostics
          otaDiagnostics.statusCode = result.statusCode;
          otaDiagnostics.statusText = errMsg;
          otaDiagnostics.exceptionMessage = errMsg;
          otaDiagnostics.failureReason = `PackageInstaller code ${result.statusCode}\nMessage: ${result.statusMessage}\nPackage: ${result.packageName}`;
          otaDiagnostics.installerResult = `Code: ${result.statusCode}\nMessage: ${result.statusMessage}\nPackage: ${result.packageName}\nTimestamp: ${new Date(result.timestamp).toISOString()}`;
          otaDiagnostics.timestamp = new Date(result.timestamp).toISOString();

          // Populate rest of device diagnostics
          await populateDiagnostics(null, 'PackageInstaller failure detected');

          // Store diagnostics and update state
          if (category === 'signature_mismatch') {
            transitionToState('signature_mismatch', 'Last install result: signature_mismatch');
            updateGlobalState({ error: errMsg, loading: false });
          } else if (category === 'versionCode_low') {
            transitionToState('versionCode_low', 'Last install result: versionCode_low');
            updateGlobalState({ error: errMsg, loading: false });
          } else if (category === 'cancelled') {
            transitionToState('available', 'Last install result: cancelled');
            updateGlobalState({ loading: false });
          } else {
            transitionToState('failed', 'Last install result: failed');
            updateGlobalState({ error: errMsg, loading: false });
          }
          
          // Clear last result so we don't repeat the error notification
          await AppInstaller.clearInstallerLogHistory();
          
          activeCheckPromise = null;
          return globalOtaState;
        }
      } catch (diagErr) {
        console.warn('[OTA] Failed to check last install result:', diagErr);
      }
    }

    transitionToState('checking', 'checkForUpdate start');
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
        otaDebugLogs.currentOtaVersion = 'disabled';

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

      if (globalOtaState.updateState !== 'checking') {
        console.log(`[INSTRUMENTATION] checkForUpdate ABORT: State transitioned to "${globalOtaState.updateState}" during check.`);
        activeCheckPromise = null;
        return globalOtaState;
      }

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
      let installedVersionName = '';
      let installedSignature = '';
      if (isNative()) {
        try {
          const { AppInstaller } = await import('./apkDownloader');
          const installedDetails = await AppInstaller.getInstalledAppDetails();
          installedVersionCode = installedDetails.versionCode;
          installedVersionName = installedDetails.versionName;
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

      const localCompareVersion = (isNativePlat && installedVersionName) ? installedVersionName : APP_VERSION;

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
          const sCmp = compareSemver(remote.version, localCompareVersion);
          versionComparisonResult = sCmp > 0 ? 'remote_version_higher' : (sCmp < 0 ? 'remote_version_lower' : 'same_version');
        }
      } else {
        const sCmp = compareSemver(remote.version, APP_VERSION);
        versionComparisonResult = sCmp > 0 ? 'remote_version_higher' : (sCmp < 0 ? 'remote_version_lower' : 'same_version');
      }

      const isUpgrade = isNativePlat
        ? (targetVersionCode && installedVersionCode > 0
            ? targetVersionCode > installedVersionCode
            : compareSemver(remote.version, localCompareVersion) > 0)
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

      if (globalOtaState.updateState !== 'checking') {
        console.log(`[INSTRUMENTATION] checkForUpdate ABORT: State transitioned to "${globalOtaState.updateState}" during check.`);
        activeCheckPromise = null;
        return globalOtaState;
      }

      if (updateType === 'none') {
        console.log('[OTA DEBUG] Skip: updateType evaluated to "none" because remote.version <= APP_VERSION and no APK update required.', {
          remoteVersion: remote.version,
          updateType
        });
        otaDebugLogs.finalDecision = `Skip: updateType is 'none' (remote.version=${remote.version} <= APP_VERSION=${APP_VERSION})`;
        if (isNative() && isAppInstallerAvailable()) {
          try {
            const { AppInstaller } = await import('./apkDownloader');
            await AppInstaller.clearInstallerLogHistory();
          } catch (_) {}
        }
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

      if (globalOtaState.updateState !== 'checking') {
        console.log(`[INSTRUMENTATION] checkForUpdate ABORT: State transitioned to "${globalOtaState.updateState}" during check.`);
        activeCheckPromise = null;
        return globalOtaState;
      }

      if (shouldSkip) {
        console.log('[OTA DEBUG] Skip: No upgrade required.', {
          version: remote.version,
          isUpgrade
        });
        otaDebugLogs.finalDecision = `Skip: No upgrade required (isUpgrade=false)`;
        if (isNative() && isAppInstallerAvailable()) {
          try {
            const { AppInstaller } = await import('./apkDownloader');
            await AppInstaller.clearInstallerLogHistory();
          } catch (_) {}
        }
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

      // Check for interrupted installation
      if (isNative() && isAppInstallerAvailable()) {
        try {
          const { AppInstaller } = await import('./apkDownloader');
          const result = await AppInstaller.getLastInstallResult();
          if (result && result.statusCode === -1) {
            const lang = useChordStore.getState().settings.language || 'en';
            const confirmMsg = lang === 'es'
              ? `Se detectó una instalación interrumpida de la versión ${remote.version}. ¿Deseas reanudar la instalación?`
              : `An interrupted installation of version ${remote.version} was detected. Do you want to resume the installation?`;
            const resume = typeof window !== 'undefined' && window.confirm(confirmMsg);
            if (resume) {
              updateGlobalState({
                updateState: 'waitingForUserInstallConfirmation',
                remoteVersion: remote.version,
                changelog: remote.changelog ?? null,
                mandatory: remote.mandatory === true,
                updateType,
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
                reinstallRequired: remote.reinstallRequired || remote.installMode === 'reinstall-required',
                signatureChanged: remote.signatureChanged === true,
                previousSignatureSha256: remote.previousSignatureSha256 ?? null,
                newSignatureSha256: remote.newSignatureSha256 ?? null,
                installMode: remote.installMode ?? null,
                packageName: remote.packageName ?? null,
              });
              activeCheckPromise = null;
              void applyUpdate('Interrupted Resume');
              return globalOtaState;
            } else {
              console.log('[OTA DEBUG] User discarded interrupted installation. Clearing status.');
              await AppInstaller.clearInstallerLogHistory();
              try {
                const downloadedPath = localStorage.getItem('studio:downloadedApkPath');
                if (downloadedPath) {
                  const { Filesystem } = await import('@capacitor/filesystem');
                  await Filesystem.deleteFile({
                    path: downloadedPath
                  });
                  localStorage.removeItem('studio:downloadedApkPath');
                }
              } catch (_) {}
            }
          }
        } catch (err) {
          console.warn('[OTA] Failed to check last install result during upgrade check:', err);
        }
      }

      let clientReinstallRequired = false;
      if (remote.reinstallRequired || remote.installMode === 'reinstall-required') {
        const cleanNewSig = (remote.newSignatureSha256 || '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206').replace(/:/g, '').toLowerCase().trim();
        if (isNative() && installedSignature && installedSignature !== cleanNewSig) {
          clientReinstallRequired = true;
        }
      }

      if (globalOtaState.updateState !== 'checking') {
        console.log(`[INSTRUMENTATION] checkForUpdate ABORT: State transitioned to "${globalOtaState.updateState}" during check.`);
        activeCheckPromise = null;
        return globalOtaState;
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

      void logProgressStage('Update detected', 'Version: ' + remote.version + ' (code ' + (remote.versionCode ?? '') + ')');

      // System notification if never seen and not already dismissed
      if (!notifiedList.includes(remote.version) && !isDismissed) {
        addToStoredList('studio:notifiedVersions', remote.version);
        await notifyOtaAvailable(remote.version);
      }
      
      console.log(`[INSTRUMENTATION] checkForUpdate EXIT Call #${callId} resolvedState=${globalOtaState.updateState}`);
      void logProgressStage('[INSTRUMENTATION] checkForUpdate EXIT', `Call #${callId} resolvedState=${globalOtaState.updateState}`);
      return globalOtaState;
    } catch (err) {
      console.error(`[INSTRUMENTATION] checkForUpdate EXIT Call #${callId} error:`, err);
      void logProgressStage('[INSTRUMENTATION] checkForUpdate EXIT', `Call #${callId} failed err=${err instanceof Error ? err.message : String(err)}`);
      console.warn('[OTA] Check failed:', err);
      updateGlobalState({ updateState: 'failed', error: String(err), loading: false });
      return globalOtaState;
    } finally {
      activeCheckPromise = null;
      lastCheckedTime = Date.now();
    }
  })();

  return activeCheckPromise;
}

export async function runEligibilityCheck(filePath: string, allowDowngrade?: boolean): Promise<boolean> {
  eligibilityCheckCallCount++;
  const callId = nextJsCallId();
  console.log(`[INSTRUMENTATION] runEligibilityCheck ENTER Call #${callId} (filePath=${filePath}, total calls: ${eligibilityCheckCallCount})`);
  void logProgressStage('[INSTRUMENTATION] runEligibilityCheck ENTER', `Call #${callId} filePath=${filePath}`);
  try {
    const { checkApkEligibility } = await import('./apkDownloader');
    const el = await checkApkEligibility(filePath, allowDowngrade);
    
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
      console.log(`[INSTRUMENTATION] runEligibilityCheck EXIT Call #${callId} returns: false (reason: ${el.reason})`);
      void logProgressStage('[INSTRUMENTATION] runEligibilityCheck EXIT', `Call #${callId} returns=false reason=${el.reason}`);
      return false;
    }
    
    console.log(`[INSTRUMENTATION] runEligibilityCheck EXIT Call #${callId} returns: true`);
    void logProgressStage('[INSTRUMENTATION] runEligibilityCheck EXIT', `Call #${callId} returns=true`);
    return true;
  } catch (err) {
    console.error(`[INSTRUMENTATION] runEligibilityCheck EXIT Call #${callId} error:`, err);
    void logProgressStage('[INSTRUMENTATION] runEligibilityCheck EXIT', `Call #${callId} failed err=${err instanceof Error ? err.message : String(err)}`);
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
export function downloadUpdate(trigger?: string, isDowngrade?: boolean): Promise<void> {
  downloadUpdateCallCount++;
  const callId = nextJsCallId();
  console.log(`[INSTRUMENTATION] downloadUpdate ENTER Call #${callId} (trigger=${trigger}, total calls: ${downloadUpdateCallCount})`);
  void logProgressStage('[INSTRUMENTATION] downloadUpdate ENTER', `Call #${callId} trigger=${trigger}`);

  if (activeDownloadPromise) {
    console.log(`[INSTRUMENTATION] downloadUpdate EXIT Call #${callId} (Early return: activeDownloadPromise is running)`);
    void logProgressStage('[INSTRUMENTATION] downloadUpdate EXIT', `Call #${callId} early exit (activeDownloadPromise running)`);
    return activeDownloadPromise;
  }

  if (trigger) {
    otaDebugLogs.triggerComponent = trigger;
    updateGlobalState({ triggerComponent: trigger });
  }

  const { apkUrl, remoteVersion } = globalOtaState;
  const ver = remoteVersion || '';

  if (!isDowngrade && (globalOtaState.updateState === 'readyForInstallPrompt' || globalOtaState.updateState === 'installedOrReady')) {
    const downloadedPath = localStorage.getItem('studio:downloadedApkPath');
    if (downloadedPath) {
      console.log(`[INSTRUMENTATION] downloadUpdate EXIT Call #${callId} (Resolved: cached APK exists)`);
      void logProgressStage('[INSTRUMENTATION] downloadUpdate EXIT', `Call #${callId} resolved (cached APK exists)`);
      return Promise.resolve();
    }
  }

  if (isNative()) {
    if (!isAppInstallerAvailable()) {
      otaDebugLogs.finalDecision = 'Manual update required (AppInstaller missing)';
      otaDebugLogs.downloadStatus = 'Error: AppInstaller missing';
      updateGlobalState({ updateState: 'manual_apk_required' });
      console.log(`[INSTRUMENTATION] downloadUpdate EXIT Call #${callId} (Rejected: AppInstaller missing)`);
      void logProgressStage('[INSTRUMENTATION] downloadUpdate EXIT', `Call #${callId} rejected (AppInstaller missing)`);
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
    console.log(`[INSTRUMENTATION] downloadUpdate EXIT Call #${callId} (Resolved: web fallback)`);
    void logProgressStage('[INSTRUMENTATION] downloadUpdate EXIT', `Call #${callId} resolved (web fallback)`);
    return Promise.resolve();
  }

  if (!apkUrl) {
    otaDebugLogs.downloadStatus = 'Error: Missing APK URL';
    updateGlobalState({ updateState: 'failed', error: 'No APK download URL available' });
    console.log(`[INSTRUMENTATION] downloadUpdate EXIT Call #${callId} (Rejected: missing apkUrl)`);
    void logProgressStage('[INSTRUMENTATION] downloadUpdate EXIT', `Call #${callId} rejected (missing apkUrl)`);
    return Promise.reject(new Error('No APK download URL available'));
  }

  // Set initial preparation state immediately to trigger progress screens instantly
  transitionToState('downloading', 'downloadUpdate start');
  updateGlobalState({ progress: 0, statusText: 'Preparing update...', error: null });

  activeDownloadPromise = (async () => {
    // Clear stale path for different versions before starting the download
    const downloadedPath = localStorage.getItem('studio:downloadedApkPath');
    if (downloadedPath && !downloadedPath.includes(`studio-update-${ver}.apk`)) {
      localStorage.removeItem('studio:downloadedApkPath');
    }
    
    otaDebugLogs.downloadStatus = `Update started: apk\nAPK URL: ${apkUrl}`;
    updateGlobalState({ progress: 0.0, statusText: 'Entering progress screen...' });
    
    try {
      const { downloadApk } = await import('./apkDownloader');
      const fileName = `studio-update-${ver}.apk`;
      
      const sources = [
        apkUrl,
        globalOtaState.manualApkUrl,
        globalOtaState.fallbackApkUrl
      ].filter(Boolean) as string[];
      
      const uniqueSources = Array.from(new Set(sources));
      let downloadSuccess = false;
      let lastDownloadError: Error | null = null;
      let filePath = '';
      
      otaDebugLogs.downloadSourcesConfigured = uniqueSources.join(' | ');
      
      for (let sIdx = 0; sIdx < uniqueSources.length; sIdx++) {
        const sourceUrl = uniqueSources[sIdx];
        otaDebugLogs.currentDownloadSource = sourceUrl;
        otaDebugLogs.downloadStatus += `\nTrying Source [${sIdx + 1}/${uniqueSources.length}]: ${sourceUrl}`;
        
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            console.log(`[OTA] Trying download from ${sourceUrl} (Attempt ${retryCount + 1}/${maxRetries})`);
            void logProgressStage('Download started', `Source: ${sourceUrl} (Attempt ${retryCount + 1})`);
            
            filePath = await downloadApk(sourceUrl, fileName, (percent) => {
              updateGlobalState({ 
                progress: Math.max(0, Math.min(1, percent / 100)),
                statusText: `Downloading update (${Math.round(percent)}%)`
              });
            });
            
            downloadSuccess = true;
            break;
          } catch (err: any) {
            retryCount++;
            lastDownloadError = err instanceof Error ? err : new Error(String(err));
            const delay = Math.pow(2, retryCount) * 1000;
            console.warn(`[OTA] Download attempt ${retryCount} failed. Retrying in ${delay}ms...`, err);
            updateGlobalState({ statusText: `Retry ${retryCount}/${maxRetries} in ${delay / 1000}s...` });
            await new Promise(r => setTimeout(r, delay));
          }
        }
        
        if (downloadSuccess) {
          break;
        }
      }
      
      if (!downloadSuccess) {
        throw lastDownloadError || new Error('All download sources failed.');
      }
      
      otaDebugLogs.downloadStatus += `\nAPK download completed. Path: ${filePath}`;
      void logProgressStage('Download completed', 'Path: ' + filePath);

      // Compute/Verify SHA-256 if expected hash is available
      const expectedHash = globalOtaState.apkSha256;
      if (expectedHash) {
        otaDebugLogs.downloadStatus += `\nStarting SHA verification (Expected: ${expectedHash})...`;
        transitionToState('verifying', 'Starting SHA verification');
        updateGlobalState({ statusText: 'Verifying package' });
        const { verifyApkSha256 } = await import('./apkDownloader');
        const isValid = await verifyApkSha256(filePath, expectedHash);
        void logProgressStage('SHA verified', isValid ? 'SHA validation successful' : 'SHA validation failed');
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

      updateGlobalState({ progress: 1.0, statusText: 'Verifying update' });
      await new Promise((resolve) => setTimeout(resolve, 300));

      otaDebugLogs.downloadStatus += `\nRunning pre-install eligibility check...`;
      transitionToState('verifying', 'Checking eligibility');
      updateGlobalState({ statusText: 'Checking eligibility...' });
      const isEligible = await runEligibilityCheck(filePath, isDowngrade);
      if (!isEligible) {
        throw new Error('Eligibility validation failed: ' + (otaDebugLogs.eligibilityReason || 'unknown'));
      }
      void logProgressStage('Eligibility check passed', 'APK is eligible for installation');
      void logProgressStage('Installer prepared', 'Installer prepared and files verified');

      transitionToState('ready_to_install', 'APK download & verify complete');
      updateGlobalState({ statusText: 'Ready to install' });
      localStorage.setItem('studio:downloadedApkPath', filePath);
      localStorage.removeItem('studio:downloadedBundleId');
      addToStoredList('studio:downloadedVersions', ver);

      console.log(`[INSTRUMENTATION] downloadUpdate EXIT Call #${callId} Resolved successfully (Paused at ready_to_install, waiting for user click)`);
      void logProgressStage('[INSTRUMENTATION] downloadUpdate EXIT', `Call #${callId} resolved (Paused at ready_to_install, waiting for user click)`);

    } catch (err) {
      console.error(`[INSTRUMENTATION] downloadUpdate EXIT Call #${callId} error:`, err);
      void logProgressStage('[INSTRUMENTATION] downloadUpdate EXIT', `Call #${callId} failed err=${err instanceof Error ? err.message : String(err)}`);
      console.error('[OTA] APK download failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = (err instanceof Error && err.stack ? err.stack : null);
      otaDebugLogs.installError = `Download/Verify Exception: ${errMsg}\nStack: ${errStack || ''}`;
      otaDebugLogs.lastExceptionStackTrace = errStack;
      otaDebugLogs.installerLaunchStatus = 'FAILED';
      await populateDiagnostics(err, 'APK download or verification failed');
      transitionToState('failed', 'Download/Verify exception');
      updateGlobalState({ 
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
  applyUpdateCallCount++;
  const callId = nextJsCallId();
  console.log(`[INSTRUMENTATION] applyUpdate ENTER Call #${callId} (trigger=${trigger}, total calls: ${applyUpdateCallCount})`);
  void logProgressStage('[INSTRUMENTATION] applyUpdate ENTER', `Call #${callId} trigger=${trigger}`);

  if (activeApplyPromise) {
    console.log(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} (Early return: activeApplyPromise is running)`);
    void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} early exit (activeApplyPromise running)`);
    return activeApplyPromise;
  }

  const { remoteVersion } = globalOtaState;
  if (!remoteVersion) {
    console.log(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} (Resolved: missing remoteVersion)`);
    void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} resolved (missing remoteVersion)`);
    return Promise.resolve();
  }

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
      console.log(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} (Resolved: web reload completed)`);
      void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} resolved (web reload completed)`);
      return;
    }

    transitionToState('installing', 'applyUpdate start');
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

      void logProgressStage('Session committed', 'Handing over to PackageInstaller');
      await AppInstaller.installApk({ filePath });
      void logProgressStage('Waiting for Android confirmation', 'Waiting for system confirmation dialog to overlay');
      
      otaDebugLogs.installError += `\nAPK installer intent launched successfully!`;
      otaDebugLogs.installerLaunchStatus = 'SUCCESS';
      otaDebugLogs.lastExceptionStackTrace = 'None';
      otaDebugLogs.finalPathExecuted = 'APK installer launched';
      transitionToState('installed', 'APK installer launched');
      updateGlobalState({ 
        updateAvailable: false,
        statusText: 'APK installer launched',
        finalPathExecuted: 'APK installer launched'
      });
      console.log(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} Resolved successfully (Installer intent launched)`);
      void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} resolved (Installer intent launched)`);
    } catch (err) {
      console.error(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} error:`, err);
      void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} failed err=${err instanceof Error ? err.message : String(err)}`);
      console.error('[OTA] APK install failed:', err);
      
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = (err instanceof Error && err.stack ? err.stack : null);
      otaDebugLogs.installError = (otaDebugLogs.installError || '') + `\nAPK Install Exception: ${errMsg}\nStack: ${errStack || ''}`;
      otaDebugLogs.installerLaunchStatus = 'FAILED';
      otaDebugLogs.lastExceptionStackTrace = errStack;
      await populateDiagnostics(err, 'APK installation failed');
      
      // Increment consecutive failures
      const currentFailures = Number(localStorage.getItem('studio:consecutiveInstallFailures') || 0) + 1;
      localStorage.setItem('studio:consecutiveInstallFailures', String(currentFailures));
      updateGlobalState({ consecutiveFailures: currentFailures });
      
      localStorage.removeItem('studio:appliedUpdateVersion');
      
      // Fallback: Enter Recovery Mode if consecutive failures are 3 or more
      const recovery = currentFailures >= 3;
      transitionToState('failed', `APK install failed. Failures: ${currentFailures}`);
      updateGlobalState({ 
        error: errMsg,
        statusText: 'Installation failed',
        recoveryMode: recovery,
        activeFallback: recovery ? 'Enter Recovery Mode' : null
      });
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
  transitionToState(nextState, 'dismissUpdate');
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
  checkNow: () => Promise<CentralizedOtaState>;
  downloadUpdate: (trigger?: string) => Promise<void>;
  applyUpdate: (trigger?: string) => Promise<void>;
  dismissUpdate: () => void;
  markUpdateSeen: () => void;
}

let otaListenerInitialized = false;

export function initializeOtaListener() {
  if (otaListenerInitialized) return;
  otaListenerInitialized = true;

  console.log('[OTA DEBUG] Centralized module-level OTA listeners initializing...');

  const runCheck = () => {
    // Check if autoCheck is enabled in preferences store
    const autoCheck = useChordStore.getState().settings.otaAutoCheck ?? true;
    if (!autoCheck) return;
    void checkForUpdate();
  };

  // 1. Initial check on load
  if (globalOtaState.updateState === 'idle') {
    void checkForUpdate();
  }

  // 2. Window/Document listeners
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

  // 3. Capacitor Native focus listener
  if (isNative()) {
    void (async () => {
      try {
        const { App } = await import('@capacitor/app');
        await App.addListener('appStateChange', (s) => {
          if (s.isActive) runCheck();
        });
      } catch {
        /* plugin unavailable */
      }
    })();
  }

  // 4. Periodic polling
  setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      runCheck();
    }
  }, FOREGROUND_POLL_MS);

  // Mirror installed version
  void nativeSet(NATIVE_PREFS.OTA_INSTALLED, APP_VERSION);
}

export function useOtaUpdate(): UseOtaUpdateResult {
  if (typeof window !== 'undefined') {
    initializeOtaListener();
  }

  const [state, setState] = useState<CentralizedOtaState>(globalOtaState);

  useEffect(() => {
    const listener = (newState: CentralizedOtaState) => {
      setState(newState);
    };
    stateListeners.add(listener);
    return () => {
      stateListeners.delete(listener);
    };
  }, []);

  const checkNow = async () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studio:open-update-dialog'));
    }
    return await checkForUpdate(true);
  };

  return {
    ...state,
    checkNow,
    downloadUpdate: async (trigger?: string) => {
      await downloadUpdate(trigger);
    },
    applyUpdate: async (trigger?: string) => {
      await applyUpdate(trigger);
    },
    dismissUpdate: () => {
      dismissUpdate();
    },
    markUpdateSeen: () => {
      markUpdateSeen();
    },
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
  if (normalizeSemver(last) === null) {
    writeLastSeen(APP_VERSION);
    return { justUpdated: false, from: null };
  }
  return {
    justUpdated: compareSemver(APP_VERSION, last) !== 0,
    from: last,
  };
}

export interface UpdateHistoryEntry {
  timestamp: number;
  fromVersion: string;
  toVersion: string;
  type: 'upgrade' | 'downgrade';
  trigger: 'user' | 'auto';
  status: 'success' | 'failed';
  error?: string;
}

export function getUpdateHistory(): UpdateHistoryEntry[] {
  try {
    const raw = localStorage.getItem('studio:updaterHistory');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function logUpdateTransition(
  fromVersion: string,
  toVersion: string,
  type: 'upgrade' | 'downgrade',
  trigger: 'user' | 'auto',
  status: 'success' | 'failed',
  error?: string
): void {
  try {
    const history = getUpdateHistory();
    // Prevent duplicate logs for the same transition within 5 seconds
    if (history.length > 0) {
      const lastEntry = history[0];
      if (
        lastEntry.fromVersion === fromVersion &&
        lastEntry.toVersion === toVersion &&
        lastEntry.status === status &&
        lastEntry.type === type &&
        Date.now() - lastEntry.timestamp < 5000
      ) {
        return;
      }
    }
    const entry: UpdateHistoryEntry = {
      timestamp: Date.now(),
      fromVersion,
      toVersion,
      type,
      trigger,
      status,
      error
    };
    history.unshift(entry);
    localStorage.setItem('studio:updaterHistory', JSON.stringify(history.slice(0, 50)));
  } catch (err) {
    console.warn('[OTA] Failed to write update history:', err);
  }
}

export async function triggerDowngrade(targetVersion: string, apkUrl: string, sha256: string): Promise<void> {
  logUpdateTransition(APP_VERSION, targetVersion, 'downgrade', 'user', 'failed', 'Initiated downgrade download');
  
  updateGlobalState({
    remoteVersion: targetVersion,
    apkUrl,
    apkSha256: sha256,
    updateType: 'apk',
    updateAvailable: false,
    updateState: 'preparing',
    progress: 0,
    error: null,
    statusText: 'Preparing downgrade...'
  });
  
  if (isNative()) {
    window.dispatchEvent(new CustomEvent('studio:open-update-dialog'));
  }
  
  try {
    await downloadUpdate('user_downgrade', true);
  } catch (err) {
    console.error('[Downgrade] Downgrade download failed:', err);
    logUpdateTransition(
      APP_VERSION,
      targetVersion,
      'downgrade',
      'user',
      'failed',
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
}

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
    if (justUpdated && from) {
      const cmp = compareSemver(APP_VERSION, from);
      if (cmp !== 0) {
        const type = cmp > 0 ? 'upgrade' : 'downgrade';
        logUpdateTransition(from, APP_VERSION, type, 'user', 'success');
        
        // Reset failures on update success
        localStorage.setItem('studio:consecutiveInstallFailures', '0');
        updateGlobalState({ consecutiveFailures: 0, recoveryMode: false, activeFallback: null });

        if (type === 'upgrade' && showChangelog) {
          setFromVersion(from);
          setShow(true);
        } else {
          writeLastSeen(APP_VERSION);
        }
      }
    } else if (from === null) {
      writeLastSeen(APP_VERSION);
    }
  }, [showChangelog]);

  const dismiss = () => {
    writeLastSeen(APP_VERSION);
    setShow(false);
  };

  return { show, fromVersion, toVersion: APP_VERSION, dismiss };
}

export async function applyUpdateDirect(): Promise<void> {
  const filePath = localStorage.getItem('studio:downloadedApkPath');
  if (!filePath) {
    throw new Error('No downloaded APK path found.');
  }
  const { openApkInstallerDirect } = await import('./apkDownloader');
  await openApkInstallerDirect(filePath);
}

export async function shareDownloadedApk(): Promise<void> {
  const filePath = localStorage.getItem('studio:downloadedApkPath');
  if (!filePath) {
    throw new Error('No downloaded APK found to share.');
  }
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({
      title: 'Studio Update APK',
      text: 'Here is the latest update APK for Studio.',
      url: filePath,
      dialogTitle: 'Share Studio Update'
    });
  } catch (err: any) {
    console.error('Failed to share APK:', err);
    throw err;
  }
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'unhealthy';
  metadataReachable: boolean;
  githubReachable: boolean;
  firebaseReachable: boolean;
  installerAvailable: boolean;
  packageInstallerAvailable: boolean;
  certificateValid: boolean;
  details: string[];
}

export async function runUpdaterHealthCheck(): Promise<HealthStatus> {
  const details: string[] = [];
  let metadataReachable = false;
  let githubReachable = false;
  let firebaseReachable = false;
  let installerAvailable = false;
  let packageInstallerAvailable = false;
  let certificateValid = false;

  try {
    const res = await fetch('https://studio-30f44.web.app/app-release.json', { method: 'HEAD', timeout: 5000 } as any);
    metadataReachable = res.ok;
    firebaseReachable = res.ok;
    details.push(res.ok ? 'Firebase metadata server reachable.' : `Firebase metadata unreachable (HTTP ${res.status}).`);
  } catch (err: any) {
    details.push(`Firebase metadata unreachable: ${err.message || String(err)}`);
  }

  try {
    const res = await fetch('https://api.github.com/repos/MAGEXE1000/Studio/releases', { method: 'HEAD', timeout: 5000 } as any);
    githubReachable = res.ok;
    details.push(res.ok ? 'GitHub API reachable.' : `GitHub API unreachable (HTTP ${res.status}).`);
  } catch (err: any) {
    details.push(`GitHub API unreachable: ${err.message || String(err)}`);
  }

  if (isNative()) {
    try {
      const { AppInstaller } = await import('./apkDownloader');
      installerAvailable = typeof AppInstaller.installApk === 'function';
      packageInstallerAvailable = true;
      details.push('AppInstaller native plugin loaded.');
      
      const appInfo = await AppInstaller.getInstalledAppInfo();
      const expectedFingerprint = '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206';
      const cleanFingerprint = appInfo.signingSha256.replace(/:/g, '').toLowerCase();
      certificateValid = (cleanFingerprint === expectedFingerprint);
      if (certificateValid) {
        details.push('App signing certificate matches official production key.');
      } else {
        details.push(`Warning: App certificate mismatch! Current: ${cleanFingerprint}, Expected: ${expectedFingerprint}`);
      }
    } catch (err: any) {
      details.push(`Native installer check failed: ${err.message || String(err)}`);
    }
  } else {
    details.push('Running on Web platform. Native installer not required.');
    installerAvailable = true;
    packageInstallerAvailable = true;
    certificateValid = true;
  }

  const isHealthy = metadataReachable && githubReachable && installerAvailable && certificateValid;
  const status = isHealthy ? 'healthy' : (installerAvailable && certificateValid ? 'warning' : 'unhealthy');

  return {
    status,
    metadataReachable,
    githubReachable,
    firebaseReachable,
    installerAvailable,
    packageInstallerAvailable,
    certificateValid,
    details
  };
}

export async function getDiagnosticsReport(): Promise<string> {
  const health = await runUpdaterHealthCheck();
  let info: any = null;
  let dev: any = null;
  if (isNative()) {
    try {
      const { AppInstaller } = await import('./apkDownloader');
      info = await AppInstaller.getInstalledAppInfo();
      dev = await AppInstaller.getDeviceInfo();
    } catch {}
  }
  
  return `=== STUDIO UPDATER HEALTH & DIAGNOSTICS REPORT ===
Timestamp: ${new Date().toISOString()}
Current State: ${globalOtaState.updateState}
Update Available: ${globalOtaState.updateAvailable}
Remote Version: ${globalOtaState.remoteVersion}
Download Source: ${otaDebugLogs.currentDownloadSource || 'None'}
SHA Status: ${otaDebugLogs.shaVerification || 'N/A'}
Consecutive Failures: ${globalOtaState.consecutiveFailures}
Active Fallback: ${globalOtaState.activeFallback || 'None'}
Recovery Mode Active: ${globalOtaState.recoveryMode}

--- Platform Health ---
Overall Status: ${health.status.toUpperCase()}
Metadata Reachable: ${health.metadataReachable}
GitHub Reachable: ${health.githubReachable}
Firebase Reachable: ${health.firebaseReachable}
Installer Available: ${health.installerAvailable}
PackageInstaller Available: ${health.packageInstallerAvailable}
Signing Certificate Valid: ${health.certificateValid}

--- Device & Package Info ---
App Version: ${APP_VERSION}
Package Name: ${info?.packageName || 'com.chordex.app'}
Installed Version Code: ${info?.versionCode || 'N/A'}
Installed Sign SHA256: ${info?.signingSha256 || 'N/A'}
Android Version: ${dev?.androidVersion || 'N/A'}
Device Model: ${dev?.model || 'N/A'}
Storage Available: ${dev?.storageAvailable || 'N/A'}

--- Health Check Logs ---
${health.details.join('\n')}
==================================================`;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION, compareSemver, normalizeSemver } from './appVersion';
import { isNative, shouldUseAndroidApkUpdater } from './capgoUpdater';
import { nativeSet, NATIVE_PREFS } from './nativePrefs';
import { useChordStore } from '../store/useChordStore';
import { logActivity } from './activityLogger';

// Import modular subcomponents
import {
  globalOtaState,
  updateGlobalState,
  transitionToState,
  stopWatchdog,
  stateListeners,
  CentralizedOtaState,
  OtaUpdateState,
  StructuredReleaseNotes
} from './updater/stateMachine';

import {
  RemoteVersionInfo,
  fetchRemoteVersion,
  versionJsonUrls
} from './updater/releaseMetadata';
import { compareVersions } from './updater/versionComparison';
import { downloadUpdateApk, downloadAndInstallGitHubApk } from './updater/downloadManager';
import { verifyFileIntegrity } from './updater/integrityVerification';
import { runEligibilityCheck } from './updater/eligibilityVerification';
import { triggerNativeInstall, processLastInstallResult } from './updater/installer';
import { runSignatureMismatchRecovery, isRecovering, setIsRecovering } from './updater/recovery';
import { validateLocalApk, deleteLocalApk, getLocalApkPath, recordDismissal, shouldShowRecoveryReminder } from './updater/cacheManager';
import {
  otaDebugLogs,
  otaDiagnostics,
  logProgressStage,
  populateDiagnostics,
  nextJsCallId,
  isAppInstallerAvailable,
  runUpdaterHealthCheck,
  getDiagnosticsReport,
  HealthStatus
} from './updater/diagnostics';

import { detectJustUpdated, writeLastSeen } from './updater/versionManager';

export {
  globalOtaState,
  otaDebugLogs,
  otaDiagnostics,
  logProgressStage,
  populateDiagnostics,
  nextJsCallId,
  isAppInstallerAvailable,
  runEligibilityCheck,
  runSignatureMismatchRecovery,
  detectJustUpdated,
  resetLastCheckedTime,
  downloadAndInstallGitHubApk,
  runUpdaterHealthCheck,
  getDiagnosticsReport
};

export type { CentralizedOtaState, OtaUpdateState, StructuredReleaseNotes, RemoteVersionInfo, HealthStatus };

// Storage utilities
export function getStoredList(key: string): string[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToStoredList(key: string, val: string): void {
  try {
    const list = getStoredList(key);
    if (!list.includes(val)) {
      list.push(val);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
}

export function removeFromStoredList(key: string, val: string): void {
  try {
    const list = getStoredList(key);
    const filtered = list.filter((v) => v !== val);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch {
    /* ignore */
  }
}

export function getSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setSessionItem(key: string, val: string): void {
  try {
    sessionStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

export function removeSessionItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function getNativeVersion(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { AppInstaller } = await import('./apkDownloader');
    const info = await AppInstaller.getInstalledAppInfo();
    return info.versionName;
  } catch (e) {
    console.warn('[OTA] Failed to query native app version:', e);
    return null;
  }
}

export async function getNativeVersionCode(): Promise<number | null> {
  if (!isNative()) return null;
  try {
    const { AppInstaller } = await import('./apkDownloader');
    const info = await AppInstaller.getInstalledAppInfo();
    return info.versionCode;
  } catch (e) {
    console.warn('[OTA] Failed to query native app version code:', e);
    return null;
  }
}


export function resetOtaUpdateState() {
  updateGlobalState({
    updateState: 'idle',
    loading: false,
    progress: 0,
    error: null,
    statusText: null,
    remoteVersion: null,
    updateAvailable: false,
    mandatory: false,
    changelog: null,
    releaseNotes: null,
  });
}

export async function enforceStartupRecovery() {
  console.log('[OTA DEBUG] enforceStartupRecovery starting...');
  let isInstallationActive = false;

  if (isNative() && isAppInstallerAvailable()) {
    try {
      const { AppInstaller } = await import('./apkDownloader');
      const check = await AppInstaller.isInstallActive();
      isInstallationActive = check.active;
      console.log('[OTA DEBUG] enforceStartupRecovery: Android active session =', isInstallationActive);
    } catch (err) {
      console.warn('[OTA] enforceStartupRecovery error checking session:', err);
    }
  }

  if (!isInstallationActive) {
    console.log('[OTA DEBUG] No active PackageInstaller session. Hard resetting all state to IDLE.');
    stopWatchdog();

    activeCheckPromise = null;
    activeApplyPromise = null;
    activeDownloadPromise = null;

    resetOtaUpdateState();

    if (isNative() && isAppInstallerAvailable()) {
      try {
        const { AppInstaller } = await import('./apkDownloader');
        await AppInstaller.clearInstallerLogHistory();

        const downloadedPath = localStorage.getItem('studio:downloadedApkPath');
        if (downloadedPath) {
          const { Filesystem } = await import('@capacitor/filesystem');
          await Filesystem.deleteFile({ path: downloadedPath }).catch(() => {});
          localStorage.removeItem('studio:downloadedApkPath');
        }
      } catch (_) {}
    }
  }
}

// Queue / Check variables
let latestCheckId = 0;
let activeCheckIsManual = false;
let activeCheckPromise: Promise<CentralizedOtaState> | null = null;
let activeDownloadPromise: Promise<void> | null = null;
let activeApplyPromise: Promise<void> | null = null;

let lastCheckedTime = 0;
function resetLastCheckedTime() {
  lastCheckedTime = 0;
}
const MIN_AUTO_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function checkForUpdate(isManual = false): Promise<CentralizedOtaState> {
  const checkId = ++latestCheckId;
  const callId = nextJsCallId();
  console.log(`[INSTRUMENTATION] checkForUpdate ENTER Call #${callId} (isManual=${isManual}, checkId=${checkId})`);
  void logProgressStage('[INSTRUMENTATION] checkForUpdate ENTER', `Call #${callId} isManual=${isManual}`);

  if (activeCheckPromise) {
    if (!activeCheckIsManual && isManual) {
      console.log(`[OTA] Obsoleting background check (checkId=${checkId - 1}) in favor of manual check (checkId=${checkId})`);
      activeCheckPromise = null;
    } else {
      console.log(`[INSTRUMENTATION] checkForUpdate EXIT Call #${callId} (Early return: reusing activeCheckPromise)`);
      return activeCheckPromise;
    }
  }

  if (!isManual) {
    const now = Date.now();
    if (now - lastCheckedTime < MIN_AUTO_CHECK_INTERVAL_MS) {
      console.log('[OTA] Skipping auto-check, checked recently (rate limited).');
      return Promise.resolve(globalOtaState);
    }
  }

  if (isManual) {
    removeSessionItem('studio:laterUpdateVersion');
    removeSessionItem('studio:autoOpenedUpdateVersion');
  }

  activeCheckIsManual = isManual;
  activeCheckPromise = (async () => {
    transitionToState('checking', 'checkForUpdate start');
    try {
      let remote = await fetchRemoteVersion();

      if (checkId !== latestCheckId) {
        console.log(`[OTA] Check request checkId=${checkId} was superseded by checkId=${latestCheckId}. Exiting silently.`);
        return globalOtaState;
      }

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
      const natVerCode = await getNativeVersionCode();
      const appliedList = getStoredList('studio:appliedVersions');
      const installedList = getStoredList('studio:installedVersions');
      const dismissedList = getStoredList('studio:dismissedVersions');
      const notifiedList = getStoredList('studio:notifiedVersions');
      const laterVersion = getSessionItem('studio:laterUpdateVersion');

      otaDebugLogs.appVersion = APP_VERSION;
      otaDebugLogs.nativeApkVersion = natVer || 'N/A';
      (otaDebugLogs as any).nativeApkVersionCode = natVerCode !== null ? natVerCode.toString() : 'N/A';
      otaDebugLogs.pendingOtaBundleId = localStorage.getItem('studio:downloadedBundleId') || 'None';

      otaDebugLogs.staleOtaCleared = false;
      otaDebugLogs.capgoSetBlocked = false;
      otaDebugLogs.triggerComponent = isManual ? 'Developer Options (Manual Check)' : 'Auto Poll / System';
      otaDebugLogs.finalPathExecuted = 'N/A';

      if (isNative()) {
        otaDebugLogs.currentOtaVersion = 'disabled';
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
        } catch (e) {
          console.warn('[OTA] AppInstaller diagnostics failed:', e);
        }
      }

      if (isNative() && isAppInstallerAvailable()) {
        try {
          const { AppInstaller } = await import('./apkDownloader');
          const result = await AppInstaller.getLastInstallResult();
          console.log('[OTA DEBUG] Last install result status:', result);
          
          const processed = processLastInstallResult(result);
          if (processed) {
            otaDiagnostics.statusCode = result.statusCode;
            otaDiagnostics.statusText = processed.errMsg;
            otaDiagnostics.exceptionMessage = processed.errMsg;
            otaDiagnostics.failureReason = `PackageInstaller code ${result.statusCode}\nMessage: ${result.statusMessage}\nPackage: ${result.packageName}`;
            otaDiagnostics.installerResult = `Code: ${result.statusCode}\nMessage: ${result.statusMessage}\nPackage: ${result.packageName}\nTimestamp: ${new Date(result.timestamp).toISOString()}`;
            otaDiagnostics.timestamp = new Date(result.timestamp).toISOString();

            await populateDiagnostics(null, 'PackageInstaller failure detected');

            updateGlobalState({
              updateState: processed.category as OtaUpdateState,
              error: processed.errMsg
            });
            return globalOtaState;
          }
        } catch (err) {
          console.warn('[OTA] Failed to fetch last native install result:', err);
        }
      }

      if (!remote) {
        if (isManual) {
          updateGlobalState({ error: 'Unable to contact the update server.' });
          transitionToState('failed', 'Manual check failed: no remote metadata');
        } else {
          transitionToState('idle', 'Auto-check completed: no remote metadata');
        }
        return globalOtaState;
      }

      const comp = compareVersions(remote, APP_VERSION, natVerCode ?? undefined);
      otaDebugLogs.updateDecision = comp.updateAvailable ? 'update_available' : 'up_to_date';
      otaDebugLogs.updateDecisionReason = `Remote version ${remote.version} vs local version ${APP_VERSION}`;

      if (comp.updateAvailable) {
        const hasBeenApplied = appliedList.includes(remote.version);
        const hasBeenInstalled = installedList.includes(remote.version);
        const isDismissed = dismissedList.includes(remote.version);
        const isLater = laterVersion === remote.version;

        if (hasBeenInstalled) {
          transitionToState('idle', 'Already installed');
          return globalOtaState;
        }

        if (!isManual && (isDismissed || isLater)) {
          console.log(`[OTA] Skipping auto-prompt for version ${remote.version} (user dismissed/later).`);
          updateGlobalState({
            remoteVersion: remote.version,
            updateAvailable: true,
            mandatory: remote.mandatory ?? false,
            changelog: remote.changelog ?? null,
            releaseNotes: remote.releaseNotes ?? null,
            apkUrl: remote.apkUrl ?? null,
            apkSha256: remote.apkSha256 ?? null,
            manualApkUrl: remote.manualApkUrl ?? null,
            fallbackApkUrl: remote.fallbackApkUrl ?? null,
          });
          await checkAndCleanCache();
          transitionToState('idle', 'User dismissed/later');
          return globalOtaState;
        }

        updateGlobalState({
          remoteVersion: remote.version,
          updateAvailable: true,
          mandatory: remote.mandatory ?? false,
          changelog: remote.changelog ?? null,
          releaseNotes: remote.releaseNotes ?? null,
          apkUrl: remote.apkUrl ?? null,
          apkSha256: remote.apkSha256 ?? null,
          manualApkUrl: remote.manualApkUrl ?? null,
          fallbackApkUrl: remote.fallbackApkUrl ?? null,
        });

        await checkAndCleanCache();
        transitionToState('update_available', 'New update found');
        void logProgressStage('Update detected', `Version: ${remote.version}`);
      } else {
        transitionToState('idle', 'App is up to date');
      }

      console.log(`[INSTRUMENTATION] checkForUpdate EXIT Call #${callId} resolvedState=${globalOtaState.updateState}`);
      void logProgressStage('[INSTRUMENTATION] checkForUpdate EXIT', `Call #${callId} resolvedState=${globalOtaState.updateState}`);
      return globalOtaState;
    } catch (err) {
      console.error(`[INSTRUMENTATION] checkForUpdate EXIT Call #${callId} error:`, err);
      void logProgressStage('[INSTRUMENTATION] checkForUpdate EXIT', `Call #${callId} failed err=${err instanceof Error ? err.message : String(err)}`);
      console.error('[OTA] Update check failed:', err);
      if (isManual) {
        updateGlobalState({ error: 'Unable to contact the update server.' });
        transitionToState('failed', 'Manual check exception');
      } else {
        transitionToState('idle', 'Auto-check exception');
      }
      return globalOtaState;
    } finally {
      if (checkId === latestCheckId) {
        activeCheckPromise = null;
        lastCheckedTime = Date.now();
      }
    }
  })();

  return activeCheckPromise;
}

export async function checkAndCleanCache(): Promise<boolean> {
  const ver = globalOtaState.remoteVersion;
  if (!ver) {
    updateGlobalState({ validApkExists: false });
    return false;
  }
  
  const expectedHash = globalOtaState.apkSha256 ?? undefined;
  const { valid, filePath } = await validateLocalApk(ver, expectedHash);
  
  updateGlobalState({ validApkExists: valid });
  
  if (!valid && filePath) {
    await deleteLocalApk(ver);
  }
  
  return valid;
}

export function downloadUpdate(trigger?: string): Promise<void> {
  const callId = nextJsCallId();
  console.log(`[INSTRUMENTATION] downloadUpdate ENTER Call #${callId} (trigger=${trigger})`);
  void logProgressStage('[INSTRUMENTATION] downloadUpdate ENTER', `Call #${callId} trigger=${trigger}`);

  if (activeDownloadPromise) {
    console.log(`[INSTRUMENTATION] downloadUpdate EXIT Call #${callId} (Early return: activeDownloadPromise is running)`);
    void logProgressStage('[INSTRUMENTATION] downloadUpdate EXIT', `Call #${callId} early exit (activeDownloadPromise running)`);
    return activeDownloadPromise;
  }

  const ver = globalOtaState.remoteVersion;
  if (!ver) {
    console.log(`[INSTRUMENTATION] downloadUpdate EXIT Call #${callId} (Early return: no remoteVersion)`);
    return Promise.resolve();
  }

  const apkUrl = globalOtaState.updateAvailable ? (globalOtaState as any).apkUrl : null;
  const isDowngrade = globalOtaState.updateAvailable && compareSemver(ver, APP_VERSION) < 0;

  if (!isNative() || !isAppInstallerAvailable()) {
    console.log('[OTA] Non-Android / Web platform detected. Falling back to web-reload update path.');
    (async () => {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        console.log('[OTA] Clearing ServiceWorker caches...');
      } catch (e) {
        console.warn('Failed to clear caches:', e);
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

  transitionToState('downloading', 'downloadUpdate start');
  updateGlobalState({ progress: 0, statusText: 'Preparing update...', error: null });

  activeDownloadPromise = (async () => {
    const downloadedPath = localStorage.getItem('studio:downloadedApkPath');
    if (downloadedPath && !downloadedPath.includes(`studio-update-${ver}.apk`)) {
      localStorage.removeItem('studio:downloadedApkPath');
    }
    
    const hasValid = await checkAndCleanCache();
    if (hasValid) {
      console.log('[Smart Recovery] Valid APK already exists. Skipping download.');
      transitionToState('verifying_sha', 'Valid cached APK exists');
      updateGlobalState({ progress: 1.0, statusText: 'Verifying update...' });
      const filePath = await getLocalApkPath(ver);
      
      transitionToState('verifying_eligibility', 'Checking cached APK eligibility');
      const isEligible = await runEligibilityCheck(filePath, isDowngrade);
      if (!isEligible) {
        if (otaDebugLogs.eligibilityReason === 'signature_mismatch' && !isRecovering) {
          const recovered = await runSignatureMismatchRecovery(applyUpdate, downloadUpdate);
          if (recovered) return;
        }
        transitionToState('eligibility_failed', `Eligibility check failed: ${otaDebugLogs.eligibilityReason}`);
        throw new Error(`[Eligibility Check] Validation failed: ${otaDebugLogs.eligibilityReason || 'unknown'}`);
      }
      
      transitionToState('ready_to_install', 'Valid cached APK verified');
      return;
    }

    otaDebugLogs.downloadStatus = `Update started: apk\nAPK URL: ${apkUrl}`;
    updateGlobalState({ progress: 0.0, statusText: 'Entering progress screen...' });
    
    try {
      let filePath: string;
      try {
        filePath = await downloadUpdateApk({
          url: apkUrl,
          version: ver,
          manualApkUrl: (globalOtaState as any).manualApkUrl,
          fallbackApkUrl: (globalOtaState as any).fallbackApkUrl,
        });
      } catch (dlErr) {
        transitionToState('download_failed', 'APK download execution failed');
        throw dlErr;
      }

      otaDebugLogs.downloadStatus += `\nAPK download completed. Path: ${filePath}`;
      void logProgressStage('Download completed', 'Path: ' + filePath);

      transitionToState('verifying_sha', 'Verifying checksum');
      const expectedHash = (globalOtaState as any).apkSha256;
      if (expectedHash) {
        try {
          await verifyFileIntegrity(filePath, expectedHash);
        } catch (shaErr) {
          transitionToState('sha_failed', 'SHA integrity check failed');
          throw shaErr;
        }
      } else {
        otaDebugLogs.shaVerification = 'SKIPPED (No expected hash)';
      }

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
      transitionToState('verifying_eligibility', 'Checking eligibility');
      updateGlobalState({ statusText: 'Checking eligibility...' });

      const isEligible = await runEligibilityCheck(filePath, isDowngrade);
      if (!isEligible) {
        if (otaDebugLogs.eligibilityReason === 'signature_mismatch' && !isRecovering) {
          const recovered = await runSignatureMismatchRecovery(applyUpdate, downloadUpdate);
          if (recovered) return;
        }
        transitionToState('eligibility_failed', `Eligibility check failed: ${otaDebugLogs.eligibilityReason}`);
        throw new Error('[Eligibility Check] Validation failed: ' + (otaDebugLogs.eligibilityReason || 'unknown'));
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

      if (globalOtaState.updateState !== 'signature_mismatch' && globalOtaState.updateState !== 'versionCode_low') {
        if (!['download_failed', 'sha_failed', 'eligibility_failed'].includes(globalOtaState.updateState)) {
          transitionToState('failed', 'Download/Verify exception');
        } else {
          transitionToState('failed', 'Granular error transition to failed');
        }
        updateGlobalState({ error: errMsg });
      }
      throw err;
    } finally {
      activeDownloadPromise = null;
    }
  })();

  return activeDownloadPromise;
}

export function applyUpdate(trigger?: string): Promise<void> {
  const callId = nextJsCallId();
  console.log(`[INSTRUMENTATION] applyUpdate ENTER Call #${callId} (trigger=${trigger})`);
  void logProgressStage('[INSTRUMENTATION] applyUpdate ENTER', `Call #${callId} trigger=${trigger}`);

  if (activeApplyPromise) {
    console.log(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} (Early return: activeApplyPromise is running)`);
    void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} early exit (activeApplyPromise running)`);
    return activeApplyPromise;
  }

  const remoteVersion = globalOtaState.remoteVersion;
  if (!remoteVersion) {
    console.log(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} (Early return: missing remoteVersion)`);
    void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} early exit (missing remoteVersion)`);
    return Promise.resolve();
  }

  if (!isNative() || !isAppInstallerAvailable()) {
    (async () => {
      try {
        const { Filesystem } = await import('@capacitor/filesystem');
        console.log('[OTA] Clearing ServiceWorker caches...');
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
    console.log(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} (Resolved: web reload completed)`);
    void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} resolved (web reload completed)`);
    return Promise.resolve();
  }

  if (globalOtaState.updateState !== 'ready_to_install') {
    console.warn(`[OTA] Rejecting applyUpdate. State is ${globalOtaState.updateState}, expected 'ready_to_install'.`);
    const err = new Error(`Cannot apply update. State is ${globalOtaState.updateState}, expected 'ready_to_install'.`);
    void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} rejected (invalid state)`);
    return Promise.reject(err);
  }

  transitionToState('installing', 'applyUpdate start');
  localStorage.setItem('studio:appliedUpdateVersion', remoteVersion);
  localStorage.setItem('studio:showUpdateSuccess', 'true');
  addToStoredList('studio:installedVersions', remoteVersion);
  addToStoredList('studio:appliedVersions', remoteVersion);
  logActivity('apk_install', `Installing APK system update (v${remoteVersion})`, 'Studio');

  activeApplyPromise = (async () => {
    try {
      const filePath = localStorage.getItem('studio:downloadedApkPath');
      if (!filePath) {
        throw new Error('No downloaded APK path found.');
      }

      updateGlobalState({ statusText: 'Installing update...' });
      const isEligible = await runEligibilityCheck(filePath);
      if (!isEligible) {
        if (otaDebugLogs.eligibilityReason === 'signature_mismatch' && !isRecovering) {
          const recovered = await runSignatureMismatchRecovery(applyUpdate, downloadUpdate);
          if (recovered) return;
        }
        throw new Error('[Eligibility Check] Validation failed: ' + (otaDebugLogs.eligibilityReason || 'unknown'));
      }

      otaDebugLogs.installError += `\nAPK is eligible. Launching APK installer intent for file: ${filePath}`;
      updateGlobalState({ statusText: 'Waiting for Android...' });
      await new Promise((resolve) => setTimeout(resolve, 800));

      updateGlobalState({ statusText: 'Installing...' });
      void logProgressStage('Session committed', 'Handing over to PackageInstaller');
      await triggerNativeInstall(filePath);
      void logProgressStage('Waiting for Android confirmation', 'Waiting for system confirmation dialog to overlay');
      
      otaDebugLogs.installError += `\nAPK installer intent launched successfully!`;
      otaDebugLogs.installerLaunchStatus = 'SUCCESS';
      otaDebugLogs.lastExceptionStackTrace = 'None';
      otaDebugLogs.finalPathExecuted = 'APK installer launched';
      
      updateGlobalState({ statusText: 'Finalizing...' });
      await new Promise((resolve) => setTimeout(resolve, 600));
      transitionToState('installed', 'APK installer launched');
      
      console.log(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} (Resolved: Installer intent launched)`);
      void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} resolved (Installer intent launched)`);
    } catch (err) {
      console.error(`[INSTRUMENTATION] applyUpdate EXIT Call #${callId} error:`, err);
      void logProgressStage('[INSTRUMENTATION] applyUpdate EXIT', `Call #${callId} failed err=${err instanceof Error ? err.message : String(err)}`);
      console.error('[OTA] PackageInstaller execution failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      const errStack = (err instanceof Error && err.stack ? err.stack : null);
      otaDebugLogs.installError = `Native Install Exception: ${errMsg}\nStack: ${errStack || ''}`;
      otaDebugLogs.lastExceptionStackTrace = errStack;
      otaDebugLogs.installerLaunchStatus = 'FAILED';
      await populateDiagnostics(err, 'APK installation failed');

      if (globalOtaState.updateState !== 'signature_mismatch' && globalOtaState.updateState !== 'versionCode_low') {
        transitionToState('install_failed', 'PackageInstaller exception');
        transitionToState('failed', 'Installer error transition to failed');
        updateGlobalState({ error: errMsg });
      }
      throw err;
    } finally {
      activeApplyPromise = null;
    }
  })();

  return activeApplyPromise;
}

export function dismissUpdate(): void {
  const ver = globalOtaState.remoteVersion;
  if (ver) {
    addToStoredList('studio:dismissedVersions', ver);
  }
  resetOtaUpdateState();
}

export function markUpdateSeen(): void {
  const ver = globalOtaState.remoteVersion;
  if (ver) {
    addToStoredList('studio:notifiedVersions', ver);
  }
}

export function useOtaUpdate() {
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

    const initUpdater = () => {
      console.log('[OTA] Running delayed updater startup (Phase 3)...');
      void checkAndCleanCache();
      if (globalOtaState.updateState === 'idle') {
        void checkForUpdate();
      }
    };

    let introTimer: any = null;
    if (typeof window !== 'undefined') {
      if ((window as any).__introDone || sessionStorage.getItem('studio-intro-shown') === 'true') {
        initUpdater();
      } else {
        const handleIntroDone = () => {
          if (introTimer) clearTimeout(introTimer);
          window.removeEventListener('studio-intro-done', handleIntroDone);
          setTimeout(initUpdater, 1000);
        };
        window.addEventListener('studio-intro-done', handleIntroDone);
        introTimer = setTimeout(handleIntroDone, 3000);
      }
    } else {
      initUpdater();
    }

    const runCheck = () => {
      if (!autoCheckRef.current) return;
      void checkForUpdate();
    };

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
      if (introTimer) clearTimeout(introTimer);
      if (nativeListener) void nativeListener.remove().catch(() => {});
    };
  }, []);

  const checkNow = async () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('studio:open-update-dialog'));
    }
    const res = await checkForUpdate(true);
    return res;
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
    dismissUpdate,
    markUpdateSeen,
    downloadAndInstallGitHubApk,
    runSignatureMismatchRecovery: async () => {
      return await runSignatureMismatchRecovery(applyUpdate, downloadUpdate);
    },
    runUpdaterHealthCheck,
    getDiagnosticsReport,
    applyUpdateDirect,
    shareDownloadedApk,
    getUpdateHistory,
    triggerDowngrade,
    checkAndCleanCache,
    deleteLocalApk,
    recordDismissal,
    shouldShowRecoveryReminder,
  };
}

const FOREGROUND_POLL_MS = 60 * 60 * 1000;

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
      error,
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
    updateState: 'downloading',
    progress: 0,
    error: null,
    statusText: 'Preparing downgrade...'
  });
  
  if (isNative()) {
    window.dispatchEvent(new CustomEvent('studio:open-update-dialog'));
  }
  
  try {
    await downloadUpdate('user_downgrade');
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



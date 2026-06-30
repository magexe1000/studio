import { isNative } from '../capgoUpdater';
import { APP_VERSION } from '../appVersion';
import { globalOtaState } from './stateMachine';

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

export const otaDebugLogs: {
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
  recoveryAttemptsPerformed: string[];
  signatureMismatchDetectedCause: string | null;
  expectedSigningSha256: string | null;
  certificateSubject: string | null;
  certificateIssuer: string | null;
  validationStage: string | null;
  exactFailingStage: string | null;
  rootCause: string | null;
  suggestedFix: string | null;
  magicHeaderCheckResult?: string | null;
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
  recoveryAttemptsPerformed: [],
  signatureMismatchDetectedCause: null,
  expectedSigningSha256: null,
  certificateSubject: null,
  certificateIssuer: null,
  validationStage: null,
  exactFailingStage: null,
  rootCause: null,
  suggestedFix: null,
};

let checkCallIdCounter = 0;
export function nextJsCallId(): number {
  return ++checkCallIdCounter;
}

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

export async function logProgressStage(stage: string, message?: string, exceptionStack?: string) {
  if (isNative() && isAppInstallerAvailable()) {
    try {
      const { AppInstaller } = await import('../apkDownloader');
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

export async function populateDiagnostics(err: any, reason: string) {
  try {
    const timestamp = new Date().toISOString();
    let manufacturer = 'Web Browser';
    let model = typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A';
    let androidVersion = 'N/A';
    let permissionState = 'N/A';

    if (isNative()) {
      try {
        const { AppInstaller } = await import('../apkDownloader');
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

        try {
          const { AppInstaller } = await import('../apkDownloader');
          const firstBytes = await AppInstaller.readFirstBytes({ filePath: apkPath, count: 4 });
          const matchesPK = firstBytes.hex.toLowerCase().startsWith('504b');
          magicHeader = `Hex: ${firstBytes.hex}, ASCII: ${firstBytes.ascii} (Matches PK/ZIP: ${matchesPK})`;
          otaDebugLogs.magicHeaderCheck = magicHeader;
        } catch (hErr) {
          console.warn('[OTA] Failed to read magic bytes:', hErr);
          magicHeader = `Failed to read: ${hErr instanceof Error ? hErr.message : String(hErr)}`;
          otaDebugLogs.magicHeaderCheck = magicHeader;
        }
      } catch (statErr) {
        console.warn('[OTA] Failed to read file stats:', statErr);
      }
    }

    let shaCalculated = otaDebugLogs.shaVerification || 'N/A';

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
    const res = await fetch('https://studio-30f44.web.app/app-release.json', { method: 'HEAD' });
    metadataReachable = res.ok;
    firebaseReachable = res.ok;
    details.push(res.ok ? 'Firebase metadata server reachable.' : `Firebase metadata unreachable (HTTP ${res.status}).`);
  } catch (err: any) {
    details.push(`Firebase metadata unreachable: ${err.message || String(err)}`);
  }

  try {
    const res = await fetch('https://api.github.com/repos/MAGEXE1000/Studio/releases', { method: 'HEAD' });
    githubReachable = res.ok;
    details.push(res.ok ? 'GitHub API reachable.' : `GitHub API unreachable (HTTP ${res.status}).`);
  } catch (err: any) {
    details.push(`GitHub API unreachable: ${err.message || String(err)}`);
  }

  if (isNative()) {
    try {
      const { AppInstaller } = await import('../apkDownloader');
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
      const { AppInstaller } = await import('../apkDownloader');
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

export function resetOtaDiagnostics() {
  // Reset all keys in otaDiagnostics
  Object.keys(otaDiagnostics).forEach(key => {
    (otaDiagnostics as any)[key] = null;
  });

  // Reset keys in otaDebugLogs
  Object.keys(otaDebugLogs).forEach(key => {
    if (key === 'appVersion') {
      otaDebugLogs.appVersion = APP_VERSION;
    } else if (key === 'apkEligibilityResult' || key === 'pluginMethodCheck' || key === 'finalUpdatePath') {
      (otaDebugLogs as any)[key] = 'N/A';
    } else if (key === 'registeredPlugins') {
      otaDebugLogs.registeredPlugins = '[]';
    } else if (key === 'otaBlockedBecauseApkRequired' || key === 'nativeApkBehind' || key === 'apkUpdateRequired' || key === 'staleOtaCleared' || key === 'capgoSetBlocked') {
      (otaDebugLogs as any)[key] = false;
    } else if (key === 'appInstallerAvailable' || key === 'downloadApkAvailable' || key === 'verifyApkSha256Available' || key === 'installApkAvailable' || key === 'openInstallPermissionSettingsAvailable') {
      (otaDebugLogs as any)[key] = false;
    } else if (key === 'recoveryAttemptsPerformed') {
      otaDebugLogs.recoveryAttemptsPerformed = [];
    } else {
      (otaDebugLogs as any)[key] = null;
    }
  });
}

import { registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

// CRITICAL WARNING:
// This interface, the registered plugin name 'AppInstaller', and its methods:
// - downloadApk
// - verifyApkSha256
// - installApk
// - openInstallPermissionSettings
// constitute a strict native-to-JS contract.
// Do NOT rename the plugin name, the methods, or remove them.
export interface AppInstallerPlugin {
  installApk(options: { filePath: string }): Promise<void>;
  installApkDirect(options: { filePath: string }): Promise<void>;
  downloadAndInstallApk(options: { url: string; fileName?: string }): Promise<void>;
  downloadApk(options: { url: string; fileName?: string }): Promise<{ filePath: string }>;
  getLastInstallResult(): Promise<{ statusCode: number; statusMessage: string; packageName: string; timestamp: number; expectedVersionCode?: number; expectedVersionName?: string }>;
  getInstallerLogHistory(): Promise<{ logs: string }>;
  clearInstallerLogHistory(): Promise<void>;
  appendLog(options: { stage: string; status?: number; message?: string; packageName?: string; exceptionStack?: string }): Promise<void>;
  resumePendingInstall(): Promise<void>;
  resumePackageInstallerSession(): Promise<void>;
  recreateActivity(): Promise<void>;
  killProcess(): Promise<void>;
  checkPermissions(): Promise<any>;
  requestPermissions(options?: { aliases?: string[] }): Promise<any>;
  getSharedFile(): Promise<{ none?: boolean; type?: 'json' | 'audio'; data?: string; fileName?: string }>;
  setSecureValue(options: { key: string; value: string | null }): Promise<void>;
  getSecureValue(options: { key: string }): Promise<{ value: string | null }>;
  removeSecureValue(options: { key: string }): Promise<void>;
  canRequestPackageInstalls(): Promise<{ value: boolean }>;
  openUnknownAppSourcesSettings(): Promise<void>;
  openInstallPermissionSettings(): Promise<void>;
  verifySha256(options: { filePath: string; expectedHash: string }): Promise<{ matches: boolean; computedHash: string }>;
  verifyApkSha256(options: { filePath: string; expectedHash: string }): Promise<{ matches: boolean; computedHash: string }>;
  getDeviceInfo(): Promise<{
    manufacturer: string;
    model: string;
    androidVersion: string;
    sdkInt: number;
    canRequestPackageInstalls: boolean;
    architecture?: string;
    deviceLocale?: string;
    storageAvailable?: string;
    networkState?: string;
  }>;
  getApkDetails(options: { filePath: string }): Promise<{ packageName: string; versionName: string; versionCode: number; signatures: string }>;
  getInstalledAppDetails(): Promise<{ packageName: string; versionName: string; versionCode: number; signatures: string }>;
  getInstalledAppInfo(): Promise<{ packageName: string; versionName: string; versionCode: number; signingSha256: string; debuggable: boolean; certificateSubject?: string; certificateIssuer?: string; }>;
  inspectApk(options: { filePath: string }): Promise<{
    packageName: string;
    versionName: string;
    versionCode: number;
    signingSha256: string;
    debuggable: boolean;
    minSdk: number;
    targetSdk: number;
    isValidApk: boolean;
    isUniversalApk: boolean;
    certificateSubject?: string;
    certificateIssuer?: string;
  }>;
  readFirstBytes(options: { filePath: string; count?: number }): Promise<{ hex: string; ascii: string }>;
  isInstallActive(): Promise<{ active: boolean; sessionId: number }>;
  getExtendedDiagnostics(): Promise<{
    sessionId: number;
    sessionState: string;
    pendingIntentCreated: boolean;
    intentSenderCreated: boolean;
    intentFired: boolean;
    confirmationIntentReceived: boolean;
    confirmationIntentStarted: boolean;
    installationActive: boolean;
    sessionStartTime: number;
    sessionCreatedTime: number;
    sessionCommitTime: number;
    lastStatusCode: number;
    lastStatusMessage: string;
    lastOtherPackage: string;
    lastStatusTimestamp: number;
    expectedVersionCode: number;
    expectedVersionName: string;
    pendingConfirmIntentExists: boolean;
    activeSessionsCount: number;
    hasInstallPermission: boolean;
  }>;
  copyToClipboard(options: { text: string }): Promise<void>;
}

export const AppInstaller = registerPlugin<AppInstallerPlugin>('AppInstaller');

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface GitHubRelease {
  tag_name: string;
  assets: GitHubReleaseAsset[];
}

/**
 * Resolves the URL for the APK by fetching the GitHub Releases API.
 * 1. Checks if a release with the tag v${targetVersion} exists.
 * 2. If it does, scans its assets for studio-debug.apk or app-debug.apk.
 * 3. If it doesn't or does not contain the APK, scans the releases from newest to oldest
 *    until it finds the latest release containing a compiled APK.
 * 4. Falls back to a hardcoded URL on failure.
 */
export async function resolveApkUrl(targetVersion?: string): Promise<string> {
  const fallbackVersion = targetVersion || '3.2.0';
  const fallbackUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${fallbackVersion}/Studio%20${fallbackVersion}.apk`;
  
  try {
    const res = await fetch('https://api.github.com/repos/MAGEXE1000/Studio/releases');
    if (!res.ok) return fallbackUrl;
    
    const releases = (await res.json()) as GitHubRelease[];
    if (!Array.isArray(releases) || releases.length === 0) return fallbackUrl;
    
    const cleanVer = targetVersion?.replace(/^[vV]/, '').trim();
    
    // Step 1 & 2: Search for the specific targetVersion release
    if (cleanVer) {
      const specificRelease = releases.find(
        r => r.tag_name.replace(/^[vV]/, '').trim() === cleanVer
      );
      if (specificRelease && specificRelease.assets) {
        const apkAsset = specificRelease.assets.find(
          a => a.name.toLowerCase().endsWith('.apk')
        );
        if (apkAsset) {
          console.log(`[apkDownloader] Found APK for specific version ${cleanVer}: ${apkAsset.browser_download_url}`);
          return apkAsset.browser_download_url;
        }
      }
    }
    
    // Step 3: Scan all releases (GitHub returns them sorted by date desc) to find the latest compiled APK
    for (const release of releases) {
      if (release.assets) {
        const apkAsset = release.assets.find(
          a => a.name.toLowerCase().endsWith('.apk')
        );
        if (apkAsset) {
          console.log(`[apkDownloader] Found latest available APK from release ${release.tag_name}: ${apkAsset.browser_download_url}`);
          return apkAsset.browser_download_url;
        }
      }
    }
    
    return fallbackUrl;
  } catch (err) {
    console.warn('[apkDownloader] Failed to resolve APK URL from GitHub API, using fallback:', err);
    return fallbackUrl;
  }
}

/**
 * Resolves the release page URL that contains a compiled APK.
 */
export async function resolveReleasePageUrl(targetVersion?: string): Promise<string> {
  const fallbackVersion = targetVersion || '3.2.0';
  const defaultFallback = `https://github.com/MAGEXE1000/Studio/releases/tag/v${fallbackVersion}`;
  
  try {
    const res = await fetch('https://api.github.com/repos/MAGEXE1000/Studio/releases');
    if (!res.ok) return defaultFallback;
    
    const releases = (await res.json()) as GitHubRelease[];
    if (!Array.isArray(releases) || releases.length === 0) return defaultFallback;
    
    const cleanVer = targetVersion?.replace(/^[vV]/, '').trim();
    
    // Step 1: Search for specific targetVersion containing APK
    if (cleanVer) {
      const specificRelease = releases.find(
        r => r.tag_name.replace(/^[vV]/, '').trim() === cleanVer
      );
      if (specificRelease && specificRelease.assets) {
        const hasApk = specificRelease.assets.some(
          a => a.name.toLowerCase().endsWith('.apk')
        );
        if (hasApk) {
          return `https://github.com/MAGEXE1000/Studio/releases/tag/${specificRelease.tag_name}`;
        }
      }
    }
    
    // Step 2: Search for the latest release containing compiled APK
    for (const release of releases) {
      if (release.assets) {
        const hasApk = release.assets.some(
          a => a.name.toLowerCase().endsWith('.apk')
        );
        if (hasApk) {
          return `https://github.com/MAGEXE1000/Studio/releases/tag/${release.tag_name}`;
        }
      }
    }
    
    return defaultFallback;
  } catch {
    return defaultFallback;
  }
}

/**
 * Downloads the APK from the specified URL and launches the native package installer.
 */
export async function downloadAndInstallApk(
  url: string,
  fileName?: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  let progressListener: any = null;
  
  try {
    if (onProgress) {
      try {
        progressListener = await (AppInstaller as any).addListener('apkDownloadProgress', (status: any) => {
          if (status && typeof status.progress === 'number') {
            onProgress(status.progress);
          }
        });
      } catch (err) {
        console.warn('[apkDownloader] Failed to add native progress listener:', err);
      }
    }
    
    console.log(`[apkDownloader] Invoking native downloadAndInstallApk for ${url}`);
    await AppInstaller.downloadAndInstallApk({ url, fileName });
    
    if (progressListener) {
      await progressListener.remove();
    }
  } catch (err) {
    if (progressListener) {
      await progressListener.remove();
    }
    console.error('[apkDownloader] Native installation failed:', err);
    throw err;
  }
}

/**
 * Downloads the APK from the specified URL without installing.
 * Resolves with the local filePath when download completes.
 */
export async function downloadApk(
  url: string,
  fileName?: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  let progressListener: any = null;
  
  try {
    console.log(`[INSTRUMENTATION] [JS] downloadApk ENTER url=${url}`);
    await AppInstaller.appendLog({ stage: '[INSTRUMENTATION] downloadApk ENTER', message: `url=${url}` });

    if (onProgress) {
      try {
        progressListener = await (AppInstaller as any).addListener('apkDownloadProgress', (status: any) => {
          if (status && typeof status.progress === 'number') {
            console.log(`[INSTRUMENTATION] [JS] apkDownloadProgress event status.progress=${status.progress}%`);
            onProgress(status.progress);
          }
        });
      } catch (err) {
        console.warn('[apkDownloader] Failed to add native progress listener:', err);
      }
    }
    
    console.log(`[apkDownloader] Invoking native downloadApk for ${url}`);
    const res = await AppInstaller.downloadApk({ url, fileName });
    
    if (progressListener) {
      await progressListener.remove();
    }
    
    console.log(`[INSTRUMENTATION] [JS] downloadApk EXIT success res.filePath=${res.filePath}`);
    await AppInstaller.appendLog({ stage: '[INSTRUMENTATION] downloadApk EXIT', message: `Success res.filePath=${res.filePath}` });
    return res.filePath;
  } catch (err) {
    if (progressListener) {
      await progressListener.remove();
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[INSTRUMENTATION] [JS] downloadApk EXIT error=${errMsg}`);
    await AppInstaller.appendLog({ stage: '[INSTRUMENTATION] downloadApk EXIT', message: `Error: ${errMsg}` });
    console.error('[apkDownloader] Native downloadApk failed:', err);
    throw err;
  }
}

/**
 * Verifies the SHA-256 hash of a file at the given absolute path.
 */
export async function verifyApkSha256(filePath: string, expectedHash: string): Promise<boolean> {
  console.log(`[INSTRUMENTATION] [JS] verifyApkSha256 ENTER filePath=${filePath}, expectedHash=${expectedHash}`);
  await AppInstaller.appendLog({ stage: '[INSTRUMENTATION] verifyApkSha256 ENTER', message: `filePath=${filePath}, expectedHash=${expectedHash}` });
  if (!expectedHash || expectedHash.replace(/0/g, '') === '') {
    console.warn('[apkDownloader] No expected hash or all-zero hash provided for verification. Skipping integrity check.');
    console.log('[INSTRUMENTATION] [JS] verifyApkSha256 EXIT (Skipped: all-zero or empty hash)');
    await AppInstaller.appendLog({ stage: '[INSTRUMENTATION] verifyApkSha256 EXIT', message: 'Skipped: all-zero or empty hash' });
    return true; // Skip if no hash provided
  }
  try {
    console.log(`[apkDownloader] Invoking native verifySha256 for ${filePath}`);
    const res = await AppInstaller.verifySha256({ filePath, expectedHash });
    console.log(`[apkDownloader] Native SHA-256 verification matches: ${res.matches}, computed: ${res.computedHash}`);
    try {
      const { otaDebugLogs } = await import('./otaUpdate');
      otaDebugLogs.downloadedApkSha256 = res.computedHash;
    } catch {}
    console.log(`[INSTRUMENTATION] [JS] verifyApkSha256 EXIT matches=${res.matches}`);
    await AppInstaller.appendLog({ stage: '[INSTRUMENTATION] verifyApkSha256 EXIT', message: `matches=${res.matches}, computedHash=${res.computedHash}` });
    return res.matches;
  } catch (err) {
    console.error('[apkDownloader] Native verifySha256 failed, falling back to JS implementation:', err);
    // Write error to otaDebugLogs if possible
    try {
      const { otaDebugLogs } = await import('./otaUpdate');
      const errMsg = err instanceof Error ? err.message : String(err);
      otaDebugLogs.installError = `Native verifySha256 failed: ${errMsg}`;
      otaDebugLogs.downloadedApkSha256 = `ERROR: Native verifySha256 failed - ${errMsg}`;
    } catch {}
    
    // JS Fallback (memory heavy, OOM risk for large files)
    try {
      const result = await Filesystem.readFile({
        path: filePath
      });
      
      const base64Data = typeof result.data === 'string' ? result.data : '';
      if (!base64Data) {
        console.warn('[apkDownloader] Empty file content read for hash verification.');
        try {
          const { otaDebugLogs } = await import('./otaUpdate');
          otaDebugLogs.downloadedApkSha256 = 'ERROR: Empty file read';
        } catch {}
        return false;
      }
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes.buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      try {
        const { otaDebugLogs } = await import('./otaUpdate');
        otaDebugLogs.downloadedApkSha256 = hashHex;
      } catch {}
      
      const matches = hashHex.toLowerCase() === expectedHash.toLowerCase();
      console.log(`[apkDownloader] JS Fallback SHA-256 verification: Expected=${expectedHash.toLowerCase()}, Computed=${hashHex}, Matches=${matches}`);
      return matches;
    } catch (jsErr) {
      console.error('[apkDownloader] JS Fallback verification failed:', jsErr);
      try {
        const { otaDebugLogs } = await import('./otaUpdate');
        const errMsg = jsErr instanceof Error ? jsErr.message : String(jsErr);
        otaDebugLogs.installError += `\nJS Fallback failed: ${errMsg}`;
        otaDebugLogs.downloadedApkSha256 = `ERROR: JS Fallback failed - ${errMsg}`;
      } catch {}
      return false;
    }
  }
}

/**
 * Triggers the native Android package installer for the given APK.
 */
export async function openApkInstaller(filePath: string): Promise<void> {
  console.log(`[apkDownloader] Requesting native APK installation for path: ${filePath}`);
  await AppInstaller.installApk({ filePath });
}

/**
 * Triggers the legacy/direct Android intent-based package installer for the given APK.
 */
export async function openApkInstallerDirect(filePath: string): Promise<void> {
  console.log(`[apkDownloader] Requesting direct APK installation for path: ${filePath}`);
  await AppInstaller.installApkDirect({ filePath });
}

/**
 * Directs the user to the system settings page to enable 'Install unknown apps'.
 */
export async function openInstallPermissionSettings(): Promise<void> {
  console.log('[apkDownloader] Opening unknown app sources settings');
  await AppInstaller.openUnknownAppSourcesSettings();
}

export interface InstallEligibility {
  eligible: boolean;
  reason?: 'packageName_mismatch' | 'signature_mismatch' | 'versionCode_low' | 'parse_failed' | 'not_native' | 'debuggable' | 'invalid_apk' | 'generic';
  errorDetails?: string;
  installed?: {
    packageName: string;
    versionName: string;
    versionCode: number;
    signingSha256: string;
    debuggable: boolean;
  };
  downloaded?: {
    packageName: string;
    versionName: string;
    versionCode: number;
    signingSha256: string;
    debuggable: boolean;
    minSdk: number;
    targetSdk: number;
    isValidApk: boolean;
    isUniversalApk: boolean;
  };
}

export async function checkApkEligibility(filePath: string, allowDowngrade?: boolean): Promise<InstallEligibility> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) {
    return { eligible: true, reason: 'not_native' };
  }

  try {
    const installed = await AppInstaller.getInstalledAppInfo();
    const downloadedInspect = await AppInstaller.inspectApk({ filePath });

    const downloaded = {
      packageName: downloadedInspect.packageName,
      versionName: downloadedInspect.versionName,
      versionCode: downloadedInspect.versionCode,
      signingSha256: downloadedInspect.signingSha256,
      debuggable: downloadedInspect.debuggable,
      minSdk: downloadedInspect.minSdk,
      targetSdk: downloadedInspect.targetSdk,
      isValidApk: downloadedInspect.isValidApk,
      isUniversalApk: downloadedInspect.isUniversalApk,
      certificateSubject: downloadedInspect.certificateSubject,
      certificateIssuer: downloadedInspect.certificateIssuer,
    };

    if (!downloaded.isValidApk) {
      return {
        eligible: false,
        reason: 'invalid_apk',
        errorDetails: 'The downloaded APK package appears invalid, corrupted, or incomplete.',
        installed,
        downloaded
      };
    }

    if (installed.packageName !== downloaded.packageName) {
      return {
        eligible: false,
        reason: 'packageName_mismatch',
        errorDetails: `Package name mismatch. Installed: ${installed.packageName}, Downloaded: ${downloaded.packageName}`,
        installed,
        downloaded
      };
    }

    const cleanInstSig = installed.signingSha256.replace(/:/g, '').toLowerCase();
    const cleanDownSig = downloaded.signingSha256.replace(/:/g, '').toLowerCase();
    if (cleanInstSig !== cleanDownSig) {
      return {
        eligible: false,
        reason: 'signature_mismatch',
        errorDetails: `Signing certificate fingerprint mismatch. Installed: ${installed.signingSha256}, Downloaded: ${downloaded.signingSha256}`,
        installed,
        downloaded
      };
    }

    if (!allowDowngrade && downloaded.versionCode <= installed.versionCode) {
      return {
        eligible: false,
        reason: 'versionCode_low',
        errorDetails: `Version code is not higher than installed version. Installed: ${installed.versionCode}, Downloaded: ${downloaded.versionCode}`,
        installed,
        downloaded
      };
    }

    if (downloaded.debuggable && !installed.debuggable) {
      return {
        eligible: false,
        reason: 'debuggable',
        errorDetails: 'The update package is a debuggable build and cannot be installed on top of the release version.',
        installed,
        downloaded
      };
    }

    return {
      eligible: true,
      installed,
      downloaded
    };
  } catch (err) {
    console.error('[apkDownloader] Eligibility check failed:', err);
    return {
      eligible: false,
      reason: 'parse_failed',
      errorDetails: err instanceof Error ? err.message : String(err)
    };
  }
}

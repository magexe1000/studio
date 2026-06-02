import { registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface AppInstallerPlugin {
  installApk(options: { filePath: string }): Promise<void>;
  downloadAndInstallApk(options: { url: string }): Promise<void>;
  downloadApk(options: { url: string }): Promise<{ filePath: string }>;
  checkPermissions(): Promise<any>;
  requestPermissions(options?: { aliases?: string[] }): Promise<any>;
  getSharedFile(): Promise<{ none?: boolean; type?: 'json' | 'audio'; data?: string; fileName?: string }>;
  setSecureValue(options: { key: string; value: string | null }): Promise<void>;
  getSecureValue(options: { key: string }): Promise<{ value: string | null }>;
  removeSecureValue(options: { key: string }): Promise<void>;
  canRequestPackageInstalls(): Promise<{ value: boolean }>;
  openUnknownAppSourcesSettings(): Promise<void>;
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
    await AppInstaller.downloadAndInstallApk({ url });
    
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
  onProgress?: (progress: number) => void
): Promise<string> {
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
    
    console.log(`[apkDownloader] Invoking native downloadApk for ${url}`);
    const res = await AppInstaller.downloadApk({ url });
    
    if (progressListener) {
      await progressListener.remove();
    }
    
    return res.filePath;
  } catch (err) {
    if (progressListener) {
      await progressListener.remove();
    }
    console.error('[apkDownloader] Native downloadApk failed:', err);
    throw err;
  }
}

/**
 * Verifies the SHA-256 hash of a file at the given absolute path.
 */
export async function verifyApkSha256(filePath: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash) {
    console.warn('[apkDownloader] No expected hash provided for verification.');
    return true; // Skip if no hash provided
  }
  try {
    const result = await Filesystem.readFile({
      path: filePath
    });
    
    const base64Data = typeof result.data === 'string' ? result.data : '';
    if (!base64Data) {
      console.warn('[apkDownloader] Empty file content read for hash verification.');
      return false;
    }
    
    // Convert base64 to binary array buffer
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes.buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const matches = hashHex.toLowerCase() === expectedHash.toLowerCase();
    console.log(`[apkDownloader] SHA-256 verification: Expected=${expectedHash.toLowerCase()}, Computed=${hashHex}, Matches=${matches}`);
    return matches;
  } catch (err) {
    console.error('[apkDownloader] Error verifying APK SHA-256:', err);
    return false;
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
 * Directs the user to the system settings page to enable 'Install unknown apps'.
 */
export async function openInstallPermissionSettings(): Promise<void> {
  console.log('[apkDownloader] Opening unknown app sources settings');
  await AppInstaller.openUnknownAppSourcesSettings();
}

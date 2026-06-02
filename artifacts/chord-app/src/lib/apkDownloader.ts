import { registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface AppInstallerPlugin {
  installApk(options: { filePath: string }): Promise<void>;
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
  const fallbackVersion = targetVersion || '3.1.86';
  const fallbackUrl = `https://github.com/MAGEXE1000/Studio/releases/download/v${fallbackVersion}/studio-debug.apk`;
  
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
          a => a.name === 'studio-debug.apk' || a.name === 'app-debug.apk'
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
          a => a.name === 'studio-debug.apk' || a.name === 'app-debug.apk'
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
 * Downloads the APK from the specified URL and launches the native package installer.
 */
export async function downloadAndInstallApk(
  url: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const fileName = 'studio-debug.apk';
  let progressListener: any = null;
  
  try {
    // Register the download progress listener if a callback is provided
    if (onProgress) {
      try {
        progressListener = await Filesystem.addListener('progress', (status: any) => {
          if (status && typeof status.bytes === 'number') {
            const total = status.contentLength || 89299955; // fallback to ~89MB if chunked/not set
            const percent = Math.min(99, Math.round((status.bytes / total) * 100));
            onProgress(percent);
          }
        });
      } catch (err) {
        console.warn('[apkDownloader] Failed to add progress listener:', err);
      }
    }
    
    console.log(`[apkDownloader] Starting download from ${url}`);
    
    // Download the file directly in native code
    const downloadResult = await Filesystem.downloadFile({
      url,
      path: fileName,
      directory: Directory.Cache,
      progress: true
    });
    
    if (progressListener) {
      await progressListener.remove();
      progressListener = null;
    }
    
    if (onProgress) {
      onProgress(100);
    }
    
    // Get the absolute path to the downloaded file
    const localPath = downloadResult.path;
    if (!localPath) {
      throw new Error('Download succeeded but local path is empty');
    }
    
    console.log(`[apkDownloader] Download completed to ${localPath}, invoking native installer`);
    
    // Trigger native installation
    await AppInstaller.installApk({ filePath: localPath });
    
  } catch (err) {
    if (progressListener) {
      await progressListener.remove();
    }
    console.error('[apkDownloader] Installation failed:', err);
    throw err;
  }
}

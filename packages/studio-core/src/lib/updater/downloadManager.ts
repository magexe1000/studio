import { downloadApk, resolveApkUrl, AppInstaller } from '../apkDownloader';
import { updateGlobalState, resetDownloadWatchdog, globalOtaState } from './stateMachine';
import { otaDebugLogs, logProgressStage, nextJsCallId } from './diagnostics';

export interface DownloadOptions {
  url: string;
  version: string;
  manualApkUrl?: string;
  fallbackApkUrl?: string;
  onProgress?: (progress: number) => void;
}

export async function downloadUpdateApk(options: DownloadOptions): Promise<string> {
  const { url, version, manualApkUrl, fallbackApkUrl, onProgress } = options;
  const fileName = `studio-update-${version}.apk`;
  
  const sources = [
    url,
    manualApkUrl,
    fallbackApkUrl
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
          resetDownloadWatchdog();
          if (onProgress) {
            onProgress(percent);
          } else {
            updateGlobalState({ 
              progress: Math.max(0, Math.min(1, percent / 100)),
              statusText: `Downloading update (${Math.round(percent)}%)`
            });
          }
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
    const baseErr = lastDownloadError || new Error('All download sources failed.');
    throw new Error('[Download] ' + baseErr.message);
  }
  
  return filePath;
}

export async function downloadAndInstallGitHubApk(): Promise<void> {
  const callId = nextJsCallId();
  console.log(`[INSTRUMENTATION] downloadAndInstallGitHubApk ENTER Call #${callId}`);
  void logProgressStage('[INSTRUMENTATION] downloadAndInstallGitHubApk ENTER', `Call #${callId}`);

  updateGlobalState({ loading: true, progress: 0, statusText: 'Resolving latest GitHub Release...' });
  try {
    const gitHubApkUrl = await resolveApkUrl(globalOtaState.remoteVersion ?? undefined);
    
    otaDebugLogs.currentDownloadSource = gitHubApkUrl;
    otaDebugLogs.downloadStatus = `Downloading GitHub package: ${gitHubApkUrl}`;
    updateGlobalState({ statusText: 'Downloading from GitHub...' });
    
    const { filePath } = await AppInstaller.downloadApk({ url: gitHubApkUrl, fileName: `studio-github-${globalOtaState.remoteVersion || 'latest'}.apk` });
    
    otaDebugLogs.downloadStatus += `\nDownload finished. Path: ${filePath}`;
    updateGlobalState({ progress: 1.0, statusText: 'Verifying package signatures...' });
    
    if (globalOtaState.apkSha256) {
      updateGlobalState({ statusText: 'Verifying SHA-256...' });
      const shaMatches = (await AppInstaller.verifyApkSha256({ filePath, expectedHash: globalOtaState.apkSha256 })).matches;
      otaDebugLogs.shaVerification = shaMatches ? 'SUCCESS' : 'FAILED';
      if (!shaMatches) {
        throw new Error('SHA-256 checksum verification failed.');
      }
    }
    
    const info = await AppInstaller.inspectApk({ filePath });
    otaDebugLogs.downloadedIsValidApk = info.isValidApk;
    otaDebugLogs.downloadedSigningSha256 = info.signingSha256;
    if (!info.isValidApk) {
      throw new Error('The downloaded package is not a valid APK.');
    }
    
    updateGlobalState({ statusText: 'Launching package installer...' });
    await AppInstaller.installApk({ filePath });
    
    updateGlobalState({ updateState: 'idle', loading: false });
    console.log(`[INSTRUMENTATION] downloadAndInstallGitHubApk EXIT Call #${callId} Success`);
  } catch (err: any) {
    console.error(`[INSTRUMENTATION] downloadAndInstallGitHubApk EXIT Call #${callId} error:`, err);
    updateGlobalState({ 
      loading: false,
      error: `GitHub installation failed: ${err.message || String(err)}`
    });
  }
}

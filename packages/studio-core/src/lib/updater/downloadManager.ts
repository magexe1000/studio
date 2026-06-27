import { downloadApk } from '../apkDownloader';
import { updateGlobalState, resetDownloadWatchdog } from './stateMachine';
import { otaDebugLogs, logProgressStage } from './diagnostics';

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

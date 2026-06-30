import { Filesystem, Directory } from '@capacitor/filesystem';
import { AppInstaller } from '../apkDownloader';

export async function getLocalApkPath(version: string): Promise<string> {
  const fileName = `studio-update-${version}.apk`;
  const uriResult = await Filesystem.getUri({
    directory: Directory.Cache,
    path: fileName
  });
  return uriResult.uri;
}

export async function validateLocalApk(version: string, expectedSha256?: string): Promise<{ valid: boolean; filePath: string }> {
  let filePath = '';
  try {
    filePath = await getLocalApkPath(version);
    
    // 1. Check if file exists
    const stat = await Filesystem.stat({ path: filePath });
    if (!stat || stat.size === 0) {
      return { valid: false, filePath };
    }
    
    // 2. Validate SHA256 if provided
    if (expectedSha256) {
      const shaRes = await AppInstaller.verifySha256({ filePath, expectedHash: expectedSha256 });
      if (!shaRes.matches) {
        console.warn(`[Smart Recovery] SHA-256 mismatch for cached APK: ${filePath}`);
        return { valid: false, filePath };
      }
    }
    
    // 3. Inspect APK using native tool
    const inspect = await AppInstaller.inspectApk({ filePath });
    if (!inspect.isValidApk) {
      console.warn(`[Smart Recovery] Invalid APK structure: ${filePath}`);
      return { valid: false, filePath };
    }
    
    // 4. Validate package name
    if (inspect.packageName !== 'com.chordex.app') {
      console.warn(`[Smart Recovery] Package name mismatch: ${inspect.packageName}`);
      return { valid: false, filePath };
    }
    
    // 5. Validate signing certificate
    const expectedFingerprint = '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206';
    const cleanFingerprint = inspect.signingSha256.replace(/:/g, '').toLowerCase();
    if (cleanFingerprint !== expectedFingerprint) {
      console.warn(`[Smart Recovery] Signing certificate mismatch: ${cleanFingerprint}`);
      return { valid: false, filePath };
    }
    
    // 6. Validate version name
    const cleanInspectVersion = inspect.versionName.replace(/^[vV]/, '').trim();
    const cleanTargetVersion = version.replace(/^[vV]/, '').trim();
    if (cleanInspectVersion !== cleanTargetVersion) {
      console.warn(`[Smart Recovery] Version mismatch: cached v${cleanInspectVersion} vs target v${cleanTargetVersion}`);
      return { valid: false, filePath };
    }
    
    return { valid: true, filePath };
  } catch (err) {
    console.log(`[Smart Recovery] Local APK validation failed or file does not exist:`, err);
    return { valid: false, filePath };
  }
}

export async function deleteLocalApk(version: string): Promise<void> {
  try {
    const filePath = await getLocalApkPath(version);
    await Filesystem.deleteFile({ path: filePath });
    console.log(`[Smart Recovery] Cleaned up invalid cached APK: ${filePath}`);
  } catch (err) {
    // File might not exist, which is fine
  }
}

export const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function recordDismissal(version: string | null) {
  if (!version) return;
  try {
    localStorage.setItem('studio:lastDismissedRecoveryVersion', version);
    localStorage.setItem('studio:lastDismissedRecoveryTimestamp', Date.now().toString());
    console.log(`[Recovery Reminder] Dismissal recorded for v${version}`);
  } catch (err) {
    console.warn('[Recovery Reminder] Failed to record dismissal:', err);
  }
}

export function shouldShowRecoveryReminder(remoteVersion: string | null): boolean {
  if (!remoteVersion) return false;
  try {
    const lastDismissedVer = localStorage.getItem('studio:lastDismissedRecoveryVersion');
    const lastDismissedTime = localStorage.getItem('studio:lastDismissedRecoveryTimestamp');
    
    if (lastDismissedVer && lastDismissedVer !== remoteVersion) {
      return true;
    }
    
    if (lastDismissedTime) {
      const parsedTime = parseInt(lastDismissedTime, 10);
      if (!isNaN(parsedTime)) {
        const elapsed = Date.now() - parsedTime;
        if (elapsed < REMINDER_INTERVAL_MS) {
          return false;
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('[Recovery Reminder] Failed to read reminder state:', err);
    return true;
  }
}

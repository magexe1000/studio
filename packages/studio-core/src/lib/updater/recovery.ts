import { AppInstaller } from '../apkDownloader';
import { runEligibilityCheck } from './eligibilityVerification';
import { updateGlobalState } from './stateMachine';
import { otaDebugLogs, logProgressStage, nextJsCallId } from './diagnostics';

export let isRecovering = false;

export function setIsRecovering(val: boolean) {
  isRecovering = val;
}

export async function runSignatureMismatchRecovery(
  applyUpdate: (trigger?: string) => Promise<void>,
  downloadUpdate: (trigger?: string) => Promise<void>
): Promise<boolean> {
  const callId = nextJsCallId();
  console.log(`[INSTRUMENTATION] runSignatureMismatchRecovery ENTER Call #${callId}`);
  void logProgressStage('[INSTRUMENTATION] runSignatureMismatchRecovery ENTER', `Call #${callId}`);

  isRecovering = true;
  const steps: string[] = [];
  otaDebugLogs.recoveryAttemptsPerformed = steps;
  updateGlobalState({ statusText: 'Running signature recovery...' });

  const filePath = localStorage.getItem('studio:downloadedApkPath');
  if (!filePath) {
    steps.push('Revalidate APK: Failed (No downloaded APK path found)');
    isRecovering = false;
    updateGlobalState({ updateState: 'signature_mismatch' });
    return false;
  }

  // Stage 1: Revalidate APK
  steps.push('Revalidating cached APK...');
  updateGlobalState({ statusText: 'Revalidating APK...' });
  const isEligible = await runEligibilityCheck(filePath);
  if (isEligible) {
    steps.push('Revalidate APK: Passed! Retrying installation.');
    updateGlobalState({ statusText: 'Retrying installation...' });
    try {
      await applyUpdate('Recovery: Stage 1');
      steps.push('Retry Installation: Success');
      isRecovering = false;
      return true;
    } catch (e: any) {
      steps.push(`Retry Installation: Failed (${e.message || String(e)})`);
    }
  } else {
    steps.push(`Revalidate APK: Failed (Reason: ${otaDebugLogs.eligibilityReason || 'unknown'})`);
  }

  // Stage 2: Recreate PackageInstaller session
  steps.push('Clearing installer session caches...');
  updateGlobalState({ statusText: 'Recreating session...' });
  try {
    await AppInstaller.clearInstallerLogHistory();
    steps.push('PackageInstaller Session: Cleared and recreated');
  } catch (e: any) {
    steps.push(`PackageInstaller Session Reset: Failed (${e.message || String(e)})`);
  }

  // Stage 3: Retry installation after recreation
  steps.push('Retrying installation with fresh session...');
  updateGlobalState({ statusText: 'Retrying install (fresh session)...' });
  try {
    await applyUpdate('Recovery: Stage 2');
    steps.push('Fresh Session Install: Success');
    isRecovering = false;
    return true;
  } catch (e: any) {
    steps.push(`Fresh Session Install: Failed (${e.message || String(e)})`);
  }

  // Stage 4: Re-download APK
  steps.push('Re-downloading APK package...');
  updateGlobalState({ statusText: 'Re-downloading APK...' });
  try {
    const { Filesystem } = await import('@capacitor/filesystem');
    await Filesystem.deleteFile({
      path: filePath
    }).catch(() => {});
    steps.push('Old APK cache cleared');

    await downloadUpdate('Recovery: Stage 4');
    steps.push('APK download completed successfully');

    const newFilePath = localStorage.getItem('studio:downloadedApkPath');
    if (newFilePath) {
      const newEligible = await runEligibilityCheck(newFilePath);
      if (newEligible) {
        steps.push('Post-download validation: Passed! Installing...');
        updateGlobalState({ statusText: 'Installing new download...' });
        await applyUpdate('Recovery: Stage 4 post-download');
        steps.push('Post-download Install: Success');
        isRecovering = false;
        return true;
      } else {
        steps.push(`Post-download validation: Failed (Reason: ${otaDebugLogs.eligibilityReason || 'unknown'})`);
      }
    } else {
      steps.push('Post-download validation: Failed (No new file path)');
    }
  } catch (e: any) {
    steps.push(`Re-download Flow: Failed (${e.message || String(e)})`);
  }

  isRecovering = false;
  updateGlobalState({ updateState: 'signature_mismatch' });
  return false;
}

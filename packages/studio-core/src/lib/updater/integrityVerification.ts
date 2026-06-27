import { verifyApkSha256 } from '../apkDownloader';
import { transitionToState, updateGlobalState } from './stateMachine';
import { otaDebugLogs, logProgressStage } from './diagnostics';

export async function verifyFileIntegrity(filePath: string, expectedHash: string): Promise<void> {
  otaDebugLogs.downloadStatus += `\nStarting SHA verification (Expected: ${expectedHash})...`;
  transitionToState('verifying', 'Starting SHA verification');
  updateGlobalState({ statusText: 'Verifying package' });

  const isValid = await verifyApkSha256(filePath, expectedHash);
  void logProgressStage('SHA verified', isValid ? 'SHA validation successful' : 'SHA validation failed');
  otaDebugLogs.shaVerification = isValid ? 'SUCCESS' : 'FAILED';

  if (!isValid) {
    throw new Error('[SHA Verification] APK hash verification failed (corrupted download)');
  }
}

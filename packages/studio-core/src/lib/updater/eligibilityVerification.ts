import { checkApkEligibility } from '../apkDownloader';
import { PRODUCTION_SIGNING_SHA256 } from '../appVersion';
import { globalOtaState, updateGlobalState } from './stateMachine';
import { otaDebugLogs, logProgressStage, nextJsCallId } from './diagnostics';

let eligibilityCheckCallCount = 0;

export async function runEligibilityCheck(filePath: string, allowDowngrade?: boolean): Promise<boolean> {
  eligibilityCheckCallCount++;
  const callId = nextJsCallId();
  console.log(`[INSTRUMENTATION] runEligibilityCheck ENTER Call #${callId} (filePath=${filePath}, total calls: ${eligibilityCheckCallCount})`);
  void logProgressStage('[INSTRUMENTATION] runEligibilityCheck ENTER', `Call #${callId} filePath=${filePath}`);
  try {
    const el = await checkApkEligibility(filePath, allowDowngrade);
    
    // Populate installed app info
    otaDebugLogs.installedPackageName = el.installed?.packageName ?? null;
    otaDebugLogs.installedVersionName = el.installed?.versionName ?? null;
    otaDebugLogs.installedVersionCode = el.installed?.versionCode ?? null;
    otaDebugLogs.installedSigningSha256 = el.installed?.signingSha256 ?? null;
    otaDebugLogs.installedDebuggable = el.installed?.debuggable ?? null;

    // Populate downloaded APK info
    otaDebugLogs.downloadedPackageName = el.downloaded?.packageName ?? null;
    otaDebugLogs.downloadedVersionName = el.downloaded?.versionName ?? null;
    otaDebugLogs.downloadedVersionCode = el.downloaded?.versionCode ?? null;
    otaDebugLogs.downloadedSigningSha256 = el.downloaded?.signingSha256 ?? null;
    otaDebugLogs.downloadedDebuggable = el.downloaded?.debuggable ?? null;
    otaDebugLogs.downloadedApkPath = filePath;
    otaDebugLogs.downloadedIsValidApk = el.downloaded?.isValidApk ?? null;
    otaDebugLogs.downloadedIsUniversalApk = el.downloaded?.isUniversalApk ?? null;
    
    // Get file size from filesystem
    try {
      const { Filesystem } = await import('@capacitor/filesystem');
      const info = await Filesystem.stat({ path: filePath });
      otaDebugLogs.downloadedApkSize = `${(info.size / (1024 * 1024)).toFixed(2)} MB (${info.size} bytes)`;
    } catch {
      otaDebugLogs.downloadedApkSize = 'N/A';
    }
    otaDebugLogs.downloadedApkSha256 = globalOtaState.apkSha256 ?? null;

    // Populate eligibility checks
    if (el.installed && el.downloaded) {
      otaDebugLogs.eligibilityPackageNameMatch = el.installed.packageName === el.downloaded.packageName;
      otaDebugLogs.eligibilitySigningMatch = (el.installed.signingSha256 || '').replace(/:/g, '').toLowerCase() === (el.downloaded.signingSha256 || '').replace(/:/g, '').toLowerCase();
      otaDebugLogs.eligibilityVersionCodeHigher = el.downloaded.versionCode > el.installed.versionCode;
      otaDebugLogs.eligibilityReleaseBuild = el.downloaded.debuggable === false;
      otaDebugLogs.eligibilityValidApk = el.downloaded.isValidApk === true;
      
      // Detailed diagnostics fields
      otaDebugLogs.certificateSubject = (el.downloaded as any).certificateSubject || (el.installed as any).certificateSubject || 'CN=Unknown Subject';
      otaDebugLogs.certificateIssuer = (el.downloaded as any).certificateIssuer || (el.installed as any).certificateIssuer || 'CN=Unknown Issuer';
      otaDebugLogs.expectedSigningSha256 = PRODUCTION_SIGNING_SHA256.toLowerCase().replace(/:/g, '').trim();
      otaDebugLogs.validationStage = 'Post-Download Package Verification';
      otaDebugLogs.exactFailingStage = el.reason === 'signature_mismatch' ? 'Certificate Fingerprint Match Check' : (el.reason === 'packageName_mismatch' ? 'Package Name Match Check' : 'Version/Metadata Match Check');
      otaDebugLogs.rootCause = el.reason === 'signature_mismatch' 
        ? `Signing certificate mismatch. Expected production fingerprint: ${PRODUCTION_SIGNING_SHA256}, but the downloaded APK was signed with fingerprint: ${el.downloaded.signingSha256 || 'N/A'}`
        : el.errorDetails || 'N/A';
      otaDebugLogs.suggestedFix = el.reason === 'signature_mismatch'
        ? 'Re-sign the update package using the official production key corresponding to the production certificate fingerprint, or reinstall the official production app release.'
        : 'Ensure package is built and signed correctly.';
    } else {
      otaDebugLogs.eligibilityPackageNameMatch = null;
      otaDebugLogs.eligibilitySigningMatch = null;
      otaDebugLogs.eligibilityVersionCodeHigher = null;
      otaDebugLogs.eligibilityReleaseBuild = null;
      otaDebugLogs.eligibilityValidApk = null;
    }
    
    otaDebugLogs.eligibilityFinalInstall = el.eligible ? 'can install' : 'cannot install';
    otaDebugLogs.eligibilityReason = el.reason ?? null;
    otaDebugLogs.apkEligibilityResult = el.eligible ? 'eligible' : (el.reason ?? 'unknown');

    if (!el.eligible) {
      if (el.reason === 'signature_mismatch') {
        updateGlobalState({ updateState: 'signature_mismatch' });
      } else if (el.reason === 'versionCode_low') {
        updateGlobalState({ updateState: 'versionCode_low' });
      } else {
        updateGlobalState({
          updateState: 'failed',
          error: el.errorDetails || 'APK eligibility validation failed.'
        });
      }
      console.log(`[INSTRUMENTATION] runEligibilityCheck EXIT Call #${callId} returns: false (reason: ${el.reason})`);
      void logProgressStage('[INSTRUMENTATION] runEligibilityCheck EXIT', `Call #${callId} returns=false reason=${el.reason}`);
      return false;
    }
    
    console.log(`[INSTRUMENTATION] runEligibilityCheck EXIT Call #${callId} returns: true`);
    void logProgressStage('[INSTRUMENTATION] runEligibilityCheck EXIT', `Call #${callId} returns=true`);
    return true;
  } catch (err) {
    console.error(`[INSTRUMENTATION] runEligibilityCheck EXIT Call #${callId} error:`, err);
    void logProgressStage('[INSTRUMENTATION] runEligibilityCheck EXIT', `Call #${callId} failed err=${err instanceof Error ? err.message : String(err)}`);
    console.error('[OTA] Eligibility helper check failed:', err);
    otaDebugLogs.eligibilityFinalInstall = 'cannot install';
    otaDebugLogs.eligibilityReason = 'parse_failed';
    otaDebugLogs.apkEligibilityResult = 'parse_failed';
    updateGlobalState({
      updateState: 'failed',
      error: err instanceof Error ? err.message : String(err)
    });
    return false;
  }
}

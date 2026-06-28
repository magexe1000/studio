export type OtaUpdateState =
  | 'idle'
  | 'checking'
  | 'update_available'
  | 'manual_apk_required'
  | 'downloading'
  | 'verifying'
  | 'verifying_sha'
  | 'verifying_eligibility'
  | 'ready_to_install'
  | 'installing'
  | 'installed'
  | 'download_failed'
  | 'sha_failed'
  | 'eligibility_failed'
  | 'install_failed'
  | 'failed'
  | 'signature_mismatch'
  | 'versionCode_low'
  | 'waiting_for_confirmation'
  | 'completed';


export interface StructuredReleaseNotes {
  added?: string[];
  improved?: string[];
  fixed?: string[];
  changed?: string[];
}

export interface CentralizedOtaState {
  updateState: OtaUpdateState;
  loading: boolean;
  progress: number;
  error: string | null;
  statusText: string | null;
  remoteVersion: string | null;
  updateAvailable: boolean;
  mandatory: boolean;
  changelog: string | null;
  releaseNotes: string[] | StructuredReleaseNotes | null;
  packageName: string | null;
  apkUrl: string | null;
  apkSha256: string | null;
  manualApkUrl: string | null;
  fallbackApkUrl: string | null;
  downloadUrl: string | null;
  // Recovery Mode fields
  consecutiveFailures: number;
  activeFallback: string | null;
  recoveryMode: boolean;
  // Version comparison fields
  updateType: 'ota' | 'apk' | 'both' | 'none';
  reinstallRequired: boolean;
  requiredVersionCode: number;
  apkUpdateRequired: boolean;
  validApkExists: boolean;
}

export let globalOtaState: CentralizedOtaState = {
  updateState: 'idle',
  loading: false,
  progress: 0,
  error: null,
  statusText: null,
  remoteVersion: null,
  updateAvailable: false,
  mandatory: false,
  changelog: null,
  releaseNotes: null,
  packageName: null,
  apkUrl: null,
  apkSha256: null,
  manualApkUrl: null,
  fallbackApkUrl: null,
  downloadUrl: null,
  consecutiveFailures: 0,
  activeFallback: null,
  recoveryMode: false,
  updateType: 'none',
  reinstallRequired: false,
  requiredVersionCode: 0,
  apkUpdateRequired: false,
  validApkExists: false,
};

export const stateListeners = new Set<(state: CentralizedOtaState) => void>();

export function updateGlobalState(patch: Partial<CentralizedOtaState>) {
  globalOtaState = { ...globalOtaState, ...patch };
  stateListeners.forEach((l) => l(globalOtaState));
}

let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

export function stopWatchdog() {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

export function transitionToState(state: OtaUpdateState, reason: string) {
  console.log(`[OTA STATE] Transitioning to: ${state}. Reason: ${reason}`);
  stopWatchdog();

  const current = globalOtaState.updateState;
  let isValid = true;

  if (current === state) {
    // Self-transition is fine
  } else if (current === 'idle') {
    isValid = state === 'checking';
  } else if (current === 'checking') {
    isValid = ['update_available', 'manual_apk_required', 'idle', 'failed'].includes(state);
  } else if (current === 'update_available') {
    isValid = state === 'downloading';
  } else if (current === 'manual_apk_required') {
    isValid = ['idle', 'checking'].includes(state);
  } else if (current === 'downloading') {
    isValid = ['verifying', 'verifying_sha', 'download_failed', 'failed', 'idle'].includes(state);
  } else if (current === 'verifying') {
    isValid = ['ready_to_install', 'verifying_eligibility', 'failed', 'idle'].includes(state);
  } else if (current === 'verifying_sha') {
    isValid = ['verifying_eligibility', 'sha_failed', 'failed', 'idle'].includes(state);
  } else if (current === 'verifying_eligibility') {
    isValid = ['ready_to_install', 'eligibility_failed', 'signature_mismatch', 'versionCode_low', 'failed', 'idle'].includes(state);
  } else if (current === 'ready_to_install') {
    isValid = ['waiting_for_confirmation', 'installing', 'failed', 'idle'].includes(state);
  } else if (current === 'waiting_for_confirmation') {
    isValid = ['installing', 'failed', 'idle'].includes(state);
  } else if (current === 'installing') {
    isValid = ['installed', 'install_failed', 'failed', 'idle'].includes(state);
  } else if (current === 'installed') {
    isValid = ['idle', 'checking'].includes(state);
  } else if (['download_failed', 'sha_failed', 'eligibility_failed', 'install_failed'].includes(current)) {
    isValid = state === 'failed';
  } else if (['failed', 'signature_mismatch', 'versionCode_low'].includes(current)) {
    isValid = ['checking', 'downloading', 'idle'].includes(state);
  }

  if (!isValid) {
    console.warn(`[OTA STATE WARNING] Invalid transition: ${current} -> ${state} (Reason: ${reason}). Resetting to idle.`);
    state = 'idle';
  }

  // Setup watchdog timers for transient states
  if (state === 'checking') {
    watchdogTimer = setTimeout(() => {
      if (globalOtaState.updateState === 'checking') {
        handleWatchdogTimeout('Checking for updates timed out (10s). Server was unreachable.');
      }
    }, 10000);
  } else if (state === 'downloading') {
    resetDownloadWatchdog();
  } else if (['verifying', 'verifying_sha', 'verifying_eligibility'].includes(state)) {
    watchdogTimer = setTimeout(() => {
      if (['verifying', 'verifying_sha', 'verifying_eligibility'].includes(globalOtaState.updateState)) {
        handleWatchdogTimeout('Verification timed out (20s). Package may be corrupted.');
      }
    }, 20000);
  } else if (state === 'installing') {
    watchdogTimer = setTimeout(() => {
      if (globalOtaState.updateState === 'installing') {
        handleWatchdogTimeout('Installation confirmation timed out (120s).');
      }
    }, 120000);
  }

  updateGlobalState({
    updateState: state,
    loading: ['checking', 'downloading', 'verifying', 'verifying_sha', 'verifying_eligibility', 'installing'].includes(state),
    error: ['failed', 'download_failed', 'sha_failed', 'eligibility_failed', 'install_failed'].includes(state) ? globalOtaState.error : null,
  });
}

export function resetDownloadWatchdog() {
  stopWatchdog();
  if (globalOtaState.updateState === 'downloading') {
    watchdogTimer = setTimeout(() => {
      if (globalOtaState.updateState === 'downloading') {
        handleWatchdogTimeout('Download stalled. No progress received for 30 seconds.');
      }
    }, 30000);
  }
}

export function handleWatchdogTimeout(errorMsg: string) {
  console.warn(`[Watchdog Timeout] ${errorMsg}. Resetting to failed.`);
  stopWatchdog();
  updateGlobalState({
    updateState: 'failed',
    loading: false,
    error: errorMsg,
  });
}

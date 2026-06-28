import { updateGlobalState } from './stateMachine';

export interface UpdaterSimulation {
  forceUpdateAvailable: boolean;
  forceNoUpdate: boolean;
  forceDowngrade: boolean;
  forceMandatoryUpdate: boolean;
  forceOptionalUpdate: boolean;
  forceApkUpdate: boolean;
  forceOtaUpdate: boolean;
  
  forceSignatureMismatch: boolean;
  forceShaFailure: boolean;
  forceMetadataFailure: boolean;
  forceInvalidApk: boolean;
  forceDownloadFailure: boolean;
  forceDownloadTimeout: boolean;
  forceRecoveryMode: boolean;
  forceResumeDownload: boolean;
  forceCachedApk: boolean;
  
  // PackageInstaller Simulations
  forceInstallSuccess: boolean;
  forceInstallFailure: boolean;
  forceUserCancel: boolean;
  forcePendingUserAction: boolean;

  // Legacy compatibility fields
  simulateDownload: boolean;
  injectDownloadFailure: boolean;
  injectChecksumFailure: boolean;
  injectNetworkTimeout: boolean;
}

export const updaterSimulation: UpdaterSimulation = {
  forceUpdateAvailable: false,
  forceNoUpdate: false,
  forceDowngrade: false,
  forceMandatoryUpdate: false,
  forceOptionalUpdate: false,
  forceApkUpdate: false,
  forceOtaUpdate: false,
  
  forceSignatureMismatch: false,
  forceShaFailure: false,
  forceMetadataFailure: false,
  forceInvalidApk: false,
  forceDownloadFailure: false,
  forceDownloadTimeout: false,
  forceRecoveryMode: false,
  forceResumeDownload: false,
  forceCachedApk: false,
  
  forceInstallSuccess: false,
  forceInstallFailure: false,
  forceUserCancel: false,
  forcePendingUserAction: false,

  simulateDownload: false,
  injectDownloadFailure: false,
  injectChecksumFailure: false,
  injectNetworkTimeout: false,
};

// Logs and timelines stored in memory
export const jsLogs: { timestamp: number; message: string }[] = [];
export const nativeLogs: { timestamp: number; message: string }[] = [];
export const stateTimeline: { state: string; reason: string; timestamp: number }[] = [];
export const transitionHistory: {
  from: string;
  to: string;
  reason: string;
  timestamp: number;
  durationMs: number;
  invalid: boolean;
}[] = [];

export const rejectedTransitions: {
  from: string;
  attempted: string;
  reason: string;
  timestamp: number;
}[] = [];

export const activityLifecycleTimeline: { stage: string; timestamp: number }[] = [];

export function recordActivityLifecycle(stage: string) {
  activityLifecycleTimeline.push({ stage, timestamp: Date.now() });
}

export function addJsLog(msg: string) {
  const now = Date.now();
  jsLogs.push({ timestamp: now, message: msg });
  console.log(`[Updater Sim] JS Log: ${msg}`);
}

export function addNativeLog(msg: string) {
  const now = Date.now();
  nativeLogs.push({ timestamp: now, message: msg });
  console.log(`[Updater Sim] Native Log: ${msg}`);
}

export function recordStateTransition(state: string, reason: string) {
  stateTimeline.push({ state, reason, timestamp: Date.now() });
}

export function clearSimulationLogs() {
  jsLogs.length = 0;
  nativeLogs.length = 0;
  stateTimeline.length = 0;
  transitionHistory.length = 0;
  rejectedTransitions.length = 0;
}

export let simulateStatusCallback: ((eventData: any) => void) | null = null;

export function setSimulateStatusCallback(cb: ((eventData: any) => void) | null) {
  simulateStatusCallback = cb;
}

export function triggerSimulatedStatus(status: number, message = '', progress = 0) {
  addJsLog(`Simulating PackageInstaller status: ${status} (${message}) progress: ${progress}`);
  if (simulateStatusCallback) {
    simulateStatusCallback({ status, message, progress });
  } else {
    addJsLog('Warning: No active PackageInstaller listener to receive simulated status.');
  }
}

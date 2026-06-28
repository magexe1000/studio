import { updateGlobalState, transitionToState } from './stateMachine';

export interface UpdaterSimulation {
  forceUpdateAvailable: boolean;
  forceNoUpdate: boolean;
  forceDowngrade: boolean;
  forceMandatoryUpdate: boolean;
  forceOptionalUpdate: boolean;
  
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
  
  simulateDownload: false,
  injectDownloadFailure: false,
  injectChecksumFailure: false,
  injectNetworkTimeout: false,
};

// Logs and timelines stored in memory
export const jsLogs: string[] = [];
export const nativeLogs: string[] = [];
export const stateTimeline: { state: string; reason: string; timestamp: number }[] = [];
export const activityLifecycleTimeline: { stage: string; timestamp: number }[] = [];

export function addJsLog(msg: string) {
  const timestamp = new Date().toISOString();
  jsLogs.push(`[${timestamp}] ${msg}`);
  console.log(`[Updater Sim] JS Log: ${msg}`);
}

export function addNativeLog(msg: string) {
  const timestamp = new Date().toISOString();
  nativeLogs.push(`[${timestamp}] ${msg}`);
  console.log(`[Updater Sim] Native Log: ${msg}`);
}

export function recordStateTransition(state: string, reason: string) {
  stateTimeline.push({ state, reason, timestamp: Date.now() });
}

export function recordActivityLifecycle(stage: string) {
  activityLifecycleTimeline.push({ stage, timestamp: Date.now() });
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

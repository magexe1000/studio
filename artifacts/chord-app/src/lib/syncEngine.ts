import { doc, setDoc, deleteDoc, serverTimestamp, collection, onSnapshot, getDoc, Timestamp } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseStorage, getFirebaseAuth, getFirebaseProjectId, getFirebaseConfigDetails, getFirebaseInitError } from './firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useChordStore } from '../store/useChordStore';
import { isNative } from './capgoUpdater';
import { APP_VERSION, APP_COMMIT_SHA } from './appVersion';
import { subscribeAuth, signOut } from './auth';

// ── Types ──
export type SyncPhase = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncEngineStatus {
  authReady: boolean;
  authUid: string;
  authEmail: string;
  syncEngineStatus: 'inactive' | 'active' | 'error';
  activeListenerCount: number;
  lastAuthChangeAt: string;
  currentDeviceId: string;
  currentPlatform: string;

  // Firebase configurations
  firebaseAppsCount: number;
  firebaseAppName: string;
  firebaseProjectId: string;
  firebaseAppId: string;
  firebaseAuthDomain: string;
  firebaseStorageBucket: string;
  dbAvailable: boolean;
  authAvailable: boolean;
  storageAvailable: boolean;
  firebaseInitError: string;
  syncEngineInitError: string;
  devicesLogicVersion: string;
  syncEngineVersion: string;
  deviceWritePath: string;
  devicesListenerPath: string;
  listenerPath: string; // Back-compat duplicate of devicesListenerPath

  // Listeners
  devicesListenerStatus: 'idle' | 'attaching' | 'active' | 'error';
  devicesListenerError: string | null;
  devicesLastSnapshotAt: string;
  devicesSnapshotCount: number;
  devicesFromCache: boolean;
  devicesHasPendingWrites: boolean;

  profileListenerStatus: 'idle' | 'attaching' | 'active' | 'error';
  profileListenerError: string | null;
  profileLastSnapshotAt: string;
  profileFromCache: boolean;
  profileHasPendingWrites: boolean;

  appearanceListenerStatus: 'idle' | 'attaching' | 'active' | 'error';
  appearanceListenerError: string | null;
  appearanceLastSnapshotAt: string;
  appearanceFromCache: boolean;
  appearanceHasPendingWrites: boolean;

  preferencesListenerStatus: 'idle' | 'attaching' | 'active' | 'error';
  preferencesListenerError: string | null;
  preferencesLastSnapshotAt: string;
  preferencesFromCache: boolean;
  preferencesHasPendingWrites: boolean;

  probeListenerStatus: 'idle' | 'attaching' | 'active' | 'error';
  probeListenerError: string | null;
  probeLastSnapshotAt: string;
  probeFromCache: boolean;
  probeHasPendingWrites: boolean;

  // Write Stats
  lastDeviceWriteAttemptedAt: string;
  lastDeviceWriteSuccess: string;
  lastDeviceWriteError: string;
  lastDeviceWriteDurationMs: number | null;
  deviceRegistrationStatus: 'idle' | 'pending' | 'registered' | 'failed';
  lastDeviceRegistrationReason: string;
  inFlightWriteStatus: boolean;

  lastProfileWriteSuccess: string;
  lastProfileWriteError: string;
  lastAppearanceWriteSuccess: string;
  lastAppearanceWriteError: string;
  lastPreferencesWriteSuccess: string;
  lastPreferencesWriteError: string;
  lastPhotoUploadError: string;
  lastHeartbeatSuccess: string;
  lastHeartbeatError: string;

  // Sync Probe Stats
  probeWritePath: string;
  probeListenerPath: string;
  lastProbeWriteAttempt: string;
  lastProbeWriteSuccess: string;
  lastProbeWriteError: string;
  probeDocumentsReceived: number;
  probeDeviceIdsReceived: string[];
  probeNoncesReceived: string[];
  lastProbeSnapshotAt: string;
  androidProbeDetected: boolean;
  webProbeDetected: boolean;
  sameUidConfirmed: boolean;
  sameProjectConfirmed: boolean;

  // Cloud cache
  cloudTheme: string;
  cloudAccentColor: string;
  cloudDisplayName: string;
  cloudPhotoURL: string;
  cloudPreferences: any;

  // Render variables
  devices: any[];
  probeDocs: any[];
}

export type SyncEngineListener = (status: SyncEngineStatus) => void;

// ── State ──
let statusListeners = new Set<SyncEngineListener>();
let currentUid: string | null = null;
let cachedDeviceId: string | null = null;
let heartbeatInterval: any = null;

// Realtime snap unsubscribers
let unsubDevices: (() => void) | null = null;
let unsubProfile: (() => void) | null = null;
let unsubAppearance: (() => void) | null = null;
let unsubPreferences: (() => void) | null = null;
let unsubProbe: (() => void) | null = null;
let unsubAuth: (() => void) | null = null;

// Initial state
let engineStatus: SyncEngineStatus = {
  authReady: false,
  authUid: 'Not signed in',
  authEmail: 'N/A',
  syncEngineStatus: 'inactive',
  activeListenerCount: 0,
  lastAuthChangeAt: 'Never',
  currentDeviceId: 'Unknown',
  currentPlatform: isNative() ? 'android' : 'web',

  firebaseAppsCount: 0,
  firebaseAppName: 'None',
  firebaseProjectId: 'Not Configured',
  firebaseAppId: 'Not Configured',
  firebaseAuthDomain: 'Not Configured',
  firebaseStorageBucket: 'Not Configured',
  dbAvailable: false,
  authAvailable: false,
  storageAvailable: false,
  firebaseInitError: 'None',
  syncEngineInitError: 'None',
  devicesLogicVersion: 'devices-v3.6.10-sync-probe',
  syncEngineVersion: 'sync-engine-v1',
  deviceWritePath: 'N/A',
  devicesListenerPath: 'N/A',
  listenerPath: 'N/A',

  devicesListenerStatus: 'idle',
  devicesListenerError: null,
  devicesLastSnapshotAt: 'Never',
  devicesSnapshotCount: 0,
  devicesFromCache: false,
  devicesHasPendingWrites: false,

  profileListenerStatus: 'idle',
  profileListenerError: null,
  profileLastSnapshotAt: 'Never',
  profileFromCache: false,
  profileHasPendingWrites: false,

  appearanceListenerStatus: 'idle',
  appearanceListenerError: null,
  appearanceLastSnapshotAt: 'Never',
  appearanceFromCache: false,
  appearanceHasPendingWrites: false,

  preferencesListenerStatus: 'idle',
  preferencesListenerError: null,
  preferencesLastSnapshotAt: 'Never',
  preferencesFromCache: false,
  preferencesHasPendingWrites: false,

  probeListenerStatus: 'idle',
  probeListenerError: null,
  probeLastSnapshotAt: 'Never',
  probeFromCache: false,
  probeHasPendingWrites: false,

  lastDeviceWriteAttemptedAt: 'Never',
  lastDeviceWriteSuccess: 'Never',
  lastDeviceWriteError: 'None',
  lastDeviceWriteDurationMs: null,
  deviceRegistrationStatus: 'idle',
  lastDeviceRegistrationReason: 'None',
  inFlightWriteStatus: false,

  lastProfileWriteSuccess: 'Never',
  lastProfileWriteError: 'None',
  lastAppearanceWriteSuccess: 'Never',
  lastAppearanceWriteError: 'None',
  lastPreferencesWriteSuccess: 'Never',
  lastPreferencesWriteError: 'None',
  lastPhotoUploadError: 'None',
  lastHeartbeatSuccess: 'Never',
  lastHeartbeatError: 'None',

  probeWritePath: 'N/A',
  probeListenerPath: 'N/A',
  lastProbeWriteAttempt: 'Never',
  lastProbeWriteSuccess: 'Never',
  lastProbeWriteError: 'None',
  probeDocumentsReceived: 0,
  probeDeviceIdsReceived: [],
  probeNoncesReceived: [],
  lastProbeSnapshotAt: 'Never',
  androidProbeDetected: false,
  webProbeDetected: false,
  sameUidConfirmed: false,
  sameProjectConfirmed: false,

  cloudTheme: 'N/A',
  cloudAccentColor: 'N/A',
  cloudDisplayName: 'N/A',
  cloudPhotoURL: 'N/A',
  cloudPreferences: null,

  devices: [],
  probeDocs: [],
};

// ── Observers ──
export function subscribeSyncEngine(l: SyncEngineListener): () => void {
  statusListeners.add(l);
  l(engineStatus);
  return () => {
    statusListeners.delete(l);
  };
}

function updateStatus(patch: Partial<SyncEngineStatus>) {
  // Retrieve Firebase details dynamically from firebase.ts
  const config = getFirebaseConfigDetails();
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  const storage = getFirebaseStorage();
  
  const firebaseDiag = {
    firebaseAppsCount: config.appsCount,
    firebaseAppName: config.appName,
    firebaseProjectId: config.projectId,
    firebaseAppId: config.appId,
    firebaseAuthDomain: config.authDomain,
    firebaseStorageBucket: config.storageBucket,
    dbAvailable: !!db,
    authAvailable: !!auth,
    storageAvailable: !!storage,
    firebaseInitError: config.initError,
  };

  const nextStatus = { ...engineStatus, ...firebaseDiag, ...patch };

  // Calculate intended paths if uid and device ID exist
  const uid = nextStatus.authUid;
  const deviceIdVal = getStableDeviceId();
  const isAuthed = uid && uid !== 'Not signed in' && uid !== 'Not Configured';

  nextStatus.probeWritePath = isAuthed ? `users/${uid}/syncProbe/${deviceIdVal}` : 'N/A';
  nextStatus.probeListenerPath = isAuthed ? `users/${uid}/syncProbe` : 'N/A';
  nextStatus.devicesListenerPath = isAuthed ? `users/${uid}/devices` : 'N/A';
  nextStatus.listenerPath = isAuthed ? `users/${uid}/devices` : 'N/A';
  nextStatus.deviceWritePath = isAuthed ? `users/${uid}/devices/${deviceIdVal}` : 'N/A';

  engineStatus = nextStatus;

  statusListeners.forEach((l) => {
    try { l(engineStatus); } catch (e) { console.error('[syncEngine] listener error:', e); }
  });
}

// ── Device ID ──
export function getStableDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;

  // Search legacy keys
  const legacyKeys = ['studioDeviceId', 'chordex_device_id', 'chordexDeviceId', 'appDeviceId', 'deviceId', 'previousDeviceId'];
  for (const k of legacyKeys) {
    try {
      const val = localStorage.getItem(k);
      if (val && val.trim()) {
        cachedDeviceId = val.trim();
        localStorage.setItem('studioDeviceId', cachedDeviceId);
        updateStatus({ currentDeviceId: cachedDeviceId });
        return cachedDeviceId;
      }
    } catch {}
  }

  // Generate new stable ID
  const platform = isNative() ? 'android' : 'web';
  const randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `gen-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  
  cachedDeviceId = `${platform}-${randomUUID}`;
  try {
    localStorage.setItem('studioDeviceId', cachedDeviceId);
  } catch {}

  if (isNative()) {
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.set({ key: 'studioDeviceId', value: cachedDeviceId! }).catch(() => {});
    }).catch(() => {});
  }

  updateStatus({ currentDeviceId: cachedDeviceId });
  return cachedDeviceId;
}

export async function initializeDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'studioDeviceId' });
      if (value && value.trim()) {
        cachedDeviceId = value.trim();
        try { localStorage.setItem('studioDeviceId', cachedDeviceId); } catch {}
        updateStatus({ currentDeviceId: cachedDeviceId });
        return cachedDeviceId;
      }
    } catch {}
  }

  return getStableDeviceId();
}

// ── Device details extraction ──
export function getDeviceDetails() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let os = 'Unknown OS';
  let model = 'Browser';
  let manufacturer = 'N/A';

  if (/windows/i.test(ua)) {
    os = 'Windows';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/android/i.test(ua)) {
    os = 'Android';
    const match = ua.match(/\(Linux; Android[^;]*; ([^)]*)\)/);
    if (match && match[1]) {
      model = match[1].trim();
      const modelLower = model.toLowerCase();
      if (modelLower.startsWith('sm-') || modelLower.startsWith('gt-')) manufacturer = 'Samsung';
      else if (modelLower.startsWith('pixel')) manufacturer = 'Google';
      else if (modelLower.startsWith('moto')) manufacturer = 'Motorola';
      else if (modelLower.startsWith('lg-')) manufacturer = 'LG';
      else if (modelLower.startsWith('oneplus')) manufacturer = 'OnePlus';
      else if (modelLower.startsWith('sony') || modelLower.startsWith('so-')) manufacturer = 'Sony';
    }
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
    model = /ipad/i.test(ua) ? 'iPad' : 'iPhone';
    manufacturer = 'Apple';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Web Browser';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';

  const isNativeApp = isNative();
  let modelClean = model;
  if (os === 'Android') {
    const buildIdx = modelClean.indexOf(' Build/');
    if (buildIdx !== -1) modelClean = modelClean.substring(0, buildIdx);
    const semiIdx = modelClean.indexOf(';');
    if (semiIdx !== -1) modelClean = modelClean.substring(0, semiIdx);
    modelClean = modelClean.trim();
  }

  const modelFriendlyMap: Record<string, string> = {
    'sm-s921b': 'Samsung Galaxy S24',
    'sm-s921u': 'Samsung Galaxy S24',
    'sm-s926b': 'Samsung Galaxy S24+',
    'sm-s926u': 'Samsung Galaxy S24+',
    'sm-s928b': 'Samsung Galaxy S24 Ultra',
    'sm-s928u': 'Samsung Galaxy S24 Ultra',
  };

  const friendlyName = modelFriendlyMap[modelClean.toLowerCase()];

  let shortName = 'Web Client';
  let displayName = 'Web Client';
  let technicalName = 'Web Client';

  if (isNativeApp) {
    technicalName = `Studio Android / ${manufacturer !== 'N/A' ? manufacturer + ' ' : ''}${modelClean}`;
    shortName = friendlyName || (manufacturer !== 'N/A' ? `${manufacturer} ${modelClean}` : modelClean);
    displayName = `${shortName}`;
  } else {
    technicalName = `Studio Web / ${browser} on ${os}`;
    shortName = `${browser} on ${os}`;
    displayName = `${browser} on ${os}`;
  }

  return { shortName, displayName, technicalName, browser, os, model: modelClean, manufacturer, userAgent: ua };
}

// Helper to scan for undefined properties recursively in development/diagnostics
function scanForUndefined(val: any, path = '') {
  if (val === undefined) {
    console.warn(`[syncEngine] Undefined value found at path: ${path || 'root'}`);
    return;
  }
  if (val === null || typeof val !== 'object') return;
  if (val instanceof Date || val instanceof Timestamp) return;
  const FieldValueClass = serverTimestamp()?.constructor;
  if (FieldValueClass && val instanceof FieldValueClass) return;
  if (typeof Blob !== 'undefined' && val instanceof Blob) return;
  if (typeof File !== 'undefined' && val instanceof File) return;
  
  if (Array.isArray(val)) {
    val.forEach((item, index) => {
      scanForUndefined(item, `${path}[${index}]`);
    });
  } else {
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        scanForUndefined(val[key], path ? `${path}.${key}` : key);
      }
    }
  }
}

// Helper to sanitize payload for firestore
export function sanitizeForFirestore(val: any): any {
  try {
    scanForUndefined(val);
  } catch (e) {
    // Ignore diagnostic scanner errors
  }
  return sanitizeValue(val);
}

function sanitizeValue(val: any): any {
  if (val === undefined) {
    return null;
  }
  if (val === null) {
    return null;
  }
  if (typeof val !== 'object') {
    return val;
  }
  if (val instanceof Date) {
    return val;
  }
  if (val instanceof Timestamp) {
    return val;
  }
  const FieldValueClass = serverTimestamp()?.constructor;
  if (FieldValueClass && val instanceof FieldValueClass) {
    return val;
  }
  if (typeof Blob !== 'undefined' && val instanceof Blob) {
    return val;
  }
  if (typeof File !== 'undefined' && val instanceof File) {
    return val;
  }
  
  // Array: convert undefined array elements to null
  if (Array.isArray(val)) {
    return val.map(item => item === undefined ? null : sanitizeValue(item));
  }
  
  // Plain object: remove undefined fields from objects, and sanitize values
  const res: any = {};
  for (const key in val) {
    if (Object.prototype.hasOwnProperty.call(val, key)) {
      const v = val[key];
      if (v !== undefined) {
        res[key] = sanitizeValue(v);
      }
    }
  }
  return res;
}


// ── Session Classification ──
export function classifyDeviceSession(data: any, currentDeviceId: string): { classification: string; reason: string } {
  if (!data) return { classification: 'unknown', reason: 'No document data available' };
  const docId = data.deviceId || data.id || 'Unknown';

  // 1. current
  if (docId === currentDeviceId || data.id === currentDeviceId) {
    return { classification: 'current', reason: 'Current active session' };
  }

  // Calculate active diff
  const lastActive = data.lastActiveAt ? (typeof data.lastActiveAt.toMillis === 'function' ? data.lastActiveAt.toMillis() : data.lastActiveAt) : 0;
  const now = Date.now();
  const diffMinutes = (now - lastActive) / 60000;
  const isCurrentlyActive = (diffMinutes <= 2 && data.syncStatus === 'active');
  const isRecentlyActive = (diffMinutes <= 1440); // 24 hours

  // 2. activeRemote
  if (isCurrentlyActive && data.signedIn !== false && data.syncStatus !== 'signedOut' && data.syncStatus !== 'revoked') {
    return { classification: 'activeRemote', reason: 'Active remote device' };
  }

  // 3. recentRemote
  if (isRecentlyActive && data.signedIn !== false && data.syncStatus !== 'signedOut' && data.syncStatus !== 'revoked' && lastActive > 0) {
    return { classification: 'recentRemote', reason: 'Recently active remote device' };
  }

  // 4. signedOut
  if (data.signedIn === false || data.currentSession === false || data.syncStatus === 'signedOut') {
    return { classification: 'signedOut', reason: 'Signed out session' };
  }

  // 5. revoked
  if (data.revokedAt != null || data.syncStatus === 'revoked') {
    return { classification: 'revoked', reason: 'Session revoked by owner' };
  }

  // 6. legacy
  if (data.isLegacy || data.legacy === true || data.replaced === true) {
    return { classification: 'legacy', reason: 'Marked as legacy or replaced session' };
  }

  // 7. unknown (stale remote session or missing metadata)
  return { classification: 'unknown', reason: 'Stale remote session (inactive > 24 hours)' };
}

// ── Sync Engine Start/Stop Lifecycle ──
export function startSyncEngine(uid: string) {
  if (currentUid === uid) return;
  stopSyncEngine();

  console.info('[syncEngine] Starting Sync Engine for UID:', uid);
  currentUid = uid;
  const deviceId = getStableDeviceId();

  const db = getFirebaseDb();
  if (!db) {
    const initError = getFirebaseInitError() || 'Firestore db is null / unavailable';
    updateStatus({
      authReady: true,
      authUid: uid,
      authEmail: getFirebaseAuth()?.currentUser?.email || 'N/A',
      syncEngineStatus: 'error',
      syncEngineInitError: `Sync Engine failed to start: ${initError}`,
      lastAuthChangeAt: new Date().toLocaleString(),
    });
    console.error('[syncEngine] Cannot start Sync Engine: Firestore db is unavailable');
    return;
  }

  updateStatus({
    authReady: true,
    authUid: uid,
    authEmail: getFirebaseAuth()?.currentUser?.email || 'N/A',
    syncEngineStatus: 'active',
    syncEngineInitError: 'None',
    lastAuthChangeAt: new Date().toLocaleString(),
    activeListenerCount: 5,
  });

  // Attach Listeners
  attachRealtimeListeners(uid, deviceId);

  // Initial Registration
  registerCurrentDevice('sync-engine-start').catch(console.error);

  // Start Heartbeat Timer
  startHeartbeat();
}

export function stopSyncEngine() {
  console.info('[syncEngine] Stopping Sync Engine');
  stopHeartbeat();
  detachRealtimeListeners();
  currentUid = null;

  updateStatus({
    syncEngineStatus: 'inactive',
    activeListenerCount: 0,
    devicesListenerStatus: 'idle',
    profileListenerStatus: 'idle',
    appearanceListenerStatus: 'idle',
    preferencesListenerStatus: 'idle',
    probeListenerStatus: 'idle',
  });
}

export function restartSyncEngine() {
  const uid = currentUid;
  stopSyncEngine();
  if (uid) {
    startSyncEngine(uid);
  }
}

// ── Device Registration ──
export async function registerCurrentDevice(reason: string): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  const deviceId = getStableDeviceId();

  const db = getFirebaseDb();
  if (!db) {
    updateStatus({
      lastDeviceWriteError: 'Firestore db unavailable',
      deviceRegistrationStatus: 'failed',
      inFlightWriteStatus: false
    });
    return;
  }

  const startTime = Date.now();
  updateStatus({
    lastDeviceWriteAttemptedAt: new Date().toLocaleString(),
    deviceRegistrationStatus: 'pending',
    lastDeviceRegistrationReason: reason,
    inFlightWriteStatus: true,
  });

  const details = getDeviceDetails();
  const payload = sanitizeForFirestore({
    deviceId,
    ownerUid: uid,
    platform: isNative() ? 'android' : 'web',
    deviceType: isNative() ? 'phone' : 'desktop',
    shortName: details.shortName,
    displayName: details.displayName,
    technicalName: details.technicalName,
    appVersion: APP_VERSION,
    apkVersion: isNative() ? APP_VERSION : 'N/A (Web)',
    otaVersion: 'N/A',
    buildType: isNative() ? 'Native Release' : 'Web',
    isNative: isNative(),
    browser: details.browser,
    os: details.os,
    model: details.model,
    manufacturer: details.manufacturer,
    userAgent: details.userAgent,
    signedIn: true,
    currentSession: true,
    syncStatus: 'active',
    firstSeenAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByDevice: deviceId,
    revision: 1,
    schemaVersion: 1,
  });

  // 10s timeout wrapper
  const writePromise = setDoc(doc(db, 'users', uid, 'devices', deviceId), payload, { merge: true });
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Write timeout')), 10000));

  try {
    await Promise.race([writePromise, timeoutPromise]);
    updateStatus({
      lastDeviceWriteSuccess: new Date().toLocaleString(),
      lastDeviceWriteError: 'None',
      lastDeviceWriteDurationMs: Date.now() - startTime,
      deviceRegistrationStatus: 'registered',
      inFlightWriteStatus: false,
    });
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    console.warn('[syncEngine] Registration failed:', errorMsg);
    updateStatus({
      lastDeviceWriteError: errorMsg,
      deviceRegistrationStatus: 'failed',
      inFlightWriteStatus: false,
    });
  }
}

// ── Heartbeat and Presence ──
export async function heartbeatNow(reason: string): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  const db = getFirebaseDb();
  if (!db) {
    updateStatus({ lastHeartbeatError: 'Firestore db unavailable' });
    return;
  }

  const deviceId = getStableDeviceId();
  const docRef = doc(db, 'users', uid, 'devices', deviceId);

  // 10s timeout wrapper
  const writePromise = setDoc(docRef, sanitizeForFirestore({
    lastActiveAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    signedIn: true,
    currentSession: true,
    syncStatus: 'active',
    updatedByDevice: deviceId,
  }), { merge: true });
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Write timeout')), 10000));

  try {
    await Promise.race([writePromise, timeoutPromise]);
    updateStatus({ lastHeartbeatSuccess: new Date().toLocaleString(), lastHeartbeatError: 'None' });
  } catch (e: any) {
    console.warn('[syncEngine] Heartbeat failed:', e);
    updateStatus({ lastHeartbeatError: e.message || String(e) });
  }
}

export function startHeartbeat(uid?: string) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    heartbeatNow('periodic-tick').catch(console.error);
  }, 30000);
}

export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ── Realtime Snapshot Listeners ──
function attachRealtimeListeners(uid: string, deviceId: string) {
  const db = getFirebaseDb();
  if (!db) return;

  // 1. Subscribe Devices
  updateStatus({ devicesListenerStatus: 'attaching' });
  unsubDevices = onSnapshot(collection(db, 'users', uid, 'devices'), (snap) => {
    const devicesList: any[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const meta = classifyDeviceSession({ id: doc.id, ...data }, deviceId);
      devicesList.push({
        id: doc.id,
        ...data,
        classification: meta.classification,
        classificationReason: meta.reason,
      });
    });

    updateStatus({
      devicesListenerStatus: 'active',
      devicesLastSnapshotAt: new Date().toLocaleString(),
      devicesSnapshotCount: snap.size,
      devicesFromCache: snap.metadata.fromCache,
      devicesHasPendingWrites: snap.metadata.hasPendingWrites,
      devices: devicesList,
    });
  }, (err) => {
    updateStatus({ devicesListenerStatus: 'error', devicesListenerError: err.message || String(err) });
  });

  // 2. Subscribe Profile
  updateStatus({ profileListenerStatus: 'attaching' });
  unsubProfile = onSnapshot(doc(db, 'users', uid, 'profile', 'main'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      updateStatus({
        profileListenerStatus: 'active',
        profileLastSnapshotAt: new Date().toLocaleString(),
        profileFromCache: snap.metadata.fromCache,
        profileHasPendingWrites: snap.metadata.hasPendingWrites,
        cloudDisplayName: data.displayName || 'N/A',
        cloudPhotoURL: data.photoURL || 'N/A',
      });
    } else {
      updateStatus({ profileListenerStatus: 'active', cloudDisplayName: 'N/A', cloudPhotoURL: 'N/A' });
    }
  }, (err) => {
    updateStatus({ profileListenerStatus: 'error', profileListenerError: err.message || String(err) });
  });

  // 3. Subscribe Appearance
  updateStatus({ appearanceListenerStatus: 'attaching' });
  unsubAppearance = onSnapshot(doc(db, 'users', uid, 'settings', 'appearance'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      updateStatus({
        appearanceListenerStatus: 'active',
        appearanceLastSnapshotAt: new Date().toLocaleString(),
        appearanceFromCache: snap.metadata.fromCache,
        appearanceHasPendingWrites: snap.metadata.hasPendingWrites,
        cloudTheme: data.theme || 'N/A',
        cloudAccentColor: data.accentColor || 'N/A',
      });
    } else {
      updateStatus({ appearanceListenerStatus: 'active', cloudTheme: 'N/A', cloudAccentColor: 'N/A' });
    }
  }, (err) => {
    updateStatus({ appearanceListenerStatus: 'error', appearanceListenerError: err.message || String(err) });
  });

  // 4. Subscribe Preferences
  updateStatus({ preferencesListenerStatus: 'attaching' });
  unsubPreferences = onSnapshot(doc(db, 'users', uid, 'settings', 'preferences'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      updateStatus({
        preferencesListenerStatus: 'active',
        preferencesLastSnapshotAt: new Date().toLocaleString(),
        preferencesFromCache: snap.metadata.fromCache,
        preferencesHasPendingWrites: snap.metadata.hasPendingWrites,
        cloudPreferences: data.studioPreferences || data || null,
      });
    } else {
      updateStatus({ preferencesListenerStatus: 'active', cloudPreferences: null });
    }
  }, (err) => {
    updateStatus({ preferencesListenerStatus: 'error', preferencesListenerError: err.message || String(err) });
  });

  // 5. Subscribe Probe
  updateStatus({ probeListenerStatus: 'attaching' });
  unsubProbe = onSnapshot(collection(db, 'users', uid, 'syncProbe'), (snap) => {
    let probeCount = 0;
    const deviceIds: string[] = [];
    const nonces: string[] = [];
    let hasAndroid = false;
    let hasWeb = false;
    let allSameUid = true;
    let allSameProj = true;
    const probeDocsList: any[] = [];

    snap.forEach((doc) => {
      probeCount++;
      const data = doc.data();
      deviceIds.push(doc.id);
      if (data.nonce) nonces.push(data.nonce);
      if (data.platform === 'android') hasAndroid = true;
      if (data.platform === 'web') hasWeb = true;
      if (data.uid !== uid) allSameUid = false;
      if (data.firebaseProjectId !== getFirebaseProjectId()) allSameProj = false;
      probeDocsList.push({
        id: doc.id,
        deviceId: data.deviceId || doc.id,
        platform: data.platform || 'unknown',
        shortName: data.shortName || 'Unknown Device',
        appVersion: data.appVersion || 'N/A',
        buildType: data.buildType || 'N/A',
        commitSha: data.commitSha || 'n/a',
        nonce: data.nonce || 'N/A',
        writtenAt: data.writtenAt || 0,
        updatedAt: data.updatedAt || 0,
      });
    });

    updateStatus({
      probeListenerStatus: 'active',
      probeLastSnapshotAt: new Date().toLocaleString(),
      probeDocumentsReceived: probeCount,
      probeFromCache: snap.metadata.fromCache,
      probeHasPendingWrites: snap.metadata.hasPendingWrites,
      probeDeviceIdsReceived: deviceIds,
      probeNoncesReceived: nonces,
      androidProbeDetected: hasAndroid,
      webProbeDetected: hasWeb,
      sameUidConfirmed: allSameUid && probeCount > 0,
      sameProjectConfirmed: allSameProj && probeCount > 0,
      probeDocs: probeDocsList,
    });
  }, (err) => {
    updateStatus({ probeListenerStatus: 'error', probeListenerError: err.message || String(err) });
  });
}

function detachRealtimeListeners() {
  unsubDevices?.(); unsubDevices = null;
  unsubProfile?.(); unsubProfile = null;
  unsubAppearance?.(); unsubAppearance = null;
  unsubPreferences?.(); unsubPreferences = null;
  unsubProbe?.(); unsubProbe = null;
}

// ── Profile and Settings Patch Writes ──
export async function writeProfilePatch(patch: any): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  const db = getFirebaseDb();
  if (!db) return;

  try {
    const payload = sanitizeForFirestore({
      ...patch,
      updatedAt: Date.now(),
      updatedByDevice: getStableDeviceId(),
      revision: 1,
      schemaVersion: 1,
    });
    await setDoc(doc(db, 'users', uid, 'profile', 'main'), payload, { merge: true });
    updateStatus({ lastProfileWriteSuccess: new Date().toLocaleString(), lastProfileWriteError: 'None' });
  } catch (err: any) {
    updateStatus({ lastProfileWriteError: err.message || String(err) });
    throw err;
  }
}

export async function writeAppearancePatch(patch: any): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  const db = getFirebaseDb();
  if (!db) return;

  try {
    const payload = sanitizeForFirestore({
      ...patch,
      updatedAt: Date.now(),
      updatedByDevice: getStableDeviceId(),
      revision: 1,
      schemaVersion: 1,
    });
    await setDoc(doc(db, 'users', uid, 'settings', 'appearance'), payload, { merge: true });
    updateStatus({ lastAppearanceWriteSuccess: new Date().toLocaleString(), lastAppearanceWriteError: 'None' });
  } catch (err: any) {
    updateStatus({ lastAppearanceWriteError: err.message || String(err) });
    throw err;
  }
}

export async function writePreferencesPatch(patch: any): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  const db = getFirebaseDb();
  if (!db) return;

  try {
    // Keep user required schema
    const payload = sanitizeForFirestore({
      studioPreferences: patch,
      modulePreferences: {},
      updatedAt: Date.now(),
      updatedByDevice: getStableDeviceId(),
      revision: 1,
      schemaVersion: 1,
    });
    await setDoc(doc(db, 'users', uid, 'settings', 'preferences'), payload, { merge: true });
    updateStatus({ lastPreferencesWriteSuccess: new Date().toLocaleString(), lastPreferencesWriteError: 'None' });
  } catch (err: any) {
    updateStatus({ lastPreferencesWriteError: err.message || String(err) });
    throw err;
  }
}

// ── Photo Upload ──
export async function uploadProfilePhoto(file: File | Blob): Promise<string> {
  const uid = currentUid;
  if (!uid) throw new Error('Not signed in');
  const storage = getFirebaseStorage();
  if (!storage) throw new Error('Firebase Storage unavailable');

  try {
    const photoRef = storageRef(storage, `users/${uid}/profile/avatar.webp`);
    await uploadBytes(photoRef, file);
    const downloadURL = await getDownloadURL(photoRef);
    await writeProfilePatch({ photoURL: downloadURL });
    return downloadURL;
  } catch (err: any) {
    updateStatus({ lastPhotoUploadError: err.message || String(err) });
    throw err;
  }
}

// ── Sync Probe ──
export async function runSyncProbe(): Promise<string> {
  const uid = currentUid;
  const deviceId = getStableDeviceId();
  const db = getFirebaseDb();

  const path = uid && deviceId ? `users/${uid}/syncProbe/${deviceId}` : 'N/A';
  const listenerPath = uid ? `users/${uid}/syncProbe` : 'N/A';

  // 1. Set lastProbeWriteAttempt immediately.
  // 2. Build intended probe path.
  updateStatus({
    probeWritePath: path,
    probeListenerPath: listenerPath,
    lastProbeWriteAttempt: new Date().toLocaleString(),
  });

  // 3. Validate uid.
  if (!uid) {
    const errorMsg = 'Auth UID missing';
    updateStatus({ lastProbeWriteError: errorMsg });
    throw new Error(errorMsg);
  }

  // 4. Validate deviceId.
  if (!deviceId) {
    const errorMsg = 'Device ID missing';
    updateStatus({ lastProbeWriteError: errorMsg });
    throw new Error(errorMsg);
  }

  // 5 & 6. Validate db and set lastProbeWriteError immediately if missing.
  if (!db) {
    const errorMsg = 'Firestore db unavailable';
    updateStatus({ lastProbeWriteError: errorMsg });
    throw new Error(errorMsg);
  }

  const probeRef = doc(db, 'users', uid, 'syncProbe', deviceId);
  const nonce = Math.random().toString(36).substring(2, 10).toUpperCase();

  // 7 & 8. Call setDoc and race it with a 10s timeout
  const writePromise = setDoc(probeRef, sanitizeForFirestore({
    uid,
    deviceId,
    platform: isNative() ? 'android' : 'web',
    shortName: getDeviceDetails().shortName,
    appVersion: APP_VERSION,
    buildType: isNative() ? 'Native Release' : 'Web',
    firebaseProjectId: getFirebaseProjectId(),
    commitSha: APP_COMMIT_SHA,
    nonce,
    writtenAt: Date.now(),
    updatedAt: Date.now(),
    userAgent: !isNative() ? navigator.userAgent : null,
    model: isNative() ? getDeviceDetails().model : null,
    manufacturer: isNative() ? getDeviceDetails().manufacturer : null,
  }));
  
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Write timeout')), 10000));

  try {
    await Promise.race([writePromise, timeoutPromise]);
    // 9. On success, set lastProbeWriteSuccess.
    updateStatus({
      lastProbeWriteSuccess: new Date().toLocaleString(),
      lastProbeWriteError: 'None',
    });
    return nonce;
  } catch (err: any) {
    // 10. On failure, set lastProbeWriteError with exact error.
    const errorMsg = err.message || String(err);
    updateStatus({ lastProbeWriteError: errorMsg });
    throw err;
  }
}

export async function clearMyProbeOnly(): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  const db = getFirebaseDb();
  if (!db) return;

  const deviceId = getStableDeviceId();
  const probeRef = doc(db, 'users', uid, 'syncProbe', deviceId);
  await deleteDoc(probeRef);
}

// ── Auto Initialization ──
// Hook Firebase Auth directly to drive SyncEngine lifecycle
let initialized = false;
export function initAuthSyncEngineHook() {
  if (initialized) return;
  initialized = true;

  subscribeAuth((user) => {
    if (user) {
      startSyncEngine(user.uid);
    } else {
      // Mark current device as signedOut before stopping
      const uid = currentUid;
      if (uid) {
        const deviceId = getStableDeviceId();
        const db = getFirebaseDb();
        if (db) {
          setDoc(doc(db, 'users', uid, 'devices', deviceId), sanitizeForFirestore({
            signedIn: false,
            currentSession: false,
            syncStatus: 'signedOut',
            lastSeenAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }), { merge: true }).catch(() => {});
        }
      }
      stopSyncEngine();
    }
  });
}

export const startDeviceHeartbeat = startHeartbeat;
export const stopDeviceHeartbeat = stopHeartbeat;

export async function reconnectDevices(): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  detachRealtimeListeners();
  const deviceId = getStableDeviceId();
  attachRealtimeListeners(uid, deviceId);
  await registerCurrentDevice('reconnect-trigger');
  await heartbeatNow('reconnect-trigger');
}

export function getSyncEngineDiagnostics(): SyncEngineStatus {
  return engineStatus;
}

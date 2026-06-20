import { 
  SyncBackendProvider, 
  UserProfile, 
  AppearanceSettings, 
  UserPreferences, 
  SyncDiagnostics, 
  Unsubscribe, 
  ProbeListener, 
  DevicesListener, 
  ProfileListener, 
  AppearanceListener, 
  PreferencesListener, 
  DiagnosticsListener,
  SyncDevice,
  ProbeDoc
} from './types';
import { 
  getStableDeviceId,
  getDeviceDetails,
  classifyDeviceSession,
  sanitizeForFirestore
} from '../syncEngine';
import { doc, getDoc, collection, onSnapshot, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth, getFirebaseStorage, getFirebaseProjectId, getFirebaseConfigDetails, getFirebaseInitError, incrementFirestoreListeners, decrementFirestoreListeners, incrementFirestoreWrites, decrementFirestoreWrites, setFirestoreLastError } from '../firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useChordStore } from '../../store/useChordStore';
import { isNative } from '../capgoUpdater';
import { APP_VERSION, APP_COMMIT_SHA } from '../appVersion';
import { subscribeAuth } from '../auth';

// ── State variables for the Legacy Sync Engine ──
let statusListeners = new Set<DiagnosticsListener>();
let currentUid: string | null = null;
let heartbeatInterval: any = null;

// Realtime snap unsubscribers
let unsubDevices: (() => void) | null = null;
let unsubProfile: (() => void) | null = null;
let unsubAppearance: (() => void) | null = null;
let unsubPreferences: (() => void) | null = null;
let unsubProbe: (() => void) | null = null;

// Initial state
let engineStatus: SyncDiagnostics = {
  activeSyncProvider: 'firebase-firestore-legacy',
  authProvider: 'firebase',
  databaseProvider: 'firestore',
  storageProvider: 'firebase-storage',
  localDatabaseProvider: 'none',
  firebaseAuthUid: 'Not signed in',
  supabaseUserId: 'N/A',
  currentDeviceId: 'Unknown',
  currentPlatform: isNative() ? 'android' : 'web',
  directWriteProvider: 'firestore',
  directWriteResult: 'N/A',
  probeProvider: 'firestore',
  probeResult: 'N/A',
  devicesProvider: 'firestore',
  devicesResult: 'active',
  profileSyncResult: 'N/A',
  appearanceSyncResult: 'N/A',
  lastErrorCode: 'None',
  lastErrorMessage: 'None',
  lastSuccessfulSyncAt: 'Never',
  syncBackendVersion: 'sync-engine-v1',
  realtimeConnected: false,
  lastRealtimeEventAt: 'Never',
  lastManualRefetchAt: 'Never',

  // legacy-compatible fields that are used inside updateStatus/diagnostics
  authReady: false,
  authUid: 'Not signed in',
  authEmail: 'N/A',
  syncEngineStatus: 'inactive',
  activeListenerCount: 0,
  lastAuthChangeAt: 'Never',

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
  devices: [],

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

  // Direct Write Test Stats
  directWritePath: 'N/A',
  directWriteAttempt: 'Never',
  directWriteSuccess: 'Never',
  directWriteError: 'None',
  directWriteDurationMs: null,
  directReadBackSuccess: 'Never',
  directReadBackError: 'None',
  directReadBackData: 'N/A',
  directListenerDocumentsReceived: 0,
  directListenerDeviceIdsReceived: [],

  // Action status logging
  lastAction: 'None',
  lastActionAt: 'Never',
  buttonActionStatus: 'idle',

  // Additional diagnostics
  firestoreTransportMode: 'default',
  firestorePersistenceMode: 'none',
  firestoreInitSource: 'not-started',

  // Listener diagnostic metadata
  probeListenerAttachedAt: 'Never',
  probeSnapshotFromCache: false,
  probeSnapshotHasPendingWrites: false,

  // Timing/Stage tracking during writes
  writeStage: 'idle',
  writeStartedAt: 'Never',
  writeTimedOutAt: 'Never',
  writeDurationMs: null,
  firebaseErrorCode: 'None',
  firebaseErrorMessage: 'None',
  onlineState: 'Unknown',
  snapshotFromCache: false,
  hasPendingWrites: false,

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
  probeDocs: [],
};

function updateStatus(patch: Partial<SyncDiagnostics>) {
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
    firebaseDbAvailable: !!db,
    firebaseAuthAvailable: !!auth,
    firebaseStorageAvailable: !!storage,
    firebaseIdTokenAvailable: 'No' as const,
    firebaseInitError: config.initError,
    firestoreTransportMode: config.firestoreTransportMode,
    firestorePersistenceMode: config.firestorePersistenceMode,
    firestoreInitSource: config.firestoreInitSource,
  };

  const supabaseDiag = {
    supabaseUrlConfigured: false,
    supabaseAnonKeyConfigured: false,
    supabaseClientReady: false,
    supabaseAuthBridgeReady: false,
    supabaseDbAvailable: false,
    supabaseStorageAvailable: false,
    supabaseUrlHost: 'N/A',
    supabaseAnonKeyPrefix: 'N/A',
    supabaseAnonKeyLength: 0,
    supabaseAuthStrategy: 'N/A',
    supabaseUserId: 'N/A',
    mappedUserId: 'N/A',
    rlsUserId: 'N/A',
    lastSupabaseAuthError: 'N/A',
    probeTable: 'N/A',
    probeRowId: 'N/A',
    devicesTable: 'N/A',
    deviceRowId: 'N/A',
    directWriteTable: 'N/A',
    directWriteRowId: 'N/A',
    profileTable: 'N/A',
    appearanceTable: 'N/A',
    preferencesTable: 'N/A',
  };

  const nextStatus = { ...engineStatus, ...firebaseDiag, ...supabaseDiag, ...patch } as SyncDiagnostics;
  nextStatus.onlineState = typeof navigator !== 'undefined' ? (navigator.onLine ? 'Online' : 'Offline') : 'Unknown';

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
    try { l(engineStatus); } catch (e) { console.error('[firebaseLegacy] listener error:', e); }
  });
}

// ── Legacy Sync Engine Lifecycle helpers ──
function engineStartSyncEngine(uid: string) {
  if (currentUid === uid) return;
  engineStopSyncEngine();

  console.info('[firebaseLegacy] Starting Sync Engine for UID:', uid);
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
    console.error('[firebaseLegacy] Cannot start Sync Engine: Firestore db is unavailable');
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

  attachRealtimeListeners(uid, deviceId);
  engineRegisterCurrentDevice('sync-engine-start').catch(console.error);
  engineStartHeartbeat();
}

function engineStopSyncEngine() {
  console.info('[firebaseLegacy] Stopping Sync Engine');
  engineStopHeartbeat();
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

// ── Device Registration ──
async function engineRegisterCurrentDevice(reason: string): Promise<void> {
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
    console.warn('[firebaseLegacy] Registration failed:', errorMsg);
    updateStatus({
      lastDeviceWriteError: errorMsg,
      deviceRegistrationStatus: 'failed',
      inFlightWriteStatus: false,
    });
  }
}

// ── Heartbeat and Presence ──
async function engineHeartbeatNow(reason: string): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  const db = getFirebaseDb();
  if (!db) {
    updateStatus({ lastHeartbeatError: 'Firestore db unavailable' });
    return;
  }

  const deviceId = getStableDeviceId();
  const docRef = doc(db, 'users', uid, 'devices', deviceId);

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
    console.warn('[firebaseLegacy] Heartbeat failed:', e);
    updateStatus({ lastHeartbeatError: e.message || String(e) });
  }
}

function engineStartHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    engineHeartbeatNow('periodic-tick').catch(console.error);
  }, 30000);
}

function engineStopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ── Realtime Snapshot Listeners ──
function attachRealtimeListeners(uid: string, deviceId: string) {
  const db = getFirebaseDb();
  if (!db) return;

  updateStatus({ devicesListenerStatus: 'attaching' });
  incrementFirestoreListeners();
  unsubDevices = onSnapshot(collection(db, 'users', uid, 'devices'), (snap) => {
    const devicesList: SyncDevice[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const meta = classifyDeviceSession({ id: doc.id, ...data }, deviceId);
      devicesList.push({
        id: doc.id,
        deviceId: data.deviceId || doc.id,
        userId: uid,
        platform: data.platform || 'unknown',
        deviceType: data.deviceType || 'unknown',
        shortName: data.shortName || 'Unknown Device',
        displayName: data.displayName || 'Unknown Device',
        technicalName: data.technicalName || 'Unknown Device',
        appVersion: data.appVersion || 'N/A',
        versionCode: data.versionCode || 0,
        buildType: data.buildType || 'N/A',
        browser: data.browser || 'N/A',
        os: data.os || 'N/A',
        model: data.model || 'N/A',
        manufacturer: data.manufacturer || 'N/A',
        signedIn: data.signedIn ?? false,
        currentSession: data.currentSession ?? false,
        syncStatus: data.syncStatus || 'inactive',
        firstSeenAt: data.firstSeenAt,
        lastSeenAt: data.lastSeenAt,
        lastActiveAt: data.lastActiveAt,
        updatedAt: data.updatedAt,
        updatedByDevice: data.updatedByDevice,
        revision: data.revision,
        schemaVersion: data.schemaVersion,
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
    setFirestoreLastError(err.message || String(err));
    updateStatus({ devicesListenerStatus: 'error', devicesListenerError: err.message || String(err) });
  });

  updateStatus({ profileListenerStatus: 'attaching' });
  incrementFirestoreListeners();
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
    setFirestoreLastError(err.message || String(err));
    updateStatus({ profileListenerStatus: 'error', profileListenerError: err.message || String(err) });
  });

  updateStatus({ appearanceListenerStatus: 'attaching' });
  incrementFirestoreListeners();
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
    setFirestoreLastError(err.message || String(err));
    updateStatus({ appearanceListenerStatus: 'error', appearanceListenerError: err.message || String(err) });
  });

  updateStatus({ preferencesListenerStatus: 'attaching' });
  incrementFirestoreListeners();
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
    setFirestoreLastError(err.message || String(err));
    updateStatus({ preferencesListenerStatus: 'error', preferencesListenerError: err.message || String(err) });
  });
}

function detachRealtimeListeners() {
  if (unsubDevices) { unsubDevices(); unsubDevices = null; decrementFirestoreListeners(); }
  if (unsubProfile) { unsubProfile(); unsubProfile = null; decrementFirestoreListeners(); }
  if (unsubAppearance) { unsubAppearance(); unsubAppearance = null; decrementFirestoreListeners(); }
  if (unsubPreferences) { unsubPreferences(); unsubPreferences = null; decrementFirestoreListeners(); }
  if (unsubProbe) { unsubProbe(); unsubProbe = null; decrementFirestoreListeners(); }
}

// ── Profile and Settings Patch Writes ──
async function engineWriteProfilePatch(patch: any): Promise<void> {
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

async function engineWriteAppearancePatch(patch: any): Promise<void> {
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

async function engineWritePreferencesPatch(patch: any): Promise<void> {
  const uid = currentUid;
  if (!uid) return;
  const db = getFirebaseDb();
  if (!db) return;

  try {
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
async function engineUploadProfilePhoto(file: File | Blob): Promise<string> {
  const uid = currentUid;
  if (!uid) throw new Error('Not signed in');
  const storage = getFirebaseStorage();
  if (!storage) throw new Error('Firebase Storage unavailable');

  try {
    const photoRef = storageRef(storage, `users/${uid}/profile/avatar.webp`);
    await uploadBytes(photoRef, file);
    const downloadURL = await getDownloadURL(photoRef);
    await engineWriteProfilePatch({ photoURL: downloadURL });
    return downloadURL;
  } catch (err: any) {
    updateStatus({ lastPhotoUploadError: err.message || String(err) });
    throw err;
  }
}

// ── Sync Probe ──
async function engineRunSyncProbe(): Promise<string> {
  const uid = currentUid;
  const deviceId = getStableDeviceId();
  const db = getFirebaseDb();

  const path = uid && deviceId ? `users/${uid}/syncProbe/${deviceId}` : 'N/A';
  const listenerPath = uid ? `users/${uid}/syncProbe` : 'N/A';

  updateStatus({
    probeWritePath: path,
    probeListenerPath: listenerPath,
    lastProbeWriteAttempt: new Date().toLocaleString(),
  });

  if (!uid) {
    const errorMsg = 'Auth UID missing';
    updateStatus({ lastProbeWriteError: errorMsg });
    throw new Error(errorMsg);
  }

  if (!deviceId) {
    const errorMsg = 'Device ID missing';
    updateStatus({ lastProbeWriteError: errorMsg });
    throw new Error(errorMsg);
  }

  if (!db) {
    const errorMsg = 'Firestore db unavailable';
    updateStatus({ lastProbeWriteError: errorMsg });
    throw new Error(errorMsg);
  }

  const probeRef = doc(db, 'users', uid, 'syncProbe', deviceId);
  const nonce = Math.random().toString(36).substring(2, 10).toUpperCase();

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
    updateStatus({
      lastProbeWriteSuccess: new Date().toLocaleString(),
      lastProbeWriteError: 'None',
    });
    return nonce;
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    updateStatus({ lastProbeWriteError: errorMsg });
    throw err;
  }
}

async function engineClearMyProbe(): Promise<void> {
  const uid = currentUid;
  const deviceId = getStableDeviceId();
  const db = getFirebaseDb();
  
  const nowStr = new Date().toLocaleString();
  
  updateStatus({
    lastAction: 'Clear My Probe',
    lastActionAt: nowStr,
    buttonActionStatus: 'pending'
  });

  if (!uid || !deviceId || !db) {
    updateStatus({ buttonActionStatus: 'error' });
    return;
  }

  try {
    const probeRef = doc(db, 'users', uid, 'syncProbe', deviceId);
    await deleteDoc(probeRef);
    updateStatus({ buttonActionStatus: 'success' });
  } catch (e) {
    console.error('[firebaseLegacy] Failed to clear probe:', e);
    updateStatus({ buttonActionStatus: 'error' });
  }
}

async function engineReconnectDevices(): Promise<void> {
  const nowStr = new Date().toLocaleString();
  updateStatus({
    lastAction: 'Reconnect Devices',
    lastActionAt: nowStr,
    buttonActionStatus: 'pending'
  });

  const uid = currentUid;
  if (!uid) {
    updateStatus({ buttonActionStatus: 'error' });
    return;
  }
  
  try {
    detachRealtimeListeners();
    const deviceId = getStableDeviceId();
    attachRealtimeListeners(uid, deviceId);
    await engineRegisterCurrentDevice('reconnect-trigger');
    await engineHeartbeatNow('reconnect-trigger');
    updateStatus({ buttonActionStatus: 'success' });
  } catch (e) {
    console.error('[firebaseLegacy] reconnectDevices failed:', e);
    updateStatus({ buttonActionStatus: 'error' });
  }
}

let unsubDirectWrites: (() => void) | null = null;

async function engineRunDirectFirestoreWriteTest(): Promise<void> {
  const uid = currentUid;
  const deviceId = getStableDeviceId();
  const db = getFirebaseDb();
  
  const nowStr = new Date().toLocaleString();
  const startTime = Date.now();
  
  updateStatus({
    lastAction: 'Direct Firestore Write Test',
    lastActionAt: nowStr,
    buttonActionStatus: 'pending',
    directWriteAttempt: nowStr,
    directWriteError: 'Pending',
    directWriteSuccess: 'Never',
    directReadBackSuccess: 'Never',
    directReadBackError: 'None',
    directReadBackData: 'N/A',
    directWritePath: uid && deviceId ? `users/${uid}/debugWrites/${deviceId}` : 'N/A'
  });

  if (!uid) {
    updateStatus({ directWriteError: 'Auth UID missing', buttonActionStatus: 'error' });
    throw new Error('Auth UID missing');
  }
  if (!deviceId) {
    updateStatus({ directWriteError: 'Device ID missing', buttonActionStatus: 'error' });
    throw new Error('Device ID missing');
  }
  if (!db) {
    updateStatus({ directWriteError: 'Firestore db unavailable', buttonActionStatus: 'error' });
    throw new Error('Firestore db unavailable');
  }

  if (!unsubDirectWrites) {
    try {
      unsubDirectWrites = onSnapshot(collection(db, 'users', uid, 'debugWrites'), (snap) => {
        const ids: string[] = [];
        snap.forEach(doc => ids.push(doc.id));
        updateStatus({
          directListenerDocumentsReceived: snap.size,
          directListenerDeviceIdsReceived: ids
        });
      }, (err) => {
        console.error('[firebaseLegacy] directWrites listener error:', err);
      });
    } catch (e) {
      console.warn('[firebaseLegacy] Failed to attach directWrites listener:', e);
    }
  }

  const nonce = Math.random().toString(36).substring(2, 10).toUpperCase();
  const payload = sanitizeForFirestore({
    uid,
    deviceId,
    platform: isNative() ? 'android' : 'web',
    appVersion: APP_VERSION,
    buildType: isNative() ? 'Native Release' : 'Web',
    commitSha: APP_COMMIT_SHA,
    testName: 'direct-firestore-write-test',
    nonce,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const docRef = doc(db, 'users', uid, 'debugWrites', deviceId);
  const writePromise = setDoc(docRef, payload, { merge: true });
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Write timeout')), 10000));

  try {
    await Promise.race([writePromise, timeoutPromise]);
    const duration = Date.now() - startTime;
    updateStatus({
      directWriteSuccess: new Date().toLocaleString(),
      directWriteError: 'None',
      directWriteDurationMs: duration
    });
    
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        updateStatus({
          directReadBackSuccess: new Date().toLocaleString(),
          directReadBackData: JSON.stringify(snap.data())
        });
      } else {
        updateStatus({
          directReadBackError: 'Document does not exist after write'
        });
      }
    } catch (readErr: any) {
      updateStatus({
        directReadBackError: readErr.message || String(readErr)
      });
    }
    
    updateStatus({ buttonActionStatus: 'success' });
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const errorMsg = err.message || String(err);
    updateStatus({
      directWriteError: errorMsg,
      directWriteDurationMs: duration,
      buttonActionStatus: 'error'
    });
    throw err;
  }
}

export class FirebaseFirestoreLegacyProvider implements SyncBackendProvider {
  providerName = 'firebase-firestore-legacy';
  private unsubs: Unsubscribe[] = [];
  private authUnsub: (() => void) | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    this.authUnsub = subscribeAuth((user) => {
      if (user) {
        engineStartSyncEngine(user.uid);
      } else {
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
        engineStopSyncEngine();
      }
    });
  }

  async dispose(): Promise<void> {
    this.authUnsub?.();
    this.authUnsub = null;
    this.initialized = false;
    engineStopSyncEngine();
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  async getCurrentUserId(): Promise<string | null> {
    return getFirebaseAuth()?.currentUser?.uid || null;
  }

  async directWriteTest() {
    try {
      await engineRunDirectFirestoreWriteTest();
      const diag = this.getDiagnostics();
      return {
        success: diag.directWriteError === 'None' || !diag.directWriteError,
        error: diag.directWriteError !== 'None' ? diag.directWriteError : undefined,
        durationMs: diag.directWriteDurationMs || undefined,
        readBackData: diag.directReadBackData || undefined
      };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  async sendSyncProbe() {
    try {
      const nonce = await engineRunSyncProbe();
      return { success: true, nonce };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  async clearSyncProbe() {
    await engineClearMyProbe();
  }

  subscribeSyncProbe(callback: ProbeListener): Unsubscribe {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return () => {};
    
    updateStatus({ probeListenerStatus: 'attaching' });
    const unsub = onSnapshot(collection(db, 'users', uid, 'syncProbe'), (snap) => {
      let probeCount = 0;
      const deviceIds: string[] = [];
      const nonces: string[] = [];
      let hasAndroid = false;
      let hasWeb = false;
      let allSameUid = true;
      let allSameProj = true;
      const probes: ProbeDoc[] = [];
      
      snap.forEach(doc => {
        probeCount++;
        const data = doc.data();
        deviceIds.push(doc.id);
        if (data.nonce) nonces.push(data.nonce);
        if (data.platform === 'android') hasAndroid = true;
        if (data.platform === 'web') hasWeb = true;
        if (data.uid !== uid) allSameUid = false;
        if (data.firebaseProjectId !== getFirebaseProjectId()) allSameProj = false;
        probes.push({
          id: doc.id,
          deviceId: data.deviceId || doc.id,
          platform: data.platform || 'unknown',
          shortName: data.shortName || 'Unknown Device',
          appVersion: data.appVersion || 'N/A',
          buildType: data.buildType || 'N/A',
          commitSha: data.commitSha,
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
        probeDocs: probes,
      });

      callback(probes);
    }, (err) => {
      updateStatus({ probeListenerStatus: 'error', probeListenerError: err.message || String(err) });
    });
    
    this.unsubs.push(unsub);
    return unsub;
  }

  async registerCurrentDevice(reason: string) {
    try {
      await engineRegisterCurrentDevice(reason);
      const diag = this.getDiagnostics();
      return {
        success: diag.lastDeviceWriteError === 'None' || !diag.lastDeviceWriteError,
        error: diag.lastDeviceWriteError !== 'None' ? diag.lastDeviceWriteError : undefined
      };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  async heartbeatNow(reason: string) {
    try {
      await engineHeartbeatNow(reason);
      const diag = this.getDiagnostics();
      return {
        success: diag.lastHeartbeatError === 'None' || !diag.lastHeartbeatError,
        error: diag.lastHeartbeatError !== 'None' ? diag.lastHeartbeatError : undefined
      };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  subscribeDevices(callback: DevicesListener): Unsubscribe {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    const currentDevId = getStableDeviceId();
    if (!db || !uid) return () => {};

    const unsub = onSnapshot(collection(db, 'users', uid, 'devices'), (snap) => {
      const devices: SyncDevice[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        const meta = classifyDeviceSession({ id: doc.id, ...data }, currentDevId);
        devices.push({
          id: doc.id,
          deviceId: data.deviceId || doc.id,
          userId: uid,
          platform: data.platform || 'unknown',
          deviceType: data.deviceType || 'unknown',
          shortName: data.shortName || 'Unknown Device',
          displayName: data.displayName || 'Unknown Device',
          technicalName: data.technicalName || 'Unknown Device',
          appVersion: data.appVersion || 'N/A',
          versionCode: data.versionCode || 0,
          buildType: data.buildType || 'N/A',
          browser: data.browser || 'N/A',
          os: data.os || 'N/A',
          model: data.model || 'N/A',
          manufacturer: data.manufacturer || 'N/A',
          signedIn: data.signedIn ?? false,
          currentSession: data.currentSession ?? false,
          syncStatus: data.syncStatus || 'inactive',
          firstSeenAt: data.firstSeenAt,
          lastSeenAt: data.lastSeenAt,
          lastActiveAt: data.lastActiveAt,
          updatedAt: data.updatedAt,
          updatedByDevice: data.updatedByDevice,
          revision: data.revision,
          schemaVersion: data.schemaVersion,
          classification: meta.classification,
          classificationReason: meta.reason,
        });
      });
      callback(devices);
    });
    this.unsubs.push(unsub);
    return unsub;
  }

  async getProfile(): Promise<UserProfile | null> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return null;
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'main'));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  async updateProfile(patch: Partial<UserProfile>): Promise<void> {
    await engineWriteProfilePatch(patch);
  }

  subscribeProfile(callback: ProfileListener): Unsubscribe {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return () => {};

    const unsub = onSnapshot(doc(db, 'users', uid, 'profile', 'main'), (snap) => {
      callback(snap.exists() ? (snap.data() as UserProfile) : null);
    });
    this.unsubs.push(unsub);
    return unsub;
  }

  async getAppearanceSettings(): Promise<AppearanceSettings | null> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return null;
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'appearance'));
    return snap.exists() ? (snap.data() as AppearanceSettings) : null;
  }

  async updateAppearanceSettings(patch: Partial<AppearanceSettings>): Promise<void> {
    await engineWriteAppearancePatch(patch);
  }

  subscribeAppearanceSettings(callback: AppearanceListener): Unsubscribe {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return () => {};

    const unsub = onSnapshot(doc(db, 'users', uid, 'settings', 'appearance'), (snap) => {
      callback(snap.exists() ? (snap.data() as AppearanceSettings) : null);
    });
    this.unsubs.push(unsub);
    return unsub;
  }

  async getPreferences(): Promise<UserPreferences | null> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return null;
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'preferences'));
    return snap.exists() ? (snap.data() as UserPreferences) : null;
  }

  async updatePreferences(patch: any): Promise<void> {
    await engineWritePreferencesPatch(patch);
  }

  subscribePreferences(callback: PreferencesListener): Unsubscribe {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return () => {};

    const unsub = onSnapshot(doc(db, 'users', uid, 'settings', 'preferences'), (snap) => {
      callback(snap.exists() ? (snap.data() as UserPreferences) : null);
    });
    this.unsubs.push(unsub);
    return unsub;
  }

  async uploadProfilePhoto(file: File | Blob): Promise<string> {
    return await engineUploadProfilePhoto(file);
  }

  async unregisterDevice(): Promise<void> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (db && uid) {
      const id = getStableDeviceId();
      await setDoc(doc(db, 'users', uid, 'devices', id), {
        signedIn: false,
        currentSession: false,
        syncStatus: 'signedOut',
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  }

  async revokeDeviceSession(targetDeviceId: string): Promise<void> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (db && uid) {
      await setDoc(doc(db, 'users', uid, 'devices', targetDeviceId), {
        revokedAt: serverTimestamp(),
        signedIn: false,
        currentSession: false,
        syncStatus: 'revoked',
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  }

  async reconnectDevices(): Promise<void> {
    await engineReconnectDevices();
  }

  async checkCloudDataExists(appKey: string): Promise<boolean> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return false;
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'state', appKey));
      return snap.exists();
    } catch (e) {
      console.warn('[firebaseLegacy] checkCloudDataExists failed:', e);
      return false;
    }
  }

  async createCloudBackup(label: string, data: Record<string, any>): Promise<void> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return;
    try {
      const backupsColl = collection(db, 'users', uid, 'backups');
      const backupDocRef = doc(backupsColl);
      await setDoc(backupDocRef, {
        createdAt: serverTimestamp(),
        deviceId: getStableDeviceId(),
        label,
        data,
      });
    } catch (e: any) {
      console.warn('[firebaseLegacy] createCloudBackup failed:', e);
    }
  }

  async deleteCloudData(appKeys: string[]): Promise<void> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return;
    for (const app of appKeys) {
      try {
        await deleteDoc(doc(db, 'users', uid, 'state', app));
      } catch (e) {
        console.warn(`[firebaseLegacy] Failed to delete state for ${app}:`, e);
      }
    }
    try {
      localStorage.removeItem('chordex_sync_meta_v1');
    } catch (_) {}
  }

  async pullAppState(appKey: string): Promise<{ body: any; updatedAt: any; deviceId: string; schemaVersion?: number } | null> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return null;
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'state', appKey));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        body: data.body,
        updatedAt: data.updatedAt,
        deviceId: data.deviceId,
        schemaVersion: data.schemaVersion
      };
    } catch (e) {
      console.warn(`[firebaseLegacy] pullAppState failed for ${appKey}:`, e);
      return null;
    }
  }

  async pushAppState(appKey: string, data: { kind: string; body: any; deviceId: string; schemaVersion: number }): Promise<number> {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) throw new Error('Unauthenticated or DB not ready');
    const ref = doc(db, 'users', uid, 'state', appKey);
    await setDoc(ref, {
      kind: data.kind,
      body: data.body,
      updatedAt: serverTimestamp(),
      deviceId: data.deviceId,
      schemaVersion: data.schemaVersion
    }, { merge: false });
    const snap = await getDoc(ref);
    const updated = snap.data()?.updatedAt;
    if (updated && typeof updated.toMillis === 'function') {
      return updated.toMillis();
    }
    return Date.now();
  }

  getDiagnostics(): SyncDiagnostics {
    return engineStatus;
  }

  subscribeDiagnostics(callback: DiagnosticsListener): Unsubscribe {
    statusListeners.add(callback);
    callback(engineStatus);
    const unsub = () => {
      statusListeners.delete(callback);
    };
    this.unsubs.push(unsub);
    return unsub;
  }
}

function mergeMerge() {
  return { merge: true };
}

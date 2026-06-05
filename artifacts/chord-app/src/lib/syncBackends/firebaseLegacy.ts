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
  DiagnosticsListener 
} from './types';
import { 
  getSyncEngineDiagnostics,
  subscribeSyncEngine,
  runDirectFirestoreWriteTest,
  runSyncProbe,
  clearMyProbe,
  registerCurrentDevice,
  heartbeatNow,
  writeProfilePatch,
  writeAppearancePatch,
  writePreferencesPatch,
  uploadProfilePhoto,
  getStableDeviceId
} from '../syncEngine';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '../firebase';

export class FirebaseFirestoreLegacyProvider implements SyncBackendProvider {
  providerName = 'firebase-firestore-legacy';
  private unsubs: Unsubscribe[] = [];

  async init(): Promise<void> {
    // Already handled by auth hook in syncEngine.ts
  }

  async dispose(): Promise<void> {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
  }

  async getCurrentUserId(): Promise<string | null> {
    return getFirebaseAuth()?.currentUser?.uid || null;
  }

  async directWriteTest() {
    try {
      await runDirectFirestoreWriteTest();
      const diag = getSyncEngineDiagnostics();
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
      const nonce = await runSyncProbe();
      return { success: true, nonce };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }

  async clearSyncProbe() {
    await clearMyProbe();
  }

  subscribeSyncProbe(callback: ProbeListener): Unsubscribe {
    const db = getFirebaseDb();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!db || !uid) return () => {};
    
    const unsub = onSnapshot(collection(db, 'users', uid, 'syncProbe'), (snap) => {
      const probes: any[] = [];
      snap.forEach(doc => {
        probes.push({ id: doc.id, ...doc.data() } as any);
      });
      callback(probes);
    });
    this.unsubs.push(unsub);
    return unsub;
  }

  async registerCurrentDevice(reason: string) {
    try {
      await registerCurrentDevice(reason);
      const diag = getSyncEngineDiagnostics();
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
      await heartbeatNow(reason);
      const diag = getSyncEngineDiagnostics();
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
    if (!db || !uid) return () => {};

    const unsub = onSnapshot(collection(db, 'users', uid, 'devices'), (snap) => {
      const devices: any[] = [];
      snap.forEach(doc => {
        devices.push({ id: doc.id, ...doc.data() });
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
    await writeProfilePatch(patch);
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
    await writeAppearancePatch(patch);
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
    await writePreferencesPatch(patch);
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
    return await uploadProfilePhoto(file);
  }

  getDiagnostics(): SyncDiagnostics {
    const diag = getSyncEngineDiagnostics();
    return {
      ...diag,
      activeSyncProvider: this.providerName,
      authProvider: 'firebase',
      databaseProvider: 'firestore',
      storageProvider: 'firebase-storage',
      localDatabaseProvider: 'none',
      firebaseAuthUid: getFirebaseAuth()?.currentUser?.uid || 'Not signed in',
      supabaseUserId: 'N/A',
      currentDeviceId: getStableDeviceId(),
      currentPlatform: diag.currentPlatform,
      directWriteProvider: 'firestore',
      directWriteResult: diag.directWriteError === 'None' ? 'success' : (diag.directWriteError || 'N/A'),
      probeProvider: 'firestore',
      probeResult: diag.lastProbeWriteError === 'None' ? 'success' : (diag.lastProbeWriteError || 'N/A'),
      devicesProvider: 'firestore',
      devicesResult: diag.devicesListenerError || 'active',
      profileSyncResult: diag.lastProfileWriteError === 'None' ? 'success' : (diag.lastProfileWriteError || 'N/A'),
      appearanceSyncResult: diag.lastAppearanceWriteError === 'None' ? 'success' : (diag.lastAppearanceWriteError || 'N/A'),
      lastErrorCode: diag.firebaseErrorCode || 'None',
      lastErrorMessage: diag.firebaseErrorMessage || 'None',
      lastSuccessfulSyncAt: diag.lastHeartbeatSuccess,
      syncBackendVersion: diag.syncEngineVersion,
      realtimeConnected: diag.syncEngineStatus === 'active',
      lastRealtimeEventAt: diag.devicesLastSnapshotAt,
      lastManualRefetchAt: diag.lastActionAt
    };
  }

  subscribeDiagnostics(callback: DiagnosticsListener): Unsubscribe {
    const unsub = subscribeSyncEngine((state) => {
      callback(this.getDiagnostics());
    });
    this.unsubs.push(unsub);
    return unsub;
  }
}

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
import { supabase, isSupabaseConfigured, setFirebaseIdToken } from '../supabaseClient';
import { getFirebaseAuth } from '../firebase';
import { subscribeAuth } from '../auth';
import { getStableDeviceId, getDeviceDetails } from '../syncEngine';
import { APP_VERSION, APP_COMMIT_SHA } from '../appVersion';
import { isNative } from '../capgoUpdater';

export class SupabaseRealtimeProvider implements SyncBackendProvider {
  providerName = 'supabase-realtime';

  private userId: string | null = null;
  private deviceId: string = 'unknown';
  private unsubs: Unsubscribe[] = [];
  
  // Callbacks
  private devicesCallbacks = new Set<DevicesListener>();
  private profileCallbacks = new Set<ProfileListener>();
  private appearanceCallbacks = new Set<AppearanceListener>();
  private preferencesCallbacks = new Set<PreferencesListener>();
  private probeCallbacks = new Set<ProbeListener>();
  private diagnosticsCallbacks = new Set<DiagnosticsListener>();

  // Diagnostic State
  private diagState: Partial<SyncDiagnostics> = {
    activeSyncProvider: 'supabase-realtime',
    authProvider: 'firebase',
    databaseProvider: 'supabase',
    storageProvider: 'supabase-storage',
    localDatabaseProvider: 'none',
    firebaseAuthUid: 'Not signed in',
    supabaseUserId: 'N/A',
    currentDeviceId: 'Unknown',
    currentPlatform: isNative() ? 'android' : 'web',
    directWriteProvider: 'supabase',
    directWriteResult: 'idle',
    probeProvider: 'supabase',
    probeResult: 'idle',
    devicesProvider: 'supabase',
    devicesResult: 'idle',
    profileSyncResult: 'idle',
    appearanceSyncResult: 'idle',
    lastErrorCode: 'None',
    lastErrorMessage: 'None',
    lastSuccessfulSyncAt: 'Never',
    syncBackendVersion: 'supabase-v1',
    realtimeConnected: false,
    lastRealtimeEventAt: 'Never',
    lastManualRefetchAt: 'Never',

    // UI Back-compat defaults
    authReady: false,
    authUid: 'Not signed in',
    authEmail: 'N/A',
    syncEngineStatus: 'inactive',
    activeListenerCount: 0,
    lastAuthChangeAt: 'Never',
    firebaseAppsCount: 0,
    firebaseAppName: 'None',
    firebaseProjectId: 'Supabase Configured',
    firebaseAppId: 'Supabase Configured',
    firebaseAuthDomain: 'N/A',
    firebaseStorageBucket: 'N/A',
    dbAvailable: true,
    authAvailable: true,
    storageAvailable: true,
    firebaseInitError: 'None',
    syncEngineInitError: 'None',
    devicesLogicVersion: 'devices-v3.6.12-supabase',
    syncEngineVersion: 'supabase-v1',
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
    lastAction: 'None',
    lastActionAt: 'Never',
    buttonActionStatus: 'idle',
    firestoreTransportMode: 'supabase-realtime',
    firestorePersistenceMode: 'in-memory',
    firestoreInitSource: 'supabase-client',
    probeListenerAttachedAt: 'Never',
    probeSnapshotFromCache: false,
    probeSnapshotHasPendingWrites: false,
    writeStage: 'idle',
    writeStartedAt: 'Never',
    writeTimedOutAt: 'Never',
    writeDurationMs: null,
    firebaseErrorCode: 'None',
    firebaseErrorMessage: 'None',
    onlineState: 'Online',
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
    sameUidConfirmed: true,
    sameProjectConfirmed: true,
    cloudTheme: 'N/A',
    cloudAccentColor: 'N/A',
    cloudDisplayName: 'N/A',
    cloudPhotoURL: 'N/A',
    cloudPreferences: null,
    probeDocs: []
  };

  private realtimeChannel: any = null;
  private refetchInterval: any = null;

  async init(): Promise<void> {
    this.deviceId = getStableDeviceId();
    this.diagState.currentDeviceId = this.deviceId;
    
    // Subscribe to Firebase Auth and dynamically acquire the token
    const unsubAuth = subscribeAuth(async (user) => {
      if (user) {
        this.userId = user.uid;
        this.diagState.firebaseAuthUid = user.uid;
        this.diagState.supabaseUserId = user.uid;
        this.diagState.authUid = user.uid;
        this.diagState.authEmail = user.email || 'N/A';
        this.diagState.authReady = true;
        this.diagState.syncEngineStatus = 'active';
        this.diagState.lastAuthChangeAt = new Date().toLocaleString();

        try {
          const rawUser = getFirebaseAuth()?.currentUser;
          if (!rawUser) throw new Error('No active Firebase user instance');
          const token = await rawUser.getIdToken();
          setFirebaseIdToken(token);
          this.diagState.firestoreInitSource = 'firebase-auth-token-bridged';
          
          // Setup Realtime Channels and Initial registration
          this.setupRealtimeAndPresence(user.uid);
          await this.registerCurrentDevice('init-auth');
          await this.heartbeatNow('init-auth');
          this.startPeriodicRefetch(user.uid);
        } catch (e: any) {
          console.error('[supabaseRealtime] Token retrieval failed:', e);
          this.updateDiag({
            syncEngineInitError: e.message || String(e),
            syncEngineStatus: 'error'
          });
        }
      } else {
        this.userId = null;
        setFirebaseIdToken(null);
        this.clearSubscriptions();
        this.diagState.firebaseAuthUid = 'Not signed in';
        this.diagState.supabaseUserId = 'N/A';
        this.diagState.authUid = 'Not signed in';
        this.diagState.authEmail = 'N/A';
        this.diagState.authReady = false;
        this.diagState.syncEngineStatus = 'inactive';
        this.diagState.lastAuthChangeAt = new Date().toLocaleString();
        this.updateDiag({});
      }
    });

    this.unsubs.push(() => {
      unsubAuth();
      this.clearSubscriptions();
    });
  }

  async dispose(): Promise<void> {
    this.unsubs.forEach(u => u());
    this.unsubs = [];
    this.clearSubscriptions();
  }

  async getCurrentUserId(): Promise<string | null> {
    return this.userId;
  }

  private updateDiag(patch: Partial<SyncDiagnostics>) {
    this.diagState = { ...this.diagState, ...patch } as SyncDiagnostics;
    this.diagState.activeListenerCount = 
      (this.devicesCallbacks.size > 0 ? 1 : 0) + 
      (this.profileCallbacks.size > 0 ? 1 : 0) + 
      (this.appearanceCallbacks.size > 0 ? 1 : 0) + 
      (this.preferencesCallbacks.size > 0 ? 1 : 0) + 
      (this.probeCallbacks.size > 0 ? 1 : 0);

    this.diagnosticsCallbacks.forEach(cb => cb(this.diagState as SyncDiagnostics));
  }

  private clearSubscriptions() {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
    if (this.refetchInterval) {
      clearInterval(this.refetchInterval);
      this.refetchInterval = null;
    }
    this.diagState.realtimeConnected = false;
  }

  private startPeriodicRefetch(userId: string) {
    if (this.refetchInterval) clearInterval(this.refetchInterval);
    this.refetchInterval = setInterval(() => {
      this.refetchAllData(userId, 'periodic-fallback');
    }, 15000);
  }

  private async refetchAllData(userId: string, source: string) {
    if (!supabase) return;
    const nowStr = new Date().toLocaleString();
    this.updateDiag({ lastManualRefetchAt: nowStr, lastAction: `Refetch data (${source})` });

    try {
      // 1. Fetch user profile
      const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
      if (profile) {
        this.updateDiag({
          cloudDisplayName: profile.display_name || 'N/A',
          cloudPhotoURL: profile.photo_url || 'N/A',
          profileLastSnapshotAt: nowStr,
          profileListenerStatus: 'active'
        });
        const mappedProfile: UserProfile = {
          displayName: profile.display_name,
          photoURL: profile.photo_url,
          avatarIcon: profile.avatar_icon
        };
        this.profileCallbacks.forEach(cb => cb(mappedProfile));
      }

      // 2. Fetch appearance
      const { data: appearance } = await supabase.from('user_appearance_settings').select('*').eq('user_id', userId).maybeSingle();
      if (appearance) {
        this.updateDiag({
          cloudTheme: appearance.theme || 'N/A',
          cloudAccentColor: appearance.accent_color || 'N/A',
          appearanceLastSnapshotAt: nowStr,
          appearanceListenerStatus: 'active'
        });
        const mappedAppearance: AppearanceSettings = {
          theme: appearance.theme,
          accentColor: appearance.accent_color,
          customAccentHue: Number(appearance.custom_accent_hue || 220),
          palette: appearance.palette,
          language: appearance.language
        };
        this.appearanceCallbacks.forEach(cb => cb(mappedAppearance));
      }

      // 3. Fetch preferences
      const { data: preferences } = await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
      if (preferences) {
        this.updateDiag({
          cloudPreferences: preferences.studio_preferences || null,
          preferencesLastSnapshotAt: nowStr,
          preferencesListenerStatus: 'active'
        });
        const mappedPreferences: UserPreferences = {
          studioPreferences: preferences.studio_preferences,
          modulePreferences: preferences.module_preferences
        };
        this.preferencesCallbacks.forEach(cb => cb(mappedPreferences));
      }

      // 4. Fetch devices
      const { data: devices } = await supabase.from('user_devices').select('*').eq('user_id', userId);
      if (devices) {
        const mappedDevices: SyncDevice[] = devices.map(d => ({
          id: d.id,
          deviceId: d.device_id,
          userId: d.user_id,
          platform: d.platform || 'unknown',
          deviceType: d.device_type || 'desktop',
          shortName: d.short_name || 'Device',
          displayName: d.display_name || 'Device',
          technicalName: d.technical_name || 'Device',
          appVersion: d.app_version || 'N/A',
          versionCode: d.version_code || 0,
          buildType: d.build_type || 'Web',
          browser: d.browser || 'Browser',
          os: d.os || 'OS',
          model: d.model || 'Model',
          manufacturer: d.manufacturer || 'Manufacturer',
          signedIn: d.signed_in,
          currentSession: d.current_session,
          syncStatus: d.sync_status,
          classification: d.device_id === this.deviceId ? 'current' : (d.sync_status === 'active' ? 'activeRemote' : 'signedOut'),
          classificationReason: d.device_id === this.deviceId ? 'Current active session' : 'Remote device session'
        }));
        this.updateDiag({
          devices: mappedDevices,
          devicesLastSnapshotAt: nowStr,
          devicesSnapshotCount: devices.length,
          devicesListenerStatus: 'active'
        });
        this.devicesCallbacks.forEach(cb => cb(mappedDevices));
      }

      // 5. Fetch probes
      const { data: probes } = await supabase.from('sync_probe').select('*').eq('user_id', userId);
      if (probes) {
        const mappedProbes: ProbeDoc[] = probes.map(p => ({
          id: p.id,
          deviceId: p.device_id,
          platform: p.platform || 'unknown',
          shortName: p.short_name || 'Unknown',
          appVersion: p.app_version || 'N/A',
          buildType: p.build_type || 'Web',
          nonce: p.nonce || 'None',
          writtenAt: p.written_at ? new Date(p.written_at).getTime() : Date.now(),
          updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now()
        }));
        
        const deviceIds = mappedProbes.map(p => p.deviceId);
        const nonces = mappedProbes.map(p => p.nonce);
        
        this.updateDiag({
          probeDocs: mappedProbes,
          lastProbeSnapshotAt: nowStr,
          probeDocumentsReceived: probes.length,
          probeDeviceIdsReceived: deviceIds,
          probeNoncesReceived: nonces,
          androidProbeDetected: mappedProbes.some(p => p.platform === 'android'),
          webProbeDetected: mappedProbes.some(p => p.platform === 'web'),
          probeListenerStatus: 'active'
        });
        this.probeCallbacks.forEach(cb => cb(mappedProbes));
      }

      this.updateDiag({
        lastSuccessfulSyncAt: nowStr,
        dbAvailable: true
      });
    } catch (e: any) {
      console.warn('[supabaseRealtime] Refetch data failed:', e);
      this.updateDiag({
        lastErrorCode: e.code || 'fetch-error',
        lastErrorMessage: e.message || String(e)
      });
    }
  }

  private setupRealtimeAndPresence(userId: string) {
    if (!supabase) return;
    this.clearSubscriptions();

    this.updateDiag({
      devicesListenerStatus: 'attaching',
      profileListenerStatus: 'attaching',
      appearanceListenerStatus: 'attaching',
      preferencesListenerStatus: 'attaching',
      probeListenerStatus: 'attaching',
      probeListenerAttachedAt: new Date().toLocaleString()
    });

    // Initialize Realtime Channel
    this.realtimeChannel = supabase.channel(`sync-realtime:${userId}`);

    this.realtimeChannel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles', filter: `user_id=eq.${userId}` }, (payload: any) => {
        this.updateDiag({ lastRealtimeEventAt: new Date().toLocaleString() });
        this.refetchAllData(userId, 'realtime-user-profiles-event');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_appearance_settings', filter: `user_id=eq.${userId}` }, (payload: any) => {
        this.updateDiag({ lastRealtimeEventAt: new Date().toLocaleString() });
        this.refetchAllData(userId, 'realtime-appearance-event');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${userId}` }, (payload: any) => {
        this.updateDiag({ lastRealtimeEventAt: new Date().toLocaleString() });
        this.refetchAllData(userId, 'realtime-preferences-event');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_devices', filter: `user_id=eq.${userId}` }, (payload: any) => {
        this.updateDiag({ lastRealtimeEventAt: new Date().toLocaleString() });
        this.refetchAllData(userId, 'realtime-devices-event');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_probe', filter: `user_id=eq.${userId}` }, (payload: any) => {
        this.updateDiag({ lastRealtimeEventAt: new Date().toLocaleString() });
        this.refetchAllData(userId, 'realtime-probe-event');
      })
      .subscribe((status: string) => {
        const isConnected = status === 'SUBSCRIBED';
        this.updateDiag({ realtimeConnected: isConnected });
      });

    // Initial Fetch
    this.refetchAllData(userId, 'realtime-initial-mount');
  }

  async directWriteTest() {
    const uid = this.userId;
    const deviceId = this.deviceId;
    const nowStr = new Date().toLocaleString();
    const startTime = Date.now();

    this.updateDiag({
      directWriteAttempt: nowStr,
      buttonActionStatus: 'pending',
      directWritePath: `debug_writes/${uid}/${deviceId}`
    });

    if (!supabase || !uid) {
      const errStr = 'Supabase client or session token is missing';
      this.updateDiag({
        directWriteResult: 'failed',
        directWriteError: errStr,
        buttonActionStatus: 'error'
      });
      return { success: false, error: errStr };
    }

    const nonce = Math.random().toString(36).substring(2, 10).toUpperCase();
    const payload = {
      id: `${uid}:${deviceId}`,
      user_id: uid,
      device_id: deviceId,
      platform: isNative() ? 'android' : 'web',
      app_version: APP_VERSION,
      version_code: isNative() ? 36 : 0,
      build_type: isNative() ? 'Native Release' : 'Web',
      nonce,
      test_name: 'direct-supabase-write-test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { error: writeError } = await supabase.from('debug_writes').upsert(payload);
      if (writeError) throw writeError;

      const { data: readData, error: readError } = await supabase.from('debug_writes').select('*').eq('id', `${uid}:${deviceId}`).maybeSingle();
      if (readError) throw readError;

      const duration = Date.now() - startTime;
      this.updateDiag({
        directWriteSuccess: nowStr,
        directWriteResult: 'success',
        directWriteError: 'None',
        directWriteDurationMs: duration,
        directReadBackSuccess: nowStr,
        directReadBackError: 'None',
        directReadBackData: JSON.stringify(readData),
        buttonActionStatus: 'success'
      });

      return {
        success: true,
        durationMs: duration,
        readBackData: JSON.stringify(readData)
      };
    } catch (e: any) {
      console.warn('[supabaseRealtime] Direct write test failed:', e);
      const duration = Date.now() - startTime;
      const errorMsg = e.message || String(e);
      this.updateDiag({
        directWriteResult: 'failed',
        directWriteError: errorMsg,
        directWriteDurationMs: duration,
        directReadBackError: errorMsg,
        buttonActionStatus: 'error'
      });
      return { success: false, error: errorMsg };
    }
  }

  async sendSyncProbe() {
    const uid = this.userId;
    const deviceId = this.deviceId;
    const nowStr = new Date().toLocaleString();

    this.updateDiag({
      lastProbeWriteAttempt: nowStr,
      buttonActionStatus: 'pending',
      probeWritePath: `sync_probe/${uid}/${deviceId}`
    });

    if (!supabase || !uid) {
      const errStr = 'Session is not authenticated with Supabase';
      this.updateDiag({
        lastProbeWriteError: errStr,
        probeResult: 'failed',
        buttonActionStatus: 'error'
      });
      return { success: false, error: errStr };
    }

    const nonce = Math.random().toString(36).substring(2, 10).toUpperCase();
    const payload = {
      id: `${uid}:${deviceId}`,
      user_id: uid,
      device_id: deviceId,
      platform: isNative() ? 'android' : 'web',
      short_name: getDeviceDetails().shortName,
      app_version: APP_VERSION,
      version_code: isNative() ? 36 : 0,
      build_type: isNative() ? 'Native Release' : 'Web',
      nonce,
      written_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('sync_probe').upsert(payload);
      if (error) throw error;

      this.updateDiag({
        lastProbeWriteSuccess: nowStr,
        probeResult: 'success',
        lastProbeWriteError: 'None',
        buttonActionStatus: 'success'
      });

      // Optimistic refresh
      this.refetchAllData(uid, 'probe-write-success');

      return { success: true, nonce };
    } catch (e: any) {
      console.warn('[supabaseRealtime] Probe send failed:', e);
      const errorMsg = e.message || String(e);
      this.updateDiag({
        lastProbeWriteError: errorMsg,
        probeResult: 'failed',
        buttonActionStatus: 'error'
      });
      return { success: false, error: errorMsg };
    }
  }

  async clearSyncProbe() {
    const uid = this.userId;
    const deviceId = this.deviceId;
    if (!supabase || !uid) return;

    this.updateDiag({
      lastAction: 'Clear My Probe',
      buttonActionStatus: 'pending'
    });

    try {
      const { error } = await supabase.from('sync_probe').delete().eq('id', `${uid}:${deviceId}`);
      if (error) throw error;
      this.updateDiag({ buttonActionStatus: 'success' });
      this.refetchAllData(uid, 'probe-clear');
    } catch (e) {
      console.error('[supabaseRealtime] Clear probe failed:', e);
      this.updateDiag({ buttonActionStatus: 'error' });
    }
  }

  subscribeSyncProbe(callback: ProbeListener): Unsubscribe {
    this.probeCallbacks.add(callback);
    return () => {
      this.probeCallbacks.delete(callback);
    };
  }

  async registerCurrentDevice(reason: string) {
    const uid = this.userId;
    const deviceId = this.deviceId;
    const nowStr = new Date().toLocaleString();
    const startTime = Date.now();

    this.updateDiag({
      lastDeviceWriteAttemptedAt: nowStr,
      deviceRegistrationStatus: 'pending',
      lastDeviceRegistrationReason: reason,
      inFlightWriteStatus: true,
      deviceWritePath: `user_devices/${uid}/${deviceId}`
    });

    if (!supabase || !uid) {
      const errStr = 'Unauthenticated session';
      this.updateDiag({
        lastDeviceWriteError: errStr,
        deviceRegistrationStatus: 'failed',
        inFlightWriteStatus: false
      });
      return { success: false, error: errStr };
    }

    const details = getDeviceDetails();
    const payload = {
      id: `${uid}:${deviceId}`,
      user_id: uid,
      device_id: deviceId,
      platform: isNative() ? 'android' : 'web',
      device_type: isNative() ? 'phone' : 'desktop',
      short_name: details.shortName,
      display_name: details.displayName,
      technical_name: details.technicalName,
      app_version: APP_VERSION,
      version_code: isNative() ? 36 : 0,
      build_type: isNative() ? 'Native Release' : 'Web',
      browser: details.browser,
      os: details.os,
      model: details.model,
      manufacturer: details.manufacturer,
      signed_in: true,
      current_session: true,
      sync_status: 'active',
      last_seen_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by_device: deviceId,
      revision: 1,
      schema_version: 'studio-sync-v1'
    };

    try {
      const { error } = await supabase.from('user_devices').upsert(payload);
      if (error) throw error;

      this.updateDiag({
        lastDeviceWriteSuccess: nowStr,
        lastDeviceWriteError: 'None',
        lastDeviceWriteDurationMs: Date.now() - startTime,
        deviceRegistrationStatus: 'registered',
        inFlightWriteStatus: false
      });

      this.refetchAllData(uid, 'device-registered');
      return { success: true };
    } catch (e: any) {
      console.warn('[supabaseRealtime] Device registration failed:', e);
      const errorMsg = e.message || String(e);
      this.updateDiag({
        lastDeviceWriteError: errorMsg,
        deviceRegistrationStatus: 'failed',
        inFlightWriteStatus: false
      });
      return { success: false, error: errorMsg };
    }
  }

  async heartbeatNow(reason: string) {
    const uid = this.userId;
    const deviceId = this.deviceId;
    const nowStr = new Date().toLocaleString();

    if (!supabase || !uid) {
      const errStr = 'Unauthenticated';
      this.updateDiag({ lastHeartbeatError: errStr });
      return { success: false, error: errStr };
    }

    try {
      const { error } = await supabase.from('user_devices').upsert({
        id: `${uid}:${deviceId}`,
        user_id: uid,
        device_id: deviceId,
        last_seen_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by_device: deviceId
      });
      if (error) throw error;

      this.updateDiag({
        lastHeartbeatSuccess: nowStr,
        lastHeartbeatError: 'None'
      });
      return { success: true };
    } catch (e: any) {
      console.warn('[supabaseRealtime] Heartbeat failed:', e);
      const errorMsg = e.message || String(e);
      this.updateDiag({ lastHeartbeatError: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  subscribeDevices(callback: DevicesListener): Unsubscribe {
    this.devicesCallbacks.add(callback);
    return () => {
      this.devicesCallbacks.delete(callback);
    };
  }

  async getProfile(): Promise<UserProfile | null> {
    const uid = this.userId;
    if (!supabase || !uid) return null;

    try {
      const { data, error } = await supabase.from('user_profiles').select('*').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      return data ? {
        displayName: data.display_name,
        photoURL: data.photo_url,
        avatarIcon: data.avatar_icon
      } : null;
    } catch (e) {
      console.warn('[supabaseRealtime] getProfile failed:', e);
      return null;
    }
  }

  async updateProfile(patch: Partial<UserProfile>): Promise<void> {
    const uid = this.userId;
    const nowStr = new Date().toLocaleString();
    if (!supabase || !uid) return;

    const payload: any = {
      user_id: uid,
      updated_at: new Date().toISOString(),
      updated_by_device: this.deviceId
    };

    if (patch.displayName !== undefined) payload.display_name = patch.displayName;
    if (patch.photoURL !== undefined) payload.photo_url = patch.photoURL;
    if (patch.avatarIcon !== undefined) payload.avatar_icon = patch.avatarIcon;

    try {
      const { error } = await supabase.from('user_profiles').upsert(payload);
      if (error) throw error;

      this.updateDiag({
        lastProfileWriteSuccess: nowStr,
        lastProfileWriteError: 'None',
        profileSyncResult: 'success'
      });

      this.refetchAllData(uid, 'profile-update');
    } catch (e: any) {
      console.warn('[supabaseRealtime] updateProfile failed:', e);
      this.updateDiag({
        lastProfileWriteError: e.message || String(e),
        profileSyncResult: 'failed'
      });
      throw e;
    }
  }

  subscribeProfile(callback: ProfileListener): Unsubscribe {
    this.profileCallbacks.add(callback);
    return () => {
      this.profileCallbacks.delete(callback);
    };
  }

  async getAppearanceSettings(): Promise<AppearanceSettings | null> {
    const uid = this.userId;
    if (!supabase || !uid) return null;

    try {
      const { data, error } = await supabase.from('user_appearance_settings').select('*').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      return data ? {
        theme: data.theme,
        accentColor: data.accent_color,
        customAccentHue: Number(data.custom_accent_hue || 220),
        palette: data.palette,
        language: data.language
      } : null;
    } catch (e) {
      console.warn('[supabaseRealtime] getAppearanceSettings failed:', e);
      return null;
    }
  }

  async updateAppearanceSettings(patch: Partial<AppearanceSettings>): Promise<void> {
    const uid = this.userId;
    const nowStr = new Date().toLocaleString();
    if (!supabase || !uid) return;

    const payload: any = {
      user_id: uid,
      updated_at: new Date().toISOString(),
      updated_by_device: this.deviceId
    };

    if (patch.theme !== undefined) payload.theme = patch.theme;
    if (patch.accentColor !== undefined) payload.accent_color = patch.accentColor;
    if (patch.customAccentHue !== undefined) payload.custom_accent_hue = patch.customAccentHue;
    if (patch.palette !== undefined) payload.palette = patch.palette;
    if (patch.language !== undefined) payload.language = patch.language;

    try {
      const { error } = await supabase.from('user_appearance_settings').upsert(payload);
      if (error) throw error;

      this.updateDiag({
        lastAppearanceWriteSuccess: nowStr,
        lastAppearanceWriteError: 'None',
        appearanceSyncResult: 'success'
      });

      this.refetchAllData(uid, 'appearance-update');
    } catch (e: any) {
      console.warn('[supabaseRealtime] updateAppearanceSettings failed:', e);
      this.updateDiag({
        lastAppearanceWriteError: e.message || String(e),
        appearanceSyncResult: 'failed'
      });
      throw e;
    }
  }

  subscribeAppearanceSettings(callback: AppearanceListener): Unsubscribe {
    this.appearanceCallbacks.add(callback);
    return () => {
      this.appearanceCallbacks.delete(callback);
    };
  }

  async getPreferences(): Promise<UserPreferences | null> {
    const uid = this.userId;
    if (!supabase || !uid) return null;

    try {
      const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      return data ? {
        studioPreferences: data.studio_preferences,
        modulePreferences: data.module_preferences
      } : null;
    } catch (e) {
      console.warn('[supabaseRealtime] getPreferences failed:', e);
      return null;
    }
  }

  async updatePreferences(patch: any): Promise<void> {
    const uid = this.userId;
    const nowStr = new Date().toLocaleString();
    if (!supabase || !uid) return;

    try {
      const { error } = await supabase.from('user_preferences').upsert({
        user_id: uid,
        studio_preferences: patch,
        module_preferences: {},
        updated_at: new Date().toISOString(),
        updated_by_device: this.deviceId
      });
      if (error) throw error;

      this.updateDiag({
        lastPreferencesWriteSuccess: nowStr,
        lastPreferencesWriteError: 'None'
      });

      this.refetchAllData(uid, 'preferences-update');
    } catch (e: any) {
      console.warn('[supabaseRealtime] updatePreferences failed:', e);
      this.updateDiag({
        lastPreferencesWriteError: e.message || String(e)
      });
      throw e;
    }
  }

  subscribePreferences(callback: PreferencesListener): Unsubscribe {
    this.preferencesCallbacks.add(callback);
    return () => {
      this.preferencesCallbacks.delete(callback);
    };
  }

  async uploadProfilePhoto(file: File | Blob): Promise<string> {
    const uid = this.userId;
    if (!supabase || !uid) throw new Error('Unauthenticated Session');

    try {
      // 1. Upload to Supabase Storage Bucket 'avatars'
      const filePath = `${uid}/avatar.jpg`;
      
      // Remove any pre-existing avatar first to prevent cache issues
      await supabase.storage.from('avatars').remove([filePath]);

      const { data, error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: true
        });

      if (uploadErr) throw uploadErr;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      // 3. Update the Profile document
      await this.updateProfile({ photoURL: publicUrl });

      return publicUrl;
    } catch (e: any) {
      console.warn('[supabaseRealtime] uploadProfilePhoto failed:', e);
      this.updateDiag({
        lastPhotoUploadError: e.message || String(e)
      });
      throw e;
    }
  }

  getDiagnostics(): SyncDiagnostics {
    return this.diagState as SyncDiagnostics;
  }

  subscribeDiagnostics(callback: DiagnosticsListener): Unsubscribe {
    this.diagnosticsCallbacks.add(callback);
    callback(this.diagState as SyncDiagnostics);
    return () => {
      this.diagnosticsCallbacks.delete(callback);
    };
  }
}

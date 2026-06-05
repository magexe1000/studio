export interface UserProfile {
  displayName: string | null;
  photoURL: string | null;
  avatarIcon: string | null;
  updatedAt?: number;
  updatedByDevice?: string;
  revision?: number;
  schemaVersion?: string;
}

export interface AppearanceSettings {
  theme: string;
  accentColor: string;
  customAccentHue: number;
  palette: any;
  language: string;
  updatedAt?: number;
  updatedByDevice?: string;
  revision?: number;
  schemaVersion?: string;
}

export interface UserPreferences {
  studioPreferences: any;
  modulePreferences: any;
  updatedAt?: number;
  updatedByDevice?: string;
  revision?: number;
  schemaVersion?: string;
}

export interface SyncDevice {
  id: string;
  deviceId: string;
  userId: string;
  platform: string;
  deviceType: string;
  shortName: string;
  displayName: string;
  technicalName: string;
  appVersion: string;
  versionCode: number;
  buildType: string;
  browser: string;
  os: string;
  model: string;
  manufacturer: string;
  signedIn: boolean;
  currentSession: boolean;
  syncStatus: string;
  firstSeenAt?: any;
  lastSeenAt?: any;
  lastActiveAt?: any;
  updatedAt?: any;
  updatedByDevice?: string;
  revision?: number;
  schemaVersion?: string;
  classification?: string;
  classificationReason?: string;
}

export interface ProbeDoc {
  id: string;
  deviceId: string;
  platform: string;
  shortName: string;
  appVersion: string;
  buildType: string;
  commitSha?: string;
  nonce: string;
  writtenAt: number;
  updatedAt: number;
}

export interface DirectWriteResult {
  success: boolean;
  error?: string;
  durationMs?: number;
  readBackData?: string;
}

export interface ProbeResult {
  success: boolean;
  nonce?: string;
  error?: string;
}

export interface DeviceWriteResult {
  success: boolean;
  error?: string;
}

export interface HeartbeatResult {
  success: boolean;
  error?: string;
}

export interface SyncDiagnostics {
  activeSyncProvider: string;
  authProvider: string;
  databaseProvider: string;
  storageProvider: string;
  localDatabaseProvider: string;
  firebaseAuthUid: string;
  supabaseUserId: string;
  currentDeviceId: string;
  currentPlatform: string;
  directWriteProvider: string;
  directWriteResult: string;
  probeProvider: string;
  probeResult: string;
  devicesProvider: string;
  devicesResult: string;
  profileSyncResult: string;
  appearanceSyncResult: string;
  lastErrorCode: string;
  lastErrorMessage: string;
  lastSuccessfulSyncAt: string;
  syncBackendVersion: string;
  realtimeConnected: boolean;
  lastRealtimeEventAt: string;
  lastManualRefetchAt: string;

  // UI mapping fields to maintain compatibility
  authReady: boolean;
  authUid: string;
  authEmail: string;
  syncEngineStatus: 'inactive' | 'active' | 'error';
  activeListenerCount: number;
  lastAuthChangeAt: string;

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
  listenerPath: string;

  devicesListenerStatus: 'idle' | 'attaching' | 'active' | 'error';
  devicesListenerError: string | null;
  devicesLastSnapshotAt: string;
  devicesSnapshotCount: number;
  devicesFromCache: boolean;
  devicesHasPendingWrites: boolean;
  devices: SyncDevice[];

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

  directWritePath: string;
  directWriteAttempt: string;
  directWriteSuccess: string;
  directWriteError: string;
  directWriteDurationMs: number | null;
  directReadBackSuccess: string;
  directReadBackError: string;
  directReadBackData: string;
  directListenerDocumentsReceived: number;
  directListenerDeviceIdsReceived: string[];

  lastAction: string;
  lastActionAt: string;
  buttonActionStatus: string;

  firestoreTransportMode: string;
  firestorePersistenceMode: string;
  firestoreInitSource: string;

  probeListenerAttachedAt: string;
  probeSnapshotFromCache: boolean;
  probeSnapshotHasPendingWrites: boolean;

  writeStage: string;
  writeStartedAt: string;
  writeTimedOutAt: string;
  writeDurationMs: number | null;
  firebaseErrorCode: string;
  firebaseErrorMessage: string;
  onlineState: string;
  snapshotFromCache: boolean;
  hasPendingWrites: boolean;

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

  cloudTheme: string;
  cloudAccentColor: string;
  cloudDisplayName: string;
  cloudPhotoURL: string;
  cloudPreferences: any;

  probeDocs: ProbeDoc[];
}

export type Unsubscribe = () => void;
export type DevicesListener = (devices: SyncDevice[]) => void;
export type ProfileListener = (profile: UserProfile | null) => void;
export type AppearanceListener = (settings: AppearanceSettings | null) => void;
export type PreferencesListener = (preferences: UserPreferences | null) => void;
export type ProbeListener = (probes: ProbeDoc[]) => void;
export type DiagnosticsListener = (diagnostics: SyncDiagnostics) => void;

export interface SyncBackendProvider {
  providerName: string;

  init(): Promise<void>;
  dispose(): Promise<void>;

  getCurrentUserId(): Promise<string | null>;

  directWriteTest(): Promise<DirectWriteResult>;

  sendSyncProbe(): Promise<ProbeResult>;
  clearSyncProbe(): Promise<void>;
  subscribeSyncProbe(callback: ProbeListener): Unsubscribe;

  registerCurrentDevice(reason: string): Promise<DeviceWriteResult>;
  heartbeatNow(reason: string): Promise<HeartbeatResult>;
  subscribeDevices(callback: DevicesListener): Unsubscribe;

  getProfile(): Promise<UserProfile | null>;
  updateProfile(patch: Partial<UserProfile>): Promise<void>;
  subscribeProfile(callback: ProfileListener): Unsubscribe;

  getAppearanceSettings(): Promise<AppearanceSettings | null>;
  updateAppearanceSettings(patch: Partial<AppearanceSettings>): Promise<void>;
  subscribeAppearanceSettings(callback: AppearanceListener): Unsubscribe;

  getPreferences(): Promise<UserPreferences | null>;
  updatePreferences(patch: any): Promise<void>;
  subscribePreferences(callback: PreferencesListener): Unsubscribe;

  uploadProfilePhoto(file: File | Blob): Promise<string>;

  getDiagnostics(): SyncDiagnostics;
  subscribeDiagnostics(callback: DiagnosticsListener): Unsubscribe;
}

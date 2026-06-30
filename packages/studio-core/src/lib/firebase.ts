import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { useChordStore } from '../store/useChordStore';
// Committed public client config — these keys are safe to ship in the
// JS bundle (Firebase web client keys identify the project, they don't
// grant access; access control lives in Firestore Security Rules).
// See firebase.config.json for the full security note.
import bundledConfig from '../../firebase.config.json';

// Two-layer config resolution:
//   1. Env vars (VITE_FIREBASE_*) take priority. This lets a build
//      target a different Firebase project (staging, a fork) without
//      touching the committed JSON.
//   2. Fall back to the committed JSON. This is what makes the APK
//      builds "just work" on a fresh machine — the previous behaviour
//      required the developer to manually export six env vars before
//      every release, and forgetting any one of them produced the
//      "Cloud sync is not configured for this build" error inside
//      Settings → Account on the phone.
const env = import.meta.env;
function pick(envValue: string | undefined, fallback: string | undefined): string | undefined {
  const v = (envValue ?? '').trim();
  return v ? v : fallback;
}
const config = {
  apiKey: pick(env.VITE_FIREBASE_API_KEY as string | undefined, bundledConfig.apiKey),
  authDomain: pick(env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined, bundledConfig.authDomain),
  projectId: pick(env.VITE_FIREBASE_PROJECT_ID as string | undefined, bundledConfig.projectId),
  storageBucket: pick(
    env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    bundledConfig.storageBucket,
  ),
  messagingSenderId: pick(
    env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    bundledConfig.messagingSenderId,
  ),
  appId: pick(env.VITE_FIREBASE_APP_ID as string | undefined, bundledConfig.appId),
};

export const isFirebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _initError: string | null = null;
let _persistenceMode: string = 'none';
let _initSource: string = 'not-started';

function init() {
  if (_app) return;
  const isEnvConfigured = Boolean(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_AUTH_DOMAIN &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID
  );
  _initSource = isEnvConfigured ? 'environment-variables' : 'bundled-config';

  if (!isFirebaseConfigured) {
    _initError = `Missing config fields: ${[
      !config.apiKey && 'apiKey',
      !config.authDomain && 'authDomain',
      !config.projectId && 'projectId',
      !config.appId && 'appId'
    ].filter(Boolean).join(', ')}`;
    return;
  }
  try {
    const apps = getApps();
    if (apps.length > 0) {
      _app = apps[0];
    } else {
      _app = initializeApp({
        apiKey: config.apiKey!,
        authDomain: config.authDomain!,
        projectId: config.projectId!,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId!,
      });
    }
    _auth = getAuth(_app);
    _storage = getStorage(_app);
    setPersistence(_auth, browserLocalPersistence).catch((err) => {
      console.warn('[firebase] failed to set auth persistence:', err);
    });
  } catch (err: any) {
    _initError = err.message || String(err);
    console.error('[firebase] initialization failed:', err);
  }
}

let firestoreInitStack = 'never';

function initFirestoreOnly() {
  if (_db || !_app) return;
  const providerKey = useChordStore.getState().settings?.syncBackendProvider;
  if (providerKey !== 'firebase-firestore-legacy') {
    return;
  }
  firestoreInitStack = new Error().stack || 'unknown stack';

  // Use initializeFirestore (NOT getFirestore) so we can configure two
  // critical things up front:
  //
  //  1. experimentalAutoDetectLongPolling — Firestore's default
  //     transport is WebChannel over fetch streams, which gets
  //     mangled by many proxies (preview webviews/iframes, corporate
  //     HTTPS-inspecting proxies, some mobile carriers, Capacitor's
  //     WebView on certain Android builds). When the WebChannel
  //     handshake stalls, every getDoc / setDoc throws "client is
  //     offline" even though the network is fine.
  //     Auto-detection probes once, then transparently falls back to
  //     long-polling for the rest of the session if needed. Costs one
  //     extra round-trip on first connect; saves the entire sync flow.
  //
  //  2. persistentLocalCache — IndexedDB-backed cache. This means:
  //       • getDoc returns cached data instantly while the network
  //         connection is still being established (eliminates the
  //         cold-start "offline" race),
  //       • setDoc queues writes when truly offline and flushes them
  //         when the connection returns,
  //       • the user keeps seeing their cloud state even with no signal.
  //     `persistentMultipleTabManager` lets multiple tabs of the app
  //     share the same cache safely (no "failed-precondition" errors
  //     when the user opens the app in two tabs).
  // Try persistent (IndexedDB) cache first. If the runtime environment
  // doesn't support it — Safari private mode, some restricted Android
  // WebViews, browsers with IndexedDB disabled — fall back to an
  // in-memory cache so sync still works (just without offline reads
  // surviving a reload). The fallback keeps the long-polling fix in
  // place, which is the more important half of this change.
  // Transport selection — third attempt:
  //
  //   1. Default WebChannel: failed on Capacitor WebView with
  //      "Failed to get document because the client is offline".
  //   2. experimentalForceLongPolling: also failing for some users.
  //      Forcing the slow path doesn't help if the slow path itself
  //      can't establish the long-poll handshake.
  //   3. experimentalAutoDetectLongPolling + a generous
  //      experimentalLongPollingOptions.timeoutSeconds: probes both
  //      transports and uses whichever works. The extended timeout
  //      gives flaky mobile networks a real chance to complete the
  //      initial handshake before the SDK gives up and decides it's
  //      "offline". Default is 30s but we set it explicitly so the
  //      change is visible to anyone reading this code.
  try {
    const firestoreOpts = {
      experimentalAutoDetectLongPolling: true,
      experimentalLongPollingOptions: { timeoutSeconds: 30 },
    } as const;
    try {
      _db = initializeFirestore(_app, {
        ...firestoreOpts,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
      _persistenceMode = 'persistent';
    } catch (err) {
      console.warn(
        '[firebase] persistent cache unavailable, using memory cache:',
        err,
      );
      _db = initializeFirestore(_app, {
        ...firestoreOpts,
        localCache: memoryLocalCache(),
      });
      _persistenceMode = 'memory';
    }
  } catch (err: any) {
    _initError = err.message || String(err);
    console.error('[firebase] Firestore initialization failed:', err);
  }
}

export function getFirebaseApp(): FirebaseApp | null {
  init();
  return _app;
}

export function getFirebaseInitError(): string | null {
  init();
  return _initError;
}

export function getFirebaseAuth(): Auth | null {
  init();
  return _auth;
}

export function getFirebaseDb(): Firestore | null {
  const providerKey = useChordStore.getState().settings?.syncBackendProvider;
  if (providerKey !== 'firebase-firestore-legacy') {
    return null;
  }
  init();
  initFirestoreOnly();
  return _db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  init();
  return _storage;
}

export function getFirebaseProjectId(): string {
  init();
  return _app?.options.projectId || 'Not Configured';
}

export function getFirebaseConfigDetails() {
  init();
  const providerKey = useChordStore.getState().settings?.syncBackendProvider;
  if (providerKey === 'firebase-firestore-legacy') {
    initFirestoreOnly();
  }
  const app = _app;
  return {
    projectId: app?.options.projectId || 'Not Configured',
    appId: app?.options.appId || 'Not Configured',
    authDomain: app?.options.authDomain || 'Not Configured',
    storageBucket: app?.options.storageBucket || 'Not Configured',
    appName: app?.name || 'None',
    appsCount: getApps().length,
    initError: _initError || 'None',
    firestoreTransportMode: 'auto-detect (long-polling + fetch streams)',
    firestorePersistenceMode: _persistenceMode,
    firestoreInitSource: _initSource,
  };
}

export const googleProvider = new GoogleAuthProvider();

// ── FIRESTORE DIAGNOSTICS & HARD GATE TRACKING ──
let activeListenersCount = 0;
let activeWritesCount = 0;
let lastFirestoreError = 'none';

export function incrementFirestoreListeners() {
  const providerKey = useChordStore.getState().settings?.syncBackendProvider;
  if (providerKey !== 'firebase-firestore-legacy') return;
  activeListenersCount++;
}

export function decrementFirestoreListeners() {
  activeListenersCount = Math.max(0, activeListenersCount - 1);
}

export function incrementFirestoreWrites() {
  const providerKey = useChordStore.getState().settings?.syncBackendProvider;
  if (providerKey !== 'firebase-firestore-legacy') return;
  activeWritesCount++;
}

export function decrementFirestoreWrites() {
  activeWritesCount = Math.max(0, activeWritesCount - 1);
}

export function setFirestoreLastError(err: string) {
  const providerKey = useChordStore.getState().settings?.syncBackendProvider;
  if (providerKey !== 'firebase-firestore-legacy') return;
  lastFirestoreError = err || 'none';
}

export function getFirestoreDiagnostics() {
  const providerKey = useChordStore.getState().settings?.syncBackendProvider || 'supabase-realtime';
  const isActive = providerKey === 'firebase-firestore-legacy' && _db !== null;
  return {
    syncProvider: providerKey,
    firestoreRuntimeActive: isActive,
    firestoreListenChannels: providerKey !== 'firebase-firestore-legacy' ? 0 : activeListenersCount,
    firestoreWriteChannels: providerKey !== 'firebase-firestore-legacy' ? 0 : activeWritesCount,
    firestoreLastError: providerKey !== 'firebase-firestore-legacy' ? 'none' : lastFirestoreError,
    firestoreInitStack
  };
}

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
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

function init() {
  if (!isFirebaseConfigured) return;
  if (_app) return;
  _app = initializeApp({
    apiKey: config.apiKey!,
    authDomain: config.authDomain!,
    projectId: config.projectId!,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId!,
  });
  _auth = getAuth(_app);

  // Use initializeFirestore (NOT getFirestore) so we can configure two
  // critical things up front:
  //
  //  1. experimentalAutoDetectLongPolling — Firestore's default
  //     transport is WebChannel over fetch streams, which gets
  //     mangled by many proxies (Replit's preview iframe, corporate
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
  } catch (err) {
    console.warn(
      '[firebase] persistent cache unavailable, using memory cache:',
      err,
    );
    _db = initializeFirestore(_app, {
      ...firestoreOpts,
      localCache: memoryLocalCache(),
    });
  }
}

export function getFirebaseAuth(): Auth | null {
  init();
  return _auth;
}

export function getFirebaseDb(): Firestore | null {
  init();
  return _db;
}

export const googleProvider = new GoogleAuthProvider();

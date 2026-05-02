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

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
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
  try {
    _db = initializeFirestore(_app, {
      experimentalAutoDetectLongPolling: true,
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
      experimentalAutoDetectLongPolling: true,
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

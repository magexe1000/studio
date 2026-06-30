import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured, incrementFirestoreListeners, decrementFirestoreListeners, incrementFirestoreWrites, decrementFirestoreWrites, setFirestoreLastError } from './firebase';
import { subscribeAuth, deleteAccount, type AuthUser } from './auth';
import { deleteCloudData } from './sync';
import { useChordStore } from '../store/useChordStore';

/**
 * Soft-delete account system with a 7-day grace period.
 *
 * Strategy:
 *   • Scheduling deletion writes a small meta doc — `users/{uid}/meta/account`
 *     — with `{ status: 'pending_deletion', scheduledAtMs }`. No user data is
 *     touched, so a restore is fully reversible.
 *   • On every sign-in (and live via onSnapshot) the app reads this meta doc.
 *     If status is `pending_deletion` and we are still within the grace
 *     window, the UI shows a lockdown screen with a countdown and a Restore
 *     button. If we are past the window, the app finalizes deletion: wipes
 *     cloud data, deletes the meta doc, then deletes the Firebase Auth user.
 *   • Restoring sets `{ status: 'active', scheduledAtMs: null }`.
 */

export const ACCOUNT_GRACE_DAYS = 7;
export const ACCOUNT_GRACE_MS = ACCOUNT_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type AccountDoc = {
  status: 'active' | 'pending_deletion' | 'disabled';
  scheduledAtMs: number | null;
};

export type AccountState =
  | { phase: 'unknown' }    // Firebase isn't configured at all
  | { phase: 'signedOut' }
  | { phase: 'active'; user: AuthUser }
  | { phase: 'pending'; user: AuthUser; scheduledAtMs: number }
  | { phase: 'disabled'; user: AuthUser };

function metaRef(uid: string) {
  const db = getFirebaseDb();
  if (!db) return null;
  return doc(db, 'users', uid, 'meta', 'account');
}

function parseDoc(data: unknown): AccountDoc | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<AccountDoc>;
  return {
    status: d.status === 'pending_deletion' ? 'pending_deletion' : 'active',
    scheduledAtMs: typeof d.scheduledAtMs === 'number' ? d.scheduledAtMs : null,
  };
}

export async function getAccountDoc(uid: string): Promise<AccountDoc | null> {
  const ref = metaRef(uid);
  if (!ref) return null;
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return parseDoc(snap.data());
  } catch (err: any) {
    setFirestoreLastError(err.message || String(err));
    return null;
  }
}

export async function scheduleAccountDeletion(uid: string): Promise<void> {
  const ref = metaRef(uid);
  if (!ref) throw new Error('Firebase not configured');
  try {
    incrementFirestoreWrites();
    await setDoc(ref, {
      status: 'pending_deletion',
      scheduledAtMs: Date.now() + ACCOUNT_GRACE_MS,
      requestedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err: any) {
    setFirestoreLastError(err.message || String(err));
    throw err;
  } finally {
    decrementFirestoreWrites();
  }
}

export async function disableAccount(uid: string): Promise<void> {
  const ref = metaRef(uid);
  if (!ref) throw new Error('Firebase not configured');
  try {
    incrementFirestoreWrites();
    await setDoc(ref, {
      status: 'disabled',
      scheduledAtMs: null,
      disabledAt: serverTimestamp(),
    }, { merge: true });
  } catch (err: any) {
    setFirestoreLastError(err.message || String(err));
    throw err;
  } finally {
    decrementFirestoreWrites();
  }
}

export async function enableAccount(uid: string): Promise<void> {
  const ref = metaRef(uid);
  if (!ref) throw new Error('Firebase not configured');
  try {
    incrementFirestoreWrites();
    await setDoc(ref, {
      status: 'active',
      scheduledAtMs: null,
      enabledAt: serverTimestamp(),
    }, { merge: true });
  } catch (err: any) {
    setFirestoreLastError(err.message || String(err));
    throw err;
  } finally {
    decrementFirestoreWrites();
  }
}

export async function cancelAccountDeletion(uid: string): Promise<void> {
  const ref = metaRef(uid);
  if (!ref) throw new Error('Firebase not configured');
  try {
    incrementFirestoreWrites();
    await setDoc(ref, {
      status: 'active',
      scheduledAtMs: null,
      cancelledAt: serverTimestamp(),
    }, { merge: true });
  } catch (err: any) {
    setFirestoreLastError(err.message || String(err));
    throw err;
  } finally {
    decrementFirestoreWrites();
  }
}

/**
 * Permanently wipe everything. Wipes cloud data first so the meta-doc and
 * auth-user removal happen last — that way a partial failure leaves the
 * lockdown screen intact and the user can retry on next sign-in.
 */
export async function finalizeAccountDeletion(uid: string): Promise<void> {
  try { await deleteCloudData(); } catch { /* continue */ }
  const ref = metaRef(uid);
  if (ref) {
    try {
      incrementFirestoreWrites();
      await deleteDoc(ref);
    } catch (err: any) {
      setFirestoreLastError(err.message || String(err));
      /* continue */
    } finally {
      decrementFirestoreWrites();
    }
  }
  await deleteAccount();
}

/**
 * Real-time listener for the account meta doc. Emits `null` when the doc
 * doesn't exist yet (which means the account has never been scheduled).
 */
export function subscribeAccountStatus(
  uid: string,
  cb: (doc: AccountDoc | null) => void,
): () => void {
  const ref = metaRef(uid);
  if (!ref) { cb(null); return () => {}; }
  incrementFirestoreListeners();
  const innerUnsub = onSnapshot(
    ref,
    (snap) => cb(snap.exists() ? parseDoc(snap.data()) : null),
    (err) => {
      setFirestoreLastError(err.message || String(err));
      cb(null);
    },
  );
  return () => {
    innerUnsub();
    decrementFirestoreListeners();
  };
}

/**
 * Combined auth + status subscription. Optimistically emits `active` as soon
 * as auth resolves so signed-in users see no flicker. Switches to `pending`
 * only if Firestore confirms a pending deletion.
 */
export function subscribeAccountState(cb: (s: AccountState) => void): () => void {
  if (!isFirebaseConfigured) {
    cb({ phase: 'unknown' });
    return () => {};
  }
  let unsubStatus: (() => void) | null = null;
  let currentUser: AuthUser | null = null;

  const setupStatusListener = (u: AuthUser) => {
    if (unsubStatus) { unsubStatus(); unsubStatus = null; }
    
    const db = getFirebaseDb();
    if (!db) {
      cb({ phase: 'active', user: u });
      return;
    }
    
    unsubStatus = subscribeAccountStatus(u.uid, (acc) => {
      if (!currentUser || currentUser.uid !== u.uid) return;
      if (acc?.status === 'pending_deletion' && acc.scheduledAtMs) {
        cb({ phase: 'pending', user: u, scheduledAtMs: acc.scheduledAtMs });
      } else if (acc?.status === 'disabled') {
        cb({ phase: 'disabled', user: u });
      } else {
        cb({ phase: 'active', user: u });
      }
    });
  };

  const unsubAuth = subscribeAuth((u) => {
    currentUser = u;
    if (!u) {
      if (unsubStatus) { unsubStatus(); unsubStatus = null; }
      cb({ phase: 'signedOut' });
      return;
    }
    cb({ phase: 'active', user: u });
    setupStatusListener(u);
  });

  let lastProvider = useChordStore.getState().settings.syncBackendProvider;
  const unsubStore = useChordStore.subscribe((state) => {
    const currentProvider = state.settings.syncBackendProvider;
    if (currentProvider !== lastProvider) {
      lastProvider = currentProvider;
      if (currentUser) {
        setupStatusListener(currentUser);
      }
    }
  });

  return () => {
    unsubAuth();
    unsubStore();
    if (unsubStatus) unsubStatus();
  };
}

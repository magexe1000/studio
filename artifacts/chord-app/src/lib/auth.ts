import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  getRedirectResult,
  signOut as fbSignOut,
  updateProfile,
  deleteUser,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from './firebase';

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
  };
}

export function subscribeAuth(cb: (u: AuthUser | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    cb(null);
    return () => {};
  }
  // Resolve any in-flight redirect result so signed-in state shows up after a Google redirect.
  getRedirectResult(auth).catch(() => {});
  return onAuthStateChanged(auth, (u) => cb(toAuthUser(u)));
}

/**
 * Sign in with Google. Web-only flow — popup first, redirect as fallback.
 *
 * NOTE: Inside the Capacitor Android WebView, BOTH signInWithPopup and
 * signInWithRedirect have issues (popup not supported; redirect breaks
 * with "missing initial state" because WebView sessionStorage is
 * partitioned across the redirect to accounts.google.com). A future
 * release will reintroduce a native sign-in path. Until then, mobile
 * users should sign in with email/password.
 */
export async function signInGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code ?? '';
    // User dismissed — don't retry, don't navigate away.
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return;
    }
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw e;
  }
}

export async function signInEmail(email: string, password: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function registerEmail(email: string, password: string, displayName?: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName && cred.user) {
    try { await updateProfile(cred.user, { displayName: displayName.trim() }); } catch { /* noop */ }
  }
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await fbSignOut(auth);
}

/**
 * Permanently delete the currently signed-in Firebase Auth user.
 * Throws `auth/requires-recent-login` if the session is too old — the caller
 * should sign the user out and ask them to sign in again before retrying.
 */
export async function deleteAccount(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth || !auth.currentUser) throw new Error('Not signed in');
  await deleteUser(auth.currentUser);
}

export function getCurrentEmail(): string | null {
  const auth = getFirebaseAuth();
  return auth?.currentUser?.email ?? null;
}

export { isFirebaseConfigured };

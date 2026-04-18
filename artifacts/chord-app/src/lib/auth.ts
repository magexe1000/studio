import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  updateProfile,
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
 * Sign in with Google.
 *
 * We always try `signInWithPopup` first — even on mobile and inside installed
 * PWAs. On Android Chrome the popup opens as a Custom Tab and shares the
 * Firebase session correctly, whereas `signInWithRedirect` is broken in
 * installed PWAs (cookies are partitioned, so `getRedirectResult` returns
 * null after the redirect comes back). We only fall back to redirect when
 * the environment genuinely cannot host a popup.
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

export { isFirebaseConfigured };

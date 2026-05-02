import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  GoogleAuthProvider,
  getRedirectResult,
  signOut as fbSignOut,
  updateProfile,
  deleteUser,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from './firebase';
import { isNative } from './capgoUpdater';

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
 * Two completely different code paths depending on where we're running:
 *
 * 1. NATIVE (Capacitor APK) → @capacitor-firebase/authentication.
 *    The Firebase JS SDK's `signInWithPopup` and `signInWithRedirect`
 *    are both broken inside Capacitor's Android WebView:
 *      - popup → `auth/operation-not-supported-in-this-environment`
 *      - redirect → "Unable to process request due to missing initial
 *        state. ... sessionStorage is inaccessible or accidentally
 *        cleared." This is because the WebView storage is partitioned
 *        across the redirect to accounts.google.com, so the nonce/state
 *        the SDK saved before redirecting can't be read after coming
 *        back.
 *    The native plugin avoids the WebView entirely — it uses the
 *    Android Google Sign-In SDK to get an idToken, then we hand it to
 *    Firebase Auth via `signInWithCredential`. Auth state then flows
 *    through `onAuthStateChanged` exactly like the web path.
 *
 * 2. WEB / PWA → `signInWithPopup` first (Custom Tab on Android Chrome
 *    shares the Firebase session correctly), with `signInWithRedirect`
 *    as a fallback for environments that genuinely can't host a popup.
 */
export async function signInGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');

  if (isNative()) {
    // Lazy-import so the web bundle never tries to load native code.
    const { FirebaseAuthentication } = await import(
      '@capacitor-firebase/authentication'
    );
    const result = await FirebaseAuthentication.signInWithGoogle();
    // ALWAYS bridge the credential into the JS SDK if we got an idToken.
    // Previous version gated this on `!auth.currentUser`, but that has
    // two failure modes:
    //   1. The plugin's own JS-SDK sync (skipNativeAuth: false) is
    //      best-effort and not guaranteed across all device/version
    //      combos — sometimes native is signed in but the JS SDK isn't.
    //   2. If a STALE/DIFFERENT user is already signed in to the JS SDK
    //      (rare, but possible after a partial sign-out), we'd skip the
    //      bridge and end up with the native and JS sessions belonging
    //      to two different Google accounts.
    // Calling signInWithCredential is idempotent when the same user is
    // already signed in — the JS SDK reuses the existing session and
    // doesn't fire a spurious onAuthStateChanged. So we just always do
    // it when we have a token.
    if (result.credential?.idToken) {
      const credential = GoogleAuthProvider.credential(
        result.credential.idToken,
      );
      await signInWithCredential(auth, credential);
    }
    return;
  }

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
  // On native, sign out of the Capacitor Firebase Auth plugin too.
  // Without this the next "Continue with Google" tap auto-picks the
  // last account silently (cached native session) and the user can't
  // pick a different Google account from the chooser.
  if (isNative()) {
    try {
      const { FirebaseAuthentication } = await import(
        '@capacitor-firebase/authentication'
      );
      await FirebaseAuthentication.signOut();
    } catch (err) {
      console.warn('[auth] native sign-out failed (continuing):', err);
    }
  }
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

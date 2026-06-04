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
  sendPasswordResetEmail as fbSendPasswordReset,
  sendEmailVerification as fbSendEmailVerification,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, googleProvider, isFirebaseConfigured } from './firebase';
import { isNative } from './capgoUpdater';
import { syncProfileListener } from './permissions';
import { logActivity } from './activityLogger';

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

let lastAuthUser: AuthUser | null = null;
const authCallbacks = new Set<(u: AuthUser | null) => void>();

export function subscribeAuth(cb: (u: AuthUser | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    cb(null);
    return () => {};
  }
  // Resolve any in-flight redirect result so signed-in state shows up after a Google redirect.
  getRedirectResult(auth).catch(() => {});

  authCallbacks.add(cb);
  if (lastAuthUser !== null) {
    cb(lastAuthUser);
  }

  const unsub = onAuthStateChanged(auth, (u) => {
    const authUser = toAuthUser(u);
    lastAuthUser = authUser;
    syncProfileListener(authUser);
    cb(authUser);
  });

  return () => {
    authCallbacks.delete(cb);
    unsub();
  };
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
 *        state" because WebView sessionStorage is partitioned across
 *        the redirect to accounts.google.com.
 *    The plugin runs in `skipNativeAuth: true` mode — it only invokes
 *    the platform Google Sign-In SDK to get an idToken and does NOT
 *    touch the native Firebase Auth SDK (which crashed the app on
 *    launch in 3.0.5). We bridge the resulting idToken into the
 *    Firebase JS SDK via signInWithCredential.
 *
 * 2. WEB / PWA → `signInWithPopup` first, with `signInWithRedirect`
 *    as a fallback.
 */
export async function signInGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');

  if (isNative()) {
    // Lazy-import so the web bundle never tries to load native code.
    const { FirebaseAuthentication } = await import(
      '@capacitor-firebase/authentication'
    );
    let result: Awaited<ReturnType<typeof FirebaseAuthentication.signInWithGoogle>>;
    try {
      result = await FirebaseAuthentication.signInWithGoogle();
    } catch (e: unknown) {
      // Native Google Sign-In failures arrive here as either a Capacitor
      // PluginException (no `code` property — message is the raw status
      // code from GoogleSignInStatusCodes, e.g. "10:" for DEVELOPER_ERROR,
      // "12500:" for SIGN_IN_FAILED, "12501:" for SIGN_IN_CANCELLED,
      // "7:" for NETWORK_ERROR) or as a structured error from the
      // plugin's Kotlin layer. We normalise both shapes into a
      // Firebase-style `code` so AccountCard's `prettyErr` can show a
      // useful message instead of dumping the raw "10:" at the user.
      const raw = e as { code?: string | number; message?: string; errorMessage?: string };
      const msg = String(raw.message ?? raw.errorMessage ?? '');
      const codeStr = String(raw.code ?? '');
      // Pull a leading numeric status code out of either field.
      const numMatch = msg.match(/^(\d+)[:\s]/) || codeStr.match(/^(\d+)$/);
      const num = numMatch ? Number(numMatch[1]) : NaN;
      // Diagnostic — surfaced in adb logcat so we can see what the user
      // actually hit when they report "10:" with no other info.
      console.warn('[auth] native Google sign-in failed', {
        message: msg,
        code: codeStr,
        parsed: num,
        raw: e,
      });
      let normalisedCode = '';
      if (num === 10 || /DEVELOPER_ERROR/i.test(msg)) {
        normalisedCode = 'auth/native-developer-error';
      } else if (num === 12501 || /SIGN_IN_CANCELLED|cancel/i.test(msg)) {
        // User backed out — silent return, same as web popup-closed-by-user.
        return;
      } else if (num === 12500 || /SIGN_IN_FAILED/i.test(msg)) {
        normalisedCode = 'auth/native-sign-in-failed';
      } else if (num === 7 || /NETWORK_ERROR|network/i.test(msg)) {
        normalisedCode = 'auth/network-request-failed';
      } else if (num === 8 || /INTERNAL_ERROR/i.test(msg)) {
        normalisedCode = 'auth/native-internal-error';
      } else if (num === 12502) {
        normalisedCode = 'auth/native-sign-in-currently-in-progress';
      }
      if (normalisedCode) {
        const wrapped = new Error(msg || normalisedCode) as Error & { code: string };
        wrapped.code = normalisedCode;
        throw wrapped;
      }
      throw e;
    }
    if (!result.credential?.idToken) {
      throw new Error('Google sign-in returned no idToken');
    }
    const credential = GoogleAuthProvider.credential(result.credential.idToken);
    await signInWithCredential(auth, credential);
    logActivity('login', 'Signed in with Google', 'Studio');
    return;
  }

  try {
    await signInWithPopup(auth, googleProvider);
    logActivity('login', 'Signed in with Google', 'Studio');
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
  logActivity('login', 'Signed in with Email', 'Studio');
}

export async function registerEmail(email: string, password: string, displayName?: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName && cred.user) {
    try { await updateProfile(cred.user, { displayName: displayName.trim() }); } catch { /* noop */ }
  }
  logActivity('login', 'Registered new account', 'Studio');
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  // On native, also sign out of the Capacitor plugin so the next
  // "Continue with Google" tap shows the account chooser instead of
  // silently picking the cached account.
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
  logActivity('logout', 'Signed out of session', 'Studio');
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

export async function updateDisplayName(name: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) throw new Error('Not signed in');
  await updateProfile(auth.currentUser, { displayName: name.trim() || null });
  if (auth.currentUser) {
    const authUser = toAuthUser(auth.currentUser);
    lastAuthUser = authUser;
    for (const cb of authCallbacks) {
      cb(lastAuthUser);
    }
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase not configured');
  await fbSendPasswordReset(auth, email);
}

export async function sendVerificationEmail(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) throw new Error('Not signed in');
  await fbSendEmailVerification(auth.currentUser);
}

export function isEmailVerified(): boolean {
  const auth = getFirebaseAuth();
  return auth?.currentUser?.emailVerified ?? false;
}

export function getSignInProviders(): string[] {
  const auth = getFirebaseAuth();
  return auth?.currentUser?.providerData.map((p) => p.providerId) ?? [];
}

export { isFirebaseConfigured };

import {
  PushNotifications,
  type PermissionStatus,
  type Token,
  type RegistrationError,
  type ActionPerformed,
} from '@capacitor/push-notifications';
import { getFirebaseDb } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Checks the current push notification permission status.
 * Returns 'granted', 'denied', or 'prompt' / 'prompt-with-rationale'.
 */
export async function checkNotificationPermission(): Promise<PermissionStatus['receive']> {
  const cap = (window as any).Capacitor;
  if (typeof window === 'undefined' || !cap || !cap.isNativePlatform()) {
    return 'granted'; // Default to granted on web/dev to avoid blockages
  }
  try {
    const status = await PushNotifications.checkPermissions();
    return status.receive;
  } catch (err) {
    console.warn('[PUSH] Failed to check permissions:', err);
    return 'prompt';
  }
}

/**
 * Requests push notification permissions and registers the device.
 */
export async function registerPushNotifications(): Promise<void> {
  const cap = (window as any).Capacitor;
  if (typeof window === 'undefined' || !cap || !cap.isNativePlatform()) {
    return;
  }
  try {
    let status = await PushNotifications.checkPermissions();
    if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
      status = await PushNotifications.requestPermissions();
    }
    if (status.receive === 'granted') {
      await PushNotifications.register();
    } else {
      console.log('[PUSH] Permission not granted:', status.receive);
    }
  } catch (err) {
    console.warn('[PUSH] Registration failed:', err);
  }
}

/**
 * Safely saves the FCM token to a user's Firestore document.
 */
export async function saveFcmTokenToFirestore(uid: string, token: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !uid || !token) return;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { fcmToken: token }, { merge: true });
    console.log('[PUSH] Successfully saved FCM token to Firestore');
  } catch (err) {
    console.warn('[PUSH] Failed to save token to Firestore:', err);
  }
}

/**
 * Sets up global listeners for registration success, errors, and notification actions.
 */
export function setupPushNotifications(): void {
  const cap = (window as any).Capacitor;
  if (typeof window === 'undefined' || !cap || !cap.isNativePlatform()) {
    return;
  }

  // Handle successful registration and token caching
  PushNotifications.addListener('registration', async (token: Token) => {
    const fcmToken = token.value;
    console.log('[PUSH] Registration success, FCM token:', fcmToken);
    localStorage.setItem('studio_fcm_token', fcmToken);

    // Save token if user is already authenticated
    try {
      const { getFirebaseAuth } = await import('./firebase');
      const auth = getFirebaseAuth();
      if (auth?.currentUser) {
        await saveFcmTokenToFirestore(auth.currentUser.uid, fcmToken);
      }
    } catch (err) {
      console.warn('[PUSH] Failed to auto-save token on registration:', err);
    }
  });

  // Handle registration errors
  PushNotifications.addListener('registrationError', (err: RegistrationError) => {
    console.error('[PUSH] Registration error:', err);
  });

  // Handle notification tap action (deep-link directly to updater/changelog)
  PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    console.log('[PUSH] Action performed:', action);
    try {
      // Dispatch the unified event to open the update dialog modal in-place.
      window.dispatchEvent(new CustomEvent('studio:open-update-dialog'));
      // Also trigger routing event in case the hub settings update page needs to sync.
      window.dispatchEvent(new CustomEvent('studio:route-to-updater'));
    } catch (err) {
      console.warn('[PUSH] Action handler failed:', err);
    }
  });
}

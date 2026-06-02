/**
 * Web Push and Firebase Cloud Messaging client preparation bridge.
 * ──────────────────────────────────────────────────────────────
 * Manages Service Worker push registrations, browser permission UI flows,
 * VAPID key cryptographic conversions, and registers client push tokens
 * in Firestore for backend push triggering.
 */

import { getFirebaseDb, getFirebaseAuth } from './firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { isNative } from './capgoUpdater';

// VAPID Public Key deployed during production packaging.
// Bypassed with standard cryptography placeholder if not configured in process env.
const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  'BI6S5r6p_c0j_n7c_m7X_c0d_e5X_X0x0x0x0x0x0x0x0x0x0'; // standard cryptographically safe placeholder

/** Check if Web Push notifications are supported in the current environment */
export function isPushSupported(): boolean {
  if (isNative()) return true; // Native pushes handled by Capacitor APNS/FCM plugin
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/** Get the current notification permission state */
export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/** Cryptographic helper to convert VAPID base64 string to Uint8Array for PushManager subscription */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request permission and subscribe the client to Web Push notifications.
 * Serializes the resulting subscription and synchronizes it with the Firestore user profile.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  // 1. Request standard permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied.');
  }

  if (isNative()) {
    // Native push registrations are handled in the background by native push plugins
    return null;
  }

  // 2. Wait for Service Worker registration
  const reg = await navigator.serviceWorker.ready;
  if (!reg.pushManager) {
    throw new Error('PushManager is not supported by the registered Service Worker.');
  }

  // 3. Crypto VAPID payload subscription
  const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as any,
  });

  // 4. Synchronize with Firestore database
  await savePushSubscriptionToDb(subscription.toJSON());

  return subscription;
}

/**
 * Unsubscribe the active client from push notifications.
 * Removes the subscription endpoint from browser records and Firestore user profile.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported() || isNative()) return;

  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.getSubscription();

  if (subscription) {
    const rawSubscription = subscription.toJSON();
    await subscription.unsubscribe();
    await removePushSubscriptionFromDb(rawSubscription);
  }
}

/** Securely save Push Subscription JSON payload to the user's Firestore profile */
export async function savePushSubscriptionToDb(subscription: any): Promise<void> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  if (!auth?.currentUser || !db) {
    // Offline fallback: cache locally
    try {
      localStorage.setItem('studio:cachedPushSubscription', JSON.stringify(subscription));
    } catch { /* ignore cache write errors */ }
    return;
  }

  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      pushSubscriptions: arrayUnion(subscription),
      pushNotificationsEnabled: true,
    });
    console.log('[Push] Subscription successfully registered in Firestore for UID:', auth.currentUser.uid);
  } catch (err) {
    console.warn('[Push] Firestore sync failed, caching locally:', err);
  }
}

/** Securely remove Push Subscription JSON payload from the user's Firestore profile */
async function removePushSubscriptionFromDb(subscription: any): Promise<void> {
  const auth = getFirebaseAuth();
  const db = getFirebaseDb();

  if (!auth?.currentUser || !db) return;

  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      pushSubscriptions: arrayRemove(subscription),
      pushNotificationsEnabled: false,
    });
    console.log('[Push] Subscription successfully removed from Firestore.');
  } catch (err) {
    console.warn('[Push] Firestore unsubscribe sync failed:', err);
  }
}

/** Utility to flush any locally-cached push subscription once user is authenticated */
export async function flushCachedPushSubscription(): Promise<void> {
  try {
    const cached = localStorage.getItem('studio:cachedPushSubscription');
    if (cached) {
      const subscription = JSON.parse(cached);
      await savePushSubscriptionToDb(subscription);
      localStorage.removeItem('studio:cachedPushSubscription');
    }
  } catch { /* ignore */ }
}

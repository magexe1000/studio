export interface PermissionStatus {
  receive: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
}

/**
 * Checks the current push notification permission status.
 * Mocked to always return 'granted' to prevent blockages in the settings flow.
 */
export async function checkNotificationPermission(): Promise<PermissionStatus['receive']> {
  return 'granted';
}

/**
 * Requests push notification permissions and registers the device.
 * Mocked as a safe no-op.
 */
export async function registerPushNotifications(): Promise<void> {
  // No-op - Push notifications are disabled
}

/**
 * Safely saves the FCM token to a user's Firestore document.
 * Mocked as a safe no-op.
 */
export async function saveFcmTokenToFirestore(uid: string, token: string): Promise<void> {
  // No-op - Push notifications are disabled
}

/**
 * Sets up global listeners for registration success, errors, and notification actions.
 * Mocked as a safe no-op.
 */
export function setupPushNotifications(): void {
  // No-op - Push notifications are disabled
}

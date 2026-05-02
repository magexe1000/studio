/**
 * One-line install for the Studio Bridge.
 *
 * Mounts the cross-app data bridge once at the React root. After this
 * runs, every Chordex preset change and every Drumex pattern change
 * flows automatically into the active StudioProject — without any app
 * importing another app's store.
 *
 * Safe to call from any component; the underlying `attachStudioBridge`
 * is idempotent so dev-mode StrictMode double-invocations are harmless.
 */

import { useEffect } from 'react';
import { attachStudioBridge } from './studioBridge';

export function useStudioSync(): void {
  useEffect(() => {
    const detach = attachStudioBridge();
    return detach;
  }, []);
}

import { createRoot } from "react-dom/client";
import { lazy, Suspense, useState, useEffect } from "react";
import { TolgeeProvider } from "@tolgee/react";
import App from "./App";
import {
  tolgee,
  ensureNotificationPermission,
  seedAudioAssets,
  NATIVE_VERSION,
  initDevToolsFramework
} from "@workspace/studio-core";
import { Capacitor } from "@capacitor/core";
import "./index.css";

// Initialize DevTools
initDevToolsFramework();

// Ask for notification permission on first launch.
void ensureNotificationPermission();

// Kick off the drum-sample seed in the background.
void seedAudioAssets();

const ChangelogModal = lazy(() => import("@workspace/ui-android").then(m => ({ default: m.UpdateDiagnosticsSheet }))); // or use appropriate lazy wrapper
const UpdateIndicator = lazy(() => import("@workspace/ui-android").then(m => ({ default: m.UpdateIndicator })));

function GlobalOverlays() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <UpdateIndicator accentFrom="#7c3aed" accentTo="#a855f7" />
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <TolgeeProvider tolgee={tolgee} fallback={null}>
    <App />
    <GlobalOverlays />
  </TolgeeProvider>,
);

// Clean up all service workers since they are not supported in native wrappers.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      void reg.unregister();
    });
  }).catch((err) => {
    console.warn('[sw] Failed to clean up service workers:', err);
  });
}

// Clear Web Cache Storage on native platform version change.
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  const LAST_NATIVE_VERSION_KEY = 'studio:lastNativeVersionForCache';
  const lastVersion = localStorage.getItem(LAST_NATIVE_VERSION_KEY);
  if (lastVersion !== NATIVE_VERSION) {
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => caches.delete(key)));
      }).then(() => {
        console.log('[Cache Migration] Cleared all Web asset caches successfully.');
        localStorage.setItem(LAST_NATIVE_VERSION_KEY, NATIVE_VERSION);
      }).catch((err) => {
        console.warn('[Cache Migration] Failed to clear caches:', err);
      });
    } else {
      localStorage.setItem(LAST_NATIVE_VERSION_KEY, NATIVE_VERSION);
    }
  }
}

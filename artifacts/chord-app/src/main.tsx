import { createRoot } from "react-dom/client";
import { lazy, Suspense, useState, useEffect } from "react";
import { TolgeeProvider } from "@tolgee/react";
import App from "./App";
import { tolgee } from "./lib/i18nSetup";
import { notifyBundleReady, ensureNotificationPermission } from "./lib/capgoUpdater";
import { seedAudioAssets } from "./lib/assetCache";
import { Capacitor } from "@capacitor/core";
import { NATIVE_VERSION } from "./lib/appVersion";
// StudioSolarIntro removed from the React tree — the solar-system startup
// animation now lives inline in index.html so it paints on the FIRST frame,
// before the JS bundle has to download/parse/mount. The .tsx file is kept
// in source for now in case we want to reuse pieces of it later.
import "./index.css";

// Tell the Capgo updater plugin that this bundle booted successfully.
// MUST run as early as possible on every launch — without it, the
// plugin's watchdog will assume the running bundle crashed and roll
// back on next start. Doing it BEFORE the React render means even a
// slow first paint can't trip the rollback timer. Safe to call on
// web (no-op outside a Capacitor native shell).
void notifyBundleReady();

// Ask for notification permission on first launch so the OS dialog
// appears immediately — users don't have to wait for an OTA update to
// be available for the system prompt to show. Fire-and-forget; the
// dialog is asynchronous and we don't block React render on it.
void ensureNotificationPermission();

// Kick off the drum-sample seed in the background. On the very first
// native launch (and after any future APK reinstall) this copies the
// ~38 MB drums tree from the bundle into the persistent Data dir so
// future OTA bundles don't have to ship it. No-op on web. Idempotent.
void seedAudioAssets();

// Lazy-load the global overlays so they never land in the critical-path
// bundle. ChangelogModal pulls in ChangelogSheet; UpdateIndicator is
// 699 lines with its own polling logic. Neither is needed for first paint.
const ChangelogModal  = lazy(() => import("./components/ChangelogModal"));
const UpdateIndicator = lazy(() => import("./components/UpdateIndicator"));

// Defer mounting the global overlays until after the first frame so they
// don't compete with the app shell for CPU/JS parse time on launch.
function GlobalOverlays() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <ChangelogModal />
      <UpdateIndicator accentFrom="#7c3aed" accentTo="#a855f7" />
    </Suspense>
  );
}

createRoot(document.getElementById("root")!).render(
  <TolgeeProvider tolgee={tolgee} fallback={null}>
    <App />
    {/* Global post-update changelog overlay + OTA indicator */}
    <GlobalOverlays />
  </TolgeeProvider>,
);

// Clean up all service workers (legacy and push update SWs) since push notifications are removed.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      void reg.unregister();
    });
  }).catch((err) => {
    console.warn('[sw] Failed to clean up service workers:', err);
  });
}

// Clear Web Cache Storage on native platform version change to prevent WebView cache drift.
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

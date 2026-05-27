import { createRoot } from "react-dom/client";
import { lazy, Suspense, useState, useEffect } from "react";
import { TolgeeProvider } from "@tolgee/react";
import App from "./App";
import { tolgee } from "./lib/i18nSetup";
import { notifyBundleReady, ensureNotificationPermission } from "./lib/capgoUpdater";
import { seedAudioAssets } from "./lib/assetCache";
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

// Service worker registration removed — the previous SW was caching the old
// StartupSplash bundle. The current `public/sw.js` is a self-destructing
// killswitch: once it runs on a device it unregisters itself and clears all
// caches, so we don't re-register it here. To restore offline support in the
// future, register a new SW under a different filename.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => { void reg.unregister(); });
  }).catch(() => { /* ignore */ });
}

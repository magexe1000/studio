import { createRoot } from "react-dom/client";
import App from "./App";
import ChangelogModal from "./components/ChangelogModal";
import UpdateIndicator from "./components/UpdateIndicator";
import { notifyBundleReady, ensureNotificationPermission } from "./lib/capgoUpdater";
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

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    {/* Global post-update changelog overlay — mounted as a root sibling
        so it surfaces regardless of which sub-app the user lands in. */}
    <ChangelogModal />
    {/* Global OTA update indicator — same reasoning. Auto-opens its
        modal once per remote version so the user can't miss a release
        even when the OS notification opens the app into a sub-app. */}
    <UpdateIndicator accentFrom="#7c3aed" accentTo="#a855f7" />
  </>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(err => console.warn('Service worker registration failed:', err));
  });
}

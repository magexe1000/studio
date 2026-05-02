import { createRoot } from "react-dom/client";
import App from "./App";
import ChangelogModal from "./components/ChangelogModal";
import { notifyBundleReady } from "./lib/capgoUpdater";
import "./index.css";

// Tell the Capgo updater plugin that this bundle booted successfully.
// MUST run as early as possible on every launch — without it, the
// plugin's watchdog will assume the running bundle crashed and roll
// back on next start. Doing it BEFORE the React render means even a
// slow first paint can't trip the rollback timer. Safe to call on
// web (no-op outside a Capacitor native shell).
void notifyBundleReady();

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    {/* Global post-update changelog overlay — mounted as a root sibling
        so it surfaces regardless of which sub-app the user lands in. */}
    <ChangelogModal />
  </>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(err => console.warn('Service worker registration failed:', err));
  });
}

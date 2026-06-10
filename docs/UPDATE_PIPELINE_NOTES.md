# Studio Web Update Pipeline & Cache Architecture

This document describes how update checking and assets caching are orchestrated on the web version of Studio, ensuring users always run the latest version.

---

## 1. Caching Strategy (Firebase Hosting)

All web assets are served via Firebase Hosting. The caching rules are defined in `firebase.json` and designed with the following rules:

1. **HTML Shell & Service Workers (No Cache):**
   The entry point `/index.html` (including clean URLs like `/` or rewritten SPA paths) and service worker scripts (`/sw.js`, `/sw-push.js`) must **never** be cached by CDN or browser.
   - **Configuration:** Set to `no-store, no-cache, must-revalidate, max-age=0` via the wildcard `**` source rule at the top of the headers configuration.
   - **Why:** Ensures that any reload immediately fetches the latest version of these files, letting the browser discover new JS/CSS hashed bundles and updated self-destructing scripts.

2. **Hashed Assets (Immutable Cache):**
   Vite builds output hashed bundle assets in `/assets/**` (e.g., `index-BKBYWmq6.js`).
   - **Configuration:** Set to `public, max-age=31536000, immutable` under the `/assets/**` source rule.
   - **Why:** Since filenames change when contents change, they can be cached forever in the browser, ensuring near-instant load times on subsequent visits.

---

## 2. Service Worker Clean-up (Self-Destruction)

Historically, Studio registered a service worker (`sw.js` and later `sw-push.js` for background push notifications). If a service worker is deleted from the server (returns `404`), browsers continue to run the old cached service worker indefinitely.

To cleanly remove these service workers and clear browser caches:
- Both `/sw.js` and `/sw-push.js` exist on the server as **self-destructing service workers**.
- On installation, they call `self.skipWaiting()` to activate immediately.
- On activation, they delete all keys in the browser's `caches` storage, unregister themselves, and reload active client pages.

---

## 3. Web Auto-Updater (Optional Client-Side Check)

To ensure clients running an older bundle can recover if their browser cached the page before these rules were implemented:
- `index.html` checks for updates and reloads if critical assets return `404` or mismatch.
- However, with `no-store` headers configured on `**`, this script is redundant and can be removed to reduce client-side code complexity.

---

## 4. Hosting & Deployment Note

* **Hosting Platform:** Studio web is hosted exclusively on **Firebase Hosting**.
* **Netlify (Deprecated/Removed):** Netlify configuration has been deprecated and removed. Studio does not use Netlify for production builds or preview deployments. Any Netlify PR checks are inactive and should be ignored.


# Permanent Studio Platform-Scope Policy & Instructions

This document is the authoritative platform-scope policy for all developers and AI agents working on Chordex Studio. Every task must be classified and validated before making any source code modifications.

---

## 1. Task Classification System

Every task must be classified into one of the following platform scopes:

* **WEB**: Refers to the responsive browser-based application (for desktop, mobile, and tablet browsers). Deployed via Netlify.
* **APK**: Refers to the native installed Android application built via Capacitor and Gradle.
* **SHARED**: platform-neutral logic, sync backend engines, and common visual primitives.
* **INFRASTRUCTURE**: GitHub Actions pipelines, Netlify configuration, Firebase Hosting config, workspace package configuration.
* **DOCUMENTATION**: Manuals, changelogs, architecture diagrams, agent run instructions.
* **RELEASE**: Version bumps, production APK signing, final artifact publishing.

### Ambiguity Interpretation Rules
* **"Web"** strictly means the responsive browser app.
* **"APK"**, **"Android"**, **"móvil"**, **"app de teléfono"**, or **"aplicación instalada"** strictly means the Android native application.
* **"Mobile"** without explicit "Web" or "browser" context defaults to **APK**.
* **SHARED** is only allowed if genuinely platform-neutral or explicitly requested for both targets by the user.
* If a request is genuinely ambiguous, ask the user only:
  > “¿Este cambio es para WEB móvil en navegador o para la APK de Android?”

---

## 2. Permanent Rules

* **Scope Isolation**: A WEB task must not alter Android/APK-owned files unless strictly necessary and documented. An APK task must not alter Web-owned files unless strictly necessary and documented.
* **Build Boundaries**: Android-only changes must not intentionally trigger Netlify builds.
* **UI Purity**: Never copy complete Web layouts directly into Android. Never copy Android navigation (like BottomNav) directly into Web.
* **No Silent Expansions**: Never silently expand a task to both platforms.
* **Version Control**: Never silently bump versions. Maintain Web at `4.0.0` and Android at `3.6.40` (versionCode `67`).
* **Security & Tokens**: Never retrieve, print, or embed credentials, secrets, or GitHub tokens in Git URLs. Never commit keystore files.
* **Fail-Closed Release Validation**: Never weaken production signing or metadata verification. Production release flows must enforce exactly the expected signer certificate fingerprint: `900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206`.
* **Testing Integrity**: Never describe untested behavior as verified. Never describe no-op tests as passing tests.
* **No git add .**: Stage explicit file paths only.

---

## 3. Platform File Ownership Map

* **WEB**:
  * `apps/studio-web/**`
  * `packages/ui-web/**`
* **APK**:
  * `apps/studio-android/**`
  * `packages/ui-android/**`
* **SHARED**:
  * `packages/studio-core/**`
  * `packages/ui-shared/**`

---

## 4. Scope Validation Checks

Validate your changes using the workspace scope validator:

```bash
pnpm scope:check --platform web
pnpm scope:check --platform apk
pnpm scope:check --platform shared
```

---

## 5. Detailed Operations & Reference Manuals

### A. OTA Update Banner System & Dev Testing
- **Trigger**: The application checks `public/version.json` on boot. An in-app update banner morphs (width/height/border-radius transition) into a small pulsing pill after ~6 seconds (or on user minimize). Tapping it launches the update modal.
- **Single Source of Truth**: The coordinate constant `APP_VERSION` in `packages/studio-core/src/lib/appVersion.ts` is the single source of truth.
- **Dev Banner Testing Override**: The `predev` workspace hook runs version synchronization with the `--preserve-newer` flag. This allows developers to manually edit `public/version.json` to a higher version (e.g. `3.0.1`) and add a custom changelog mock to demo banner morphs and animation behavior locally without the file being overwritten on package restarts.
- **Production Builds**: The `prebuild` hook deliberately omits `--preserve-newer`, overwriting `public/version.json` to prevent local overrides from entering production release tracks.

### B. Android OTA Native Bundle Release Procedure
- **Plugin Hook**: The over-the-air native bundle swap on Android is managed via `@capgo/capacitor-updater@^6`.
- **First Paint Watchdog Safety**: `src/lib/capgoUpdater.ts` registers a lazy native bridge calling `notifyBundleReady()` *before* React's `createRoot()` mount in `main.tsx`. This ensures slow first paints do not trigger Capgo's automatic bundle rollback watchdog.
- **OTA Base URL Config**: The APK build requires `VITE_OTA_BASE_URL` baked into the bundle pointing to the Firebase public tracking endpoint (e.g. `https://studio-30f44.web.app`). If empty, `versionJsonUrl()` fails closed and logs a Native Updater configuration error, disabling background update polling.
- **OTA Deployment Flow**:
  1. Bump the coordinates `APP_VERSION` in `packages/studio-core/src/lib/appVersion.ts`.
  2. Run `npm run release:firebase`. This triggers automated package compression into `firebase-public/ota/`, writes the release metadata manifests to `firebase-public/version.json`, and uploads assets to Firebase Hosting.

### C. Cloud Sync Engine Queue Architecture
- **State Machine Rules**: Sync phases cycle strictly through: `'idle' | 'syncing' | 'success' | 'error'`.
- **Lock Management**: Callers hook into `enqueueRun(reason, mode)`. This locks an in-flight `runPromise` wrapper. Concurrent sync triggers share the same in-flight execution promise, with a max queue depth of 1 pending followup run.
- **Isolation boundaries**: Sub-app sync payloads execute concurrently via `Promise.allSettled()`. Each Firestore operation has a 6-second timeout, with an overall run limit of 10 seconds capped by an `AbortController`.
- **Auth Swapping**: An `epoch` atomic counter is incremented on every `attachSyncEngine` / `detachSyncEngine` auth boundaries. This causes in-flight runs to discard write promises on mismatch, preventing cross-UID contamination on sign-out/sign-in swaps.


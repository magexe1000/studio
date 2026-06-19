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


---

## 6. Studio Engineering Protocol v1.0 (Permanent Project Rule)

### Core Principle
Stability is more important than feature velocity. A feature is not considered complete when it compiles; it is only complete when:
- It works.
- Existing functionality still works.
- Platform boundaries remain intact.
- Release validation passes.
- Regressions are ruled out.
Never trade reliability for speed.

### Change Classification
Before modifying code, classify the change into one of the following categories:
- **Category A**: Android-only
- **Category B**: Web-only
- **Category C**: Shared cross-platform
- **Category D**: Infrastructure / CI / Build pipeline
Every task must explicitly identify its category before implementation. Do not modify unrelated categories.

### Platform Isolation Rule
Never assume a Web implementation can be copied directly into Android. When adapting Web functionality to Android, you must adapt:
1. Web-specific dependencies
2. Android-specific constraints
3. Layout
4. Safe areas
5. Viewport behavior
6. Gestures & touch interactions
7. Keyboard behavior & safe areas
8. Navigation & back button behavior
9. Performance characteristics
Android must feel native. Never force a desktop-oriented implementation into Android unchanged.

### No Blind Reuse Rule
Before reusing code, check if it depends on: mouse events, hover states, desktop viewport assumptions, browser-only APIs, iframe assumptions, keyboard shortcuts, or Web-only routing. If so, adapt it before integrating.

### Regression Prevention Protocol
Before changing any module, create a short impact map of:
- Affected files
- Affected modules
- Affected platform(s)
Verify these assumptions after implementation.

### No Collateral Damage Rule
Do not modify working systems unless absolutely required. If fixing one component (e.g. Stagex), do not casually modify unrelated components (e.g. Chordex, Drumex, Hub, Update system, Sync system, Themes, Authentication). Every unrelated modification requires justification.

### Implementation Pipeline
1. Understand existing architecture.
2. Identify platform boundaries.
3. Implement minimal required changes.
4. Run targeted validation.
5. Run regression validation.
6. Prepare release candidate.

### Android Adaptation Checklist
Verify: touch interactions, pointer events, gestures, back button, swipe-back, safe areas, notch handling, keyboard behavior, scrolling, orientation changes, and performance.

### UI Wiring Protocol
For every visible control, verify: UI element → handler → action → state update → visible result. Do not mark a control functional merely because it renders, compiles, or a handler exists. Trace the full chain.

### Stagex Rule
Any redesign of Stagex must preserve: add button, save, export, setup, preferences, stage editor, element selection, element movement, element editing, and navigation. Visual redesigns must never disconnect functionality; functionality always wins.

### Performance Rule
Reduce: unnecessary rerenders, duplicate listeners, duplicate polling, duplicate effects, hidden background work, and excessive logging. Measure actual impact instead of optimization theater.

### Loop Prevention Rule
Do not repeatedly reopen identical files, rerun identical searches, reread unchanged plans, or regenerate identical reports. Checkpoint conclusions and move on.

### Release Gate
Before any publication, verify: version alignment, package ID, signing certificate, APK integrity, release manifest, update eligibility, and platform separation. If any check fails, STOP. Do not publish.

### Post-Implementation Review
Every completed task must answer:
1. What changed?
2. Why was it necessary?
3. Which platforms were affected?
4. What regressions were checked?
5. What remains risky?

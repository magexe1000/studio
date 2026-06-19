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
* **Version Control**: Never silently bump versions. Maintain Web at `4.0.0` and Android at `3.6.36` (versionCode `63`).
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

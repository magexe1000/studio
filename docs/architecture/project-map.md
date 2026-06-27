# Studio Project Map

---
*   **Current Production Version**: v3.7.1
*   **Architecture Version**: 1.0.0
*   **Last Updated**: June 27, 2026
*   **Owner**: Engineering Team
*   **Subsystem**: Workspace Architecture
*   **Status**: Production
---

This document maps out the packages, applications, and directories of the Studio repository, defining their responsibilities, dependencies, and platform targets.

---

## Workspace Layout

```
Studio
├── apps/
│   ├── studio-android/ (Android Native & Capacitor Container) [ANDROID]
│   └── studio-web/ (Web App & Landing Page) [WEB]
└── packages/
    ├── studio-core/ (Shared Stores, Business Logic, and Hooks) [SHARED]
    └── ui-shared/ (Shared React UI Component Library) [SHARED]
```

---

## 1. apps/studio-android
*   **Purpose**: Native Android packaging and Capacitor configuration container.
*   **Responsibilities**:
    -   Compiling and signing release APK and AAB bundles.
    -   Hosting native custom Java plugins (`AppInstallerPlugin.java` and `InstallReceiver.java`).
    -   Configuring AndroidManifest.xml and FileProvider permissions.
*   **Main Files**:
    -   [AppInstallerPlugin.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java)
    -   [InstallReceiver.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/InstallReceiver.java)
*   **Public APIs**: None (container package).
*   **Dependencies**: `packages/studio-core`, `packages/ui-shared`.
*   **Consuming Modules**: None.
*   **Platform Classification**: **ANDROID**

---

## 2. apps/studio-web
*   **Purpose**: Production web build container and landing page server.
*   **Responsibilities**:
    -   Serving client web applications.
    -   Hosting static public update files (e.g. version catalogs).
*   **Main Files**: Web assets and config files.
*   **Dependencies**: `packages/studio-core`, `packages/ui-shared`.
*   **Platform Classification**: **WEB**

---

## 3. packages/studio-core
*   **Purpose**: Core application state machine and platform-agnostic business logic.
*   **Responsibilities**:
    -   Managing chord stores, drum stores, user settings, preferences, and local state.
    -   Handling OTA update checking, mirror resolution, downloading triggers, and eligibility checks.
    -   Interacting with native preferences and native file providers.
*   **Main Files**:
    -   [otaUpdate.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/otaUpdate.ts)
    -   [apkDownloader.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/apkDownloader.ts)
*   **Public APIs**: `useOtaUpdate`, `applyUpdate`, `applyUpdateDirect`, `runUpdaterHealthCheck`, `getDiagnosticsReport`, `shareDownloadedApk`.
*   **Dependencies**: Capacitor Core plugins, Zustand.
*   **Consuming Modules**: `apps/studio-android`, `apps/studio-web`, `packages/ui-shared`.
*   **Platform Classification**: **SHARED**

---

## 4. packages/ui-shared
*   **Purpose**: Design system component library shared across Web and Android platforms.
*   **Responsibilities**:
    -   Rendering custom UI panels, settings indicators, and update dialogs.
*   **Main Files**:
    -   [UpdateIndicator.tsx](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/ui-shared/src/components/UpdateIndicator.tsx)
*   **Public APIs**: `<UpdateIndicator />`, hub layouts.
*   **Dependencies**: `packages/studio-core`.
*   **Consuming Modules**: `apps/studio-android`, `apps/studio-web`.
*   **Platform Classification**: **SHARED**

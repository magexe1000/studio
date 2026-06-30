# Updater Implementation History

---
*   **Current Production Version**: v3.7.1
*   **Architecture Version**: 1.0.0
*   **Last Updated**: June 27, 2026
*   **Owner**: Engineering Team
*   **Subsystem**: Implementation History
*   **Status**: Production
---

This document serves as the project's engineering log, recording major updates, design changes, and architectural decisions made to the update system.

---

## 1. Release v3.7.2: Reliability Upgrade & Smart Resume
-   **Date**: June 27, 2026
-   **Release Target**: `v3.7.2` (versionCode `129`)
-   **Files Modified**:
    -   [AppInstallerPlugin.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java)
    -   [apkDownloader.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/apkDownloader.ts)
    -   [otaUpdate.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/otaUpdate.ts)
    -   [UpdateIndicator.tsx](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/ui-shared/src/components/UpdateIndicator.tsx)
-   **Reason for Change**: Prevent update lock-ups caused by interrupted downloads, single-point release servers, or PackageInstaller session blocks.
-   **Key Decisions**:
    -   Implemented smart resume (`downloadFileWithResume`) via HTTP Range requests in native Java.
    -   Created a prioritized mirror failover loop (GitHub Release ➔ Firebase Hosting ➔ Fallback Mirror) in TypeScript.
    -   Introduced automated installation retry loops (consecutive failure counters) with automatic session reconstruction.
    -   Added **Recovery Mode** rendering failsafe legacy intent installs (`installApkDirect` using FileProvider URIs), copy/paste link builders, and native sharing actions (`@capacitor/share`).
-   **Regression Risk**: **Low**
    -   All resume sequences automatically fall back to downloading from scratch if mirrors lack Range support. Failsafe direct installs are fully isolated and only run if automated paths fail.
-   **Rollback Strategy**:
    -   Native Java: Restore standard byte stream downloader code and delete `installApkDirect`.
    -   TypeScript / React: Replace mirror resolver loops with standard `downloadApk` calls, and remove `ota.recoveryMode` overrides in UI files.
-   **Known Limitations**: Downgrade installations in-place require API level 34+ (Android 14). Older platforms require manual reinstallation.

---

## 2. Release v3.7.1: Compile-Safe Downgrade Support & UI pill fixes
-   **Date**: June 27, 2026
-   **Release Target**: `v3.7.1` (versionCode `128`)
-   **Files Modified**:
    -   [AppInstallerPlugin.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java)
    -   [appVersion.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/appVersion.ts)
-   **Reason for Change**: Support compile-safe Android 14 in-place downgrades and fix update indicator z-index layer clipping.
-   **Key Decisions**:
    -   Refactored `setRequestDowngrade(true)` to compile using dynamically resolved reflection lookups, preventing build script compile-time exceptions.
    -   Raised the `UpdateIndicator` pill overlay `z-index` to `8900` to prevent clipping behind other panels.
-   **Regression Risk**: **Low**
-   **Rollback Strategy**: Revert Java reflection block and replace with the legacy conditional class declarations.

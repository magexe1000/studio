# Updater Troubleshooting Guide

---
*   **Current Production Version**: v3.7.1
*   **Architecture Version**: 1.0.0
*   **Last Updated**: June 27, 2026
*   **Owner**: Engineering Team
*   **Subsystem**: Updater Troubleshooting
*   **Status**: Production
---

This document describes troubleshooting and recovery paths for common updater failure cases.

---

## 1. Download Stuck at 0%
-   **Symptoms**: The updater dialog gets stuck at "Downloading update (0%)" or "Retry 1/3 in...".
-   **Possible Causes**: Network unreachable, DNS resolution failures, or target mirror file deleted/not found (HTTP 404).
-   **Relevant Files**:
    -   [apkDownloader.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/apkDownloader.ts)
    -   [AppInstallerPlugin.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java)
-   **Diagnostics to Inspect**:
    -   `otaDebugLogs.downloadStatus`
    -   `otaDebugLogs.currentDownloadSource`
-   **Recovery Procedure**:
    -   The system will automatically attempt failover to the Firebase mirror.
    -   If persistent, the app triggers Recovery Mode. User can select "Copy Link" or "GitHub Release" to download via browser.
-   **Rollback Procedure**: No rollback needed; network-level issue.

---

## 2. Installer Overlay Dialog Never Appears
-   **Symptoms**: Download completes 100%, status flashes, but the OS Package Installer confirmation overlay never displays.
-   **Possible Causes**: Background Activity Launch (BAL) restrictions (Android 14+), session token timeout, or pending intent collision.
-   **Relevant Files**:
    -   [AppInstallerPlugin.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java)
    -   [InstallReceiver.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/InstallReceiver.java)
-   **Diagnostics to Inspect**:
    -   `otaDebugLogs.installerLaunchStatus`
    -   `otaDebugLogs.installError`
-   **Recovery Procedure**:
    -   Let the auto-retry session recreation trigger.
    -   If blocked, enter Recovery Mode, click **Install Directly (Failsafe)** to launch the legacy intent-based package installer.
-   **Rollback Procedure**: Revert to the legacy intent-based installation flow if the modern PackageInstaller session API is permanently corrupted.

---

## 3. SHA-256 Mismatch (Corrupted Download)
-   **Symptoms**: Download succeeds but stays at "Verifying update" before transitioning to "Update download failed" (hash validation failed).
-   **Possible Causes**: Partially downloaded files corrupted during stream write, or file size/hash mismatch on the release server.
-   **Relevant Files**:
    -   [apkDownloader.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/apkDownloader.ts)
-   **Diagnostics to Inspect**:
    -   `otaDiagnostics.shaExpected`
    -   `otaDiagnostics.shaCalculated`
-   **Recovery Procedure**:
    -   The system deletes the cache file and retries.
    -   If it fails repeatedly, download the APK manually from the GitHub release page.
-   **Rollback Procedure**: Update the `app-release.json` metadata on the server with the correct SHA-256 hash.

---

## 4. Signature Mismatch
-   **Symptoms**: Dialog transitions directly to "Manual reinstall required" stating that signing certificate has changed.
-   **Possible Causes**: App signed with a development debug keystore attempting to update using a production release APK (or vice versa).
-   **Relevant Files**:
    -   [apkDownloader.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/apkDownloader.ts)
-   **Diagnostics to Inspect**:
    -   `otaDebugLogs.installedSigningSha256`
    -   `otaDebugLogs.downloadedSigningSha256`
-   **Recovery Procedure**:
    -   Backup app data, uninstall the current app, and download/install the official version from the Firebase mirror.
-   **Rollback Procedure**: Ensure the production build script executes signing tasks using the correct official keystore configuration.

---

## 5. GitHub / Firebase Host Unavailable
-   **Symptoms**: App is unable to resolve updates, showing network error details.
-   **Possible Causes**: Cloudflare/GitHub API rate limits, server outages, or corporate firewall restrictions.
-   **Relevant Files**:
    -   [otaUpdate.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/otaUpdate.ts)
-   **Diagnostics to Inspect**:
    -   `otaDebugLogs.fetchedVersionJson`
    -   `otaDebugLogs.fetchedAppReleaseJson`
-   **Recovery Procedure**:
    -   The system automatically checks secondary endpoints.
    -   If both are down, the update checks fail silently back to Idle.
-   **Rollback Procedure**: No rollback needed.

---

## 6. Unknown Sources Disabled
-   **Symptoms**: Redirects to system settings or prompt appears: "automatic installation blocked".
-   **Possible Causes**: Android default security blocks sideloading apps from unknown sources.
-   **Relevant Files**:
    -   [UpdateIndicator.tsx](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/ui-shared/src/components/UpdateIndicator.tsx)
-   **Diagnostics to Inspect**:
    -   `otaDiagnostics.permissionState`
-   **Recovery Procedure**:
    -   Tap **Open Settings** in the prompt, find Studio, enable the toggle, and return to the app to apply the update.
-   **Rollback Procedure**: None.

---

## 7. Downgrade Failure
-   **Symptoms**: "Invalid update package: Android versionCode is not newer than installed".
-   **Possible Causes**: User attempts to click a release rollback version code lower than the installed build without enabling downgrade support.
-   **Relevant Files**:
    -   [AppInstallerPlugin.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java)
-   **Diagnostics to Inspect**:
    -   `otaDebugLogs.installedVersionCode`
    -   `otaDebugLogs.downloadedVersionCode`
-   **Recovery Procedure**:
    -   Ensure downgrade support flag `setRequestDowngrade(true)` is applied (this is handled dynamically via Java reflection on API level 34+).
    -   If reflection fails, trigger the manual reinstall flow.
-   **Rollback Procedure**: Ensure target versionCode matches constraints.

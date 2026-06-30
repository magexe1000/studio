# Diagnostics Engine

---
*   **Current Production Version**: v3.7.1
*   **Architecture Version**: 1.0.0
*   **Last Updated**: June 27, 2026
*   **Owner**: Engineering Team
*   **Subsystem**: Diagnostics
*   **Status**: Production
---

This document details the telemetry tracking, failure detection, logging structures, and developer mode utilities of the updater.

---

## 1. Diagnostics Architecture
The diagnostics subsystem records operations, network handshakes, integrity checks, and native transaction outcomes. It runs in the background and collects metrics that can be exported or reviewed directly in the diagnostics window.

---

## 2. Failure & Timeout Detection
-   **Download Failures**: Caught in the connection streams of [AppInstallerPlugin.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java) (HTTP response code checks, missing assets, content length mismatch).
-   **Validation Failures**: Caught in [apkDownloader.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/apkDownloader.ts) (hash comparisons, signature verification blocks).
-   **Install Failures**: Caught in [InstallReceiver.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/InstallReceiver.java) (handling OS broadcast status codes like `STATUS_FAILURE_INVALID` or `STATUS_FAILURE_ABORTED`).

---

## 3. Log Levels
-   **DEBUG**: Granular developer trace logs (written to local files and debug windows).
-   **INFO**: Standard update progress states (checking, downloading, handoff).
-   **WARN**: Recoverable transient errors (network retry attempt 1/3, fallback mirror redirects).
-   **ERROR**: Fatal process drops (verification mismatch, native exception crashes).

---

## 4. Diagnostics Export Format
Selecting "Health Report" in the Recovery Mode menu compiles a detailed diagnostic report in the following format:
```
=== STUDIO UPDATER HEALTH & DIAGNOSTICS REPORT ===
Timestamp: [ISO-Date]
Current State: [State]
Update Available: [boolean]
Remote Version: [version]
Download Source: [Active mirror URL]
SHA Status: [SUCCESS/FAILED]
Consecutive Failures: [count]
Active Fallback: [Fallback step]
Recovery Mode Active: [boolean]

--- Platform Health ---
Overall Status: [HEALTHY/WARNING/UNHEALTHY]
Metadata Reachable: [boolean]
GitHub Reachable: [boolean]
Firebase Reachable: [boolean]
Installer Available: [boolean]
PackageInstaller Available: [boolean]
Signing Certificate Valid: [boolean]

--- Device & Package Info ---
App Version: [version]
Package Name: [package]
Installed Version Code: [code]
Installed Sign SHA256: [hash]
Android Version: [version]
Device Model: [model]
Storage Available: [bytes]

--- Health Check Logs ---
[Detailed sequence logs]
```

---

## 5. Developer Mode
-   **Activation**: Tap the version label inside settings 7 times to enable.
-   **Features**: Displays an additional **Diagnostics UI** tab allowing developers to inspect direct session variables, clear caches, manually simulate download errors, and copy raw native logs.

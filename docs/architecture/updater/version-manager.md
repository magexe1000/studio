# Version Manager

---
*   **Current Production Version**: v3.7.1
*   **Architecture Version**: 1.0.0
*   **Last Updated**: June 27, 2026
*   **Owner**: Engineering Team
*   **Subsystem**: Version Manager
*   **Status**: Production
---

This document describes how Studio handles version parsing, transitions, channels, and histories.

---

## 1. Version Identifiers
Studio versions are identified by two values:
-   **versionName** (e.g. `3.7.2`): Semver-formatted string shown to users.
-   **versionCode** (e.g. `129`): Positive integer utilized by the Android OS and release databases to verify upgrade sequence.

---

## 2. Version Transitions

### Upgrade Flow
-   **Condition**: Client `versionCode` < Remote `versionCode`.
-   **Mechanism**: Normal update dialog displays, prompts user, downloads, verifies integrity, and hands over to the OS PackageInstaller.

### Downgrade Flow
-   **Condition**: Client `versionCode` > Remote `versionCode` (and downgrade is required).
-   **Mechanism**: The client fetches the target downgrade version's APK, runs standard eligibility checks, and invokes the `PackageInstaller` Session API applying `setRequestDowngrade(true)` dynamically via reflection.
-   **Requirement**: Client must compile/run on API level 34+ (Android 14) for the system to process downgrade requests in-place without manual uninstallation. On older platforms, manual reinstall is requested.

---

## 3. Installation & Update History
-   **History Log**: Logged in persistent storage (`studio:updaterHistory`). Keeps a revolving history of up to 50 update attempts and outcomes.
-   **Properties Saved**:
    -   `timestamp`: millisecond time of transition.
    -   `fromVersion`: client version before update.
    -   `toVersion`: client version target.
    -   `type`: `'upgrade'` or `'downgrade'`.
    -   `trigger`: `'user'` or `'auto'`.
    -   `status`: `'success'` or `'failed'`.
    -   `error`: detailed log of installation failure message (if failed).

---

## 4. Release Channels
The updater queries release endpoints based on user configuration settings:
-   **Production**: Default channel resolving stable builds (`https://studio-30f44.web.app/app-release.json`).
-   **Beta**: Resolves prerelease testing updates.
-   **Developer**: Dev builds with diagnostics metrics logging enabled.

---

## 5. Future Support
-   **OTA (Over-The-Air) Bundle Sync**: Future versions will support dynamic OTA assets/JS updates (Capgo based) layered on top of the native APK base, ensuring fast UI updates without full APK cycles when possible.

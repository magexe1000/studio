# ADR 002: Failsafe Direct Intent Installation

---
*   **Title**: ADR 002: Failsafe Direct Intent Installation
*   **Date**: June 27, 2026
*   **Release**: v3.7.2 (versionCode 129)
*   **Status**: Accepted
---

## Context
Studio utilizes the modern Android `PackageInstaller` Session API as its primary installation path to enable background activity launches (BAL) and seamless in-place updates.

## Problem
In several instances (e.g. background activity launch restrictions on Android 14+, OS-level session limit exhaustion, or heavily customized OEM ROM overlays), the `PackageInstaller.Session` API fails to display the system confirmation dialog or overlay. The user sees "APK installer launched" but no confirmation ever appears, locking them from updating.

## Decision
Implemented a native backup installation method (`installApkDirect`) using the legacy intent-based flow (`ACTION_VIEW` with type `application/vnd.android.package-archive` and `FLAG_GRANT_READ_URI_PERMISSION`), passing the APK file via a secure `androidx.core.content.FileProvider` `content://` URI.

## Alternatives Considered
-   **Defaulting to legacy intent-based installer**:
    -   *Why Rejected*: The legacy installer does not support background operations or in-place downgrades as cleanly as the modern Session API, and it forces a full activity lifecycle interruption. The modern Session API is much more robust for primary updates on API 21+.

## Consequences
-   **Benefits**: Bypasses the session-creation queue entirely and hands the file directly to Android's OS installer. It guarantees a working installation dialog overlay even if the app-session state is completely blocked.
-   **Trade-offs**: Requires a configured `FileProvider` in the manifest (which is already present in the workspace).

## Prohibited Patterns
-   **Do not use file:// URIs on Android 7.0+ (API 24+)**: Bypassing `FileProvider` and passing a raw file URI throws a `FileUriExposedException` and crashes the application instantly.
-   **Do not launch intent without permission checks**: On Android 8.0+, `canRequestPackageInstalls()` must be verified before launching the intent, or the system will reject the task.

## Files Affected
-   [AppInstallerPlugin.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java)
-   [apkDownloader.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/apkDownloader.ts)
-   [UpdateIndicator.tsx](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/ui-shared/src/components/UpdateIndicator.tsx)

## Rollback & Future Considerations
-   **Rollback**: Remove `installApkDirect` from the Capacitor wrapper.

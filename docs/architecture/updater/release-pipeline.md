# Release Pipeline

---
*   **Current Production Version**: v3.7.1
*   **Architecture Version**: 1.0.0
*   **Last Updated**: June 27, 2026
*   **Owner**: Engineering Team
*   **Subsystem**: Release Pipeline
*   **Status**: Production
---

This document details the build, validation, signing, and deployment procedures for Studio production releases.

---

## 1. Version Bump & VersionCode Generation
-   **Release Target Version**: Set inside `packages/studio-core/src/lib/appVersion.ts` (`NATIVE_VERSION`).
-   **Android versionCode**: Generated incrementally inside `apps/studio-android/android/app/build.gradle` using the next sequential integer (e.g. versionCode `129` for version `3.7.2`).
-   **Consistency Check**: Run `pnpm check:versions` to verify package versions, app versions, and Android configurations are aligned.

---

## 2. GitHub Actions Build Workflow
-   **Trigger**: Manual trigger (`workflow_dispatch`) or automated merge events.
-   **Environment**: runner VM configures OpenJDK 21 or equivalent.
-   **Dependencies Resolution**: Runs `pnpm install` and `pnpm bootstrap` to resolve workspace layouts.
-   **Compilation Check**: Evaluates TypeScript targets (`pnpm typecheck:libs` and `pnpm typecheck:android`).

---

## 3. Signing & APK Generation
-   **Keystore Setup**: The release runner loads the production signing keystore via repository secrets (`ANDROID_KEYSTORE_BASE64`).
-   **APK Packaging**: Executes gradle task `./gradlew assembleRelease` or `./gradlew bundleRelease` (generating AAB packages).
-   **SHA-256 Signature Fingerprint**:
    -   Official production SHA-256 fingerprint: `90:0c:f2:59:18:5c:81:10:0c:da:8b:b0:85:71:fa:23:55:2e:97:89:13:1c:f0:7a:8f:40:56:e4:d4:12:92:06`.

---

## 4. SHA Verification & Asset Uploads
-   **Integrity Hash**: Computes the SHA-256 hash of the generated APK:
    -   `sha256sum app-release.apk > app-release.apk.sha256`
-   **GitHub Release Creation**: Publishes a new GitHub release tag containing the version changelog, release APK, and the computed checksum file.
-   **Firebase Hosting Metadata**: Deploys `app-release.json` (containing the version, versionCode, release notes, APK download URL, and SHA-256 hash) to Firebase Hosting at:
    -   `https://studio-30f44.web.app/app-release.json`

---

## 5. Pre-Release Validation & Verification
Before publishing the update metadata, the release manager or automated action must check:
1.  **Changelog Entries**: Ensure version release notes are updated in `CHANGELOG.md`.
2.  **SHA Match**: Ensure the SHA-256 hash in `app-release.json` matches the build checksum.
3.  **Fingerprint Match**: Ensure the signing certificate is the official production keystore fingerprint.
4.  **Download Check**: Verify the remote URL resolves the target APK file.

---

## 6. Rollback Procedure
If a production release introduces a critical regression:
1.  **Draft a Rollback Metadata**: Modify `app-release.json` on Firebase Hosting.
2.  **Target Downgrade Version**: Point the `apkUrl` or `fallbackApkUrl` to the last stable release APK.
3.  **Enable Downgrade Support**: Set `requiredVersionCode` or `requiredApkVersion` to trigger client-side downgrade flags.
4.  **Client-Side Handoff**: The client updater will detect the downgrade request, query the downgrade APK, apply `setRequestDowngrade(true)`, and downgrade in-place.

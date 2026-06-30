# ADR 001: Updater Redundancy & Recovery Mode

---
*   **Title**: ADR 001: Updater Redundancy & Recovery Mode
*   **Date**: June 27, 2026
*   **Release**: v3.7.2 (versionCode 129)
*   **Status**: Accepted
---

## Context
The in-app updater is a critical system in Studio. If the updater fails, users can become locked on an older version of the application, rendering future updates inaccessible.

## Problem
Several failure modes compromised updater reliability:
1.  **Interrupted Downloads**: Downloads always restarted from 0% on network dropouts.
2.  **Single Point of Failure**: Relying only on GitHub release downloads created rate-limit or host-unavailability lockouts.
3.  **Handoff session drops**: OS `PackageInstaller` failures could crash the update flow with no automatic self-healing.
4.  **No user fallbacks**: If the automated flow failed, the user was left with a generic error screen and no manual install or share options.

## Decision
1.  **Smart HTTP Resume**: Refactored the native Java downloader to utilize seekable stream writing (`RandomAccessFile`) and HTTP Range headers (`Range: bytes=X-`) to allow resuming interrupted downloads.
2.  **Prioritized Multi-Source Failover**: Sequential mirror lookup (GitHub ➔ Firebase Hosting ➔ Mirror Backup) with exponential backoff retries (3 attempts per source).
3.  **Self-Healing Session Recovery**: Tracks consecutive failures and attempts auto-retry and session reconstruction twice before presenting error states.
4.  **Recovery Mode UI**: Prominently overlays options for direct legacy installs, mirrors download links, file sharing, and diagnostic compiles when consecutive failures exceed the threshold (3).

## Alternatives Considered
-   **Forced web download immediately**: Prompting users to open a web browser as soon as the first download fails.
    -   *Why Rejected*: Poor user experience. The app should always attempt a seamless, in-app update before requesting manual web browsing actions.
-   **Automatic cache clearance on every retry**:
    -   *Why Rejected*: Discards partial downloads, defeating the purpose of Range-based smart resume.

## Consequences
-   **Benefits**: Zero data waste on dropped connections, automatic failover if GitHub goes down, and failsafe recovery menus.
-   **Trade-offs**: Slightly increased state complexity in `otaUpdate.ts` due to mirror sequence tracking.

## Prohibited Patterns
-   **Do not create multiple state machines**: All state changes must be governed by `globalOtaState` in `otaUpdate.ts` to prevent race conditions.
-   **Do not bypass eligibility checks on retries**: Any retry session must recheck package signatures and versionCode rules to prevent malicious packages from executing.

## Files Affected
-   [AppInstallerPlugin.java](file:///c:/Users/ayuda/Documents/Studio/chordex-app/apps/studio-android/android/app/src/main/java/com/chordex/app/AppInstallerPlugin.java)
-   [otaUpdate.ts](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/studio-core/src/lib/otaUpdate.ts)
-   [UpdateIndicator.tsx](file:///c:/Users/ayuda/Documents/Studio/chordex-app/packages/ui-shared/src/components/UpdateIndicator.tsx)

## Rollback & Future Considerations
-   **Rollback**: Remove `consecutiveInstallFailures` checks and replace the failover loop in `downloadUpdate` with a single URL fetch.

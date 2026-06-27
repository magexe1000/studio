# Studio Internal Engineering Architecture Index

---
*   **Current Production Version**: v3.7.1
*   **Architecture Version**: 1.0.0
*   **Last Updated**: June 27, 2026
*   **Owner**: Engineering Team
*   **Subsystem**: Architecture Index
*   **Status**: Production
---

> [!IMPORTANT]
> **INTERNAL ONLY**: This folder contains internal engineering documentation intended exclusively for codebase maintainers. 
> These documents must **NEVER** be compiled into APK assets, served on Firebase Hosting, exposed in navigation menus, or uploaded to public sitemaps.

## Subsystem Index

### 1. Version Management & In-App Updater
Documents describing update checking, resume-capable downloads, OS session commits, and failsafe Recovery Modes.
-   [Updater Architecture](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/updater/updater-architecture.md)
-   [Updater State Machine](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/updater/updater-state-machine.md)
-   [Troubleshooting Guide](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/updater/updater-troubleshooting.md)
-   [Release & Deployment Pipeline](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/updater/release-pipeline.md)
-   [Version Manager](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/updater/version-manager.md)
-   [Diagnostics Engine](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/updater/diagnostics.md)
-   [Engineering Implementation History](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/updater/implementation-history.md)

### 2. Workspace & Core Systems
Index of repository boundaries, package dependencies, and platform separations.
-   [Master Project Map](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/project-map.md)
-   [Platform separation guidelines](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/platform-separation.md)

### 3. Architecture Decision Records (ADRs)
Log of historical engineering decisions, context, problems, and prohibited patterns.
-   [ADR 001: Updater Redundancy & Recovery Mode](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/adr/adr-001-updater-redundancy.md)
-   [ADR 002: Failsafe Direct Intent Installation](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/adr/adr-002-failsafe-direct-install.md)

---

## Maintenance & Verification Guidelines
Before editing any codebase code:
1.  Verify the component target classification: **ANDROID**, **WEB**, or **SHARED**.
2.  Consult the [Master Project Map](file:///c:/Users/ayuda/Documents/Studio/chordex-app/docs/architecture/project-map.md) to understand which package exports the target logic and which packages consume it.
3.  Consult the subsystem troubleshooting documents to understand failure metrics before tweaking logic.

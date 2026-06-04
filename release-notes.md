### Fixed
- Fixed unreliable Android and Web Cloud Sync connection.
- Fixed Devices & Sessions not proving whether devices were actually connected.
- Fixed current device being incorrectly classified as a previous session.
- Fixed profile, theme, accent, and photo sync relying on inconsistent local/cloud state.

### Improved
- Added a real Firebase-backed Sync Engine unifying all Firestore and Storage actions.
- Added stable device identity, heartbeat presence, and deterministic session classification.
- Added clearer sync diagnostics for Auth UID, Firebase project, listeners, writes, cache state, and probe results.
- Improved Firestore source-of-truth handling for profile and settings.

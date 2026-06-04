### Fixed
- Fixed Cloud Sync initialization errors where Firestore or Firebase config was missing or not resolved.
- Fixed Diagnostics UI panel issues to prevent nested scrolling and text overflow on mobile viewports.
- Fixed manual registration button to prevent false successes when Firestore is unavailable.

### Improved
- Added clear warning cards in settings when Cloud Sync is not initialized.
- Added dynamic real-time Firebase configuration metrics (Apps count, App name, services state, and init errors) to Sync Diagnostics.
- Improved clipboard copy diagnostics payload to include all newly introduced Firebase state diagnostics.

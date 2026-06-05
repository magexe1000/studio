### Fixed
- Fixed Cloud Sync Probe failing on Android because Firestore rejected undefined userAgent values.
- Fixed Firestore sync writes to sanitize undefined fields before setDoc.
- Fixed Sync Diagnostics overflow on mobile by making the diagnostics section scrollable.
- Fixed Cloud Sync validation so probe errors show real Firestore failures.

### Improved
- Improved Android and Web sync diagnostics with copyable runtime reports.
- Improved Firestore payload sanitization across probe, devices, profile, and settings writes.
- Improved mobile usability for long diagnostics, paths, errors, and device metadata.

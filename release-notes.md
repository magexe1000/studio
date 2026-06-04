### Fixed
- Fixed Devices & Sessions showing no devices even when signed in.
- Fixed current device registration not writing to Firestore.
- Fixed missing device documents under users/{uid}/devices.
- Added diagnostics for device write status and listener status.
- Implemented robust device registration with 10-second write timeout and automatic retries.
- Added deep diagnostics in Devices & Sessions sheet listing 16 registration status parameters.
- Implemented automatic Firestore payload sanitization to prevent write rejections due to undefined native/platform fields.

### Improved
- Improved Devices & Sessions reliability across Android and Web.
- Improved current device detection and last active tracking.
- Improved cross-device session visibility.

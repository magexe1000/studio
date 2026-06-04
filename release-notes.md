### Fixed
- Fixed Devices & Sessions showing no devices even when signed in.
- Fixed current device registration not writing to Firestore.
- Fixed missing device documents under users/{uid}/devices.
- Added diagnostics for device write status and listener status.

### Improved
- Improved Devices & Sessions reliability across Android and Web.
- Improved current device detection and last active tracking.
- Improved cross-device session visibility.

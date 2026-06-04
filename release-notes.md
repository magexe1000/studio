### Fixed
- Fixed duplicate properties compile typecheck error in sync diagnostics.
- Fixed incorrect device categorization in the Devices list.
- Fixed potential web connection gaps and session listener disconnects.

### Improved
- Improved device session classification utilizing deterministic categories for current device, active remotes, recent remotes, signed out, and legacy devices.
- Added periodic 30-second heartbeats for signed-in sessions to track device freshness.
- Added manual Reconnect Devices button in settings panel and developer tools.

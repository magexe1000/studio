### Fixed
- Fixed critical updater system regressions by enforcing a strict deterministic state machine.
- Added native PackageInstaller active session checks on startup to prevent boot deadlocks and blank screens.
- Implemented robust watchdog timers for checking, downloading, verifying, and installing states.
- Cleaned up interrupted installation behaviors to reset to idle safely when the installer session is dead.

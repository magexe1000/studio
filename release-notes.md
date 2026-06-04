### Fixed
- Fixed boot guard to rollback invalid OTA bundles and prevent WebView reload loops.
- Correctly cleared stale OTA bundles when a native APK wrap update is required.

### Improved
- Added detailed updater trigger, block, and final path diagnostics to Developer Options.
- Blocked developer OTA force updates on outdated native wrappers.

### Changed
- Migrated Studio updates to APK-only delivery.
- Removed OTA bundle application from the updater.
- Simplified update flow to use the native Android installer for every update.

### Fixed
- Fixed mixed App/OTA/APK version states.
- Fixed updates applying as OTA instead of opening the Android installer.
- Fixed black screen caused by WebView reload during updates.
- Fixed stale OTA bundle state affecting APK updates.

### Improved
- More reliable update process.
- Cleaner update diagnostics.
- Stronger APK validation before install.
- Consistent App Version and APK Version after updates.

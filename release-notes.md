### Fixed
- Fixed mixed OTA/APK version state where App Version could advance while APK Version stayed behind.
- Added required APK version enforcement.
- Prevented OTA-only updates when native APK updates are required.
- Added diagnostics for “Native APK behind” and “APK update required”.
- Improved release classification for ota/apk/both updates.

### Improved
- Safer update flow for users with older native wrappers.
- Better recovery path when APK Version is behind App/OTA Version.

# Studio Changelog

Each release on the OTA channel is described in its own section below.
The release script (`scripts/release-firebase.mjs`) reads this file and
copies the bullet list under the section that matches the current
`APP_VERSION` into `version.json`'s `changelog` field, so the in-app
"Update available" modal always shows the actual changes that ship in
that bundle.

Conventions:
- One H2 heading per version: `## X.Y.Z` (no leading `v`).
- Bullets start with `- ` and use plain English a non-technical user
  can parse. Keep each line short — the modal's text area is narrow.
- List the user-visible changes only. Internal refactors, tooling,
  and CI tweaks do not need a bullet.
- Newest version goes on top.

## 3.4.12

### Fixed
- Fixed internal Studio apps not following the selected accent color.
- Removed hardcoded blue accent styling from app controls.
- Fixed Chordex Discover genre chips appearing abruptly cut off while scrolling.

### Improved
- Unified accent color behavior across Hub, Settings, Chordex, Drumex, Stagex, Groovex, and Vocalex.
- Added polished horizontal fade behavior for scrollable chip rows.
- Improved visual consistency across the Studio ecosystem.

## 3.4.11

### Fixed
- Fixed Developer Options turning black after opening.
- Fixed profile display name changes not updating the main Settings account card.
- Removed the unnecessary floating “Up to date” badge.
- Removed technical developer/build diagnostics from the About screen.

### Improved
- Cleaned up the About screen to focus on user-facing app information.
- Moved technical build and update diagnostics into Developer Options.
- Updated the Updater Settings description to reflect Studio’s current update system.
- Improved Updater screen clarity and consistency.

## 3.4.10

### Improved
- Redesigned the APK-only updater dialog with clearer status, better spacing, and Studio visual styling.
- Improved the “What’s New” section in the update dialog.
- Replaced old OTA terminology with APK-only update wording.
- Improved Developer Options update diagnostics organization.
- Improved About screen responsiveness across phones, tablets, and desktop layouts.

### Fixed
- Fixed cramped About section layout on some devices.
- Fixed updater labels that still referenced the old OTA system.
- Fixed update dialog copy to better explain the Android installation step.

## 3.4.9

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

## 3.4.8

### Fixed
- Fixed boot guard to rollback invalid OTA bundles and prevent WebView reload loops.
- Correctly cleared stale OTA bundles when a native APK wrap update is required.

### Improved
- Added detailed updater trigger, block, and final path diagnostics to Developer Options.
- Blocked developer OTA force updates on outdated native wrappers.

## 3.4.7

### Fixed
- Fixed APK-required updates to always open the native Android installer.
- Blocked silent OTA updates when the native APK version is behind the required versionCode.
- Disabled Capgo auto OTA bundle apply for APK-required releases to avoid WebView reload loop.
- Expanded pipeline guards to fail-fast if native or update-system files change in OTA releases.

### Improved
- Enhanced update diagnostics and checklists in Developer Options.
- Added detailed final update path logic for native wrappers.

## 3.4.6

### Fixed
- Fixed mixed OTA/APK version state where App Version could advance while APK Version stayed behind.
- Added required APK version enforcement.
- Prevented OTA-only updates when native APK updates are required.
- Added diagnostics for “Native APK behind” and “APK update required”.
- Improved release classification for ota/apk/both updates.

### Improved
- Safer update flow for users with older native wrappers.
- Better recovery path when APK Version is behind App/OTA Version.

## 3.4.5

### Fixed
- Fixed Android APK updates failing with “App not installed”.
- Added in-app APK install eligibility checks before launching Android installer.
- Added validation for package name, signing certificate, versionCode, and APK build type.
- Prevented invalid APK updates from being published.
- Improved update diagnostics when Android rejects an APK.

### Improved
- Strengthened automatic in-app update reliability.
- Improved consistency between GitHub APK, Firebase APK mirror, and update metadata.
- Reduced need for manual recovery installs.

## 3.4.4

### Fixed
- Fixed Android “App not installed” failure during APK updates.
- Added APK versionCode validation before release.
- Added signing certificate consistency checks.
- Added APK install eligibility diagnostics.
- Improved update failure messages for Android installer errors.

### Improved
- Strengthened APK release validation.
- Improved consistency between GitHub Release APK, Firebase APK mirror, and update metadata.

## 3.4.3

### Added
- Added automated validation for changelog structure and release note placeholders.
- Added structured releaseNotes field support to update manifests.

### Improved
- Improved updater UI to dynamically categorize and render release notes.

## 3.4.2

### Removed
- Removed Push Notifications support and related settings for now.
- Removed inactive push notification messaging from the update experience.

### Improved
- Revamped Developer Options with clearer sections and diagnostics.
- Improved Developer Options actions, statuses, confirmations, and feedback.
- Improved return-to-Hub transition to avoid black screen frames.
- Added a smoother app-to-Hub exit animation.

### Fixed
- Fixed Developer Options buttons that had incomplete or unclear behavior.
- Fixed return-to-Hub visual transition showing a black screen before the Hub appears.
- Fixed app shell visual reset during app exit.

## 3.4.0

- Moved Studio to production-signed release APKs.
- Improved APK installation trust and release signing validation.
- Added CI checks to prevent unsigned, debuggable, or incorrectly signed APKs.
- Requires a one-time clean reinstall for users coming from older debug-signed builds.
- Future updates after this install will work normally from inside Studio.

## 3.3.8

- Redesigned the update dialog with Studio’s visual style.
- Improved the update progress screen with percentage, status, and polished visuals.
- Improved the “What’s new” section layout.
- Improved the Ready to Install screen.
- Replaced generic blue update buttons with Studio accent styling.
- Improved install handoff so Studio does not intentionally reopen after launching the Android installer.
- Fixed updater overlay cleanup after install/later actions.
- Fixed potential stuck fade or black overlay states.
- Ensured only one updater dialog is used across the app.

## 3.3.7

- Added a polished account benefits section for signed-out users.
- Added clearer explanations for Cloud Sync, multi-device access, backups, personalization, recovery, and future account features.
- Added a small privacy note explaining account sync behavior.
- Improved the signed-out Account screen.
- Improved onboarding clarity for users who have not created a Studio account.
- Improved messaging around sync, backups, and cross-device use.

## 3.3.6

- Fixed black screen when returning from Studio apps back to the Hub.
- Unified app-to-hub navigation through one shared return handler.
- Added root UI fallback to prevent invalid blank/black render states.
- Improved app exit transition reliability.
- Improved Android back and predictive back recovery behavior.

## 3.3.5

- Fixed stale Firebase update manifests.
- Fixed duplicate update notifications.
- Removed legacy updater dialog conflicts.
- Fixed black screen caused by stale update dialog fade overlay.
- Unified the update dialog into one professional flow.
- Improved update state handling and retry behavior.
- Ensured manual checks always show accurate update status.
- Preserved AppInstaller runtime validation for APK updates.

## 3.3.4

- Fixed manual APK recovery downloads getting stuck at 100%.
- Added Firebase-hosted direct APK mirror for recovery installs.
- Improved manual update flow for users without AppInstaller.
- Added Copy Link and GitHub Fallback options for APK recovery.
- Improved APK download headers for Android compatibility.
- Prevented broken GitHub mobile download behavior from blocking recovery.

## 3.3.3

- Fixed repeated APK update failure when AppInstaller is unavailable.
- Fixed native AppInstaller registration reliability on Android.
- Added runtime AppInstaller availability checks before APK updates.
- Added manual recovery flow for users on older/broken APK builds.
- Prevented partial OTA/APK updates when native update support is missing.
- Added build-time validation to prevent APK releases without AppInstaller.
- Improved update diagnostics for native plugin availability.

## 3.3.2

- Added runtime capability checking for native AppInstaller plugin and its methods.
- Prevents starting corrupt downloads or partial updates if the native plugin is missing.
- Show clear manual update recovery dialog with direct download links on older APK wrapper versions.
- Added comprehensive AppInstaller diagnostics in Settings -> Developer Options -> Update Debug.

## 3.3.1

- Fixed black screen when returning from apps to Studio Hub using the top navigation.
- Fixed app exit transition state so the Hub renders correctly.
- Improved navigation reliability across Chordex, Drumex, Vocalex, Stagex, and Groovex.
- Added real system push notification support for updates using Firebase Cloud Messaging.
- Added deduplication so each update version notifies only once.
- Improved notification tap behavior to open the updater/changelog.

## 3.3.0

- Hidden Developer Options: Added a hidden settings menu with update controls, log viewing, and simulation tools.
- Advanced Diagnostics: Relocated and expanded all update diagnostics into the Developer Options menu.
- Firebase Hosting: Migrated OTA bundle and version manifest hosting from GitHub Pages to Firebase.
- SHA-256 Verification: Integrated cryptographic verification to check APK download integrity before installation.
- Size Reduction: Reduced OTA bundle download size by ~65% via optimized asset packing and WebP image formats.
- Performance & CORS: Fixed remote manifest fetch race conditions and native update CORS issues.

## 3.1.87

- WebView Permission Bypass: Automatically auto-grant WebView permission requests for WebRTC microphone streams, resolving cached site-level locks when OS permissions are active.
- In-App Direct Downloader: Added a clean warning card and button to download and install native APK updates directly from your settings panel when running an outdated shell.
- In-App Package Installer: Downloads system updates and launches the Android package installer directly inside the app, resolving 404 download errors by dynamically querying GitHub Release assets.
- Split Updater Layout: Segregated Over-the-Air (OTA) interface updates and App System Wrapper (APK) updates into explicit sections with clear descriptions detailing their differences.
- Download Progress Feedback: Added immediate visual timer feedback (1% to 15%) during downloader network handshakes to prevent the page from appearing stuck at 0%.
- Background Update Types: Updated background notifications to clearly differentiate between Interface Updates (OTA) and System Wrapper Updates (APK).

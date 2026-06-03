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

# Studio Changelog

Each release on the OTA channel is described in its own section below.
The release script (`scripts/publish-bundle.mjs`) reads this file and
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

---

## 3.0.6

- Stability fix — reverted the native Google sign-in change that was
  causing the app to crash on launch. Google sign-in is temporarily
  disabled on Android; please sign in with email and password for now.
- Notification permission prompt on first launch is preserved.

## 3.0.5

- (Withdrawn — caused the app to crash on launch on Android. Replaced
  by 3.0.6.)

## 3.0.4

- Cloud sync now works on the phone — sign-in with Google and email/password
  no longer shows "Cloud sync is not configured for this build". The Firebase
  config is now bundled with the app, so a fresh APK build always has it.

## 3.0.3

- Update banner now appears centered on the screen and smoothly morphs
  into a small badge in the top-right corner.
- The banner now shows the new version number.
- Studio sends a native phone notification when a new version is
  available, with the version number in the message.

## 3.0.2

- First over-the-air update test ride: bundles now download and install
  on the phone without going through the Play Store or reinstalling
  the APK.
- Update banner pulses in the top-right corner until you tap "Update".
- Download progress bar appears while the new bundle is fetched.

## 3.0.1

- Initial over-the-air update infrastructure — the app now checks for
  new releases on launch and surfaces an "Update available" indicator.
- Background changelog modal so the user sees what changed after every
  successful update.

## 3.0.0

- Studio Project — chord, drum, vocal and stage data now flow through a
  single project, so switching between sub-apps no longer loses your
  work.
- Session persistence — the app remembers where you left off, even
  after a hard close.

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

## 3.0.30

- Update indicator now shows a "Checking…" spinner on every launch and a green "Up to date" check that spins away when nothing new is available.

## 3.0.29

- Stale-bundle guard — installing a newer APK now resets Capgo to the bundled assets so the device actually runs the version you just installed.
- Same dual-build OTA fix from 3.0.28.

## 3.0.28

- Fixes the "all gray" screen after OTA update — release script now does two builds (one clean for the bundle, one with /Chordex/ prefix for Pages).

## 3.0.27

- OTA round-trip test on the fresh 3.0.26 APK — if you see this changelog the entire pipeline works.

## 3.0.26

- Bumps past 3.0.25 to recover users whose old "Later" tap permanently hid the indicator.
- All 3.0.25 fixes carried forward: themed accent, light/dark, persistent corner pill, raw.github bundle URL.

## 3.0.25

- Update banner now uses the Studio accent color you chose in settings (no more hardcoded purple).
- Adapts to light and dark themes automatically.
- "Later" no longer hides the indicator forever — it collapses to the corner dot and stays there until you update or a newer version arrives.
- Removed the diagnostic strip used to debug the previous OTA detection bug.

## 3.0.24

- OTA self-test 3.0.24. Tests the CORS preflight fix — if the banner appears, OTA detection is fully working.

## 3.0.23

- OTA self-test 3.0.23. Final confirmation — if you see this modal, OTA is working end-to-end.

## 3.0.22

- OTA self-test 3.0.22. Second confirmation that over-the-air updates are reaching the device cleanly.

## 3.0.21

- OTA self-test 3.0.21. If you can read this on your phone, the over-the-air update flow is working end-to-end.

## 3.0.20

- Test release to verify the OTA update flow end-to-end. No functional changes vs. 3.0.19.

---

## 3.0.19

- Sync timeouts further extended (60 s overall, 25 s per operation) to handle slow mobile connections, long-polling cold starts, and large Vocalex audio payloads without giving up.
- Fixes the OTA "update available" modal getting permanently suppressed after a single missed prompt. The auto-open marker now lives in sessionStorage, so every cold start gets a fresh shot at the modal until the user actually updates.

---

## 3.0.18

- Cloud sync now waits longer before giving up. The previous 6-second cap was too tight for the new long-polling transport on slower mobile connections, causing "Sync timed out" errors. Per-operation cap raised to 15 seconds and overall run cap to 30 seconds.

---

## 3.0.17

- Cloud sync no longer fails with "client is offline" on Android. The app now uses long-polling for Firestore from the start, which reliably works inside the Capacitor WebView.

---

## 3.0.16

- The update notification now actually works: tapping it opens a clear "Update available" dialog with the version and an Update button, instead of opening Studio with no visible prompt.
- The update indicator now appears on every screen (Hub, Drumex, Stage, Groovex, Vocalex, Chordex), not only on the Hub.
- Fixed the GitHub Pages publish script so the web version of Studio loads instead of returning 404.

---

## 3.0.15

- Fixed the GitHub Pages deployment so the web version of Studio
  loads instead of returning a 404. The release script now mirrors
  the entire built app (HTML, assets, icons) into the published
  folder, not just the OTA bundle zip.
- Republishing this version forces every device to re-evaluate the
  OTA banner, including phones that had stale "already seen"
  markers from earlier 3.0.13 / 3.0.14 attempts.

---

## 3.0.14

- Republished the 3.0.13 sync indicator fix under a new version
  number so devices that didn't pick up 3.0.13 (because the prior
  version was already marked seen on the device) get a fresh
  update banner.

---

## 3.0.13

- Cloud sync no longer spins almost constantly. The indicator was
  firing on every interaction (clicking a chord, switching tabs)
  because the sync engine was listening to *all* in-memory state
  changes — including UI state that never gets saved. Studio now
  only triggers a sync when something that actually gets persisted
  changes (favorites, progressions, presets, settings, custom
  chords, etc.).
- Quick background syncs (the common case) no longer flash the
  spinner at all. The "Syncing…" state only appears if the round
  trip takes more than ~600 ms, so you'll mostly see "Synced" with
  no flicker.
- Background safety-net poll relaxed from every 5 seconds to every
  60 seconds. Real edits still flush right away thanks to the
  store subscription.

---

## 3.0.12

- Updates are detected almost immediately. Studio now reads the
  version manifest from `raw.githubusercontent.com` (which refreshes
  within seconds of a push) instead of waiting on the GitHub Pages
  CDN, which used to take 2–3 minutes to flush.
- In-app version polling tightened from every 5 minutes to every 1
  minute while the app is open. Also re-checks on window focus, on
  page show, and whenever the network comes back online.
- Native background worker now races the same set of URLs and picks
  the highest semver, so the system notification fires sooner too.

---

## 3.0.11

- The post-update screen no longer asks you to tap "View changes" —
  the changelog now opens automatically right after an update,
  showing the version and its bullet list at the top.
- Refreshed the changelog sheet with Studio's own minimal style
  (lighter header, hairline divider, flush text instead of cards).
- Avatar picker icons render as actual icons again, not as huge raw
  text like "SENTIMENT_VER…".
- Your chosen language is finally preserved across updates instead
  of silently resetting to Spanish.

---

## 3.0.10

- Faster updates: Studio now re-checks for new versions every time
  you bring the app back to the foreground, plus once every 5 minutes
  while it stays open.
- Background notifications: a tiny Android worker checks every ~15
  minutes and posts a system notification when a new bundle is
  available — even if the app is closed. (Requires one APK reinstall
  to activate; future updates remain over-the-air.)

---

## 3.0.9

- New: the changelog is now a slick bottom sheet (Metrolist style) —
  swipe down to dismiss, or tap outside.
- New: open the changelog any time from Settings → About → Changelog.
- The "you just updated" screen is now lighter and only shows the
  version number; tap "View changes" to read the full changelog.
- The "update available" prompt no longer shows a wall of release
  notes — it only confirms the version being offered. Read the
  details after the update lands.

## 3.0.8

- New: pick an icon (person, face, headphones, music note...) as your
  profile picture. Tap your avatar in the account card to open the
  picker. Stored on this device — switch back to your Google photo any
  time.
- Fix: cloud sync sometimes got stuck on "Syncing…" forever when the
  Vocalex local database took too long to respond. The snapshot step
  is now time-bounded so a slow read can no longer wedge the engine.
- Photo failures now fall back to your initials gradient instead of
  showing a broken-image placeholder.

## 3.0.7

- Sign in with Google is back on the phone — uses the native Google
  account picker. This version uses the safer "credential bridge" mode
  (the plugin only fetches the idToken and we hand it to Firebase
  ourselves), which avoids the native Firebase init that crashed 3.0.5.
- Pinned Firebase Auth + Play Services Auth versions in the Android
  build to keep the native dependencies predictable across rebuilds.

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

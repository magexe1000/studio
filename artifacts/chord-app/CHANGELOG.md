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

## 3.0.75

- Stagex: 46 new full-color illustrated SVG icons for every stage element (mics, drums, instruments, amps, monitors, and utilities).
- Stagex: Each icon is a detailed vector illustration with gradients, shading, and accurate proportions — SM58 grille mesh, violin f-holes, 4×12 speaker grid, mixing console faders, and more.
- Stagex: New People category added with 7 stage members: Performer, Vocalist, Guitarist, Bassist, Drummer, Keyboardist, and Tech.
- Stagex: Mic Stand added to the Mics section with its own boom-stand illustration.
- Stagex: Eye/visibility button now hides automatically when the + FAB dial is open — no overlap with element chips.
- Stagex: Scenes bar is 15% more compact — smaller pills, tighter font, and a smaller add button.
- Navigation: BottomNav buttons are taller with larger icons (24 px) for a more comfortable tap target.

## 3.0.62

- Changelog no longer opens on every launch — it now only appears the first time after an OTA update.
- Full German (Deutsch) translation added across all sections: chords, songs, settings, Drumex, Vocalex, Groovex, Stagex, Studio Hub, and more.

## 3.0.61

- Faster cold launch: StudioHub, changelog modal, and update indicator now load after first paint.
- Bottom nav no longer re-renders on unrelated state changes — navigation is more responsive.
- Hub greeting and accent colour are now memoized — reduced per-frame CPU work.

## 3.0.57

- CRITICAL data-loss fix: uninstalling and reinstalling Studio no longer wipes your songs, presets, and progressions on the next sign-in.
- Studio now speaks 9 languages and auto-detects your phone's language on first launch: English, Spanish, German, French, Chinese, Portuguese, Italian, Japanese, and Korean. You can change it any time from Settings → Language.
- Sync status now shows a clear green check ✓ once your data is safely backed up.
- Update notifications cleaned up: removed the duplicated in-app banner; only one system notification fires now, with a proper "i" info icon instead of the generic launcher icon.

## 3.0.56

- Cloud sync no longer gets stuck on "Syncing" or "Waiting to sync…" — guaranteed to escape that state within 25 seconds.
- Sync per-operation timeout tightened from 25 s to 12 s for faster recovery on flaky networks.
- Library → Discover song descriptions now fully translated to Spanish (200+ songs).
- Library → Discover genre filter chips now display in Spanish ("Rock Inglés", "Rock en Español", etc.).
- Stagex: removed the duplicated Auto-arrange button from the top toolbar. The vertical sidebar button now triggers Auto-arrange directly (no confirmation dialog).
- Stagex: Live-mode (eye) button moved out of the top toolbar to float above the blue + FAB. It hides when the + menu opens so it never overlaps the element chips, and the icon now toggles between `visibility` / `visibility_off` to reflect state.

## 3.0.48

- Android back gesture now works correctly across all Studio apps (Chordex, Drumex, Vocalex, Stagex).
- Modal dialogs and bottom sheets now close on back before navigating between sections.
- Predictive back gesture (Android 14+): smooth dim overlay follows your finger during a back swipe, snapping back if you cancel.

## 3.0.47

- Settings icons fixed — all rows now show correct Metrolist-style icons.
- AI Assistant section is now functional with its own sub-page.
- Updater opens a live OTA status page (installed vs. latest version).
- Removed placeholder rows: Integration, Backup & Restore, Open Supported Links.
- Sections reorganised: Interface, Content & Language, Privacy & Security, Storage & Data, System & About.

## 3.0.46

- Studio Hub Settings completely redesigned with a Metrolist-style layout.
- Settings organized into grouped sections: Interface, Player & Content, Integration, Privacy & Security, Storage & Data, System & About.
- Each category navigates to a dedicated sub-page with smooth slide transitions.
- Staggered fade-in animations and scale tap feedback on all setting rows.

## 3.0.45

- App-switcher pill restored to tap-to-select; chips start from the left edge.
- Fixed pill opening with Chordex auto-scrolled to center instead of showing from the left.

## 3.0.44

- App-switcher pill completely redesigned as a snap picker: swipe between apps, the centered chip glows as a pre-selection, and releasing commits the switch — no tap needed.
- Fixed pill glitch caused by broken scroll spacers.
- Center spotlight indicator always shows which app slot is active.

## 3.0.43

- App-switcher pill chip row now snaps one chip at a time with native momentum physics.
- Active app chip automatically scrolls to the center of the pill when it opens.

## 3.0.42

- App-switcher pill now appears perfectly centered on screen in all panels — fixed a rendering issue caused by CSS containment.
- Fixed tapping a chip in the app-switcher pill not switching apps.
- Library scrolling is now smoother and more fluid, with GPU-accelerated compositing.

## 3.0.41

- App now defaults to English for new installs; existing users previously on the default Spanish are automatically switched.
- About section storage label updated to "Local & Cloud".
- Faster startup: splash screen clears 400 ms sooner, DNS prefetch added for font CDN, audio DSP libraries split into a separate lazy chunk.

## 3.0.40

- App switcher v3: trigger fully collapses on open (logo + label + chevron all hide) and the chip pill is now `position:fixed` and screen-centered horizontally, vertically anchored to the trigger. Spring on open, smooth on close.
- First **slim** OTA bundle — `OTA_SLIM=1` excludes the drum-sample tree (~38 MB). Should drop bundle size from ~53 MB to ~5 MB. Requires the seed from 3.0.37+ to have run on the device.

## 3.0.39

- App switcher v2: trigger label collapses on open so the trigger shrinks to just the logo. The floating pill now shows full chips (icon + name) for every app, swipe-scrollable with snap. Spring/bouncy on open, smooth on close, with per-chip stagger.

## 3.0.38

- Re-release of 3.0.37 with bumped version so the OTA channel re-delivers the pill app switcher and drum-cache changes that didn't reach all devices.

## 3.0.37

- App switcher redesigned: trigger pill expands horizontally to the right into a floating glass pill with every app icon. Horizontally swipe-scrollable (`scroll-snap`), measured against viewport so it never touches the side wall. Spring-easing on open, calm ease on close.
- Drum samples are now stored once on the device after first launch (Capacitor `Filesystem.Directory.Data`). Future OTA bundles can omit the ~38 MB drums tree, shrinking releases from ~53 MB to ~5 MB.
- This release is the **transitional** one: it still SHIPS the drum tree so the seeder has a source. After it installs, future releases can publish with `OTA_SLIM=1`.
- New `scripts/build-audio-manifest.mjs` (wired into `prebuild`) emits `public/audio-manifest.json` listing every drum file. Consumed by `src/lib/assetCache.ts` on first native launch.

## 3.0.36

- Sync timeouts raised so Firestore's first-connection handshake can complete (35 s overall, 25 s per call).
- Timeouts during sync are now treated as silent retries instead of "Sync timed out" errors.

## 3.0.35

- Cloud sync now connects more reliably on mobile networks — switched to auto-detect transport with a 30 s handshake window.
- When the connection drops mid-sync, the indicator no longer shows a scary "Sync failed" error — it silently retries when the network is back.

## 3.0.34

- Account sync no longer spins forever — tighter timeouts, bounded restores, and a safety net so the cloud icon always returns to a normal state.

## 3.0.33

- Update check no longer hangs — returns as soon as ANY source responds (instead of waiting for the slowest one).
- "Up to date" pill now appears only once per session, not every minute when the background check runs.

## 3.0.32

- "Up to date" pill now disappears with a pure, ultra-smooth fade — no more sliding or scaling.
- When an update is available, the corner pill's download arrow gently bounces to draw your eye.

## 3.0.31

- The "Up to date" pill now fades out smoothly instead of spinning.

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

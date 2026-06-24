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

## 3.6.93

### Added
- Expanded guitar chord database with new qualities and 14 slash chords.
- Fixed floating chord diagram skipping and auto-scrolling issues in Practice.
- Added active segment/phrase highlighting to sync with playback timeline.
- Fixed horizontal scroll block on Discover genre chips.
- Made app entry transition and launch animations 25% faster.

## 3.6.92

### Added
- Expanded guitar chord database by adding the minor 13th (min13) quality and chord shape definitions.
- Enhanced normalization layer to support Latin roots, unicode symbols, and suffix aliases like 7M/M7/menor/maior.
- Upgraded import diagnostics and chord mapping tooltips in the preview modal for better diagram verification.
- Correctly categorized extended and new chord shapes under the right sections in Chordex Library.

## 3.6.91

### Added
- Expanded chord diagram coverage in Practice mode by auto-generating complete guitar shapes for all standard roots and extensions.
- Implemented a robust chord normalization layer converting Latin roots, unicode accidentals, and suffix aliases before resolution.
- Added slash chord fallback rendering: shows the base chord shape and details the bass note on missing slash definitions.
- Integrated a Supported Sites status checklist inside the URL Import modal showing Supported, Limited, and Blocked hosts.
- Implemented dedicated import adapters with detailed error diagnostics for E-Chords and 7 other chord search sites.

## 3.6.90

### Fixed
- Fixed Cifra Club URL importer failure in production by implementing a resilient, multi-strategy layout parser.
- Added support for both mobile and desktop Cifra Club web structures using Apollo JSON parsing and wildcard <pre> tag recognition.
- Integrated inline parser diagnostics list in the chart preview screen to display execution strategies.

## 3.6.89

### Added
- Added user-initiated Import from URL workflow for Cifra Club and generic preformatted chord charts.
- Implemented interactive Preview-Before-Save layout to inspect parsed chords and lyrics.
- Integrated imported chords directly into the Practice view and floating diagram overlays.
- Saved imported charts privately in local storage as User Imported charts.

## 3.6.88

### Removed
- Removed suggested/generated fallback chord progressions.
- Purged hand-aligned chord charts for copyrighted songs in compliance with licensing guidelines.

### Added
- Integrated custom user import and edit chord sheet fallback actions.
- Implemented premium badge indicators for Verified, User, Provider, and Unavailable states.

### Improved
- Polished Practice UI and layout when chords are unavailable (showing lyrics only).
- Disabled floating chord diagrams overlay when no verified or user chords are present.

## 3.6.87

### Added
- Implemented hand-aligned verified chord charts database for curated song lists.
- Integrated new ChordChartProvider search hierarchy prioritising user and verified charts.
- Added premium status indicators indicating chord authenticity (Verified, User, Suggested, Lyrics).

### Improved
- Aligned chord placement to lyrics with accurate timestamp interpolation.
- Refactored manual chord editor modal to easily customize, paste, or reset chord sheets.
- Polished Practice UI layout, typography, line highlights, and viewport spacing.

## 3.6.86

### Added
- Added suggested practice chords mapped to lyrics when verified chord charts are missing.
- Redesigned Chords Home with Chord of the Day, quick categories, and practice tips.

### Fixed
- Fixed Library back button navigation and improved return-to-hub transition logging.

## 3.6.85

### Added
- Implemented MetroList-style lyrics provider integration with LRCLIB auto-fetching.

## 3.6.84

### Fixed
- Matched Stagex History panel design and transitions to Layouts UI.
- Resolved Android native swipe-back gestures for PDF Export and History panel.

## 3.6.83

### Improved
- Added performance diagnostics for sub-app transitions.
- Optimized startup sequence and deferred heavy bundle compilation.
- Polished Stagex touch targets and back button navigation.
- Enhanced native OTA update installer progress tracking.

## 3.6.82

### Fixed
- Optimized startup planets animation with cached dimensions and pre-computed logo offsets.
- Expanded Stagex plot object selection hitboxes by 16px and suppressed tap highlight overlays.
- Redesigned Stagex history menu into a responsive bottom sheet and disabled undo/redo on open.
- Resolved Stagex back-gesture coverage, including presets panel and history overlay detection.
- Refactored native update progress flows with support for all 10 states and automated install.

## 3.6.81

### Fixed
- Optimized startup planets animation and throttled layout queries to prevent freezes.
- Deferred React mounting and non-critical assets load to ensure smooth initial frames.
- Implemented double-buffered loading to eliminate sub-app entry transition stutters.
- Added universal swipe-to-back navigation and root screen exit behavior setting.
- Fixed bottom nav restoration stutters upon exiting nested panels or practice mode.

## 3.6.80

### Fixed
- Fixed global i18n root causes in settings menus and Vocalex Harmonizer.
- Added authorized lyrics and chords support for public-domain songs in Chordex Practice.
- Implemented user-provided custom lyrics/charts paste, edit, and delete flows.
- Optimized floating chord overlay to make diagrams primary and chord names secondary labels.

## 3.6.79

### Fixed
- Fixed incomplete global language switching across the entire app suite.
- Removed entry animation glow and bloom effects from app entries.
- Redesigned Chordex Discover Practice UI to feel polished and native.
- Added clean empty chart placeholder with support for custom chart importing.
- Simplified Practice Settings, keeping size, spacing, and BPM controls.
- Upgraded floating chord widget to display real guitar chord diagrams.
- Scoped bottom navigation bar hiding strictly to the Chordex practice view.

## 3.6.78

### Added
- Centralized localization (i18n) architecture using a unified JSON source of truth.
- Implemented Chordex practice screen with interactive chords-above-lyrics formatting.
- Added draggable floating chord overlay with screen boundary protection and local persistence.
- Added karaoke mode with auto-scroll settings, custom text sizes, and AMOLED contrast themes.
- Expanded Discover song library with 30 detailed song charts by Enjambre.
- Polished app entry transitions with cross-fade overlays and responsive grid/flex layout scaling.

## 3.6.77

### Added
- Increased splash duration (950ms delay with 300ms fadeout) to guarantee visual presence.
- Added fully opaque, theme-adaptive splash backgrounds preventing layout bleed-through.
- Configured dynamic theme adaptation for splash logos and app name titles.
- Eliminated off-screen CPU/GPU rendering overhead of loading animations in background boundaries.
- Synced fade-out with double requestAnimationFrame to ensure browser paints first.

## 3.6.76

### Added
- Implemented dedicated per-app launch screen animations with centered logos and names when opening sub-apps from the Hub.
- Preloaded and initialized sub-app rendering in the background behind the splash screen to eliminate visually jarring entry flickers.
- Enforced a premium minimum launch screen duration (850ms) to ensure smooth transitions.

## 3.6.75

### Added
- Modified navigation forensic snapshot sequence to capture unconditionally at T+0ms, T+50ms, T+100ms, T+250ms, T+500ms, T+1000ms, and T+2000ms.
- Rendered live paint verification screenshots inside the Navigation Forensics panel of the debug overlay.
- Optimized offscreen paint capture image quality to reduce local storage footprints.

## 3.6.74

### Added
- Integrated early orbit intro dismissal bypass when returning from sub-apps via path check and sessionStorage tracking.
- Accelerated launchApp zooming timing to execute setZooming(true) immediately, aligning transition states.
- Re-aligned sub-app transition behavior with the web platform to prevent double-scaling effects.

## 3.6.73

### Added
- Restored centered app-specific loading screens showing animated logos, app names, and customized loading indicators for all sub-apps.
- Smoothed sub-app entry and exit transitions, eliminating any temporary black or blank frames during bundle loading and heavy initialization.
- Integrated persistent sub-app loading screens with Stagex iframe onload/bridge-ready hooks to prevent gray backgrounds.
- Streamlined sub-app mount performance and eliminated rendering delays on Android devices.

## 3.6.72

### Added
- Restored original smooth transition animations for sub-app entries and exits.
- Optimized navigation performance and transition frame-rates on physical Android devices.
- Memoized SubAppWrapper component to prevent unnecessary React re-renders.
- Hidden emergency debug UI, panic menu, and watchdog telemetry from production, keeping diagnostics accessible behind a debug flag.

## 3.6.71

### Fixed
- Mitigated React Error #300 hook order violation in BottomNav by hoisting hooks above conditional return statements.
- Integrated runtime React stack trace symbolicator with VLQ sourcemap decoding and online/offline mapping.
- Added COPY SYMBOLICATED REACT ERROR REPORT action to crashed boundaries and debug overlay timelines.
- Resolved WebView black screen and compositing freezes on sub-app exits with enhanced telemetry and paint validation.

## 3.6.70

### Fixed
- Prevented the visible RootApp ErrorBoundary crash panel from flashing during recoverable Chordex to Hub return transitions.
- Configured RootApp ErrorBoundary to render a neutral dark layout during return sequences, recovering silently.
- Added detailed telemetry logging for RootApp ErrorBoundary catches, recorded under local storage logs.
- Added COPY ROOTAPP ERROR LOG and COPY LAST RECOVERABLE ERROR buttons to Failed Timeline tab.
- Integrated RootApp Error counts, suppression status, and recovery duration diagnostics in Emergency Debug Overlay.

## 3.6.69

### Added
- Upgraded the root React app tree structure to render EmergencyDebugOverlay at root level.
- Refactored App.tsx layout to keep the outer app-container permanently mounted, preventing root-level unmounts.
- Integrated LifecycleTracker logging to record component mount/unmount stack traces and Suspense fallback states.
- Implemented ROOT_APP_TREE_MISSING and HUB_DOM_NOT_MOUNTED diagnostics to isolate rendering failures.
- Added COPY ROOT LIFECYCLE LOG and COPY MOUNT/UNMOUNT STACKS buttons to Failed Timeline tab.
- Fixed React Error #300 hook order violation in BottomNav by hoisting hooks above conditional return statements.
- Integrated runtime React stack trace symbolicator with VLQ sourcemap decoding and online/offline mapping.
- Added COPY SYMBOLICATED REACT ERROR REPORT action to crashed boundaries and debug overlay timelines.

## 3.6.68

### Added
- Upgraded StudioHub to mount synchronously and permanently, eliminating Suspense-induced unmounts.
- Improved the failsafe watchdog to run active DOM restoration at T+50ms, T+100ms, T+250ms, and T+500ms checkpoints.
- Added comprehensive report export options to Failed Timeline (Full Report, Timeline JSON, Summary, Checkpoints, and Recovery Log).
- Fixed the header version display to dynamically show both the current runtime and captured timeline versions.

## 3.6.67

### Added
- Upgraded StudioHub to a synchronous static import to prevent Suspense fallback unmounts.
- Added a failsafe T+50ms watchdog to force-mount StudioHub and clear transition locks if the DOM is missing.
- Updated watchdog return validation to enforce pass/fail criteria on chronological checkpoints.

## 3.6.66

### Added
- Added automated forensic snapshots at T+0ms, T+50ms, T+100ms, T+250ms, T+500ms, T+1000ms, and T+2000ms.
- Enhanced snapshot data model with topmost stack, computed CSS styles, bounding rects, and WebView metrics.
- Added visual thumbnail capture with html2canvas at every checkpoint.
- Added Last Failed Navigation Timeline panel showing chronological checkpoints.
- Added auto-open behavior of emergency overlay on startup following force-closes.

## 3.6.65

### Added
- Added Paint Verification using html2canvas to Navigation Forensics.
- Added Force WebView Repaint recovery action with multiple visual repaint cycles.
- Added Force Full Hub Rebuild recovery action to remount the Hub subtree with a new React key.
- Added Force WebView Refresh Layer compositor invalidation recovery action.
- Added automated timing forensic snapshots at LEAVING_CHORDEX, ENTERING_HUB, T+500ms, and T+2000ms.
- Integrated paint validation into the 1200ms return watchdog to detect and record compositor freeze errors automatically.

## 3.6.64

### Added
- Added pixel-level visibility probes to detect screen rendering freezes.
- Added WebView computed layout, compositing, and layer count diagnostics.
- Added Visual Repaint Recovery and React Nuclear Remount actions.
- Upgraded Navigation Forensics with timing snapshot comparison dropdowns.

## 3.6.63

### Added
- Added auto-capture forensic telemetry for returns from Chordex to Hub.
- Added side-by-side transition state comparison audits (Previous vs Current snapshot).
- Added Force Hub Repaint recovery failsafe tool to clear black screen states.

## 3.6.62

### Fixed
- Upgraded Black Screen Forensics telemetry with elementsFromPoint stacks, fullscreen overlay scanning, and React component fiber audits.
- Added one-click copy forensics report and filtered DOM snapshot buttons to the debug overlay.
- Added force fullscreen overlay removal and force hub visibility recovery controls.
- Fixed Stagex landscape viewport squashing layout mapping offsets.
- Expanded Stagex scene selection, add, and delete touch targets to a minimum of 48dp x 48dp.

## 3.6.61

### Fixed
- Hardened Hub root diagnostics using multi-fallback element selectors.
- Resolved false-positive watchdog failsafes during slow Suspense paints.
- Ensured emergency DBG button is always mounted and auto-recreated if removed.
- Expanded panic context menu with 8 one-click debug data copy actions.
- Added computed style detail printouts in DOM tree snapshots.

## 3.6.60

### Fixed
- Mounted emergency debug overlay outside the main React root via React Portal.
- Added always-visible DBG button and failsafe quick recovery panel.
- Implemented window.__emergencyOverlayHealthCheck() layout stacking audits.
- Added simulated black screen layer tool to verify diagnostic recovery.

## 3.6.59

### Fixed
- Resolved Chordex -> Hub return black screen by keeping StudioHub permanently mounted.
- Eliminated watchdog false-positives via an optimized 1.2s verification delay.
- Added separate HUB_ROOT_MISSING_CAPTURE diagnostic snapshot inside local storage.
- Preserved accurate previous mode history in failsafe recovery logs.

## 3.6.58

### Fixed
- Fixed persistent Chordex-to-Hub return black screen issue via a deterministic failsafe.
- Resolved GSAP target missing console warning.
- Improved diagnostics and trace logging.

## 3.6.57

### Added
- Added advanced WebView diagnostics for black screen analysis.
- Added automatic localStorage persistence for watchdog trace reports.

## 3.6.56

### Added
- Added black screen diagnostic capture action in Developer Tools.
- Added automatic black screen blocker detection and telemetry.

### Fixed
- Fixed Stagex scene buttons touch hitboxes alignment using concentric transparent layout.
- Enlarged delete scene buttons to 36x36px touch target.

## 3.6.55

### Added
- Integrated a "Test Stagex Scenes Input" diagnostic action in Developer Tools.

### Fixed
- Hard-gated Firestore on Android when Supabase is active to prevent runtime connections.
- Resolved Chordex-to-Hub return black screen with an opacity transition fallback.
- Fixed Stagex Scenes bar touch hitboxes by adding position: relative and CSS pseudo-element expansions.

## 3.6.54

### Added
- Added navigation trace and transition diagnostics tab under Developer Tools.

### Fixed
- Fixed false hub warnings by reclassifying diagnostics logs inside devTools.
- Resolved black screen bug when returning from Chordex to Livex Hub.
- Mapped Warnings Inspector to conform to clean WarningItem data model.

## 3.6.53

### Added
- Rebranded user-facing elements and text from "Studio" to "Livex" (Livex Hub).
- Enhanced Developer Tools Warnings view with warning copy and unified diagnostics layout.

### Fixed
- Fixed the "View Warnings" button click responsiveness and event lifecycle on Android.
- Resolved "Black Screen Return Bug" by properly clearing sub-app launch timers on Hub return.
- Polished Stagex landscape mode: zoomed out stage plot and adjusted left toolbar placement.

## 3.6.52

### Added
- Integrated Warnings Inspector inside the Logs view in Developer Tools.
- Added Missing Assets sniffer to Network Request tab to group and diagnose 404 errors.

### Fixed
- Packaged complete Drumex audio assets inside the APK, preventing 404 remote preloading issues.
- Fixed 'View Warnings' WebView touch propagation and overlay response delays on Android.
- Polished Stagex landscape mode: adjusted canvas zoom, decreased toolbar toggle size, increased scenes tab touch targets with ontouchend fast-tap, and positioned element drawer above Add button.

## 3.6.51

### Added
- Dedicated Warnings Inspector in Developer Tools with duplicate count grouping and mobile-friendly scrolling.

### Fixed
- Resolved console module parsing bug to correctly categorize system and infrastructure warnings under true source modules instead of defaulting to Studio Hub.
- Refined Stagex landscape layout, removing bottom collapse arrows, center-aligning left toolbar vertically, and elevating the vertical drawer to clear FAB/Eye buttons.

## 3.6.50

### Added
- Redesigned Developer Tools toggle switch and added live card stats.
- Added multi-app status diagnostics for Hub, Chordex, Drumex, Stagex, Groovex, and Vocalex.

### Fixed
- Resolved app switching black screen transition issue with cached views.
- Fixed startup routing restoration to prevent default sub-app recovery.
- Improved Stagex landscape layouts, Safe Area offsets, and expanded button touch targets.

## 3.6.49

### Fixed
- Optimized 120 Hz display rendering and route animations for extreme responsiveness.
- Eliminated background gray flashes by enforcing pure black (#000000) layouts and windows.
- Redesigned Developer Tools into an intuitive dashboard with dedicated sub-view cards.
- Implemented modular diagnostics copy buttons for individual diagnostic sections.

## 3.6.48

### Added
- Created an interactive Stagex Bridge Self-Test runner to verify runtime command execution.
- Added a System Health Summary card at the top of the Developer Tools dashboard for quick mobile check.
- Upgraded the log viewer with a collapsible summary list tailored for phone viewports.
- Added available and missing handlers details to the Stagex diagnostics section.

### Fixed
- Fixed Stagex runtime command system on Android by correcting syntax issues and bracket mismatches.
- Resolved the `_orig is not a function` error.
- Upgraded the iframe postMessage bridge to immediately return ACK/NACK and prevent silent timeouts.

## 3.6.47

### Added
- Upgraded the Developer Tools UI to be fully phone-adapted with collapsible sections and safe area layouts.
- Added a dedicated Stagex diagnostics panel showing detailed postMessage ACK telemetry.
- Preserved the legacy Update Diagnostics page and added sub-navigation.

### Fixed
- Fixed the Stagex iframe postMessage ACK bridge error by adding robust try-catch wrapping and diagnostics.

## 3.6.46

### Added
- Created a centralized Developer Tools / Debugging Tools system accessible via Settings.
- Support for runtime log, error, event, performance, and network sniffing.
- App-specific diagnostic panels for Chordex, Stagex, Drumex, Groovex, Vocalex, and Hub.

## 3.6.45

### Fixed
- Reverted the old Stagex restoration and adapted the modern Web Stagex design for Android.
- Fixed layout alignment to prevent bottom navigation overlaps on Samsung SM-S921B.
- Resolved cross-frame SecurityErrors by implementing asynchronous postMessage channels.
- Restored functional Stagex controls: Add picker, Setup/Preferences tabs, Save, PDF export, and Back-to-Hub navigation.

## 3.6.44

### Fixed
- Restored stable Stagex editor functionality and touch controls on Android.
- Optimized Android WebView performance and Hub transition times.
- Corrected Stagex plus-button and element-picker interaction.
- Restored Setup and Preferences tab switching within Stagex.
- Fixed elements scaling, rotation, deletion, and selection on canvas.

## 3.6.43

### Fixed
- Fixed Back-to-Hub navigation gray screen freeze.
- Reconnected Stagex controls and canvas touch events.


## 3.6.42

### Fixed
- Restored missing theme and layout CSS variables in separated platform build.
- Fixed Stagex onTouchEnd responsiveness for eye, plus, and rotate buttons on Android.
- Added transition active lock safety watchdog to prevent stuck screens.


## 3.6.41

### Fixed
- Resolved global style and layout regressions in the separated monorepo architecture.
- Added Tailwind CSS source path configuration for shared workspace packages.


## 3.6.40

### Fixed
- Fixed Stagex same-origin bridge and allowed null origins.
- Resolved ScreenOrientation.lock UI thread blocking issues.
- Fixed element picker pointer-events and touch interactions.
- Restored Stagex bottom-navigation and system back gesture handling.


## 3.6.36

### Fixed
- Restored Stagex bottom-navigation section switching.
- Corrected Stagex plus-button and element-picker interaction.
- Corrected Stagex eye/visibility control behavior.
- Corrected parent-to-iframe command delivery in Android WebView.
- Improved selected-element controls.
- Prevented transition states from leaving Studio on a black screen.
- Added recovery actions when a Studio module fails to load.

### Improved
- Unified Help Center and FAQ & Support into Help & Support.
- Added searchable support content and functional troubleshooting actions.
- Improved transition cleanup when switching between Studio apps.
- Improved Stagex interaction diagnostics and event handling.


## 3.6.35

### Added
- Added transition serialization to stabilize fast app-switching.

### Improved
- Unified Help & Support center with search, categories, and live diagnostics.
- Safeguarded sub-apps with lazy import retries and Error Boundaries.

### Fixed
- Fixed Stagex mobile controls touch responsiveness and layout re-render click loss.
- Resolved Stagex iframe cache load race conditions.


## 3.6.34

### Added
- Added Stagex native landscape rotation locking.
- Added Setup sub-section navigation corrections.
- Added Mobile-only Settings cleanup.

### Improved
- Improved orientation change transitions.
- Improved Android system Back and swipe-back gesture responsiveness.
- Improved bottom navigation stability.
- Improved Help, FAQ, Terms, Privacy, and Report a Bug pages.

### Fixed
- Fixed Stage element touch drag cancellation and freeze issues.
- Fixed stuck selection rectangle on resize and orientation change.
- Fixed Drumex black-screen safeguards on mount.


## 3.6.33

### Added
- Restored Stagex element picker and visible elements (Guitar, People/Performers, etc.).
- Restored Chordex bottom navigation for Android.
- Added version-gated native WebView Cache Storage cleanup preventatively.

### Improved
- Centered and scaled Stage plot for phone screens.
- Improved global system Back and left-edge swipe-back navigation.
- Improved Setup Back button behaviors to prevent duplicate controls.

### Fixed
- Fixed Stagex mobile layout alignment and rotation.
- Fixed Setup, Rider, Setlist, and Gear Back navigation.


## 4.0.0

### Added
- Added adaptive Web navigation rails for laptop/desktop screen widths.
- Added Web-specific internal app navigation tabs for tablet/iPad screen widths.
- Added Web-specific internal app navigation for Chordex, Drumex, Stagex, Groovex, and Vocalex.

### Improved
- Improved Web shortcuts and deep shortcuts to target sub-sections.
- Repositioned back buttons inline to prevent overlap in Web layouts.

### Fixed


## 3.6.31

**Android/mobile 3.6.31**

### Fixed
- Fixed Android native mobile layout regressions in Stagex and Setup panels.
- Fixed Stagex element visibility and same-origin protocol mismatch.
- Removed duplicate Back buttons and aligned bottom navigation in WebView.

## 3.6.30

**Android/mobile 3.6.30**

### Fixed
- Android update compatibility release using the production signing certificate.

## 3.6.29

**Android/mobile 3.6.29**

### Added
- Redesigned Stage Plot for mobile matching modern Web Stagex visuals.
- Redesigned Scenes bottom sheet and management interface for mobile devices.

### Improved
- Improved element selection outlines and scaled resize controls.
- Aligned Stagex mobile canvas colors with Light, Dark, and AMOLED Web theme definitions.
- Preserved all mobile gestures, offline capabilities, and project saving.

### Fixed
- Removed Zones from mobile UI while maintaining legacy project compatibility.

## 3.6.28

### Fixed
- Fixed Web update actions falling back to Android manual APK update states.
- Fixed legacy Web clients getting stuck in stale cache/service-worker update flows.
- Ensured Web update actions refresh Studio instead of opening Android install UI.

### Improved
- Improved Web cache and service-worker cleanup during update refresh.
- Preserved Android APK/AppInstaller updater behavior.

## 3.6.27

### Fixed
- Fixed Studio Web incorrectly showing Android manual APK update states.
- Separated Web/PWA update metadata from Android APK release metadata.
- Ensured Web uses refresh-based update behavior while Android keeps APK/AppInstaller updates.

### Improved
- Added clearer platform separation for update metadata and updater actions.
- Preserved shared Studio version and What’s New across Web and Android.

## 3.6.26

### Fixed
- Fixed issue where the web application would get stuck on old versions and fail to load updates.
- Implemented auto-cleanup of legacy push service worker instances to clear stale browser caches.
- Optimized Firebase Hosting caching configuration to prevent caching of index.html and service workers.

## 3.6.25

### Improved
- Web builds now show a slim, non-blocking refresh banner instead of the Android-style APK update modal.
- Settings → Updates page adapts for web: shows a 'Web Build' badge, Refresh button, and hides native-only controls.
- Hub and Settings layouts are now centered and constrained on desktop/laptop screens for better readability.
- Desktop hover effects added for cards, buttons, and interactive settings rows.

### Fixed
- Fixed Stagex back-navigation so that swiping back or pressing back now properly closes open panels (timeline, presets, share modal, custom elements, etc.) instead of being ignored.

## 3.6.24

### Improved
- Revamped the signed-out profile benefits page to feature a premium, list-based glassmorphic layout.
- Enhanced the sign-in success overlay checkmark animation with expanding double ripple rings and a spring overshoot drawing path.

### Fixed
- Fixed sub-app back-navigation so that swipe-back and back button gestures consume the action instead of exiting to the Studio Hub.

## 3.6.23

### Improved
- Hardened release pipeline push phase with automatic cleanup of unstaged build files before rebasing.

## 3.6.22

### Fixed
- Fixed swipe-back touch gesture inside sub-apps to never exit to the Studio Hub, only navigating back to the previous screen.
- Removed duplicate Changelog row from the Settings UI.

### Improved
- Made applications launch instantly upon clicking, delaying zoom scaling animations slightly to ensure a lag-free visual transition.

## 3.6.21

### Fixed
- Hardened release pipeline push phase with retry logic and exponential backoff to handle transient remote push conflicts.

## 3.6.20

### Fixed
- Fixed release pipeline race conditions by introducing concurrency group constraints and rebase-before-push logic in CI.

## 3.6.19

### Fixed
- Prevented accidental GitHub Pages deployment paths from being treated as active Studio update infrastructure.

### Improved
- Removed unused Replit-specific project files and references from the Studio repository.
- Cleaned deployment documentation so Firebase Hosting is clearly the active hosting target.
- Removed stale GitHub Pages references from release/update documentation and configuration.
- Added validation to prevent updater metadata from pointing to GitHub Pages.

## 3.6.18

### Fixed
- Fixed Stagex Elements menu invisible dial chips capturing clicks.
- Fixed back-navigation in sub-apps to dismiss open sheets, menus, and forms before exiting.
- Fixed swipe-back gesture to dismiss open overlays instead of exiting immediately.

### Improved
- Improved updates page layout by embedding the changelog inside the hero card.
- Improved Settings subtitle localization and Stagex accent colors to dynamically adapt to the user theme color.

## 3.6.17

### New
- Redesigned the Updates page with a hero card, structured changelog, and Stitch-inspired layout.
- Added recent releases section with expandable changelogs.

### Improved
- Changed Settings subtitle to "Studio Settings".
- Renamed the Updater navigation row to "Updates".

## 3.6.16

### Fixed
- Paused unfinished cloud sync surfaces by marking Devices & Sessions, Backup & Sync, and Storage & Export as Coming Soon.
- Fixed profile photo updates so the new image appears consistently in Profile and Settings.
- Removed the misleading uploading profile picture dialog while cloud profile photo sync is paused.
- Fixed the Settings update button alignment and sizing.
- Fixed the Stagex visibility button overlapping the Elements menu.

### Improved
- Improved account/settings clarity by hiding unfinished sync controls behind Coming Soon states.
- Improved profile avatar consistency across account surfaces.
- Improved Settings header layout on mobile.
- Improved Stagex floating controls behavior when the Elements menu is open.

## 3.6.15

### Fixed
- Completed the signing reset path for builds where the original production keystore is unavailable.
- Added explicit reinstall-required metadata for APKs signed with the new certificate.
- Improved updater messaging when Android cannot install over an app signed with a different certificate.

### Improved
- Added safer release handling for signing certificate changes.
- Improved AppInstaller diagnostics for reinstall-required builds.
- Preserved strict signature validation for normal future updates.

### Changed
- This build requires a one-time uninstall/reinstall because the original Android signing key is unavailable. After reinstalling this version, future Studio updates can continue using the new signing certificate.

## 3.6.14

### Improved
- Bumped version to 3.6.14 to resolve signature mismatch eligibility validation error.

## 3.6.13

### Added
- Added Supabase Realtime Sync integration with dynamic diagnostics and switcher UI.
- Integrated Firebase and Supabase database status fields in settings.
- Added automatic payload sanitization and write timeout safeguards.

## 3.6.12

### Added
- Added Supabase Realtime Sync provider as an option alongside Firebase Cloud.
- Added Sync Provider selector to settings to allow switching between database backends.
- Added dynamic diagnostics information for the active sync provider.

## 3.6.11

### Fixed
- Fixed Cloud Sync initialization errors where Firestore or Firebase config was missing or not resolved.
- Fixed Diagnostics UI panel issues to prevent nested scrolling and text overflow on mobile viewports.
- Fixed manual registration button to prevent false successes when Firestore is unavailable.

### Improved
- Added clear warning cards in settings when Cloud Sync is not initialized.
- Added dynamic real-time Firebase configuration metrics (Apps count, App name, services state, and init errors) to Sync Diagnostics.
- Improved clipboard copy diagnostics payload to include all newly introduced Firebase state diagnostics.

## 3.6.10

### Fixed
- Fixed Cloud Sync Probe failing on Android because Firestore rejected undefined userAgent values.
- Fixed Firestore sync writes to sanitize undefined fields before setDoc.
- Fixed Sync Diagnostics overflow on mobile by making the diagnostics section scrollable.
- Fixed Cloud Sync validation so probe errors show real Firestore failures.

### Improved
- Improved Android and Web sync diagnostics with copyable runtime reports.
- Improved Firestore payload sanitization across probe, devices, profile, and settings writes.
- Improved mobile usability for long diagnostics, paths, errors, and device metadata.

## 3.6.9

### Fixed
- Fixed unreliable Android and Web Cloud Sync connection.
- Fixed Devices & Sessions not proving whether devices were actually connected.
- Fixed current device being incorrectly classified as a previous session.
- Fixed profile, theme, accent, and photo sync relying on inconsistent local/cloud state.

### Improved
- Added a real Firebase-backed Sync Engine unifying all Firestore and Storage actions.
- Added stable device identity, heartbeat presence, and deterministic session classification.
- Added clearer sync diagnostics for Auth UID, Firebase project, listeners, writes, cache state, and probe results.
- Improved Firestore source-of-truth handling for profile and settings.

## 3.6.8

### Fixed
- Fixed duplicate properties compile typecheck error in sync diagnostics.
- Fixed incorrect device categorization in the Devices list.
- Fixed potential web connection gaps and session listener disconnects.

### Improved
- Improved device session classification utilizing deterministic categories for current device, active remotes, recent remotes, signed out, and legacy devices.
- Added periodic 30-second heartbeats for signed-in sessions to track device freshness.
- Added manual Reconnect Devices button in settings panel and developer tools.

## 3.6.7

### Fixed
- Fixed duplicate and stale device records appearing as active sessions in Devices & Sessions.
- Fixed legacy Android and Web session documents being shown as current devices.
- Fixed confusing session status combinations such as "Active just now" with "Idle."
- Fixed unknown version values appearing in main device cards.

### Improved
- Improved Devices & Sessions grouping for current device, other devices, and previous sessions.
- Improved device name normalization for Android and Web.
- Improved diagnostics for duplicate, stale, legacy, and replaced device records.
- Improved handling of older device documents created by previous Studio versions.

## 3.6.6

### Fixed
- Fixed Web/laptop devices not appearing in Devices & Sessions after Android registration was restored.
- Fixed Web device registration being skipped or not reflected across devices.
- Fixed Devices & Sessions rendering only the current device when multiple Firestore device documents exist.
- Fixed overly technical device names appearing in session cards.

### Improved
- Improved Android and Web session visibility from users/{uid}/devices.
- Improved Web device metadata handling for APK/OTA N/A cases.
- Improved device display names for cleaner session cards.
- Improved diagnostics for device IDs received, devices rendered, filtered devices, and raw technical metadata.

## 3.6.5

### Fixed
- Fixed Devices & Sessions showing no devices even when signed in.
- Fixed current device registration not writing to Firestore.
- Fixed missing device documents under users/{uid}/devices.
- Added diagnostics for device write status and listener status.
- Implemented robust device registration with 10-second write timeout and automatic retries.
- Added deep diagnostics in Devices & Sessions sheet listing 16 registration status parameters.
- Implemented automatic Firestore payload sanitization to prevent write rejections due to undefined native/platform fields.

### Improved
- Improved Devices & Sessions reliability across Android and Web.
- Improved current device detection and last active tracking.
- Improved cross-device session visibility.

## 3.6.4

### Fixed
- Fixed Devices & Sessions showing no devices even when signed in.
- Fixed current device registration not writing to Firestore.
- Fixed missing device documents under users/{uid}/devices.
- Added diagnostics for device write status and listener status.

### Improved
- Improved Devices & Sessions reliability across Android and Web.
- Improved current device detection and last active tracking.
- Improved cross-device session visibility.

## 3.6.3

### Fixed
- Fixed Android device not registering in Devices & Sessions.
- Fixed Web and Android sessions not seeing each other.
- Fixed Cloud Sync listeners appearing active without actual cross-device data updates.
- Fixed theme, accent color, profile name, and profile photo sync not propagating between devices.
- Fixed sync errors being hidden or treated as successful.

### Improved
- Added stronger Sync Diagnostics for device registration and Firestore listener state.
- Improved Devices & Sessions accuracy across Web and Android.
- Improved sync failure reporting.

## 3.6.2

### Fixed
- Fixed Cloud Sync not working correctly on Web builds.
- Fixed web/laptop sessions not registering as real devices.
- Fixed sync logic incorrectly depending on native APK/OTA fields.
- Fixed theme, accent color, and profile photo not syncing between Android and Web.
- Fixed Devices & Sessions not showing all signed-in devices.

### Added
- Added platform-aware sync diagnostics for Web and Android in Developer Options.
- Added detailed Build and platform labels for Devices & Sessions.

### Improved
- Improved cross-device sync reliability.
- Improved Devices & Sessions layout for web/browser sessions.

## 3.6.1

### Fixed
- Fixed Cloud Sync not syncing theme, accent color, and profile photo across devices.
- Fixed profile changes not updating live on other signed-in devices.
- Fixed Devices & Sessions only showing the current device.
- Fixed profile photo upload getting stuck without updating remote devices.

### Added
- Added real device registration for signed-in Studio accounts.
- Added live listeners for profile, appearance, preferences, and devices.
- Added Sync Diagnostics in Developer Options.

### Improved
- Improved account sync reliability.
- Improved cross-device settings updates.
- Improved local-first sync and offline recovery behavior.

## 3.6.0

### Added
- Added real cross-device sync for profile and account settings.
- Added live sync for theme, accent color, language, and preferences.
- Added profile photo upload and sync across devices.
- Added sync diagnostics in Developer Options.

### Improved
- Improved local-first sync behavior.
- Improved offline sync handling.
- Improved account/profile state consistency across Studio.

### Fixed
- Fixed account sync controls not actually syncing settings across devices.
- Fixed theme and accent color not appearing on other devices.
- Fixed profile photo not syncing between phone and laptop.
- Fixed Settings account card using stale local profile data.

## 3.5.0

### Added
- Added real Studio Cloud Sync for signed-in users.
- Added cross-device sync support for Studio account data.
- Added sync status, last synced time, and manual Sync Now controls.
- Added device registration for signed-in devices.
- Added local-to-cloud migration for existing data.
- Added sync diagnostics in Developer Options.

### Improved
- Improved account functionality with real backup and restore behavior.
- Improved profile/settings persistence across devices.
- Improved offline handling for syncable data.

### Fixed
- Fixed sync buttons appearing functional when sync was not actually implemented.

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

# Project Structure & Architecture Map — Chordex Studio

This document defines the codebase layout, module entry points, component structures, and file classifications to ensure development hygiene.

---

## 1. Key Entry Points & Feature Locations

* **App Entry Points**:
  * **Android App (Web Bundle)**: [main.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/apps/studio-android/src/main.tsx) & [App.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/apps/studio-android/src/App.tsx)
  * **Android Native App Shell**: `apps/studio-android/android/app/src/main/java/com/chordex/app/MainActivity.java`
  * **Web App**: `apps/studio-web/src/main.tsx` & `apps/studio-web/src/App.tsx`
* **Studio Hub (Settings Dashboard)**:
  * [StudioHub.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/components/StudioHub.tsx)
* **Chordex (Practice & Chords Library)**:
  * **Discover & Songs catalog**: [SongsPanel.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/panels/SongsPanel.tsx)
  * **Practice Screen**: [SongPracticeView.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/components/SongPracticeView.tsx)
  * **Chord Library**: [LibraryPanel.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/panels/LibraryPanel.tsx)
* **Stagex (Interactive Layout Stage)**:
  * **Android Screen Wrapper**: [StageCorePanel.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-android/src/components/StageCorePanel.tsx)
  * **Web Screen Wrapper**: [StageCorePanel.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/components/StageCorePanel.tsx)
  * **Static iframe App**: [app.js](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/apps/studio-android/public/stage-core/app.js) & [features.js](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/apps/studio-android/public/stage-core/features.js)
* **Drumex (Sequencer & Drum Pads)**:
  * **Sequencer UI**: [DrumEditor.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/panels/DrumEditor.tsx)
  * **Audio Sampler Logic**: [drumAudio.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/lib/drumAudio.ts)
* **Groovex (Interactive Backing Tracks)**:
  * **Sequencer UI & Player**: `packages/ui-shared/src/groovex/`
* **Vocalex (Vocal Tuning & Takes)**:
  * **App Shell**: `packages/ui-shared/src/vocalex/VocalexApp.tsx`
  * **Tuner Lab**: `packages/ui-shared/src/vocalex/LabPanel.tsx`
* **OTA & Native Update System**:
  * **OTA Concurrency Engine**: [otaUpdate.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/lib/otaUpdate.ts)
  * **Native Bridge Watchdog**: [capgoUpdater.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/lib/capgoUpdater.ts)
  * **Update UI Indicator overlay**: [UpdateIndicator.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/components/UpdateIndicator.tsx)
* **Release Metadata Locations**:
  * **Vite Companion Manifest**: `apps/studio-android/public/version.json`
  * **Android build configurations**: `apps/studio-android/android/app/build.gradle` (versionCode & versionName)
  * **Source version mapping**: [appVersion.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/lib/appVersion.ts)
* **Shared UI Components Location**:
  * `packages/ui-shared/`
* **Android-only UI Components Location**:
  * `packages/ui-android/`
* **Core Library Locations**:
  * **Core engines & native wrappers**: `packages/studio-core/src/lib/`
  * **Zustand states & stores**: `packages/studio-core/src/store/`
  * **Data catalogs**: `packages/studio-core/src/data/`
  * **I18N JSON files**: `packages/studio-core/src/i18n/`

---

## 2. Platform Boundaries & File Ownership Map

* **WEB-owned (Netlify targets)**:
  * `apps/studio-web/**`
  * `packages/ui-web/**`
* **APK-owned (Gradle/Android builds)**:
  * `apps/studio-android/**`
  * `packages/ui-android/**`
* **SHARED (Neutral logic & assets)**:
  * `packages/studio-core/**`
  * `packages/ui-shared/**`

---

## 3. Area Classification

### ACTIVE (Actively maintained and developed)
* `packages/studio-core/src/lib/` (Core features: `appVersion`, `otaUpdate`, `auth`, `permissions`)
* `packages/ui-shared/src/components/` (Shared UI buttons, dialogs, cards)
* `packages/ui-shared/src/panels/` (App core screens: Library, Songs, Settings)
* `apps/studio-android/src/` (Android App entry and base layout router)

### LEGACY (Maintained for backward compatibility but superseded)
* `packages/studio-core/src/lib/syncBackends/firebaseLegacy.ts` (Superseded by Supabase Realtime synchronization)
* `packages/studio-core/src/lib/utils.ts` (Obsolete small utility wrappers, replaced by lodash and direct JS equivalents)

### DUPLICATED (Intentionally separate versions for Web/Android platform requirements)
* `packages/ui-android/src/components/StageCorePanel.tsx` (Interprets back gestures, notches, and Capacitor bridges)
* `packages/ui-shared/src/components/StageCorePanel.tsx` (Web version utilizing standard browser frames, mouse hovers, and keyboards)
* `packages/ui-web/src/components/WebAppSectionDock.tsx` (Vite landing/desktop dock panel)
* `packages/ui-shared/src/components/WebAppSectionDock.tsx` (Shared web app workspace dock version)

### RISKY (Fragile concurrency locks, security features, or compilation boundary targets)
* `packages/studio-core/src/lib/syncEngine.ts` & `sync.ts` (Concurrency sync queues, locks, Auth state mutations)
* `packages/studio-core/src/lib/capgoUpdater.ts` (Early watchdog listener executed before React bundle runs)
* `apps/studio-android/android/app/build.gradle` (Gradle release keys configuration)

### UNKNOWN (Preserved without modifications)
* `apps/studio-android/public/drums/` & `instruments/` (Optional asset packs, sound maps)
* `packages/studio-core/src/data/songs.ts` (Unpreloaded catalog indices, keep for offline mapping templates)

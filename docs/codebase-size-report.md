# Codebase Size & Context Cost Report — Chordex Studio

This report catalogs the largest files, data structures, and assets in the codebase to evaluate token footprint impact and design future splitting strategies.

---

## 1. Code Files Over 3000 Lines

### `apps/studio-android/public/stage-core/app.js`
* **Size / Line Count**: 437.1 KB / 9,818 lines
* **Feature Owner**: Stagex (Layout Canvas Editor)
* **Description / Why it is large**: Contains the core logic for the HTML5 canvas editor, visual node coordinates, and DOM interaction helpers.
* **Safe to split?**: **NO**. It is a pre-compiled static package loaded inside the sub-app iframe.
* **Action**: **DO NOT TOUCH** (Risk of breaking canvas drawing mechanics).

### `packages/ui-shared/src/components/StudioHub.tsx`
* **Size / Line Count**: 307.1 KB / 6,868 lines
* **Feature Owner**: Studio Hub (Dashboard and Settings Panel)
* **Description / Why it is large**: Houses the entire dashboard layout, profile menus, system diagnostics settings, account tiers, and theme selections.
* **Safe to split?**: **YES**. Settings rows and individual cards can be refactored into distinct files later.
* **Action**: **DO NOT TOUCH NOW** (Settings dependencies are highly coupled to local states).

### `packages/ui-shared/src/panels/DrumEditor.tsx`
* **Size / Line Count**: 339.8 KB / 5,547 lines
* **Feature Owner**: Drumex (Step Sequencer Grid)
* **Description / Why it is large**: Implements the step sequencer pad matrix, mixer channels controls, and tempo configurations.
* **Safe to split?**: **YES**. Sequencer matrix, audio mixer, and control bars can be modularized.
* **Action**: **DO NOT TOUCH NOW** (High frequency state mutations inside loop cycles).

### `packages/ui-shared/src/components/AccountCard.tsx`
* **Size / Line Count**: 247.4 KB / 4,711 lines
* **Feature Owner**: Studio Hub (User Billing and Account settings)
* **Description / Why it is large**: Renders pricing tiers, card credentials, subscription plans, and invoice tables.
* **Safe to split?**: **YES**. Subscriptions card can be separated from invoice histories.
* **Action**: **DO NOT TOUCH NOW** (Contains sensitive auth integrations).

### `apps/studio-android/src/EmergencyDebugOverlay.tsx`
* **Size / Line Count**: 171.3 KB / 3,949 lines
* **Feature Owner**: Diagnostics Overlay (Debug Panel)
* **Description / Why it is large**: Implements the debug tool tabs, error logs, and navigation telemetry logs.
* **Safe to split?**: **YES**. Log tables and network trackers can be split.
* **Action**: **DO NOT TOUCH NOW** (Useful to keep as a single tool file for debug references).

### `packages/ui-shared/src/panels/SongsPanel.tsx`
* **Size / Line Count**: 203.9 KB / 3,880 lines
* **Feature Owner**: Chordex (Songs Library and Discover)
* **Description / Why it is large**: Houses search controls, genre cards, lyrics parser layouts, and empty-state fallbacks.
* **Safe to split?**: **YES**. Filter sidebar and cards grid can be separated.
* **Action**: **DO NOT TOUCH NOW** (Song state handles transition zoom animations).

### `apps/studio-android/public/stage-core/features.js`
* **Size / Line Count**: 201.8 KB / 3,818 lines
* **Feature Owner**: Stagex (History Overlay & Presets System)
* **Description / Why it is large**: Contains the layout history timeline rendering engine and presets panel widgets.
* **Safe to split?**: **NO**. Pre-compiled vendor bundle asset.
* **Action**: **DO NOT TOUCH**.

---

## 2. Code Files Over 2000 Lines

* **[StageCorePanel.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-android/src/components/StageCorePanel.tsx)** (Android): 131.9 KB / 3,078 lines — Android Stagex wrapper (safe to split sheets, do not touch now).
* **[StageCorePanel.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/components/StageCorePanel.tsx)** (Shared): 124.7 KB / 2,883 lines — Web Stagex wrapper (safe to split, do not touch now).
* **[sync.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/lib/sync.ts)**: 108.7 KB / 2,866 lines — Sync engine transactions (concurrency state-machine locks. **RISKY — DO NOT TOUCH**).
* **[App.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/apps/studio-android/src/App.tsx)**: 95.5 KB / 2,682 lines — Android app navigator (safe to split routes, do not touch now).
* **[DevToolsDashboard.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/components/DevToolsDashboard.tsx)**: 97.3 KB / 2,403 lines — Diagnostics view.
* **[progressions.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/data/progressions.ts)**: 108.9 KB / 2,201 lines — Discover lyrics progression maps (heavy database object. Safe to split into dynamic JSON files in the future).
* **[drumAudio.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/lib/drumAudio.ts)**: 99.6 KB / 2,140 lines — Audio buffer buffers mapping (no-touch).
* **[index.css](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/apps/studio-android/src/index.css)**: 64.5 KB / 2,001 lines — App stylesheet.

---

## 3. Code Files Over 1000 Lines

* **[UpdateIndicator.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/components/UpdateIndicator.tsx)**: 65.2 KB / 1,841 lines — OTA UI mapping.
* **[otaUpdate.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/lib/otaUpdate.ts)**: 69.1 KB / 1,812 lines — OTA client downloader logic.
* **[LibraryPanel.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/panels/LibraryPanel.tsx)**: 86.2 KB / 1,683 lines — Chords selector.
* **[supabaseRealtime.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/lib/syncBackends/supabaseRealtime.ts)**: 45.0 KB / 1,354 lines — Realtime sync backend.
* **[firebaseLegacy.ts](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/lib/syncBackends/firebaseLegacy.ts)**: 42.7 KB / 1,332 lines — Legacy firebase sync.
* **[LabPanel.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/vocalex/LabPanel.tsx)**: 57.0 KB / 1,268 lines — Vocalex tuner view.
* **[CHANGELOG.md](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/CHANGELOG.md)**: 46.5 KB / 1,100 lines.
* **[GroovexPlayer.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/groovex/GroovexPlayer.tsx)**: 44.6 KB / 1,098 lines — Groovex backing track player interface.
* **[TakesPanel.tsx](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/ui-shared/src/vocalex/TakesPanel.tsx)**: 41.3 KB / 1,057 lines — Vocalex takes explorer.

---

## 4. Largest JSON Files in Source

1. **[en.json](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/i18n/en.json)**: 61.8 KB / 1,043 lines — English translation values.
2. **[es.json](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/packages/studio-core/src/i18n/es.json)**: 47.6 KB / 998 lines — Spanish translation values.

---

## 5. Largest CSS Files in Source

1. **[app.css](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/apps/studio-android/public/stage-core/app.css)**: 113.2 KB / 2,961 lines — Stagex layouts.
2. **[index.css](file:///c:/Users/ayuda/.gemini/antigravity/scratch/Studio/apps/studio-android/src/index.css)**: 64.5 KB / 2,001 lines — Android app CSS styling definitions.

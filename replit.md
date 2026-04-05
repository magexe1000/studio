# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/chord-app` (`@workspace/chord-app`)

Chordex — React/Vite PWA + Capacitor Android app for chord reference, song/progression building, and drum tab editing.

- **Stage Mode (Stagex)**: `src/components/StageCorePanel.tsx` — iframe-based stage plot editor.
  - **Architecture**: Pre-built static bundle at `public/stage-core/` served in an iframe. React parent renders header, FAB, and bottom nav bar as real DOM buttons on top of the iframe. Iframe's own FAB/nav bar are hidden via CSS injection + inline `<head>` script (hash-based embed detection).
  - **Bridge**: `callIframe(fn, arg)` — direct `contentWindow[fn]()` call (same-origin) with `postMessage` fallback; 200ms dedup guard prevents double-fire from touch+click. Iframe→parent: `postMessage({type:'sc-dial-state', open})` for FAB dial state sync (source-verified listener).
  - **FAB animation**: React FAB button in StageCorePanel rotates 45° + scale(1.08) on open (spring curve 0.34,1.56,0.64,1). State driven by iframe `sc-dial-state` messages only (authoritative, not optimistic).
  - **Chrome Android iframe rule**: All `position:fixed` replaced with `position:absolute` in `app.css`, `app.js`, `features.js`, `index.html`. Body has `transform: translateZ(0)` to create stacking context.
  - **Offline**: `cloud-stub.js` stubs all Firebase APIs; fonts bundled locally; no external network dependencies.
  - **CSS overrides** in `index.html`: hide desktop nav, style bottom nav pill, position:absolute for scrollable-view/FAB/backdrop, view padding adjustments. Left `#lib-panel` hidden via inline `display:none !important` + CSS rule (permanently killed, React parent handles navigation).
  - **Dark mode colors**: Stagex uses `#0e0e0e` (matching Chordex `--app-bg`) for all dark-mode backgrounds (canvas, body, views, header). AMOLED: `#000`. Light: `#f2f1ef`.
- **Chord Diagrams**: `src/components/ChordDiagram.tsx` — React SVG renderer. PDF/preview renderers in `SongsPanel.tsx` (`buildPrintSVG`, `buildPrintFretboardSVG`, `PreviewFretboard`, `PreviewCustomDiagram`). String numbering: `frets[]` index 0=low E…5=high E; barre `fromString/toString` use guitar convention 1=high E…6=low E. Barre x-position uses `(numStrings - stringNumber)` mapping. Dot suppression converts array index to string number before range-checking against barre. Fret window auto-calculates `minActive` when `baseFret===1`.
- **State**: `src/store/useChordStore.ts` (Zustand + persist) — chord/song/settings; `src/store/useDrumStore.ts` — fully isolated drum patterns
- **App Mode**: `settings.appMode: 'chords' | 'drums'` in AppSettings; switching replaces the entire UI instantly with no reload
- **Panels** (Chordex mode): `LibraryPanel`, `ChordPanel`, `SongsPanel`, `SettingsPanel` + `BottomNav`
- **DrumEditor** (`src/panels/DrumEditor.tsx`): vertical drum tab editor — measures stack top→bottom; 10 instruments (kick, snare, hi-hats, toms, crash, ride); click to toggle hits, drag to extend; auto-adds new empty measure when last measure gets its first hit; pattern tabs, BPM, time signature, subdivision (8th/16th) controls; completely isolated from chord data. Hamburger menu includes Humanize (applies subtle variation to note types: ghost snare, accented kick, open hihat, bell ride — probabilistic rules) and Preferences link.
- **DrumPrefsPanel** (`src/panels/DrumPrefsPanel.tsx`): full-screen preferences panel matching Chordex card/toggle style. 14 settings across 5 sections: Editor Behavior (noteVariationsCycle, autoExpandPattern, snapToGrid, dragToFill), Playback (autoPlayOnEdit, loopPlayback, metronome, countIn), Interaction (quickDeleteMode, showNoteVariations, highlightActiveInst), Visual (gridLinesEmphasis), Performance (lowLatencyMode, performanceMode). Accessible via sliders button in songs list top bar OR hamburger → Preferences.
- **DrumPrefs** in `useDrumStore.ts`: `DrumPrefs` interface + `DEFAULT_DRUM_PREFS`, stored as `drumPrefs` in persist (store version 10), `updateDrumPrefs(patch)` action. Migration v10 seeds `drumPrefs` from defaults for existing users.
- **Drum FX** (`src/lib/drumAudio.ts`): per-instrument FX chain with 4-band EQ (80 Hz / 350 Hz / 2 kHz / 10 kHz), dynamics compressor (safe -6 to -24 dB threshold, 2:1–8:1 ratio), gate (GainNode hold+release envelope, min 50ms release — never clicks), asymmetric tanh saturation (tape oxide emulation with even-order harmonics), Freeverb reverb (Jezar at Dreampoint public domain — 8 Schroeder comb filters + 4 all-pass filters, JS IR generation + ConvolverNode). Per-instrument character presets: Snare (Tight/Fat/Crack/Brush), Kick (Sub/Punch/Click/Tight), HH (Bright/Dark/Crisp), etc. Persist version 8. `InstFX` interface: compress, attack, eqLow, eqLowMid, eqMid, eqHigh, reverb, gate, saturate.
- **Capacitor**: Android build via `npx cap sync android` then `node patch-android.cjs`; ExternalStorage permissions for file export to public Downloads folder
- **i18n**: `src/lib/i18n.ts` — full EN/ES (LATAM) localization system. `useT()` hook from `src/lib/useT.ts`. Covers all sections: `nav`, `library`, `chord`, `songs`, `settings`, `customBuilder`, `chordFinder`, `liveMode`, `hub` (Studio Hub), `drum` (Drumex), `drumPrefs` (Drum preferences), `applyTo` (apply-to-sheet). StudioHub greetings have 22 pairs in both EN and ES with time-of-day awareness. Stagex uses its own `TRANSLATIONS` object in `public/stage-core/app.js` with `T(key)` function.

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

## Security Overrides (pnpm)

The root `package.json` includes pnpm overrides to patch transitive dependency vulnerabilities:
- `path-to-regexp@8.3.0` → `8.4.0`
- `picomatch@2.3.1` → `2.3.2`, `picomatch@4.0.3` → `4.0.4`
- `lodash@4.17.23` → `4.18.0`
- `tar@6.2.1` → `7.5.11`
- `brace-expansion@2.0.2` → `2.0.3`
- `esbuild@0.18.20` → `0.25.0`
- `yaml@2.8.2` → `2.8.3`

postMessage calls between the React parent and stage-core iframe use `window.location.origin` (not `'*'`) and message listeners validate `e.origin` before processing.

All `.innerHTML` assignments in `public/stage-core/app.js`, `features.js`, and `index.html` are wrapped with `DOMPurify.sanitize()` (vendor lib at `vendor/purify.min.js`, v3.2.6). A DOMPurify hook in `index.html` preserves the app's developer-controlled inline event attributes (`onclick`, `ondragstart`, etc.) while still sanitizing against injected scripts, iframes, and other XSS vectors.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

# Overview

This project is a pnpm workspace monorepo utilizing TypeScript, designed to build a suite of music-related applications. It includes an API server, a React-based Progressive Web App (PWA) for chord reference and music creation, and shared libraries. The core vision is to provide comprehensive tools for musicians, from practice aids to stage management.

**Key Capabilities:**

*   **Chordex (Chord App):** A React/Vite PWA for guitar chord diagrams, song/progression building, drum tab editing, and multi-track practice mixer (Groovex).
*   **API Server:** An Express 5 API handling data persistence via PostgreSQL and Drizzle ORM.
*   **Shared Libraries:** Centralized OpenAPI specifications, generated API clients (React Query hooks), and Zod schemas for validation.

# User Preferences

I prefer concise and clear communication.
I value an iterative development approach, with regular updates and opportunities for feedback.
Before implementing major architectural changes or introducing new dependencies, please discuss them with me.
I appreciate detailed explanations for complex technical decisions.
Do not make changes to the `lib/api-spec` directory without prior approval.
Do not modify the core `tsconfig.base.json` without explicit instruction.

# System Architecture

## Monorepo Structure

The project is structured as a pnpm workspace monorepo, organizing code into `artifacts/` (deployable applications) and `lib/` (shared libraries).

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
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Technology Stack

*   **Monorepo Tool:** pnpm workspaces
*   **Node.js:** v24
*   **TypeScript:** v5.9
*   **API Framework:** Express 5
*   **Database:** PostgreSQL with Drizzle ORM
*   **Validation:** Zod (`zod/v4`), `drizzle-zod`
*   **API Codegen:** Orval (from OpenAPI spec)
*   **Build Tool:** esbuild (CJS bundle)
*   **Frontend Framework:** React with Vite (for Chordex)
*   **State Management:** Zustand (for Chordex/Groovex)
*   **Mobile App Development:** Capacitor (for Android builds)

## TypeScript Configuration

The monorepo uses TypeScript composite projects. Every package extends `tsconfig.base.json` with `composite: true`, and the root `tsconfig.json` lists all packages as project references. This setup enforces type-checking from the root and utilizes `emitDeclarationOnly` for `.d.ts` generation, with `esbuild` handling JavaScript bundling.

## UI/UX and Feature Specifications

### Chordex (Chord App)

*   **App Modes:** Supports `chords`, `drums`, `stage`, `groovex`, and `vocalex` modes, allowing instant UI switching.
*   **Stage Mode (Stagex):** An iframe-based stage plot editor with a React parent for header and navigation. Features a `postMessage` bridge for communication and specific CSS overrides for mobile compatibility.
*   **Guitar Audio:** Implements Karplus-Strong physical string synthesis for realistic acoustic guitar chord playback, entirely via Web Audio API.
*   **Chord Diagrams:** React SVG renderer for chord diagrams, including PDF/preview rendering.
*   **Groovex Mode:** A multitrack music practice mixer for Rock Band song stems. Features a Web Audio API engine for synchronized playback, Zustand for state management, IndexedDB stem caching, and a comprehensive song catalog with 95 songs having server-hosted stems (OGG format at `api-server/public/stems/{songId}/`). Stem configurations vary per song (kick/snare/cymbals vs drums, backing, crowd, keys). UI follows a premium "Harmonic Mixer" design with hero visualizer, centered song identity, transport controls (stop, -10s, play/pause, +10s, skip-to-end), and a clean mixer section. Floating pill navigation bar (matching Chordex) with Library and Settings tabs. Player view hides the nav for full immersion. Download robustness includes automatic retry (up to 2x) with exponential backoff and 120s timeout per stem.
*   **Vocalex Mode:** Vocal tools & training app with 4 sections: Practice (warm-ups, drills), Pitch (real-time pitch detection), Vocal Lab (effects/processing), and Takes (recording management). Has its own bottom nav, splash animation, and mic/waveform logo icon. Component at `src/vocalex/VocalexApp.tsx`. Practice exercises use a multi-oscillator vocal synth (`vocalSynth.ts`) for reference tones and a voice coach (`voiceCoach.ts`) powered by Web Speech Synthesis API that speaks instructions, step changes, coaching tips, and completion feedback aloud.
*   **DrumEditor:** A vertical drum tab editor with 10 instruments, pattern management, humanization features, and a dedicated Drum Library with search, filters, and audio previews.
*   **Drum Audio FX:** Per-instrument FX chain with 4-band EQ, compressor, gate, asymmetric tanh saturation, and Freeverb reverb, all configurable.
*   **Localization:** Full EN/ES (LATAM) localization system (`i18n.ts`) across all application sections.
*   **OTA Update Notifications:** Checks `public/version.json` on launch to notify the user via an in-app banner/pill if a newer version is available.
*   **OTA on Native (Capgo, self-hosted):** Handles over-the-air bundle updates dynamically on Android using self-hosted bundle packages served from Firebase Hosting.
*   **Cloud Sync Engine:** Synchronizes application states (Chordex, Drumex, Stagex, Vocalex) to Firestore using a background state-machine-driven sync engine.


### API Server

*   **Entry Point:** `src/index.ts`
*   **App Setup:** `src/app.ts` handles CORS, JSON parsing, and mounts routes at `/api`.
*   **Routes:** Organized under `src/routes/`, utilizing `@workspace/api-zod` for validation and `@workspace/db` for persistence. Exposes a `GET /health` endpoint.

## Security

pnpm overrides are used to patch transitive dependency vulnerabilities. `postMessage` calls between the React parent and stage-core iframe validate `e.origin`. All `.innerHTML` assignments are sanitized using `DOMPurify.sanitize()` to prevent XSS.

# External Dependencies

*   **Database:** PostgreSQL
*   **API Codegen:** Orval
*   **Frontend State Management:** Zustand
*   **Mobile App Framework:** Capacitor 6 (with `@capgo/capacitor-updater` for self-hosted OTA bundle swaps on Android)
*   **Web Audio API:** For guitar synthesis and multitrack mixing
*   **Firebase APIs:** Stubbed in offline mode for Chordex
*   **DOMPurify:** For HTML sanitization
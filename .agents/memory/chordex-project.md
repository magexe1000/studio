---
name: Chordex project context
description: Key rules, file locations, and constraints for the Chordex monorepo
---

# Chordex Project Context

## Structure
- `artifacts/chord-app/` — React/Vite PWA (main app)
- `artifacts/api-server/` — Express 5 API + PostgreSQL via Drizzle ORM
- `artifacts/mockup-sandbox/` — Canvas tool only, ignore unless asked
- `lib/api-spec/` — OpenAPI spec (NEVER edit without explicit approval)
- `lib/api-client-react/` — Generated React Query hooks (Orval codegen)
- `lib/api-zod/` — Generated Zod schemas (Orval codegen)
- `lib/db/` — Drizzle ORM schema + DB connection

## Hard Rules
- Never edit `lib/api-spec/` without explicit user approval
- Never modify `tsconfig.base.json` without explicit instruction
- Never `git push` directly — git push is blocked; always use GitHub Git Data API via `code_execution`
- Always use `pnpm` (never npm or yarn)
- Discuss major architectural changes or new dependencies before implementing

## Key Files
- `artifacts/chord-app/src/lib/appVersion.ts` — APP_VERSION + APP_CHANGELOG (single source of truth)
- `artifacts/chord-app/src/lib/liquidGlass.ts` — WebGL liquid glass nav effect
- `artifacts/chord-app/src/lib/sync.ts` — Firestore cloud sync engine
- `artifacts/chord-app/src/lib/capgoUpdater.ts` — OTA bundle swap bridge
- `artifacts/chord-app/src/groovex/stemCache.ts` — Stem download + IndexedDB cache
- `artifacts/chord-app/public/version.json` — OTA version manifest (auto-generated, do not hand-edit)

## OTA System
- Bump `APP_VERSION` + `APP_CHANGELOG` in `appVersion.ts` only — user handles build/release locally
- OTA base URL: `https://studio-30f44.web.app`
- Web PWA: service worker reload; Android: @capgo/capacitor-updater
- `scripts/sync-version.mjs` regenerates `public/version.json` on predev/prebuild

## GitHub Push Pattern (REQUIRED — git push is blocked)
Use GitHub Git Data API via `code_execution`. Owner: `MAGEXE1000`, Repo: `Chordex`, branch: `main`.
Get token from GitHub integration (listConnections). Always push `package.json` + `pnpm-lock.yaml` together when deps change.

## Audio / Stems (Groovex)
- Stems are .ogg on Cloudflare R2 (`pub-b6a593f7d45247389f1accd1a54fec5c.r2.dev`)
- R2 needs CORS: GET/HEAD from * — check CORS first if stems fail
- Vite dev proxies `/r2-stems` → R2 for local dev

## App Modes (chord-app)
SPA switching between: chords, drums, stage, groovex, vocalex — via BottomNav.tsx

## Current Version
3.0.76 (Beta), date 2026-05-12

## Workflows (Replit)
- chord-app web: `pnpm --filter @workspace/chord-app run dev`
- API Server: `pnpm --filter @workspace/api-server run dev`
Restart after code/package changes.

## Security
- Dependency vulns: pnpm overrides in root `package.json`
- postMessage in Stage mode validates `e.origin`
- All `.innerHTML` uses `DOMPurify.sanitize()`

## .gitignore exclusions
`attached_assets/`, `*.apk`, `*.zip`, `node_modules/`, `dist/`, `.local/`

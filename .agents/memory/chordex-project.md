---
name: Chordex project context
description: Key rules, file locations, and constraints for the Chordex monorepo
---

# Chordex Project Context

## Structure
- `apps/studio-android/` — Native Android application (built via Capacitor and Gradle)
- `apps/studio-web/` — Web-based PWA application (deployed via Netlify)
- `packages/studio-core/` — Platform-neutral core logic (sync backend, configuration store)
- `packages/ui-shared/` — Platform-neutral UI primitives (StageCorePanel)
- `packages/ui-android/` — Android-specific UI primitives
- `packages/ui-web/` — Web-specific UI primitives
- `lib/api-spec/` — OpenAPI specification (NEVER edit without explicit approval)
- `lib/db/` — Drizzle ORM schema + database connection

## Hard Rules
- Never edit `lib/api-spec/` without explicit user approval
- Never modify `tsconfig.base.json` without explicit instruction
- Always use `pnpm` (never npm or yarn)
- Discuss major architectural changes or new dependencies before implementing
- Strictly isolate platforms: Web changes must not modify Android files, and vice versa.

## Key Files
- `packages/studio-core/src/lib/appVersion.ts` — Version constants + Changelog (single source of truth)
- `apps/studio-android/src/App.tsx` — Android startup wrapper, status bar, and themes synchronizers
- `packages/studio-core/src/lib/sync.ts` — Firestore cloud sync engine
- `packages/ui-shared/src/components/StageCorePanel.tsx` — Stagex editor panel and touch event wrappers
- `firebase-public/app-release.json` — Android OTA version manifest (production update tracker)

## Current Versions
- **Android / APK**: 3.6.42 (versionCode 69)
- **Web / PWA**: 4.0.0

## Security
- Dependency vulnerabilities: patched via pnpm overrides in root `package.json`
- postMessage in Stage mode validates `e.origin`
- All `.innerHTML` uses `DOMPurify.sanitize()`
- Keystore credentials and release passwords must NEVER be committed to Git.

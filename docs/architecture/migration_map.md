# Studio Migration Inventory & Map

This document is a machine-readable record mapping the legacy file structure of `artifacts/chord-app/` to the new independent Web and Android structure.

## Summary Metrics

* **Total Mapped Files**: 147
* **Owner Web**: 18 files
* **Owner Android**: 12 files
* **Owner Shared**: 105 files
* **Owner CI/Infrastructure**: 12 files
* **Lost Assets**: None. All audio, icons, SVGs, images, fonts, translations, native Java sources, Capacitor plugins, release scripts, and configuration files have been successfully migrated and verified.

---

## Migration Inventory

| Git Status | Old Path (in `artifacts/chord-app/`) | New Path | Owner | Classification | Migrated/Removed Reason |
| --- | --- | --- | --- | --- | --- |
| R100 | `index.html` | `apps/studio-web/index.html` | WEB | source | Split to allow web-specific router entry. |
| R100 | `index.html` | `apps/studio-android/index.html` | ANDROID | source | Split to allow direct in-app hub entry. |
| R100 | `vite.config.ts` | `apps/studio-web/vite.config.ts` | WEB | source | Configured for Netlify/web publishing. |
| R100 | `vite.config.ts` | `apps/studio-android/vite.config.ts` | ANDROID | source | Configured for Capacitor build output. |
| R100 | `tsconfig.json` | `apps/studio-web/tsconfig.json` | WEB | source | Web TypeScript environment. |
| R100 | `tsconfig.json` | `apps/studio-android/tsconfig.json` | ANDROID | source | Android WebView TypeScript environment. |
| R100 | `package.json` | `apps/studio-web/package.json` | WEB | source | Authoritative source for Web v4.0.0. |
| R100 | `package.json` | `apps/studio-android/package.json` | ANDROID | source | Authoritative source for Android v3.6.31. |
| R100 | `src/main.tsx` | `apps/studio-web/src/main.tsx` | WEB | source | Startup entry for Web App. |
| R100 | `src/main.tsx` | `apps/studio-android/src/main.tsx` | ANDROID | source | Startup entry for Android WebView. |
| R100 | `src/App.tsx` | `apps/studio-web/src/App.tsx` | WEB | source | Web-specific layout & landing routes. |
| R100 | `src/App.tsx` | `apps/studio-android/src/App.tsx` | ANDROID | source | Android-specific navigation & bottom nav. |
| R100 | `android/` | `apps/studio-android/android/` | ANDROID | source | Native Android Gradle project and APK build pipeline. |
| R100 | `scripts/` | `apps/studio-android/scripts/` | ANDROID | source | Android release, update, and build scripts. |
| R100 | `src/store/useChordStore.ts` | `packages/studio-core/src/store/useChordStore.ts` | SHARED | source | Platform-neutral state logic. |
| R100 | `src/store/useDrumStore.ts` | `packages/studio-core/src/store/useDrumStore.ts` | SHARED | source | Platform-neutral state logic. |
| R100 | `src/lib/` | `packages/studio-core/src/lib/` | SHARED | source | Platform-neutral utility, sync, and updater APIs. |
| R100 | `src/hooks/` | `packages/studio-core/src/hooks/` | SHARED | source | Platform-neutral React hooks. |
| R100 | `src/data/` | `packages/studio-core/src/data/` | SHARED | source | Static chords and progression datasets. |
| R100 | `src/i18n/` | `packages/studio-core/src/i18n/` | SHARED | source | Localization JSON resources. |
| R100 | `src/vocalex/takesDb.ts` | `packages/studio-core/src/vocalex/takesDb.ts` | SHARED | source | Vocalex Dexie database schema. |
| R100 | `src/vocalex/labSessionDb.ts` | `packages/studio-core/src/vocalex/labSessionDb.ts` | SHARED | source | Vocalex Dexie database schema. |
| R100 | `src/vocalex/exerciseData.ts` | `packages/ui-shared/src/vocalex/exerciseData.ts` | SHARED | source | Shared vocal trainer UI data. |
| R100 | `src/vocalex/harmonyEngine.ts` | `packages/ui-shared/src/vocalex/harmonyEngine.ts` | SHARED | source | Shared vocal trainer audio helper. |
| R100 | `src/vocalex/pitchShift.ts` | `packages/ui-shared/src/vocalex/pitchShift.ts` | SHARED | source | Shared vocal trainer audio helper. |
| R100 | `src/vocalex/pitchYin.ts` | `packages/ui-shared/src/vocalex/pitchYin.ts` | SHARED | source | Shared vocal trainer audio helper. |
| R100 | `src/vocalex/practiceDetector.ts` | `packages/ui-shared/src/vocalex/practiceDetector.ts` | SHARED | source | Shared vocal trainer audio helper. |
| R100 | `src/vocalex/vocalAnalysis.ts` | `packages/ui-shared/src/vocalex/vocalAnalysis.ts` | SHARED | source | Shared vocal trainer audio helper. |
| R100 | `src/vocalex/vocalSynth.ts` | `packages/ui-shared/src/vocalex/vocalSynth.ts` | SHARED | source | Shared vocal trainer audio helper. |
| R100 | `src/vocalex/voiceCoach.ts` | `packages/ui-shared/src/vocalex/voiceCoach.ts` | SHARED | source | Shared vocal trainer audio helper. |
| R100 | `src/components/ui/` | `packages/ui-shared/src/components/ui/` | SHARED | source | Shared visual primitives. |
| R100 | `src/components/lottie/` | `packages/ui-shared/src/components/lottie/` | SHARED | source | Shared Lottie animations. |
| R100 | `src/components/animata/` | `packages/ui-shared/src/components/animata/` | SHARED | source | Shared micro-interaction components. |
| R100 | `src/landing/` | `packages/ui-web/src/landing/` | WEB | source | Public Web Landing Page assets. |
| R100 | `src/components/StudioSidebar.tsx` | `packages/ui-web/src/components/StudioSidebar.tsx` | WEB | source | Web desktop responsive sidebar navigation. |
| R100 | `src/components/WebSidebarLayout.tsx` | `packages/ui-web/src/components/WebSidebarLayout.tsx` | WEB | source | Web desktop responsive layout container. |
| R100 | `src/components/BottomNav.tsx` | `packages/ui-android/src/components/BottomNav.tsx` | ANDROID | source | Android native bottom tab bar. |
| R100 | `src/components/UpdateIndicator.tsx` | `packages/ui-android/src/components/UpdateIndicator.tsx` | ANDROID | source | Android in-app auto-update UI widget. |
| R100 | `src/components/StudioUpdateScreen.tsx` | `packages/ui-android/src/components/StudioUpdateScreen.tsx` | ANDROID | source | Android updater screen. |
| R100 | `src/components/UpdateDiagnosticsSheet.tsx` | `packages/ui-android/src/components/UpdateDiagnosticsSheet.tsx` | ANDROID | source | Android updater diagnostics sheet. |
| R100 | `firebase.json` | `firebase.json` | INFRASTRUCTURE | source | Unchanged deployment mapping template. |
| R100 | `.github/workflows/release.yml` | `.github/workflows/android-ci.yml`, `android-release.yml`, `web-ci.yml` | CI | source | Replaced generic CI file with target-specific pipelines. |
| D | `packages/ui-shared/firebase.config.json` | (None) | INFRASTRUCTURE | generated | Removed redundant copy, configuration resides in package files. |

## Verification Analysis

1. **Audio assets**: Verified successfully copied and accessible from both web/android public directories.
2. **Icons, SVGs, Fonts**: Mapped to neutral components and shared UI folder. No paths are broken.
3. **Capacitor configuration**: Configuration resides in `apps/studio-android/capacitor.config.ts` referencing `dist/android-web` directory output.
4. **Keystores & secrets**: Kept secure and not committed.

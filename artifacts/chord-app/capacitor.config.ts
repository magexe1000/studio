import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chordex.app',
  appName: 'Studio',
  webDir: 'dist/public',
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // ── Capgo over-the-air updater ────────────────────────────────────
    // We do NOT use Capgo's hosted auto-update channel — the
    // application controls when/where to download bundles via a
    // self-hosted version.json + zip. So:
    //   - autoUpdate: false           → never call Capgo's cloud API
    //   - directUpdate: false         → don't apply on app start; we
    //                                   download in foreground when the
    //                                   user taps "Reload" in the
    //                                   UpdateIndicator banner.
    //   - resetWhenUpdate: false      → keep the user's WebView state
    //                                   (storage, IndexedDB) across
    //                                   bundle swaps. The new bundle is
    //                                   only loaded on next app open.
    // notifyAppReady() is still required on every launch so the plugin
    // marks the active bundle as healthy and doesn't roll back.
    CapacitorUpdater: {
      autoUpdate: false,
      directUpdate: false,
      resetWhenUpdate: false,
    },
  },
};

export default config;

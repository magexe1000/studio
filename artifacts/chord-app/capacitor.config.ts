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
    // ── Capacitor Firebase Authentication ─────────────────────────────
    // Used on native (Android APK) for the Google sign-in path. The
    // Firebase JS SDK's `signInWithRedirect` is broken inside Capacitor
    // WebViews because the WebView's sessionStorage is partitioned
    // across the redirect to accounts.google.com — the JS SDK can't
    // read back the nonce it stored before redirecting and bails with
    // "missing initial state". The native plugin sidesteps the WebView
    // entirely (uses the platform Google Sign-In SDK), then bridges
    // the resulting credential into Firebase Auth.
    //
    //  - skipNativeAuth: false (default) — the plugin signs the JS
    //    SDK in for us via the credential, so onAuthStateChanged fires
    //    and the rest of the app reacts identically to the web flow.
    //  - providers: only Google for now; email/password still uses the
    //    JS SDK directly (works fine in WebViews because no redirect
    //    is involved).
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useChordStore, ACCENT_COLORS } from './store/useChordStore';
import type { AppKey } from './store/useChordStore';
import BottomNav from './components/BottomNav';
import SmartLoading from './components/SmartLoading';
import {
  StudioHubSkeleton,
  VocalexTakesSkeleton,
  GroovexAppSkeleton,
  StagexPanelSkeleton,
  DrumEditorSkeleton,
  ChordexPanelSkeleton,
  StudioSkeletonList,
} from './components/StudioSkeleton';
import { ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './components/ChordexLogo';
import { setNavHidden, setNavLocked, resetNav } from './lib/navScroll';
import { handleGlobalBack } from './lib/backStack';
import { useStatusBar } from './lib/useStatusBar';
import { AppEntryTransition } from './components/AppAnimationSystem';
// Lazy-load StudioHub — it's 1400+ lines and pulls in SettingControls,
// ApplyToSheet, ChangelogSheet, and all logo variants. Keeping it out of
// the main bundle saves significant parse+eval time on cold launch.
const StudioHub = lazy(() => import('./components/StudioHub'));

// Account state is intentionally typed inline so we don't pull
// `lib/accountStatus` (and its Firebase dependencies) into the main
// bundle just for a type. The full module is dynamic-imported below.
type AccountState =
  | { phase: 'unknown' }
  | { phase: 'signedOut' }
  | { phase: 'active'; user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } }
  | { phase: 'pending'; user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }; scheduledAtMs: number }
  | { phase: 'disabled'; user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } };

const stagexImport  = () => import('./components/StageCorePanel');
const libraryImport = () => import('./panels/LibraryPanel');
const chordImport   = () => import('./panels/ChordPanel');
const settingsImport = () => import('./panels/SettingsPanel');
const songsImport   = () => import('./panels/SongsPanel');
const drumImport    = () => import('./panels/DrumEditor');

const StagexPanel  = lazy(stagexImport);
const LibraryPanel = lazy(libraryImport);
const ChordPanel   = lazy(chordImport);
const SettingsPanel = lazy(settingsImport);
const SongsPanel   = lazy(songsImport);
const DrumEditor   = lazy(drumImport);

const groovexImport = () => import('./groovex/GroovexApp');
const GroovexApp = lazy(groovexImport);

const vocalexImport = () => import('./vocalex/VocalexApp');
const VocalexApp = lazy(vocalexImport);

// Lockdown screen is only ever rendered when the user has scheduled
// account deletion, which requires an active sign-in. Lazy so first
// paint never pays for it.
const PendingDeletionScreen = lazy(() => import('./components/PendingDeletionScreen'));
const DisabledAccountScreen = lazy(() => import('./components/DisabledAccountScreen'));

// Preload panel chunks during browser idle time so tab switches and
// app-mode transitions are instant.  We fire on the first available idle
// frame (no hard timeout) and run ALL critical chunks regardless of the
// startup app — Chordex tab panels are light enough that preloading all
// four adds negligible overhead while eliminating the visible stall on
// first visit to each section.
function schedulePreload(picks: Array<() => Promise<unknown>>) {
  const run = () => { for (const p of picks) { try { p(); } catch { /* noop */ } } };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run);
  } else {
    setTimeout(run, 200);
  }
}

// Ordered left-to-right (matches nav order) — used to compute slide direction
const NAV_ORDER = ['songs', 'library', 'chord', 'settings'] as const;
const ALL_PANELS = ['library', 'chord', 'songs', 'settings'] as const;

export default function App() {
  const { activePanel, settings, setActivePanel, activePresetId, updateSettings } = useChordStore();

  // Subscribe to combined auth + soft-delete status. While in `pending` we
  // overlay a lockdown screen with a countdown + Restore button.
  //
  // Defer the subscription itself until after first paint via idle
  // callback, then dynamic-import the account-status module. This keeps
  // the firebase-auth + firestore SDK out of the main bundle and out of
  // the critical path for users who never sign in.
  const [accountState, setAccountState] = useState<AccountState>({ phase: 'unknown' });
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;
    const start = () => {
      if (cancelled) return;
      import('./lib/accountStatus').then(({ subscribeAccountState }) => {
        if (cancelled) return;
        unsub = subscribeAccountState((s) => setAccountState(s as AccountState));
      }).catch(() => { /* firebase not configured / offline */ });
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(start, { timeout: 1500 });
    } else {
      setTimeout(start, 200);
    }
    return () => { cancelled = true; unsub?.(); };
  }, []);

  // Request startup permissions for notifications (required by OTA updates)
  useEffect(() => {
    const requestStartupPermissions = async () => {
      // Notification permission request
      try {
        if (typeof window !== 'undefined') {
          if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
          }
          // Native Capacitor notification permission request
          const { Capacitor } = await import('@capacitor/core');
          if (Capacitor.isNativePlatform()) {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            await LocalNotifications.requestPermissions();
          }
        }
      } catch (err) {
        console.warn('[Permissions] Notification permission request skipped or denied:', err);
      }
    };

    const timer = setTimeout(requestStartupPermissions, 3000);
    return () => clearTimeout(timer);
  }, []);


  // Whenever we leave the lockdown screen (e.g. user tapped Restore), force
  // the bottom nav back into a clean visible state. The lockdown screen
  // unmounts before the underlying panels remount, so without this reset
  // any stale `hidden` flag from a previous session would persist and the
  // user would land on the Hub without a visible nav bar.
  useEffect(() => {
    if (accountState.phase !== 'pending' && accountState.phase !== 'disabled') resetNav();
  }, [accountState.phase]);

  // Boot the cloud sync engine once. It listens for sign-in changes and
  // pushes/pulls Chordex/Drumex/StageX state. Also bridges localStorage
  // restores back into the in-memory zustand stores.
  //
  // Lazy-loaded after first paint so the Firebase SDK (firestore + auth,
  // ~150 KB minified) never lands in the main bundle. Until the engine
  // is attached, store changes are buffered into a tiny `pendingFlush`
  // flag and a single `requestFlush` call is fired right after attach.
  useEffect(() => {
    let cancelled = false;
    let unsubChord: (() => void) | null = null;
    let unsubDrum: (() => void) | null = null;
    let requestFlushFn: ((delayMs?: number) => void) | null = null;
    let pendingFlush = false;

    const flushIfReady = () => {
      if (requestFlushFn) requestFlushFn();
      else pendingFlush = true;
    };

    const onRehydrate = async (e: Event) => {
      const detail = (e as CustomEvent<{ key?: string }>).detail;
      try {
        if (detail?.key === 'chord-explorer-storage-v3') {
          await useChordStore.persist.rehydrate();
        } else if (detail?.key === 'chordex-drums') {
          const { useDrumStore } = await import('./store/useDrumStore');
          if (!cancelled) await useDrumStore.persist.rehydrate();
        }
      } catch { /* noop */ }
    };
    window.addEventListener('chordex:storage-rehydrate', onRehydrate as EventListener);

    // Subscribe to store changes immediately so no edits are lost while
    // we wait for the sync engine to load — they just get coalesced into
    // a single flush once it's ready.
    //
    // CRITICAL: only flush when the *persisted* slices change. Plain
    // `useChordStore.subscribe(fn)` fires on EVERY state change, including
    // transient UI state like `selectedChordId`, `activePanel`,
    // `multiSelectChords`, `isMultiChordMode`, `activePresetId` — none of
    // which are written to localStorage and none of which need to be
    // synced. Subscribing without a selector caused the cloud-sync
    // indicator to spin almost continuously while the user was just
    // browsing chords. We compare a hash of the persisted snapshot and
    // only flush on actual changes.
    let lastChordSig: string | null = null;
    unsubChord = useChordStore.subscribe((s) => {
      // Cheap signature: same fields as `partialize` in the store.
      const sig =
        (s.favorites?.length ?? 0) + '|' +
        (s.recentChords?.length ?? 0) + '|' +
        (s.progressions?.length ?? 0) + '|' +
        (s.currentProgressionChords?.length ?? 0) + '|' +
        (s.presets?.length ?? 0) + '|' +
        (s.customChords?.length ?? 0) + '|' +
        // settings + transpositions + chordUsage + lastSession can change
        // shape, so JSON-stringify them. They're small.
        JSON.stringify(s.settings) + '|' +
        JSON.stringify(s.transpositions) + '|' +
        JSON.stringify(s.chordUsage) + '|' +
        JSON.stringify(s.lastSession) + '|' +
        // Length-based for the array fields above is enough to catch
        // adds/removes; for content edits we re-hash favorites/progressions.
        JSON.stringify(s.favorites) + '|' +
        JSON.stringify(s.progressions) + '|' +
        JSON.stringify(s.presets) + '|' +
        JSON.stringify(s.customChords);
      if (sig === lastChordSig) return;
      lastChordSig = sig;
      flushIfReady();
    });
    void import('./store/useDrumStore').then(({ useDrumStore }) => {
      if (cancelled) return;
      let lastDrumSig: string | null = null;
      unsubDrum = useDrumStore.subscribe((s) => {
        // Drum store is smaller; full JSON snapshot is fine here.
        const sig = JSON.stringify(s);
        if (sig === lastDrumSig) return;
        lastDrumSig = sig;
        flushIfReady();
      });
    });

    const startSync = () => {
      if (cancelled) return;
      import('./lib/sync').then(({ attachSyncEngine, requestFlush }) => {
        if (cancelled) return;
        attachSyncEngine();
        requestFlushFn = requestFlush;
        if (pendingFlush) {
          pendingFlush = false;
          requestFlush();
        }
      }).catch(() => { /* firebase not configured / offline */ });
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(startSync, { timeout: 2500 });
    } else {
      setTimeout(startSync, 400);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('chordex:storage-rehydrate', onRehydrate as EventListener);
      unsubChord?.();
      unsubDrum?.();
    };
  }, []);

  // On first mount: restore the last session if we have one, otherwise
  // fall back to the user's `startupApp` preference (which itself defaults
  // to 'hub'). This satisfies "fallback to home if no data exists" without
  // forcing existing users who pinned a startup app to lose that pref on
  // their very first launch after the upgrade — `lastSession.app` is
  // seeded to 'hub' for fresh installs so the legacy behavior matches.
  useEffect(() => {
    const validApps: readonly AppKey[] = ['hub', 'chords', 'drums', 'stage', 'groovex', 'vocalex'] as const;

    // Check query params first for direct link deep-linking
    const queryPage = new URLSearchParams(window.location.search).get('page');
    if (queryPage === 'updater') {
      try {
        sessionStorage.setItem('studio:routeToUpdater', '1');
        const url = new URL(window.location.href);
        url.searchParams.delete('page');
        window.history.replaceState({}, '', url.toString());
      } catch { /* noop */ }
      
      prevAppMode.current = 'hub';
      updateSettings({ appMode: 'hub' });
      
      // Preload critical chunks
      schedulePreload([
        libraryImport, chordImport, songsImport, settingsImport, stagexImport,
      ]);
      return;
    }

    const queryApp = new URLSearchParams(window.location.search).get('app');
    const isQueryAppValid = queryApp && validApps.includes(queryApp as AppKey);
    if (isQueryAppValid) {
      const mode = queryApp as AppKey;
      prevAppMode.current = mode;
      updateSettings({ appMode: mode });
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('app');
        window.history.replaceState({}, '', url.toString());
      } catch { /* noop */ }
      
      // Schedule preloads
      const picks: Array<() => Promise<unknown>> = [
        libraryImport, chordImport, songsImport, settingsImport, stagexImport,
      ];
      if (mode === 'drums')   picks.push(drumImport);
      if (mode === 'groovex') picks.push(groovexImport);
      if (mode === 'vocalex') picks.push(vocalexImport);
      schedulePreload(picks);
      return;
    }

    const restoreEnabled = useChordStore.getState().settings.restoreLastSession;
    const saved = restoreEnabled ? useChordStore.getState().lastSession?.app : undefined;
    const restoredApp: AppKey | null = saved && validApps.includes(saved) ? saved : null;

    if (restoredApp) {
      prevAppMode.current = restoredApp;
      updateSettings({ appMode: restoredApp });
      // Sub-app screens (activePanel for chords, vocalexTab, stagexView,
      // drumexTab, groovex view+song) are already persisted by their own
      // stores / lastSession fields and re-applied where the components
      // mount, so we deliberately do NOT override them here.
      return;
    }

    const startApp = settings.startupApp ?? 'hub';
    if (startApp === 'drums') {
      prevAppMode.current = 'drums';
      updateSettings({ appMode: 'drums' });
    } else if (startApp === 'hub') {
      prevAppMode.current = 'hub';
      updateSettings({ appMode: 'hub' });
    } else if (startApp === 'groovex') {
      prevAppMode.current = 'groovex';
      updateSettings({ appMode: 'groovex' });
    } else if (startApp === 'stage') {
      prevAppMode.current = 'stage';
      updateSettings({ appMode: 'stage' });
    } else if (startApp === 'vocalex') {
      prevAppMode.current = 'vocalex';
      updateSettings({ appMode: 'vocalex' });
    } else {
      prevAppMode.current = 'chords';
      updateSettings({ appMode: 'chords' });
      const tab = settings.defaultTab ?? 'library';
      if (tab !== 'library') setActivePanel(tab);
    }

    // Always preload all four Chordex tab panels + Stagex so navigating
    // to any section from the hub is instant.  The four Chordex panels
    // together are the most-visited chunks in the app; Stagex is next.
    // Heavier app chunks (Drumex, Groovex, Vocalex) are only pre-warmed
    // when they are the startup or restored app.
    const targetApp: AppKey = (restoredApp ?? (startApp as AppKey));
    const picks: Array<() => Promise<unknown>> = [
      libraryImport, chordImport, songsImport, settingsImport, stagexImport,
    ];
    if (targetApp === 'drums')   picks.push(drumImport);
    if (targetApp === 'groovex') picks.push(groovexImport);
    if (targetApp === 'vocalex') picks.push(vocalexImport);
    schedulePreload(picks);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamic SEO & Metadata Syncer
  useEffect(() => {
    const mode = settings.appMode ?? 'hub';
    
    // Metadata dictionary
    const metaMap: Record<AppKey, { title: string; desc: string; keywords: string }> = {
      hub: {
        title: 'Studio by Mag — Organization, Rehearsal & Practice Tools',
        desc: 'StudioXX is the premium integrated toolkit for musicians, band managers, and live sound engineers. Manage chords, build drum sheets, create stage plots, practice vocals, and play multitracks.',
        keywords: 'musician tools, band management tools, studioxx, studio xx, studio by mag, mag studio, rehearsal tools, chord library app, stage plot app'
      },
      chords: {
        title: 'Chordex — Chord Library, Songs & Guitar Tools | Studio',
        desc: 'Explore guitar chords, search interactive chord diagrams, find fingerings, transpositions, and manage your band\'s song library in Chordex.',
        keywords: 'chord library app, guitar chord finder, musician tools, guitar chords, chord library'
      },
      drums: {
        title: 'Drumex — Drum Sheets & Practice Tools | Studio',
        desc: 'Build Snare drum sheets, practice rudiments with visual indicators, adjust timing and speed, and access interactive practice tools in Drumex.',
        keywords: 'drum sheets, snare rudiments, practice tools, drum practice, rhythm tools'
      },
      stage: {
        title: 'Stagex — Professional Stage Plot & Tech Rider Creator | Studio',
        desc: 'Create clear, professional stage plots and detailed technical riders for sound engineers. Add band members, speakers, instruments, and mic stands.',
        keywords: 'stage plot, stage plot maker, stage plot creator, stage plot app, tech rider creator, tech rider generator, stage manager tools, band stage plot'
      },
      groovex: {
        title: 'Groovex — Multitrack Practice & Rehearsal Studio | Studio',
        desc: 'Unleash your rehearsal with multitrack practice tools. Load tracks, adjust levels, mute stems, and loop sections with a gorgeous liquid glass UI.',
        keywords: 'multitrack practice app, rehearsal tools, multitrack player, band tools'
      },
      vocalex: {
        title: 'Vocalex — Vocal Practice & Training Studio | Studio',
        desc: 'Train your vocals, trace pitch in real-time, record takes, practice scales, and master your singing with feedback inside Vocalex.',
        keywords: 'vocal practice app, vocal training, pitch tracker, singing practice, musician tools'
      }
    };

    const metadata = metaMap[mode] || metaMap.hub;

    // 1. Update document title
    document.title = metadata.title;

    // 2. Helper to find/create meta tag
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const setPropertyMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // 3. Update description and keywords
    setMeta('description', metadata.desc);
    setMeta('keywords', metadata.keywords);

    // 4. Update canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    const canonicalBase = 'https://MAGEXE1000.github.io/Studio';
    const relativePath = mode === 'hub' ? '/' : `/${mode}/`;
    canonical.setAttribute('href', `${canonicalBase}${relativePath}`);

    // 5. Update Open Graph and Twitter Card tags
    setPropertyMeta('og:title', metadata.title);
    setPropertyMeta('og:description', metadata.desc);
    setPropertyMeta('og:url', `${canonicalBase}${relativePath}`);
    setPropertyMeta('og:type', 'website');
    setPropertyMeta('og:image', 'https://MAGEXE1000.github.io/Studio/opengraph.jpg');

    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', metadata.title);
    setMeta('twitter:description', metadata.desc);
    setMeta('twitter:image', 'https://MAGEXE1000.github.io/Studio/opengraph.jpg');

    // 6. JSON-LD Structured Data
    let jsonLdEl = document.getElementById('studio-structured-data');
    if (!jsonLdEl) {
      jsonLdEl = document.createElement('script');
      jsonLdEl.setAttribute('id', 'studio-structured-data');
      jsonLdEl.setAttribute('type', 'application/ld+json');
      document.head.appendChild(jsonLdEl);
    }

    const structuredData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://MAGEXE1000.github.io/Studio/#organization',
          'name': 'Mag Studio',
          'url': 'https://MAGEXE1000.github.io/Studio/',
          'logo': 'https://MAGEXE1000.github.io/Studio/icon-512.png',
          'sameAs': [
            'https://github.com/MAGEXE1000/Studio'
          ]
        },
        {
          '@type': 'WebApplication',
          '@id': `https://MAGEXE1000.github.io/Studio/#webapp-${mode}`,
          'url': `${canonicalBase}${relativePath}`,
          'name': metadata.title.split(' | ')[0],
          'applicationCategory': 'MultimediaApplication',
          'operatingSystem': 'Any',
          'description': metadata.desc,
          'browserRequirements': 'Requires JavaScript and HTML5 canvas.',
          'publisher': {
            '@id': 'https://MAGEXE1000.github.io/Studio/#organization'
          }
        }
      ]
    };

    jsonLdEl.textContent = JSON.stringify(structuredData, null, 2);
  }, [settings.appMode]);

  // ── Push Notification Deep-Link Receiver ──────────────────────────────────
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ROUTE_UPDATE') {
        sessionStorage.setItem('studio:routeToUpdater', '1');
        updateSettings({ appMode: 'hub' });
        window.dispatchEvent(new CustomEvent('studio:route-to-updater'));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [updateSettings]);

  // ── Global back navigation ────────────────────────────────────────────────
  const [exitToast, setExitToast] = useState(false);
  const lastBackTime = useRef(0);
  const exitToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Seed two history entries so every back gesture fires popstate
    // without immediately leaving the page.
    window.history.replaceState({ chordex: 'root' }, '');
    window.history.pushState({ chordex: 'app' }, '');

    const onBack = () => {
      const handled = handleGlobalBack();

      if (!handled) {
        const now = Date.now();
        if (now - lastBackTime.current < 2000) {
          // Second press within 2 s → exit / minimize
          import('@capacitor/app')
            .then(({ App: CapApp }) => CapApp.exitApp())
            .catch(() => {});
        } else {
          lastBackTime.current = now;
          setExitToast(true);
          if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
          exitToastTimer.current = setTimeout(() => setExitToast(false), 2000);
        }
      }

      // Always re-push for the web popstate fallback so the stack stays alive.
      window.history.pushState({ chordex: 'app' }, '');
    };

    // Web: popstate fires when browser / WebView pops history
    const handlePop = () => onBack();
    window.addEventListener('popstate', handlePop);

    // Native Android: Capacitor's backButton is the authoritative event
    let capRemove: (() => void) | null = null;
    import('@capacitor/app')
      .then(({ App: CapApp }) => {
        CapApp.addListener('backButton', onBack).then((handle) => {
          capRemove = () => handle.remove();
        });
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('popstate', handlePop);
      capRemove?.();
      if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
    };
  }, []);



  // ── Hub-return exit animation ────────────────────────────────────────────
  const [exitingToHub, setExitingToHub] = useState(false);
  useEffect(() => {
    const handler = () => {
      setExitingToHub(true);
      setTimeout(() => { updateSettings({ appMode: 'hub' }); setExitingToHub(false); }, 370);
    };
    window.addEventListener('studio-hub-return', handler);
    return () => window.removeEventListener('studio-hub-return', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── App-switch splash on mode change ────────────────────────────────────
  type SplashPhase = 'hidden' | 'in' | 'out';
  const [drumSplash,    setDrumSplash]    = useState<SplashPhase>('hidden');
  const [chordexSplash, setChordexSplash] = useState<SplashPhase>('hidden');
  const [stageSplash,   setStageSplash]   = useState<SplashPhase>('hidden');
  const [groovexSplash, setGroovexSplash] = useState<SplashPhase>('hidden');
  const [vocalexSplash, setVocalexSplash] = useState<SplashPhase>('hidden');
  const prevAppMode      = useRef(settings.appMode);
  const splashTimers     = useRef<ReturnType<typeof setTimeout>[]>([]);

  const fireSplash = (set: (p: SplashPhase) => void) => {
    splashTimers.current.forEach(clearTimeout);
    splashTimers.current = [];
    set('in');
    const t1 = setTimeout(() => set('out'),    750);
    const t2 = setTimeout(() => set('hidden'), 1100);
    splashTimers.current = [t1, t2];
  };

  useEffect(() => {
    if (settings.appMode === 'drums'   && prevAppMode.current !== 'drums')   fireSplash(setDrumSplash);
    if (settings.appMode === 'chords'  && prevAppMode.current !== 'chords')  fireSplash(setChordexSplash);
    if (settings.appMode === 'stage'   && prevAppMode.current !== 'stage')   fireSplash(setStageSplash);
    if (settings.appMode === 'groovex' && prevAppMode.current !== 'groovex') fireSplash(setGroovexSplash);
    if (settings.appMode === 'vocalex' && prevAppMode.current !== 'vocalex') fireSplash(setVocalexSplash);
    // Always show the nav when switching apps — non-scrollable sections (e.g. Stage)
    // have no way to scroll up to reveal it, so we reset visibility on every mode change.
    // Reset both hidden and collapsed on every app-mode switch.
    // setNavHidden(false) alone left the nav in a collapsed-pill state if the
    // user had scrolled down in the previous app before switching.
    if (prevAppMode.current !== settings.appMode) resetNav();
    prevAppMode.current = settings.appMode;
    return () => splashTimers.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.appMode]);

  // Which panel is fully visible (the "live" one)
  const [visiblePanel, setVisiblePanel] = useState(activePanel);
  // Which panel is animating out
  const [exitingPanel, setExitingPanel] = useState<string | null>(null);
  // Direction: 'right' = entering panel comes from the right
  const [slideDir, setSlideDir] = useState<'right' | 'left'>('right');

  const prevPanel  = useRef(activePanel);

  // Derive per-app visual settings, with a safe fallback for old persisted data
  const appKey   = (settings.appMode ?? 'hub') as AppKey;
  const perAppRaw = settings.perApp;
  const activeVis = perAppRaw?.[appKey] ?? {
    theme:       settings.theme       ?? 'dark',
    accentColor: settings.accentColor ?? 'blue',
    amoledMode:  settings.amoledMode  ?? false,
  };
  const accent = ACCENT_COLORS[activeVis.accentColor] ?? ACCENT_COLORS.blue;

  // Show/hide the nav based on panel and preset state.
  // Hidden (and locked so scroll can't override) only when inside the preset editor.
  useEffect(() => {
    const inPreset = !!(activePresetId && activePanel === 'songs');
    setNavLocked(inPreset);
    setNavHidden(inPreset);
  }, [activePresetId, activePanel]);

  // Apply CSS vars for accent color (re-runs when appMode or per-app accent changes)
  // Wrap in the same theme-transitioning class so every element cross-fades to the
  // new accent at the same time (matches the dark/light switch animation).
  const prevAccentRef = useRef({ from: accent.from, to: accent.to, mid: accent.mid });
  const accentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    const prev = prevAccentRef.current;
    const changed =
      prev.from !== accent.from || prev.to !== accent.to || prev.mid !== accent.mid;
    prevAccentRef.current = { from: accent.from, to: accent.to, mid: accent.mid };

    if (accentTimerRef.current) {
      clearTimeout(accentTimerRef.current);
      accentTimerRef.current = null;
    }

    const apply = () => {
      if (changed) root.classList.add('theme-transitioning');
      root.style.setProperty('--accent-from', accent.from);
      root.style.setProperty('--accent-to',   accent.to);
      root.style.setProperty('--accent-mid',  accent.mid);
      if (changed) {
        accentTimerRef.current = setTimeout(() => {
          root.classList.remove('theme-transitioning');
          accentTimerRef.current = null;
        }, 350);
      }
    };

    apply();
  }, [accent.from, accent.to, accent.mid]);

  // Theme + AMOLED mode — wrapped in View Transitions API for smooth crossfade
  const prevThemeRef = useRef({ theme: activeVis.theme, amoled: activeVis.amoledMode });
  const themeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const prev = prevThemeRef.current;
    const changed = prev.theme !== activeVis.theme || prev.amoled !== activeVis.amoledMode;
    prevThemeRef.current = { theme: activeVis.theme, amoled: activeVis.amoledMode };

    if (themeTimerRef.current) {
      clearTimeout(themeTimerRef.current);
      themeTimerRef.current = null;
    }

    const applyTheme = (skipTransitioningClass = false) => {
      const root = document.documentElement;

      if (!skipTransitioningClass) {
        root.classList.add('theme-transitioning');
      }

      activeVis.amoledMode ? root.classList.add('amoled') : root.classList.remove('amoled');

      const h = new Date().getHours();
      const lightStart = settings.dynamicLightStart ?? 7;
      const lightEnd   = settings.dynamicLightEnd   ?? 20;
      const isDaytime  = h >= lightStart && h < lightEnd;

      root.classList.remove('light', 'theme-system');
      if (activeVis.theme === 'light') root.classList.add('light');
      else if (activeVis.theme === 'system') root.classList.add('theme-system');
      else if (activeVis.theme === 'dynamic' && isDaytime) root.classList.add('light');

      const isLight = activeVis.theme === 'light' ||
        (activeVis.theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) ||
        (activeVis.theme === 'dynamic' && isDaytime);
      const color = activeVis.amoledMode ? (isLight ? '#ffffff' : '#000000') : (isLight ? '#f5f5f5' : '#111116');
      let tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'theme-color';
        document.head.appendChild(tag);
      }
      tag.content = color;

      if (!skipTransitioningClass) {
        themeTimerRef.current = setTimeout(() => {
          root.classList.remove('theme-transitioning');
          themeTimerRef.current = null;
        }, 350);
      }
    };

    if (changed && 'startViewTransition' in document) {
      const root = document.documentElement;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reduceMotion) {
        try {
          (document as any).startViewTransition(() => {
            flushSync(() => applyTheme(true));
          });
        } catch {
          applyTheme();
        }
      } else {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cx = vw / 2;
        const cy = vh / 2;
        const maxR = Math.hypot(cx, cy);

        root.style.setProperty('--x', `${cx}px`);
        root.style.setProperty('--y', `${cy}px`);
        root.style.setProperty('--r', `${maxR}px`);
        root.style.setProperty('--studio-theme-vt-duration', '500ms');
        root.dataset.studioThemeVt = 'active';

        const cleanup = () => {
          delete root.dataset.studioThemeVt;
          root.style.removeProperty('--x');
          root.style.removeProperty('--y');
          root.style.removeProperty('--r');
          root.style.removeProperty('--studio-theme-vt-duration');
        };

        try {
          const transition = (document as any).startViewTransition(() => {
            flushSync(() => applyTheme(true));
          });

          if (transition && typeof transition.finished?.finally === 'function') {
            transition.finished.finally(cleanup);
          } else {
            setTimeout(cleanup, 500);
          }
        } catch {
          cleanup();
          applyTheme();
        }
      }
    } else {
      applyTheme();
    }
  }, [activeVis.theme, activeVis.amoledMode, settings.dynamicLightStart, settings.dynamicLightEnd]);

  // Re-apply dynamic theme every minute so it flips at the configured times
  useEffect(() => {
    if (activeVis.theme !== 'dynamic') return;
    const id = setInterval(() => {
      const s = useChordStore.getState().settings;
      const h = new Date().getHours();
      const isDaytime = h >= (s.dynamicLightStart ?? 7) && h < (s.dynamicLightEnd ?? 20);
      const root = document.documentElement;
      root.classList.remove('light');
      if (isDaytime) root.classList.add('light');
    }, 60_000);
    return () => clearInterval(id);
  }, [activeVis.theme]);

  // Keep the native Android status bar in sync with the active theme
  useStatusBar(activeVis.theme, activeVis.amoledMode);

  // Animation speed → root data-attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-anim', settings.animationSpeed);
  }, [settings.animationSpeed]);

  // Performance mode → root attribute (used by CSS to disable blur, heavy
  // shadows, non-essential animations across all apps).
  useEffect(() => {
    const root = document.documentElement;
    if (settings.performanceMode) root.setAttribute('data-perf-mode', 'on');
    else root.removeAttribute('data-perf-mode');
  }, [settings.performanceMode]);

  // Low latency mode → drum scheduler tick budget. Other audio engines pick
  // up the latencyHint at AudioContext creation time via createAudioContext().
  useEffect(() => {
    let cancelled = false;
    import('./lib/drumAudio').then(({ drumScheduler }) => {
      if (!cancelled) drumScheduler.setLowLatency(settings.lowLatencyMode);
    }).catch(() => { /* drum module not loaded yet */ });
    return () => { cancelled = true; };
  }, [settings.lowLatencyMode]);

  // High refresh rate (90/120Hz) — keeps the compositor in high-frequency mode
  // by running a continuous rAF tick. Many mobile browsers (Android Chrome
  // especially) drop to 60Hz when the page is "idle" — this prevents that.
  useEffect(() => {
    const root = document.documentElement;
    if (!settings.highRefreshRate) {
      root.removeAttribute('data-hifps');
      return;
    }
    root.setAttribute('data-hifps', 'on');
    let rafId = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      root.removeAttribute('data-hifps');
    };
  }, [settings.highRefreshRate]);

  // Font size
  useEffect(() => {
    const root = document.documentElement;
    const sizes = {
      small:  { base: '13px', sm: '11px', xs: '9px',  lg: '16px', xl: '20px', hero: '2.2rem' },
      medium: { base: '14px', sm: '12px', xs: '10px', lg: '18px', xl: '24px', hero: '2.8rem' },
      large:  { base: '16px', sm: '13px', xs: '11px', lg: '20px', xl: '26px', hero: '3.2rem' },
    };
    const s = sizes[settings.fontSize];
    root.style.setProperty('--font-base', s.base);
    root.style.setProperty('--font-sm',   s.sm);
    root.style.setProperty('--font-xs',   s.xs);
    root.style.setProperty('--font-lg',   s.lg);
    root.style.setProperty('--font-xl',   s.xl);
    root.style.setProperty('--font-hero', s.hero);
  }, [settings.fontSize]);

  // Display density
  useEffect(() => {
    const root = document.documentElement;
    const d = {
      compact:     { pad: '10px', rowPad: '10px 20px', gap: '8px',  cardGap: '6px'  },
      comfortable: { pad: '16px', rowPad: '14px 20px', gap: '12px', cardGap: '10px' },
      spacious:    { pad: '22px', rowPad: '20px 24px', gap: '18px', cardGap: '16px' },
    }[settings.displayDensity];
    root.style.setProperty('--density-pad',      d.pad);
    root.style.setProperty('--density-row-pad',  d.rowPad);
    root.style.setProperty('--density-gap',      d.gap);
    root.style.setProperty('--density-card-gap', d.cardGap);
  }, [settings.displayDensity]);

  // Panel transition with slide direction
  const durMs = settings.animationSpeed === 'fast' ? 200 : settings.animationSpeed === 'reduced' ? 0 : 280;

  useEffect(() => {
    if (activePanel === prevPanel.current) return;

    const prevIdx = NAV_ORDER.indexOf(prevPanel.current as typeof NAV_ORDER[number]);
    const nextIdx = NAV_ORDER.indexOf(activePanel as typeof NAV_ORDER[number]);
    const dir: 'right' | 'left' = nextIdx >= prevIdx ? 'right' : 'left';

    setSlideDir(dir);
    setExitingPanel(prevPanel.current);
    setVisiblePanel(activePanel);
    prevPanel.current = activePanel;

    const t = setTimeout(() => setExitingPanel(null), durMs + 20);
    return () => clearTimeout(t);
  }, [activePanel, durMs]);

  const renderExitToast = () => {
    const isLight = activeVis.theme === 'light' ||
      (activeVis.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) ||
      (activeVis.theme === 'dynamic' && (() => {
        const h = new Date().getHours();
        const lightStart = settings.dynamicLightStart ?? 7;
        const lightEnd   = settings.dynamicLightEnd   ?? 20;
        return h >= lightStart && h < lightEnd;
      })());

    return createPortal(
      <div
        id="exit-toast"
        style={{
          position: 'fixed',
          bottom: 'max(28px, calc(env(safe-area-inset-bottom) + 88px))',
          left: '50%',
          transform: 'translateX(-50%)',
          background: isLight ? 'rgba(255, 255, 255, 0.90)' : 'rgba(24,24,32,0.93)',
          color: isLight ? '#1a1a1a' : 'var(--c-text-primary)',
          padding: '10px 22px',
          borderRadius: '24px',
          fontSize: '13px',
          fontFamily: 'Inter, sans-serif',
          zIndex: 99999,
          pointerEvents: 'none',
          backdropFilter: 'blur(12px)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.08)' : '0 8px 24px rgba(0,0,0,0.30)',
          whiteSpace: 'nowrap',
        }}
      >
        Press back or swipe again to exit
      </div>,
      document.body
    );
  };

  // ── Account scheduled for deletion: lockdown overlay ───────────────────
  if (accountState.phase === 'pending') {
    return (
      <>
        <div className="app-main-layout" style={{ height: '100dvh', overflow: 'hidden' }}>
          <Suspense fallback={<SmartLoading fallbackSkeleton={<StudioSkeletonList count={3} />} />}>
            <PendingDeletionScreen
              phase="pending"
              user={accountState.user}
              scheduledAtMs={accountState.scheduledAtMs}
            />
          </Suspense>
        </div>
        {exitToast && renderExitToast()}
      </>
    );
  }

  // ── Account disabled ─────────────────────────────────────────────────────
  if (accountState.phase === 'disabled') {
    return (
      <>
        <div className="app-main-layout" style={{ height: '100dvh', overflow: 'hidden' }}>
          <Suspense fallback={<SmartLoading fallbackSkeleton={<StudioSkeletonList count={3} />} />}>
            <DisabledAccountScreen user={accountState.user} />
          </Suspense>
        </div>
        {exitToast && renderExitToast()}
      </>
    );
  }

  // ── Hub mode: show the Studio Hub ────────────────────────────────────────
  if (settings.appMode === 'hub') {
    return (
      <>
        <div className="app-main-layout" style={{ animation: 'hub-return-enter 380ms cubic-bezier(0.0, 0.0, 0.2, 1) both', height: '100dvh', overflow: 'hidden', position: 'relative' }}>
          <Suspense fallback={<SmartLoading fallbackSkeleton={<StudioHubSkeleton />} />}>
            <StudioHub />
          </Suspense>
        </div>
        {exitToast && renderExitToast()}
      </>
    );
  }

  // ── Groovex mode: multitrack practice mixer ─────────────────────────
  if (settings.appMode === 'groovex') {
    const groovexIsAmoled = activeVis.amoledMode;
    const groovexIsLight  = activeVis.theme === 'light';
    const groovexBgColor  = groovexIsAmoled ? '#000000' : groovexIsLight ? '#f2f1ef' : '#0e0e0e';
    return (
      <>
        <div className="app-main-layout" style={{
          position: 'relative', height: '100dvh', overflow: 'hidden',
          background: groovexBgColor,
          transform: exitingToHub ? 'scale(1.10)' : undefined,
          opacity:   exitingToHub ? 0 : undefined,
          transition: exitingToHub ? 'transform 370ms cubic-bezier(0.4,0,1,1), opacity 270ms ease-in' : undefined,
        }}>
          <Suspense fallback={<SmartLoading fallbackSkeleton={<GroovexAppSkeleton />} />}><AppEntryTransition><GroovexApp /></AppEntryTransition></Suspense>

          {groovexSplash !== 'hidden' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 500,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: groovexBgColor,
              opacity:   groovexSplash === 'out' ? 0 : 1,
              transform: groovexSplash === 'out' ? 'scale(1.05)' : 'scale(1)',
              transition: 'opacity 330ms cubic-bezier(0.4,0,0.2,1), transform 330ms cubic-bezier(0.4,0,0.2,1)',
              pointerEvents: 'none',
            }}>
              <div style={{ color: groovexIsLight ? '#1a1a1a' : '#ffffff', animation: 'splash-logo-in 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <GroovexLogo size={60} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 14, animation: 'splash-wordmark-in 380ms 80ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <p style={{ color: groovexIsLight ? '#1a1a1a' : '#ffffff', fontSize: 22, fontWeight: 800, fontFamily: 'Manrope, sans-serif', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Groovex</p>
                <p style={{ color: groovexIsLight ? '#6b6b6b' : 'rgba(255,255,255,0.45)', fontSize: 12, fontFamily: 'Manrope, sans-serif', margin: 0 }}>Multitrack practice mixer</p>
              </div>
            </div>
          )}
        </div>
        {exitToast && renderExitToast()}
      </>
    );
  }

  // ── Vocalex mode: vocal tools & training ─────────────────────────
  if (settings.appMode === 'vocalex') {
    const vocalexIsAmoled = activeVis.amoledMode;
    const vocalexIsLight  = activeVis.theme === 'light';
    const vocalexBgColor  = vocalexIsAmoled ? '#000000' : vocalexIsLight ? '#f2f1ef' : '#0e0e0e';
    return (
      <>
        <div className="app-main-layout" style={{
          position: 'relative', height: '100dvh', overflow: 'hidden',
          background: vocalexBgColor,
          transform: exitingToHub ? 'scale(1.10)' : undefined,
          opacity:   exitingToHub ? 0 : undefined,
          transition: exitingToHub ? 'transform 370ms cubic-bezier(0.4,0,1,1), opacity 270ms ease-in' : undefined,
        }}>
          <Suspense fallback={<SmartLoading fallbackSkeleton={<VocalexTakesSkeleton />} />}><AppEntryTransition><VocalexApp /></AppEntryTransition></Suspense>

          {vocalexSplash !== 'hidden' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 500,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: vocalexBgColor,
              opacity:   vocalexSplash === 'out' ? 0 : 1,
              transform: vocalexSplash === 'out' ? 'scale(1.05)' : 'scale(1)',
              transition: 'opacity 330ms cubic-bezier(0.4,0,0.2,15), transform 330ms cubic-bezier(0.4,0,0.2,1)',
              pointerEvents: 'none',
            }}>
              <div style={{ color: vocalexIsLight ? '#1a1a1a' : '#ffffff', animation: 'splash-logo-in 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <VocalexLogo size={60} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 14, animation: 'splash-wordmark-in 380ms 80ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <p style={{ color: vocalexIsLight ? '#1a1a1a' : '#ffffff', fontSize: 22, fontWeight: 800, fontFamily: 'Manrope, sans-serif', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Vocalex</p>
                <p style={{ color: vocalexIsLight ? '#6b6b6b' : 'rgba(255,255,255,0.45)', fontSize: 12, fontFamily: 'Manrope, sans-serif', margin: 0 }}>Vocal tools & training</p>
              </div>
            </div>
          )}
        </div>
        {exitToast && renderExitToast()}
      </>
    );
  }

  // ── Stagex mode: full-screen iframe wrapper ─────────────────────────
  if (settings.appMode === 'stage') {
    const stageIsAmoled = activeVis.amoledMode;
    const stageIsLight  = activeVis.theme === 'light';
    const stageBgColor  = stageIsAmoled ? '#000000' : stageIsLight ? '#f2f1ef' : '#0e0e0e';
    return (
      <>
        <div className="app-main-layout" style={{
          position: 'relative', height: '100dvh', overflow: 'hidden',
          background: stageBgColor,
          transform: exitingToHub ? 'scale(1.10)' : undefined,
          opacity:   exitingToHub ? 0 : undefined,
          transition: exitingToHub ? 'transform 370ms cubic-bezier(0.4,0,1,1), opacity 270ms ease-in' : undefined,
        }}>
          <Suspense fallback={<SmartLoading fallbackSkeleton={<StagexPanelSkeleton />} />}><AppEntryTransition><StagexPanel /></AppEntryTransition></Suspense>

          {/* Stagex splash — shown when entering from hub */}
          {stageSplash !== 'hidden' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 500,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: stageBgColor,
              opacity:   stageSplash === 'out' ? 0 : 1,
              transform: stageSplash === 'out' ? 'scale(1.05)' : 'scale(1)',
              transition: 'opacity 330ms cubic-bezier(0.4,0,0.2,1), transform 330ms cubic-bezier(0.4,0,0.2,1)',
              pointerEvents: 'none',
            }}>
              <div style={{ color: stageIsLight ? '#1a1a1a' : '#ffffff', animation: 'splash-logo-in 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <StagexLogoIcon size={60} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 14, animation: 'splash-wordmark-in 380ms 80ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <p style={{ color: stageIsLight ? '#1a1a1a' : '#ffffff', fontSize: 22, fontWeight: 800, fontFamily: 'Manrope, sans-serif', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Stagex</p>
                <p style={{ color: stageIsLight ? '#6b6b6b' : 'rgba(255,255,255,0.45)', fontSize: 12, fontFamily: 'Manrope, sans-serif', margin: 0 }}>Stage plot & tech rider</p>
              </div>
            </div>
          )}
        </div>
        {exitToast && renderExitToast()}
      </>
    );
  }

  // ── Drums mode: completely separate environment ──────────────────────────
  if (settings.appMode === 'drums') {
    return (
      <>
        <div className="app-main-layout" style={{
          position: 'relative', height: '100dvh', overflow: 'hidden',
          transform: exitingToHub ? 'scale(1.10)' : undefined,
          opacity:   exitingToHub ? 0 : undefined,
          transition: exitingToHub ? 'transform 370ms cubic-bezier(0.4,0,1,1), opacity 270ms ease-in' : undefined,
        }}>
          <Suspense fallback={<SmartLoading fallbackSkeleton={<DrumEditorSkeleton />} />}><AppEntryTransition><DrumEditor /></AppEntryTransition></Suspense>

          {/* Drumex splash — shown when switching from Chordex */}
          {drumSplash !== 'hidden' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 500,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--app-bg)',
              opacity:   drumSplash === 'out' ? 0 : 1,
              transform: drumSplash === 'out' ? 'scale(1.05)' : 'scale(1)',
              transition: 'opacity 330ms cubic-bezier(0.4,0,0.2,1), transform 330ms cubic-bezier(0.4,0,0.2,1)',
              pointerEvents: 'none',
            }}>
              <div style={{ color: 'var(--c-text-primary)', animation: 'splash-logo-in 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <DrumexLogo size={60} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 14, animation: 'splash-wordmark-in 380ms 80ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
                <p style={{ color: 'var(--c-text-primary)', fontSize: 22, fontWeight: 800, fontFamily: 'Manrope, sans-serif', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Drumex</p>
                <p style={{ color: 'var(--c-text-secondary)', fontSize: 12, fontFamily: 'Manrope, sans-serif', margin: 0 }}>Drum sheet editor</p>
              </div>
            </div>
          )}
        </div>
        {exitToast && renderExitToast()}
      </>
    );
  }

  return (
    <>
      <AppEntryTransition
        className="flex flex-col w-full overflow-hidden select-none app-bg app-main-layout"
        style={{
          position: 'relative',
          height: '100dvh',
          paddingTop: 'env(safe-area-inset-top)',
          '--panel-dur':      `${durMs}ms`,
          '--panel-exit-dur': `${Math.round(durMs * 0.65)}ms`,
          transform: exitingToHub ? 'scale(1.10)' : undefined,
          opacity:   exitingToHub ? 0 : undefined,
          transition: exitingToHub ? 'transform 370ms cubic-bezier(0.4,0,1,1), opacity 270ms ease-in' : undefined,
        } as React.CSSProperties}
      >
        {/* Panel container — mount only the active panel instantly */}
        <div className="flex-1 overflow-hidden relative" style={{ contain: 'strict' }}>
          {ALL_PANELS.map(panel => {
            const isVisible = activePanel === panel;
            if (!isVisible) return null;

            return (
              <div
                key={panel}
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'auto',
                  contain: 'layout style paint',
                }}
              >
                <Suspense fallback={<SmartLoading fallbackSkeleton={<ChordexPanelSkeleton />} />}>
                  {panel === 'library'  && <LibraryPanel />}
                  {panel === 'chord'    && <ChordPanel />}
                  {panel === 'songs'    && <SongsPanel />}
                  {panel === 'settings' && <SettingsPanel />}
                </Suspense>
              </div>
            );
          })}
        </div>

        <BottomNav />

        {/* Chordex splash — shown when switching back from Drumex */}
        {chordexSplash !== 'hidden' && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--app-bg)',
            opacity:   chordexSplash === 'out' ? 0 : 1,
            transform: chordexSplash === 'out' ? 'scale(1.05)' : 'scale(1)',
            transition: 'opacity 330ms cubic-bezier(0.4,0,0.2,1), transform 330ms cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: 'none',
          }}>
            <div style={{ color: 'var(--c-text-primary)', animation: 'splash-logo-in 420ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <ChordexLogo size={60} />
            </div>
            <div style={{ textAlign: 'center', marginTop: 14, animation: 'splash-wordmark-in 380ms 80ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <p style={{ color: 'var(--c-text-primary)', fontSize: 22, fontWeight: 800, fontFamily: 'Manrope, sans-serif', margin: '0 0 4px', letterSpacing: '-0.01em' }}>Chordex</p>
              <p style={{ color: 'var(--c-text-secondary)', fontSize: 12, fontFamily: 'Manrope, sans-serif', margin: 0 }}>Chord library & songs</p>
            </div>
          </div>
        )}

      </AppEntryTransition>
      {exitToast && renderExitToast()}
    </>
  );
}

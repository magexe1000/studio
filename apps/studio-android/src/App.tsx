import { type AppKey } from '@workspace/studio-core';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  useChordStore,
  ACCENT_COLORS,
  useIsWebDesktop,
  useStudioPreferences,
  logActivity,
  resetNav,
  setNavHidden,
  setNavLocked,
  handleGlobalBack,
  useStatusBar,
  recordNavigation
} from '@workspace/studio-core';

import {
  SmartLoading,
  StudioHubSkeleton,
  VocalexTakesSkeleton,
  GroovexAppSkeleton,
  StagexPanelSkeleton,
  DrumEditorSkeleton,
  ChordexPanelSkeleton,
  ChordexLogo,
  DrumexLogo,
  StagexLogoIcon,
  GroovexLogo,
  VocalexLogo,
  AppEntryTransition,
  LibraryPanel,
  ChordPanel,
  SettingsPanel,
  SongsPanel,
  DrumEditor,
  GroovexApp,
  VocalexApp,
  ErrorBoundary
} from '@workspace/ui-shared';

import { BottomNav, StageCorePanel } from '@workspace/ui-android';
import { Capacitor } from '@capacitor/core';

import "./index.css";

const StudioHub = lazy(() => import('@workspace/ui-shared').then(m => ({ default: m.StudioHub })));

type AccountState =
  | { phase: 'unknown' }
  | { phase: 'signedOut' }
  | { phase: 'active'; user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } }
  | { phase: 'pending'; user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }; scheduledAtMs: number }
  | { phase: 'disabled'; user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } };

const ALL_PANELS = ['library', 'chord', 'songs', 'settings'] as const;

export default function App() {
  const { activePanel, settings, setActivePanel, activePresetId, updateSettings } = useChordStore();
  const { preferences } = useStudioPreferences();

  // Cold Start App Restore Bug: Reset appMode to settings.startupApp || 'hub' if restoreLastSession is false
  useEffect(() => {
    const s = useChordStore.getState().settings;
    if (!s.restoreLastSession) {
      const defaultApp = s.startupApp || 'hub';
      console.log(`[Startup] restoreLastSession is false. Resetting appMode to ${defaultApp}.`);
      useChordStore.getState().updateSettings({ appMode: defaultApp });
    }
  }, []);

  // Record initial app launch diagnostic event
  useEffect(() => {
    const active = useChordStore.getState().settings.appMode || 'hub';
    recordNavigation({
      fromApp: 'none',
      toApp: active,
      hubMounted: true,
      activeAppAfterTransition: active,
      transitionLockState: false,
      fallbackRendered: false
    });
  }, []);

  const [exitToast, setExitToast] = useState(false);
  const exitToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBackTime = useRef<number>(0);

  const [transitionActive, setTransitionActive] = useState(false);

  // Synchronize transitionActive with window.studioTransitionActive
  useEffect(() => {
    try {
      Object.defineProperty(window, 'studioTransitionActive', {
        get() {
          return transitionActive;
        },
        set(val) {
          setTransitionActive(!!val);
        },
        configurable: true
      });
    } catch (e) {
      console.warn('Failed to defineProperty studioTransitionActive', e);
      (window as any).studioTransitionActive = transitionActive;
    }
    return () => {
      try {
        delete (window as any).studioTransitionActive;
      } catch (e) {}
    };
  }, [transitionActive]);

  // 1.2-second safety watchdog for transitionActive
  useEffect(() => {
    let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
    if (transitionActive) {
      watchdogTimer = setTimeout(() => {
        console.warn('[Safety] transitionActive watchdog triggered! Forcing reset to Hub.');
        setTransitionActive(false);
        updateSettings({ appMode: 'hub' });
        window.dispatchEvent(new CustomEvent('studio:reset-hub-zooming'));
      }, 1200);
    }
    return () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
    };
  }, [transitionActive, updateSettings]);

  // ── Sync Active Theme & AMOLED Mode ──
  const activeApp = settings.appMode || 'hub';
  const activeVis = useMemo(() => {
    const appKey = activeApp as AppKey;
    return settings.perApp?.[appKey] ?? {
      theme: settings.theme ?? 'dark',
      accentColor: settings.accentColor ?? 'blue',
      amoledMode: settings.amoledMode ?? false,
    };
  }, [activeApp, settings.perApp, settings.theme, settings.accentColor, settings.amoledMode]);

  useEffect(() => {
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
      const color = activeVis.amoledMode ? (isLight ? '#ffffff' : '#000000') : (isLight ? '#f5f5f5' : '#000000');
      let tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'theme-color';
        document.head.appendChild(tag);
      }
      tag.content = color;

      if (!skipTransitioningClass) {
        setTimeout(() => {
          root.classList.remove('theme-transitioning');
        }, 350);
      }
    };

    applyTheme();
  }, [activeVis.theme, activeVis.amoledMode, settings.dynamicLightStart, settings.dynamicLightEnd]);

  // Re-apply dynamic theme every minute
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

  // Sync Accent variables
  const hubAccentKey = activeVis.accentColor ?? 'blue';
  const accent = useMemo(() =>
    hubAccentKey === 'custom'
      ? { from: `hsl(${settings.customAccentHue ?? 220}, 75%, 65%)`, mid: `hsl(${settings.customAccentHue ?? 220}, 80%, 55%)`, to: `hsl(${((settings.customAccentHue ?? 220) + 25) % 360}, 85%, 42%)` }
      : (ACCENT_COLORS[hubAccentKey as keyof typeof ACCENT_COLORS] ?? ACCENT_COLORS.blue),
  [hubAccentKey, settings.customAccentHue]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    root.style.setProperty('--accent-from', accent.from);
    root.style.setProperty('--accent-to',   accent.to);
    root.style.setProperty('--accent-mid',  accent.mid);
    
    const colorToRgbStr = (colorStr: string) => {
      if (colorStr.startsWith('rgb')) {
        const m = colorStr.match(/\d+/g);
        return m ? m.slice(0, 3).join(', ') : '0, 122, 255';
      }
      if (colorStr.startsWith('#')) {
        const hex = colorStr.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `${r}, ${g}, ${b}`;
      }
      return '0, 122, 255';
    };

    root.style.setProperty('--accent-from-rgb', colorToRgbStr(accent.from));
    root.style.setProperty('--accent-to-rgb',   colorToRgbStr(accent.to));
    root.style.setProperty('--accent-mid-rgb',  colorToRgbStr(accent.mid));
    
    const tId = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 350);
    return () => clearTimeout(tId);
  }, [accent]);

  // Sync Native Status Bar
  useStatusBar(activeVis.theme, activeVis.amoledMode);

  // Sync Animation speed & Performance mode
  useEffect(() => {
    const isReduced = preferences.reduceMotion || settings.animationSpeed === 'reduced';
    document.documentElement.setAttribute('data-anim', isReduced ? 'reduced' : settings.animationSpeed);
  }, [settings.animationSpeed, preferences.reduceMotion]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.performanceMode) root.setAttribute('data-perf-mode', 'on');
    else root.removeAttribute('data-perf-mode');
  }, [settings.performanceMode]);

  // High refresh rate tick
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

  // Sync Font Size
  useEffect(() => {
    const root = document.documentElement;
    const sizes = {
      small:  { base: '13px', sm: '11px', xs: '9px',  lg: '16px', xl: '20px', hero: '2.2rem' },
      medium: { base: '14px', sm: '12px', xs: '10px', lg: '18px', xl: '24px', hero: '2.8rem' },
      large:  { base: '16px', sm: '13px', xs: '11px', lg: '20px', xl: '26px', hero: '3.2rem' },
    };
    const s = sizes[settings.fontSize] || sizes.medium;
    root.style.setProperty('--font-base', s.base);
    root.style.setProperty('--font-sm',   s.sm);
    root.style.setProperty('--font-xs',   s.xs);
    root.style.setProperty('--font-lg',   s.lg);
    root.style.setProperty('--font-xl',   s.xl);
    root.style.setProperty('--font-hero', s.hero);
  }, [settings.fontSize]);

  // Sync Display Density
  useEffect(() => {
    const root = document.documentElement;
    const densities = {
      compact:     { pad: '10px', rowPad: '10px 20px', gap: '8px',  cardGap: '6px'  },
      comfortable: { pad: '16px', rowPad: '14px 20px', gap: '12px', cardGap: '10px' },
      spacious:    { pad: '22px', rowPad: '20px 24px', gap: '18px', cardGap: '16px' },
    };
    const d = densities[settings.displayDensity] || densities.comfortable;
    root.style.setProperty('--density-pad',      d.pad);
    root.style.setProperty('--density-row-pad',  d.rowPad);
    root.style.setProperty('--density-gap',      d.gap);
    root.style.setProperty('--density-card-gap', d.cardGap);
  }, [settings.displayDensity]);

  const returnToStudioHub = useCallback((isSwipeSuccess = false) => {
    const fromApp = useChordStore.getState().settings.appMode || 'hub';
    if (fromApp === 'hub') {
      return; // Already in hub, no need to navigate
    }

    recordNavigation({
      fromApp,
      toApp: 'hub',
      transitionStart: Date.now(),
      transitionLockState: true,
      activeAppAfterTransition: 'hub',
      fallbackRendered: false
    });

    // 1. Close active modals/sheets/overlays
    window.dispatchEvent(new CustomEvent('studio:close-all-sheets'));
    window.dispatchEvent(new CustomEvent('studio:close-all-modals'));
    document.querySelectorAll('.modal-backdrop, .overlay').forEach(el => {
      if (el.id !== 'update-fade-overlay') {
        el.remove();
      }
    });
    document.documentElement.classList.remove('has-modal-open');

    // 2. Set transition active lock
    setTransitionActive(true);

    // Reset Hub's zoom/opacity animation state immediately so it starts fading in as the sub-app exits
    window.dispatchEvent(new CustomEvent('studio:reset-hub-zooming'));

    // 3. Clear selected/active app state, reset animation locks & return to Hub after transition
    updateSettings({ appMode: 'hub' });
    
    // Reset nested views to defaults if rememberLastAppSection is disabled
    if (!preferences.rememberLastAppSection) {
      const storeState = useChordStore.getState();
      storeState.setActivePanel(storeState.settings.defaultTab ?? 'library');
      storeState.setLastSession({
        vocalexTab: 'practice',
        drumexTab: storeState.settings.defaultDrumTab ?? 'songs',
        stagexView: storeState.settings.defaultStageView ?? 'Editor',
      });

      import('@workspace/ui-shared')
        .then(({ useGroovexStore }) => {
          useGroovexStore.getState().setView('library');
        })
        .catch(() => {});
    }

    setTimeout(() => {
      setTransitionActive(false);
      recordNavigation({
        fromApp,
        toApp: 'hub',
        transitionComplete: Date.now(),
        transitionLockState: false,
        activeAppAfterTransition: 'hub',
        fallbackRendered: false
      });
    }, 370);
  }, [updateSettings, preferences.rememberLastAppSection]);

  const returnToStudioHubRef = useRef(returnToStudioHub);
  useEffect(() => {
    returnToStudioHubRef.current = returnToStudioHub;
  }, [returnToStudioHub]);

  // Export to window object so external sub-apps can call it directly
  useEffect(() => {
    (window as any).returnToStudioHub = returnToStudioHub;
    return () => {
      delete (window as any).returnToStudioHub;
    };
  }, [returnToStudioHub]);

  // Backward compatibility listener for studio-hub-return CustomEvent
  useEffect(() => {
    const handler = () => {
      returnToStudioHubRef.current();
    };
    window.addEventListener('studio-hub-return', handler);
    return () => window.removeEventListener('studio-hub-return', handler);
  }, []);

  // System back button & predictive gesture handler
  useEffect(() => {
    // Seed history entries so we can capture popstate events
    window.history.replaceState({ chordex: 'root' }, '');
    window.history.pushState({ chordex: 'app' }, '');

    const onBack = () => {
      const handled = handleGlobalBack();

      if (!handled) {
        const isSubApp = useChordStore.getState().settings.appMode !== 'hub';
        if (isSubApp) {
          returnToStudioHubRef.current(false);
        } else {
          // Double press to exit when already on the Studio Hub
          const now = Date.now();
          if (now - lastBackTime.current < 2000) {
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
      }

      window.history.pushState({ chordex: 'app' }, '');
    };

    const handlePop = () => {
      if (Capacitor.isNativePlatform()) {
        return;
      }
      onBack();
    };
    window.addEventListener('popstate', handlePop);

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

  // Root-level safety fallback: recover to Studio Hub on invalid appMode
  useEffect(() => {
    const validModes = ['hub', 'chords', 'drums', 'stage', 'groovex', 'vocalex'];
    if (!settings.appMode || !validModes.includes(settings.appMode)) {
      console.warn('[Safety] Invalid appMode detected:', settings.appMode, 'Falling back to hub.');
      updateSettings({ appMode: 'hub' });
    }
  }, [settings.appMode, updateSettings]);

  const [route, setRoute] = useState('/app');

  const navigateTo = (path: string) => {
    if (path === '/') return; // Never route to landing page on Android
    window.history.pushState({}, '', path);
    setRoute(path);
  };

  useEffect(() => {
    // Force app mode classes on mount
    document.documentElement.classList.add('app-route');
    document.documentElement.classList.remove('landing-route');
    
    const intro = document.getElementById('intro');
    if (intro && (window as any).__introReturnedEarly) {
      intro.style.transition = 'opacity 500ms ease-out';
      intro.style.opacity = '0';
      setTimeout(() => {
        intro.classList.add('dismissed');
        if (intro.parentNode) intro.parentNode.removeChild(intro);
      }, 550);
      (window as any).__introDone = true;
      window.dispatchEvent(new Event('studio-intro-done'));
    }
  }, []);

  const [accountState, setAccountState] = useState<AccountState>({ phase: 'unknown' });
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const initAuth = async () => {
      try {
        const { supabase } = await import('@workspace/studio-core');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!active) return;
        setSession(currentSession);
        
        if (currentSession?.user) {
          const { getAccountDoc } = await import('@workspace/studio-core');
          const doc = await getAccountDoc(currentSession.user.id);
          if (!active) return;
          const status = doc || { status: 'active', scheduledAtMs: null };
          if (status.status === 'pending_deletion') {
            setAccountState({
              phase: 'pending',
              user: currentSession.user as any,
              scheduledAtMs: status.scheduledAtMs || Date.now()
            });
          } else if (status.status === 'disabled') {
            setAccountState({ phase: 'disabled', user: currentSession.user as any });
          } else {
            setAccountState({ phase: 'active', user: currentSession.user as any });
          }
        } else {
          setAccountState({ phase: 'signedOut' });
        }
      } catch (err) {
        console.error('Failed to init auth:', err);
        if (active) setAccountState({ phase: 'signedOut' });
      }
    };

    initAuth();
    return () => { active = false; };
  }, []);

  const appMode = settings.appMode || 'hub';
  const isSubAppActive = appMode !== 'hub';

  const lastActiveAppRef = useRef<AppKey>('chords');
  if (isSubAppActive) {
    lastActiveAppRef.current = appMode as AppKey;
  }
  const stableKey = lastActiveAppRef.current;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100dvh', overflow: 'hidden', background: 'var(--app-bg)' }}>
      <div
        className="app-main-layout"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          height: '100dvh',
          overflow: 'hidden',
          pointerEvents: isSubAppActive ? 'none' : 'auto',
        }}
      >
        <Suspense fallback={<SmartLoading fallbackSkeleton={<StudioHubSkeleton />} />}>
          <StudioHub />
        </Suspense>
      </div>

      <AnimatePresence>
        {isSubAppActive && (
          <motion.div
            key={stableKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              background: 'var(--app-bg)',
              pointerEvents: isSubAppActive ? 'auto' : 'none',
            }}
          >
            <SubAppWrapper
              app={stableKey}
              activePanel={activePanel}
              settings={settings}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {exitToast && renderExitToast()}
    </div>
  );

  function renderExitToast() {
    const isLight = settings.theme === 'light' ||
      (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

    return createPortal(
      <div
        id="exit-toast"
        style={{
          position: 'fixed',
          bottom: 'max(28px, calc(env(safe-area-inset-bottom) + 88px))',
          left: '50%',
          transform: 'translateX(-50%)',
          background: isLight ? 'rgba(255, 255, 255, 0.90)' : 'rgba(24,24,32,0.93)',
          color: isLight ? '#1a1a1a' : 'var(--c-text-primary, #ffffff)',
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
  }
}

interface SubAppWrapperProps {
  app: AppKey;
  activePanel: string;
  settings: any;
}

function FallbackTracker({ app, children }: { app: AppKey; children: React.ReactNode }) {
  useEffect(() => {
    recordNavigation({
      fromApp: 'hub',
      toApp: app,
      activeAppAfterTransition: app,
      transitionLockState: (window as any).studioTransitionActive || false,
      fallbackRendered: true
    });
  }, [app]);
  return <>{children}</>;
}

function SubAppWrapper({ app, activePanel, settings }: SubAppWrapperProps) {
  const [cachedApp] = useState<AppKey>(app);

  useEffect(() => {
    recordNavigation({
      fromApp: 'hub',
      toApp: app,
      hubMounted: true,
      activeAppAfterTransition: app,
      transitionLockState: (window as any).studioTransitionActive || false,
      fallbackRendered: false
    });
    return () => {
      recordNavigation({
        fromApp: app,
        toApp: 'hub',
        subappUnmounted: true,
        activeAppAfterTransition: 'hub',
        transitionLockState: (window as any).studioTransitionActive || false,
        fallbackRendered: false
      });
    };
  }, [app]);

  return (
    <>
      {cachedApp === 'groovex' && (
        <div className="app-sub-app-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          <ErrorBoundary moduleName="Groovex">
            <Suspense fallback={<FallbackTracker app="groovex"><SmartLoading fallbackSkeleton={<GroovexAppSkeleton />} /></FallbackTracker>}><AppEntryTransition><GroovexApp /></AppEntryTransition></Suspense>
          </ErrorBoundary>
        </div>
      )}

      {cachedApp === 'vocalex' && (
        <div className="app-sub-app-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          <ErrorBoundary moduleName="Vocalex">
            <Suspense fallback={<FallbackTracker app="vocalex"><SmartLoading fallbackSkeleton={<VocalexTakesSkeleton />} /></FallbackTracker>}><AppEntryTransition><VocalexApp /></AppEntryTransition></Suspense>
          </ErrorBoundary>
        </div>
      )}

      {cachedApp === 'stage' && (
        <div className="app-sub-app-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          <ErrorBoundary moduleName="Stagex">
            <Suspense fallback={<FallbackTracker app="stage"><SmartLoading fallbackSkeleton={<StagexPanelSkeleton />} /></FallbackTracker>}><AppEntryTransition><StageCorePanel /></AppEntryTransition></Suspense>
          </ErrorBoundary>
        </div>
      )}

      {cachedApp === 'drums' && (
        <div className="app-sub-app-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          <ErrorBoundary moduleName="Drumex"><Suspense fallback={<FallbackTracker app="drums"><SmartLoading fallbackSkeleton={<DrumEditorSkeleton />} /></FallbackTracker>}><AppEntryTransition><DrumEditor /></AppEntryTransition></Suspense></ErrorBoundary>
        </div>
      )}

      {cachedApp === 'chords' && (
        <div className="app-sub-app-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', userSelect: 'none', background: 'var(--app-bg)' }}>
          <AppEntryTransition
            className="flex flex-col w-full overflow-hidden select-none app-bg"
            style={{
              position: 'relative',
              height: '100%',
              paddingTop: 'env(safe-area-inset-top)',
            } as React.CSSProperties}
          >
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                flex: 1, 
                width: '100%', 
                height: '100%', 
                overflow: 'hidden' 
              }}
            >
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
                      }}
                    >
                      <ErrorBoundary moduleName="Chordex">
                        <Suspense fallback={<FallbackTracker app="chords"><SmartLoading fallbackSkeleton={<ChordexPanelSkeleton />} /></FallbackTracker>}>
                          {panel === 'library'  && <LibraryPanel />}
                          {panel === 'chord'    && <ChordPanel />}
                          {panel === 'songs'    && <SongsPanel />}
                          {panel === 'settings' && <SettingsPanel />}
                        </Suspense>
                      </ErrorBoundary>
                    </div>
                  );
                })}
              </div>
            </div>

            {cachedApp === 'chords' && <BottomNav />}
          </AppEntryTransition>
        </div>
      )}
    </>
  );
}

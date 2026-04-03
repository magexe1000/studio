import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useChordStore, ACCENT_COLORS } from './store/useChordStore';
import BottomNav from './components/BottomNav';
import { ChordexLogo, DrumexLogo } from './components/ChordexLogo';
import { setNavHidden, setNavLocked } from './lib/navScroll';
import { handleGlobalBack } from './lib/backStack';
import { useStatusBar } from './lib/useStatusBar';
import StudioHub from './components/StudioHub';

const LibraryPanel  = lazy(() => import('./panels/LibraryPanel'));
const ChordPanel    = lazy(() => import('./panels/ChordPanel'));
const SettingsPanel = lazy(() => import('./panels/SettingsPanel'));
const SongsPanel    = lazy(() => import('./panels/SongsPanel'));
const DrumEditor    = lazy(() => import('./panels/DrumEditor'));

// Ordered left-to-right (matches nav order) — used to compute slide direction
const NAV_ORDER = ['songs', 'library', 'chord', 'settings'] as const;
const ALL_PANELS = ['library', 'chord', 'songs', 'settings'] as const;

export default function App() {
  const { activePanel, settings, setActivePanel, activePresetId, updateSettings } = useChordStore();

  // On first mount: apply startupApp preference
  const startupHandled = useRef(false);
  useEffect(() => {
    const startApp = settings.startupApp ?? 'hub';
    if (startApp === 'drums') {
      prevAppMode.current = 'drums';
      updateSettings({ appMode: 'drums' });
    } else if (startApp === 'hub') {
      prevAppMode.current = 'hub';
      updateSettings({ appMode: 'hub' });
    } else {
      prevAppMode.current = 'chords';
      updateSettings({ appMode: 'chords' });
      const tab = settings.defaultTab ?? 'library';
      if (tab !== 'library') setActivePanel(tab);
    }
    startupHandled.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Global back navigation ───────────────────────────────────────────────
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

  // ── App-switch splash on mode change ────────────────────────────────────
  type SplashPhase = 'hidden' | 'in' | 'out';
  const [drumSplash,    setDrumSplash]    = useState<SplashPhase>('hidden');
  const [chordexSplash, setChordexSplash] = useState<SplashPhase>('hidden');
  const prevAppMode  = useRef(settings.appMode);
  const splashTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const fireSplash = (set: (p: SplashPhase) => void) => {
    splashTimers.current.forEach(clearTimeout);
    splashTimers.current = [];
    set('in');
    const t1 = setTimeout(() => set('out'),    750);
    const t2 = setTimeout(() => set('hidden'), 1100);
    splashTimers.current = [t1, t2];
  };

  useEffect(() => {
    if (settings.appMode === 'drums'  && prevAppMode.current !== 'drums')  fireSplash(setDrumSplash);
    if (settings.appMode === 'chords' && prevAppMode.current !== 'chords') fireSplash(setChordexSplash);
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
  const accent     = ACCENT_COLORS[settings.accentColor];

  // Show/hide the nav based on panel and preset state.
  // Hidden (and locked so scroll can't override) only when inside the preset editor.
  useEffect(() => {
    const inPreset = !!(activePresetId && visiblePanel === 'songs');
    setNavLocked(inPreset);
    setNavHidden(inPreset);
  }, [activePresetId, visiblePanel]);

  // Apply CSS vars for accent color globally
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-from', accent.from);
    root.style.setProperty('--accent-to',   accent.to);
    root.style.setProperty('--accent-mid',  accent.mid);
  }, [settings.accentColor]);

  // AMOLED mode
  useEffect(() => {
    const root = document.documentElement;
    settings.amoledMode ? root.classList.add('amoled') : root.classList.remove('amoled');
  }, [settings.amoledMode]);

  // Sync theme-color meta tag so the PWA / browser status bar matches the app theme
  useEffect(() => {
    const isLight = settings.theme === 'light' ||
      (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);
    const color = settings.amoledMode ? '#000000' : (isLight ? '#f5f5f5' : '#111116');
    let tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'theme-color';
      document.head.appendChild(tag);
    }
    tag.content = color;
  }, [settings.theme, settings.amoledMode]);

  // Theme mode (dark / light / system)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'theme-system');
    if (settings.theme === 'light') {
      root.classList.add('light');
    } else if (settings.theme === 'system') {
      root.classList.add('theme-system');
    }
    // 'dark' is the default — no class needed
  }, [settings.theme]);

  // Keep the native Android status bar in sync with the active theme
  useStatusBar(settings.theme, settings.amoledMode);

  // Animation speed → root data-attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-anim', settings.animationSpeed);
  }, [settings.animationSpeed]);

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
  const durMs = settings.animationSpeed === 'fast' ? 160 : settings.animationSpeed === 'reduced' ? 0 : 300;

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

  // ── Hub mode: show the Studio Hub ────────────────────────────────────────
  if (settings.appMode === 'hub') {
    return <StudioHub />;
  }

  // ── Drums mode: completely separate environment ──────────────────────────
  if (settings.appMode === 'drums') {
    return (
      <div style={{ position: 'relative', height: '100dvh', overflow: 'hidden', animation: 'mode-enter 300ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <Suspense fallback={null}><DrumEditor /></Suspense>

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
    );
  }

  return (
    <div
      className="flex flex-col w-full overflow-hidden select-none app-bg"
      style={{
        position: 'relative',
        height: '100dvh',
        paddingTop: 'env(safe-area-inset-top)',
        '--panel-dur': `${durMs}ms`,
        animation: 'mode-enter 300ms cubic-bezier(0.34,1.56,0.64,1) both',
      } as React.CSSProperties}
    >

      {/* Panel container */}
      <div className="flex-1 overflow-hidden relative">
        {ALL_PANELS.map(panel => {
          const isVisible  = visiblePanel === panel;
          const isExiting  = exitingPanel === panel;
          const isEntering = isVisible && exitingPanel !== null;

          // Determine CSS animation class
          let animClass = '';
          if (isEntering) animClass = slideDir === 'right' ? 'panel-enter-right' : 'panel-enter-left';
          else if (isExiting) animClass = slideDir === 'right' ? 'panel-exit-left' : 'panel-exit-right';

          if (!isVisible && !isExiting) {
            return (
              <div
                key={panel}
                style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
              >
                <Suspense fallback={null}>
                  {panel === 'library'  && <LibraryPanel />}
                  {panel === 'chord'    && <ChordPanel />}
                  {panel === 'songs'    && <SongsPanel />}
                  {panel === 'settings' && <SettingsPanel />}
                </Suspense>
              </div>
            );
          }

          return (
            <div
              key={panel}
              className={animClass}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: isExiting && !animClass ? 0 : undefined,
                pointerEvents: isVisible && !isExiting ? 'auto' : 'none',
              }}
            >
              <Suspense fallback={null}>
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

      {/* Double-tap exit toast */}
      {exitToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom) + 88px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(24,24,32,0.93)',
            color: 'var(--c-text-primary)',
            padding: '10px 22px',
            borderRadius: '24px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            zIndex: 9999,
            pointerEvents: 'none',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            whiteSpace: 'nowrap',
          }}
        >
          Press back again to exit
        </div>
      )}

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

    </div>
  );
}

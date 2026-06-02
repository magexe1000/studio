import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useBackHandler } from '../lib/backStack';
import { useChordStore, ACCENT_COLORS, type AppKey } from '../store/useChordStore';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import { useT } from '../lib/useT';
import { resetNav, setNavCollapsed, useNavHidden, useNavCollapsed } from '../lib/navScroll';
import { subscribeVocalexBack } from './headerBack';
import { useLiquidGlassNav } from '../lib/useLiquidGlassNav';

const PracticePanelLazy = lazy(() => import('./PracticePanel'));
const PitchPanelLazy = lazy(() => import('./PitchPanel'));
const TakesPanelLazy = lazy(() => import('./TakesPanel'));
const LabPanelLazy = lazy(() => import('./LabPanel'));

type VocalexPanel = 'practice' | 'pitch' | 'vocalLab' | 'takes';

const NAV_ORDER: VocalexPanel[] = ['practice', 'pitch', 'vocalLab', 'takes'];

function IconMic({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="9" y="5" width="6" height="10" rx="3" strokeWidth={sw} />
      <path d="M5 12a7 7 0 0 0 14 0" strokeWidth={sw} />
      <line x1="12" y1="19" x2="12" y2="22" strokeWidth={sw} />
      <line x1="8" y1="22" x2="16" y2="22" strokeWidth={sw} />
    </svg>
  );
}

function IconPitch({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <polyline points="4,18 8,10 12,14 16,6 20,12" strokeWidth={sw} />
      <circle cx="20" cy="12" r="1.5" fill={active ? 'currentColor' : 'none'} strokeWidth={sw * 0.7} />
    </svg>
  );
}

function IconLab({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3" strokeWidth={sw} />
      {active && <path d="M7 15h10" strokeWidth={sw} strokeOpacity={0.4} />}
    </svg>
  );
}

function IconTakes({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  const ao = active ? 1 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={sw} />
      <path d="M3 9h18" strokeWidth={sw} />
      <circle cx="12" cy="15" r="3" fill="currentColor" fillOpacity={ao} strokeWidth={sw} style={{ transition: 'fill-opacity 140ms ease' }} />
    </svg>
  );
}





export default function VocalexApp() {
  const { settings } = useChordStore();
  const t = useT();
  // Restore last-visited Vocalex tab so a refresh / app-switch lands the
  // user where they left off. Falls back to 'practice' for fresh installs
  // or if the persisted value is somehow corrupted / out-of-schema.
  const initialVocalexTab: VocalexPanel = (() => {
    const s = useChordStore.getState();
    if (!s.settings.restoreLastSession) return 'practice';
    const saved = s.lastSession?.vocalexTab;
    return saved === 'practice' || saved === 'pitch' || saved === 'vocalLab' || saved === 'takes'
      ? saved
      : 'practice';
  })();
  const [activeTab, setActiveTab] = useState<VocalexPanel>(initialVocalexTab);
  const [visibleTab, setVisibleTab] = useState<VocalexPanel>(initialVocalexTab);
  const [exitingTab, setExitingTab] = useState<VocalexPanel | null>(null);
  const [slideDir, setSlideDir] = useState<'right' | 'left'>('right');
  const prevTab = useRef<VocalexPanel>(initialVocalexTab);

  // Persist the active tab on every change so cold-start can resume here.
  useEffect(() => {
    useChordStore.getState().setLastSession({ vocalexTab: activeTab });
  }, [activeTab]);

  const appKey = 'vocalex' as AppKey;
  const activeVis = settings.perApp?.[appKey] ?? { theme: 'dark' as const, accentColor: 'blue' as const, amoledMode: false };
  const accent = ACCENT_COLORS[activeVis.accentColor] ?? ACCENT_COLORS.blue;
  const isLight = (() => {
    if (activeVis.theme === 'light') return true;
    if (activeVis.theme === 'system') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    if (activeVis.theme === 'dynamic') {
      const h = new Date().getHours();
      const lightStart = settings.dynamicLightStart ?? 7;
      const lightEnd   = settings.dynamicLightEnd   ?? 20;
      return h >= lightStart && h < lightEnd;
    }
    return false;
  })();

  const durMs = settings.animationSpeed === 'fast' ? 200 : settings.animationSpeed === 'reduced' ? 0 : 280;

  useEffect(() => {
    if (activeTab === prevTab.current) return;
    const prevIdx = NAV_ORDER.indexOf(prevTab.current);
    const nextIdx = NAV_ORDER.indexOf(activeTab);
    setSlideDir(nextIdx >= prevIdx ? 'right' : 'left');
    setExitingTab(prevTab.current);
    setVisibleTab(activeTab);
    prevTab.current = activeTab;
    // Reset nav fully on every tab switch — resets both hidden AND collapsed states.
    // Critical: setNavHidden(false) alone left the nav as a collapsed pill when switching
    // from a scrolled-down panel to a non-scrollable one (e.g. pitch detector).
    resetNav();
    const ti = setTimeout(() => setExitingTab(null), durMs + 20);
    return () => clearTimeout(ti);
  }, [activeTab, durMs]);

  const NAV_ITEMS: { panel: VocalexPanel; Icon: React.FC<{ active: boolean }>; label: string }[] = [
    { panel: 'practice', Icon: IconMic,   label: t.vocalex.navTips },
    { panel: 'pitch',    Icon: IconPitch,  label: t.vocalex.navPitch },
    { panel: 'vocalLab', Icon: IconLab,    label: t.vocalex.navLab },
    { panel: 'takes',    Icon: IconTakes,  label: t.vocalex.navTakes },
  ];

  const navRef = useRef<HTMLElement | null>(null);
  useLiquidGlassNav(navRef);
  // Fixed nav height — same rationale as BottomNav: always 64px, dynamic
  // measurement was a race condition that returned 64 anyway.
  const NAV_HEIGHT_PX = 56;
  const [expandedW, setExpandedW] = useState(350);
  useEffect(() => {
    if (navRef.current) setExpandedW(navRef.current.offsetWidth);
  }, []);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const prevIdxRef = useRef(0);

  const practiceScrollRef = useRef<HTMLDivElement | null>(null);
  const pitchScrollRef    = useRef<HTMLDivElement | null>(null);
  const labScrollRef      = useRef<HTMLDivElement | null>(null);
  const takesScrollRef    = useRef<HTMLDivElement | null>(null);

  // Unified scroll tracker — attaches to the active panel's container after each tab switch.
  // Replaces 4 separate useScrollHide calls: those ran once on mount with empty deps,
  // so any panel that wasn't rendered yet (ref = null) never got a scroll listener.
  useEffect(() => {
    const refMap = {
      practice: practiceScrollRef,
      pitch:    pitchScrollRef,
      vocalLab: labScrollRef,
      takes:    takesScrollRef,
    } as const;

    let el: HTMLElement | null = null;
    let onScroll: (() => void) | null = null;

    // Defer by one tick so the panel has mounted and the ref has been assigned.
    const tid = setTimeout(() => {
      el = refMap[activeTab].current;
      if (!el) return;
      let lastY = el.scrollTop;
      onScroll = () => {
        const y = el!.scrollTop;
        if (y < 30) { setNavCollapsed(false); lastY = y; return; }
        const dy = y - lastY;
        if (Math.abs(dy) < 6) return;
        setNavCollapsed(dy > 0);
        lastY = y;
      };
      el.addEventListener('scroll', onScroll, { passive: true });
    }, 50);

    return () => {
      clearTimeout(tid);
      if (el && onScroll) el.removeEventListener('scroll', onScroll);
    };
  }, [activeTab]);

  const navHidden   = useNavHidden();
  const navCollapsed = useNavCollapsed();
  const [headerBack, setHeaderBack] = useState<(() => void) | null>(null);
  useEffect(() => subscribeVocalexBack(fn => setHeaderBack(() => fn)), []);

  useBackHandler('nested', () => {
    if (headerBack) { headerBack(); return true; }
    return false;
  }, [headerBack]);



  const stretchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pill, setPill] = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const [pressedPanel, setPressedPanel] = useState<VocalexPanel | null>(null);

  const measureBtn = (idx: number): { left: number; right: number } | null => {
    const btn = btnRefs.current[idx];
    const nav = navRef.current;
    if (!btn || !nav) return null;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return { left: btnRect.left - navRect.left, right: btnRect.right - navRect.left };
  };

  useEffect(() => {
    // Measure the button for the actual initial tab, not always index 0.
    const initIdx = NAV_ORDER.indexOf(initialVocalexTab);
    const m = measureBtn(initIdx >= 0 ? initIdx : 0);
    if (m) setPill({ left: m.left, right: m.right, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const newIdx = NAV_ORDER.indexOf(activeTab);
    const oldIdx = prevIdxRef.current;
    if (newIdx === oldIdx) return;
    prevIdxRef.current = newIdx;
    const newM = measureBtn(newIdx);
    if (!newM) return;

    if (stretchTimeoutRef.current) {
      clearTimeout(stretchTimeoutRef.current);
      stretchTimeoutRef.current = null;
      setPill(p => ({ ...p, left: newM.left, right: newM.right }));
      return;
    }

    if (newIdx > oldIdx) {
      setPill(p => ({ ...p, right: newM.right }));
      stretchTimeoutRef.current = setTimeout(() => {
        setPill(p => ({ ...p, left: newM.left }));
        stretchTimeoutRef.current = null;
      }, 90);
    } else {
      setPill(p => ({ ...p, left: newM.left }));
      stretchTimeoutRef.current = setTimeout(() => {
        setPill(p => ({ ...p, right: newM.right }));
        stretchTimeoutRef.current = null;
      }, 90);
    }
  }, [activeTab]);

  const amoledBg = isLight
    ? activeVis.amoledMode
      ? 'rgba(255, 255, 255, 0.92)'
      : 'rgba(255, 255, 255, 0.40)'
    : activeVis.amoledMode
      ? 'rgba(4,4,4,0.88)'
      : 'rgba(26,26,30,0.72)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
      '--panel-dur':      `${durMs}ms`,
      '--panel-exit-dur': `${Math.round(durMs * 0.65)}ms`,
    } as React.CSSProperties}>
      <header className="flex-none px-6 pt-6 pb-1 spring-in" style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
          overflow: 'hidden',
          flexShrink: 0,
          width: headerBack ? '40px' : '0px',
          opacity: headerBack ? 1 : 0,
          transition: 'width 300ms cubic-bezier(0.34,1.1,0.64,1), opacity 200ms ease',
        }}>
          <button
            onClick={() => {
              headerBack?.();
            }}
            data-testid="vocalex-back-button"
            aria-label="Back"
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--app-surface-high)',
              border: '1px solid rgba(128,128,128,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0,
              transition: 'background 500ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: '18px' }}>arrow_back</span>
          </button>
        </div>
        <h1 style={{
          fontSize: '14px', fontWeight: 700,
          color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em',
          display: 'flex', alignItems: 'center', gap: '7px',
          margin: 0,
        }}>
          <AppModeMenuLogo />
        </h1>
      </header>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {NAV_ORDER.map(panel => {
          const isVisible = visibleTab === panel;
          const isExiting = exitingTab === panel;
          if (!isVisible && !isExiting) return null;
          const isEntering = isVisible && exitingTab !== null;

          let animClass = '';
          if (isEntering) animClass = slideDir === 'right' ? 'panel-enter-right' : 'panel-enter-left';
          else if (isExiting) animClass = slideDir === 'right' ? 'panel-exit-left' : 'panel-exit-right';

          const scrollRef =
            panel === 'practice' ? practiceScrollRef :
            panel === 'pitch'    ? pitchScrollRef    :
            panel === 'vocalLab' ? labScrollRef      :
                                   takesScrollRef;

          return (
            <div key={panel} ref={scrollRef} className={animClass} style={{
              position: 'absolute', inset: 0,
              opacity: isExiting && !animClass ? 0 : undefined,
              pointerEvents: isVisible && !isExiting ? 'auto' : 'none',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 'var(--content-bottom-pad)',
            }}>
              {panel === 'practice' && <Suspense fallback={null}><PracticePanelLazy /></Suspense>}
              {panel === 'pitch' && <Suspense fallback={null}><PitchPanelLazy active={activeTab === 'pitch'} /></Suspense>}
              {panel === 'vocalLab' && <Suspense fallback={null}><LabPanelLazy /></Suspense>}
              {panel === 'takes' && <Suspense fallback={null}><TakesPanelLazy /></Suspense>}
            </div>
          );
        })}
      </div>

      <nav
        ref={navRef}
        className="glass-nav"
        style={{
          position: 'fixed',
          bottom: 'var(--nav-safe-bottom)',
          left: '50%',
          width: '88%',
          maxWidth: '360px',
          height: `${NAV_HEIGHT_PX}px`,
          borderRadius: '2rem',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.32)'}`,
          background: amoledBg,
          boxShadow: isLight
            ? '0 8px 32px rgba(0,0,0,0.08), 0 1.5px 0 rgba(255,255,255,0.70) inset'
            : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
          zIndex: 50,
          overflow: 'hidden',
          transform: `translateX(-50%) translateY(${navHidden ? 'calc(100% + 32px)' : '0'})`,
          clipPath: navCollapsed
            ? `inset(${Math.max(0, NAV_HEIGHT_PX - 5)}px ${Math.max(0, Math.floor((expandedW - 90) / 2))}px 0 ${Math.max(0, Math.floor((expandedW - 90) / 2))}px round 99px)`
            : 'inset(0 0 0 0 round 2rem)',
          willChange: 'clip-path, transform',
          transition: [
            navCollapsed
              ? 'clip-path 500ms cubic-bezier(0.4,0,0.2,1)'
              : 'clip-path 380ms cubic-bezier(0.16,1,0.3,1)',
            navCollapsed
              ? 'transform 500ms cubic-bezier(0.4,0,0.2,1)'
              : 'transform 380ms cubic-bezier(0.16,1,0.3,1)',
          ].join(', '),
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          padding: '4px 6px',
          opacity: navCollapsed ? 0 : 1,
          transition: navCollapsed ? 'opacity 100ms ease' : 'opacity 350ms ease 180ms',
          willChange: 'opacity',
        }}>
        {pill.ready && (
          <div aria-hidden style={{
            position: 'absolute',
            top: '4px',
            left: pill.left,
            width: pill.right - pill.left,
            height: 'calc(100% - 8px)',
            borderRadius: '9999px',
            background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.09)',
            border: isLight ? '1.5px solid rgba(0,0,0,0.06)' : '1.5px solid rgba(255,255,255,0.30)',
            boxShadow: isLight
              ? 'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px rgba(0,0,0,0.08)'
              : 'inset 0 1px 0 rgba(255,255,255,0.40), 0 2px 16px rgba(255,255,255,0.06)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            zIndex: 0,
            opacity: 1,
            transition: 'left 300ms cubic-bezier(0.16,1,0.3,1), width 300ms cubic-bezier(0.16,1,0.3,1)',
          }} />
        )}

        {NAV_ITEMS.map(({ panel, Icon, label }, i) => {
          const isActive = activeTab === panel;
          const isPressed = pressedPanel === panel;
          return (
            <button
              key={panel}
              ref={el => { btnRefs.current[i] = el; }}
              data-testid={`vocalex-nav-${panel}`}
              onPointerDown={() => setPressedPanel(panel)}
              onPointerUp={() => { setPressedPanel(null); setActiveTab(panel); }}
              onPointerLeave={() => setPressedPanel(null)}
              onPointerCancel={() => setPressedPanel(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                padding: '6px 4px',
                borderRadius: '9999px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? (isLight ? accent.from : '#fff') : 'var(--c-text-secondary)',
                position: 'relative',
                zIndex: 1,
                opacity: 1,
                transform: isPressed ? 'scale(0.91)' : 'scale(1)',
                transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <Icon active={isActive} />
              <span style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 700,
                fontSize: '9px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                textShadow: isLight ? 'none' : '0 1px 4px rgba(0,0,0,0.60)',
              }}>
                {label}
              </span>
            </button>
          );
        })}
        </div>
      </nav>
    </div>
  );
}

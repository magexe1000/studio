import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useChordStore, ACCENT_COLORS, type AppKey } from '../store/useChordStore';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import { useT } from '../lib/useT';
import { useScrollHide, useNavHidden } from '../lib/navScroll';

const PracticePanelLazy = lazy(() => import('./PracticePanel'));
const PitchPanelLazy = lazy(() => import('./PitchPanel'));
const TakesPanelLazy = lazy(() => import('./TakesPanel'));
const LabPanelLazy = lazy(() => import('./LabPanel'));

type VocalexPanel = 'practice' | 'pitch' | 'vocalLab' | 'takes';

const NAV_ORDER: VocalexPanel[] = ['practice', 'pitch', 'vocalLab', 'takes'];

function IconMic({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="9" y="2" width="6" height="11" rx="3" strokeWidth={sw} />
      <path d="M5 10a7 7 0 0 0 14 0" strokeWidth={sw} />
      <line x1="12" y1="17" x2="12" y2="21" strokeWidth={sw} />
      <line x1="8" y1="21" x2="16" y2="21" strokeWidth={sw} />
    </svg>
  );
}

function IconPitch({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <polyline points="4,18 8,10 12,14 16,6 20,12" strokeWidth={sw} />
      <circle cx="20" cy="12" r="1.5" fill={active ? 'currentColor' : 'none'} strokeWidth={sw * 0.7} />
    </svg>
  );
}

function IconLab({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3" strokeWidth={sw} />
      {active && <path d="M7 15h10" strokeWidth={sw} strokeOpacity={0.4} />}
    </svg>
  );
}

function IconTakes({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  const ao = active ? 1 : 0;
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={sw} />
      <path d="M3 9h18" strokeWidth={sw} />
      <circle cx="12" cy="15" r="3" fill="currentColor" fillOpacity={ao} strokeWidth={sw} style={{ transition: 'fill-opacity 140ms ease' }} />
    </svg>
  );
}





export default function VocalexApp() {
  const { settings } = useChordStore();
  const t = useT();
  const [activeTab, setActiveTab] = useState<VocalexPanel>('practice');
  const [visibleTab, setVisibleTab] = useState<VocalexPanel>('practice');
  const [exitingTab, setExitingTab] = useState<VocalexPanel | null>(null);
  const [slideDir, setSlideDir] = useState<'right' | 'left'>('right');
  const prevTab = useRef<VocalexPanel>('practice');

  const appKey = 'vocalex' as AppKey;
  const activeVis = settings.perApp?.[appKey] ?? { theme: 'dark' as const, accentColor: 'blue' as const, amoledMode: false };
  const accent = ACCENT_COLORS[activeVis.accentColor] ?? ACCENT_COLORS.blue;
  const isLight = activeVis.theme === 'light' || (activeVis.theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const durMs = settings.animationSpeed === 'fast' ? 160 : settings.animationSpeed === 'reduced' ? 0 : 300;

  useEffect(() => {
    if (activeTab === prevTab.current) return;
    const prevIdx = NAV_ORDER.indexOf(prevTab.current);
    const nextIdx = NAV_ORDER.indexOf(activeTab);
    setSlideDir(nextIdx >= prevIdx ? 'right' : 'left');
    setExitingTab(prevTab.current);
    setVisibleTab(activeTab);
    prevTab.current = activeTab;
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
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const prevIdxRef = useRef(0);

  const practiceScrollRef = useRef<HTMLDivElement | null>(null);
  const pitchScrollRef    = useRef<HTMLDivElement | null>(null);
  const labScrollRef      = useRef<HTMLDivElement | null>(null);
  const takesScrollRef    = useRef<HTMLDivElement | null>(null);

  useScrollHide(practiceScrollRef);
  useScrollHide(pitchScrollRef);
  useScrollHide(labScrollRef);
  useScrollHide(takesScrollRef);

  const navHidden = useNavHidden();
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
    const m = measureBtn(0);
    if (m) setPill({ left: m.left, right: m.right, ready: true });
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
      }, 70);
    } else {
      setPill(p => ({ ...p, left: newM.left }));
      stretchTimeoutRef.current = setTimeout(() => {
        setPill(p => ({ ...p, right: newM.right }));
        stretchTimeoutRef.current = null;
      }, 70);
    }
  }, [activeTab]);

  const amoledBg = activeVis.amoledMode
    ? 'rgba(4,4,4,0.88)'
    : isLight
      ? 'rgba(240,240,242,0.82)'
      : 'rgba(26,26,30,0.82)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
      '--panel-dur': `${durMs}ms`,
    } as React.CSSProperties}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 6px',
        flexShrink: 0,
      }}>
        <AppModeMenuLogo size={14} />
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
              paddingBottom: 100,
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
          bottom: 'max(10px, env(safe-area-inset-bottom))',
          left: '50%',
          width: '90%',
          maxWidth: '28rem',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '6px 8px',
          borderRadius: '2rem',
          border: `1px solid ${isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.10)'}`,
          background: amoledBg,
          boxShadow: isLight
            ? '0 8px 32px rgba(0,0,0,0.14), 0 1.5px 0 rgba(255,255,255,0.80) inset'
            : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
          zIndex: 50,
          overflow: 'hidden',
          transform: `translateX(-50%) translateY(${navHidden ? 'calc(100% + 20px)' : '0'})`,
          transition: 'transform 320ms cubic-bezier(0.4, 0, 0.2, 1)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {pill.ready && (
          <div aria-hidden style={{
            position: 'absolute',
            top: '4px',
            left: pill.left,
            width: pill.right - pill.left,
            height: 'calc(100% - 8px)',
            borderRadius: '9999px',
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            boxShadow: `0 2px 18px ${accent.to}60`,
            pointerEvents: 'none',
            zIndex: 0,
            transition: 'left 150ms cubic-bezier(0.34,1.56,0.64,1), width 150ms cubic-bezier(0.34,1.56,0.64,1)',
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
                gap: '4px',
                padding: '8px 4px',
                borderRadius: '9999px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? '#fff' : 'var(--c-text-secondary)',
                position: 'relative',
                zIndex: 1,
                transform: isPressed ? 'scale(0.91)' : 'scale(1)',
                transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <Icon active={isActive} />
              <span style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 700,
                fontSize: '9.5px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

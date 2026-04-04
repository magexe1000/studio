import { useEffect, useRef, useState } from 'react';
import { useChordStore, ACCENT_COLORS, type ActivePanel, type AppKey } from '../store/useChordStore';
import { useNavHidden } from '../lib/navScroll';
import { useT } from '../lib/useT';

/* ── Crisp inline SVG icons ──────────────────────────────────── */
export function IconSongs({ active }: { active: boolean }) {
  const sw = active ? 2.1 : 1.7;
  const ao = active ? 1 : 0;
  const trans = 'fill-opacity 140ms cubic-bezier(0.34,1.56,0.64,1)';
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M9 18V7l10-2.5V16" stroke="currentColor" strokeWidth={sw}
        style={{ transition: 'stroke-width 120ms ease' }} />
      <circle cx="7" cy="18" r="2.5"
        fill="currentColor" fillOpacity={ao}
        stroke="currentColor" strokeWidth={sw - 0.2}
        style={{ transition: trans }} />
      <circle cx="17" cy="16" r="2.5"
        fill="currentColor" fillOpacity={ao}
        stroke="currentColor" strokeWidth={sw - 0.2}
        style={{ transition: trans }} />
    </svg>
  );
}

export function IconLibrary({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.7;
  const ao = active ? 1 : 0;
  const trans = 'fill-opacity 140ms cubic-bezier(0.34,1.56,0.64,1)';
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="3" y="4" width="5" height="16" rx="1.5" strokeWidth={sw}
        fill="currentColor" fillOpacity={ao} style={{ transition: trans }} />
      <rect x="10" y="7" width="4" height="13" rx="1.5" strokeWidth={sw}
        fill="currentColor" fillOpacity={ao} style={{ transition: `${trans.replace('140ms', '120ms')}` }} />
      <rect x="16" y="9" width="5" height="11" rx="1.5" strokeWidth={sw}
        fill="currentColor" fillOpacity={ao} style={{ transition: `${trans.replace('140ms', '100ms')}` }} />
    </svg>
  );
}

/* Guitar chord diagram — 3×3 fret grid, dots on frets */
export function IconChords({ active }: { active: boolean }) {
  const sw     = active ? 1.8 : 1.5;
  const dotAo  = active ? 1 : 0;
  const dotTr  = 'fill-opacity 130ms cubic-bezier(0.34,1.56,0.64,1)';
  const lineTr = 'stroke-opacity 130ms ease';

  /* Grid: 3 strings (x = 6, 12, 18), 3 frets (y = 7, 12, 17) */
  const strings = [6, 12, 18];
  const frets   = [7, 12, 17];

  /* Dots to display (string index, fret index) */
  const dots = [[0, 1], [1, 0], [2, 2]];

  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      {/* Nut (top thick bar) */}
      <line x1="4" y1="4.5" x2="20" y2="4.5"
        stroke="currentColor" strokeWidth={sw + 0.6} strokeLinecap="round"
        style={{ transition: 'stroke-width 120ms ease' }} />

      {/* Fret lines (horizontal) */}
      {frets.map((y, fi) => (
        <line key={`f${fi}`} x1="4" y1={y} x2="20" y2={y}
          stroke="currentColor" strokeWidth={sw - 0.5} strokeOpacity={active ? 0.5 : 0.45}
          style={{ transition: lineTr }} />
      ))}

      {/* String lines (vertical) */}
      {strings.map((x, si) => (
        <line key={`s${si}`} x1={x} y1="4.5" x2={x} y2="20"
          stroke="currentColor" strokeWidth={sw - 0.5} strokeOpacity={active ? 0.5 : 0.45}
          style={{ transition: lineTr }} />
      ))}

      {/* Fret dots */}
      {dots.map(([si, fi], i) => (
        <circle key={i}
          cx={strings[si]}
          cy={(frets[fi] + (fi > 0 ? frets[fi - 1] : 4.5)) / 2}
          r="2.4"
          fill="currentColor"
          fillOpacity={dotAo}
          stroke="currentColor"
          strokeWidth={active ? 0 : sw - 0.3}
          strokeOpacity={active ? 0 : 0.7}
          style={{ transition: dotTr }} />
      ))}
    </svg>
  );
}

export function IconSettings({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.7;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      {/* Three horizontal slider tracks */}
      <line x1="4" y1="6"  x2="20" y2="6"  />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      {/* Knobs at different positions */}
      <circle cx="8"  cy="6"  r="2.2" fill={active ? 'currentColor' : 'var(--app-bg)'} />
      <circle cx="16" cy="12" r="2.2" fill={active ? 'currentColor' : 'var(--app-bg)'} />
      <circle cx="10" cy="18" r="2.2" fill={active ? 'currentColor' : 'var(--app-bg)'} />
    </svg>
  );
}

const NAV_ORDER: ActivePanel[] = ['songs', 'library', 'chord', 'settings'];

export default function BottomNav() {
  const { activePanel, setActivePanel, settings } = useChordStore();
  const t = useT();

  const NAV_ITEMS: { panel: ActivePanel; Icon: React.FC<{ active: boolean }>; label: string }[] = [
    { panel: 'songs',    Icon: IconSongs,    label: t.nav.songs    },
    { panel: 'library',  Icon: IconLibrary,  label: t.nav.library  },
    { panel: 'chord',    Icon: IconChords,   label: t.nav.chords   },
    { panel: 'settings', Icon: IconSettings, label: t.nav.settings },
  ];
  // Derive the active per-app visuals the same way App.tsx does (per-app beats global)
  const appKey    = (settings.appMode ?? 'hub') as AppKey;
  const activeVis = settings.perApp?.[appKey] ?? {
    theme:       settings.theme       ?? 'dark',
    accentColor: settings.accentColor ?? 'blue',
    amoledMode:  settings.amoledMode  ?? false,
  };
  const accent    = ACCENT_COLORS[activeVis.accentColor] ?? ACCENT_COLORS.blue;
  const isLight  = activeVis.theme === 'light' || (activeVis.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const amoledBg = activeVis.amoledMode
    ? 'rgba(4,4,4,0.88)'
    : isLight
      ? 'rgba(240,240,242,0.82)'
      : 'rgba(26,26,30,0.82)';
  const navHidden = useNavHidden();

  /* ── Sliding pill state ── */
  const navRef            = useRef<HTMLElement | null>(null);
  const btnRefs           = useRef<(HTMLButtonElement | null)[]>([]);
  const prevIdxRef        = useRef(NAV_ORDER.indexOf(activePanel));
  const stretchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pill, setPill]   = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  /* tracks which button is pressed for micro-interaction */
  const [pressedPanel, setPressedPanel] = useState<ActivePanel | null>(null);

  const measureBtn = (idx: number): { left: number; right: number } | null => {
    const btn = btnRefs.current[idx];
    const nav = navRef.current;
    if (!btn || !nav) return null;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return { left: btnRect.left - navRect.left, right: btnRect.right - navRect.left };
  };

  useEffect(() => {
    const m = measureBtn(NAV_ORDER.indexOf(activePanel));
    if (m) setPill({ left: m.left, right: m.right, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const newIdx = NAV_ORDER.indexOf(activePanel);
    const oldIdx = prevIdxRef.current;
    if (newIdx === oldIdx) return;
    prevIdxRef.current = newIdx;

    const newM = measureBtn(newIdx);
    if (!newM) return;

    if (stretchTimeoutRef.current) {
      /* A stretch was in-progress — cancel it and slide cleanly to new target
         so the pill never stays bridging two items. */
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel]);

  return (
    <nav
      ref={navRef}
      className="glass-nav fixed left-1/2 -translate-x-1/2 w-[90%] max-w-md flex justify-around items-center px-2 py-1.5"
      style={{
        bottom: 'max(10px, env(safe-area-inset-bottom))',
        borderRadius: '2rem',
        border: `1px solid ${isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.10)'}`,
        background: amoledBg,
        boxShadow: isLight
          ? '0 8px 32px rgba(0,0,0,0.14), 0 1.5px 0 rgba(255,255,255,0.80) inset'
          : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
        zIndex: 50,
        overflow: 'hidden',
        transform: navHidden ? 'translateY(calc(100% + 32px))' : 'translateY(0)',
        transition: [
          'transform 420ms cubic-bezier(0.4, 0, 0.2, 1)',
          'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
        ].join(', '),
      }}
    >
      {/* ── Elastic sliding pill ── */}
      {pill.ready && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '4px',
            left:  pill.left,
            width: pill.right - pill.left,
            height: 'calc(100% - 8px)',
            borderRadius: '9999px',
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            boxShadow: `0 2px 18px ${accent.to}60`,
            pointerEvents: 'none',
            zIndex: 0,
            transition: [
              'left  150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              'width 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            ].join(', '),
          }}
        />
      )}

      {/* ── Nav buttons ── */}
      {NAV_ITEMS.map(({ panel, Icon, label }, i) => {
        const isActive  = activePanel === panel;
        const isPressed = pressedPanel === panel;
        return (
          <button
            key={panel}
            ref={el => { btnRefs.current[i] = el; }}
            data-testid={`nav-${panel}`}
            onPointerDown={() => setPressedPanel(panel)}
            onPointerUp={() => { setPressedPanel(null); setActivePanel(panel); }}
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
              /* No scale on active — avoids subpixel blur on non-retina screens */
              transform: isPressed ? 'scale(0.91)' : 'scale(1)',
              transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
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
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility',
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

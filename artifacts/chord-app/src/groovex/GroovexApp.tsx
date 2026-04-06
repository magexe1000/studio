import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGroovexStore, type GroovexView } from './useGroovexStore';
import { GroovexLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, StudioLogo } from '../components/ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

const GroovexLibrary = lazy(() => import('./GroovexLibrary'));
const GroovexPlayer = lazy(() => import('./GroovexPlayer'));
const GroovexPreferences = lazy(() => import('./GroovexPreferences'));

export default function GroovexApp() {
  const { view, setView, activeSongId } = useGroovexStore();

  function handleBack() {
    if (view === 'player') {
      setView('library');
    } else {
      window.dispatchEvent(new Event('studio-hub-return'));
    }
  }

  return (
    <div className="groovex-root" style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: 'var(--gx-bg)',
      fontFamily: 'Manrope, sans-serif',
      paddingTop: 'env(safe-area-inset-top)',
      overflow: 'hidden',
    }}>

      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 24px 4px', flexShrink: 0,
        background: 'var(--gx-bg)',
      }}>
        {view === 'player' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleBack}
              className="btn-smooth"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--gx-surface-high)',
                border: '1px solid rgba(128,128,128,0.15)',
                cursor: 'pointer',
                animation: 'spring-in 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
                transition: 'background 500ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: 18 }}>arrow_back</span>
            </button>
          </div>
        ) : (
          <GroovexAppMenuLogo />
        )}
      </header>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Suspense fallback={null}>
          {view === 'library' && <GroovexLibrary />}
          {view === 'player' && <GroovexPlayer />}
          {view === 'preferences' && <GroovexPreferences />}
        </Suspense>
      </div>

      {view !== 'player' && (
        <GroovexNav view={view} setView={setView} hasActiveSong={!!activeSongId} />
      )}
    </div>
  );
}

const NAV_ORDER: GroovexView[] = ['library', 'preferences'];

function GroovexNav({ view, setView, hasActiveSong }: {
  view: GroovexView;
  setView: (v: GroovexView) => void;
  hasActiveSong: boolean;
}) {
  const items: { id: GroovexView; icon: string; label: string }[] = [
    { id: 'library', icon: 'library_music', label: 'Library' },
    { id: 'preferences', icon: 'tune', label: 'Preferences' },
  ];

  const navRef = useRef<HTMLElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const prevIdxRef = useRef(NAV_ORDER.indexOf(view));
  const stretchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pill, setPill] = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const [pressedId, setPressedId] = useState<GroovexView | null>(null);

  const measureBtn = (idx: number): { left: number; right: number } | null => {
    const btn = btnRefs.current[idx];
    const nav = navRef.current;
    if (!btn || !nav) return null;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return { left: btnRect.left - navRect.left, right: btnRect.right - navRect.left };
  };

  useEffect(() => {
    const m = measureBtn(NAV_ORDER.indexOf(view));
    if (m) setPill({ left: m.left, right: m.right, ready: true });
  }, []);

  useEffect(() => {
    const newIdx = NAV_ORDER.indexOf(view);
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

    return () => {
      if (stretchTimeoutRef.current) {
        clearTimeout(stretchTimeoutRef.current);
        stretchTimeoutRef.current = null;
      }
    };
  }, [view]);

  return (
    <nav
      ref={navRef}
      style={{
        position: 'fixed',
        bottom: 'max(10px, env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '70%',
        maxWidth: 280,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: '2rem',
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(26,26,30,0.82)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 50,
        overflow: 'hidden',
        transition: 'transform 420ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {pill.ready && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 4,
            left: pill.left,
            width: pill.right - pill.left,
            height: 'calc(100% - 8px)',
            borderRadius: 9999,
            background: 'linear-gradient(135deg, var(--gx-accent), var(--gx-accent-container))',
            boxShadow: '0 2px 18px rgba(0,122,255,0.35)',
            pointerEvents: 'none',
            zIndex: 0,
            transition: 'left 150ms cubic-bezier(0.34, 1.56, 0.64, 1), width 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      )}

      {items.map((item, i) => {
        const active = view === item.id;
        const pressed = pressedId === item.id;
        return (
          <button
            key={item.id}
            ref={el => { btnRefs.current[i] = el; }}
            onClick={() => setView(item.id)}
            onPointerDown={() => setPressedId(item.id)}
            onPointerUp={() => setPressedId(null)}
            onPointerLeave={() => setPressedId(null)}
            onPointerCancel={() => setPressedId(null)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '8px 4px',
              borderRadius: 9999,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: active ? '#fff' : 'var(--c-text-secondary)',
              position: 'relative',
              zIndex: 1,
              transform: pressed ? 'scale(0.91)' : 'scale(1)',
              transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <span className="material-symbols-outlined" style={{
              fontSize: 21,
              fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
            }}>{item.icon}</span>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: '9.5px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function GroovexAppMenuLogo() {
  const { settings, updateSettings } = useChordStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const accentKey = (settings.perApp?.groovex?.accentColor ?? settings.accentColor ?? 'blue') as keyof typeof ACCENT_COLORS;
  const accent = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  const OPTIONS: {
    value: string;
    Icon: React.FC<{ size?: number }>;
    label: string;
    desc: string;
  }[] = [
    { value: 'chords', Icon: ChordexLogo,    label: 'Chordex', desc: 'Chords & songs'     },
    { value: 'drums',  Icon: DrumexLogo,     label: 'Drumex',  desc: 'Drum sheets'         },
    { value: 'stage',  Icon: StagexLogoIcon, label: 'Stagex',  desc: 'Stage plot & rider'  },
    { value: 'groovex', Icon: GroovexLogo,   label: 'Groovex', desc: 'Multitrack mixer'    },
  ];

  const goToHub = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('studio-hub-return'));
  };

  const switchTo = (mode: string) => {
    setOpen(false);
    if (mode === 'groovex') return;
    updateSettings({ appMode: mode as 'chords' | 'drums' | 'stage' });
    window.dispatchEvent(new Event('studio-hub-return'));
    setTimeout(() => updateSettings({ appMode: mode as 'chords' | 'drums' | 'stage' }), 50);
  };

  const resolvedColor = '#d4d4d8';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '4px 6px 4px 0', margin: '-4px 0',
          color: resolvedColor,
        }}
      >
        <GroovexLogo size={14} />
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Manrope', letterSpacing: '-0.02em', color: resolvedColor }}>
          Groovex
        </span>
        <span style={{
          fontSize: 9, opacity: 0.4, marginLeft: -3, color: resolvedColor,
          display: 'inline-block',
          transform: open ? 'rotate(-180deg)' : 'rotate(0deg)',
          transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', left: 0,
          background: 'rgba(18,18,22,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          zIndex: 9999, minWidth: 200, overflow: 'hidden',
          transformOrigin: 'top left',
          animation: 'menu-pop 200ms cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <div style={{ padding: '12px 14px 6px' }}>
            <span style={{
              fontSize: 9, fontWeight: 800, fontFamily: 'Manrope',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.30)',
            }}>
              Switch App
            </span>
          </div>

          <div style={{ padding: '2px 8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {OPTIONS.map(opt => {
              const isActive = opt.value === 'groovex';
              return (
                <button
                  key={opt.value}
                  onClick={() => switchTo(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 10px',
                    background: isActive ? `${accent.from}18` : 'transparent',
                    border: isActive ? `1px solid ${accent.from}30` : '1px solid transparent',
                    borderRadius: 10,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 120ms',
                  }}
                >
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: isActive ? `${accent.from}22` : 'rgba(255,255,255,0.07)',
                    color: isActive ? accent.from : 'rgba(200,200,210,0.8)',
                    border: `1px solid ${isActive ? accent.from + '30' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'background 120ms',
                  }}>
                    <opt.Icon size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      color: isActive ? accent.from : '#e4e4e7',
                      fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, margin: 0,
                      letterSpacing: '-0.01em',
                    }}>{opt.label}</p>
                    <p style={{
                      color: 'rgba(255,255,255,0.35)',
                      fontFamily: 'Inter', fontSize: 10, margin: '1px 0 0',
                    }}>{opt.desc}</p>
                  </div>
                  {isActive && (
                    <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: 15, flexShrink: 0 }}>check</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 8px' }} />

          <div style={{ padding: 8 }}>
            <button
              onClick={goToHub}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '9px 10px',
                background: 'transparent', border: '1px solid transparent',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                transition: 'background 120ms',
              }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'white',
              }}>
                <StudioLogo size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: '#e4e4e7',
                  fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, margin: 0,
                  letterSpacing: '-0.01em',
                }}>Studio Hub</p>
                <p style={{
                  color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'Inter', fontSize: 10, margin: '1px 0 0',
                }}>Home screen</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

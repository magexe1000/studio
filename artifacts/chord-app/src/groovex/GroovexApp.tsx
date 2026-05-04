import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGroovexStore, type GroovexView } from './useGroovexStore';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { useT } from '../lib/useT';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import { useBackHandler } from '../lib/backStack';

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

  useBackHandler('nested', () => {
    if (view === 'player') {
      setView('library');
      return true;
    }
    if (view === 'preferences') {
      setView('library');
      return true;
    }
    return false;
  }, [view]);

  return (
    <div className="groovex-root" style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: 'var(--gx-bg)',
      fontFamily: 'Manrope, sans-serif',
      paddingTop: 'env(safe-area-inset-top)',
      overflow: 'hidden',
    }}>

      <header style={{
        display: 'flex', alignItems: 'center',
        padding: '24px 24px 4px', flexShrink: 0,
        background: 'var(--gx-bg)',
      }}>
        <div style={{
          overflow: 'hidden',
          flexShrink: 0,
          width: view === 'player' ? '40px' : '0px',
          opacity: view === 'player' ? 1 : 0,
          transition: 'width 300ms cubic-bezier(0.34,1.1,0.64,1), opacity 200ms ease',
        }}>
          <button
            onClick={handleBack}
            className="btn-smooth"
            aria-label="Back"
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--gx-surface-high)',
              border: '1px solid rgba(128,128,128,0.15)',
              cursor: 'pointer', padding: 0,
              transition: 'background 500ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: 18 }}>arrow_back</span>
          </button>
        </div>
        <AppModeMenuLogo />
      </header>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Suspense fallback={null}>
          <div key={view} className="panel-enter-right" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {view === 'library' && <GroovexLibrary />}
            {view === 'player' && <GroovexPlayer />}
            {view === 'preferences' && <GroovexPreferences />}
          </div>
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
  const { settings } = useChordStore();
  const groovexVis = settings.perApp?.groovex ?? { theme: 'dark', accentColor: 'blue', amoledMode: false };
  const isLight = groovexVis.theme === 'light' ||
    (groovexVis.theme === 'system' && typeof window !== 'undefined' &&
     window.matchMedia('(prefers-color-scheme: light)').matches);

  const t = useT();
  const items: { id: GroovexView; icon: string; label: string }[] = [
    { id: 'library', icon: 'library_music', label: t.groovex.library },
    { id: 'preferences', icon: 'tune', label: t.groovex.preferences },
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
        border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.10)',
        background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(26,26,30,0.82)',
        boxShadow: isLight
          ? '0 8px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.6) inset'
          : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
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
            onPointerDown={() => setPressedId(item.id)}
            onPointerUp={() => { setPressedId(null); setView(item.id); }}
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
              // Active pill is always filled with the accent gradient, so the
              // active label/icon must always be white — dark text would be
              // unreadable on the blue fill in light mode.
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

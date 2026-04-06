import { lazy, Suspense, useState } from 'react';
import { useGroovexStore, type GroovexView } from './useGroovexStore';

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
        padding: '0 16px', height: 56, flexShrink: 0,
        background: 'var(--gx-bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 6,
              borderRadius: 9999, color: 'var(--gx-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
          </button>
          <div>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text-primary)', letterSpacing: '-0.01em' }}>
              {view === 'player' ? 'Practice' : 'Groovex'}
            </span>
            {view === 'player' && (
              <p style={{ fontSize: 10, color: 'var(--c-text-secondary)', margin: '1px 0 0', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Multitrack Session
              </p>
            )}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Suspense fallback={null}>
          {view === 'library' && <GroovexLibrary />}
          {view === 'player' && <GroovexPlayer />}
          {view === 'preferences' && <GroovexPreferences />}
        </Suspense>
      </div>

      <GroovexNav view={view} setView={setView} hasActiveSong={!!activeSongId} />
    </div>
  );
}

function GroovexNav({ view, setView, hasActiveSong }: {
  view: GroovexView;
  setView: (v: GroovexView) => void;
  hasActiveSong: boolean;
}) {
  const items: { id: GroovexView; icon: string; iconFill?: boolean; label: string; disabled?: boolean }[] = [
    { id: 'library', icon: 'library_music', iconFill: view === 'library', label: 'Library' },
    { id: 'player', icon: 'graphic_eq', iconFill: view === 'player', label: 'Practice', disabled: !hasActiveSong },
    { id: 'preferences', icon: 'settings', iconFill: view === 'preferences', label: 'Preferences' },
  ];

  return (
    <nav style={{
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      height: 68, paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'rgba(25,26,26,0.65)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(128,128,128,0.08)',
      flexShrink: 0,
    }}>
      {items.map(item => {
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => !item.disabled && setView(item.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: active ? 'var(--gx-accent-container)' : 'transparent',
              color: active ? '#fff' : item.disabled ? 'rgba(172,171,170,0.3)' : 'var(--c-text-secondary)',
              border: 'none', cursor: item.disabled ? 'default' : 'pointer',
              borderRadius: active ? 9999 : 0,
              padding: active ? '4px 16px' : '4px 8px',
              transition: 'background 150ms ease, color 150ms ease',
              opacity: item.disabled ? 0.4 : 1,
            }}
          >
            <span className="material-symbols-outlined" style={{
              fontSize: 22,
              fontVariationSettings: item.iconFill ? "'FILL' 1" : "'FILL' 0",
            }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

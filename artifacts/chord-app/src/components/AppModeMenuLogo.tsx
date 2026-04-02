import { useState, useRef, useEffect } from 'react';
import { ChordexLogo } from './ChordexLogo';
import { useChordStore } from '../store/useChordStore';

export function AppModeMenuLogo({ color = 'var(--c-text-secondary)', size = 14 }: { color?: string; size?: number }) {
  const { settings, updateSettings } = useChordStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const currentMode = settings.appMode ?? 'chords';

  const OPTIONS = [
    { value: 'chords' as const, icon: 'library_music', label: 'Chordex', desc: 'Chord library & songs' },
    { value: 'drums'  as const, icon: 'album',         label: 'Drums',   desc: 'Drum sheet editor'   },
  ];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '4px 8px 4px 0', margin: '-4px 0',
          color,
        }}
      >
        <ChordexLogo size={size} />
        <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Manrope', letterSpacing: '-0.02em', color }}>
          Chordex
        </span>
        <span style={{
          fontSize: 9, opacity: 0.45, marginLeft: -2, color,
          display: 'inline-block',
          transform: open ? 'rotate(-180deg)' : 'rotate(0deg)',
          transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          background: 'var(--app-bg)',
          border: '1px solid rgba(128,128,128,0.18)',
          borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
          zIndex: 9999, minWidth: 196, overflow: 'hidden',
          transformOrigin: 'top left',
          animation: 'menu-pop 200ms cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          {OPTIONS.map((opt, i) => {
            const isActive = currentMode === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { updateSettings({ appMode: opt.value }); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '13px 14px',
                  background: isActive ? 'rgba(128,128,255,0.07)' : 'transparent',
                  border: 'none',
                  borderBottom: i < OPTIONS.length - 1 ? '1px solid rgba(128,128,128,0.09)' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 19, flexShrink: 0,
                    color: isActive ? 'var(--accent-from)' : 'var(--c-text-secondary)',
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {opt.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, margin: 0 }}>{opt.label}</p>
                  <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 11, margin: '2px 0 0' }}>{opt.desc}</p>
                </div>
                {isActive && (
                  <span className="material-symbols-outlined" style={{ color: 'var(--accent-from)', fontSize: 16, flexShrink: 0 }}>check</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

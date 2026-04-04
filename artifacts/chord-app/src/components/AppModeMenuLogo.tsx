import { useState, useRef, useEffect } from 'react';
import { ChordexLogo, DrumexLogo, StudioLogo, StageCoreLogoIcon } from './ChordexLogo';
import { useChordStore } from '../store/useChordStore';

export function AppModeMenuLogo({ color, size = 14 }: { color?: string; size?: number }) {
  const { settings, updateSettings } = useChordStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Auto-derive color from per-app theme when no explicit color is supplied
  const appKey = settings.appMode ?? 'chords';
  const activeVis = settings.perApp?.[appKey as keyof typeof settings.perApp] ?? { theme: settings.theme ?? 'dark', amoledMode: settings.amoledMode ?? false };
  const isLight = (activeVis as { theme: string }).theme === 'light' ||
    ((activeVis as { theme: string }).theme === 'system' && typeof window !== 'undefined' &&
     window.matchMedia('(prefers-color-scheme: light)').matches);
  const resolvedColor = color ?? (isLight ? '#18181b' : '#d4d4d8');

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

  const OPTIONS: {
    value: 'chords' | 'drums' | 'stage';
    Icon: React.FC<{ size?: number }>;
    label: string;
    desc: string;
  }[] = [
    { value: 'chords', Icon: ChordexLogo,       label: 'Chordex',    desc: 'Chord library & songs'   },
    { value: 'drums',  Icon: DrumexLogo,        label: 'Drumex',     desc: 'Drum sheet editor'       },
    { value: 'stage',  Icon: StageCoreLogoIcon, label: 'Stagex',     desc: 'Stage plot & tech rider' },
  ];

  const goToHub = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('studio-hub-return'));
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '4px 8px 4px 0', margin: '-4px 0',
          color: resolvedColor,
        }}
      >
        {currentMode === 'drums' ? <DrumexLogo size={size} /> : currentMode === 'stage' ? <StageCoreLogoIcon size={size} /> : <ChordexLogo size={size} />}
        <span style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Manrope', letterSpacing: '-0.02em', color: resolvedColor }}>
          {currentMode === 'drums' ? 'Drumex' : currentMode === 'stage' ? 'Stagex' : 'Chordex'}
        </span>
        <span style={{
          fontSize: 9, opacity: 0.45, marginLeft: -2, color: resolvedColor,
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
                  borderBottom: '1px solid rgba(128,128,128,0.09)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, flexShrink: 0,
                  color: 'var(--c-text-primary)',
                  opacity: isActive ? 1 : 0.75,
                }}>
                  <opt.Icon size={18} />
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
          {/* Hub shortcut */}
          <button
            onClick={goToHub}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '13px 14px',
              background: 'transparent', border: 'none',
              cursor: 'pointer',
            }}
          >
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, flexShrink: 0,
              color: isLight ? 'var(--c-text-primary)' : 'white',
            }}>
              <StudioLogo size={16} />
            </span>
            <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, margin: 0 }}>Back to Hub</p>
          </button>
        </div>
      )}
    </div>
  );
}

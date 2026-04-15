import { useState, useRef, useEffect } from 'react';
import { ChordexLogo, DrumexLogo, StudioLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

export function AppModeMenuLogo({ color, size = 14 }: { color?: string; size?: number }) {
  const { settings, updateSettings } = useChordStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const appKey = settings.appMode ?? 'chords';
  const activeVis = settings.perApp?.[appKey as keyof typeof settings.perApp] ?? {
    theme:       settings.theme       ?? 'dark',
    accentColor: settings.accentColor ?? 'blue',
    amoledMode:  settings.amoledMode  ?? false,
  };
  const isLight = (activeVis as { theme: string }).theme === 'light' ||
    ((activeVis as { theme: string }).theme === 'system' && typeof window !== 'undefined' &&
     window.matchMedia('(prefers-color-scheme: light)').matches);
  const resolvedColor = color ?? (isLight ? '#18181b' : '#d4d4d8');

  const accentKey = ((activeVis as { accentColor?: string }).accentColor ?? settings.accentColor ?? 'blue') as keyof typeof ACCENT_COLORS;
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

  const currentMode = settings.appMode ?? 'chords';

  const OPTIONS: {
    value: 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex';
    Icon: React.FC<{ size?: number }>;
    label: string;
    desc: string;
  }[] = [
    { value: 'chords',  Icon: ChordexLogo,    label: 'Chordex', desc: 'Chords & songs'       },
    { value: 'drums',   Icon: DrumexLogo,     label: 'Drumex',  desc: 'Drum sheets'          },
    { value: 'stage',   Icon: StagexLogoIcon, label: 'Stagex',  desc: 'Stage plot & rider'   },
    { value: 'groovex', Icon: GroovexLogo,    label: 'Groovex', desc: 'Multitrack mixer'     },
    { value: 'vocalex', Icon: VocalexLogo,    label: 'Vocalex', desc: 'Vocal tools & training' },
  ];

  const goToHub = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('studio-hub-return'));
  };

  const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
  const bgColor     = isLight ? 'rgba(252,252,253,0.98)' : 'rgba(18,18,22,0.98)';
  const divider     = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '4px 6px 4px 0', margin: '-4px 0',
          color: resolvedColor,
        }}
      >
        {currentMode === 'drums' ? <DrumexLogo size={size} /> : currentMode === 'stage' ? <StagexLogoIcon size={size} /> : currentMode === 'groovex' ? <GroovexLogo size={size} /> : currentMode === 'vocalex' ? <span style={{ display: 'inline-flex', transform: 'translateY(2px)' }}><VocalexLogo size={size} /></span> : <ChordexLogo size={size} />}
        <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'Manrope', letterSpacing: '-0.02em', color: resolvedColor }}>
          {currentMode === 'drums' ? 'Drumex' : currentMode === 'stage' ? 'Stagex' : currentMode === 'groovex' ? 'Groovex' : currentMode === 'vocalex' ? 'Vocalex' : 'Chordex'}
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
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 16,
          boxShadow: isLight
            ? '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)'
            : '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          zIndex: 9999, minWidth: 175, overflow: 'hidden',
          transformOrigin: 'top left',
          animation: 'menu-pop 200ms cubic-bezier(0.34,1.56,0.64,1) both',
        }}>

          <div style={{ padding: '10px 12px 4px' }}>
            <span style={{
              fontSize: 8, fontWeight: 800, fontFamily: 'Manrope',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.30)',
            }}>
              Switch App
            </span>
          </div>

          <div style={{ padding: '2px 6px 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {OPTIONS.map(opt => {
              const isActive = currentMode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { updateSettings({ appMode: opt.value }); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '7px 8px',
                    background: isActive
                      ? (isLight ? `${accent.from}14` : `${accent.from}18`)
                      : 'transparent',
                    border: isActive
                      ? `1px solid ${accent.from}30`
                      : '1px solid transparent',
                    borderRadius: 9,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 120ms',
                  }}
                >
                  <span style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    background: isActive
                      ? `${accent.from}22`
                      : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'),
                    color: isActive ? accent.from : (isLight ? 'rgba(0,0,0,0.55)' : 'rgba(200,200,210,0.8)'),
                    border: `1px solid ${isActive ? accent.from + '30' : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)')}`,
                    transition: 'background 120ms',
                  }}>
                    <opt.Icon size={13} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      color: isActive ? accent.from : (isLight ? '#18181b' : '#e4e4e7'),
                      fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, margin: 0,
                      letterSpacing: '-0.01em',
                    }}>{opt.label}</p>
                    <p style={{
                      color: isLight ? 'rgba(0,0,0,0.40)' : 'rgba(255,255,255,0.35)',
                      fontFamily: 'Inter', fontSize: 8.5, margin: '1px 0 0',
                    }}>{opt.desc}</p>
                  </div>
                  {isActive && (
                    <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: 13, flexShrink: 0 }}>check</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: divider, margin: '0 6px' }} />

          <div style={{ padding: '6px' }}>
            <button
              onClick={goToHub}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 8px',
                background: 'transparent', border: '1px solid transparent',
                borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                transition: 'background 120ms',
              }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                color: isLight ? '#18181b' : 'white',
              }}>
                <StudioLogo size={12} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: isLight ? '#18181b' : '#e4e4e7',
                  fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, margin: 0,
                  letterSpacing: '-0.01em',
                }}>Studio Hub</p>
                <p style={{
                  color: isLight ? 'rgba(0,0,0,0.40)' : 'rgba(255,255,255,0.35)',
                  fontFamily: 'Inter', fontSize: 8.5, margin: '1px 0 0',
                }}>Home screen</p>
              </div>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

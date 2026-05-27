import { useState, useEffect } from 'react';
import { StudioLogo } from './ChordexLogo';

const SPLASH_KEY = 'studio:splashShown';

export default function StartupSplash() {
  const [phase, setPhase] = useState<'wave' | 'exit' | 'done'>(() => {
    try {
      return sessionStorage.getItem(SPLASH_KEY) ? 'done' : 'wave';
    } catch {
      return 'done';
    }
  });

  useEffect(() => {
    if (phase !== 'wave') return;
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch {}
    const t1 = setTimeout(() => setPhase('exit'), 1500);
    const t2 = setTimeout(() => setPhase('done'), 1950);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0a',
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity 450ms cubic-bezier(0.4,0,1,1)' : 'none',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        color: '#ffffff',
        animation: 'studio-launch-wave 1500ms cubic-bezier(0.4,0,0.2,1) forwards',
      }}>
        <StudioLogo size={68} />
      </div>
      <div style={{
        marginTop: 16,
        textAlign: 'center',
        animation: 'studio-launch-text 1500ms cubic-bezier(0.4,0,0.2,1) forwards',
      }}>
        <p style={{
          color: '#ffffff',
          fontSize: 26, fontWeight: 800,
          fontFamily: 'Manrope, sans-serif',
          margin: '0 0 3px', letterSpacing: '-0.02em',
        }}>Studio</p>
        <p style={{
          color: 'rgba(255,255,255,0.42)',
          fontSize: 12,
          fontFamily: 'Manrope, sans-serif',
          margin: 0, letterSpacing: '0.05em',
        }}>by Mag</p>
      </div>
    </div>
  );
}

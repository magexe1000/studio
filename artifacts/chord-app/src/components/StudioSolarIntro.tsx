import { useState, useEffect, useMemo, useRef } from 'react';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

// Show once per browser session — users see it every time they open the app
const SESSION_KEY = 'studio_solar_shown';

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 6 planets evenly spaced — Studio is index 2 (3rd position)
const PLANET_DEFS = [
  { name: 'Chordex', glow: '#8b5cf6', Icon: ChordexLogo,    startAngle: 0,                  isStudio: false },
  { name: 'Drumex',  glow: '#f97316', Icon: DrumexLogo,     startAngle: Math.PI / 3,        isStudio: false },
  { name: 'Studio',  glow: 'accent',  Icon: StudioLogo,     startAngle: (Math.PI * 2) / 3,  isStudio: true  },
  { name: 'Stagex',  glow: '#f59e0b', Icon: StagexLogoIcon, startAngle: Math.PI,            isStudio: false },
  { name: 'Groovex', glow: '#10b981', Icon: GroovexLogo,    startAngle: (Math.PI * 4) / 3,  isStudio: false },
  { name: 'Vocalex', glow: '#3b82f6', Icon: VocalexLogo,    startAngle: (Math.PI * 5) / 3,  isStudio: false },
];

// Deterministic star field (44 stars, no Math.random() for SSR stability)
const STARS = Array.from({ length: 44 }, (_, i) => ({
  x:    ((i * 347 + 23) % 88) + 6,
  y:    ((i * 211 + 41) % 88) + 6,
  size: [1, 1.5, 1, 2, 1, 1.5, 1, 2.5][i % 8],
  del:  (i * 0.31) % 3,
  dur:  2.2 + (i % 3) * 0.7,
}));

// Final Y positions for 6 planets settling into a column (35px gaps)
const FINAL_Y = [-88, -53, -18, 17, 52, 87];

export default function StudioSolarIntro() {
  const shouldShow = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return false;
      sessionStorage.setItem(SESSION_KEY, '1');
      return true;
    } catch { return false; }
  }, []);

  const [visible,  setVisible]  = useState(shouldShow);
  const [fadeOut,  setFadeOut]  = useState(false);

  const planetRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null, null, null]);
  const ringRef    = useRef<SVGEllipseElement>(null);
  const starsRef   = useRef<HTMLDivElement>(null);
  const glowRef    = useRef<HTMLDivElement>(null);

  const { settings } = useChordStore();

  const rawTheme      = settings.theme;
  const sysLight      = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: light)').matches : false;
  const resolvedTheme = rawTheme === 'system' ? (sysLight ? 'light' : 'dark') : rawTheme;
  const isLight       = resolvedTheme === 'light';
  const isAmoled      = !isLight && !!settings.amoledMode;

  const bg          = isLight ? '#f2f1ef' : isAmoled ? '#000000' : '#0e0e0e';
  const textPri     = isLight ? '#1a1a1a' : '#e7e5e4';
  const textSec     = isLight ? '#6e6d6b' : '#acabaa';
  const ringColor   = isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.16)';
  const starColor   = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.55)';
  const pillBg      = isLight ? 'rgba(0,0,0,0.07)'  : 'rgba(255,255,255,0.08)';
  const pillBorder  = isLight ? 'rgba(0,0,0,0.10)'  : 'rgba(255,255,255,0.11)';

  const accent = ACCENT_COLORS[settings.accentColor ?? 'blue'] ?? ACCENT_COLORS.blue;

  useEffect(() => {
    if (!shouldShow) return;

    const R = Math.min(Math.min(window.innerWidth, window.innerHeight) * 0.35, 148);

    if (ringRef.current) {
      ringRef.current.setAttribute('rx', String(R));
      ringRef.current.setAttribute('ry', String(R));
    }

    const ORBIT_PERIOD = 2600;
    const ENTER_END    = 420;
    const ORBIT_END    = 2700;
    const SETTLE_END   = 3430;
    const FADEOUT_END  = 3850;

    let raf: number;
    const t0 = performance.now();
    let fadeOutFired = false;
    let doneFired    = false;

    const tick = (now: number) => {
      const elapsed = now - t0;

      if (elapsed >= FADEOUT_END) {
        if (!doneFired) { doneFired = true; setVisible(false); }
        return;
      }
      if (elapsed >= SETTLE_END && !fadeOutFired) {
        fadeOutFired = true;
        setFadeOut(true);
      }

      const settling    = elapsed > ORBIT_END;
      const settleT     = settling ? Math.min((elapsed - ORBIT_END) / (SETTLE_END - ORBIT_END), 1) : 0;
      const easedS      = easeInOut(settleT);

      const orbitBase   = elapsed - ENTER_END;
      const settleExtra = settling ? (elapsed - ORBIT_END) * (1 - easedS * 0.92) : 0;
      const baseElapsed = settling
        ? (ORBIT_END - ENTER_END) + settleExtra
        : Math.max(0, orbitBase);
      const currentR    = R * (1 - easedS);

      if (ringRef.current)  ringRef.current.style.opacity  = String(Math.max(0, 1 - easedS * 1.6));
      if (starsRef.current) starsRef.current.style.opacity = String(Math.max(0, 1 - easedS * 1.3));
      if (glowRef.current)  glowRef.current.style.opacity  = String(Math.max(0, 1 - easedS * 1.4));

      PLANET_DEFS.forEach((def, i) => {
        const el   = planetRefs.current[i];
        if (!el) return;
        const half  = def.isStudio ? 27 : 22;
        const angle = def.startAngle + (baseElapsed / ORBIT_PERIOD) * Math.PI * 2;
        const tx    = Math.cos(angle) * currentR * (1 - easedS);
        const ty    = Math.sin(angle) * currentR * (1 - easedS) + FINAL_Y[i] * easedS;
        el.style.transform = `translate(${tx - half}px, ${ty - half}px)`;
        if (settling) el.style.opacity = String(Math.max(0, 1 - easedS * 0.45));
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shouldShow]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      data-solar-intro=""
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: bg, overflow: 'hidden',
        opacity: fadeOut ? 0 : 1,
        transition: fadeOut ? 'opacity 420ms cubic-bezier(0.4,0,1,1)' : 'none',
        pointerEvents: fadeOut ? 'none' : 'auto',
        userSelect: 'none',
      }}
      onClick={() => {
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
        setFadeOut(true);
        setTimeout(() => setVisible(false), 420);
      }}
    >
      {/* Star field */}
      <div ref={starsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {STARS.map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: '50%', background: starColor,
            opacity: 0,
            animation: `solar-twinkle ${s.dur}s ${s.del}s ease-in-out infinite`,
          }} />
        ))}
      </div>

      {/* Orbit ring */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <ellipse
          ref={ringRef}
          cx="50%" cy="50%" rx={148} ry={148}
          fill="none" strokeWidth={0.75} strokeDasharray="3 12"
          style={{ stroke: ringColor, opacity: 0, animation: 'solar-ring-in 600ms 200ms ease-out forwards' }}
        />
      </svg>

      {/* Center nebula glow — no icon, no blue box */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 240, height: 240, borderRadius: '50%',
          background: `radial-gradient(circle, ${accent.from}2a 0%, ${accent.from}10 45%, transparent 70%)`,
          animation: 'solar-glow-pulse 3.5s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* Center wordmark */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -52%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        animation: 'solar-sun-in 700ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        zIndex: 2, pointerEvents: 'none',
      }}>
        <p style={{
          color: textPri, fontSize: 28, fontWeight: 800,
          fontFamily: 'Manrope, sans-serif', margin: 0, letterSpacing: '-0.03em',
        }}>Studio</p>
        <p style={{
          color: textSec, fontSize: 11,
          fontFamily: 'Manrope, sans-serif', margin: 0, letterSpacing: '0.06em',
        }}>by Mag</p>
      </div>

      {/* Orbiting planets */}
      {PLANET_DEFS.map((def, i) => {
        const size        = def.isStudio ? 54 : 44;
        const iconSize    = def.isStudio ? 28 : 22;
        const glowColor   = def.isStudio ? accent.from : def.glow;
        const borderStyle = def.isStudio
          ? `1px solid ${accent.from}55`
          : `1px solid ${pillBorder}`;
        const bgStyle     = def.isStudio
          ? `${accent.from}18`
          : pillBg;

        return (
          <div
            key={def.name}
            ref={el => { planetRefs.current[i] = el; }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              width: size, height: size,
              opacity: 0, willChange: 'transform, opacity',
              animation: `solar-planet-in 380ms ${500 + i * 90}ms ease-out forwards`,
              pointerEvents: 'none', zIndex: 1,
            }}
          >
            <div style={{
              width: size, height: size,
              borderRadius: def.isStudio ? 17 : 14,
              background: bgStyle,
              border: borderStyle,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: def.isStudio
                ? `0 0 20px 7px ${glowColor}55, 0 0 44px 18px ${glowColor}22`
                : `0 0 10px 3px ${glowColor}45`,
            }}>
              <def.Icon size={iconSize} />
            </div>
          </div>
        );
      })}

      {/* Tap-to-skip hint */}
      <p style={{
        position: 'absolute',
        bottom: 'max(28px, env(safe-area-inset-bottom, 28px))',
        width: '100%', textAlign: 'center', margin: 0,
        color: textSec, fontSize: 11,
        fontFamily: 'Manrope, sans-serif', letterSpacing: '0.05em',
        opacity: 0,
        animation: 'solar-planet-in 500ms 1400ms ease-out forwards',
        pointerEvents: 'none',
      }}>
        tap to skip
      </p>
    </div>
  );
}

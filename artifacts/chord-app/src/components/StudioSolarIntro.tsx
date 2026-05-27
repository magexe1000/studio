import { useState, useEffect, useMemo, useRef } from 'react';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

const SOLAR_KEY  = 'studio_solar_intro_seen';
const SPLASH_KEY = 'studio:splashShown';

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 5 planets, evenly distributed around the orbit ring
const PLANET_DEFS = [
  { name: 'Chordex', glow: '#8b5cf6', Icon: ChordexLogo,    startAngle: 0                    },
  { name: 'Drumex',  glow: '#f97316', Icon: DrumexLogo,     startAngle: (Math.PI * 2) / 5    },
  { name: 'Stagex',  glow: '#f59e0b', Icon: StagexLogoIcon, startAngle: (Math.PI * 4) / 5    },
  { name: 'Groovex', glow: '#10b981', Icon: GroovexLogo,    startAngle: (Math.PI * 6) / 5    },
  { name: 'Vocalex', glow: '#3b82f6', Icon: VocalexLogo,    startAngle: (Math.PI * 8) / 5    },
] as const;

// Deterministic star field — no Math.random() to stay SSR-safe and stable
const STARS = Array.from({ length: 26 }, (_, i) => ({
  x:    ((i * 347 + 23) % 88) + 6,
  y:    ((i * 211 + 41) % 88) + 6,
  size: [1, 1.5, 1, 2, 1, 1.5][i % 6],
  del:  (i * 0.31) % 3,
  dur:  2.2 + (i % 3) * 0.7,
}));

// Final Y positions (px from center) when planets settle
const FINAL_Y = [-88, -44, 0, 44, 88];

export default function StudioSolarIntro() {
  // Synchronously decide whether to show — set sessionStorage immediately so
  // StartupSplash (which renders after this) skips itself.
  const shouldShow = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    try {
      if (localStorage.getItem(SOLAR_KEY)) return false;
      sessionStorage.setItem(SPLASH_KEY, '1'); // preempt StartupSplash
      return true;
    } catch { return false; }
  }, []);

  const [visible,  setVisible]  = useState(shouldShow);
  const [fadeOut,  setFadeOut]  = useState(false);

  const planetRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null, null]);
  const ringRef    = useRef<SVGEllipseElement>(null);
  const starsRef   = useRef<HTMLDivElement>(null);
  const sunRef     = useRef<HTMLDivElement>(null);

  const { settings } = useChordStore();

  // Derive all colours synchronously (before CSS vars are applied by App.tsx)
  const rawTheme = settings.theme;
  const sysLight = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: light)').matches
    : false;
  const resolvedTheme = rawTheme === 'system' ? (sysLight ? 'light' : 'dark') : rawTheme;
  const isLight  = resolvedTheme === 'light';
  const isAmoled = !isLight && !!settings.amoledMode;

  const bg         = isLight ? '#f2f1ef' : isAmoled ? '#000000' : '#0e0e0e';
  const textPri    = isLight ? '#1a1a1a' : '#e7e5e4';
  const textSec    = isLight ? '#6e6d6b' : '#acabaa';
  const ringColor  = isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.16)';
  const starColor  = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.55)';
  const pillBg     = isLight ? 'rgba(0,0,0,0.07)'  : 'rgba(255,255,255,0.10)';
  const pillBorder = isLight ? 'rgba(0,0,0,0.09)'  : 'rgba(255,255,255,0.10)';

  const accent = ACCENT_COLORS[settings.accentColor ?? 'blue'] ?? ACCENT_COLORS.blue;

  useEffect(() => {
    if (!shouldShow) return;

    try { localStorage.setItem(SOLAR_KEY, '1'); } catch {}

    // Orbit radius: 35% of the smaller screen dimension, capped at 148px
    const R = Math.min(Math.min(window.innerWidth, window.innerHeight) * 0.35, 148);
    const ICON_HALF = 22; // half of 44px icon size

    if (ringRef.current) {
      ringRef.current.setAttribute('rx', String(R));
      ringRef.current.setAttribute('ry', String(R));
    }

    //  ── Phase timing (ms) ──────────────────────────────────────────────
    const ORBIT_PERIOD  = 2800;   // ms per revolution
    const ENTER_END     = 420;    // CSS enter animations complete
    const ORBIT_END     = 2780;   // 2360ms of live orbiting
    const SETTLE_END    = 3510;   // 730ms deceleration + convergence
    const FADEOUT_END   = 3930;   // 420ms CSS opacity fade

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

      const settling  = elapsed > ORBIT_END;
      const settleT   = settling ? Math.min((elapsed - ORBIT_END) / (SETTLE_END - ORBIT_END), 1) : 0;
      const easedS    = easeInOut(settleT);

      // Orbit elapsed — decelerate during settle phase
      const orbitBase    = elapsed - ENTER_END;
      const settleExtra  = settling ? (elapsed - ORBIT_END) * (1 - easedS * 0.92) : 0;
      const baseElapsed  = settling
        ? (ORBIT_END - ENTER_END) + settleExtra
        : Math.max(0, orbitBase);
      const currentR     = R * (1 - easedS);

      // Fade out orbit ring and stars as we settle
      if (ringRef.current) {
        ringRef.current.style.opacity = String(Math.max(0, 1 - easedS * 1.6));
      }
      if (starsRef.current) {
        starsRef.current.style.opacity = String(Math.max(0, 1 - easedS * 1.3));
      }
      // Shrink and fade the sun label slightly
      if (sunRef.current && settling) {
        const s = 1 - easedS * 0.06;
        sunRef.current.style.transform = `translate(-50%, -52%) scale(${s})`;
      }

      PLANET_DEFS.forEach((def, i) => {
        const el = planetRefs.current[i];
        if (!el) return;

        const angle  = def.startAngle + (baseElapsed / ORBIT_PERIOD) * Math.PI * 2;
        const orbitX = Math.cos(angle) * currentR;
        const orbitY = Math.sin(angle) * currentR;

        // Converge X to 0, lerp Y toward stacked final position
        const tx = orbitX * (1 - easedS);
        const ty = orbitY * (1 - easedS) + FINAL_Y[i] * easedS;

        el.style.transform = `translate(${tx - ICON_HALF}px, ${ty - ICON_HALF}px)`;
        if (settling) {
          el.style.opacity = String(Math.max(0, 1 - easedS * 0.45));
        }
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
        background: bg,
        overflow: 'hidden',
        opacity:    fadeOut ? 0 : 1,
        transition: fadeOut ? 'opacity 420ms cubic-bezier(0.4,0,1,1)' : 'none',
        pointerEvents: fadeOut ? 'none' : 'auto',
        userSelect: 'none',
      }}
      onClick={() => {
        try {
          localStorage.setItem(SOLAR_KEY, '1');
          sessionStorage.setItem(SPLASH_KEY, '1');
        } catch {}
        setFadeOut(true);
        setTimeout(() => setVisible(false), 420);
      }}
    >
      {/* ── Star field ──────────────────────────────────────────── */}
      <div ref={starsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {STARS.map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: '50%',
            background: starColor,
            opacity: 0,
            animation: `solar-twinkle ${s.dur}s ${s.del}s ease-in-out infinite`,
          }} />
        ))}
      </div>

      {/* ── Orbit ring ──────────────────────────────────────────── */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <ellipse
          ref={ringRef}
          cx="50%" cy="50%"
          rx={148} ry={148}
          fill="none"
          strokeWidth={0.75}
          strokeDasharray="3 12"
          style={{
            stroke: ringColor,
            opacity: 0,
            animation: 'solar-ring-in 600ms 200ms ease-out forwards',
          }}
        />
      </svg>

      {/* ── Studio sun (center) ─────────────────────────────────── */}
      <div
        ref={sunRef}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -52%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          animation: 'solar-sun-in 700ms cubic-bezier(0.34,1.56,0.64,1) forwards',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 30px 12px ${accent.from}55, 0 0 60px 24px ${accent.from}22`,
        }}>
          <StudioLogo size={38} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{
            color: textPri, fontSize: 24, fontWeight: 800,
            fontFamily: 'Manrope, sans-serif', margin: 0, letterSpacing: '-0.03em',
          }}>Studio</p>
          <p style={{
            color: textSec, fontSize: 11,
            fontFamily: 'Manrope, sans-serif', margin: '2px 0 0', letterSpacing: '0.05em',
          }}>by Mag</p>
        </div>
      </div>

      {/* ── Orbiting planet icons ────────────────────────────────── */}
      {PLANET_DEFS.map((def, i) => (
        <div
          key={def.name}
          ref={el => { planetRefs.current[i] = el; }}
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 44, height: 44,
            opacity: 0,
            willChange: 'transform, opacity',
            animation: `solar-planet-in 380ms ${500 + i * 95}ms ease-out forwards`,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: pillBg,
            border: `1px solid ${pillBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 10px 3px ${def.glow}45`,
          }}>
            <def.Icon size={22} />
          </div>
        </div>
      ))}


      {/* ── Tap-to-skip hint ─────────────────────────────────────── */}
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

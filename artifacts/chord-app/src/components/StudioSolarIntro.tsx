import { useState, useEffect, useMemo, useRef } from 'react';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// 6 planets — Studio is index 2 (3rd position, orbits like the others)
const PLANET_DEFS = [
  { name: 'Chordex', glow: '#8b5cf6', Icon: ChordexLogo,    startAngle: 0,                  isStudio: false },
  { name: 'Drumex',  glow: '#f97316', Icon: DrumexLogo,     startAngle: Math.PI / 3,        isStudio: false },
  { name: 'Studio',  glow: 'accent',  Icon: StudioLogo,     startAngle: (Math.PI * 2) / 3,  isStudio: true  },
  { name: 'Stagex',  glow: '#f59e0b', Icon: StagexLogoIcon, startAngle: Math.PI,            isStudio: false },
  { name: 'Groovex', glow: '#10b981', Icon: GroovexLogo,    startAngle: (Math.PI * 4) / 3,  isStudio: false },
  { name: 'Vocalex', glow: '#3b82f6', Icon: VocalexLogo,    startAngle: (Math.PI * 5) / 3,  isStudio: false },
];

const STARS = Array.from({ length: 44 }, (_, i) => ({
  x:    ((i * 347 + 23) % 88) + 6,
  y:    ((i * 211 + 41) % 88) + 6,
  size: [1, 1.5, 1, 2, 1, 1.5, 1, 2.5][i % 8],
  del:  (i * 0.31) % 3,
  dur:  2.2 + (i % 3) * 0.7,
}));

export default function StudioSolarIntro() {
  // Always play on mount. Respect reduced-motion users by skipping the animation.
  const shouldShow = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  }, []);

  const [visible, setVisible] = useState(shouldShow);
  const [fadeOut, setFadeOut] = useState(false);

  const planetRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null, null, null]);
  const ringRef    = useRef<SVGEllipseElement>(null);
  const starsRef   = useRef<HTMLDivElement>(null);
  const glowRef    = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);

  // Stores the (x,y) each planet flies toward during the settle phase
  const finalPosRef = useRef<{ x: number; y: number }[]>([]);

  const { settings } = useChordStore();
  const rawTheme      = settings.theme;
  const sysLight      = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: light)').matches : false;
  const resolvedTheme = rawTheme === 'system' ? (sysLight ? 'light' : 'dark') : rawTheme;
  const isLight       = resolvedTheme === 'light';
  const isAmoled      = !isLight && !!settings.amoledMode;

  const bg         = isLight ? '#f2f1ef' : isAmoled ? '#000000' : '#0e0e0e';
  const textPri    = isLight ? '#1a1a1a' : '#e7e5e4';
  const textSec    = isLight ? '#6e6d6b' : '#acabaa';
  const ringColor  = isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.16)';
  const starColor  = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.55)';
  const pillBg     = isLight ? 'rgba(0,0,0,0.07)'  : 'rgba(255,255,255,0.08)';
  const pillBorder = isLight ? 'rgba(0,0,0,0.10)'  : 'rgba(255,255,255,0.11)';

  const accent = ACCENT_COLORS[settings.accentColor ?? 'blue'] ?? ACCENT_COLORS.blue;

  useEffect(() => {
    if (!shouldShow) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const R = Math.min(Math.min(W, H) * 0.35, 148);

    if (ringRef.current) {
      ringRef.current.setAttribute('rx', String(R));
      ringRef.current.setAttribute('ry', String(R));
    }

    // ── Compute final positions (approximate home screen icon locations) ──
    // These are offsets from screen center (50%, 50%)
    const cx = W / 2;
    const cy = H / 2;

    // Studio waveform logo sits near the top of the home screen (≈11% from top)
    const studioFinalX = 0;
    const studioFinalY = H * 0.11 - cy;

    // App icons sit in a left-aligned column, in a card that starts ≈27% down
    const cardTopY = H * 0.27;
    const rowH     = Math.min(68, H * 0.082);
    const iconCX   = -(cx - 82); // icon centers ≈82px from left edge

    // Map PLANET_DEFS[i] → home screen row
    // [0]=Chordex row0, [1]=Drumex row1, [2]=Studio header, [3]=Stagex row2, [4]=Groovex row3, [5]=Vocalex row4
    const rowMap = [0, 1, -1, 2, 3, 4];
    finalPosRef.current = PLANET_DEFS.map((def, i) => {
      if (def.isStudio) return { x: studioFinalX, y: studioFinalY };
      const row = rowMap[i];
      return { x: iconCX, y: cardTopY + 48 + row * rowH - cy };
    });

    // ── Timing (ms) ────────────────────────────────────────────────────────
    // Generous orbit phase so the animation is unmissable even when the
    // React app takes a couple of seconds to finish first paint.
    const ORBIT_PERIOD  = 3200;  // one full revolution
    const ENTER_END     = 0;     // orbit starts immediately (enter is rAF-driven)
    const ORBIT_END     = 5200;  // ~5.2s of visible orbiting
    const STAGGER_MS    = 80;    // each planet starts settling 80ms after the previous
    const SETTLE_DUR    = 820;   // each planet's settle animation lasts 820ms
    const LAST_START    = ORBIT_END + (PLANET_DEFS.length - 1) * STAGGER_MS;
    const SETTLE_END    = LAST_START + SETTLE_DUR;
    const FADEOUT_END   = SETTLE_END + 420;

    // Enter: staggered fade-in fully via rAF (no CSS animation on planets)
    const ENTER_STAGGER = 130; // ms between each planet's fade-in start
    const ENTER_DUR     = 380; // fade-in duration per planet

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
      // Global settle progress (for ring/stars/glow fade)
      const settleT     = settling
        ? Math.min((elapsed - ORBIT_END) / (SETTLE_END - ORBIT_END), 1)
        : 0;
      const easedS      = easeOut(settleT);

      // Orbit elapsed — decelerate during settle so planets slow down
      const orbitBase    = Math.max(0, elapsed - ENTER_END);
      const settleExtra  = settling
        ? (elapsed - ORBIT_END) * (1 - easeInOut(Math.min((elapsed - ORBIT_END) / 600, 1)) * 0.94)
        : 0;
      const baseElapsed  = settling
        ? (ORBIT_END - ENTER_END) + settleExtra
        : orbitBase;

      if (ringRef.current)    ringRef.current.style.opacity    = String(Math.max(0, 1 - easedS * 1.5));
      if (starsRef.current)   starsRef.current.style.opacity   = String(Math.max(0, 1 - easedS * 1.2));
      if (glowRef.current)    glowRef.current.style.opacity    = String(Math.max(0, 1 - easedS * 1.3));
      if (wordmarkRef.current) wordmarkRef.current.style.opacity = String(Math.max(0, 1 - easedS * 1.6));

      PLANET_DEFS.forEach((def, i) => {
        const el   = planetRefs.current[i];
        if (!el) return;
        const half  = def.isStudio ? 27 : 22;
        const angle = def.startAngle + (baseElapsed / ORBIT_PERIOD) * Math.PI * 2;
        const orbitX = Math.cos(angle) * R;
        const orbitY = Math.sin(angle) * R;

        if (!settling) {
          // Always set position
          el.style.transform = `translate(${orbitX - half}px, ${orbitY - half}px)`;
          // Staggered enter fade-in (fully via rAF — no CSS animation)
          const fadeStart   = i * ENTER_STAGGER;
          const fadeElapsed = Math.max(0, elapsed - fadeStart);
          el.style.opacity  = String(Math.min(easeOut(fadeElapsed / ENTER_DUR), 1));
        } else {
          // Per-planet staggered settle
          const pDelay   = i * STAGGER_MS;
          const pElapsed = Math.max(0, elapsed - ORBIT_END - pDelay);
          const pEase    = easeInOut(Math.min(pElapsed / SETTLE_DUR, 1));

          const fp = finalPosRef.current[i] ?? { x: 0, y: 0 };
          const tx = orbitX * (1 - pEase) + fp.x * pEase;
          const ty = orbitY * (1 - pEase) + fp.y * pEase;

          el.style.transform = `translate(${tx - half}px, ${ty - half}px)`;
          // Fade fully to 0 — smooth eased fade, slightly delayed so planet moves first
          el.style.opacity   = String(Math.max(0, 1 - Math.pow(pEase, 0.65)));
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
        background: bg, overflow: 'hidden',
        opacity:    fadeOut ? 0 : 1,
        transition: fadeOut ? 'opacity 380ms cubic-bezier(0.4,0,1,1)' : 'none',
        pointerEvents: fadeOut ? 'none' : 'auto',
        userSelect: 'none',
      }}
      onClick={() => {
        setFadeOut(true);
        setTimeout(() => setVisible(false), 380);
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

      {/* Center nebula glow */}
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
      <div
        ref={wordmarkRef}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -52%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          animation: 'solar-sun-in 700ms cubic-bezier(0.34,1.56,0.64,1) forwards',
          zIndex: 2, pointerEvents: 'none',
        }}
      >
        <p style={{
          color: textPri, fontSize: 28, fontWeight: 800,
          fontFamily: 'Manrope, sans-serif', margin: 0, letterSpacing: '-0.03em', lineHeight: 1,
        }}>
          {'Studio'.split('').map((char, i) => (
            <span key={i} style={{
              display: 'inline-block',
              animation: `char-reveal 0.45s ${0.18 + i * 0.06}s cubic-bezier(0.22,1,0.36,1) both`,
            }}>{char}</span>
          ))}
        </p>
        <style>{`@keyframes char-reveal{from{opacity:0;transform:translateY(9px);filter:blur(4px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}`}</style>
      </div>

      {/* Orbiting planets */}
      {PLANET_DEFS.map((def, i) => {
        const size        = def.isStudio ? 54 : 44;
        const iconSize    = def.isStudio ? 28 : 22;
        const glowColor   = def.isStudio ? accent.from : def.glow;
        const borderStyle = def.isStudio ? `1px solid ${accent.from}55` : `1px solid ${pillBorder}`;
        const bgStyle     = def.isStudio ? `${accent.from}18` : pillBg;
        // Pre-position at orbit angle so planets never flash at screen-center.
        // 128px ≈ median R across device sizes; rAF corrects on the first tick.
        const half  = def.isStudio ? 27 : 22;
        const initX = Math.cos(def.startAngle) * 128 - half;
        const initY = Math.sin(def.startAngle) * 128 - half;

        return (
          <div
            key={def.name}
            ref={el => { planetRefs.current[i] = el; }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              width: size, height: size,
              opacity: 0,                                   // rAF owns opacity fully
              transform: `translate(${initX}px, ${initY}px)`, // rAF corrects on first tick
              willChange: 'transform, opacity',
              pointerEvents: 'none', zIndex: 1,
            }}
          >
            <div style={{
              width: size, height: size,
              borderRadius: def.isStudio ? 17 : 14,
              background: bgStyle, border: borderStyle,
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

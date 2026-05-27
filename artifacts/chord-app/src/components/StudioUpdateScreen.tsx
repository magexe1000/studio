import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import AnimatedProgressBar from './AnimatedProgressBar';

/**
 * StudioUpdateScreen — fullscreen overlay shown exclusively during the OTA
 * download/install process.
 *
 * Background: animate-ui BubbleBackground (blurred radial-gradient blobs)
 * Loader:     KokonutUI Loader (multi-ring conic-gradient, accent-colored)
 * Bar:        AnimatedProgressBar
 * Text:       rotating status messages
 */

const MESSAGES = [
  "Sit tight, we're almost there",
  'Preparing your update',
  'Almost ready',
  'Finishing things up',
  'Making things smoother',
];

interface StudioUpdateScreenProps {
  progress: number;
  accentFrom: string;
  accentTo: string;
}

export default function StudioUpdateScreen({
  progress,
  accentFrom,
  accentTo,
}: StudioUpdateScreenProps) {
  const [msgIdx, setMsgIdx] = useState(0);
  const pct = Math.round(progress * 100);

  useEffect(() => {
    const id = setInterval(
      () => setMsgIdx(i => (i + 1) % MESSAGES.length),
      2800,
    );
    return () => clearInterval(id);
  }, []);

  /* ── helpers ─────────────────────────────────────────────────────────── */
  const mix = (color: string, pct: number) =>
    `color-mix(in srgb, ${color} ${pct}%, transparent)`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--app-bg, #0a0a0c)',
      }}
    >
      {/* ── animate-ui BubbleBackground ────────────────────────────────── */}

      {/* SVG goo filter — makes blobs merge softly */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, top: 0, left: 0 }}
      >
        <defs>
          <filter id="su-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Blobs layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: 'url(#su-goo) blur(40px)',
        }}
      >
        {/* Primary blob — oscillates vertically */}
        <motion.div
          style={{
            position: 'absolute',
            width: '80%',
            height: '80%',
            top: '10%',
            left: '10%',
            borderRadius: '50%',
            mixBlendMode: 'screen',
            background: `radial-gradient(circle at center, ${mix(accentFrom, 55)} 0%, ${mix(accentFrom, 0)} 60%)`,
            willChange: 'transform',
          }}
          animate={{ y: [-60, 60, -60] }}
          transition={{ duration: 28, ease: 'easeInOut', repeat: Infinity }}
        />

        {/* Second blob — orbits around offset pivot */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformOrigin: 'calc(50% - 380px) 50%',
            willChange: 'transform',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
        >
          <div
            style={{
              width: '75%',
              height: '75%',
              borderRadius: '50%',
              mixBlendMode: 'screen',
              background: `radial-gradient(circle at center, ${mix(accentTo, 45)} 0%, ${mix(accentTo, 0)} 55%)`,
            }}
          />
        </motion.div>

        {/* Third blob — orbits opposite pivot */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformOrigin: 'calc(50% + 380px) 50%',
            willChange: 'transform',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 38, ease: 'linear', repeat: Infinity }}
        >
          <div
            style={{
              position: 'absolute',
              width: '70%',
              height: '70%',
              top: 'calc(50% + 140px)',
              left: 'calc(50% - 400px)',
              borderRadius: '50%',
              mixBlendMode: 'screen',
              background: `radial-gradient(circle at center, ${mix(accentFrom, 35)} 0%, ${mix(accentFrom, 0)} 55%)`,
            }}
          />
        </motion.div>

        {/* Fourth blob — oscillates horizontally */}
        <motion.div
          style={{
            position: 'absolute',
            width: '80%',
            height: '80%',
            top: '10%',
            left: '10%',
            borderRadius: '50%',
            mixBlendMode: 'screen',
            background: `radial-gradient(circle at center, ${mix(accentTo, 28)} 0%, ${mix(accentTo, 0)} 60%)`,
            willChange: 'transform',
          }}
          animate={{ x: [-50, 50, -50] }}
          transition={{ duration: 36, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>

      {/* ── Centered content ───────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          padding: '0 32px',
          width: '100%',
          maxWidth: 340,
        }}
      >
        {/* KokonutUI Loader — accent-colored rings */}
        <motion.div
          style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}
          animate={{ scale: [1, 1.015, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
        >
          {/* Ring 1 — outermost thin ring, fast */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, transparent 0deg, ${accentFrom} 90deg, transparent 180deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)',
              WebkitMask:
                'radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)',
              opacity: 0.85,
              willChange: 'transform',
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />

          {/* Ring 2 — primary wide ring, medium speed */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, transparent 0deg, ${accentFrom} 120deg, ${mix(accentTo, 55)} 240deg, transparent 360deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)',
              WebkitMask:
                'radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 48%, transparent 50%)',
              opacity: 0.95,
              willChange: 'transform',
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
          />

          {/* Ring 3 — counter-rotating, slow */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 180deg, transparent 0deg, ${mix(accentTo, 60)} 45deg, transparent 90deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)',
              WebkitMask:
                'radial-gradient(circle at 50% 50%, transparent 52%, black 54%, black 56%, transparent 58%)',
              opacity: 0.45,
              willChange: 'transform',
            }}
            animate={{ rotate: [0, -360] }}
            transition={{ duration: 4, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
          />

          {/* Ring 4 — accent dot arc, outermost */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 270deg, transparent 0deg, ${mix(accentFrom, 45)} 20deg, transparent 40deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)',
              WebkitMask:
                'radial-gradient(circle at 50% 50%, transparent 61%, black 62%, black 63%, transparent 64%)',
              opacity: 0.6,
              willChange: 'transform',
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
          />

          {/* Progress % — centered inside rings */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <span
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 30,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                color: accentFrom,
              }}
            >
              {pct}
            </span>
            <span
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 600,
                fontSize: 11,
                color: 'var(--c-text-secondary)',
              }}
            >
              %
            </span>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div style={{ width: '100%' }}>
          <AnimatedProgressBar
            progress={progress}
            accentFrom={accentFrom}
            accentTo={accentTo}
            height={4}
          />
        </div>

        {/* Rotating message */}
        <motion.p
          key={msgIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
          style={{
            margin: 0,
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            color: 'var(--c-text-secondary)',
            textAlign: 'center',
            letterSpacing: '-0.01em',
          }}
        >
          {MESSAGES[msgIdx]}
        </motion.p>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import StudioProgressBar from './StudioProgressBar';

/**
 * StudioUpdateScreen — fullscreen overlay during OTA download.
 *
 * Background: soft warm-neutral blobs (no accent color — calming atmosphere)
 * Loader:     theme-aware rings — white in dark mode, near-black in light
 * Text:       fully white/black via var(--c-text-primary)
 */

// Pool of mid-update messages — shuffled on mount so each session feels fresh
const MESSAGE_POOL = [
  'Preparing your update',
  'Downloading new features',
  'Unpacking improvements',
  'Optimizing your experience',
  'Applying the finishing touches',
  'Tuning things up',
  "This one's a good one",
  'Almost there, hang tight',
  'Smoothing out the rough edges',
  'Making Studio feel just right',
  'One moment — good things take time',
  'Rewriting the good parts',
  'Polishing every detail',
  'Good vibes incoming',
  'Your patience is appreciated',
  'Worth the wait, promise',
];

// Completion messages — one is picked at random when progress hits 100
const DONE_MESSAGES = [
  "You're all caught up",
  'Update complete — enjoy',
  'Fresh and ready to go',
  'All done. Studio is yours',
  'Good as new',
  'Latest and greatest, installed',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  const pct = Math.round(progress * 100);
  const isDone = pct >= 100;

  // Shuffled pool — stable across re-renders via useState initializer
  const [messages] = useState<string[]>(() => shuffle(MESSAGE_POOL));
  const [doneMsg] = useState<string>(
    () => DONE_MESSAGES[Math.floor(Math.random() * DONE_MESSAGES.length)],
  );
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (isDone) return; // stop cycling once complete
    const id = setInterval(
      () => setMsgIdx(i => (i + 1) % messages.length),
      2600,
    );
    return () => clearInterval(id);
  }, [isDone, messages.length]);

  const displayMsg = isDone ? doneMsg : messages[msgIdx];

  // Blob palette — warm-neutral, relaxing, theme-independent.
  // Screen blend mode on a dark bg turns these into gentle glows.
  const blobA = 'rgba(245, 238, 255, 0.60)'; // warm lavender-white
  const blobB = 'rgba(220, 210, 255, 0.45)'; // soft violet
  const blobC = 'rgba(255, 248, 235, 0.35)'; // warm cream
  const blobD = 'rgba(200, 195, 255, 0.28)'; // pale periwinkle

  // Ring color — crisp white on dark, near-black on light.
  const ring = 'var(--c-text-primary)';
  // Opacity helper for ring layers
  const ringAlpha = (a: number) =>
    `color-mix(in srgb, ${ring} ${Math.round(a * 100)}%, transparent)`;

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
      {/* ── SVG goo filter ─────────────────────────────────────────────── */}
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

      {/* ── Blobs — warm neutral, relaxing atmosphere ───────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: 'url(#su-goo) blur(44px)',
        }}
      >
        {/* Primary — slow vertical drift */}
        <motion.div
          style={{
            position: 'absolute',
            width: '85%',
            height: '85%',
            top: '7%',
            left: '7%',
            borderRadius: '50%',
            mixBlendMode: 'screen',
            background: `radial-gradient(circle at center, ${blobA} 0%, transparent 62%)`,
            willChange: 'transform',
          }}
          animate={{ y: [-55, 55, -55] }}
          transition={{ duration: 30, ease: 'easeInOut', repeat: Infinity }}
        />

        {/* Second — slow orbit */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformOrigin: 'calc(50% - 360px) 50%',
            willChange: 'transform',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 24, ease: 'linear', repeat: Infinity }}
        >
          <div
            style={{
              width: '70%',
              height: '70%',
              borderRadius: '50%',
              mixBlendMode: 'screen',
              background: `radial-gradient(circle at center, ${blobB} 0%, transparent 58%)`,
            }}
          />
        </motion.div>

        {/* Third — opposite slow orbit */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformOrigin: 'calc(50% + 360px) 50%',
            willChange: 'transform',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 42, ease: 'linear', repeat: Infinity }}
        >
          <div
            style={{
              position: 'absolute',
              width: '68%',
              height: '68%',
              top: 'calc(50% + 130px)',
              left: 'calc(50% - 380px)',
              borderRadius: '50%',
              mixBlendMode: 'screen',
              background: `radial-gradient(circle at center, ${blobC} 0%, transparent 58%)`,
            }}
          />
        </motion.div>

        {/* Fourth — slow horizontal drift */}
        <motion.div
          style={{
            position: 'absolute',
            width: '75%',
            height: '75%',
            top: '12%',
            left: '12%',
            borderRadius: '50%',
            mixBlendMode: 'screen',
            background: `radial-gradient(circle at center, ${blobD} 0%, transparent 62%)`,
            willChange: 'transform',
          }}
          animate={{ x: [-45, 45, -45] }}
          transition={{ duration: 38, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>

      {/* ── Centered content ────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          padding: '0 36px',
          width: '100%',
          maxWidth: 360,
        }}
      >
        {/* ── Loader: theme-aware rings, 210×210 ── */}
        <motion.div
          style={{ position: 'relative', width: 210, height: 210, flexShrink: 0 }}
          animate={{ scale: [1, 1.012, 1] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
        >
          {/* Ring 1 — outermost thin, fast */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, transparent 0deg, ${ringAlpha(0.9)} 90deg, transparent 180deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)',
              WebkitMask:
                'radial-gradient(circle at 50% 50%, transparent 35%, black 37%, black 39%, transparent 41%)',
              willChange: 'transform',
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
          />

          {/* Ring 2 — primary wide, medium */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, transparent 0deg, ${ringAlpha(1)} 120deg, ${ringAlpha(0.5)} 240deg, transparent 360deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 49%, transparent 51%)',
              WebkitMask:
                'radial-gradient(circle at 50% 50%, transparent 42%, black 44%, black 49%, transparent 51%)',
              willChange: 'transform',
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
          />

          {/* Ring 3 — counter-rotating, slow, dim */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 180deg, transparent 0deg, ${ringAlpha(0.5)} 45deg, transparent 90deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 53%, black 55%, black 57%, transparent 59%)',
              WebkitMask:
                'radial-gradient(circle at 50% 50%, transparent 53%, black 55%, black 57%, transparent 59%)',
              willChange: 'transform',
            }}
            animate={{ rotate: [0, -360] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: [0.4, 0, 0.6, 1] }}
          />

          {/* Ring 4 — tiny dot arc, outermost */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 270deg, transparent 0deg, ${ringAlpha(0.55)} 20deg, transparent 40deg)`,
              mask: 'radial-gradient(circle at 50% 50%, transparent 62%, black 63%, black 64.5%, transparent 65.5%)',
              WebkitMask:
                'radial-gradient(circle at 50% 50%, transparent 62%, black 63%, black 64.5%, transparent 65.5%)',
              willChange: 'transform',
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
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
              gap: 2,
            }}
          >
            <span
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: 42,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                color: 'var(--c-text-primary)',
              }}
            >
              {pct}
            </span>
            <span
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.04em',
                color: 'var(--c-text-primary)',
                opacity: 0.55,
              }}
            >
              %
            </span>
          </div>
        </motion.div>

        {/* Progress bar — accent-colored, full width */}
        <div style={{ width: '100%' }}>
          <StudioProgressBar
            value={progress * 100}
            accentFrom={accentFrom}
            accentTo={accentTo}
            height={4}
          />
        </div>

        {/* Status message — cycles through shuffled pool, then done message */}
        <motion.p
          key={displayMsg}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
          style={{
            margin: 0,
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--c-text-primary)',
            textAlign: 'center',
            letterSpacing: '-0.015em',
          }}
        >
          {displayMsg}
        </motion.p>
      </div>
    </div>
  );
}

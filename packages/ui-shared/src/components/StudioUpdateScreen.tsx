import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import StudioProgressBar from './StudioProgressBar';
import StudioUpdateAuroraBackground from './StudioUpdateAuroraBackground';
import StudioCountUpPercentage from './StudioCountUpPercentage';

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
  statusText?: React.ReactNode;
}

export default function StudioUpdateScreen({
  progress,
  accentFrom,
  accentTo,
  statusText,
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

  const displayMsg = statusText || (isDone ? doneMsg : messages[msgIdx]);

  // Blob palette — warm-neutral, relaxing, theme-independent.
  // Screen blend mode on a dark bg turns these into gentle glows.
  const blobA = 'rgba(245, 238, 255, 0.60)'; // warm lavender-white
  const blobB = 'rgba(220, 210, 255, 0.45)'; // soft violet
  const blobC = 'rgba(255, 248, 235, 0.35)'; // warm cream
  const blobD = 'rgba(200, 195, 255, 0.28)'; // pale periwinkle

  // Opacity helpers using primary accent colors (high contrast and vibrant visibility)
  const ringAlpha1 = (a: number) =>
    `color-mix(in srgb, ${accentFrom} ${Math.round(a * 100)}%, transparent)`;
  const ringAlpha2 = (a: number) =>
    `color-mix(in srgb, ${accentTo} ${Math.round(a * 100)}%, transparent)`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        overflow: 'hidden',
        background: 'var(--app-bg, #0a0a0c)',
      }}
    >
      <StudioUpdateAuroraBackground
        accentFrom={accentFrom}
        accentTo={accentTo}
        className="w-full h-full flex items-center justify-center"
      >
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            padding: '0 36px',
            width: '100%',
            maxWidth: 360,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          {/* ── Percentage: large, bold, centered ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 900,
              fontSize: '5.2rem',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              color: 'var(--c-text-primary)',
            }}
          >
            <StudioCountUpPercentage value={progress} />
            <span
              style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: '2.4rem',
                opacity: 0.8,
                marginLeft: 2,
              }}
            >
              %
            </span>
          </div>

          {/* ── Progress bar ── */}
          <div style={{ width: '100%', marginTop: 4, marginBottom: 4 }}>
            <StudioProgressBar
              value={progress * 100}
              accentFrom={accentFrom}
              accentTo={accentTo}
              height={6}
            />
          </div>

          {/* ── Status message ── */}
          <motion.div
            key={typeof displayMsg === 'string' ? displayMsg : 'rich-status'}
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
              opacity: 0.9,
            }}
          >
            {displayMsg}
          </motion.div>
        </div>
      </StudioUpdateAuroraBackground>
    </motion.div>
  );
}

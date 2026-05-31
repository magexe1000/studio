import { useEffect, useState } from 'react';
import AppSpinner from './AppSpinner';
import AnimatedProgressBar from './AnimatedProgressBar';

const MESSAGES = [
  "Sit tight, we're almost there",
  'Preparing your update',
  'Finishing things up',
  'Almost ready',
  'Making things smoother',
];

interface UpdateLoadingScreenProps {
  progress: number;
  accentFrom: string;
  accentTo: string;
}

const BUBBLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  size: 18 + Math.floor((i * 37 + 11) % 40),
  left: (i * 71 + 13) % 90,
  delay: ((i * 23) % 30) * 0.1,
  duration: 3.5 + ((i * 17) % 30) * 0.12,
}));

export default function UpdateLoadingScreen({ progress, accentFrom, accentTo }: UpdateLoadingScreenProps) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 2600);
    return () => clearInterval(id);
  }, []);

  const pct = Math.round(progress * 100);

  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 22,
      padding: '40px 28px 36px',
      minHeight: 260,
    }}>
      {/* Bubble background */}
      {BUBBLES.map(b => (
        <div
          key={b.id}
          style={{
            position: 'absolute',
            left: `${b.left}%`,
            bottom: `-${b.size}px`,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, color-mix(in srgb, ${accentFrom} 55%, transparent), color-mix(in srgb, ${accentTo} 20%, transparent))`,
            animation: `bubble-rise ${b.duration}s ${b.delay}s ease-in infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Spinner */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AppSpinner size={52} color={accentFrom} strokeWidth={3} />
      </div>

      {/* Progress percentage */}
      <p style={{
        position: 'relative', zIndex: 1,
        fontFamily: 'Manrope, sans-serif',
        fontWeight: 800, fontSize: 32,
        color: accentFrom,
        margin: 0, lineHeight: 1,
        letterSpacing: '-0.03em',
      }}>
        {pct}<span style={{ fontSize: 16, marginLeft: 2, opacity: 0.7 }}>%</span>
      </p>

      {/* Progress bar */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        <AnimatedProgressBar progress={progress} accentFrom={accentFrom} accentTo={accentTo} height={5} />
      </div>

      {/* Rotating message */}
      <p
        key={msgIdx}
        style={{
          position: 'relative', zIndex: 1,
          fontFamily: 'Inter, sans-serif',
          fontSize: 13, color: 'var(--c-text-secondary)',
          margin: 0, textAlign: 'center',
          animation: 'msg-fade-in 0.4s ease-out both',
        }}
      >
        {MESSAGES[msgIdx]}
      </p>

      <style>{`
        @keyframes bubble-rise {
          0%   { transform: translateY(0) scale(1);   opacity: 0; }
          10%  { opacity: 0.55; }
          90%  { opacity: 0.3; }
          100% { transform: translateY(-380px) scale(0.7); opacity: 0; }
        }
        @keyframes msg-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

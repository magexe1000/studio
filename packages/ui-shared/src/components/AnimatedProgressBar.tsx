interface AnimatedProgressBarProps {
  progress: number;
  accentFrom?: string;
  accentTo?: string;
  height?: number;
  className?: string;
}

export default function AnimatedProgressBar({
  progress,
  accentFrom = 'var(--accent-from, #679cff)',
  accentTo = 'var(--accent-to, #007aff)',
  height = 6,
}: AnimatedProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <div style={{
      position: 'relative',
      height,
      borderRadius: 9999,
      background: 'rgba(128,128,128,0.15)',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: `${pct}%`,
        borderRadius: 9999,
        background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
        transition: 'width 280ms cubic-bezier(0.4,0,0.2,1)',
        minWidth: pct > 0 ? 12 : 0,
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'progress-shimmer 1.6s linear infinite',
          borderRadius: 9999,
        }} />
      </div>
      <style>{`
        @keyframes progress-shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }
      `}</style>
    </div>
  );
}

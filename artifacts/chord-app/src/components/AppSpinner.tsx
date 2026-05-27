interface AppSpinnerProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * Clean SVG arc spinner — replaces generic spinning circles.
 * A 270° arc that rotates continuously with smooth acceleration.
 * Respects accent color via CSS variable fallback.
 */
export default function AppSpinner({
  size = 20,
  color = 'var(--accent-from, #679cff)',
  strokeWidth = 2.5,
  className,
}: AppSpinnerProps) {
  const center = size / 2;
  const r = center - strokeWidth / 2 - 0.5;
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * 0.73;

  return (
    <>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={className}
        style={{
          animation: 'app-spinner-spin 0.85s linear infinite',
          flexShrink: 0,
          display: 'inline-block',
          verticalAlign: 'middle',
        }}
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          opacity={0.12}
        />
        {/* Spinning arc */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeDashoffset={circumference * 0.1}
        />
      </svg>
      <style>{`
        @keyframes app-spinner-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

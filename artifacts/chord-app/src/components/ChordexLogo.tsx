export function DrumexLogo({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Top-left pad — active */}
      <rect x="1" y="1" width="6.5" height="6.5" rx="1.8" fill="currentColor" />
      {/* Top-right pad — dim */}
      <rect x="8.5" y="1" width="6.5" height="6.5" rx="1.8" fill="currentColor" fillOpacity="0.28" />
      {/* Bottom-left pad — dim */}
      <rect x="1" y="8.5" width="6.5" height="6.5" rx="1.8" fill="currentColor" fillOpacity="0.28" />
      {/* Bottom-right pad — active */}
      <rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1.8" fill="currentColor" />
    </svg>
  );
}

export function ChordexLogo({ size = 14 }: { size?: number }) {
  const h = Math.round(size * 17 / 13);
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 13 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Nut */}
      <rect x="0.5" y="0.5" width="12" height="2.5" rx="1" fill="currentColor" />

      {/* Strings */}
      <line x1="2.5"  y1="3" x2="2.5"  y2="16.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.35" />
      <line x1="6.5"  y1="3" x2="6.5"  y2="16.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.35" />
      <line x1="10.5" y1="3" x2="10.5" y2="16.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.35" />

      {/* Fret lines */}
      <line x1="0.5" y1="8"  x2="12.5" y2="8"  stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.28" />
      <line x1="0.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="0.7" strokeOpacity="0.28" />

      {/* Chord dots */}
      <circle cx="2.5"  cy="5.5"  r="2.1" fill="currentColor" />
      <circle cx="10.5" cy="5.5"  r="2.1" fill="currentColor" />
      <circle cx="6.5"  cy="10.5" r="2.1" fill="currentColor" />
    </svg>
  );
}

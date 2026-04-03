export function StudioLogo({ size = 14 }: { size?: number }) {
  /* Studio — sine wave mark, matches app icon */
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
      <path
        d="M 72 256 C 128 60 192 60 256 256 S 384 452 440 256"
        stroke="currentColor" strokeWidth="44"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </svg>
  );
}

export function DrumexLogo({ size = 14 }: { size?: number }) {
  /* Snare drum — top-down view: outer rim, head ring, 6 tension lugs, centre dot */
  const cx = 8, cy = 8;
  const lugs = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 6 - Math.PI / 2;
    return { x: cx + 6.1 * Math.cos(angle), y: cy + 6.1 * Math.sin(angle) };
  });
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Outer rim */}
      <circle cx={cx} cy={cy} r="7" stroke="currentColor" strokeWidth="1.6" />
      {/* Head ring */}
      <circle cx={cx} cy={cy} r="4.8" stroke="currentColor" strokeWidth="0.85" strokeOpacity="0.5" />
      {/* Tension lugs */}
      {lugs.map((l, i) => (
        <circle key={i} cx={l.x} cy={l.y} r="0.95" fill="currentColor" />
      ))}
      {/* Centre sweet-spot */}
      <circle cx={cx} cy={cy} r="1.4" fill="currentColor" />
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

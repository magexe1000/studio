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

export function StagexLogoIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
      {/* Stage platform */}
      <rect x="1" y="10" width="14" height="2.5" rx="1" fill="currentColor" fillOpacity="0.9" />
      {/* Left speaker */}
      <rect x="1" y="4" width="3.5" height="5.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="2.75" cy="6.2" r="0.8" fill="currentColor" />
      <circle cx="2.75" cy="8.1" r="0.55" fill="currentColor" fillOpacity="0.6" />
      {/* Right speaker */}
      <rect x="11.5" y="4" width="3.5" height="5.5" rx="0.8" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="13.25" cy="6.2" r="0.8" fill="currentColor" />
      <circle cx="13.25" cy="8.1" r="0.55" fill="currentColor" fillOpacity="0.6" />
      {/* Center mic stand */}
      <line x1="8" y1="4" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="8" cy="3.2" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function GroovexLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <line x1="8" y1="1" x2="8" y2="5" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="8" y1="11" x2="8" y2="15" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="1" y1="8" x2="5" y2="8" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="11" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
    </svg>
  );
}

export function VocalexLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
      <rect x="6.5" y="3" width="3" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 9.5C4 12.26 5.79 14 8 14C10.21 14 12 12.26 12 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <line x1="8" y1="14" x2="8" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="6" y1="15" x2="10" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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

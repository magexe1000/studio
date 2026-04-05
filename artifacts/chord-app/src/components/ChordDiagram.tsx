import type { GuitarChordData } from '../data/chords';

interface Props {
  data: GuitarChordData;
  accentFrom: string;
  /** Optional: multi-fret data (number[][]) that overrides data.frets for rendering.
   *  Each entry is an array of active fret positions on that string.
   *  [-1] = muted, [0] = open, [n, m, …] = multiple dots. */
  fretsMulti?: number[][];
}

export default function ChordDiagram({ data, accentFrom, fretsMulti }: Props) {
  const W = 90, H = 80;
  const padL = 13, padR = 6, padT = 18, padB = 8;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const numStrings = 6, numFrets = 4;
  const cellW = innerW / (numStrings - 1);
  const cellH = innerH / numFrets;
  const r = 3.8;
  const { barres, baseFret } = data;

  // Resolve per-string fret arrays — support both legacy (number[]) and multi-fret (number[][])
  const perString: number[][] = fretsMulti
    ? fretsMulti
    : data.frets.map(f => [f]);

  // Anchor the window at the lowest positive fret across all strings
  const allPositive = perString.flatMap(arr => arr.filter(f => f > 0));
  const minActive = allPositive.length ? Math.min(...allPositive) : 1;
  const minFret = baseFret > 1 ? baseFret : Math.max(1, minActive);
  const showNut = minFret <= 1;

  // String thickness (low E = thickest)
  const stringWidths = [1.4, 1.1, 0.85, 0.7, 0.6, 0.5];

  // Fret indicator position as % of SVG dimensions (for HTML overlay)
  const fretIndTopPct  = ((padT + cellH / 2) / H) * 100;
  const fretIndLeftPct = (padL / W) * 100;

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Fretboard warm background */}
      <rect x={padL} y={padT} width={innerW} height={innerH} rx={2.5} fill="rgba(28,18,8,0.45)" />
      {/* Nut */}
      {showNut && (
        <rect x={padL - 1} y={padT - 3.5} width={innerW + 2} height={3.5} rx={1.5} fill="#888" opacity={0.7} />
      )}
      {/* Fret lines */}
      {Array.from({ length: numFrets + 1 }).map((_, i) => (
        <line key={i} x1={padL} y1={padT + i * cellH} x2={padL + innerW} y2={padT + i * cellH}
          stroke="rgba(120,90,50,0.52)" strokeWidth={0.75} />
      ))}
      {/* String lines — thicker for wound strings */}
      {Array.from({ length: numStrings }).map((_, i) => (
        <line key={i} x1={padL + i * cellW} y1={padT} x2={padL + i * cellW} y2={padT + innerH}
          stroke="rgba(200,170,90,0.42)"
          strokeWidth={stringWidths[i]} />
      ))}
      {/* Barre chords */}
      {barres.map((barre, bi) => {
        const fp = barre.fret - minFret;
        if (fp < 0 || fp >= numFrets) return null;
        const x1 = padL + (barre.fromString - 1) * cellW;
        const x2 = padL + (barre.toString - 1) * cellW;
        const cy = padT + fp * cellH + cellH / 2;
        return (
          <rect key={`barre-${bi}`}
            x={Math.min(x1, x2)}
            y={cy - r}
            width={Math.abs(x2 - x1)}
            height={r * 2}
            rx={r}
            fill={accentFrom}
            opacity={0.9}
          />
        );
      })}
      {/* Finger dots — one per (string, fret) pair, skip barre-covered positions */}
      {perString.map((arr, si) =>
        arr.map((fret, dotIdx) => {
          if (fret <= 0) return null;
          const fp = fret - minFret;
          if (fp < 0 || fp >= numFrets) return null;
          const isBarre = barres.some(b =>
            b.fret === fret &&
            si >= b.fromString - 1 &&
            si <= b.toString - 1
          );
          if (isBarre) return null;
          const cx = padL + si * cellW;
          const cy = padT + fp * cellH + cellH / 2;
          return (
            <g key={`${si}-${dotIdx}`}>
              <circle cx={cx} cy={cy} r={r + 2.5} fill={accentFrom} opacity={0.13} />
              <circle cx={cx} cy={cy} r={r} fill={accentFrom} />
            </g>
          );
        })
      )}
      {/* Open / muted indicators — based on the first entry of each string's array */}
      {perString.map((arr, si) => {
        const cx = padL + si * cellW;
        const cy = padT - 9;
        const isMuted = arr[0] === -1;
        const isOpen = !isMuted && arr.includes(0) && !arr.some(f => f > 0);
        if (isMuted) return (
          <text key={si} x={cx} y={cy + 2} fontSize={9} fill="#c55" textAnchor="middle"
            dominantBaseline="middle" fontWeight="bold">✕</text>
        );
        if (isOpen) return (
          <circle key={si} cx={cx} cy={cy} r={3} fill="none" stroke="#888" strokeWidth={0.9} />
        );
        return null;
      })}
    </svg>
    {/* Fret position indicator — pure HTML so it renders crisply and always above SVG dots */}
    {!showNut && (
      <span style={{
        position: 'absolute',
        left: 0,
        width: `${fretIndLeftPct}%`,
        top: `${fretIndTopPct}%`,
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: '3px',
        fontSize: '11px',
        fontFamily: '"Inter", system-ui, sans-serif',
        fontWeight: 800,
        color: '#8a8a8a',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 2,
      }}>{baseFret}</span>
    )}
    </div>
  );
}

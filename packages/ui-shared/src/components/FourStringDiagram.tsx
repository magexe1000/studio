import { memo } from 'react';
import type { GuitarChordData } from '../data/chords';

interface FourStringDiagramProps {
  chordData: GuitarChordData;
  chordName: string;
  showNoteNames?: boolean;
  showIntervals?: boolean;
  notes?: string[];
  intervals?: string[];
  size?: 'sm' | 'md' | 'lg';
  instrument?: 'bass';
  fiveString?: boolean;
}

const TUNINGS = {
  bass: ['E', 'A', 'D', 'G'],
};

const FourStringDiagram = memo(function FourStringDiagram({
  chordData,
  chordName,
  showNoteNames = false,
  showIntervals = false,
  notes = [],
  intervals = [],
  size = 'lg',
  instrument = 'bass',
  fiveString = false,
}: FourStringDiagramProps) {
  // Use last 4 strings of guitar chord data (strings 2-5 for bass approximation)
  const rawFrets = chordData.frets;
  const numStrings = fiveString && instrument === 'bass' ? 5 : 4;
  // Take the bottom numStrings from guitar (indices 0..numStrings-1)
  const frets = rawFrets.slice(0, numStrings);
  const barres = chordData.barres.filter(b => b.fromString <= numStrings && b.toString <= numStrings);
  const baseFret = chordData.baseFret;

  const sizes = {
    sm: { width: 110, height: 145, cellW: 22, cellH: 24, dotR: 7, fontSize: 8, headerH: 24 },
    md: { width: 150, height: 195, cellW: 30, cellH: 32, dotR: 9, fontSize: 10, headerH: 30 },
    lg: { width: 200, height: 260, cellW: 40, cellH: 42, dotR: 12, fontSize: 12, headerH: 40 },
  };

  const { width, height, cellW, cellH, dotR, fontSize, headerH } = sizes[size];
  const numFrets = 5;
  const startX = size === 'lg' ? 28 : size === 'md' ? 20 : 14;
  const startY = headerH + 14;
  const boardW = cellW * (numStrings - 1);
  const boardH = cellH * numFrets;

  const showNut = baseFret === 1;
  const minFret = baseFret > 1 ? baseFret : 1;

  const tuning = TUNINGS[instrument];

  const dotGradId = `4str-grad-${chordName.replace(/[^a-z0-9]/gi, '')}`;

  const getNoteLabel = (stringIdx: number): string => {
    if (showNoteNames && notes.length > 0) {
      const fret = frets[stringIdx];
      if (fret < 0) return '';
      return notes[stringIdx % notes.length] || '';
    }
    if (showIntervals && intervals.length > 0) {
      const fret = frets[stringIdx];
      if (fret < 0) return '';
      return intervals[stringIdx % intervals.length] || '';
    }
    return '';
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={dotGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#679cff" />
          <stop offset="100%" stopColor="#007aff" />
        </linearGradient>
      </defs>

      {/* Instrument label */}
      <text
        x={startX + boardW / 2}
        y={12}
        fontSize={8}
        fill="#acabaa"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Manrope, sans-serif"
        fontWeight="700"
        letterSpacing="0.1em"
      >
        {instrument.toUpperCase()} {fiveString && instrument === 'bass' ? '(5-string)' : '(4-string)'}
      </text>

      {/* Base fret label — right side */}
      {baseFret > 1 && (
        <text
          x={startX + boardW + 6}
          y={startY + cellH * 0.5}
          fontSize={fontSize}
          fontWeight="bold"
          fill="#acabaa"
          textAnchor="start"
          dominantBaseline="middle"
          fontFamily="Inter, sans-serif"
        >
          {baseFret}
        </text>
      )}

      {/* Nut */}
      {showNut && (
        <rect x={startX - 1} y={startY - 4} width={boardW + 2} height={5} rx={2} fill="#acabaa" opacity={0.6} />
      )}

      {/* Fret lines */}
      {Array.from({ length: numFrets + 1 }).map((_, i) => (
        <line
          key={`fret-${i}`}
          x1={startX} y1={startY + i * cellH}
          x2={startX + boardW} y2={startY + i * cellH}
          stroke="#484848"
          strokeOpacity={i === 0 ? (showNut ? 0 : 0.4) : 0.20}
          strokeWidth={1}
        />
      ))}

      {/* String lines */}
      {Array.from({ length: numStrings }).map((_, i) => (
        <line
          key={`string-${i}`}
          x1={startX + i * cellW} y1={startY}
          x2={startX + i * cellW} y2={startY + boardH}
          stroke="#484848"
          strokeOpacity={0.25}
          strokeWidth={1 + (i === 0 ? 0.5 : 0)}
        />
      ))}

      {/* String name labels at bottom */}
      {tuning.slice(0, numStrings).map((note, i) => (
        <text
          key={`label-${i}`}
          x={startX + i * cellW}
          y={startY + boardH + 16}
          fontSize={9}
          fill="#acabaa"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Inter, sans-serif"
          fontWeight="600"
        >
          {note}
        </text>
      ))}

      {/* Barre chords */}
      {barres.map((barre, bi) => {
        const fretPos = barre.fret - minFret;
        const x1 = startX + (numStrings - barre.fromString) * cellW;
        const x2 = startX + (numStrings - Math.min(barre.toString, numStrings)) * cellW;
        const cy = startY + fretPos * cellH + cellH / 2;
        return (
          <rect key={`barre-${bi}`}
            x={Math.min(x1, x2)} y={cy - dotR}
            width={Math.abs(x2 - x1)} height={dotR * 2}
            rx={dotR} fill={`url(#${dotGradId})`} opacity={0.9}
          />
        );
      })}

      {/* Finger dots */}
      {frets.map((fret, stringIdx) => {
        if (fret <= 0) return null;
        const fretPos = fret - minFret;
        const cx = startX + stringIdx * cellW;
        const cy = startY + fretPos * cellH + cellH / 2;
        const label = getNoteLabel(stringIdx);
        const stringNum = numStrings - stringIdx;
        const isBarre = barres.some(b => b.fret === fret && stringNum >= b.toString && stringNum <= b.fromString);

        return (
          <g key={`dot-${stringIdx}`}>
            {!isBarre && (
              <>
                <circle cx={cx} cy={cy} r={dotR + 3} fill="#679cff" opacity={0.15} />
                <circle cx={cx} cy={cy} r={dotR} fill={`url(#${dotGradId})`} />
              </>
            )}
            {label && (
              <text x={cx} y={cy} fontSize={fontSize - 1} fill="#ffffff" textAnchor="middle" dominantBaseline="middle" fontWeight="bold" fontFamily="Inter, sans-serif">
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Open/Muted indicators */}
      {frets.map((fret, stringIdx) => {
        const cx = startX + stringIdx * cellW;
        const cy = startY - 16;
        if (fret === 0) {
          return <circle key={`open-${stringIdx}`} cx={cx} cy={cy} r={dotR * 0.6} fill="none" stroke="#acabaa" strokeWidth={1.5} strokeOpacity={0.7} />;
        } else if (fret === -1) {
          const d = dotR * 0.5;
          return (
            <g key={`muted-${stringIdx}`}>
              <line x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d} stroke="#ee7d77" strokeWidth={1.5} strokeLinecap="round" strokeOpacity={0.9} />
              <line x1={cx + d} y1={cy - d} x2={cx - d} y2={cy + d} stroke="#ee7d77" strokeWidth={1.5} strokeLinecap="round" strokeOpacity={0.9} />
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
});

export default FourStringDiagram;

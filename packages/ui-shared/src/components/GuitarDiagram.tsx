import { type GuitarChordData } from '@workspace/studio-core';
import { memo } from 'react';

interface GuitarDiagramProps {
  chordData: GuitarChordData;
  chordName: string;
  showNoteNames?: boolean;
  showIntervals?: boolean;
  notes?: string[];
  intervals?: string[];
  size?: 'sm' | 'md' | 'lg';
  leftHanded?: boolean;
}

const GuitarDiagram = memo(function GuitarDiagram({
  chordData,
  chordName,
  showNoteNames = false,
  showIntervals = false,
  notes = [],
  intervals = [],
  size = 'lg',
  leftHanded = false,
}: GuitarDiagramProps) {
  const rawFrets = chordData.frets;
  const rawFingers = chordData.fingers;
  const frets = leftHanded ? [...rawFrets].reverse() : rawFrets;
  const fingers = leftHanded ? [...rawFingers].reverse() : rawFingers;
  const barres = leftHanded
    ? chordData.barres.map(b => ({ fret: b.fret, fromString: 7 - b.toString, toString: 7 - b.fromString }))
    : chordData.barres;
  const { baseFret } = chordData;

  const sizes = {
    sm: { width: 130, height: 150, cellW: 18, cellH: 22, dotR: 6,  fontSize: 8,  headerH: 24 },
    md: { width: 180, height: 210, cellW: 26, cellH: 30, dotR: 8,  fontSize: 10, headerH: 32 },
    lg: { width: 240, height: 290, cellW: 36, cellH: 42, dotR: 10, fontSize: 12, headerH: 44 },
  };

  const { width, height, cellW, cellH, dotR, fontSize, headerH } = sizes[size];

  const numStrings = 6;
  const positiveFrets = frets.filter(f => f > 0);
  const maxFret = positiveFrets.length ? Math.max(...positiveFrets) : 1;
  const numFrets = Math.max(5, maxFret - (baseFret > 1 ? baseFret : Math.max(1, positiveFrets.length ? Math.min(...positiveFrets) : 1)) + 1);
  const startX = size === 'lg' ? 30 : size === 'md' ? 22 : 16;
  const startY = headerH + (size === 'lg' ? 14 : 10);
  const boardW = cellW * (numStrings - 1);
  const boardH = cellH * numFrets;

  const showNut = baseFret === 1;
  const minFret = baseFret > 1 ? baseFret : 1;

  const getNoteLabel = (stringIdx: number): string => {
    if (showNoteNames && notes.length > 0) {
      const fret = frets[stringIdx];
      if (fret < 0) return '';
      const noteIdx = stringIdx < notes.length ? stringIdx : -1;
      if (noteIdx >= 0) return notes[noteIdx % notes.length];
    }
    if (showIntervals && intervals.length > 0) {
      const fret = frets[stringIdx];
      if (fret < 0) return '';
      const noteIdx = stringIdx < intervals.length ? stringIdx : -1;
      if (noteIdx >= 0) return intervals[noteIdx % intervals.length];
    }
    return '';
  };

  const dotGradId = `dot-grad-${chordName.replace(/[^a-z0-9]/gi, '')}`;

  // String thickness (low E = thickest)
  const stringWidths = [1.8, 1.4, 1.1, 0.85, 0.7, 0.6];

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

      {/* Warm fretboard background */}
      <rect
        x={startX - 1}
        y={startY}
        width={boardW + 2}
        height={boardH}
        rx={3}
        fill="rgba(28,18,8,0.48)"
      />

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
        <rect
          x={startX - 1}
          y={startY - 4}
          width={boardW + 2}
          height={4.5}
          rx={2}
          fill="#888"
          opacity={0.7}
        />
      )}

      {/* Fret lines */}
      {Array.from({ length: numFrets + 1 }).map((_, i) => (
        <line
          key={`fret-${i}`}
          x1={startX}
          y1={startY + i * cellH}
          x2={startX + boardW}
          y2={startY + i * cellH}
          stroke="rgba(120,90,50,0.5)"
          strokeWidth={i === 0 ? (showNut ? 0 : 0.8) : 0.75}
        />
      ))}

      {/* String lines — thicker for wound strings (low E to high E) */}
      {Array.from({ length: numStrings }).map((_, i) => (
        <line
          key={`string-${i}`}
          x1={startX + i * cellW}
          y1={startY}
          x2={startX + i * cellW}
          y2={startY + boardH}
          stroke="rgba(200,170,90,0.42)"
          strokeWidth={stringWidths[i]}
        />
      ))}

      {/* Barre chords */}
      {barres.map((barre, bi) => {
        const fretPos = barre.fret - minFret;
        if (fretPos < 0 || fretPos >= numFrets) return null;
        const x1 = startX + (numStrings - barre.fromString) * cellW;
        const x2 = startX + (numStrings - barre.toString) * cellW;
        const cy = startY + fretPos * cellH + cellH / 2;
        return (
          <rect
            key={`barre-${bi}`}
            x={Math.min(x1, x2)}
            y={cy - dotR}
            width={Math.abs(x2 - x1)}
            height={dotR * 2}
            rx={dotR}
            fill={`url(#${dotGradId})`}
            opacity={0.92}
          />
        );
      })}

      {/* Finger dots */}
      {frets.map((fret, stringIdx) => {
        if (fret <= 0) return null;
        const fretPos = fret - minFret;
        if (fretPos < 0 || fretPos >= numFrets) return null;
        const cx = startX + stringIdx * cellW;
        const cy = startY + fretPos * cellH + cellH / 2;
        const label = getNoteLabel(stringIdx);

        const stringNum = numStrings - stringIdx;
        const isBarre = barres.some(b =>
          b.fret === fret &&
          stringNum >= b.toString &&
          stringNum <= b.fromString
        );

        return (
          <g key={`dot-${stringIdx}`}>
            {!isBarre ? (
              <>
                <circle cx={cx} cy={cy} r={dotR + 2} fill="#679cff" opacity={0.14} />
                <circle cx={cx} cy={cy} r={dotR} fill={`url(#${dotGradId})`} />
              </>
            ) : (
              <circle cx={cx} cy={cy} r={dotR} fill={`url(#${dotGradId})`} opacity={0.85} />
            )}
            {label && (
              <text
                x={cx}
                y={cy}
                fontSize={fontSize - 2}
                fill="#ffffff"
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="bold"
                fontFamily="Inter, sans-serif"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Open / Muted string indicators */}
      {frets.map((fret, stringIdx) => {
        const cx = startX + stringIdx * cellW;
        const cy = startY - (size === 'lg' ? 18 : 12);
        if (fret === 0) {
          return (
            <circle
              key={`open-${stringIdx}`}
              cx={cx}
              cy={cy}
              r={dotR * 0.52}
              fill="none"
              stroke="#acabaa"
              strokeWidth={1.5}
              strokeOpacity={0.75}
            />
          );
        } else if (fret === -1) {
          const d = dotR * 0.48;
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

export default GuitarDiagram;

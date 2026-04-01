import { memo } from 'react';
import type { PianoChordData } from '../data/chords';

interface PianoDiagramProps {
  chordData: PianoChordData;
  chordName: string;
  showNoteNames?: boolean;
  showIntervals?: boolean;
  notes?: string[];
  intervals?: string[];
  size?: 'sm' | 'md' | 'lg';
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#

const PianoDiagram = memo(function PianoDiagram({
  chordData,
  showNoteNames = false,
  showIntervals = false,
  notes = [],
  intervals = [],
  size = 'lg',
}: PianoDiagramProps) {
  const { keys } = chordData;

  const sizes = {
    sm: { wW: 16, wH: 60, bW: 10, bH: 38, fontSize: 7 },
    md: { wW: 22, wH: 82, bW: 14, bH: 52, fontSize: 9 },
    lg: { wW: 30, wH: 110, bW: 18, bH: 68, fontSize: 11 },
  };

  const { wW, wH, bW, bH, fontSize } = sizes[size];

  // Show 2 octaves (C to B, C to B) = 14 white keys
  const octaves = 2;
  const whiteKeysPerOctave = 7; // C D E F G A B
  const totalWhite = whiteKeysPerOctave * octaves;

  // White key order within octave: 0=C,1=D,2=E,3=F,4=G,5=A,6=B
  const whiteNotes = [0, 2, 4, 5, 7, 9, 11];

  const totalWidth = wW * totalWhite + 2;
  const totalHeight = wH + 12;

  // Highlight keys from both octaves (show chord in first octave primarily)
  const highlightedKeys = new Set(keys);

  // Build the key positions
  const whiteKeyElements: React.ReactElement[] = [];
  const blackKeyElements: React.ReactElement[] = [];

  let whiteIdx = 0;
  for (let oct = 0; oct < octaves; oct++) {
    for (let wi = 0; wi < whiteKeysPerOctave; wi++) {
      const noteVal = whiteNotes[wi];
      const isHighlighted = highlightedKeys.has(noteVal);
      const x = whiteIdx * wW + 1;
      const noteIdx = keys.indexOf(noteVal);
      let label = '';
      if (isHighlighted) {
        if (showIntervals && intervals.length > noteIdx && noteIdx >= 0) label = intervals[noteIdx];
        else if (showNoteNames) label = NOTE_NAMES[noteVal];
      }

      whiteKeyElements.push(
        <g key={`wk-${oct}-${wi}`}>
          <rect
            x={x}
            y={0}
            width={wW - 1}
            height={wH}
            rx={3}
            fill={isHighlighted ? '#a78bfa' : '#e2e8f0'}
            stroke={isHighlighted ? '#7c3aed' : '#94a3b8'}
            strokeWidth={0.5}
          />
          {label && (
            <text
              x={x + (wW - 1) / 2}
              y={wH - 8}
              fontSize={fontSize}
              fill={isHighlighted ? '#fff' : '#334155'}
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              {label}
            </text>
          )}
        </g>
      );

      // Check for black key after this white key
      // After C->C#, D->D#, F->F#, G->G#, A->A#
      const hasBlack = [0, 1, 3, 4, 5].includes(wi); // positions with black key after
      if (hasBlack) {
        const blackNote = noteVal + 1;
        const isBlackHighlighted = highlightedKeys.has(blackNote);
        const bx = x + wW - bW / 2;
        const bNoteIdx = keys.indexOf(blackNote);
        let bLabel = '';
        if (isBlackHighlighted) {
          if (showIntervals && intervals.length > bNoteIdx && bNoteIdx >= 0) bLabel = intervals[bNoteIdx];
          else if (showNoteNames) bLabel = NOTE_NAMES[blackNote].replace('#', '♯');
        }

        blackKeyElements.push(
          <g key={`bk-${oct}-${wi}`}>
            <rect
              x={bx}
              y={0}
              width={bW}
              height={bH}
              rx={2}
              fill={isBlackHighlighted ? '#7c3aed' : '#1e293b'}
              stroke={isBlackHighlighted ? '#a78bfa' : '#0f172a'}
              strokeWidth={0.5}
            />
            {bLabel && (
              <text
                x={bx + bW / 2}
                y={bH - 6}
                fontSize={fontSize - 1}
                fill="#fff"
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {bLabel}
              </text>
            )}
          </g>
        );
      }

      whiteIdx++;
    }
  }

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <g>{whiteKeyElements}</g>
      <g>{blackKeyElements}</g>
    </svg>
  );
});

export default PianoDiagram;

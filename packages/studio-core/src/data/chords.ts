export type ChordType = 'major' | 'minor' | '7th' | 'maj7' | 'min7' | 'sus2' | 'sus4' | 'dim' | 'aug' | '9th' | 'add9' | '11th' | '13th' | 'min9' | 'maj9' | '6th' | 'min6' | 'dom9' | 'halfdim' | 'dim7' | 'min11' | 'maj6' | '7sus4' | '7sus2' | 'power' | 'minmaj7' | 'aug7' | '7b9' | '7s9' | '69' | '9sus4' | 'min13' | 'madd9' | 'maj11' | '7#11' | 'maj7#11' | 'add11' | 'maj13' | '13sus4' | 'sus2add13' | '7b5' | '7alt';

export type Instrument = 'guitar' | 'piano' | 'bass';

export interface GuitarFret {
  string: number; // 1 = high E, 6 = low E
  fret: number;   // 0 = open, -1 = muted
}

export interface GuitarChordData {
  frets: number[];  // 6 values, low E to high E, -1 = muted, 0 = open
  fingers: number[]; // finger numbers for each string
  barres: { fret: number; fromString: number; toString: number }[];
  baseFret: number;
}

export interface PianoChordData {
  keys: number[]; // MIDI-like: 0=C, 1=C#, 2=D, ..., 11=B (relative to octave)
  octaveShift?: number[];
}

export interface Chord {
  id: string;
  name: string;
  root: string;
  type: ChordType;
  notes: string[];
  intervals: string[];
  guitar: GuitarChordData;
  piano: PianoChordData;
  relatedChords?: string[];
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_DISPLAY: Record<string, string> = {
  'C#': 'C#/Db', 'D#': 'D#/Eb', 'F#': 'F#/Gb', 'G#': 'G#/Ab', 'A#': 'A#/Bb'
};


const chordDatabase: Chord[] = [
  // C MAJOR
  {
    id: 'C-major', name: 'C', root: 'C', type: 'major',
    notes: ['C', 'E', 'G'], intervals: ['1', '3', '5'],
    guitar: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barres: [], baseFret: 1 },
    piano: { keys: [0, 4, 7] },
    relatedChords: ['Am', 'Em', 'G', 'F', 'Dm']
  },
  {
    id: 'C-minor', name: 'Cm', root: 'C', type: 'minor',
    notes: ['C', 'D#', 'G'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barres: [{ fret: 3, fromString: 5, toString: 1 }], baseFret: 1 },
    piano: { keys: [0, 3, 7] },
    relatedChords: ['C', 'Eb', 'Gm', 'Fm']
  },
  {
    id: 'C-7th', name: 'C7', root: 'C', type: '7th',
    notes: ['C', 'E', 'G', 'A#'], intervals: ['1', '3', '5', 'b7'],
    guitar: { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], barres: [], baseFret: 1 },
    piano: { keys: [0, 4, 7, 10] },
    relatedChords: ['F', 'G7', 'Gm']
  },
  {
    id: 'C-maj7', name: 'Cmaj7', root: 'C', type: 'maj7',
    notes: ['C', 'E', 'G', 'B'], intervals: ['1', '3', '5', '7'],
    guitar: { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [0, 4, 7, 11] },
    relatedChords: ['Am', 'Em7', 'G']
  },
  {
    id: 'C-min7', name: 'Cm7', root: 'C', type: 'min7',
    notes: ['C', 'D#', 'G', 'A#'], intervals: ['1', 'b3', '5', 'b7'],
    guitar: { frets: [-1, 3, 5, 3, 4, 3], fingers: [0, 1, 3, 1, 2, 1], barres: [{ fret: 3, fromString: 5, toString: 1 }], baseFret: 1 },
    piano: { keys: [0, 3, 7, 10] },
    relatedChords: ['Eb', 'Bb', 'Gm7']
  },
  {
    id: 'C-sus2', name: 'Csus2', root: 'C', type: 'sus2',
    notes: ['C', 'D', 'G'], intervals: ['1', '2', '5'],
    guitar: { frets: [-1, 3, 0, 0, 1, 3], fingers: [0, 3, 0, 0, 1, 4], barres: [], baseFret: 1 },
    piano: { keys: [0, 2, 7] },
    relatedChords: ['C', 'G', 'Gsus2']
  },
  {
    id: 'C-sus4', name: 'Csus4', root: 'C', type: 'sus4',
    notes: ['C', 'F', 'G'], intervals: ['1', '4', '5'],
    guitar: { frets: [-1, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1], barres: [], baseFret: 1 },
    piano: { keys: [0, 5, 7] },
    relatedChords: ['C', 'F', 'G']
  },
  {
    id: 'C-dim', name: 'Cdim', root: 'C', type: 'dim',
    notes: ['C', 'D#', 'F#'], intervals: ['1', 'b3', 'b5'],
    guitar: { frets: [-1, -1, 1, 2, 1, 2], fingers: [0, 0, 1, 3, 2, 4], barres: [], baseFret: 1 },
    piano: { keys: [0, 3, 6] },
    relatedChords: ['Eb', 'Gb', 'A']
  },
  {
    id: 'C-aug', name: 'Caug', root: 'C', type: 'aug',
    notes: ['C', 'E', 'G#'], intervals: ['1', '3', '#5'],
    guitar: { frets: [-1, -1, 2, 1, 1, 0], fingers: [0, 0, 3, 1, 2, 0], barres: [], baseFret: 1 },
    piano: { keys: [0, 4, 8] },
    relatedChords: ['E', 'Ab']
  },

  // D MAJOR
  {
    id: 'D-major', name: 'D', root: 'D', type: 'major',
    notes: ['D', 'F#', 'A'], intervals: ['1', '3', '5'],
    guitar: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barres: [], baseFret: 1 },
    piano: { keys: [2, 6, 9] },
    relatedChords: ['G', 'A', 'Bm', 'Em', 'F#m']
  },
  {
    id: 'D-minor', name: 'Dm', root: 'D', type: 'minor',
    notes: ['D', 'F', 'A'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], barres: [], baseFret: 1 },
    piano: { keys: [2, 5, 9] },
    relatedChords: ['F', 'C', 'Am', 'Gm']
  },
  {
    id: 'D-7th', name: 'D7', root: 'D', type: '7th',
    notes: ['D', 'F#', 'A', 'C'], intervals: ['1', '3', '5', 'b7'],
    guitar: { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], barres: [], baseFret: 1 },
    piano: { keys: [2, 6, 9, 0] },
    relatedChords: ['G', 'A7', 'Am']
  },
  {
    id: 'D-maj7', name: 'Dmaj7', root: 'D', type: 'maj7',
    notes: ['D', 'F#', 'A', 'C#'], intervals: ['1', '3', '5', '7'],
    guitar: { frets: [-1, -1, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1], barres: [{ fret: 2, fromString: 4, toString: 1 }], baseFret: 1 },
    piano: { keys: [2, 6, 9, 1] },
    relatedChords: ['Bm7', 'F#m7', 'A']
  },
  {
    id: 'D-min7', name: 'Dm7', root: 'D', type: 'min7',
    notes: ['D', 'F', 'A', 'C'], intervals: ['1', 'b3', '5', 'b7'],
    guitar: { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 3, 1, 1], barres: [{ fret: 1, fromString: 2, toString: 1 }], baseFret: 1 },
    piano: { keys: [2, 5, 9, 0] },
    relatedChords: ['F', 'C', 'Bb']
  },
  {
    id: 'D-sus4', name: 'Dsus4', root: 'D', type: 'sus4',
    notes: ['D', 'G', 'A'], intervals: ['1', '4', '5'],
    guitar: { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3], barres: [], baseFret: 1 },
    piano: { keys: [2, 7, 9] },
    relatedChords: ['D', 'G', 'A']
  },

  // E MAJOR
  {
    id: 'E-major', name: 'E', root: 'E', type: 'major',
    notes: ['E', 'G#', 'B'], intervals: ['1', '3', '5'],
    guitar: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [4, 8, 11] },
    relatedChords: ['A', 'B', 'C#m', 'F#m', 'G#m']
  },
  {
    id: 'E-minor', name: 'Em', root: 'E', type: 'minor',
    notes: ['E', 'G', 'B'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [4, 7, 11] },
    relatedChords: ['G', 'D', 'Am', 'C']
  },
  {
    id: 'E-7th', name: 'E7', root: 'E', type: '7th',
    notes: ['E', 'G#', 'B', 'D'], intervals: ['1', '3', '5', 'b7'],
    guitar: { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [4, 8, 11, 2] },
    relatedChords: ['A', 'B7', 'F#m']
  },
  {
    id: 'E-maj7', name: 'Emaj7', root: 'E', type: 'maj7',
    notes: ['E', 'G#', 'B', 'D#'], intervals: ['1', '3', '5', '7'],
    guitar: { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [4, 8, 11, 3] },
    relatedChords: ['C#m7', 'G#m7', 'B']
  },
  {
    id: 'E-min7', name: 'Em7', root: 'E', type: 'min7',
    notes: ['E', 'G', 'B', 'D'], intervals: ['1', 'b3', '5', 'b7'],
    guitar: { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [4, 7, 11, 2] },
    relatedChords: ['G', 'D', 'Am7', 'C']
  },
  {
    id: 'E-sus4', name: 'Esus4', root: 'E', type: 'sus4',
    notes: ['E', 'A', 'B'], intervals: ['1', '4', '5'],
    guitar: { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [4, 9, 11] },
    relatedChords: ['E', 'A', 'B']
  },

  // F MAJOR
  {
    id: 'F-major', name: 'F', root: 'F', type: 'major',
    notes: ['F', 'A', 'C'], intervals: ['1', '3', '5'],
    guitar: { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [5, 9, 0] },
    relatedChords: ['C', 'G', 'Am', 'Dm', 'Bb']
  },
  {
    id: 'F-minor', name: 'Fm', root: 'F', type: 'minor',
    notes: ['F', 'G#', 'C'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [5, 8, 0] },
    relatedChords: ['Ab', 'Eb', 'Cm', 'Bbm']
  },
  {
    id: 'F-7th', name: 'F7', root: 'F', type: '7th',
    notes: ['F', 'A', 'C', 'D#'], intervals: ['1', '3', '5', 'b7'],
    guitar: { frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1], barres: [{ fret: 1, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [5, 9, 0, 3] },
    relatedChords: ['Bb', 'C7', 'Gm']
  },
  {
    id: 'F-maj7', name: 'Fmaj7', root: 'F', type: 'maj7',
    notes: ['F', 'A', 'C', 'E'], intervals: ['1', '3', '5', '7'],
    guitar: { frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], barres: [], baseFret: 1 },
    piano: { keys: [5, 9, 0, 4] },
    relatedChords: ['Am7', 'C', 'Em7']
  },

  // G MAJOR
  {
    id: 'G-major', name: 'G', root: 'G', type: 'major',
    notes: ['G', 'B', 'D'], intervals: ['1', '3', '5'],
    guitar: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barres: [], baseFret: 1 },
    piano: { keys: [7, 11, 2] },
    relatedChords: ['C', 'D', 'Em', 'Am', 'Bm']
  },
  {
    id: 'G-minor', name: 'Gm', root: 'G', type: 'minor',
    notes: ['G', 'A#', 'D'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barres: [{ fret: 3, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [7, 10, 2] },
    relatedChords: ['Bb', 'F', 'Cm', 'Eb']
  },
  {
    id: 'G-7th', name: 'G7', root: 'G', type: '7th',
    notes: ['G', 'B', 'D', 'F'], intervals: ['1', '3', '5', 'b7'],
    guitar: { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], barres: [], baseFret: 1 },
    piano: { keys: [7, 11, 2, 5] },
    relatedChords: ['C', 'D7', 'Am']
  },
  {
    id: 'G-maj7', name: 'Gmaj7', root: 'G', type: 'maj7',
    notes: ['G', 'B', 'D', 'F#'], intervals: ['1', '3', '5', '7'],
    guitar: { frets: [3, 2, 0, 0, 0, 2], fingers: [3, 2, 0, 0, 0, 1], barres: [], baseFret: 1 },
    piano: { keys: [7, 11, 2, 6] },
    relatedChords: ['Em7', 'Am7', 'D']
  },
  {
    id: 'G-min7', name: 'Gm7', root: 'G', type: 'min7',
    notes: ['G', 'A#', 'D', 'F'], intervals: ['1', 'b3', '5', 'b7'],
    guitar: { frets: [3, 5, 3, 3, 3, 3], fingers: [1, 3, 1, 1, 1, 1], barres: [{ fret: 3, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [7, 10, 2, 5] },
    relatedChords: ['Bb', 'F', 'Eb', 'Cm7']
  },
  {
    id: 'G-sus2', name: 'Gsus2', root: 'G', type: 'sus2',
    notes: ['G', 'A', 'D'], intervals: ['1', '2', '5'],
    guitar: { frets: [3, 0, 0, 0, 3, 3], fingers: [1, 0, 0, 0, 2, 3], barres: [], baseFret: 1 },
    piano: { keys: [7, 9, 2] },
    relatedChords: ['G', 'D', 'Em']
  },

  // A MAJOR
  {
    id: 'A-major', name: 'A', root: 'A', type: 'major',
    notes: ['A', 'C#', 'E'], intervals: ['1', '3', '5'],
    guitar: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], barres: [], baseFret: 1 },
    piano: { keys: [9, 1, 4] },
    relatedChords: ['D', 'E', 'F#m', 'Bm', 'C#m']
  },
  {
    id: 'A-minor', name: 'Am', root: 'A', type: 'minor',
    notes: ['A', 'C', 'E'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], barres: [], baseFret: 1 },
    piano: { keys: [9, 0, 4] },
    relatedChords: ['C', 'G', 'Em', 'F', 'Dm']
  },
  {
    id: 'A-7th', name: 'A7', root: 'A', type: '7th',
    notes: ['A', 'C#', 'E', 'G'], intervals: ['1', '3', '5', 'b7'],
    guitar: { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0], barres: [], baseFret: 1 },
    piano: { keys: [9, 1, 4, 7] },
    relatedChords: ['D', 'E7', 'Bm']
  },
  {
    id: 'A-maj7', name: 'Amaj7', root: 'A', type: 'maj7',
    notes: ['A', 'C#', 'E', 'G#'], intervals: ['1', '3', '5', '7'],
    guitar: { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 3, 1, 4, 0], barres: [], baseFret: 1 },
    piano: { keys: [9, 1, 4, 8] },
    relatedChords: ['F#m7', 'C#m7', 'E']
  },
  {
    id: 'A-min7', name: 'Am7', root: 'A', type: 'min7',
    notes: ['A', 'C', 'E', 'G'], intervals: ['1', 'b3', '5', 'b7'],
    guitar: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], barres: [], baseFret: 1 },
    piano: { keys: [9, 0, 4, 7] },
    relatedChords: ['C', 'G', 'Em7', 'F']
  },
  {
    id: 'A-sus2', name: 'Asus2', root: 'A', type: 'sus2',
    notes: ['A', 'B', 'E'], intervals: ['1', '2', '5'],
    guitar: { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 2, 3, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [9, 11, 4] },
    relatedChords: ['A', 'D', 'E']
  },
  {
    id: 'A-sus4', name: 'Asus4', root: 'A', type: 'sus4',
    notes: ['A', 'D', 'E'], intervals: ['1', '4', '5'],
    guitar: { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0], barres: [], baseFret: 1 },
    piano: { keys: [9, 2, 4] },
    relatedChords: ['A', 'D', 'E']
  },

  // B MAJOR
  {
    id: 'B-major', name: 'B', root: 'B', type: 'major',
    notes: ['B', 'D#', 'F#'], intervals: ['1', '3', '5'],
    guitar: { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 3, 4, 2, 1], barres: [{ fret: 2, fromString: 5, toString: 1 }], baseFret: 1 },
    piano: { keys: [11, 3, 6] },
    relatedChords: ['E', 'F#', 'G#m', 'C#m', 'D#m']
  },
  {
    id: 'B-minor', name: 'Bm', root: 'B', type: 'minor',
    notes: ['B', 'D', 'F#'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barres: [{ fret: 2, fromString: 5, toString: 1 }], baseFret: 1 },
    piano: { keys: [11, 2, 6] },
    relatedChords: ['G', 'D', 'A', 'Em']
  },
  {
    id: 'B-7th', name: 'B7', root: 'B', type: '7th',
    notes: ['B', 'D#', 'F#', 'A'], intervals: ['1', '3', '5', 'b7'],
    guitar: { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], barres: [], baseFret: 1 },
    piano: { keys: [11, 3, 6, 9] },
    relatedChords: ['E', 'F#7', 'G#m']
  },
  {
    id: 'B-min7', name: 'Bm7', root: 'B', type: 'min7',
    notes: ['B', 'D', 'F#', 'A'], intervals: ['1', 'b3', '5', 'b7'],
    guitar: { frets: [-1, 2, 4, 2, 3, 2], fingers: [0, 1, 3, 1, 2, 1], barres: [{ fret: 2, fromString: 5, toString: 1 }], baseFret: 1 },
    piano: { keys: [11, 2, 6, 9] },
    relatedChords: ['G', 'D', 'A', 'Em7']
  },

  // F# / Gb
  {
    id: 'F#-major', name: 'F#', root: 'F#', type: 'major',
    notes: ['F#', 'A#', 'C#'], intervals: ['1', '3', '5'],
    guitar: { frets: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1], barres: [{ fret: 2, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [6, 10, 1] },
    relatedChords: ['B', 'C#', 'D#m', 'G#m']
  },
  {
    id: 'F#-minor', name: 'F#m', root: 'F#', type: 'minor',
    notes: ['F#', 'A', 'C#'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], barres: [{ fret: 2, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [6, 9, 1] },
    relatedChords: ['A', 'D', 'Bm', 'E']
  },
  {
    id: 'F#-min7', name: 'F#m7', root: 'F#', type: 'min7',
    notes: ['F#', 'A', 'C#', 'E'], intervals: ['1', 'b3', '5', 'b7'],
    guitar: { frets: [2, 4, 2, 2, 2, 2], fingers: [1, 3, 1, 1, 1, 1], barres: [{ fret: 2, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [6, 9, 1, 4] },
    relatedChords: ['A', 'D', 'Bm7', 'E7']
  },

  // Ab / G#
  {
    id: 'Ab-major', name: 'Ab', root: 'G#', type: 'major',
    notes: ['G#', 'C', 'D#'], intervals: ['1', '3', '5'],
    guitar: { frets: [4, 6, 6, 5, 4, 4], fingers: [1, 3, 4, 2, 1, 1], barres: [{ fret: 4, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [8, 0, 3] },
    relatedChords: ['Db', 'Eb', 'Fm', 'Bbm']
  },
  {
    id: 'Ab-minor', name: 'Abm', root: 'G#', type: 'minor',
    notes: ['G#', 'B', 'D#'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1], barres: [{ fret: 4, fromString: 6, toString: 1 }], baseFret: 1 },
    piano: { keys: [8, 11, 3] },
    relatedChords: ['B', 'E', 'F#m', 'Db']
  },

  // Bb / A#
  {
    id: 'Bb-major', name: 'Bb', root: 'A#', type: 'major',
    notes: ['A#', 'D', 'F'], intervals: ['1', '3', '5'],
    guitar: { frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 3, 4, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }], baseFret: 1 },
    piano: { keys: [10, 2, 5] },
    relatedChords: ['Eb', 'F', 'Gm', 'Cm', 'Dm']
  },
  {
    id: 'Bb-minor', name: 'Bbm', root: 'A#', type: 'minor',
    notes: ['A#', 'C#', 'F'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }], baseFret: 1 },
    piano: { keys: [10, 1, 5] },
    relatedChords: ['Db', 'Ab', 'Ebm', 'Fm']
  },
  {
    id: 'Bb-7th', name: 'Bb7', root: 'A#', type: '7th',
    notes: ['A#', 'D', 'F', 'G#'], intervals: ['1', '3', '5', 'b7'],
    guitar: { frets: [-1, 1, 3, 1, 3, 1], fingers: [0, 1, 3, 1, 4, 1], barres: [{ fret: 1, fromString: 5, toString: 1 }], baseFret: 1 },
    piano: { keys: [10, 2, 5, 8] },
    relatedChords: ['Eb', 'F7', 'Gm']
  },

  // Eb / D#
  {
    id: 'Eb-major', name: 'Eb', root: 'D#', type: 'major',
    notes: ['D#', 'G', 'A#'], intervals: ['1', '3', '5'],
    guitar: { frets: [-1, -1, 1, 3, 4, 3], fingers: [0, 0, 1, 3, 4, 2], barres: [], baseFret: 1 },
    piano: { keys: [3, 7, 10] },
    relatedChords: ['Ab', 'Bb', 'Cm', 'Fm', 'Gm']
  },
  {
    id: 'Eb-minor', name: 'Ebm', root: 'D#', type: 'minor',
    notes: ['D#', 'F#', 'A#'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [-1, -1, 1, 3, 4, 2], fingers: [0, 0, 1, 3, 4, 2], barres: [], baseFret: 1 },
    piano: { keys: [3, 6, 10] },
    relatedChords: ['Gb', 'Ab', 'Bbm', 'Cbm']
  },

  // Db / C#
  {
    id: 'Db-major', name: 'Db', root: 'C#', type: 'major',
    notes: ['C#', 'F', 'G#'], intervals: ['1', '3', '5'],
    guitar: { frets: [-1, 4, 3, 1, 2, 1], fingers: [0, 4, 3, 1, 2, 1], barres: [{ fret: 1, fromString: 4, toString: 1 }], baseFret: 1 },
    piano: { keys: [1, 5, 8] },
    relatedChords: ['Gb', 'Ab', 'Bbm', 'Fm', 'Ebm']
  },
  {
    id: 'Db-minor', name: 'C#m', root: 'C#', type: 'minor',
    notes: ['C#', 'E', 'G#'], intervals: ['1', 'b3', '5'],
    guitar: { frets: [-1, 4, 6, 6, 5, 4], fingers: [0, 1, 3, 4, 2, 1], barres: [{ fret: 4, fromString: 5, toString: 1 }], baseFret: 1 },
    piano: { keys: [1, 4, 8] },
    relatedChords: ['E', 'A', 'F#m', 'B']
  },
  // Common Slash Chords (hand-crafted shapes)
  {
    id: 'C-major/E', name: 'C/E', root: 'C', type: 'major',
    notes: ['E', 'C', 'E', 'G', 'C', 'E'], intervals: ['3', '1', '3', '5', '1', '3'],
    guitar: { frets: [0, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barres: [], baseFret: 1 },
    piano: { keys: [4, 0, 7] }
  },
  {
    id: 'C-major/G', name: 'C/G', root: 'C', type: 'major',
    notes: ['G', 'C', 'E', 'G', 'C', 'E'], intervals: ['5', '1', '3', '5', '1', '3'],
    guitar: { frets: [3, 3, 2, 0, 1, 0], fingers: [3, 4, 2, 0, 1, 0], barres: [], baseFret: 1 },
    piano: { keys: [7, 0, 4] }
  },
  {
    id: 'D-major/F#', name: 'D/F#', root: 'D', type: 'major',
    notes: ['F#', 'D', 'A', 'D', 'F#'], intervals: ['3', '1', '5', '1', '3'],
    guitar: { frets: [2, -1, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3], barres: [], baseFret: 1 },
    piano: { keys: [6, 2, 9] }
  },
  {
    id: 'D-major/A', name: 'D/A', root: 'D', type: 'major',
    notes: ['A', 'D', 'A', 'D', 'F#'], intervals: ['5', '1', '5', '1', '3'],
    guitar: { frets: [-1, 0, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barres: [], baseFret: 1 },
    piano: { keys: [9, 2, 6] }
  },
  {
    id: 'E-major/G#', name: 'E/G#', root: 'E', type: 'major',
    notes: ['G#', 'B', 'E', 'G#', 'B', 'E'], intervals: ['3', '5', '1', '3', '5', '1'],
    guitar: { frets: [4, 2, 2, 1, 0, 0], fingers: [4, 2, 3, 1, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [8, 11, 4] }
  },
  {
    id: 'E-major/B', name: 'E/B', root: 'E', type: 'major',
    notes: ['B', 'E', 'G#', 'B', 'E'], intervals: ['5', '1', '3', '5', '1'],
    guitar: { frets: [-1, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [11, 4, 8] }
  },
  {
    id: 'F-major/A', name: 'F/A', root: 'F', type: 'major',
    notes: ['A', 'F', 'A', 'C', 'F'], intervals: ['3', '1', '3', '5', '1'],
    guitar: { frets: [-1, 0, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1], barres: [], baseFret: 1 },
    piano: { keys: [9, 5, 0] }
  },
  {
    id: 'G-major/B', name: 'G/B', root: 'G', type: 'major',
    notes: ['B', 'G', 'D', 'G', 'B'], intervals: ['3', '1', '5', '1', '3'],
    guitar: { frets: [-1, 2, 0, 0, 0, 3], fingers: [0, 1, 0, 0, 0, 2], barres: [], baseFret: 1 },
    piano: { keys: [11, 7, 2] }
  },
  {
    id: 'A-major/C#', name: 'A/C#', root: 'A', type: 'major',
    notes: ['C#', 'A', 'C#', 'E', 'A'], intervals: ['3', '1', '3', '5', '1'],
    guitar: { frets: [-1, 4, 2, 2, 2, 0], fingers: [0, 4, 1, 2, 3, 0], barres: [{ fret: 2, fromString: 4, toString: 2 }], baseFret: 1 },
    piano: { keys: [1, 9, 4] }
  },
  {
    id: 'A-minor/G', name: 'Am/G', root: 'A', type: 'minor',
    notes: ['G', 'A', 'E', 'A', 'C', 'E'], intervals: ['b7', '1', '5', '1', 'b3', '5'],
    guitar: { frets: [3, 0, 2, 2, 1, 0], fingers: [4, 0, 2, 3, 1, 0], barres: [], baseFret: 1 },
    piano: { keys: [7, 9, 0, 4] }
  },
  {
    id: 'D-minor/F', name: 'Dm/F', root: 'D', type: 'minor',
    notes: ['F', 'D', 'A', 'D', 'F'], intervals: ['b3', '1', '5', '1', 'b3'],
    guitar: { frets: [1, -1, 0, 2, 3, 1], fingers: [1, 0, 0, 2, 4, 1], barres: [], baseFret: 1 },
    piano: { keys: [5, 2, 9] }
  },
  {
    id: 'E-minor/G', name: 'Em/G', root: 'E', type: 'minor',
    notes: ['G', 'B', 'E', 'G', 'B', 'E'], intervals: ['b3', '5', '1', 'b3', '5', '1'],
    guitar: { frets: [3, 2, 2, 0, 0, 0], fingers: [3, 1, 2, 0, 0, 0], barres: [], baseFret: 1 },
    piano: { keys: [7, 11, 4] }
  },
  {
    id: 'F-major/C', name: 'F/C', root: 'F', type: 'major',
    notes: ['C', 'F', 'A', 'C', 'F'], intervals: ['5', '1', '5', '1', '3'],
    guitar: { frets: [-1, 3, 3, 2, 1, 1], fingers: [0, 3, 4, 2, 1, 1], barres: [{ fret: 1, fromString: 2, toString: 1 }], baseFret: 1 },
    piano: { keys: [0, 5, 9] }
  },
  {
    id: 'G-major/D', name: 'G/D', root: 'G', type: 'major',
    notes: ['D', 'D', 'G', 'B'], intervals: ['5', '5', '1', '3'],
    guitar: { frets: [-1, -1, 0, 0, 0, 3], fingers: [0, 0, 0, 0, 0, 3], barres: [], baseFret: 1 },
    piano: { keys: [2, 7, 11] }
  },
];

// ═══════════════════════════════════════════════════════════════
//  PROGRAMMATIC CHORD GENERATOR
//  Fills in every root × type combination not already in the DB
// ═══════════════════════════════════════════════════════════════

const NOTE_TO_IDX: Record<string, number> = {
  C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11,
};

// Root fret positions on string 6 (low E) — E-shape barre
const ROOT_E_FRET: Record<string, number> = {
  E:0,F:1,'F#':2,G:3,'G#':4,A:5,'A#':6,B:7,C:8,'C#':9,D:10,'D#':11,
};
// Root fret positions on string 5 (A) — A-shape barre
const ROOT_A_FRET: Record<string, number> = {
  A:0,'A#':1,B:2,C:3,'C#':4,D:5,'D#':6,E:7,F:8,'F#':9,G:10,'G#':11,
};

// Interval semitones for each chord type
const CHORD_INTERVALS: Record<ChordType, number[]> = {
  major:   [0,4,7],
  minor:   [0,3,7],
  '7th':   [0,4,7,10],
  maj7:    [0,4,7,11],
  min7:    [0,3,7,10],
  sus2:    [0,2,7],
  sus4:    [0,5,7],
  dim:     [0,3,6],
  aug:     [0,4,8],
  '9th':   [0,4,7,10,14],
  add9:    [0,4,7,14],
  maj9:    [0,4,7,11,14],
  min9:    [0,3,7,10,14],
  dom9:    [0,4,7,10,14],
  '6th':   [0,4,7,9],
  min6:    [0,3,7,9],
  halfdim: [0,3,6,10],
  '11th':  [0,4,7,10,14,17],
  '13th':  [0,4,7,10,14,17,21],
  dim7:    [0,3,6,9],
  min13:   [0,3,7,10,14,17,21],
  min11:   [0,3,7,10,14,17],
  maj6:    [0,4,7,9],
  '7sus4': [0,5,7,10],
  '7sus2': [0,2,7,10],
  // ── New types from reference library ──────────────────────────────────────
  power:   [0,7],
  minmaj7: [0,3,7,11],
  aug7:    [0,4,8,10],
  '7b9':   [0,4,7,10,13],
  '7s9':   [0,4,7,10,15],
  '69':    [0,4,7,9,14],
  '9sus4': [0,5,7,10,14],
  madd9:   [0,3,7,14],
  maj11:   [0,4,7,11,14,17],
  '7#11':  [0,4,7,10,14,18],
  'maj7#11': [0,4,7,11,14,18],
  add11:   [0,4,7,17],
  maj13:   [0,4,7,11,14,17,21],
  '13sus4': [0,5,7,10,14,21],
  sus2add13: [0,2,7,21],
  '7b5':   [0,4,6,10],
  '7alt':  [0,4,10,13],
};

const CHORD_INTERVAL_NAMES: Record<ChordType, string[]> = {
  major:   ['1','3','5'],
  minor:   ['1','b3','5'],
  '7th':   ['1','3','5','b7'],
  maj7:    ['1','3','5','7'],
  min7:    ['1','b3','5','b7'],
  sus2:    ['1','2','5'],
  sus4:    ['1','4','5'],
  dim:     ['1','b3','b5'],
  aug:     ['1','3','#5'],
  '9th':   ['1','3','5','b7','9'],
  add9:    ['1','3','5','9'],
  maj9:    ['1','3','5','7','9'],
  min9:    ['1','b3','5','b7','9'],
  dom9:    ['1','3','5','b7','9'],
  '6th':   ['1','3','5','6'],
  min6:    ['1','b3','5','6'],
  halfdim: ['1','b3','b5','b7'],
  '11th':  ['1','3','5','b7','9','11'],
  '13th':  ['1','3','5','b7','9','11','13'],
  dim7:    ['1','b3','b5','bb7'],
  min13:   ['1','b3','5','b7','9','11','13'],
  min11:   ['1','b3','5','b7','9','11'],
  maj6:    ['1','3','5','6'],
  '7sus4': ['1','4','5','b7'],
  '7sus2': ['1','2','5','b7'],
  power:   ['1','5'],
  minmaj7: ['1','b3','5','7'],
  aug7:    ['1','3','#5','b7'],
  '7b9':   ['1','3','5','b7','b9'],
  '7s9':   ['1','3','5','b7','#9'],
  '69':    ['1','3','5','6','9'],
  '9sus4': ['1','4','5','b7','9'],
  madd9:   ['1','b3','5','9'],
  maj11:   ['1','3','5','7','9','11'],
  '7#11':  ['1','3','5','b7','9','#11'],
  'maj7#11': ['1','3','5','7','9','#11'],
  add11:   ['1','3','5','11'],
  maj13:   ['1','3','5','7','9','11','13'],
  '13sus4': ['1','4','5','b7','9','13'],
  sus2add13: ['1','2','5','13'],
  '7b5':   ['1','3','b5','b7'],
  '7alt':  ['1','3','b7','b9'],
};

const CHORD_SUFFIX: Record<ChordType, string> = {
  major:   '',   minor:   'm',   '7th':   '7',   maj7:    'maj7',
  min7:    'm7', sus2:    'sus2', sus4:   'sus4', dim:     'dim',
  aug:     'aug','9th':   '9',   add9:   'add9', maj9:    'maj9',
  min9:    'm9', dom9:    '9',   '6th':  '6',    min6:    'm6',
  halfdim: 'ø7','11th':  '11',  '13th': '13',
  dim7:    'dim7', min11: 'm11', maj6:   'maj6', '7sus4': '7sus4', '7sus2': '7sus2',
  power:   '5',    minmaj7: 'm/maj7', aug7: 'aug7',
  '7b9':   '7b9',  '7s9':  '7#9',    '69': '6/9',   '9sus4': '9sus4',
  min13:   'm13',
  madd9:   'm(add9)',
  maj11:   'maj11',
  '7#11':  '7#11',
  'maj7#11': 'maj7#11',
  add11:   'add11',
  maj13:   'maj13',
  '13sus4': '13sus4',
  sus2add13: 'sus2add13',
  '7b5':   '7b5',
  '7alt':  '7alt',
};

// Guitar shape templates: offsets from root fret; -1 = mute
// shape 'E' = root on 6th string; shape 'A' = root on 5th string
// Rule: at most 4 distinct fingers (barre counts as 1, covers all strings at root fret).
//        Strings above the barre need separate fingers (2, 3, 4).
interface GuitarShapeTemplate {
  shape: 'E' | 'A';
  offsets: number[];          // length 6, strings 6→1
  fingers: number[];
  hasBarre: boolean;
  barreToString?: number;     // partial barre — default 1 (all strings)
}

const GUITAR_SHAPES: Record<ChordType, GuitarShapeTemplate> = {
  // ── Standard barre shapes — well-established, 3-4 fingers ──────────────────
  // major: barre(str6-1) + ring(str5+2) + pinky(str4+2) + middle(str3+1)
  major:   { shape:'E', offsets:[0,2,2,1,0,0],     fingers:[1,3,4,2,1,1], hasBarre:true  },
  // minor: barre + ring(str5+2) + pinky(str4+2)
  minor:   { shape:'E', offsets:[0,2,2,0,0,0],     fingers:[1,3,4,1,1,1], hasBarre:true  },
  // dom7: barre + ring(str5+2) + middle(str3+1)
  '7th':   { shape:'E', offsets:[0,2,0,1,0,0],     fingers:[1,3,1,2,1,1], hasBarre:true  },
  // maj7: barre + ring(str5+2) + middle-barre(str4+1,str3+1)
  maj7:    { shape:'E', offsets:[0,2,1,1,0,0],     fingers:[1,3,2,2,1,1], hasBarre:true  },
  // min7: barre + ring(str5+2)
  min7:    { shape:'E', offsets:[0,2,0,0,0,0],     fingers:[1,3,1,1,1,1], hasBarre:true  },
  // sus4: barre + middle(str5+2) + ring(str4+2) + pinky(str3+2)
  sus4:    { shape:'E', offsets:[0,2,2,2,0,0],     fingers:[1,2,3,4,1,1], hasBarre:true  },
  // sus2: A-shape barre + ring(str4+2) + pinky(str3+2)
  sus2:    { shape:'A', offsets:[-1,0,2,2,0,0],    fingers:[0,1,3,4,1,1], hasBarre:true  },
  // 7sus4: barre + middle(str5+2) + ring(str4+2) + pinky(str3+2)
  '7sus4': { shape:'E', offsets:[0,2,2,2,0,0],     fingers:[1,2,3,4,1,1], hasBarre:true  },
  // 7sus2: A-shape barre + ring(str4+2) + pinky(str3+2)
  '7sus2': { shape:'A', offsets:[-1,0,2,2,0,0],    fingers:[0,1,3,4,1,1], hasBarre:true  },

  // ── Non-barre shapes ────────────────────────────────────────────────────────
  // dim: A-shape — root(str5) + b5(str4+1) + root(str3+2) + b3(str2+1) — mute str1
  // Verified: Adim = A,Eb,A,C
  dim:     { shape:'A', offsets:[-1,0,1,2,1,-1],   fingers:[0,1,2,4,3,0], hasBarre:false },
  // aug: E-shape — root(str6) + #5(str4+2) + 3rd(str3+1) + 3rd(str2+1) — mute str5,str1
  // Verified: Eaug = E,G#,B# (C); 4 fingers: index(str6)+pinky(str4)+ring(str3)+middle(str2)
  aug:     { shape:'E', offsets:[0,-1,2,1,1,-1],   fingers:[1,0,4,3,2,0], hasBarre:false },

  // ── Fixed extended chords (previously required 5 fingers) ──────────────────
  // dom9 / 9th: barre + ring(str5+2) + middle(str3+1) + PINKY(str1+2)
  // Verified: E9 = E,B,D,G#,F# — pinky goes to str1, NOT covered by barre
  '9th':   { shape:'E', offsets:[0,2,0,1,0,2],     fingers:[1,3,1,2,1,4], hasBarre:true  },
  dom9:    { shape:'E', offsets:[0,2,0,1,0,2],     fingers:[1,3,1,2,1,4], hasBarre:true  },
  // add9: sparse shape — root(str6)+3rd(str3+1)+5th(str2)+9th(str1+2); no barre needed
  // Verified for E: E,G#,B,F# — index(str6)+middle(str3)+ring(str1); str2 open-at-root
  add9:    { shape:'E', offsets:[0,-1,-1,1,0,2],   fingers:[1,0,0,2,1,3], hasBarre:false },
  // maj9: barre + ring(str5+2) + middle-barre(str4+1,str3+1) + PINKY(str1+2)
  // Verified: Emaj9 = E,B,D#,G#,F#
  maj9:    { shape:'E', offsets:[0,2,1,1,0,2],     fingers:[1,3,2,2,1,4], hasBarre:true  },
  // min9: barre + ring(str5+2) + PINKY(str1+2); middle strings stay on barre
  // Verified: Em9 = E,B,D,G,F# — 3 fingers total
  min9:    { shape:'E', offsets:[0,2,0,0,0,2],     fingers:[1,3,1,1,1,4], hasBarre:true  },

  // 6th / maj6: A-shape — index(str5-root) + ring-mini-barre(str4-str1 at +2)
  // Verified: A6 = A,E,A,C#,F# — 2 finger groups
  '6th':   { shape:'A', offsets:[-1,0,2,2,2,2],    fingers:[0,1,3,3,3,3], hasBarre:false },
  maj6:    { shape:'A', offsets:[-1,0,2,2,2,2],    fingers:[0,1,3,3,3,3], hasBarre:false },
  // min6: A-shape barre(str5-1@R) + ring-barre(str4+str3@R+2) + middle(str2@R+1) + pinky(str1@R+2)
  // Verified: Am6 = A(root),E(5th),A(root),C(b3),F#(6th) — all 4 notes present
  min6:    { shape:'A', offsets:[-1,0,2,2,1,2],    fingers:[0,1,3,3,2,4], hasBarre:true  },

  // halfdim (ø7): A-shape — root(str5)+b5(str4+1)+mute(str3)+b3(str2+1)+b7(str1+3)
  // Verified: Aø7 = A,Eb,C,G — all 4 distinct notes; str3 muted avoids impossible finger cross
  // 4 fingers: index(str5@R)+middle(str4@R+1)+ring(str2@R+1,skip str3)+pinky(str1@R+3)
  halfdim: { shape:'A', offsets:[-1,0,1,-1,1,3],   fingers:[0,1,2,0,3,4], hasBarre:false },
  // 11th: A-shape barre — covers str5(root)+str4(11th)+str1(5th); ring+pinky on str3,str2
  // Verified: A11 = A,D,A,C#,E — barre(str5+str4+str1) + ring(str3+2) + pinky(str2+2)
  '11th':  { shape:'A', offsets:[-1,0,0,2,2,0],    fingers:[0,1,1,3,4,1], hasBarre:true  },
  // 13th: E-shape, mute str5 — barre + middle(str3+1) + pinky(str2+2)
  // Verified: A13 = A,G,C#,F#,A — barre(str6+str4+str1) + middle(str3+1) + pinky(str2+2)
  '13th':  { shape:'E', offsets:[0,-1,0,1,2,0],    fingers:[1,0,1,2,4,1], hasBarre:true  },
  // dim7: A-shape — index+middle+ring+pinky across str4-1; no same-finger duplicates
  // Verified: Adim7 = A,Eb,A,C,F# — index(str4+1)+ring(str3+2)+middle(str2+1)+pinky(str1+2)
  dim7:    { shape:'A', offsets:[-1,0,1,2,1,2],    fingers:[0,0,1,3,2,4], hasBarre:false },
  // min11: barre + ring(str5+2) + pinky(str1+2); others on barre
  // Verified: Em11 = E,B,D,G,B,F# — 3 fingers
  min11:   { shape:'E', offsets:[0,2,0,0,0,2],     fingers:[1,3,1,1,1,4], hasBarre:true  },

  // ── New shapes (7 additional types) ─────────────────────────────────────────
  // power (1,5): root(str6)+5th(str5)+root-8va(str4); mute str3-1 — classic rock shape
  // Verified: E5 = E,B,E — index(str6)+middle(str5)+ring(str4)
  power:   { shape:'E', offsets:[0,2,2,-1,-1,-1],  fingers:[1,2,3,0,0,0], hasBarre:false },

  // minmaj7 (1,b3,5,7): E-shape minor barre + maj7 on str4(+1)
  // Verified: Em/maj7 = E,B,D#,G,B,E — barre(1)+ring(3)@str5+middle(2)@str4
  minmaj7: { shape:'E', offsets:[0,2,1,0,0,0],     fingers:[1,3,2,1,1,1], hasBarre:true  },

  // aug7 (7#5, 1,3,#5,b7): E-shape barre; str5 muted; str4@0=b7, str3@1=3rd, str2@1=#5
  // Verified: E aug7 = E,D,G#,C,E — barre(1)+middle(2)@str3+pinky(4)@str2; str5 muted
  aug7:    { shape:'E', offsets:[0,-1,0,1,1,0],    fingers:[1,0,1,2,4,1], hasBarre:true  },

  // 7b9 (1,3,5,b7,b9): E-shape dom7 + b9 on str1(+1)
  // Verified: E7b9 = E,B,D,G#,B,F — barre(1)+ring(3)@str5+middle(2)@str3+pinky(4)@str1
  '7b9':   { shape:'E', offsets:[0,2,0,1,0,1],     fingers:[1,3,1,2,1,4], hasBarre:true  },

  // 7#9 "Hendrix" (1,3,5,b7,#9): E-shape dom7 + #9 on str1(+3)
  // Verified: E7#9 = E,B,D,G#,B,G — barre(1)+ring(3)@str5+middle(2)@str3+pinky(4)@str1+3
  '7s9':   { shape:'E', offsets:[0,2,0,1,0,3],     fingers:[1,3,1,2,1,4], hasBarre:true  },

  // 6/9 (1,3,5,6,9): A-shape barre; ring mini-barre(str4+str3@+2); str2@0=9th(barre); middle@str1+2=6th
  // Verified: A6/9 = A,E,A,B,F# — index-barre(1)@str5+str2+str1-base; ring(3)@str4+str3; middle(2)@str1+2
  '69':    { shape:'A', offsets:[-1,0,2,2,0,2],    fingers:[0,1,3,3,1,2], hasBarre:true  },

  // 9sus4 (1,4,5,b7,9): A-shape flat barre — all strings at rootFret give root,4th,b7,9th,5th
  // Verified: A9sus4 = A,D,G,B,E — pure A-shape barre, no extra fingers needed
  '9sus4': { shape:'A', offsets:[-1,0,0,0,0,0],    fingers:[0,1,1,1,1,1], hasBarre:true  },
  
  // min13 (1,b3,5,b7,9,11,13): E-shape minor barre + 13th on B string
  // Verified: Am13 = A,G,C,F#,A — index-barre(1)@str6+str4+str3+str1; ring(3)@str2+2
  min13:   { shape:'E', offsets:[0,-1,0,0,2,0],    fingers:[1,0,1,1,3,1], hasBarre:true  },

  // madd9: E-shape root + 5th + 9th + b3
  madd9:   { shape:'E', offsets:[0,2,4,0,0,0],     fingers:[1,2,4,1,1,1], hasBarre:true  },

  // maj11: A-shape playable voicing
  maj11:   { shape:'A', offsets:[-1,0,2,1,2,0],    fingers:[0,1,3,2,4,0], hasBarre:false },

  // 7#11: E-shape dominant sharp 11
  '7#11':  { shape:'E', offsets:[0,-1,0,1,1,0],    fingers:[1,0,2,3,4,1], hasBarre:true  },

  // maj7#11: E-shape maj7 sharp 11
  'maj7#11': { shape:'E', offsets:[0,-1,1,1,0,-1],   fingers:[2,0,3,4,1,0], hasBarre:false },

  // add11: A-shape flat barre
  add11:   { shape:'A', offsets:[-1,0,2,2,2,0],    fingers:[0,1,3,3,3,1], hasBarre:true  },

  // maj13: E-shape major 13th
  maj13:   { shape:'E', offsets:[0,-1,1,1,2,-1],   fingers:[1,0,2,2,4,0], hasBarre:false },

  // 13sus4: E-shape 13th suspended 4th
  '13sus4': { shape:'E', offsets:[0,-1,0,2,2,-1],   fingers:[1,0,1,3,4,0], hasBarre:false },

  // sus2add13: A-shape suspended 2nd add 13
  sus2add13: { shape:'A', offsets:[-1,0,2,2,3,-1],  fingers:[0,1,3,3,4,0], hasBarre:false },

  // 7b5: E-shape dominant 7th flat 5
  '7b5':   { shape:'E', offsets:[0,-1,0,1,1,-1],   fingers:[1,0,2,3,4,0], hasBarre:false },

  // 7alt: E-shape altered 7th
  '7alt':  { shape:'E', offsets:[0,-1,0,1,2,-1],   fingers:[1,0,2,3,4,0], hasBarre:false },
};

function buildGuitarChord(root: string, type: ChordType): GuitarChordData {
  const tmpl = GUITAR_SHAPES[type];
  const rootFret = tmpl.shape === 'E' ? ROOT_E_FRET[root] : ROOT_A_FRET[root];

  const frets = tmpl.offsets.map(o => (o === -1 ? -1 : rootFret + o));

  const barres: { fret: number; fromString: number; toString: number }[] = [];
  if (tmpl.hasBarre && rootFret >= 1) {
    barres.push({
      fret: rootFret,
      fromString: tmpl.shape === 'E' ? 6 : 5,
      toString: tmpl.barreToString ?? 1,
    });
  }

  // baseFret: set so the diagram window starts at the lowest non-muted fret
  const nonMuted = frets.filter(f => f > 0);
  const minPlayed = nonMuted.length > 0 ? Math.min(...nonMuted) : 1;
  const baseFret = minPlayed > 1 ? minPlayed : 1;

  return { frets, fingers: tmpl.fingers, barres, baseFret };
}

function buildPianoKeys(root: string, type: ChordType): PianoChordData {
  const rootIdx = NOTE_TO_IDX[root];
  const semitones = CHORD_INTERVALS[type];
  const keys = semitones.map(s => (rootIdx + s) % 12);
  return { keys };
}

function buildNotes(root: string, type: ChordType): string[] {
  const rootIdx = NOTE_TO_IDX[root];
  return CHORD_INTERVALS[type].map(s => NOTES[(rootIdx + s) % 12]);
}

// Display root label  (C# → C#/Db, etc.)
function rootLabel(root: string): string {
  return NOTE_DISPLAY[root] || root;
}

function buildChordName(root: string, type: ChordType): string {
  const suffix = CHORD_SUFFIX[type];
  const display = NOTE_DISPLAY[root];
  if (display && display.includes('/')) {
    const parts = display.split('/');
    return `${parts[0]}${suffix}/${parts[1]}${suffix}`;
  }
  return root + suffix;
}

function generateMissingChords(): Chord[] {
  const existingIds = new Set(chordDatabase.map(c => c.id));
  const generated: Chord[] = [];

  const allTypes = Object.keys(CHORD_INTERVALS) as ChordType[];

  for (const root of NOTES) {
    for (const type of allTypes) {
      const id = `${root}-${type}`;
      if (existingIds.has(id)) continue;

      generated.push({
        id,
        name: buildChordName(root, type),
        root,
        type,
        notes:     buildNotes(root, type),
        intervals: CHORD_INTERVAL_NAMES[type],
        guitar:    buildGuitarChord(root, type),
        piano:     buildPianoKeys(root, type),
      });
    }
  }
  return generated;
}

// Merge generated chords into the database (hand-crafted take priority)
const generatedChords = generateMissingChords();
chordDatabase.push(...generatedChords);

export function getAllChords(): Chord[] {
  return chordDatabase;
}

export function getChordById(id: string): Chord | undefined {
  return chordDatabase.find(c => c.id === id);
}

export function searchChords(query: string): Chord[] {
  const q = query.toLowerCase().trim();
  if (!q) return chordDatabase;
  return chordDatabase.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.root.toLowerCase().includes(q) ||
    c.type.toLowerCase().includes(q) ||
    c.notes.some(n => n.toLowerCase().includes(q))
  );
}


export function getRelatedChords(chord: Chord): Chord[] {
  if (!chord.relatedChords) return [];
  return chord.relatedChords
    .map(name => chordDatabase.find(c => c.name === name))
    .filter(Boolean) as Chord[];
}

export function suggestNextChord(progression: Chord[]): Chord[] {
  if (progression.length === 0) return chordDatabase.slice(0, 4);
  const lastChord = progression[progression.length - 1];
  return getRelatedChords(lastChord).filter(c => !progression.find(p => p.id === c.id)).slice(0, 4);
}

export const CHORD_TYPES: { value: ChordType; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
  { value: '7th', label: '7th' },
  { value: 'maj7', label: 'Maj7' },
  { value: 'min7', label: 'Min7' },
  { value: 'sus2', label: 'Sus2' },
  { value: 'sus4', label: 'Sus4' },
  { value: 'dim', label: 'Dim' },
  { value: 'aug', label: 'Aug' },
  { value: '9th', label: '9th' },
];

export const ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function normalizeChordName(name: string): string {
  if (!name || name === '—') return '';
  let clean = name.trim();
  
  // 1. Remove brackets/parentheses and comments, e.g. (no5) or (omit5) or [Verse]
  clean = clean.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
  
  // 2. Remove commas, trailing punctuation and HTML tags
  clean = clean.replace(/<[^>]*>/g, '').replace(/[.,!$%\^&;:{}=\-_`~()]/g, '').trim();
  
  // 3. Normalize spaces
  clean = clean.replace(/\s+/g, '');
  
  // 4. Handle slash chords recursively
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 2) {
      const base = normalizeSingleChord(parts[0]);
      const bass = normalizeSingleChord(parts[1]);
      if (base && bass) {
        return `${base}/${bass}`;
      }
    }
  }
  
  return normalizeSingleChord(clean);
}

function normalizeSingleChord(chord: string): string {
  if (!chord) return '';
  
  // 1. Unicode accidentals
  let clean = chord
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#');
    
  // 2. Extract root and suffix
  // Latin roots mapping: Do, Re, Mi, Fa, Sol, La, Si
  const latinRoots: Record<string, string> = {
    'do': 'C', 'dó': 'C',
    're': 'D', 'ré': 'D',
    'mi': 'E',
    'fa': 'F', 'fá': 'F',
    'sol': 'G',
    'la': 'A', 'lá': 'A',
    'si': 'B'
  };
  
  const latinPattern = /^(do|dó|re|ré|mi|fa|fá|sol|la|lá|si)(#|b)?/i;
  const englishPattern = /^[a-g](#|b)?/i;
  
  let root = '';
  let suffix = '';
  
  let match = clean.match(latinPattern);
  if (match) {
    const rootName = match[1].toLowerCase();
    const accidental = match[2] || '';
    root = latinRoots[rootName] + accidental;
    suffix = clean.slice(match[0].length);
    
    // Collision guard: If root matched Latin "Fa" but suffix starts with "d" (as in add) or "u" (as in aug),
    // it was actually English root "F" with an "add" or "aug" suffix.
    if ((rootName === 'fa' || rootName === 'fá') && !accidental) {
      const lowerSuffix = suffix.toLowerCase();
      if (lowerSuffix.startsWith('d') || lowerSuffix.startsWith('u')) {
        root = 'F';
        suffix = 'a' + suffix;
      }
    }
  } else {
    match = clean.match(englishPattern);
    if (match) {
      root = match[0];
      // Normalize casing of root: first letter capitalized, second letter (if accidental) stays as is
      root = root.charAt(0).toUpperCase() + root.slice(1);
      suffix = clean.slice(match[0].length);
    } else {
      return clean; // Fallback if no root matches
    }
  }
  
  // 3. Normalize enharmonic equivalents
  if (root === 'Cb') root = 'B';
  if (root === 'B#') root = 'C';
  if (root === 'Fb') root = 'E';
  if (root === 'E#') root = 'F';
  
  // 4. Normalize suffix
  let normSuffix = suffix.trim();
  
  // Normalize Diminished / Augmented symbols first
  normSuffix = normSuffix
    .replace(/[º°]/g, 'dim')
    .replace(/\*/g, 'aug')
    .replace(/\+/g, 'aug');

  // Case-sensitive replacements to preserve Major (M) vs minor (m) distinction
  normSuffix = normSuffix.replace(/7M/g, 'maj7');
  if (normSuffix.startsWith('M') && !normSuffix.startsWith('Min') && !normSuffix.startsWith('Minor')) {
    normSuffix = 'maj' + normSuffix.slice(1);
  }

  const lowerSuffix = normSuffix.toLowerCase();
  
  // Handle major/minor/7M/M7 standardizations
  if (lowerSuffix.startsWith('minor') || lowerSuffix.startsWith('minor')) {
    normSuffix = 'm' + normSuffix.slice(5);
  } else if (lowerSuffix.startsWith('min')) {
    normSuffix = 'm' + normSuffix.slice(3);
  } else if (lowerSuffix.startsWith('maior') || lowerSuffix.startsWith('major')) {
    normSuffix = 'maj' + normSuffix.slice(5);
  } else if (lowerSuffix.startsWith('maj')) {
    normSuffix = 'maj' + normSuffix.slice(3);
  }
  
  // Specific translations for major 7th variations (e.g. 7M, M7, maj7)
  const cleanLower = normSuffix.toLowerCase();
  if (cleanLower === '7m' || cleanLower === 'm7' || cleanLower === 'maj7' || cleanLower === '7maj') {
    if (cleanLower === '7m' || cleanLower === 'maj7' || cleanLower === '7maj') {
      normSuffix = 'maj7';
    } else {
      normSuffix = 'm7';
    }
  } else if (cleanLower === 'm/maj7' || cleanLower === 'm(maj7)' || cleanLower === 'mmaj7' || cleanLower === 'minmaj7') {
    normSuffix = 'm/maj7';
  } else if (cleanLower === 'm7b5' || cleanLower === 'min7b5' || cleanLower === 'halfdim' || cleanLower === 'half-diminished') {
    normSuffix = 'ø7';
  } else if (cleanLower === '7#5' || cleanLower === '7+5') {
    normSuffix = 'aug7';
  } else if (cleanLower === 'm' || cleanLower === 'min' || cleanLower === 'menor') {
    normSuffix = 'm';
  } else if (cleanLower === 'maj' || cleanLower === 'maior' || cleanLower === 'major') {
    normSuffix = '';
  } else if (cleanLower === 'madd9' || cleanLower === 'm(add9)') {
    normSuffix = 'm(add9)';
  } else if (cleanLower === 'maj11' || cleanLower === 'maj7(11)') {
    normSuffix = 'maj11';
  } else if (cleanLower === '7#11' || cleanLower === '7(#11)') {
    normSuffix = '7#11';
  } else if (cleanLower === 'maj7#11' || cleanLower === 'maj7(#11)') {
    normSuffix = 'maj7#11';
  } else if (cleanLower === 'add11' || cleanLower === 'add(11)') {
    normSuffix = 'add11';
  } else if (cleanLower === 'maj13' || cleanLower === 'maj7(13)') {
    normSuffix = 'maj13';
  } else if (cleanLower === '13sus4' || cleanLower === '13sus') {
    normSuffix = '13sus4';
  } else if (cleanLower === 'sus2add13' || cleanLower === 'sus2(add13)') {
    normSuffix = 'sus2add13';
  } else if (cleanLower === '7b5' || cleanLower === '7(-5)') {
    normSuffix = '7b5';
  } else if (cleanLower === '7alt' || cleanLower === 'alt7' || cleanLower === 'alt') {
    normSuffix = '7alt';
  } else if (cleanLower === '7s9' || cleanLower === '7#9') {
    normSuffix = '7#9';
  } else if (cleanLower === '69' || cleanLower === '6/9') {
    normSuffix = '6/9';
  } else {
    // General character replacements for common aliases
    normSuffix = normSuffix
      .replace(/7M/g, 'maj7')
      .replace(/M7/g, 'maj7')
      .replace(/7maj/gi, 'maj7')
      .replace(/maj7/gi, 'maj7')
      .replace(/^sus$/i, 'sus4');
      
    // Lowercase everything remaining (e.g. sus2, sus4, add9, m11, m13)
    normSuffix = normSuffix.toLowerCase();
  }
  
  if (normSuffix === 'maj') {
    normSuffix = '';
  }
  
  return root + normSuffix;
}

function toCanonicalRoot(root: string): string {
  const mapping: Record<string, string> = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
    'db': 'c#', 'eb': 'd#', 'gb': 'f#', 'ab': 'g#', 'bb': 'a#'
  };
  return mapping[root] || root;
}

export function getChordByName(name: string): Chord | undefined {
  const normName = normalizeChordName(name);
  const normalized = normName.toLowerCase();
  
  // 1. Direct name match
  let found = chordDatabase.find(c => c.name.replace(/\s/g, '').toLowerCase() === normalized);
  if (found) return found;

  // 2. ID match
  found = chordDatabase.find(c => c.id.toLowerCase() === normalized);
  if (found) return found;

  // 3. Match parts of a slash-separated name (e.g. "C#/Db" matching "C#" or "Db")
  found = chordDatabase.find(c => {
    const cName = c.name.replace(/\s/g, '').toLowerCase();
    if (cName.includes('/')) {
      const parts = cName.split('/');
      return parts.includes(normalized);
    }
    return false;
  });
  if (found) return found;

  // 4. Enharmonic fallback
  const match = normalized.match(/^([a-g][#b]?)(.*)$/);
  if (match) {
    const queryRoot = toCanonicalRoot(match[1].charAt(0).toUpperCase() + match[1].slice(1));
    const querySuffix = match[2];

    found = chordDatabase.find(c => {
      const baseName = c.name.split('/')[0].trim();
      const cMatch = baseName.toLowerCase().match(/^([a-g][#b]?)(.*)$/);
      if (cMatch) {
        const cRoot = toCanonicalRoot(cMatch[1].charAt(0).toUpperCase() + cMatch[1].slice(1));
        const cSuffix = cMatch[2];
        return cRoot === queryRoot && cSuffix === querySuffix;
      }
      return false;
    });
    if (found) return found;
  }

  return undefined;
}

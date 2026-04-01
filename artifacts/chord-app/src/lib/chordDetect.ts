/**
 * Lightweight chord-name detection from a set of chromatic note indices (0–11).
 * Used by the Custom Chord Builder to suggest a name while the user builds.
 */

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** (interval-set, suffix) pairs — ordered from most-specific to least-specific */
const PATTERNS: [string, number[]][] = [
  // 4-note chords
  ['dim7',    [0, 3, 6, 9]],
  ['maj7',    [0, 4, 7, 11]],
  ['min7',    [0, 3, 7, 10]],
  ['7th',     [0, 4, 7, 10]],
  ['halfdim', [0, 3, 6, 10]],
  ['minmaj7', [0, 3, 7, 11]],
  ['aug7',    [0, 4, 8, 10]],
  ['6th',     [0, 4, 7, 9]],
  ['min6',    [0, 3, 7, 9]],
  ['7sus4',   [0, 5, 7, 10]],
  ['7sus2',   [0, 2, 7, 10]],
  // 3-note chords
  ['major',   [0, 4, 7]],
  ['minor',   [0, 3, 7]],
  ['dim',     [0, 3, 6]],
  ['aug',     [0, 4, 8]],
  ['sus2',    [0, 2, 7]],
  ['sus4',    [0, 5, 7]],
  ['add9',    [0, 2, 4, 7]],
  // 2-note
  ['5',       [0, 7]],
];

/**
 * Given an array of chromatic note indices (may be any range; mod-12 applied),
 * returns a suggested chord name like "C major", "Am", "G7th" or null.
 */
export function detectChordName(noteIndices: number[]): string | null {
  if (noteIndices.length < 2) return null;
  // Deduplicate + normalise to 0–11
  const unique = [...new Set(noteIndices.map(n => ((n % 12) + 12) % 12))].sort((a, b) => a - b);

  for (const root of unique) {
    for (const [type, pattern] of PATTERNS) {
      const expected = new Set(pattern.map(p => (p + root) % 12));
      const actual   = new Set(unique);
      const hasAll   = [...expected].every(n => actual.has(n));
      const noExtra  = [...actual].every(n => expected.has(n));
      if (hasAll && noExtra) {
        const rootName = NOTES[root];
        return type === 'major' ? rootName : `${rootName} ${type}`;
      }
    }
  }
  return null;
}

/** Chromatic index → note name */
export function chromaticToName(idx: number): string {
  return NOTES[((idx % 12) + 12) % 12];
}

/** Open string chromatic indices (low → high string order) */
export const OPEN_NOTES: Record<'guitar' | 'bass' | 'ukulele', number[]> = {
  guitar:  [4, 9, 2, 7, 11, 4], // E A D G B e
  bass:    [4, 9, 2, 7],         // E A D G
  ukulele: [7, 0, 4, 9],         // G C E A
};

export const STRING_LABELS: Record<'guitar' | 'bass' | 'ukulele', string[]> = {
  guitar:  ['E', 'A', 'D', 'G', 'B', 'e'],
  bass:    ['E', 'A', 'D', 'G'],
  ukulele: ['G', 'C', 'E', 'A'],
};

/** Compute played note names from fret positions */
export function notesFromFrets(frets: number[], openNotes: number[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  frets.forEach((f, i) => {
    if (f < 0) return;
    const name = NOTES[(openNotes[i] + f) % 12];
    if (!seen.has(name)) { seen.add(name); result.push(name); }
  });
  return result;
}

/** Compute played note names from piano key chromatic indices */
export function notesFromPianoKeys(keys: number[]): string[] {
  return [...new Set(keys.map(k => NOTES[((k % 12) + 12) % 12]))];
}

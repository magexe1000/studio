const NOTE_CHROMA: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
  E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8,
  Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

function parseKey(key: string): { chroma: number; minor: boolean } | null {
  if (!key) return null;
  const minor = key.endsWith('m');
  const rootStr = minor ? key.slice(0, -1) : key;
  const chroma = NOTE_CHROMA[rootStr];
  if (chroma === undefined) return null;
  return { chroma, minor };
}

function chordIdToRootChroma(chordId: string): number | null {
  if (!chordId || chordId.startsWith('custom-')) return null;
  const dash = chordId.indexOf('-');
  if (dash === -1) return null;
  const root = chordId.slice(0, dash);
  const chroma = NOTE_CHROMA[root];
  return chroma !== undefined ? chroma : null;
}

export function isChordOutOfKey(chordId: string, key: string): boolean {
  if (!key || !chordId) return false;
  const parsed = parseKey(key);
  if (!parsed) return false;
  const rootChroma = chordIdToRootChroma(chordId);
  if (rootChroma === null) return false;
  const intervals = parsed.minor ? MINOR_INTERVALS : MAJOR_INTERVALS;
  const scaleNotes = intervals.map(i => (parsed.chroma + i) % 12);
  return !scaleNotes.includes(rootChroma);
}

/**
 * Chord transposition utilities.
 * Chord IDs always use sharp-notation roots (matching the database).
 * Display can optionally use flat notation.
 */

export const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const CHROMATIC_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Map any root (sharp or flat) to a 0–11 chromatic index. */
const ROOT_TO_IDX: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

/**
 * Transpose a chord ID by `semitones`.
 * Always returns an ID with a sharp-notation root (matching the chord database).
 * Returns the original ID unchanged if it can't be parsed.
 */
export function transposeChordId(id: string, semitones: number): string {
  if (semitones === 0) return id;
  const hyphen = id.indexOf('-');
  if (hyphen < 0) return id;
  const root = id.slice(0, hyphen);
  const type = id.slice(hyphen + 1);
  const idx = ROOT_TO_IDX[root];
  if (idx === undefined) return id;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return `${CHROMATIC[newIdx]}-${type}`;
}

/**
 * Return a display-friendly root name for a chromatic index.
 * Respects the user's flat/sharp preference.
 */
function idxToRoot(idx: number, preferFlats: boolean): string {
  return preferFlats ? CHROMATIC_FLATS[idx] : CHROMATIC[idx];
}

/**
 * Transpose a root string (e.g. "C#") by `semitones` and return for display.
 */
function transposeRoot(root: string, semitones: number, preferFlats: boolean): string {
  const idx = ROOT_TO_IDX[root];
  if (idx === undefined) return root;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return idxToRoot(newIdx, preferFlats);
}

/**
 * Try to extract the leading root note from a free-text key string
 * like "C Major", "Am", "F#", "Bb Minor".
 * Returns [root, rest] or null if no note found.
 */
function parseKeyRoot(key: string): [string, string] | null {
  const trimmed = key.trim();
  // Try 2-char roots first (C#, Db, D#, Eb, F#, Gb, G#, Ab, A#, Bb)
  const two = trimmed.slice(0, 2);
  if (ROOT_TO_IDX[two] !== undefined) {
    return [two, trimmed.slice(2).trim()];
  }
  // Single char roots
  const one = trimmed.slice(0, 1);
  if (ROOT_TO_IDX[one] !== undefined) {
    return [one, trimmed.slice(1).trim()];
  }
  return null;
}

/**
 * Transpose a free-text key string (e.g. "C Major" → "D Major").
 * Returns the original if it can't be parsed.
 */
export function transposeKeyString(key: string, semitones: number, preferFlats: boolean): string {
  if (!key || semitones === 0) return key;
  const parsed = parseKeyRoot(key);
  if (!parsed) return key;
  const [root, rest] = parsed;
  const newRoot = transposeRoot(root, semitones, preferFlats);
  return rest ? `${newRoot} ${rest}` : newRoot;
}

/** Format a semitone offset as "+2", "−3", or "±0". */
export function formatOffset(n: number): string {
  if (n === 0) return '±0';
  return n > 0 ? `+${n}` : `${n}`;
}

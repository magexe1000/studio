/**
 * Chord-progression generator (Chordex)
 * ──────────────────────────────────────
 * Pure theory module — no React / no store. Given a key, scale type and
 * style, returns a 4–8-chord progression assembled from real harmonic
 * templates (no random chords).
 *
 * Templates use the Roman-numeral convention where:
 *   • Uppercase = major triad         (I, IV, V, bVII, …)
 *   • Lowercase = minor triad         (ii, iii, vi, i, iv, v, …)
 *   • Trailing  °  = diminished       (vii°, ii°)
 *   • Leading   b  = lowered (borrowed from the parallel mode)
 *   • Trailing  7 / maj7 = chord extension
 *
 * Each numeral resolves to a chord-id of the form "<root>-<quality>" that
 * matches an entry in src/data/chords.ts (verified via getChordById).
 */

import type { ChordType } from '../data/chords';
import { getChordById } from '../data/chords';

// ── Constants ──────────────────────────────────────────────────────────────

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

// Optional flat-spelling for display only (chord IDs always use sharps to
// match the database). Used by labelKey().
const FLAT_DISPLAY: Record<string, string> = {
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
};

export type Key       = typeof NOTES[number];
export type ScaleType = 'major' | 'minor';
export type Style     = 'pop' | 'indie' | 'sad' | 'rock';

export const KEYS: readonly Key[] = NOTES;

export const SCALE_TYPES: { id: ScaleType; label: string }[] = [
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
];

export const STYLES: { id: Style; label: string; blurb: string }[] = [
  { id: 'pop',   label: 'Pop',   blurb: 'Bright, hooky, four-chord loops' },
  { id: 'indie', label: 'Indie', blurb: 'Modal flavour, gentle motion'    },
  { id: 'sad',   label: 'Sad',   blurb: 'Pensive, descending, minor pull' },
  { id: 'rock',  label: 'Rock',  blurb: 'Driving, borrowed bVII colour'   },
];

// ── Roman-numeral → { offset, quality } ────────────────────────────────────
// `offset` is semitones above the tonic. `quality` is the chord type used
// when building the chord-id.
interface NumeralSpec { offset: number; quality: ChordType; }

const NUMERAL_TABLE: Record<string, NumeralSpec> = {
  // Major-key diatonic triads
  'I':    { offset: 0,  quality: 'major' },
  'ii':   { offset: 2,  quality: 'minor' },
  'iii':  { offset: 4,  quality: 'minor' },
  'IV':   { offset: 5,  quality: 'major' },
  'V':    { offset: 7,  quality: 'major' },
  'vi':   { offset: 9,  quality: 'minor' },
  'vii°': { offset: 11, quality: 'dim'   },
  // Common 7ths in major
  'V7':    { offset: 7,  quality: '7th'  },
  'ii7':   { offset: 2,  quality: 'min7' },
  'Imaj7': { offset: 0,  quality: 'maj7' },
  'vi7':   { offset: 9,  quality: 'min7' },
  'iii7':  { offset: 4,  quality: 'min7' },
  // Borrowed (modal-mixture) chords often used in pop / rock
  'bVII': { offset: 10, quality: 'major' },
  'bVI':  { offset: 8,  quality: 'major' },
  'bIII': { offset: 3,  quality: 'major' },

  // Natural-minor diatonic triads
  'i':    { offset: 0,  quality: 'minor' },
  'ii°':  { offset: 2,  quality: 'dim'   },
  'III':  { offset: 3,  quality: 'major' },
  'iv':   { offset: 5,  quality: 'minor' },
  'v':    { offset: 7,  quality: 'minor' },
  'VI':   { offset: 8,  quality: 'major' },
  'VII':  { offset: 10, quality: 'major' },
  // Harmonic-minor flavour: borrow V (major) for stronger cadence
  'V_h':  { offset: 7,  quality: 'major' },
  // Minor-key 7ths
  'i7':   { offset: 0,  quality: 'min7' },
  'iv7':  { offset: 5,  quality: 'min7' },
  'V7_h': { offset: 7,  quality: '7th'  },
};

// ── Style templates ────────────────────────────────────────────────────────
// Each entry is a tuple [name, romans] where romans is an ordered list of
// numerals. Lengths are 4–8 (per spec).
type Template = readonly [name: string, romans: readonly string[]];

const TEMPLATES: Record<Style, Record<ScaleType, readonly Template[]>> = {
  pop: {
    major: [
      ['I–V–vi–IV',                ['I','V','vi','IV']],
      ['I–vi–IV–V (50s doo-wop)',  ['I','vi','IV','V']],
      ['vi–IV–I–V',                ['vi','IV','I','V']],
      ['I–V–vi–iii–IV–I–IV–V',     ['I','V','vi','iii','IV','I','IV','V']],
      ['I–IV–vi–V',                ['I','IV','vi','V']],
    ],
    minor: [
      ['i–VI–III–VII',             ['i','VI','III','VII']],
      ['i–VII–VI–VII',             ['i','VII','VI','VII']],
      ['i–iv–VII–III',             ['i','iv','VII','III']],
      ['i–VI–VII–i',               ['i','VI','VII','i']],
    ],
  },
  indie: {
    major: [
      ['vi–IV–I–V',                ['vi','IV','I','V']],
      ['I–iii–vi–IV',              ['I','iii','vi','IV']],
      ['IV–I–V–vi',                ['IV','I','V','vi']],
      ['I–V–vi–iii',               ['I','V','vi','iii']],
      ['I–iii–IV–vi–V',            ['I','iii','IV','vi','V']],
    ],
    minor: [
      ['i–VI–III–VII',             ['i','VI','III','VII']],
      ['i–iv–VII–III',             ['i','iv','VII','III']],
      ['iv–VI–i–v',                ['iv','VI','i','v']],
      ['i–VII–VI–III',             ['i','VII','VI','III']],
    ],
  },
  sad: {
    major: [
      ['vi–IV–I–V (relative-min)', ['vi','IV','I','V']],
      ['vi–iii–IV–I',              ['vi','iii','IV','I']],
      ['ii–V7–I–vi',               ['ii','V7','Imaj7','vi']],
      ['IV–I–vi–V',                ['IV','I','vi','V']],
    ],
    minor: [
      ['i–VII–VI–VII',             ['i','VII','VI','VII']],
      ['i–iv–VII–III',             ['i','iv','VII','III']],
      ['i–VI–III–VII',             ['i','VI','III','VII']],
      ['i–iv–v–i (pure minor)',    ['i','iv','v','i']],
      ['i–iv–V_h–i (harmonic)',    ['i','iv','V_h','i']],
    ],
  },
  rock: {
    major: [
      ['I–IV–V–IV',                ['I','IV','V','IV']],
      ['I–bVII–IV–I',              ['I','bVII','IV','I']],
      ['I–V–IV–V',                 ['I','V','IV','V']],
      ['I–V–vi–IV',                ['I','V','vi','IV']],
      ['I–bVII–bVI–bVII',          ['I','bVII','bVI','bVII']],
    ],
    minor: [
      ['i–VII–VI–VII',             ['i','VII','VI','VII']],
      ['i–iv–VII–i',               ['i','iv','VII','i']],
      ['i–VII–VI–V_h',             ['i','VII','VI','V_h']],
      ['i–v–VI–VII',               ['i','v','VI','VII']],
    ],
  },
};

// ── Conversion helpers ─────────────────────────────────────────────────────

/** Resolve a Roman numeral to a concrete chord-id under (key, scale). */
export function romanToChordId(roman: string, key: Key): string | null {
  const spec = NUMERAL_TABLE[roman];
  if (!spec) return null;
  const keyIdx = NOTES.indexOf(key);
  if (keyIdx < 0) return null;
  const root = NOTES[(keyIdx + spec.offset) % 12];
  const id   = `${root}-${spec.quality}`;
  // Verify the chord actually exists in the database — if not, fall back to
  // the plain triad of the same root so generation never produces a dead id.
  if (getChordById(id)) return id;
  const fallback = `${root}-${spec.quality === 'minor' ? 'minor' : 'major'}`;
  return getChordById(fallback) ? fallback : null;
}

/**
 * Display label for a numeral (strips internal markers like "_h" / "maj7"
 * suffix display). Used when surfacing the roman next to each chord.
 */
export function romanLabel(roman: string): string {
  // Strip our internal "_h" tag (harmonic-minor V) and replace with V
  return roman.replace(/_h$/, '').replace(/°/, '°');
}

/** Pretty key label honouring the user's flat preference. */
export function labelKey(key: Key, preferFlats: boolean): string {
  if (!preferFlats) return key;
  return FLAT_DISPLAY[key] ?? key;
}

// ── Generation ─────────────────────────────────────────────────────────────

export interface GeneratedProgression {
  templateName: string;          // e.g. "I–V–vi–IV"
  romans:       string[];        // ['I','V','vi','IV'] (display-cleaned)
  chordIds:     string[];        // resolved chord-ids (matches data/chords.ts)
  key:          Key;
  scale:        ScaleType;
  style:        Style;
  templateIdx:  number;          // index into TEMPLATES[style][scale]
}

/**
 * Generate a progression. When `excludeIdx` is provided, the generator will
 * pick a *different* template — used by the Regenerate button so consecutive
 * presses always show new material. Falls back to (excludeIdx + 1) % len when
 * only one template exists.
 */
export function generateProgression(
  key: Key,
  scale: ScaleType,
  style: Style,
  excludeIdx?: number,
): GeneratedProgression {
  const pool = TEMPLATES[style][scale];
  let idx: number;
  if (pool.length === 1) {
    idx = 0;
  } else if (excludeIdx === undefined) {
    idx = Math.floor(Math.random() * pool.length);
  } else {
    // pick any other template uniformly
    const others: number[] = [];
    for (let i = 0; i < pool.length; i++) if (i !== excludeIdx) others.push(i);
    idx = others[Math.floor(Math.random() * others.length)];
  }
  const [name, romans] = pool[idx];
  // Build chordIds and display-romans together so they stay index-aligned
  // even when a numeral fails to resolve (defensive — shouldn't happen with
  // the current chord database, but keeps the UI honest).
  const outRomans:   string[] = [];
  const outChordIds: string[] = [];
  for (const r of romans) {
    const id = romanToChordId(r, key);
    if (id === null) continue;
    outRomans.push(romanLabel(r));
    outChordIds.push(id);
  }
  return {
    templateName: name,
    romans:       outRomans,
    chordIds:     outChordIds,
    key,
    scale,
    style,
    templateIdx:  idx,
  };
}

/** Diatonic triads for the (key, scale) — used by the chord-swap picker. */
export function diatonicChordIds(key: Key, scale: ScaleType): { roman: string; chordId: string }[] {
  const numerals = scale === 'major'
    ? ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
    : ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
  return numerals
    .map(r => {
      const chordId = romanToChordId(r, key);
      return chordId ? { roman: r, chordId } : null;
    })
    .filter((x): x is { roman: string; chordId: string } => x !== null);
}

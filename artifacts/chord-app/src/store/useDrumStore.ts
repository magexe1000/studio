import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { InstPlugin } from '../lib/drumPlugins';
import { secureReadLocal, secureWriteLocal } from '../lib/security';
export type { InstPlugin };

export type DrumInstrument =
  | 'crash' | 'ride'
  | 'hihat-open' | 'hihat-closed' | 'hihat-foot'
  | 'snare'
  | 'tom-high' | 'tom-mid' | 'tom-floor'
  | 'kick';

export type NoteVariation =
  | 'normal' | 'ghost' | 'rimshot' | 'flam'
  | 'open' | 'pedal'
  | 'accent' | 'bell' | 'choke' | 'ride';

export type KitType =
  | 'ludwig' | 'jazz' | 'rock' | 'vintage'
  | 'studio' | 'r8'   | 'linn' | 'funk'
  | 'cr78'   | 'tr808'| 'techno'| 'stark'
  | 'rmm'    | 'chrome'| 'house';

export type HouseMic = 'blend' | 'close' | 'oh' | 'room';
export const HOUSE_MICS: { id: HouseMic; label: string; desc: string }[] = [
  { id: 'blend', label: 'Blend',  desc: 'Mixed multi-mic for balanced, production-ready tone'  },
  { id: 'close', label: 'Close',  desc: 'Close mic only — punchy, dry, very direct'            },
  { id: 'oh',    label: 'OH',     desc: 'Overhead — open, airy, natural room perspective'       },
  { id: 'room',  label: 'Room',   desc: 'Room mic — spacious live ambience'                     },
];

export type HouseCrashModel = 'ac18' | 'am17' | 'hhx18' | 'zcp19';
export const HOUSE_CRASH_MODELS: { id: HouseCrashModel; label: string; desc: string }[] = [
  { id: 'ac18',  label: 'Custom 18"',     desc: 'A-Custom 18" — bright, cutting, versatile'          },
  { id: 'am17',  label: 'Medium 17"',     desc: 'A-Medium 17" — warm, controlled, mid-focused'        },
  { id: 'hhx18', label: 'HHXplosion 18"', desc: 'HHXplosion 18" — explosive, dark, washy'             },
  { id: 'zcp19', label: 'Z-Custom 19"',   desc: 'Z-Custom Projection 19" — loud, full, wide spread'   },
];

export type CymbalPack = 'default' | 'zildjian-k';
export const CYMBAL_PACKS: { id: CymbalPack; label: string; desc: string }[] = [
  { id: 'default',     label: 'Sabian Pack',         desc: 'Hi-hat, crash, ride — bright, versatile'            },
  { id: 'zildjian-k',  label: 'Zildjian K Custom',   desc: 'Dark crash, splash, ride — warm, complex overtones' },
];

export const DRUM_INSTRUMENTS: DrumInstrument[] = [
  'crash', 'ride', 'hihat-open', 'hihat-closed', 'hihat-foot',
  'snare', 'tom-high', 'tom-mid', 'tom-floor', 'kick',
];

// Cycling sequences per instrument.
// First tap → 'normal', each subsequent tap advances,
// tap past the last variation → removes the note.
export const INST_VARIATIONS: Partial<Record<DrumInstrument, NoteVariation[]>> = {
  snare:          ['normal', 'rimshot', 'flam', 'ghost'],
  'hihat-closed': ['normal', 'open', 'pedal'],
  kick:           ['normal', 'accent'],
  'tom-high':     ['normal', 'accent'],
  'tom-mid':      ['normal', 'accent'],
  'tom-floor':    ['normal', 'accent'],
  // crash row now represents ALL cymbals: crash (normal/choke) + ride (ride/bell)
  crash:          ['normal', 'choke', 'ride', 'bell'],
};

export const INSTRUMENT_NAME: Record<DrumInstrument, string> = {
  crash:          'Cymbal',
  ride:           'Ride',
  'hihat-open':   'Open HH',
  'hihat-closed': 'Hi-Hat',
  'hihat-foot':   'HH Foot',
  snare:          'Snare',
  'tom-high':     'Tom Hi',
  'tom-mid':      'Tom Mid',
  'tom-floor':    'Floor',
  kick:           'Kick',
};

export const INSTRUMENT_COLOR: Record<DrumInstrument, string> = {
  crash:          '#a1a1aa',
  ride:           '#71717a',
  'hihat-open':   '#d4d4d8',
  'hihat-closed': '#e4e4e7',
  'hihat-foot':   '#a1a1aa',
  snare:          '#ffffff',
  'tom-high':     '#e4e4e7',
  'tom-mid':      '#d4d4d8',
  'tom-floor':    '#a1a1aa',
  kick:           '#ffffff',
};

// Display order: high pitch → low pitch (hi-hat top, kick bottom)
// hihat-open and hihat-foot are now handled as variations of hihat-closed
// 'ride' has been folded into 'crash' as variations ('ride'/'bell') — no longer a separate row
export const KIT_INSTRUMENTS: Record<KitType, DrumInstrument[]> = {
  ludwig:  ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
  jazz:    ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
  rock:    ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
  vintage: ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
  studio:  ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
  r8:      ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
  linn:    ['hihat-closed','snare','kick','crash','tom-high'],
  funk:    ['hihat-closed','snare','kick','crash','tom-high'],
  cr78:    ['hihat-closed','snare','kick','crash','tom-high'],
  tr808:   ['hihat-closed','snare','kick','crash','tom-high'],
  techno:  ['hihat-closed','snare','kick','crash','tom-high'],
  stark:   ['hihat-closed','snare','kick','crash'],
  rmm:     ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
  chrome:  ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
  house:   ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
};

// Per-step velocity (MIDI 0–127). 100 is neutral / "no scaling". Optional so
// existing patterns persisted before velocity existed keep working — undefined
// is treated as DEFAULT_VELOCITY at playback time.
export const MIN_VELOCITY = 1;
export const MAX_VELOCITY = 127;
export const DEFAULT_VELOCITY = 100;
// Newly placed notes get a velocity in this range (rather than always 100), so
// freshly drawn patterns don't sound robotic out of the box.
export const NEW_NOTE_VELOCITY_MIN = 85;
export const NEW_NOTE_VELOCITY_MAX = 110;
export function randomNewNoteVelocity(): number {
  return Math.round(NEW_NOTE_VELOCITY_MIN + Math.random() * (NEW_NOTE_VELOCITY_MAX - NEW_NOTE_VELOCITY_MIN));
}
export function clampVelocity(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_VELOCITY;
  return Math.max(MIN_VELOCITY, Math.min(MAX_VELOCITY, Math.round(v)));
}

export interface DrumHit { step: number; length: number; variation?: NoteVariation; velocity?: number; }
export interface DrumMeasure { id: string; hits: Partial<Record<DrumInstrument, DrumHit[]>>; }

export const GROOVE_TAGS = ['Rock', 'Trap', 'Jazz', 'Funk', 'Fill', 'Intro', 'Outro', 'Loop', 'Latin'] as const;

// ── Per-instrument FX ────────────────────────────────────────────────────────
export interface InstFX {
  compress:  number;  // 0 (off) → 1 (heavy)
  attack:    number;  // 0 (fast punch) → 1 (slow)
  eqLow:     number;  // -12 to +12 dB at 80 Hz
  eqLowMid:  number;  // -12 to +12 dB at 350 Hz
  eqMid:     number;  // -12 to +12 dB at 2 kHz
  eqHigh:    number;  // -12 to +12 dB at 10 kHz
  reverb:    number;  // 0 (dry) → 1 (wet)
  gate:      number;  // 0 (off) → 1 (tight chop)
  saturate:  number;  // 0 (clean) → 1 (driven)
}
export const DEFAULT_INST_FX: InstFX = {
  compress: 0, attack: 0, eqLow: 0, eqLowMid: 0, eqMid: 0, eqHigh: 0,
  reverb: 0, gate: 0, saturate: 0,
};

// ── Kit Family: two-level kit browser used in Create Song modal ───────────────
export interface KitVariation { kit: KitType; label: string; desc: string; }
export interface KitFamilyEntry { id: string; label: string; variations: KitVariation[]; }
export const KIT_FAMILY: KitFamilyEntry[] = [
  { id: 'acoustic', label: 'Acoustic', variations: [
    {
      kit: 'house',
      label: 'House Kit',
      desc: 'Premium multi-velocity studio kit — 5 velocity layers × 7 round-robin variations per instrument. Choose mic position (Blend / Close / OH / Room) in kit settings.',
    },
  ]},
];
export type GrooveTag = typeof GROOVE_TAGS[number] | '';

export interface GrooveEntry {
  id: string;
  name: string;
  tag: GrooveTag;
  bpm: number;
  bars: number;
  subdivision: 8 | 16;
  measures: DrumMeasure[];
  savedAt: number;
}
// ── Smart Loop (section loop) ───────────────────────────────────────────────
// A bar-indexed [startBar, endBar] inclusive range. When enabled, the
// scheduler wraps playback at endBar+1 → startBar instead of looping the
// full pattern. Indices are clamped at runtime so out-of-range values from
// stale data fall back gracefully to no-op (full pattern loops).
export interface LoopRange {
  startBar: number;   // 0-based, inclusive
  endBar:   number;   // 0-based, inclusive
  enabled:  boolean;
}

export interface DrumPattern {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  subdivision: 8 | 16;
  measures: DrumMeasure[];
  mutedInstruments?: DrumInstrument[];
  // Per-pattern swing/groove (0–60 %). Off-beat steps are pushed forward in
  // time by `(swing/100) * stepDur / 3`. Optional → undefined === 0 (straight),
  // so existing patterns persisted before swing existed keep their feel.
  swing?: number;
  // Per-pattern smart loop range. Optional / undefined === full pattern.
  loopRange?: LoopRange;
}

export function defaultLoopRange(): LoopRange {
  return { startBar: 0, endBar: 0, enabled: false };
}

export function clampLoopRange(lr: LoopRange | undefined, barCount: number): LoopRange {
  const maxBar = Math.max(0, barCount - 1);
  if (!lr) return { startBar: 0, endBar: maxBar, enabled: false };
  const start = Math.max(0, Math.min(Math.floor(lr.startBar), maxBar));
  const end   = Math.max(start, Math.min(Math.floor(lr.endBar), maxBar));
  return { startBar: start, endBar: end, enabled: !!lr.enabled };
}

// ── Swing / groove ──────────────────────────────────────────────────────────
export const SWING_MIN = 0;
export const SWING_MAX = 60;
export const SWING_PRESETS: { id: 'tight' | 'groove' | 'funky'; value: number }[] = [
  { id: 'tight',  value: 0  },
  { id: 'groove', value: 18 },
  { id: 'funky',  value: 40 },
];
export function clampSwing(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(SWING_MIN, Math.min(SWING_MAX, Math.round(v)));
}

export interface DrumSong {
  id: string;
  name: string;
  artist: string;
  notes: string;
  patterns: DrumPattern[];
  activePatternId: string;
  kitType: KitType | null;
  createdAt: number;
  updatedAt: number;
}

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
export function emptyMeasure(): DrumMeasure { return { id: `m-${uid()}`, hits: {} }; }
function defaultPattern(): DrumPattern {
  return { id: `p-${uid()}`, name: 'Pattern 1', bpm: 120, timeSignature: [4, 4], subdivision: 16, measures: [emptyMeasure(), emptyMeasure()], swing: 0 };
}

export function stepsPerMeasure(p: DrumPattern): number {
  return p.timeSignature[0] * (p.subdivision / p.timeSignature[1]);
}

// Migrate patterns: fold hihat-open/hihat-foot into hihat-closed, and ride into crash (as variations)
function migratePatterns(patterns: DrumPattern[]): DrumPattern[] {
  return patterns.map(p => ({
    ...p,
    measures: p.measures.map(m => {
      // ── Hi-hat fold ──────────────────────────────────────────────────────
      const hhHits: DrumHit[] = [...(m.hits['hihat-closed'] ?? [])];
      (m.hits['hihat-open'] ?? []).forEach(h => {
        if (!hhHits.some(c => c.step === h.step))
          hhHits.push({ ...h, variation: 'open' as NoteVariation });
      });
      (m.hits['hihat-foot'] ?? []).forEach(h => {
        if (!hhHits.some(c => c.step === h.step))
          hhHits.push({ ...h, variation: 'pedal' as NoteVariation });
      });
      hhHits.sort((a, b) => a.step - b.step);

      // ── Cymbal fold: ride → crash with 'ride'/'bell' variation ───────────
      const cymHits: DrumHit[] = [...(m.hits['crash'] ?? [])];
      (m.hits['ride'] ?? []).forEach(h => {
        if (!cymHits.some(c => c.step === h.step)) {
          const var_: NoteVariation = h.variation === 'bell' ? 'bell' : 'ride';
          cymHits.push({ ...h, variation: var_ });
        }
      });
      cymHits.sort((a, b) => a.step - b.step);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { 'hihat-open': _o, 'hihat-foot': _f, ride: _r, ...rest } = m.hits as Partial<Record<string, DrumHit[]>>;
      return {
        ...m,
        hits: {
          ...rest,
          'hihat-closed': hhHits,
          crash: cymHits,
        } as Partial<Record<DrumInstrument, DrumHit[]>>,
      };
    }),
  }));
}

// ── Drum Preferences ──────────────────────────────────────────────────────────
export interface DrumPrefs {
  // Editor Behavior
  noteVariationsCycle:  boolean;
  autoExpandPattern:    boolean;
  snapToGrid:           boolean;
  dragToFill:           boolean;
  // Playback
  autoPlayOnEdit:       boolean;
  loopPlayback:         boolean;
  metronome:            boolean;
  countIn:              boolean;
  metronomeSound:       string; // 'classic' | 'wood' | 'studio' | 'digital' | 'rim'
  // Interaction
  showNoteVariations:   boolean;
  highlightActiveInst:  boolean;
  // Visual
  gridLinesEmphasis:    boolean;
  // Cymbal
  randomVariations:     boolean;
  // Dynamics
  humanizeVelocity:     boolean;  // non-destructive ±jitter applied at playback time
}

export const DEFAULT_DRUM_PREFS: DrumPrefs = {
  noteVariationsCycle:  true,
  autoExpandPattern:    false,
  snapToGrid:           true,
  dragToFill:           true,
  autoPlayOnEdit:       false,
  loopPlayback:         true,
  metronome:            false,
  countIn:              false,
  metronomeSound:       'classic',
  showNoteVariations:   true,
  highlightActiveInst:  true,
  gridLinesEmphasis:    true,
  randomVariations:     true,
  humanizeVelocity:     true,
};

interface DrumStore {
  patterns:          DrumPattern[];
  activePatternId:   string | null;
  soundMap:          Partial<Record<DrumInstrument, string>>;
  volumeMap:         Partial<Record<DrumInstrument, number>>;
  masterVolume:      number;
  kitType:           KitType | null;
  activeInstruments: DrumInstrument[];
  drumPrefs:         DrumPrefs;

  setSoundForInstrument:   (inst: DrumInstrument, soundId: string) => void;
  setVolumeForInstrument:  (inst: DrumInstrument, vol: number)     => void;
  setMasterVolume:         (vol: number) => void;
  setKitType:              (kit: KitType, soundMap: Partial<Record<DrumInstrument, string>>) => void;
  toggleInstrument:        (inst: DrumInstrument) => void;
  setActiveInstruments:    (insts: DrumInstrument[]) => void;

  createPattern:    () => string;
  addBlankPattern:  () => string;
  duplicatePattern: (id: string) => string;
  deletePattern:    (id: string) => void;
  renamePattern:    (id: string, name: string) => void;
  updatePattern:    (id: string, patch: Partial<Pick<DrumPattern, 'bpm' | 'timeSignature' | 'subdivision' | 'measures' | 'swing' | 'loopRange'>>) => void;
  setActivePattern: (id: string) => void;

  toggleHit:       (patternId: string, measureId: string, instrument: DrumInstrument, step: number) => void;
  simpleToggleHit: (patternId: string, measureId: string, instrument: DrumInstrument, step: number) => void;
  setHitVelocity:  (patternId: string, measureId: string, instrument: DrumInstrument, step: number, velocity: number) => void;
  addMeasure:      (patternId: string) => string;
  deleteMeasure:   (patternId: string, measureId: string) => void;
  clearMeasure:       (patternId: string, measureId: string) => void;
  duplicateMeasure:   (patternId: string, measureId: string) => void;
  insertMeasureAfter: (patternId: string, afterMeasureId: string, hitsTemplate: DrumMeasure['hits']) => string;
  togglePatternMute:  (patternId: string, inst: DrumInstrument) => void;

  drumSongs:           DrumSong[];
  saveDrumSong:        (name: string, artist: string, notes: string) => string;
  createBlankDrumSong: (name: string, artist: string, bpm: number, notes: string, kitType?: KitType) => string;
  loadDrumSong:        (id: string) => void;
  deleteDrumSong:      (id: string) => void;
  updateDrumSong:      (id: string, patch: Partial<Pick<DrumSong, 'name' | 'artist' | 'notes' | 'patterns' | 'activePatternId' | 'kitType'>>) => void;

  restorePatterns:  (patterns: DrumPattern[], activePatternId: string | null) => void;
  importDrumSong:   (name: string, artist: string, notes: string, patterns: DrumPattern[], activePatternId: string, kitType?: KitType | null) => string;

  grooves:             GrooveEntry[];
  saveGroove:          (name: string, tag: GrooveTag) => string;
  deleteGroove:        (id: string) => void;
  renameGroove:        (id: string, name: string, tag: GrooveTag) => void;
  loadGrooveReplace:   (id: string) => void;
  loadGrooveAppend:    (id: string) => void;
  duplicateGroove:     (id: string) => string;

  instFX:        Partial<Record<DrumInstrument, InstFX>>;
  setInstFX:     (inst: DrumInstrument, fx: InstFX) => void;

  instPlugins:   Partial<Record<DrumInstrument, InstPlugin[]>>;
  setInstPlugins:(inst: DrumInstrument, plugins: InstPlugin[]) => void;

  houseKitMic:    HouseMic;
  setHouseKitMic: (mic: HouseMic) => void;

  houseInstVelOverride: Partial<Record<string, string>>;
  setHouseInstVelOverride: (inst: string, vel: string | undefined) => void;

  houseCrashModel: HouseCrashModel;
  setHouseCrashModel: (model: HouseCrashModel) => void;

  cymbalPack: CymbalPack;
  setCymbalPack: (pack: CymbalPack) => void;

  updateDrumPrefs: (patch: Partial<DrumPrefs>) => void;
}

const initial = defaultPattern();

export const useDrumStore = create<DrumStore>()(
  persist(
    (set, get) => ({
      patterns:          [initial],
      activePatternId:   initial.id,
      soundMap:          {},
      volumeMap:         {},
      masterVolume:      0.82,
      kitType:           'house',
      activeInstruments: KIT_INSTRUMENTS.house,
      drumSongs:         [],
      instFX:            {},
      instPlugins:       {},
      houseKitMic:          'blend' as HouseMic,
      houseInstVelOverride: {} as Partial<Record<string, string>>,
      houseCrashModel:      'ac18' as HouseCrashModel,
      cymbalPack:           'default' as CymbalPack,
      drumPrefs:            { ...DEFAULT_DRUM_PREFS },

      setSoundForInstrument: (inst, soundId) =>
        set(s => ({ soundMap: { ...s.soundMap, [inst]: soundId } })),
      setVolumeForInstrument: (inst, vol) =>
        set(s => ({ volumeMap: { ...s.volumeMap, [inst]: Math.max(0, Math.min(1, vol)) } })),
      setMasterVolume: vol => set({ masterVolume: Math.max(0, Math.min(1, vol)) }),

      setKitType: (kit, soundMap) =>
        set({ kitType: kit, soundMap, activeInstruments: KIT_INSTRUMENTS[kit] }),

      toggleInstrument: inst =>
        set(s => ({
          activeInstruments: s.activeInstruments.includes(inst)
            ? s.activeInstruments.length > 1 ? s.activeInstruments.filter(i => i !== inst) : s.activeInstruments
            : [...s.activeInstruments, inst],
        })),

      setActiveInstruments: insts => set({ activeInstruments: insts }),

      createPattern: () => {
        const p = defaultPattern();
        p.name = `Pattern ${get().patterns.length + 1}`;
        set(s => ({ patterns: [...s.patterns, p], activePatternId: p.id }));
        return p.id;
      },

      addBlankPattern: () => {
        const s = get();
        const src = s.patterns.find(p => p.id === s.activePatternId) ?? s.patterns[0];
        const num = s.patterns.length + 1;
        const p: DrumPattern = {
          id: `p-${uid()}`,
          name: `Pattern ${num}`,
          bpm: src?.bpm ?? 120,
          timeSignature: src?.timeSignature ?? [4, 4],
          subdivision: src?.subdivision ?? 16,
          measures: [emptyMeasure(), emptyMeasure()],
          swing: src?.swing ?? 0,
        };
        set(st => ({ patterns: [...st.patterns, p], activePatternId: p.id }));
        return p.id;
      },

      duplicatePattern: id => {
        const src = get().patterns.find(p => p.id === id);
        if (!src) return id;
        const dup: DrumPattern = {
          ...JSON.parse(JSON.stringify(src)),
          id: `p-${uid()}`,
          name: `${src.name} (copy)`,
          measures: JSON.parse(JSON.stringify(src.measures)).map((m: DrumMeasure) => ({ ...m, id: `m-${uid()}` })),
        };
        set(s => ({ patterns: [...s.patterns, dup], activePatternId: dup.id }));
        return dup.id;
      },

      deletePattern: id => {
        set(s => {
          const patterns = s.patterns.filter(p => p.id !== id);
          if (patterns.length === 0) {
            const p = defaultPattern();
            return { patterns: [p], activePatternId: p.id };
          }
          return { patterns, activePatternId: s.activePatternId === id ? patterns[0].id : s.activePatternId };
        });
      },

      renamePattern:  (id, name) => set(s => ({ patterns: s.patterns.map(p => p.id === id ? { ...p, name } : p) })),
      updatePattern:  (id, patch) => set(s => ({ patterns: s.patterns.map(p => p.id === id ? { ...p, ...patch } : p) })),
      setActivePattern: id => set({ activePatternId: id }),

      toggleHit: (patternId, measureId, instrument, step) => {
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            return {
              ...p,
              measures: p.measures.map(m => {
                if (m.id !== measureId) return m;
                const hits     = m.hits[instrument] ?? [];
                const existing = hits.find(h => h.step === step);
                const varList  = INST_VARIATIONS[instrument] ?? ['normal'];
                if (!existing) {
                  const newHit: DrumHit = { step, length: 1, variation: 'normal', velocity: randomNewNoteVelocity() };
                  return { ...m, hits: { ...m.hits, [instrument]: [...hits, newHit].sort((a, b) => a.step - b.step) } };
                }
                const curVar  = existing.variation ?? 'normal';
                const curIdx  = varList.indexOf(curVar);
                const nextIdx = curIdx < 0 ? varList.length : curIdx + 1;
                if (nextIdx >= varList.length) {
                  return { ...m, hits: { ...m.hits, [instrument]: hits.filter(h => h !== existing) } };
                }
                const updated: DrumHit = { ...existing, variation: varList[nextIdx] };
                return { ...m, hits: { ...m.hits, [instrument]: hits.map(h => h === existing ? updated : h) } };
              }),
            };
          }),
        }));
      },

      simpleToggleHit: (patternId, measureId, instrument, step) => {
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            return {
              ...p,
              measures: p.measures.map(m => {
                if (m.id !== measureId) return m;
                const hits = m.hits[instrument] ?? [];
                const existing = hits.find(h => h.step === step);
                if (existing) {
                  return { ...m, hits: { ...m.hits, [instrument]: hits.filter(h => h !== existing) } };
                }
                const newHit: DrumHit = { step, length: 1, variation: 'normal', velocity: randomNewNoteVelocity() };
                return { ...m, hits: { ...m.hits, [instrument]: [...hits, newHit].sort((a, b) => a.step - b.step) } };
              }),
            };
          }),
        }));
      },

      setHitVelocity: (patternId, measureId, instrument, step, velocity) => {
        const v = clampVelocity(velocity);
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            return {
              ...p,
              measures: p.measures.map(m => {
                if (m.id !== measureId) return m;
                const hits = m.hits[instrument] ?? [];
                const existing = hits.find(h => h.step === step);
                if (!existing || existing.velocity === v) return m;
                const updated: DrumHit = { ...existing, velocity: v };
                return { ...m, hits: { ...m.hits, [instrument]: hits.map(h => h === existing ? updated : h) } };
              }),
            };
          }),
        }));
      },

      addMeasure: patternId => {
        const m = emptyMeasure();
        set(s => ({ patterns: s.patterns.map(p => p.id === patternId ? { ...p, measures: [...p.measures, m] } : p) }));
        return m.id;
      },

      deleteMeasure: (patternId, measureId) => {
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            if (p.measures.length <= 2) return p;
            const finalMeasures = p.measures.filter(m => m.id !== measureId);
            const loopRange = p.loopRange
              ? clampLoopRange(p.loopRange, finalMeasures.length)
              : p.loopRange;
            return { ...p, measures: finalMeasures, loopRange };
          }),
        }));
      },

      clearMeasure: (patternId, measureId) => {
        set(s => ({
          patterns: s.patterns.map(p =>
            p.id !== patternId ? p : { ...p, measures: p.measures.map(m => m.id === measureId ? { ...m, hits: {} } : m) }
          ),
        }));
      },

      duplicateMeasure: (patternId, measureId) => {
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            const idx = p.measures.findIndex(m => m.id === measureId);
            if (idx < 0) return p;
            const dup: DrumMeasure = { id: `m-${uid()}`, hits: JSON.parse(JSON.stringify(p.measures[idx].hits)) };
            const measures = [...p.measures];
            measures.splice(idx + 1, 0, dup);
            return { ...p, measures };
          }),
        }));
      },

      insertMeasureAfter: (patternId, afterMeasureId, hitsTemplate) => {
        const newM: DrumMeasure = { id: `m-${uid()}`, hits: JSON.parse(JSON.stringify(hitsTemplate)) };
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            const idx = p.measures.findIndex(m => m.id === afterMeasureId);
            if (idx < 0) return p;
            const measures = [...p.measures];
            measures.splice(idx + 1, 0, newM);
            return { ...p, measures };
          }),
        }));
        return newM.id;
      },

      togglePatternMute: (patternId, inst) =>
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            const muted = p.mutedInstruments ?? [];
            return {
              ...p,
              mutedInstruments: muted.includes(inst)
                ? muted.filter(i => i !== inst)
                : [...muted, inst],
            };
          }),
        })),

      saveDrumSong: (name, artist, notes) => {
        const s = get();
        const song: DrumSong = {
          id: `ds-${uid()}`,
          name: name.trim() || 'Untitled Beat',
          artist: artist.trim(),
          notes: notes.trim(),
          patterns: JSON.parse(JSON.stringify(s.patterns)),
          activePatternId: s.activePatternId ?? s.patterns[0]?.id ?? '',
          kitType: s.kitType,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(st => ({ drumSongs: [song, ...st.drumSongs] }));
        return song.id;
      },

      createBlankDrumSong: (name, artist, bpm, notes, kitType) => {
        const p = defaultPattern();
        p.bpm = Math.max(40, Math.min(280, bpm));
        const normalizedKit = kitType && kitType !== 'house' ? 'house' : (kitType ?? 'house');
        const song: DrumSong = {
          id: `ds-${uid()}`,
          name: name.trim() || 'Untitled Beat',
          artist: artist.trim(),
          notes: notes.trim(),
          patterns: [p],
          activePatternId: p.id,
          kitType: normalizedKit,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(st => ({ drumSongs: [song, ...st.drumSongs] }));
        return song.id;
      },

      loadDrumSong: id => {
        const song = get().drumSongs.find(s => s.id === id);
        if (!song) return;
        const kit = song.kitType && song.kitType !== 'house' ? 'house' : (song.kitType ?? 'house');
        set({
          patterns: JSON.parse(JSON.stringify(song.patterns)),
          activePatternId: song.activePatternId,
          kitType: kit,
          instFX: {},
        });
      },

      deleteDrumSong: id =>
        set(s => ({ drumSongs: s.drumSongs.filter(x => x.id !== id) })),

      updateDrumSong: (id, patch) =>
        set(s => ({
          drumSongs: s.drumSongs.map(x =>
            x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x
          ),
        })),

      restorePatterns: (pts, actId) => set({ patterns: pts, activePatternId: actId }),

      grooves: [],

      saveGroove: (name, tag) => {
        const s = get();
        const pat = s.patterns.find(p => p.id === s.activePatternId) ?? s.patterns[0];
        if (!pat) return '';
        const entry: GrooveEntry = {
          id: `g-${uid()}`,
          name: name.trim() || pat.name,
          tag,
          bpm: pat.bpm,
          bars: pat.measures.length,
          subdivision: pat.subdivision,
          measures: JSON.parse(JSON.stringify(pat.measures)),
          savedAt: Date.now(),
        };
        set(st => ({ grooves: [entry, ...st.grooves] }));
        return entry.id;
      },

      deleteGroove: id => set(s => ({ grooves: s.grooves.filter(g => g.id !== id) })),

      renameGroove: (id, name, tag) =>
        set(s => ({ grooves: s.grooves.map(g => g.id === id ? { ...g, name: name.trim() || g.name, tag } : g) })),

      loadGrooveReplace: id => {
        const { grooves, activePatternId } = get();
        const groove = grooves.find(g => g.id === id);
        if (!groove) return;
        const newMeasures: DrumMeasure[] = JSON.parse(JSON.stringify(groove.measures)).map((m: DrumMeasure) => ({ ...m, id: `m-${uid()}` }));
        set(s => ({
          patterns: s.patterns.map(p =>
            p.id === activePatternId
              ? { ...p, bpm: groove.bpm, subdivision: groove.subdivision, measures: newMeasures }
              : p
          ),
        }));
      },

      loadGrooveAppend: id => {
        const { grooves, activePatternId } = get();
        const groove = grooves.find(g => g.id === id);
        if (!groove) return;
        const appendMeasures: DrumMeasure[] = JSON.parse(JSON.stringify(groove.measures)).map((m: DrumMeasure) => ({ ...m, id: `m-${uid()}` }));
        set(s => ({
          patterns: s.patterns.map(p =>
            p.id === activePatternId
              ? { ...p, measures: [...p.measures, ...appendMeasures] }
              : p
          ),
        }));
      },

      duplicateGroove: id => {
        const groove = get().grooves.find(g => g.id === id);
        if (!groove) return id;
        const dup: GrooveEntry = {
          ...JSON.parse(JSON.stringify(groove)),
          id: `g-${uid()}`,
          name: `${groove.name} (copy)`,
          savedAt: Date.now(),
        };
        set(s => {
          const idx = s.grooves.findIndex(g => g.id === id);
          const next = [...s.grooves];
          next.splice(idx + 1, 0, dup);
          return { grooves: next };
        });
        return dup.id;
      },

      importDrumSong: (name, artist, notes, patterns, activePatternId, kitType) => {
        const normalizedKit = kitType && kitType !== 'house' ? 'house' : (kitType ?? 'house');
        const song: DrumSong = {
          id: `ds-${uid()}`,
          name: name.trim() || 'Imported Beat',
          artist: artist.trim(),
          notes: notes.trim(),
          patterns: JSON.parse(JSON.stringify(patterns)),
          activePatternId,
          kitType: normalizedKit,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(st => ({ drumSongs: [song, ...st.drumSongs] }));
        return song.id;
      },

      setInstFX: (inst, fx) =>
        set(s => ({ instFX: { ...s.instFX, [inst]: { ...fx } } })),

      setInstPlugins: (inst, plugins) =>
        set(s => ({ instPlugins: { ...s.instPlugins, [inst]: plugins } })),

      setHouseKitMic: (mic) => set({ houseKitMic: mic }),

      setHouseInstVelOverride: (inst, vel) => set(s => {
        const next = { ...s.houseInstVelOverride };
        if (vel === undefined) delete next[inst]; else next[inst] = vel;
        return { houseInstVelOverride: next };
      }),

      setHouseCrashModel: (model) => set({ houseCrashModel: model }),
      setCymbalPack: (pack) => set({ cymbalPack: pack }),

      updateDrumPrefs: (patch) =>
        set(s => ({ drumPrefs: { ...s.drumPrefs, ...patch } })),
    }),
    {
      name: 'chordex-drums',
      version: 13,
      partialize: (state) => { const { instFX: _fx, ...rest } = state; return rest as typeof state; },
      storage: createJSONStorage(() => ({
        getItem: (name) => secureReadLocal(name),
        setItem: (name, value) => secureWriteLocal(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      })),
      migrate: (state: unknown, _version: number) => {
        const s = state as {
          drumSongs?: DrumSong[];
          patterns?: DrumPattern[];
          activeInstruments?: DrumInstrument[];
          kitType?: KitType | null;
          [k: string]: unknown;
        };
        const kitType = s.kitType && s.kitType !== 'house' ? 'house' : (s.kitType ?? 'house');
        const migratedPatterns = migratePatterns(s.patterns ?? [defaultPattern()]);
        const migratedSongs = (s.drumSongs ?? []).map(song => ({
          ...song,
          kitType: song.kitType && song.kitType !== 'house' ? 'house' : (song.kitType ?? 'house'),
          patterns: migratePatterns(song.patterns ?? []),
        }));
        // Remove folded instruments from activeInstruments
        const filtered = (s.activeInstruments ?? KIT_INSTRUMENTS[kitType])
          .filter((i: DrumInstrument) => i !== 'hihat-open' && i !== 'hihat-foot' && i !== 'ride');
        return {
          ...s,
          kitType,
          patterns: migratedPatterns,
          drumSongs: migratedSongs,
          activeInstruments: filtered.length > 0 ? filtered : KIT_INSTRUMENTS[kitType],
          drumPrefs: { ...DEFAULT_DRUM_PREFS, ...(s.drumPrefs as Partial<DrumPrefs> ?? {}) },
        };
      },
    }
  )
);

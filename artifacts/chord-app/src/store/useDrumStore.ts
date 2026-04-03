import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DrumInstrument =
  | 'crash' | 'ride'
  | 'hihat-open' | 'hihat-closed' | 'hihat-foot'
  | 'snare'
  | 'tom-high' | 'tom-mid' | 'tom-floor'
  | 'kick';

export type NoteVariation =
  | 'normal' | 'ghost' | 'rimshot' | 'flam'
  | 'open' | 'pedal'
  | 'accent' | 'bell' | 'choke';

export type KitType =
  | 'ludwig' | 'jazz' | 'rock' | 'vintage'
  | 'studio' | 'r8'   | 'linn' | 'funk'
  | 'cr78'   | 'tr808'| 'techno'| 'stark'
  | 'rmm'    | 'chrome';

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
  crash:          ['normal', 'choke'],
  ride:           ['normal', 'bell'],
};

export const INSTRUMENT_NAME: Record<DrumInstrument, string> = {
  crash:          'Crash',
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
  crash:          '#c084fc',
  ride:           '#a78bfa',
  'hihat-open':   '#34d399',
  'hihat-closed': '#4ade80',
  'hihat-foot':   '#86efac',
  snare:          '#fb923c',
  'tom-high':     '#f59e0b',
  'tom-mid':      '#fbbf24',
  'tom-floor':    '#f97316',
  kick:           '#679cff',
};

// Display order: high pitch → low pitch (hi-hat top, kick bottom)
// hihat-open and hihat-foot are now handled as variations of hihat-closed
export const KIT_INSTRUMENTS: Record<KitType, DrumInstrument[]> = {
  ludwig:  ['hihat-closed','snare','kick','crash','ride','tom-high','tom-mid','tom-floor'],
  jazz:    ['hihat-closed','snare','kick','crash','ride','tom-high','tom-mid','tom-floor'],
  rock:    ['hihat-closed','snare','kick','crash','ride','tom-high','tom-mid','tom-floor'],
  vintage: ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'],
  studio:  ['hihat-closed','snare','kick','crash','ride','tom-high','tom-mid','tom-floor'],
  r8:      ['hihat-closed','snare','kick','crash','ride','tom-high','tom-mid','tom-floor'],
  linn:    ['hihat-closed','snare','kick','crash','ride','tom-high'],
  funk:    ['hihat-closed','snare','kick','crash','ride','tom-high'],
  cr78:    ['hihat-closed','snare','kick','crash','tom-high'],
  tr808:   ['hihat-closed','snare','kick','crash','tom-high'],
  techno:  ['hihat-closed','snare','kick','crash','tom-high'],
  stark:   ['hihat-closed','snare','kick','crash'],
  // ── New high-quality acoustic kits ─────────────────────────────────────────
  rmm:     ['hihat-closed','snare','kick','crash','ride','tom-high','tom-mid','tom-floor'],
  chrome:  ['hihat-closed','snare','kick','crash','ride','tom-high','tom-mid','tom-floor'],
};

export interface DrumHit { step: number; length: number; variation?: NoteVariation; }
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
      kit: 'ludwig',
      label: 'Warm',
      desc: 'Pearl Master Studio — 10-ply maple shells, recorded by Enoe (CC-BY-3.0). Multi-mic, unprocessed natural tone.',
    },
    {
      kit: 'rmm',
      label: 'Punchy',
      desc: 'Real Music Media Open Source Drum Kit — commercial-grade studio recording released to the public domain. 20+ velocity layers.',
    },
    {
      kit: 'chrome',
      label: 'Bright',
      desc: 'Chrome Web Audio Acoustic Kit — real acoustic recording by Chris Wilson (cwilso / Google). Used in the original Web Audio API demo.',
    },
    {
      kit: 'jazz',
      label: 'Soft',
      desc: 'Pearl Master Studio (brush character) — snare-03 variant, soft hi-hat, generous early-room reflections for intimate jazz feel.',
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
export interface DrumPattern {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  subdivision: 8 | 16;
  measures: DrumMeasure[];
  mutedInstruments?: DrumInstrument[];
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
function emptyMeasure(): DrumMeasure { return { id: `m-${uid()}`, hits: {} }; }
function defaultPattern(): DrumPattern {
  return { id: `p-${uid()}`, name: 'Pattern 1', bpm: 120, timeSignature: [4, 4], subdivision: 16, measures: [emptyMeasure()] };
}

export function stepsPerMeasure(p: DrumPattern): number {
  return p.timeSignature[0] * (p.subdivision / p.timeSignature[1]);
}
export function measureHasHits(m: DrumMeasure): boolean {
  return Object.values(m.hits).some(arr => arr && arr.length > 0);
}

// Migrate a set of patterns: fold hihat-open/hihat-foot hits into hihat-closed with variations
function migratePatterns(patterns: DrumPattern[]): DrumPattern[] {
  return patterns.map(p => ({
    ...p,
    measures: p.measures.map(m => {
      const existing: DrumHit[] = [...(m.hits['hihat-closed'] ?? [])];
      (m.hits['hihat-open'] ?? []).forEach(h => {
        if (!existing.some(c => c.step === h.step))
          existing.push({ ...h, variation: 'open' as NoteVariation });
      });
      (m.hits['hihat-foot'] ?? []).forEach(h => {
        if (!existing.some(c => c.step === h.step))
          existing.push({ ...h, variation: 'pedal' as NoteVariation });
      });
      existing.sort((a, b) => a.step - b.step);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { 'hihat-open': _o, 'hihat-foot': _f, ...rest } = m.hits as Partial<Record<string, DrumHit[]>>;
      return { ...m, hits: { ...rest, 'hihat-closed': existing } as Partial<Record<DrumInstrument, DrumHit[]>> };
    }),
  }));
}

interface DrumStore {
  patterns:          DrumPattern[];
  activePatternId:   string | null;
  soundMap:          Partial<Record<DrumInstrument, string>>;
  volumeMap:         Partial<Record<DrumInstrument, number>>;
  masterVolume:      number;
  kitType:           KitType | null;
  activeInstruments: DrumInstrument[];

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
  updatePattern:    (id: string, patch: Partial<Pick<DrumPattern, 'bpm' | 'timeSignature' | 'subdivision' | 'measures'>>) => void;
  setActivePattern: (id: string) => void;

  toggleHit:       (patternId: string, measureId: string, instrument: DrumInstrument, step: number) => void;
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
  importDrumSong:   (name: string, artist: string, notes: string, patterns: DrumPattern[], activePatternId: string) => string;

  grooves:             GrooveEntry[];
  saveGroove:          (name: string, tag: GrooveTag) => string;
  deleteGroove:        (id: string) => void;
  renameGroove:        (id: string, name: string, tag: GrooveTag) => void;
  loadGrooveReplace:   (id: string) => void;
  loadGrooveAppend:    (id: string) => void;
  duplicateGroove:     (id: string) => string;

  instFX:     Partial<Record<DrumInstrument, InstFX>>;
  setInstFX:  (inst: DrumInstrument, fx: InstFX) => void;
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
      kitType:           null,
      activeInstruments: KIT_INSTRUMENTS.ludwig,
      drumSongs:         [],
      instFX:            {},

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
          measures: [emptyMeasure()],
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
                  const newHit: DrumHit = { step, length: 1, variation: 'normal' };
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

      addMeasure: patternId => {
        const m = emptyMeasure();
        set(s => ({ patterns: s.patterns.map(p => p.id === patternId ? { ...p, measures: [...p.measures, m] } : p) }));
        return m.id;
      },

      deleteMeasure: (patternId, measureId) => {
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            const measures = p.measures.filter(m => m.id !== measureId);
            return { ...p, measures: measures.length > 0 ? measures : [emptyMeasure()] };
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
        const song: DrumSong = {
          id: `ds-${uid()}`,
          name: name.trim() || 'Untitled Beat',
          artist: artist.trim(),
          notes: notes.trim(),
          patterns: [p],
          activePatternId: p.id,
          kitType: kitType ?? get().kitType,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(st => ({ drumSongs: [song, ...st.drumSongs] }));
        return song.id;
      },

      loadDrumSong: id => {
        const song = get().drumSongs.find(s => s.id === id);
        if (!song) return;
        set({
          patterns: JSON.parse(JSON.stringify(song.patterns)),
          activePatternId: song.activePatternId,
          kitType: song.kitType,
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

      importDrumSong: (name, artist, notes, patterns, activePatternId) => {
        const song: DrumSong = {
          id: `ds-${uid()}`,
          name: name.trim() || 'Imported Beat',
          artist: artist.trim(),
          notes: notes.trim(),
          patterns: JSON.parse(JSON.stringify(patterns)),
          activePatternId,
          kitType: get().kitType,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(st => ({ drumSongs: [song, ...st.drumSongs] }));
        return song.id;
      },

      setInstFX: (inst, fx) =>
        set(s => ({ instFX: { ...s.instFX, [inst]: { ...fx } } })),
    }),
    {
      name: 'chordex-drums',
      version: 8,
      migrate: (state: unknown, _version: number) => {
        const s = state as {
          drumSongs?: DrumSong[];
          patterns?: DrumPattern[];
          activeInstruments?: DrumInstrument[];
          kitType?: KitType | null;
          [k: string]: unknown;
        };
        const kitType = s.kitType ?? null;
        const migratedPatterns = migratePatterns(s.patterns ?? [defaultPattern()]);
        const migratedSongs = (s.drumSongs ?? []).map(song => ({
          ...song,
          patterns: migratePatterns(song.patterns ?? []),
        }));
        // Remove hihat-open/hihat-foot from activeInstruments if present
        const filtered = (s.activeInstruments ?? KIT_INSTRUMENTS[kitType ?? 'ludwig'])
          .filter((i: DrumInstrument) => i !== 'hihat-open' && i !== 'hihat-foot');
        return {
          ...s,
          patterns: migratedPatterns,
          drumSongs: migratedSongs,
          activeInstruments: filtered.length > 0 ? filtered : KIT_INSTRUMENTS[kitType ?? 'ludwig'],
        };
      },
    }
  )
);

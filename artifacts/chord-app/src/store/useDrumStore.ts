import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DrumInstrument =
  | 'crash' | 'ride'
  | 'hihat-open' | 'hihat-closed' | 'hihat-foot'
  | 'snare'
  | 'tom-high' | 'tom-mid' | 'tom-floor'
  | 'kick';

export const DRUM_INSTRUMENTS: DrumInstrument[] = [
  'crash', 'ride', 'hihat-open', 'hihat-closed', 'hihat-foot',
  'snare', 'tom-high', 'tom-mid', 'tom-floor', 'kick',
];

export const INSTRUMENT_ABBR: Record<DrumInstrument, string> = {
  crash:          'CR',
  ride:           'RD',
  'hihat-open':   'HO',
  'hihat-closed': 'HC',
  'hihat-foot':   'HF',
  snare:          'SN',
  'tom-high':     'T1',
  'tom-mid':      'T2',
  'tom-floor':    'FT',
  kick:           'BD',
};

export const INSTRUMENT_NAME: Record<DrumInstrument, string> = {
  crash:          'Crash',
  ride:           'Ride',
  'hihat-open':   'Hi-Hat Open',
  'hihat-closed': 'Hi-Hat Closed',
  'hihat-foot':   'Hi-Hat Foot',
  snare:          'Snare',
  'tom-high':     'Tom High',
  'tom-mid':      'Tom Mid',
  'tom-floor':    'Floor Tom',
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

export interface DrumHit {
  step: number;
  length: number;
}

export interface DrumMeasure {
  id: string;
  hits: Partial<Record<DrumInstrument, DrumHit[]>>;
}

export interface DrumPattern {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  subdivision: 8 | 16;
  measures: DrumMeasure[];
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyMeasure(): DrumMeasure {
  return { id: `m-${uid()}`, hits: {} };
}

function defaultPattern(): DrumPattern {
  return {
    id: `p-${uid()}`,
    name: 'Pattern 1',
    bpm: 120,
    timeSignature: [4, 4],
    subdivision: 16,
    measures: [emptyMeasure()],
  };
}

export function stepsPerMeasure(p: DrumPattern): number {
  return p.timeSignature[0] * (p.subdivision / p.timeSignature[1]);
}

export function measureHasHits(m: DrumMeasure): boolean {
  return Object.values(m.hits).some(arr => arr && arr.length > 0);
}

interface DrumStore {
  patterns: DrumPattern[];
  activePatternId: string | null;
  soundMap: Partial<Record<DrumInstrument, string>>;
  volumeMap: Partial<Record<DrumInstrument, number>>;
  masterVolume: number;

  setSoundForInstrument: (inst: DrumInstrument, soundId: string) => void;
  setVolumeForInstrument: (inst: DrumInstrument, vol: number) => void;
  setMasterVolume: (vol: number) => void;

  createPattern: () => string;
  duplicatePattern: (id: string) => string;
  deletePattern: (id: string) => void;
  renamePattern: (id: string, name: string) => void;
  updatePattern: (id: string, patch: Partial<Pick<DrumPattern, 'bpm' | 'timeSignature' | 'subdivision'>>) => void;
  setActivePattern: (id: string) => void;

  toggleHit: (patternId: string, measureId: string, instrument: DrumInstrument, step: number) => void;
  setHitLength: (patternId: string, measureId: string, instrument: DrumInstrument, step: number, length: number) => void;
  addMeasure: (patternId: string) => string;
  deleteMeasure: (patternId: string, measureId: string) => void;
  clearMeasure: (patternId: string, measureId: string) => void;
  duplicateMeasure: (patternId: string, measureId: string) => void;
}

const initial = defaultPattern();

export const useDrumStore = create<DrumStore>()(
  persist(
    (set, get) => ({
      patterns: [initial],
      activePatternId: initial.id,
      soundMap: {},
      volumeMap: {},
      masterVolume: 0.8,

      setSoundForInstrument: (inst, soundId) =>
        set(s => ({ soundMap: { ...s.soundMap, [inst]: soundId } })),
      setVolumeForInstrument: (inst, vol) =>
        set(s => ({ volumeMap: { ...s.volumeMap, [inst]: Math.max(0, Math.min(1, vol)) } })),
      setMasterVolume: (vol) =>
        set({ masterVolume: Math.max(0, Math.min(1, vol)) }),

      createPattern: () => {
        const p = defaultPattern();
        p.name = `Pattern ${get().patterns.length + 1}`;
        set(s => ({ patterns: [...s.patterns, p], activePatternId: p.id }));
        return p.id;
      },

      duplicatePattern: (id) => {
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

      deletePattern: (id) => {
        set(s => {
          const patterns = s.patterns.filter(p => p.id !== id);
          if (patterns.length === 0) {
            const p = defaultPattern();
            return { patterns: [p], activePatternId: p.id };
          }
          return {
            patterns,
            activePatternId: s.activePatternId === id ? patterns[0].id : s.activePatternId,
          };
        });
      },

      renamePattern: (id, name) => set(s => ({
        patterns: s.patterns.map(p => p.id === id ? { ...p, name } : p),
      })),

      updatePattern: (id, patch) => set(s => ({
        patterns: s.patterns.map(p => p.id === id ? { ...p, ...patch } : p),
      })),

      setActivePattern: (id) => set({ activePatternId: id }),

      toggleHit: (patternId, measureId, instrument, step) => {
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            return {
              ...p,
              measures: p.measures.map(m => {
                if (m.id !== measureId) return m;
                const hits = m.hits[instrument] ?? [];
                const existing = hits.find(h => step >= h.step && step < h.step + h.length);
                if (existing) {
                  return { ...m, hits: { ...m.hits, [instrument]: hits.filter(h => h !== existing) } };
                }
                return {
                  ...m,
                  hits: {
                    ...m.hits,
                    [instrument]: [...hits, { step, length: 1 }].sort((a, b) => a.step - b.step),
                  },
                };
              }),
            };
          }),
        }));
      },

      setHitLength: (patternId, measureId, instrument, step, length) => {
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            return {
              ...p,
              measures: p.measures.map(m => {
                if (m.id !== measureId) return m;
                const hits = m.hits[instrument] ?? [];
                return {
                  ...m,
                  hits: {
                    ...m.hits,
                    [instrument]: hits.map(h => h.step === step ? { ...h, length: Math.max(1, length) } : h),
                  },
                };
              }),
            };
          }),
        }));
      },

      addMeasure: (patternId) => {
        const m = emptyMeasure();
        set(s => ({
          patterns: s.patterns.map(p =>
            p.id === patternId ? { ...p, measures: [...p.measures, m] } : p
          ),
        }));
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
            p.id !== patternId ? p : {
              ...p,
              measures: p.measures.map(m => m.id === measureId ? { ...m, hits: {} } : m),
            }
          ),
        }));
      },

      duplicateMeasure: (patternId, measureId) => {
        set(s => ({
          patterns: s.patterns.map(p => {
            if (p.id !== patternId) return p;
            const idx = p.measures.findIndex(m => m.id === measureId);
            if (idx < 0) return p;
            const dup: DrumMeasure = {
              id: `m-${uid()}`,
              hits: JSON.parse(JSON.stringify(p.measures[idx].hits)),
            };
            const measures = [...p.measures];
            measures.splice(idx + 1, 0, dup);
            return { ...p, measures };
          }),
        }));
      },
    }),
    { name: 'chordex-drums', version: 1 }
  )
);

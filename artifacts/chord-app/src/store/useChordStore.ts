import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Chord, Instrument } from '../data/chords';
import { detectDeviceLanguage, type Language as I18nLanguage } from '../lib/i18n';
import { secureReadLocal, secureWriteLocal } from '../lib/security';

export type Theme = 'dark' | 'light' | 'system' | 'dynamic';
export type ActivePanel = 'library' | 'chord' | 'settings' | 'songs';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink' | 'teal' | 'custom';
export type AppKey = 'hub' | 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex';

export interface PerAppVisuals {
  theme: Theme;
  accentColor: AccentColor;
  amoledMode: boolean;
}
// Re-exported from i18n.ts so the store and the translation system always
// agree on the supported language set. v3.0.57 added: de, fr, zh, pt, it, ja, ko.
export type Language = I18nLanguage;
export type AnimationSpeed = 'normal' | 'fast' | 'reduced';
export type DisplayDensity = 'compact' | 'comfortable' | 'spacious';

export interface Progression {
  id: string;
  name: string;
  chords: string[];
  createdAt: number;
}

export interface BarreDef {
  fret: number;
  fromString: number; // 1-indexed
  toString: number;   // 1-indexed
}

export interface CustomChord {
  id: string;             // "custom-{timestamp}-{random}"
  name: string;           // user-defined name
  instrument: 'guitar' | 'piano' | 'bass';
  frets?: number[];       // per string: -1=muted, 0=open, n=fret (guitar/bass)
  barres?: BarreDef[];    // barre chord definitions
  pianoKeys?: number[];   // chromatic indices 0–11 (piano)
  notes: string[];        // computed note names (display)
  createdAt: number;
}

export interface SongSection {
  id: string;
  name: string;
  chords: string[];
}

export interface SongPreset {
  id: string;
  name: string;
  artist: string;
  bpm: number;
  key: string;
  notes: string;
  chords: string[];          // flat list — used when no sections
  sections?: SongSection[];  // optional section-based organisation
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  instrument: Instrument;
  theme: Theme;
  showNoteNames: boolean;
  showIntervals: boolean;
  tuning: string;
  amoledMode: boolean;
  accentColor: AccentColor;
  leftHanded: boolean;
  showFretNumbers: boolean;
  showFingerNumbers: boolean;
  animationSpeed: AnimationSpeed;
  displayDensity: DisplayDensity;
  showChordQualityColors: boolean;
  diagramSize: number;
  bassFiveString: boolean;
  hapticFeedback: boolean;
  showOpenStrings: boolean;
  fontSize: 'small' | 'medium' | 'large';
  showIntervalNames: boolean;
  liveModeAnimations: boolean;
  liveModeDiagram: boolean;
  liveChordSize: number;
  language: Language;
  preferFlats: boolean;
  defaultTab: ActivePanel;
  defaultDrumTab: 'songs' | 'patterns' | 'prefs';
  defaultStageView: 'Editor' | 'Setup' | 'Preferences';
  startupApp: 'chords' | 'drums' | 'hub' | 'stage' | 'groovex' | 'vocalex';
  appMode: 'chords' | 'drums' | 'hub' | 'stage' | 'groovex' | 'vocalex';
  hubUserName: string;
  highRefreshRate: boolean;
  lowLatencyMode: boolean;
  performanceMode: boolean;
  chordAssistant: boolean;
  assistantSmartSuggestions: boolean;
  assistantProgressionTips: boolean;
  assistantConflictDetection: boolean;
  assistantLearning: boolean;
  /**
   * When true, opening the app restores the last visited app, sub-tab and
   * sub-view (e.g. Stagex view, Drumex tab, Vocalex tab). When false (the
   * default), every launch falls back to the user's startupApp preference
   * and each sub-app's pinned default tab/view.
   */
  restoreLastSession: boolean;
  /** Show OS-level notification when a new OTA bundle is available. */
  otaNotifications: boolean;
  /** Periodically auto-check for OTA updates while the app is open. */
  otaAutoCheck: boolean;
  /** Show the "What's new" changelog sheet on the first launch after an update. */
  otaShowChangelog: boolean;
  perApp: Record<AppKey, PerAppVisuals>;
  customAccentHue: number;
  dynamicLightStart: number;
  dynamicLightEnd: number;
  privacyAnalytics: boolean;
  privacyCrashReports: boolean;
  privacyPerfReports: boolean;
  autoBackup: boolean;
  syncAcrossDevices: boolean;
  backupFrequency: 'manual' | 'daily' | 'weekly' | 'monthly';
  backupRetention: 'forever' | '90days' | '30days';
  autoCleanTemp: boolean;
  lastExportDate: string;
  activityHistoryEnabled: boolean;
  developerMode: boolean;
}

interface ChordStore {
  selectedChordId: string | null;
  activePanel: ActivePanel;
  settings: AppSettings;
  favorites: string[];
  recentChords: string[];
  progressions: Progression[];
  currentProgressionChords: string[];
  multiSelectChords: string[];
  isMultiChordMode: boolean;
  presets: SongPreset[];
  activePresetId: string | null;
  transpositions: Record<string, number>; // presetId → semitone offset (view-only, not stored in preset)
  customChords: CustomChord[];
  chordUsage: Record<string, number>;
  activityLog?: any[];

  /**
   * Persisted "where was the user last?" snapshot — used at app launch to
   * restore the prior session (last opened app, sub-screen, etc.). Project
   * IDs (activePresetId, activePatternId, etc.) live in their own stores
   * and are restored independently. Optional fields default to undefined,
   * in which case launch falls back to settings.startupApp / 'hub'.
   */
  lastSession: {
    app?: AppKey;
    vocalexTab?: 'practice' | 'pitch' | 'vocalLab' | 'takes';
    stagexView?: string;
    drumexTab?: 'songs' | 'patterns' | 'prefs';
  };

  selectChord: (chordId: string) => void;
  trackChordUsage: (chordId: string) => void;
  setActivePanel: (panel: ActivePanel) => void;
  toggleFavorite: (chordId: string) => void;
  isFavorite: (chordId: string) => boolean;
  updateSettings: (settings: Partial<AppSettings>) => void;
  updatePerApp: (apps: AppKey[], patch: Partial<PerAppVisuals>) => void;
  setLastSession: (patch: Partial<ChordStore['lastSession']>) => void;

  addToProgression: (chordId: string) => void;
  removeFromProgression: (index: number) => void;
  reorderProgression: (from: number, to: number) => void;
  clearProgression: () => void;
  saveProgression: (name: string) => void;
  loadProgression: (id: string) => void;
  deleteProgression: (id: string) => void;

  toggleMultiChordMode: () => void;
  toggleMultiSelectChord: (chordId: string) => void;
  clearMultiSelect: () => void;

  // Transposition
  setTranspose: (presetId: string, semitones: number) => void;
  resetTranspose: (presetId: string) => void;

  // Custom chords
  saveCustomChord: (chord: CustomChord) => void;
  updateCustomChord: (id: string, patch: Partial<CustomChord>) => void;
  deleteCustomChord: (id: string) => void;

  // Song preset operations
  createPreset: (data: Omit<SongPreset, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePreset: (id: string, data: Partial<SongPreset>) => void;
  deletePreset: (id: string) => void;
  setActivePreset: (id: string | null) => void;
  addChordToPreset: (presetId: string, chordId: string) => void;
  removeChordFromPreset: (presetId: string, index: number) => void;
  reorderPresetChords: (presetId: string, from: number, to: number) => void;
  duplicateChordInPreset: (presetId: string, index: number) => void;

  // Section operations
  addSection: (presetId: string, name: string) => void;
  updateSection: (presetId: string, sectionId: string, name: string) => void;
  deleteSection: (presetId: string, sectionId: string) => void;
  addChordToSection: (presetId: string, sectionId: string, chordId: string) => void;
  removeChordFromSection: (presetId: string, sectionId: string, index: number) => void;
  reorderSectionChords: (presetId: string, sectionId: string, from: number, to: number) => void;
  duplicateChordInSection: (presetId: string, sectionId: string, index: number) => void;
  reorderSection: (presetId: string, fromIdx: number, toIdx: number) => void;
  convertToSections: (presetId: string) => void;
  deduplicatePresetChords: (presetId: string) => void;
  deduplicateAllPresets: () => void;
}

const rawAccentColors = {
  blue:   { from: '#679cff', to: '#007aff', mid: '#4d8ef7' },
  purple: { from: '#b57bee', to: '#7c3aed', mid: '#9d60e6' },
  green:  { from: '#34d399', to: '#059669', mid: '#10b981' },
  orange: { from: '#fb923c', to: '#ea580c', mid: '#f97316' },
  pink:   { from: '#f472b6', to: '#db2777', mid: '#ec4899' },
  teal:   { from: '#2dd4bf', to: '#0891b2', mid: '#14b8a6' },
  custom: { from: '#6ea8fe', to: '#0d6efd', mid: '#4188fc' },
};

export const ACCENT_COLORS = new Proxy(rawAccentColors, {
  get(target, prop) {
    if (prop === 'custom') {
      try {
        const state = useChordStore.getState();
        const hue = state?.settings?.customAccentHue ?? 220;
        return {
          from: `hsl(${hue}, 75%, 65%)`,
          mid: `hsl(${hue}, 80%, 55%)`,
          to: `hsl(${(hue + 25) % 360}, 85%, 42%)`
        };
      } catch (e) {
        return target.custom;
      }
    }
    return target[prop as keyof typeof target] || target.blue;
  }
}) as typeof rawAccentColors;

export const useChordStore = create<ChordStore>()(
  persist(
    (set, get) => ({
      selectedChordId: 'C-major',
      activePanel: 'library',
      settings: {
        instrument: 'guitar',
        theme: 'dark',
        showNoteNames: true,
        showIntervals: false,
        tuning: 'Standard (EADGBE)',
        amoledMode: false,
        accentColor: 'blue',
        leftHanded: false,
        showFretNumbers: true,
        showFingerNumbers: false,
        animationSpeed: 'normal',
        displayDensity: 'comfortable',
        showChordQualityColors: true,
        diagramSize: 60,
        bassFiveString: false,
        hapticFeedback: true,
        showOpenStrings: true,
        fontSize: 'medium',
        showIntervalNames: false,
        liveModeAnimations: true,
        liveModeDiagram: false,
        liveChordSize: 100,
        // v3.0.57: default to the device's language on a fresh install.
        // Existing installs keep whatever the user already had — the
        // persist `merge` step overwrites this default with the saved
        // value, so this only matters when there's no persisted state.
        language: detectDeviceLanguage(),
        preferFlats: false,
        defaultTab: 'library',
        defaultDrumTab: 'songs',
        defaultStageView: 'Editor',
        startupApp: 'hub',
        appMode: 'hub',
        hubUserName: '',
        highRefreshRate: false,
        lowLatencyMode: false,
        performanceMode: false,
        chordAssistant: false,
        assistantSmartSuggestions: true,
        assistantProgressionTips: true,
        assistantConflictDetection: true,
        assistantLearning: true,
        restoreLastSession: false,
        otaNotifications: true,
        otaAutoCheck: true,
        otaShowChangelog: true,
        customAccentHue: 220,
        dynamicLightStart: 7,
        dynamicLightEnd: 20,
        privacyAnalytics: false,
        privacyCrashReports: false,
        privacyPerfReports: false,
        autoBackup: false,
        syncAcrossDevices: false,
        backupFrequency: 'manual',
        backupRetention: 'forever',
        autoCleanTemp: false,
        lastExportDate: 'Never exported',
        activityHistoryEnabled: true,
        developerMode: false,
        perApp: {
          hub:    { theme: 'dark', accentColor: 'blue', amoledMode: false },
          chords: { theme: 'dark', accentColor: 'blue', amoledMode: false },
          drums:  { theme: 'dark', accentColor: 'blue', amoledMode: false },
          stage:   { theme: 'dark', accentColor: 'blue', amoledMode: false },
          vocalex: { theme: 'dark', accentColor: 'blue', amoledMode: false },
          groovex: { theme: 'dark', accentColor: 'blue', amoledMode: false },
        },
      },
      favorites: [],
      recentChords: ['C-major'],
      progressions: [],
      currentProgressionChords: [],
      multiSelectChords: [],
      isMultiChordMode: false,
      presets: [],
      activePresetId: null,
      transpositions: {},
      customChords: [],
      chordUsage: {},
      activityLog: [],
      lastSession: { app: 'hub' },

      trackChordUsage: (chordId) => {
        set(state => ({
          chordUsage: { ...state.chordUsage, [chordId]: (state.chordUsage[chordId] ?? 0) + 1 },
        }));
      },

      selectChord: (chordId) => {
        set((state) => {
          const recent = [chordId, ...state.recentChords.filter(id => id !== chordId)].slice(0, 10);
          return { selectedChordId: chordId, recentChords: recent, activePanel: 'chord' };
        });
      },

      setActivePanel: (panel) => set({ activePanel: panel }),

      toggleFavorite: (chordId) => {
        set((state) => {
          const isFav = state.favorites.includes(chordId);
          return {
            favorites: isFav
              ? state.favorites.filter(id => id !== chordId)
              : [...state.favorites, chordId],
          };
        });
      },

      isFavorite: (chordId) => get().favorites.includes(chordId),

      updateSettings: (newSettings) => {
        set((state) => {
          // Mirror appMode changes into lastSession so a refresh / cold start
          // can restore the user to the last app they were viewing. This is
          // the universal write path for appMode (exit-to-hub, BottomNav,
          // launcher tiles all flow through here), so no extra subscription
          // is needed.
          const nextSession =
            newSettings.appMode && newSettings.appMode !== state.settings.appMode
              ? { ...state.lastSession, app: newSettings.appMode }
              : state.lastSession;
          return {
            settings: { ...state.settings, ...newSettings },
            lastSession: nextSession,
          };
        });
      },

      setLastSession: (patch) => {
        set((state) => ({ lastSession: { ...state.lastSession, ...patch } }));
      },

      updatePerApp: (apps, patch) => {
        set((state) => {
          const perApp = { ...state.settings.perApp };
          apps.forEach(app => {
            perApp[app] = { ...perApp[app], ...patch };
          });
          return { settings: { ...state.settings, perApp } };
        });
      },

      addToProgression: (chordId) => {
        set((state) => ({ currentProgressionChords: [...state.currentProgressionChords, chordId] }));
      },
      removeFromProgression: (index) => {
        set((state) => ({
          currentProgressionChords: state.currentProgressionChords.filter((_, i) => i !== index),
        }));
      },
      reorderProgression: (from, to) => {
        set((state) => {
          const chords = [...state.currentProgressionChords];
          const [moved] = chords.splice(from, 1);
          chords.splice(to, 0, moved);
          return { currentProgressionChords: chords };
        });
      },
      clearProgression: () => set({ currentProgressionChords: [] }),
      saveProgression: (name) => {
        set((state) => {
          const progression: Progression = {
            id: `prog-${Date.now()}`,
            name,
            chords: [...state.currentProgressionChords],
            createdAt: Date.now(),
          };
          return { progressions: [...state.progressions, progression] };
        });
      },
      loadProgression: (id) => {
        const prog = get().progressions.find(p => p.id === id);
        if (prog) set({ currentProgressionChords: [...prog.chords] });
      },
      deleteProgression: (id) => {
        set((state) => ({ progressions: state.progressions.filter(p => p.id !== id) }));
      },

      toggleMultiChordMode: () => {
        set((state) => ({ isMultiChordMode: !state.isMultiChordMode, multiSelectChords: [] }));
      },
      toggleMultiSelectChord: (chordId) => {
        set((state) => {
          const selected = state.multiSelectChords.includes(chordId);
          return {
            multiSelectChords: selected
              ? state.multiSelectChords.filter(id => id !== chordId)
              : [...state.multiSelectChords, chordId],
          };
        });
      },
      clearMultiSelect: () => set({ multiSelectChords: [] }),

      // ── Transposition ──
      setTranspose: (presetId, semitones) => {
        const clamped = Math.max(-11, Math.min(11, semitones));
        set((state) => ({
          transpositions: { ...state.transpositions, [presetId]: clamped },
        }));
      },
      resetTranspose: (presetId) => {
        set((state) => {
          const next = { ...state.transpositions };
          delete next[presetId];
          return { transpositions: next };
        });
      },

      // ── Custom chords ──
      saveCustomChord: (chord) => set((state) => ({
        customChords: [...state.customChords.filter(c => c.id !== chord.id), chord],
      })),
      updateCustomChord: (id, patch) => set((state) => ({
        customChords: state.customChords.map(c => c.id === id ? { ...c, ...patch } : c),
      })),
      deleteCustomChord: (id) => set((state) => ({
        customChords: state.customChords.filter(c => c.id !== id),
      })),

      // ── Song Preset operations ──
      createPreset: (data) => {
        const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const now = Date.now();
        const preset: SongPreset = { ...data, id, createdAt: now, updatedAt: now };
        set((state) => ({ presets: [...state.presets, preset], activePresetId: id }));
        import('../lib/activityLogger').then(({ logActivity }) => {
          logActivity('project_create', `Created ${preset.name}`, 'Chordex');
        }).catch(() => {});
        return id;
      },

      updatePreset: (id, data) => {
        set((state) => ({
          presets: state.presets.map(p =>
            p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p
          ),
        }));
      },

      deletePreset: (id) => {
        set((state) => ({
          presets: state.presets.filter(p => p.id !== id),
          activePresetId: state.activePresetId === id ? null : state.activePresetId,
        }));
      },

      setActivePreset: (id) => set({ activePresetId: id }),

      addChordToPreset: (presetId, chordId) => {
        set((state) => ({
          presets: state.presets.map(p =>
            p.id === presetId ? { ...p, chords: [...p.chords, chordId], updatedAt: Date.now() } : p
          ),
        }));
      },

      removeChordFromPreset: (presetId, index) => {
        set((state) => ({
          presets: state.presets.map(p => {
            if (p.id !== presetId) return p;
            const chords = [...p.chords];
            chords.splice(index, 1);
            return { ...p, chords, updatedAt: Date.now() };
          }),
        }));
      },

      reorderPresetChords: (presetId, from, to) => {
        set((state) => ({
          presets: state.presets.map(p => {
            if (p.id !== presetId) return p;
            const chords = [...p.chords];
            const [moved] = chords.splice(from, 1);
            chords.splice(to, 0, moved);
            return { ...p, chords, updatedAt: Date.now() };
          }),
        }));
      },

      duplicateChordInPreset: (presetId, index) => {
        set((state) => ({
          presets: state.presets.map(p => {
            if (p.id !== presetId) return p;
            const chords = [...p.chords];
            chords.splice(index + 1, 0, chords[index]);
            return { ...p, chords, updatedAt: Date.now() };
          }),
        }));
      },

      addSection: (presetId, name) => {
        const id = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        set((state) => ({
          presets: state.presets.map(p =>
            p.id !== presetId ? p : {
              ...p, updatedAt: Date.now(),
              sections: [...(p.sections ?? []), { id, name, chords: [] }],
            }
          ),
        }));
      },

      updateSection: (presetId, sectionId, name) => {
        set((state) => ({
          presets: state.presets.map(p =>
            p.id !== presetId ? p : {
              ...p, updatedAt: Date.now(),
              sections: (p.sections ?? []).map(s => s.id === sectionId ? { ...s, name } : s),
            }
          ),
        }));
      },

      deleteSection: (presetId, sectionId) => {
        set((state) => ({
          presets: state.presets.map(p =>
            p.id !== presetId ? p : {
              ...p, updatedAt: Date.now(),
              sections: (p.sections ?? []).filter(s => s.id !== sectionId),
            }
          ),
        }));
      },

      addChordToSection: (presetId, sectionId, chordId) => {
        set((state) => ({
          presets: state.presets.map(p =>
            p.id !== presetId ? p : {
              ...p, updatedAt: Date.now(),
              sections: (p.sections ?? []).map(s =>
                s.id === sectionId ? { ...s, chords: [...s.chords, chordId] } : s
              ),
            }
          ),
        }));
      },

      removeChordFromSection: (presetId, sectionId, index) => {
        set((state) => ({
          presets: state.presets.map(p => {
            if (p.id !== presetId) return p;
            return {
              ...p, updatedAt: Date.now(),
              sections: (p.sections ?? []).map(s => {
                if (s.id !== sectionId) return s;
                const chords = [...s.chords];
                chords.splice(index, 1);
                return { ...s, chords };
              }),
            };
          }),
        }));
      },

      reorderSectionChords: (presetId, sectionId, from, to) => {
        if (from === to) return;
        set((state) => ({
          presets: state.presets.map(p => {
            if (p.id !== presetId) return p;
            return {
              ...p, updatedAt: Date.now(),
              sections: (p.sections ?? []).map(s => {
                if (s.id !== sectionId) return s;
                const chords = [...s.chords];
                const [moved] = chords.splice(from, 1);
                chords.splice(to, 0, moved);
                return { ...s, chords };
              }),
            };
          }),
        }));
      },

      duplicateChordInSection: (presetId, sectionId, index) => {
        set((state) => ({
          presets: state.presets.map(p => {
            if (p.id !== presetId) return p;
            return {
              ...p, updatedAt: Date.now(),
              sections: (p.sections ?? []).map(s => {
                if (s.id !== sectionId) return s;
                const chords = [...s.chords];
                chords.splice(index + 1, 0, chords[index]);
                return { ...s, chords };
              }),
            };
          }),
        }));
      },

      reorderSection: (presetId, fromIdx, toIdx) => {
        set((state) => ({
          presets: state.presets.map(p => {
            if (p.id !== presetId || !p.sections) return p;
            const secs = [...p.sections];
            const [moved] = secs.splice(fromIdx, 1);
            secs.splice(toIdx, 0, moved);
            return { ...p, updatedAt: Date.now(), sections: secs };
          }),
        }));
      },

      convertToSections: (presetId) => {
        set((state) => ({
          presets: state.presets.map(p => {
            if (p.id !== presetId) return p;
            const id = `sec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
            return {
              ...p, updatedAt: Date.now(),
              sections: [{ id, name: 'Verse', chords: [...p.chords] }],
              chords: [],
            };
          }),
        }));
      },

      deduplicatePresetChords: (presetId) => {
        const state = get();
        const preset = state.presets.find(p => p.id === presetId);
        if (!preset) return;
        const uniqueFlat = [...new Set(preset.chords)];
        const uniqueSections = preset.sections?.map(s => ({
          ...s,
          chords: [...new Set(s.chords)],
        }));
        const changed =
          uniqueFlat.length !== preset.chords.length ||
          (uniqueSections ?? []).some((s, i) => s.chords.length !== (preset.sections?.[i]?.chords.length ?? 0));
        if (!changed) return;
        set({
          presets: state.presets.map(p =>
            p.id === presetId
              ? { ...p, chords: uniqueFlat, sections: uniqueSections, updatedAt: Date.now() }
              : p
          ),
        });
      },

      deduplicateAllPresets: () => {
        const state = get();
        let anyChanged = false;
        const newPresets = state.presets.map(p => {
          const uniqueFlat = [...new Set(p.chords)];
          const uniqueSections = p.sections?.map(s => ({
            ...s,
            chords: [...new Set(s.chords)],
          }));
          const changed =
            uniqueFlat.length !== p.chords.length ||
            (uniqueSections ?? []).some((s, i) => s.chords.length !== (p.sections?.[i]?.chords.length ?? 0));
          if (!changed) return p;
          anyChanged = true;
          return { ...p, chords: uniqueFlat, sections: uniqueSections, updatedAt: Date.now() };
        });
        if (!anyChanged) return;
        set({ presets: newPresets });
      },
    }),
    {
      name: 'chord-explorer-storage-v3',
      version: 10,
      migrate: (stored: unknown, fromVersion: number) => {
        const s = stored as Record<string, unknown>;
        if (fromVersion < 1) {
          if (s.settings && typeof s.settings === 'object') {
            const settings = s.settings as Record<string, unknown>;
            settings.startupApp  = 'hub';
            settings.appMode     = 'hub';
            settings.hubUserName = settings.hubUserName ?? '';
          }
        }
        if (fromVersion < 2) {
          if (s.settings && typeof s.settings === 'object') {
            const settings = s.settings as Record<string, unknown>;
            const theme       = (settings.theme       as Theme)       ?? 'dark';
            const accentColor = (settings.accentColor as AccentColor) ?? 'blue';
            const amoledMode  = (settings.amoledMode  as boolean)     ?? false;
            settings.perApp = {
              hub:    { theme, accentColor, amoledMode },
              chords: { theme, accentColor, amoledMode },
              drums:  { theme, accentColor, amoledMode },
              stage:  { theme, accentColor, amoledMode },
            };
          }
        }
        if (fromVersion < 3) {
          if (s.settings && typeof s.settings === 'object') {
            const settings = s.settings as Record<string, unknown>;
            const perApp = settings.perApp as Record<string, unknown> | undefined;
            if (perApp && !perApp.groovex) {
              const hubVis = perApp.hub as PerAppVisuals | undefined;
              perApp.groovex = hubVis ? { ...hubVis } : { theme: 'dark', accentColor: 'blue', amoledMode: false };
            }
          }
        }
        if (fromVersion < 4) {
          if (s.settings && typeof s.settings === 'object') {
            const settings = s.settings as Record<string, unknown>;
            const perApp = settings.perApp as Record<string, unknown> | undefined;
            if (perApp && !perApp.vocalex) {
              const hubVis = perApp.hub as PerAppVisuals | undefined;
              perApp.vocalex = hubVis ? { ...hubVis } : { theme: 'dark', accentColor: 'blue', amoledMode: false };
            }
          }
        }
        // NOTE: a previous v5 migration unconditionally rewrote
        // `settings.language = 'es'`, which silently undid every user's
        // language pick after each OTA update. Removed permanently —
        // the language is now whatever the user last chose, period.
        if (fromVersion < 5) {
          // intentionally no-op; left as a marker so older builds with
          // a stored persist version of 4 still bump cleanly through to 6+.
        }
        if (fromVersion < 6) {
          if (s.settings && typeof s.settings === 'object') {
            const settings = s.settings as Record<string, unknown>;
            if (typeof settings.highRefreshRate !== 'boolean') {
              settings.highRefreshRate = false;
            }
            if (typeof settings.lowLatencyMode !== 'boolean') {
              settings.lowLatencyMode = false;
            }
            if (typeof settings.performanceMode !== 'boolean') {
              settings.performanceMode = false;
            }
            // Drop legacy `hubChimeEnabled` from older persisted state — the
            // Studio Chime feature was removed entirely. Leaving the property
            // around is harmless but pointless; remove it on rehydrate so
            // old installs don't carry dead config forever.
            if ('hubChimeEnabled' in settings) {
              delete (settings as Record<string, unknown>).hubChimeEnabled;
            }
          }
        }
        if (fromVersion < 7) {
          // Switch the default language from 'es' to 'en'. Only resets users
          // who still have the old hardcoded default — anyone who explicitly
          // chose a different language keeps their choice.
          if (s.settings && typeof s.settings === 'object') {
            const settings = s.settings as Record<string, unknown>;
            if (settings.language === 'es') {
              settings.language = 'en';
            }
          }
        }
        if (fromVersion < 8) {
          // v3.0.57: 7 new languages added. No-op for existing users —
          // they keep whatever they had picked. New installs get device
          // language via the initial state in the store. Marker only.
        }
        if (fromVersion < 9) {
          if (s.settings && typeof s.settings === 'object') {
            const settings = s.settings as Record<string, unknown>;
            if (typeof settings.privacyAnalytics !== 'boolean') settings.privacyAnalytics = false;
            if (typeof settings.privacyCrashReports !== 'boolean') settings.privacyCrashReports = false;
            if (typeof settings.privacyPerfReports !== 'boolean') settings.privacyPerfReports = false;
            if (typeof settings.autoBackup !== 'boolean') settings.autoBackup = false;
            if (typeof settings.syncAcrossDevices !== 'boolean') settings.syncAcrossDevices = false;
            if (typeof settings.backupFrequency !== 'string') settings.backupFrequency = 'manual';
            if (typeof settings.backupRetention !== 'string') settings.backupRetention = 'forever';
            if (typeof settings.autoCleanTemp !== 'boolean') settings.autoCleanTemp = false;
            if (typeof settings.lastExportDate !== 'string') settings.lastExportDate = 'Never exported';
          }
        }
        if (fromVersion < 10) {
          if (s.settings && typeof s.settings === 'object') {
            const settings = s.settings as Record<string, unknown>;
            if (typeof settings.developerMode !== 'boolean') {
              settings.developerMode = false;
            }
          }
        }
        return s;
      },
      partialize: (state) => ({
        favorites: state.favorites,
        recentChords: state.recentChords,
        progressions: state.progressions,
        settings: state.settings,
        currentProgressionChords: state.currentProgressionChords,
        presets: state.presets,
        transpositions: state.transpositions,
        customChords: state.customChords,
        chordUsage: state.chordUsage,
        lastSession: state.lastSession,
      }),
      storage: createJSONStorage(() => ({
        getItem: (name) => secureReadLocal(name),
        setItem: (name, value) => secureWriteLocal(name, value),
        removeItem: (name) => localStorage.removeItem(name),
      })),
    }
  )
);

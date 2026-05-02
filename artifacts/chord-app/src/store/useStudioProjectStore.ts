/**
 * Central Studio Project store.
 *
 * One Zustand store owns ALL projects across the Studio ecosystem. App
 * stores (useChordStore, useDrumStore, ...) never import this file
 * directly — only `lib/studioBridge.ts` does. That module is the single
 * integration layer; apps stay completely independent.
 *
 * Persisted to localStorage via the standard zustand persist middleware
 * — same mechanism as every other Studio store, so reads at app launch
 * are synchronous and add no startup cost.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type StudioProject,
  type StudioProjectChordsSlice,
  type StudioProjectDrumsSlice,
  type StudioProjectVocalsSlice,
  type StudioProjectStageSlice,
  isStudioProject,
  makeEmptyProject,
  STUDIO_PROJECT_SCHEMA_VERSION,
} from '../types/studioProject';

interface StudioProjectStore {
  /** All projects keyed by id. Map shape (not array) so updates are O(1). */
  projects: Record<string, StudioProject>;
  /** The project that ambient sync writes into. Null = sync is inert. */
  activeProjectId: string | null;

  /* ───── Project lifecycle ────────────────────────────────────────── */
  createProject: (name?: string) => string;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setActiveProject: (id: string | null) => void;

  /* ───── Slice updaters (called by the bridge / per-app push fns) ── */
  updateChordsSlice: (projectId: string, patch: Partial<StudioProjectChordsSlice>) => void;
  updateDrumsSlice:  (projectId: string, patch: Partial<StudioProjectDrumsSlice>)  => void;
  updateVocalsSlice: (projectId: string, patch: Partial<StudioProjectVocalsSlice>) => void;
  updateStageSlice:  (projectId: string, patch: Partial<StudioProjectStageSlice>)  => void;

  /* ───── Import / export (cloud sync, sharing, debugging) ─────────── */
  exportProject: (id: string) => StudioProject | null;
  importProject: (json: unknown) => string | null;

  /* ───── Read helpers ─────────────────────────────────────────────── */
  getActiveProject: () => StudioProject | null;
  listProjects: () => StudioProject[];
}

const DEFAULT_PROJECT_NAME = 'My First Song';

export const useStudioProjectStore = create<StudioProjectStore>()(
  persist(
    (set, get) => ({
      projects: {},
      activeProjectId: null,

      createProject: (name) => {
        const project = makeEmptyProject(name?.trim() || DEFAULT_PROJECT_NAME);
        set((s) => ({
          projects: { ...s.projects, [project.id]: project },
          // First-ever project becomes active automatically — otherwise
          // the bridge would have nothing to write into and the system
          // would appear inert.
          activeProjectId: s.activeProjectId ?? project.id,
        }));
        return project.id;
      },

      deleteProject: (id) => {
        set((s) => {
          if (!s.projects[id]) return s;
          const { [id]: _removed, ...rest } = s.projects;
          const stillActive = s.activeProjectId === id ? null : s.activeProjectId;
          return { projects: rest, activeProjectId: stillActive };
        });
      },

      renameProject: (id, name) => {
        set((s) => {
          const p = s.projects[id];
          if (!p) return s;
          return {
            projects: { ...s.projects, [id]: { ...p, name, updatedAt: Date.now() } },
          };
        });
      },

      setActiveProject: (id) => {
        if (id !== null && !get().projects[id]) return;
        set({ activeProjectId: id });
      },

      updateChordsSlice: (projectId, patch) => {
        set((s) => {
          const p = s.projects[projectId];
          if (!p) return s;
          const now = Date.now();
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...p,
                chords: { chordIds: [], presetId: null, ...p.chords, ...patch, updatedAt: now },
                updatedAt: now,
              },
            },
          };
        });
      },

      updateDrumsSlice: (projectId, patch) => {
        set((s) => {
          const p = s.projects[projectId];
          if (!p) return s;
          const now = Date.now();
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...p,
                drums: { patternId: null, ...p.drums, ...patch, updatedAt: now },
                updatedAt: now,
              },
            },
          };
        });
      },

      updateVocalsSlice: (projectId, patch) => {
        set((s) => {
          const p = s.projects[projectId];
          if (!p) return s;
          const now = Date.now();
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...p,
                vocals: { takeIds: [], ...p.vocals, ...patch, updatedAt: now },
                updatedAt: now,
              },
            },
          };
        });
      },

      updateStageSlice: (projectId, patch) => {
        set((s) => {
          const p = s.projects[projectId];
          if (!p) return s;
          const now = Date.now();
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...p,
                stage: { ...p.stage, ...patch, updatedAt: now },
                updatedAt: now,
              },
            },
          };
        });
      },

      exportProject: (id) => {
        const p = get().projects[id];
        return p ? structuredClone(p) : null;
      },

      importProject: (json) => {
        if (!isStudioProject(json)) return null;
        // Forward-compat: refuse newer schemas we don't understand.
        if (json.schemaVersion > STUDIO_PROJECT_SCHEMA_VERSION) return null;
        const id =
          json.id && !get().projects[json.id]
            ? json.id
            : makeEmptyProject('').id;
        const imported: StudioProject = { ...json, id, updatedAt: Date.now() };
        set((s) => ({
          projects: { ...s.projects, [id]: imported },
          activeProjectId: s.activeProjectId ?? id,
        }));
        return id;
      },

      getActiveProject: () => {
        const s = get();
        return s.activeProjectId ? s.projects[s.activeProjectId] ?? null : null;
      },

      listProjects: () => {
        const s = get();
        return Object.values(s.projects).sort((a, b) => b.updatedAt - a.updatedAt);
      },
    }),
    {
      name: 'studio-projects-v1',
      // Only the data — actions are recreated by zustand on every load.
      partialize: (s) => ({
        projects: s.projects,
        activeProjectId: s.activeProjectId,
      }),
    },
  ),
);

/**
 * Ensure there's always at least one project so ambient sync has a
 * destination on first launch. Idempotent — safe to call repeatedly.
 * Called once from `useStudioSync` at app boot.
 */
export function ensureDefaultStudioProject(): string {
  const s = useStudioProjectStore.getState();
  if (s.activeProjectId && s.projects[s.activeProjectId]) return s.activeProjectId;
  const existing = Object.keys(s.projects)[0];
  if (existing) {
    s.setActiveProject(existing);
    return existing;
  }
  return s.createProject(DEFAULT_PROJECT_NAME);
}

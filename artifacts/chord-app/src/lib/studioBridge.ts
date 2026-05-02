/**
 * Studio Bridge — the *only* module that's allowed to know about more
 * than one app's store. Every other file in the codebase imports from
 * exactly one app store; this file is the integration boundary.
 *
 * Responsibilities:
 *   1. Subscribe to per-app stores (Chordex, Drumex) and mirror their
 *      "active selection" into the active StudioProject's slice.
 *   2. Expose imperative `push…` helpers for apps whose state lives
 *      outside zustand (Vocalex takes in IndexedDB, Stagex layout in an
 *      iframe). Those apps call the helper from their own boundary.
 *   3. Expose `read…` helpers so any app can pull a peer slice WITHOUT
 *      importing the peer's store directly. e.g. Drumex can call
 *      `readActiveProjectChords()` to default a new pattern's BPM to
 *      the song's BPM — without touching useChordStore.
 *
 * Design notes:
 *   - Subscribers run a JSON-snapshot diff so we don't write on every
 *     unrelated store change. Diff is O(slice size); slices are tiny.
 *   - All writes go through `useStudioProjectStore` actions so the
 *     persist middleware throttles I/O.
 *   - When `activeProjectId` is null, every subscriber is a no-op —
 *     zero overhead until the user creates a project (or the default
 *     project is auto-created by `ensureDefaultStudioProject`).
 */

import { useChordStore } from '../store/useChordStore';
import { useDrumStore } from '../store/useDrumStore';
import {
  useStudioProjectStore,
  ensureDefaultStudioProject,
} from '../store/useStudioProjectStore';
import type {
  StudioProjectChordsSlice,
  StudioProjectDrumsSlice,
  StudioProjectStageSlice,
  StudioProjectVocalsSlice,
} from '../types/studioProject';

type SnapshotJson = string;

/**
 * Subscribe to Chordex's active preset and mirror it into the active
 * project's chords slice. Returns the unsubscribe fn.
 */
function subscribeChordexBridge(): () => void {
  let last: SnapshotJson = '';

  const sync = () => {
    const projectId = useStudioProjectStore.getState().activeProjectId;
    if (!projectId) return;

    const cs = useChordStore.getState();
    const preset = cs.presets.find((p) => p.id === cs.activePresetId);

    // Flatten section-organised presets to a single chord list so any
    // peer app can iterate without knowing Chordex's section model.
    let chordIds: string[] = [];
    if (preset) {
      if (preset.sections && preset.sections.length > 0) {
        chordIds = preset.sections.flatMap((s) => s.chords);
      } else {
        chordIds = preset.chords ?? [];
      }
    }

    const next = {
      presetId: preset?.id ?? null,
      presetName: preset?.name,
      chordIds,
      key: preset?.key,
      bpm: preset?.bpm,
    };
    const snap = JSON.stringify(next);
    if (snap === last) return;
    last = snap;
    useStudioProjectStore.getState().updateChordsSlice(projectId, next);
  };

  // Sync once on attach so the project reflects current state.
  sync();
  return useChordStore.subscribe(sync);
}

/**
 * Subscribe to Drumex's active pattern and mirror it into the active
 * project's drums slice.
 */
function subscribeDrumexBridge(): () => void {
  let last: SnapshotJson = '';

  const sync = () => {
    const projectId = useStudioProjectStore.getState().activeProjectId;
    if (!projectId) return;

    const ds = useDrumStore.getState();
    const pattern = ds.patterns.find((p) => p.id === ds.activePatternId);

    const next = {
      patternId: pattern?.id ?? null,
      patternName: pattern?.name,
      bpm: pattern?.bpm,
    };
    const snap = JSON.stringify(next);
    if (snap === last) return;
    last = snap;
    useStudioProjectStore.getState().updateDrumsSlice(projectId, next);
  };

  sync();
  return useDrumStore.subscribe(sync);
}

/* ──────────────────────────────────────────────────────────────────── *
 * Public API — apps that aren't wired to zustand call these directly.  *
 * ──────────────────────────────────────────────────────────────────── */

/** Push a Vocalex take into the active project. Called from TakesPanel. */
export function pushVocalTakeToActiveProject(
  takeId: string,
  opts?: { activate?: boolean },
): boolean {
  const projectId = useStudioProjectStore.getState().activeProjectId;
  if (!projectId) return false;
  const project = useStudioProjectStore.getState().projects[projectId];
  const existing = project?.vocals?.takeIds ?? [];
  if (!existing.includes(takeId)) {
    useStudioProjectStore.getState().updateVocalsSlice(projectId, {
      takeIds: [...existing, takeId],
      ...(opts?.activate ? { activeTakeId: takeId } : {}),
    });
  } else if (opts?.activate) {
    useStudioProjectStore.getState().updateVocalsSlice(projectId, {
      activeTakeId: takeId,
    });
  }
  return true;
}

/** Remove a take id from the active project. */
export function removeVocalTakeFromActiveProject(takeId: string): boolean {
  const projectId = useStudioProjectStore.getState().activeProjectId;
  if (!projectId) return false;
  const project = useStudioProjectStore.getState().projects[projectId];
  const existing = project?.vocals?.takeIds ?? [];
  if (!existing.includes(takeId)) return false;
  useStudioProjectStore.getState().updateVocalsSlice(projectId, {
    takeIds: existing.filter((id) => id !== takeId),
    activeTakeId:
      project?.vocals?.activeTakeId === takeId ? null : project?.vocals?.activeTakeId,
  });
  return true;
}

/** Push a Stagex iframe layout snapshot. Called from StageCorePanel. */
export function pushStageLayoutToActiveProject(
  layoutSnapshot: unknown,
  elementCount?: number,
): boolean {
  const projectId = useStudioProjectStore.getState().activeProjectId;
  if (!projectId) return false;
  useStudioProjectStore.getState().updateStageSlice(projectId, {
    layoutSnapshot,
    elementCount,
  });
  return true;
}

/* ──────────────────────────────────────────────────────────────────── *
 * Read helpers — let any app pull peer slices without coupling.        *
 * ──────────────────────────────────────────────────────────────────── */

export function readActiveProjectChords(): StudioProjectChordsSlice | null {
  return useStudioProjectStore.getState().getActiveProject()?.chords ?? null;
}

export function readActiveProjectDrums(): StudioProjectDrumsSlice | null {
  return useStudioProjectStore.getState().getActiveProject()?.drums ?? null;
}

export function readActiveProjectVocals(): StudioProjectVocalsSlice | null {
  return useStudioProjectStore.getState().getActiveProject()?.vocals ?? null;
}

export function readActiveProjectStage(): StudioProjectStageSlice | null {
  return useStudioProjectStore.getState().getActiveProject()?.stage ?? null;
}

/* ──────────────────────────────────────────────────────────────────── *
 * Lifecycle.                                                           *
 * ──────────────────────────────────────────────────────────────────── */

let attached = false;

/**
 * Wire the bridge once at app boot. Idempotent. Returns a teardown fn
 * the React hook can run on unmount (in practice we never unmount —
 * the bridge lives for the lifetime of the page).
 */
export function attachStudioBridge(): () => void {
  if (attached) return () => {};
  attached = true;
  ensureDefaultStudioProject();
  const off1 = subscribeChordexBridge();
  const off2 = subscribeDrumexBridge();
  return () => {
    attached = false;
    off1();
    off2();
  };
}

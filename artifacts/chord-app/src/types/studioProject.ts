/**
 * Studio Project — unified data shape shared by every Studio app
 * (Chordex, Drumex, Vocalex, Stagex). A project is the *connective tissue*
 * of the ecosystem: each app contributes (and reads) its own slice of the
 * same JSON document, so material moves between apps without any app
 * knowing about any other.
 *
 * Design rules:
 *  - Every slice is OPTIONAL. An empty project is valid.
 *  - Slices store *references* (IDs) into each app's own store, not the
 *    raw payloads. Source-of-truth lives in the per-app store; the
 *    project just records which preset / pattern / take / layout the
 *    user is currently treating as part of this song.
 *  - Lightweight metadata (name, bpm, key, durationMs) is duplicated so
 *    other apps can act on the data without dereferencing through the
 *    source store.
 *  - Every slice carries its own `updatedAt` so the cloud-sync layer can
 *    do per-slice last-writer-wins without overwriting unrelated work.
 *  - `schemaVersion` is bumped only when an incompatible change ships;
 *    forward-compat readers should ignore unknown fields.
 */

export const STUDIO_PROJECT_SCHEMA_VERSION = 1;

export interface StudioProjectChordsSlice {
  /** Chordex preset id — null when the user has no preset selected. */
  presetId: string | null;
  /** Cached preset name so other apps can show it without loading useChordStore. */
  presetName?: string;
  /** Ordered chord-id list (flat or flattened from sections). */
  chordIds: string[];
  /** Key signature, e.g. "C", "Am". */
  key?: string;
  /** Beats per minute — used by Drumex to seed new patterns. */
  bpm?: number;
  updatedAt: number;
}

export interface StudioProjectDrumsSlice {
  /** Drumex pattern id currently associated with this project. */
  patternId: string | null;
  /** Cached pattern name. */
  patternName?: string;
  /** Drumex song id (a song = ordered list of patterns). */
  songId?: string | null;
  songName?: string;
  /** BPM of the active pattern. */
  bpm?: number;
  updatedAt: number;
}

export interface StudioProjectVocalsSlice {
  /** Vocalex take ids (recorded vocal performances) attached to the project. */
  takeIds: string[];
  /** The "lead" take the user picked from the set, if any. */
  activeTakeId?: string | null;
  updatedAt: number;
}

export interface StudioProjectStageSlice {
  /**
   * Opaque snapshot of the Stagex iframe layout. The iframe owns the
   * shape of this blob; Studio just stores it. Stored as `unknown` so
   * downstream consumers must validate before use.
   */
  layoutSnapshot?: unknown;
  /** Number of band elements currently on the stage (for quick UI badges). */
  elementCount?: number;
  updatedAt: number;
}

export type StudioProjectSliceKey = 'chords' | 'drums' | 'vocals' | 'stage';

export interface StudioProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: typeof STUDIO_PROJECT_SCHEMA_VERSION;
  chords?: StudioProjectChordsSlice;
  drums?: StudioProjectDrumsSlice;
  vocals?: StudioProjectVocalsSlice;
  stage?: StudioProjectStageSlice;
}

/**
 * Runtime guard — used when accepting a project from import / cloud sync.
 * Rejects anything that doesn't look like a project so we never poison
 * the central store with malformed data.
 */
export function isStudioProject(x: unknown): x is StudioProject {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) return false;
  if (typeof p.name !== 'string') return false;
  if (typeof p.createdAt !== 'number') return false;
  if (typeof p.updatedAt !== 'number') return false;
  if (typeof p.schemaVersion !== 'number') return false;
  return true;
}

/**
 * Build an empty project. Centralised so all create-paths produce
 * structurally identical projects (helps cloud-sync deduplication).
 */
export function makeEmptyProject(name: string): StudioProject {
  const now = Date.now();
  return {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `proj_${now}_${Math.random().toString(36).slice(2, 10)}`,
    name,
    createdAt: now,
    updatedAt: now,
    schemaVersion: STUDIO_PROJECT_SCHEMA_VERSION,
  };
}

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { subscribeAuth, type AuthUser } from './auth';
import { getAllTakes, saveTake, type TakeRecord } from '../vocalex/takesDb';
import { getAllSessions, saveSession, type LabSession, type LabLayer } from '../vocalex/labSessionDb';

/**
 * Cloud sync engine for Chordex / Drumex / StageX / Vocalex.
 *
 * Lifecycle (state machine):
 *
 *     ┌─ idle ──┐  request   ┌──── syncing ────┐  ok    ┌── success ─┐ 1.8s
 *     │         ├──────────► │ (one in-flight) ├──────► │ briefly    ├──────► idle
 *     │         │            └──────┬──────┬───┘        └────────────┘
 *     │         │                   │      │  fail / timeout
 *     │         │                   │      └─────────► error  ── retry ──┐
 *     └─────────┘                   │                                    │
 *                                   └──── (queue at-most-one follow-up if changes
 *                                          happened during the run) ─────┘
 *
 * Guarantees this rebuild adds:
 *   • EXACTLY one run can be in flight at a time. All callers (`syncNow`,
 *     `requestFlush`, the periodic tick, the visibility/beforeunload
 *     hooks, and the auth-change first-pull) funnel through `enqueueRun`
 *     which returns the in-flight Promise rather than starting a second
 *     run. This kills duplicate-trigger bugs at the source.
 *   • Every run is bounded by a 10-second OVERALL timeout. If the
 *     watchdog fires, the run is aborted, state transitions to `error`
 *     with a Retry-able message, and a `[sync] timeout` line is logged.
 *   • Per-Firestore-op timeout is 6 seconds. Apps are processed in
 *     PARALLEL (`Promise.allSettled`) instead of sequentially, so a
 *     full pull-or-push completes in ~6s worst case rather than 60s+.
 *   • An EPOCH counter is bumped on auth-change / detach. In-flight
 *     runs read it after every await and discard their results if it
 *     changed — no stale-uid writes after sign-out, no setState into a
 *     now-irrelevant world.
 *   • Initial pull-then-push is FIRE-AND-FORGET; the regular tick is
 *     scheduled immediately so the engine can never hang on first sync.
 *   • Structured `[sync]` console logs for every transition: start,
 *     success (with duration + push/pull counts), failure (with cause),
 *     timeout (with which op + how long).
 *   • `phase: 'idle'|'syncing'|'success'|'error'` is the source of
 *     truth. `syncing: boolean` stays as a derived field for callers
 *     that haven't migrated. `phase` automatically returns to `idle`
 *     1.8s after a successful run so the "Synced" toast never lingers.
 *
 * Per-app strategy (unchanged from prior version):
 *   • Per-app docs at `users/{uid}/state/{appKey}`.
 *   • Push: read each app's local snapshot, hash-compare to last-pushed,
 *     write to Firestore if changed.
 *   • Pull: on sign-in, for each app, if cloud is newer than what we
 *     last pulled/pushed, restore locally; otherwise push local upward.
 *   • StageX lives inside the stage-core iframe — snapshot via postMessage.
 *   • Vocalex takes/lab sessions live in IndexedDB; audio blobs are base64.
 */

import type { SyncAppKey } from './sync.types';
export type { SyncAppKey };

const SYNC_META_KEY = 'chordex_sync_meta_v1';
const DEVICE_ID_KEY = 'chordex_device_id';

const TICK_MS = 60_000;          // periodic safety-net flush while signed in
const RUN_TIMEOUT_MS = 15_000;   // OVERALL hard cap per run — keeps the spinner from sitting on a wedged Firestore connection
const FIRESTORE_OP_MS = 8_000;   // per-getDoc / per-setDoc cap — long enough for cold long-polling, short enough that the user notices a real failure
const SUCCESS_LINGER_MS = 1_200; // how long `phase=success` stays visible
const SYNCING_DEBOUNCE_MS = 600; // delay before showing spinner — quick runs stay invisible
const STAGE_SNAPSHOT_MS = 1_500; // postMessage round-trip cap
const RESTORE_OP_MS = 5_000;     // soft-cap on local IndexedDB restores so a wedged store can't pin `phase=syncing` forever

// localStorage keys owned by each app
const CHORDEX_LS_KEY = 'chord-explorer-storage-v3';
const DRUMEX_LS_KEY  = 'chordex-drums';
const DRUMEX_UI_KEY  = 'chordex-drum-ui';

const STAGEX_KEYS = [
  'stagecoreProject',
  'stagecorePresets_v1',
  'stagecoreSettings',
  'sc_session',
  'scCustomElements',
  'sc-offline-mode',
  'sm_behavior',
  'sc_el_presets_v1',
] as const;

type StagexSnapshot = Partial<Record<(typeof STAGEX_KEYS)[number], string>>;

// ── Vocalex serialization types ──────────────────────────────────────────────

type TakeSyncRecord = Omit<TakeRecord, 'audioBlob'> & { audioB64: string };
type LayerSyncRecord = Omit<LabLayer, 'audioBlob'> & { audioB64: string };
type SessionSyncRecord = Omit<LabSession, 'layers'> & { layers: LayerSyncRecord[] };

type Meta = {
  [K in SyncAppKey]?: {
    lastHash: string;
    cloudUpdatedMs: number;
  };
};

export type SyncPhase = 'idle' | 'syncing' | 'success' | 'error';

export type SyncStatus = {
  signedIn: boolean;
  /** Source of truth for the lifecycle. */
  phase: SyncPhase;
  /** Derived from `phase === 'syncing'` for back-compat with older UI code. */
  syncing: boolean;
  lastSyncedMs: number | null;
  error: string | null;
};

type Listener = (s: SyncStatus) => void;

// ── Engine state ─────────────────────────────────────────────────────────────

let currentUser: AuthUser | null = null;
/**
 * Bumped on every auth change, on detach, and any time we want to make
 * in-flight work give up its results without breaking the actual JS
 * call stack. Every async helper checks `epoch === startEpoch` after
 * every await and bails out if it has shifted.
 */
let epoch = 0;
let tickHandle: ReturnType<typeof setInterval> | null = null;
let unsubAuth: (() => void) | null = null;
let listeners = new Set<Listener>();
let status: SyncStatus = {
  signedIn: false,
  phase: 'idle',
  syncing: false,
  lastSyncedMs: null,
  error: null,
};
let stageIframe: HTMLIFrameElement | null = null;
let stageSnapshotResolvers: Array<(s: StagexSnapshot) => void> = [];

/**
 * The single in-flight run promise. Concurrent callers receive THIS
 * promise rather than starting their own — that is the lock that
 * prevents duplicate sync triggers.
 */
let runPromise: Promise<void> | null = null;
/**
 * If a caller asks for a run while one is in progress, instead of
 * starting a second run we just set this flag. When the current run
 * finishes it inspects the flag and starts ONE follow-up. At most one
 * follow-up is ever queued — so a flood of changes can't pile into a
 * runaway chain.
 */
let pendingFollowup = false;
/** Auto-fade-success timer (success → idle after a short linger). */
let lingerTimer: ReturnType<typeof setTimeout> | null = null;

type RunReason = 'initial' | 'tick' | 'manual' | 'visibility' | 'beforeunload' | 'flush' | 'retry';
type RunMode = 'pull-then-push' | 'push-only';

// ── Status emit ─────────────────────────────────────────────────────────────

function setStatus(patch: Partial<SyncStatus>): void {
  const next: SyncStatus = { ...status, ...patch };
  next.syncing = next.phase === 'syncing'; // keep derived field consistent
  status = next;
  for (const l of listeners) {
    try { l(status); } catch { /* listener errors must not break the engine */ }
  }
}

export function subscribeSyncStatus(l: Listener): () => void {
  listeners.add(l);
  l(status);
  return () => listeners.delete(l);
}

export function getSyncStatus(): SyncStatus { return status; }

// ── Logging helpers (single point so it's easy to silence in prod if needed) ─

const LOG = '[sync]';
function logStart(reason: RunReason, mode: RunMode) { console.info(`${LOG} start (reason=${reason}, mode=${mode})`); }
function logSuccess(durationMs: number, pushed: number, pulled: number) {
  console.info(`${LOG} success (duration=${durationMs}ms, pushed=${pushed}, pulled=${pulled})`);
}
function logFailure(durationMs: number, error: unknown) {
  const msg = (error as Error)?.message ?? String(error);
  console.warn(`${LOG} failure (duration=${durationMs}ms, error=${msg})`);
}
function logTimeout(op: string, ms: number) { console.warn(`${LOG} timeout (op=${op}, after=${ms}ms)`); }

// ── Timeout helpers ──────────────────────────────────────────────────────────

class SyncTimeoutError extends Error {
  constructor(public op: string, public ms: number) {
    super(`Sync timed out (op=${op}, after=${ms}ms)`);
    this.name = 'SyncTimeoutError';
  }
}

/** Wrap a promise with a timeout that REJECTS with a tagged error. */
function withTimeout<T>(promise: Promise<T>, ms: number, op: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new SyncTimeoutError(op, ms)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Race a promise against an AbortSignal — used for the overall run cap. */
function withAbort<T>(promise: Promise<T>, signal: AbortSignal, op: string): Promise<T> {
  if (signal.aborted) return Promise.reject(new SyncTimeoutError(op, 0));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new SyncTimeoutError(op, RUN_TIMEOUT_MS));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

// ── Meta storage ────────────────────────────────────────────────────────────

function readMeta(): Meta {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    return raw ? (JSON.parse(raw) as Meta) : {};
  } catch { return {}; }
}

function writeMeta(m: Meta) {
  try { localStorage.setItem(SYNC_META_KEY, JSON.stringify(m)); } catch { /* noop */ }
}

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch { return 'dev_unknown'; }
}

// ── Hash ────────────────────────────────────────────────────────────────────

function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ':' + s.length.toString(36);
}

// ── Local snapshots (localStorage) ──────────────────────────────────────────

function readLocalRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function snapshotChordex(): string | null { return readLocalRaw(CHORDEX_LS_KEY); }
function snapshotDrumex():  string | null { return readLocalRaw(DRUMEX_LS_KEY); }
function snapshotDrumexUI(): string | null { return readLocalRaw(DRUMEX_UI_KEY); }

function snapshotStagex(): Promise<StagexSnapshot | null> {
  if (!stageIframe || !stageIframe.contentWindow) {
    const fallback: StagexSnapshot = {};
    for (const k of STAGEX_KEYS) {
      const v = readLocalRaw(k);
      if (v != null) fallback[k] = v;
    }
    return Promise.resolve(Object.keys(fallback).length ? fallback : null);
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      stageSnapshotResolvers = stageSnapshotResolvers.filter((r) => r !== resolve);
      resolve(null);
    }, STAGE_SNAPSHOT_MS);
    stageSnapshotResolvers.push((snap) => {
      clearTimeout(timeout);
      resolve(snap);
    });
    try {
      stageIframe!.contentWindow!.postMessage(
        { type: 'sc-sync-snapshot' },
        window.location.origin,
      );
    } catch {
      clearTimeout(timeout);
      stageSnapshotResolvers = stageSnapshotResolvers.filter((r) => r !== resolve);
      resolve(null);
    }
  });
}

// ── Blob serialization ───────────────────────────────────────────────────────

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(dataUrl: string, fallbackType = 'audio/webm'): Blob {
  try {
    const [header, base64] = dataUrl.split(',');
    const type = header.match(/:(.*?);/)?.[1] ?? fallbackType;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type });
  } catch {
    return new Blob([], { type: fallbackType });
  }
}

// ── Vocalex takes / lab snapshots ────────────────────────────────────────────

const VOCALEX_BUDGET = 800_000; // ~800 KB cap per Firestore doc

/**
 * Race a promise against a short timeout. If the source rejects OR the
 * timer fires first, resolve to `null` rather than rejecting — the
 * caller's snapshot pipeline treats `null` as "no data this round" and
 * carries on. Used to defend against IndexedDB calls that can wedge
 * indefinitely on Android WebView (we've seen `getAll` never resolve
 * when the store was opened mid-upgrade), which previously left the
 * sync engine stuck on `phase: 'syncing'` forever because nothing in
 * `collectPushWork` was bounded.
 */
function softTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      () => { clearTimeout(t); resolve(null); },
    );
  });
}

const INDEXEDDB_SNAPSHOT_MS = 4_000;

async function snapshotVocalexTakes(): Promise<TakeSyncRecord[] | null> {
  try {
    const takes = await softTimeout(getAllTakes(), INDEXEDDB_SNAPSHOT_MS);
    if (!takes) return null;
    if (takes.length === 0) return null;
    const records: TakeSyncRecord[] = [];
    let totalSize = 0;
    for (const take of takes) {
      try {
        const audioB64 = await blobToBase64(take.audioBlob);
        if (totalSize + audioB64.length > VOCALEX_BUDGET) continue;
        totalSize += audioB64.length;
        const { audioBlob: _, ...rest } = take;
        records.push({ ...rest, audioB64 });
      } catch { /* skip unreadable blob */ }
    }
    return records.length > 0 ? records : null;
  } catch {
    return null;
  }
}

async function restoreVocalexTakes(records: TakeSyncRecord[]): Promise<void> {
  for (const record of records) {
    try {
      const audioBlob = base64ToBlob(record.audioB64);
      const { audioB64: _, ...rest } = record;
      await saveTake({ ...rest, audioBlob });
    } catch { /* skip corrupt record */ }
  }
}

async function snapshotVocalexLab(): Promise<SessionSyncRecord[] | null> {
  try {
    const sessions = await softTimeout(getAllSessions(), INDEXEDDB_SNAPSHOT_MS);
    if (!sessions) return null;
    if (sessions.length === 0) return null;
    const records: SessionSyncRecord[] = [];
    let totalSize = 0;
    for (const session of sessions) {
      try {
        const layers: LayerSyncRecord[] = [];
        let sessionBlobSize = 0;
        for (const layer of session.layers) {
          try {
            const audioB64 = await blobToBase64(layer.audioBlob);
            if (totalSize + sessionBlobSize + audioB64.length > VOCALEX_BUDGET) continue;
            sessionBlobSize += audioB64.length;
            const { audioBlob: _, ...rest } = layer;
            layers.push({ ...rest, audioB64 });
          } catch { /* skip unreadable layer */ }
        }
        if (layers.length > 0 || session.layers.length === 0) {
          totalSize += sessionBlobSize;
          const { layers: _, ...sessionRest } = session;
          records.push({ ...sessionRest, layers });
        }
      } catch { /* skip corrupt session */ }
    }
    return records.length > 0 ? records : null;
  } catch {
    return null;
  }
}

async function restoreVocalexLab(records: SessionSyncRecord[]): Promise<void> {
  for (const record of records) {
    try {
      const layers: LabLayer[] = record.layers.map((l) => {
        const { audioB64, ...rest } = l;
        return { ...rest, audioBlob: base64ToBlob(audioB64) };
      });
      await saveSession({ ...record, layers });
    } catch { /* skip corrupt record */ }
  }
}

// ── Local restore ────────────────────────────────────────────────────────────

function restoreChordex(raw: string) {
  try { localStorage.setItem(CHORDEX_LS_KEY, raw); } catch { /* noop */ }
  triggerStorageEvent(CHORDEX_LS_KEY);
}

function restoreDrumex(raw: string) {
  try { localStorage.setItem(DRUMEX_LS_KEY, raw); } catch { /* noop */ }
  triggerStorageEvent(DRUMEX_LS_KEY);
}

function restoreDrumexUI(raw: string) {
  try { localStorage.setItem(DRUMEX_UI_KEY, raw); } catch { /* noop */ }
  triggerStorageEvent(DRUMEX_UI_KEY);
}

function restoreStagex(snap: StagexSnapshot) {
  for (const k of STAGEX_KEYS) {
    const v = snap[k];
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch { /* noop */ }
  }
  if (stageIframe?.contentWindow) {
    try {
      stageIframe.contentWindow.postMessage(
        { type: 'sc-sync-restore', data: snap },
        window.location.origin,
      );
    } catch { /* noop */ }
  }
}

function triggerStorageEvent(key: string) {
  try {
    window.dispatchEvent(new CustomEvent('chordex:storage-rehydrate', { detail: { key } }));
  } catch { /* noop */ }
}

// ── Iframe registration (called by StageCorePanel) ──────────────────────────

export function registerStageIframe(iframe: HTMLIFrameElement | null) {
  stageIframe = iframe;
}

function handleStageMessage(data: unknown) {
  if (!data || typeof data !== 'object') return;
  const m = data as { type?: string; data?: StagexSnapshot };
  if (m.type === 'sc-sync-snapshot-result' && m.data) {
    const resolvers = stageSnapshotResolvers;
    stageSnapshotResolvers = [];
    for (const r of resolvers) r(m.data);
  } else if (m.type === 'sc-sync-local-changed') {
    requestFlush();
  }
}

// ── Push / pull a single app ────────────────────────────────────────────────

type CloudDoc = {
  kind?: string;
  body?: unknown;
  updatedAt?: Timestamp;
  deviceId?: string;
  schemaVersion?: number;
};

function cloudMs(v: CloudDoc | null | undefined): number {
  const ts = v?.updatedAt;
  if (ts && typeof ts.toMillis === 'function') {
    try { return ts.toMillis(); } catch { /* noop */ }
  }
  return 0;
}

async function applyCloudBody(app: SyncAppKey, body: unknown, meta: Meta, cloudUpdatedMs: number): Promise<boolean> {
  if (app === 'stagex' && body && typeof body === 'object' && !Array.isArray(body)) {
    restoreStagex(body as StagexSnapshot);
    meta[app] = { lastHash: hashString(JSON.stringify(body)), cloudUpdatedMs };
    return true;
  }
  if (app === 'vocalex-takes' && Array.isArray(body)) {
    await restoreVocalexTakes(body as TakeSyncRecord[]);
    meta[app] = { lastHash: hashString(JSON.stringify(body)), cloudUpdatedMs };
    return true;
  }
  if (app === 'vocalex-lab' && Array.isArray(body)) {
    await restoreVocalexLab(body as SessionSyncRecord[]);
    meta[app] = { lastHash: hashString(JSON.stringify(body)), cloudUpdatedMs };
    return true;
  }
  if (typeof body === 'string') {
    if (app === 'chordex')       restoreChordex(body);
    else if (app === 'drumex')   restoreDrumex(body);
    else if (app === 'drumexUI') restoreDrumexUI(body);
    else return false;
    meta[app] = { lastHash: hashString(body), cloudUpdatedMs };
    return true;
  }
  return false;
}

async function pushApp(
  app: SyncAppKey,
  raw: string | StagexSnapshot | unknown[],
  meta: Meta,
  signal: AbortSignal,
): Promise<{ pushed: boolean; pulled: boolean }> {
  const db = getFirebaseDb();
  if (!db || !currentUser) return { pushed: false, pulled: false };
  const ref = doc(db, 'users', currentUser.uid, 'state', app);
  const serialized = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const localHash = hashString(serialized);

  const snap = await withAbort(withTimeout(getDoc(ref), FIRESTORE_OP_MS, `getDoc:${app}`), signal, 'run');
  const v = snap.exists() ? (snap.data() as CloudDoc) : null;
  const cloudTs = cloudMs(v);
  const knownCloudTs = meta[app]?.cloudUpdatedMs ?? 0;

  // Cloud is newer — let cloud win (pull instead of push).
  // Bound the local restore: IndexedDB writes can wedge on Android
  // WebView mid-upgrade and we never want them to pin the spinner.
  if (v && cloudTs > knownCloudTs) {
    const applied = await softTimeout(
      applyCloudBody(app, v.body, meta, cloudTs),
      RESTORE_OP_MS,
    );
    if (applied) {
      writeMeta(meta);
      return { pushed: false, pulled: true };
    }
  }

  if (meta[app]?.lastHash === localHash) return { pushed: false, pulled: false };

  await withAbort(withTimeout(setDoc(ref, {
    kind: typeof raw === 'string' ? 'json' : Array.isArray(raw) ? 'array' : 'bundle',
    body: raw,
    updatedAt: serverTimestamp(),
    deviceId: deviceId(),
    schemaVersion: 1,
  }, { merge: false }), FIRESTORE_OP_MS, `setDoc:${app}`), signal, 'run');

  // Re-read to capture the server-assigned timestamp.
  const after = await withAbort(withTimeout(getDoc(ref), FIRESTORE_OP_MS, `getDoc:${app}:confirm`), signal, 'run');
  const afterTs = after.exists() ? cloudMs(after.data() as CloudDoc) : Date.now();
  meta[app] = { lastHash: localHash, cloudUpdatedMs: afterTs };
  writeMeta(meta);
  return { pushed: true, pulled: false };
}

async function pullApp(
  app: SyncAppKey,
  meta: Meta,
  signal: AbortSignal,
): Promise<{ pulled: boolean }> {
  const db = getFirebaseDb();
  if (!db || !currentUser) return { pulled: false };
  const ref = doc(db, 'users', currentUser.uid, 'state', app);
  const snap = await withAbort(withTimeout(getDoc(ref), FIRESTORE_OP_MS, `getDoc:${app}`), signal, 'run');
  if (!snap.exists()) return { pulled: false };
  const v = snap.data() as CloudDoc;
  const cloudTs = cloudMs(v);
  const knownCloudTs = meta[app]?.cloudUpdatedMs ?? 0;

  if (cloudTs > 0 && cloudTs <= knownCloudTs) return { pulled: false };

  const cloudHash = v.body == null
    ? ''
    : hashString(typeof v.body === 'string' ? v.body : JSON.stringify(v.body));
  if (cloudHash && cloudHash === meta[app]?.lastHash) {
    meta[app] = { lastHash: cloudHash, cloudUpdatedMs: cloudTs };
    writeMeta(meta);
    return { pulled: false };
  }

  const applied = await softTimeout(
    applyCloudBody(app, v.body, meta, cloudTs),
    RESTORE_OP_MS,
  );
  if (applied) writeMeta(meta);
  return { pulled: applied === true };
}

// ── The single run path ──────────────────────────────────────────────────────

const ALL_APPS: SyncAppKey[] = ['chordex', 'drumex', 'drumexUI', 'stagex', 'vocalex-takes', 'vocalex-lab'];

/**
 * Build the parallel work list for a push run. Skipping no-change
 * apps here keeps Firestore traffic minimal.
 */
async function collectPushWork(meta: Meta): Promise<Array<{ app: SyncAppKey; raw: string | StagexSnapshot | unknown[] }>> {
  const [chordex, drumex, drumexUI, stagex, vTakes, vLab] = await Promise.all([
    Promise.resolve(snapshotChordex()),
    Promise.resolve(snapshotDrumex()),
    Promise.resolve(snapshotDrumexUI()),
    snapshotStagex(),
    snapshotVocalexTakes(),
    snapshotVocalexLab(),
  ]);
  const work: Array<{ app: SyncAppKey; raw: string | StagexSnapshot | unknown[] }> = [];
  if (chordex  && hashString(chordex)                      !== meta.chordex?.lastHash)          work.push({ app: 'chordex',       raw: chordex });
  if (drumex   && hashString(drumex)                       !== meta.drumex?.lastHash)           work.push({ app: 'drumex',        raw: drumex });
  if (drumexUI && hashString(drumexUI)                     !== meta.drumexUI?.lastHash)         work.push({ app: 'drumexUI',      raw: drumexUI });
  if (stagex   && hashString(JSON.stringify(stagex))       !== meta.stagex?.lastHash)           work.push({ app: 'stagex',        raw: stagex });
  if (vTakes   && hashString(JSON.stringify(vTakes))       !== meta['vocalex-takes']?.lastHash) work.push({ app: 'vocalex-takes', raw: vTakes });
  if (vLab     && hashString(JSON.stringify(vLab))         !== meta['vocalex-lab']?.lastHash)   work.push({ app: 'vocalex-lab',   raw: vLab });
  return work;
}

/**
 * Execute a single sync run. Bounded by RUN_TIMEOUT_MS overall via an
 * AbortController; when the controller fires, every in-flight Firestore
 * op rejects with SyncTimeoutError and we transition to `error`.
 *
 * Apps run in PARALLEL via Promise.allSettled — one slow app can't
 * starve the others, and the worst case is a single FIRESTORE_OP_MS
 * window, not N × FIRESTORE_OP_MS like the old serial implementation.
 */
async function executeRun(reason: RunReason, mode: RunMode): Promise<void> {
  if (!currentUser) return;

  // Skip the noisy "syncing" flicker if there's literally nothing to do
  // on a push-only run. (For pull-then-push we always announce — the
  // user just signed in and deserves feedback that something happened.)
  const meta = readMeta();
  let work: Awaited<ReturnType<typeof collectPushWork>> = [];
  if (mode === 'push-only') {
    work = await collectPushWork(meta);
    if (work.length === 0) {
      // Nothing to push and we don't need to pull — bail without
      // touching `phase`. This keeps the indicator in `idle`/`success`
      // during periods of inactivity.
      return;
    }
  }

  const startedAt = Date.now();
  const startEpoch = epoch;
  const ctrl = new AbortController();
  const timeoutHandle = setTimeout(() => ctrl.abort(), RUN_TIMEOUT_MS);

  // Defer the visible "syncing" state. Most pushes complete in well under
  // 600ms (one getDoc + one setDoc on a warm connection), and flashing the
  // spinner for that brief window felt like the indicator was always
  // spinning. We only commit to `phase=syncing` if the run is still going
  // when the timer fires.
  //
  // The `runDone` flag is the safety net: even though `clearTimeout` in
  // `finally` cancels the pending callback in the common case, a callback
  // already dequeued from the macrotask queue can still execute after the
  // run completes. Checking `runDone` inside the timer guarantees we
  // never flip back to `syncing` after a `success`/`idle`/`error` setStatus.
  let syncingShown = false;
  let runDone = false;
  const showSyncingHandle = setTimeout(() => {
    if (runDone) return;
    if (epoch !== startEpoch) return;
    syncingShown = true;
    setStatus({ phase: 'syncing', error: null });
  }, SYNCING_DEBOUNCE_MS);
  logStart(reason, mode);

  let pushedCount = 0;
  let pulledCount = 0;
  let failure: unknown = null;

  try {
    if (mode === 'pull-then-push') {
      const pullResults = await Promise.allSettled(
        ALL_APPS.map((app) => pullApp(app, meta, ctrl.signal)),
      );
      for (const r of pullResults) {
        if (r.status === 'fulfilled' && r.value.pulled) pulledCount += 1;
        // Per-app failures are tolerated — the OVERALL run only fails
        // on AbortError or when EVERY single op blew up.
      }
      // Re-collect after pulling: a successful pull can change local state
      // and create new push work that the snapshot from before would miss.
      if (epoch !== startEpoch) throw new SyncTimeoutError('epoch-changed', 0);
      work = await collectPushWork(meta);
    }

    if (work.length > 0) {
      const pushResults = await Promise.allSettled(
        work.map((w) => pushApp(w.app, w.raw, meta, ctrl.signal)),
      );
      for (const r of pushResults) {
        if (r.status === 'fulfilled') {
          if (r.value.pushed) pushedCount += 1;
          if (r.value.pulled) pulledCount += 1;
        } else {
          // If ALL ops failed with abort/timeout, surface as error below.
          if (r.reason instanceof SyncTimeoutError) failure = r.reason;
        }
      }
      // If every op aborted, treat the whole run as failed.
      if (pushResults.length > 0 && pushResults.every((r) => r.status === 'rejected')) {
        const first = pushResults.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        failure = first?.reason ?? new Error('All push operations failed');
      }
    }

    if (epoch !== startEpoch) {
      // Auth changed mid-run — discard. Don't touch status; the
      // auth-change handler already reset it.
      logFailure(Date.now() - startedAt, new Error('aborted: auth changed'));
      return;
    }

    if (failure) throw failure;

    // Only flash the green "Synced" pop if we actually made the spinner
    // visible. Background runs that never showed `syncing` should slide
    // straight to `idle` with an updated `lastSyncedMs` — no UI flicker.
    if (syncingShown) {
      setStatus({ phase: 'success', lastSyncedMs: Date.now(), error: null });
      if (lingerTimer) clearTimeout(lingerTimer);
      lingerTimer = setTimeout(() => {
        lingerTimer = null;
        if (status.phase === 'success') setStatus({ phase: 'idle' });
      }, SUCCESS_LINGER_MS);
    } else {
      setStatus({ phase: 'idle', lastSyncedMs: Date.now(), error: null });
    }
    logSuccess(Date.now() - startedAt, pushedCount, pulledCount);
  } catch (e) {
    const isTimeout = e instanceof SyncTimeoutError;
    const durationMs = Date.now() - startedAt;
    if (isTimeout) logTimeout(e.op, e.ms || durationMs);
    else logFailure(durationMs, e);
    if (epoch === startEpoch) {
      setStatus({
        phase: 'error',
        error: isTimeout ? 'Sync timed out' : ((e as Error)?.message ?? 'Sync failed'),
      });
    }
  } finally {
    runDone = true;
    clearTimeout(timeoutHandle);
    clearTimeout(showSyncingHandle);
    // SAFETY NET — under no circumstances may we exit with the UI
    // stuck on `phase=syncing`. Without this guard, an unhandled throw
    // anywhere above (e.g. a corrupt CloudDoc body that escapes the
    // restore handlers) leaves the spinner rotating forever because
    // nothing else will ever advance the state machine.
    if (epoch === startEpoch && status.phase === 'syncing') {
      setStatus({ phase: 'idle', error: null });
    }
  }
}

/**
 * Public entry point for ANY caller that wants to trigger a sync.
 * Returns the in-flight promise if a run is already happening — so
 * concurrent callers all await the SAME work, rather than queuing
 * extra runs. If a caller arrives while a run is mid-flight, we set
 * `pendingFollowup` so exactly ONE follow-up run is scheduled when the
 * current one finishes.
 */
function enqueueRun(reason: RunReason, mode: RunMode = 'push-only'): Promise<void> {
  if (!currentUser) return Promise.resolve();
  if (runPromise) {
    pendingFollowup = true;
    return runPromise;
  }
  runPromise = executeRun(reason, mode).finally(() => {
    runPromise = null;
    if (pendingFollowup) {
      pendingFollowup = false;
      // Chain a single follow-up. Non-blocking.
      void enqueueRun('flush', 'push-only');
    }
  });
  return runPromise;
}

// ── Account deletion ────────────────────────────────────────────────────────

export async function deleteCloudData(): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !currentUser) return;
  for (const app of ALL_APPS) {
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'state', app));
    } catch { /* per-doc continue */ }
  }
  try { localStorage.removeItem(SYNC_META_KEY); } catch { /* noop */ }
}

// ── Public flush controls ───────────────────────────────────────────────────

let flushDebounce: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced "something changed locally — please push when quiet".
 * Multiple calls within `delayMs` collapse into a single trigger.
 */
export function requestFlush(delayMs = 1500): void {
  if (!currentUser) return;
  if (flushDebounce) clearTimeout(flushDebounce);
  flushDebounce = setTimeout(() => {
    flushDebounce = null;
    void enqueueRun('flush', 'push-only');
  }, delayMs);
}

/**
 * "Sync now" — bypass the debounce. If a run is already in flight,
 * await it (so the caller's spinner ends when the actual work ends).
 * If a previous run failed, this clears the error first so the user
 * sees the new run's outcome cleanly.
 */
export async function syncNow(): Promise<void> {
  if (flushDebounce) { clearTimeout(flushDebounce); flushDebounce = null; }
  if (status.phase === 'error') setStatus({ phase: 'idle', error: null });
  await enqueueRun('manual', 'push-only');
}

/**
 * Explicit retry after an error. Identical to syncNow() but logs the
 * intent distinctly so the user-facing Retry button is greppable.
 */
export async function retrySync(): Promise<void> {
  if (flushDebounce) { clearTimeout(flushDebounce); flushDebounce = null; }
  setStatus({ phase: 'idle', error: null });
  await enqueueRun('retry', 'push-only');
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

let attached = false;
// Keep references so detachSyncEngine can remove them. Without this,
// repeated attach/detach cycles (test harnesses, hot-reload, future
// multi-account flows) would accumulate window listeners.
let onMessage: ((e: MessageEvent) => void) | null = null;
let onVisibility: (() => void) | null = null;
let onBeforeUnload: (() => void) | null = null;

export function attachSyncEngine(): void {
  if (attached) return;
  attached = true;

  onMessage = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    handleStageMessage(e.data);
  };
  window.addEventListener('message', onMessage);

  unsubAuth = subscribeAuth((u) => {
    // Bumping the epoch makes any in-flight run discard its results —
    // we never want a write under a stale uid, and we never want a
    // pre-signin `pullAll` to land into a now-signed-out world.
    epoch += 1;
    currentUser = u;
    pendingFollowup = false;
    runPromise = null; // forget the lock; the in-flight run will see epoch shift and bail.

    if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }

    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }

    if (u) {
      setStatus({ signedIn: true, phase: 'idle', error: null });
      // Schedule the periodic tick FIRST so we're never blocked on the
      // initial pull. The first run is fire-and-forget.
      tickHandle = setInterval(() => { void enqueueRun('tick', 'push-only'); }, TICK_MS);
      void enqueueRun('initial', 'pull-then-push');
    } else {
      try { localStorage.removeItem(SYNC_META_KEY); } catch { /* noop */ }
      setStatus({ signedIn: false, phase: 'idle', error: null, lastSyncedMs: null });
    }
  });

  onVisibility = () => {
    if (document.visibilityState === 'hidden') void enqueueRun('visibility', 'push-only');
  };
  document.addEventListener('visibilitychange', onVisibility);

  onBeforeUnload = () => { void enqueueRun('beforeunload', 'push-only'); };
  window.addEventListener('beforeunload', onBeforeUnload);
}

export function detachSyncEngine(): void {
  if (!attached) return;
  attached = false;
  epoch += 1; // invalidate any in-flight run
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  if (unsubAuth) { unsubAuth(); unsubAuth = null; }
  if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
  if (flushDebounce) { clearTimeout(flushDebounce); flushDebounce = null; }
  if (onMessage) { window.removeEventListener('message', onMessage); onMessage = null; }
  if (onVisibility) { document.removeEventListener('visibilitychange', onVisibility); onVisibility = null; }
  if (onBeforeUnload) { window.removeEventListener('beforeunload', onBeforeUnload); onBeforeUnload = null; }
  pendingFollowup = false;
  runPromise = null;
  listeners = new Set();
}

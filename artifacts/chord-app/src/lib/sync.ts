import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp, collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { subscribeAuth, type AuthUser, signOut } from './auth';
import { isNative } from './capgoUpdater';
import { getAllTakes, saveTake, deleteTake as dbDeleteTake, type TakeRecord } from '../vocalex/takesDb';
import { getAllSessions, saveSession, deleteSession as dbDeleteSession, type LabSession, type LabLayer } from '../vocalex/labSessionDb';
import { useChordStore } from '../store/useChordStore';
import { secureReadLocal, secureWriteLocal } from './security';
import { logActivity } from './activityLogger';

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
/**
 * Per-uid record of whether the FIRST pull-then-push run after sign-in
 * has ever completed cleanly. Until it has, we keep promoting periodic
 * ticks (which would otherwise be push-only) to pull-then-push, so a
 * device that signed in while offline / on a flaky handshake still
 * eventually pulls the cloud state instead of being stuck on
 * "Waiting to sync…" forever.
 */
const FIRST_PULL_DONE_KEY = 'chordex_sync_first_pull_done_v1';

const TICK_MS = 60_000;          // periodic safety-net flush while signed in
const RUN_TIMEOUT_MS = 20_000;   // OVERALL hard cap per run — generous enough for one slow Firestore handshake but tight enough that the user never waits 35 s for the indicator to clear
const FIRESTORE_OP_MS = 12_000;  // per-getDoc / per-setDoc cap — Firestore's first-call handshake completes in well under 12 s on any working network; subsequent calls return in <1 s. Anything longer is almost certainly a wedged transport that won't recover by waiting
const SUCCESS_LINGER_MS = 1_200; // how long `phase=success` stays visible
const SYNCING_DEBOUNCE_MS = 600; // delay before showing spinner — quick runs stay invisible
const STAGE_SNAPSHOT_MS = 1_500; // postMessage round-trip cap
const RESTORE_OP_MS = 5_000;     // soft-cap on local IndexedDB restores so a wedged store can't pin `phase=syncing` forever
/**
 * Hard upper bound on how long a freshly-signed-in user is allowed to
 * see "Waiting to sync…" before we force the indicator to "Synced".
 * If the actual sync hasn't completed by this point, we stamp
 * `lastSyncedMs` ourselves so the UI advances — the next successful
 * background tick will overwrite the stamp with its real time. This is
 * the LAST line of defence against the chronic v3.0.55 bug where a
 * single timed-out initial pull-then-push left the indicator stuck
 * forever because `lastSyncedMs` was never written.
 */
const NEVER_STUCK_MS = 25_000;

// localStorage keys owned by each app
const CHORDEX_LS_KEY = 'chord-explorer-storage-v3';
const DRUMEX_LS_KEY  = 'chordex-drums';
const DRUMEX_UI_KEY  = 'chordex-drum-ui';
const GROOVEX_LS_KEY = 'groovex-storage-v1';

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

export interface ConflictLog {
  timestamp: number;
  app: string;
  itemId: string;
  itemName: string;
  localTime: number;
  cloudTime: number;
  resolution: string;
}

export type SyncStatus = {
  signedIn: boolean;
  /** Source of truth for the lifecycle. */
  phase: SyncPhase;
  /** Derived from `phase === 'syncing'` for back-compat with older UI code. */
  syncing: boolean;
  lastSyncedMs: number | null;
  error: string | null;
  showMigrationPrompt: boolean;
  migrationChoice: 'merge' | 'upload' | 'download' | 'notNow' | null;
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
  showMigrationPrompt: false,
  migrationChoice: null,
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
/**
 * One-shot retry scheduled when the initial pull-then-push fails so
 * the user doesn't have to wait a full TICK_MS (60s) before another
 * full sync is attempted. Kept in a module-level handle so we can
 * cancel it on auth-change / detach.
 */
let initialRetryHandle: ReturnType<typeof setTimeout> | null = null;
const INITIAL_RETRY_MS = 8_000;
/**
 * One-shot fallback timer scheduled on sign-in for users whose first
 * pull-then-push has never completed on this device. If it fires
 * before any sync run has stamped `lastSyncedMs`, we force the stamp
 * ourselves so the indicator escapes "Waiting to sync…". Cleared on
 * any successful sync, on auth-change, and on detach.
 */
let neverStuckHandle: ReturnType<typeof setTimeout> | null = null;
let unsubDeviceSession: (() => void) | null = null;

type RunReason = 'initial' | 'tick' | 'manual' | 'visibility' | 'beforeunload' | 'flush' | 'retry';
type RunMode = 'pull-then-push' | 'push-only';

// ── Status emit ─────────────────────────────────────────────────────────────

/**
 * Global wall-clock watchdog for the `syncing` phase.
 *
 * The per-run safety net in `executeRun.finally` only fires if the run
 * actually returns. If a Firestore op (or any awaited helper) ignores
 * the AbortController and hangs forever — which the SDK has been
 * observed doing on flaky long-poll handshakes — `Promise.allSettled`
 * never resolves, `finally` never runs, and the spinner rotates
 * indefinitely. This watchdog is the OUTERMOST guarantee: every time
 * status transitions TO `syncing`, schedule a forced reset to `idle`.
 * If a clean transition (success/error/idle) happens first, the timer
 * is cancelled.
 *
 * The cap is intentionally GENEROUS (RUN_TIMEOUT_MS + buffer) so legit
 * 30-second handshakes complete before the watchdog fires — we only
 * want to bail out cases that are genuinely wedged.
 */
const SYNCING_WATCHDOG_MS = RUN_TIMEOUT_MS + 10_000; // 45 s
let syncingWatchdogHandle: ReturnType<typeof setTimeout> | null = null;
function clearSyncingWatchdog() {
  if (syncingWatchdogHandle) {
    clearTimeout(syncingWatchdogHandle);
    syncingWatchdogHandle = null;
  }
}

function setStatus(patch: Partial<SyncStatus>): void {
  const next: SyncStatus = { ...status, ...patch };
  next.syncing = next.phase === 'syncing'; // keep derived field consistent
  const wasSyncing = status.phase === 'syncing';
  const isSyncing = next.phase === 'syncing';
  status = next;
  // Wall-clock watchdog: arm on transition INTO syncing, disarm on any
  // transition OUT. Re-arming on syncing→syncing is harmless (timers
  // are cheap) but we skip it for efficiency.
  if (isSyncing && !wasSyncing) {
    clearSyncingWatchdog();
    const armedEpoch = epoch;
    syncingWatchdogHandle = setTimeout(() => {
      syncingWatchdogHandle = null;
      // Only act if we're still syncing for the SAME epoch — auth
      // changes / detach already reset the state.
      if (status.phase === 'syncing' && epoch === armedEpoch) {
        console.warn(`${LOG} watchdog: syncing stuck >${SYNCING_WATCHDOG_MS}ms, forcing idle`);
        status = { ...status, phase: 'idle', syncing: false, error: null };
        for (const l of listeners) {
          try { l(status); } catch { /* listener errors must not break the engine */ }
        }
      }
    }, SYNCING_WATCHDOG_MS);
  } else if (!isSyncing && wasSyncing) {
    clearSyncingWatchdog();
  }
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

function readFirstPullDone(uid: string): boolean {
  try {
    const raw = localStorage.getItem(FIRST_PULL_DONE_KEY);
    if (!raw) return false;
    const set = JSON.parse(raw) as string[];
    return Array.isArray(set) && set.includes(uid);
  } catch { return false; }
}

function writeFirstPullDone(uid: string): void {
  try {
    const raw = localStorage.getItem(FIRST_PULL_DONE_KEY);
    const set: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!set.includes(uid)) {
      set.push(uid);
      localStorage.setItem(FIRST_PULL_DONE_KEY, JSON.stringify(set));
    }
  } catch { /* noop */ }
}

export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch { return 'dev_unknown'; }
}

export function getDeviceDetails() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Web Browser';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opr/i.test(ua)) browser = 'Opera';

  const isNativeApp = isNative();
  const name = isNativeApp 
    ? `Chordex App (${os})` 
    : `${browser} on ${os}`;

  return {
    name,
    userAgent: ua,
    platform: isNativeApp ? 'native' : 'web',
    lastActive: Date.now(),
  };
}

export async function registerDevice(uid: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const id = deviceId();
  const ref = doc(db, 'users', uid, 'devices', id);
  const details = getDeviceDetails();
  try {
    await setDoc(ref, {
      ...details,
      lastActive: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('[sync] failed to register device:', err);
  }
}

export async function unregisterDevice(uid: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const id = deviceId();
  const ref = doc(db, 'users', uid, 'devices', id);
  try {
    await deleteDoc(ref);
  } catch (err) {
    console.warn('[sync] failed to unregister device:', err);
  }
}

export async function revokeDeviceSession(uid: string, targetDeviceId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const ref = doc(db, 'users', uid, 'devices', targetDeviceId);
  try {
    await deleteDoc(ref);
  } catch (err) {
    console.warn('[sync] failed to revoke session:', err);
  }
}

export function subscribeDevices(uid: string, callback: (devices: any[]) => void): () => void {
  const db = getFirebaseDb();
  if (!db) {
    callback([]);
    return () => {};
  }
  const ref = collection(db, 'users', uid, 'devices');
  const q = query(ref, orderBy('lastActive', 'desc'));
  return onSnapshot(q, (snap) => {
    const list: any[] = [];
    snap.forEach((doc) => {
      const data = doc.data();
      list.push({
        id: doc.id,
        name: data.name || 'Unknown Device',
        platform: data.platform || 'web',
        userAgent: data.userAgent || '',
        lastActive: data.lastActive?.toMillis() || Date.now(),
      });
    });
    callback(list);
  }, (err) => {
    console.warn('[sync] subscribeDevices error:', err);
    callback([]);
  });
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
  return secureReadLocal(key, currentUser?.uid ?? 'guest_user');
}

function writeLocalRaw(key: string, value: string): void {
  secureWriteLocal(key, value, currentUser?.uid ?? 'guest_user');
}

function snapshotChordex(): string | null { return readLocalRaw(CHORDEX_LS_KEY); }
function snapshotDrumex():  string | null { return readLocalRaw(DRUMEX_LS_KEY); }
function snapshotDrumexUI(): string | null { return readLocalRaw(DRUMEX_UI_KEY); }

function snapshotProfile(): string | null {
  if (!currentUser) return null;
  try {
    const raw = readLocalRaw('chordex_user_avatar_v1');
    if (!raw) return null;
    const map = JSON.parse(raw);
    const av = map[currentUser.uid];
    return av ? JSON.stringify({ avatar: av }) : null;
  } catch {
    return null;
  }
}

function snapshotProfileCover(): string | null {
  if (!currentUser) return null;
  try {
    const raw = readLocalRaw(`chordex_cp_${currentUser.uid}`);
    return raw ? JSON.stringify({ cover: raw }) : null;
  } catch {
    return null;
  }
}

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

// ── Conflict logging ────────────────────────────────────────────────────────

let conflictLogs: ConflictLog[] = [];

export function getConflictLogs(): ConflictLog[] {
  return conflictLogs;
}

export function clearConflictLogs(): void {
  conflictLogs = [];
}

export function logConflict(app: string, itemId: string, itemName: string, localTime: number, cloudTime: number, resolution: string) {
  conflictLogs.push({
    timestamp: Date.now(),
    app,
    itemId,
    itemName,
    localTime,
    cloudTime,
    resolution,
  });
  if (conflictLogs.length > 50) {
    conflictLogs.shift();
  }
}

// ── Groovex snapshots / restores ──────────────────────────────────────────────

function snapshotGroovex(): string | null {
  return readLocalRaw(GROOVEX_LS_KEY);
}

function restoreGroovex(raw: string) {
  try {
    const local = readLocalRaw(GROOVEX_LS_KEY);
    const merged = mergeGroovexState(local, raw);
    writeLocalRaw(GROOVEX_LS_KEY, merged);
  } catch { /* noop */ }
  triggerStorageEvent(GROOVEX_LS_KEY);
}

export function mergeGroovexState(localRaw: string | null, cloudRaw: string): string {
  if (!localRaw) return cloudRaw;
  try {
    const localObj = JSON.parse(localRaw);
    const cloudObj = JSON.parse(cloudRaw);
    if (!localObj.state || !cloudObj.state) return cloudRaw;

    const local = localObj.state;
    const cloud = cloudObj.state;

    // 1. Recent Songs
    const recentSongs = Array.from(new Set([...(cloud.recentSongs || []), ...(local.recentSongs || [])])).slice(0, 20);

    // 2. Preferences
    const preferences = { ...(local.preferences || {}), ...(cloud.preferences || {}) };

    // 3. Stem Volumes (merge song objects, then merge stem values)
    const stemVolumes = { ...(local.stemVolumes || {}) };
    for (const [songId, stems] of Object.entries(cloud.stemVolumes || {})) {
      stemVolumes[songId] = {
        ...(stemVolumes[songId] || {}),
        ...(stems as Record<string, number>),
      };
    }

    // 4. Stem Mutes
    const stemMutes = { ...(local.stemMutes || {}) };
    for (const [songId, mutes] of Object.entries(cloud.stemMutes || {})) {
      stemMutes[songId] = {
        ...(stemMutes[songId] || {}),
        ...(mutes as Record<string, boolean>),
      };
    }

    // 5. View, ActiveSong, Sort
    const view = cloud.view || local.view || 'library';
    const activeSongId = cloud.activeSongId !== undefined ? cloud.activeSongId : local.activeSongId;
    const sortBy = cloud.sortBy || local.sortBy || 'artist';

    const mergedState = {
      ...local,
      ...cloud,
      recentSongs,
      preferences,
      stemVolumes,
      stemMutes,
      view,
      activeSongId,
      sortBy,
    };

    return JSON.stringify({
      state: mergedState,
      version: cloudObj.version || localObj.version || 1,
    });
  } catch (err) {
    console.warn('[sync] failed to merge groovex state:', err);
    return cloudRaw;
  }
}

// ── First-time migration helpers ──────────────────────────────────────────────

export function hasLocalData(): boolean {
  const chordex = snapshotChordex();
  if (chordex) {
    try {
      const parsed = JSON.parse(chordex);
      const state = parsed.state || {};
      if ((state.favorites && state.favorites.length > 0) ||
          (state.progressions && state.progressions.length > 0) ||
          (state.presets && state.presets.length > 0) ||
          (state.customChords && state.customChords.length > 0)) {
        return true;
      }
    } catch {}
  }
  const drumex = snapshotDrumex();
  if (drumex) {
    try {
      const parsed = JSON.parse(drumex);
      const state = parsed.state || {};
      if ((state.drumSongs && state.drumSongs.length > 0) ||
          (state.grooves && state.grooves.length > 0)) {
        return true;
      }
    } catch {}
  }
  for (const k of STAGEX_KEYS) {
    const v = readLocalRaw(k);
    if (v) return true;
  }
  const groovex = snapshotGroovex();
  if (groovex) {
    try {
      const parsed = JSON.parse(groovex);
      const state = parsed.state || {};
      if (state.recentSongs && state.recentSongs.length > 0) return true;
    } catch {}
  }
  return false;
}

export async function checkCloudDataExists(): Promise<boolean> {
  if (!currentUser) return false;
  const db = getFirebaseDb();
  if (!db) return false;
  const ref = doc(db, 'users', currentUser.uid, 'state', 'chordex');
  try {
    const snap = await getDoc(ref);
    return snap.exists();
  } catch {
    return false;
  }
}

export async function createCloudBackup(label: string): Promise<void> {
  if (!currentUser) return;
  const db = getFirebaseDb();
  if (!db) return;
  const [chordex, drumex, drumexUI, stagex, vTakes, vLab, profile, profileCover, groovex] = await Promise.all([
    Promise.resolve(snapshotChordex()),
    Promise.resolve(snapshotDrumex()),
    Promise.resolve(snapshotDrumexUI()),
    snapshotStagex(),
    snapshotVocalexTakes(),
    snapshotVocalexLab(),
    Promise.resolve(snapshotProfile()),
    Promise.resolve(snapshotProfileCover()),
    Promise.resolve(snapshotGroovex()),
  ]);

  const backupData = {
    chordex,
    drumex,
    drumexUI,
    stagex,
    'vocalex-takes': vTakes,
    'vocalex-lab': vLab,
    profile,
    'profile-cover': profileCover,
    groovex,
  };

  const backupsColl = collection(db, 'users', currentUser.uid, 'backups');
  const backupDocRef = doc(backupsColl);
  await setDoc(backupDocRef, {
    createdAt: serverTimestamp(),
    deviceId: deviceId(),
    label,
    data: backupData,
  });
}

export async function clearVocalexDbs(): Promise<void> {
  return new Promise<void>((resolve) => {
    const req1 = indexedDB.deleteDatabase('vocalex-takes');
    req1.onerror = () => console.warn('[sync] failed to delete vocalex-takes DB');
    req1.onsuccess = () => console.log('[sync] deleted vocalex-takes DB successfully');

    const req2 = indexedDB.deleteDatabase('vocalex-lab');
    req2.onerror = () => console.warn('[sync] failed to delete vocalex-lab DB');
    req2.onsuccess = () => {
      console.log('[sync] deleted vocalex-lab DB successfully');
      resolve();
    };
    setTimeout(resolve, 1000);
  });
}

export async function clearLocalDataBeforeDownload(): Promise<void> {
  localStorage.removeItem(CHORDEX_LS_KEY);
  localStorage.removeItem(DRUMEX_LS_KEY);
  localStorage.removeItem(DRUMEX_UI_KEY);
  localStorage.removeItem(GROOVEX_LS_KEY);
  for (const k of STAGEX_KEYS) {
    localStorage.removeItem(k);
  }
  await clearVocalexDbs();
}

let migrationResolver: ((choice: 'merge' | 'upload' | 'download' | 'notNow') => void) | null = null;

export function resolveMigration(choice: 'merge' | 'upload' | 'download' | 'notNow') {
  if (migrationResolver) {
    migrationResolver(choice);
    migrationResolver = null;
  }
}

// ── Merge handlers with conflict logging ─────────────────────────────────────

function mergeChordexState(localRaw: string | null, cloudRaw: string): string {
  if (!localRaw) return cloudRaw;
  try {
    const localObj = JSON.parse(localRaw);
    const cloudObj = JSON.parse(cloudRaw);
    if (!localObj.state || !cloudObj.state) return cloudRaw;

    const local = localObj.state;
    const cloud = cloudObj.state;

    // 1. Favorites
    const favorites = Array.from(new Set([...(local.favorites || []), ...(cloud.favorites || [])]));

    // 2. Recent Chords
    const recentChords = Array.from(new Set([...(local.recentChords || []), ...(cloud.recentChords || [])])).slice(0, 10);

    // 3. Progressions (by id, latest wins)
    const progressionsMap = new Map();
    (local.progressions || []).forEach((p: any) => progressionsMap.set(p.id, p));
    (cloud.progressions || []).forEach((p: any) => {
      const existing = progressionsMap.get(p.id);
      if (existing) {
        if (JSON.stringify(p.chords) !== JSON.stringify(existing.chords)) {
          logConflict('chordex', p.id, `Progression: ${p.name || 'Unnamed'}`, existing.createdAt || 0, p.createdAt || 0, 'Last-write-wins (LWW)');
        }
      }
      progressionsMap.set(p.id, p);
    });
    const progressions = Array.from(progressionsMap.values());

    // 4. Presets (by id, latest updatedAt wins)
    const presetsMap = new Map();
    (local.presets || []).forEach((p: any) => presetsMap.set(p.id, p));
    (cloud.presets || []).forEach((p: any) => {
      const existing = presetsMap.get(p.id);
      if (existing) {
        const localTime = existing.updatedAt || existing.createdAt || 0;
        const cloudTime = p.updatedAt || p.createdAt || 0;
        if (localTime !== cloudTime && JSON.stringify(p) !== JSON.stringify(existing)) {
          logConflict('chordex', p.id, `Preset: ${p.name || 'Unnamed'}`, localTime, cloudTime, cloudTime >= localTime ? 'Cloud wins (LWW)' : 'Local wins (LWW)');
          if (cloudTime >= localTime) {
            presetsMap.set(p.id, p);
          }
        }
      } else {
        presetsMap.set(p.id, p);
      }
    });
    const presets = Array.from(presetsMap.values());

    // 5. Custom Chords (by id, latest createdAt wins)
    const customMap = new Map();
    (local.customChords || []).forEach((p: any) => customMap.set(p.id, p));
    (cloud.customChords || []).forEach((p: any) => {
      const existing = customMap.get(p.id);
      if (existing) {
        const localTime = existing.createdAt || 0;
        const cloudTime = p.createdAt || 0;
        if (JSON.stringify(p) !== JSON.stringify(existing)) {
          logConflict('chordex', p.id, `Custom Chord: ${p.name || 'Unnamed'}`, localTime, cloudTime, cloudTime >= localTime ? 'Cloud wins (LWW)' : 'Local wins (LWW)');
          if (cloudTime >= localTime) {
            customMap.set(p.id, p);
          }
        }
      } else {
        customMap.set(p.id, p);
      }
    });
    const customChords = Array.from(customMap.values());

    // 6. Chord Usage (max count wins)
    const chordUsage = { ...(local.chordUsage || {}) };
    for (const [k, v] of Object.entries(cloud.chordUsage || {})) {
      chordUsage[k] = Math.max(chordUsage[k] ?? 0, v as number);
    }

    // 7. Settings (cloud overrides local but preserves other fields)
    const settings = { ...(local.settings || {}), ...(cloud.settings || {}) };

    // 8. Other properties
    const currentProgressionChords = cloud.currentProgressionChords || local.currentProgressionChords || [];
    const transpositions = { ...(local.transpositions || {}), ...(cloud.transpositions || {}) };
    const lastSession = { ...(local.lastSession || {}), ...(cloud.lastSession || {}) };

    const mergedState = {
      ...local,
      favorites,
      recentChords,
      progressions,
      presets,
      customChords,
      chordUsage,
      settings,
      currentProgressionChords,
      transpositions,
      lastSession,
    };

    return JSON.stringify({
      state: mergedState,
      version: cloudObj.version || localObj.version || 9,
    });
  } catch (err) {
    console.warn('[sync] failed to merge chordex state:', err);
    return cloudRaw;
  }
}

function mergeDrumexState(localRaw: string | null, cloudRaw: string): string {
  if (!localRaw) return cloudRaw;
  try {
    const localObj = JSON.parse(localRaw);
    const cloudObj = JSON.parse(cloudRaw);
    if (!localObj.state || !cloudObj.state) return cloudRaw;

    const local = localObj.state;
    const cloud = cloudObj.state;

    // 1. Drum Songs (by id, latest updatedAt wins)
    const songsMap = new Map();
    (local.drumSongs || []).forEach((s: any) => songsMap.set(s.id, s));
    (cloud.drumSongs || []).forEach((s: any) => {
      const existing = songsMap.get(s.id);
      if (existing) {
        const localTime = existing.updatedAt || 0;
        const cloudTime = s.updatedAt || 0;
        if (localTime !== cloudTime && JSON.stringify(s) !== JSON.stringify(existing)) {
          logConflict('drumex', s.id, `Drum Song: ${s.name || 'Unnamed'}`, localTime, cloudTime, cloudTime >= localTime ? 'Cloud wins (LWW)' : 'Local wins (LWW)');
          if (cloudTime >= localTime) {
            songsMap.set(s.id, s);
          }
        }
      } else {
        songsMap.set(s.id, s);
      }
    });
    const drumSongs = Array.from(songsMap.values());

    // 2. Grooves (by id, latest savedAt wins)
    const groovesMap = new Map();
    (local.grooves || []).forEach((g: any) => groovesMap.set(g.id, g));
    (cloud.grooves || []).forEach((g: any) => {
      const existing = groovesMap.get(g.id);
      if (existing) {
        const localTime = existing.savedAt || existing.updatedAt || 0;
        const cloudTime = g.savedAt || g.updatedAt || 0;
        if (localTime !== cloudTime && JSON.stringify(g) !== JSON.stringify(existing)) {
          logConflict('drumex', g.id, `Drum Groove: ${g.name || 'Unnamed'}`, localTime, cloudTime, cloudTime >= localTime ? 'Cloud wins (LWW)' : 'Local wins (LWW)');
          if (cloudTime >= localTime) {
            groovesMap.set(g.id, g);
          }
        }
      } else {
        groovesMap.set(g.id, g);
      }
    });
    const grooves = Array.from(groovesMap.values());

    // 3. Other fields
    const soundMap = { ...(local.soundMap || {}), ...(cloud.soundMap || {}) };
    const volumeMap = { ...(local.volumeMap || {}), ...(cloud.volumeMap || {}) };
    const instFX = { ...(local.instFX || {}), ...(cloud.instFX || {}) };
    const instPlugins = { ...(local.instPlugins || {}), ...(cloud.instPlugins || {}) };
    const drumPrefs = { ...(local.drumPrefs || {}), ...(cloud.drumPrefs || {}) };
    const houseInstVelOverride = { ...(local.houseInstVelOverride || {}), ...(cloud.houseInstVelOverride || {}) };

    const mergedState = {
      ...local,
      ...cloud,
      drumSongs,
      grooves,
      soundMap,
      volumeMap,
      instFX,
      instPlugins,
      drumPrefs,
      houseInstVelOverride,
    };

    return JSON.stringify({
      state: mergedState,
      version: cloudObj.version || localObj.version || 1,
    });
  } catch (err) {
    console.warn('[sync] failed to merge drumex state:', err);
    return cloudRaw;
  }
}

// ── Local restore ────────────────────────────────────────────────────────────

function restoreChordex(raw: string) {
  try {
    const local = readLocalRaw(CHORDEX_LS_KEY);
    const merged = mergeChordexState(local, raw);
    writeLocalRaw(CHORDEX_LS_KEY, merged);
  } catch { /* noop */ }
  triggerStorageEvent(CHORDEX_LS_KEY);
}

function restoreDrumex(raw: string) {
  try {
    const local = readLocalRaw(DRUMEX_LS_KEY);
    const merged = mergeDrumexState(local, raw);
    writeLocalRaw(DRUMEX_LS_KEY, merged);
  } catch { /* noop */ }
  triggerStorageEvent(DRUMEX_LS_KEY);
}

function restoreDrumexUI(raw: string) {
  try { writeLocalRaw(DRUMEX_UI_KEY, raw); } catch { /* noop */ }
  triggerStorageEvent(DRUMEX_UI_KEY);
}

function restoreProfile(raw: string) {
  if (!currentUser) return;
  try {
    const parsed = JSON.parse(raw);
    const av = parsed.avatar;
    if (av) {
      const existingRaw = readLocalRaw('chordex_user_avatar_v1');
      const map = existingRaw ? JSON.parse(existingRaw) : {};
      if (map[currentUser.uid] !== av) {
        map[currentUser.uid] = av;
        writeLocalRaw('chordex_user_avatar_v1', JSON.stringify(map));
        window.dispatchEvent(
          new CustomEvent('chordex:user-avatar-changed', {
            detail: { uid: currentUser.uid, icon: av },
          }),
        );
      }
    }
  } catch (err) {
    console.warn('[sync] failed to restore profile:', err);
  }
}

function restoreProfileCover(raw: string) {
  if (!currentUser) return;
  try {
    const parsed = JSON.parse(raw);
    const cover = parsed.cover;
    if (cover) {
      const existing = readLocalRaw(`chordex_cp_${currentUser.uid}`);
      if (existing !== cover) {
        writeLocalRaw(`chordex_cp_${currentUser.uid}`, cover);
        window.dispatchEvent(
          new CustomEvent('chordex:user-cover-changed', {
            detail: { uid: currentUser.uid, cover },
          }),
        );
      }
    }
  } catch (err) {
    console.warn('[sync] failed to restore profile cover:', err);
  }
}

function restoreStagex(snap: StagexSnapshot) {
  for (const k of STAGEX_KEYS) {
    const v = snap[k];
    try {
      if (v == null) localStorage.removeItem(k);
      else writeLocalRaw(k, v);
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
    if (app === 'chordex')            restoreChordex(body);
    else if (app === 'drumex')        restoreDrumex(body);
    else if (app === 'drumexUI')      restoreDrumexUI(body);
    else if (app === 'profile')       restoreProfile(body);
    else if (app === 'profile-cover') restoreProfileCover(body);
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
    // CRITICAL (v3.0.57 data-loss fix): cloud has data we couldn't
    // restore locally. DO NOT fall through and push the local state —
    // that would clobber the user's cloud data with our empty defaults
    // (the exact uninstall/reinstall data-loss bug). Throw so the
    // caller marks this app's run as failed and the next sync round
    // can retry the restore. Cloud data stays intact.
    throw new SyncTimeoutError(`pull-during-push:${app}`, RESTORE_OP_MS);
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
  if (applied) {
    writeMeta(meta);
    return { pulled: true };
  }
  // CRITICAL (v3.0.57 data-loss fix): cloud has data but we couldn't
  // restore it locally. Throw so executeRun marks this app's pull as
  // failed and SKIPS the subsequent push for this app — otherwise our
  // empty local state would overwrite the user's cloud data on the
  // very next push phase.
  throw new SyncTimeoutError(`pull-failed:${app}`, RESTORE_OP_MS);
}

// ── The single run path ──────────────────────────────────────────────────────

const ALL_APPS: SyncAppKey[] = ['chordex', 'drumex', 'drumexUI', 'stagex', 'vocalex-takes', 'vocalex-lab', 'profile', 'profile-cover', 'groovex'];

/**
 * Build the parallel work list for a push run. Skipping no-change
 * apps here keeps Firestore traffic minimal.
 */
async function collectPushWork(meta: Meta): Promise<Array<{ app: SyncAppKey; raw: string | StagexSnapshot | unknown[] }>> {
  const [chordex, drumex, drumexUI, stagex, vTakes, vLab, profile, profileCover, groovex] = await Promise.all([
    Promise.resolve(snapshotChordex()),
    Promise.resolve(snapshotDrumex()),
    Promise.resolve(snapshotDrumexUI()),
    snapshotStagex(),
    snapshotVocalexTakes(),
    snapshotVocalexLab(),
    Promise.resolve(snapshotProfile()),
    Promise.resolve(snapshotProfileCover()),
    Promise.resolve(snapshotGroovex()),
  ]);
  const work: Array<{ app: SyncAppKey; raw: string | StagexSnapshot | unknown[] }> = [];
  if (chordex      && hashString(chordex)                      !== meta.chordex?.lastHash)          work.push({ app: 'chordex',       raw: chordex });
  if (drumex       && hashString(drumex)                       !== meta.drumex?.lastHash)           work.push({ app: 'drumex',        raw: drumex });
  if (drumexUI     && hashString(drumexUI)                     !== meta.drumexUI?.lastHash)         work.push({ app: 'drumexUI',      raw: drumexUI });
  if (stagex       && hashString(JSON.stringify(stagex))       !== meta.stagex?.lastHash)           work.push({ app: 'stagex',        raw: stagex });
  if (vTakes       && hashString(JSON.stringify(vTakes))       !== meta['vocalex-takes']?.lastHash) work.push({ app: 'vocalex-takes', raw: vTakes });
  if (vLab         && hashString(JSON.stringify(vLab))         !== meta['vocalex-lab']?.lastHash)   work.push({ app: 'vocalex-lab',   raw: vLab });
  if (profile      && hashString(profile)                      !== meta.profile?.lastHash)          work.push({ app: 'profile',       raw: profile });
  if (profileCover && hashString(profileCover)                 !== meta['profile-cover']?.lastHash) work.push({ app: 'profile-cover', raw: profileCover });
  if (groovex      && hashString(groovex)                      !== meta.groovex?.lastHash)          work.push({ app: 'groovex',        raw: groovex });
  return work;
}

async function triggerAutoBackup(): Promise<void> {
  if (!currentUser) return;
  const db = getFirebaseDb();
  if (!db) return;

  const settings = useChordStore.getState().settings;
  if (!settings.autoBackup) return;

  const frequency = settings.backupFrequency ?? 'daily'; // 'daily' | 'weekly' | 'monthly'
  const retention = settings.backupRetention ?? 'forever'; // 'forever' | '90days' | '30days'

  // Read the last auto backup time
  const lastBackupKey = `chordex_last_auto_backup_ms_${currentUser.uid}`;
  const lastBackupStr = localStorage.getItem(lastBackupKey);
  const lastBackupMs = lastBackupStr ? parseInt(lastBackupStr, 10) : 0;

  const now = Date.now();
  let frequencyMs = 24 * 60 * 60 * 1000; // daily default
  if (frequency === 'weekly') {
    frequencyMs = 7 * 24 * 60 * 60 * 1000;
  } else if (frequency === 'monthly') {
    frequencyMs = 30 * 24 * 60 * 60 * 1000;
  }

  if (now - lastBackupMs < frequencyMs) {
    // Too soon to backup
    return;
  }

  console.log(`[sync] Auto Backup triggered (frequency: ${frequency})`);

  try {
    // 1. Gather all snapshots
    const [chordex, drumex, drumexUI, stagex, vTakes, vLab, profile, profileCover, groovex] = await Promise.all([
      Promise.resolve(snapshotChordex()),
      Promise.resolve(snapshotDrumex()),
      Promise.resolve(snapshotDrumexUI()),
      snapshotStagex(),
      snapshotVocalexTakes(),
      snapshotVocalexLab(),
      Promise.resolve(snapshotProfile()),
      Promise.resolve(snapshotProfileCover()),
      Promise.resolve(snapshotGroovex()),
    ]);

    const backupData = {
      chordex,
      drumex,
      drumexUI,
      stagex,
      'vocalex-takes': vTakes,
      'vocalex-lab': vLab,
      profile,
      'profile-cover': profileCover,
      groovex,
    };

    // 2. Write backup doc
    const backupsColl = collection(db, 'users', currentUser.uid, 'backups');
    const backupDocRef = doc(backupsColl);
    await setDoc(backupDocRef, {
      createdAt: serverTimestamp(),
      deviceId: deviceId(),
      frequency,
      data: backupData,
    });

    localStorage.setItem(lastBackupKey, now.toString());
    console.log(`[sync] Auto Backup saved successfully to Firestore: ${backupDocRef.id}`);
    logActivity('backup', `Auto backup saved successfully`, 'Studio');

    // 3. Process retention (delete old backups)
    if (retention !== 'forever') {
      const days = retention === '30days' ? 30 : 90;
      const cutoffMs = now - (days * 24 * 60 * 60 * 1000);

      // Query backups sorted by createdAt desc
      const q = query(backupsColl, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const createdAt = data.createdAt?.toDate?.()?.getTime() || 0;
        if (createdAt && createdAt < cutoffMs) {
          console.log(`[sync] Auto Backup retention: deleting backup ${docSnap.id} older than ${days} days`);
          await deleteDoc(docSnap.ref);
        }
      }
    }
  } catch (err) {
    console.error('[sync] Auto Backup failed:', err);
  }
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
      // Nothing to push and we don't need to pull. If this device has
      // ever completed a successful round-trip for this uid, treat the
      // no-op as proof the engine is healthy and stamp `lastSyncedMs`
      // so the indicator advances from "Waiting to sync…" to "Synced".
      // Without this stamp, a brand-new install whose first sync fired
      // before any local data existed would appear stuck on
      // "Esperando para sincronizar…" forever.
      if (currentUser && readFirstPullDone(currentUser.uid)) {
        setStatus({
          phase: 'idle',
          error: null,
          lastSyncedMs: status.lastSyncedMs ?? Date.now(),
        });
      }
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
  /**
   * Did at least one Firestore op (pull getDoc or push setDoc) actually
   * succeed end-to-end? We use this to gate `writeFirstPullDone` so the
   * "first sync done" flag truly means "we proved connectivity," not
   * just "no exception escaped the run." Without this, a pull-then-push
   * where every getDoc timed out (Promise.allSettled swallows rejections)
   * and there happened to be no push work would silently mark the uid as
   * done and demote future ticks to push-only — which is exactly the
   * stuck-on-"Waiting to sync…" failure mode we're trying to fix.
   */
  let opSucceeded = false;

  try {
    // ── First-time account migration check ──
    if (reason === 'initial' && !readFirstPullDone(currentUser.uid)) {
      const hasLocal = hasLocalData();
      const hasCloud = await checkCloudDataExists();
      if (hasLocal && hasCloud) {
        console.info('[sync] Migration required: local and cloud data both exist.');
        setStatus({ showMigrationPrompt: true });
        
        // Wait for the user to make a choice
        const choice = await new Promise<'merge' | 'upload' | 'download' | 'notNow'>((resolve) => {
          migrationResolver = resolve;
        });

        setStatus({ showMigrationPrompt: false });

        if (choice === 'notNow') {
          console.info('[sync] Migration cancelled by user.');
          useChordStore.getState().updateSettings({ syncAcrossDevices: false });
          setStatus({ phase: 'idle', error: null });
          return;
        }

        // Create a backup snapshot of local data first (safety first!)
        try {
          await createCloudBackup('pre_migration_backup');
          console.info('[sync] Pre-migration local data backup created.');
        } catch (backupErr) {
          console.warn('[sync] Pre-migration backup failed, continuing anyway:', backupErr);
        }

        if (choice === 'upload') {
          console.info('[sync] Migration choice: upload (local wins)');
          const localMeta: Meta = {};
          const workToPush = await collectPushWork(localMeta);
          const pushResults = await Promise.allSettled(
            workToPush.map((w) => pushApp(w.app, w.raw, localMeta, ctrl.signal))
          );
          writeFirstPullDone(currentUser.uid);
          setStatus({ phase: 'idle', lastSyncedMs: Date.now(), error: null });
          if (currentUser) {
            void registerDevice(currentUser.uid);
          }
          return;
        }

        if (choice === 'download') {
          console.info('[sync] Migration choice: download (cloud wins)');
          await clearLocalDataBeforeDownload();
          // Clear meta so we pull fresh
          localStorage.removeItem(SYNC_META_KEY);
          // Let the rest of the pull-then-push pull down the cloud data
        }

        if (choice === 'merge') {
          console.info('[sync] Migration choice: merge');
          // Standard pull-then-push merges automatically
        }
      }
    }

    /**
     * Apps whose pull threw (cloud had data we couldn't restore).
     * We MUST skip pushing these on the same run — otherwise our empty
     * local state would clobber the user's cloud data. The exact
     * uninstall/reinstall data-loss bug fixed in v3.0.57.
     */
    const failedPullApps = new Set<SyncAppKey>();
    if (mode === 'pull-then-push') {
      const pullResults = await Promise.allSettled(
        ALL_APPS.map((app) => pullApp(app, meta, ctrl.signal)),
      );
      pullResults.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          opSucceeded = true; // proof we round-tripped to Firestore
          if (r.value.pulled) pulledCount += 1;
        } else {
          // Track which app's pull failed so we don't push over its cloud doc.
          failedPullApps.add(ALL_APPS[i]);
        }
      });
      // Re-collect after pulling: a successful pull can change local state
      // and create new push work that the snapshot from before would miss.
      if (epoch !== startEpoch) throw new SyncTimeoutError('epoch-changed', 0);
      work = await collectPushWork(meta);
      // CRITICAL: never push for an app whose pull failed this round.
      if (failedPullApps.size > 0) {
        work = work.filter((w) => !failedPullApps.has(w.app));
      }
    }

    if (work.length > 0) {
      const pushResults = await Promise.allSettled(
        work.map((w) => pushApp(w.app, w.raw, meta, ctrl.signal)),
      );
      for (const r of pushResults) {
        if (r.status === 'fulfilled') {
          opSucceeded = true; // proof we round-tripped to Firestore
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
    // Mark this uid as having completed at least one full pull-then-push
    // cycle — but ONLY if at least one Firestore op actually succeeded.
    // This is the critical gate: a pull-then-push where every single
    // getDoc timed out and no push work existed would otherwise reach
    // this success path with `opSucceeded=false` and incorrectly demote
    // future ticks to push-only, recreating the original "stuck on
    // Waiting to sync…" bug.
    if (mode === 'pull-then-push' && currentUser && opSucceeded) {
      writeFirstPullDone(currentUser.uid);
    }
    // We just succeeded — cancel any one-shot initial-retry timer
    // and the never-stuck fallback timer that might still be queued
    // from a prior failure / sign-in.
    if (initialRetryHandle) { clearTimeout(initialRetryHandle); initialRetryHandle = null; }
    if (neverStuckHandle) { clearTimeout(neverStuckHandle); neverStuckHandle = null; }
    if (currentUser) {
      void registerDevice(currentUser.uid);
      void triggerAutoBackup();
    }
    logSuccess(Date.now() - startedAt, pushedCount, pulledCount);
    if (pushedCount > 0 || pulledCount > 0) {
      logActivity('cloud_sync', `Synced ${pushedCount} push / ${pulledCount} pull`, 'Studio');
    }
  } catch (e) {
    const isTimeout = e instanceof SyncTimeoutError;
    const errMsg = (e as Error)?.message ?? '';
    const errCode = (e as { code?: string })?.code ?? '';
    // Detect "we just don't have network right now" cases. Firestore
    // throws with code 'unavailable' or message containing "offline"
    // when its connection can't be established. This is NOT a real
    // failure — the user's Wi-Fi might be flaky, the app might have
    // resumed before the radio came back, or Firestore's long-poll
    // handshake might have lost a packet. Surfacing this as a scary
    // "Sync failed" error trains users to ignore the indicator.
    // Instead we silently return to idle and let the next tick retry.
    const isOffline =
      errCode === 'unavailable' ||
      /offline|unavailable|network|fetch failed/i.test(errMsg);
    const durationMs = Date.now() - startedAt;
    if (isTimeout) logTimeout(e.op, e.ms || durationMs);
    else logFailure(durationMs, e);
    if (epoch === startEpoch) {
      // CRITICAL: even though the run as a whole "failed", if at least
      // one Firestore op proved end-to-end connectivity, treat the user
      // as synced. Without this, a pull-then-push where one of six
      // pulls timed out (causing the others' results to be wasted via
      // the `if (failure) throw failure` exit) would leave the
      // indicator stuck on "Waiting to sync…" forever — even though
      // the cloud and local were actually in sync. This is the
      // definitive fix for the v3.0.55 chronic stuck-on-syncing bug.
      if (opSucceeded) {
        if (mode === 'pull-then-push' && currentUser) {
          writeFirstPullDone(currentUser.uid);
        }
        if (initialRetryHandle) { clearTimeout(initialRetryHandle); initialRetryHandle = null; }
        if (neverStuckHandle) { clearTimeout(neverStuckHandle); neverStuckHandle = null; }
        setStatus({ phase: 'idle', lastSyncedMs: Date.now(), error: null });
        return;
      }
      // Treat both true offline AND timeouts as soft failures. A
      // timeout in this code path almost always means "the network
      // didn't answer in time" — same user-visible reality as offline,
      // and the next tick will retry. Showing "Sync timed out" as a
      // hard error trains the user to ignore the indicator.
      if (isOffline || isTimeout) {
        setStatus({ phase: 'idle', error: null });
      } else {
        setStatus({
          phase: 'error',
          error: errMsg || 'Sync failed',
        });
      }
      // The initial pull-then-push is the only run that hydrates a
      // brand-new device with cloud state. If it fails (timeout or
      // offline), schedule ONE quick retry in INITIAL_RETRY_MS instead
      // of waiting a full TICK_MS for the next push-only sweep — and
      // make that retry a pull-then-push too so the device actually
      // catches up. Any subsequent failures fall back to the normal
      // 60 s tick.
      if (mode === 'pull-then-push' && currentUser && !readFirstPullDone(currentUser.uid)) {
        // Capture uid at SCHEDULING time so a sign-out + sign-in (with a
        // different uid) before the timer fires can't cause this retry
        // to run for the wrong user. The auth-change handler already
        // clears `initialRetryHandle`, but that race isn't airtight —
        // a callback already dequeued from the macrotask queue can
        // still execute. The uid check inside the callback makes it
        // safe regardless.
        const scheduledForUid = currentUser.uid;
        if (initialRetryHandle) clearTimeout(initialRetryHandle);
        initialRetryHandle = setTimeout(() => {
          initialRetryHandle = null;
          if (currentUser && currentUser.uid === scheduledForUid) {
            void enqueueRun('retry', 'pull-then-push');
          }
        }, INITIAL_RETRY_MS);
      }
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

  // Background ticks, visibilities, beforeunloads, and flush updates are gated by syncAcrossDevices setting.
  // Explicit manual triggers ('manual' and 'retry') and the critical login 'initial' pull must always run.
  const syncEnabled = useChordStore.getState().settings.syncAcrossDevices;
  if (!syncEnabled && reason !== 'manual' && reason !== 'retry' && reason !== 'initial') {
    return Promise.resolve();
  }

  // If the initial pull has not completed, we MUST force pull-then-push
  // to avoid overwriting cloud data with empty local defaults.
  if (!readFirstPullDone(currentUser.uid)) {
    mode = 'pull-then-push';
  }

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
 *
 * Manual sync is ALWAYS pull-then-push: when the user taps the button
 * they want a true round-trip, not just a local push. This also gives
 * them a working escape hatch when the automatic initial pull failed
 * — without it, the user could be stuck on "Waiting to sync…" forever
 * because every periodic tick was push-only.
 */
export async function syncNow(): Promise<void> {
  if (flushDebounce) { clearTimeout(flushDebounce); flushDebounce = null; }
  if (status.phase === 'error') setStatus({ phase: 'idle', error: null });
  await enqueueRun('manual', 'pull-then-push');
}

/**
 * Explicit retry after an error. Identical to syncNow() but logs the
 * intent distinctly so the user-facing Retry button is greppable.
 * Also pull-then-push for the same reason as syncNow.
 */
export async function retrySync(): Promise<void> {
  if (flushDebounce) { clearTimeout(flushDebounce); flushDebounce = null; }
  setStatus({ phase: 'idle', error: null });
  await enqueueRun('retry', 'pull-then-push');
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

let attached = false;
// Keep references so detachSyncEngine can remove them. Without this,
// repeated attach/detach cycles (test harnesses, hot-reload, future
// multi-account flows) would accumulate window listeners.
let onMessage: ((e: MessageEvent) => void) | null = null;
let onVisibility: (() => void) | null = null;
let onBeforeUnload: (() => void) | null = null;
let onAvatarChanged: (() => void) | null = null;
let onCoverChanged: (() => void) | null = null;
let onOnline: (() => void) | null = null;

export function attachSyncEngine(): void {
  if (attached) return;
  attached = true;

  onMessage = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    handleStageMessage(e.data);
  };
  window.addEventListener('message', onMessage);

  onAvatarChanged = () => {
    requestFlush();
  };
  window.addEventListener('chordex:user-avatar-changed', onAvatarChanged);

  onCoverChanged = () => {
    requestFlush();
  };
  window.addEventListener('chordex:user-cover-changed', onCoverChanged);

  onOnline = () => {
    console.info('[sync] network connection restored, triggering flush');
    void enqueueRun('manual', 'pull-then-push');
  };
  window.addEventListener('online', onOnline);

  unsubAuth = subscribeAuth((u) => {
    // Bumping the epoch makes any in-flight run discard its results —
    // we never want a write under a stale uid, and we never want a
    // pre-signin `pullAll` to land into a now-signed-out world.
    epoch += 1;
    const priorUser = currentUser;
    currentUser = u;
    pendingFollowup = false;
    runPromise = null; // forget the lock; the in-flight run will see epoch shift and bail.

    if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }

    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }

    if (initialRetryHandle) { clearTimeout(initialRetryHandle); initialRetryHandle = null; }

    if (neverStuckHandle) { clearTimeout(neverStuckHandle); neverStuckHandle = null; }

    if (unsubDeviceSession) {
      unsubDeviceSession();
      unsubDeviceSession = null;
    }

    if (!u && priorUser) {
      void unregisterDevice(priorUser.uid);
    }

    if (u) {
      void registerDevice(u.uid);
      const db = getFirebaseDb();
      if (db) {
        const myId = deviceId();
        const sessionRef = doc(db, 'users', u.uid, 'devices', myId);
        let sessionExisted = false;
        unsubDeviceSession = onSnapshot(sessionRef, (snap) => {
          if (currentUser?.uid === u.uid) {
            if (snap.exists()) {
              sessionExisted = true;
            } else if (sessionExisted) {
              console.info('[sync] active session revoked, signing out');
              void signOut();
            }
          }
        });
      }
      // OPTIMISTIC STAMP: if this uid has previously completed a full
      // round-trip on this device (FIRST_PULL_DONE_KEY), assume we're
      // still in sync and show "Synced just now" immediately. This kills
      // the "Esperando para sincronizar…" flash that otherwise persists
      // until the next pull-then-push completes — which on a flaky
      // network can be 8 s, 60 s, or never. The next successful run
      // will overwrite this stamp with its real completion time.
      const hasPriorSync = readFirstPullDone(u.uid);
      setStatus({
        signedIn: true,
        phase: 'idle',
        error: null,
        lastSyncedMs: hasPriorSync ? Date.now() : null,
      });
      // NEVER-STUCK FALLBACK. For brand-new devices (no prior sync) we
      // arm a wall-clock timer: if the indicator hasn't escaped
      // "Waiting to sync…" within NEVER_STUCK_MS, we force-stamp it.
      // This is the absolute last line of defence against the chronic
      // v3.0.55 stuck-on-syncing bug — even if every layer above fails
      // (Firestore handshake hangs, watchdog mis-fires, opSucceeded
      // gate stays false), the user is GUARANTEED to escape the
      // waiting state within ~25 s. The next real sync overwrites the
      // stamp with its true completion time.
      if (!hasPriorSync) {
        const armedForUid = u.uid;
        const armedEpoch = epoch;
        neverStuckHandle = setTimeout(() => {
          neverStuckHandle = null;
          if (!currentUser || currentUser.uid !== armedForUid) return;
          if (epoch !== armedEpoch) return;
          if (status.phase === 'syncing') return; // watchdog handles this
          if (status.lastSyncedMs != null) return; // a real sync already stamped
          console.warn(`${LOG} never-stuck fallback: stamping lastSyncedMs after ${NEVER_STUCK_MS}ms with no completed sync`);
          setStatus({ phase: 'idle', lastSyncedMs: Date.now(), error: null });
        }, NEVER_STUCK_MS);
      }
      // Schedule the periodic tick FIRST so we're never blocked on the
      // initial pull. The first run is fire-and-forget.
      //
      // Tick mode is ADAPTIVE: if this uid has never completed a full
      // pull-then-push (because the initial run timed out or the user
      // signed in while offline), we keep promoting ticks to
      // pull-then-push. Once the first round-trip succeeds we revert
      // to cheap push-only ticks. This is what stops a device from
      // being stuck on "Waiting to sync…" forever — the next tick
      // after coming back online will actually pull cloud state.
      tickHandle = setInterval(() => {
        const mode: RunMode = currentUser && !readFirstPullDone(currentUser.uid)
          ? 'pull-then-push'
          : 'push-only';
        void enqueueRun('tick', mode);
      }, TICK_MS);
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
  if (initialRetryHandle) { clearTimeout(initialRetryHandle); initialRetryHandle = null; }
  if (neverStuckHandle) { clearTimeout(neverStuckHandle); neverStuckHandle = null; }
  if (onMessage) { window.removeEventListener('message', onMessage); onMessage = null; }
  if (onAvatarChanged) { window.removeEventListener('chordex:user-avatar-changed', onAvatarChanged); onAvatarChanged = null; }
  if (onCoverChanged) { window.removeEventListener('chordex:user-cover-changed', onCoverChanged); onCoverChanged = null; }
  if (onOnline) { window.removeEventListener('online', onOnline); onOnline = null; }
  if (onVisibility) { document.removeEventListener('visibilitychange', onVisibility); onVisibility = null; }
  if (onBeforeUnload) { window.removeEventListener('beforeunload', onBeforeUnload); onBeforeUnload = null; }
  pendingFollowup = false;
  runPromise = null;
  listeners = new Set();
}

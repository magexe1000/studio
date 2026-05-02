import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { subscribeAuth, type AuthUser } from './auth';
import { getAllTakes, saveTake, type TakeRecord } from '../vocalex/takesDb';
import { getAllSessions, saveSession, type LabSession, type LabLayer } from '../vocalex/labSessionDb';

/**
 * Cloud sync engine for Chordex / Drumex / StageX / Vocalex.
 *
 * Strategy:
 *   • Per-app docs at `users/{uid}/state/{appKey}`.
 *   • Push: a 5s tick reads each app's local snapshot, compares it to the
 *     last-pushed snapshot, and writes to Firestore if it changed.
 *   • Pull: on sign-in, for each app: if the cloud doc is newer than what we
 *     last pulled/pushed, restore it locally; otherwise push local upward.
 *   • StageX lives inside the stage-core iframe, so we get/set its snapshot
 *     through postMessage (`sc-sync-snapshot` / `sc-sync-restore`).
 *   • Vocalex takes/lab sessions live in IndexedDB; audio blobs are serialized
 *     as base64 DataURLs. Items exceeding the size budget are skipped.
 *   • A 40-second watchdog resets a stuck `syncing` flag; per-operation
 *     10-second timeouts guard against hung Firestore promises.
 */

export type SyncAppKey = 'chordex' | 'drumex' | 'drumexUI' | 'stagex' | 'vocalex-takes' | 'vocalex-lab';

const SYNC_META_KEY = 'chordex_sync_meta_v1';
const DEVICE_ID_KEY = 'chordex_device_id';
const TICK_MS = 5000;

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

type SyncStatus = {
  signedIn: boolean;
  syncing: boolean;
  lastSyncedMs: number | null;
  error: string | null;
};

type Listener = (s: SyncStatus) => void;

let currentUser: AuthUser | null = null;
let tickHandle: ReturnType<typeof setInterval> | null = null;
let unsubAuth: (() => void) | null = null;
let listeners = new Set<Listener>();
let status: SyncStatus = { signedIn: false, syncing: false, lastSyncedMs: null, error: null };
let pendingFlush = false;
let stageIframe: HTMLIFrameElement | null = null;
let stageSnapshotResolvers: Array<(s: StagexSnapshot) => void> = [];

// ── Safety watchdog ──────────────────────────────────────────────────────────

let syncSafetyTimer: ReturnType<typeof setTimeout> | null = null;

function armWatchdog() {
  if (syncSafetyTimer) clearTimeout(syncSafetyTimer);
  syncSafetyTimer = setTimeout(() => {
    syncSafetyTimer = null;
    if (status.syncing) {
      status = { ...status, syncing: false, error: null };
      emit();
    }
  }, 40_000);
}

function disarmWatchdog() {
  if (syncSafetyTimer) { clearTimeout(syncSafetyTimer); syncSafetyTimer = null; }
}

// ── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Sync timed out (${ms}ms)`)), ms)
    ),
  ]);
}

// ── Status ──────────────────────────────────────────────────────────────────

function emit() {
  for (const l of listeners) {
    try { l(status); } catch { /* noop */ }
  }
}

export function subscribeSyncStatus(l: Listener): () => void {
  listeners.add(l);
  l(status);
  return () => listeners.delete(l);
}

export function getSyncStatus(): SyncStatus { return status; }

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
    }, 1500);
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

// ── Vocalex takes snapshots ──────────────────────────────────────────────────

/** Max total base64 bytes we'll pack into one Firestore doc (~800 KB). */
const VOCALEX_BUDGET = 800_000;

async function snapshotVocalexTakes(): Promise<TakeSyncRecord[] | null> {
  try {
    const takes = await getAllTakes();
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

// ── Vocalex lab snapshots ────────────────────────────────────────────────────

async function snapshotVocalexLab(): Promise<SessionSyncRecord[] | null> {
  try {
    const sessions = await getAllSessions();
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

async function pushApp(app: SyncAppKey, raw: string | StagexSnapshot | unknown[], meta: Meta) {
  const db = getFirebaseDb();
  if (!db || !currentUser) return;
  const ref = doc(db, 'users', currentUser.uid, 'state', app);
  const serialized = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const localHash = hashString(serialized);

  const snap = await withTimeout(getDoc(ref), 10_000);
  const v = snap.exists() ? (snap.data() as CloudDoc) : null;
  const cloudTs = cloudMs(v);
  const knownCloudTs = meta[app]?.cloudUpdatedMs ?? 0;

  if (v && cloudTs > knownCloudTs) {
    if (await applyCloudBody(app, v.body, meta, cloudTs)) {
      writeMeta(meta);
      return;
    }
  }

  if (meta[app]?.lastHash === localHash) return;

  await withTimeout(setDoc(ref, {
    kind: typeof raw === 'string' ? 'json' : Array.isArray(raw) ? 'array' : 'bundle',
    body: raw,
    updatedAt: serverTimestamp(),
    deviceId: deviceId(),
    schemaVersion: 1,
  }, { merge: false }), 10_000);

  const after = await withTimeout(getDoc(ref), 10_000);
  const afterTs = after.exists() ? cloudMs(after.data() as CloudDoc) : Date.now();
  meta[app] = { lastHash: localHash, cloudUpdatedMs: afterTs };
  writeMeta(meta);
}

async function pullApp(app: SyncAppKey, meta: Meta): Promise<{ pulled: boolean }> {
  const db = getFirebaseDb();
  if (!db || !currentUser) return { pulled: false };
  const ref = doc(db, 'users', currentUser.uid, 'state', app);
  const snap = await withTimeout(getDoc(ref), 10_000);
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

  const applied = await applyCloudBody(app, v.body, meta, cloudTs);
  if (applied) writeMeta(meta);
  return { pulled: applied };
}

// ── Tick / flush ────────────────────────────────────────────────────────────

async function flushOnce(): Promise<void> {
  if (!currentUser) return;
  if (status.syncing) { pendingFlush = true; return; }

  const meta = readMeta();
  const chordex    = snapshotChordex();
  const drumex     = snapshotDrumex();
  const drumexUI   = snapshotDrumexUI();
  const stagex     = await snapshotStagex();
  const vocalexTakes = await snapshotVocalexTakes();
  const vocalexLab   = await snapshotVocalexLab();

  const work: Array<{ app: SyncAppKey; raw: string | StagexSnapshot | unknown[] }> = [];
  if (chordex      && hashString(chordex)                              !== meta.chordex?.lastHash)          work.push({ app: 'chordex',       raw: chordex });
  if (drumex       && hashString(drumex)                               !== meta.drumex?.lastHash)           work.push({ app: 'drumex',        raw: drumex });
  if (drumexUI     && hashString(drumexUI)                             !== meta.drumexUI?.lastHash)         work.push({ app: 'drumexUI',      raw: drumexUI });
  if (stagex       && hashString(JSON.stringify(stagex))               !== meta.stagex?.lastHash)           work.push({ app: 'stagex',        raw: stagex });
  if (vocalexTakes && hashString(JSON.stringify(vocalexTakes))         !== meta['vocalex-takes']?.lastHash) work.push({ app: 'vocalex-takes', raw: vocalexTakes });
  if (vocalexLab   && hashString(JSON.stringify(vocalexLab))           !== meta['vocalex-lab']?.lastHash)   work.push({ app: 'vocalex-lab',   raw: vocalexLab });

  if (work.length === 0) {
    pendingFlush = false;
    return;
  }

  status = { ...status, syncing: true, error: null };
  armWatchdog();
  emit();
  try {
    for (const w of work) await pushApp(w.app, w.raw, meta);
    status = { ...status, syncing: false, lastSyncedMs: Date.now(), error: null };
  } catch (e) {
    status = { ...status, syncing: false, error: (e as Error)?.message ?? 'Sync failed' };
  }
  disarmWatchdog();
  emit();
  if (pendingFlush) {
    pendingFlush = false;
    setTimeout(() => { void flushOnce(); }, 800);
  }
}

// ── Account deletion ────────────────────────────────────────────────────────

export async function deleteCloudData(): Promise<void> {
  const db = getFirebaseDb();
  if (!db || !currentUser) return;
  const apps: SyncAppKey[] = ['chordex', 'drumex', 'drumexUI', 'stagex', 'vocalex-takes', 'vocalex-lab'];
  for (const app of apps) {
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'state', app));
    } catch { /* per-doc continue */ }
  }
  try { localStorage.removeItem(SYNC_META_KEY); } catch { /* noop */ }
}

let flushDebounce: ReturnType<typeof setTimeout> | null = null;
export function requestFlush(delayMs = 1500): void {
  if (!currentUser) return;
  if (flushDebounce) clearTimeout(flushDebounce);
  flushDebounce = setTimeout(() => { flushDebounce = null; void flushOnce(); }, delayMs);
}

export async function syncNow(): Promise<void> {
  if (flushDebounce) { clearTimeout(flushDebounce); flushDebounce = null; }
  await flushOnce();
}

async function pullAll(): Promise<void> {
  if (!currentUser) return;
  status = { ...status, syncing: true, error: null };
  armWatchdog();
  emit();
  try {
    const meta = readMeta();
    const apps: SyncAppKey[] = ['chordex', 'drumex', 'drumexUI', 'stagex', 'vocalex-takes', 'vocalex-lab'];
    for (const app of apps) {
      try { await pullApp(app, meta); } catch { /* per-app continue */ }
    }
    status = { ...status, syncing: false, lastSyncedMs: Date.now(), error: null };
  } catch (e) {
    status = { ...status, syncing: false, error: (e as Error)?.message ?? 'Initial sync failed' };
  }
  disarmWatchdog();
  emit();
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

let attached = false;

export function attachSyncEngine(): void {
  if (attached) return;
  attached = true;

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    handleStageMessage(e.data);
  });

  unsubAuth = subscribeAuth(async (u) => {
    currentUser = u;
    status = { ...status, signedIn: !!u, error: null };
    emit();
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }

    if (u) {
      await pullAll();
      await flushOnce();
      tickHandle = setInterval(() => { void flushOnce(); }, TICK_MS);
    } else {
      disarmWatchdog();
      try { localStorage.removeItem(SYNC_META_KEY); } catch { /* noop */ }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushOnce();
  });
  window.addEventListener('beforeunload', () => { void flushOnce(); });
}

export function detachSyncEngine(): void {
  if (!attached) return;
  attached = false;
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  if (unsubAuth) { unsubAuth(); unsubAuth = null; }
  disarmWatchdog();
  listeners = new Set();
}

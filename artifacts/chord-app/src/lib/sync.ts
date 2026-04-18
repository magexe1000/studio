import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { subscribeAuth, type AuthUser } from './auth';

/**
 * Cloud sync engine for Chordex / Drumex / StageX.
 *
 * Strategy:
 *   • Per-app docs at `users/{uid}/state/{appKey}`.
 *   • Push: a 5s tick reads each app's local snapshot, compares it to the
 *     last-pushed snapshot, and writes to Firestore if it changed.
 *   • Pull: on sign-in, for each app: if the cloud doc is newer than what we
 *     last pulled/pushed, restore it locally; otherwise push local upward.
 *   • StageX lives inside the stage-core iframe, so we get/set its snapshot
 *     through postMessage (`sc-sync-snapshot` / `sc-sync-restore`).
 */

export type SyncAppKey = 'chordex' | 'drumex' | 'drumexUI' | 'stagex';

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

type Meta = {
  [K in SyncAppKey]?: {
    lastHash: string;        // hash of the last snapshot we pushed or pulled
    cloudUpdatedMs: number;  // server-assigned updatedAt (ms) we last saw
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
  // FNV-1a 32-bit, hex output. Plenty for change detection.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ':' + s.length.toString(36);
}

// ── Local snapshots ─────────────────────────────────────────────────────────

function readLocalRaw(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function snapshotChordex(): string | null { return readLocalRaw(CHORDEX_LS_KEY); }
function snapshotDrumex():  string | null { return readLocalRaw(DRUMEX_LS_KEY); }
function snapshotDrumexUI(): string | null { return readLocalRaw(DRUMEX_UI_KEY); }

function snapshotStagex(): Promise<StagexSnapshot | null> {
  if (!stageIframe || !stageIframe.contentWindow) {
    // Fallback: some StageX keys also live in the parent's localStorage when
    // the iframe writes through a shim — read what we can directly.
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

// ── Local restore ───────────────────────────────────────────────────────────

function restoreChordex(raw: string) {
  try { localStorage.setItem(CHORDEX_LS_KEY, raw); } catch { /* noop */ }
  // Tell zustand persist middleware to re-read.
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
  // Always mirror to the parent's localStorage as a safety net.
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
  // Same-tab writes don't fire `storage`; emit a custom event our stores listen to.
  try {
    window.dispatchEvent(new CustomEvent('chordex:storage-rehydrate', { detail: { key } }));
  } catch { /* noop */ }
}

// ── Iframe registration (called by StageCorePanel) ──────────────────────────

export function registerStageIframe(iframe: HTMLIFrameElement | null) {
  stageIframe = iframe;
}

// Called from a global window message listener wired up in attach().
function handleStageMessage(data: unknown) {
  if (!data || typeof data !== 'object') return;
  const m = data as { type?: string; data?: StagexSnapshot };
  if (m.type === 'sc-sync-snapshot-result' && m.data) {
    const resolvers = stageSnapshotResolvers;
    stageSnapshotResolvers = [];
    for (const r of resolvers) r(m.data);
  } else if (m.type === 'sc-sync-local-changed') {
    // Iframe told us its localStorage changed — flush soon.
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

function applyCloudBody(app: SyncAppKey, body: unknown, meta: Meta, cloudUpdatedMs: number): boolean {
  if (app === 'stagex' && body && typeof body === 'object') {
    restoreStagex(body as StagexSnapshot);
    meta[app] = { lastHash: hashString(JSON.stringify(body)), cloudUpdatedMs };
    return true;
  }
  if (typeof body === 'string') {
    if (app === 'chordex')      restoreChordex(body);
    else if (app === 'drumex')  restoreDrumex(body);
    else if (app === 'drumexUI') restoreDrumexUI(body);
    else return false;
    meta[app] = { lastHash: hashString(body), cloudUpdatedMs };
    return true;
  }
  return false;
}

/**
 * Push local state to the cloud, but only if it has changed *and* nothing
 * newer is sitting in the cloud that we haven't pulled yet. If the cloud
 * has advanced since our last sync, we pull-first to avoid clobbering edits
 * made on another device.
 *
 * Conflict ordering uses Firestore's server-assigned `updatedAt` Timestamp
 * (NOT client clocks), so device clock skew cannot cause data loss.
 */
async function pushApp(app: SyncAppKey, raw: string | StagexSnapshot, meta: Meta) {
  const db = getFirebaseDb();
  if (!db || !currentUser) return;
  const ref = doc(db, 'users', currentUser.uid, 'state', app);
  const localHash = hashString(typeof raw === 'string' ? raw : JSON.stringify(raw));

  // Read current cloud doc to detect remote-newer-than-our-last-sync.
  const snap = await getDoc(ref);
  const v = snap.exists() ? (snap.data() as CloudDoc) : null;
  const cloudTs = cloudMs(v);
  const knownCloudTs = meta[app]?.cloudUpdatedMs ?? 0;

  if (v && cloudTs > knownCloudTs) {
    // Someone else (or this same device on another tab) advanced cloud state.
    // Pull it first; if after merging the local snapshot still differs, we'll
    // push on the next tick.
    if (applyCloudBody(app, v.body, meta, cloudTs)) {
      writeMeta(meta);
      return;
    }
  }

  if (meta[app]?.lastHash === localHash) return; // local unchanged → nothing to push

  await setDoc(ref, {
    kind: typeof raw === 'string' ? 'json' : 'bundle',
    body: raw,
    updatedAt: serverTimestamp(),
    deviceId: deviceId(),
    schemaVersion: 1,
  }, { merge: false });

  // Re-read to capture the server-assigned timestamp.
  const after = await getDoc(ref);
  const afterTs = after.exists() ? cloudMs(after.data() as CloudDoc) : Date.now();
  meta[app] = { lastHash: localHash, cloudUpdatedMs: afterTs };
  writeMeta(meta);
}

async function pullApp(app: SyncAppKey, meta: Meta): Promise<{ pulled: boolean }> {
  const db = getFirebaseDb();
  if (!db || !currentUser) return { pulled: false };
  const ref = doc(db, 'users', currentUser.uid, 'state', app);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { pulled: false };
  const v = snap.data() as CloudDoc;
  const cloudTs = cloudMs(v);
  const knownCloudTs = meta[app]?.cloudUpdatedMs ?? 0;

  // Fast paths: nothing new on the server.
  if (cloudTs > 0 && cloudTs <= knownCloudTs) return { pulled: false };

  // Compute hashes to avoid a redundant restore if cloud body matches local.
  const cloudHash = v.body == null
    ? ''
    : hashString(typeof v.body === 'string' ? v.body : JSON.stringify(v.body));
  if (cloudHash && cloudHash === meta[app]?.lastHash) {
    // Same content, just refresh our cloudUpdatedMs marker.
    meta[app] = { lastHash: cloudHash, cloudUpdatedMs: cloudTs };
    writeMeta(meta);
    return { pulled: false };
  }

  const applied = applyCloudBody(app, v.body, meta, cloudTs);
  if (applied) writeMeta(meta);
  return { pulled: applied };
}

// ── Tick / flush ────────────────────────────────────────────────────────────

async function flushOnce(): Promise<void> {
  if (!currentUser) return;
  if (status.syncing) { pendingFlush = true; return; }
  status = { ...status, syncing: true, error: null };
  emit();
  try {
    const meta = readMeta();
    const chordex = snapshotChordex();
    const drumex  = snapshotDrumex();
    const drumexUI = snapshotDrumexUI();
    const stagex  = await snapshotStagex();
    if (chordex)   await pushApp('chordex',  chordex,  meta);
    if (drumex)    await pushApp('drumex',   drumex,   meta);
    if (drumexUI)  await pushApp('drumexUI', drumexUI, meta);
    if (stagex)    await pushApp('stagex',   stagex,   meta);
    status = { ...status, syncing: false, lastSyncedMs: Date.now(), error: null };
  } catch (e) {
    status = { ...status, syncing: false, error: (e as Error)?.message ?? 'Sync failed' };
  }
  emit();
  if (pendingFlush) {
    pendingFlush = false;
    setTimeout(() => { void flushOnce(); }, 800);
  }
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
  emit();
  try {
    const meta = readMeta();
    const apps: SyncAppKey[] = ['chordex', 'drumex', 'drumexUI', 'stagex'];
    for (const app of apps) {
      try { await pullApp(app, meta); } catch { /* per-app continue */ }
    }
    status = { ...status, syncing: false, lastSyncedMs: Date.now(), error: null };
  } catch (e) {
    status = { ...status, syncing: false, error: (e as Error)?.message ?? 'Initial sync failed' };
  }
  emit();
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

let attached = false;

export function attachSyncEngine(): void {
  if (attached) return;
  attached = true;

  // Listen for iframe messages globally (StageCorePanel doesn't proxy these).
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    handleStageMessage(e.data);
  });

  // Subscribe to sign-in / sign-out
  unsubAuth = subscribeAuth(async (u) => {
    currentUser = u;
    status = { ...status, signedIn: !!u, error: null };
    emit();
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }

    if (u) {
      // 1) Pull cloud → local for any newer docs.
      await pullAll();
      // 2) Push current local → cloud (covers fresh devices and merges).
      await flushOnce();
      // 3) Start the periodic tick.
      tickHandle = setInterval(() => { void flushOnce(); }, TICK_MS);
    } else {
      // Wipe sync metadata so a future sign-in starts clean.
      try { localStorage.removeItem(SYNC_META_KEY); } catch { /* noop */ }
    }
  });

  // Flush on tab hide / unload so we don't lose the last few seconds.
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
  listeners = new Set();
}

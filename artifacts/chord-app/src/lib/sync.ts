import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    lastHash: string;        // last snapshot we pushed or pulled
    lastUpdatedMs: number;   // local clock when we last pushed/pulled
    cloudUpdatedMs?: number; // server-side updatedAt mirror (ms)
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

async function pushApp(app: SyncAppKey, raw: string | StagexSnapshot, meta: Meta) {
  const db = getFirebaseDb();
  if (!db || !currentUser) return;
  const payload = typeof raw === 'string' ? { kind: 'json', body: raw } : { kind: 'bundle', body: raw };
  const hash = hashString(typeof raw === 'string' ? raw : JSON.stringify(raw));
  if (meta[app]?.lastHash === hash) return; // no change
  const ref = doc(db, 'users', currentUser.uid, 'state', app);
  await setDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
    deviceId: deviceId(),
    schemaVersion: 1,
  }, { merge: false });
  meta[app] = { lastHash: hash, lastUpdatedMs: Date.now(), cloudUpdatedMs: Date.now() };
  writeMeta(meta);
}

async function pullApp(app: SyncAppKey, meta: Meta): Promise<{ pulled: boolean; cloudUpdatedMs: number }> {
  const db = getFirebaseDb();
  if (!db || !currentUser) return { pulled: false, cloudUpdatedMs: 0 };
  const ref = doc(db, 'users', currentUser.uid, 'state', app);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { pulled: false, cloudUpdatedMs: 0 };
  const v = snap.data() as { kind?: string; body?: unknown; updatedAtMs?: number; deviceId?: string };
  const cloudUpdatedMs = typeof v.updatedAtMs === 'number' ? v.updatedAtMs : 0;
  const localUpdatedMs = meta[app]?.lastUpdatedMs ?? 0;
  // Same device just pushed it → nothing to do
  if (v.deviceId === deviceId() && cloudUpdatedMs === (meta[app]?.cloudUpdatedMs ?? 0)) {
    return { pulled: false, cloudUpdatedMs };
  }
  // Cloud is the same age or older than our local push → skip
  if (cloudUpdatedMs <= localUpdatedMs && (meta[app]?.cloudUpdatedMs ?? 0) >= cloudUpdatedMs) {
    return { pulled: false, cloudUpdatedMs };
  }
  // Apply
  const body = v.body;
  if (app === 'stagex' && body && typeof body === 'object') {
    restoreStagex(body as StagexSnapshot);
    meta[app] = { lastHash: hashString(JSON.stringify(body)), lastUpdatedMs: Date.now(), cloudUpdatedMs };
  } else if (typeof body === 'string') {
    if (app === 'chordex') restoreChordex(body);
    else if (app === 'drumex') restoreDrumex(body);
    else if (app === 'drumexUI') restoreDrumexUI(body);
    meta[app] = { lastHash: hashString(body), lastUpdatedMs: Date.now(), cloudUpdatedMs };
  }
  writeMeta(meta);
  return { pulled: true, cloudUpdatedMs };
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

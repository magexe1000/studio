const DB_NAME = 'vocalex-lab';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';

export interface TrackEffect {
  type: 'reverb' | 'delay' | 'chorus' | 'distortion' | 'highpass' | 'lowpass';
  enabled: boolean;
  params: Record<string, number>;
}

export interface LabLayer {
  id: string;
  name: string;
  audioBlob: Blob;
  durationMs: number;
  createdAt: number;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  effects: TrackEffect[];
  sourceType: 'recorded' | 'take' | 'file';
  order: number;
}

export interface LabSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  layers: LabLayer[];
  icon: string;
  bpm?: number;
  key?: string;
  masterVolume?: number;
}

export function createDefaultEffects(): TrackEffect[] {
  return [
    { type: 'reverb', enabled: false, params: { mix: 0.3, decay: 2.0 } },
    { type: 'delay', enabled: false, params: { time: 0.3, feedback: 0.3, mix: 0.25 } },
    { type: 'chorus', enabled: false, params: { rate: 1.5, depth: 0.5, mix: 0.3 } },
    { type: 'distortion', enabled: false, params: { amount: 0.3, mix: 0.2 } },
    { type: 'highpass', enabled: false, params: { frequency: 200, q: 0.7 } },
    { type: 'lowpass', enabled: false, params: { frequency: 8000, q: 0.7 } },
  ];
}

export function createLayer(partial: Pick<LabLayer, 'name' | 'audioBlob' | 'durationMs'> & Partial<LabLayer>): LabLayer {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    volume: 0.8,
    pan: 0,
    muted: false,
    solo: false,
    effects: createDefaultEffects(),
    sourceType: 'recorded',
    order: Date.now(),
    createdAt: Date.now(),
    ...partial,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if ((event as IDBVersionChangeEvent).oldVersion < 2) {
        // migration: existing layers get new fields on read
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function migrateLayer(l: any): LabLayer {
  return {
    ...l,
    volume: l.volume ?? 0.8,
    pan: l.pan ?? 0,
    muted: l.muted ?? false,
    solo: l.solo ?? false,
    effects: l.effects ?? createDefaultEffects(),
    sourceType: l.sourceType ?? 'recorded',
    order: l.order ?? l.createdAt ?? Date.now(),
  };
}

function migrateSession(s: any): LabSession {
  return {
    ...s,
    layers: (s.layers || []).map(migrateLayer),
    masterVolume: s.masterVolume ?? 0.8,
  };
}

export async function saveSession(session: LabSession): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSessions(): Promise<LabSession[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('updatedAt').getAll();
    req.onsuccess = () => resolve((req.result as any[]).map(migrateSession).reverse());
    req.onerror = () => reject(req.error);
  });
}

export async function getSession(id: string): Promise<LabSession | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      const r = req.result;
      resolve(r ? migrateSession(r) : undefined);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

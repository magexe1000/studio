const DB_NAME = 'groovex-stems-cache';
const DB_VERSION = 1;
const STORE_NAME = 'stems';

interface CachedStem {
  key: string;
  data: ArrayBuffer;
  songId: string;
  stemName: string;
  cachedAt: number;
  size: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('songId', 'songId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function stemKey(songId: string, stemName: string): string {
  return `${songId}/${stemName}`;
}

export async function getCachedStem(songId: string, stemName: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(stemKey(songId, stemName));
      req.onsuccess = () => {
        const result = req.result as CachedStem | undefined;
        resolve(result?.data ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function cacheStem(songId: string, stemName: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: CachedStem = {
        key: stemKey(songId, stemName),
        data,
        songId,
        stemName,
        cachedAt: Date.now(),
        size: data.byteLength,
      };
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // silently fail cache writes
  }
}

export async function isStemCached(songId: string, stemName: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getKey(stemKey(songId, stemName));
      req.onsuccess = () => resolve(req.result !== undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

export async function getSongCacheStatus(songId: string, stemNames: string[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const name of stemNames) {
    result[name] = await isStemCached(songId, name);
  }
  return result;
}

export async function getCacheSize(): Promise<{ totalBytes: number; songCount: number; stemCount: number }> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const entries = req.result as CachedStem[];
        const songIds = new Set(entries.map(e => e.songId));
        resolve({
          totalBytes: entries.reduce((sum, e) => sum + e.size, 0),
          songCount: songIds.size,
          stemCount: entries.length,
        });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return { totalBytes: 0, songCount: 0, stemCount: 0 };
  }
}

export async function clearSongCache(songId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('songId');
      const req = index.getAllKeys(songId);
      req.onsuccess = () => {
        const keys = req.result;
        keys.forEach(k => store.delete(k));
        tx.oncomplete = () => resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

export async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

export type DownloadProgress = {
  stemName: string;
  loaded: number;
  total: number;
  percent: number;
};

export async function downloadStem(
  songId: string,
  stemName: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<ArrayBuffer> {
  const cached = await getCachedStem(songId, stemName);
  if (cached) {
    onProgress?.({ stemName, loaded: cached.byteLength, total: cached.byteLength, percent: 100 });
    return cached;
  }

  const baseUrl = import.meta.env.BASE_URL ?? '/';
  const url = `${baseUrl}api/stems/${songId}/${stemName}.ogg`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download stem: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    const data = await response.arrayBuffer();
    await cacheStem(songId, stemName, data);
    onProgress?.({ stemName, loaded: data.byteLength, total: data.byteLength, percent: 100 });
    return data;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.({
      stemName,
      loaded,
      total: total || loaded,
      percent: total ? Math.round((loaded / total) * 100) : 0,
    });
  }

  const data = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }

  const buffer = data.buffer;
  await cacheStem(songId, stemName, buffer);
  onProgress?.({ stemName, loaded, total: loaded, percent: 100 });
  return buffer;
}

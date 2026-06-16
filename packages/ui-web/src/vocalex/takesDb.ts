const DB_NAME = 'vocalex-takes';
const DB_VERSION = 1;
const STORE_NAME = 'takes';

export interface TakeRecord {
  id: string;
  name: string;
  createdAt: number;
  durationMs: number;
  audioBlob: Blob;
  waveformPeaks: number[];
  sampleRate: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTake(take: TakeRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(take);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllTakes(): Promise<TakeRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('createdAt').getAll();
    req.onsuccess = () => resolve((req.result as TakeRecord[]).reverse());
    req.onerror = () => reject(req.error);
  });
}

export async function getTake(id: string): Promise<TakeRecord | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as TakeRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTake(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function extractWaveformPeaks(audioBuffer: AudioBuffer, barCount = 60): number[] {
  const raw = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(raw.length / barCount);
  const peaks: number[] = [];
  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, raw.length);
    for (let j = start; j < end; j++) {
      sum += Math.abs(raw[j]);
    }
    peaks.push(sum / (end - start));
  }
  const maxPeak = Math.max(...peaks, 0.001);
  return peaks.map(p => Math.round((p / maxPeak) * 100));
}

export async function blobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 44100);
  return ctx.decodeAudioData(arrayBuffer);
}

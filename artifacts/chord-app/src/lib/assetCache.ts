/**
 * Asset cache — keeps the large unchanging drum-sample tree (~38 MB)
 * out of every OTA bundle by storing it once in the device's Data
 * directory after the first launch.
 *
 * Why bother:
 *   The drum samples are 70%+ of every Capgo OTA bundle, but they
 *   change at most once or twice a year. Re-uploading 38 MB of WAV
 *   and OPUS files for a one-line code fix turned every release into
 *   a 5-minute upload over a residential connection. Splitting them
 *   into a one-time persistent cache shrinks normal OTA bundles to
 *   ~5 MB and brings publishing back to ~30 s.
 *
 * Lifecycle:
 *   1. APK ships with drums/ in the WebView root — `/drums/...`
 *      resolves directly. This is true on first install.
 *   2. On first native launch, `seedAudioAssets()` walks the manifest
 *      generated at build time (`/audio-manifest.json`), fetches
 *      every file from the running bundle, and writes it to
 *      `Filesystem.Directory.Data/audio-v1/`. A marker file records
 *      success so subsequent launches skip the work in O(1).
 *   3. Future OTAs can omit the drums tree (publish-bundle.mjs has an
 *      `OTA_SLIM=1` switch). After the OTA reload, `/drums/...` 404s
 *      from the new bundle — but `drumAssetUrl()` now resolves to the
 *      Data-dir copy via `Capacitor.convertFileSrc()`, so playback
 *      keeps working.
 *
 * Web (browser PWA): every export here is a no-op pass-through. The
 * static host already serves the audio at the original URL.
 *
 * Failure modes:
 *   - Manifest missing: skip seed, leave audio loading from bundle.
 *   - Source file 404 (likely a "slim" OTA installed before any seed
 *     ever ran, e.g. user wiped app data): we DON'T write the marker,
 *     so we'll retry on every launch. `drumAssetUrl` falls back to
 *     the original path, which 404s — audio is broken until the user
 *     reinstalls the APK or an OTA with the audio re-included rolls
 *     out. Logged loudly so the developer notices in `adb logcat`.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const SEED_DIR = 'audio-v1';
const SEED_MARKER = `${SEED_DIR}/.seeded`;
// Manifest path is relative to the served root. On Capacitor BASE_URL
// is "/" so this resolves to "/audio-manifest.json" inside the bundle.
const MANIFEST_PATH = 'audio-manifest.json';

interface AudioManifest {
  generatedAt: string;
  files: string[];   // each starts with "/" — e.g. "/drums/realistic/..."
}

let _seedPromise: Promise<void> | null = null;
let _seeded = false;
const _urlCache = new Map<string, string>();

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Resolve a drum-asset URL. ASYNC because on first call it may need
 * to wait for the seed to finish writing the file to disk; subsequent
 * calls are cheap (memoised in `_urlCache`).
 *
 * On the web, returns the path unchanged.
 * On native before/after seed:
 *   - seed in progress → awaits it
 *   - seed succeeded → returns convertFileSrc(<data>/audio-v1/...)
 *   - seed failed → returns the original path (best-effort fallback)
 */
export async function drumAssetUrl(p: string): Promise<string> {
  if (!isNative()) {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
    const trimmed = p.replace(/^\/+/, '');
    return `${base}${trimmed}`;
  }
  // Implicit dependency: every audio caller awaits this, so the seed
  // can't be skipped just because the caller forgot to kick it off
  // from main.tsx.
  await seedAudioAssets();
  if (!_seeded) return p;
  const trimmed = p.replace(/^\/+/, '');
  const cached = _urlCache.get(trimmed);
  if (cached) return cached;
  // Unmemoised path — resolve once and cache. Happens for files not
  // listed in the manifest (e.g. a sample added after the manifest
  // was generated). We still return a Data-dir URL on the assumption
  // the seed copied it; if not, the fetch will 404 and the audio
  // loader will silently skip it (its existing behaviour).
  try {
    const { uri } = await Filesystem.getUri({
      directory: Directory.Data,
      path: `${SEED_DIR}/${trimmed}`,
    });
    const url = Capacitor.convertFileSrc(uri);
    _urlCache.set(trimmed, url);
    return url;
  } catch {
    return p;
  }
}

/** Idempotent: returns the same in-flight promise on repeat calls. */
export function seedAudioAssets(): Promise<void> {
  if (!isNative()) return Promise.resolve();
  if (_seedPromise) return _seedPromise;
  _seedPromise = doSeed().catch((err) => {
    console.warn('[assetCache] seed failed:', err);
  });
  return _seedPromise;
}

async function doSeed(): Promise<void> {
  // Already seeded in a prior launch?
  try {
    await Filesystem.stat({ directory: Directory.Data, path: SEED_MARKER });
    // Marker exists — populate the URL cache from the manifest so
    // drumAssetUrl is fast.
    const manifest = await loadManifest();
    if (manifest) await populateUrlCache(manifest.files);
    _seeded = true;
    return;
  } catch {
    // Marker missing — proceed with the actual seed.
  }

  const manifest = await loadManifest();
  if (!manifest) {
    console.warn('[assetCache] no audio manifest — drum-sample seed skipped');
    return;
  }

  try {
    await Filesystem.mkdir({
      directory: Directory.Data,
      path: SEED_DIR,
      recursive: true,
    });
  } catch {
    // Already exists — fine.
  }

  // Snapshot the file list into a const so the worker closure has a
  // stable, non-null reference (TS narrows `manifest` back to its
  // declared shape inside the nested function).
  const files = manifest.files;
  let copied = 0;
  let failed = 0;
  const total = files.length;
  // Concurrency limit — saturate disk I/O without stuffing hundreds
  // of megabyte-class ArrayBuffers into memory at once.
  const CONCURRENCY = 6;
  let cursor = 0;
  const startedAt = Date.now();

  async function worker(): Promise<void> {
    while (cursor < files.length) {
      const i = cursor++;
      const file = files[i];
      const trimmed = file.replace(/^\/+/, '');
      const dataPath = `${SEED_DIR}/${trimmed}`;
      try {
        const resp = await fetch(file, { cache: 'force-cache' });
        if (!resp.ok) {
          failed++;
          continue;
        }
        const buf = await resp.arrayBuffer();
        const parent = dataPath.substring(0, dataPath.lastIndexOf('/'));
        try {
          await Filesystem.mkdir({
            directory: Directory.Data,
            path: parent,
            recursive: true,
          });
        } catch { /* exists */ }
        await Filesystem.writeFile({
          directory: Directory.Data,
          path: dataPath,
          data: arrayBufferToBase64(buf),
          recursive: true,
        });
        copied++;
      } catch {
        failed++;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[assetCache] seeded ${copied}/${total} files in ${elapsed}s (${failed} failed)`,
  );

  if (copied === 0) {
    // Source bundle had nothing — almost certainly a "slim" OTA was
    // installed before any seed ever ran. Don't stamp the marker, so
    // we retry next launch (when maybe the user has reinstalled the
    // APK with audio in it).
    return;
  }

  await populateUrlCache(manifest.files);

  // Stamp the marker LAST so a crash mid-seed retries from scratch.
  try {
    await Filesystem.writeFile({
      directory: Directory.Data,
      path: SEED_MARKER,
      data: new Date().toISOString(),
      encoding: Encoding.UTF8,
    });
  } catch (err) {
    console.warn('[assetCache] could not stamp seed marker:', err);
  }
  _seeded = true;
}

async function populateUrlCache(files: string[]): Promise<void> {
  for (const f of files) {
    const trimmed = f.replace(/^\/+/, '');
    try {
      const { uri } = await Filesystem.getUri({
        directory: Directory.Data,
        path: `${SEED_DIR}/${trimmed}`,
      });
      _urlCache.set(trimmed, Capacitor.convertFileSrc(uri));
    } catch {
      // File missing — drumAssetUrl will fall back to the bundle path.
    }
  }
}

async function loadManifest(): Promise<AudioManifest | null> {
  try {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
    const resp = await fetch(`${base}${MANIFEST_PATH}`, { cache: 'no-cache' });
    if (!resp.ok) return null;
    return (await resp.json()) as AudioManifest;
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // Process in chunks so we don't blow the stack with String.fromCharCode.apply
  // on big files (some cymbal WAVs are >200 KB).
  const CHUNK = 0x8000;
  let s = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

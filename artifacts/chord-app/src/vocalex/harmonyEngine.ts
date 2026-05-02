/**
 * Harmony Engine (Vocalex)
 * ────────────────────────
 * Manages pitch-shifted variants of a take and plays them in sync with the
 * dry vocal as a real-time preview. Pre-renders shifted buffers once and
 * caches them per (takeId, semitones) so toggling layers / scrubbing is
 * instantaneous.
 *
 *   • Lazy generation: shifted buffers are computed on first request.
 *   • Synchronous playback: all source nodes start at ctx.currentTime + 0.05
 *     so the dry vocal and harmonies are sample-aligned (no flam).
 *   • Per-layer gain control: caller can adjust `gain` mid-playback.
 *   • Lightweight: each layer is a single AudioBufferSourceNode → GainNode
 *     → destination. No filters, no real-time DSP.
 */

import { pitchShiftBuffer, audioBufferToWavBlob } from './pitchShift';
import type { TakeRecord } from './takesDb';
import { blobToAudioBuffer, extractWaveformPeaks } from './takesDb';

// ── Harmony interval catalogue ─────────────────────────────────────────────

export type HarmonyId = 'third' | 'fifth' | 'octave';

export interface HarmonyDef {
  id:        HarmonyId;
  label:     string;
  short:     string;     // compact label for chips
  semitones: number;
  hint:      string;     // user-facing description
}

export const HARMONIES: HarmonyDef[] = [
  { id: 'third',  label: 'Major 3rd',   short: '+3rd', semitones: 4,  hint: 'Bright, sweet upper harmony'   },
  { id: 'fifth',  label: 'Perfect 5th', short: '+5th', semitones: 7,  hint: 'Strong, open consonant interval' },
  { id: 'octave', label: 'Octave',      short: '+8ve', semitones: 12, hint: 'Doubles the melody one octave up' },
];

export interface HarmonyLayerState {
  id:       HarmonyId;
  enabled:  boolean;
  gain:     number;      // 0–1.5 (linear)
}

export const DEFAULT_HARMONY_STATE: HarmonyLayerState[] = HARMONIES.map(h => ({
  id:      h.id,
  enabled: false,
  gain:    0.7,
}));

// ── Cache: take.id → { shiftedBuffers, sourceBuffer } ──────────────────────

interface TakeCache {
  source:   AudioBuffer;
  shifted:  Partial<Record<HarmonyId, AudioBuffer>>;
}
const cache = new Map<string, TakeCache>();

/** Decode the take's blob and cache the source AudioBuffer. */
async function getSource(take: TakeRecord, ctx: AudioContext): Promise<AudioBuffer> {
  const existing = cache.get(take.id);
  if (existing) return existing.source;
  const arrayBuffer = await take.audioBlob.arrayBuffer();
  // We need a real (or matching-rate) context to decode. Use the live ctx.
  const source = await ctx.decodeAudioData(arrayBuffer.slice(0));
  cache.set(take.id, { source, shifted: {} });
  return source;
}

/** Lazily render and cache the shifted buffer for a given harmony. */
export async function getShiftedBuffer(
  take: TakeRecord,
  harmonyId: HarmonyId,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  const source = await getSource(take, ctx);
  const entry  = cache.get(take.id)!;
  if (entry.shifted[harmonyId]) return entry.shifted[harmonyId]!;
  const def   = HARMONIES.find(h => h.id === harmonyId);
  if (!def) throw new Error(`Unknown harmony id: ${harmonyId}`);
  const shifted = pitchShiftBuffer(ctx, source, def.semitones);
  entry.shifted[harmonyId] = shifted;
  return shifted;
}

/** Clear the cache for a take (call on delete). */
export function clearTakeCache(takeId: string) {
  cache.delete(takeId);
}

// ── Playback session ───────────────────────────────────────────────────────

export interface HarmonyPlaybackSession {
  /** Stop all layers and free nodes. */
  stop: () => void;
  /** Update the gain of one harmony layer (or 'dry' for the original). */
  setGain: (id: HarmonyId | 'dry', gain: number) => void;
  /** True after the dry buffer reaches its end. */
  onEnded: (cb: () => void) => void;
  /** Duration in seconds. */
  duration: number;
}

/**
 * Begin synchronised playback of dry vocal + every enabled harmony layer.
 * Returns a session handle; call `stop()` to halt all sources cleanly.
 *
 * Buffers for enabled layers are rendered before scheduling so we can start
 * everything at the *same* future timestamp. The 50 ms head-start guarantees
 * sample-aligned starts even on slower devices.
 */
export async function startHarmonyPlayback(
  take: TakeRecord,
  layers: HarmonyLayerState[],
  ctx: AudioContext,
  dryGain = 1,
): Promise<HarmonyPlaybackSession> {
  const source = await getSource(take, ctx);

  // Pre-render every enabled layer so we never race the audio clock.
  await Promise.all(
    layers
      .filter(l => l.enabled)
      .map(l => getShiftedBuffer(take, l.id, ctx)),
  );

  const startAt = ctx.currentTime + 0.05;
  const gainNodes = new Map<HarmonyId | 'dry', GainNode>();
  const sources:  AudioBufferSourceNode[] = [];

  // Dry vocal
  const drySrc  = ctx.createBufferSource();
  drySrc.buffer = source;
  const dryG    = ctx.createGain();
  dryG.gain.value = dryGain;
  drySrc.connect(dryG).connect(ctx.destination);
  drySrc.start(startAt);
  gainNodes.set('dry', dryG);
  sources.push(drySrc);

  // Harmony layers
  for (const layer of layers) {
    if (!layer.enabled) continue;
    const buf = cache.get(take.id)?.shifted[layer.id];
    if (!buf) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g    = ctx.createGain();
    g.gain.value = layer.gain;
    src.connect(g).connect(ctx.destination);
    src.start(startAt);
    gainNodes.set(layer.id, g);
    sources.push(src);
  }

  let endedCb: (() => void) | null = null;
  drySrc.onended = () => endedCb?.();

  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      for (const s of sources) {
        try { s.stop(); } catch { /* already ended */ }
        try { s.disconnect(); } catch { /* noop */ }
      }
      for (const g of gainNodes.values()) {
        try { g.disconnect(); } catch { /* noop */ }
      }
    },
    setGain: (id, gain) => {
      const g = gainNodes.get(id);
      if (g) g.gain.setTargetAtTime(gain, ctx.currentTime, 0.02);
    },
    onEnded: cb => { endedCb = cb; },
    duration: source.duration,
  };
}

// ── Bounce: render a take + its enabled harmonies into a new TakeRecord ────

/**
 * Render an offline mix of (dry + enabled harmony layers) into a new take.
 * Used to make harmonized recordings persistent (post-record processing).
 */
export async function bounceHarmonizedTake(
  take: TakeRecord,
  layers: HarmonyLayerState[],
  newName: string,
  dryGain = 1,
): Promise<TakeRecord> {
  // Decode source and render shifted buffers via the OfflineAudioContext so
  // we don't depend on the live audio graph (callable from any context).
  const sourceBuf = await blobToAudioBuffer(take.audioBlob);
  const sr        = sourceBuf.sampleRate;
  const numCh     = Math.min(2, Math.max(1, sourceBuf.numberOfChannels));

  const offline = new OfflineAudioContext(numCh, sourceBuf.length, sr);

  // Dry path
  const drySrc = offline.createBufferSource();
  drySrc.buffer = sourceBuf;
  const dryG = offline.createGain();
  dryG.gain.value = dryGain;
  drySrc.connect(dryG).connect(offline.destination);
  drySrc.start(0);

  // Each enabled harmony — render the shifted buffer offline, route to mix.
  for (const layer of layers) {
    if (!layer.enabled) continue;
    const def = HARMONIES.find(h => h.id === layer.id);
    if (!def) continue;
    const shifted = pitchShiftBuffer(offline, sourceBuf, def.semitones);
    const src = offline.createBufferSource();
    src.buffer = shifted;
    const g = offline.createGain();
    g.gain.value = layer.gain;
    src.connect(g).connect(offline.destination);
    src.start(0);
  }

  const renderedBuf = await offline.startRendering();
  const blob        = audioBufferToWavBlob(renderedBuf);
  const peaks       = extractWaveformPeaks(renderedBuf, 60);

  const id = `take-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name:           newName,
    createdAt:      Date.now(),
    durationMs:     Math.round(renderedBuf.duration * 1000),
    audioBlob:      blob,
    waveformPeaks:  peaks,
    sampleRate:     renderedBuf.sampleRate,
  };
}

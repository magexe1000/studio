import { type TakeRecord, blobToAudioBuffer, extractWaveformPeaks } from '@workspace/studio-core';
/**
 * Harmony Engine (Vocalex)
 * ────────────────────────
 * Full harmony system:
 *   • 9 interval types with per-layer pan, mute, solo, fine-tune
 *   • Caches shifted buffers keyed by (semitones, humanize, formant)
 *   • StereoPannerNode per layer for real stereo width
 *   • Humanize: randomised per-layer timing offset
 *   • Key detection from pitch timeline
 */

import { pitchShiftBuffer, audioBufferToWavBlob, type PitchShiftOptions } from './pitchShift';

// ── Harmony interval catalogue ──────────────────────────────────────────────

export type HarmonyId =
  | 'third_up' | 'third_down'
  | 'fifth_up'
  | 'sixth_up' | 'sixth_down'
  | 'octave_up' | 'octave_down'
  | 'double' | 'custom';

export interface HarmonyDef {
  id:       HarmonyId;
  label:    string;
  short:    string;
  semitones: number;
  color:    string;
  hint:     string;
}

export const HARMONIES: HarmonyDef[] = [
  { id: 'third_up',    label: '3rd Above',    short: '+3rd',  semitones: 4,    color: '#007aff', hint: 'Bright, sweet upper harmony' },
  { id: 'third_down',  label: '3rd Below',    short: '−3rd',  semitones: -3,   color: '#5856d6', hint: 'Warm, intimate lower harmony' },
  { id: 'fifth_up',    label: '5th Above',    short: '+5th',  semitones: 7,    color: '#34c759', hint: 'Strong, open consonant interval' },
  { id: 'sixth_up',    label: '6th Above',    short: '+6th',  semitones: 9,    color: '#ff9f0a', hint: 'Expressive, soulful upper voice' },
  { id: 'sixth_down',  label: '6th Below',    short: '−6th',  semitones: -9,   color: '#ff6b35', hint: 'Full, rich lower harmony' },
  { id: 'octave_up',   label: 'Octave Up',    short: '+8ve',  semitones: 12,   color: '#af52de', hint: 'Doubles melody one octave higher' },
  { id: 'octave_down', label: 'Octave Down',  short: '−8ve',  semitones: -12,  color: '#ff2d55', hint: 'Deep double one octave below' },
  { id: 'double',      label: 'Double Track', short: 'DBL',   semitones: 0.18, color: '#32d74b', hint: 'Classic double-tracking thickener' },
  { id: 'custom',      label: 'Custom',       short: 'CST',   semitones: 5,    color: '#64d2ff', hint: 'Custom semitone interval' },
];

export interface HarmonyLayerState {
  id:             HarmonyId;
  enabled:        boolean;
  gain:           number;           // 0–1.5 linear
  pan:            number;           // −1 (L) to +1 (R)
  mute:           boolean;
  solo:           boolean;
  fineTune:       number;           // −1 to +1 semitones of additional shift
  customSemitones: number;          // only used when id === 'custom'
}

const LAYER_DEFAULTS: Omit<HarmonyLayerState, 'id'> = {
  enabled: true,
  gain:    0.75,
  pan:     0,
  mute:    false,
  solo:    false,
  fineTune: 0,
  customSemitones: 5,
};

export const DEFAULT_HARMONY_LAYERS: HarmonyLayerState[] = [
  { ...LAYER_DEFAULTS, id: 'third_up',   pan:  0.25 },
  { ...LAYER_DEFAULTS, id: 'third_down', pan: -0.25, enabled: false },
  { ...LAYER_DEFAULTS, id: 'fifth_up',   pan: -0.15, enabled: false },
];

/** Effective semitone shift for a layer (base + fineTune, or custom). */
export function layerSemitones(layer: HarmonyLayerState): number {
  const def = HARMONIES.find(h => h.id === layer.id)!;
  const base = layer.id === 'custom' ? layer.customSemitones : def.semitones;
  return base + layer.fineTune;
}

// ── Key detection ───────────────────────────────────────────────────────────

export function detectKey(
  pitchTimeline: { noteName: string; frequency: number }[],
): string | null {
  if (!pitchTimeline.length) return null;
  const counts = new Map<string, number>();
  for (const { noteName } of pitchTimeline) {
    counts.set(noteName, (counts.get(noteName) ?? 0) + 1);
  }
  let best = '';
  let max = 0;
  for (const [note, count] of counts) {
    if (count > max) { max = count; best = note; }
  }
  return best || null;
}

// ── Buffer cache ────────────────────────────────────────────────────────────

interface TakeCache {
  source:  AudioBuffer;
  shifted: Map<string, AudioBuffer>;  // key = serialised options
}
const cache = new Map<string, TakeCache>();

async function getSource(take: TakeRecord, ctx: AudioContext): Promise<AudioBuffer> {
  const existing = cache.get(take.id);
  if (existing) return existing.source;
  const ab = await take.audioBlob.arrayBuffer();
  const source = await ctx.decodeAudioData(ab.slice(0));
  cache.set(take.id, { source, shifted: new Map() });
  return source;
}

function shiftCacheKey(semitones: number, opts: PitchShiftOptions): string {
  return `${semitones.toFixed(3)}:h${(opts.humanize ?? 0).toFixed(2)}:f${(opts.formantCorrection ?? 0).toFixed(2)}`;
}

async function getShiftedBuffer(
  take: TakeRecord,
  semitones: number,
  ctx: AudioContext,
  opts: PitchShiftOptions = {},
): Promise<AudioBuffer> {
  const source = await getSource(take, ctx);
  const entry  = cache.get(take.id)!;
  const key    = shiftCacheKey(semitones, opts);
  const cached = entry.shifted.get(key);
  if (cached) return cached;
  const shifted = pitchShiftBuffer(ctx, source, semitones, opts);
  entry.shifted.set(key, shifted);
  return shifted;
}

/** Clear the cache for a take (call on delete). */
export function clearTakeCache(takeId: string) {
  cache.delete(takeId);
}

// ── Playback session ────────────────────────────────────────────────────────

export interface HarmonyPlaybackSession {
  stop:     () => void;
  /** Update gain of a layer (index) or 'dry'. */
  setGain:  (layerIdx: number | 'dry', gain: number) => void;
  onEnded:  (cb: () => void) => void;
  duration: number;
}

export interface PlaybackOptions {
  dryGain?:           number;
  humanize?:          number;   // 0–1
  formantCorrection?: number;   // 0–1
}

/**
 * Start synchronised playback of dry vocal + enabled harmony layers.
 * Mute/solo logic is applied before scheduling.
 */
export async function startHarmonyPlayback(
  take:   TakeRecord,
  layers: HarmonyLayerState[],
  ctx:    AudioContext,
  opts:   PlaybackOptions = {},
): Promise<HarmonyPlaybackSession> {
  const { dryGain = 1, humanize = 0, formantCorrection = 0 } = opts;
  const shiftOpts: PitchShiftOptions = { humanize, formantCorrection };

  const source = await getSource(take, ctx);

  const hasSolo = layers.some(l => l.enabled && l.solo && !l.mute);
  const audible = layers.filter(l =>
    l.enabled && !l.mute && (!hasSolo || l.solo),
  );

  await Promise.all(
    audible.map(l => getShiftedBuffer(take, layerSemitones(l), ctx, shiftOpts)),
  );

  const startAt  = ctx.currentTime + 0.05;
  const gainNodes = new Map<number | 'dry', GainNode>();
  const sources:  AudioBufferSourceNode[] = [];

  // Dry vocal
  const drySrc = ctx.createBufferSource();
  drySrc.buffer = source;
  const dryG = ctx.createGain();
  dryG.gain.value = dryGain;
  drySrc.connect(dryG).connect(ctx.destination);
  drySrc.start(startAt);
  gainNodes.set('dry', dryG);
  sources.push(drySrc);

  // Harmony layers
  for (let i = 0; i < audible.length; i++) {
    const layer   = audible[i];
    const key     = shiftCacheKey(layerSemitones(layer), shiftOpts);
    const buf     = cache.get(take.id)?.shifted.get(key);
    if (!buf) continue;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const g = ctx.createGain();
    g.gain.value = layer.gain;

    const panner = ctx.createStereoPanner();
    panner.pan.value = layer.pan;

    src.connect(panner).connect(g).connect(ctx.destination);

    const jitter = humanize * 0.015 * Math.random();
    src.start(startAt + jitter);

    gainNodes.set(i, g);
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

// ── Offline bounce ──────────────────────────────────────────────────────────

export async function bounceHarmonizedTake(
  take:    TakeRecord,
  layers:  HarmonyLayerState[],
  newName: string,
  opts:    PlaybackOptions = {},
): Promise<TakeRecord> {
  const { dryGain = 1, humanize = 0, formantCorrection = 0 } = opts;
  const shiftOpts: PitchShiftOptions = { humanize, formantCorrection };

  const sourceBuf = await blobToAudioBuffer(take.audioBlob);
  const sr    = sourceBuf.sampleRate;
  const numCh = Math.min(2, Math.max(1, sourceBuf.numberOfChannels));

  const offline = new OfflineAudioContext(numCh, sourceBuf.length, sr);

  // Dry
  const drySrc = offline.createBufferSource();
  drySrc.buffer = sourceBuf;
  const dryG = offline.createGain();
  dryG.gain.value = dryGain;
  drySrc.connect(dryG).connect(offline.destination);
  drySrc.start(0);

  // Harmony layers
  const hasSolo = layers.some(l => l.enabled && l.solo && !l.mute);
  for (const layer of layers) {
    if (!layer.enabled || layer.mute) continue;
    if (hasSolo && !layer.solo) continue;

    const shifted = pitchShiftBuffer(offline, sourceBuf, layerSemitones(layer), shiftOpts);
    const src = offline.createBufferSource();
    src.buffer = shifted;

    const g = offline.createGain();
    g.gain.value = layer.gain;

    const panner = offline.createStereoPanner();
    panner.pan.value = layer.pan;

    src.connect(panner).connect(g).connect(offline.destination);
    src.start(0);
  }

  const rendered = await offline.startRendering();
  const blob     = audioBufferToWavBlob(rendered);
  const peaks    = extractWaveformPeaks(rendered, 60);

  const id = `take-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    name:          newName,
    createdAt:     Date.now(),
    durationMs:    Math.round(rendered.duration * 1000),
    audioBlob:     blob,
    waveformPeaks: peaks,
    sampleRate:    rendered.sampleRate,
  };
}

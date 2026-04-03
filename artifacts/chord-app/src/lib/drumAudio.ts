import type { DrumInstrument, DrumPattern, InstFX, KitType, HouseMic, HouseCrashModel, NoteVariation } from '../store/useDrumStore';
import { DRUM_INSTRUMENTS, stepsPerMeasure } from '../store/useDrumStore';
import { getPlugin } from './drumPlugins';
import type { InstPlugin } from './drumPlugins';

// ── Variation → sound/volume helpers ─────────────────────────────────────────

/** Resolve the correct soundId for a hit given its variation. */
export function getSoundForVariation(
  inst:        DrumInstrument,
  variation:   NoteVariation,
  soundMap:    Partial<Record<DrumInstrument, string>>,
  kitDefaults: Partial<Record<DrumInstrument, string>>,
): string {
  if (inst === 'hihat-closed') {
    if (variation === 'open')  return soundMap['hihat-open']  ?? kitDefaults['hihat-open']  ?? 'hh-o-short';
    if (variation === 'pedal') return soundMap['hihat-foot']  ?? kitDefaults['hihat-foot']  ?? 'hh-f-std';
  }
  if (inst === 'snare'  && variation === 'rimshot') return 'snare-rimshot';
  if (inst === 'ride'   && variation === 'bell')    return 'ride-bell';
  return soundMap[inst] ?? kitDefaults[inst] ?? defaultSoundId(inst);
}

/** Volume multiplier for a variation (applied on top of per-instrument vol). */
export function getVolMultForVariation(variation: NoteVariation): number {
  if (variation === 'ghost')  return 0.28;
  if (variation === 'accent') return 1.32;
  return 1.0;
}

// ── Kit definitions ───────────────────────────────────────────────────────────
export const KIT_DEFAULTS: Record<KitType, {
  label:       string;
  description: string;
  soundMap:    Partial<Record<DrumInstrument, string>>;
}> = {
  // ── Acoustic ──────────────────────────────────────────────────────────────
  ludwig: {
    label: 'Pearl Master Studio',
    description: '10-ply maple shells · recorded by Enoe (CC-BY-3.0) · multi-mic, unprocessed',
    soundMap: { kick:'kick-acoustic', snare:'snare-fat', 'hihat-closed':'hh-c-crisp', 'hihat-open':'hh-o-long', 'hihat-foot':'hh-f-std', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-warm', 'tom-floor':'tom-f-std', crash:'crash-std', ride:'ride-std' },
  },
  jazz: {
    label: 'Pearl Master Studio (Brushed)',
    description: 'Snare-03 variant · soft hi-hat · early-room reflections · intimate jazz character',
    soundMap: { kick:'kick-tight', snare:'snare-brush', 'hihat-closed':'hh-c-loose', 'hihat-open':'hh-o-short', crash:'crash-bright', ride:'ride-bell', 'tom-high':'tom-hi-tight', 'tom-mid':'tom-m-std', 'tom-floor':'tom-f-std' },
  },
  // ── Real Music Media Open Source Drum Kit ─────────────────────────────────
  rmm: {
    label: 'Real Music Media Open Source Drum Kit',
    description: 'Commercial-grade studio recording · public domain · 20+ velocity layers per instrument',
    soundMap: { kick:'kick-acoustic', snare:'snare-fat', 'hihat-closed':'hh-c-crisp', 'hihat-open':'hh-o-long', 'hihat-foot':'hh-f-std', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-warm', 'tom-floor':'tom-f-std', crash:'crash-std', ride:'ride-std' },
  },
  // ── Chrome Web Audio Acoustic Kit ─────────────────────────────────────────
  chrome: {
    label: 'Chrome Web Audio Acoustic Kit',
    description: 'Acoustic recording by Chris Wilson (cwilso / Google) · used in original Web Audio API demos',
    soundMap: { kick:'kick-acoustic', snare:'snare-crack', 'hihat-closed':'hh-c-crisp', 'hihat-open':'hh-o-short', 'hihat-foot':'hh-f-std', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-warm', 'tom-floor':'tom-f-std', crash:'crash-std', ride:'ride-std' },
  },
  // ── Ultra-HD House Kit (multi-velocity local Opus samples) ─────────────────
  house: {
    label: 'House Kit',
    description: 'Premium studio recording · 5 velocity layers · 7 round-robin variations · 4 mic positions',
    soundMap: { kick:'kick-acoustic', snare:'snare-fat', 'hihat-closed':'hh-c-crisp', 'hihat-open':'hh-o-long', 'hihat-foot':'hh-f-std', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-warm', 'tom-floor':'tom-f-std', crash:'crash-std', ride:'ride-std' },
  },
  rock: {
    label: 'Rock Kit', description: 'Big punchy kick, fat cracking snare',
    soundMap: { kick:'kick-acoustic', snare:'snare-fat', 'hihat-closed':'hh-c-crisp', 'hihat-open':'hh-o-wash', 'hihat-foot':'hh-f-std', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-warm', 'tom-floor':'tom-f-deep', crash:'crash-std', ride:'ride-std' },
  },
  vintage: {
    label: "Vintage '60s", description: 'Woodsy warm tones, open resonance',
    soundMap: { kick:'kick-std', snare:'snare-fat', 'hihat-closed':'hh-c-crisp', 'hihat-open':'hh-o-long', crash:'crash-bright', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-warm', 'tom-floor':'tom-f-std' },
  },
  // ── Studio ────────────────────────────────────────────────────────────────
  studio: {
    label: 'Studio A', description: 'Clean compressed bright studio kit',
    soundMap: { kick:'kick-tight', snare:'snare-crack', 'hihat-closed':'hh-c-tight', 'hihat-open':'hh-o-short', crash:'crash-bright', ride:'ride-std', 'tom-high':'tom-hi-tight', 'tom-mid':'tom-m-std', 'tom-floor':'tom-f-std' },
  },
  r8: {
    label: 'Roland R8', description: '1989 electronic-acoustic hybrid',
    soundMap: { kick:'kick-tight', snare:'snare-rimshot', 'hihat-closed':'hh-c-loose', 'hihat-open':'hh-o-wash', crash:'crash-bright', ride:'ride-std', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-std', 'tom-floor':'tom-f-deep' },
  },
  linn: {
    label: 'LinnDrum', description: '1982 sample-based drum machine',
    soundMap: { kick:'kick-std', snare:'snare-crack', 'hihat-closed':'hh-c-tight', 'hihat-open':'hh-o-short', crash:'crash-std', ride:'ride-bell', 'tom-high':'tom-hi-tight' },
  },
  funk: {
    label: 'Funk Kit', description: 'Tight snappy groove machine',
    soundMap: { kick:'kick-tight', snare:'snare-crack', 'hihat-closed':'hh-c-tight', 'hihat-open':'hh-o-short', 'hihat-foot':'hh-f-splash', crash:'crash-bright', ride:'ride-bell', 'tom-high':'tom-hi-tight' },
  },
  // ── Electric ──────────────────────────────────────────────────────────────
  cr78: {
    label: 'Roland CR-78', description: '1978 vintage analog drum machine',
    soundMap: { kick:'kick-std', snare:'snare-crack', 'hihat-closed':'hh-c-tight', crash:'crash-china', 'tom-high':'tom-hi-tight' },
  },
  tr808: {
    label: 'Roland TR-808', description: '1980 deep bass hip-hop classic',
    soundMap: { kick:'kick-808', snare:'snare-fat', 'hihat-closed':'hh-c-tight', 'hihat-open':'hh-o-short', crash:'crash-std', 'tom-high':'tom-hi-tight' },
  },
  techno: {
    label: 'Techno Kit', description: 'Hard punching industrial rave',
    soundMap: { kick:'kick-tight', snare:'snare-crack', 'hihat-closed':'hh-c-tight', 'hihat-foot':'hh-f-std', crash:'crash-china', 'tom-high':'tom-hi-tight' },
  },
  stark: {
    label: 'Stark Industrial', description: 'Cold metallic machine sounds',
    soundMap: { kick:'kick-808', snare:'snare-rimshot', 'hihat-closed':'hh-c-tight', 'hihat-open':'hh-o-short', crash:'crash-china' },
  },
};

// ── Sound variant catalogue ─────────────────────────────────────────────────
export interface SoundVariant { id: string; label: string; }

export const SOUND_VARIANTS: Record<DrumInstrument, SoundVariant[]> = {
  kick:           [{ id: 'kick-std',      label: 'Standard'      }, { id: 'kick-tight', label: 'Tight'     }, { id: 'kick-808', label: '808 Sub'  }, { id: 'kick-acoustic', label: 'Acoustic' }],
  snare:          [{ id: 'snare-crack',   label: 'Crack'         }, { id: 'snare-fat',  label: 'Fat'       }, { id: 'snare-brush', label: 'Brush' }, { id: 'snare-rimshot', label: 'Rimshot' }],
  'hihat-closed': [{ id: 'hh-c-tight',   label: 'Tight'         }, { id: 'hh-c-crisp', label: 'Crisp'     }, { id: 'hh-c-loose', label: 'Slightly Open' }],
  'hihat-open':   [{ id: 'hh-o-short',   label: 'Short'         }, { id: 'hh-o-long',  label: 'Long'      }, { id: 'hh-o-wash',  label: 'Wash'   }],
  'hihat-foot':   [{ id: 'hh-f-std',     label: 'Standard'      }, { id: 'hh-f-splash',label: 'Splash'    }],
  'tom-high':     [{ id: 'tom-hi-std',   label: 'Standard'      }, { id: 'tom-hi-tight',label: 'Tight'    }],
  'tom-mid':      [{ id: 'tom-m-std',    label: 'Standard'      }, { id: 'tom-m-warm', label: 'Warm'      }],
  'tom-floor':    [{ id: 'tom-f-std',    label: 'Standard'      }, { id: 'tom-f-deep', label: 'Deep'      }],
  crash:          [{ id: 'crash-std',    label: 'Standard'      }, { id: 'crash-china',label: 'China'     }, { id: 'crash-bright', label: 'Bright' }],
  ride:           [{ id: 'ride-std',     label: 'Standard'      }, { id: 'ride-bell',  label: 'Bell'      }, { id: 'ride-wash',  label: 'Wash'   }],
};

export function defaultSoundId(inst: DrumInstrument): string {
  return SOUND_VARIANTS[inst][0].id;
}
export function soundVariantLabel(inst: DrumInstrument, id: string): string {
  return SOUND_VARIANTS[inst].find(v => v.id === id)?.label ?? id;
}

// ── Per-kit acoustic character config ────────────────────────────────────────
// rate: playback speed (pitch).  >1 = higher/brighter, <1 = lower/darker.
// gain: volume multiplier applied on top of master vol.
// roomMs: early-reflection delay in ms (0 = dry).  Used for jazz & vintage.
interface KitInstCfg { rate: number; gain: number; roomMs?: number }
const KIT_ACOUSTIC_CFG: Partial<Record<KitType, Partial<Record<DrumInstrument, KitInstCfg>>>> = {
  // Pearl Master Studio — natural/warm. Counteract BASE_RATE to play toms at native pitch.
  ludwig: {
    'tom-high':     { rate: 0.74, gain: 1.00 },   // 1.35 × 0.74 ≈ 1.00 — native pitch
    'tom-floor':    { rate: 1.25, gain: 1.00 },   // 0.80 × 1.25 = 1.00 — native pitch
  },
  // Pearl Master Studio (Brushed) — intimate small-room, soft room bloom
  jazz: {
    kick:           { rate: 0.87, gain: 0.80, roomMs: 18 },
    snare:          { rate: 0.90, gain: 0.70, roomMs: 14 },
    'hihat-closed': { rate: 0.96, gain: 0.56 },
    'hihat-open':   { rate: 0.96, gain: 0.60 },
    'hihat-foot':   { rate: 0.96, gain: 0.50 },
    'tom-high':     { rate: 0.63, gain: 0.80, roomMs: 16 },
    'tom-mid':      { rate: 0.90, gain: 0.80, roomMs: 14 },
    'tom-floor':    { rate: 1.10, gain: 0.80, roomMs: 18 },
  },
  // Rock — punchy, cracking attack; toms at native-pitch (Pearl already tuned distinctly)
  rock: {
    kick:           { rate: 1.06, gain: 1.22 },
    snare:          { rate: 1.08, gain: 1.25 },
    'hihat-closed': { rate: 1.02, gain: 1.04 },
    'hihat-open':   { rate: 1.00, gain: 1.00 },
    'hihat-foot':   { rate: 1.02, gain: 1.02 },
    'tom-high':     { rate: 0.74, gain: 1.12 },
    'tom-mid':      { rate: 1.05, gain: 1.10 },
    'tom-floor':    { rate: 1.19, gain: 1.12 },
  },
  // Vintage '60s — boomy/warm; all toms lowered & given generous early room decay
  vintage: {
    kick:           { rate: 0.76, gain: 0.90, roomMs: 24 },
    snare:          { rate: 0.80, gain: 0.84, roomMs: 20 },
    'hihat-closed': { rate: 0.90, gain: 0.72 },
    'hihat-open':   { rate: 0.90, gain: 0.78 },
    'tom-high':     { rate: 0.59, gain: 0.90, roomMs: 20 },
    'tom-mid':      { rate: 0.84, gain: 0.90, roomMs: 20 },
    'tom-floor':    { rate: 1.06, gain: 0.90, roomMs: 20 },
  },
  // Real Music Media OSDK — punchy studio feel, slight brightness boost.
  // Only one tom size in the kit; rate-shift to simulate hi/mid/floor.
  rmm: {
    kick:           { rate: 1.02, gain: 1.10 },
    snare:          { rate: 1.04, gain: 1.15 },
    'hihat-closed': { rate: 1.00, gain: 1.00 },
    'hihat-open':   { rate: 1.00, gain: 1.00 },
    'hihat-foot':   { rate: 1.00, gain: 0.90 },
    'tom-high':     { rate: 1.40, gain: 1.05 },   // pitch up for hi tom
    'tom-mid':      { rate: 1.00, gain: 1.05 },   // natural pitch for mid
    'tom-floor':    { rate: 0.68, gain: 1.10 },   // pitch down for floor tom
    crash:          { rate: 1.00, gain: 1.00 },
    ride:           { rate: 1.00, gain: 0.95 },
  },
  // Chrome Web Audio Acoustic — bright, articulate; keep natural character
  chrome: {
    kick:           { rate: 1.00, gain: 1.05 },
    snare:          { rate: 1.00, gain: 1.00 },
    'hihat-closed': { rate: 1.05, gain: 0.95 },
    'hihat-open':   { rate: 1.00, gain: 1.00 },
    'hihat-foot':   { rate: 1.00, gain: 0.85 },
    'tom-high':     { rate: 1.00, gain: 1.00 },
    'tom-mid':      { rate: 1.00, gain: 1.00 },
    'tom-floor':    { rate: 1.00, gain: 1.05 },
  },
  // House Kit — samples are native pitch/gain; toms use separate files per size
  house: {
    kick:       { rate: 1.00, gain: 1.00 },
    snare:      { rate: 1.00, gain: 1.00 },
    'tom-high': { rate: 1.00, gain: 1.00 },
    'tom-mid':  { rate: 1.00, gain: 1.00 },
    'tom-floor':{ rate: 1.00, gain: 1.00 },
  },
};

// ── Map soundId → instrument ────────────────────────────────────────────────
function soundIdToInst(id: string): DrumInstrument | null {
  if (id.startsWith('kick-'))       return 'kick';
  if (id.startsWith('snare-'))      return 'snare';
  if (id.startsWith('hh-c'))        return 'hihat-closed';
  if (id.startsWith('hh-o'))        return 'hihat-open';
  if (id.startsWith('hh-f'))        return 'hihat-foot';
  if (id.startsWith('tom-hi'))      return 'tom-high';
  if (id.startsWith('tom-m'))       return 'tom-mid';
  if (id.startsWith('tom-f'))       return 'tom-floor';
  if (id.startsWith('crash-'))      return 'crash';
  if (id.startsWith('ride-'))       return 'ride';
  return null;
}

// (Gate is implemented per-note as a scheduled GainNode envelope in playSoundAt,
//  not as a persistent AudioWorklet. See playSoundAt for the implementation.)

// ── AudioContext singleton ──────────────────────────────────────────────────
let _ctx:        AudioContext | null = null;
let _compressor: DynamicsCompressorNode | null = null;
let _masterGain: GainNode | null = null;

function getCtx(): { ctx: AudioContext; dest: AudioNode } {
  if (!_ctx) {
    _ctx = new AudioContext();

    _masterGain = _ctx.createGain();
    _masterGain.gain.value = 0.85;

    _compressor = _ctx.createDynamicsCompressor();
    _compressor.threshold.value = -14;
    _compressor.knee.value       = 8;
    _compressor.ratio.value      = 4;
    _compressor.attack.value     = 0.003;
    _compressor.release.value    = 0.15;

    _masterGain.connect(_compressor);
    _compressor.connect(_ctx.destination);
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return { ctx: _ctx, dest: _masterGain! };
}

// ── WaveShaperNode (soft saturation) ────────────────────────────────────────
function makeSaturationCurve(k = 50): Float32Array<ArrayBuffer> {
  const n    = 256;
  const arr  = new Float32Array(new ArrayBuffer(n * 4));
  const deg  = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    arr[i]  = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return arr;
}

// ── Noise helper ────────────────────────────────────────────────────────────
function makeNoise(ctx: AudioContext, dur: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ── Kit-specific sample URLs ──────────────────────────────────────────────────
// PEARL  — oramics.github.io/sampled  GitHub Pages, CORS *, CC-BY-3.0
// OSDK   — raw.githubusercontent.com/crabacus  Real Music Media, Public Domain, 20+ velocity layers
// MIDI   — raw.githubusercontent.com/cwilso   Chrome Web Audio API acoustic kit
const PEARL  = 'https://oramics.github.io/sampled/DRUMS/pearl-master-studio/samples/'; // CC-BY-3.0
const LM2    = 'https://oramics.github.io/sampled/DM/LM-2/samples/';                   // Public Domain
const CR78O  = 'https://oramics.github.io/sampled/DM/CR-78/samples/';                  // Public Domain
const TR505  = 'https://oramics.github.io/sampled/DM/TR-505/samples/';                 // Public Domain
const TR909  = 'https://oramics.github.io/sampled/DM/TR-909/Detroit/samples/';         // free
const MIDI   = 'https://raw.githubusercontent.com/cwilso/MIDIDrums/master/sounds/drum-samples/';
const TONEJS = 'https://tonejs.github.io/audio/drum-samples/';
// Real Music Media Open Source Drum Kit — public domain, commercial studio quality
const OSDK   = 'https://raw.githubusercontent.com/crabacus/the-open-source-drumkit/master/';

// Each kit maps to real recorded samples; first URL is primary, rest are fallbacks.
const KIT_SAMPLE_URLS: Record<KitType, Partial<Record<DrumInstrument, string[]>>> = {
  // ── Acoustic — Pearl Master Studio (CC-BY-3.0, real Pearl drums recorded in studio) ──
  // Ludwig Classic — warm, natural full kit
  ludwig: {
    kick:           [`${PEARL}kick-01.wav`,            `${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${PEARL}snare-01.wav`,           `${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${PEARL}hihat-closed.wav`,       `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-open':   [`${PEARL}hihat-open.wav`,         `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-foot':   [`${PEARL}hihat-closed.wav`,       `${MIDI}acoustic-kit/hihat.wav`],
    'tom-high':     [`${PEARL}tom-01.wav`,             `${MIDI}acoustic-kit/tom1.wav`],
    'tom-mid':      [`${PEARL}tom-02.wav`,             `${MIDI}acoustic-kit/tom2.wav`],
    'tom-floor':    [`${PEARL}tom-03.wav`,             `${MIDI}acoustic-kit/tom3.wav`],
    crash:          [`${PEARL}crash-01.wav`,           `${TONEJS}CR78/crash.mp3`],
    ride:           [`${PEARL}ride-01.wav`,            `${TONEJS}CR78/ride.mp3`],
  },
  // Pearl Master Studio (Brushed) — snare-03 is the most open/roomy variation
  jazz: {
    kick:           [`${PEARL}kick-01.wav`,            `${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${PEARL}snare-03.wav`,           `${PEARL}snare-02.wav`,        `${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${PEARL}hihat-closed.wav`,       `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-open':   [`${PEARL}hihat-open.wav`,         `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-foot':   [`${PEARL}hihat-closed.wav`,       `${MIDI}acoustic-kit/hihat.wav`],
    'tom-high':     [`${PEARL}tom-01.wav`,             `${MIDI}acoustic-kit/tom1.wav`],
    'tom-mid':      [`${PEARL}tom-02.wav`,             `${MIDI}acoustic-kit/tom2.wav`],
    'tom-floor':    [`${PEARL}tom-03.wav`,             `${MIDI}acoustic-kit/tom3.wav`],
    crash:          [`${PEARL}crash-02.wav`,           `${TONEJS}CR78/crash.mp3`],
    ride:           [`${PEARL}ride-02.wav`,            `${TONEJS}CR78/ride.mp3`],
  },
  // Rock Kit — Pearl kit, cracking snare variation, both crash cymbals
  rock: {
    kick:           [`${PEARL}kick-01.wav`,            `${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${PEARL}snare-01.wav`,           `${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${PEARL}hihat-closed.wav`,       `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-open':   [`${PEARL}hihat-open.wav`,         `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-foot':   [`${PEARL}hihat-closed.wav`,       `${MIDI}acoustic-kit/hihat.wav`],
    'tom-high':     [`${PEARL}tom-01.wav`,             `${MIDI}acoustic-kit/tom1.wav`],
    'tom-mid':      [`${PEARL}tom-02.wav`,             `${MIDI}acoustic-kit/tom2.wav`],
    'tom-floor':    [`${PEARL}tom-03.wav`,             `${MIDI}acoustic-kit/tom3.wav`],
    crash:          [`${PEARL}crash-01.wav`,           `${PEARL}crash-02.wav`,        `${TONEJS}CR78/crash.mp3`],
    ride:           [`${PEARL}ride-01.wav`,            `${TONEJS}CR78/ride.mp3`],
  },
  // Vintage '60s — Pearl kit, third snare variation (more open/roomy), pitched down in DSP
  vintage: {
    kick:           [`${PEARL}kick-01.wav`,            `${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${PEARL}snare-03.wav`,           `${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${PEARL}hihat-closed.wav`,       `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-open':   [`${PEARL}hihat-open.wav`,         `${MIDI}acoustic-kit/hihat.wav`],
    'tom-high':     [`${PEARL}tom-01.wav`,             `${MIDI}acoustic-kit/tom1.wav`],
    'tom-mid':      [`${PEARL}tom-02.wav`,             `${MIDI}acoustic-kit/tom2.wav`],
    'tom-floor':    [`${PEARL}tom-03.wav`,             `${MIDI}acoustic-kit/tom3.wav`],
    crash:          [`${PEARL}crash-02.wav`,           `${TONEJS}CR78/crash.mp3`],
    ride:           [`${PEARL}ride-02.wav`,            `${TONEJS}CR78/ride.mp3`],
  },
  // ── Studio ─────────────────────────────────────────────────────────────────
  // Studio A — LM-2 (LinnDrum), the iconic studio machine of the 80s
  studio: {
    kick:           [`${LM2}kick.wav`,                 `${MIDI}R8/kick.wav`],
    snare:          [`${LM2}snare-h.wav`,              `${MIDI}R8/snare.wav`],
    'hihat-closed': [`${LM2}hihat-closed.wav`,         `${MIDI}LINN/hihat.wav`],
    'hihat-open':   [`${LM2}hihat-open.wav`,           `${MIDI}LINN/hihat.wav`],
    crash:          [`${LM2}crash.wav`,                `${TONEJS}CR78/crash.mp3`],
    ride:           [`${LM2}ride.wav`,                 `${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${LM2}conga-h.wav`,              `${MIDI}R8/tom1.wav`],
    'tom-mid':      [`${LM2}conga-m.wav`,              `${MIDI}R8/tom2.wav`],
    'tom-floor':    [`${LM2}conga-l.wav`,              `${MIDI}R8/tom3.wav`],
  },
  // Roland R8 — TR-505 (clean digital hits, same late-80s Roland era as R8)
  r8: {
    kick:           [`${TR505}tr505-kick.wav`,         `${MIDI}R8/kick.wav`],
    snare:          [`${TR505}tr505-snare.wav`,        `${MIDI}R8/snare.wav`],
    'hihat-closed': [`${TR505}tr505-hihat-closed.wav`, `${MIDI}R8/hihat.wav`],
    'hihat-open':   [`${TR505}tr505-hihat-open.wav`,   `${MIDI}LINN/hihat.wav`],
    crash:          [`${TR505}tr505-crash.wav`,        `${TONEJS}CR78/crash.mp3`],
    ride:           [`${TR505}tr505-ride.wav`,         `${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${TR505}tr505-tom-h.wav`,        `${MIDI}R8/tom1.wav`],
    'tom-mid':      [`${TR505}tr505-tom-m.wav`,        `${MIDI}R8/tom2.wav`],
    'tom-floor':    [`${TR505}tr505-tom-l.wav`,        `${MIDI}R8/tom3.wav`],
  },
  // LinnDrum — authentic LM-2 (Public Domain, original 1982 hardware samples)
  linn: {
    kick:           [`${LM2}kick.wav`,                 `${LM2}kick-alt.wav`,          `${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${LM2}snare-h.wav`,              `${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${LM2}hihat-closed-short.wav`,   `${MIDI}LINN/hihat.wav`],
    'hihat-open':   [`${LM2}hihat-open.wav`,           `${MIDI}LINN/hihat.wav`],
    crash:          [`${LM2}crash.wav`,                `${TONEJS}CR78/crash.mp3`],
    ride:           [`${LM2}ride.wav`,                 `${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${LM2}conga-hh.wav`,             `${MIDI}acoustic-kit/tom1.wav`],
  },
  // Funk Kit — LM-2 (the LinnDrum defined 80s funk; Prince, Michael Jackson, etc.)
  funk: {
    kick:           [`${LM2}kick.wav`,                 `${LM2}kick-alt.wav`,          `${MIDI}Techno/kick.wav`],
    snare:          [`${LM2}snare-m.wav`,              `${LM2}snare-h.wav`,           `${MIDI}R8/snare.wav`],
    'hihat-closed': [`${LM2}hihat-closed-short.wav`,   `${MIDI}LINN/hihat.wav`],
    'hihat-open':   [`${LM2}hihat-open.wav`,           `${MIDI}LINN/hihat.wav`],
    'hihat-foot':   [`${LM2}hihat-closed.wav`,         `${MIDI}LINN/hihat.wav`],
    crash:          [`${LM2}crash.wav`,                `${TONEJS}CR78/crash.mp3`],
    ride:           [`${LM2}ride.wav`,                 `${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${LM2}conga-h.wav`,              `${MIDI}R8/tom1.wav`],
  },
  // ── Electric ───────────────────────────────────────────────────────────────
  // Roland CR-78 — oramics authentic samples (Public Domain, 1978 analog rhythm machine)
  cr78: {
    kick:           [`${CR78O}kick.wav`,               `${TONEJS}CR78/kick.mp3`],
    snare:          [`${CR78O}snare.wav`,              `${TONEJS}CR78/snare.mp3`],
    'hihat-closed': [`${CR78O}hihat.wav`,              `${TONEJS}CR78/hihat.mp3`],
    'hihat-open':   [`${CR78O}hihat-accent.wav`,       `${TONEJS}CR78/hihat.mp3`],
    crash:          [`${CR78O}cymbal.wav`,             `${TONEJS}CR78/crash.mp3`],
    'tom-high':     [`${CR78O}bongo-h.wav`,            `${TONEJS}CR78/highTom.mp3`],
    'tom-mid':      [`${CR78O}bongo-l.wav`,            `${TONEJS}CR78/highTom.mp3`],
  },
  // Roland TR-808 — authentic 4OP-FM samples (unique sub-bass boom, can't substitute)
  tr808: {
    kick:           [`${MIDI}4OP-FM/kick.wav`],
    snare:          [`${MIDI}4OP-FM/snare.wav`],
    'hihat-closed': [`${TR505}tr505-hihat-closed.wav`, `${MIDI}4OP-FM/hihat.wav`],
    'hihat-open':   [`${TR505}tr505-hihat-open.wav`,   `${MIDI}4OP-FM/hihat.wav`],
    crash:          [`${TR505}tr505-crash.wav`,        `${MIDI}4OP-FM/tom3.wav`],
    'tom-high':     [`${MIDI}4OP-FM/tom1.wav`],
  },
  // Techno — TR-505 (Public Domain Roland 505, the workhorse of 90s techno/house)
  techno: {
    kick:           [`${TR505}tr505-kick.wav`,         `${MIDI}Techno/kick.wav`],
    snare:          [`${TR505}tr505-snare.wav`,        `${MIDI}Techno/snare.wav`],
    'hihat-closed': [`${TR505}tr505-hihat-closed.wav`, `${MIDI}Techno/hihat.wav`],
    'hihat-open':   [`${TR505}tr505-hihat-open.wav`,   `${MIDI}Stark/hihat.wav`],
    'hihat-foot':   [`${TR505}tr505-hihat-closed.wav`, `${MIDI}Stark/hihat.wav`],
    crash:          [`${TR505}tr505-crash.wav`,        `${MIDI}Stark/tom3.wav`],
    ride:           [`${TR505}tr505-ride.wav`,         `${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${TR505}tr505-tom-h.wav`,        `${MIDI}Techno/tom1.wav`],
    'tom-mid':      [`${TR505}tr505-tom-m.wav`],
    'tom-floor':    [`${TR505}tr505-tom-l.wav`],
  },
  // Stark Industrial — TR-909 Detroit + cwilso Stark (warm recorded 909 with metallic edge)
  stark: {
    kick:           [`${TR909}kick.wav`,               `${MIDI}4OP-FM/kick.wav`,      `${MIDI}Stark/tom3.wav`],
    snare:          [`${TR909}snare.wav`,              `${MIDI}Techno/snare.wav`,     `${MIDI}4OP-FM/snare.wav`],
    'hihat-closed': [`${TR909}hihat-closed.wav`,       `${MIDI}Stark/hihat.wav`],
    'hihat-open':   [`${TR909}hihat-open-1.wav`,       `${MIDI}Stark/hihat.wav`],
    crash:          [`${TR909}cymbal.wav`,             `${MIDI}Stark/tom3.wav`,       `${MIDI}4OP-FM/tom3.wav`],
    ride:           [`${TR909}ride.wav`,               `${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${TR909}tom-h.wav`,              `${MIDI}4OP-FM/tom1.wav`],
    'tom-floor':    [`${TR909}tom-l.wav`,              `${MIDI}4OP-FM/tom3.wav`],
  },
  // ── Real Music Media Open Source Drum Kit (crabacus/the-open-source-drumkit) ──
  // Public Domain. 20+ velocity layers. kick10/snare-top10 = mid-velocity (natural feel).
  // All toms use the same "large-tom" sample; rate-shifting in KIT_ACOUSTIC_CFG creates hi/mid/floor.
  // Pearl hihat used as primary (crabacus hihat has non-standard filenames).
  rmm: {
    kick:           [`${OSDK}kick/kick10.wav`,          `${OSDK}kick/kick8.wav`,       `${PEARL}kick-01.wav`,   `${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${OSDK}snare/snare-top10.wav`,    `${OSDK}snare/snare-top8.wav`, `${PEARL}snare-01.wav`,  `${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${PEARL}hihat-closed.wav`,        `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-open':   [`${PEARL}hihat-open.wav`,          `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-foot':   [`${PEARL}hihat-closed.wav`,        `${MIDI}acoustic-kit/hihat.wav`],
    'tom-high':     [`${OSDK}toms/large-tom5.wav`,      `${OSDK}toms/large-tom3.wav`,  `${PEARL}tom-01.wav`,   `${MIDI}acoustic-kit/tom1.wav`],
    'tom-mid':      [`${OSDK}toms/large-tom5.wav`,      `${OSDK}toms/large-tom3.wav`,  `${PEARL}tom-02.wav`,   `${MIDI}acoustic-kit/tom2.wav`],
    'tom-floor':    [`${OSDK}toms/large-tom5.wav`,      `${OSDK}toms/large-tom3.wav`,  `${PEARL}tom-03.wav`,   `${MIDI}acoustic-kit/tom3.wav`],
    crash:          [`${OSDK}crash/crash10.wav`,        `${OSDK}crash/crash8.wav`,     `${PEARL}crash-01.wav`, `${TONEJS}CR78/crash.mp3`],
    ride:           [`${OSDK}ride/ride-mid-in8.wav`,    `${OSDK}ride/ride-mid-out5.wav`,`${PEARL}ride-01.wav`, `${TONEJS}CR78/ride.mp3`],
  },
  // ── Chrome Web Audio Acoustic Kit (cwilso/MIDIDrums acoustic-kit) ─────────
  // By Chris Wilson (Google). Used in the original Chrome Web Audio API demo.
  // Simple 1-layer per instrument; Pearl cymbals used as they are not in this kit.
  chrome: {
    kick:           [`${MIDI}acoustic-kit/kick.wav`,    `${PEARL}kick-01.wav`],
    snare:          [`${MIDI}acoustic-kit/snare.wav`,   `${PEARL}snare-01.wav`],
    'hihat-closed': [`${MIDI}acoustic-kit/hihat.wav`,   `${PEARL}hihat-closed.wav`],
    'hihat-open':   [`${MIDI}acoustic-kit/hihat.wav`,   `${PEARL}hihat-open.wav`],
    'hihat-foot':   [`${MIDI}acoustic-kit/hihat.wav`,   `${PEARL}hihat-closed.wav`],
    'tom-high':     [`${MIDI}acoustic-kit/tom1.wav`,    `${PEARL}tom-01.wav`],
    'tom-mid':      [`${MIDI}acoustic-kit/tom2.wav`,    `${PEARL}tom-02.wav`],
    'tom-floor':    [`${MIDI}acoustic-kit/tom3.wav`,    `${PEARL}tom-03.wav`],
    crash:          [`${PEARL}crash-01.wav`,            `${TONEJS}CR78/crash.mp3`],
    ride:           [`${PEARL}ride-01.wav`,             `${TONEJS}CR78/ride.mp3`],
  },
  // house uses HouseKitPool (local Opus), not KIT_SAMPLE_URLS
  house: {},
};

export type SampleStatus = 'idle' | 'loading' | 'partial' | 'ready' | 'failed';

// Kit-aware sample pool — buffers stored as `${kit}:${inst}`
class SamplePool {
  private _buffers: Partial<Record<string, AudioBuffer>> = {};
  private _kitLoaded:  Partial<Record<string, boolean>> = {};
  private _kitLoading: Partial<Record<string, boolean>> = {};
  private _status: SampleStatus = 'idle';
  private _loaded = 0;
  private _total  = 0;

  onStatusChange: ((s: SampleStatus, loaded: number, total: number) => void) | null = null;

  private _setStatus(s: SampleStatus) {
    this._status = s;
    this.onStatusChange?.(s, this._loaded, this._total);
  }

  async loadForKit(kit: KitType, ctx: AudioContext) {
    if (this._kitLoaded[kit] || this._kitLoading[kit]) return;
    this._kitLoading[kit] = true;

    const urls = KIT_SAMPLE_URLS[kit];
    const entries = Object.entries(urls) as [DrumInstrument, string[]][];
    this._total  = entries.length;
    this._loaded = 0;
    this._setStatus('loading');

    await Promise.all(entries.map(async ([inst, urlList]) => {
      for (const url of urlList) {
        try {
          const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
          if (!resp.ok) continue;
          const ab  = await resp.arrayBuffer();
          const buf = await ctx.decodeAudioData(ab);
          this._buffers[`${kit}:${inst}`] = buf;
          break;
        } catch { continue; }
      }
      this._loaded++;
      this._setStatus(this._loaded === this._total ? 'ready' : 'partial');
    }));

    this._kitLoaded[kit]  = true;
    this._kitLoading[kit] = false;
    if (this._loaded === 0) this._setStatus('failed');
  }

  getForKit(kit: KitType, inst: DrumInstrument): AudioBuffer | undefined {
    return this._buffers[`${kit}:${inst}`];
  }
  hasForKit(kit: KitType, inst: DrumInstrument): boolean {
    return !!this._buffers[`${kit}:${inst}`];
  }

  // Backward-compat shims (no-kit path, used by synthesis fallback only)
  get(inst: DrumInstrument): AudioBuffer | undefined { return undefined; }
  has(inst: DrumInstrument): boolean { return false; }
  get status(): SampleStatus { return this._status; }
  get loadedCount(): number   { return this._loaded; }
  get totalCount():  number   { return this._total;  }
}

export const samplePool = new SamplePool();

/** Load samples for the chosen kit on first play */
export function loadDrumSamples(kit: KitType) {
  if (kit === 'house') return; // House kit loaded separately via loadHouseKit()
  const { ctx } = getCtx();
  samplePool.loadForKit(kit, ctx);
}

// ── House Kit — multi-velocity local Opus sample pool ───────────────────────
// Instruments: kick, snare, tom10 (tom-high), tom12 (tom-mid), tom14 (tom-floor), tom16 (unused)
// Velocity layers: kick/toms: hard/med/soft; snare: crack/hard/medhard/medsoft/soft
// Round-robins: 1–7 per velocity layer

export type HouseInstName = 'kick' | 'snare' | 'tom10' | 'tom12' | 'tom14';

const HOUSE_INST_MAP: Partial<Record<DrumInstrument, HouseInstName>> = {
  kick:       'kick',
  snare:      'snare',
  'tom-high': 'tom10',
  'tom-mid':  'tom12',
  'tom-floor':'tom14',
};

// ── Velocity metadata exported for UI ────────────────────────────────────────
export type HouseVelConfig = { id: string; label: string };
export const HOUSE_VEL_CONFIGS: Record<HouseInstName, HouseVelConfig[]> = {
  kick:  [{ id: 'hard', label: 'Hard' }, { id: 'med',     label: 'Medium' }, { id: 'soft',    label: 'Soft'   }],
  snare: [{ id: 'crack',label: 'Crack'}, { id: 'hard',    label: 'Hard'   }, { id: 'medhard', label: 'Med Hi' },
          { id: 'medsoft', label: 'Med Lo' },                                 { id: 'soft',    label: 'Soft'   }],
  tom10: [{ id: 'hard', label: 'Hard' }, { id: 'med',     label: 'Medium' }, { id: 'soft',    label: 'Soft'   }],
  tom12: [{ id: 'hard', label: 'Hard' }, { id: 'med',     label: 'Medium' }, { id: 'soft',    label: 'Soft'   }],
  tom14: [{ id: 'hard', label: 'Hard' }, { id: 'med',     label: 'Medium' }, { id: 'soft',    label: 'Soft'   }],
};
export const HOUSE_INST_LABELS: Record<HouseInstName, string> = {
  kick: 'Kick', snare: 'Snare', tom10: 'Hi Tom', tom12: 'Mid Tom', tom14: 'Floor Tom',
};

// Velocity selection from NoteVariation
const HOUSE_KICK_VEL: Record<string, string> = {
  ghost: 'soft', normal: 'med', accent: 'hard', flam: 'med',
};
// Snare has: crack / hard / medhard / medsoft / soft  (NO 'med' layer)
const HOUSE_SNARE_VEL: Record<string, string> = {
  ghost: 'soft', normal: 'medhard', rimshot: 'hard', accent: 'hard',
  flam: 'medsoft', crack: 'crack',
};
const HOUSE_TOM_VEL: Record<string, string> = {
  ghost: 'soft', normal: 'med', accent: 'hard', flam: 'med',
};

// Per-instrument velocity override — set from UI, bypasses dynamic velocity mapping
let _houseInstVelOverride: Partial<Record<HouseInstName, string>> = {};
export function setHouseInstVelOverrides(map: Partial<Record<string, string>>) {
  _houseInstVelOverride = map as Partial<Record<HouseInstName, string>>;
}

function houseVelForVariation(inst: DrumInstrument, variation: NoteVariation): string {
  const houseInst = HOUSE_INST_MAP[inst];
  if (houseInst && _houseInstVelOverride[houseInst]) {
    return _houseInstVelOverride[houseInst]!;
  }
  if (inst === 'snare') return HOUSE_SNARE_VEL[variation] ?? 'medhard';
  if (inst === 'kick')  return HOUSE_KICK_VEL[variation]  ?? 'med';
  return HOUSE_TOM_VEL[variation] ?? 'med';
}

class HouseKitPool {
  private _buffers  = new Map<string, AudioBuffer>();
  private _loaded   = false;
  private _loading  = false;
  private _mic: HouseMic = 'blend';
  private _rrCounters: Partial<Record<HouseInstName, number>> = {};
  onStatusChange: ((loaded: number, total: number) => void) | null = null;

  get mic(): HouseMic { return this._mic; }
  get ready(): boolean { return this._loaded; }

  private _key(inst: HouseInstName, mic: HouseMic, vel: string, rr: number): string {
    return `${inst}:${mic}:${vel}:${rr}`;
  }

  async load(mic: HouseMic, ctx: AudioContext) {
    if (this._loading && this._mic === mic && this._loaded) return;
    // If mic changed, clear and reload
    if (mic !== this._mic) { this._buffers.clear(); this._loaded = false; }
    if (this._loading) return;
    this._mic     = mic;
    this._loading = true;
    this._loaded  = false;

    const instConfigs: { name: HouseInstName; vels: string[] }[] = [
      { name: 'kick',  vels: ['hard','med','soft'] },
      { name: 'snare', vels: ['crack','hard','medhard','medsoft','soft'] },
      { name: 'tom10', vels: ['hard','med','soft'] },
      { name: 'tom12', vels: ['hard','med','soft'] },
      { name: 'tom14', vels: ['hard','med','soft'] },
    ];

    const tasks: Promise<void>[] = [];
    let total = 0;
    let loaded = 0;

    for (const { name, vels } of instConfigs) {
      for (const vel of vels) {
        for (let rr = 1; rr <= 7; rr++) {
          total++;
          // Overhead mic barely captures kick low-end — use blend mic for kick
          // when OH is selected, giving full-bodied punch while toms/snare stay OH.
          const loadMic = (name === 'kick' && mic === 'oh') ? 'blend' : mic;
          const key = this._key(name, loadMic, vel, rr);
          const url = `/drums/realistic/${name}/${loadMic}/${vel}_${rr}.opus`;
          tasks.push((async () => {
            try {
              const resp = await fetch(url, { cache: 'force-cache' });
              if (!resp.ok) return;
              const ab  = await resp.arrayBuffer();
              const buf = await ctx.decodeAudioData(ab);
              this._buffers.set(key, buf);
            } catch { /* silently skip missing files */ }
            loaded++;
            this.onStatusChange?.(loaded, total);
          })());
        }
      }
    }

    await Promise.all(tasks);
    this._loaded  = true;
    this._loading = false;
  }

  getBuffer(inst: HouseInstName, mic: HouseMic, vel: string, rr: number): AudioBuffer | undefined {
    const effectiveMic = (inst === 'kick' && mic === 'oh') ? 'blend' : mic;
    return this._buffers.get(this._key(inst, effectiveMic, vel, rr));
  }

  /** Advance and return the next round-robin index (1–7) for this instrument */
  nextRR(inst: HouseInstName): number {
    const cur = this._rrCounters[inst] ?? 0;
    const next = (cur % 7) + 1;
    this._rrCounters[inst] = next;
    return next;
  }
}

export const houseKitPool = new HouseKitPool();

let _houseKitMic: HouseMic = 'blend';

export function setHouseKitMic(mic: HouseMic) { _houseKitMic = mic; }

export function loadHouseKit(mic: HouseMic) {
  const { ctx } = getCtx();
  _houseKitMic = mic;
  houseKitPool.load(mic, ctx);
  cymbalPool.load(ctx);
}

// ── House Kit Cymbal Pool — hi-hat, crash, ride WAV samples ─────────────────
const CYMBAL_BASE = '/drums/cymbals';

class CymbalPool {
  private _buffers  = new Map<string, AudioBuffer>();
  private _loaded   = false;
  private _loading  = false;
  private _rrFoot   = 0;
  private _rrBow    = 0;
  private _rrBell   = 0;
  onStatusChange: ((loaded: number, total: number) => void) | null = null;

  get ready(): boolean { return this._loaded; }

  async load(ctx: AudioContext) {
    if (this._loaded || this._loading) return;
    this._loading = true;

    const files = [
      'hh-closed-soft', 'hh-closed-hard',
      'hh-halfopen-soft', 'hh-halfopen-hard',
      'hh-mostlyopen-soft', 'hh-mostlyopen-hard',
      'hh-fullopen-hard',
      'hh-foot-1', 'hh-foot-2', 'hh-foot-3', 'hh-foot-4',
      'crash-ac18-bell',  'crash-ac18-low',  'crash-ac18-high',  'crash-ac18-tip',  'crash-ac18-choke',
      'crash-am17-bell',  'crash-am17-low',  'crash-am17-high',  'crash-am17-tip',  'crash-am17-choke',
      'crash-hhx18-bell', 'crash-hhx18-low', 'crash-hhx18-high', 'crash-hhx18-tip', 'crash-hhx18-choke',
      'crash-zcp19-bell', 'crash-zcp19-low', 'crash-zcp19-high', 'crash-zcp19-tip', 'crash-zcp19-choke',
      'ride-bell-1', 'ride-bell-2', 'ride-bow-1', 'ride-bow-2', 'ride-crash',
    ];

    const total = files.length;
    let loaded = 0;

    await Promise.all(files.map(name => (async () => {
      try {
        const resp = await fetch(`${CYMBAL_BASE}/${name}.wav`, { cache: 'force-cache' });
        if (!resp.ok) return;
        const buf = await ctx.decodeAudioData(await resp.arrayBuffer());
        this._buffers.set(name, buf);
      } catch { /* silently skip */ }
      loaded++;
      this.onStatusChange?.(loaded, total);
    })()));

    this._loaded  = true;
    this._loading = false;
  }

  private _get(k: string): AudioBuffer | undefined { return this._buffers.get(k); }

  getHHClosed(variation: NoteVariation): AudioBuffer | undefined {
    const hard = variation === 'accent' || variation === 'open';
    return this._get(hard ? 'hh-closed-hard' : 'hh-closed-soft');
  }

  getHHOpen(variation: NoteVariation): AudioBuffer | undefined {
    if (variation === 'accent') return this._get('hh-fullopen-hard') ?? this._get('hh-mostlyopen-hard');
    if (variation === 'open')   return this._get('hh-mostlyopen-soft') ?? this._get('hh-halfopen-hard');
    return this._get('hh-halfopen-soft');
  }

  getHHFoot(): AudioBuffer | undefined {
    const rr = (this._rrFoot % 4) + 1;
    this._rrFoot++;
    return this._get(`hh-foot-${rr}`);
  }

  getCrash(model: HouseCrashModel, variation: NoteVariation): AudioBuffer | undefined {
    const sfx = variation === 'bell'   ? 'bell'  :
                variation === 'choke'  ? 'choke' :
                variation === 'accent' ? 'high'  :
                variation === 'ghost'  ? 'low'   : 'tip';
    return this._get(`crash-${model}-${sfx}`);
  }

  getRide(variation: NoteVariation): AudioBuffer | undefined {
    if (variation === 'bell') {
      const rr = (this._rrBell % 2) + 1;
      this._rrBell++;
      return this._get(`ride-bell-${rr}`);
    }
    if (variation === 'choke') return this._get('ride-crash');
    const rr = (this._rrBow % 2) + 1;
    this._rrBow++;
    return this._get(`ride-bow-${rr}`);
  }
}

export const cymbalPool = new CymbalPool();

let _houseCrashModel: HouseCrashModel = 'ac18';
export function setHouseCrashModel(model: HouseCrashModel): void { _houseCrashModel = model; }

export function loadHouseCymbals(): void {
  const { ctx } = getCtx();
  cymbalPool.load(ctx);
}

// ── Synthesis: Kick ─────────────────────────────────────────────────────────
function synthKick(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  const P: Record<string, { sf: number; ef: number; decay: number; clickVol: number; sub: boolean }> = {
    'kick-std':      { sf: 185, ef: 42,  decay: 0.42, clickVol: 0.40, sub: false },
    'kick-tight':    { sf: 230, ef: 62,  decay: 0.20, clickVol: 0.55, sub: false },
    'kick-808':      { sf: 82,  ef: 28,  decay: 1.40, clickVol: 0.10, sub: true  },
    'kick-acoustic': { sf: 155, ef: 44,  decay: 0.36, clickVol: 0.55, sub: false },
  };
  const p = P[id] ?? P['kick-std'];

  const out = ctx.createGain();
  out.gain.setValueAtTime(vol * 1.1, t);
  out.connect(dest);

  // Waveshaper saturation for punchier kick
  const ws = ctx.createWaveShaper();
  ws.curve = makeSaturationCurve(20);
  ws.connect(out);

  // Body (sine sweep)
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(p.sf, t);
  osc.frequency.exponentialRampToValueAtTime(p.ef, t + p.decay);
  const og = ctx.createGain();
  og.gain.setValueAtTime(1.0, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + p.decay + 0.04);
  osc.connect(og); og.connect(ws);
  osc.start(t); osc.stop(t + p.decay + 0.08);

  // Sub layer (for 808)
  if (p.sub) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(p.ef * 0.6, t + 0.02);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.6, t + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.001, t + p.decay + 0.5);
    sub.connect(sg); sg.connect(ws);
    sub.start(t + 0.02); sub.stop(t + p.decay + 0.6);
  }

  // Transient click
  const cs = ctx.createBufferSource();
  cs.buffer = makeNoise(ctx, 0.03);
  const cf = ctx.createBiquadFilter();
  cf.type = 'highpass'; cf.frequency.value = 800;
  const cf2 = ctx.createBiquadFilter();
  cf2.type = 'lowpass'; cf2.frequency.value = 4200;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(p.clickVol, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  cs.connect(cf); cf.connect(cf2); cf2.connect(cg); cg.connect(out);
  cs.start(t);
}

// ── Synthesis: Snare ────────────────────────────────────────────────────────
function synthSnare(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  const P: Record<string, { tone: number; tVol: number; tDecay: number; nVol: number; nDecay: number; bpHz: number; bpQ: number }> = {
    'snare-crack':   { tone: 235, tVol: 0.55, tDecay: 0.065, nVol: 1.10, nDecay: 0.105, bpHz: 5800, bpQ: 0.80 },
    'snare-fat':     { tone: 155, tVol: 0.85, tDecay: 0.160, nVol: 0.90, nDecay: 0.210, bpHz: 3400, bpQ: 0.55 },
    'snare-brush':   { tone: 175, tVol: 0.25, tDecay: 0.130, nVol: 0.50, nDecay: 0.190, bpHz: 3200, bpQ: 0.40 },
    'snare-rimshot': { tone: 290, tVol: 1.10, tDecay: 0.048, nVol: 0.85, nDecay: 0.075, bpHz: 6800, bpQ: 1.20 },
  };
  const p = P[id] ?? P['snare-crack'];

  const out = ctx.createGain();
  out.gain.setValueAtTime(vol, t);
  out.connect(dest);

  // Triangle body (adds warmth)
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(p.tone, t);
  osc.frequency.linearRampToValueAtTime(p.tone * 0.7, t + p.tDecay);
  const og = ctx.createGain();
  og.gain.setValueAtTime(p.tVol, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + p.tDecay);
  osc.connect(og); og.connect(out);
  osc.start(t); osc.stop(t + p.tDecay + 0.01);

  // Snare wire noise (high-pass band)
  const ns = ctx.createBufferSource();
  ns.buffer = makeNoise(ctx, p.nDecay + 0.02);
  const nf1 = ctx.createBiquadFilter();
  nf1.type = 'bandpass'; nf1.frequency.value = p.bpHz; nf1.Q.value = p.bpQ;
  // Second bandpass for low body
  const nf2 = ctx.createBiquadFilter();
  nf2.type = 'bandpass'; nf2.frequency.value = p.bpHz * 0.4; nf2.Q.value = 0.5;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(p.nVol, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + p.nDecay);
  ns.connect(nf1); nf1.connect(ng); ng.connect(out);
  ns.connect(nf2); nf2.connect(ng);
  ns.start(t);
}

// ── Synthesis: Hi-Hat ───────────────────────────────────────────────────────
// Metallic frequencies based on real cymbal harmonic ratios
const HH_FREQS = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21] as const;

function synthHihat(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  const P: Record<string, { decay: number; hp: number; lp: number; nVol: number; baseF: number }> = {
    'hh-c-tight':   { decay: 0.030, hp: 8000,  lp: 16000, nVol: 0.18, baseF: 42 },
    'hh-c-crisp':   { decay: 0.050, hp: 7000,  lp: 15000, nVol: 0.25, baseF: 40 },
    'hh-c-loose':   { decay: 0.075, hp: 6000,  lp: 13000, nVol: 0.28, baseF: 38 },
    'hh-o-short':   { decay: 0.230, hp: 5500,  lp: 12000, nVol: 0.38, baseF: 38 },
    'hh-o-long':    { decay: 0.600, hp: 5000,  lp: 12000, nVol: 0.40, baseF: 38 },
    'hh-o-wash':    { decay: 1.000, hp: 4400,  lp: 11000, nVol: 0.50, baseF: 36 },
    'hh-f-std':     { decay: 0.085, hp: 6500,  lp: 11500, nVol: 0.28, baseF: 36 },
    'hh-f-splash':  { decay: 0.160, hp: 5800,  lp: 11000, nVol: 0.35, baseF: 36 },
  };
  const p = P[id] ?? P['hh-c-tight'];

  const out = ctx.createGain();
  out.gain.setValueAtTime(vol, t);

  const hp  = ctx.createBiquadFilter(); hp.type  = 'highpass'; hp.frequency.value = p.hp;
  const lp  = ctx.createBiquadFilter(); lp.type  = 'lowpass';  lp.frequency.value = p.lp;
  out.connect(hp); hp.connect(lp); lp.connect(dest);

  // Metallic oscillator bank
  HH_FREQS.forEach((r, i) => {
    const osc = ctx.createOscillator();
    osc.type  = 'square';
    osc.frequency.value = p.baseF * r;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.45 / (i + 1), t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
    osc.connect(og); og.connect(out);
    osc.start(t); osc.stop(t + p.decay + 0.01);
  });

  // Noise layer
  const ns = ctx.createBufferSource();
  ns.buffer = makeNoise(ctx, p.decay + 0.02);
  const ng  = ctx.createGain();
  ng.gain.setValueAtTime(p.nVol, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
  ns.connect(ng); ng.connect(out);
  ns.start(t);
}

// ── Synthesis: Tom ──────────────────────────────────────────────────────────
function synthTom(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  const P: Record<string, { sf: number; ef: number; decay: number; clickVol: number }> = {
    'tom-hi-std':   { sf: 320, ef: 160, decay: 0.26, clickVol: 0.30 },
    'tom-hi-tight': { sf: 345, ef: 190, decay: 0.15, clickVol: 0.42 },
    'tom-m-std':    { sf: 215, ef: 100, decay: 0.33, clickVol: 0.28 },
    'tom-m-warm':   { sf: 195, ef: 88,  decay: 0.42, clickVol: 0.20 },
    'tom-f-std':    { sf: 140, ef: 60,  decay: 0.44, clickVol: 0.27 },
    'tom-f-deep':   { sf: 108, ef: 44,  decay: 0.60, clickVol: 0.20 },
  };
  const p = P[id] ?? P['tom-hi-std'];

  const out = ctx.createGain();
  out.gain.setValueAtTime(vol, t);
  out.connect(dest);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(p.sf, t);
  osc.frequency.exponentialRampToValueAtTime(p.ef, t + p.decay);
  const og = ctx.createGain();
  og.gain.setValueAtTime(1.0, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + p.decay);
  osc.connect(og); og.connect(out);
  osc.start(t); osc.stop(t + p.decay + 0.01);

  // Second harmonic (small)
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(p.sf * 1.8, t);
  osc2.frequency.exponentialRampToValueAtTime(p.ef * 1.2, t + p.decay * 0.4);
  const og2 = ctx.createGain();
  og2.gain.setValueAtTime(0.22, t);
  og2.gain.exponentialRampToValueAtTime(0.001, t + p.decay * 0.5);
  osc2.connect(og2); og2.connect(out);
  osc2.start(t); osc2.stop(t + p.decay * 0.55);

  // Transient click
  const cs = ctx.createBufferSource();
  cs.buffer = makeNoise(ctx, 0.022);
  const cf  = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 1200;
  const cg  = ctx.createGain();
  cg.gain.setValueAtTime(p.clickVol, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
  cs.connect(cf); cf.connect(cg); cg.connect(out);
  cs.start(t);
}

// ── Synthesis: Cymbal (crash/ride) ──────────────────────────────────────────
const CYM_FREQS = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21, 9.87, 11.34] as const;

function synthCymbal(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  const P: Record<string, { decay: number; hp: number; attackT: number; baseF: number; nVol: number }> = {
    'crash-std':    { decay: 1.30, hp: 4200, attackT: 0.005, baseF: 36, nVol: 0.30 },
    'crash-china':  { decay: 0.95, hp: 5400, attackT: 0.003, baseF: 46, nVol: 0.35 },
    'crash-bright': { decay: 1.05, hp: 5900, attackT: 0.004, baseF: 42, nVol: 0.28 },
    'ride-std':     { decay: 1.80, hp: 5400, attackT: 0.008, baseF: 54, nVol: 0.22 },
    'ride-bell':    { decay: 0.85, hp: 7200, attackT: 0.002, baseF: 72, nVol: 0.12 },
    'ride-wash':    { decay: 2.20, hp: 3900, attackT: 0.015, baseF: 30, nVol: 0.40 },
  };
  const p = P[id] ?? P['crash-std'];

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.001, t);
  out.gain.linearRampToValueAtTime(vol, t + p.attackT);
  out.gain.exponentialRampToValueAtTime(0.001, t + p.decay);

  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = p.hp;
  out.connect(hp); hp.connect(dest);

  CYM_FREQS.forEach((r, i) => {
    const osc = ctx.createOscillator();
    osc.type  = 'square';
    osc.frequency.value = p.baseF * r;
    const og  = ctx.createGain();
    og.gain.setValueAtTime(0.30 / (i + 2), t);
    osc.connect(og); og.connect(out);
    osc.start(t); osc.stop(t + p.decay + 0.05);
  });

  const ns = ctx.createBufferSource();
  ns.buffer = makeNoise(ctx, p.decay + 0.05);
  const ng  = ctx.createGain();
  ng.gain.setValueAtTime(p.nVol, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + p.decay);
  ns.connect(ng); ng.connect(out);
  ns.start(t);
}

// ── Play buffer from sample pool ────────────────────────────────────────────
function playBuffer(
  ctx: AudioContext,
  buf: AudioBuffer,
  t: number,
  vol: number,
  dest: AudioNode,
  maxDur?: number,
  rate = 1.0,
) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  if (maxDur) {
    gain.gain.setValueAtTime(vol, t + maxDur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + maxDur);
  }

  src.connect(gain); gain.connect(dest);
  src.start(t);
  if (maxDur) src.stop(t + maxDur + 0.02);
}

// ── Play buffer with early reflection (natural room ambience) ────────────────
// Adds a single early bounce at `reflectionMs` ms with ~−14 dB to simulate a
// small/medium recording room without a heavy convolution reverb.
function playBufferRoomy(
  ctx: AudioContext,
  buf: AudioBuffer,
  t: number,
  vol: number,
  dest: AudioNode,
  rate: number,
  reflectionMs: number,
  maxDur?: number,
) {
  // Direct signal
  playBuffer(ctx, buf, t, vol, dest, maxDur, rate);

  // Early reflection — lower pitch offset simulates room scatter
  const refDelay = reflectionMs / 1000;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * 0.995; // tiny detune on reflection
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.20, t + refDelay);
  g.gain.exponentialRampToValueAtTime(0.001, t + refDelay + (maxDur ?? 0.55));
  src.connect(g); g.connect(dest);
  src.start(t + refDelay);
  src.stop(t + refDelay + (maxDur ?? 0.6) + 0.02);
}

// ── Per-instrument FX ────────────────────────────────────────────────────────

let _instFXMap: Partial<Record<DrumInstrument, InstFX>> = {};

// ── Persistent FX chain cache ─────────────────────────────────────────────────
//
// DISTORTION BUG ROOT CAUSE (v1 attempt): setInstFXMap deleted old chains from
// the map but never disconnected them from _masterGain. Every slider move added
// a new chain WITHOUT removing the old one → chains accumulated → gain exploded.
//
// FIX: each chain entry stores its two output nodes (dryGain, wetGain) and the
// dest they are connected to. On invalidation, we explicitly disconnect them
// before deleting. This is the ONLY way to stop old chains from contributing.
//
// Gate is NOT part of the persistent chain — see playSoundAt for the gate impl.
//
type ChainEntry = {
  input:   AudioNode;        // entry point: note sources connect here
  dryOut:  GainNode;         // dry path output (connected to dest)
  wetOut:  GainNode;         // wet reverb output (connected to dest)
  dest:    AudioNode;        // the masterGain this chain feeds into
  dispose: () => void;       // stops plugin oscillators
};

const _persistentChains = new Map<DrumInstrument, ChainEntry>();

function _teardownChain(entry: ChainEntry): void {
  // Disconnect outputs from masterGain — stops the old chain from contributing.
  // Nodes without live sources will then be GC'd by the browser.
  try { entry.dryOut.disconnect(entry.dest); } catch { /* already disconnected */ }
  try { entry.wetOut.disconnect(entry.dest); } catch { /* already disconnected */ }
  try { entry.dispose(); } catch {}
}

let _instPluginMap: Partial<Record<DrumInstrument, InstPlugin[]>> = {};

/** Called from the React component whenever instFX state changes. */
export function setInstFXMap(map: Partial<Record<DrumInstrument, InstFX>>) {
  // Disconnect and remove cached chains for changed instruments
  for (const inst of Object.keys(map) as DrumInstrument[]) {
    const existing = _persistentChains.get(inst as DrumInstrument);
    if (existing) {
      _teardownChain(existing);
      _persistentChains.delete(inst as DrumInstrument);
    }
  }
  _instFXMap = map;
}

/** Called from the React component whenever plugin state changes. */
export function setInstPluginMap(map: Partial<Record<DrumInstrument, InstPlugin[]>>) {
  for (const inst of Object.keys(map) as DrumInstrument[]) {
    const existing = _persistentChains.get(inst as DrumInstrument);
    if (existing) {
      _teardownChain(existing);
      _persistentChains.delete(inst as DrumInstrument);
    }
  }
  _instPluginMap = map;
}

/** Tear down ALL persistent chains (called when AudioContext resets). */
function _clearAllChains(): void {
  _persistentChains.forEach(_teardownChain);
  _persistentChains.clear();
}

/**
 * Freeverb impulse response generator.
 *
 * Source algorithm: "Freeverb" by Jezar at Dreampoint — public domain.
 * Reference: https://github.com/sinshu/freeverb (C++ original)
 *
 * Architecture (faithful JS port of the original C++):
 *   • 8 parallel Schroeder feedback comb filters with LPF damping in the loop
 *     (the LPF in the feedback path is what gives Freeverb its characteristic
 *     high-frequency rolloff over time — highs decay faster than lows)
 *   • 4 series Schroeder all-pass filters for diffusion / de-correlation
 *   • Stereo: right channel uses all delay sizes offset by +`STEREO_SPREAD`
 *     samples, giving true stereo decorrelation without extra processing
 *
 * Implementation approach: run the algorithm sample-by-sample in JS to generate
 * a 2.2-second impulse response buffer, then load it into a ConvolverNode.
 * This lets the browser use its native FFT-based convolution engine for
 * real-time playback — much more efficient than running Freeverb per-sample
 * in a worklet at runtime.
 *
 * Parameters (fixed for drum room character):
 *   roomSize = 0.75  →  feedback = roomSize × 0.28 + 0.7 = 0.91
 *   damping  = 0.32  →  damp1    = damping  × 0.4       = 0.128
 */
let _irBuffer: AudioBuffer | null = null;
function getIR(ctx: AudioContext): AudioBuffer {
  if (_irBuffer && _irBuffer.sampleRate === ctx.sampleRate) return _irBuffer;

  const sr = ctx.sampleRate;

  // ── Freeverb constants (Jezar at Dreampoint, public domain) ────────────────
  const FIXED_GAIN    = 0.015;
  const STEREO_SPREAD = 23;
  const ROOM_SIZE     = 0.75;   // 0–1: room size (0.7–0.9 for realistic rooms)
  const DAMPING       = 0.32;   // 0–1: HF damping in comb feedback path

  // Delay line lengths at 44100 Hz (Jezar's original tuning)
  const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617] as const;
  const AP_TUNING   = [556,  441,  341,  225]                           as const;

  // Scale delay lengths to actual sample rate
  const scaleFactor = sr / 44100;
  const combLen = COMB_TUNING.map(n => Math.round(n * scaleFactor));
  const apLen   = AP_TUNING.map(n  => Math.round(n * scaleFactor));

  // Derived parameters
  const feedback = ROOM_SIZE * 0.28 + 0.70;  // 0.70–0.98
  const damp1    = DAMPING   * 0.40;          // LPF coefficient (in feedback path)
  const damp2    = 1 - damp1;                 // complementary coefficient

  // ── Filter state ────────────────────────────────────────────────────────────
  type CombState = { buf: Float32Array; idx: number; lpStore: number };
  type APState   = { buf: Float32Array; idx: number };

  const mkComb = (n: number): CombState => ({ buf: new Float32Array(n), idx: 0, lpStore: 0 });
  const mkAP   = (n: number): APState   => ({ buf: new Float32Array(n), idx: 0 });

  // L channel uses standard lengths; R adds STEREO_SPREAD for decorrelation
  const combsL = combLen.map(n => mkComb(n));
  const combsR = combLen.map(n => mkComb(n + STEREO_SPREAD));
  const apsL   = apLen.map(n   => mkAP(n));
  const apsR   = apLen.map(n   => mkAP(n + STEREO_SPREAD));

  // ── Process one sample through a Schroeder comb filter ─────────────────────
  // Transfer function: H(z) = z^{-N} / (1 - g·(1 - d)·z^{-1} - g·d·z^{-N})
  // The LPF in the loop (lpStore) is the key to Freeverb's warm decay character.
  const processComb = (c: CombState, inp: number): number => {
    const out = c.buf[c.idx];
    c.lpStore  = out * damp2 + c.lpStore * damp1;   // 1-pole LP in feedback
    c.buf[c.idx] = inp + c.lpStore * feedback;
    c.idx = (c.idx + 1) % c.buf.length;
    return out;
  };

  // ── Process one sample through a Schroeder all-pass filter ─────────────────
  // Transfer function: H(z) = (-g + z^{-N}) / (1 - g·z^{-N}), g = 0.5
  // All-pass filters don't change frequency content but scatter energy in time,
  // adding diffusion and preventing flutter echoes.
  const processAP = (ap: APState, inp: number): number => {
    const bufOut = ap.buf[ap.idx];
    const out    = -inp + bufOut;
    ap.buf[ap.idx] = inp + bufOut * 0.5;  // g = 0.5 (Jezar's fixed value)
    ap.idx = (ap.idx + 1) % ap.buf.length;
    return out;
  };

  // ── Generate the impulse response ─────────────────────────────────────────
  const irLen = Math.floor(sr * 2.2);
  const dataL = new Float32Array(irLen);
  const dataR = new Float32Array(irLen);

  // Pre-delay of 14 ms (gives sense of room distance before reverb bloom)
  const predelayLen = Math.floor(sr * 0.014);

  for (let n = 0; n < irLen; n++) {
    // Single impulse at n=predelay (with Freeverb's fixed input gain scaling)
    const input = (n === predelayLen) ? FIXED_GAIN : 0;

    // 8 comb filters run in parallel, outputs are summed
    let outL = 0, outR = 0;
    for (const c of combsL) outL += processComb(c, input);
    for (const c of combsR) outR += processComb(c, input);

    // 4 all-pass filters run in series for diffusion
    for (const ap of apsL) outL = processAP(ap, outL);
    for (const ap of apsR) outR = processAP(ap, outR);

    dataL[n] = outL;
    dataR[n] = outR;
  }

  // Normalise peak to –6 dBFS so the convolver doesn't clip
  let peak = 0;
  for (let i = 0; i < irLen; i++) peak = Math.max(peak, Math.abs(dataL[i]), Math.abs(dataR[i]));
  const norm = peak > 0 ? 0.5 / peak : 1;
  for (let i = 0; i < irLen; i++) { dataL[i] *= norm; dataR[i] *= norm; }

  const buf = ctx.createBuffer(2, irLen, sr);
  buf.copyToChannel(dataL, 0);
  buf.copyToChannel(dataR, 1);
  _irBuffer = buf;
  return buf;
}

/**
 * Build a PERSISTENT FX channel strip for one instrument and return a ChainEntry.
 *
 * Chain: EQ (4-band) → Saturator → Compressor → Post-gain → Limiter → dry/wet reverb → dest
 *
 * Built ONCE per instrument. Old chains are disconnected via ChainEntry.dryOut/wetOut
 * before being replaced — this is the only way to prevent gain accumulation.
 *
 * Gate is NOT here — it is applied per-note in playSoundAt (scheduled GainNode).
 *
 * Safety guarantees:
 *  - EQ gains clamped to ±9 dB (prevents extreme boosts before compressor)
 *  - Compressor threshold: -6 to -24 dB; ratio: 2:1 to 8:1
 *  - Compressor makeup gain fully cancelled via postGain
 *    (Web Audio auto-applies makeup ≈ -threshold × (1 − 1/ratio); we negate it)
 *  - Hard limiter at -1 dBFS as true last resort
 *  - Reverb wet capped at 0.45 (equal-power crossfade)
 */
function buildFXChain(ctx: AudioContext, dest: AudioNode, fx: InstFX, plugins: InstPlugin[]): ChainEntry {
  // ── 4-band EQ — gains clamped to ±12 dB (matches UI slider range) ────────────
  // With makeup gain fully cancelled downstream, ±12 dB is safe.
  const clamp = (v: number) => Math.max(-12, Math.min(12, v));

  const low = ctx.createBiquadFilter();
  low.type = 'lowshelf'; low.frequency.value = 80;   low.gain.value = clamp(fx.eqLow);

  const lowMid = ctx.createBiquadFilter();
  lowMid.type = 'peaking'; lowMid.frequency.value = 350;
  lowMid.Q.value = 1.0;   lowMid.gain.value = clamp(fx.eqLowMid ?? 0);

  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking'; mid.frequency.value = 2000;
  mid.Q.value = 1.2;    mid.gain.value = clamp(fx.eqMid);

  const hi = ctx.createBiquadFilter();
  hi.type = 'highshelf'; hi.frequency.value = 10000; hi.gain.value = clamp(fx.eqHigh);

  // ── Saturation waveshaper — asymmetric tanh (tape oxide emulation) ─────────
  //
  // Algorithm: asymmetric normalized tanh.
  // Real magnetic tape saturates asymmetrically — the positive and negative
  // half-cycles clip at slightly different amounts, introducing even-order
  // harmonics (2nd, 4th…) that give tape its characteristic "warmth".
  // A symmetric clipper (like pure tanh or the old algebraic clipper) only
  // produces odd-order harmonics, which sound harsher.
  //
  // Implementation: drive the positive half at 1.15× and the negative half
  // at 0.85× of the base drive. Each half is normalised independently so
  // the overall gain stays the same but the wave shape becomes asymmetric.
  // This is the same technique used in many open-source tape emulation plugins
  // (e.g., the Airwindows "Tape" series and the Ardour tape saturation code).
  const saturate = fx.saturate ?? 0;
  let satOutput: AudioNode = hi;
  if (saturate > 0.01) {
    const ws   = ctx.createWaveShaper();
    const drv  = 1 + saturate * 9;                  // base drive: 1 → 10
    const drvP = drv * 1.15;                         // positive half (slightly more driven)
    const drvN = drv * 0.85;                         // negative half (slightly less driven)
    const normP = Math.tanh(drvP);                   // per-half normalisation
    const normN = Math.tanh(drvN);
    const n    = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x  = (i * 2) / (n - 1) - 1;             // −1 … +1
      curve[i] = x >= 0
        ? Math.tanh(x * drvP) / normP               // positive half
        : Math.tanh(x * drvN) / normN;              // negative half (asymmetric!)
    }
    ws.curve      = curve;
    ws.oversample = '4x';
    // RMS compensation — asymmetric clipping reduces average level slightly
    const satComp = ctx.createGain();
    satComp.gain.value = 1 / Math.sqrt(1 + saturate * 0.35);
    hi.connect(ws); ws.connect(satComp);
    satOutput = satComp;
  }

  // ── Compressor ──────────────────────────────────────────────────────────────
  // Threshold: -6 to -24 dB (safe range — old 0 to -60 dB was the explosion source)
  // Ratio:     2:1 to 8:1   (old 1:1 to 20:1 was similarly dangerous)
  //
  // Web Audio DynamicsCompressorNode applies AUTOMATIC MAKEUP GAIN:
  //   makeup_dB ≈ -threshold × (1 − 1/ratio)
  // At max settings: -(-24) × (1 - 1/8) = 24 × 0.875 = 21 dB added by the browser.
  // Old compensation was only -3.5 dB → net +17.5 dB leaking through every note.
  // NEW: postGain fully cancels the calculated makeup gain, keeping output level
  // the same regardless of how much compression is applied (just like a real
  // compressor with "auto makeup" turned off).
  const comp  = ctx.createDynamicsCompressor();
  const ratio = 2 + fx.compress * 6;                        // 2:1 – 8:1
  const thr   = -(6 + fx.compress * 18);                    // -6 – -24 dB
  comp.attack.value    = 0.003 + fx.attack * 0.097;         // 3 – 100 ms
  comp.release.value   = 0.08  + fx.attack * 0.12;          // 80 – 200 ms
  comp.ratio.value     = ratio;
  comp.threshold.value = thr;
  comp.knee.value      = 8;

  // Cancel the browser's automatic makeup gain precisely
  const makeupDB  = -thr * (1 - 1 / ratio);                 // e.g. 21 dB at max
  const postGain  = ctx.createGain();
  postGain.gain.value = Math.pow(10, -makeupDB / 20);        // exact inverse

  // ── Hard limiter — absolute last resort, should rarely trigger ───────────────
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value      = 0;
  limiter.ratio.value     = 20;
  limiter.attack.value    = 0.001;
  limiter.release.value   = 0.05;

  // ── Plugin chain — inserted between limiter and reverb ───────────────────────
  // Each plugin's createNodes() is called to get an {input,output,dispose} tuple.
  // Plugins are chained in order: limiter → plugin[0] → plugin[1] → … → reverb.
  const pluginDisposers: Array<() => void> = [];
  let pluginChainOut: AudioNode = limiter; // starts at limiter output

  for (const inst of plugins) {
    const def = getPlugin(inst.id);
    if (!def) continue;
    const nodes = def.createNodes(ctx, inst.params);
    pluginChainOut.connect(nodes.input);
    pluginChainOut = nodes.output;
    if (nodes.dispose) pluginDisposers.push(nodes.dispose);
  }

  // ── Reverb — Freeverb IR via ConvolverNode (built once, cached) ─────────────
  // Equal-power crossfade; wet capped at 0.45 (convolver can amplify)
  const angle   = fx.reverb * (Math.PI / 2);
  const dryGain = ctx.createGain(); dryGain.gain.value = Math.cos(angle);
  const wetGain = ctx.createGain(); wetGain.gain.value = Math.sin(angle) * 0.45;

  const conv = ctx.createConvolver();
  conv.buffer = getIR(ctx);

  // ── Wire: EQ → sat → comp → postGain → limiter → [plugins] → dry/wet → dest ─
  low.connect(lowMid); lowMid.connect(mid); mid.connect(hi);
  satOutput.connect(comp);
  comp.connect(postGain); postGain.connect(limiter);
  // pluginChainOut is now either limiter (no plugins) or last plugin output
  pluginChainOut.connect(dryGain); dryGain.connect(dest);
  pluginChainOut.connect(conv);    conv.connect(wetGain); wetGain.connect(dest);

  const disposeAll = () => pluginDisposers.forEach(d => { try { d(); } catch {} });
  return { input: low, dryOut: dryGain, wetOut: wetGain, dest, dispose: disposeAll };
}

function isFXDefault(fx: InstFX): boolean {
  return fx.compress === 0 && fx.attack === 0
      && fx.eqLow === 0 && (fx.eqLowMid ?? 0) === 0
      && fx.eqMid === 0 && fx.eqHigh === 0
      && fx.reverb === 0 && (fx.gate ?? 0) === 0 && (fx.saturate ?? 0) === 0;
}

// ── Main sound dispatcher ────────────────────────────────────────────────────
export function playSoundAt(
  soundId:   string,
  time:      number,
  vol:       number,
  dest:      AudioNode,
  kit:       KitType | null = null,
  variation: NoteVariation  = 'normal',
) {
  const { ctx } = getCtx();
  const t    = Math.max(time, ctx.currentTime + 0.003);
  const inst = soundIdToInst(soundId);

  // ── Persistent FX channel strip lookup ───────────────────────────────────────
  // One EQ+comp+reverb chain per instrument, shared by all notes of that inst.
  // The chain is built on first use and torn down (disconnected from masterGain)
  // whenever FX params change — preventing the gain accumulation that caused
  // distortion.
  const fx      = inst ? _instFXMap[inst]    : undefined;
  const plugins = inst ? (_instPluginMap[inst] ?? []) : [];
  const needsChain = (fx && !isFXDefault(fx)) || plugins.length > 0;
  let chainInput: AudioNode = dest;     // where note sources will connect

  if (needsChain && inst) {
    let entry = _persistentChains.get(inst);
    if (!entry) {
      entry = buildFXChain(ctx, dest, fx ?? {
        compress: 0, attack: 0, eqLow: 0, eqLowMid: 0, eqMid: 0, eqHigh: 0,
        reverb: 0, gate: 0, saturate: 0,
      }, plugins);
      _persistentChains.set(inst, entry);
    }
    chainInput = entry.input;
  }

  // ── Gate — scheduled per-note GainNode ───────────────────────────────────────
  // Applied BETWEEN the note source and the persistent FX chain.
  //
  // Envelope:
  //   • 2 ms linear open ramp  (click-free onset)
  //   • hold period            (full signal passes through)
  //   • exponential close ramp (smooth, natural-sounding fade)
  //
  // Hihats use hard maxDur instead — hard gate is correct for closed hi-hats.
  //
  // Hold/release curves (gate = 0→1):
  //   hold:    1.75 s → 50 ms  (quadratic — gentle at low values, tight at top)
  //   release: 400 ms → 150 ms (linear — always ≥ 150 ms to avoid clicks)
  //
  // The gateGain is disconnected from chainInput via setTimeout after the
  // envelope ends — prevents accumulation of idle nodes in the audio graph.
  const gateVal = fx?.gate ?? 0;
  const isHihat = inst === 'hihat-closed' || inst === 'hihat-open' || inst === 'hihat-foot';
  let noteDest: AudioNode = chainInput;

  if (gateVal > 0.05 && !isHihat) {
    const g       = gateVal;
    const hold    = 0.050 + (1 - g) * (1 - g) * 1.70;  // 1.75 s → 50 ms  (quadratic)
    const release = 0.150 + (1 - g) * 0.250;             // 400 ms → 150 ms (linear)
    const gateGain = ctx.createGain();

    gateGain.gain.setValueAtTime(0,       t);
    gateGain.gain.linearRampToValueAtTime(1, t + 0.002);            // 2 ms attack
    gateGain.gain.setValueAtTime(1,          t + 0.002 + hold);     // hold
    gateGain.gain.exponentialRampToValueAtTime(0.0001,               // smooth close
      t + 0.002 + hold + release);

    gateGain.connect(chainInput);
    noteDest = gateGain;

    // Disconnect the GainNode after envelope completes so it can be GC'd
    const msUntilDone = (hold + release + 0.2) * 1000;
    setTimeout(() => { try { gateGain.disconnect(chainInput); } catch {} }, msUntilDone);
  }

  // ── House Kit — multi-velocity + round-robin sample playback ─────────────────
  if (kit === 'house' && inst) {
    const houseInst = HOUSE_INST_MAP[inst];
    if (houseInst) {
      const vel = houseVelForVariation(inst, variation);
      const rr  = houseKitPool.nextRR(houseInst);
      const buf = houseKitPool.getBuffer(houseInst, _houseKitMic, vel, rr);
      if (buf) {
        playBuffer(ctx, buf, t, vol, noteDest, undefined, 1.0);
        return;
      }
      // Buffer not loaded yet — play nothing rather than falling back to synthesis
      return;
    }

    // ── Cymbal routing (hi-hat, crash, ride via CymbalPool) ─────────────────
    if (inst === 'hihat-closed') {
      const buf = cymbalPool.getHHClosed(variation);
      // No artificial gate — the real recorded sample already has the correct
      // closed articulation and natural decay; gating it makes it sound fake.
      if (buf) { playBuffer(ctx, buf, t, vol, chainInput, undefined, 1.0); return; }
    } else if (inst === 'hihat-open') {
      const buf = cymbalPool.getHHOpen(variation);
      if (buf) { playBuffer(ctx, buf, t, vol, noteDest, undefined, 1.0); return; }
    } else if (inst === 'hihat-foot') {
      const buf = cymbalPool.getHHFoot();
      if (buf) { playBuffer(ctx, buf, t, vol, chainInput, undefined, 1.0); return; }
    } else if (inst === 'crash') {
      const buf = cymbalPool.getCrash(_houseCrashModel, variation);
      if (buf) { playBuffer(ctx, buf, t, vol, noteDest, undefined, 1.0); return; }
    } else if (inst === 'ride') {
      const buf = cymbalPool.getRide(variation);
      if (buf) { playBuffer(ctx, buf, t, vol, noteDest, undefined, 1.0); return; }
    }
    // Cymbal pool not yet loaded — play nothing, don't fall back to synthesis
    return;
  }

  // Try kit-specific real sample first
  if (kit && inst && samplePool.hasForKit(kit, inst)) {
    const buf = samplePool.getForKit(kit, inst)!;

    const BASE_RATE: Partial<Record<DrumInstrument, number>> = {
      'tom-high': 1.35, 'tom-mid': 1.00, 'tom-floor': 0.80,
    };
    const cfg     = kit ? KIT_ACOUSTIC_CFG[kit]?.[inst] : undefined;
    const baseRate = BASE_RATE[inst] ?? 1.0;
    const kitRate  = cfg?.rate  ?? 1.0;
    const kitGain  = cfg?.gain  ?? 1.0;
    const roomMs   = cfg?.roomMs ?? 0;
    const rate     = baseRate * kitRate;
    const adjVol   = Math.min(vol * kitGain, 1.6);

    if (isHihat) {
      const dur = inst === 'hihat-foot' ? 0.08 : (soundId === 'hh-c-tight' ? 0.032 : soundId === 'hh-c-crisp' ? 0.052 : 0.075);
      playBuffer(ctx, buf, t, adjVol, chainInput, dur, rate);
    } else if (roomMs > 0 && chainInput === dest) {
      playBufferRoomy(ctx, buf, t, adjVol, chainInput, rate, roomMs);
    } else {
      playBuffer(ctx, buf, t, adjVol, noteDest, undefined, rate);
    }
    return;
  }

  // Synthesis fallback
  if      (soundId.startsWith('kick-'))    synthKick(ctx, t, vol, noteDest, soundId);
  else if (soundId.startsWith('snare-'))   synthSnare(ctx, t, vol, noteDest, soundId);
  else if (soundId.startsWith('hh-'))      synthHihat(ctx, t, vol, chainInput, soundId);
  else if (soundId.startsWith('tom-'))     synthTom(ctx, t, vol, noteDest, soundId);
  else if (soundId.startsWith('crash-') || soundId.startsWith('ride-')) synthCymbal(ctx, t, vol, noteDest, soundId);
}

// ── Playback scheduler ──────────────────────────────────────────────────────
const LOOKAHEAD_S = 0.10;
const TICK_MS     = 22;

class DrumScheduler {
  private _playing   = false;
  private _looping   = true;
  private _pattern:  DrumPattern | null = null;
  private _soundMap: Partial<Record<DrumInstrument, string>> = {};
  private _volMap:   Partial<Record<DrumInstrument, number>> = {};
  private _masterVol = 0.85;
  private _kitType:  KitType | null = null;

  private _nextStepTime = 0;
  private _currentStep  = 0;
  private _totalSteps   = 0;
  private _tickId: ReturnType<typeof setTimeout> | null = null;
  private _scheduled: { step: number; time: number }[] = [];

  onStep: ((globalStep: number, measureIdx: number, stepInMeasure: number) => void) | null = null;

  private secPerStep(): number {
    if (!this._pattern) return 0.125;
    const spBeat = this._pattern.subdivision / this._pattern.timeSignature[1];
    return (60 / this._pattern.bpm) / spBeat;
  }

  private scheduleNote(step: number, time: number) {
    if (!this._pattern || !_masterGain) return;
    const spm  = stepsPerMeasure(this._pattern);
    const mIdx = Math.floor(step / spm);
    const sInM = step % spm;
    if (mIdx >= this._pattern.measures.length) return;

    const measure  = this._pattern.measures[mIdx];
    const kitDefs  = this._kitType ? (KIT_DEFAULTS[this._kitType]?.soundMap ?? {}) : {};

    for (const inst of DRUM_INSTRUMENTS) {
      const hits = measure.hits[inst];
      if (!hits?.length) continue;
      const hit = hits.find(h => h.step === sInM);
      if (!hit) continue;

      const variation = hit.variation ?? 'normal';
      const soundId   = getSoundForVariation(inst, variation, this._soundMap, kitDefs);
      const volMult   = getVolMultForVariation(variation);
      const baseVol   = (this._volMap[inst] ?? 1) * this._masterVol;
      const vol       = Math.min(baseVol * volMult, 1.5);

      // Flam: play a soft grace note ~20 ms before the main hit
      if (variation === 'flam') {
        const graceT = Math.max(time - 0.020, (_ctx?.currentTime ?? 0) + 0.002);
        playSoundAt(soundId, graceT, vol * 0.42, _masterGain!, this._kitType, 'ghost');
      }

      playSoundAt(soundId, time, vol, _masterGain!, this._kitType, variation);
    }
    this._scheduled.push({ step, time });
  }

  private doTick() {
    if (!this._playing || !_ctx) return;
    const now = _ctx.currentTime;

    while (this._nextStepTime < now + LOOKAHEAD_S) {
      this.scheduleNote(this._currentStep, this._nextStepTime);
      this._nextStepTime += this.secPerStep();
      this._currentStep++;
      if (this._currentStep >= this._totalSteps) {
        if (this._looping) this._currentStep = 0;
        else { this._playing = false; break; }
      }
    }

    const past = this._scheduled.filter(s => s.time <= now + 0.02);
    if (past.length && this._pattern) {
      const cur = past[past.length - 1];
      const spm = stepsPerMeasure(this._pattern);
      this.onStep?.(cur.step, Math.floor(cur.step / spm), cur.step % spm);
    }
    this._scheduled = this._scheduled.filter(s => s.time >= now - 0.15);

    if (this._playing) this._tickId = setTimeout(() => this.doTick(), TICK_MS);
  }

  start(
    pattern:   DrumPattern,
    soundMap:  Partial<Record<DrumInstrument, string>>,
    volMap:    Partial<Record<DrumInstrument, number>>,
    masterVol: number,
    loop:      boolean,
    kitType?:  KitType | null,
  ) {
    this.stop();
    getCtx();
    this._pattern    = pattern;
    this._soundMap   = soundMap;
    this._volMap     = volMap;
    this._masterVol  = masterVol;
    this._looping    = loop;
    this._kitType    = kitType ?? null;
    this._totalSteps = stepsPerMeasure(pattern) * pattern.measures.length;
    this._currentStep   = 0;
    this._nextStepTime  = _ctx!.currentTime + 0.06;
    this._playing    = true;
    this._scheduled  = [];
    this.onStep?.(0, 0, 0); // snap playhead to beat 1 immediately
    this.doTick();
  }

  stop() {
    this._playing = false;
    if (this._tickId) { clearTimeout(this._tickId); this._tickId = null; }
    this.onStep?.(-1, 0, 0);
  }

  seekTo(step: number) {
    if (!this._pattern) return;
    const total = stepsPerMeasure(this._pattern) * this._pattern.measures.length;
    const clamped = Math.max(0, Math.min(step, total - 1));
    if (this._playing) {
      this._currentStep   = clamped;
      this._nextStepTime  = (_ctx?.currentTime ?? 0) + 0.06;
      this._scheduled     = [];
    }
    const spm = stepsPerMeasure(this._pattern);
    this.onStep?.(clamped, Math.floor(clamped / spm), clamped % spm);
  }

  get totalSteps(): number { return this._totalSteps; }
  get isPlaying(): boolean { return this._playing; }

  pause() {
    this._playing = false;
    if (this._tickId) { clearTimeout(this._tickId); this._tickId = null; }
  }

  resume(
    pattern:   DrumPattern,
    soundMap:  Partial<Record<DrumInstrument, string>>,
    volMap:    Partial<Record<DrumInstrument, number>>,
    masterVol: number,
    loop:      boolean,
    kitType?:  KitType | null,
  ) {
    this._pattern   = pattern;
    this._soundMap  = soundMap;
    this._volMap    = volMap;
    this._masterVol = masterVol;
    this._looping   = loop;
    this._kitType   = kitType ?? this._kitType;
    if (!this._totalSteps && pattern)
      this._totalSteps = stepsPerMeasure(pattern) * pattern.measures.length;
    this._nextStepTime = _ctx ? _ctx.currentTime + 0.05 : 0.05;
    this._playing = true;
    this.doTick();
  }

  updatePattern(pattern: DrumPattern) {
    this._pattern    = pattern;
    this._totalSteps = stepsPerMeasure(pattern) * pattern.measures.length;
    if (this._currentStep >= this._totalSteps) this._currentStep = 0;
  }

  setMasterVolume(vol: number) {
    this._masterVol = vol;
    if (_masterGain && _ctx)
      _masterGain.gain.linearRampToValueAtTime(vol, _ctx.currentTime + 0.05);
  }

  previewSound(soundId: string, vol = 0.75, kit: KitType | null = null) {
    const { ctx, dest } = getCtx();
    playSoundAt(soundId, ctx.currentTime + 0.01, vol, dest, kit);
  }

}

export const drumScheduler = new DrumScheduler();

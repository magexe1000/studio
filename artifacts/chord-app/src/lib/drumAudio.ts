import type { DrumInstrument, DrumPattern, KitType } from '../store/useDrumStore';
import { DRUM_INSTRUMENTS, stepsPerMeasure } from '../store/useDrumStore';

// ── Kit definitions ───────────────────────────────────────────────────────────
export const KIT_DEFAULTS: Record<KitType, {
  label:       string;
  description: string;
  soundMap:    Partial<Record<DrumInstrument, string>>;
}> = {
  // ── Acoustic ──────────────────────────────────────────────────────────────
  ludwig: {
    label: 'Ludwig Classic', description: 'Warm natural acoustic — full kit',
    soundMap: { kick:'kick-acoustic', snare:'snare-fat', 'hihat-closed':'hh-c-crisp', 'hihat-open':'hh-o-long', 'hihat-foot':'hh-f-std', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-warm', 'tom-floor':'tom-f-std', crash:'crash-std', ride:'ride-std' },
  },
  jazz: {
    label: 'Jazz Kit', description: 'Tight brushes, dry cymbals, small kit',
    soundMap: { kick:'kick-tight', snare:'snare-brush', 'hihat-closed':'hh-c-loose', 'hihat-open':'hh-o-short', crash:'crash-bright', ride:'ride-bell', 'tom-high':'tom-hi-tight', 'tom-mid':'tom-m-std' },
  },
  rock: {
    label: 'Rock Kit', description: 'Big punchy kick, fat cracking snare',
    soundMap: { kick:'kick-acoustic', snare:'snare-fat', 'hihat-closed':'hh-c-crisp', 'hihat-open':'hh-o-wash', 'hihat-foot':'hh-f-std', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-warm', 'tom-floor':'tom-f-deep', crash:'crash-std', ride:'ride-std' },
  },
  vintage: {
    label: "Vintage '60s", description: 'Woodsy warm tones, open resonance',
    soundMap: { kick:'kick-std', snare:'snare-crack', 'hihat-closed':'hh-c-crisp', 'hihat-open':'hh-o-long', crash:'crash-bright', 'tom-high':'tom-hi-std', 'tom-mid':'tom-m-warm', 'tom-floor':'tom-f-std' },
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
// All URLs served with Access-Control-Allow-Origin: * via raw.githubusercontent.com
const MIDI = 'https://raw.githubusercontent.com/cwilso/MIDIDrums/master/sounds/drum-samples/';
const TONEJS = 'https://tonejs.github.io/audio/drum-samples/';

// Each kit maps to completely different real audio samples for distinct character.
const KIT_SAMPLE_URLS: Record<KitType, Partial<Record<DrumInstrument, string[]>>> = {
  // ── Acoustic ────────────────────────────────────────────────────────────────
  // Ludwig Classic — warm full acoustic-kit
  ludwig: {
    kick:           [`${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${MIDI}acoustic-kit/hihat.wav`],
    'hihat-open':   [`${MIDI}acoustic-kit/hihat.wav`],
    'hihat-foot':   [`${MIDI}acoustic-kit/hihat.wav`],
    'tom-high':     [`${MIDI}acoustic-kit/tom1.wav`],
    'tom-mid':      [`${MIDI}acoustic-kit/tom2.wav`],
    'tom-floor':    [`${MIDI}acoustic-kit/tom3.wav`],
    crash:          [`${TONEJS}CR78/crash.mp3`],
    ride:           [`${TONEJS}CR78/ride.mp3`],
  },
  // Jazz Kit — CR78 cymbals over acoustic toms (dry, intimate)
  jazz: {
    kick:           [`${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${TONEJS}CR78/hihat.mp3`],
    'hihat-open':   [`${TONEJS}CR78/hihat.mp3`],
    crash:          [`${TONEJS}CR78/crash.mp3`],
    ride:           [`${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${MIDI}acoustic-kit/tom1.wav`],
    'tom-mid':      [`${MIDI}acoustic-kit/tom2.wav`],
  },
  // Rock Kit — R8 kick+snare punch over acoustic toms
  rock: {
    kick:           [`${MIDI}R8/kick.wav`,            `${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${MIDI}R8/snare.wav`,           `${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${MIDI}acoustic-kit/hihat.wav`],
    'hihat-open':   [`${MIDI}LINN/hihat.wav`,         `${MIDI}acoustic-kit/hihat.wav`],
    'hihat-foot':   [`${MIDI}acoustic-kit/hihat.wav`],
    'tom-high':     [`${MIDI}acoustic-kit/tom1.wav`],
    'tom-mid':      [`${MIDI}acoustic-kit/tom2.wav`],
    'tom-floor':    [`${MIDI}acoustic-kit/tom3.wav`],
    crash:          [`${TONEJS}CR78/crash.mp3`],
    ride:           [`${TONEJS}CR78/ride.mp3`],
  },
  // Vintage '60s — CR78 analog over acoustic toms (warm, open)
  vintage: {
    kick:           [`${TONEJS}CR78/kick.mp3`,        `${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${TONEJS}CR78/snare.mp3`,       `${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${MIDI}acoustic-kit/hihat.wav`],
    'hihat-open':   [`${MIDI}acoustic-kit/hihat.wav`],
    crash:          [`${TONEJS}CR78/crash.mp3`],
    'tom-high':     [`${TONEJS}CR78/highTom.mp3`,     `${MIDI}acoustic-kit/tom1.wav`],
    'tom-mid':      [`${TONEJS}CR78/lowTom.mp3`,      `${MIDI}acoustic-kit/tom2.wav`],
    'tom-floor':    [`${MIDI}acoustic-kit/tom3.wav`],
  },
  // ── Studio ──────────────────────────────────────────────────────────────────
  // Studio A — LINN hihat + R8 drums (clean processed)
  studio: {
    kick:           [`${MIDI}R8/kick.wav`],
    snare:          [`${MIDI}R8/snare.wav`],
    'hihat-closed': [`${MIDI}LINN/hihat.wav`],
    'hihat-open':   [`${MIDI}LINN/hihat.wav`],
    crash:          [`${TONEJS}CR78/crash.mp3`],
    ride:           [`${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${MIDI}R8/tom1.wav`],
    'tom-mid':      [`${MIDI}R8/tom2.wav`],
    'tom-floor':    [`${MIDI}R8/tom3.wav`],
  },
  // Roland R8 — exclusively R8 samples
  r8: {
    kick:           [`${MIDI}R8/kick.wav`],
    snare:          [`${MIDI}R8/snare.wav`],
    'hihat-closed': [`${MIDI}R8/hihat.wav`],
    'hihat-open':   [`${MIDI}LINN/hihat.wav`],
    crash:          [`${TONEJS}CR78/crash.mp3`],
    ride:           [`${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${MIDI}R8/tom1.wav`],
    'tom-mid':      [`${MIDI}R8/tom2.wav`],
    'tom-floor':    [`${MIDI}R8/tom3.wav`],
  },
  // LinnDrum — acoustic-kit drums + LINN hihat (1982 sample machine feel)
  linn: {
    kick:           [`${MIDI}acoustic-kit/kick.wav`],
    snare:          [`${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${MIDI}LINN/hihat.wav`],
    'hihat-open':   [`${MIDI}LINN/hihat.wav`],
    crash:          [`${TONEJS}CR78/crash.mp3`],
    ride:           [`${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${MIDI}acoustic-kit/tom1.wav`],
  },
  // Funk Kit — Techno kick + R8 snare + LINN hihats (tight, snappy)
  funk: {
    kick:           [`${MIDI}Techno/kick.wav`,        `${MIDI}R8/kick.wav`],
    snare:          [`${MIDI}R8/snare.wav`,           `${MIDI}acoustic-kit/snare.wav`],
    'hihat-closed': [`${MIDI}LINN/hihat.wav`],
    'hihat-open':   [`${MIDI}LINN/hihat.wav`],
    'hihat-foot':   [`${MIDI}LINN/hihat.wav`],
    crash:          [`${TONEJS}CR78/crash.mp3`],
    ride:           [`${TONEJS}CR78/ride.mp3`],
    'tom-high':     [`${MIDI}R8/tom1.wav`],
  },
  // ── Electric ────────────────────────────────────────────────────────────────
  // Roland CR-78 — 1978 ToneJS CR78 samples exclusively
  cr78: {
    kick:           [`${TONEJS}CR78/kick.mp3`],
    snare:          [`${TONEJS}CR78/snare.mp3`],
    'hihat-closed': [`${TONEJS}CR78/hihat.mp3`],
    crash:          [`${TONEJS}CR78/crash.mp3`],
    'tom-high':     [`${TONEJS}CR78/highTom.mp3`],
  },
  // Roland TR-808 — 4OP-FM synthesis samples exclusively
  tr808: {
    kick:           [`${MIDI}4OP-FM/kick.wav`],
    snare:          [`${MIDI}4OP-FM/snare.wav`],
    'hihat-closed': [`${MIDI}4OP-FM/hihat.wav`],
    'hihat-open':   [`${MIDI}4OP-FM/hihat.wav`],
    crash:          [`${MIDI}4OP-FM/tom3.wav`],
    'tom-high':     [`${MIDI}4OP-FM/tom1.wav`],
  },
  // Techno — Techno samples + Stark hihat
  techno: {
    kick:           [`${MIDI}Techno/kick.wav`],
    snare:          [`${MIDI}Techno/snare.wav`],
    'hihat-closed': [`${MIDI}Techno/hihat.wav`],
    'hihat-foot':   [`${MIDI}Stark/hihat.wav`],
    crash:          [`${MIDI}Stark/tom3.wav`],
    'tom-high':     [`${MIDI}Techno/tom1.wav`],
  },
  // Stark Industrial — Stark + 4OP-FM (cold, metallic)
  stark: {
    kick:           [`${MIDI}4OP-FM/kick.wav`,        `${MIDI}Stark/tom3.wav`],
    snare:          [`${MIDI}Techno/snare.wav`,       `${MIDI}4OP-FM/snare.wav`],
    'hihat-closed': [`${MIDI}Stark/hihat.wav`],
    'hihat-open':   [`${MIDI}Stark/hihat.wav`],
    crash:          [`${MIDI}Stark/tom3.wav`,         `${MIDI}4OP-FM/tom3.wav`],
  },
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
  const { ctx } = getCtx();
  samplePool.loadForKit(kit, ctx);
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

// ── Main sound dispatcher ────────────────────────────────────────────────────
export function playSoundAt(
  soundId: string,
  time:    number,
  vol:     number,
  dest:    AudioNode,
  kit:     KitType | null = null,
) {
  const { ctx } = getCtx();
  const t    = Math.max(time, ctx.currentTime + 0.003);
  const inst = soundIdToInst(soundId);

  // Try kit-specific real sample first
  if (kit && inst && samplePool.hasForKit(kit, inst)) {
    const buf = samplePool.getForKit(kit, inst)!;
    if (inst === 'hihat-closed' || inst === 'hihat-foot') {
      const dur = inst === 'hihat-foot' ? 0.08 : (soundId === 'hh-c-tight' ? 0.032 : soundId === 'hh-c-crisp' ? 0.052 : 0.075);
      playBuffer(ctx, buf, t, vol, dest, dur);
    } else if (inst === 'tom-high') {
      playBuffer(ctx, buf, t, vol, dest, undefined, 1.35);
    } else if (inst === 'tom-mid') {
      playBuffer(ctx, buf, t, vol, dest, undefined, 1.0);
    } else if (inst === 'tom-floor') {
      playBuffer(ctx, buf, t, vol, dest, undefined, 0.80);
    } else {
      playBuffer(ctx, buf, t, vol, dest);
    }
    return;
  }

  // Synthesis fallback
  if      (soundId.startsWith('kick-'))    synthKick(ctx, t, vol, dest, soundId);
  else if (soundId.startsWith('snare-'))   synthSnare(ctx, t, vol, dest, soundId);
  else if (soundId.startsWith('hh-'))      synthHihat(ctx, t, vol, dest, soundId);
  else if (soundId.startsWith('tom-'))     synthTom(ctx, t, vol, dest, soundId);
  else if (soundId.startsWith('crash-') || soundId.startsWith('ride-')) synthCymbal(ctx, t, vol, dest, soundId);
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

    const measure = this._pattern.measures[mIdx];
    for (const inst of DRUM_INSTRUMENTS) {
      const hits = measure.hits[inst];
      if (!hits?.length) continue;
      const hit = hits.find(h => h.step === sInM);
      if (!hit) continue;
      const soundId = this._soundMap[inst] ?? defaultSoundId(inst);
      const vol     = Math.min((this._volMap[inst] ?? 1) * this._masterVol, 1.5);
      playSoundAt(soundId, time, vol, _masterGain!, this._kitType);
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
    this.doTick();
  }

  stop() {
    this._playing = false;
    if (this._tickId) { clearTimeout(this._tickId); this._tickId = null; }
    this.onStep?.(0, 0, -1);
  }

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

  get isPlaying() { return this._playing; }
}

export const drumScheduler = new DrumScheduler();

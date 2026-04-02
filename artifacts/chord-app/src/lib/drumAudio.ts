import type { DrumInstrument, DrumPattern } from '../store/useDrumStore';
import { DRUM_INSTRUMENTS, stepsPerMeasure } from '../store/useDrumStore';

// ── Sound variant catalogue ────────────────────────────────────
export interface SoundVariant { id: string; label: string; }

export const SOUND_VARIANTS: Record<DrumInstrument, SoundVariant[]> = {
  kick: [
    { id: 'kick-std',      label: 'Standard'  },
    { id: 'kick-tight',    label: 'Tight'     },
    { id: 'kick-808',      label: '808 Sub'   },
    { id: 'kick-acoustic', label: 'Acoustic'  },
  ],
  snare: [
    { id: 'snare-crack',   label: 'Crack'    },
    { id: 'snare-fat',     label: 'Fat'      },
    { id: 'snare-brush',   label: 'Brush'    },
    { id: 'snare-rimshot', label: 'Rimshot'  },
  ],
  'hihat-closed': [
    { id: 'hh-c-tight', label: 'Tight'          },
    { id: 'hh-c-crisp', label: 'Crisp'          },
    { id: 'hh-c-loose', label: 'Slightly Open'  },
  ],
  'hihat-open': [
    { id: 'hh-o-short', label: 'Short' },
    { id: 'hh-o-long',  label: 'Long'  },
    { id: 'hh-o-wash',  label: 'Wash'  },
  ],
  'hihat-foot': [
    { id: 'hh-f-std',    label: 'Standard' },
    { id: 'hh-f-splash', label: 'Splash'   },
  ],
  'tom-high': [
    { id: 'tom-hi-std',   label: 'Standard' },
    { id: 'tom-hi-tight', label: 'Tight'    },
  ],
  'tom-mid': [
    { id: 'tom-m-std',  label: 'Standard' },
    { id: 'tom-m-warm', label: 'Warm'     },
  ],
  'tom-floor': [
    { id: 'tom-f-std',  label: 'Standard' },
    { id: 'tom-f-deep', label: 'Deep'     },
  ],
  crash: [
    { id: 'crash-std',    label: 'Standard' },
    { id: 'crash-china',  label: 'China'    },
    { id: 'crash-bright', label: 'Bright'   },
  ],
  ride: [
    { id: 'ride-std',  label: 'Standard' },
    { id: 'ride-bell', label: 'Bell'     },
    { id: 'ride-wash', label: 'Wash'     },
  ],
};

export function defaultSoundId(inst: DrumInstrument): string {
  return SOUND_VARIANTS[inst][0].id;
}

export function soundVariantLabel(inst: DrumInstrument, id: string): string {
  return SOUND_VARIANTS[inst].find(v => v.id === id)?.label ?? id;
}

// ── AudioContext singleton ─────────────────────────────────────
let _ctx: AudioContext | null = null;
let _masterGain: GainNode | null = null;

function getCtx(): { ctx: AudioContext; master: GainNode } {
  if (!_ctx) {
    _ctx = new AudioContext();
    _masterGain = _ctx.createGain();
    _masterGain.gain.value = 0.8;
    _masterGain.connect(_ctx.destination);
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return { ctx: _ctx, master: _masterGain! };
}

// ── Noise helper ───────────────────────────────────────────────
function makeNoise(ctx: AudioContext, dur: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ── Synthesis functions ────────────────────────────────────────
function synthKick(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  type KP = { sf: number; ef: number; decay: number; click: number };
  const P: Record<string, KP> = {
    'kick-std':      { sf: 180, ef: 40,  decay: 0.45, click: 0.30 },
    'kick-tight':    { sf: 220, ef: 60,  decay: 0.22, click: 0.50 },
    'kick-808':      { sf: 80,  ef: 28,  decay: 1.30, click: 0.08 },
    'kick-acoustic': { sf: 150, ef: 42,  decay: 0.35, click: 0.50 },
  };
  const p = P[id] ?? P['kick-std'];

  const out = ctx.createGain();
  out.gain.setValueAtTime(vol, t);
  out.connect(dest);

  // Sine body
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(p.sf, t);
  osc.frequency.exponentialRampToValueAtTime(p.ef, t + p.decay);
  const og = ctx.createGain();
  og.gain.setValueAtTime(1, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + p.decay + 0.04);
  osc.connect(og); og.connect(out);
  osc.start(t); osc.stop(t + p.decay + 0.06);

  // Transient click
  const cs = ctx.createBufferSource();
  cs.buffer = makeNoise(ctx, 0.025);
  const cf = ctx.createBiquadFilter();
  cf.type = 'highpass'; cf.frequency.value = 900;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(p.click, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
  cs.connect(cf); cf.connect(cg); cg.connect(out);
  cs.start(t);
}

function synthSnare(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  type SP = { tone: number; tVol: number; tDecay: number; nVol: number; nDecay: number; bpHz: number; bpQ: number };
  const P: Record<string, SP> = {
    'snare-crack':   { tone: 230, tVol: 0.6, tDecay: 0.07, nVol: 1.2, nDecay: 0.11, bpHz: 5500, bpQ: 0.8 },
    'snare-fat':     { tone: 155, tVol: 0.9, tDecay: 0.16, nVol: 1.0, nDecay: 0.22, bpHz: 3500, bpQ: 0.5 },
    'snare-brush':   { tone: 175, tVol: 0.3, tDecay: 0.13, nVol: 0.55, nDecay: 0.20, bpHz: 3200, bpQ: 0.4 },
    'snare-rimshot': { tone: 285, tVol: 1.1, tDecay: 0.05, nVol: 0.9, nDecay: 0.08, bpHz: 6500, bpQ: 1.2 },
  };
  const p = P[id] ?? P['snare-crack'];

  const out = ctx.createGain();
  out.gain.setValueAtTime(vol, t);
  out.connect(dest);

  // Tone
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(p.tone, t);
  const og = ctx.createGain();
  og.gain.setValueAtTime(p.tVol, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + p.tDecay);
  osc.connect(og); og.connect(out);
  osc.start(t); osc.stop(t + p.tDecay + 0.01);

  // Noise (snare wires)
  const ns = ctx.createBufferSource();
  ns.buffer = makeNoise(ctx, p.nDecay + 0.02);
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass'; nf.frequency.value = p.bpHz; nf.Q.value = p.bpQ;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(p.nVol, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + p.nDecay);
  ns.connect(nf); nf.connect(ng); ng.connect(out);
  ns.start(t);
}

function synthHihat(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  type HP = { decay: number; hp: number; lp: number; nVol: number };
  const P: Record<string, HP> = {
    'hh-c-tight':  { decay: 0.032, hp: 7500, lp: 14000, nVol: 0.20 },
    'hh-c-crisp':  { decay: 0.048, hp: 6500, lp: 14000, nVol: 0.28 },
    'hh-c-loose':  { decay: 0.070, hp: 5800, lp: 12000, nVol: 0.25 },
    'hh-o-short':  { decay: 0.220, hp: 5200, lp: 12000, nVol: 0.40 },
    'hh-o-long':   { decay: 0.550, hp: 5000, lp: 12000, nVol: 0.40 },
    'hh-o-wash':   { decay: 0.900, hp: 4200, lp: 10500, nVol: 0.50 },
    'hh-f-std':    { decay: 0.080, hp: 6200, lp: 11000, nVol: 0.30 },
    'hh-f-splash': { decay: 0.150, hp: 5600, lp: 11000, nVol: 0.35 },
  };
  const p = P[id] ?? P['hh-c-tight'];

  const out = ctx.createGain();
  out.gain.setValueAtTime(vol, t);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = p.hp;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = p.lp;
  out.connect(hp); hp.connect(lp); lp.connect(dest);

  // Metallic oscillator bank
  [2.0, 3.0, 4.16, 5.43, 6.79, 8.21].forEach((r, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 42 * r;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.4 / (i + 1), t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
    osc.connect(og); og.connect(out);
    osc.start(t); osc.stop(t + p.decay + 0.01);
  });

  // Noise layer
  const ns = ctx.createBufferSource();
  ns.buffer = makeNoise(ctx, p.decay + 0.02);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(p.nVol, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
  ns.connect(ng); ng.connect(out);
  ns.start(t);
}

function synthTom(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  type TP = { sf: number; ef: number; decay: number; click: number };
  const P: Record<string, TP> = {
    'tom-hi-std':   { sf: 320, ef: 160, decay: 0.25, click: 0.30 },
    'tom-hi-tight': { sf: 340, ef: 185, decay: 0.15, click: 0.40 },
    'tom-m-std':    { sf: 215, ef: 100, decay: 0.32, click: 0.28 },
    'tom-m-warm':   { sf: 195, ef: 88,  decay: 0.40, click: 0.20 },
    'tom-f-std':    { sf: 140, ef: 60,  decay: 0.42, click: 0.28 },
    'tom-f-deep':   { sf: 105, ef: 44,  decay: 0.58, click: 0.20 },
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
  og.gain.setValueAtTime(1, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + p.decay);
  osc.connect(og); og.connect(out);
  osc.start(t); osc.stop(t + p.decay + 0.01);

  const cs = ctx.createBufferSource();
  cs.buffer = makeNoise(ctx, 0.02);
  const cf = ctx.createBiquadFilter();
  cf.type = 'highpass'; cf.frequency.value = 1500;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(p.click, t);
  cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  cs.connect(cf); cf.connect(cg); cg.connect(out);
  cs.start(t);
}

function synthCymbal(ctx: AudioContext, t: number, vol: number, dest: AudioNode, id: string) {
  type CP = { decay: number; hp: number; attack: number; baseF: number };
  const P: Record<string, CP> = {
    'crash-std':    { decay: 1.20, hp: 4000, attack: 0.005, baseF: 35 },
    'crash-china':  { decay: 0.90, hp: 5200, attack: 0.003, baseF: 46 },
    'crash-bright': { decay: 1.00, hp: 5800, attack: 0.004, baseF: 41 },
    'ride-std':     { decay: 1.50, hp: 5200, attack: 0.008, baseF: 52 },
    'ride-bell':    { decay: 0.75, hp: 6500, attack: 0.002, baseF: 65 },
    'ride-wash':    { decay: 2.00, hp: 3800, attack: 0.015, baseF: 30 },
  };
  const p = P[id] ?? P['crash-std'];

  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(vol, t + p.attack);
  out.gain.exponentialRampToValueAtTime(0.001, t + p.decay);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = p.hp;
  out.connect(hp); hp.connect(dest);

  [2.0, 3.0, 4.16, 5.43, 6.79, 8.21, 9.87, 11.34].forEach((r, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = p.baseF * r;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.3 / (i + 2), t);
    osc.connect(og); og.connect(out);
    osc.start(t); osc.stop(t + p.decay + 0.02);
  });

  const ns = ctx.createBufferSource();
  ns.buffer = makeNoise(ctx, p.decay + 0.02);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.28, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + p.decay);
  ns.connect(ng); ng.connect(out);
  ns.start(t);
}

// ── Main dispatch ──────────────────────────────────────────────
export function playSoundAt(soundId: string, time: number, vol: number, dest: AudioNode) {
  const { ctx } = getCtx();
  const t = Math.max(time, ctx.currentTime);
  if      (soundId.startsWith('kick-'))  synthKick(ctx, t, vol, dest, soundId);
  else if (soundId.startsWith('snare-')) synthSnare(ctx, t, vol, dest, soundId);
  else if (soundId.startsWith('hh-'))    synthHihat(ctx, t, vol, dest, soundId);
  else if (soundId.startsWith('tom-'))   synthTom(ctx, t, vol, dest, soundId);
  else if (soundId.startsWith('crash-') || soundId.startsWith('ride-')) synthCymbal(ctx, t, vol, dest, soundId);
}

// ── Playback scheduler ─────────────────────────────────────────
const LOOKAHEAD_S = 0.12;
const TICK_MS     = 25;

class DrumScheduler {
  private _playing  = false;
  private _looping  = true;
  private _pattern: DrumPattern | null = null;
  private _soundMap: Partial<Record<DrumInstrument, string>> = {};
  private _volMap:   Partial<Record<DrumInstrument, number>> = {};
  private _masterVol = 0.8;

  private _nextStepTime  = 0;
  private _currentStep   = 0;
  private _totalSteps    = 0;
  private _tickId: ReturnType<typeof setTimeout> | null = null;
  private _scheduled: { step: number; time: number }[] = [];

  onStep: ((globalStep: number, measureIdx: number, stepInMeasure: number) => void) | null = null;

  private secPerStep(): number {
    if (!this._pattern) return 0.125;
    const stepsPerBeat = this._pattern.subdivision / this._pattern.timeSignature[1];
    return (60 / this._pattern.bpm) / stepsPerBeat;
  }

  private scheduleNote(step: number, time: number) {
    if (!this._pattern || !_masterGain) return;
    const spm   = stepsPerMeasure(this._pattern);
    const mIdx  = Math.floor(step / spm);
    const sInM  = step % spm;
    if (mIdx >= this._pattern.measures.length) return;

    const measure = this._pattern.measures[mIdx];
    for (const inst of DRUM_INSTRUMENTS) {
      const hits = measure.hits[inst];
      if (!hits?.length) continue;
      const hit = hits.find(h => h.step === sInM);
      if (!hit) continue;
      const soundId = this._soundMap[inst] ?? defaultSoundId(inst);
      const vol     = (this._volMap[inst] ?? 1) * this._masterVol;
      playSoundAt(soundId, time, Math.min(vol, 1.5), _masterGain!);
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

    // Visual update
    const past = this._scheduled.filter(s => s.time <= now + 0.02);
    if (past.length && this._pattern) {
      const cur  = past[past.length - 1];
      const spm  = stepsPerMeasure(this._pattern);
      this.onStep?.(cur.step, Math.floor(cur.step / spm), cur.step % spm);
    }
    this._scheduled = this._scheduled.filter(s => s.time >= now - 0.15);

    if (this._playing) this._tickId = setTimeout(() => this.doTick(), TICK_MS);
  }

  start(
    pattern: DrumPattern,
    soundMap: Partial<Record<DrumInstrument, string>>,
    volMap:   Partial<Record<DrumInstrument, number>>,
    masterVol: number,
    loop: boolean,
  ) {
    this.stop();
    getCtx();
    this._pattern    = pattern;
    this._soundMap   = soundMap;
    this._volMap     = volMap;
    this._masterVol  = masterVol;
    this._looping    = loop;
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
    pattern: DrumPattern,
    soundMap: Partial<Record<DrumInstrument, string>>,
    volMap:   Partial<Record<DrumInstrument, number>>,
    masterVol: number,
    loop: boolean,
  ) {
    this._pattern   = pattern;
    this._soundMap  = soundMap;
    this._volMap    = volMap;
    this._masterVol = masterVol;
    this._looping   = loop;
    if (!this._totalSteps && pattern) {
      this._totalSteps = stepsPerMeasure(pattern) * pattern.measures.length;
    }
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
    if (_masterGain && _ctx) {
      _masterGain.gain.linearRampToValueAtTime(vol, _ctx.currentTime + 0.05);
    }
  }

  previewSound(soundId: string, vol = 0.7) {
    const { ctx, master } = getCtx();
    playSoundAt(soundId, ctx.currentTime + 0.01, vol, master);
  }

  get isPlaying() { return this._playing; }
}

export const drumScheduler = new DrumScheduler();

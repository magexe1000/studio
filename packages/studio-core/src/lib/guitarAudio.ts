import type { GuitarChordData } from '../data/chords';

const OPEN_STRINGS = [
  82.41,
  110.00,
  146.83,
  196.00,
  246.94,
  329.63,
];

const STRING_GAUGE = [0.052, 0.042, 0.032, 0.024, 0.016, 0.012];

let audioCtx: AudioContext | null = null;

const AudioCtxClass = typeof AudioContext !== 'undefined'
  ? AudioContext
  : (typeof (window as any).webkitAudioContext !== 'undefined' ? (window as any).webkitAudioContext as typeof AudioContext : null);

function getCtx(): AudioContext {
  if (!audioCtx) {
    if (!AudioCtxClass) throw new Error('Web Audio API not supported');
    audioCtx = new AudioCtxClass({ sampleRate: 44100 });
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function noteFreq(stringIdx: number, fret: number): number {
  return OPEN_STRINGS[stringIdx] * Math.pow(2, fret / 12);
}

function createPluckBuffer(
  ctx: AudioContext,
  freq: number,
  duration: number,
  stringIdx: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const samples = Math.ceil(sr * duration);
  const buffer = ctx.createBuffer(1, samples, sr);
  const data = buffer.getChannelData(0);

  const period = Math.round(sr / freq);
  if (period < 2) return buffer;

  const gauge = STRING_GAUGE[stringIdx];
  const isWound = stringIdx <= 3;

  for (let i = 0; i < period; i++) {
    const phase = i / period;
    const noise = Math.random() * 2 - 1;
    const shaped = noise * (1 - 0.3 * Math.sin(Math.PI * phase));
    const pluckPos = 0.13;
    const pluckFilter = Math.sin(Math.PI * phase / pluckPos);
    const excitation = phase < pluckPos ? shaped * pluckFilter : shaped * 0.6;
    data[i] = excitation;
  }

  const brightness = isWound ? 0.42 + stringIdx * 0.03 : 0.55 + (stringIdx - 4) * 0.08;
  const damping = 0.9985 + (1 - gauge / 0.052) * 0.0012;
  const blend = brightness;

  const allpass_coeff = 0.5 - 0.35 * (stringIdx / 5);

  let prev_allpass = 0;
  data[period] = damping * data[0];
  for (let i = period + 1; i < samples; i++) {
    const avg = blend * data[i - period] + (1 - blend) * data[i - period - 1];
    const allpassed = allpass_coeff * avg + prev_allpass - allpass_coeff * prev_allpass;
    prev_allpass = avg;
    data[i] = damping * allpassed;
  }

  if (isWound) {
    const buzzAmount = 0.015 * (gauge / 0.052);
    for (let i = 0; i < Math.min(samples, sr * 0.15); i++) {
      const t = i / sr;
      data[i] += buzzAmount * Math.sin(2 * Math.PI * freq * 3.01 * t) * Math.exp(-t * 30);
    }
  }

  const attack = 0.003;
  const decayRate = 1.8 + stringIdx * 0.3;
  for (let i = 0; i < samples; i++) {
    const t = i / sr;
    const attackEnv = t < attack ? t / attack : 1;
    const decayEnv = Math.exp(-t * decayRate);
    data[i] *= attackEnv * decayEnv;
  }

  return buffer;
}

let activeSources: AudioBufferSourceNode[] = [];
let playbackTimeout: ReturnType<typeof setTimeout> | null = null;

export function stopChordPlayback() {
  activeSources.forEach(n => { try { n.stop(); } catch {} });
  activeSources = [];
  if (playbackTimeout) { clearTimeout(playbackTimeout); playbackTimeout = null; }
}

export function playChord(data: GuitarChordData, volume: number = 0.65) {
  stopChordPlayback();

  const ctx = getCtx();
  const now = ctx.currentTime;

  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;

  const bodyLo = ctx.createBiquadFilter();
  bodyLo.type = 'peaking';
  bodyLo.frequency.value = 240;
  bodyLo.Q.value = 1.4;
  bodyLo.gain.value = 4;

  const bodyMid = ctx.createBiquadFilter();
  bodyMid.type = 'peaking';
  bodyMid.frequency.value = 420;
  bodyMid.Q.value = 1.0;
  bodyMid.gain.value = 2.5;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2800;
  presence.Q.value = 0.7;
  presence.gain.value = 1.5;

  const airShelf = ctx.createBiquadFilter();
  airShelf.type = 'highshelf';
  airShelf.frequency.value = 8000;
  airShelf.gain.value = -4;

  const antiAlias = ctx.createBiquadFilter();
  antiAlias.type = 'lowpass';
  antiAlias.frequency.value = 10000;
  antiAlias.Q.value = 0.707;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.15;

  masterGain
    .connect(bodyLo)
    .connect(bodyMid)
    .connect(presence)
    .connect(airShelf)
    .connect(antiAlias)
    .connect(comp)
    .connect(ctx.destination);

  const strumBase = 0.020;
  const strumVar = 0.010;
  const duration = 3.0;

  const stringsToPlay: { freq: number; stringIdx: number; delay: number }[] = [];
  let strumIdx = 0;

  for (let i = 0; i < 6; i++) {
    const fret = data.frets[i];
    if (fret === -1) continue;
    const delay = strumIdx * (strumBase + Math.random() * strumVar);
    stringsToPlay.push({ freq: noteFreq(i, fret), stringIdx: i, delay });
    strumIdx++;
  }

  stringsToPlay.forEach(({ freq, stringIdx, delay }) => {
    const buf = createPluckBuffer(ctx, freq, duration, stringIdx);
    const source = ctx.createBufferSource();
    source.buffer = buf;

    const stringGain = ctx.createGain();
    const velocityVar = 0.82 + Math.random() * 0.18;
    const stringBalance = stringIdx <= 2 ? 0.85 : 0.75 + (stringIdx / 5) * 0.25;
    stringGain.gain.value = velocityVar * stringBalance;

    source.connect(stringGain).connect(masterGain);

    const t = now + delay;
    source.start(t);
    activeSources.push(source);
  });

  playbackTimeout = setTimeout(() => { activeSources = []; }, (duration + 0.5) * 1000);
}


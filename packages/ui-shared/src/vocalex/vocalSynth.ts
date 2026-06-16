import { createAudioContext } from '@workspace/studio-core';
import { NOTE_FREQ } from './exerciseData';

let ctx: AudioContext | null = null;
let activeNodes: AudioNode[] = [];
let activeOscs: (OscillatorNode | AudioBufferSourceNode)[] = [];
let noiseBuffer: AudioBuffer | null = null;
let voiceId = 0;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') ctx = createAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function getNoiseBuffer(): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const audio = getCtx();
  const len = audio.sampleRate * 2;
  noiseBuffer = audio.createBuffer(1, len, audio.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
    if (i > 0) data[i] = data[i] * 0.4 + data[i - 1] * 0.6;
  }
  return noiseBuffer;
}

export function stopVoice() {
  for (const osc of activeOscs) {
    try { osc.stop(); osc.disconnect(); } catch {}
  }
  for (const n of activeNodes) {
    try { n.disconnect(); } catch {}
  }
  activeOscs = [];
  activeNodes = [];
}

interface FormantDef {
  freq: number;
  bw: number;
  gain: number;
}

const VOWEL_FORMANTS: Record<string, FormantDef[]> = {
  'mm': [
    { freq: 250, bw: 80, gain: 1.0 },
    { freq: 2500, bw: 300, gain: 0.12 },
    { freq: 3500, bw: 400, gain: 0.04 },
  ],
  'ah': [
    { freq: 780, bw: 120, gain: 1.0 },
    { freq: 1200, bw: 150, gain: 0.55 },
    { freq: 2600, bw: 200, gain: 0.12 },
  ],
  'ee': [
    { freq: 280, bw: 80, gain: 1.0 },
    { freq: 2250, bw: 150, gain: 0.45 },
    { freq: 2900, bw: 200, gain: 0.18 },
  ],
  'eh': [
    { freq: 520, bw: 90, gain: 1.0 },
    { freq: 1800, bw: 140, gain: 0.4 },
    { freq: 2500, bw: 180, gain: 0.12 },
  ],
  'oh': [
    { freq: 480, bw: 100, gain: 1.0 },
    { freq: 750, bw: 120, gain: 0.65 },
    { freq: 2700, bw: 200, gain: 0.06 },
  ],
  'oo': [
    { freq: 310, bw: 70, gain: 1.0 },
    { freq: 900, bw: 120, gain: 0.35 },
    { freq: 2300, bw: 180, gain: 0.06 },
  ],
  'uh': [
    { freq: 620, bw: 90, gain: 1.0 },
    { freq: 1200, bw: 130, gain: 0.4 },
    { freq: 2400, bw: 180, gain: 0.1 },
  ],
  'la': [
    { freq: 700, bw: 110, gain: 1.0 },
    { freq: 1100, bw: 140, gain: 0.5 },
    { freq: 2600, bw: 180, gain: 0.1 },
  ],
  'na': [
    { freq: 540, bw: 100, gain: 1.0 },
    { freq: 1350, bw: 150, gain: 0.45 },
    { freq: 2500, bw: 180, gain: 0.1 },
  ],
  'ng': [
    { freq: 280, bw: 70, gain: 1.0 },
    { freq: 2300, bw: 250, gain: 0.2 },
    { freq: 3100, bw: 300, gain: 0.06 },
  ],
  'nay': [
    { freq: 350, bw: 80, gain: 1.0 },
    { freq: 2050, bw: 150, gain: 0.45 },
    { freq: 2800, bw: 180, gain: 0.14 },
  ],
  'ya': [
    { freq: 730, bw: 110, gain: 1.0 },
    { freq: 1200, bw: 140, gain: 0.5 },
    { freq: 2700, bw: 180, gain: 0.1 },
  ],
  'da': [
    { freq: 700, bw: 100, gain: 1.0 },
    { freq: 1050, bw: 130, gain: 0.5 },
    { freq: 2500, bw: 180, gain: 0.1 },
  ],
  'ha': [
    { freq: 780, bw: 120, gain: 1.0 },
    { freq: 1100, bw: 140, gain: 0.5 },
    { freq: 2600, bw: 190, gain: 0.1 },
  ],
  'ga': [
    { freq: 740, bw: 110, gain: 1.0 },
    { freq: 1150, bw: 140, gain: 0.48 },
    { freq: 2600, bw: 180, gain: 0.1 },
  ],
  'ba': [
    { freq: 700, bw: 110, gain: 1.0 },
    { freq: 1100, bw: 140, gain: 0.5 },
    { freq: 2500, bw: 180, gain: 0.1 },
  ],
  'ma': [
    { freq: 580, bw: 90, gain: 1.0 },
    { freq: 1100, bw: 140, gain: 0.38 },
    { freq: 2600, bw: 180, gain: 0.08 },
  ],
  'goh': [
    { freq: 480, bw: 100, gain: 1.0 },
    { freq: 750, bw: 120, gain: 0.6 },
    { freq: 2700, bw: 200, gain: 0.06 },
  ],
  'nee': [
    { freq: 300, bw: 70, gain: 1.0 },
    { freq: 2200, bw: 150, gain: 0.45 },
    { freq: 2900, bw: 200, gain: 0.16 },
  ],
  'mah': [
    { freq: 700, bw: 100, gain: 1.0 },
    { freq: 1050, bw: 130, gain: 0.42 },
    { freq: 2600, bw: 180, gain: 0.08 },
  ],
};

function mapSyllableToFormant(syllable: string): FormantDef[] {
  const raw = syllable
    .replace(/[↑↓→().…"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const first = raw.split(' ')[0];

  if (VOWEL_FORMANTS[first]) return VOWEL_FORMANTS[first];

  if (first.startsWith('mm') || first === 'hum') return VOWEL_FORMANTS['mm'];
  if (first.startsWith('brr')) return VOWEL_FORMANTS['mm'];
  if (first.startsWith('rrr')) return VOWEL_FORMANTS['mm'];
  if (first.startsWith('haa') || first.startsWith('hah')) return VOWEL_FORMANTS['ah'];
  if (first.startsWith('hoo')) return VOWEL_FORMANTS['oo'];
  if (first.startsWith('hee')) return VOWEL_FORMANTS['ee'];
  if (first.startsWith('ah')) return VOWEL_FORMANTS['ah'];
  if (first.startsWith('oh')) return VOWEL_FORMANTS['oh'];
  if (first.startsWith('oo')) return VOWEL_FORMANTS['oo'];
  if (first.startsWith('ee')) return VOWEL_FORMANTS['ee'];
  if (first.startsWith('ng')) return VOWEL_FORMANTS['ng'];
  if (first.startsWith('la')) return VOWEL_FORMANTS['la'];
  if (first.startsWith('na')) return VOWEL_FORMANTS['na'];
  if (first.startsWith('nay')) return VOWEL_FORMANTS['nay'];
  if (first.startsWith('ya')) return VOWEL_FORMANTS['ya'];
  if (first.startsWith('da')) return VOWEL_FORMANTS['da'];
  if (first.startsWith('ha')) return VOWEL_FORMANTS['ha'];
  if (first.startsWith('ga')) return VOWEL_FORMANTS['ga'];
  if (first.startsWith('ba')) return VOWEL_FORMANTS['ba'];
  if (first.startsWith('ma')) return VOWEL_FORMANTS['ma'];
  if (first.startsWith('goh')) return VOWEL_FORMANTS['goh'];
  if (first.startsWith('nee')) return VOWEL_FORMANTS['nee'];
  if (first.startsWith('mah')) return VOWEL_FORMANTS['mah'];

  if (raw.includes('ah') || raw.includes('ahhh')) return VOWEL_FORMANTS['ah'];
  if (raw.includes('oh')) return VOWEL_FORMANTS['oh'];

  return VOWEL_FORMANTS['ah'];
}

interface VoiceOptions {
  freq: number;
  durationMs: number;
  syllable?: string;
  isTrill?: boolean;
  volume?: number;
}

export function playVoice(opts: VoiceOptions) {
  stopVoice();
  const thisId = ++voiceId;
  const audio = getCtx();
  const { freq, durationMs, syllable, isTrill, volume = 0.3 } = opts;
  const dur = durationMs / 1000;
  const now = audio.currentTime;
  const end = now + dur;

  const formants = syllable ? mapSyllableToFormant(syllable) : VOWEL_FORMANTS['ah'];

  const glottalOsc = audio.createOscillator();
  glottalOsc.type = 'sawtooth';
  glottalOsc.frequency.setValueAtTime(freq, now);
  activeOscs.push(glottalOsc);

  const h2Osc = audio.createOscillator();
  h2Osc.type = 'sine';
  h2Osc.frequency.setValueAtTime(freq * 2, now);
  activeOscs.push(h2Osc);

  const h3Osc = audio.createOscillator();
  h3Osc.type = 'sine';
  h3Osc.frequency.setValueAtTime(freq * 3, now);
  activeOscs.push(h3Osc);

  const subOsc = audio.createOscillator();
  subOsc.type = 'triangle';
  subOsc.frequency.setValueAtTime(freq, now);
  activeOscs.push(subOsc);

  const vibratoLfo = audio.createOscillator();
  vibratoLfo.type = 'sine';
  vibratoLfo.frequency.setValueAtTime(5 + Math.random() * 0.6, now);
  const vibratoDepth = audio.createGain();
  vibratoDepth.gain.setValueAtTime(0, now);
  vibratoDepth.gain.linearRampToValueAtTime(0, now + 0.3);
  vibratoDepth.gain.linearRampToValueAtTime(freq * 0.008, now + 0.8);
  vibratoLfo.connect(vibratoDepth);
  vibratoDepth.connect(glottalOsc.frequency);
  vibratoDepth.connect(h2Osc.frequency);
  vibratoDepth.connect(h3Osc.frequency);
  vibratoDepth.connect(subOsc.frequency);
  vibratoLfo.start(now);
  vibratoLfo.stop(end);
  activeOscs.push(vibratoLfo);
  activeNodes.push(vibratoDepth);

  const driftLfo = audio.createOscillator();
  driftLfo.type = 'sine';
  driftLfo.frequency.setValueAtTime(0.3 + Math.random() * 0.4, now);
  const driftDepth = audio.createGain();
  driftDepth.gain.setValueAtTime(freq * 0.002, now);
  driftLfo.connect(driftDepth);
  driftDepth.connect(glottalOsc.frequency);
  driftDepth.connect(subOsc.frequency);
  driftLfo.start(now);
  driftLfo.stop(end);
  activeOscs.push(driftLfo);
  activeNodes.push(driftDepth);

  const glottalMix = audio.createGain();
  glottalMix.gain.setValueAtTime(0.55, now);
  glottalOsc.connect(glottalMix);
  activeNodes.push(glottalMix);

  const h2Mix = audio.createGain();
  h2Mix.gain.setValueAtTime(0.18, now);
  h2Osc.connect(h2Mix);
  activeNodes.push(h2Mix);

  const h3Mix = audio.createGain();
  h3Mix.gain.setValueAtTime(0.08, now);
  h3Osc.connect(h3Mix);
  activeNodes.push(h3Mix);

  const subMix = audio.createGain();
  subMix.gain.setValueAtTime(0.2, now);
  subOsc.connect(subMix);
  activeNodes.push(subMix);

  const noiseSrc = audio.createBufferSource();
  noiseSrc.buffer = getNoiseBuffer();
  noiseSrc.loop = true;
  activeOscs.push(noiseSrc);

  const noiseFilter = audio.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(2200, now);
  noiseFilter.Q.setValueAtTime(1.5, now);
  noiseSrc.connect(noiseFilter);
  activeNodes.push(noiseFilter);

  const noiseMix = audio.createGain();
  noiseMix.gain.setValueAtTime(0.06, now);
  noiseFilter.connect(noiseMix);
  activeNodes.push(noiseMix);

  const preFormant = audio.createGain();
  preFormant.gain.setValueAtTime(1, now);
  glottalMix.connect(preFormant);
  h2Mix.connect(preFormant);
  h3Mix.connect(preFormant);
  subMix.connect(preFormant);
  noiseMix.connect(preFormant);
  activeNodes.push(preFormant);

  const formantSum = audio.createGain();
  formantSum.gain.setValueAtTime(1, now);
  activeNodes.push(formantSum);

  for (const f of formants) {
    const bp = audio.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f.freq, now);
    bp.Q.setValueAtTime(f.freq / f.bw, now);
    const fGain = audio.createGain();
    fGain.gain.setValueAtTime(f.gain, now);
    preFormant.connect(bp);
    bp.connect(fGain);
    fGain.connect(formantSum);
    activeNodes.push(bp, fGain);
  }

  const directThrough = audio.createGain();
  directThrough.gain.setValueAtTime(0.08, now);
  preFormant.connect(directThrough);
  activeNodes.push(directThrough);

  const warmth = audio.createBiquadFilter();
  warmth.type = 'lowshelf';
  warmth.frequency.setValueAtTime(350, now);
  warmth.gain.setValueAtTime(4, now);
  formantSum.connect(warmth);
  directThrough.connect(warmth);
  activeNodes.push(warmth);

  const presence = audio.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.setValueAtTime(2800, now);
  presence.Q.setValueAtTime(2, now);
  presence.gain.setValueAtTime(3, now);
  warmth.connect(presence);
  activeNodes.push(presence);

  const airCut = audio.createBiquadFilter();
  airCut.type = 'lowpass';
  airCut.frequency.setValueAtTime(5000, now);
  airCut.Q.setValueAtTime(0.5, now);
  presence.connect(airCut);
  activeNodes.push(airCut);

  const envelope = audio.createGain();
  const attack = Math.min(0.18, dur * 0.12);
  const release = Math.min(0.25, dur * 0.2);
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.setValueAtTime(0, now + 0.001);
  envelope.gain.linearRampToValueAtTime(volume * 0.6, now + attack * 0.3);
  envelope.gain.linearRampToValueAtTime(volume, now + attack);
  if (end - release > now + attack) {
    envelope.gain.setValueAtTime(volume, end - release);
  }
  envelope.gain.linearRampToValueAtTime(volume * 0.3, end - release * 0.3);
  envelope.gain.linearRampToValueAtTime(0, end);
  airCut.connect(envelope);
  activeNodes.push(envelope);

  if (isTrill) {
    const trillLfo = audio.createOscillator();
    trillLfo.type = 'sine';
    trillLfo.frequency.setValueAtTime(20 + Math.random() * 5, now);
    const trillDepth = audio.createGain();
    trillDepth.gain.setValueAtTime(volume * 0.35, now);
    trillLfo.connect(trillDepth);
    trillDepth.connect(envelope.gain);
    trillLfo.start(now);
    trillLfo.stop(end);
    activeOscs.push(trillLfo);
    activeNodes.push(trillDepth);
  }

  const jitterLfo = audio.createOscillator();
  jitterLfo.type = 'sine';
  jitterLfo.frequency.setValueAtTime(12 + Math.random() * 4, now);
  const jitterDepth = audio.createGain();
  jitterDepth.gain.setValueAtTime(volume * 0.02, now);
  jitterLfo.connect(jitterDepth);
  jitterDepth.connect(envelope.gain);
  jitterLfo.start(now);
  jitterLfo.stop(end);
  activeOscs.push(jitterLfo);
  activeNodes.push(jitterDepth);

  const limiter = audio.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-6, now);
  limiter.knee.setValueAtTime(6, now);
  limiter.ratio.setValueAtTime(12, now);
  limiter.attack.setValueAtTime(0.003, now);
  limiter.release.setValueAtTime(0.15, now);
  activeNodes.push(limiter);

  envelope.connect(limiter);
  limiter.connect(audio.destination);

  glottalOsc.start(now);
  glottalOsc.stop(end);
  h2Osc.start(now);
  h2Osc.stop(end);
  h3Osc.start(now);
  h3Osc.stop(end);
  subOsc.start(now);
  subOsc.stop(end);
  noiseSrc.start(now);
  noiseSrc.stop(end);

  glottalOsc.onended = () => {
    if (voiceId === thisId) {
      activeOscs = [];
      activeNodes = [];
    }
  };
}

export function playNoteVoice(targetNote: string, durationSec: number, syllable?: string) {
  const note = targetNote.split('→')[0].split(',')[0].trim();
  const freq = NOTE_FREQ[note];
  if (!freq) return;

  const isTrill = syllable
    ? /brr|rrr|trill/i.test(syllable)
    : false;

  playVoice({
    freq,
    durationMs: Math.min(2500, durationSec * 500),
    syllable: syllable ?? 'ah',
    isTrill,
    volume: 0.35,
  });
}

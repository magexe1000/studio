import { NOTE_FREQ } from './exerciseData';

let ctx: AudioContext | null = null;
let activeNodes: AudioNode[] = [];
let activeOscs: OscillatorNode[] = [];

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
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
    { freq: 250, bw: 60, gain: 1.0 },
    { freq: 2500, bw: 200, gain: 0.15 },
    { freq: 3500, bw: 300, gain: 0.05 },
  ],
  'ah': [
    { freq: 800, bw: 80, gain: 1.0 },
    { freq: 1150, bw: 90, gain: 0.5 },
    { freq: 2800, bw: 120, gain: 0.1 },
  ],
  'ee': [
    { freq: 270, bw: 60, gain: 1.0 },
    { freq: 2300, bw: 100, gain: 0.4 },
    { freq: 3000, bw: 120, gain: 0.15 },
  ],
  'eh': [
    { freq: 530, bw: 60, gain: 1.0 },
    { freq: 1850, bw: 100, gain: 0.35 },
    { freq: 2500, bw: 120, gain: 0.1 },
  ],
  'oh': [
    { freq: 500, bw: 70, gain: 1.0 },
    { freq: 700, bw: 80, gain: 0.6 },
    { freq: 2800, bw: 120, gain: 0.05 },
  ],
  'oo': [
    { freq: 300, bw: 50, gain: 1.0 },
    { freq: 870, bw: 80, gain: 0.3 },
    { freq: 2250, bw: 120, gain: 0.05 },
  ],
  'uh': [
    { freq: 640, bw: 60, gain: 1.0 },
    { freq: 1200, bw: 80, gain: 0.35 },
    { freq: 2400, bw: 120, gain: 0.08 },
  ],
  'la': [
    { freq: 700, bw: 80, gain: 1.0 },
    { freq: 1100, bw: 90, gain: 0.5 },
    { freq: 2700, bw: 120, gain: 0.1 },
  ],
  'na': [
    { freq: 550, bw: 70, gain: 1.0 },
    { freq: 1400, bw: 100, gain: 0.4 },
    { freq: 2600, bw: 120, gain: 0.1 },
  ],
  'ng': [
    { freq: 280, bw: 50, gain: 1.0 },
    { freq: 2300, bw: 150, gain: 0.2 },
    { freq: 3200, bw: 200, gain: 0.05 },
  ],
  'nay': [
    { freq: 350, bw: 60, gain: 1.0 },
    { freq: 2100, bw: 100, gain: 0.4 },
    { freq: 2900, bw: 120, gain: 0.12 },
  ],
  'ya': [
    { freq: 750, bw: 80, gain: 1.0 },
    { freq: 1200, bw: 90, gain: 0.45 },
    { freq: 2800, bw: 120, gain: 0.1 },
  ],
  'da': [
    { freq: 700, bw: 70, gain: 1.0 },
    { freq: 1050, bw: 80, gain: 0.5 },
    { freq: 2600, bw: 120, gain: 0.1 },
  ],
  'ha': [
    { freq: 800, bw: 80, gain: 1.0 },
    { freq: 1100, bw: 90, gain: 0.45 },
    { freq: 2700, bw: 120, gain: 0.08 },
  ],
  'ga': [
    { freq: 750, bw: 80, gain: 1.0 },
    { freq: 1150, bw: 90, gain: 0.45 },
    { freq: 2700, bw: 120, gain: 0.1 },
  ],
  'ba': [
    { freq: 720, bw: 80, gain: 1.0 },
    { freq: 1100, bw: 90, gain: 0.5 },
    { freq: 2600, bw: 120, gain: 0.1 },
  ],
  'ma': [
    { freq: 600, bw: 60, gain: 1.0 },
    { freq: 1100, bw: 90, gain: 0.35 },
    { freq: 2700, bw: 120, gain: 0.08 },
  ],
  'ss': [
    { freq: 4000, bw: 500, gain: 0.2 },
    { freq: 7000, bw: 600, gain: 0.15 },
    { freq: 10000, bw: 800, gain: 0.05 },
  ],
  'zz': [
    { freq: 250, bw: 60, gain: 0.5 },
    { freq: 4000, bw: 400, gain: 0.2 },
    { freq: 7000, bw: 500, gain: 0.1 },
  ],
  'goh': [
    { freq: 500, bw: 70, gain: 1.0 },
    { freq: 750, bw: 80, gain: 0.6 },
    { freq: 2800, bw: 120, gain: 0.05 },
  ],
  'nee': [
    { freq: 300, bw: 50, gain: 1.0 },
    { freq: 2200, bw: 100, gain: 0.4 },
    { freq: 3000, bw: 120, gain: 0.15 },
  ],
  'mah': [
    { freq: 700, bw: 70, gain: 1.0 },
    { freq: 1050, bw: 90, gain: 0.4 },
    { freq: 2700, bw: 120, gain: 0.08 },
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
  if (first.startsWith('ss')) return VOWEL_FORMANTS['ss'];
  if (first.startsWith('zz')) return VOWEL_FORMANTS['zz'];
  if (first.startsWith('fff')) return VOWEL_FORMANTS['ss'];

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
  const audio = getCtx();
  const { freq, durationMs, syllable, isTrill, volume = 0.14 } = opts;
  const dur = durationMs / 1000;
  const now = audio.currentTime;
  const end = now + dur;

  const formants = syllable ? mapSyllableToFormant(syllable) : VOWEL_FORMANTS['ah'];

  const mainOsc = audio.createOscillator();
  mainOsc.type = 'sawtooth';
  mainOsc.frequency.setValueAtTime(freq, now);
  activeOscs.push(mainOsc);

  const vibratoLfo = audio.createOscillator();
  vibratoLfo.type = 'sine';
  vibratoLfo.frequency.setValueAtTime(5.2, now);
  const vibratoGain = audio.createGain();
  vibratoGain.gain.setValueAtTime(0, now);
  vibratoGain.gain.linearRampToValueAtTime(freq * 0.006, now + 0.4);
  vibratoLfo.connect(vibratoGain);
  vibratoGain.connect(mainOsc.frequency);
  vibratoLfo.start(now);
  vibratoLfo.stop(end);
  activeOscs.push(vibratoLfo);
  activeNodes.push(vibratoGain);

  const subOsc = audio.createOscillator();
  subOsc.type = 'triangle';
  subOsc.frequency.setValueAtTime(freq, now);
  vibratoGain.connect(subOsc.frequency);
  activeOscs.push(subOsc);

  const subGain = audio.createGain();
  subGain.gain.setValueAtTime(0.25, now);
  subOsc.connect(subGain);
  activeNodes.push(subGain);

  const mixer = audio.createGain();
  mixer.gain.setValueAtTime(1, now);
  mainOsc.connect(mixer);
  subGain.connect(mixer);
  activeNodes.push(mixer);

  const formantSum = audio.createGain();
  formantSum.gain.setValueAtTime(0, now);
  activeNodes.push(formantSum);

  for (const f of formants) {
    const bp = audio.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f.freq, now);
    bp.Q.setValueAtTime(f.freq / f.bw, now);
    const fGain = audio.createGain();
    fGain.gain.setValueAtTime(f.gain, now);
    mixer.connect(bp);
    bp.connect(fGain);
    fGain.connect(formantSum);
    activeNodes.push(bp, fGain);
  }

  const warmth = audio.createBiquadFilter();
  warmth.type = 'lowshelf';
  warmth.frequency.setValueAtTime(300, now);
  warmth.gain.setValueAtTime(3, now);
  formantSum.connect(warmth);
  activeNodes.push(warmth);

  const airCut = audio.createBiquadFilter();
  airCut.type = 'lowpass';
  airCut.frequency.setValueAtTime(4500, now);
  airCut.Q.setValueAtTime(0.7, now);
  warmth.connect(airCut);
  activeNodes.push(airCut);

  const envelope = audio.createGain();
  const attack = Math.min(0.15, dur * 0.15);
  const release = Math.min(0.2, dur * 0.2);
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(volume, now + attack);
  envelope.gain.setValueAtTime(volume, end - release);
  envelope.gain.linearRampToValueAtTime(0, end);
  airCut.connect(envelope);
  activeNodes.push(envelope);

  if (isTrill) {
    const trillLfo = audio.createOscillator();
    trillLfo.type = 'sine';
    trillLfo.frequency.setValueAtTime(22, now);
    const trillDepth = audio.createGain();
    trillDepth.gain.setValueAtTime(volume * 0.4, now);
    trillLfo.connect(trillDepth);
    trillDepth.connect(envelope.gain);
    trillLfo.start(now);
    trillLfo.stop(end);
    activeOscs.push(trillLfo);
    activeNodes.push(trillDepth);
  }

  envelope.connect(audio.destination);

  mainOsc.start(now);
  mainOsc.stop(end);
  subOsc.start(now);
  subOsc.stop(end);

  mainOsc.onended = () => {
    activeOscs = activeOscs.filter(o => o !== mainOsc && o !== subOsc && o !== vibratoLfo);
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
    volume: 0.13,
  });
}

import { detectPitch, type PitchResult } from './pitchYin';
import { NOTE_FREQ } from './exerciseData';
import { createAudioContext } from '../lib/audioContextOptions';

export interface DetectorState {
  listening: boolean;
  currentPitch: PitchResult | null;
  accuracy: number;
  centsOff: number;
  status: 'silent' | 'good' | 'close' | 'off';
}

export interface StepScore {
  avgCentsOff: number;
  accuracy: number;
  samplesDetected: number;
  totalSamples: number;
}

const CENTS_GOOD = 15;
const CENTS_CLOSE = 35;

export function noteNameToFreq(noteName: string): number | null {
  const clean = noteName.split('→')[0].split(',')[0].trim();
  return NOTE_FREQ[clean] ?? null;
}

export function freqToCents(detected: number, target: number): number {
  if (target <= 0 || detected <= 0) return 999;
  return 1200 * Math.log2(detected / target);
}

export function centsToAccuracy(cents: number): number {
  const absCents = Math.abs(cents);
  if (absCents <= 5) return 1.0;
  if (absCents <= 10) return 0.95;
  if (absCents <= CENTS_GOOD) return 0.85;
  if (absCents <= 25) return 0.70;
  if (absCents <= CENTS_CLOSE) return 0.50;
  if (absCents <= 50) return 0.25;
  return 0.0;
}

export function centsToStatus(cents: number): 'good' | 'close' | 'off' {
  const absCents = Math.abs(cents);
  if (absCents <= CENTS_GOOD) return 'good';
  if (absCents <= CENTS_CLOSE) return 'close';
  return 'off';
}

export function statusColor(status: DetectorState['status']): string {
  switch (status) {
    case 'good': return '#34d399';
    case 'close': return '#eab308';
    case 'off': return '#ef4444';
    default: return '#484848';
  }
}

export class PracticeDetector {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private buffer: Float32Array<ArrayBuffer> | null = null;
  private targetFreq = 0;
  private samples: number[] = [];
  private totalSamples = 0;
  private onUpdate: ((state: DetectorState) => void) | null = null;

  async start(onUpdate: (state: DetectorState) => void) {
    this.onUpdate = onUpdate;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.ctx = createAudioContext();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      src.connect(this.analyser);
      this.buffer = new Float32Array(this.analyser.fftSize);
      this.tick();
    } catch {
      onUpdate({ listening: false, currentPitch: null, accuracy: 0, centsOff: 0, status: 'silent' });
    }
  }

  setTarget(noteName: string | undefined) {
    this.targetFreq = noteName ? (noteNameToFreq(noteName) ?? 0) : 0;
    this.samples = [];
    this.totalSamples = 0;
  }

  getStepScore(): StepScore {
    const detected = this.samples.length;
    const total = Math.max(1, this.totalSamples);
    if (detected === 0) return { avgCentsOff: 0, accuracy: 0, samplesDetected: 0, totalSamples: total };
    const avgCents = this.samples.reduce((s, c) => s + Math.abs(c), 0) / detected;
    const accuracy = this.samples.reduce((s, c) => s + centsToAccuracy(c), 0) / detected;
    return { avgCentsOff: avgCents, accuracy, samplesDetected: detected, totalSamples: total };
  }

  resetStepScore() {
    this.samples = [];
    this.totalSamples = 0;
  }

  private tick = () => {
    if (!this.analyser || !this.buffer || !this.ctx) return;
    this.analyser.getFloatTimeDomainData(this.buffer);
    const result = detectPitch(this.buffer, this.ctx.sampleRate, 0.75);

    this.totalSamples++;

    if (!result || this.targetFreq <= 0) {
      this.onUpdate?.({
        listening: true,
        currentPitch: result,
        accuracy: 0,
        centsOff: 0,
        status: result ? 'silent' : 'silent',
      });
    } else {
      const cents = freqToCents(result.frequency, this.targetFreq);
      const accuracy = centsToAccuracy(cents);
      const status = centsToStatus(cents);
      this.samples.push(cents);
      this.onUpdate?.({
        listening: true,
        currentPitch: result,
        accuracy,
        centsOff: cents,
        status,
      });
    }

    this.raf = requestAnimationFrame(this.tick);
  };

  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach(t => t.stop());
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.stream = null;
    this.analyser = null;
    this.buffer = null;
    this.onUpdate = null;
  }
}

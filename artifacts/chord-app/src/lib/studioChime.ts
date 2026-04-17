/**
 * Studio Chime — 80s synthwave "studio open" stinger.
 *
 * Voiced like a Juno/JP-8 pad with a resonant filter sweep — think
 * Blade Runner / Stranger Things / Tangerine Dream:
 *  • Lush Cmaj9 chord (C–E–G–B–D) — the classic dreamy 80s extension.
 *  • Each note is 3 detuned sawtooth oscillators (±7 cents) for analog warmth.
 *  • Single shared low-pass filter with high resonance, swept from
 *    ~350 Hz → ~3.8 kHz over the first 700 ms — that signature "wowww".
 *  • Sub-octave triangle bass on the root for chest-felt warmth.
 *  • Sine "shimmer" layer two octaves up for the airy top end.
 *  • One quiet delay tap at 280 ms for synthwave space.
 *
 * Length ≈ 1.6 s. Generated entirely in-browser, no samples.
 */

let _ctx: AudioContext | null = null;
let _lastPlay = 0;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!_ctx) _ctx = new AC();
  return _ctx;
}

/** Convert cents offset to a frequency multiplier (2^(cents/1200)). */
function cents(c: number): number {
  return Math.pow(2, c / 1200);
}

interface PadVoiceOpts {
  freq: number;
  startAt: number;
  duration: number;
  peakGain: number;
}

/** A single "fat" pad voice: 3 detuned sawtooths through a shared dest. */
function schedulePadVoice(ctx: AudioContext, dest: AudioNode, opts: PadVoiceOpts) {
  const { freq, startAt, duration, peakGain } = opts;

  const voiceGain = ctx.createGain();
  voiceGain.gain.setValueAtTime(0.0001, startAt);
  // Soft 80 ms attack — the "swelling in" feel
  voiceGain.gain.linearRampToValueAtTime(peakGain, startAt + 0.08);
  // Hold near peak then long release (synthy tail)
  voiceGain.gain.setValueAtTime(peakGain, startAt + duration - 0.55);
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  voiceGain.connect(dest);

  // 3 detuned saws — center, +7 ¢, −7 ¢ — gives the "supersaw lite" thickness
  [0, +7, -7].forEach((detune) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq * cents(detune);
    osc.connect(voiceGain);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  });
}

interface SineLayerOpts {
  freq: number;
  startAt: number;
  duration: number;
  peakGain: number;
}

function scheduleSineShimmer(ctx: AudioContext, dest: AudioNode, opts: SineLayerOpts) {
  const { freq, startAt, duration, peakGain } = opts;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(dest);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

function scheduleSubBass(ctx: AudioContext, dest: AudioNode, freq: number, startAt: number, duration: number, peakGain: number) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.05);
  gain.gain.setValueAtTime(peakGain, startAt + duration - 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(dest);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

export function playStudioChime(): void {
  // Debounce — guard against React double-mount in dev StrictMode.
  const now = Date.now();
  if (now - _lastPlay < 1500) return;
  _lastPlay = now;

  const ctx = getCtx();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const t0 = ctx.currentTime + 0.04;
  const PAD_DURATION = 1.4;

  // ── Master bus ──
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  // ── Resonant low-pass filter with envelope sweep — the heart of the synthwave sound ──
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 6.5; // High resonance for that "wowww" character
  filter.frequency.setValueAtTime(350, t0);
  filter.frequency.exponentialRampToValueAtTime(3800, t0 + 0.7);
  filter.frequency.exponentialRampToValueAtTime(900, t0 + PAD_DURATION);
  filter.connect(master);

  // Pad bus → goes through the swept filter
  const padBus = ctx.createGain();
  padBus.gain.value = 1.0;
  padBus.connect(filter);

  // ── One quiet delay tap at 280 ms for synthwave space ──
  const delay = ctx.createDelay(0.5);
  delay.delayTime.value = 0.28;
  const delayGain = ctx.createGain();
  delayGain.gain.value = 0.25;
  // Send pad → delay → master (post-filter so the tap is darker, more "vintage")
  const delayLPF = ctx.createBiquadFilter();
  delayLPF.type = 'lowpass';
  delayLPF.frequency.value = 2200;
  filter.connect(delay);
  delay.connect(delayLPF).connect(delayGain).connect(master);

  // ── Cmaj9 chord (C–E–G–B–D) — quintessential dreamy 80s extension ──
  const C4 = 261.63;
  const E4 = 329.63;
  const G4 = 392.00;
  const B4 = 493.88;
  const D5 = 587.33;
  const C2 = 65.41;   // sub-bass root
  const C6 = 1046.50; // shimmer top
  const G6 = 1567.98; // shimmer top

  // Sub bass — fades in with the pad
  scheduleSubBass(ctx, padBus, C2, t0, PAD_DURATION, 0.22);

  // Pad chord voices — each one a 3-saw stack
  const voiceGain = 0.085; // per-voice (5 voices * 3 saws = a lot of summation)
  schedulePadVoice(ctx, padBus, { freq: C4, startAt: t0,         duration: PAD_DURATION, peakGain: voiceGain });
  schedulePadVoice(ctx, padBus, { freq: E4, startAt: t0 + 0.025, duration: PAD_DURATION, peakGain: voiceGain });
  schedulePadVoice(ctx, padBus, { freq: G4, startAt: t0 + 0.050, duration: PAD_DURATION, peakGain: voiceGain });
  schedulePadVoice(ctx, padBus, { freq: B4, startAt: t0 + 0.075, duration: PAD_DURATION, peakGain: voiceGain * 0.85 });
  schedulePadVoice(ctx, padBus, { freq: D5, startAt: t0 + 0.100, duration: PAD_DURATION, peakGain: voiceGain * 0.75 });

  // Shimmer sines (bypass the resonant filter — pure top-end air, dry to master)
  scheduleSineShimmer(ctx, master, { freq: C6, startAt: t0 + 0.20, duration: PAD_DURATION - 0.20, peakGain: 0.045 });
  scheduleSineShimmer(ctx, master, { freq: G6, startAt: t0 + 0.30, duration: PAD_DURATION - 0.30, peakGain: 0.035 });
}

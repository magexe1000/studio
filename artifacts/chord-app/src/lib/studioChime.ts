/**
 * Studio Chime — retro 8-bit "power-on" jingle for Studio Hub.
 *
 * Voiced like a chiptune console boot (NES / Game Boy era):
 *  • Square-wave lead arpeggio — five fast notes (~70 ms each) ascending a
 *    C major triad and resolving up to the octave: C5 → E5 → G5 → C6 → G5.
 *  • Triangle-wave bass thump on beat 1 for that "console kicked on" weight.
 *  • Tiny pitch-envelope blip on the final note for chiptune sparkle.
 *
 * Total length ≈ 520 ms. No samples — generated entirely in-browser.
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

interface SquareNoteOpts {
  freq: number;
  startAt: number;
  duration: number;
  peakGain: number;
  /** Optional rising pitch slide for chiptune sparkle. */
  pitchSlideTo?: number;
}

function scheduleSquare(ctx: AudioContext, dest: AudioNode, opts: SquareNoteOpts) {
  const { freq, startAt, duration, peakGain, pitchSlideTo } = opts;

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, startAt);
  if (pitchSlideTo) {
    osc.frequency.linearRampToValueAtTime(pitchSlideTo, startAt + duration * 0.9);
  }

  // Sharp attack / fast decay = classic chiptune envelope (no soft tail).
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.005);
  gain.gain.linearRampToValueAtTime(peakGain * 0.85, startAt + duration * 0.6);
  gain.gain.linearRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(dest);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function scheduleTriangleBass(ctx: AudioContext, dest: AudioNode, freq: number, startAt: number, duration: number, peakGain: number) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq * 1.6, startAt);
  // Quick downward pitch sweep = old-school "thump"
  osc.frequency.exponentialRampToValueAtTime(freq, startAt + 0.05);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(dest);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
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

  // Master bus — keep it lo-fi-ish but not painful: gentle low-pass at 6 kHz.
  const master = ctx.createGain();
  master.gain.value = 0.55;

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 6000;
  lpf.Q.value = 0.4;

  master.connect(lpf).connect(ctx.destination);

  // ── Notes (Hz) ──
  const C3 = 130.81;   // bass thump
  const C5 = 523.25;
  const E5 = 659.25;
  const G5 = 783.99;
  const C6 = 1046.50;

  // Tempo: 70 ms per arpeggio step (≈215 BPM 16ths) — fast but readable
  const STEP = 0.070;

  // Bass thump on beat 1
  scheduleTriangleBass(ctx, master, C3, t0, 0.18, 0.32);

  // 5-note ascending arpeggio (C major triad → octave → resolve down to G5)
  scheduleSquare(ctx, master, { freq: C5, startAt: t0 + 0 * STEP, duration: STEP * 0.95, peakGain: 0.18 });
  scheduleSquare(ctx, master, { freq: E5, startAt: t0 + 1 * STEP, duration: STEP * 0.95, peakGain: 0.18 });
  scheduleSquare(ctx, master, { freq: G5, startAt: t0 + 2 * STEP, duration: STEP * 0.95, peakGain: 0.18 });
  scheduleSquare(ctx, master, { freq: C6, startAt: t0 + 3 * STEP, duration: STEP * 0.95, peakGain: 0.20 });

  // Final sustained note with a tiny rising pitch blip — chiptune sparkle
  scheduleSquare(ctx, master, {
    freq: G5,
    startAt: t0 + 4 * STEP,
    duration: 0.22,
    peakGain: 0.20,
    pitchSlideTo: G5 * 1.012, // ~21 cents up — that classic NES vibrato-ish lift
  });
}

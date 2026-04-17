/**
 * Studio Chime — synthesized welcome sound for Studio Hub.
 *
 * Design goals:
 *  • Minimalist & modern: 3 tones, sine waves, soft volume.
 *  • Bell-like shimmer matching the polished feel of the Studio logo.
 *  • Short (~900 ms total) so it never feels intrusive.
 *  • Generated entirely in the browser — zero asset payload, instant playback.
 *
 * Musical structure:
 *  An ascending Csus2-add-9 arpeggio (G4 → C5 → D5) with a final
 *  sustained perfect-fifth pad (C5 + G5) that lingers and decays.
 *  Each note carries a 5th-harmonic bell partial at low gain to give a
 *  subtle metallic shimmer reminiscent of a struck cymbal/Rhodes hybrid.
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

interface ToneOpts {
  freq: number;
  startAt: number;
  duration: number;
  peakGain: number;
  bellGain?: number;
}

function scheduleTone(ctx: AudioContext, dest: AudioNode, opts: ToneOpts) {
  const { freq, startAt, duration, peakGain, bellGain = 0 } = opts;

  // Fundamental sine
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  // Quick soft attack
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.018);
  // Long exponential decay
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain).connect(dest);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);

  // 5th-harmonic bell shimmer (very low gain) — gives the chime its "studio polish"
  if (bellGain > 0) {
    const bell = ctx.createOscillator();
    bell.type = 'sine';
    bell.frequency.value = freq * 5;

    const bellEnv = ctx.createGain();
    bellEnv.gain.setValueAtTime(0.0001, startAt);
    bellEnv.gain.exponentialRampToValueAtTime(bellGain, startAt + 0.008);
    bellEnv.gain.exponentialRampToValueAtTime(0.0001, startAt + duration * 0.55);

    bell.connect(bellEnv).connect(dest);
    bell.start(startAt);
    bell.stop(startAt + duration * 0.6 + 0.02);
  }
}

export function playStudioChime(): void {
  // Debounce — guard against double-mount (React StrictMode dev) playing twice.
  const now = Date.now();
  if (now - _lastPlay < 1500) return;
  _lastPlay = now;

  const ctx = getCtx();
  if (!ctx) return;

  // Browsers may suspend the context until a user gesture. Try to resume;
  // if it fails (cold-load with no prior interaction) we just exit silently.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const t0 = ctx.currentTime + 0.04;

  // Master bus with a gentle low-pass to keep the chime warm, never harsh.
  const master = ctx.createGain();
  master.gain.value = 0.85;

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 4200;
  lpf.Q.value = 0.5;

  master.connect(lpf).connect(ctx.destination);

  // Notes: G4 (392) → C5 (523.25) → D5 (587.33), then a sustained C5+G5 pad.
  const G4 = 392.0;
  const C5 = 523.25;
  const D5 = 587.33;
  const G5 = 783.99;

  // Ascending arpeggio — 110 ms between note onsets, each ringing 0.55 s
  scheduleTone(ctx, master, { freq: G4, startAt: t0,         duration: 0.55, peakGain: 0.18, bellGain: 0.012 });
  scheduleTone(ctx, master, { freq: C5, startAt: t0 + 0.110, duration: 0.55, peakGain: 0.18, bellGain: 0.012 });
  scheduleTone(ctx, master, { freq: D5, startAt: t0 + 0.220, duration: 0.50, peakGain: 0.15, bellGain: 0.010 });

  // Sustained perfect-fifth pad arriving with the 3rd note — provides the
  // satisfying "landed" resolution and the soft tail that lingers ~0.9 s.
  scheduleTone(ctx, master, { freq: C5, startAt: t0 + 0.330, duration: 0.80, peakGain: 0.13, bellGain: 0.008 });
  scheduleTone(ctx, master, { freq: G5, startAt: t0 + 0.330, duration: 0.80, peakGain: 0.10, bellGain: 0.006 });
}

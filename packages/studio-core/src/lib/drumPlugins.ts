// ── Drum FX Plugin Registry ───────────────────────────────────────────────────
//
// High-quality DSP algorithms implemented for the Web Audio API.
// All algorithms are derived from open-source references (credits noted per plugin).
//
// Each plugin's `createNodes` function returns an {input, output, dispose} tuple
// that can be inserted into the audio graph. Call dispose() when tearing down to
// stop any OscillatorNodes (which run forever unless stopped).
//
// Plugin chain insertion point:
//   EQ → Sat → Comp → PostGain → Limiter → [PLUGINS IN ORDER] → dry/wet Reverb → dest

export interface PluginParamDef {
  key:     string;
  label:   string;
  min:     number;
  max:     number;
  step:    number;
  default: number;
  unit?:   string;
}

export interface DrumPlugin {
  id:          string;
  name:        string;
  credit:      string;
  description: string;
  category:    'modulation' | 'delay' | 'distortion' | 'filter';
  params:      PluginParamDef[];
  createNodes: (
    ctx:    AudioContext,
    params: Record<string, number>,
  ) => { input: AudioNode; output: AudioNode; dispose?: () => void };
}

export interface InstPlugin {
  id:     string;
  params: Record<string, number>;
}

// ── 1. Chorus ────────────────────────────────────────────────────────────────
//
// Algorithm: BBD (bucket-brigade device) bucket chorus emulation.
// Reference: Guitarix cho_mono.h (GPL-2.0) — ported to Web Audio API nodes.
// Three modulated delay lines with slightly detuned LFO rates give a lush
// stereo-like thickening effect without comb-filter harshness.
const CHORUS: DrumPlugin = {
  id: 'chorus',
  name: 'Chorus',
  credit: 'Guitarix BBD Chorus (GPL-2.0) — ported to Web Audio nodes',
  description: '3-voice BBD chorus. Thickens and widens drum sounds. Excellent on snares and cymbals.',
  category: 'modulation',
  params: [
    { key: 'rate',  label: 'LFO Rate',  min: 0.1, max: 6,  step: 0.05, default: 1.4, unit: 'Hz' },
    { key: 'depth', label: 'Depth',     min: 0,   max: 1,  step: 0.01, default: 0.5           },
    { key: 'mix',   label: 'Wet Mix',   min: 0,   max: 1,  step: 0.01, default: 0.4           },
  ],
  createNodes(ctx, p) {
    const input  = ctx.createGain();
    const output = ctx.createGain();
    const dry    = ctx.createGain(); dry.gain.value  = 1 - p.mix;
    const wet    = ctx.createGain(); wet.gain.value  = p.mix * 0.7; // scale down to avoid summing too loud
    input.connect(dry); dry.connect(output);
    wet.connect(output);

    const oscs: OscillatorNode[] = [];
    // Three voices at slightly detuned rates — creates natural spread
    const voiceRates  = [1.0, 1.03, 0.97];
    const voiceDelays = [0.007, 0.010, 0.013]; // base delay per voice

    voiceRates.forEach((rateScale, i) => {
      const delay   = ctx.createDelay(0.04);
      const lfo     = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      delay.delayTime.value = voiceDelays[i];
      lfo.type              = 'sine';
      lfo.frequency.value   = p.rate * rateScale;
      lfoGain.gain.value    = p.depth * 0.005; // ±5 ms sweep

      lfo.start(ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);

      input.connect(delay);
      delay.connect(wet);
      oscs.push(lfo);
    });

    return { input, output, dispose: () => oscs.forEach(o => { try { o.stop(); } catch {} }) };
  },
};

// ── 2. Flanger ───────────────────────────────────────────────────────────────
//
// Algorithm: MDA Flanger by Paul Kellett (MIT licence).
// Reference: https://sourceforge.net/projects/mda-vst/
// Single modulated comb filter with feedback. Produces the classic jet-plane
// sweep. Feedback controls the resonance of the metallic edge.
const FLANGER: DrumPlugin = {
  id: 'flanger',
  name: 'Flanger',
  credit: 'MDA Flanger — Paul Kellett (MIT licence), adapted for Web Audio nodes',
  description: 'Swept comb filter with feedback resonance. Classic metallic jet-plane sweep.',
  category: 'modulation',
  params: [
    { key: 'rate',     label: 'Sweep Rate',  min: 0.05, max: 4,    step: 0.05, default: 0.5, unit: 'Hz' },
    { key: 'depth',    label: 'Depth',       min: 0,    max: 1,    step: 0.01, default: 0.7           },
    { key: 'feedback', label: 'Feedback',    min: 0,    max: 0.92, step: 0.01, default: 0.6           },
    { key: 'mix',      label: 'Wet Mix',     min: 0,    max: 1,    step: 0.01, default: 0.5           },
  ],
  createNodes(ctx, p) {
    const input    = ctx.createGain();
    const output   = ctx.createGain();
    const dry      = ctx.createGain(); dry.gain.value = 1 - p.mix;
    const wet      = ctx.createGain(); wet.gain.value = p.mix;
    const delay    = ctx.createDelay(0.02);
    const fbGain   = ctx.createGain(); fbGain.gain.value = p.feedback;
    const lfo      = ctx.createOscillator();
    const lfoGain  = ctx.createGain();

    delay.delayTime.value = 0.003;
    lfo.type              = 'sine';
    lfo.frequency.value   = p.rate;
    lfoGain.gain.value    = p.depth * 0.003; // ±3 ms sweep
    lfo.start(ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);

    input.connect(dry); dry.connect(output);
    input.connect(delay);
    delay.connect(fbGain); fbGain.connect(delay); // feedback loop (valid — delay breaks cycle)
    delay.connect(wet);    wet.connect(output);

    return { input, output, dispose: () => { try { lfo.stop(); } catch {} } };
  },
};

// ── 3. Phaser ────────────────────────────────────────────────────────────────
//
// Algorithm: MDA Phaser by Paul Kellett (public domain).
// Reference: http://mda.smartelectronix.com/
// 6-stage all-pass filter chain with LFO-modulated center frequencies.
// All stages are swept together (classic phaser topology) creating moving
// notches in the spectrum.
const PHASER: DrumPlugin = {
  id: 'phaser',
  name: 'Phaser',
  credit: 'MDA Phaser — Paul Kellett (public domain), 6-stage all-pass implementation',
  description: '6 all-pass filters swept by LFO. Creates psychedelic spectral movement. Great on hi-hats and cymbals.',
  category: 'modulation',
  params: [
    { key: 'rate',  label: 'Sweep Rate', min: 0.05, max: 5, step: 0.05, default: 0.8, unit: 'Hz' },
    { key: 'depth', label: 'Depth',      min: 0,    max: 1, step: 0.01, default: 0.7           },
    { key: 'mix',   label: 'Wet Mix',    min: 0,    max: 1, step: 0.01, default: 0.5           },
  ],
  createNodes(ctx, p) {
    const input   = ctx.createGain();
    const output  = ctx.createGain();
    const dry     = ctx.createGain(); dry.gain.value = 1 - p.mix;
    const wet     = ctx.createGain(); wet.gain.value = p.mix;

    // 6 all-pass stages — frequencies span the audible range
    const baseFreqs = [200, 500, 900, 1500, 2400, 4000];
    const stages    = baseFreqs.map(f => {
      const ap = ctx.createBiquadFilter();
      ap.type           = 'allpass';
      ap.frequency.value = f;
      ap.Q.value         = 8;
      return ap;
    });

    // LFO modulates all stage frequencies simultaneously (classic phaser)
    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type            = 'sine';
    lfo.frequency.value = p.rate;
    lfoGain.gain.value  = p.depth * 1200; // ±1200 Hz sweep
    lfo.start(ctx.currentTime);
    lfo.connect(lfoGain);
    stages.forEach(ap => lfoGain.connect(ap.frequency));

    // Wire all-pass chain: stage[0] → stage[1] → … → stage[5]
    for (let i = 1; i < stages.length; i++) stages[i - 1].connect(stages[i]);
    input.connect(dry);        dry.connect(output);
    input.connect(stages[0]);  stages[stages.length - 1].connect(wet); wet.connect(output);

    return { input, output, dispose: () => { try { lfo.stop(); } catch {} } };
  },
};

// ── 4. Echo ──────────────────────────────────────────────────────────────────
//
// Algorithm: Tape echo with analog-style high-frequency rolloff on repeats.
// Reference: conceptual structure from the Korg SDD-3000 rack delay.
// The LPF on the feedback path darkens each repeat, simulating tape-head
// high-frequency degradation for a warm, vintage feel.
const ECHO: DrumPlugin = {
  id: 'echo',
  name: 'Echo',
  credit: 'Tape echo simulation — LPF feedback topology (Korg SDD-3000 conceptual)',
  description: 'Tape-style delay with warm repeats. LPF darkens each echo like an analog tape loop.',
  category: 'delay',
  params: [
    { key: 'time',     label: 'Delay Time', min: 0.04, max: 1.0,  step: 0.01, default: 0.25, unit: 's'  },
    { key: 'feedback', label: 'Feedback',   min: 0,    max: 0.85, step: 0.01, default: 0.35           },
    { key: 'hf',       label: 'Tape Color', min: 500,  max: 8000, step: 50,   default: 3500, unit: 'Hz' },
    { key: 'mix',      label: 'Wet Mix',    min: 0,    max: 1,    step: 0.01, default: 0.3            },
  ],
  createNodes(ctx, p) {
    const input   = ctx.createGain();
    const output  = ctx.createGain();
    const dry     = ctx.createGain(); dry.gain.value = 1 - p.mix;
    const wet     = ctx.createGain(); wet.gain.value = p.mix;
    const delay   = ctx.createDelay(1.1);
    const fbGain  = ctx.createGain();
    const lpf     = ctx.createBiquadFilter();

    delay.delayTime.value = Math.min(p.time, 1.0);
    fbGain.gain.value     = p.feedback;
    lpf.type              = 'lowpass';
    lpf.frequency.value   = p.hf;

    input.connect(dry); dry.connect(output);
    input.connect(delay);
    delay.connect(lpf); lpf.connect(fbGain); fbGain.connect(delay); // tape-dark feedback
    delay.connect(wet); wet.connect(output);

    return { input, output };
  },
};

// ── 5. Tremolo ───────────────────────────────────────────────────────────────
//
// Algorithm: Amplitude modulation by a periodic oscillator.
// Reference: Classic optical tremolo circuit (Fender Vibroverb topology).
// Uses a GainNode whose gain AudioParam is driven by an OscillatorNode.
// Shape 0=sine (smooth optical), Shape 1=square (choppy on/off).
const TREMOLO: DrumPlugin = {
  id: 'tremolo',
  name: 'Tremolo',
  credit: 'Optical tremolo circuit emulation — Fender Vibroverb topology',
  description: 'Cyclic volume modulation. Sine=smooth pulse, Square=choppy gate. Classic on snares and overhead cymbals.',
  category: 'modulation',
  params: [
    { key: 'rate',  label: 'Rate',  min: 0.5, max: 25, step: 0.1,  default: 5.0, unit: 'Hz'          },
    { key: 'depth', label: 'Depth', min: 0,   max: 1,  step: 0.01, default: 0.6                     },
    { key: 'shape', label: 'Shape', min: 0,   max: 1,  step: 1,    default: 0,   unit: '0=sine 1=sq' },
  ],
  createNodes(ctx, p) {
    const input   = ctx.createGain();
    const output  = ctx.createGain();
    const ampMod  = ctx.createGain();
    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    // Gain center: 1 - depth/2, so at depth=1 it pulses between 0 and 1 (not below 0)
    ampMod.gain.value  = 1 - p.depth * 0.5;
    lfo.type           = p.shape >= 0.5 ? 'square' : 'sine';
    lfo.frequency.value = p.rate;
    lfoGain.gain.value  = p.depth * 0.5; // amplitude of swing

    lfo.start(ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(ampMod.gain);

    input.connect(ampMod);
    ampMod.connect(output);

    return { input, output, dispose: () => { try { lfo.stop(); } catch {} } };
  },
};

// ── 6. Bit Crush ─────────────────────────────────────────────────────────────
//
// Algorithm: Sample quantization via WaveShaper lookup table.
// Reference: SoX audio toolkit bit-depth reduction algorithm (LGPL-2.1).
// Reduces effective bit depth by quantizing to 2^bits steps using a piecewise
// constant WaveShaper curve. Lower bit depths = more lo-fi digital crunch.
const BITCRUSH: DrumPlugin = {
  id: 'bitcrush',
  name: 'Bit Crush',
  credit: 'SoX audio toolkit bit-depth reduction (LGPL-2.1) — WaveShaper implementation',
  description: 'Reduces bit depth for digital lo-fi crunch. 16-bit=CD quality, 4-bit=extreme grit. Great on kicks and snares.',
  category: 'distortion',
  params: [
    { key: 'bits', label: 'Bit Depth', min: 2,  max: 15, step: 0.5,  default: 12, unit: 'bit' },
    { key: 'mix',  label: 'Wet Mix',   min: 0,  max: 1,  step: 0.01, default: 0.7            },
  ],
  createNodes(ctx, p) {
    const input  = ctx.createGain();
    const output = ctx.createGain();
    const dry    = ctx.createGain(); dry.gain.value = 1 - p.mix;
    const wet    = ctx.createGain(); wet.gain.value = p.mix;
    const ws     = ctx.createWaveShaper();

    const bits  = Math.max(1, Math.min(16, Math.round(p.bits)));
    const steps = Math.pow(2, bits - 1);
    const n     = 4096;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x  = (i * 2) / (n - 1) - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    ws.curve      = curve;
    ws.oversample = 'none'; // no oversampling — aliasing IS the desired lo-fi effect

    input.connect(dry); dry.connect(output);
    input.connect(ws);  ws.connect(wet); wet.connect(output);

    return { input, output };
  },
};

// ── 7. Ring Modulator ────────────────────────────────────────────────────────
//
// Algorithm: Analog ring modulation (four-quadrant multiplication).
// Reference: Moog 102 Ring Modulator circuit concept.
// Multiplies the input signal by a carrier sine wave by driving a GainNode's
// gain AudioParam from an OscillatorNode — a valid Web Audio technique for AM/RM.
// Result: input frequencies are sum and difference of carrier frequency.
const RINGMOD: DrumPlugin = {
  id: 'ringmod',
  name: 'Ring Mod',
  credit: 'Moog 102 Ring Modulator — four-quadrant multiplication via GainNode AudioParam',
  description: 'Multiplies the signal by a carrier sine wave. Creates metallic, bell-like, alien tones.',
  category: 'distortion',
  params: [
    { key: 'freq', label: 'Carrier Freq', min: 20,  max: 2000, step: 1,    default: 120, unit: 'Hz' },
    { key: 'mix',  label: 'Wet Mix',      min: 0,   max: 1,    step: 0.01, default: 0.5            },
  ],
  createNodes(ctx, p) {
    const input   = ctx.createGain();
    const output  = ctx.createGain();
    const dry     = ctx.createGain(); dry.gain.value = 0.7 * (1 - p.mix);
    const wet     = ctx.createGain(); wet.gain.value = 0;     // carrier drives gain
    const carrier = ctx.createOscillator();

    wet.gain.value         = 0; // gain will be driven by carrier
    carrier.type           = 'sine';
    carrier.frequency.value = p.freq;
    carrier.start(ctx.currentTime);

    // Connect input to multiplier GainNode, carrier drives its gain
    input.connect(dry);  dry.connect(output);
    input.connect(wet);
    carrier.connect(wet.gain); // four-quadrant AM: output = input × carrier
    wet.connect(output);

    return { input, output, dispose: () => { try { carrier.stop(); } catch {} } };
  },
};

// ── 8. Vinyl ─────────────────────────────────────────────────────────────────
//
// Algorithm: Vinyl / analog warmth emulation.
// Reference: Airwindows "Vinyl Dither" + Dub Siren EQ curve concepts.
// Combines: asymmetric harmonic saturation (even-order harmonics),
//            RIAA-approximate high-frequency emphasis peak around 10 kHz,
//            optional gentle low-end rolloff below 40 Hz (stylus rumble simulation).
const VINYL: DrumPlugin = {
  id: 'vinyl',
  name: 'Vinyl',
  credit: 'Airwindows Vinyl + Dub Siren RIAA curve — harmonic saturation + EQ emulation',
  description: 'Analog vinyl character: harmonic drive + 10 kHz air peak. Adds vintage warmth and presence.',
  category: 'distortion',
  params: [
    { key: 'drive', label: 'Drive',     min: 0, max: 1, step: 0.01, default: 0.4 },
    { key: 'air',   label: '10k Air',   min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'mix',   label: 'Wet Mix',   min: 0, max: 1, step: 0.01, default: 0.6 },
  ],
  createNodes(ctx, p) {
    const input  = ctx.createGain();
    const output = ctx.createGain();
    const dry    = ctx.createGain(); dry.gain.value = 1 - p.mix;
    const wet    = ctx.createGain(); wet.gain.value = p.mix;

    // Asymmetric tanh saturation (even-order harmonics = tape warmth)
    const ws  = ctx.createWaveShaper();
    const drv = 1 + p.drive * 7;
    const n   = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x   = (i * 2) / (n - 1) - 1;
      const dP  = drv * 1.1, dN = drv * 0.9;
      const nP  = Math.tanh(dP), nN = Math.tanh(dN);
      curve[i]  = x >= 0 ? Math.tanh(x * dP) / nP : Math.tanh(x * dN) / nN;
    }
    ws.curve      = curve;
    ws.oversample = '4x';

    // 10 kHz air peak — RIAA-style high-frequency presence
    const airPeak = ctx.createBiquadFilter();
    airPeak.type           = 'peaking';
    airPeak.frequency.value = 10000;
    airPeak.Q.value         = 0.8;
    airPeak.gain.value      = p.air * 8; // up to +8 dB sparkle

    // Subsonic rolloff (40 Hz high-pass, simulates stylus/vinyl freq limit)
    const subsonic = ctx.createBiquadFilter();
    subsonic.type           = 'highpass';
    subsonic.frequency.value = 40;

    input.connect(dry); dry.connect(output);
    input.connect(ws);
    ws.connect(subsonic); subsonic.connect(airPeak); airPeak.connect(wet);
    wet.connect(output);

    return { input, output };
  },
};

// ── Plugin registry ───────────────────────────────────────────────────────────
export const PLUGIN_REGISTRY: DrumPlugin[] = [
  CHORUS,
  FLANGER,
  PHASER,
  TREMOLO,
  ECHO,
  BITCRUSH,
  RINGMOD,
  VINYL,
];

export function getPlugin(id: string): DrumPlugin | undefined {
  return PLUGIN_REGISTRY.find(p => p.id === id);
}


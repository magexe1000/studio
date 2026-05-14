/**
 * Granular pitch-shifter for AudioBuffer (Vocalex Harmonizer)
 * ───────────────────────────────────────────────────────────
 * Time-domain OLA (Overlap-Add) algorithm:
 *   1. Read 40 ms grains from the source at 50% overlap.
 *   2. Resample each grain by ratio = 2^(semitones/12).
 *   3. Hann-window and overlap-add at the same hop — duration preserved.
 *
 * Enhancements:
 *   • formantCorrection (0–1): scales grain size by ratio^correction so
 *     the spectral envelope (formants) stays closer to the original pitch.
 *     0 = formants shift with pitch (standard), 1 = formants largely preserved.
 *   • humanize (0–1): adds per-grain micro-pitch variation (±4% ratio max)
 *     for a natural double-tracking texture.
 */

export interface PitchShiftOptions {
  humanize?:          number;   // 0–1
  formantCorrection?: number;   // 0–1
}

const GRAIN_SEC     = 0.040;
const OVERLAP_RATIO = 0.5;
const MIN_GRAIN_LEN = 64;

const hannCache = new Map<number, Float32Array>();
function hannWindow(n: number): Float32Array {
  const cached = hannCache.get(n);
  if (cached) return cached;
  const w = new Float32Array(n);
  const d = n - 1;
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / d);
  hannCache.set(n, w);
  return w;
}

function shiftChannel(
  input:      Float32Array,
  sampleRate: number,
  semitones:  number,
  opts:       PitchShiftOptions = {},
): Float32Array {
  const { humanize = 0, formantCorrection = 0 } = opts;
  const ratio  = Math.pow(2, semitones / 12);
  const inLen  = input.length;
  const out    = new Float32Array(inLen);

  // Formant correction: enlarge grain for upward shifts so the spectral
  // envelope reads closer to its original position.
  const fScale   = Math.pow(Math.abs(ratio), formantCorrection);
  const grainLen = Math.max(MIN_GRAIN_LEN, Math.floor(GRAIN_SEC * sampleRate * fScale));
  const hop      = Math.max(1, Math.floor(grainLen * OVERLAP_RATIO));
  const win      = hannWindow(grainLen);

  const humanizeAmt = humanize * 0.04; // max ±4 % per grain

  for (let outPos = 0; outPos + grainLen <= inLen; outPos += hop) {
    // Micro-pitch variation per grain for humanization
    const grainRatio = ratio * (1 + (Math.random() - 0.5) * humanizeAmt);

    for (let i = 0; i < grainLen; i++) {
      const srcIdx = i * grainRatio;
      const intIdx = Math.floor(srcIdx);
      const frac   = srcIdx - intIdx;
      const a      = outPos + intIdx;
      if (a + 1 >= inLen) break;
      const sample = input[a] * (1 - frac) + input[a + 1] * frac;
      out[outPos + i] += sample * win[i];
    }
  }

  // Tail: pad un-shifted input at reduced level to avoid hard cutoff
  const tailStart = Math.max(0, inLen - grainLen);
  for (let i = tailStart; i < inLen; i++) {
    if (out[i] === 0) out[i] = input[i] * 0.4;
  }

  return out;
}

export function pitchShiftBuffer(
  audioCtx:  BaseAudioContext,
  source:    AudioBuffer,
  semitones: number,
  opts:      PitchShiftOptions = {},
): AudioBuffer {
  const out = audioCtx.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  for (let c = 0; c < source.numberOfChannels; c++) {
    const src = source.getChannelData(c);
    const dst = out.getChannelData(c);
    if (Math.abs(semitones) < 0.01 && !opts.humanize) {
      for (let i = 0; i < src.length; i++) dst[i] = src[i];
    } else {
      const shifted = shiftChannel(src, source.sampleRate, semitones, opts);
      for (let i = 0; i < shifted.length; i++) dst[i] = shifted[i];
    }
  }
  return out;
}

/** Convert AudioBuffer → mono Float32Array (averaged channels). */
export function bufferToMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
  const len = buf.length;
  const out = new Float32Array(len);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += ch[i];
  }
  const inv = 1 / buf.numberOfChannels;
  for (let i = 0; i < len; i++) out[i] *= inv;
  return out;
}

/** Render a 16-bit PCM WAV blob from an AudioBuffer. */
export function audioBufferToWavBlob(buf: AudioBuffer): Blob {
  const numCh = buf.numberOfChannels;
  const sr    = buf.sampleRate;
  const len   = buf.length;
  const bps   = 2;
  const block = numCh * bps;
  const dataSz = len * block;
  const ab     = new ArrayBuffer(44 + dataSz);
  const v      = new DataView(ab);

  const ws = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ws(0,  'RIFF'); v.setUint32(4, 36 + dataSz, true);
  ws(8,  'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * block, true); v.setUint16(32, block, true);
  v.setUint16(34, 16, true); ws(36, 'data');
  v.setUint32(40, dataSz, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buf.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

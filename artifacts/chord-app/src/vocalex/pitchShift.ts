/**
 * Granular pitch-shifter for AudioBuffer (Vocalex Harmonizer)
 * ───────────────────────────────────────────────────────────
 * Time-domain SOLA-style algorithm:
 *   1. Read 40 ms grains from the source at hop-size H (50% overlap).
 *   2. For each grain, resample by ratio = 2^(semitones/12) so the grain
 *      plays at a higher/lower pitch.
 *   3. Apply a Hann window and overlap-add into the output buffer at the
 *      same temporal hop H — this preserves duration but shifts pitch.
 *
 * No FFT, no external libs, no Worker — completes in a few ms for a typical
 * 10-second take, and is run once per harmony layer (results are cached by
 * harmonyEngine.ts), so playback adds zero CPU at preview time.
 *
 * Limitations: small artifacts on transients (consonants) above +/-7 st.
 * The spec only asks for +4 (3rd), +7 (5th) and +12 (8ve), all of which
 * sound musically clean for sustained vocal material.
 */

const GRAIN_SEC      = 0.040;    // 40 ms grain
const OVERLAP_RATIO  = 0.5;      // 50% overlap → Hann sum-of-squares ≈ 1
const MIN_GRAIN_LEN  = 64;       // safety floor (samples)

/** Pre-computed Hann window cache keyed by length. */
const hannCache = new Map<number, Float32Array>();
function hannWindow(n: number): Float32Array {
  const cached = hannCache.get(n);
  if (cached) return cached;
  const w = new Float32Array(n);
  const denom = n - 1;
  for (let i = 0; i < n; i++) {
    w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / denom);
  }
  hannCache.set(n, w);
  return w;
}

/**
 * Pitch-shift a single channel by `semitones` (positive = up).
 * Returns a Float32Array of the same length as the input.
 */
function shiftChannel(input: Float32Array, sampleRate: number, semitones: number): Float32Array {
  const ratio = Math.pow(2, semitones / 12);
  const inLen = input.length;
  const out   = new Float32Array(inLen);

  const grainLen = Math.max(MIN_GRAIN_LEN, Math.floor(GRAIN_SEC * sampleRate));
  const hop      = Math.max(1, Math.floor(grainLen * OVERLAP_RATIO));
  const win      = hannWindow(grainLen);

  // The output grain is filled by reading input samples at positions
  // (inPos + i * ratio) for i in [0, grainLen). When ratio < 1 we read fewer
  // input samples than grainLen (downward shift); when ratio > 1 we read
  // more (upward shift). Either way the output duration is unchanged.
  for (let outPos = 0; outPos + grainLen <= inLen; outPos += hop) {
    const inPos = outPos;
    for (let i = 0; i < grainLen; i++) {
      const srcIdx = i * ratio;
      const intIdx = Math.floor(srcIdx);
      const frac   = srcIdx - intIdx;
      const a      = inPos + intIdx;
      // Bounds: the shifted read can run past the end of the input when
      // ratio > 1 — clamp by stopping that grain early.
      if (a + 1 >= inLen) break;
      const sample = input[a] * (1 - frac) + input[a + 1] * frac;
      out[outPos + i] += sample * win[i];
    }
  }

  // Pad the tail (last <grainLen samples) with the un-shifted input scaled
  // down so we don't get a hard cutoff at the very end of the take.
  const tailStart = Math.max(0, inLen - grainLen);
  for (let i = tailStart; i < inLen; i++) {
    if (out[i] === 0) out[i] = input[i] * 0.4;
  }

  return out;
}

/**
 * Pitch-shift an entire AudioBuffer (multi-channel) into a new AudioBuffer.
 * `audioCtx` may be a regular or OfflineAudioContext — only used for the
 * createBuffer() factory.
 */
export function pitchShiftBuffer(
  audioCtx: BaseAudioContext,
  source: AudioBuffer,
  semitones: number,
): AudioBuffer {
  const out = audioCtx.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  for (let c = 0; c < source.numberOfChannels; c++) {
    const src = source.getChannelData(c);
    const dst = out.getChannelData(c);
    if (Math.abs(semitones) < 0.01) {
      // No-op: copy through so callers can treat all results uniformly.
      for (let i = 0; i < src.length; i++) dst[i] = src[i];
    } else {
      const shifted = shiftChannel(src, source.sampleRate, semitones);
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

/**
 * Render a WAV blob (16-bit PCM) from an AudioBuffer for IndexedDB storage.
 * Used when bouncing harmonized takes — we cannot store WebM that we created
 * via OfflineAudioContext, so WAV is the universal fallback.
 */
export function audioBufferToWavBlob(buf: AudioBuffer): Blob {
  const numCh = buf.numberOfChannels;
  const sr    = buf.sampleRate;
  const len   = buf.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign     = numCh * bytesPerSample;
  const dataSize       = len * blockAlign;
  const headerSize     = 44;
  const ab = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(ab);

  // RIFF header
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);             // PCM chunk size
  view.setUint16(20, 1, true);              // PCM format
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples (interleaved)
  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buf.getChannelData(c));
  let offset = headerSize;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

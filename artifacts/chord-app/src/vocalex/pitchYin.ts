const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface PitchResult {
  frequency: number;
  confidence: number;
  noteName: string;
  octave: number;
  cents: number;
  noteFrequency: number;
  midiNote: number;
}

export function yinDetect(
  buffer: Float32Array,
  sampleRate: number,
  threshold = 0.15,
): PitchResult | null {
  const halfLen = Math.floor(buffer.length / 2);
  const diff = new Float32Array(halfLen);

  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const d = buffer[i] - buffer[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  const cmnd = new Float32Array(halfLen);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = diff[tau] * tau / runningSum;
  }

  let tauEstimate = -1;
  for (let tau = 2; tau < halfLen; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 < halfLen && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) return null;

  let betterTau: number;
  const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
  const x2 = tauEstimate + 1 < halfLen ? tauEstimate + 1 : tauEstimate;

  if (x0 === tauEstimate) {
    betterTau = cmnd[tauEstimate] <= cmnd[x2] ? tauEstimate : x2;
  } else if (x2 === tauEstimate) {
    betterTau = cmnd[tauEstimate] <= cmnd[x0] ? tauEstimate : x0;
  } else {
    const s0 = cmnd[x0];
    const s1 = cmnd[tauEstimate];
    const s2 = cmnd[x2];
    const denom = 2 * s1 - s2 - s0;
    betterTau = denom !== 0
      ? tauEstimate + (s2 - s0) / (2 * denom)
      : tauEstimate;
  }

  const frequency = sampleRate / betterTau;
  const confidence = 1 - (cmnd[tauEstimate] ?? 0);

  if (frequency < 50 || frequency > 2000 || confidence < 0.7) return null;

  const midiNote = 12 * Math.log2(frequency / 440) + 69;
  const roundedMidi = Math.round(midiNote);
  const cents = (midiNote - roundedMidi) * 100;
  const noteIdx = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const noteFrequency = 440 * Math.pow(2, (roundedMidi - 69) / 12);

  return {
    frequency,
    confidence,
    noteName: NOTE_NAMES[noteIdx],
    octave,
    cents,
    noteFrequency,
    midiNote: roundedMidi,
  };
}

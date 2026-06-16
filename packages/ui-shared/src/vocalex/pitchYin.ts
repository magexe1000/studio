import { PitchDetector } from 'pitchy';

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

let detector: PitchDetector<Float32Array> | null = null;

export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  clarityThreshold = 0.80,
): PitchResult | null {
  if (!detector || detector.inputLength !== buffer.length) {
    detector = PitchDetector.forFloat32Array(buffer.length);
  }

  const [frequency, clarity] = detector.findPitch(buffer, sampleRate);

  if (clarity < clarityThreshold || frequency < 50 || frequency > 2000) return null;

  const midiNote = 12 * Math.log2(frequency / 440) + 69;
  const roundedMidi = Math.round(midiNote);
  const cents = (midiNote - roundedMidi) * 100;
  const noteIdx = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const noteFrequency = 440 * Math.pow(2, (roundedMidi - 69) / 12);

  return {
    frequency,
    confidence: clarity,
    noteName: NOTE_NAMES[noteIdx],
    octave,
    cents,
    noteFrequency,
    midiNote: roundedMidi,
  };
}

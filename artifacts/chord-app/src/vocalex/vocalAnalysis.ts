import { detectPitch, type PitchResult } from './pitchYin';

export interface VocalInsight {
  icon: string;
  title: string;
  value: string;
  detail: string;
  color: string;
}

export interface VocalAnalysis {
  pitchTimeline: { time: number; frequency: number; noteName: string; octave: number; cents: number }[];
  avgFrequency: number;
  lowestNote: string;
  highestNote: string;
  rangeSemitones: number;
  stabilityPercent: number;
  avgCents: number;
  pitchTrend: 'flat' | 'sharp' | 'stable';
  silencePercent: number;
  insights: VocalInsight[];
}

export interface AnalysisLabels {
  noPitchTitle: string;
  noPitchDetail: string;
  pitchStability: string;
  stabilityExcellent: string;
  stabilityGood: string;
  stabilityPractice: string;
  vocalRange: string;
  semitones: string;
  rangeWide: string;
  rangeModerate: string;
  rangeNarrow: string;
  rangeTo: string;
  pitchTrend: string;
  driftingFlat: string;
  driftingFlatDetail: string;
  driftingSharp: string;
  driftingSharpDetail: string;
  stableTrend: string;
  stableTrendDetail: string;
  breathGaps: string;
  breathGapsDetail: string;
  inTuneRate: string;
  inTuneExcellent: string;
  inTuneDecent: string;
  inTunePractice: string;
}

export function analyzeAudio(audioBuffer: AudioBuffer, labels: AnalysisLabels): VocalAnalysis {
  const raw = audioBuffer.getChannelData(0);
  const sr = audioBuffer.sampleRate;
  const chunkSize = 2048;
  const hopSize = 1024;
  const timeline: VocalAnalysis['pitchTimeline'] = [];

  let totalSamples = 0;
  let silentSamples = 0;

  for (let offset = 0; offset + chunkSize <= raw.length; offset += hopSize) {
    const chunk = raw.slice(offset, offset + chunkSize);
    totalSamples++;

    let maxAmp = 0;
    for (let i = 0; i < chunk.length; i++) {
      const a = Math.abs(chunk[i]);
      if (a > maxAmp) maxAmp = a;
    }

    if (maxAmp < 0.01) {
      silentSamples++;
      continue;
    }

    const result = detectPitch(chunk, sr, 0.75);
    if (result) {
      timeline.push({
        time: offset / sr,
        frequency: result.frequency,
        noteName: result.noteName,
        octave: result.octave,
        cents: result.cents,
      });
    }
  }

  if (timeline.length === 0) {
    return {
      pitchTimeline: [],
      avgFrequency: 0,
      lowestNote: '—',
      highestNote: '—',
      rangeSemitones: 0,
      stabilityPercent: 0,
      avgCents: 0,
      pitchTrend: 'stable',
      silencePercent: totalSamples > 0 ? Math.round((silentSamples / totalSamples) * 100) : 100,
      insights: [
        { icon: 'info', title: labels.noPitchTitle, value: '', detail: labels.noPitchDetail, color: '#acabaa' },
      ],
    };
  }

  const frequencies = timeline.map(t => t.frequency);
  const centsArr = timeline.map(t => t.cents);

  const avgFrequency = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
  const avgCents = centsArr.reduce((a, b) => a + b, 0) / centsArr.length;

  const sortedFreqs = [...frequencies].sort((a, b) => a - b);
  const lowestFreq = sortedFreqs[0];
  const highestFreq = sortedFreqs[sortedFreqs.length - 1];

  const lowestMidi = Math.round(12 * Math.log2(lowestFreq / 440) + 69);
  const highestMidi = Math.round(12 * Math.log2(highestFreq / 440) + 69);
  const rangeSemitones = highestMidi - lowestMidi;

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const lowestNote = `${NOTE_NAMES[((lowestMidi % 12) + 12) % 12]}${Math.floor(lowestMidi / 12) - 1}`;
  const highestNote = `${NOTE_NAMES[((highestMidi % 12) + 12) % 12]}${Math.floor(highestMidi / 12) - 1}`;

  const centsDiffs = centsArr.map(c => Math.abs(c));
  const avgAbsCents = centsDiffs.reduce((a, b) => a + b, 0) / centsDiffs.length;
  const stabilityPercent = Math.max(0, Math.min(100, Math.round(100 - avgAbsCents * 2)));

  const halfLen = Math.floor(timeline.length / 2);
  const firstHalfAvg = timeline.slice(0, halfLen).reduce((s, t) => s + t.cents, 0) / halfLen;
  const secondHalfAvg = timeline.slice(halfLen).reduce((s, t) => s + t.cents, 0) / (timeline.length - halfLen);
  const drift = secondHalfAvg - firstHalfAvg;
  const pitchTrend: 'flat' | 'sharp' | 'stable' = drift < -5 ? 'flat' : drift > 5 ? 'sharp' : 'stable';

  const silencePercent = totalSamples > 0 ? Math.round((silentSamples / totalSamples) * 100) : 0;

  const insights: VocalInsight[] = [];

  if (stabilityPercent >= 80) {
    insights.push({
      icon: 'verified', title: labels.pitchStability, value: `${stabilityPercent}%`,
      detail: labels.stabilityExcellent,
      color: '#34d399',
    });
  } else if (stabilityPercent >= 60) {
    insights.push({
      icon: 'tune', title: labels.pitchStability, value: `${stabilityPercent}%`,
      detail: labels.stabilityGood,
      color: '#eab308',
    });
  } else {
    insights.push({
      icon: 'music_note', title: labels.pitchStability, value: `${stabilityPercent}%`,
      detail: labels.stabilityPractice,
      color: '#ef4444',
    });
  }

  insights.push({
    icon: 'straighten', title: labels.vocalRange, value: `${rangeSemitones} ${labels.semitones}`,
    detail: `${lowestNote} ${labels.rangeTo} ${highestNote}. ${rangeSemitones >= 12 ? labels.rangeWide : rangeSemitones >= 6 ? labels.rangeModerate : labels.rangeNarrow}`,
    color: '#007aff',
  });

  if (pitchTrend === 'flat') {
    insights.push({
      icon: 'trending_down', title: labels.pitchTrend, value: labels.driftingFlat,
      detail: labels.driftingFlatDetail,
      color: '#f97316',
    });
  } else if (pitchTrend === 'sharp') {
    insights.push({
      icon: 'trending_up', title: labels.pitchTrend, value: labels.driftingSharp,
      detail: labels.driftingSharpDetail,
      color: '#f97316',
    });
  } else {
    insights.push({
      icon: 'check_circle', title: labels.pitchTrend, value: labels.stableTrend,
      detail: labels.stableTrendDetail,
      color: '#34d399',
    });
  }

  if (silencePercent > 40) {
    insights.push({
      icon: 'air', title: labels.breathGaps, value: `${silencePercent}%`,
      detail: labels.breathGapsDetail,
      color: '#eab308',
    });
  }

  const inTunePercent = Math.round((centsArr.filter(c => Math.abs(c) <= 10).length / centsArr.length) * 100);
  insights.push({
    icon: 'target', title: labels.inTuneRate, value: `${inTunePercent}%`,
    detail: `${inTunePercent >= 80 ? labels.inTuneExcellent : inTunePercent >= 50 ? labels.inTuneDecent : labels.inTunePractice}`,
    color: inTunePercent >= 80 ? '#34d399' : inTunePercent >= 50 ? '#eab308' : '#ef4444',
  });

  return {
    pitchTimeline: timeline,
    avgFrequency,
    lowestNote,
    highestNote,
    rangeSemitones,
    stabilityPercent,
    avgCents,
    pitchTrend,
    silencePercent,
    insights,
  };
}

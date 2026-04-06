export interface TrackState {
  name: string;
  label: string;
  icon: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  buffer: AudioBuffer | null;
  originalBuffer: AudioBuffer | null;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function resumeAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

export interface AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  scrubFilter: BiquadFilterNode;
  scrubGain: GainNode;
  tracks: TrackState[];
  isPlaying: boolean;
  isScrubbing: boolean;
  startTime: number;
  pauseOffset: number;
  duration: number;
  looping: boolean;
  _rampTimer: ReturnType<typeof setTimeout> | null;
  pitchSemitones: number;
}

function getPitchRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

function timeStretchBuffer(ctx: AudioContext, buffer: AudioBuffer, factor: number): AudioBuffer {
  if (Math.abs(factor - 1.0) < 0.005) return buffer;

  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const inputLen = buffer.length;
  const outputLen = Math.ceil(inputLen * factor);
  const result = ctx.createBuffer(numChannels, outputLen, sampleRate);

  const grainSize = 4096;
  const hopAnalysis = 1024;
  const hopSynthesis = Math.round(hopAnalysis * factor);

  const win = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (grainSize - 1)));
  }

  for (let ch = 0; ch < numChannels; ch++) {
    const input = buffer.getChannelData(ch);
    const output = result.getChannelData(ch);
    const norm = new Float32Array(outputLen);

    let aPos = 0;
    let sPos = 0;

    while (aPos + grainSize <= inputLen && sPos + grainSize <= outputLen) {
      for (let i = 0; i < grainSize; i++) {
        output[sPos + i] += input[aPos + i] * win[i];
        norm[sPos + i] += win[i];
      }
      aPos += hopAnalysis;
      sPos += hopSynthesis;
    }

    for (let i = 0; i < outputLen; i++) {
      if (norm[i] > 0.01) {
        output[i] /= norm[i];
      }
    }
  }

  return result;
}

export function createEngine(): AudioEngine {
  const ctx = getAudioContext();
  const masterGain = ctx.createGain();
  const scrubFilter = ctx.createBiquadFilter();
  scrubFilter.type = 'lowpass';
  scrubFilter.frequency.setValueAtTime(20000, ctx.currentTime);
  scrubFilter.Q.setValueAtTime(0.7, ctx.currentTime);
  const scrubGain = ctx.createGain();
  scrubGain.gain.setValueAtTime(1.0, ctx.currentTime);
  masterGain.connect(scrubFilter);
  scrubFilter.connect(scrubGain);
  scrubGain.connect(ctx.destination);
  return {
    ctx,
    masterGain,
    scrubFilter,
    scrubGain,
    tracks: [],
    isPlaying: false,
    isScrubbing: false,
    startTime: 0,
    pauseOffset: 0,
    duration: 0,
    looping: false,
    _rampTimer: null,
    pitchSemitones: 0,
  };
}

export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

export async function loadAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  return ctx.decodeAudioData(arrayBuffer);
}

export function initTracks(
  engine: AudioEngine,
  stems: { name: string; label: string; icon: string }[]
): TrackState[] {
  engine.tracks = stems.map(s => ({
    name: s.name,
    label: s.label,
    icon: s.icon,
    volume: 1.0,
    muted: false,
    solo: false,
    buffer: null,
    originalBuffer: null,
    source: null,
    gainNode: engine.ctx.createGain(),
  }));
  engine.tracks.forEach(t => t.gainNode!.connect(engine.masterGain));
  return engine.tracks;
}

export function setTrackBuffer(engine: AudioEngine, trackIndex: number, buffer: AudioBuffer): void {
  const track = engine.tracks[trackIndex];
  if (!track) return;
  track.originalBuffer = buffer;
  if (engine.pitchSemitones !== 0) {
    const ratio = getPitchRatio(engine.pitchSemitones);
    track.buffer = timeStretchBuffer(engine.ctx, buffer, ratio);
  } else {
    track.buffer = buffer;
  }
  if (buffer.duration > engine.duration) {
    engine.duration = buffer.duration;
  }
}

function getSourceRate(engine: AudioEngine): number {
  return engine.pitchSemitones !== 0 ? getPitchRatio(engine.pitchSemitones) : 1.0;
}

function getBufferOffset(engine: AudioEngine, originalOffset: number): number {
  if (engine.pitchSemitones === 0) return originalOffset;
  return originalOffset * getPitchRatio(engine.pitchSemitones);
}

function createSourceForTrack(
  engine: AudioEngine,
  track: TrackState,
  originalOffset: number,
  rate: number
): AudioBufferSourceNode | null {
  if (!track.buffer || !track.gainNode) return null;
  const ctx = engine.ctx;
  const source = ctx.createBufferSource();
  source.buffer = track.buffer;
  source.loop = engine.looping;
  source.connect(track.gainNode);
  source.playbackRate.setValueAtTime(rate, ctx.currentTime);
  const bufOffset = getBufferOffset(engine, originalOffset);
  source.start(0, bufOffset);
  return source;
}

export function play(engine: AudioEngine): void {
  if (engine.isPlaying) return;
  if (engine._rampTimer) { clearTimeout(engine._rampTimer); engine._rampTimer = null; }
  const ctx = engine.ctx;
  if (ctx.state === 'suspended') ctx.resume();

  const offset = engine.pauseOffset;
  engine.startTime = ctx.currentTime - offset;
  engine.isPlaying = true;
  const baseRate = getSourceRate(engine);

  engine.tracks.forEach(track => {
    if (!track.buffer || !track.gainNode) return;
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = engine.looping;
    source.connect(track.gainNode);
    source.playbackRate.setValueAtTime(0.15, ctx.currentTime);
    source.playbackRate.exponentialRampToValueAtTime(baseRate, ctx.currentTime + 0.7);
    const bufOffset = getBufferOffset(engine, offset);
    source.start(0, bufOffset);
    track.source = source;

    if (!engine.looping) {
      source.onended = () => {
        if (engine.isPlaying) {
          const elapsed = ctx.currentTime - engine.startTime;
          if (elapsed >= engine.duration - 0.1) {
            stop(engine);
          }
        }
      };
    }
  });

  applyMutesSolos(engine);
}

export function pause(engine: AudioEngine): void {
  if (!engine.isPlaying) return;
  const ctx = engine.ctx;
  const rampDuration = 0.75;
  engine.pauseOffset = ctx.currentTime - engine.startTime;
  engine.isPlaying = false;

  engine.tracks.forEach(track => {
    if (track.source) {
      try {
        track.source.playbackRate.cancelScheduledValues(ctx.currentTime);
        track.source.playbackRate.setValueAtTime(track.source.playbackRate.value || 1.0, ctx.currentTime);
        track.source.playbackRate.exponentialRampToValueAtTime(0.01, ctx.currentTime + rampDuration);
      } catch {}
    }
  });

  if (engine._rampTimer) clearTimeout(engine._rampTimer);
  engine._rampTimer = setTimeout(() => {
    stopSources(engine);
    engine._rampTimer = null;
  }, rampDuration * 1000 + 50);
}

export function stop(engine: AudioEngine): void {
  if (engine._rampTimer) { clearTimeout(engine._rampTimer); engine._rampTimer = null; }
  stopSources(engine);
  engine.isPlaying = false;
  engine.pauseOffset = 0;
}

function stopSources(engine: AudioEngine): void {
  engine.tracks.forEach(track => {
    if (track.source) {
      try { track.source.stop(); } catch {}
      track.source.disconnect();
      track.source = null;
    }
  });
}

function startSourcesAtOffset(engine: AudioEngine, offset: number): void {
  const ctx = engine.ctx;
  const rate = getSourceRate(engine);
  engine.tracks.forEach(track => {
    if (!track.buffer || !track.gainNode) return;
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = engine.looping;
    source.connect(track.gainNode);
    source.playbackRate.setValueAtTime(rate, ctx.currentTime);
    const bufOffset = getBufferOffset(engine, offset);
    source.start(0, bufOffset);
    track.source = source;
    if (!engine.looping) {
      source.onended = () => {
        if (engine.isPlaying) {
          const elapsed = ctx.currentTime - engine.startTime;
          if (elapsed >= engine.duration - 0.1) { stop(engine); }
        }
      };
    }
  });
  applyMutesSolos(engine);
}

export function seek(engine: AudioEngine, time: number): void {
  const wasPlaying = engine.isPlaying;
  if (engine._rampTimer) { clearTimeout(engine._rampTimer); engine._rampTimer = null; }
  if (wasPlaying) stopSources(engine);
  engine.pauseOffset = Math.max(0, Math.min(time, engine.duration));
  engine.isPlaying = false;
  if (wasPlaying) {
    const ctx = engine.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    engine.startTime = ctx.currentTime - engine.pauseOffset;
    engine.isPlaying = true;
    startSourcesAtOffset(engine, engine.pauseOffset);
  }
}

export function startScrub(engine: AudioEngine): void {
  if (engine.isScrubbing) return;
  engine.isScrubbing = true;
  const ct = engine.ctx.currentTime;
  engine.scrubFilter.frequency.cancelScheduledValues(ct);
  engine.scrubFilter.frequency.setValueAtTime(engine.scrubFilter.frequency.value, ct);
  engine.scrubFilter.frequency.exponentialRampToValueAtTime(600, ct + 0.08);
  engine.scrubGain.gain.cancelScheduledValues(ct);
  engine.scrubGain.gain.setValueAtTime(engine.scrubGain.gain.value, ct);
  engine.scrubGain.gain.linearRampToValueAtTime(0.35, ct + 0.08);
}

export function setScrubRate(engine: AudioEngine, rate: number): void {
  const baseRate = getSourceRate(engine);
  const clampedRate = Math.max(0.15, Math.min(rate, 1.8));
  const effectiveRate = clampedRate * baseRate;
  const ct = engine.ctx.currentTime;
  const filterFreq = 300 + clampedRate * 400;
  engine.scrubFilter.frequency.cancelScheduledValues(ct);
  engine.scrubFilter.frequency.setValueAtTime(engine.scrubFilter.frequency.value, ct);
  engine.scrubFilter.frequency.exponentialRampToValueAtTime(filterFreq, ct + 0.04);
  engine.tracks.forEach(track => {
    if (track.source) {
      try {
        track.source.playbackRate.cancelScheduledValues(ct);
        track.source.playbackRate.setValueAtTime(
          Math.max(0.15, track.source.playbackRate.value),
          ct
        );
        track.source.playbackRate.exponentialRampToValueAtTime(effectiveRate, ct + 0.04);
      } catch {}
    }
  });
}

export function endScrub(engine: AudioEngine, targetTime: number): void {
  engine.isScrubbing = false;
  if (engine._rampTimer) { clearTimeout(engine._rampTimer); engine._rampTimer = null; }
  const ct = engine.ctx.currentTime;
  engine.scrubFilter.frequency.cancelScheduledValues(ct);
  engine.scrubFilter.frequency.setValueAtTime(engine.scrubFilter.frequency.value, ct);
  engine.scrubFilter.frequency.exponentialRampToValueAtTime(20000, ct + 0.15);
  engine.scrubGain.gain.cancelScheduledValues(ct);
  engine.scrubGain.gain.setValueAtTime(engine.scrubGain.gain.value, ct);
  engine.scrubGain.gain.linearRampToValueAtTime(1.0, ct + 0.15);
  const wasPlaying = engine.isPlaying;
  stopSources(engine);
  engine.pauseOffset = Math.max(0, Math.min(targetTime, engine.duration));
  engine.isPlaying = false;
  if (wasPlaying) {
    const ctx = engine.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    engine.startTime = ctx.currentTime - engine.pauseOffset;
    engine.isPlaying = true;
    startSourcesAtOffset(engine, engine.pauseOffset);
  }
}

export function setPitch(engine: AudioEngine, semitones: number): void {
  const prevSemitones = engine.pitchSemitones;
  engine.pitchSemitones = semitones;

  if (prevSemitones === semitones) return;

  const ratio = semitones !== 0 ? getPitchRatio(semitones) : 1.0;

  engine.tracks.forEach(track => {
    if (!track.originalBuffer) return;
    if (semitones === 0) {
      track.buffer = track.originalBuffer;
    } else {
      track.buffer = timeStretchBuffer(engine.ctx, track.originalBuffer, ratio);
    }
  });

  if (engine.isPlaying) {
    const currentTime = getCurrentTime(engine);
    stopSources(engine);
    engine.pauseOffset = currentTime;
    engine.startTime = engine.ctx.currentTime - currentTime;
    startSourcesAtOffset(engine, currentTime);
  }
}

export function setTrackVolume(engine: AudioEngine, trackIndex: number, volume: number): void {
  const track = engine.tracks[trackIndex];
  if (!track || !track.gainNode) return;
  track.volume = volume;
  applyMutesSolos(engine);
}

export function toggleMute(engine: AudioEngine, trackIndex: number): void {
  const track = engine.tracks[trackIndex];
  if (!track) return;
  track.muted = !track.muted;
  applyMutesSolos(engine);
}

export function toggleSolo(engine: AudioEngine, trackIndex: number): void {
  const track = engine.tracks[trackIndex];
  if (!track) return;
  track.solo = !track.solo;
  applyMutesSolos(engine);
}

export function setMasterVolume(engine: AudioEngine, volume: number): void {
  engine.masterGain.gain.setValueAtTime(volume, engine.ctx.currentTime);
}

function applyMutesSolos(engine: AudioEngine): void {
  const anySolo = engine.tracks.some(t => t.solo);
  engine.tracks.forEach(track => {
    if (!track.gainNode) return;
    let effectiveVolume = track.volume;
    if (track.muted) effectiveVolume = 0;
    else if (anySolo && !track.solo) effectiveVolume = 0;
    track.gainNode.gain.setValueAtTime(effectiveVolume, engine.ctx.currentTime);
  });
}

export function getCurrentTime(engine: AudioEngine): number {
  if (!engine.isPlaying) return engine.pauseOffset;
  const elapsed = engine.ctx.currentTime - engine.startTime;
  if (engine.looping && engine.duration > 0) {
    return elapsed % engine.duration;
  }
  return Math.min(elapsed, engine.duration);
}

export function destroyEngine(engine: AudioEngine): void {
  stop(engine);
  engine.tracks.forEach(t => {
    if (t.gainNode) t.gainNode.disconnect();
  });
  engine.masterGain.disconnect();
  engine.scrubFilter.disconnect();
  engine.scrubGain.disconnect();
}

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
  track.buffer = buffer;
  if (buffer.duration > engine.duration) {
    engine.duration = buffer.duration;
  }
  if (engine.pitchSemitones !== 0) applyPitchToTrack(engine, track);
}

function getSourceRate(engine: AudioEngine): number {
  return engine.pitchSemitones !== 0 ? getPitchRatio(engine.pitchSemitones) : 1.0;
}

function timeStretchBuffer(ctx: AudioContext, buffer: AudioBuffer, stretchFactor: number): AudioBuffer {
  if (Math.abs(stretchFactor - 1.0) < 0.005) return buffer;
  const numCh = buffer.numberOfChannels;
  const inLen = buffer.length;
  const outLen = Math.round(inLen * stretchFactor);
  const result = ctx.createBuffer(numCh, outLen, buffer.sampleRate);
  const W = 2048;
  const Ha = W >> 2;
  const Hs = Math.max(1, Math.round(Ha * stretchFactor));
  const win = new Float32Array(W);
  for (let i = 0; i < W; i++) win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (W - 1)));
  for (let ch = 0; ch < numCh; ch++) {
    const inp = buffer.getChannelData(ch);
    const out = result.getChannelData(ch);
    const ws = new Float32Array(outLen);
    let aPos = 0;
    let sPos = 0;
    while (aPos + W <= inLen && sPos + W <= outLen) {
      for (let i = 0; i < W; i++) {
        out[sPos + i] += inp[aPos + i] * win[i];
        ws[sPos + i] += win[i];
      }
      aPos += Ha;
      sPos += Hs;
    }
    for (let i = 0; i < outLen; i++) {
      if (ws[i] > 0.01) out[i] /= ws[i];
    }
  }
  return result;
}

function applyPitchToTrack(engine: AudioEngine, track: TrackState): void {
  if (!track.originalBuffer) return;
  const ratio = getSourceRate(engine);
  track.buffer = Math.abs(ratio - 1.0) < 0.005
    ? track.originalBuffer
    : timeStretchBuffer(engine.ctx, track.originalBuffer, ratio);
}

export function play(engine: AudioEngine): void {
  if (engine.isPlaying) return;
  if (engine._rampTimer) { clearTimeout(engine._rampTimer); engine._rampTimer = null; }
  stopSources(engine);
  const ctx = engine.ctx;
  if (ctx.state === 'suspended') ctx.resume();

  const offset = engine.pauseOffset;
  const rate = getSourceRate(engine);
  engine.startTime = ctx.currentTime - offset;
  engine.isPlaying = true;

  engine.tracks.forEach(track => {
    if (!track.buffer || !track.gainNode) return;
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = engine.looping;
    source.connect(track.gainNode);
    source.playbackRate.setValueAtTime(0.15, ctx.currentTime);
    source.playbackRate.exponentialRampToValueAtTime(rate, ctx.currentTime + 0.7);
    source.start(0, offset * rate);
    track.source = source;

    if (!engine.looping) {
      source.onended = () => {
        if (engine.isPlaying) {
          const songPos = getCurrentTime(engine);
          if (songPos >= engine.duration - 0.1) {
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
  engine.pauseOffset = getCurrentTime(engine);
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
    source.start(0, offset * rate);
    track.source = source;
    if (!engine.looping) {
      source.onended = () => {
        if (engine.isPlaying) {
          const songPos = getCurrentTime(engine);
          if (songPos >= engine.duration - 0.1) { stop(engine); }
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

export function scrubSeek(engine: AudioEngine, delta: number): void {
  if (!engine.isPlaying) return;
  const baseRate = getSourceRate(engine);
  let mult: number;
  if (delta > 0.003) mult = 2.5;
  else if (delta < -0.003) mult = 0.2;
  else mult = 0.7;
  engine.tracks.forEach(track => {
    if (track.source) {
      try { track.source.playbackRate.setValueAtTime(baseRate * mult, engine.ctx.currentTime); } catch {}
    }
  });
}

export function endScrub(engine: AudioEngine, targetTime: number): void {
  engine.isScrubbing = false;
  const ct = engine.ctx.currentTime;
  engine.scrubFilter.frequency.cancelScheduledValues(ct);
  engine.scrubFilter.frequency.setValueAtTime(engine.scrubFilter.frequency.value, ct);
  engine.scrubFilter.frequency.exponentialRampToValueAtTime(20000, ct + 0.15);
  engine.scrubGain.gain.cancelScheduledValues(ct);
  engine.scrubGain.gain.setValueAtTime(engine.scrubGain.gain.value, ct);
  engine.scrubGain.gain.linearRampToValueAtTime(1.0, ct + 0.15);
  if (engine.isPlaying) {
    const clamped = Math.max(0, Math.min(targetTime, engine.duration));
    stopSources(engine);
    engine.pauseOffset = clamped;
    engine.startTime = ct - clamped;
    startSourcesAtOffset(engine, clamped);
  }
}

export function setPitch(engine: AudioEngine, semitones: number): void {
  if (engine.pitchSemitones === semitones) return;

  const currentPos = getCurrentTime(engine);
  const wasPlaying = engine.isPlaying;
  if (wasPlaying) stopSources(engine);

  engine.pitchSemitones = semitones;
  engine.tracks.forEach(track => applyPitchToTrack(engine, track));

  engine.pauseOffset = currentPos;
  if (wasPlaying) {
    engine.startTime = engine.ctx.currentTime - currentPos;
    engine.isPlaying = true;
    startSourcesAtOffset(engine, currentPos);
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
  const songPos = engine.ctx.currentTime - engine.startTime;
  if (engine.looping && engine.duration > 0) {
    return songPos % engine.duration;
  }
  return Math.min(songPos, engine.duration);
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

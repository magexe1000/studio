import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import VinylLottie from '../components/lottie/VinylLottie';
import LoadingLottie from '../components/lottie/LoadingLottie';
import { GroovexMixerSkeleton } from '../components/StudioSkeleton';
import { useScrollHide } from '../lib/navScroll';
import { SONG_CATALOG } from './songCatalog';
import { useGroovexStore } from './useGroovexStore';
import {
  createEngine, initSoundTouch, initTracks, loadAudioFile, loadAudioBuffer, setTrackBuffer,
  play, pause, stop, seek, startScrub, scrubSeek, endScrub, setTrackVolume, toggleMute, toggleSolo,
  setMasterVolume, setPitch, getCurrentTime, destroyEngine, resumeAudioContext,
  type AudioEngine,
} from './audioEngine';
import { downloadStem, getSongCacheStatus, clearSongCache, type DownloadProgress } from './stemCache';
import { useT } from '../lib/useT';
import StudioProgressBar from '../components/StudioProgressBar';
import StudioCountUpPercentage from '../components/StudioCountUpPercentage';

type PlayerPhase = 'idle' | 'downloading' | 'ready';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };

function transposeKey(key: string, semitones: number): string {
  if (!key || semitones === 0) return key;
  const match = key.match(/^([A-G][b#]?)(.*)/);
  if (!match) return key;
  let [, root, suffix] = match;
  const normalized = FLAT_MAP[root] || root;
  const idx = NOTE_NAMES.indexOf(normalized);
  if (idx < 0) return key;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return NOTE_NAMES[newIdx] + suffix;
}

export default function GroovexPlayer() {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);
  const t = useT();
  const { activeSongId, setView, preferences } = useGroovexStore();
  const song = useMemo(() => SONG_CATALOG.find(s => s.id === activeSongId), [activeSongId]);

  const engineRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number>(0);
  const sessionIdRef = useRef(0);

  const [phase, setPhase] = useState<PlayerPhase>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStemLabel, setCurrentStemLabel] = useState('');
  const [failedStems, setFailedStems] = useState<number[]>([]);
  const [pitchShift, setPitchShift] = useState(0);
  const [tracks, setTracks] = useState<{
    name: string; label: string; icon: string;
    volume: number; muted: boolean; solo: boolean; loaded: boolean;
  }[]>([]);

  useEffect(() => {
    if (!song) return;
    const sid = ++sessionIdRef.current;
    const engine = createEngine();
    engine.looping = preferences.loopPlayback;
    const trackStates = initTracks(engine, song.stems);
    engineRef.current = engine;
    setMasterVolume(engine, preferences.masterVolume);
    initSoundTouch(engine).catch(() => {});
    setTracks(trackStates.map(t => ({
      name: t.name, label: t.label, icon: t.icon,
      volume: t.volume, muted: t.muted, solo: t.solo, loaded: false,
    })));
    setCurrentTime(0);
    setDuration(0);
    setPhase('idle');
    setIsPlaying(false);
    setOverallProgress(0);
    setCurrentStemLabel('');
    setFailedStems([]);
    setPitchShift(0);
    cancelAnimationFrame(rafRef.current);

    if (song.hasStems) {
      getSongCacheStatus(song.id, song.stems.map(s => s.name)).then(status => {
        if (sessionIdRef.current !== sid) return;
        const allCached = Object.values(status).every(v => v);
        if (allCached) {
          loadAllStems(engine, song, sid);
        }
      });
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      destroyEngine(engine);
      engineRef.current = null;
    };
  }, [song]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.looping = preferences.loopPlayback;
  }, [preferences.loopPlayback]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setMasterVolume(engine, preferences.masterVolume);
  }, [preferences.masterVolume]);

  async function loadAllStems(engine: AudioEngine, songData: typeof SONG_CATALOG[0], sid: number) {
    setPhase('downloading');
    setFailedStems([]);
    const total = songData.stems.length;
    const failed: number[] = [];

    for (let i = 0; i < total; i++) {
      if (sessionIdRef.current !== sid) return;
      const stem = songData.stems[i];
      setCurrentStemLabel(stem.label);
      try {
        resumeAudioContext();
        const data = await downloadStem(songData.id, stem.name, (p: DownloadProgress) => {
          if (sessionIdRef.current !== sid) return;
          const stemProgress = p.percent / 100;
          setOverallProgress(((i + stemProgress) / total) * 100);
        });
        if (sessionIdRef.current !== sid) return;
        const buffer = await loadAudioBuffer(data);
        if (sessionIdRef.current !== sid) return;
        setTrackBuffer(engine, i, buffer);
        setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, loaded: true } : t));
        setDuration(engine.duration);
      } catch (e) {
        console.error(`Failed to load stem ${stem.name}:`, e);
        failed.push(i);
      }
      if (sessionIdRef.current !== sid) return;
      setOverallProgress(((i + 1) / total) * 100);
    }

    if (sessionIdRef.current !== sid) return;
    setFailedStems(failed);
    setPhase('ready');
    setCurrentStemLabel('');
  }

  async function handleDownload() {
    const engine = engineRef.current;
    if (!engine || !song) return;
    await loadAllStems(engine, song, sessionIdRef.current);
  }

  async function handleRedownload() {
    const engine = engineRef.current;
    if (!engine || !song) return;
    const sid = ++sessionIdRef.current;
    stop(engine);
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
    setCurrentTime(0);
    setTracks(prev => prev.map(t => ({ ...t, loaded: false })));
    await clearSongCache(song.id);
    await loadAllStems(engine, song, sid);
  }

  async function handleRetryFailed() {
    const engine = engineRef.current;
    if (!engine || !song) return;
    const sid = sessionIdRef.current;
    const toRetry = [...failedStems];
    setPhase('downloading');
    setFailedStems([]);
    const newFailed: number[] = [];

    for (let fi = 0; fi < toRetry.length; fi++) {
      if (sessionIdRef.current !== sid) return;
      const i = toRetry[fi];
      const stem = song.stems[i];
      setCurrentStemLabel(stem.label);
      try {
        resumeAudioContext();
        const data = await downloadStem(song.id, stem.name, (p: DownloadProgress) => {
          if (sessionIdRef.current !== sid) return;
          setOverallProgress(((fi + p.percent / 100) / toRetry.length) * 100);
        }, true);
        if (sessionIdRef.current !== sid) return;
        const buffer = await loadAudioBuffer(data);
        if (sessionIdRef.current !== sid) return;
        setTrackBuffer(engine, i, buffer);
        setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, loaded: true } : t));
        setDuration(engine.duration);
      } catch (e) {
        console.error(`Retry failed for stem ${stem.name}:`, e);
        newFailed.push(i);
      }
      if (sessionIdRef.current !== sid) return;
      setOverallProgress(((fi + 1) / toRetry.length) * 100);
    }

    if (sessionIdRef.current !== sid) return;
    setFailedStems(newFailed);
    setPhase('ready');
    setCurrentStemLabel('');
  }

  async function handleLoadFromFile(idx: number) {
    const engine = engineRef.current;
    if (!engine) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        resumeAudioContext();
        const buffer = await loadAudioFile(file);
        setTrackBuffer(engine, idx, buffer);
        setTracks(prev => prev.map((t, i) => i === idx ? { ...t, loaded: true } : t));
        setDuration(engine.duration);
        setFailedStems(prev => prev.filter(fi => fi !== idx));
        if (phase === 'idle') setPhase('ready');
      } catch (e) {
        console.error('Failed to load audio:', e);
      }
    };
    input.click();
  }

  const updateTime = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!engine.isScrubbing) {
      const t = getCurrentTime(engine);
      setCurrentTime(t);
    }
    setDuration(engine.duration);
    if (engine.isPlaying) {
      rafRef.current = requestAnimationFrame(updateTime);
    } else if (isPlaying) {
      setIsPlaying(false);
    }
  }, [isPlaying]);

  function handlePlay() {
    const engine = engineRef.current;
    if (!engine) return;
    resumeAudioContext();
    if (isPlaying) {
      pause(engine);
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
    } else {
      play(engine);
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }

  function handleStop() {
    const engine = engineRef.current;
    if (!engine) return;
    stop(engine);
    setIsPlaying(false);
    setCurrentTime(0);
    cancelAnimationFrame(rafRef.current);
  }

  function handleSeek(pct: number) {
    const engine = engineRef.current;
    if (!engine) return;
    const t = pct * engine.duration;
    seek(engine, t);
    setCurrentTime(t);
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }

  function handleScrubStart() {
    const engine = engineRef.current;
    if (!engine || !isPlaying) return;
    startScrub(engine);
  }

  function handleScrubSeek(pct: number, delta: number) {
    const engine = engineRef.current;
    if (!engine || !isPlaying) return;
    scrubSeek(engine, delta);
    setCurrentTime(pct * engine.duration);
  }

  function handleScrubEnd(pct: number) {
    const engine = engineRef.current;
    if (!engine) return;
    const t = pct * engine.duration;
    if (isPlaying) {
      endScrub(engine, t);
    } else {
      engine.pauseOffset = Math.max(0, Math.min(t, engine.duration));
    }
    setCurrentTime(t);
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }

  function handlePitchChange(delta: number) {
    const newPitch = Math.max(-6, Math.min(6, pitchShift + delta));
    setPitchShift(newPitch);
    const engine = engineRef.current;
    if (engine) {
      setPitch(engine, newPitch);
    }
  }

  function handleSkip(delta: number) {
    const engine = engineRef.current;
    if (!engine) return;
    const newTime = Math.max(0, Math.min(getCurrentTime(engine) + delta, engine.duration));
    seek(engine, newTime);
    setCurrentTime(newTime);
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }

  function handleVolumeChange(idx: number, vol: number) {
    const engine = engineRef.current;
    if (!engine) return;
    setTrackVolume(engine, idx, vol);
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, volume: vol } : t));
  }

  function handleMute(idx: number) {
    const engine = engineRef.current;
    if (!engine) return;
    toggleMute(engine, idx);
    const track = engine.tracks[idx];
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, muted: track.muted } : t));
  }

  function handleSolo(idx: number) {
    const engine = engineRef.current;
    if (!engine) return;
    toggleSolo(engine, idx);
    const track = engine.tracks[idx];
    setTracks(prev => prev.map((t, i) => i === idx ? { ...t, solo: track.solo } : t));
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  if (!song) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--c-text-secondary)' }}>
        <VinylLottie size={64} />
        <p style={{ fontSize: 14, margin: 0 }}>{t.groovex.noSongSelected}</p>
      </div>
    );
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const anyLoaded = tracks.some(t => t.loaded);

  return (
    <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}>

        <section className="gx-hero-enter" style={{ paddingTop: 12, marginBottom: 36, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', height: 140, marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse 80% 90% at 50% 100%, rgba(0,122,255,0.12) 0%, transparent 70%)',
              animation: 'gx-glow-pulse 4s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'relative', width: '100%', height: '100%',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2,
              padding: '0 8px',
            }}>
              {Array.from({ length: 40 }).map((_, i) => {
                const center = 20;
                const dist = Math.abs(i - center) / center;
                const baseH = (1 - dist * 0.6) * 0.5 + Math.sin(i * 0.9 + 1.2) * 0.25 + 0.25;
                return (
                  <div
                    key={i}
                    className="gx-visualizer-bar"
                    style={{
                      flex: 1,
                      maxWidth: 6,
                      minWidth: 2,
                      borderRadius: 3,
                      height: `${baseH * 100}%`,
                      background: `linear-gradient(to top, var(--gx-accent), rgba(103,156,255,${0.3 + (1 - dist) * 0.7}))`,
                      transformOrigin: 'bottom',
                      animationDelay: `${i * 0.08}s`,
                      opacity: isPlaying ? 0.6 + (1 - dist) * 0.4 : 0.15 + (1 - dist) * 0.15,
                      transition: 'opacity 400ms ease',
                      animationPlayState: isPlaying ? 'running' : 'paused',
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="gx-fade-up-1" style={{ textAlign: 'center', marginBottom: 4, width: '100%' }}>
            <h2 style={{
              fontSize: 38, fontWeight: 900, letterSpacing: '-0.04em',
              margin: '0 0 8px', color: 'var(--c-text-primary)',
              fontFamily: 'Manrope, sans-serif', lineHeight: 1.1,
            }}>{song.title}</h2>
            <p style={{
              fontSize: 20, fontWeight: 500, color: 'var(--c-text-secondary)',
              margin: 0, fontFamily: 'Manrope, sans-serif',
            }}>{song.artist}</p>
          </div>

          {phase === 'ready' && (
            <div className="gx-fade-up-1" style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
              fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--c-text-secondary)',
            }}>
              <span>{song.bpm} BPM</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span style={{ color: pitchShift !== 0 ? 'var(--gx-accent)' : undefined, fontWeight: pitchShift !== 0 ? 600 : undefined }}>
                {transposeKey(song.key, pitchShift)}
                {pitchShift !== 0 && <span style={{ fontSize: 10, opacity: 0.7 }}> ({pitchShift > 0 ? '+' : ''}{pitchShift})</span>}
              </span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span style={{ color: 'var(--c-text-primary)', fontWeight: 600 }}>{formatTime(currentTime)}</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <span>{duration > 0 ? formatTime(duration) : song.duration}</span>
            </div>
          )}
        </section>

        {phase === 'idle' && song.hasStems && (
          <section className="gx-fade-up-2" style={{ marginBottom: 36 }}>
            <button
              onClick={handleDownload}
              style={{
                width: '100%', padding: '20px 24px', borderRadius: 16, border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--gx-accent-container), var(--gx-accent))',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                boxShadow: '0 8px 40px rgba(0,122,255,0.35)',
                transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease',
              }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
              onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>cloud_download</span>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{t.groovex.downloadStems}</p>
                <p style={{ fontSize: 11, margin: '2px 0 0', opacity: 0.8, fontFamily: 'Inter' }}>
                  {t.groovex.tracksWillBeDownloaded(song.stems.length)}
                </p>
              </div>
            </button>
          </section>
        )}

        {phase === 'downloading' && (
          <section className="gx-fade-up-2" style={{ marginBottom: 36, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
              background: 'var(--gx-surface)', borderRadius: 20, padding: '22px 24px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <LoadingLottie width={26} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>{t.groovex.downloading}</p>
                    <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: '2px 0 0', fontFamily: 'Inter' }}>
                      {currentStemLabel}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gx-accent)', fontFamily: 'Inter' }}>
                  <StudioCountUpPercentage value={overallProgress} />%
                </span>
              </div>
              <StudioProgressBar
                value={overallProgress}
                accentFrom="var(--gx-accent-container)"
                accentTo="var(--gx-accent)"
                height={6}
              />
            </div>

            {/* Mixer Tracks loading placeholders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{
                fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)',
                letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 4px 4px',
                fontFamily: 'Inter, sans-serif',
              }}>{t.groovex.stemsMixer}</h3>
              <div style={{
                background: 'var(--gx-surface)', borderRadius: 20, padding: '20px 20px',
              }}>
                <GroovexMixerSkeleton tracksCount={song.stems.length || 4} />
              </div>
            </div>
          </section>
        )}

        {phase === 'ready' && (
          <>
            <section className="gx-fade-up-2" style={{ marginBottom: 20 }}>
              <ProgressBar pct={pct} isPlaying={isPlaying} onSeek={handleSeek} onScrubStart={handleScrubStart} onScrubSeek={handleScrubSeek} onScrubEnd={handleScrubEnd} duration={duration} />
              <div style={{ marginBottom: 28 }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <TransportBtn icon="skip_previous" onClick={handleStop} />
                <TransportBtn icon="replay_10" onClick={() => handleSkip(-10)} />

                <button
                  onClick={handlePlay}
                  disabled={!anyLoaded}
                  style={{
                    width: 72, height: 72, borderRadius: 9999, border: 'none',
                    cursor: anyLoaded ? 'pointer' : 'not-allowed',
                    background: anyLoaded
                      ? 'linear-gradient(135deg, var(--gx-accent-container), var(--gx-accent))'
                      : 'var(--gx-surface-high)',
                    color: anyLoaded ? '#fff' : 'var(--c-text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: anyLoaded ? '0 0 40px rgba(0,122,255,0.4)' : 'none',
                    transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease',
                  }}
                  onPointerDown={e => { if (anyLoaded) e.currentTarget.style.transform = 'scale(0.92)'; }}
                  onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }}>
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                <TransportBtn icon="forward_10" onClick={() => handleSkip(10)} />
                <TransportBtn icon="skip_next" onClick={() => handleSkip(duration)} />
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginTop: 18,
              }}>
                <button
                  onClick={() => handlePitchChange(-1)}
                  disabled={pitchShift <= -6}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none', cursor: pitchShift <= -6 ? 'not-allowed' : 'pointer',
                    background: 'var(--gx-surface)', color: pitchShift <= -6 ? 'var(--c-text-secondary)' : 'var(--c-text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: pitchShift <= -6 ? 0.4 : 1,
                    transition: 'transform 150ms ease, opacity 150ms ease',
                  }}
                  onPointerDown={e => { if (pitchShift > -6) e.currentTarget.style.transform = 'scale(0.9)'; }}
                  onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>remove</span>
                </button>

                <div style={{
                  minWidth: 110, textAlign: 'center', padding: '6px 12px',
                  borderRadius: 10, background: pitchShift !== 0 ? 'rgba(0,122,255,0.08)' : 'var(--gx-surface)',
                  transition: 'background 200ms ease',
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: 'var(--c-text-secondary)', fontFamily: 'Inter, sans-serif', marginBottom: 2,
                  }}>{t.groovex.key}</div>
                  <div style={{
                    fontSize: 15, fontWeight: 800, fontFamily: 'Manrope, sans-serif',
                    color: pitchShift !== 0 ? 'var(--gx-accent)' : 'var(--c-text-primary)',
                    transition: 'color 200ms ease',
                  }}>
                    {transposeKey(song.key, pitchShift)}
                    {pitchShift !== 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, marginLeft: 4 }}>
                        {pitchShift > 0 ? '+' : ''}{pitchShift}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handlePitchChange(1)}
                  disabled={pitchShift >= 6}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none', cursor: pitchShift >= 6 ? 'not-allowed' : 'pointer',
                    background: 'var(--gx-surface)', color: pitchShift >= 6 ? 'var(--c-text-secondary)' : 'var(--c-text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: pitchShift >= 6 ? 0.4 : 1,
                    transition: 'transform 150ms ease, opacity 150ms ease',
                  }}
                  onPointerDown={e => { if (pitchShift < 6) e.currentTarget.style.transform = 'scale(0.9)'; }}
                  onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
                </button>

                {pitchShift !== 0 && (
                  <button
                    onClick={() => { setPitchShift(0); const engine = engineRef.current; if (engine) setPitch(engine, 0); }}
                    style={{
                      marginLeft: 4, width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'rgba(238,125,119,0.08)', color: '#ee7d77',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'transform 150ms ease',
                    }}
                    onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
                    onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                    onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                    title="Reset to original key"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
                  </button>
                )}
              </div>
            </section>

            {failedStems.length > 0 && (
              <section className="gx-fade-up-3" style={{ marginBottom: 20 }}>
                <div style={{
                  background: 'rgba(238,125,119,0.06)', borderRadius: 16, padding: '14px 18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ee7d77' }}>warning</span>
                    <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter' }}>
                      {t.groovex.stemsFailed(failedStems.length)}
                    </p>
                  </div>
                  <button
                    onClick={handleRetryFailed}
                    style={{
                      padding: '6px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'rgba(238,125,119,0.12)', color: '#ee7d77',
                      fontSize: 11, fontWeight: 700, fontFamily: 'Inter',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      transition: 'background 150ms ease',
                    }}
                  >
                    {t.groovex.retry}
                  </button>
                </div>
              </section>
            )}

            <section className="gx-fade-up-3" style={{ marginBottom: 24 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <h3 style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)',
                  letterSpacing: '0.18em', textTransform: 'uppercase', margin: 0,
                  fontFamily: 'Inter, sans-serif',
                }}>{t.groovex.stemsMixer}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {song.hasStems && (
                    <button
                      onClick={handleRedownload}
                      style={{
                        padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: 'transparent', color: 'var(--gx-accent)',
                        fontSize: 10, fontWeight: 700, fontFamily: 'Inter',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        display: 'flex', alignItems: 'center', gap: 4,
                        transition: 'background 150ms ease',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>refresh</span>
                      {t.groovex.redownload}
                    </button>
                  )}
                </div>
              </div>

              <div style={{
                background: 'var(--gx-surface)', borderRadius: 20, padding: '20px 20px',
                display: 'flex', flexDirection: 'column', gap: 20,
              }}>
                {tracks.map((track, idx) => (
                  <MixerRow
                    key={track.name}
                    track={track}
                    showLoadFile={!track.loaded && (!song.hasStems || failedStems.includes(idx))}
                    onLoadFromFile={() => handleLoadFromFile(idx)}
                    onVolumeChange={(v) => handleVolumeChange(idx, v)}
                    onMute={() => handleMute(idx)}
                    onSolo={() => handleSolo(idx)}
                    animDelay={idx * 40}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {phase === 'idle' && !song.hasStems && (
          <section className="gx-fade-up-2" style={{ marginBottom: 28 }}>
            <div style={{
              background: 'var(--gx-surface)', borderRadius: 16, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--gx-accent)' }}>info</span>
              <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter', lineHeight: 1.4 }}>
                {t.groovex.stemsNotAvailable}
              </p>
            </div>
          </section>
        )}

        {phase === 'idle' && !song.hasStems && (
          <section className="gx-fade-up-3" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 4px 4px', fontFamily: 'Inter' }}>
              {t.groovex.mixerTracks(tracks.length)}
            </p>
            {tracks.map((track, idx) => (
              <MixerRow
                key={track.name}
                track={track}
                showLoadFile={true}
                onLoadFromFile={() => handleLoadFromFile(idx)}
                onVolumeChange={(v) => handleVolumeChange(idx, v)}
                onMute={() => handleMute(idx)}
                onSolo={() => handleSolo(idx)}
                animDelay={idx * 40}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ pct, isPlaying, onSeek, onScrubStart, onScrubSeek, onScrubEnd, duration }: {
  pct: number; isPlaying: boolean; duration: number;
  onSeek: (v: number) => void;
  onScrubStart: () => void;
  onScrubSeek: (pct: number, delta: number) => void;
  onScrubEnd: (pct: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const scrubPct = useRef(0);
  const lastSeekTime = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [visualPct, setVisualPct] = useState(0);

  const calcPct = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    const p = calcPct(e.clientX);
    scrubPct.current = p;
    lastSeekTime.current = performance.now();
    setIsDragging(true);
    setVisualPct(p * 100);
    if (isPlaying) {
      onScrubStart();
      onScrubSeek(p, 0);
    } else {
      onSeek(p);
    }
  }, [calcPct, onSeek, onScrubStart, onScrubSeek, isPlaying]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = calcPct(e.clientX);
    const prevP = scrubPct.current;
    scrubPct.current = p;
    setVisualPct(p * 100);

    if (!isPlaying) {
      onSeek(p);
      return;
    }

    const now = performance.now();
    if (now - lastSeekTime.current > 60) {
      onScrubSeek(p, p - prevP);
      lastSeekTime.current = now;
    }
  }, [calcPct, onSeek, onScrubSeek, isPlaying]);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    const finalPct = scrubPct.current;
    if (isPlaying) {
      onScrubEnd(finalPct);
    }
  }, [onScrubEnd, isPlaying]);

  const displayPct = isDragging ? visualPct : pct;

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'relative', height: 28, display: 'flex', alignItems: 'center',
        cursor: 'pointer', touchAction: 'none',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 6,
        background: 'var(--gx-surface-high)', borderRadius: 9999, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${displayPct}%`,
          background: 'linear-gradient(90deg, var(--gx-accent-container), var(--gx-accent))',
          borderRadius: 9999,
        }} />
        {isPlaying && !isDragging && (
          <div className="gx-progress-wave" style={{
            position: 'absolute', top: 0, left: 0, height: '100%',
            width: `${displayPct}%`,
            borderRadius: 9999,
            opacity: 0.5,
          }} />
        )}
      </div>
      <div style={{
        position: 'absolute',
        left: `${displayPct}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: isDragging ? 20 : 16, height: isDragging ? 20 : 16, borderRadius: 9999,
        background: '#fff',
        boxShadow: isDragging
          ? '0 0 14px rgba(0,122,255,0.7), 0 2px 8px rgba(0,0,0,0.5)'
          : '0 0 10px rgba(0,122,255,0.5), 0 2px 6px rgba(0,0,0,0.4)',
        pointerEvents: 'none',
        transition: isDragging ? 'none' : 'width 150ms, height 150ms, box-shadow 150ms',
      }} />
    </div>
  );
}

function DragSlider({ value, disabled, onChange }: { value: number; disabled?: boolean; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const calcValue = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, [value]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    onChange(calcValue(e.clientX));
  }, [disabled, calcValue, onChange]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    onChange(calcValue(e.clientX));
  }, [calcValue, onChange]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const pct = Math.round(value * 100);

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'relative', height: 28, display: 'flex', alignItems: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer', touchAction: 'none',
      }}
    >
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 6,
        background: 'var(--gx-surface-lowest)', borderRadius: 9999,
      }} />
      <div style={{
        position: 'absolute', left: 0, height: 6,
        width: `${pct}%`,
        background: 'linear-gradient(90deg, var(--gx-accent-container), var(--gx-accent))',
        borderRadius: 9999,
      }} />
      <div style={{
        position: 'absolute',
        left: `${pct}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 18, height: 18, borderRadius: 9999,
        background: 'var(--gx-accent)',
        boxShadow: '0 0 8px rgba(0,122,255,0.4), 0 2px 4px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

function TransportBtn({ icon, onClick }: { icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        color: 'var(--c-text-secondary)',
        transition: 'color 150ms ease, transform 120ms cubic-bezier(0.34,1.56,0.64,1)',
      }}
      onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.85)')}
      onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>{icon}</span>
    </button>
  );
}

function MixerRow({
  track, showLoadFile, onLoadFromFile, onVolumeChange, onMute, onSolo, animDelay,
}: {
  track: {
    name: string; label: string; icon: string;
    volume: number; muted: boolean; solo: boolean; loaded: boolean;
  };
  showLoadFile: boolean;
  onLoadFromFile: () => void;
  onVolumeChange: (v: number) => void;
  onMute: () => void;
  onSolo: () => void;
  animDelay: number;
}) {
  const volPct = Math.round(track.volume * 100);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      opacity: track.muted ? 0.4 : 1,
      transition: 'opacity 200ms ease',
      animation: `gx-fade-up 350ms ${animDelay}ms cubic-bezier(0.0,0.0,0.2,1) both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700,
            color: 'var(--c-text-primary)', letterSpacing: '0.02em',
          }}>{track.label}</span>
          {showLoadFile && (
            <button
              onClick={onLoadFromFile}
              style={{
                padding: '2px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'var(--gx-accent-dim)', color: 'var(--gx-accent)',
                fontSize: 9, fontWeight: 700, fontFamily: 'Inter',
                letterSpacing: '0.05em', textTransform: 'uppercase',
                transition: 'background 150ms ease',
              }}
            >
              Load
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={onMute}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: track.muted ? 'rgba(238,125,119,0.15)' : 'var(--gx-surface-high)',
              color: track.muted ? '#ee7d77' : 'var(--c-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, fontFamily: 'Inter',
              transition: 'background 150ms ease, color 150ms ease',
            }}
          >M</button>
          <button
            onClick={onSolo}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: track.solo ? 'rgba(0,122,255,0.15)' : 'var(--gx-surface-high)',
              color: track.solo ? 'var(--gx-accent)' : 'var(--c-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, fontFamily: 'Inter',
              transition: 'background 150ms ease, color 150ms ease',
            }}
          >S</button>
        </div>
      </div>

      <DragSlider value={track.volume} disabled={!track.loaded} onChange={onVolumeChange} />
    </div>
  );
}

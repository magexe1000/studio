import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SONG_CATALOG } from './songCatalog';
import { useGroovexStore } from './useGroovexStore';
import {
  createEngine, initTracks, loadAudioFile, loadAudioBuffer, setTrackBuffer,
  play, pause, stop, seek, setTrackVolume, toggleMute, toggleSolo,
  setMasterVolume, getCurrentTime, destroyEngine, resumeAudioContext,
  type AudioEngine,
} from './audioEngine';
import { downloadStem, getSongCacheStatus, type DownloadProgress } from './stemCache';

type PlayerPhase = 'idle' | 'downloading' | 'ready';

export default function GroovexPlayer() {
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
        });
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
    const t = getCurrentTime(engine);
    setCurrentTime(t);
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
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-secondary)' }}>
        <p>No song selected</p>
      </div>
    );
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const anyLoaded = tracks.some(t => t.loaded);

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>

        <section style={{ paddingTop: 24, marginBottom: 28 }}>
          <div style={{
            background: 'var(--gx-surface)', borderRadius: 16, padding: 24,
            display: 'flex', flexDirection: 'column', gap: 20,
            borderLeft: '4px solid var(--gx-accent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 4px', color: 'var(--c-text-primary)' }}>{song.title}</h1>
                <p style={{ fontSize: 14, color: 'var(--gx-accent)', margin: 0, fontWeight: 600 }}>
                  {song.artist} • {song.bpm} BPM • {song.key}
                </p>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'Inter', color: 'var(--c-text-secondary)', fontSize: 13 }}>
                <span style={{ color: 'var(--c-text-primary)', fontWeight: 700 }}>{formatTime(currentTime)}</span> / {duration > 0 ? formatTime(duration) : song.duration}
              </div>
            </div>

            {phase === 'ready' && (
              <>
                <div
                  style={{ position: 'relative', height: 6, background: 'var(--gx-surface-high)', borderRadius: 9999, overflow: 'hidden', cursor: 'pointer' }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleSeek((e.clientX - rect.left) / rect.width);
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 0, left: 0, height: '100%',
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, var(--gx-accent), var(--gx-accent-container))',
                    borderRadius: 9999, transition: 'width 50ms linear',
                  }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                  <ControlBtn icon="skip_previous" onClick={handleStop} />
                  <ControlBtn icon="replay_10" onClick={() => handleSkip(-10)} />
                  <button
                    onClick={handlePlay}
                    disabled={!anyLoaded}
                    style={{
                      width: 56, height: 56, borderRadius: 9999, border: 'none', cursor: anyLoaded ? 'pointer' : 'not-allowed',
                      background: anyLoaded ? 'linear-gradient(135deg, var(--gx-accent), var(--gx-accent-container))' : 'var(--gx-surface-high)',
                      color: anyLoaded ? '#fff' : 'var(--c-text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: anyLoaded ? '0 4px 20px rgba(103,156,255,0.25)' : 'none',
                      transition: 'transform 100ms ease, box-shadow 200ms ease',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 32, fontVariationSettings: "'FILL' 1" }}>
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                  <ControlBtn icon="forward_10" onClick={() => handleSkip(10)} />
                  <ControlBtn icon="skip_next" onClick={() => handleSkip(duration)} />
                </div>
              </>
            )}
          </div>
        </section>

        {phase === 'idle' && song.hasStems && (
          <section style={{ marginBottom: 28 }}>
            <button
              onClick={handleDownload}
              style={{
                width: '100%', padding: '20px 24px', borderRadius: 16, border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--gx-accent), var(--gx-accent-container))',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                boxShadow: '0 6px 28px rgba(103,156,255,0.3)',
                transition: 'transform 100ms ease, box-shadow 200ms ease',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>cloud_download</span>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Download Stems</p>
                <p style={{ fontSize: 11, margin: '2px 0 0', opacity: 0.8, fontFamily: 'Inter' }}>
                  {song.stems.length} tracks will be downloaded
                </p>
              </div>
            </button>
          </section>
        )}

        {phase === 'downloading' && (
          <section style={{ marginBottom: 28 }}>
            <div style={{
              background: 'var(--gx-surface)', borderRadius: 16, padding: '20px 24px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--gx-accent)', animation: 'spin 1s linear infinite' }}>progress_activity</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>Downloading...</p>
                    <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: '2px 0 0', fontFamily: 'Inter' }}>
                      {currentStemLabel}
                    </p>
                  </div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--gx-accent)', fontFamily: 'Inter' }}>
                  {Math.round(overallProgress)}%
                </span>
              </div>
              <div style={{
                height: 6, background: 'var(--gx-surface-high)', borderRadius: 9999, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${overallProgress}%`,
                  background: 'linear-gradient(90deg, var(--gx-accent), var(--gx-accent-container))',
                  borderRadius: 9999, transition: 'width 200ms ease',
                }} />
              </div>
            </div>
          </section>
        )}

        {phase === 'ready' && failedStems.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <div style={{
              background: 'rgba(238,125,119,0.08)', borderRadius: 14, padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: '1px solid rgba(238,125,119,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#ee7d77' }}>warning</span>
                <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter' }}>
                  {failedStems.length} stem{failedStems.length > 1 ? 's' : ''} failed to download
                </p>
              </div>
              <button
                onClick={handleRetryFailed}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(238,125,119,0.15)', color: '#ee7d77',
                  fontSize: 11, fontWeight: 700, fontFamily: 'Inter',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}
              >
                Retry
              </button>
            </div>
          </section>
        )}

        {phase === 'idle' && !song.hasStems && (
          <section style={{ marginBottom: 28 }}>
            <div style={{
              background: 'var(--gx-surface-low)', borderRadius: 14, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
              border: '1px solid rgba(103,156,255,0.15)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--gx-accent)' }}>info</span>
              <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter', lineHeight: 1.4 }}>
                Stems not yet available on server. Load audio files from your device using the buttons below.
              </p>
            </div>
          </section>
        )}

        {(phase === 'ready' || !song.hasStems) && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 4px 4px', fontFamily: 'Inter' }}>
              Mixer — {tracks.length} Tracks
            </p>
            {tracks.map((track, idx) => (
              <TrackCard
                key={track.name}
                track={track}
                showLoadFile={!track.loaded && (!song.hasStems || failedStems.includes(idx))}
                onLoadFromFile={() => handleLoadFromFile(idx)}
                onVolumeChange={(v) => handleVolumeChange(idx, v)}
                onMute={() => handleMute(idx)}
                onSolo={() => handleSolo(idx)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

function ControlBtn({ icon, onClick }: { icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        color: 'var(--c-text-secondary)', transition: 'color 100ms ease',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>{icon}</span>
    </button>
  );
}

function TrackCard({
  track, showLoadFile, onLoadFromFile, onVolumeChange, onMute, onSolo,
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
}) {
  return (
    <div style={{
      background: 'var(--gx-surface-high)', padding: '16px 18px', borderRadius: 14,
      border: '1px solid rgba(72,72,72,0.1)',
      display: 'flex', flexDirection: 'column', gap: 14,
      opacity: track.muted ? 0.5 : 1,
      transition: 'opacity 150ms ease, background 100ms ease',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--gx-surface-lowest)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--gx-accent)' }}>{track.icon}</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>{track.label}</p>
            <p style={{ fontSize: 10, color: track.loaded ? '#4ade80' : 'var(--c-text-secondary)', margin: '1px 0 0', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {track.loaded ? 'Ready' : 'No file'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {showLoadFile && (
            <button
              onClick={onLoadFromFile}
              style={{
                padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'var(--gx-accent-dim)', color: '#fff',
                fontSize: 10, fontWeight: 700, fontFamily: 'Inter',
                letterSpacing: '0.05em', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder_open</span>
              Load
            </button>
          )}
          <button
            onClick={onMute}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: track.muted ? 'rgba(238,125,119,0.2)' : 'var(--gx-surface-low)',
              color: track.muted ? '#ee7d77' : 'var(--c-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, fontFamily: 'Inter',
            }}
          >M</button>
          <button
            onClick={onSolo}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: track.solo ? 'rgba(103,156,255,0.15)' : 'var(--gx-surface-low)',
              color: track.solo ? 'var(--gx-accent)' : 'var(--c-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, fontFamily: 'Inter',
            }}
          >S</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-text-secondary)' }}>volume_down</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.volume}
          onChange={e => onVolumeChange(parseFloat(e.target.value))}
          disabled={!track.loaded}
          className="gx-slider"
          style={{ flex: 1 }}
        />
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-text-secondary)' }}>volume_up</span>
      </div>
    </div>
  );
}

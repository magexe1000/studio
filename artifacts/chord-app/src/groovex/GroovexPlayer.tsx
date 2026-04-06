import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SONG_CATALOG } from './songCatalog';
import { useGroovexStore } from './useGroovexStore';
import {
  createEngine, initTracks, loadAudioFile, loadAudioBuffer, setTrackBuffer,
  play, pause, stop, seek, setTrackVolume, toggleMute, toggleSolo,
  setMasterVolume, getCurrentTime, destroyEngine, resumeAudioContext,
  type AudioEngine,
} from './audioEngine';
import { downloadStem, getSongCacheStatus, clearSongCache, type DownloadProgress } from './stemCache';

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
      <div style={{ padding: '0 24px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}>

        <section className="gx-hero-enter" style={{ paddingTop: 12, marginBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 220, height: 220, marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute', inset: -40,
              background: 'radial-gradient(circle, rgba(0,122,255,0.18) 0%, transparent 70%)',
              borderRadius: '50%',
              animation: 'gx-glow-pulse 4s ease-in-out infinite',
            }} />

            <div style={{
              position: 'relative', width: 200, height: 200, borderRadius: 20,
              overflow: 'hidden', zIndex: 10,
              background: '#000',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, rgba(103,156,255,0.08) 0%, rgba(0,0,0,0.95) 50%, rgba(0,122,255,0.06) 100%)',
              }} />
              <div style={{
                position: 'absolute', top: '30%', left: '10%', right: '10%', height: '40%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
                opacity: 0.4,
              }}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} style={{
                    width: 2, borderRadius: 1,
                    background: 'var(--gx-accent)',
                    height: `${20 + Math.sin(i * 0.7) * 60}%`,
                    opacity: 0.3 + Math.sin(i * 0.5) * 0.5,
                  }} />
                ))}
              </div>

              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
                background: 'linear-gradient(to top, #000 0%, transparent 100%)',
              }} />

              <div style={{
                position: 'absolute', bottom: 16, left: 0, right: 0,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, zIndex: 2,
              }}>
                {[0.5, 0.75, 0.4, 0.9, 0.65, 1, 0.75, 0.5].map((h, i) => (
                  <div
                    key={i}
                    className="gx-visualizer-bar"
                    style={{
                      width: 3, borderRadius: 2,
                      background: 'var(--gx-accent)',
                      height: h * 28,
                      transformOrigin: 'bottom',
                      animationDelay: `${i * 0.15}s`,
                      opacity: isPlaying ? 1 : 0.5,
                      transition: 'opacity 300ms ease',
                      animationPlayState: isPlaying ? 'running' : 'paused',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="gx-fade-up-1" style={{ textAlign: 'center', marginBottom: 4 }}>
            <h2 style={{
              fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em',
              margin: '0 0 6px', color: 'var(--c-text-primary)',
              fontFamily: 'Manrope, sans-serif',
            }}>{song.title}</h2>
            <p style={{
              fontSize: 16, fontWeight: 500, color: 'var(--c-text-secondary)',
              margin: 0, fontFamily: 'Manrope, sans-serif',
            }}>{song.artist}</p>
          </div>

          {phase === 'ready' && (
            <div className="gx-fade-up-1" style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
              fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--c-text-secondary)',
            }}>
              <span>{song.bpm} BPM</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>{song.key}</span>
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
                <p style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Download Stems</p>
                <p style={{ fontSize: 11, margin: '2px 0 0', opacity: 0.8, fontFamily: 'Inter' }}>
                  {song.stems.length} tracks will be downloaded
                </p>
              </div>
            </button>
          </section>
        )}

        {phase === 'downloading' && (
          <section className="gx-fade-up-2" style={{ marginBottom: 36 }}>
            <div style={{
              background: 'var(--gx-surface)', borderRadius: 20, padding: '22px 24px',
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
              <div style={{ height: 6, background: 'var(--gx-surface-high)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${overallProgress}%`,
                  background: 'linear-gradient(90deg, var(--gx-accent-container), var(--gx-accent))',
                  borderRadius: 9999, transition: 'width 200ms ease',
                }} />
              </div>
            </div>
          </section>
        )}

        {phase === 'ready' && (
          <>
            <section className="gx-fade-up-2" style={{ marginBottom: 20 }}>
              <div
                style={{
                  position: 'relative', height: 4,
                  background: 'var(--gx-surface-high)', borderRadius: 9999,
                  overflow: 'hidden', cursor: 'pointer', marginBottom: 28,
                }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  handleSeek((e.clientX - rect.left) / rect.width);
                }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, height: '100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--gx-accent-container), var(--gx-accent))',
                  borderRadius: 9999, transition: 'width 50ms linear',
                }} />
              </div>

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
                      {failedStems.length} stem{failedStems.length > 1 ? 's' : ''} failed
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
                    Retry
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
                }}>Stems Mixer</h3>
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
                      Re-download
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
                Stems not available on server. Load audio files from your device below.
              </p>
            </div>
          </section>
        )}

        {phase === 'idle' && !song.hasStems && (
          <section className="gx-fade-up-3" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 4px 4px', fontFamily: 'Inter' }}>
              Mixer — {tracks.length} Tracks
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

      <div style={{ position: 'relative', height: 6, cursor: 'pointer' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--gx-surface-lowest)',
          borderRadius: 9999,
        }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, height: '100%',
          width: `${volPct}%`,
          background: 'linear-gradient(90deg, var(--gx-accent-container), var(--gx-accent))',
          borderRadius: 9999,
          transition: 'width 80ms linear',
        }} />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={track.volume}
          onChange={e => onVolumeChange(parseFloat(e.target.value))}
          disabled={!track.loaded}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            opacity: 0, cursor: track.loaded ? 'pointer' : 'not-allowed',
            margin: 0,
          }}
        />
      </div>
    </div>
  );
}

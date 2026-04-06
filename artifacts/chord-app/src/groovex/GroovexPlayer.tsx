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

type StemStatus = 'none' | 'available' | 'downloading' | 'loaded';

export default function GroovexPlayer() {
  const { activeSongId, setView, preferences } = useGroovexStore();
  const song = useMemo(() => SONG_CATALOG.find(s => s.id === activeSongId), [activeSongId]);

  const engineRef = useRef<AudioEngine | null>(null);
  const rafRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState<{
    name: string; label: string; icon: string;
    volume: number; muted: boolean; solo: boolean;
    status: StemStatus;
    downloadProgress: number;
  }[]>([]);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    if (!song) return;
    const engine = createEngine();
    engine.looping = preferences.loopPlayback;
    const trackStates = initTracks(engine, song.stems);
    engineRef.current = engine;
    setMasterVolume(engine, preferences.masterVolume);
    setTracks(trackStates.map(t => ({
      name: t.name, label: t.label, icon: t.icon,
      volume: t.volume, muted: t.muted, solo: t.solo,
      status: 'none' as StemStatus,
      downloadProgress: 0,
    })));
    setCurrentTime(0);
    setDuration(0);

    if (song.hasStems) {
      getSongCacheStatus(song.id, song.stems.map(s => s.name)).then(cacheStatus => {
        setTracks(prev => prev.map(t => ({
          ...t,
          status: cacheStatus[t.name] ? 'available' : 'none',
        })));
      });
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      destroyEngine(engine);
      engineRef.current = null;
    };
  }, [song, preferences.loopPlayback, preferences.masterVolume]);

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

  async function handleDownloadStem(idx: number) {
    const engine = engineRef.current;
    if (!engine || !song) return;

    setTracks(prev => prev.map((t, i) =>
      i === idx ? { ...t, status: 'downloading', downloadProgress: 0 } : t
    ));

    try {
      resumeAudioContext();
      const data = await downloadStem(song.id, tracks[idx].name, (p: DownloadProgress) => {
        setTracks(prev => prev.map((t, i) =>
          i === idx ? { ...t, downloadProgress: p.percent } : t
        ));
      });
      const buffer = await loadAudioBuffer(data);
      setTrackBuffer(engine, idx, buffer);
      setTracks(prev => prev.map((t, i) =>
        i === idx ? { ...t, status: 'loaded', downloadProgress: 100 } : t
      ));
      setDuration(engine.duration);
    } catch (e) {
      console.error('Failed to download stem:', e);
      setTracks(prev => prev.map((t, i) =>
        i === idx ? { ...t, status: 'none', downloadProgress: 0 } : t
      ));
    }
  }

  async function handleDownloadAll() {
    const engine = engineRef.current;
    if (!engine || !song) return;
    setDownloadingAll(true);

    for (let idx = 0; idx < tracks.length; idx++) {
      if (tracks[idx].status === 'loaded') continue;
      await handleDownloadStem(idx);
    }

    setDownloadingAll(false);
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
      setTracks(prev => prev.map((t, i) =>
        i === idx ? { ...t, status: 'downloading', downloadProgress: 50 } : t
      ));
      try {
        resumeAudioContext();
        const buffer = await loadAudioFile(file);
        setTrackBuffer(engine, idx, buffer);
        setTracks(prev => prev.map((t, i) =>
          i === idx ? { ...t, status: 'loaded', downloadProgress: 100 } : t
        ));
        setDuration(engine.duration);
      } catch (e) {
        console.error('Failed to load audio:', e);
        setTracks(prev => prev.map((t, i) =>
          i === idx ? { ...t, status: 'none', downloadProgress: 0 } : t
        ));
      }
    };
    input.click();
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
  const anyLoaded = tracks.some(t => t.status === 'loaded');
  const allLoaded = tracks.every(t => t.status === 'loaded');
  const anyDownloading = tracks.some(t => t.status === 'downloading');

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
          </div>
        </section>

        {song.hasStems && !allLoaded && (
          <div style={{
            background: 'var(--gx-surface-low)', borderRadius: 14, padding: '14px 18px',
            marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: '1px solid rgba(103,156,255,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--gx-accent)' }}>cloud_download</span>
              <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter', lineHeight: 1.4 }}>
                Stems available on server
              </p>
            </div>
            <button
              onClick={handleDownloadAll}
              disabled={downloadingAll || anyDownloading}
              style={{
                padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--gx-accent), var(--gx-accent-container))',
                color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'Inter',
                letterSpacing: '0.03em',
                opacity: downloadingAll || anyDownloading ? 0.6 : 1,
              }}
            >
              {downloadingAll || anyDownloading ? 'Downloading...' : 'Download All'}
            </button>
          </div>
        )}

        {!song.hasStems && !anyLoaded && (
          <div style={{
            background: 'var(--gx-surface-low)', borderRadius: 14, padding: '16px 18px',
            marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
            border: '1px solid rgba(103,156,255,0.15)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--gx-accent)' }}>info</span>
            <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter', lineHeight: 1.4 }}>
              Load audio stems from your device for each track below.
            </p>
          </div>
        )}

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 4px 4px', fontFamily: 'Inter' }}>
            Mixer — {tracks.length} Tracks
          </p>
          {tracks.map((track, idx) => (
            <TrackCard
              key={track.name}
              track={track}
              hasServerStems={!!song.hasStems}
              onDownload={() => handleDownloadStem(idx)}
              onLoadFromFile={() => handleLoadFromFile(idx)}
              onVolumeChange={(v) => handleVolumeChange(idx, v)}
              onMute={() => handleMute(idx)}
              onSolo={() => handleSolo(idx)}
            />
          ))}
        </section>
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
  track, hasServerStems, onDownload, onLoadFromFile, onVolumeChange, onMute, onSolo,
}: {
  track: {
    name: string; label: string; icon: string;
    volume: number; muted: boolean; solo: boolean;
    status: StemStatus;
    downloadProgress: number;
  };
  hasServerStems: boolean;
  onDownload: () => void;
  onLoadFromFile: () => void;
  onVolumeChange: (v: number) => void;
  onMute: () => void;
  onSolo: () => void;
}) {
  const isDownloading = track.status === 'downloading';
  const isLoaded = track.status === 'loaded';
  const isCached = track.status === 'available';

  return (
    <div style={{
      background: 'var(--gx-surface-high)', padding: '16px 18px', borderRadius: 14,
      border: '1px solid rgba(72,72,72,0.1)',
      display: 'flex', flexDirection: 'column', gap: 14,
      opacity: track.muted ? 0.5 : 1,
      transition: 'opacity 150ms ease, background 100ms ease',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {isDownloading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, height: 3,
          width: `${track.downloadProgress}%`,
          background: 'linear-gradient(90deg, var(--gx-accent), var(--gx-accent-container))',
          transition: 'width 200ms ease',
        }} />
      )}

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
            <p style={{ fontSize: 10, color: 'var(--c-text-secondary)', margin: '1px 0 0', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {isLoaded ? 'Ready' : isDownloading ? `${track.downloadProgress}%` : isCached ? 'Cached' : 'No file'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!isLoaded && !isDownloading && (
            <>
              {hasServerStems && (
                <button
                  onClick={onDownload}
                  style={{
                    padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: isCached ? 'rgba(103,156,255,0.15)' : 'var(--gx-accent-dim)',
                    color: isCached ? 'var(--gx-accent)' : '#fff',
                    fontSize: 10, fontWeight: 700, fontFamily: 'Inter',
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    {isCached ? 'play_arrow' : 'cloud_download'}
                  </span>
                  {isCached ? 'Load' : 'Get'}
                </button>
              )}
              <button
                onClick={onLoadFromFile}
                title="Load from device"
                style={{
                  padding: '5px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'var(--gx-surface-low)',
                  color: 'var(--c-text-secondary)',
                  fontSize: 10, fontWeight: 700, fontFamily: 'Inter',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder_open</span>
              </button>
            </>
          )}
          {isDownloading && (
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--gx-accent)', animation: 'spin 1s linear infinite' }}>progress_activity</span>
            </div>
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
          disabled={!isLoaded}
          className="gx-slider"
          style={{ flex: 1 }}
        />
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-text-secondary)' }}>volume_up</span>
      </div>
    </div>
  );
}

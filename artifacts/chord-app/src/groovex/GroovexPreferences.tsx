import { useState, useEffect, useCallback, useRef } from 'react';
import ElasticSlider from '../components/ElasticSlider';
import { useGroovexStore } from './useGroovexStore';
import { getCacheSize, clearAllCache, clearSongCache, getPerSongCacheInfo, type SongCacheInfo } from './stemCache';
import { SONG_CATALOG } from './songCatalog';
import { useT } from '../lib/useT';
import { APP_VERSION_LABEL } from '../lib/appVersion';
import { useScrollHide } from '../lib/navScroll';

export default function GroovexPreferences() {
  const t = useT();
  const { preferences, updatePreferences } = useGroovexStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);
  const [cacheInfo, setCacheInfo] = useState({ totalBytes: 0, songCount: 0, stemCount: 0 });
  const [songCaches, setSongCaches] = useState<SongCacheInfo[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const refreshCache = useCallback(() => {
    getCacheSize().then(setCacheInfo);
    getPerSongCacheInfo().then(setSongCaches);
  }, []);

  useEffect(() => {
    refreshCache();
  }, [refreshCache]);

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleDeleteSong(songId: string) {
    setDeletingId(songId);
    setConfirmDeleteAll(false);
    await clearSongCache(songId);
    await Promise.all([getCacheSize().then(setCacheInfo), getPerSongCacheInfo().then(setSongCaches)]);
    setDeletingId(null);
  }

  async function handleClearAll() {
    setConfirmDeleteAll(false);
    setDeletingId('__all__');
    await clearAllCache();
    await Promise.all([getCacheSize().then(setCacheInfo), getPerSongCacheInfo().then(setSongCaches)]);
    setDeletingId(null);
  }

  function songMeta(songId: string) {
    return SONG_CATALOG.find(s => s.id === songId);
  }

  return (
    <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>

        <section style={{ paddingTop: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: 'var(--c-text-primary)' }}>{t.groovex.audioEngine}</h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', fontFamily: 'Inter', margin: 0 }}>
            {t.groovex.audioEngineDesc}
          </p>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <PrefCard title={t.groovex.defaultVolumeLevels} icon="equalizer">
            <SliderRow
              label={t.groovex.masterGain}
              value={preferences.masterVolume}
              onChange={(v) => updatePreferences({ masterVolume: v })}
              displayValue={`${Math.round((preferences.masterVolume - 1) * 20)} dB`}
            />
            <SliderRow
              label={t.groovex.defaultStemVolume}
              value={preferences.defaultStemVolume}
              onChange={(v) => updatePreferences({ defaultStemVolume: v })}
              displayValue={`${Math.round(preferences.defaultStemVolume * 100)}%`}
            />
          </PrefCard>

          <PrefCard title={t.groovex.playback} icon="play_circle">
            <ToggleRow
              label={t.groovex.autoPlayOnLoad}
              value={preferences.autoPlay}
              onChange={(v) => updatePreferences({ autoPlay: v })}
            />
            <ToggleRow
              label={t.groovex.infiniteLoop}
              value={preferences.loopPlayback}
              onChange={(v) => updatePreferences({ loopPlayback: v })}
            />
            <ToggleRow
              label={t.groovex.prerollCountIn}
              value={preferences.countIn}
              onChange={(v) => updatePreferences({ countIn: v })}
            />
          </PrefCard>

          <PrefCard title={t.groovex.downloadedSongs} icon="cloud_done">
            <div style={{ padding: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 4px', fontFamily: 'Inter' }}>
                    {t.groovex.songUnit(cacheInfo.songCount)} • {cacheInfo.stemCount} {t.groovex.stems}
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>
                    {formatBytes(cacheInfo.totalBytes)}
                  </p>
                </div>
                {cacheInfo.songCount > 0 && (
                  confirmDeleteAll ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={handleClearAll}
                        disabled={deletingId !== null}
                        style={{
                          padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                          background: '#ee7d77', color: '#fff',
                          fontSize: 12, fontWeight: 700, fontFamily: 'Inter',
                          opacity: deletingId ? 0.5 : 1,
                        }}
                      >
                        {t.groovex.confirm}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteAll(false)}
                        style={{
                          padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                          background: 'var(--gx-surface-high)', color: 'var(--c-text-primary)',
                          fontSize: 12, fontWeight: 700, fontFamily: 'Inter',
                        }}
                      >
                        {t.groovex.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteAll(true)}
                      disabled={deletingId !== null}
                      style={{
                        padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'rgba(238,125,119,0.15)', color: '#ee7d77',
                        fontSize: 12, fontWeight: 700, fontFamily: 'Inter',
                        opacity: deletingId ? 0.5 : 1,
                      }}
                    >
                      {t.groovex.deleteAll}
                    </button>
                  )
                )}
              </div>

              {songCaches.length > 0 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 2,
                  marginTop: 4, marginBottom: 10,
                  maxHeight: 280, overflowY: 'auto',
                  borderRadius: 12,
                }}>
                  {songCaches.map(sc => {
                    const meta = songMeta(sc.songId);
                    const isDeleting = deletingId === sc.songId || deletingId === '__all__';
                    return (
                      <div
                        key={sc.songId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 12px',
                          background: 'var(--gx-surface-high)',
                          borderRadius: 10,
                          opacity: isDeleting ? 0.4 : 1,
                          transition: 'opacity 200ms ease',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{
                          fontSize: 28, color: 'var(--gx-accent)', flexShrink: 0,
                          fontVariationSettings: "'FILL' 1",
                        }}>album</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)',
                            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {meta?.title ?? sc.songId}
                          </p>
                          <p style={{
                            fontSize: 11, color: 'var(--c-text-secondary)', margin: '2px 0 0',
                            fontFamily: 'Inter',
                          }}>
                            {meta?.artist ?? t.groovex.unknown} • {sc.stemCount} {t.groovex.stems} • {formatBytes(sc.totalBytes)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteSong(sc.songId)}
                          disabled={deletingId !== null}
                          style={{
                            width: 32, height: 32, borderRadius: 8, border: 'none',
                            cursor: deletingId ? 'default' : 'pointer',
                            background: 'rgba(238,125,119,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            opacity: deletingId && !isDeleting ? 0.3 : 1,
                            transition: 'opacity 150ms',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ee7d77' }}>
                            {isDeleting ? 'hourglass_empty' : 'delete'}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter', opacity: 0.7, lineHeight: 1.4 }}>
                {songCaches.length === 0
                  ? t.groovex.noSongsDownloaded
                  : t.groovex.downloadedSongsHint}
              </p>
            </div>
          </PrefCard>

          <PrefCard title={t.groovex.aboutGroovex} icon="info">
            <div style={{ padding: '4px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 8px', fontFamily: 'Inter', lineHeight: 1.5 }}>
                {t.groovex.aboutDesc1}
              </p>
              <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 8px', fontFamily: 'Inter', lineHeight: 1.5 }}>
                {t.groovex.aboutDesc2}
              </p>
              <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter', opacity: 0.6 }}>
                {APP_VERSION_LABEL} • {t.groovex.aboutVersion}
              </p>
            </div>
          </PrefCard>

          <div style={{ marginTop: 16, paddingTop: 20, borderTop: '1px solid rgba(72,72,72,0.15)' }}>
            <h4 style={{ color: '#ee7d77', fontWeight: 700, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
              {t.groovex.resetAllPreferences}
            </h4>
            <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 16px', maxWidth: 400, lineHeight: 1.4 }}>
              {t.groovex.resetDesc}
            </p>
            <button
              onClick={() => updatePreferences({
                masterVolume: 0.85,
                loopPlayback: false,
                autoPlay: false,
                countIn: false,
                defaultStemVolume: 0.85,
              })}
              style={{
                background: 'rgba(127,41,39,0.2)', border: '1px solid rgba(238,125,119,0.3)',
                color: '#ee7d77', fontSize: 13, fontWeight: 700, padding: '12px 24px',
                borderRadius: 9999, cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
            >
              {t.groovex.resetToDefaults}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrefCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--gx-surface)', borderRadius: 16, padding: 20,
      transition: 'background 150ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--gx-accent)' }}>{icon}</span>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {children}
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange, displayValue }: {
  label: string; value: number; onChange: (v: number) => void; displayValue: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-secondary)', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {label}
        </label>
        <span style={{ fontSize: 13, color: 'var(--gx-accent)', fontWeight: 700 }}>{displayValue}</span>
      </div>
      <ElasticSlider
        min={0} max={1} step={0.01}
        value={value}
        onChange={onChange}
        accentColor="var(--gx-accent, #679cff)"
        trackColor="var(--gx-surface-high, rgba(128,128,128,0.2))"
      />
    </div>
  );
}

function ToggleRow({ label, value, onChange }: {
  label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-primary)' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 9999, border: 'none', cursor: 'pointer',
          background: value ? 'rgba(103,156,255,0.25)' : 'var(--gx-surface-high)',
          position: 'relative', padding: 2, transition: 'background 150ms ease',
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 9999,
          background: value ? 'var(--gx-accent)' : 'var(--c-text-secondary)',
          position: 'absolute', top: 3,
          left: value ? 23 : 3,
          transition: 'left 150ms ease, background 150ms ease',
        }} />
      </button>
    </div>
  );
}

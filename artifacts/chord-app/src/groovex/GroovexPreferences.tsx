import { useState, useEffect } from 'react';
import { useGroovexStore } from './useGroovexStore';
import { getCacheSize, clearAllCache } from './stemCache';
import { useChordStore, ACCENT_COLORS, type PerAppVisuals, type Theme, type AppKey } from '../store/useChordStore';
import { COLOR_OPTIONS } from '../components/SettingControls';
import { useT } from '../lib/useT';
import ApplyToSheet from '../components/ApplyToSheet';

export default function GroovexPreferences() {
  const { preferences, updatePreferences } = useGroovexStore();
  const { settings, updatePerApp } = useChordStore();
  const t = useT();
  const [cacheInfo, setCacheInfo] = useState({ totalBytes: 0, songCount: 0, stemCount: 0 });

  const groovexVis: PerAppVisuals = settings.perApp?.groovex ?? { theme: 'dark', accentColor: 'blue', amoledMode: false };
  const accent = ACCENT_COLORS[groovexVis.accentColor] ?? ACCENT_COLORS.blue;

  const [pending, setPending] = useState<Partial<PerAppVisuals> | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  function requestChange(patch: Partial<PerAppVisuals>) {
    setPending(patch);
    setShowSheet(true);
  }
  function handleApply(apps: AppKey[]) {
    if (pending) updatePerApp(apps, pending);
    setPending(null);
    setShowSheet(false);
  }
  function handleClose() {
    setPending(null);
    setShowSheet(false);
  }

  useEffect(() => {
    getCacheSize().then(setCacheInfo);
  }, []);

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleClearCache() {
    await clearAllCache();
    setCacheInfo({ totalBytes: 0, songCount: 0, stemCount: 0 });
  }

  const themeOptions: { value: Theme; label: string; icon: string; amoled: boolean }[] = [
    { value: 'system', label: t.settings.rows.themeSystem, icon: 'brightness_auto', amoled: false },
    { value: 'light',  label: t.settings.rows.themeLight,  icon: 'light_mode',      amoled: false },
    { value: 'dark',   label: t.settings.rows.themeDark,   icon: 'dark_mode',        amoled: false },
    { value: 'dark',   label: t.hub.amoled,                icon: 'contrast',          amoled: true  },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>

        <section style={{ paddingTop: 32, marginBottom: 28 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: 'var(--c-text-primary)' }}>
            {t.settings.title}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', fontFamily: 'Inter', margin: 0 }}>
            Customize look, audio engine & playback.
          </p>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <PrefCard title={t.settings.sections.appearance} icon="palette" accent={accent.from}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {themeOptions.map((opt, i) => {
                const isActive = opt.amoled
                  ? groovexVis.amoledMode
                  : groovexVis.theme === opt.value && !groovexVis.amoledMode;
                return (
                  <button key={i}
                    onClick={() => {
                      if (opt.amoled) requestChange({ theme: 'dark', amoledMode: true });
                      else requestChange({ theme: opt.value, amoledMode: false });
                    }}
                    style={{
                      padding: '14px 8px', borderRadius: 14,
                      background: isActive ? `${accent.from}20` : 'var(--gx-surface-high)',
                      border: `1.5px solid ${isActive ? accent.from + '60' : 'rgba(128,128,128,0.10)'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                      transition: 'background 200ms ease, border-color 200ms ease',
                      cursor: 'pointer',
                    }}>
                    <span className="material-symbols-outlined" style={{
                      fontSize: 22,
                      color: isActive ? accent.from : 'var(--c-text-secondary)',
                      fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                      transition: 'color 200ms ease',
                    }}>{opt.icon}</span>
                    <p style={{
                      margin: 0, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope',
                      color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
                      transition: 'color 200ms ease',
                    }}>{opt.label}</p>
                  </button>
                );
              })}
            </div>

            <div style={{ height: 1, background: 'rgba(128,128,128,0.10)', margin: '6px 0' }} />

            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, color: 'var(--c-text-secondary)',
                letterSpacing: '0.14em', textTransform: 'uppercase',
                margin: '0 0 10px', fontFamily: 'Manrope',
              }}>Accent Color</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {COLOR_OPTIONS.map(c => {
                  const isActive = groovexVis.accentColor === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => requestChange({ accentColor: c.id as PerAppVisuals['accentColor'] })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', borderRadius: 12,
                        background: isActive ? `${c.to}20` : 'var(--gx-surface-high)',
                        border: `1.5px solid ${isActive ? c.to + '60' : 'rgba(128,128,128,0.10)'}`,
                        transition: 'background 200ms ease, border-color 200ms ease',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${c.from}, ${c.to})`,
                        flexShrink: 0,
                        boxShadow: isActive ? `0 0 8px ${c.to}55` : 'none',
                        transition: 'box-shadow 200ms ease',
                        display: 'block',
                      }} />
                      <span style={{
                        color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
                        fontFamily: 'Manrope', fontWeight: 700, fontSize: 11,
                        transition: 'color 200ms ease',
                      }}>{t.settings.colors[c.id]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </PrefCard>

          <PrefCard title="Default Volume Levels" icon="equalizer" accent={accent.from}>
            <SliderRow
              label="Master Gain"
              value={preferences.masterVolume}
              onChange={(v) => updatePreferences({ masterVolume: v })}
              displayValue={`${Math.round((preferences.masterVolume - 1) * 20)} dB`}
              accent={accent.from}
            />
            <SliderRow
              label="Default Stem Volume"
              value={preferences.defaultStemVolume}
              onChange={(v) => updatePreferences({ defaultStemVolume: v })}
              displayValue={`${Math.round(preferences.defaultStemVolume * 100)}%`}
              accent={accent.from}
            />
          </PrefCard>

          <PrefCard title="Playback" icon="play_circle" accent={accent.from}>
            <ToggleRow
              label="Auto-play on Load"
              value={preferences.autoPlay}
              onChange={(v) => updatePreferences({ autoPlay: v })}
              accent={accent.from}
            />
            <ToggleRow
              label="Infinite Loop"
              value={preferences.loopPlayback}
              onChange={(v) => updatePreferences({ loopPlayback: v })}
              accent={accent.from}
            />
            <ToggleRow
              label="Pre-roll Count-in"
              value={preferences.countIn}
              onChange={(v) => updatePreferences({ countIn: v })}
              accent={accent.from}
            />
          </PrefCard>

          <PrefCard title="Downloaded Stems Cache" icon="cloud_done" accent={accent.from}>
            <div style={{ padding: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 4px', fontFamily: 'Inter' }}>
                    {cacheInfo.stemCount} stems from {cacheInfo.songCount} songs
                  </p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>
                    {formatBytes(cacheInfo.totalBytes)}
                  </p>
                </div>
                {cacheInfo.stemCount > 0 && (
                  <button
                    onClick={handleClearCache}
                    style={{
                      padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'rgba(238,125,119,0.15)', color: '#ee7d77',
                      fontSize: 12, fontWeight: 700, fontFamily: 'Inter',
                      alignSelf: 'center',
                    }}
                  >
                    Clear Cache
                  </button>
                )}
              </div>
              <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter', opacity: 0.7, lineHeight: 1.4 }}>
                Downloaded stems are cached in your browser. Clearing the cache will require re-downloading stems when you open songs.
              </p>
            </div>
          </PrefCard>

          <PrefCard title="About Groovex" icon="info" accent={accent.from}>
            <div style={{ padding: '4px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 8px', fontFamily: 'Inter', lineHeight: 1.5 }}>
                Groovex is a multitrack music practice tool. Load audio stems for any song
                and control each track independently — adjust volumes, mute, or solo individual
                instruments to practice at your own pace.
              </p>
              <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 8px', fontFamily: 'Inter', lineHeight: 1.5 }}>
                All audio processing happens locally using the Web Audio API for zero-latency,
                perfectly synchronized playback.
              </p>
              <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: 0, fontFamily: 'Inter', opacity: 0.6 }}>
                Version 1.0 • Part of Studio by Mag
              </p>
            </div>
          </PrefCard>

          <div style={{ marginTop: 16, paddingTop: 20, borderTop: '1px solid rgba(72,72,72,0.15)' }}>
            <h4 style={{ color: '#ee7d77', fontWeight: 700, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
              Reset All Preferences
            </h4>
            <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 16px', maxWidth: 400, lineHeight: 1.4 }}>
              Resetting preferences will revert all volume levels and playback behaviors to defaults. This cannot be undone.
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
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      <ApplyToSheet show={showSheet} onApply={handleApply} onClose={handleClose} />
    </div>
  );
}

function PrefCard({ title, icon, accent, children }: { title: string; icon: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--gx-surface)', borderRadius: 16, padding: 20,
      transition: 'background 150ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent }}>{icon}</span>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {children}
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange, displayValue, accent }: {
  label: string; value: number; onChange: (v: number) => void; displayValue: string; accent: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-secondary)', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {label}
        </label>
        <span style={{ fontSize: 13, color: accent, fontWeight: 700 }}>{displayValue}</span>
      </div>
      <input
        type="range" min="0" max="1" step="0.01" value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="gx-slider"
        style={{ width: '100%' }}
      />
    </div>
  );
}

function ToggleRow({ label, value, onChange, accent }: {
  label: string; value: boolean; onChange: (v: boolean) => void; accent: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-primary)' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 9999, border: 'none', cursor: 'pointer',
          background: value ? `${accent}30` : 'var(--gx-surface-high)',
          position: 'relative', padding: 2, transition: 'background 150ms ease',
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: 9999,
          background: value ? accent : 'var(--c-text-secondary)',
          position: 'absolute', top: 3,
          left: value ? 23 : 3,
          transition: 'left 150ms ease, background 150ms ease',
        }} />
      </button>
    </div>
  );
}

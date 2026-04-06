import { useGroovexStore } from './useGroovexStore';

export default function GroovexPreferences() {
  const { preferences, updatePreferences } = useGroovexStore();

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>

        <section style={{ paddingTop: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 6px', color: 'var(--c-text-primary)' }}>Audio Engine</h2>
          <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', fontFamily: 'Inter', margin: 0 }}>
            Fine-tune the output behavior and default playback states.
          </p>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <PrefCard title="Default Volume Levels" icon="equalizer">
            <SliderRow
              label="Master Gain"
              value={preferences.masterVolume}
              onChange={(v) => updatePreferences({ masterVolume: v })}
              displayValue={`${Math.round((preferences.masterVolume - 1) * 20)} dB`}
            />
            <SliderRow
              label="Default Stem Volume"
              value={preferences.defaultStemVolume}
              onChange={(v) => updatePreferences({ defaultStemVolume: v })}
              displayValue={`${Math.round(preferences.defaultStemVolume * 100)}%`}
            />
          </PrefCard>

          <PrefCard title="Playback" icon="play_circle">
            <ToggleRow
              label="Auto-play on Load"
              value={preferences.autoPlay}
              onChange={(v) => updatePreferences({ autoPlay: v })}
            />
            <ToggleRow
              label="Infinite Loop"
              value={preferences.loopPlayback}
              onChange={(v) => updatePreferences({ loopPlayback: v })}
            />
            <ToggleRow
              label="Pre-roll Count-in"
              value={preferences.countIn}
              onChange={(v) => updatePreferences({ countIn: v })}
            />
          </PrefCard>

          <PrefCard title="About Groovex" icon="info">
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
      <input
        type="range" min="0" max="1" step="0.01" value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="gx-slider"
        style={{ width: '100%' }}
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

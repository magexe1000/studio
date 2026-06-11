import { useRef } from 'react';
import { useDrumStore } from '../store/useDrumStore';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { Toggle, SectionHeader, SettingRow } from '../components/SettingControls';
import { useT } from '../lib/useT';
import { useScrollHide } from '../lib/navScroll';
import { useIsWebDesktop } from '../hooks/useIsWebDesktop';
import { WebSettingsSection, WebPreferenceRow } from '../components/WebDesignSystem';

function IconDrumSongs({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6; const ao = active ? 0.13 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={ao} />
      <line x1="7.5" y1="8"  x2="16.5" y2="8"  stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
      <line x1="7.5" y1="16" x2="13"   y2="16" stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
    </svg>
  );
}
function IconPatterns({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={sw} />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth={sw * 0.7} />
      <circle cx="7" cy="6" r="1.2" fill="currentColor" />
      <circle cx="12" cy="6" r="1.2" fill="currentColor" />
      <circle cx="17" cy="12" r="1.2" fill="currentColor" />
      <circle cx="7" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="18" r="1.2" fill="currentColor" />
      <circle cx="17" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}
function IconPrefs({ active }: { active: boolean }) {
  const sw = active ? 2.2 : 1.7;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <line x1="4" y1="6"  x2="20" y2="6"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="8" y1="3"  x2="8"  y2="9"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="14" y1="9" x2="14" y2="15" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="10" y1="15" x2="10" y2="21" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

export default function DrumPrefsPanel() {
  const { settings, updateSettings } = useChordStore();
  const { drumPrefs, updateDrumPrefs } = useDrumStore();
  const t = useT();
  const dp = t.drumPrefs;
  const acc = ACCENT_COLORS[(settings.perApp?.drums?.accentColor ?? settings.accentColor) as keyof typeof ACCENT_COLORS] ?? ACCENT_COLORS.blue;
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);

  const cardStyle: React.CSSProperties = {
    background: 'var(--app-surface)',
    borderRadius: '1.5rem',
    overflow: 'hidden',
  };

  const isWebDesktop = useIsWebDesktop();

  function row(key: keyof typeof drumPrefs, label: string, desc: string) {
    if (isWebDesktop) {
      return (
        <WebPreferenceRow label={label} desc={desc}>
          <Toggle
            value={drumPrefs[key] as boolean}
            onChange={v => updateDrumPrefs({ [key]: v })}
            accentFrom={acc.from}
            accentTo={acc.to}
          />
        </WebPreferenceRow>
      );
    }
    return (
      <SettingRow label={label} desc={desc}>
        <Toggle
          value={drumPrefs[key] as boolean}
          onChange={v => updateDrumPrefs({ [key]: v })}
          accentFrom={acc.from}
          accentTo={acc.to}
        />
      </SettingRow>
    );
  }

  if (isWebDesktop) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[#050505] p-6">
        <div className="mb-6">
          <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'white', fontFamily: 'Manrope' }}>
            {dp.title}
          </h2>
          <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '11px', marginTop: '2px' }}>
            {dp.subtitle}
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar space-y-6" style={{ paddingBottom: '96px' }}>
          <WebSettingsSection title={dp.editorBehavior}>
            {row('noteVariationsCycle', dp.noteVariations, dp.noteVariationsDesc)}
            {row('autoExpandPattern', dp.autoExpand, dp.autoExpandDesc)}
            {row('snapToGrid', dp.snapToGrid, dp.snapToGridDesc)}
            {row('dragToFill', dp.dragToFill, dp.dragToFillDesc)}
          </WebSettingsSection>

          <WebSettingsSection title={dp.playback}>
            {row('autoPlayOnEdit', dp.autoPlay, dp.autoPlayDesc)}
            {row('loopPlayback', dp.loopPlayback, dp.loopPlaybackDesc)}
            {row('metronome', dp.metronome, dp.metronomeDesc)}
            {row('countIn', dp.countIn, dp.countInDesc)}
            {row('humanizeVelocity', dp.humanizeVelocity, dp.humanizeVelocityDesc)}
          </WebSettingsSection>

          <WebSettingsSection title={dp.interaction}>
            {row('showNoteVariations', dp.showVariations, dp.showVariationsDesc)}
            {row('highlightActiveInst', dp.highlightActive, dp.highlightActiveDesc)}
          </WebSettingsSection>

          <WebSettingsSection title={dp.visual}>
            {row('gridLinesEmphasis', dp.gridEmphasis, dp.gridEmphasisDesc)}
          </WebSettingsSection>

          <WebSettingsSection title={dp.startOn}>
            <WebPreferenceRow label={dp.startOn} desc={dp.startOnDesc}>
              {(() => {
                const cur = settings.defaultDrumTab ?? 'songs';
                const tabs: { value: 'songs' | 'patterns' | 'prefs'; Icon: React.FC<{ active: boolean }> }[] = [
                  { value: 'songs',    Icon: IconDrumSongs },
                  { value: 'patterns', Icon: IconPatterns  },
                  { value: 'prefs',    Icon: IconPrefs     },
                ];
                return (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {tabs.map(({ value, Icon }) => {
                      const active = cur === value;
                      return (
                        <button
                          key={value}
                          onClick={() => updateSettings({ defaultDrumTab: value })}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg border cursor-pointer transition-all ${
                            active 
                              ? 'bg-zinc-800 text-white border-zinc-700' 
                              : 'bg-transparent text-zinc-500 border-zinc-900 hover:text-zinc-300'
                          }`}
                        >
                          <Icon active={active} />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </WebPreferenceRow>
          </WebSettingsSection>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{
          flex: 1, overflowY: 'auto',
          padding: '0 20px',
          paddingBottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 90px)',
        }}
      >
        <div className="spring-in" style={{ marginTop: 12, marginBottom: 24 }}>
          <h2 style={{
            fontFamily: 'Manrope', fontWeight: 900, fontSize: '2.6rem',
            color: 'var(--c-text-primary)', letterSpacing: '-0.04em',
            lineHeight: 1, margin: 0,
          }}>
            {dp.title}
          </h2>
          <p style={{
            color: 'var(--c-text-secondary)', fontFamily: 'Inter',
            fontSize: 13, marginTop: 4,
          }}>
            {dp.subtitle}
          </p>
        </div>

        <SectionHeader icon="edit_note" title={dp.editorBehavior} />
        <div style={cardStyle}>
          {row('noteVariationsCycle', dp.noteVariations, dp.noteVariationsDesc)}
          {row('autoExpandPattern', dp.autoExpand, dp.autoExpandDesc)}
          {row('snapToGrid', dp.snapToGrid, dp.snapToGridDesc)}
          {row('dragToFill', dp.dragToFill, dp.dragToFillDesc)}
        </div>

        <SectionHeader icon="play_circle" title={dp.playback} />
        <div style={cardStyle}>
          {row('autoPlayOnEdit', dp.autoPlay, dp.autoPlayDesc)}
          {row('loopPlayback', dp.loopPlayback, dp.loopPlaybackDesc)}
          {row('metronome', dp.metronome, dp.metronomeDesc)}
          {row('countIn', dp.countIn, dp.countInDesc)}
          {row('humanizeVelocity', dp.humanizeVelocity, dp.humanizeVelocityDesc)}
        </div>

        <SectionHeader icon="touch_app" title={dp.interaction} />
        <div style={cardStyle}>
          {row('showNoteVariations', dp.showVariations, dp.showVariationsDesc)}
          {row('highlightActiveInst', dp.highlightActive, dp.highlightActiveDesc)}
        </div>

        <SectionHeader icon="grid_on" title={dp.visual} />
        <div style={cardStyle}>
          {row('gridLinesEmphasis', dp.gridEmphasis, dp.gridEmphasisDesc)}
        </div>

        <SectionHeader icon="dashboard" title={dp.startOn} />
        <div style={cardStyle}>
          <SettingRow label={dp.startOn} desc={dp.startOnDesc}>
            {(() => {
              const cur = settings.defaultDrumTab ?? 'songs';
              const tabs: { value: 'songs' | 'patterns' | 'prefs'; Icon: React.FC<{ active: boolean }> }[] = [
                { value: 'songs',    Icon: IconDrumSongs },
                { value: 'patterns', Icon: IconPatterns  },
                { value: 'prefs',    Icon: IconPrefs     },
              ];
              return (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {tabs.map(({ value, Icon }) => {
                    const active = cur === value;
                    return (
                      <button
                        key={value}
                        onClick={() => updateSettings({ defaultDrumTab: value })}
                        style={{
                          width: '40px', height: '40px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '10px',
                          border: active ? `2px solid ${acc.from}` : '2px solid transparent',
                          background: active ? `linear-gradient(135deg, ${acc.from}22, ${acc.to}18)` : 'var(--app-surface-low)',
                          color: active ? acc.from : 'var(--c-text-secondary)',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                          flexShrink: 0,
                        }}
                      >
                        <Icon active={active} />
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

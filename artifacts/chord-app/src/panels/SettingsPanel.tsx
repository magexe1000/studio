import React, { useRef } from 'react';
import { useChordStore, ACCENT_COLORS, type ActivePanel } from '../store/useChordStore';
import { useScrollHide } from '../lib/navScroll';
import { useT } from '../lib/useT';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import { useIsWebDesktop } from '../hooks/useIsWebDesktop';
import { Toggle, SectionHeader, SettingRow } from '../components/SettingControls';
import { IconSongs, IconLibrary, IconChords, IconSettings } from '../components/BottomNav';
import { WebSettingsSection, WebPreferenceRow } from '../components/WebDesignSystem';

export default function SettingsPanel() {
  const { settings, updateSettings } = useChordStore();
  const acc = ACCENT_COLORS[settings.perApp?.chords?.accentColor ?? settings.accentColor] ?? ACCENT_COLORS.blue;

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);
  const t = useT();

  const cardStyle: React.CSSProperties = {
    background: 'var(--app-surface)',
    borderRadius: '1.5rem',
    overflow: 'hidden',
    transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
  };

  const standardTuning = 'Standard (EADGBE)';

  const tunings = [
    { label: t.settings.tunings.standard, value: standardTuning },
    { label: t.settings.tunings.dropD,    value: 'Drop D (DADGBE)' },
    { label: t.settings.tunings.openG,    value: 'Open G (DGDGBD)' },
    { label: t.settings.tunings.openD,    value: 'Open D (DADF#AD)' },
    { label: 'DADGAD',                    value: 'DADGAD' },
  ];

  const isWebDesktop = useIsWebDesktop();

  if (isWebDesktop) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[var(--app-bg)] p-6">
        {/* Page title */}
        <div className="mb-6">
          <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: 'white', fontFamily: 'Manrope' }}>
            {t.settings.title}
          </h2>
          <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '11px', marginTop: '2px' }}>
            {t.settings.subtitle}
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar space-y-6">
          {/* ── TUNING ── */}
          <WebSettingsSection title={t.settings.sections.tuning}>
            <WebPreferenceRow label="Instrument Tuning" desc="Change the guitar/bass fretboard tuning system">
              <select
                value={settings.tuning}
                onChange={e => updateSettings({ tuning: e.target.value })}
                className="bg-zinc-900 text-zinc-200 border border-zinc-800 rounded px-2 py-1 text-xs outline-none cursor-pointer hover:border-zinc-700 transition-colors"
                style={{ fontFamily: 'Inter' }}
              >
                {tunings.map(tun => (
                  <option key={tun.value} value={tun.value}>{tun.label}</option>
                ))}
              </select>
            </WebPreferenceRow>
          </WebSettingsSection>

          {/* ── CHORD DIAGRAM ── */}
          <WebSettingsSection title={t.settings.sections.chordDiagram}>
            <WebPreferenceRow label={t.settings.rows.leftHanded} desc={t.settings.rows.leftHandedDesc}>
              <Toggle value={settings.leftHanded} onChange={v => updateSettings({ leftHanded: v })} accentFrom={acc.from} accentTo={acc.to} />
            </WebPreferenceRow>
            <WebPreferenceRow label={t.settings.rows.fretNumbers} desc={t.settings.rows.fretNumbersDesc}>
              <Toggle value={settings.showFretNumbers} onChange={v => updateSettings({ showFretNumbers: v })} accentFrom={acc.from} accentTo={acc.to} />
            </WebPreferenceRow>
            <WebPreferenceRow label={t.settings.rows.fingerNumbers} desc={t.settings.rows.fingerNumbersDesc}>
              <Toggle value={settings.showFingerNumbers} onChange={v => updateSettings({ showFingerNumbers: v })} accentFrom={acc.from} accentTo={acc.to} />
            </WebPreferenceRow>
            <WebPreferenceRow label={t.settings.rows.noteNames} desc={t.settings.rows.noteNamesDesc}>
              <Toggle value={settings.showNoteNames} onChange={v => updateSettings({ showNoteNames: v })} accentFrom={acc.from} accentTo={acc.to} />
            </WebPreferenceRow>
            <WebPreferenceRow label={t.settings.rows.intervalLabels} desc={t.settings.rows.intervalLabelsDesc}>
              <Toggle value={settings.showIntervals} onChange={v => updateSettings({ showIntervals: v })} accentFrom={acc.from} accentTo={acc.to} />
            </WebPreferenceRow>
            <WebPreferenceRow label={t.settings.rows.openStringMarkers} desc={t.settings.rows.openStringMarkersDesc}>
              <Toggle value={settings.showOpenStrings} onChange={v => updateSettings({ showOpenStrings: v })} accentFrom={acc.from} accentTo={acc.to} />
            </WebPreferenceRow>
          </WebSettingsSection>

          {/* ── DISPLAY ── */}
          <WebSettingsSection title={t.settings.sections.display}>
            <WebPreferenceRow label={t.settings.rows.chordColors} desc={t.settings.rows.chordColorsDesc}>
              <Toggle value={settings.showChordQualityColors} onChange={v => updateSettings({ showChordQualityColors: v })} accentFrom={acc.from} accentTo={acc.to} />
            </WebPreferenceRow>
            <WebPreferenceRow label={t.settings.rows.defaultTab} desc={t.settings.rows.defaultTabDesc}>
              {(() => {
                const cur = settings.defaultTab ?? 'library';
                const tabs: { value: ActivePanel; Icon: React.FC<{ active: boolean }> }[] = [
                  { value: 'songs',    Icon: IconSongs    },
                  { value: 'library',  Icon: IconLibrary  },
                  { value: 'chord',    Icon: IconChords   },
                  { value: 'settings', Icon: IconSettings },
                ];
                return (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {tabs.map(({ value, Icon }) => {
                      const active = cur === value;
                      return (
                        <button
                          key={value}
                          onClick={() => updateSettings({ defaultTab: value })}
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

          {/* ── INTELLIGENCE ── */}
          <WebSettingsSection title={t.settings.sections.intelligence}>
            <WebPreferenceRow label={t.settings.rows.chordAssistant} desc={t.settings.rows.chordAssistantDesc}>
              <Toggle value={settings.chordAssistant} onChange={v => updateSettings({ chordAssistant: v })} accentFrom={acc.from} accentTo={acc.to} />
            </WebPreferenceRow>
            {settings.chordAssistant && (
              <>
                <WebPreferenceRow label={t.settings.rows.smartSuggestions} desc={t.settings.rows.smartSuggestionsDesc}>
                  <Toggle value={settings.assistantSmartSuggestions} onChange={v => updateSettings({ assistantSmartSuggestions: v })} accentFrom={acc.from} accentTo={acc.to} />
                </WebPreferenceRow>
                <WebPreferenceRow label={t.settings.rows.progressionTips} desc={t.settings.rows.progressionTipsDesc}>
                  <Toggle value={settings.assistantProgressionTips} onChange={v => updateSettings({ assistantProgressionTips: v })} accentFrom={acc.from} accentTo={acc.to} />
                </WebPreferenceRow>
                <WebPreferenceRow label={t.settings.rows.conflictDetection} desc={t.settings.rows.conflictDetectionDesc}>
                  <Toggle value={settings.assistantConflictDetection} onChange={v => updateSettings({ assistantConflictDetection: v })} accentFrom={acc.from} accentTo={acc.to} />
                </WebPreferenceRow>
                <WebPreferenceRow label={t.settings.rows.learningMode} desc={t.settings.rows.learningModeDesc}>
                  <Toggle value={settings.assistantLearning} onChange={v => updateSettings({ assistantLearning: v })} accentFrom={acc.from} accentTo={acc.to} />
                </WebPreferenceRow>
              </>
            )}
          </WebSettingsSection>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden app-bg">
      {!isWebDesktop && (
        <header className="flex-none px-6 pt-6 pb-1 app-bg spring-in">
          <h1 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <AppModeMenuLogo />
          </h1>
        </header>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-5" style={{ paddingBottom: 'var(--content-bottom-pad)', paddingTop: isWebDesktop ? '20px' : '0' }}>
        {/* Page title */}
        <div className="mt-3 mb-6 spring-in">
          <h2 style={{ fontSize: 'var(--font-hero)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>
            {t.settings.title}
          </h2>
          <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 'var(--font-sm)', marginTop: '4px' }}>
            {t.settings.subtitle}
          </p>
        </div>

        {/* ── TUNING ── */}
        <SectionHeader icon="tune" title={t.settings.sections.tuning} />
        <div style={cardStyle}>
          {tunings.map(tun => {
            const isActive = settings.tuning === tun.value;
            return (
              <button
                key={tun.value}
                className="card-hover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: 'var(--density-row-pad)',
                  background: isActive ? `${acc.to}15` : 'transparent',
                  borderBottom: '1px solid rgba(72,72,72,0.07)',
                  transition: 'background-color 200ms ease',
                }}
                onClick={() => updateSettings({ tuning: tun.value })}
              >
                <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 'var(--font-base)' }}>{tun.label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 'var(--font-sm)' }}>{tun.value}</p>
                  {isActive && (
                    <span className="material-symbols-outlined" style={{ color: acc.from, fontSize: '18px' }}>check</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── CHORD DIAGRAM ── */}
        <SectionHeader icon="schema" title={t.settings.sections.chordDiagram} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.leftHanded} desc={t.settings.rows.leftHandedDesc}>
            <Toggle value={settings.leftHanded} onChange={v => updateSettings({ leftHanded: v })} accentFrom={acc.from} accentTo={acc.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.fretNumbers} desc={t.settings.rows.fretNumbersDesc}>
            <Toggle value={settings.showFretNumbers} onChange={v => updateSettings({ showFretNumbers: v })} accentFrom={acc.from} accentTo={acc.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.fingerNumbers} desc={t.settings.rows.fingerNumbersDesc}>
            <Toggle value={settings.showFingerNumbers} onChange={v => updateSettings({ showFingerNumbers: v })} accentFrom={acc.from} accentTo={acc.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.noteNames} desc={t.settings.rows.noteNamesDesc}>
            <Toggle value={settings.showNoteNames} onChange={v => updateSettings({ showNoteNames: v })} accentFrom={acc.from} accentTo={acc.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.intervalLabels} desc={t.settings.rows.intervalLabelsDesc}>
            <Toggle value={settings.showIntervals} onChange={v => updateSettings({ showIntervals: v })} accentFrom={acc.from} accentTo={acc.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.openStringMarkers} desc={t.settings.rows.openStringMarkersDesc}>
            <Toggle value={settings.showOpenStrings} onChange={v => updateSettings({ showOpenStrings: v })} accentFrom={acc.from} accentTo={acc.to} />
          </SettingRow>
        </div>

        {/* ── DISPLAY ── */}
        <SectionHeader icon="dashboard" title={t.settings.sections.display} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.chordColors} desc={t.settings.rows.chordColorsDesc}>
            <Toggle value={settings.showChordQualityColors} onChange={v => updateSettings({ showChordQualityColors: v })} accentFrom={acc.from} accentTo={acc.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.defaultTab} desc={t.settings.rows.defaultTabDesc}>
            {(() => {
              const cur = settings.defaultTab ?? 'library';
              const tabs: { value: ActivePanel; Icon: React.FC<{ active: boolean }> }[] = [
                { value: 'songs',    Icon: IconSongs    },
                { value: 'library',  Icon: IconLibrary  },
                { value: 'chord',    Icon: IconChords   },
                { value: 'settings', Icon: IconSettings },
              ];
              return (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {tabs.map(({ value, Icon }) => {
                    const active = cur === value;
                    return (
                      <button
                        key={value}
                        onClick={() => updateSettings({ defaultTab: value })}
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

        {/* ── INTELLIGENCE ── */}
        <SectionHeader icon="psychology" title={t.settings.sections.intelligence} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.chordAssistant} desc={t.settings.rows.chordAssistantDesc}>
            <Toggle value={settings.chordAssistant} onChange={v => updateSettings({ chordAssistant: v })} accentFrom={acc.from} accentTo={acc.to} />
          </SettingRow>
          {settings.chordAssistant && (
            <div style={{ borderTop: '1px solid rgba(72,72,72,0.1)', paddingTop: '4px', marginTop: '4px' }}>
              <SettingRow label={t.settings.rows.smartSuggestions} desc={t.settings.rows.smartSuggestionsDesc} indent>
                <Toggle value={settings.assistantSmartSuggestions} onChange={v => updateSettings({ assistantSmartSuggestions: v })} accentFrom={acc.from} accentTo={acc.to} />
              </SettingRow>
              <SettingRow label={t.settings.rows.progressionTips} desc={t.settings.rows.progressionTipsDesc} indent>
                <Toggle value={settings.assistantProgressionTips} onChange={v => updateSettings({ assistantProgressionTips: v })} accentFrom={acc.from} accentTo={acc.to} />
              </SettingRow>
              <SettingRow label={t.settings.rows.conflictDetection} desc={t.settings.rows.conflictDetectionDesc} indent>
                <Toggle value={settings.assistantConflictDetection} onChange={v => updateSettings({ assistantConflictDetection: v })} accentFrom={acc.from} accentTo={acc.to} />
              </SettingRow>
              <SettingRow label={t.settings.rows.learningMode} desc={t.settings.rows.learningModeDesc} indent>
                <Toggle value={settings.assistantLearning} onChange={v => updateSettings({ assistantLearning: v })} accentFrom={acc.from} accentTo={acc.to} />
              </SettingRow>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}


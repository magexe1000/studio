import React, { useRef } from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { useScrollHide } from '../lib/navScroll';
import { useT } from '../lib/useT';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import { Toggle, SectionHeader, SettingRow, SegmentedControl } from '../components/SettingControls';

export default function SettingsPanel() {
  const { settings, updateSettings } = useChordStore();
  const acc = ACCENT_COLORS[settings.accentColor];

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

  return (
    <div className="flex flex-col h-full overflow-hidden app-bg">
      <header className="flex-none px-6 pt-6 pb-1 app-bg">
        <h1 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <AppModeMenuLogo />
        </h1>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-5" style={{ paddingBottom: 'calc(max(10px, env(safe-area-inset-bottom)) + 80px)' }}>
        {/* Page title */}
        <div className="mt-3 mb-6">
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

        {/* ── FEEDBACK ── */}
        <SectionHeader icon="vibration" title={t.settings.sections.feedback} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.haptic} desc={t.settings.rows.hapticDesc}>
            <Toggle value={settings.hapticFeedback} onChange={v => updateSettings({ hapticFeedback: v })} accentFrom={acc.from} accentTo={acc.to} />
          </SettingRow>
        </div>

        {/* ── LANGUAGE ── */}
        <SectionHeader icon="language" title={t.settings.sections.language} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.language.label} desc={t.settings.language.desc}>
            <SegmentedControl<'en' | 'es'>
              value={settings.language}
              options={[
                { value: 'en', label: t.settings.language.en },
                { value: 'es', label: t.settings.language.es },
              ]}
              onChange={v => updateSettings({ language: v })}
              accentFrom={acc.from}
              accentTo={acc.to}
            />
          </SettingRow>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: '32px' }} />

        {/* ── ABOUT ── */}
        <SectionHeader icon="info" title={t.settings.sections.about} />
        <div style={cardStyle}>
          <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: t.settings.about.version,       value: '1.5.0' },
              { label: t.settings.about.designSystem,  value: 'Chordex' },
              { label: t.settings.about.chordLibrary,  value: t.settings.about.chordLibraryValue },
              { label: t.settings.about.storage,       value: t.settings.about.storageValue },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 'var(--font-base)' }}>{label}</span>
                <span style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 'var(--font-sm)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '28px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '32px', height: '2px', borderRadius: '9999px', background: `linear-gradient(90deg, ${acc.from}, ${acc.to})`, marginBottom: '4px' }} />
          <p style={{ color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
            {t.settings.about.footer}
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useRef } from 'react';
import { useChordStore, ACCENT_COLORS, type AccentColor, type AnimationSpeed, type DisplayDensity, type ActivePanel } from '../store/useChordStore';
import { useScrollHide } from '../lib/navScroll';
import { useT } from '../lib/useT';
import { IconSongs, IconLibrary, IconChords, IconSettings } from '../components/BottomNav';
import { ChordexLogo } from '../components/ChordexLogo';

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  accentFrom: string;
  accentTo: string;
}

function Toggle({ value, onChange, accentFrom, accentTo }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="btn-smooth relative flex-none"
      style={{
        width: '48px',
        height: '28px',
        borderRadius: '9999px',
        background: value ? `linear-gradient(135deg, ${accentFrom}, ${accentTo})` : 'rgba(72,72,72,0.2)',
        transition: 'background 300ms ease',
        boxShadow: value ? `0 2px 12px ${accentTo}44` : 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '3px',
          left: value ? 'calc(100% - 25px)' : '3px',
          width: '22px',
          height: '22px',
          borderRadius: '9999px',
          background: value ? 'white' : '#acabaa',
          transition: 'left 280ms cubic-bezier(0.34, 1.56, 0.64, 1), background 280ms ease',
          display: 'block',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6">
      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--c-text-secondary)' }}>{icon}</span>
      <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{title}</p>
    </div>
  );
}

function SettingRow({ label, desc, children, indent }: { label: string; desc?: string; children: React.ReactNode; indent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4" style={{ padding: 'var(--density-row-pad)', borderBottom: '1px solid rgba(72,72,72,0.07)', paddingLeft: indent ? '28px' : undefined }}>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: indent ? 'var(--font-sm)' : 'var(--font-base)', fontWeight: 600, color: indent ? 'var(--c-text-secondary)' : 'var(--c-text-primary)', fontFamily: 'Manrope' }}>{label}</p>
        {desc && <p style={{ fontSize: 'var(--font-sm)', marginTop: '2px', lineHeight: 1.3, color: 'var(--c-text-secondary)', fontFamily: 'Inter', opacity: indent ? 0.75 : 1 }}>{desc}</p>}
      </div>
      <div className="flex-none">{children}</div>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value, options, onChange, accentFrom, accentTo,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  accentFrom: string;
  accentTo: string;
}) {
  return (
    <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '9999px', padding: '2px', display: 'flex', transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="btn-smooth"
          style={{
            padding: '4px 12px',
            borderRadius: '9999px',
            fontFamily: 'Manrope',
            fontSize: 'var(--font-xs)',
            fontWeight: 700,
            background: value === opt.value ? `linear-gradient(135deg, ${accentFrom}, ${accentTo})` : 'transparent',
            color: value === opt.value ? 'white' : '#acabaa',
            transition: 'background 250ms ease, color 250ms ease',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const COLOR_OPTIONS: { id: AccentColor; from: string; to: string }[] = [
  { id: 'blue',   from: '#679cff', to: '#007aff' },
  { id: 'purple', from: '#b57bee', to: '#7c3aed' },
  { id: 'green',  from: '#34d399', to: '#059669' },
  { id: 'orange', from: '#fb923c', to: '#ea580c' },
  { id: 'pink',   from: '#f472b6', to: '#db2777' },
  { id: 'teal',   from: '#2dd4bf', to: '#0891b2' },
];

export default function SettingsPanel() {
  const { settings, updateSettings } = useChordStore();
  const accent = ACCENT_COLORS[settings.accentColor];
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
      <header className="flex-none pt-6 pb-1 app-bg" style={{ paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 24px)', paddingRight: 'calc(env(safe-area-inset-right, 0px) + 24px)' }}>
        <h1 style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <ChordexLogo />
          {t.appName}
        </h1>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 20px)', paddingRight: 'calc(env(safe-area-inset-right, 0px) + 20px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
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
                  background: isActive ? `${accent.to}15` : 'transparent',
                  borderBottom: '1px solid rgba(72,72,72,0.07)',
                  transition: 'background-color 200ms ease',
                }}
                onClick={() => updateSettings({ tuning: tun.value })}
              >
                <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 'var(--font-base)' }}>{tun.label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 'var(--font-sm)' }}>{tun.value}</p>
                  {isActive && (
                    <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: '18px' }}>check</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── APPEARANCE ── */}
        <SectionHeader icon="palette" title={t.settings.sections.appearance} />

        {/* Theme Mode */}
        <div style={{ ...cardStyle, marginBottom: '10px' }}>
          <div style={{ padding: 'var(--density-pad) var(--density-pad) 16px' }}>
            <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 'var(--density-card-gap)' }}>{t.settings.rows.theme}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {([
                { value: 'system', label: t.settings.rows.themeSystem, icon: 'brightness_auto' },
                { value: 'light',  label: t.settings.rows.themeLight, icon: 'light_mode'      },
                { value: 'dark',   label: t.settings.rows.themeDark,  icon: 'dark_mode'       },
              ] as { value: import('../store/useChordStore').Theme; label: string; icon: string }[]).map(opt => {
                const isActive = settings.theme === opt.value;
                return (
                  <button key={opt.value} onClick={() => updateSettings({ theme: opt.value })} className="btn-smooth"
                    style={{ padding: '12px 6px', borderRadius: '12px', background: isActive ? `${accent.from}22` : 'var(--app-surface-high)', border: `1.5px solid ${isActive ? accent.from + '66' : 'transparent'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'background 200ms ease, border-color 200ms ease' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: isActive ? accent.from : 'var(--c-text-secondary)', fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0", transition: 'color 200ms ease' }}>{opt.icon}</span>
                    <p style={{ color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', transition: 'color 200ms ease' }}>{opt.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* AMOLED Mode hero */}
        {(() => {
          const isLightMode = settings.theme === 'light';
          return (
            <div
              style={{
                ...cardStyle,
                marginBottom: '10px',
                background: settings.amoledMode ? 'rgba(6,6,6,0.97)' : 'var(--app-surface)',
                border: settings.amoledMode ? '1px solid rgba(50,50,50,0.4)' : '1px solid transparent',
                transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1), border-color 700ms ease, opacity 300ms ease',
                opacity: isLightMode ? 0.38 : 1,
                pointerEvents: isLightMode ? 'none' : 'auto',
              }}
            >
              <div style={{ padding: 'var(--density-row-pad)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: settings.amoledMode ? '#030303' : 'var(--app-surface-high)',
                      border: settings.amoledMode ? '1px solid #2a2a2a' : 'none',
                      transition: 'background-color 300ms ease',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: settings.amoledMode ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', fontSize: '20px' }}>dark_mode</span>
                  </div>
                  <div>
                    <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-base)' }}>{t.settings.rows.amoledMode}</p>
                    <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 'var(--font-sm)', marginTop: '2px' }}>{t.settings.rows.amoledModeDesc}</p>
                  </div>
                </div>
                <Toggle value={settings.amoledMode} onChange={v => updateSettings({ amoledMode: v })} accentFrom={accent.from} accentTo={accent.to} />
              </div>
            </div>
          );
        })()}

        {/* Accent Color */}
        <div style={cardStyle}>
          <div style={{ padding: 'var(--density-pad) var(--density-pad) 16px' }}>
            <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 'var(--density-card-gap)' }}>{t.settings.rows.accentColor}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--density-card-gap)' }}>
              {COLOR_OPTIONS.map(c => {
                const isActive = settings.accentColor === c.id;
                return (
                  <button
                    key={c.id}
                    data-testid={`accent-${c.id}`}
                    onClick={() => updateSettings({ accentColor: c.id })}
                    className="btn-smooth"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: isActive ? `${c.to}22` : 'var(--app-surface-high)',
                      border: `1.5px solid ${isActive ? c.to + '66' : 'transparent'}`,
                      transition: 'background-color 200ms ease, border-color 200ms ease',
                    }}
                  >
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${c.from}, ${c.to})`,
                        flexShrink: 0,
                        boxShadow: isActive ? `0 0 8px ${c.to}55` : 'none',
                        transition: 'box-shadow 200ms ease',
                        display: 'block',
                      }}
                    />
                    <span style={{ color: isActive ? '#e7e5e4' : '#acabaa', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', transition: 'color 200ms ease' }}>{t.settings.colors[c.id]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── ANIMATIONS ── */}
        <SectionHeader icon="animation" title={t.settings.sections.animations} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.animSpeed} desc={t.settings.rows.animSpeedDesc}>
            <SegmentedControl<AnimationSpeed>
              value={settings.animationSpeed}
              options={[{ value: 'fast', label: t.settings.rows.fast }, { value: 'normal', label: t.settings.rows.normal }, { value: 'reduced', label: t.settings.rows.off }]}
              onChange={v => updateSettings({ animationSpeed: v })}
              accentFrom={accent.from}
              accentTo={accent.to}
            />
          </SettingRow>
        </div>

        {/* ── DISPLAY ── */}
        <SectionHeader icon="dashboard" title={t.settings.sections.display} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.density} desc={t.settings.rows.densityDesc}>
            <SegmentedControl<DisplayDensity>
              value={settings.displayDensity}
              options={[{ value: 'compact', label: t.settings.rows.compact }, { value: 'comfortable', label: t.settings.rows.normal }, { value: 'spacious', label: t.settings.rows.airy }]}
              onChange={v => updateSettings({ displayDensity: v })}
              accentFrom={accent.from}
              accentTo={accent.to}
            />
          </SettingRow>
          <SettingRow label={t.settings.rows.fontSize} desc={t.settings.rows.fontSizeDesc}>
            <SegmentedControl<'small' | 'medium' | 'large'>
              value={settings.fontSize}
              options={[{ value: 'small', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'large', label: 'L' }]}
              onChange={v => updateSettings({ fontSize: v })}
              accentFrom={accent.from}
              accentTo={accent.to}
            />
          </SettingRow>
          <SettingRow label={t.settings.rows.chordColors} desc={t.settings.rows.chordColorsDesc}>
            <Toggle value={settings.showChordQualityColors} onChange={v => updateSettings({ showChordQualityColors: v })} accentFrom={accent.from} accentTo={accent.to} />
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
                          border: active ? `2px solid ${accent.from}` : '2px solid transparent',
                          background: active
                            ? `linear-gradient(135deg, ${accent.from}22, ${accent.to}18)`
                            : 'var(--app-surface-low)',
                          color: active ? accent.from : 'var(--c-text-secondary)',
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

        {/* ── CHORD DIAGRAM ── */}
        <SectionHeader icon="schema" title={t.settings.sections.chordDiagram} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.leftHanded} desc={t.settings.rows.leftHandedDesc}>
            <Toggle value={settings.leftHanded} onChange={v => updateSettings({ leftHanded: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.fretNumbers} desc={t.settings.rows.fretNumbersDesc}>
            <Toggle value={settings.showFretNumbers} onChange={v => updateSettings({ showFretNumbers: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.fingerNumbers} desc={t.settings.rows.fingerNumbersDesc}>
            <Toggle value={settings.showFingerNumbers} onChange={v => updateSettings({ showFingerNumbers: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.noteNames} desc={t.settings.rows.noteNamesDesc}>
            <Toggle value={settings.showNoteNames} onChange={v => updateSettings({ showNoteNames: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.intervalLabels} desc={t.settings.rows.intervalLabelsDesc}>
            <Toggle value={settings.showIntervals} onChange={v => updateSettings({ showIntervals: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.openStringMarkers} desc={t.settings.rows.openStringMarkersDesc}>
            <Toggle value={settings.showOpenStrings} onChange={v => updateSettings({ showOpenStrings: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
        </div>

        {/* ── INTELLIGENCE ── */}
        <SectionHeader icon="psychology" title={t.settings.sections.intelligence} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.chordAssistant} desc={t.settings.rows.chordAssistantDesc}>
            <Toggle value={settings.chordAssistant} onChange={v => updateSettings({ chordAssistant: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          {settings.chordAssistant && (
            <div style={{ borderTop: '1px solid rgba(72,72,72,0.1)', paddingTop: '4px', marginTop: '4px' }}>
              <SettingRow label={t.settings.rows.smartSuggestions} desc={t.settings.rows.smartSuggestionsDesc} indent>
                <Toggle value={settings.assistantSmartSuggestions} onChange={v => updateSettings({ assistantSmartSuggestions: v })} accentFrom={accent.from} accentTo={accent.to} />
              </SettingRow>
              <SettingRow label={t.settings.rows.progressionTips} desc={t.settings.rows.progressionTipsDesc} indent>
                <Toggle value={settings.assistantProgressionTips} onChange={v => updateSettings({ assistantProgressionTips: v })} accentFrom={accent.from} accentTo={accent.to} />
              </SettingRow>
              <SettingRow label={t.settings.rows.conflictDetection} desc={t.settings.rows.conflictDetectionDesc} indent>
                <Toggle value={settings.assistantConflictDetection} onChange={v => updateSettings({ assistantConflictDetection: v })} accentFrom={accent.from} accentTo={accent.to} />
              </SettingRow>
              <SettingRow label={t.settings.rows.learningMode} desc={t.settings.rows.learningModeDesc} indent>
                <Toggle value={settings.assistantLearning} onChange={v => updateSettings({ assistantLearning: v })} accentFrom={accent.from} accentTo={accent.to} />
              </SettingRow>
            </div>
          )}
        </div>

        {/* ── FEEDBACK ── */}
        <SectionHeader icon="vibration" title={t.settings.sections.feedback} />
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.haptic} desc={t.settings.rows.hapticDesc}>
            <Toggle value={settings.hapticFeedback} onChange={v => updateSettings({ hapticFeedback: v })} accentFrom={accent.from} accentTo={accent.to} />
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
              accentFrom={accent.from}
              accentTo={accent.to}
            />
          </SettingRow>
        </div>

        {/* Spacer — pushes About to the very bottom */}
        <div style={{ flex: 1, minHeight: '32px' }} />

        {/* ── ABOUT ── */}
        <SectionHeader icon="info" title={t.settings.sections.about} />
        <div style={cardStyle}>
          <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: t.settings.about.version,       value: '2.0.0' },
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
          <div style={{ width: '32px', height: '2px', borderRadius: '9999px', background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`, marginBottom: '4px' }} />
          <p style={{ color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
            {t.settings.about.footer}
          </p>
        </div>
        </div>{/* end flex column */}
      </div>
    </div>
  );
}

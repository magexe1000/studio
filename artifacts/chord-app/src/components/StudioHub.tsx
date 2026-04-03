import React, { useState, useRef, useEffect } from 'react';
import { useChordStore, ACCENT_COLORS, type Theme, type AnimationSpeed, type DisplayDensity, type ActivePanel } from '../store/useChordStore';
import { StudioLogo, ChordexLogo, DrumexLogo } from './ChordexLogo';
import { useNavHidden, useScrollHide } from '../lib/navScroll';
import { useT } from '../lib/useT';
import { Toggle, SectionHeader, SettingRow, SegmentedControl, COLOR_OPTIONS } from './SettingControls';
import { IconSongs, IconLibrary, IconChords, IconSettings } from './BottomNav';

type HubTab = 'home' | 'settings';
type TargetApp = 'chords' | 'drums';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark',   label: 'Dark' },
  { value: 'light',  label: 'Light' },
  { value: 'system', label: 'Auto' },
];

// ── Greeting helper ────────────────────────────────────────────────────────────
function getGreeting(name?: string): string {
  const h = new Date().getHours();
  const timeWord = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';

  // Rotate through a small pool keyed to the current day so it changes daily
  const day = Math.floor(Date.now() / 86_400_000);

  if (name?.trim()) {
    const n = name.trim();
    const pool = [
      `Good ${timeWord}, ${n}.`,
      `Welcome back, ${n}.`,
      `Ready to create, ${n}.`,
      `Good to see you, ${n}.`,
    ];
    return pool[day % pool.length];
  }

  const pool = [
    `Good ${timeWord}.`,
    'Welcome back.',
    'Ready to create.',
    'Let\'s make music.',
    'Good to have you here.',
  ];
  return pool[day % pool.length];
}

export default function StudioHub() {
  const { settings, updateSettings } = useChordStore();
  const accent = ACCENT_COLORS[settings.accentColor];

  const [tab, setTab]     = useState<HubTab>('home');
  const [zooming, setZooming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);

  const launchApp = (appMode: 'chords' | 'drums') => {
    setZooming(true);
    setTimeout(() => {
      updateSettings({ appMode });
    }, 380);
  };

  const greeting = getGreeting(settings.hubUserName);

  return (
    <div style={{
      position: 'relative',
      height: '100dvh',
      overflow: 'hidden',
      background: 'var(--app-bg)',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top)',
      fontFamily: 'Manrope, sans-serif',
      transform: zooming ? 'scale(1.10)' : 'scale(1)',
      opacity: zooming ? 0 : 1,
      transition: zooming
        ? 'transform 380ms cubic-bezier(0.4,0,1,1), opacity 280ms ease-in, background-color 700ms cubic-bezier(0.4,0,0.2,1)'
        : 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
    }}>

      {/* ── Main scrollable content ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* ── HOME TAB ── */}
        {tab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>

            {/* Logo area */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: 'clamp(48px, 10vh, 80px)',
              animation: 'hub-drop-in 500ms cubic-bezier(0.34,1.15,0.64,1) both',
            }}>
              <div style={{ color: 'white' }}>
                <StudioLogo size={56} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: '10px 0 0', letterSpacing: '-0.03em', lineHeight: 1 }}>
                Studio
              </p>
              <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '5px 0 0', letterSpacing: '0.05em', fontWeight: 500 }}>
                by Chordex
              </p>
            </div>

            {/* Combined welcome + apps card */}
            <div style={{
              width: '100%', maxWidth: 380,
              marginTop: 'clamp(28px, 6vh, 48px)',
              background: 'var(--app-surface)',
              borderRadius: 24,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.05)',
              animation: 'hub-rise-in 500ms 80ms cubic-bezier(0.34,1.15,0.64,1) both',
              transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
            }}>
              {/* Welcome header */}
              <div style={{ padding: '22px 22px 18px' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  {greeting}
                </p>
                <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', margin: '5px 0 0', fontWeight: 500 }}>
                  What are we picking today?
                </p>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(128,128,128,0.1)', margin: '0 16px' }} />

              {/* App rows */}
              {([
                { app: 'chords' as TargetApp, Logo: ChordexLogo, name: 'Chordex', desc: 'Chord library & songs' },
                { app: 'drums'  as TargetApp, Logo: DrumexLogo,  name: 'Drumex',  desc: 'Drum sheet editor'    },
              ]).map(({ app, Logo, name, desc }, i, arr) => (
                <AppRow
                  key={app}
                  Logo={Logo}
                  name={name}
                  desc={desc}
                  last={i === arr.length - 1}
                  onClick={() => launchApp(app)}
                />
              ))}
            </div>

          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <HubSettings accent={accent} />
        )}
      </div>

      {/* ── Bottom nav ── */}
      <HubNav tab={tab} setTab={setTab} accent={accent} />
    </div>
  );
}

// ── App row (list item inside the combined card) ───────────────────────────────
function AppRow({
  Logo, name, desc, last, onClick,
}: {
  Logo: React.FC<{ size: number }>;
  name: string;
  desc: string;
  last: boolean;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', padding: '13px 18px',
        background: pressed ? 'rgba(128,128,128,0.07)' : 'transparent',
        border: 'none',
        borderBottom: last ? 'none' : '1px solid rgba(128,128,128,0.08)',
        cursor: 'pointer', textAlign: 'left',
        transform: pressed ? 'scale(0.985)' : 'scale(1)',
        transition: 'background 100ms ease, transform 120ms cubic-bezier(0.34,1.15,0.64,1)',
        boxSizing: 'border-box',
      }}
    >
      {/* Icon pill */}
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: 'rgba(128,128,128,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--c-text-primary)',
      }}>
        <Logo size={22} />
      </div>

      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
          {name}
        </p>
        <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '2px 0 0', fontWeight: 500 }}>
          {desc}
        </p>
      </div>

      {/* Chevron */}
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', flexShrink: 0, opacity: 0.5 }}>
        chevron_right
      </span>
    </button>
  );
}

// ── Hub settings ──────────────────────────────────────────────────────────────
function HubSettings({ accent }: { accent: { from: string; to: string; mid: string } }) {
  const { settings, updateSettings } = useChordStore();
  const t = useT();
  const [name, setName] = useState(settings.hubUserName ?? '');

  const cardStyle: React.CSSProperties = {
    background: 'var(--app-surface)',
    borderRadius: '1.5rem',
    overflow: 'hidden',
    transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)',
    letterSpacing: '0.18em', textTransform: 'uppercase',
    margin: '24px 0 8px 4px',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '15px 18px',
    borderBottom: '1px solid rgba(128,128,128,0.07)',
  };

  return (
    <div style={{ padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>

      {/* Page title */}
      <div style={{ paddingTop: 32, paddingBottom: 8 }}>
        <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.03em' }}>Settings</p>
        <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '5px 0 0', fontWeight: 500 }}>Studio preferences</p>
      </div>

      {/* ── Account ── */}
      <p style={sectionLabel}>Account</p>
      <div style={cardStyle}>
        <div style={rowStyle}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>Login</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>Sync across devices</p>
          </div>
          <div style={{
            padding: '7px 14px', borderRadius: 9999,
            background: 'rgba(128,128,128,0.1)',
            border: '1px solid rgba(128,128,128,0.15)',
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-secondary)', margin: 0, whiteSpace: 'nowrap' }}>Coming soon</p>
          </div>
        </div>
      </div>

      {/* ── Profile ── */}
      <p style={sectionLabel}>Profile</p>
      <div style={cardStyle}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid rgba(128,128,128,0.07)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-secondary)', margin: '0 0 8px' }}>Your name</p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => updateSettings({ hubUserName: name })}
            placeholder="Add your name for a greeting"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(128,128,128,0.08)',
              border: `1px solid rgba(128,128,128,0.15)`,
              borderRadius: 12, padding: '11px 14px',
              fontSize: 14, fontWeight: 500,
              color: 'var(--c-text-primary)',
              fontFamily: 'Manrope',
              outline: 'none',
              transition: 'border-color 200ms ease',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = accent.from; }}
            onBlurCapture={e => { e.currentTarget.style.borderColor = 'rgba(128,128,128,0.15)'; updateSettings({ hubUserName: name }); }}
          />
        </div>
      </div>

      {/* ── APPEARANCE ── */}
      <SectionHeader icon="palette" title={t.settings.sections.appearance} />

      {/* Theme Mode */}
      <div style={{ ...cardStyle, marginBottom: '10px' }}>
        <div style={{ padding: 'var(--density-pad) var(--density-pad) 16px' }}>
          <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 'var(--density-card-gap)' }}>{t.settings.rows.theme}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
            {([
              { value: 'system', label: t.settings.rows.themeSystem, icon: 'brightness_auto' },
              { value: 'light',  label: t.settings.rows.themeLight,  icon: 'light_mode'      },
              { value: 'dark',   label: t.settings.rows.themeDark,   icon: 'dark_mode'       },
            ] as { value: Theme; label: string; icon: string }[]).map(opt => {
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

      {/* AMOLED Mode */}
      {(() => {
        const isLightMode = settings.theme === 'light';
        return (
          <div style={{
            ...cardStyle,
            marginBottom: '10px',
            background: settings.amoledMode ? 'rgba(6,6,6,0.97)' : 'var(--app-surface)',
            border: settings.amoledMode ? '1px solid rgba(50,50,50,0.4)' : '1px solid transparent',
            transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1), border-color 700ms ease, opacity 300ms ease',
            opacity: isLightMode ? 0.38 : 1,
            pointerEvents: isLightMode ? 'none' : undefined,
          }}>
            <div style={{ padding: 'var(--density-row-pad)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: settings.amoledMode ? '#030303' : 'var(--app-surface-high)',
                  border: settings.amoledMode ? '1px solid #2a2a2a' : 'none',
                  transition: 'background-color 300ms ease',
                }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--density-card-gap)' }}>
            {COLOR_OPTIONS.map(c => {
              const isActive = settings.accentColor === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => updateSettings({ accentColor: c.id })}
                  className="btn-smooth"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', borderRadius: '12px',
                    background: isActive ? `${c.to}22` : 'var(--app-surface-high)',
                    border: `1.5px solid ${isActive ? c.to + '66' : 'transparent'}`,
                    transition: 'background-color 200ms ease, border-color 200ms ease',
                  }}
                >
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${c.from}, ${c.to})`,
                    flexShrink: 0,
                    boxShadow: isActive ? `0 0 8px ${c.to}55` : 'none',
                    transition: 'box-shadow 200ms ease',
                    display: 'block',
                  }} />
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
        <SettingRow label={t.settings.rows.startupApp} desc={t.settings.rows.startupAppDesc}>
          {(() => {
            const cur = settings.startupApp ?? 'chords';
            const opts: { value: 'chords' | 'drums'; label: string }[] = [
              { value: 'chords', label: t.settings.rows.startupAppChords },
              { value: 'drums',  label: t.settings.rows.startupAppDrums  },
            ];
            return (
              <div style={{ display: 'flex', gap: '6px' }}>
                {opts.map(({ value, label }) => {
                  const active = cur === value;
                  return (
                    <button
                      key={value}
                      onClick={() => updateSettings({ startupApp: value })}
                      style={{
                        height: '40px', padding: '0 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        borderRadius: '10px',
                        border: active ? `2px solid ${accent.from}` : '2px solid transparent',
                        background: active ? `linear-gradient(135deg, ${accent.from}22, ${accent.to}18)` : 'var(--app-surface-low)',
                        color: active ? accent.from : 'var(--c-text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                        flexShrink: 0,
                      }}
                    >
                      {value === 'chords' ? <ChordexLogo size={14} /> : <DrumexLogo size={14} />}
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
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
                        background: active ? `linear-gradient(135deg, ${accent.from}22, ${accent.to}18)` : 'var(--app-surface-low)',
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

    </div>
  );
}

// ── Floating bottom nav (matches Chordex/Drumex style) ───────────────────────
const HUB_NAV_ITEMS: { id: HubTab; icon: string; label: string }[] = [
  { id: 'home',     icon: 'home',     label: 'Home'     },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];

function HubNav({ tab, setTab, accent }: {
  tab: HubTab;
  setTab: (t: HubTab) => void;
  accent: { from: string; to: string; mid: string };
}) {
  const { settings } = useChordStore();
  const navRef   = useRef<HTMLElement | null>(null);
  const btnRefs  = useRef<(HTMLButtonElement | null)[]>([]);
  const prevIdx  = useRef(HUB_NAV_ITEMS.findIndex(i => i.id === tab));
  const stretchT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navHidden = useNavHidden();

  const [pill, setPill]       = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const [pressed, setPressed] = useState<HubTab | null>(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => { const t = setTimeout(() => setEntered(true), 40); return () => clearTimeout(t); }, []);

  const measureBtn = (idx: number) => {
    const btn = btnRefs.current[idx];
    const nav = navRef.current;
    if (!btn || !nav) return null;
    const nr = nav.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return { left: br.left - nr.left, right: br.right - nr.left };
  };

  useEffect(() => {
    const m = measureBtn(HUB_NAV_ITEMS.findIndex(i => i.id === tab));
    if (m) setPill({ left: m.left, right: m.right, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const newIdx = HUB_NAV_ITEMS.findIndex(i => i.id === tab);
    const oldIdx = prevIdx.current;
    if (newIdx === oldIdx) return;
    prevIdx.current = newIdx;
    const newM = measureBtn(newIdx);
    if (!newM) return;
    if (stretchT.current) { clearTimeout(stretchT.current); stretchT.current = null; setPill(p => ({ ...p, left: newM.left, right: newM.right })); return; }
    if (newIdx > oldIdx) {
      setPill(p => ({ ...p, right: newM.right }));
      stretchT.current = setTimeout(() => { setPill(p => ({ ...p, left: newM.left })); stretchT.current = null; }, 70);
    } else {
      setPill(p => ({ ...p, left: newM.left }));
      stretchT.current = setTimeout(() => { setPill(p => ({ ...p, right: newM.right })); stretchT.current = null; }, 70);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const isLight = settings.theme === 'light' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const bg = settings.amoledMode ? 'rgba(4,4,4,0.88)' : isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)';

  return (
    <nav
      ref={navRef}
      style={{
        position: 'fixed',
        bottom: 'max(10px, env(safe-area-inset-bottom))',
        left: '50%',
        width: '90%', maxWidth: '448px',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '6px 8px',
        borderRadius: '2rem',
        border: `1px solid ${isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.10)'}`,
        background: bg,
        boxShadow: isLight
          ? '0 8px 32px rgba(0,0,0,0.14), 0 1.5px 0 rgba(255,255,255,0.80) inset'
          : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
        zIndex: 50,
        overflow: 'hidden',
        transform: (navHidden && entered)
          ? 'translateX(-50%) translateY(calc(100% + 32px))'
          : entered
            ? 'translateX(-50%)'
            : 'translateX(-50%) translateY(24px)',
        opacity: entered ? 1 : 0,
        transition: 'transform 420ms cubic-bezier(0.4,0,0.2,1), opacity 400ms cubic-bezier(0.34,1.15,0.64,1), background-color 700ms cubic-bezier(0.4,0,0.2,1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Sliding pill */}
      {pill.ready && (
        <div aria-hidden style={{
          position: 'absolute', top: 4,
          left: pill.left, width: pill.right - pill.left,
          height: 'calc(100% - 8px)',
          borderRadius: '9999px',
          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
          boxShadow: `0 2px 18px ${accent.to}60`,
          pointerEvents: 'none', zIndex: 0,
          transition: 'left 150ms cubic-bezier(0.34,1.56,0.64,1), width 150ms cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      )}

      {HUB_NAV_ITEMS.map(({ id, icon, label }, i) => {
        const active = tab === id;
        const isPressed = pressed === id;
        return (
          <button
            key={id}
            ref={el => { btnRefs.current[i] = el; }}
            onPointerDown={() => setPressed(id)}
            onPointerUp={() => { setPressed(null); setTab(id); }}
            onPointerLeave={() => setPressed(null)}
            onPointerCancel={() => setPressed(null)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '8px 4px', borderRadius: '9999px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: active ? '#fff' : 'var(--c-text-secondary)',
              position: 'relative', zIndex: 1,
              transform: isPressed ? 'scale(0.91)' : 'scale(1)',
              transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 22,
                fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                transition: 'font-variation-settings 200ms ease',
              }}
            >
              {icon}
            </span>
            <span style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 700,
              fontSize: '9.5px', letterSpacing: '0.08em',
              textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

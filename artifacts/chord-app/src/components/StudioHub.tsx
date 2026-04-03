import { useState } from 'react';
import { useChordStore, ACCENT_COLORS, type AccentColor, type Theme } from '../store/useChordStore';
import { StudioLogo, ChordexLogo, DrumexLogo } from './ChordexLogo';

type HubTab = 'home' | 'settings';
type TargetApp = 'chords' | 'drums';

const COLOR_OPTIONS: { id: AccentColor; from: string; to: string }[] = [
  { id: 'blue',   from: '#679cff', to: '#007aff' },
  { id: 'purple', from: '#b57bee', to: '#7c3aed' },
  { id: 'green',  from: '#34d399', to: '#059669' },
  { id: 'orange', from: '#fb923c', to: '#ea580c' },
  { id: 'pink',   from: '#f472b6', to: '#db2777' },
  { id: 'teal',   from: '#2dd4bf', to: '#0891b2' },
];

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark',   label: 'Dark' },
  { value: 'light',  label: 'Light' },
  { value: 'system', label: 'Auto' },
];

export default function StudioHub() {
  const { settings, updateSettings } = useChordStore();
  const accent = ACCENT_COLORS[settings.accentColor];

  const [tab, setTab]         = useState<HubTab>('home');
  const [popup, setPopup]     = useState<TargetApp | null>(null);
  const [popupIn, setPopupIn] = useState(false);

  const openPopup = (app: TargetApp) => {
    setPopup(app);
    requestAnimationFrame(() => requestAnimationFrame(() => setPopupIn(true)));
  };

  const closePopup = () => {
    setPopupIn(false);
    setTimeout(() => setPopup(null), 320);
  };

  const launch = (appMode: 'chords' | 'drums', startupApp: 'chords' | 'drums' | 'hub') => {
    closePopup();
    setTimeout(() => {
      updateSettings({ appMode, startupApp });
    }, 360);
  };

  const greeting = settings.hubUserName?.trim()
    ? `Hi, ${settings.hubUserName.trim()}!`
    : 'Welcome!';

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
      transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
    }}>

      {/* ── Main scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* ── HOME TAB ── */}
        {tab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>

            {/* Logo area */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: 'clamp(48px, 10vh, 80px)',
              animation: 'hub-drop-in 500ms cubic-bezier(0.34,1.15,0.64,1) both',
            }}>
              <div style={{ color: `var(--accent-from)` }}>
                <StudioLogo size={56} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: '10px 0 0', letterSpacing: '-0.03em', lineHeight: 1 }}>
                Studio
              </p>
              <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '5px 0 0', letterSpacing: '0.05em', fontWeight: 500 }}>
                by Chordex
              </p>
            </div>

            {/* Welcome card */}
            <div style={{
              width: '100%', maxWidth: 380,
              marginTop: 'clamp(28px, 6vh, 48px)',
              background: 'var(--app-surface)',
              borderRadius: 24,
              padding: '22px 26px',
              border: '1px solid rgba(255,255,255,0.05)',
              animation: 'hub-rise-in 500ms 80ms cubic-bezier(0.34,1.15,0.64,1) both',
              transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
            }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                {greeting}
              </p>
              <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', margin: '6px 0 0', fontWeight: 500 }}>
                What are we picking today?
              </p>
            </div>

            {/* App cards */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 14, width: '100%', maxWidth: 380,
              marginTop: 16,
            }}>
              {([
                {
                  app: 'chords' as TargetApp,
                  Logo: ChordexLogo,
                  name: 'Chordex',
                  desc: 'Chord library & songs',
                  delay: 160,
                },
                {
                  app: 'drums' as TargetApp,
                  Logo: DrumexLogo,
                  name: 'Drumex',
                  desc: 'Drum sheet editor',
                  delay: 240,
                },
              ]).map(({ app, Logo, name, desc, delay }) => (
                <AppCard
                  key={app}
                  delay={delay}
                  accentFrom={accent.from}
                  accentTo={accent.to}
                  onClick={() => openPopup(app)}
                >
                  <div style={{ color: 'var(--c-text-primary)' }}>
                    <Logo size={34} />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text-primary)', margin: '12px 0 0', letterSpacing: '-0.02em' }}>
                    {name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--c-text-secondary)', margin: '4px 0 0', fontWeight: 500, lineHeight: 1.3 }}>
                    {desc}
                  </p>
                </AppCard>
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

      {/* ── Popup sheet ── */}
      {popup !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'flex-end',
        }}>
          {/* Backdrop */}
          <div
            onClick={closePopup}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              opacity: popupIn ? 1 : 0,
              transition: 'opacity 300ms cubic-bezier(0.4,0,0.2,1)',
            }}
          />
          {/* Sheet */}
          <div style={{
            position: 'relative', zIndex: 1,
            width: '100%',
            background: 'var(--app-surface)',
            borderRadius: '28px 28px 0 0',
            padding: '8px 20px calc(max(24px, env(safe-area-inset-bottom)) + 24px)',
            transform: popupIn ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 320ms cubic-bezier(0.34,1.15,0.64,1)',
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: 'rgba(128,128,128,0.25)', borderRadius: 9999, margin: '10px auto 28px' }} />

            <p style={{ fontSize: 19, fontWeight: 800, color: 'var(--c-text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              Open in…
            </p>
            <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '0 0 24px', fontWeight: 500 }}>
              Choose where you'd like to use Studio
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PopupOption
                icon="music_note"
                label="Chordex only"
                desc="Start directly in the chord library"
                accentFrom={accent.from}
                accentTo={accent.to}
                onClick={() => launch('chords', 'chords')}
              />
              <PopupOption
                icon="drum"
                label="Drumex only"
                desc="Start directly in the drum editor"
                accentFrom={accent.from}
                accentTo={accent.to}
                onClick={() => launch('drums', 'drums')}
              />
              <PopupOption
                icon="apps"
                label="Everywhere"
                desc="Use both — keep this hub as home"
                accentFrom={accent.from}
                accentTo={accent.to}
                primary
                onClick={() => launch(popup, 'hub')}
              />
            </div>

            <button
              onClick={closePopup}
              style={{
                marginTop: 16, width: '100%', padding: '14px',
                background: 'transparent',
                border: '1px solid rgba(128,128,128,0.15)',
                borderRadius: 16, color: 'var(--c-text-secondary)',
                fontSize: 14, fontWeight: 600, fontFamily: 'Manrope',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── App card ──────────────────────────────────────────────────────────────────
function AppCard({
  children, delay, accentFrom, onClick,
}: {
  children: React.ReactNode;
  delay: number;
  accentFrom: string;
  accentTo: string;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '22px 20px',
        background: 'var(--app-surface)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer', textAlign: 'left',
        animation: `hub-rise-in 500ms ${delay}ms cubic-bezier(0.34,1.15,0.64,1) both`,
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        transition: `transform 120ms cubic-bezier(0.34,1.15,0.64,1), background-color 700ms cubic-bezier(0.4,0,0.2,1)`,
        boxShadow: pressed ? `0 0 0 2px ${accentFrom}55` : 'none',
      }}
    >
      {children}
    </button>
  );
}

// ── Popup option row ──────────────────────────────────────────────────────────
function PopupOption({
  icon, label, desc, accentFrom, accentTo, primary, onClick,
}: {
  icon: string;
  label: string;
  desc: string;
  accentFrom: string;
  accentTo: string;
  primary?: boolean;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 18px',
        background: primary
          ? `linear-gradient(135deg, ${accentFrom}22, ${accentTo}22)`
          : 'rgba(128,128,128,0.08)',
        border: primary ? `1px solid ${accentFrom}44` : '1px solid transparent',
        borderRadius: 18,
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transform: pressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 120ms cubic-bezier(0.34,1.15,0.64,1)',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: primary ? `linear-gradient(135deg, ${accentFrom}, ${accentTo})` : 'rgba(128,128,128,0.12)',
      }}>
        <span className="material-symbols-outlined" style={{
          fontSize: 20,
          color: primary ? 'white' : 'var(--c-text-secondary)',
        }}>{icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0, fontFamily: 'Manrope', letterSpacing: '-0.01em' }}>
          {label}
        </p>
        <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '2px 0 0', fontWeight: 500 }}>
          {desc}
        </p>
      </div>
    </button>
  );
}

// ── Hub settings ──────────────────────────────────────────────────────────────
function HubSettings({ accent }: { accent: { from: string; to: string; mid: string } }) {
  const { settings, updateSettings } = useChordStore();
  const [name, setName] = useState(settings.hubUserName ?? '');

  const cardStyle: React.CSSProperties = {
    background: 'var(--app-surface)',
    borderRadius: 24,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.03)',
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

      {/* ── Appearance ── */}
      <p style={sectionLabel}>Appearance</p>
      <div style={cardStyle}>
        {/* Theme */}
        <div style={rowStyle}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>Theme</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>App colour scheme</p>
          </div>
          <div style={{
            display: 'flex', gap: 2, background: 'rgba(128,128,128,0.1)',
            borderRadius: 9999, padding: 2,
          }}>
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateSettings({ theme: opt.value })}
                style={{
                  padding: '5px 13px', borderRadius: 9999,
                  background: settings.theme === opt.value
                    ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                    : 'transparent',
                  color: settings.theme === opt.value ? 'white' : 'var(--c-text-secondary)',
                  fontSize: 11, fontWeight: 700, fontFamily: 'Manrope',
                  cursor: 'pointer', border: 'none',
                  transition: 'background 250ms ease, color 250ms ease',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accent colour */}
        <div style={{ ...rowStyle, borderBottom: 'none', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>Accent colour</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>Navigation bar & highlights</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLOR_OPTIONS.map(col => (
              <button
                key={col.id}
                onClick={() => updateSettings({ accentColor: col.id })}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${col.from}, ${col.to})`,
                  border: settings.accentColor === col.id
                    ? `2px solid ${col.from}`
                    : '2px solid transparent',
                  outline: settings.accentColor === col.id
                    ? `2px solid rgba(255,255,255,0.6)`
                    : 'none',
                  outlineOffset: '1px',
                  cursor: 'pointer',
                  transition: 'transform 150ms ease, outline 150ms ease',
                  transform: settings.accentColor === col.id ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Display ── */}
      <p style={sectionLabel}>Display</p>
      <div style={cardStyle}>
        {/* AMOLED */}
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>AMOLED Black</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>True black background</p>
          </div>
          <HubToggle
            value={settings.amoledMode}
            onChange={v => updateSettings({ amoledMode: v })}
            accentFrom={accent.from}
            accentTo={accent.to}
          />
        </div>
      </div>

    </div>
  );
}

// ── Minimal toggle ────────────────────────────────────────────────────────────
function HubToggle({ value, onChange, accentFrom, accentTo }: {
  value: boolean;
  onChange: (v: boolean) => void;
  accentFrom: string;
  accentTo: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        flexShrink: 0, width: 48, height: 28, borderRadius: 9999,
        background: value ? `linear-gradient(135deg, ${accentFrom}, ${accentTo})` : 'rgba(72,72,72,0.2)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 300ms ease',
        boxShadow: value ? `0 2px 12px ${accentTo}44` : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: value ? 'calc(100% - 25px)' : 3,
        width: 22, height: 22, borderRadius: '50%',
        background: value ? 'white' : '#acabaa',
        transition: 'left 280ms cubic-bezier(0.34, 1.56, 0.64, 1), background 280ms ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        display: 'block',
      }} />
    </button>
  );
}

// ── Bottom nav ────────────────────────────────────────────────────────────────
function HubNav({ tab, setTab, accent }: {
  tab: HubTab;
  setTab: (t: HubTab) => void;
  accent: { from: string; to: string; mid: string };
}) {
  const items: { id: HubTab; icon: string; label: string }[] = [
    { id: 'home',     icon: 'home',     label: 'Home' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <div style={{
      flexShrink: 0,
      position: 'relative',
      zIndex: 100,
      background: 'var(--app-surface)',
      borderTop: '1px solid rgba(128,128,128,0.08)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      animation: 'hub-nav-in 500ms cubic-bezier(0.34,1.15,0.64,1) both',
      transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
    }}>
      <div style={{ display: 'flex', height: 64 }}>
        {items.map(item => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                background: 'transparent', border: 'none', cursor: 'pointer',
                transition: 'opacity 200ms ease',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 22,
                  color: active ? accent.from : 'var(--c-text-secondary)',
                  transition: 'color 250ms ease',
                  fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'Manrope',
                color: active ? accent.from : 'var(--c-text-secondary)',
                letterSpacing: '0.04em',
                transition: 'color 250ms ease',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

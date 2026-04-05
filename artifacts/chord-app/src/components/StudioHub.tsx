import React, { useState, useRef, useEffect } from 'react';
import { useChordStore, ACCENT_COLORS, type Theme, type AnimationSpeed, type DisplayDensity, type AppKey, type PerAppVisuals } from '../store/useChordStore';
import { StudioLogo, ChordexLogo, DrumexLogo, StageCoreLogoIcon } from './ChordexLogo';
import { useNavHidden, useScrollHide } from '../lib/navScroll';
import { useT } from '../lib/useT';
import { Toggle, SectionHeader, SettingRow, SegmentedControl, COLOR_OPTIONS } from './SettingControls';
import ApplyToSheet from './ApplyToSheet';

type HubTab = 'home' | 'settings';
type TargetApp = 'chords' | 'drums' | 'stage';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark',   label: 'Dark' },
  { value: 'light',  label: 'Light' },
  { value: 'system', label: 'Auto' },
];

type TimeWord = 'morning' | 'afternoon' | 'evening';
const TIME_WORD_ES: Record<TimeWord, string> = { morning: 'mañana', afternoon: 'tarde', evening: 'noche' };
const TIME_GREETING_ES: Record<TimeWord, string> = { morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches' };

// ── Session index — stable within one app open, advances each fresh launch ─────
// A module-level variable resets to null on every page load (fresh JS context)
// but stays stable across React re-renders, avoiding sessionStorage/PWA quirks.
const _INDEX_KEY = 'sx_idx';
let _cachedIdx: number | null = null;

function getSessionIndex(): number {
  if (_cachedIdx !== null) return _cachedIdx;
  const prev = parseInt(localStorage.getItem(_INDEX_KEY) ?? '-1', 10);
  _cachedIdx = prev + 1;
  localStorage.setItem(_INDEX_KEY, String(_cachedIdx));
  return _cachedIdx;
}

// ── Greeting pairs — greeting + subtitle are always shown together ─────────────
interface GreetingPair { greeting: string; subtitle: string }

const _NAMED_PAIRS_EN: Array<(n: string, t: string) => GreetingPair> = [
  (n, t) => ({ greeting: `Good ${t}, ${n}.`,              subtitle: 'What are we picking today?'         }),
  (n)    => ({ greeting: `Welcome back, ${n}.`,           subtitle: 'Ready to lay something down?'       }),
  (n)    => ({ greeting: `Good to see you, ${n}.`,        subtitle: "What's on the setlist today?"       }),
  (n)    => ({ greeting: `Ready to create, ${n}.`,        subtitle: 'New progressions await.'            }),
  (n)    => ({ greeting: `The studio is yours, ${n}.`,    subtitle: 'Choose your weapon.'                }),
  (n)    => ({ greeting: `Back at it, ${n}.`,             subtitle: 'Consistency builds masters.'        }),
  (n)    => ({ greeting: `Let's make something, ${n}.`,   subtitle: 'Every great song starts here.'      }),
  (n)    => ({ greeting: `Fresh session, ${n}.`,          subtitle: 'Where will today take you?'         }),
  (n)    => ({ greeting: `In the zone, ${n}.`,            subtitle: 'Time to make something great.'      }),
  (n, t) => ({ greeting: `Good ${t}, ${n}.`,              subtitle: 'Your next idea is waiting.'         }),
  (n)    => ({ greeting: `Ready to groove, ${n}.`,        subtitle: 'The rhythm is already in you.'      }),
  (n)    => ({ greeting: `Something's brewing, ${n}.`,    subtitle: 'Follow the sound.'                  }),
  (n)    => ({ greeting: `Let's create, ${n}.`,           subtitle: 'This session is yours.'             }),
  (n)    => ({ greeting: `Make it count, ${n}.`,          subtitle: 'Lay it down.'                       }),
  (n)    => ({ greeting: `Here we go, ${n}.`,             subtitle: 'Your next track starts now.'        }),
  (n)    => ({ greeting: `Pick up where you left off, ${n}.`, subtitle: 'The studio remembers.'         }),
  (n)    => ({ greeting: `What's the plan, ${n}.`,        subtitle: 'The studio is listening.'           }),
  (n)    => ({ greeting: `Time to play, ${n}.`,           subtitle: 'Ready when you are.'                }),
  (n)    => ({ greeting: `Feel the rhythm, ${n}.`,        subtitle: 'Let it flow.'                       }),
  (n)    => ({ greeting: `Let's lay it down, ${n}.`,      subtitle: 'Give it everything.'                }),
  (n)    => ({ greeting: `Hey ${n}.`,                     subtitle: 'Something great is one tap away.'   }),
  (n, t) => ({ greeting: `Good ${t}, ${n}.`,              subtitle: 'Capture it before it\'s gone.'      }),
];

const _NAMED_PAIRS_ES: Array<(n: string, t: string) => GreetingPair> = [
  (n, t) => ({ greeting: `${TIME_GREETING_ES[t as TimeWord]}, ${n}.`,  subtitle: '¿Qué tocamos hoy?'                   }),
  (n)    => ({ greeting: `De vuelta, ${n}.`,             subtitle: '¿Listo para grabar algo?'             }),
  (n)    => ({ greeting: `Qué bueno verte, ${n}.`,       subtitle: '¿Qué hay en el setlist hoy?'          }),
  (n)    => ({ greeting: `A crear, ${n}.`,               subtitle: 'Nuevas progresiones te esperan.'      }),
  (n)    => ({ greeting: `El estudio es tuyo, ${n}.`,    subtitle: 'Elige tu arma.'                       }),
  (n)    => ({ greeting: `Otra vez aquí, ${n}.`,         subtitle: 'La constancia hace al maestro.'       }),
  (n)    => ({ greeting: `Hagamos algo, ${n}.`,          subtitle: 'Toda gran canción empieza aquí.'      }),
  (n)    => ({ greeting: `Sesión nueva, ${n}.`,          subtitle: '¿A dónde te lleva hoy?'               }),
  (n)    => ({ greeting: `En la zona, ${n}.`,            subtitle: 'Es hora de hacer algo grande.'        }),
  (n, t) => ({ greeting: `${TIME_GREETING_ES[t as TimeWord]}, ${n}.`,  subtitle: 'Tu próxima idea te espera.'            }),
  (n)    => ({ greeting: `Listo para el groove, ${n}.`,  subtitle: 'El ritmo ya está en ti.'              }),
  (n)    => ({ greeting: `Algo se viene, ${n}.`,         subtitle: 'Sigue el sonido.'                     }),
  (n)    => ({ greeting: `Vamos a crear, ${n}.`,         subtitle: 'Esta sesión es tuya.'                 }),
  (n)    => ({ greeting: `Que cuente, ${n}.`,            subtitle: 'Dale con todo.'                       }),
  (n)    => ({ greeting: `Arrancamos, ${n}.`,            subtitle: 'Tu próximo track empieza ahora.'      }),
  (n)    => ({ greeting: `Retoma donde lo dejaste, ${n}.`, subtitle: 'El estudio recuerda.'               }),
  (n)    => ({ greeting: `¿Cuál es el plan, ${n}?`,      subtitle: 'El estudio escucha.'                  }),
  (n)    => ({ greeting: `A tocar, ${n}.`,               subtitle: 'Listo cuando quieras.'                }),
  (n)    => ({ greeting: `Siente el ritmo, ${n}.`,       subtitle: 'Déjalo fluir.'                        }),
  (n)    => ({ greeting: `A grabar, ${n}.`,              subtitle: 'Dale con todo.'                       }),
  (n)    => ({ greeting: `Hey ${n}.`,                    subtitle: 'Algo grande está a un toque.'         }),
  (n, t) => ({ greeting: `${TIME_GREETING_ES[t as TimeWord]}, ${n}.`,  subtitle: 'Atrápalo antes de que se vaya.'        }),
];

const _ANON_PAIRS_EN: GreetingPair[] = [
  { greeting: 'Good morning.',                 subtitle: 'What are we picking today?'          },
  { greeting: 'Welcome back.',                 subtitle: 'Ready to lay something down?'        },
  { greeting: 'The studio is open.',           subtitle: 'Choose your weapon.'                 },
  { greeting: 'Ready to create.',              subtitle: 'New progressions await.'             },
  { greeting: 'Good to have you here.',        subtitle: 'Let the music lead.'                 },
  { greeting: "Let's make music.",             subtitle: 'One chord at a time.'                },
  { greeting: 'Fresh session.',                subtitle: 'Where will today take you?'          },
  { greeting: 'Ready to groove.',              subtitle: 'The rhythm is already in you.'       },
  { greeting: 'In the zone.',                  subtitle: 'Time to make something great.'       },
  { greeting: 'Pick up where you left off.',   subtitle: 'Your next idea is waiting.'          },
  { greeting: 'The keys are waiting.',         subtitle: 'Give them something to play.'        },
  { greeting: "Something's in the air.",       subtitle: "Capture it before it's gone."        },
  { greeting: "Let's create.",                 subtitle: 'Every great song starts here.'       },
  { greeting: 'Make it count.',                subtitle: 'This session is yours.'              },
  { greeting: 'Here we go.',                   subtitle: 'Lay it down.'                        },
  { greeting: 'Good to see you.',              subtitle: "What's on the setlist today?"        },
  { greeting: "What's the plan?",              subtitle: 'The studio is listening.'            },
  { greeting: 'Back at it.',                   subtitle: 'Consistency builds masters.'         },
  { greeting: 'Time to play.',                 subtitle: 'Ready when you are.'                 },
  { greeting: 'Feel the rhythm.',              subtitle: 'Let it flow.'                        },
  { greeting: "Something's brewing.",          subtitle: 'Follow the sound.'                   },
  { greeting: "Let's lay it down.",            subtitle: 'Your next track starts now.'         },
];

const _ANON_PAIRS_ES: GreetingPair[] = [
  { greeting: 'Buenos días.',                  subtitle: '¿Qué tocamos hoy?'                  },
  { greeting: 'De vuelta.',                    subtitle: '¿Listo para grabar algo?'            },
  { greeting: 'El estudio está listo.',        subtitle: 'Elige tu arma.'                      },
  { greeting: 'A crear.',                      subtitle: 'Nuevas progresiones te esperan.'     },
  { greeting: 'Qué bueno tenerte aquí.',       subtitle: 'Que la música guíe.'                 },
  { greeting: 'Hagamos música.',               subtitle: 'Un acorde a la vez.'                 },
  { greeting: 'Sesión nueva.',                 subtitle: '¿A dónde te lleva hoy?'              },
  { greeting: 'Listo para el groove.',         subtitle: 'El ritmo ya está en ti.'             },
  { greeting: 'En la zona.',                   subtitle: 'Es hora de hacer algo grande.'       },
  { greeting: 'Retoma donde lo dejaste.',      subtitle: 'Tu próxima idea te espera.'          },
  { greeting: 'Las teclas esperan.',           subtitle: 'Dales algo que tocar.'               },
  { greeting: 'Algo se siente en el aire.',    subtitle: 'Atrápalo antes de que se vaya.'      },
  { greeting: 'Vamos a crear.',                subtitle: 'Toda gran canción empieza aquí.'     },
  { greeting: 'Que cuente.',                   subtitle: 'Esta sesión es tuya.'                },
  { greeting: 'Arrancamos.',                   subtitle: 'Dale con todo.'                      },
  { greeting: 'Qué bueno verte.',              subtitle: '¿Qué hay en el setlist?'             },
  { greeting: '¿Cuál es el plan?',             subtitle: 'El estudio escucha.'                 },
  { greeting: 'Otra vez aquí.',                subtitle: 'La constancia hace al maestro.'      },
  { greeting: 'A tocar.',                      subtitle: 'Listo cuando quieras.'               },
  { greeting: 'Siente el ritmo.',              subtitle: 'Déjalo fluir.'                       },
  { greeting: 'Algo se viene.',                subtitle: 'Sigue el sonido.'                    },
  { greeting: 'A grabar.',                     subtitle: 'Tu próximo track empieza ahora.'     },
];

function getGreetingPair(name?: string, idx?: number, lang: 'en' | 'es' = 'en'): GreetingPair {
  const h = new Date().getHours();
  const timeWord = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const i = idx ?? 0;

  if (name?.trim()) {
    const pairs = lang === 'es' ? _NAMED_PAIRS_ES : _NAMED_PAIRS_EN;
    const fn = pairs[i % pairs.length];
    return fn(name.trim(), timeWord);
  }

  const anonPairs = lang === 'es' ? _ANON_PAIRS_ES : _ANON_PAIRS_EN;
  const pair = anonPairs[i % anonPairs.length];
  if (lang === 'es') {
    return {
      ...pair,
      greeting: pair.greeting === 'Buenos días.' ? `${TIME_GREETING_ES[timeWord as TimeWord]}.` : pair.greeting,
    };
  }
  return {
    ...pair,
    greeting: pair.greeting === 'Good morning.' ? `Good ${timeWord}.` : pair.greeting,
  };
}

export default function StudioHub() {
  const { settings, updateSettings } = useChordStore();
  const t = useT();
  const lang = settings.language ?? 'en';
  const hubAccentKey = settings.perApp?.hub?.accentColor ?? settings.accentColor;
  const accent = ACCENT_COLORS[hubAccentKey];
  const isHubLight = (settings.perApp?.hub?.theme ?? settings.theme ?? 'dark') === 'light';

  const [tab, setTab]     = useState<HubTab>('home');
  const [zooming, setZooming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);

  const launchApp = (appMode: 'chords' | 'drums' | 'stage') => {
    setZooming(true);
    setTimeout(() => {
      updateSettings({ appMode });
    }, 380);
  };

  const sessionIdx = getSessionIndex();
  const { greeting, subtitle } = getGreetingPair(settings.hubUserName, sessionIdx, lang);

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
              <div style={{ color: isHubLight ? '#18181b' : 'white' }}>
                <StudioLogo size={56} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: '10px 0 0', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {t.hub.studio}
              </p>
              <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '5px 0 0', letterSpacing: '0.05em', fontWeight: 500 }}>
                {t.hub.byChordex}
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
                  {subtitle}
                </p>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(128,128,128,0.1)', margin: '0 16px' }} />

              {/* App rows */}
              {([
                { app: 'chords' as TargetApp, Logo: ChordexLogo,       name: 'Chordex',    desc: t.hub.chordexDesc       },
                { app: 'drums'  as TargetApp, Logo: DrumexLogo,        name: 'Drumex',     desc: t.hub.drumexDesc        },
                { app: 'stage'  as TargetApp, Logo: StageCoreLogoIcon, name: 'Stagex',     desc: t.hub.stagexDesc        },
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
function GlobalHint() {
  const t = useT();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      margin: '6px 4px 0',
    }}>
      <span className="material-symbols-outlined" style={{
        fontSize: 13, color: 'var(--c-text-secondary)',
        fontVariationSettings: "'FILL' 1",
        flexShrink: 0,
      }}>public</span>
      <p style={{
        margin: 0,
        fontSize: 11, fontWeight: 600,
        color: 'var(--c-text-secondary)',
        fontFamily: 'Inter',
        letterSpacing: '0.01em',
      }}>
        {t.hub.appliesToAll}
      </p>
    </div>
  );
}

function HubSettings({ accent }: { accent: { from: string; to: string; mid: string } }) {
  const { settings, updateSettings, updatePerApp } = useChordStore();
  const t = useT();
  const [name, setName] = useState(settings.hubUserName ?? '');

  // Per-app appearance — read hub's current visuals
  const hubVis: PerAppVisuals = settings.perApp?.hub ?? { theme: 'dark', accentColor: 'blue', amoledMode: false };

  // Pending change for the ApplyToSheet
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
        <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.03em' }}>{t.hub.settingsTitle}</p>
        <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '5px 0 0', fontWeight: 500 }}>{t.hub.settingsSubtitle}</p>
      </div>

      {/* ── Account ── */}
      <p style={sectionLabel}>{t.hub.account}</p>
      <div style={cardStyle}>
        <div style={rowStyle}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>{t.hub.login}</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '2px 0 0' }}>{t.hub.syncDevices}</p>
          </div>
          <div style={{
            padding: '7px 14px', borderRadius: 9999,
            background: 'rgba(128,128,128,0.1)',
            border: '1px solid rgba(128,128,128,0.15)',
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-secondary)', margin: 0, whiteSpace: 'nowrap' }}>{t.hub.comingSoon}</p>
          </div>
        </div>
      </div>

      {/* ── Profile ── */}
      <p style={sectionLabel}>{t.hub.profile}</p>
      <div style={cardStyle}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid rgba(128,128,128,0.07)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-secondary)', margin: '0 0 8px' }}>{t.hub.yourName}</p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => updateSettings({ hubUserName: name })}
            placeholder={t.hub.namePlaceholder}
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

      {/* Theme + AMOLED + Accent — single card */}
      <div style={cardStyle}>

        {/* Theme + AMOLED — 2×2 grid */}
        <div style={{ padding: 'var(--density-pad) var(--density-pad) 16px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            {([
              { value: 'system', label: t.settings.rows.themeSystem, icon: 'brightness_auto', amoled: false },
              { value: 'light',  label: t.settings.rows.themeLight,  icon: 'light_mode',      amoled: false },
              { value: 'dark',   label: t.settings.rows.themeDark,   icon: 'dark_mode',        amoled: false },
              { value: 'dark',   label: t.hub.amoled,                 icon: 'contrast',          amoled: true  },
            ] as { value: Theme; label: string; icon: string; amoled: boolean }[]).map((opt, i) => {
              const isActive = opt.amoled
                ? hubVis.amoledMode
                : hubVis.theme === opt.value && !hubVis.amoledMode;
              return (
                <button key={i}
                  onClick={() => {
                    if (opt.amoled) requestChange({ theme: 'dark', amoledMode: true });
                    else requestChange({ theme: opt.value, amoledMode: false });
                  }}
                  className="btn-smooth"
                  style={{
                    padding: '12px 6px', borderRadius: '12px',
                    background: isActive ? `${accent.from}22` : 'var(--app-surface-high)',
                    border: `1.5px solid ${isActive ? accent.from + '66' : 'transparent'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    transition: 'background 200ms ease, border-color 200ms ease, opacity 200ms ease',
                    cursor: 'pointer',
                  }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: '22px',
                    color: isActive ? accent.from : 'var(--c-text-secondary)',
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                    transition: 'color 200ms ease',
                  }}>{opt.icon}</span>
                  <p style={{
                    color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
                    fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)',
                    transition: 'color 200ms ease',
                  }}>{opt.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color */}
        <div style={{ padding: 'var(--density-pad) var(--density-pad) 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--density-card-gap)' }}>
            {COLOR_OPTIONS.map(c => {
              const isActive = hubVis.accentColor === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => requestChange({ accentColor: c.id as PerAppVisuals['accentColor'] })}
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

      <ApplyToSheet show={showSheet} onApply={handleApply} onClose={handleClose} />

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
      <GlobalHint />

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
      </div>
      <GlobalHint />

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

      {/* ── ABOUT ── */}
      <SectionHeader icon="info" title={t.settings.sections.about} />
      <div style={cardStyle}>
        <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { label: t.settings.about.version, value: '1.5.0'                      },
            { label: t.settings.about.storage, value: t.settings.about.storageValue },
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

    </div>
  );
}

// ── Floating bottom nav (matches Chordex/Drumex style) ───────────────────────
function useHubNavItems(): { id: HubTab; icon: string; label: string }[] {
  const t = useT();
  return [
    { id: 'home',     icon: 'home',     label: t.hub.home     },
    { id: 'settings', icon: 'settings', label: t.hub.settings },
  ];
}

function HubNav({ tab, setTab, accent }: {
  tab: HubTab;
  setTab: (t: HubTab) => void;
  accent: { from: string; to: string; mid: string };
}) {
  const { settings } = useChordStore();
  const HUB_NAV_ITEMS = useHubNavItems();
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

  const hubVis2 = settings.perApp?.hub ?? { theme: settings.theme ?? 'dark', amoledMode: settings.amoledMode ?? false };
  const isLight = hubVis2.theme === 'light' || (hubVis2.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const bg = hubVis2.amoledMode ? 'rgba(4,4,4,0.88)' : isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)';

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

import React, { useState, useRef, useEffect, useLayoutEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { useBackHandler } from '../lib/backStack';
import { subscribeAuth, signOut, type AuthUser } from '../lib/auth';
import { useChordStore, ACCENT_COLORS, type Theme, type AnimationSpeed, type DisplayDensity, type AppKey, type PerAppVisuals } from '../store/useChordStore';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useNavHidden, useNavCollapsed, useScrollHide } from '../lib/navScroll';
import { useT } from '../lib/useT';
import { Toggle, SectionHeader, SettingRow, SegmentedControl, COLOR_OPTIONS } from './SettingControls';
import ApplyToSheet from './ApplyToSheet';
import { APP_VERSION_LABEL } from '../lib/appVersion';
import ChangelogSheet from './ChangelogSheet';
import GradientBorderCard from './GradientBorderCard';
import { useOtaUpdate } from '../lib/otaUpdate';
import { useLiquidGlassNav } from '../lib/useLiquidGlassNav';

// AccountCard pulls Firebase (auth + firestore). Lazy-load it so Firebase
// stays out of the initial bundle graph; only fetched when Settings tab opens.
const AccountCard = lazy(() => import('./AccountCard'));
const AccountDangerZone = lazy(() =>
  import('./AccountCard').then(m => ({ default: m.AccountDangerZone }))
);
const AccountSettingsPage = lazy(() =>
  import('./AccountCard').then(m => ({ default: m.AccountSettingsPage }))
);

type HubTab = 'home' | 'settings' | 'profile';
type TargetApp = 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark',   label: 'Oscuro' },
  { value: 'light',  label: 'Claro' },
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

function getGreetingPair(name?: string, idx?: number, lang: string = 'en'): GreetingPair {
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
  const hubAccentKey = settings.perApp?.hub?.accentColor ?? settings.accentColor ?? 'blue';
  const accent = useMemo(() =>
    hubAccentKey === 'custom'
      ? { from: `hsl(${settings.customAccentHue ?? 220}, 75%, 65%)`, mid: `hsl(${settings.customAccentHue ?? 220}, 80%, 55%)`, to: `hsl(${((settings.customAccentHue ?? 220) + 25) % 360}, 85%, 42%)` }
      : (ACCENT_COLORS[hubAccentKey] ?? ACCENT_COLORS.blue),
  [hubAccentKey, settings.customAccentHue]);
  const isHubLight = (settings.perApp?.hub?.theme ?? settings.theme ?? 'dark') === 'light';

  const [tab, setTab]       = useState<HubTab>('home');
  const [zooming, setZooming] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);

  useEffect(() => subscribeAuth(setAuthUser), []);

  useEffect(() => {
    if (!showProfile) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfile]);

  const launchApp = useCallback((appMode: 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex') => {
    setZooming(true);
    setTimeout(() => {
      updateSettings({ appMode });
    }, 380);
  // updateSettings is stable (Zustand action), setZooming is React setState
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessionIdx = getSessionIndex();
  const greetName = authUser?.displayName?.trim() || settings.hubUserName;
  const { greeting, subtitle } = useMemo(
    () => getGreetingPair(greetName, sessionIdx, lang),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [greetName, lang],
  );

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
      <div ref={scrollRef} style={{ flex: 1, overflowY: tab === 'home' ? 'hidden' : 'auto', overflowX: 'hidden' }}>

        {/* ── HOME TAB ── */}
        {tab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)', position: 'relative' }}>

            {/* ── Profile trigger + dropdown — top left ── */}
            <div
              ref={profileRef}
              style={{
                position: 'absolute',
                top: 'max(14px, calc(env(safe-area-inset-top) + 10px))',
                left: 20,
                zIndex: 200,
                animation: 'hub-drop-in 500ms cubic-bezier(0.34,1.15,0.64,1) both',
              }}
            >
              {/* Avatar circle — compact trigger */}
              <button
                onClick={() => setShowProfile(v => !v)}
                aria-label="Profile"
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  padding: 2, border: 'none',
                  cursor: 'pointer', outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  flexShrink: 0,
                  boxShadow: showProfile ? `0 0 0 3px color-mix(in srgb, ${accent.from} 28%, transparent)` : 'none',
                  transition: 'box-shadow 200ms ease',
                }}
              >
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--app-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {authUser?.photoURL ? (
                    <img src={authUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <span style={{ fontSize: 15, fontWeight: 800, color: accent.from, fontFamily: 'Manrope' }}>
                      {(authUser?.displayName || settings.hubUserName || 'S')[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
              </button>

              {/* Panel — bursts out from the avatar origin */}
              {showProfile && (
                <div style={{
                  position: 'absolute', left: 0, top: 0,
                  width: 235,
                  background: 'rgba(22,23,30,0.97)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 18,
                  boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
                  overflow: 'hidden',
                  animation: 'profile-burst-out 320ms cubic-bezier(0.34,1.65,0.64,1) both',
                  transformOrigin: 'top left',
                }}>
                  {/* Header: avatar + name + email */}
                  <div style={{ padding: '13px 15px 11px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, padding: 2, flexShrink: 0 }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#111114', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {authUser?.photoURL ? (
                          <img src={authUser.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 800, color: accent.from, fontFamily: 'Manrope' }}>
                            {(authUser?.displayName || settings.hubUserName || 'S')[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#ffffff', fontFamily: 'Manrope', letterSpacing: '-0.01em', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {authUser?.displayName || settings.hubUserName || 'Studio'}
                      </p>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {authUser?.email || 'studio@app'}
                      </p>
                    </div>
                  </div>

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '0 10px 4px' }} />

                  <div style={{ padding: '0 4px 4px' }}>
                    {([
                      { icon: 'account_circle', label: 'Profile',      action: () => { setTab('profile'); setShowProfile(false); }, badge: null as string | null },
                      { icon: 'auto_awesome',   label: 'Subscription', action: null as (() => void) | null, badge: 'Soon' },
                      { icon: 'settings',       label: 'Settings',     action: () => { setTab('settings'); setShowProfile(false); }, badge: null },
                    ]).map((item, idx) => (
                      <button
                        key={item.icon}
                        onClick={item.action ?? undefined}
                        disabled={!item.action}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 11px',
                          background: 'transparent', border: '1px solid transparent',
                          borderRadius: 13,
                          cursor: item.action ? 'pointer' : 'default',
                          outline: 'none', WebkitTapHighlightColor: 'transparent',
                          opacity: item.action || item.badge ? 1 : 0.5,
                          transition: 'background 120ms ease',
                          animation: `profile-dd-item-in 200ms ${idx * 45}ms cubic-bezier(0.22,1,0.36,1) both`,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', fontVariationSettings: "'FILL' 0", flexShrink: 0 }}>{item.icon}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#ffffff', fontFamily: 'Manrope', textAlign: 'left' }}>{item.label}</span>
                        {item.badge && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: accent.from, background: `color-mix(in srgb, ${accent.from} 18%, transparent)`, padding: '2px 7px', borderRadius: 9999, border: `1px solid color-mix(in srgb, ${accent.from} 28%, transparent)` }}>{item.badge}</span>
                        )}
                      </button>
                    ))}

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 6px' }} />

                    {authUser && (
                      <button
                        onClick={async () => { await signOut(); setShowProfile(false); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 11px',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid transparent',
                          borderRadius: 13,
                          cursor: 'pointer', outline: 'none', WebkitTapHighlightColor: 'transparent',
                          transition: 'background 120ms ease',
                          animation: 'profile-dd-item-in 200ms 135ms cubic-bezier(0.22,1,0.36,1) both',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f87171', fontVariationSettings: "'FILL' 0", flexShrink: 0 }}>logout</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#f87171', fontFamily: 'Manrope' }}>Sign out</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Logo area */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: 'clamp(148px, 30vh, 200px)',
              animation: 'hub-drop-in 500ms cubic-bezier(0.34,1.15,0.64,1) both',
            }}>
              <div data-intro-target="studio" style={{ color: isHubLight ? '#18181b' : 'white', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <StudioLogo size={56} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: '10px 0 0', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {String(t.hub.studio).split('').map((char, i) => (
                  <span key={i} style={{ display: 'inline-block', animation: `char-reveal 0.45s ${0.08 + i * 0.06}s cubic-bezier(0.22,1,0.36,1) both` }}>{char}</span>
                ))}
              </p>
            </div>

            {/* Combined welcome + apps card */}
            <GradientBorderCard
              borderRadius={24}
              wrapStyle={{
                width: '100%', maxWidth: 380,
                marginTop: 'clamp(40px, 9vh, 68px)',
                animation: 'hub-rise-in 500ms 80ms cubic-bezier(0.34,1.15,0.64,1) both, gb-spin 14s linear infinite',
              }}
              innerStyle={{
                overflow: 'hidden',
                transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
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
                { app: 'stage'  as TargetApp, Logo: StagexLogoIcon, name: 'Stagex',     desc: t.hub.stagexDesc        },
                { app: 'groovex' as TargetApp, Logo: GroovexLogo,     name: 'Groovex',    desc: t.hub.groovexDesc       },
                { app: 'vocalex' as TargetApp, Logo: VocalexLogo,    name: 'Vocalex',    desc: t.hub.vocalexDesc       },
              ]).map(({ app, Logo, name, desc }, i, arr) => (
                <AppRow
                  key={app}
                  app={app}
                  Logo={Logo}
                  name={name}
                  desc={desc}
                  last={i === arr.length - 1}
                  onClick={() => launchApp(app)}
                />
              ))}
            </GradientBorderCard>

          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 0', paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
              <button
                onClick={() => setTab('home')}
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'transparent', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  color: 'var(--c-text-secondary)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>chevron_left</span>
              </button>
            </div>
            <Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>…</div>}>
              <AccountSettingsPage accent={accent} />
            </Suspense>
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 0', paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
              <button
                onClick={() => setTab('home')}
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'transparent', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  color: 'var(--c-text-secondary)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>chevron_left</span>
              </button>
            </div>
            <HubSettings accent={accent} scrollRef={scrollRef} />
          </>
        )}
      </div>

      {/* UpdateIndicator is now hoisted to AppShell so it appears on
          every screen, not just the Hub. */}
    </div>
  );
}

// ── StudioFamilyOrbit ─────────────────────────────────────────────────────────
// Clean monochrome orbit — Studio sine-wave in a neutral dark circle at center,
// 5 sub-app icons orbiting in white-outlined circles (no color gradients).
// Uses the canonical animata double-rotate trick so icons stay upright.
function StudioFamilyOrbit({
  items,
}: {
  items: { key: string; node: React.ReactNode; label: string }[];
}) {
  const RADIUS = 96;
  const SPEED  = 22;
  const SIZE   = 240;
  const N      = items.length;

  const keyframes = items.map((_, i) => {
    const a = (i / N) * 360;
    return `
      @keyframes family-orbit-${i} {
        from { transform: rotate(${a}deg) translateX(${RADIUS}px) rotate(${-a}deg); }
        to   { transform: rotate(${a + 360}deg) translateX(${RADIUS}px) rotate(${-(a + 360)}deg); }
      }
    `;
  }).join('\n');

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: SIZE,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <style>{`
        ${keyframes}
        @keyframes family-orbit-bob {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-3px); }
        }
      `}</style>

      {/* Subtle neutral glow */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 200, height: 200,
        marginTop: -100, marginLeft: -100,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Dashed orbit ring */}
      <div style={{
        position: 'absolute',
        width: RADIUS * 2,
        height: RADIUS * 2,
        borderRadius: '50%',
        border: '1px dashed rgba(128,128,128,0.22)',
        pointerEvents: 'none',
      }} />

      {/* Center Studio logo — neutral dark circle, no pink gradient */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        width: 84,
        height: 84,
        borderRadius: '50%',
        background: 'var(--c-surface-2, rgba(255,255,255,0.05))',
        border: '1px solid rgba(255,255,255,0.10)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--c-text-primary)',
        animation: 'family-orbit-bob 3.2s ease-in-out infinite',
      }}>
        <StudioLogo size={48} />
      </div>

      {/* Orbiters — clean white-outlined circles */}
      {items.map(({ key, node }, i) => (
        <div
          key={key}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 0,
            height: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: `family-orbit-${i} ${SPEED}s linear infinite`,
            zIndex: 1,
          }}
        >
          <div style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--c-text-primary)',
          }}>
            {React.cloneElement(node as React.ReactElement<{ size: number }>, { size: 24 })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── App row (list item inside the combined card) ───────────────────────────────
function AppRow({
  app, Logo, name, desc, last, onClick,
}: {
  app: TargetApp;
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
      <div data-intro-target={app} style={{
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

type SettingsPageId = 'main' | 'appearance' | 'language' | 'storage' | 'privacy' | 'about' | 'ai-assistant' | 'updater';

function formatHour(h: number): string {
  if (h === 0) return '12 am';
  if (h < 12) return `${h} am`;
  if (h === 12) return '12 pm';
  return `${h - 12} pm`;
}

const HUB_SETTINGS_CSS = `
  @keyframes hub-slide-in {
    from { transform: translateX(32px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes hub-slide-back {
    from { transform: translateX(-24px); opacity: 0; }
    to   { transform: translateX(0);     opacity: 1; }
  }
  @keyframes hub-row-fade {
    from { transform: translateY(7px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
  }
  @keyframes hub-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes char-reveal {
    from { opacity: 0; transform: translateY(9px); filter: blur(4px); }
    to   { opacity: 1; transform: translateY(0);   filter: blur(0); }
  }
  @keyframes profile-sheet-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes profile-dd-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }
  @keyframes profile-dd-item-in {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes profile-burst-out {
    from { opacity: 0; transform: scale(0.12); transform-origin: top left; }
    to   { opacity: 1; transform: scale(1);   transform-origin: top left; }
  }
  input[type=range].hue-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 28px;
    border-radius: 14px;
    outline: none;
    cursor: pointer;
    display: block;
    width: 100%;
  }
  input[type=range].hue-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid rgba(0,0,0,0.18);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    cursor: pointer;
  }
  input[type=range].hue-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid rgba(0,0,0,0.18);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    cursor: pointer;
    border: none;
  }
`;

function SettingsNavRow({
  icon, iconColor, title, desc, onPress,
  last = false, placeholder = false, delay = 0, badge,
}: {
  icon: string; iconColor?: string; title: string; desc?: string;
  onPress: () => void; last?: boolean; placeholder?: boolean; delay?: number; badge?: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={placeholder ? () => {} : onPress}
      onPointerDown={() => !placeholder && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', padding: '13px 16px',
        background: pressed ? 'rgba(128,128,128,0.06)' : 'transparent',
        border: 'none',
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
        borderBottom: last ? 'none' : '1px solid rgba(128,128,128,0.07)',
        cursor: placeholder ? 'default' : 'pointer',
        textAlign: 'left',
        transform: pressed ? 'scale(0.977)' : 'scale(1)',
        transition: 'background 100ms ease, transform 140ms cubic-bezier(0.34,1.15,0.64,1)',
        boxSizing: 'border-box',
        opacity: placeholder ? 0.38 : 1,
        animation: `hub-row-fade 380ms ease ${delay}ms both`,
        transformOrigin: 'center center',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: iconColor ? `${iconColor}20` : 'rgba(128,128,128,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${iconColor ? iconColor + '28' : 'transparent'}`,
      }}>
        <span className="material-symbols-outlined" style={{
          fontSize: 18,
          color: iconColor ?? 'var(--c-text-secondary)',
          fontVariationSettings: "'FILL' 1",
        }}>{icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.01em', fontFamily: 'Manrope' }}>{title}</p>
        {desc && <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: '2px 0 0', fontWeight: 500, fontFamily: 'Inter', lineHeight: 1.3 }}>{desc}</p>}
      </div>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: 'Manrope',
          padding: '3px 7px', borderRadius: 999,
          background: 'rgba(128,128,128,0.12)',
          color: 'var(--c-text-secondary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>{badge}</span>
      )}
      {!placeholder && (
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', flexShrink: 0, opacity: 0.45 }}>chevron_right</span>
      )}
    </button>
  );
}

function SettingsSectionLabel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700,
      color: 'var(--c-text-secondary)',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      margin: '22px 0 8px 4px',
      fontFamily: 'Manrope',
      animation: `hub-row-fade 380ms ease ${delay}ms both`,
    }}>{children}</p>
  );
}

function SettingsSubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 32, paddingBottom: 16, animation: 'hub-row-fade 300ms ease both' }}>
      <button
        onClick={onBack}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(128,128,128,0.10)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--c-text-primary)',
          flexShrink: 0,
          transform: pressed ? 'scale(0.91)' : 'scale(1)',
          transition: 'transform 130ms cubic-bezier(0.34,1.15,0.64,1)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
      </button>
      <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.03em', fontFamily: 'Manrope' }}>{title}</p>
    </div>
  );
}

function GlobalHint() {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '6px 4px 0' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--c-text-secondary)', fontVariationSettings: "'FILL' 1", flexShrink: 0 }}>public</span>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)', fontFamily: 'Inter', letterSpacing: '0.01em' }}>
        {t.hub.appliesToAll}
      </p>
    </div>
  );
}

function HubUpdaterPage({ style, cardStyle, accent, onBack }: {
  style: React.CSSProperties;
  cardStyle: React.CSSProperties;
  accent: { from: string; to: string; mid: string };
  onBack: () => void;
}) {
  const ota = useOtaUpdate();
  const { settings, updateSettings } = useChordStore();
  const lang = settings.language ?? 'en';

  const L = lang === 'es'
    ? {
        version: 'Versión',
        installed: 'Instalada',
        latest: 'Última',
        status: 'Estado',
        checking: 'Buscando actualizaciones…',
        updateAvailable: (v: string) => `Actualización disponible — ${v}`,
        upToDate: 'Estás al día',
        download: (v: string) => `Descargar ${v}`,
        controls: 'Controles',
        notifTitle: 'Notificaciones de actualización',
        notifDesc: 'Recibe un aviso del sistema cuando haya un bundle nuevo.',
        autoTitle: 'Comprobación automática',
        autoDesc: 'Studio comprueba cada 60 s mientras la app está abierta.',
        changelogTitle: 'Mostrar novedades tras actualizar',
        changelogDesc: 'Abre la hoja de cambios la primera vez tras instalar una nueva versión.',
        checkNow: 'Buscar ahora',
        howItWorks: 'Cómo funciona',
        howItWorksBody: 'Las actualizaciones OTA se descargan en segundo plano y se aplican al reabrir la app — sin reinstalar.',
        title: 'Actualizaciones',
      }
    : {
        version: 'Version',
        installed: 'Installed',
        latest: 'Latest',
        status: 'Status',
        checking: 'Checking for updates…',
        updateAvailable: (v: string) => `Update available — ${v}`,
        upToDate: "You're up to date",
        download: (v: string) => `Download ${v}`,
        controls: 'Controls',
        notifTitle: 'Update notifications',
        notifDesc: 'Get a system notification when a new bundle is ready.',
        autoTitle: 'Automatic checks',
        autoDesc: 'Studio checks every 60 s while the app is open.',
        changelogTitle: "Show what's new after updating",
        changelogDesc: 'Open the changelog sheet the first time you launch after installing a new version.',
        checkNow: 'Check now',
        howItWorks: 'How it works',
        howItWorksBody: 'OTA updates download in the background and apply on the next launch — no reinstall needed.',
        title: 'Updater',
      };

  const statusColor = ota.loading
    ? 'var(--c-text-secondary)'
    : ota.updateAvailable ? '#f59e0b' : '#4ade80';

  const statusLabel = ota.loading
    ? L.checking
    : ota.updateAvailable
      ? L.updateAvailable(ota.remoteVersion ?? '')
      : L.upToDate;

  return (
    <div style={style}>
      <style>{HUB_SETTINGS_CSS}</style>
      <SettingsSubHeader title={L.title} onBack={onBack} />

      <SettingsSectionLabel>{L.version}</SettingsSectionLabel>
      <div style={cardStyle}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid rgba(128,128,128,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 'var(--font-base)' }}>{L.installed}</span>
          <span style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 'var(--font-sm)' }}>{APP_VERSION_LABEL}</span>
        </div>
        <div style={{ padding: '15px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 'var(--font-base)' }}>{L.latest}</span>
          <span style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 'var(--font-sm)' }}>
            {ota.loading ? '—' : (ota.remoteVersion ?? '—')}
          </span>
        </div>
      </div>

      <SettingsSectionLabel delay={50}>{L.status}</SettingsSectionLabel>
      <div style={cardStyle}>
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(128,128,128,0.07)' }}>
          {ota.loading
            ? <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', flexShrink: 0, animation: 'hub-spin 1s linear infinite' }}>refresh</span>
            : <div style={{ width: 9, height: 9, borderRadius: '50%', background: statusColor, flexShrink: 0, boxShadow: `0 0 8px ${statusColor}88` }} />
          }
          <span style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 'var(--font-base)', flex: 1 }}>{statusLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => { void ota.checkNow(); }}
          disabled={ota.loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '14px 18px', border: 'none', background: 'transparent',
            color: ota.loading ? 'var(--c-text-secondary)' : accent.from,
            fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-sm)',
            cursor: ota.loading ? 'default' : 'pointer',
            borderBottom: ota.updateAvailable && ota.downloadUrl ? '1px solid rgba(128,128,128,0.07)' : 'none',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
          {L.checkNow}
        </button>
        {ota.updateAvailable && ota.downloadUrl && (
          <a
            href={ota.downloadUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '0 16px 16px', marginTop: 12, padding: '13px', borderRadius: 12, background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-sm)', textDecoration: 'none', boxShadow: `0 4px 16px ${accent.to}44` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>download</span>
            {L.download(ota.remoteVersion ?? '')}
          </a>
        )}
      </div>

      <SettingsSectionLabel delay={80}>{L.controls}</SettingsSectionLabel>
      <div style={cardStyle}>
        <SettingRow label={L.notifTitle} desc={L.notifDesc}>
          <Toggle value={settings.otaNotifications ?? true} onChange={v => updateSettings({ otaNotifications: v })} accentFrom={accent.from} accentTo={accent.to} />
        </SettingRow>
        <SettingRow label={L.autoTitle} desc={L.autoDesc}>
          <Toggle value={settings.otaAutoCheck ?? true} onChange={v => updateSettings({ otaAutoCheck: v })} accentFrom={accent.from} accentTo={accent.to} />
        </SettingRow>
        <SettingRow label={L.changelogTitle} desc={L.changelogDesc}>
          <Toggle value={settings.otaShowChangelog ?? true} onChange={v => updateSettings({ otaShowChangelog: v })} accentFrom={accent.from} accentTo={accent.to} />
        </SettingRow>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '14px 4px 0', padding: '12px 14px', borderRadius: 12, background: 'rgba(128,128,128,0.06)', border: '1px solid rgba(128,128,128,0.09)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--c-text-secondary)', flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1" }}>cloud_download</span>
        <div>
          <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 12.5, margin: '0 0 3px' }}>{L.howItWorks}</p>
          <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 11.5, margin: 0, lineHeight: 1.55 }}>{L.howItWorksBody}</p>
        </div>
      </div>
    </div>
  );
}

function HubSettings({ accent, scrollRef }: { accent: { from: string; to: string; mid: string }; scrollRef?: React.RefObject<HTMLDivElement | null> }) {
  const { settings, updateSettings, updatePerApp } = useChordStore();
  const t = useT();
  const [page, setPage] = useState<SettingsPageId>('main');
  const [pageKey, setPageKey] = useState(0);
  const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');

  const hubVis: PerAppVisuals = settings.perApp?.hub ?? { theme: 'dark', accentColor: 'blue', amoledMode: false };
  const [pending, setPending] = useState<Partial<PerAppVisuals> | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  function requestChange(patch: Partial<PerAppVisuals>) { setPending(patch); setShowSheet(true); }
  function handleApply(apps: AppKey[]) { if (pending) updatePerApp(apps, pending); setPending(null); setShowSheet(false); }
  function handleClose() { setPending(null); setShowSheet(false); }

  // Scroll-position memory per sub-page. Without this, navigating
  // Settings → About → back resets the outer scroll container to the
  // top because the rendered content shrunk while in About and then
  // grew again on return — the browser clamps scrollTop and we lose
  // the user's place. We snapshot the current scrollTop right before
  // any page change and restore it on the next paint after the new
  // page is in the DOM.
  const pageScrollPositions = useRef<Record<string, number>>({});
  const pendingRestoreRef = useRef<string | null>(null);
  function snapshotScroll(forPage: SettingsPageId) {
    const el = scrollRef?.current;
    if (el) pageScrollPositions.current[forPage] = el.scrollTop;
  }
  useLayoutEffect(() => {
    const target = pendingRestoreRef.current;
    if (target === null) return;
    const el = scrollRef?.current;
    if (el) el.scrollTop = pageScrollPositions.current[target] ?? 0;
    pendingRestoreRef.current = null;
  }, [page, pageKey, scrollRef]);

  function navigate(to: SettingsPageId) {
    snapshotScroll(page);
    pendingRestoreRef.current = to;
    setSlideDir('forward');
    setPage(to);
    setPageKey(k => k + 1);
  }
  function goBack() {
    snapshotScroll(page);
    pendingRestoreRef.current = 'main';
    setSlideDir('back');
    setPage('main');
    setPageKey(k => k + 1);
  }

  const goBackRef = useRef(goBack);
  useEffect(() => { goBackRef.current = goBack; });

  useBackHandler('nested', () => {
    if (page !== 'main') { goBack(); return true; }
    return false;
  }, [page]);

  useEffect(() => {
    if (page === 'main') return;
    let startX = 0, startY = 0;
    const onStart = (e: TouchEvent) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (startX < 40 && dx > 60 && dy < 80) goBackRef.current();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [page]);

  const cardStyle: React.CSSProperties = {
    background: 'var(--app-surface)',
    borderRadius: '1.25rem',
    overflow: 'hidden',
    transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
    border: '1px solid rgba(128,128,128,0.07)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
  };

  const slideAnim = slideDir === 'forward' ? 'hub-slide-in' : 'hub-slide-back';
  const subStyle: React.CSSProperties = {
    padding: '0 20px',
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)',
    animation: `${slideAnim} 300ms cubic-bezier(0.25,0.46,0.45,0.94) both`,
  };

  /* ── APPEARANCE ─────────────────────────────────────────────────── */
  if (page === 'appearance') {
    return (
      <div key={pageKey}>
        <div style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title={t.settings.sections.appearance} onBack={goBack} />

        <SettingsSectionLabel>{(t.hub as { studioSettings?: { themeSection?: string } }).studioSettings?.themeSection ?? 'Theme'}</SettingsSectionLabel>
        <div style={cardStyle}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {([
                { value: 'system', label: t.settings.rows.themeSystem, icon: 'brightness_auto', amoled: false },
                { value: 'light',  label: t.settings.rows.themeLight,  icon: 'light_mode',      amoled: false },
                { value: 'dark',   label: t.settings.rows.themeDark,   icon: 'dark_mode',        amoled: false },
                { value: 'dark',   label: t.hub.amoled,                icon: 'contrast',          amoled: true  },
              ] as { value: Theme; label: string; icon: string; amoled: boolean }[]).map((opt, i) => {
                const isActive = opt.amoled
                  ? hubVis.amoledMode
                  : hubVis.theme === opt.value && !hubVis.amoledMode;
                return (
                  <button key={i}
                    onClick={() => { if (opt.amoled) requestChange({ theme: 'dark', amoledMode: true }); else requestChange({ theme: opt.value, amoledMode: false }); }}
                    className="btn-smooth"
                    style={{
                      padding: '12px 6px', borderRadius: 12,
                      background: isActive ? `${accent.from}22` : 'var(--app-surface-high)',
                      border: `1.5px solid ${isActive ? accent.from + '66' : 'transparent'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      transition: 'background 200ms ease, border-color 200ms ease, transform 160ms cubic-bezier(0.34,1.56,0.64,1)',
                      cursor: 'pointer',
                      transform: isActive ? 'scale(1.04)' : 'scale(1)',
                    }}>
                    <span className="material-symbols-outlined" style={{
                      fontSize: 22,
                      color: isActive ? accent.from : 'var(--c-text-secondary)',
                      fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                      transition: 'color 200ms ease, font-variation-settings 200ms ease',
                      filter: isActive ? `drop-shadow(0 0 6px ${accent.from}66)` : 'none',
                    }}>{opt.icon}</span>
                    <p style={{ color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', transition: 'color 200ms ease', margin: 0 }}>{opt.label}</p>
                  </button>
                );
              })}
            </div>
            {/* Dynamic theme — full-width row */}
            {(() => {
              const isDynActive = hubVis.theme === 'dynamic' && !hubVis.amoledMode;
              return (
                <button
                  onClick={() => requestChange({ theme: 'dynamic' as Theme, amoledMode: false })}
                  className="btn-smooth"
                  style={{
                    width: '100%', marginTop: 8, padding: '11px 14px', borderRadius: 12,
                    background: isDynActive ? `${accent.from}22` : 'var(--app-surface-high)',
                    border: `1.5px solid ${isDynActive ? accent.from + '66' : 'transparent'}`,
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'background 200ms ease, border-color 200ms ease, transform 160ms cubic-bezier(0.34,1.56,0.64,1)',
                    cursor: 'pointer',
                    transform: isDynActive ? 'scale(1.02)' : 'scale(1)',
                  }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22, color: isDynActive ? accent.from : 'var(--c-text-secondary)', fontVariationSettings: isDynActive ? "'FILL' 1" : "'FILL' 0", transition: 'color 200ms ease', flexShrink: 0, filter: isDynActive ? `drop-shadow(0 0 6px ${accent.from}66)` : 'none' }}>schedule</span>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ color: isDynActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', margin: 0, transition: 'color 200ms ease' }}>{(t.hub as { studioSettings?: { dynamic?: string } }).studioSettings?.dynamic ?? 'Dynamic'}</p>
                    <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 10.5, margin: '2px 0 0', opacity: 0.75 }}>{
                      (t.hub as { studioSettings?: { dynamicHelper?: (a: string, b: string) => string } }).studioSettings?.dynamicHelper?.(
                        formatHour(settings.dynamicLightStart ?? 7),
                        formatHour(settings.dynamicLightEnd ?? 20),
                      ) ?? `Light ${formatHour(settings.dynamicLightStart ?? 7)} – ${formatHour(settings.dynamicLightEnd ?? 20)} · Dark at night`
                    }</p>
                  </div>
                </button>
              );
            })()}
            {hubVis.theme === 'dynamic' && !hubVis.amoledMode && (() => {
              const lStart = settings.dynamicLightStart ?? 7;
              const lEnd   = settings.dynamicLightEnd   ?? 20;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 0 4px' }}>
                  {([
                    { label: (t.hub as { studioSettings?: { lightFrom?: string } }).studioSettings?.lightFrom ?? 'Light from', val: lStart, onDec: () => updateSettings({ dynamicLightStart: Math.max(0, lStart - 1) }), onInc: () => updateSettings({ dynamicLightStart: Math.min(lEnd - 1, lStart + 1) }) },
                    { label: (t.hub as { studioSettings?: { darkFrom?: string } }).studioSettings?.darkFrom ?? 'Dark from',  val: lEnd,   onDec: () => updateSettings({ dynamicLightEnd: Math.max(lStart + 1, lEnd - 1) }), onInc: () => updateSettings({ dynamicLightEnd: Math.min(23, lEnd + 1) }) },
                  ] as { label: string; val: number; onDec: () => void; onInc: () => void }[]).map(({ label, val, onDec, onInc }) => (
                    <div key={label} style={{ background: `${accent.from}12`, borderRadius: 12, padding: '10px 12px' }}>
                      <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>{label}</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <button onClick={onDec} className="btn-smooth" style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(128,128,128,0.12)', border: 'none', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-text-secondary)' }}>remove</span>
                        </button>
                        <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 14, color: 'var(--c-text-primary)', minWidth: 40, textAlign: 'center' }}>{formatHour(val)}</span>
                        <button onClick={onInc} className="btn-smooth" style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(128,128,128,0.12)', border: 'none', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-text-secondary)' }}>add</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          <div style={{ padding: '14px 16px 12px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-secondary)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 10px', fontFamily: 'Manrope' }}>{t.settings.rows.accentColor}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {COLOR_OPTIONS.map(c => {
                const isActive = hubVis.accentColor === c.id;
                return (
                  <button key={c.id} onClick={() => requestChange({ accentColor: c.id as PerAppVisuals['accentColor'] })} className="btn-smooth"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: isActive ? `${c.to}22` : 'var(--app-surface-high)', border: `1.5px solid ${isActive ? c.to + '66' : 'transparent'}`, transition: 'background-color 200ms ease, border-color 200ms ease' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: `linear-gradient(135deg, ${c.from}, ${c.to})`, flexShrink: 0, boxShadow: isActive ? `0 0 8px ${c.to}55` : 'none', transition: 'box-shadow 200ms ease', display: 'block' }} />
                    <span style={{ color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', transition: 'color 200ms ease' }}>{(t.settings.colors as Record<string, string>)[c.id]}</span>
                  </button>
                );
              })}
            </div>
            {/* Custom accent color */}
            {(() => {
              const isCustom = hubVis.accentColor === 'custom';
              const hue = settings.customAccentHue ?? 220;
              return (
                <>
                  <button
                    onClick={() => requestChange({ accentColor: 'custom' })}
                    className="btn-smooth"
                    style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, background: isCustom ? `hsla(${hue}, 75%, 65%, 0.13)` : 'var(--app-surface-high)', border: `1.5px solid ${isCustom ? `hsla(${hue}, 75%, 65%, 0.4)` : 'transparent'}`, transition: 'background-color 200ms ease, border-color 200ms ease', outline: 'none', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: `linear-gradient(135deg, hsl(${hue}, 75%, 65%), hsl(${(hue + 25) % 360}, 85%, 42%))`, flexShrink: 0, display: 'block', boxShadow: isCustom ? `0 0 8px hsla(${hue}, 75%, 55%, 0.5)` : 'none', transition: 'box-shadow 200ms ease' }} />
                    <span style={{ color: isCustom ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', transition: 'color 200ms ease' }}>{(t.hub as { studioSettings?: { custom?: string } }).studioSettings?.custom ?? 'Custom'}</span>
                  </button>
                  {isCustom && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>{(t.hub as { studioSettings?: { colorLabel?: string } }).studioSettings?.colorLabel ?? 'Color'}</p>
                      <input
                        type="range" className="hue-slider"
                        min={0} max={359} value={hue}
                        onChange={e => updateSettings({ customAccentHue: Number(e.target.value) })}
                        style={{ background: 'linear-gradient(to right, hsl(0,80%,60%), hsl(30,80%,60%), hsl(60,80%,60%), hsl(90,80%,60%), hsl(120,80%,60%), hsl(150,80%,60%), hsl(180,80%,60%), hsl(210,80%,60%), hsl(240,80%,60%), hsl(270,80%,60%), hsl(300,80%,60%), hsl(330,80%,60%), hsl(360,80%,60%))' }}
                      />
                      <div style={{ height: 24, borderRadius: 8, marginTop: 8, background: `linear-gradient(135deg, hsl(${hue}, 75%, 65%), hsl(${(hue + 25) % 360}, 85%, 42%))`, boxShadow: `0 2px 8px hsla(${hue}, 70%, 55%, 0.4)` }} />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <SettingsSectionLabel delay={50}>{(t.hub as { studioSettings?: { animationsMotion?: string } }).studioSettings?.animationsMotion ?? 'Animations & Motion'}</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.animSpeed} desc={t.settings.rows.animSpeedDesc}>
            <SegmentedControl<AnimationSpeed> value={settings.animationSpeed} options={[{ value: 'fast', label: t.settings.rows.fast }, { value: 'normal', label: t.settings.rows.normal }, { value: 'reduced', label: t.settings.rows.off }]} onChange={v => updateSettings({ animationSpeed: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
        </div>
        <GlobalHint />

        <SettingsSectionLabel delay={80}>{(t.hub as { studioSettings?: { display?: string } }).studioSettings?.display ?? 'Display'}</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.density} desc={t.settings.rows.densityDesc}>
            <SegmentedControl<DisplayDensity> value={settings.displayDensity} options={[{ value: 'compact', label: t.settings.rows.compact }, { value: 'comfortable', label: t.settings.rows.normal }, { value: 'spacious', label: t.settings.rows.airy }]} onChange={v => updateSettings({ displayDensity: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.fontSize} desc={t.settings.rows.fontSizeDesc}>
            <SegmentedControl<'small' | 'medium' | 'large'> value={settings.fontSize} options={[{ value: 'small', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'large', label: 'L' }]} onChange={v => updateSettings({ fontSize: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
        </div>
        <GlobalHint />

        <SettingsSectionLabel delay={110}>{(t.hub as { studioSettings?: { feedbackPerformance?: string } }).studioSettings?.feedbackPerformance ?? 'Feedback & Performance'}</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.haptic} desc={t.settings.rows.hapticDesc}>
            <Toggle value={settings.hapticFeedback} onChange={v => updateSettings({ hapticFeedback: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={(t.hub as { studioSettings?: { highRefresh?: string } }).studioSettings?.highRefresh ?? 'High refresh rate'} desc={(t.hub as { studioSettings?: { highRefreshDesc?: string } }).studioSettings?.highRefreshDesc ?? "Keeps animations at your display's max rate (90/120Hz). May increase battery use."}>
            <Toggle value={settings.highRefreshRate} onChange={v => updateSettings({ highRefreshRate: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={(t.hub as { studioSettings?: { lowLatency?: string } }).studioSettings?.lowLatency ?? 'Low latency mode'} desc={(t.hub as { studioSettings?: { lowLatencyDesc?: string } }).studioSettings?.lowLatencyDesc ?? 'Faster audio response across all apps.'}>
            <Toggle value={settings.lowLatencyMode} onChange={v => updateSettings({ lowLatencyMode: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={(t.hub as { studioSettings?: { performanceMode?: string } }).studioSettings?.performanceMode ?? 'Performance mode'} desc={(t.hub as { studioSettings?: { performanceModeDesc?: string } }).studioSettings?.performanceModeDesc ?? 'Disables blur and heavy animations for older devices.'}>
            <Toggle value={settings.performanceMode} onChange={v => updateSettings({ performanceMode: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
        </div>
        </div>
        <ApplyToSheet show={showSheet} onApply={handleApply} onClose={handleClose} />
      </div>
    );
  }

  /* ── LANGUAGE ───────────────────────────────────────────────────── */
  if (page === 'language') {
    const LANG_OPTIONS: { code: string; flag: string; native: string; label: string }[] = [
      { code: 'en', flag: '🇬🇧', native: 'English',    label: t.settings.language.en },
      { code: 'es', flag: '🇪🇸', native: 'Español',    label: t.settings.language.es },
      { code: 'de', flag: '🇩🇪', native: 'Deutsch',    label: t.settings.language.de },
      { code: 'fr', flag: '🇫🇷', native: 'Français',   label: t.settings.language.fr },
      { code: 'zh', flag: '🇨🇳', native: '中文',        label: t.settings.language.zh },
      { code: 'pt', flag: '🇧🇷', native: 'Português',  label: t.settings.language.pt },
      { code: 'it', flag: '🇮🇹', native: 'Italiano',   label: t.settings.language.it },
      { code: 'ja', flag: '🇯🇵', native: '日本語',      label: t.settings.language.ja },
      { code: 'ko', flag: '🇰🇷', native: '한국어',      label: t.settings.language.ko },
    ];
    const currentLang = settings.language ?? 'en';
    return (
      <div key={pageKey} style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title={t.settings.sections.language} onBack={goBack} />
        <div style={{ ...cardStyle, animation: 'hub-row-fade 320ms ease both' }}>
          {LANG_OPTIONS.map((opt, i) => {
            const isSelected = currentLang === opt.code;
            const isLast = i === LANG_OPTIONS.length - 1;
            return (
              <button
                key={opt.code}
                onClick={() => updateSettings({ language: opt.code as typeof settings.language })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  width: '100%', padding: '13px 16px',
                  background: isSelected ? `${accent.from}12` : 'transparent',
                  border: 'none', outline: 'none',
                  borderBottom: isLast ? 'none' : '1px solid rgba(128,128,128,0.07)',
                  cursor: 'pointer', textAlign: 'left',
                  WebkitTapHighlightColor: 'transparent',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{opt.flag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: 'Manrope', fontWeight: 700, fontSize: 14,
                    color: isSelected ? accent.from : 'var(--c-text-primary)',
                    margin: 0, letterSpacing: '-0.01em',
                  }}>{opt.native}</p>
                  <p style={{
                    fontFamily: 'Inter', fontSize: 11.5,
                    color: 'var(--c-text-secondary)',
                    margin: '2px 0 0',
                  }}>{opt.label}</p>
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined" style={{
                    fontSize: 20, color: accent.from,
                    flexShrink: 0, fontVariationSettings: "'FILL' 1",
                  }}>check_circle</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── STORAGE ────────────────────────────────────────────────────── */
  if (page === 'storage') {
    return (
      <div key={pageKey} style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title={(t.hub as { studioSettings?: { storageSession?: string } }).studioSettings?.storageSession ?? 'Storage & Session'} onBack={goBack} />
        <SettingsSectionLabel>{(t.hub as { studioSettings?: { data?: string } }).studioSettings?.data ?? 'Data'}</SettingsSectionLabel>
        <div style={cardStyle}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(128,128,128,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 'var(--font-base)' }}>{t.settings.about.storage}</span>
            <span style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 'var(--font-sm)' }}>{t.settings.about.storageValue}</span>
          </div>
          <SettingRow label={t.hub.restoreLastSession} desc={t.hub.restoreLastSessionDesc}>
            <Toggle value={settings.restoreLastSession} onChange={v => updateSettings({ restoreLastSession: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
        </div>
      </div>
    );
  }

  /* ── PRIVACY ────────────────────────────────────────────────────── */
  if (page === 'privacy') {
    return (
      <div key={pageKey} style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title={(t.hub as { studioSettings?: { privacySecurity?: string } }).studioSettings?.privacySecurity ?? 'Privacy & Security'} onBack={goBack} />
        <SettingsSectionLabel>{(t.hub as { studioSettings?: { accountControls?: string } }).studioSettings?.accountControls ?? 'Account Controls'}</SettingsSectionLabel>
        <Suspense fallback={null}>
          <AccountDangerZone accent={accent} cardStyle={cardStyle} />
        </Suspense>
      </div>
    );
  }

  /* ── AI ASSISTANT ───────────────────────────────────────────────── */
  if (page === 'ai-assistant') {
    return (
      <div key={pageKey} style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title={(t.hub as { studioSettings?: { aiAssistant?: string } }).studioSettings?.aiAssistant ?? 'AI Assistant'} onBack={goBack} />

        <SettingsSectionLabel>{(t.hub as { studioSettings?: { intelligence?: string } }).studioSettings?.intelligence ?? 'Intelligence'}</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.chordAssistant ?? 'Chord Assistant'} desc={(t.hub as { studioSettings?: { chordAssistantDesc?: string } }).studioSettings?.chordAssistantDesc ?? 'Smart chord suggestions and progression analysis'}>
            <Toggle value={settings.chordAssistant} onChange={v => updateSettings({ chordAssistant: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '14px 4px 0', padding: '12px 14px', borderRadius: 12, background: 'rgba(128,128,128,0.06)', border: '1px solid rgba(128,128,128,0.09)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'var(--c-text-secondary)', flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 11.5, margin: 0, lineHeight: 1.6 }}>
            {(t.hub as { studioSettings?: { aiHint?: string } }).studioSettings?.aiHint ?? 'More AI features — smart suggestions, progression tips, and conflict detection — are coming in a future update.'}
          </p>
        </div>
      </div>
    );
  }

  /* ── UPDATER ─────────────────────────────────────────────────────── */
  if (page === 'updater') {
    return (
      <HubUpdaterPage
        key={pageKey}
        style={subStyle}
        cardStyle={cardStyle}
        accent={accent}
        onBack={goBack}
      />
    );
  }

  /* ── ABOUT ──────────────────────────────────────────────────────── */
  if (page === 'about') {
    const lang = settings.language ?? 'en';
    const subAppLogos: { key: string; node: React.ReactNode; label: string }[] = [
      { key: 'chordex', label: 'Chordex', node: <ChordexLogo size={34} /> },
      { key: 'drumex',  label: 'Drumex',  node: <DrumexLogo size={34} /> },
      { key: 'stagex',  label: 'Stagex',  node: <StagexLogoIcon size={34} /> },
      { key: 'groovex', label: 'Groovex', node: <GroovexLogo size={34} /> },
      { key: 'vocalex', label: 'Vocalex', node: <VocalexLogo size={34} /> },
    ];
    return (
      <div key={pageKey} style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title={t.settings.sections.about} onBack={goBack} />

        {/* Sub-app family — clean monochrome orbit of all 5 apps around the
            Studio sine-wave center. This is the only visual on the About
            page now (per design); version + footer sit minimally below. */}
        <div style={cardStyle}>
          <StudioFamilyOrbit items={subAppLogos} />
          <div style={{ textAlign: 'center', padding: '0 0 22px' }}>
            <p style={{ margin: 0, fontFamily: 'Manrope', fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', color: 'var(--c-text-primary)', lineHeight: 1.1 }}>Studio</p>
            <p style={{ margin: '6px 0 0', fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', letterSpacing: '0.04em' }}>{APP_VERSION_LABEL}</p>
          </div>
        </div>

        <div style={{ padding: '28px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 2, borderRadius: 999, background: 'rgba(128,128,128,0.35)', marginBottom: 4 }} />
          <p style={{ color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>{t.settings.about.footer}</p>
        </div>
        <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      </div>
    );
  }

  /* ── MAIN PAGE ──────────────────────────────────────────────────── */
  return (
    <div key={pageKey} style={{ padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
      <style>{HUB_SETTINGS_CSS}</style>

      {/* Title */}
      <div style={{ paddingTop: 32, paddingBottom: 8, animation: 'hub-row-fade 350ms ease both' }}>
        <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.03em', fontFamily: 'Manrope' }}>{t.hub.settingsTitle}</p>
        <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '5px 0 0', fontWeight: 500 }}>{t.hub.settingsSubtitle}</p>
      </div>

      {/* Interface */}
      <SettingsSectionLabel delay={70}>{(t.hub as { studioSettings?: { interface?: string } }).studioSettings?.interface ?? 'Interface'}</SettingsSectionLabel>
      <div style={cardStyle}>
        <SettingsNavRow icon="palette" iconColor={accent.from} title={t.settings.sections.appearance} desc={(t.hub as { studioSettings?: { appearanceDesc?: string } }).studioSettings?.appearanceDesc ?? 'Theme, colors, display & performance'} onPress={() => navigate('appearance')} last delay={80} />
      </div>

      {/* Content & Language */}
      <SettingsSectionLabel delay={100}>{(t.hub as { studioSettings?: { contentLanguage?: string } }).studioSettings?.contentLanguage ?? 'Content & Language'}</SettingsSectionLabel>
      <div style={cardStyle}>
        <SettingsNavRow icon="language" iconColor={accent.from} title={t.settings.sections.language} desc={(t.hub as { studioSettings?: { languageDesc?: string } }).studioSettings?.languageDesc ?? 'App display language'} onPress={() => navigate('language')} delay={110} />
        <SettingsNavRow icon="auto_awesome" iconColor={accent.from} title={(t.hub as { studioSettings?: { aiAssistant?: string } }).studioSettings?.aiAssistant ?? 'AI Assistant'} desc={(t.hub as { studioSettings?: { aiAssistantDesc?: string } }).studioSettings?.aiAssistantDesc ?? 'Smart chord suggestions and analysis'} onPress={() => navigate('ai-assistant')} last delay={120} />
      </div>

      {/* Storage & Data */}
      <SettingsSectionLabel delay={170}>{(t.hub as { studioSettings?: { storageData?: string } }).studioSettings?.storageData ?? 'Storage & Data'}</SettingsSectionLabel>
      <div style={cardStyle}>
        <SettingsNavRow icon="save" iconColor={accent.from} title={(t.hub as { studioSettings?: { storageSession?: string } }).studioSettings?.storageSession ?? 'Storage & Session'} desc={t.settings.about.storageValue} onPress={() => navigate('storage')} last delay={180} />
      </div>

      {/* System & About */}
      <SettingsSectionLabel delay={200}>{(t.hub as { studioSettings?: { systemAbout?: string } }).studioSettings?.systemAbout ?? 'System & About'}</SettingsSectionLabel>
      <div style={cardStyle}>
        <SettingsNavRow icon="download" iconColor={accent.from} title={(t.hub as { studioSettings?: { updater?: string } }).studioSettings?.updater ?? 'Updater'} desc={(t.hub as { studioSettings?: { updaterDesc?: string } }).studioSettings?.updaterDesc ?? 'OTA update system'} badge={(t.hub as { studioSettings?: { autoBadge?: string } }).studioSettings?.autoBadge ?? 'Auto'} onPress={() => navigate('updater')} delay={210} />
        <SettingsNavRow icon="history" iconColor={accent.from} title={(t.hub as { studioSettings?: { changelog?: string } }).studioSettings?.changelog ?? 'Changelog'} desc={(t.hub as { studioSettings?: { changelogDesc?: string } }).studioSettings?.changelogDesc ?? "What's new in this version"} onPress={() => setChangelogOpen(true)} delay={220} />
        <SettingsNavRow icon="info" iconColor={accent.from} title={t.settings.sections.about} desc={APP_VERSION_LABEL} onPress={() => navigate('about')} last delay={230} />
      </div>

      <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />

      <div style={{ padding: '28px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 2, borderRadius: 999, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`, marginBottom: 4 }} />
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
  useLiquidGlassNav(navRef);
  const btnRefs  = useRef<(HTMLButtonElement | null)[]>([]);
  const prevIdx  = useRef(HUB_NAV_ITEMS.findIndex(i => i.id === tab));
  const stretchT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navHidden    = useNavHidden();
  const navCollapsed = useNavCollapsed();


  const [pill, setPill]       = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const [pressed, setPressed] = useState<HubTab | null>(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => { const t = setTimeout(() => setEntered(true), 40); return () => clearTimeout(t); }, []);

  // Measure natural height once after mount — needed so height transition
  // has explicit px values on both ends (auto → px doesn't animate).
  const [expandedH, setExpandedH] = useState(60);
  const [expandedW, setExpandedW] = useState(400);
  useEffect(() => {
    if (navRef.current) {
      setExpandedH(navRef.current.offsetHeight);
      setExpandedW(navRef.current.offsetWidth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      stretchT.current = setTimeout(() => { setPill(p => ({ ...p, left: newM.left })); stretchT.current = null; }, 90);
    } else {
      setPill(p => ({ ...p, left: newM.left }));
      stretchT.current = setTimeout(() => { setPill(p => ({ ...p, right: newM.right })); stretchT.current = null; }, 90);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const hubVis2 = settings.perApp?.hub ?? { theme: settings.theme ?? 'dark', amoledMode: settings.amoledMode ?? false };
  const isLight = hubVis2.theme === 'light' || (hubVis2.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const bg = hubVis2.amoledMode ? 'rgba(4,4,4,0.88)' : isLight ? 'rgba(240,240,242,0.72)' : 'rgba(26,26,30,0.72)';

  return (
    <nav
      ref={navRef}
      style={{
        position: 'fixed',
        bottom: 'max(10px, env(safe-area-inset-bottom))',
        left: '50%',
        width: '90%',
        maxWidth: '448px',
        height: `${expandedH}px`,
        borderRadius: '2rem',
        border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.32)'}`,
        background: bg,
        boxShadow: isLight
          ? '0 8px 32px rgba(0,0,0,0.14), 0 1.5px 0 rgba(255,255,255,0.80) inset'
          : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
        zIndex: 50,
        overflow: 'hidden',
        pointerEvents: (navHidden || navCollapsed) ? 'none' : 'auto',
        transform: !entered
          ? 'translateX(-50%) translateY(24px)'
          : navHidden
            ? 'translateX(-50%) translateY(calc(100% + 32px))'
            : 'translateX(-50%) translateY(0px)',
        opacity: entered ? 1 : 0,
        clipPath: navCollapsed
          ? `inset(${Math.max(0, expandedH - 5)}px ${Math.max(0, Math.floor((expandedW - 90) / 2))}px 0 ${Math.max(0, Math.floor((expandedW - 90) / 2))}px round 99px)`
          : 'inset(0 0 0 0 round 2rem)',
        willChange: 'clip-path, transform, opacity',
        transition: [
          navCollapsed
            ? 'clip-path 500ms cubic-bezier(0.4,0,0.2,1)'
            : 'clip-path 380ms cubic-bezier(0.16,1,0.3,1)',
          navCollapsed
            ? 'transform 500ms cubic-bezier(0.4,0,0.2,1)'
            : 'transform 380ms cubic-bezier(0.16,1,0.3,1)',
          'opacity          500ms cubic-bezier(0.16,1,0.3,1)',
          'background-color 300ms ease',
          'border-color     300ms ease',
          'box-shadow       300ms ease',
        ].join(', '),
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '6px 8px',
        opacity: navCollapsed ? 0 : 1,
        transition: navCollapsed ? 'opacity 100ms ease' : 'opacity 350ms ease 180ms',
        willChange: 'opacity',
      }}>
      {/* Sliding pill */}
      {pill.ready && (
        <div aria-hidden style={{
          position: 'absolute', top: 4,
          left: pill.left, width: pill.right - pill.left,
          height: 'calc(100% - 8px)',
          borderRadius: '9999px',
          // Liquid glass ring — flips for light vs dark
          background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.09)',
          border: isLight ? '1.5px solid rgba(0,0,0,0.14)' : '1.5px solid rgba(255,255,255,0.30)',
          boxShadow: isLight
            ? ['inset 0 1px 0 rgba(255,255,255,0.90)', '0 2px 8px rgba(0,0,0,0.10)'].join(', ')
            : ['inset 0 1px 0 rgba(255,255,255,0.40)', '0 2px 16px rgba(255,255,255,0.06)'].join(', '),
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none', zIndex: 0,
          opacity: 1,
          transition: 'left 300ms cubic-bezier(0.16,1,0.3,1), width 300ms cubic-bezier(0.16,1,0.3,1)',
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
              color: active
                ? (isLight ? accent.from : '#fff')
                : 'var(--c-text-secondary)',
              position: 'relative', zIndex: 1,
              opacity: 1,
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
      </div>
    </nav>
  );
}

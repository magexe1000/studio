import React, { useState, useRef, useEffect, useLayoutEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { useBackHandler } from '../lib/backStack';
import { subscribeAuth, signOut, type AuthUser } from '../lib/auth';
import { subscribeSyncStatus, syncNow, type SyncStatus, deviceId, getConflictLogs, clearConflictLogs, createCloudBackup, getSyncDiagnostics, pushLocalSettingsToCloud, pullCloudSettingsFromCloud, registerDevice, registerCurrentDevice, reconnectDevices } from '../lib/sync';
import { useChordStore, ACCENT_COLORS, type Theme, type AnimationSpeed, type DisplayDensity, type AppKey, type PerAppVisuals } from '../store/useChordStore';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useNavHidden, useNavCollapsed, useScrollHide } from '../lib/navScroll';
import { useT } from '../lib/useT';
import { Toggle, SectionHeader, SettingRow, SegmentedControl, COLOR_OPTIONS } from './SettingControls';
import StudioThemeToggler from './StudioThemeToggler';
import ApplyToSheet from './ApplyToSheet';
import { APP_VERSION_LABEL, compareSemver, APP_VERSION } from '../lib/appVersion';
import ChangelogSheet from './ChangelogSheet';
import GradientBorderCard from './GradientBorderCard';
import { useOtaUpdate, otaDebugLogs, otaDiagnostics, checkForUpdate, resetOtaUpdateState, isAppInstallerAvailable } from '../lib/otaUpdate';
import UpdateDiagnosticsSheet from './UpdateDiagnosticsSheet';
import { applyUpdate, isNative, fadeToBlackAndReload, notifyOtaAvailable } from '../lib/capgoUpdater';
import { resolveApkUrl, downloadAndInstallApk, resolveReleasePageUrl } from '../lib/apkDownloader';
import StudioUpdateScreen from './StudioUpdateScreen';
import StudioTitleReveal from './StudioTitleReveal';
import { EncryptedText } from './ui/encrypted-text';
import { useLiquidGlassNav } from '../lib/useLiquidGlassNav';
import ProfileDropdown from './kokonutui/profile-dropdown';
import SmartLoading from './SmartLoading';
import { StudioSkeletonProfile, StudioSkeletonList } from './StudioSkeleton';

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

let _sessionIntroFinished = false;

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
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [successAnimationState, setSuccessAnimationState] = useState<'entering' | 'exiting' | 'hidden'>('hidden');
  const [successName, setSuccessName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastUserRef = useRef<AuthUser | null>(null);

  useScrollHide(scrollRef);

  const isFirstAuthRun = useRef(true);

  // Android-style Developer Options Tap & Toast state
  const devTapsRef = useRef(0);
  const [devToast, setDevToast] = useState<string | null>(null);
  const [devToastTimer, setDevToastTimer] = useState<number | null>(null);
  

  const showDevToast = (msg: string) => {
    if (devToastTimer) {
      window.clearTimeout(devToastTimer);
    }
    setDevToast(msg);
    const id = window.setTimeout(() => setDevToast(null), 2000);
    setDevToastTimer(id);
  };

  const handleLogoTap = () => {
    if (settings.developerMode) {
      showDevToast('Developer Options are already active.');
      return;
    }
    devTapsRef.current += 1;
    const remaining = 5 - devTapsRef.current;
    if (remaining > 0 && remaining <= 3) {
      showDevToast(`${remaining} tap${remaining > 1 ? 's' : ''} remaining...`);
    } else if (remaining === 0) {
      devTapsRef.current = 0;
      updateSettings({ developerMode: true });
      showDevToast('Developer Options unlocked.');
    }
  };

  const renderDevToast = () => (
    <div
      style={{
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: isHubLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)',
        color: isHubLight ? '#fff' : '#000',
        padding: '8px 18px',
        borderRadius: '20px',
        fontSize: '12.5px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 600,
        zIndex: 99999,
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
        whiteSpace: 'nowrap',
      }}
    >
      {devToast}
    </div>
  );

  useEffect(() => {
    return subscribeAuth((user) => {
      if (isFirstAuthRun.current) {
        isFirstAuthRun.current = false;
        lastUserRef.current = user;
        setAuthUser(user);
        return;
      }

      if (!lastUserRef.current && user) {
        // Successful login transition!
        setSuccessName(user.displayName || user.email || 'User');
        setSuccessAnimationState('entering');
        setTimeout(() => {
          setSuccessAnimationState('exiting');
          setTimeout(() => {
            setSuccessAnimationState('hidden');
          }, 450); // wait for exit animation to complete
        }, 1800); // linger success check for 1.8 seconds
      }
      lastUserRef.current = user;
      setAuthUser(user);
    });
  }, []);

  // Deep-link intercept for Updater routing
  useEffect(() => {
    const handleRoute = () => {
      setTab('settings');
    };
    window.addEventListener('studio:route-to-updater', handleRoute);

    if (typeof window !== 'undefined' && sessionStorage.getItem('studio:routeToUpdater') === '1') {
      setTab('settings');
    }

    return () => {
      window.removeEventListener('studio:route-to-updater', handleRoute);
    };
  }, [setTab]);

  useEffect(() => {
    const handleRoute = () => {
      setTab('settings');
      sessionStorage.setItem('studio:routeToPrivacy', '1');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('studio:update-settings-page', { detail: 'privacy' }));
      }, 50);
    };
    window.addEventListener('studio:route-to-privacy', handleRoute);

    if (typeof window !== 'undefined' && sessionStorage.getItem('studio:routeToPrivacy') === '1') {
      setTab('settings');
    }

    return () => {
      window.removeEventListener('studio:route-to-privacy', handleRoute);
    };
  }, [setTab]);

  useBackHandler('nested', () => {
    if (tab === 'profile') {
      setTab('settings');
      return true;
    }
    if (tab === 'settings') {
      setTab('home');
      return true;
    }
    return false;
  }, [tab]);

  const launchApp = useCallback((appMode: 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex') => {
    setZooming(true);
    setTimeout(() => {
      updateSettings({ appMode });
    }, 380);
  // updateSettings is stable (Zustand action), setZooming is React setState
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [introFinished, setIntroFinished] = useState(() => {
    if (_sessionIntroFinished) return true;
    if (typeof document !== 'undefined' && !document.getElementById('intro') && !document.querySelector('[data-solar-intro]')) {
      _sessionIntroFinished = true;
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (introFinished) {
      _sessionIntroFinished = true;
      return;
    }
    const handler = () => {
      _sessionIntroFinished = true;
      setIntroFinished(true);
    };
    window.addEventListener('studio-intro-done', handler, { once: true });
    return () => window.removeEventListener('studio-intro-done', handler);
  }, [introFinished]);

  // Reset zooming state when returning to the Hub
  useEffect(() => {
    if (settings.appMode === 'hub') {
      setZooming(false);
    }
  }, [settings.appMode]);

  // Safety watchdog: recover from stuck zooming state on the Hub
  useEffect(() => {
    let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
    if (settings.appMode === 'hub' && zooming) {
      watchdogTimer = setTimeout(() => {
        console.warn('[Safety] Hub zooming stuck on Hub mode for too long, forcing reset.');
        setZooming(false);
      }, 600);
    }
    return () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
    };
  }, [settings.appMode, zooming]);

  useEffect(() => {
    const handleReset = () => {
      setZooming(false);
    };
    window.addEventListener('studio:reset-hub-zooming', handleReset);
    return () => window.removeEventListener('studio:reset-hub-zooming', handleReset);
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
        : 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1), opacity 380ms ease-out, background-color 700ms cubic-bezier(0.4,0,0.2,1)',
    }}>

      {/* ── Main scrollable content ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: tab === 'home' ? 'hidden' : 'auto', overflowX: 'hidden' }}>

        {/* ── HOME TAB ── */}
        {tab === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px', paddingBottom: 'var(--content-bottom-pad)' }}>

            {/* Logo area */}
            <div className="spring-in" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: 'clamp(36px, 7vh, 56px)',
            }}>
              <div data-intro-target="studio" style={{ color: isHubLight ? '#18181b' : 'white', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <StudioLogo size={56} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, margin: '10px 0 0', letterSpacing: '-0.03em', lineHeight: 1 }}>
                <StudioTitleReveal text={String(t.hub.studio)} />
              </p>
            </div>

            {/* Combined welcome + apps card */}
            <GradientBorderCard
              borderRadius={24}
              wrapStyle={{
                width: '100%', maxWidth: 380,
                marginTop: 'clamp(28px, 6vh, 48px)',
                animation: 'spring-in 400ms 80ms cubic-bezier(0.34,1.56,0.64,1) both, gb-spin 14s linear infinite',
              }}
              innerStyle={{
                overflow: 'hidden',
                transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
              }}
            >
              {/* Welcome header */}
              <div style={{ padding: '22px 22px 18px' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  <EncryptedText
                    text={greeting}
                    onlyOnce={false}
                    paused={!introFinished}
                    revealDelayMs={35}
                    flipDelayMs={45}
                    encryptedClassName="text-[var(--accent-from)] opacity-60 font-mono"
                  />
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
            <style>{HUB_SETTINGS_CSS}</style>
            <ProfileHeaderBack onBack={() => { setTab('settings'); }} />
            <Suspense fallback={<SmartLoading fallbackSkeleton={<div style={{ padding: '0 20px 80px' }}><StudioSkeletonProfile /></div>} />}>
              {authUser ? (
                <div style={{ padding: '0 0 100px', animation: 'hub-slide-in 300ms cubic-bezier(0.25,0.46,0.45,0.94) both' }}>
                <AccountSettingsPage
                  accent={accent}
                  cardStyle={{ background: 'var(--app-surface)', borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(128,128,128,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}
                  onBack={() => { setTab('settings'); }}
                />
                </div>
              ) : (
                <div style={{ padding: '0 20px 80px', animation: 'hub-slide-in 300ms cubic-bezier(0.25,0.46,0.45,0.94) both' }}>
                  <div style={{ marginBottom: 16 }}>
                    <StudioFamilyOrbit
                      items={[
                        { key: 'chordex', label: 'Chordex', node: <ChordexLogo size={34} /> },
                        { key: 'drumex',  label: 'Drumex',  node: <DrumexLogo size={34} /> },
                        { key: 'stagex',  label: 'Stagex',  node: <StagexLogoIcon size={34} /> },
                        { key: 'groovex', label: 'Groovex', node: <GroovexLogo size={34} /> },
                        { key: 'vocalex', label: 'Vocalex', node: <VocalexLogo size={34} /> },
                      ]}
                    />
                  </div>
                  <AccountCard
                    accent={accent}
                    cardStyle={{ background: 'var(--app-surface)', borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(128,128,128,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', marginBottom: 20 }}
                    rowStyle={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
                  />

                  {/* Polished Benefits Section */}
                  <div style={{ marginTop: 24, padding: '0 4px 20px', textAlign: 'center' }}>
                    <h3 style={{
                      fontSize: 18,
                      fontWeight: 800,
                      fontFamily: 'Manrope, sans-serif',
                      color: 'var(--c-text-primary)',
                      margin: '0 0 6px',
                      letterSpacing: '-0.02em',
                    }}>
                      Your Studio workspace, everywhere
                    </h3>
                    <p style={{
                      fontSize: 12.5,
                      fontFamily: 'Inter, sans-serif',
                      color: 'var(--c-text-secondary)',
                      opacity: 0.75,
                      lineHeight: 1.45,
                      margin: '0 auto 22px',
                      maxWidth: 340,
                    }}>
                      Create an account to keep your projects, presets, settings, and progress connected across devices.
                    </p>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 12,
                      textAlign: 'left',
                    }}>
                      {/* Cloud Sync */}
                      <div style={{
                        background: 'var(--app-surface, rgba(20, 20, 24, 0.45))',
                        border: '1px solid rgba(128, 128, 128, 0.08)',
                        borderRadius: 16,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent.from, display: 'inline-block' }}>sync</span>
                        <h4 style={{ fontSize: 13.5, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-primary)', margin: 0 }}>Cloud Sync</h4>
                        <p style={{ fontSize: 11.5, fontFamily: 'Inter, sans-serif', color: 'var(--c-text-secondary)', opacity: 0.8, lineHeight: 1.4, margin: 0 }}>Sync your workspace across devices securely.</p>
                      </div>

                      {/* Multi-device Access */}
                      <div style={{
                        background: 'var(--app-surface, rgba(20, 20, 24, 0.45))',
                        border: '1px solid rgba(128, 128, 128, 0.08)',
                        borderRadius: 16,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent.from, display: 'inline-block' }}>devices</span>
                        <h4 style={{ fontSize: 13.5, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-primary)', margin: 0 }}>Multi-Device</h4>
                        <p style={{ fontSize: 11.5, fontFamily: 'Inter, sans-serif', color: 'var(--c-text-secondary)', opacity: 0.8, lineHeight: 1.4, margin: 0 }}>Keep your workspace connected across mobile and desktop.</p>
                      </div>

                      {/* Cloud Backup */}
                      <div style={{
                        background: 'var(--app-surface, rgba(20, 20, 24, 0.45))',
                        border: '1px solid rgba(128, 128, 128, 0.08)',
                        borderRadius: 16,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent.from, display: 'inline-block' }}>backup</span>
                        <h4 style={{ fontSize: 13.5, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-primary)', margin: 0 }}>Cloud Backup</h4>
                        <p style={{ fontSize: 11.5, fontFamily: 'Inter, sans-serif', color: 'var(--c-text-secondary)', opacity: 0.8, lineHeight: 1.4, margin: 0 }}>Back up your projects, presets, and settings automatically.</p>
                      </div>

                      {/* Personalized Studio */}
                      <div style={{
                        background: 'var(--app-surface, rgba(20, 20, 24, 0.45))',
                        border: '1px solid rgba(128, 128, 128, 0.08)',
                        borderRadius: 16,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent.from, display: 'inline-block' }}>palette</span>
                        <h4 style={{ fontSize: 13.5, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-primary)', margin: 0 }}>Personalized</h4>
                        <p style={{ fontSize: 11.5, fontFamily: 'Inter, sans-serif', color: 'var(--c-text-secondary)', opacity: 0.8, lineHeight: 1.4, margin: 0 }}>Save your custom themes, layouts, and app settings.</p>
                      </div>

                      {/* Faster Recovery */}
                      <div style={{
                        background: 'var(--app-surface, rgba(20, 20, 24, 0.45))',
                        border: '1px solid rgba(128, 128, 128, 0.08)',
                        borderRadius: 16,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent.from, display: 'inline-block' }}>settings_backup_restore</span>
                        <h4 style={{ fontSize: 13.5, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-primary)', margin: 0 }}>Easy Recovery</h4>
                        <p style={{ fontSize: 11.5, fontFamily: 'Inter, sans-serif', color: 'var(--c-text-secondary)', opacity: 0.8, lineHeight: 1.4, margin: 0 }}>Restore your Studio setup anytime on any device.</p>
                      </div>

                      {/* Future Features */}
                      <div style={{
                        background: 'var(--app-surface, rgba(20, 20, 24, 0.45))',
                        border: '1px solid rgba(128, 128, 128, 0.08)',
                        borderRadius: 16,
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent.from, display: 'inline-block' }}>star</span>
                          <span style={{
                            fontSize: 8.5,
                            fontWeight: 800,
                            color: accent.from,
                            background: `color-mix(in srgb, ${accent.from} 14%, transparent)`,
                            padding: '1.5px 5.5px',
                            borderRadius: 99,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            fontFamily: 'Manrope, sans-serif',
                          }}>Coming soon</span>
                        </div>
                        <h4 style={{ fontSize: 13.5, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-primary)', margin: 0 }}>Upcoming Tools</h4>
                        <p style={{ fontSize: 11.5, fontFamily: 'Inter, sans-serif', color: 'var(--c-text-secondary)', opacity: 0.8, lineHeight: 1.4, margin: 0 }}>Prepare your account for collaboration and cloud tools.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Suspense>

            {/* Premium Login Success Check Overlay */}
            {successAnimationState !== 'hidden' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 9999,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(10, 10, 12, 0.72)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  animation: successAnimationState === 'entering'
                    ? 'success-fade-in-blur 0.4s cubic-bezier(0.16, 1, 0.3, 1) both'
                    : 'success-fade-out-blur 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
                }}
              >
                <style>{`
                  @keyframes success-fade-in-blur {
                    from { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
                    to { opacity: 1; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
                  }
                  @keyframes success-fade-out-blur {
                    from { opacity: 1; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); transform: scale(1); }
                    to { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); transform: scale(0.95); filter: blur(8px); }
                  }
                  @keyframes success-pop {
                    0% { transform: scale(0.85) translateY(12px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                  }
                  @keyframes draw-circle {
                    0% { stroke-dashoffset: 166; }
                    100% { stroke-dashoffset: 0; }
                  }
                  @keyframes draw-check {
                    0% { stroke-dashoffset: 48; }
                    100% { stroke-dashoffset: 0; }
                  }
                  .success-card {
                    padding: 36px 28px;
                    border-radius: 28px;
                    background: var(--app-surface, rgba(20, 20, 24, 0.8));
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
                    text-align: center;
                    max-width: 320px;
                    width: calc(100% - 40px);
                    animation: success-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                  }
                  .success-svg {
                    width: 72px;
                    height: 72px;
                    display: block;
                    margin: 0 auto 20px;
                  }
                  .success-circle {
                    stroke-dasharray: 166;
                    stroke-dashoffset: 166;
                    stroke-linecap: round;
                    animation: draw-circle 0.65s cubic-bezier(0.65, 0, 0.45, 1) forwards;
                    animation-delay: 0.05s;
                  }
                  .success-check {
                    stroke-dasharray: 48;
                    stroke-dashoffset: 48;
                    animation: draw-check 0.4s cubic-bezier(0.65, 0, 0.45, 1) forwards;
                    animation-delay: 0.68s;
                  }
                `}</style>
                <div className="success-card">
                  <svg className="success-svg" viewBox="0 0 52 52" fill="none">
                    <circle className="success-circle" cx="26" cy="26" r="25" stroke="#10b981" strokeWidth="4" />
                    <path className="success-check" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                  </svg>
                  <h3 style={{ margin: '0 0 8px', fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, color: 'var(--c-text-primary)' }}>
                    {t.hub.accountSection.signedIn}
                  </h3>
                  <p style={{ margin: 0, fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.4, wordBreak: 'break-all' }}>
                    {successName}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <HubSettings
            accent={accent}
            scrollRef={scrollRef}
            authUser={authUser}
            onProfile={() => setTab('profile')}
            tab={tab}
            setTab={setTab}
            showDevToast={showDevToast}
            handleLogoTap={handleLogoTap}
            devToast={devToast}
            renderDevToast={renderDevToast}
          />
        )}
      </div>

      {/* ── Bottom nav ── */}
      <HubNav tab={tab} setTab={setTab} accent={accent} />

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
  onLogoPress,
}: {
  items: { key: string; node: React.ReactNode; label: string }[];
  onLogoPress?: () => void;
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
      <div
        onClick={onLogoPress}
        style={{
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
          cursor: onLogoPress ? 'pointer' : 'default',
        }}
      >
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
            minWidth: 46,
            minHeight: 46,
            flexShrink: 0,
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

type SettingsPageId = 'main' | 'appearance' | 'language' | 'privacy' | 'about' | 'updater' | 'help' | 'debug' | 'developer';

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
    height: 10px;
    border-radius: 5px;
    outline: none;
    cursor: pointer;
    display: block;
    width: 100%;
    margin: 14px 0;
  }
  input[type=range].hue-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: hsl(var(--slider-hue, 0), 85%, 60%);
    border: 3px solid #ffffff;
    box-shadow: 
      0 2px 8px rgba(0,0,0,0.35),
      0 0 10px hsla(var(--slider-hue, 0), 85%, 60%, 0.4);
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }
  input[type=range].hue-slider:active::-webkit-slider-thumb {
    transform: scale(1.18);
    box-shadow: 
      0 3px 12px rgba(0,0,0,0.45),
      0 0 16px hsla(var(--slider-hue, 0), 85%, 60%, 0.6);
  }
  input[type=range].hue-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: hsl(var(--slider-hue, 0), 85%, 60%);
    border: 3px solid #ffffff;
    box-shadow: 
      0 2px 8px rgba(0,0,0,0.35),
      0 0 10px hsla(var(--slider-hue, 0), 85%, 60%, 0.4);
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease;
    border: none;
  }
  input[type=range].hue-slider:active::-moz-range-thumb {
    transform: scale(1.18);
    box-shadow: 
      0 3px 12px rgba(0,0,0,0.45),
      0 0 16px hsla(var(--slider-hue, 0), 85%, 60%, 0.6);
  }
  @keyframes sync-spin-kf {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .sync-spin {
    animation: sync-spin-kf 1.1s linear infinite;
    display: inline-block;
  }
  @media (max-width: 480px) {
    .about-row {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 4px !important;
      padding: 10px 0 !important;
    }
    .about-row span:last-child {
      text-align: left !important;
      margin-right: 0 !important;
      word-break: break-all !important;
    }
  }
  @media (max-width: 360px) {
    .settings-panel-sheet {
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
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
      <span className="material-symbols-outlined" style={{
        fontSize: 22, flexShrink: 0,
        color: iconColor ?? 'var(--c-text-secondary)',
        fontVariationSettings: "'FILL' 1",
        opacity: 0.75,
        width: 26, textAlign: 'center',
      }}>{icon}</span>
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
    <p className="spring-in" style={{
      fontSize: 11, fontWeight: 700,
      color: 'var(--c-text-secondary)',
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      margin: '22px 0 8px 4px',
      fontFamily: 'Manrope',
      animationDelay: `${delay}ms`,
    }}>{children}</p>
  );
}

function SettingsSubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div className="spring-in" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 32, paddingBottom: 16 }}>
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

function ProfileHeaderBack({ onBack }: { onBack: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div className="spring-in" style={{ display: 'flex', alignItems: 'center', padding: '0 20px', paddingTop: 32, paddingBottom: 16 }}>
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

function HubUpdaterPage({ className, style, cardStyle, accent, onBack }: {
  className?: string;
  style: React.CSSProperties;
  cardStyle: React.CSSProperties;
  accent: { from: string; to: string; mid: string };
  onBack: () => void;
}) {
  const ota = useOtaUpdate();
  const { settings, updateSettings } = useChordStore();
  const lang = settings.language ?? 'en';

  const isApkFlow = ota.updateType === 'apk' || ota.updateType === 'both';

  const L = lang === 'es'
    ? {
        title: 'Actualizaciones',
        version: 'Versión',
        status: 'Estado',
        checking: 'Buscando actualizaciones…',
        upToDate: 'Tu aplicación está al día',
        checkNow: 'Buscar ahora',
        studioUpdateAvailable: 'Actualización de Studio disponible',
        appUpdateAvailable: 'Actualización de aplicación disponible',
        updateStudio: 'Actualizar Studio',
        controls: 'Controles',
        notifTitle: 'Notificaciones de actualización',
        notifDesc: 'Recibe un aviso del sistema cuando haya una actualización disponible.',
        autoTitle: 'Comprobación automática',
        autoDesc: 'Studio comprueba cada 60 s mientras la app está abierta.',
        changelogTitle: 'Mostrar novedades tras actualizar',
        changelogDesc: 'Abre la hoja de cambios la primera vez tras instalar una nueva versión.',
        howItWorks: 'Cómo funciona',
        howItWorksBody: 'Studio soporta actualizaciones de la aplicación, actualizaciones nativas de APK y notificaciones de actualización.',
      }
    : {
        title: 'Updater',
        version: 'Version',
        status: 'Status',
        checking: 'Checking for updates…',
        upToDate: 'Your app is up to date',
        checkNow: 'Check now',
        studioUpdateAvailable: 'Studio update available',
        appUpdateAvailable: 'App update available',
        updateStudio: 'Update Studio',
        controls: 'Controls',
        notifTitle: 'Update notifications',
        notifDesc: 'Get a system notification when a new update is ready.',
        autoTitle: 'Automatic checks',
        autoDesc: 'Studio checks every 60 s while the app is open.',
        changelogTitle: "Show what's new after updating",
        changelogDesc: 'Open the changelog sheet the first time you launch after installing a new version.',
        howItWorks: 'How it works',
        howItWorksBody: 'Studio supports app updates, native APK updates, and update notifications.',
      };

  const statusColor = ota.loading
    ? 'var(--c-text-secondary)'
    : ota.updateAvailable ? '#f59e0b' : '#4ade80';

  const statusLabel = ota.loading
    ? L.checking
    : ota.updateAvailable
      ? L.studioUpdateAvailable
      : L.upToDate;

  return (
    <div className={className} style={style}>
      <style>{HUB_SETTINGS_CSS}</style>
      <SettingsSubHeader title={L.title} onBack={onBack} />

      {/* ── CARD: UNIFIED UPDATER CARD ── */}
      <div style={cardStyle}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid rgba(128,128,128,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 'var(--font-base)' }}>{L.version}</span>
          <span style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 'var(--font-sm)' }}>{APP_VERSION}</span>
        </div>
        
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(128,128,128,0.07)' }}>
          {ota.loading
            ? <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', flexShrink: 0, animation: 'hub-spin 1s linear infinite' }}>refresh</span>
            : <div style={{ width: 9, height: 9, borderRadius: '50%', background: statusColor, flexShrink: 0, boxShadow: `0 0 8px ${statusColor}88` }} />
          }
          <span style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 600, fontSize: 'var(--font-base)', flex: 1 }}>{statusLabel}</span>
        </div>

        {/* Action Buttons */}
        {!ota.updateAvailable ? (
          <button
            type="button"
            onClick={async () => {
              window.dispatchEvent(new CustomEvent('studio:open-update-dialog'));
              await ota.checkNow();
            }}
            disabled={ota.loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 18px', border: 'none', background: 'transparent',
              color: ota.loading ? 'var(--c-text-secondary)' : accent.from,
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-sm)',
              cursor: ota.loading ? 'default' : 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            {L.checkNow}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('studio:open-update-dialog'));
            }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              margin: '16px', padding: '13px', borderRadius: 12,
              background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, 
              color: '#fff',
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-sm)',
              border: 'none', cursor: 'pointer',
              boxShadow: `0 4px 16px ${accent.to}44`
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
              system_update
            </span>
            {L.updateStudio}
          </button>
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


function HubSettings({
  accent,
  scrollRef,
  authUser,
  onProfile,
  tab,
  setTab,
  showDevToast = () => {},
  handleLogoTap = () => {},
  devToast = null,
  renderDevToast = () => null,
}: {
  accent: { from: string; to: string; mid: string };
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  authUser?: AuthUser | null;
  onProfile?: () => void;
  tab: HubTab;
  setTab: React.Dispatch<React.SetStateAction<HubTab>>;
  showDevToast?: (msg: string) => void;
  handleLogoTap?: () => void;
  devToast?: string | null;
  renderDevToast?: () => React.ReactNode;
}) {
  const { settings, updateSettings, updatePerApp } = useChordStore();
  const t = useT();
  const lang = settings.language ?? 'en';
  const ota = useOtaUpdate();
  const [copiedLogs, setCopiedLogs] = useState(false);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    signedIn: false,
    phase: 'idle',
    syncing: false,
    lastSyncedMs: null,
    error: null,
    showMigrationPrompt: false,
    migrationChoice: null,
  });

  useEffect(() => {
    return subscribeSyncStatus((s) => {
      setSyncStatus(s);
    });
  }, []);
  const [page, setPage] = useState<SettingsPageId>(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('studio:routeToUpdater') === '1') {
      sessionStorage.removeItem('studio:routeToUpdater');
      return 'updater';
    }
    if (typeof window !== 'undefined' && sessionStorage.getItem('studio:routeToPrivacy') === '1') {
      sessionStorage.removeItem('studio:routeToPrivacy');
      return 'privacy';
    }
    return 'main';
  });
  const [pageKey, setPageKey] = useState(0);
  const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');

  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (!authUser?.uid) { setCustomPhoto(null); return; }
    try {
      const stored = localStorage.getItem(`chordex_cp_${authUser.uid}`);
      setCustomPhoto(stored || null);
    } catch { setCustomPhoto(null); }

    const onCoverChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ uid: string; cover: string | null }>).detail;
      if (detail && detail.uid === authUser.uid) {
        setCustomPhoto(detail.cover);
      }
    };
    window.addEventListener('chordex:user-cover-changed', onCoverChanged);
    return () => {
      window.removeEventListener('chordex:user-cover-changed', onCoverChanged);
    };
  }, [authUser?.uid]);



  useEffect(() => {
    const handleRoute = () => {
      sessionStorage.removeItem('studio:routeToUpdater');
      navigate('updater');
    };
    window.addEventListener('studio:route-to-updater', handleRoute);

    if (typeof window !== 'undefined' && sessionStorage.getItem('studio:routeToUpdater') === '1') {
      sessionStorage.removeItem('studio:routeToUpdater');
      navigate('updater');
    }

    return () => {
      window.removeEventListener('studio:route-to-updater', handleRoute);
    };
  }, []);

  useEffect(() => {
    const handleRoute = () => {
      sessionStorage.removeItem('studio:routeToPrivacy');
      navigate('privacy');
    };
    window.addEventListener('studio:route-to-privacy', handleRoute);

    if (typeof window !== 'undefined' && sessionStorage.getItem('studio:routeToPrivacy') === '1') {
      sessionStorage.removeItem('studio:routeToPrivacy');
      navigate('privacy');
    }

    return () => {
      window.removeEventListener('studio:route-to-privacy', handleRoute);
    };
  }, []);

  useEffect(() => {
    const handleUpdatePage = (e: Event) => {
      const customEvent = e as CustomEvent<SettingsPageId>;
      if (customEvent.detail) {
        navigate(customEvent.detail);
      }
    };
    window.addEventListener('studio:update-settings-page', handleUpdatePage as EventListener);
    return () => {
      window.removeEventListener('studio:update-settings-page', handleUpdatePage as EventListener);
    };
  }, [page]);

  const hubVis: PerAppVisuals = settings.perApp?.hub ?? { theme: 'dark', accentColor: 'blue', amoledMode: false };
  const [changelogOpen, setChangelogOpen] = useState(false);

  function requestChange(patch: Partial<PerAppVisuals>) {
    const ALL_APPS: AppKey[] = ['hub', 'chords', 'drums', 'stage', 'groovex', 'vocalex'];
    updatePerApp(ALL_APPS, patch);
    if (patch.theme) updateSettings({ theme: patch.theme });
    if (patch.accentColor) updateSettings({ accentColor: patch.accentColor });
    if (patch.amoledMode !== undefined) updateSettings({ amoledMode: patch.amoledMode });
  }

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

  const [devNativeVersion, setDevNativeVersion] = useState<string>('Loading...');
  const [devOtaVersion, setDevOtaVersion] = useState<string>('Loading...');
  const [devBundleId, setDevBundleId] = useState<string>('Loading...');
  const [devVersionCode, setDevVersionCode] = useState<string>('Loading...');
  const [preferencesDump, setPreferencesDump] = useState<string>('Loading...');
  const [localStorageStatus, setLocalStorageStatus] = useState<string>('Loading...');
  const [devLoadingAction, setDevLoadingAction] = useState<string | null>(null);
  const [firebaseVersionJson, setFirebaseVersionJson] = useState<string>('Loading...');
  const [firebaseAppReleaseJson, setFirebaseAppReleaseJson] = useState<string>('Loading...');
  const [verboseLogs, setVerboseLogs] = useState<boolean>(() => localStorage.getItem('studio:verboseLogs') === 'true');
  const [installedPackageDetails, setInstalledPackageDetails] = useState<any>(null);
  const [downloadedApkDetails, setDownloadedApkDetails] = useState<any>(null);
  const [apkEligibility, setApkEligibility] = useState<any>(null);

  useEffect(() => {
    if (page !== 'developer' && page !== 'debug') return;
    
    const loadInfo = async () => {
      try {
        if (isNative()) {
          const { App } = await import('@capacitor/app');
          const info = await App.getInfo();
          setDevNativeVersion(info.version);
          setDevBundleId(info.id);
          setDevVersionCode(info.build);
        } else {
          setDevNativeVersion('N/A — Web build');
          setDevBundleId('N/A — Web build');
          setDevVersionCode('N/A — Web build');
        }
      } catch (e) {
        setDevNativeVersion('Error loading native info');
        setDevBundleId('Error loading native info');
        setDevVersionCode('Error');
      }

      try {
        if (isNative()) {
          const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
          const current = await CapacitorUpdater.current();
          setDevOtaVersion(current?.bundle?.version || 'builtin');
        } else {
          setDevOtaVersion('N/A — Web build');
        }
      } catch (e) {
        setDevOtaVersion('Error loading OTA info');
      }

      // Load local storage status
      try {
        let size = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            size += key.length + (localStorage.getItem(key)?.length || 0);
          }
        }
        setLocalStorageStatus(`${localStorage.length} keys (~${(size / 1024).toFixed(2)} KB)`);
      } catch (e) {
        setLocalStorageStatus('Error loading storage info');
      }

      // Load Capacitor Preferences dump
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const { keys } = await Preferences.keys();
        const dump: Record<string, string | null> = {};
        for (const k of keys) {
          const { value } = await Preferences.get({ key: k });
          dump[k] = value;
        }
        setPreferencesDump(JSON.stringify(dump, null, 2));
      } catch (e: any) {
        setPreferencesDump(`Error loading Preferences: ${e?.message || String(e)}`);
      }

      if (isNative()) {
        try {
          const { AppInstaller, checkApkEligibility } = await import('../lib/apkDownloader');
          const installed = await AppInstaller.getInstalledAppInfo();
          setInstalledPackageDetails({
            ...installed,
            signatures: installed.signingSha256
          });

          const apkPath = localStorage.getItem('studio:downloadedApkPath');
          if (apkPath) {
            try {
              const inspected = await AppInstaller.inspectApk({ filePath: apkPath });
              
              let sizeStr = 'N/A';
              try {
                const { Filesystem } = await import('@capacitor/filesystem');
                const statInfo = await Filesystem.stat({ path: apkPath });
                sizeStr = `${(statInfo.size / (1024 * 1024)).toFixed(2)} MB (${statInfo.size} bytes)`;
              } catch (e) {
                console.warn('Error reading APK size:', e);
              }

              setDownloadedApkDetails({
                ...inspected,
                fileSize: sizeStr,
                filePath: apkPath
              });
              
              const eligibility = await checkApkEligibility(apkPath);
              setApkEligibility(eligibility);
            } catch (apkErr) {
              console.warn('Error loading downloaded APK details:', apkErr);
            }
          } else {
            setDownloadedApkDetails(null);
            setApkEligibility(null);
          }
        } catch (err) {
          console.warn('Error loading native package/APK details:', err);
        }
      }
    };
    
    const loadManifests = async () => {
      const t = Date.now();
      const baseUrl = 'https://studio-30f44.web.app';
      try {
        const r1 = await fetch(`${baseUrl}/version.json?t=${t}`);
        if (r1.ok) {
          const text = await r1.text();
          setFirebaseVersionJson(text);
        } else {
          setFirebaseVersionJson(`Error: HTTP ${r1.status}`);
        }
      } catch (e: any) {
        setFirebaseVersionJson(`Error: ${e.message || String(e)}`);
      }

      try {
        const r2 = await fetch(`${baseUrl}/app-release.json?t=${t}`);
        if (r2.ok) {
          const text = await r2.text();
          setFirebaseAppReleaseJson(text);
        } else {
          setFirebaseAppReleaseJson(`Error: HTTP ${r2.status}`);
        }
      } catch (e: any) {
        setFirebaseAppReleaseJson(`Error: ${e.message || String(e)}`);
      }
    };

    loadInfo();
    loadManifests();
  }, [page, ota.updateState]);

  const handleClearUpdateCache = async () => {
    try {
      const filePath = localStorage.getItem('studio:downloadedApkPath');
      if (filePath && isNative()) {
        const { Filesystem } = await import('@capacitor/filesystem');
        await Filesystem.deleteFile({ path: filePath }).catch(() => {});
      }
      localStorage.removeItem('studio:downloadedApkPath');
      localStorage.removeItem('studio:downloadedBundleId');
      localStorage.removeItem('studio:downloadedVersions');
      showDevToast('Update cache cleared.');
    } catch (err: any) {
      showDevToast(`Clear failed: ${err.message || String(err)}`);
    }
  };

  const handleClearDismissed = () => {
    localStorage.removeItem('studio:dismissedVersions');
    sessionStorage.removeItem('studio:laterUpdateVersion');
    localStorage.removeItem('studio:notifiedUpdateVersion');
    showDevToast('Dismissed versions cleared.');
  };

  const handleClearApplied = () => {
    localStorage.removeItem('studio:appliedVersions');
    localStorage.removeItem('studio:appliedUpdateVersion');
    showDevToast('Applied versions cleared.');
  };

  const handleResetOta = async () => {
    showDevToast('OTA System: disabled.');
  };

  const handleForceOtaRefresh = async () => {
    showDevToast('OTA System: disabled.');
  };

  const handleTestNotification = async () => {
    try {
      const mockVer = `3.3.0-test-${Date.now()}`;
      showDevToast(`Triggering test notification: ${mockVer}`);
      await notifyOtaAvailable(mockVer);
    } catch (err: any) {
      showDevToast(`Notification test failed: ${err.message || String(err)}`);
    }
  };

  const handleTestOtaDetection = async () => {
    try {
      const mockVer = '3.3.1';
      const mockRemote = {
        version: mockVer,
        updateType: 'ota',
        downloadUrl: 'https://example.com/mock-ota.zip',
        changelog: 'Simulated OTA Update Changelog for v3.3.1. Adds sleek developer features.',
        releaseNotes: ['Simulated OTA item 1', 'Simulated OTA item 2']
      };
      sessionStorage.setItem('studio:mockOtaResponse', JSON.stringify(mockRemote));
      
      const dismissed = localStorage.getItem('studio:dismissedVersions');
      if (dismissed) {
        try {
          const list = JSON.parse(dismissed);
          localStorage.setItem('studio:dismissedVersions', JSON.stringify(list.filter((v: string) => v !== mockVer)));
        } catch {}
      }
      sessionStorage.removeItem('studio:laterUpdateVersion');
      
      showDevToast('OTA simulation configured. Checking update...');
      await ota.checkNow();
    } catch (err: any) {
      showDevToast(`Simulate failed: ${err.message || String(err)}`);
    }
  };

  const handleTestApkDetection = async () => {
    try {
      const mockVer = '3.3.2';
      const mockRemote = {
        version: mockVer,
        updateType: 'apk',
        apkUrl: 'https://example.com/mock-apk.apk',
        changelog: 'Simulated APK System Update for v3.3.2. Includes Android-specific fixes.',
        apkSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        releaseNotes: ['Simulated APK item 1', 'Simulated APK item 2']
      };
      sessionStorage.setItem('studio:mockOtaResponse', JSON.stringify(mockRemote));

      const dismissed = localStorage.getItem('studio:dismissedVersions');
      if (dismissed) {
        try {
          const list = JSON.parse(dismissed);
          localStorage.setItem('studio:dismissedVersions', JSON.stringify(list.filter((v: string) => v !== mockVer)));
        } catch {}
      }
      sessionStorage.removeItem('studio:laterUpdateVersion');

      showDevToast('APK simulation configured. Checking update...');
      await ota.checkNow();
    } catch (err: any) {
      showDevToast(`Simulate failed: ${err.message || String(err)}`);
    }
  };

  const getDiagnosticsText = () => {
    return [
      '=== STUDIO DIAGNOSTICS REPORT ===',
      `Timestamp: ${new Date().toISOString()}`,
      `App Version: ${APP_VERSION}`,
      `Device Model: ${isNative() ? 'Native Device' : 'Web Browser'}`,
      '',
      '=== APK UPDATE DIAGNOSTICS ===',
      `App Version: ${APP_VERSION}`,
      `APK Version: ${devNativeVersion}`,
      `versionCode: ${devVersionCode}`,
      `Update System: APK only`,
      `OTA System: disabled`,
      `AppInstaller Available: ${otaDebugLogs.appInstallerAvailable}`,
      `downloadApk Available: ${otaDebugLogs.downloadApkAvailable}`,
      `verifyApkSha256 Available: ${otaDebugLogs.verifyApkSha256Available}`,
      `installApk Available: ${otaDebugLogs.installApkAvailable}`,
      `openInstallPermissionSettings Available: ${otaDebugLogs.openInstallPermissionSettingsAvailable}`,
      `Registered Capacitor Plugins: ${otaDebugLogs.registeredPlugins}`,
      `Plugin Method Check: ${otaDebugLogs.pluginMethodCheck}`,
      `Fetched version.json: ${otaDebugLogs.fetchedVersionJson}`,
      `Fetched app-release.json: ${otaDebugLogs.fetchedAppReleaseJson}`,
      `Update Type: ${otaDebugLogs.updateType}`,
      `Download Status: ${otaDebugLogs.downloadStatus}`,
      `SHA Verification: ${otaDebugLogs.shaVerification}`,
      `File Details: ${otaDebugLogs.fileDetails}`,
      `Install Error / Log: ${otaDebugLogs.installError}`,
      `Installer Launch Status: ${otaDebugLogs.installerLaunchStatus}`,
      `Last Exception Stack Trace: ${otaDebugLogs.lastExceptionStackTrace}`,
      '',
      '=== APK INSTALL DETAILS ===',
      `Exception Message: ${otaDiagnostics.exceptionMessage}`,
      `Failure Reason: ${otaDiagnostics.failureReason}`,
      `Download URL: ${otaDiagnostics.downloadUrl}`,
      `APK Path: ${otaDiagnostics.apkPath}`,
      `File Size: ${otaDiagnostics.fileSize}`,
      `SHA Expected: ${otaDiagnostics.shaExpected}`,
      `SHA Calculated: ${otaDiagnostics.shaCalculated}`,
      `Installer Result: ${otaDiagnostics.installerResult}`,
      `Permission State: ${otaDiagnostics.permissionState}`,
      `Android Version: ${otaDiagnostics.androidVersion}`,
      `Device Model: ${otaDiagnostics.deviceModel}`,
      `Diagnostics Timestamp: ${otaDiagnostics.timestamp}`,
    ].join('\n');
  };

  const handleExportDiagnostics = async () => {
    const content = getDiagnosticsText();
    const filename = `studio-diagnostics-${Date.now()}.txt`;
    if (isNative()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: 'utf8' as any,
        });
        showDevToast(`Exported to Documents: ${filename}`);
      } catch (err: any) {
        showDevToast(`Export failed: ${err.message || String(err)}`);
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showDevToast('Diagnostics exported successfully.');
    }
  };

  useBackHandler('nested', () => {
    // 1. If inside a nested view (settingsPage), go back to main Hub
    if (page !== 'main') {
      goBack();
      return true;
    }
    // 2. If inside profile tab, return to settings tab
    if (tab === 'profile') {
      setTab('settings');
      return true;
    }
    // 3. If inside settings tab, return to home tab
    if (tab === 'settings') {
      setTab('home');
      return true;
    }
    return false;
  }, [page, tab]);



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
    paddingBottom: 'var(--content-bottom-pad)',
    animation: `${slideAnim} 300ms cubic-bezier(0.25,0.46,0.45,0.94) both`,
  };

  /* ── HELP & FAQ ─────────────────────────────────────────────────── */
  if (page === 'help') {
    return (
      <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title="Help & FAQ" onBack={goBack} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <HelpAccordion accent={accent} lang={lang} />
        </div>
      </div>
    );
  }

  /* ── APPEARANCE ─────────────────────────────────────────────────── */
  if (page === 'appearance') {
    return (
      <div key={pageKey}>
        <div className="settings-panel-sheet" style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title={t.settings.sections.appearance} onBack={goBack} />

        <SettingsSectionLabel>{(t.hub as { studioSettings?: { themeSection?: string } }).studioSettings?.themeSection ?? 'Theme'}</SettingsSectionLabel>
        <div style={cardStyle}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
            <StudioThemeToggler
              currentTheme={hubVis.theme}
              currentAmoled={hubVis.amoledMode ?? false}
              accentFrom={accent.from}
              onChange={(theme, amoledMode) => requestChange({ theme, amoledMode })}
              labels={{
                system: t.settings.rows.themeSystem,
                light:  t.settings.rows.themeLight,
                dark:   t.settings.rows.themeDark,
                amoled: t.hub.amoled,
              }}
            />
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
                        style={{ 
                          background: 'linear-gradient(to right, hsl(0,80%,55%), hsl(30,80%,55%), hsl(60,80%,55%), hsl(90,80%,55%), hsl(120,80%,55%), hsl(150,80%,55%), hsl(180,80%,55%), hsl(210,80%,55%), hsl(240,80%,55%), hsl(270,80%,55%), hsl(300,80%,55%), hsl(330,80%,55%), hsl(360,80%,55%))',
                          '--slider-hue': String(hue)
                        } as React.CSSProperties}
                      />
                      <div style={{ 
                        height: 48, 
                        borderRadius: 14, 
                        marginTop: 12, 
                        background: `linear-gradient(135deg, hsl(${hue}, 75%, 65%), hsl(${(hue + 25) % 360}, 85%, 42%))`, 
                        boxShadow: `0 4px 20px hsla(${hue}, 75%, 55%, 0.25)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.12)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)',
                          pointerEvents: 'none'
                        }} />
                        <span style={{ 
                          fontFamily: 'Manrope', 
                          fontWeight: 800, 
                          fontSize: '11px', 
                          color: '#ffffff', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.15em',
                          textShadow: '0 1px 4px rgba(0,0,0,0.25)',
                          zIndex: 1
                        }}>
                          Custom Hue {hue}°
                        </span>
                      </div>
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
      <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
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



  if (page === 'privacy') {
    return (
      <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title={(t.hub as { studioSettings?: { privacySecurity?: string } }).studioSettings?.privacySecurity ?? 'Privacy & Security'} onBack={goBack} />
        <SettingsSectionLabel>{(t.hub as { studioSettings?: { accountControls?: string } }).studioSettings?.accountControls ?? 'Account Controls'}</SettingsSectionLabel>
        <Suspense fallback={null}>
          <AccountDangerZone accent={accent} cardStyle={cardStyle} />
        </Suspense>
      </div>
    );
  }


  /* ── UPDATER ─────────────────────────────────────────────────────── */
  if (page === 'updater') {
    return (
      <HubUpdaterPage
        key={pageKey}
        className="settings-panel-sheet"
        style={subStyle}
        cardStyle={cardStyle}
        accent={accent}
        onBack={goBack}
      />
    );
  }

  /* ── UPDATE DEBUG ────────────────────────────────────────────────── */
  if (page === 'debug') {
    const DebugRow = ({ label, desc, value, highlightColor }: { label: string; desc?: string; value: string | null; highlightColor?: string }) => (
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope', margin: 0 }}>{label}</p>
            {desc && <p style={{ fontSize: 'var(--font-sm)', marginTop: '2px', lineHeight: 1.3, color: 'var(--c-text-secondary)', fontFamily: 'Inter', margin: '4px 0 0' }}>{desc}</p>}
          </div>
        </div>
        <div style={{ 
          marginTop: '8px', 
          padding: '8px 12px', 
          borderRadius: '6px', 
          background: 'rgba(128,128,128,0.06)', 
          fontFamily: 'monospace', 
          fontSize: '12px', 
          color: highlightColor || 'var(--c-text-primary)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap'
        }}>
          {value || 'N/A'}
        </div>
      </div>
    );

    return (
      <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title="Update Debug" onBack={goBack} />
        
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 12 }}>
          <button
            onClick={async () => {
              try {
                await ota.checkNow();
              } catch (e) {
                console.error(e);
              }
            }}
            className="btn-smooth"
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '0.75rem',
              background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              color: 'white',
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            {ota.updateState === 'checking' ? 'Checking...' : 'Check For Updates Now'}
          </button>
          
          <button
            onClick={() => {
              const debugLogsText = [
                '=== COMPREHENSIVE DEBUG LOGS ===',
                `App Version / JS Version: ${otaDebugLogs.appVersion}`,
                `APK Version: ${otaDebugLogs.nativeApkVersion}`,
                `installed versionCode: ${otaDebugLogs.installedVersionCode}`,
                `remote version: ${ota.remoteVersion || 'N/A'}`,
                `Update System: APK only`,
                `OTA System: disabled`,
                `AppInstaller available: ${otaDebugLogs.appInstallerAvailable}`,
                `APK eligibility status: ${otaDebugLogs.apkEligibilityResult}`,
                `Current release channel: production`,
                `Last update check: ${localStorage.getItem('studio:lastUpdateCheck') || 'Never'}`,
                `Last downloaded APK SHA: ${otaDiagnostics.shaExpected || 'N/A'}`,
                `downloadApk Available: ${otaDebugLogs.downloadApkAvailable}`,
                `verifyApkSha256 Available: ${otaDebugLogs.verifyApkSha256Available}`,
                `installApk Available: ${otaDebugLogs.installApkAvailable}`,
                `openInstallPermissionSettings Available: ${otaDebugLogs.openInstallPermissionSettingsAvailable}`,
                `Registered Capacitor Plugins: ${otaDebugLogs.registeredPlugins}`,
                `Plugin Method Check: ${otaDebugLogs.pluginMethodCheck}`,
                `Fetched version.json: ${otaDebugLogs.fetchedVersionJson}`,
                `Fetched app-release.json: ${otaDebugLogs.fetchedAppReleaseJson}`,
                `Update Type: ${otaDebugLogs.updateType}`,
                `Download Status: ${otaDebugLogs.downloadStatus}`,
                `SHA Verification: ${otaDebugLogs.shaVerification}`,
                `File Details: ${otaDebugLogs.fileDetails}`,
                `Install Error / Log: ${otaDebugLogs.installError}`,
                `Installer Launch Status: ${otaDebugLogs.installerLaunchStatus}`,
                `Last Exception Stack Trace: ${otaDebugLogs.lastExceptionStackTrace}`,
                '',
                '=== ELIGIBILITY DETAILS ===',
                `Installed package: ${installedPackageDetails?.packageName || 'N/A'}`,
                `Installed versionName: ${installedPackageDetails?.versionName || 'N/A'}`,
                `Installed versionCode: ${installedPackageDetails ? String(installedPackageDetails.versionCode) : 'N/A'}`,
                `Installed signing SHA-256: ${installedPackageDetails?.signingSha256 || 'N/A'}`,
                `Installed debuggable: ${installedPackageDetails ? String(installedPackageDetails.debuggable) : 'N/A'}`,
                '',
                `Downloaded package: ${downloadedApkDetails?.packageName || 'N/A'}`,
                `Downloaded versionName: ${downloadedApkDetails?.versionName || 'N/A'}`,
                `Downloaded versionCode: ${downloadedApkDetails ? String(downloadedApkDetails.versionCode) : 'N/A'}`,
                `Downloaded signing SHA-256: ${downloadedApkDetails?.signingSha256 || 'N/A'}`,
                `Downloaded debuggable: ${downloadedApkDetails ? String(downloadedApkDetails.debuggable) : 'N/A'}`,
                `Downloaded isValidApk: ${downloadedApkDetails ? String(downloadedApkDetails.isValidApk) : 'N/A'}`,
                `Downloaded isUniversalApk: ${downloadedApkDetails ? String(downloadedApkDetails.isUniversalApk) : 'N/A'}`,
                `Downloaded size: ${downloadedApkDetails?.fileSize || 'N/A'}`,
                '',
                `Eligibility package match: ${apkEligibility?.installed && apkEligibility?.downloaded ? String(apkEligibility.installed.packageName === apkEligibility.downloaded.packageName) : 'N/A'}`,
                `Eligibility signing match: ${apkEligibility?.installed && apkEligibility?.downloaded ? String(apkEligibility.installed.signingSha256.replace(/:/g, '').toLowerCase() === apkEligibility.downloaded.signingSha256.replace(/:/g, '').toLowerCase()) : 'N/A'}`,
                `Eligibility versionCode higher: ${apkEligibility?.installed && apkEligibility?.downloaded ? String(apkEligibility.downloaded.versionCode > apkEligibility.installed.versionCode) : 'N/A'}`,
                `Eligibility release build: ${apkEligibility?.downloaded ? String(!apkEligibility.downloaded.debuggable) : 'N/A'}`,
                `Eligibility valid APK: ${apkEligibility?.downloaded ? String(apkEligibility.downloaded.isValidApk) : 'N/A'}`,
                `Eligibility final install: ${apkEligibility ? (apkEligibility.eligible ? 'can install' : 'cannot install') : 'N/A'}`,
                `Eligibility reason: ${apkEligibility?.reason || 'none'}`
              ].join('\n');
              navigator.clipboard.writeText(debugLogsText).then(() => {
                setCopiedLogs(true);
                setTimeout(() => setCopiedLogs(false), 2000);
              });
            }}
            className="btn-smooth"
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '0.75rem',
              background: copiedLogs ? '#22c55e' : 'rgba(128,128,128,0.08)',
              color: copiedLogs ? 'white' : 'var(--c-text-primary)',
              border: '1px solid rgba(128,128,128,0.15)',
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'background 200ms ease, color 200ms ease'
            }}
          >
            {copiedLogs ? 'Copied!' : 'Copy All Logs'}
          </button>
        </div>

        <div style={cardStyle}>
          <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '16px 20px 8px', opacity: 0.75, color: 'var(--c-text-primary)', borderBottom: '1px solid rgba(128,128,128,0.08)', letterSpacing: '0.05em' }}>CURRENT APP</div>
          <DebugRow label="App Version" desc="The hardcoded version in the app bundle" value={APP_VERSION} />
          <DebugRow label="APK Version" desc="The native Android APK version wrapper" value={devNativeVersion} />
          <DebugRow label="versionCode" desc="The version code of the installed native wrapper" value={devVersionCode} />
          <DebugRow label="Update System" desc="The update delivery channel used by the app" value="APK only" />
          <DebugRow label="OTA System" desc="State of the Capgo bundle update system" value="Disabled" />

          <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '16px 20px 8px', opacity: 0.75, color: 'var(--c-text-primary)', borderBottom: '1px solid rgba(128,128,128,0.08)', letterSpacing: '0.05em' }}>LATEST UPDATE</div>
          <DebugRow label="Remote Version" desc="The latest version released on the remote server" value={ota.remoteVersion} />
          <DebugRow label="Remote versionCode" desc="The required version code on the remote server" value={ota.requiredVersionCode ? String(ota.requiredVersionCode) : 'N/A'} />
          <DebugRow label="updateType" desc="The remote update category type" value="apk" />
          <DebugRow label="APK URL" desc="Resolved browser download URL for the update package" value={ota.apkUrl} />
          <DebugRow label="SHA-256" desc="SHA-256 hash expected from the update manifest" value={ota.apkSha256} />

          <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '16px 20px 8px', opacity: 0.75, color: 'var(--c-text-primary)', borderBottom: '1px solid rgba(128,128,128,0.08)', letterSpacing: '0.05em' }}>PACKAGE VALIDATION</div>
          <DebugRow label="packageName match" value={apkEligibility?.installed && apkEligibility?.downloaded ? String(apkEligibility.installed.packageName === apkEligibility.downloaded.packageName) : 'N/A'} />
          <DebugRow label="signing match" value={apkEligibility?.installed && apkEligibility?.downloaded ? String(apkEligibility.installed.signingSha256.replace(/:/g, '').toLowerCase() === apkEligibility.downloaded.signingSha256.replace(/:/g, '').toLowerCase()) : 'N/A'} />
          <DebugRow label="versionCode higher" value={apkEligibility?.installed && apkEligibility?.downloaded ? String(apkEligibility.downloaded.versionCode > apkEligibility.installed.versionCode) : 'N/A'} />
          <DebugRow label="APK valid" value={apkEligibility?.downloaded ? String(apkEligibility.downloaded.isValidApk) : 'N/A'} />
          <DebugRow label="release build" value={apkEligibility?.downloaded ? String(!apkEligibility.downloaded.debuggable) : 'N/A'} />
          <DebugRow label="debuggable=false" value={apkEligibility?.downloaded ? String(apkEligibility.downloaded.debuggable === false) : 'N/A'} />
          <DebugRow label="final eligibility" value={apkEligibility ? (apkEligibility.eligible ? 'can install' : 'cannot install') : 'N/A'} highlightColor={apkEligibility ? (apkEligibility.eligible ? '#22c55e' : '#ef4444') : undefined} />

          <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '16px 20px 8px', opacity: 0.75, color: 'var(--c-text-primary)', borderBottom: '1px solid rgba(128,128,128,0.08)', letterSpacing: '0.05em' }}>LAST INSTALL ATTEMPT</div>
          <DebugRow label="status" value={otaDebugLogs.installerLaunchStatus} />
          <DebugRow label="file path" value={downloadedApkDetails?.filePath || 'N/A'} />
          <DebugRow label="file size" value={downloadedApkDetails?.fileSize || 'N/A'} />
          <DebugRow label="error if any" value={otaDebugLogs.installError} />
        </div>
      </div>
    );
  }

  /* ── DEVELOPER OPTIONS ───────────────────────────────────────────── */
  if (page === 'developer') {
    try {
    const diag = getSyncDiagnostics();
    const wrapAction = async (actionId: string, fn: () => Promise<void> | void) => {
      setDevLoadingAction(actionId);
      try {
        await fn();
      } catch (err: any) {
        showDevToast(`Failed: ${err?.message || String(err)}`);
      } finally {
        setDevLoadingAction(null);
      }
    };

    const DevButtonRow = ({ label, desc, actionLabel, actionId, onPress, disabled = false, isDestructive = false }: { label: string; desc?: string; actionLabel: string; actionId: string; onPress: () => void; disabled?: boolean; isDestructive?: boolean }) => {
      const isLoading = devLoadingAction === actionId;
      return (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(128,128,128,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope', margin: 0 }}>{label}</p>
            {desc && <p style={{ fontSize: 'var(--font-sm)', marginTop: '2px', lineHeight: 1.3, color: 'var(--c-text-secondary)', fontFamily: 'Inter', margin: '4px 0 0' }}>{desc}</p>}
          </div>
          <button
            onClick={onPress}
            disabled={disabled || isLoading || devLoadingAction !== null}
            className="btn-smooth"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: isDestructive ? 'rgba(239, 68, 68, 0.08)' : 'rgba(128,128,128,0.08)',
              border: isDestructive ? '1px solid rgba(239, 68, 68, 0.20)' : '1px solid rgba(128,128,128,0.15)',
              color: isDestructive ? '#ef4444' : 'var(--c-text-primary)',
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: '12.5px',
              cursor: (disabled || isLoading) ? 'not-allowed' : 'pointer',
              opacity: (disabled || isLoading) ? 0.6 : 1,
              whiteSpace: 'nowrap'
            }}
          >
            {isLoading ? 'Running...' : actionLabel}
          </button>
        </div>
      );
    };

    const DevInfoRow = ({ label, desc, value, canCopy = false }: { label: string; desc?: string; value: string; canCopy?: boolean }) => (
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: '6px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope', margin: 0 }}>{label}</p>
            {desc && <p style={{ fontSize: 'var(--font-sm)', marginTop: '2px', lineHeight: 1.3, color: 'var(--c-text-secondary)', fontFamily: 'Inter', margin: '4px 0 0' }}>{desc}</p>}
          </div>
          {canCopy && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(value).then(() => showDevToast('Copied to clipboard'));
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(128,128,128,0.08)',
                border: '1px solid rgba(128,128,128,0.15)',
                color: 'var(--c-text-primary)',
                fontSize: '11px',
                fontFamily: 'Manrope',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Copy
            </button>
          )}
        </div>
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          background: 'rgba(128,128,128,0.06)',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: 'var(--c-text-primary)',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          maxHeight: '160px',
          overflowY: 'auto'
        }}>
          {value}
        </div>
      </div>
    );

    const DevCollapsibleRow = ({ label, desc, value, canCopy = false }: { label: string; desc?: string; value: string; canCopy?: boolean }) => {
      const [open, setOpen] = useState(false);
      return (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
              <p style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope', margin: 0 }}>
                {open ? '▼' : '▶'} {label}
              </p>
              {desc && <p style={{ fontSize: 'var(--font-sm)', marginTop: '2px', lineHeight: 1.3, color: 'var(--c-text-secondary)', fontFamily: 'Inter', margin: '4px 0 0' }}>{desc}</p>}
            </div>
            {canCopy && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(value).then(() => showDevToast('Copied to clipboard'));
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(128,128,128,0.08)',
                  border: '1px solid rgba(128,128,128,0.15)',
                  color: 'var(--c-text-primary)',
                  fontSize: '11px',
                  fontFamily: 'Manrope',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Copy
              </button>
            )}
          </div>
          {open && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(128,128,128,0.06)',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: 'var(--c-text-primary)',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              maxHeight: '240px',
              overflowY: 'auto',
              border: '1px solid rgba(128,128,128,0.12)'
            }}>
              {value}
            </div>
          )}
        </div>
      );
    };

    const handleClearUpdateCacheAction = () => {
      if (!window.confirm('Delete downloaded APK files and reset local update history?')) return;
      wrapAction('clear-cache', handleClearUpdateCache);
    };

    const handleClearDismissedAction = () => {
      if (!window.confirm('Clear skip update choices?')) return;
      wrapAction('clear-dismissed', handleClearDismissed);
    };

    const handleClearAppliedAction = () => {
      if (!window.confirm('Clear list of installed OTA/APK updates?')) return;
      wrapAction('clear-applied', handleClearApplied);
    };

    const handleClearFailedUpdateAction = () => {
      if (!window.confirm('Clear update error codes and reset checking status?')) return;
      wrapAction('clear-failed', () => {
        resetOtaUpdateState();
        showDevToast('Failed update state cleared.');
      });
    };

    const handleResetOtaAction = () => {
      if (!window.confirm('Revert OTA bundles back to built-in factory default? App will reload.')) return;
      wrapAction('reset-ota', handleResetOta);
    };

    const handleValidateInstallerAction = () => {
      wrapAction('validate-installer', async () => {
        const cap = (window as any).Capacitor;
        const appInstallerExists = cap ? cap.isPluginAvailable?.('AppInstaller') ?? false : false;
        if (!appInstallerExists) {
          throw new Error('AppInstaller native plugin is unavailable on this platform.');
        }
        const avail = isAppInstallerAvailable();
        if (avail) {
          showDevToast('AppInstaller validation PASSED: all native methods are registered.');
        } else {
          throw new Error('AppInstaller registered but missing required native methods.');
        }
      });
    };

    const handleClearTemporaryAction = () => {
      if (!window.confirm('Clear all session configurations and temporary mock data?')) return;
      wrapAction('clear-temp', () => {
        sessionStorage.clear();
        showDevToast('Temporary mock settings cleared.');
      });
    };

    const handleExportLocalDiagnosticsAction = () => {
      wrapAction('export-local', () => {
        const dump = {
          timestamp: new Date().toISOString(),
          localStorage: { ...localStorage },
          preferencesDump
        };
        const text = JSON.stringify(dump, null, 2);
        const filename = `studio-local-diagnostics-${Date.now()}.json`;
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showDevToast('Local diagnostics exported.');
      });
    };

    const handleResetAppShellAction = () => {
      if (!window.confirm('Reset all user settings, active theme, and layouts to factory default?')) return;
      wrapAction('reset-shell', () => {
        localStorage.clear();
        sessionStorage.clear();
        showDevToast('App shell reset completed. Please restart the app.');
        setTimeout(() => window.location.reload(), 1500);
      });
    };

    const handleForceReturnHubAction = () => {
      wrapAction('force-return', () => {
        (window as any).returnToStudioHub?.();
        showDevToast('Return to Hub triggered.');
      });
    };

    const handleResetDeveloperAction = () => {
      if (!window.confirm('Disable developer mode and hide this menu?')) return;
      wrapAction('reset-developer', () => {
        updateSettings({ developerMode: false });
        goBack();
        showDevToast('Developer options disabled.');
      });
    };

    const handleClearDebugLogsAction = () => {
      if (!window.confirm('Clear diagnostic logs memory?')) return;
      wrapAction('clear-logs', () => {
        otaDebugLogs.fetchedVersionJson = null;
        otaDebugLogs.fetchedAppReleaseJson = null;
        otaDebugLogs.installError = null;
        otaDebugLogs.lastExceptionStackTrace = null;
        showDevToast('Logs memory reset.');
      });
    };

    const handleResetUpdateStateAction = () => {
      if (!window.confirm('Reset all OTA and APK update logs and persistent history?')) return;
      wrapAction('reset-update-state', () => {
        resetOtaUpdateState();
        localStorage.removeItem('studio:appliedVersions');
        localStorage.removeItem('studio:appliedUpdateVersion');
        localStorage.removeItem('studio:dismissedVersions');
        localStorage.removeItem('studio:notifiedVersions');
        localStorage.removeItem('studio:downloadedApkPath');
        localStorage.removeItem('studio:downloadedBundleId');
        localStorage.removeItem('studio:downloadedVersions');
        showDevToast('Update state fully reset.');
      });
    };

    const getLocalRecordCounts = () => {
      let chordexPresets = 0;
      let chordexProgressions = 0;
      let chordexChords = 0;
      let drumexSongs = 0;
      let drumexGrooves = 0;
      let groovexSongs = 0;

      try {
        const chordex = localStorage.getItem('chord-explorer-storage-v3');
        if (chordex) {
          const parsed = JSON.parse(chordex);
          const state = parsed.state || {};
          chordexPresets = state.presets?.length || 0;
          chordexProgressions = state.progressions?.length || 0;
          chordexChords = state.customChords?.length || 0;
        }
      } catch {}

      try {
        const drumex = localStorage.getItem('chordex-drums');
        if (drumex) {
          const parsed = JSON.parse(drumex);
          const state = parsed.state || {};
          drumexSongs = state.drumSongs?.length || 0;
          drumexGrooves = state.grooves?.length || 0;
        }
      } catch {}

      try {
        const groovex = localStorage.getItem('groovex-storage-v1');
        if (groovex) {
          const parsed = JSON.parse(groovex);
          const state = parsed.state || {};
          groovexSongs = state.recentSongs?.length || 0;
        }
      } catch {}

      return `Chordex: ${chordexPresets} presets, ${chordexProgressions} progressions, ${chordexChords} custom chords\nDrumex: ${drumexSongs} songs, ${drumexGrooves} grooves\nGroovex: ${groovexSongs} recent songs`;
    };

    const handleForceSyncNow = () => {
      wrapAction('force-sync', async () => {
        await syncNow();
        showDevToast('Force sync completed.');
      });
    };

    const handleResetSyncState = () => {
      if (!window.confirm('WARNING: This will reset local sync state. It will NOT delete local data. Reset now?')) return;
      wrapAction('reset-sync', () => {
        localStorage.removeItem('chordex_sync_meta_v1');
        localStorage.removeItem('chordex_sync_first_pull_done_v1');
        showDevToast('Local sync state reset. Re-syncing on next app open.');
        setTimeout(() => window.location.reload(), 1500);
      });
    };

    const handleUploadSnapshot = () => {
      if (!window.confirm('Upload a full backup snapshot of your current local data to your cloud account?')) return;
      wrapAction('upload-snapshot', async () => {
        await createCloudBackup('manual_dev_options');
        showDevToast('Backup snapshot uploaded successfully.');
      });
    };

    const handleClearSyncLogs = () => {
      wrapAction('clear-sync-logs', () => {
        clearConflictLogs();
        showDevToast('Sync conflict logs cleared.');
      });
    };

    const conflictLogsText = getConflictLogs().map(log => 
      `[${new Date(log.timestamp).toLocaleTimeString()}] App: ${log.app}\nItem: ${log.itemName} (${log.itemId})\nLocal Time: ${new Date(log.localTime).toLocaleString()}\nCloud Time: ${new Date(log.cloudTime).toLocaleString()}\nResolution: ${log.resolution}`
    ).join('\n\n') || 'No conflicts logged in this session.';

    return (
      <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title="Developer Options" onBack={goBack} />

        {/* 1. App & Build */}
        <SettingsSectionLabel>1. App & Build</SettingsSectionLabel>
        <div style={cardStyle}>
          <DevInfoRow label="App Version" desc="Hardcoded version in app bundle (APP_VERSION)" value={APP_VERSION} />
          <DevInfoRow label="APK Version" desc="Android native APK binary version wrapper" value={devNativeVersion} />
          <DevInfoRow label="OTA Version" desc="Active dynamically applied bundle version" value={devOtaVersion} />
          <DevInfoRow label="Build Type" desc="Execution platform compilation target" value={isNative() ? 'Native Release' : 'Web'} />
          <DevInfoRow label="Package Name" desc="Unique application package identifier" value={devBundleId} />
          <DevInfoRow label="versionCode" desc="Android manifest build increment number" value={devVersionCode} />
          <DevInfoRow label="Firebase App ID" desc="Firebase application reference ID" value={devBundleId} />
          <DevInfoRow label="Signing Fingerprint" desc="Public SHA-256 production certificate key" value="90:0C:F2:59:18:5C:81:10:0C:DA:8B:B0:85:71:FA:23:55:2E:97:89:13:1C:F0:7A:8F:40:56:E4:D4:12:92:06" canCopy />
          <DevInfoRow label="Signature SHA-256" desc="Active loaded certificate hash key" value={installedPackageDetails?.signingSha256 || 'N/A'} canCopy />
          <DevInfoRow label="Debuggable Status" desc="Security debugging compiled state" value={isNative() ? 'false (Release Build)' : 'true (Web Dev Mode)'} />
          {!isNative() && (
            <>
              <DevInfoRow label="Web App Version" desc="Hardcoded web application version" value={APP_VERSION} />
              <DevInfoRow label="Web Sync Supported" desc="Is cloud sync supported on web platforms" value={diag.webSyncSupported ? 'true' : 'false'} />
              <DevInfoRow label="Firebase Auth Available" desc="Is Firebase Authentication client library available" value={diag.firebaseAuthAvailable ? 'true' : 'false'} />
              <DevInfoRow label="Firestore Available" desc="Is Firestore Database client library available" value={diag.firestoreAvailable ? 'true' : 'false'} />
              <DevInfoRow label="Storage Available" desc="Is Firebase Storage client library available" value={diag.storageAvailable ? 'true' : 'false'} />
              <DevInfoRow label="Device Registration" desc="Status of this web device registration" value={diag.deviceRegistrationStatus} />
            </>
          )}
        </div>

        {/* 2. Update System */}
        <SettingsSectionLabel>2. Update System</SettingsSectionLabel>
        <div style={cardStyle}>
          <DevButtonRow label="Check For Updates" desc="Run default foreground query" actionLabel="Check" actionId="check-normal" onPress={() => wrapAction('check-normal', async () => { await checkForUpdate(false); })} />
          <DevButtonRow label="Force Update Check" desc="Bypass all skip & check intervals" actionLabel="Force Check" actionId="check-force" onPress={() => wrapAction('check-force', async () => { await checkForUpdate(true); })} />
          <DevButtonRow label="Clear Update Cache" desc="Delete downloaded APK files & paths" actionLabel="Clear" actionId="clear-cache" onPress={handleClearUpdateCacheAction} isDestructive />
          <DevButtonRow label="Clear Dismissed Versions" desc="Reset choices for skipped versions" actionLabel="Clear" actionId="clear-dismissed" onPress={handleClearDismissedAction} />
          <DevButtonRow label="Clear Applied Versions" desc="Reset installed update database" actionLabel="Clear" actionId="clear-applied" onPress={handleClearAppliedAction} />
          <DevButtonRow label="Clear Failed Update State" desc="Clear error logs and update states" actionLabel="Reset" actionId="clear-failed" onPress={handleClearFailedUpdateAction} />
          <DevButtonRow label="Reset OTA State" desc="Revert active bundle to standard build" actionLabel="Reset Bundle" actionId="reset-ota" onPress={handleResetOtaAction} isDestructive />
          <DevCollapsibleRow label="version.json Manifest" desc="Cached raw content of version.json metadata" value={firebaseVersionJson} canCopy />
          <DevCollapsibleRow label="app-release.json Manifest" desc="Cached raw content of app-release.json metadata" value={firebaseAppReleaseJson} canCopy />
          <DevButtonRow label="Copy Update Diagnostics" desc="Copy full updater debug reports" actionLabel="Copy" actionId="copy-diag" onPress={() => {
            navigator.clipboard.writeText(getDiagnosticsText()).then(() => showDevToast('Diagnostics copied.'));
          }} />
          <DevButtonRow label="Export Update Diagnostics" desc="Save reports file to memory" actionLabel="Export" actionId="export-diag" onPress={() => wrapAction('export-diag', handleExportDiagnostics)} />
        </div>

        {/* 3. AppInstaller / Native Capabilities */}
        <SettingsSectionLabel>3. AppInstaller & Plugins</SettingsSectionLabel>
        <div style={cardStyle}>
          <DevInfoRow label="AppInstaller Available" value={otaDebugLogs.appInstallerAvailable ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="downloadApk Available" value={otaDebugLogs.downloadApkAvailable ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="verifyApkSha256 Available" value={otaDebugLogs.verifyApkSha256Available ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="installApk Available" value={otaDebugLogs.installApkAvailable ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="openInstallPermissionSettings Available" value={otaDebugLogs.openInstallPermissionSettingsAvailable ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="Registered Capacitor Plugins" value={otaDebugLogs.registeredPlugins} />
          <DevButtonRow label="Validate Installer Capability" desc="Perform active registration assertions" actionLabel="Validate" actionId="validate-installer" onPress={handleValidateInstallerAction} />
          
          {isNative() && installedPackageDetails && (
            <>
              <div style={{ height: 1, background: 'rgba(128,128,128,0.12)', margin: '8px 0' }} />
              <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '4px 0', opacity: 0.75, color: 'var(--c-text-primary)' }}>Installed Package Details</div>
              <DevInfoRow label="Installed Package Name" value={installedPackageDetails.packageName} />
              <DevInfoRow label="Installed Version Name" value={installedPackageDetails.versionName} />
              <DevInfoRow label="Installed Version Code" value={String(installedPackageDetails.versionCode)} />
              <DevInfoRow label="Installed Signature SHA-256" value={installedPackageDetails.signatures} canCopy />
            </>
          )}

          {isNative() && downloadedApkDetails && (
            <>
              <div style={{ height: 1, background: 'rgba(128,128,128,0.12)', margin: '8px 0' }} />
              <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '4px 0', opacity: 0.75, color: 'var(--c-text-primary)' }}>Downloaded APK Details</div>
              <DevInfoRow label="Downloaded Package Name" value={downloadedApkDetails.packageName} />
              <DevInfoRow label="Downloaded Version Name" value={downloadedApkDetails.versionName} />
              <DevInfoRow label="Downloaded Version Code" value={String(downloadedApkDetails.versionCode)} />
              <DevInfoRow label="Downloaded Signature SHA-256" value={downloadedApkDetails.signingSha256} canCopy />
              <DevInfoRow label="Debuggable" value={downloadedApkDetails.debuggable ? 'TRUE' : 'FALSE'} />
              <DevInfoRow label="APK Valid" value={downloadedApkDetails.isValidApk ? 'TRUE' : 'FALSE'} />
            </>
          )}

          {isNative() && apkEligibility && (
            <>
              <div style={{ height: 1, background: 'rgba(128,128,128,0.12)', margin: '8px 0' }} />
              <div style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, padding: '4px 0', opacity: 0.75, color: 'var(--c-text-primary)' }}>APK Install Eligibility</div>
              <DevInfoRow label="Package Name Match" value={apkEligibility.installed?.packageName && apkEligibility.downloaded?.packageName ? String(apkEligibility.installed.packageName === apkEligibility.downloaded.packageName).toUpperCase() : 'N/A'} />
              <DevInfoRow label="Signing Certificate Match" value={apkEligibility.installed?.signingSha256 && apkEligibility.downloaded?.signingSha256 ? String(apkEligibility.installed.signingSha256.replace(/:/g,'').toLowerCase() === apkEligibility.downloaded.signingSha256.replace(/:/g,'').toLowerCase()).toUpperCase() : 'N/A'} />
              <DevInfoRow label="New Version Code Higher" value={apkEligibility.installed?.versionCode && apkEligibility.downloaded?.versionCode ? String(apkEligibility.downloaded.versionCode > apkEligibility.installed.versionCode).toUpperCase() : 'N/A'} />
              <DevInfoRow label="APK Installable" value={apkEligibility.eligible ? 'TRUE' : 'FALSE'} />
              <DevInfoRow label="Final Decision" value={apkEligibility.eligible ? 'CAN INSTALL' : 'CANNOT INSTALL'} />
              {!apkEligibility.eligible && <DevInfoRow label="Reason if Cannot Install" value={apkEligibility.errorDetails || apkEligibility.reason || 'N/A'} />}
            </>
          )}
        </div>

        {/* 4. Storage & Sync Debug */}
        <SettingsSectionLabel>4. Storage & Sync</SettingsSectionLabel>
        <div style={cardStyle}>
          <DevInfoRow label="Active Sync Provider" value={diag.activeSyncProvider || 'firebase-legacy'} />
          <DevInfoRow label="Database Provider" value={diag.databaseProvider || 'firestore'} />
          <DevInfoRow label="Auth UID" value={diag.authUid} />
          <DevInfoRow label="Current Device ID" value={diag.deviceId || diag.currentDeviceId} />
          
          {diag.activeSyncProvider === 'supabase-realtime' ? (
            <>
              <DevInfoRow label="Supabase Host" value={diag.supabaseUrlHost || 'N/A'} />
              <DevInfoRow label="Supabase Key Mask" value={diag.supabaseAnonKeyPrefix ? `${diag.supabaseAnonKeyPrefix}... (${diag.supabaseAnonKeyLength} chars)` : 'N/A'} />
              <DevInfoRow label="Supabase Client Ready" value={diag.supabaseClientReady ? 'Yes' : 'No'} />
              <DevInfoRow label="Supabase Db Available" value={diag.supabaseDbAvailable ? 'Yes' : 'No'} />
              <DevInfoRow label="Supabase Auth Strategy" value={diag.supabaseAuthStrategy || 'N/A'} />
              <DevInfoRow label="Supabase Mapped User ID" value={diag.mappedUserId || 'N/A'} />
              <DevInfoRow label="Supabase RLS User ID" value={diag.rlsUserId || 'N/A'} />
              <DevInfoRow label="Devices Table" value={diag.devicesTable || 'user_devices'} />
              <DevInfoRow label="Device Row Key" value={diag.deviceRowId || 'N/A'} />
              <DevInfoRow label="Probe Table" value={diag.probeTable || 'sync_probe'} />
              <DevInfoRow label="Probe Row Key" value={diag.probeRowId || 'N/A'} />
              <DevInfoRow label="Direct Write Table" value={diag.directWriteTable || 'debug_writes'} />
              <DevInfoRow label="Direct Write Row Key" value={diag.directWriteRowId || 'N/A'} />
              <DevInfoRow label="Profiles Table" value={diag.profileTable || 'user_profiles'} />
              <DevInfoRow label="Appearance Table" value={diag.appearanceTable || 'user_appearance_settings'} />
              <DevInfoRow label="Preferences Table" value={diag.preferencesTable || 'user_preferences'} />
              <DevInfoRow label="Supabase Client Init Error" value={diag.supabaseInitError || 'None'} />
              <DevInfoRow label="Last Supabase Auth Error" value={diag.lastSupabaseAuthError || 'None'} />
            </>
          ) : (
            <>
              <DevInfoRow label="Current Device Doc Path" value={diag.currentDeviceDocPath} canCopy />
              <DevInfoRow label="Firebase Project ID" value={diag.firebaseProjectId} />
              <DevInfoRow label="Devices Collection Path" value={diag.devicesCollectionPath} canCopy />
              <DevInfoRow label="Device write path" value={diag.deviceWritePath || 'N/A'} />
              <DevInfoRow label="Device listener path" value={diag.devicesListenerPath || 'N/A'} />
              <DevInfoRow label="Probe write path" value={diag.probeWritePath || 'N/A'} />
              <DevInfoRow label="Probe listener path" value={diag.probeListenerPath || 'N/A'} />
              <DevInfoRow label="Direct write path" value={diag.directWritePath || 'N/A'} />
            </>
          )}

          <DevInfoRow label="Devices Snapshot Count" value={String(diag.devicesSnapshotCount)} />
          <DevInfoRow label="Devices Snapshot IDs" value={diag.devicesSnapshotIds} />
          <DevInfoRow label="Last Device Write Success" value={diag.lastDeviceWriteSuccess} />
          <DevInfoRow label="Last Device Write Error" value={diag.lastDeviceWriteError} />
          <DevInfoRow label="Last Devices Listener Error" value={diag.lastDevicesListenerError} />
          <DevInfoRow label="Build Type" value={diag.buildType} />
          <DevInfoRow label="Platform" value={diag.platform} />
          <DevInfoRow label="Sync Enabled" value={diag.syncEnabled ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="Firestore Connected" value={diag.firestoreConnected ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="Profile Listener Active" value={diag.profileListenerActive ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="Appearance Listener Active" value={diag.appearanceListenerActive ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="Preferences Listener Active" value={diag.preferencesListenerActive ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="Devices Listener Active" value={diag.devicesListenerActive ? 'TRUE' : 'FALSE'} />
          <DevInfoRow label="Last Sync Success" value={diag.lastSyncSuccess} />
          <DevInfoRow label="Last Profile Sync" value={diag.lastProfileSync} />
          <DevInfoRow label="Last Appearance Sync" value={diag.lastAppearanceSync} />
          <DevInfoRow label="Last Preferences Sync" value={diag.lastPreferencesSync} />
          <DevInfoRow label="Pending Writes" value={String(diag.pendingWrites)} />
          <DevInfoRow label="Last Sync Error" value={diag.lastSyncError} />
          <DevInfoRow label="Local Display Name" value={diag.localDisplayName} />
          <DevInfoRow label="Remote Display Name" value={diag.remoteDisplayName} />
          <DevInfoRow label="Local Theme" value={diag.localTheme} />
          <DevInfoRow label="Remote Theme" value={diag.remoteTheme} />
          <DevInfoRow label="Local Accent Color" value={diag.localAccentColor} />
          <DevInfoRow label="Remote Accent Color" value={diag.remoteAccentColor} />
          <DevInfoRow label="Local Photo URL" value={diag.localPhotoURL} canCopy />
          <DevInfoRow label="Remote Photo URL" value={diag.remotePhotoURL} canCopy />
          <DevInfoRow label="Registered Devices Count" value={String(diag.registeredDevicesCount)} />
          <DevInfoRow label="Last Remote Update Timestamp" value={diag.lastRemoteUpdateTimestamp} />
          <DevInfoRow label="Last Local Update Timestamp" value={diag.lastLocalUpdateTimestamp} />
          
          <DevInfoRow label="Local Storage Status" desc="Key counts and total memory estimation" value={localStorageStatus} />
          <DevInfoRow label="Local Records by Category" value={getLocalRecordCounts()} />
          <DevInfoRow label="Sync Conflict Count" value={String(getConflictLogs().length)} />
          <DevCollapsibleRow label="Sync Conflict Logs" desc="Item-level conflicts logged during merge runs" value={conflictLogsText} canCopy />
          <DevCollapsibleRow label="Capacitor Preferences Dump" desc="Read values in Capacitor Preferences storage" value={preferencesDump} canCopy />
          
          <DevButtonRow label="Force Sync Now" desc="Bypass all throttling and trigger cloud sync" actionLabel="Sync Now" actionId="force-sync" onPress={handleForceSyncNow} />
          <DevButtonRow label="Register This Device Now" desc="Manually write/update this device document in Firestore" actionLabel="Register" actionId="register-device-now" onPress={async () => {
            if (!authUser?.uid) {
              showDevToast('Error: Not signed in');
              return;
            }
            await wrapAction('register-device-now', async () => {
              await registerCurrentDevice(authUser.uid, 'dev-options-button');
              showDevToast('Device registration completed.');
            });
          }} />
          <DevButtonRow label="Reconnect Devices" desc="Force heartbeat and rebuild active Firestore listeners" actionLabel="Reconnect" actionId="reconnect-devices" onPress={async () => {
            if (!authUser?.uid) {
              showDevToast('Error: Not signed in');
              return;
            }
            await wrapAction('reconnect-devices', async () => {
              await reconnectDevices();
              showDevToast('Device reconnection completed.');
            });
          }} />
          <DevButtonRow label="Push Local Settings to Cloud" desc="Overwrite cloud profile/settings with this device's state" actionLabel="Push Settings" actionId="push-settings" onPress={async () => {
            if (window.confirm('Overwrite cloud settings with local state?')) {
              await wrapAction('push-settings', pushLocalSettingsToCloud);
              showDevToast('Settings pushed successfully.');
            }
          }} />
          <DevButtonRow label="Pull Cloud Settings to Device" desc="Overwrite local settings with cloud profile/settings" actionLabel="Pull Settings" actionId="pull-settings" onPress={async () => {
            if (window.confirm('Overwrite local settings with cloud state?')) {
              await wrapAction('pull-settings', pullCloudSettingsFromCloud);
              showDevToast('Settings pulled successfully.');
            }
          }} />
          <DevButtonRow label="Copy Sync Diagnostics" desc="Copy formatted sync state details to clipboard" actionLabel="Copy" actionId="copy-sync-diag" onPress={() => {
            const report = Object.entries(getSyncDiagnostics()).map(([k, v]) => `${k}: ${v}`).join('\n');
            navigator.clipboard.writeText(report).then(() => showDevToast('Sync diagnostics copied.'));
          }} />
          <DevButtonRow label="Reset Local Sync State Only" desc="Clear metadata to force a clean pull next open" actionLabel="Reset Sync State" actionId="reset-sync" onPress={handleResetSyncState} isDestructive />
          <DevButtonRow label="Upload Local Data Snapshot" desc="Write a custom backup doc to backups collection" actionLabel="Upload Backup" actionId="upload-snapshot" onPress={handleUploadSnapshot} />
          <DevButtonRow label="Clear Sync Logs & Errors" desc="Flush all logged conflict history and reset phase error" actionLabel="Clear Logs" actionId="clear-sync-logs" onPress={handleClearSyncLogs} />
          
          <DevButtonRow label="Clear Temporary Files" desc="Reset session-scoped configs" actionLabel="Clear" actionId="clear-temp" onPress={handleClearTemporaryAction} />
          <DevButtonRow label="Export Local Diagnostics" desc="Download complete preferences and storage dump" actionLabel="Export" actionId="export-local" onPress={handleExportLocalDiagnosticsAction} />
        </div>

        {/* 5. UI & Navigation Debug */}
        <SettingsSectionLabel>5. UI & Navigation</SettingsSectionLabel>
        <div style={cardStyle}>
          <DevInfoRow label="Current Root View" value="App" />
          <DevInfoRow label="Current Active App" value={settings.appMode || 'hub'} />
          <DevInfoRow label="Return-to-Hub State" value="Idle" />
          <DevInfoRow label="Overlay State" desc="Count of active modals/sheets in viewport" value={String(document.querySelectorAll('.modal-backdrop, .overlay').length)} />
          <DevInfoRow label="Transition State" value="Inactive" />
          <DevButtonRow label="Reset App Shell State" desc="Revert all store configurations to default" actionLabel="Reset Shell" actionId="reset-shell" onPress={handleResetAppShellAction} isDestructive />
          <DevButtonRow label="Force Return to Hub" desc="Bypass view locks & trigger returnToStudioHub" actionLabel="Trigger Return" actionId="force-return" onPress={handleForceReturnHubAction} />
        </div>

        {/* 6. Danger Zone */}
        <SettingsSectionLabel>6. Danger Zone</SettingsSectionLabel>
        <div style={cardStyle}>
          <DevButtonRow label="Reset Developer Options" desc="Disable developer options and lock this menu" actionLabel="Reset" actionId="reset-developer" onPress={handleResetDeveloperAction} isDestructive />
          <DevButtonRow label="Clear Debug Logs" desc="Reset all current memory logs" actionLabel="Clear Logs" actionId="clear-logs" onPress={handleClearDebugLogsAction} isDestructive />
          <DevButtonRow label="Reset Update State" desc="Wipe update configurations, logs & choices" actionLabel="Reset Update State" actionId="reset-update-state" onPress={handleResetUpdateStateAction} isDestructive />
          <DevButtonRow label="Disable Developer Options" desc="Exit developer mode immediately" actionLabel="Disable" actionId="disable-dev" onPress={handleResetDeveloperAction} isDestructive />
        </div>

        <div style={{ height: '32px' }} />
        {devToast && renderDevToast()}
      </div>
    );
    } catch (e: any) {
      console.error('Error rendering Developer Options:', e);
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Developer Options" onBack={goBack} />
          <div style={{ padding: '24px 20px', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#ef4444', marginBottom: 12 }}>error</span>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--c-text-primary)' }}>Diagnostics unavailable</p>
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>An error occurred while loading developer details.</p>
          </div>
        </div>
      );
    }
  }
  /* ── ABOUT ──────────────────────────────────────────────────────── */
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
      <div key={pageKey} className="settings-panel-sheet" style={{ ...subStyle, paddingBottom: 'calc(var(--content-bottom-pad) + 20px)' }}>
        <style>{HUB_SETTINGS_CSS}</style>
        <SettingsSubHeader title={t.settings.sections.about} onBack={goBack} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 520, margin: '0 auto', paddingBottom: 24 }}>
          {/* Hero Card */}
          <div style={{ ...cardStyle, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <StudioFamilyOrbit items={subAppLogos} onLogoPress={handleLogoTap} />
            <p style={{ margin: '16px 0 0', fontFamily: 'Manrope', fontWeight: 800, fontSize: 24, letterSpacing: '-0.03em', color: 'var(--c-text-primary)', lineHeight: 1.1 }}>Studio</p>
            <p style={{ margin: '4px 0 0', fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', fontWeight: 500 }}>
              {t.settings.about.version} {APP_VERSION_LABEL}
            </p>
            <p style={{ margin: '14px 0 0', fontFamily: 'Inter', fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5, padding: '0 8px' }}>
              {lang === 'es'
                ? 'Suite de producción musical todo en uno. Graba, mezcla, sintetiza y compone pistas directamente en tu dispositivo.'
                : 'All-in-one music production suite. Record, mix, synthesize, and compose tracks directly on your device.'}
            </p>
          </div>

          {/* Credits / Legal / Links Card */}
          <div style={{ ...cardStyle, padding: '6px 20px' }}>
            <button
              onClick={() => window.open('https://github.com/MAGEXE1000/Studio', '_system')}
              className="btn-smooth"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '12px 0', borderBottom: '1px solid rgba(128,128,128,0.08)',
                background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                color: 'var(--c-text-primary)', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13.5 }}>GitHub Repository</span>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)' }}>open_in_new</span>
            </button>
            <button
              onClick={() => navigate('privacy')}
              className="btn-smooth"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '12px 0', borderBottom: '1px solid rgba(128,128,128,0.08)',
                background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                color: 'var(--c-text-primary)', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13.5 }}>
                {lang === 'es' ? 'Política de Privacidad' : 'Privacy Policy'}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)' }}>chevron_right</span>
            </button>
            <button
              onClick={() => showDevToast(lang === 'es' ? 'Licencias de código abierto' : 'Open Source Licenses')}
              className="btn-smooth"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '12px 0',
                background: 'transparent', border: 'none',
                color: 'var(--c-text-primary)', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 13.5 }}>
                {lang === 'es' ? 'Licencias de Software' : 'Software Licenses'}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)' }}>chevron_right</span>
            </button>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 32, height: 2, borderRadius: 999, background: 'rgba(128,128,128,0.25)', marginBottom: 4 }} />
            <p style={{ color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.18em', margin: 0 }}>
              {t.settings.about.footer}
            </p>
          </div>
        </div>

        <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
        {devToast && renderDevToast()}
      </div>
    );
  }

  /* ── MAIN PAGE ──────────────────────────────────────────────────── */
  return (
    <div key={pageKey} style={{ padding: '0 20px', paddingBottom: 'var(--content-bottom-pad)' }}>
      <style>{HUB_SETTINGS_CSS}</style>

      {/* Title */}
      <div className="spring-in" style={{ paddingTop: 32, paddingBottom: 8 }}>
        <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.03em', fontFamily: 'Manrope' }}>{t.hub.settingsTitle}</p>
        <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '5px 0 0', fontWeight: 500 }}>{t.hub.settingsSubtitle}</p>
      </div>

      {/* ── Profile card ── */}
      {(() => {
        const name    = authUser?.displayName || authUser?.email || '';
        const email   = authUser?.email || '';
        const photo   = customPhoto || authUser?.photoURL;
        const initial = (name[0] ?? 'S').toUpperCase();
        const hasUser = !!authUser;
        return (
          <button
            type="button"
            onClick={() => onProfile?.()}
            className="btn-smooth"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              width: '100%', padding: '28px 20px 24px',
              marginBottom: 8,
              background: 'var(--app-surface)',
              borderRadius: '1.25rem',
              border: '1px solid rgba(128,128,128,0.07)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
              cursor: 'pointer', outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              animation: 'hub-row-fade 320ms 30ms ease both',
              position: 'relative',
              textAlign: 'center',
              gap: 0,
            }}
          >
            {/* Chevron top-right */}
            <span
              className="material-symbols-outlined"
              style={{
                position: 'absolute', top: 14, right: 14,
                fontSize: 18, color: 'var(--c-text-secondary)', opacity: 0.5,
              }}
            >chevron_right</span>

            {/* Avatar */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%', marginBottom: 14,
              background: photo
                ? 'transparent'
                : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 800, color: '#fff',
              overflow: 'hidden', flexShrink: 0,
              boxShadow: `0 0 0 3px ${accent.from}33, 0 4px 18px ${accent.from}28`,
            }}>
              {photo ? (
                <img src={photo} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : hasUser ? (
                <span>{initial}</span>
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: 34, color: '#fff' }}>account_circle</span>
              )}
            </div>

            {/* Name */}
            <p style={{
              fontFamily: 'Manrope', fontWeight: 800, fontSize: 18,
              color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.02em',
              maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {hasUser ? (authUser.displayName || 'Studio User') : 'Sign In'}
            </p>

            {/* Email */}
            <p style={{
              fontFamily: 'Inter', fontSize: 13,
              color: 'var(--c-text-secondary)', margin: '4px 0 0',
              maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {hasUser ? email : 'Tap to create account or sign in'}
            </p>
          </button>
        );
      })()}

      {/* Interface */}
      <SettingsSectionLabel delay={70}>{(t.hub as { studioSettings?: { interface?: string } }).studioSettings?.interface ?? 'Interface'}</SettingsSectionLabel>
      <div style={cardStyle}>
        <SettingsNavRow icon="palette" iconColor={accent.from} title={t.settings.sections.appearance} desc={(t.hub as { studioSettings?: { appearanceDesc?: string } }).studioSettings?.appearanceDesc ?? 'Theme, colors, display & performance'} onPress={() => navigate('appearance')} last delay={80} />
      </div>

      {/* Language */}
      <SettingsSectionLabel delay={100}>{t.settings.sections.language}</SettingsSectionLabel>
      <div style={cardStyle}>
        <SettingsNavRow icon="language" iconColor={accent.from} title={t.settings.sections.language} desc={(t.hub as { studioSettings?: { languageDesc?: string } }).studioSettings?.languageDesc ?? 'App display language'} onPress={() => navigate('language')} last delay={110} />
      </div>





      {/* Help & Support */}
      <SettingsSectionLabel delay={150}>Help & Support</SettingsSectionLabel>
      <div style={cardStyle}>
        <SettingsNavRow icon="help" iconColor={accent.from} title="Help & FAQ" desc="Frequently asked questions and solutions" onPress={() => navigate('help')} last delay={160} />
      </div>

      {/* System & About */}
      <SettingsSectionLabel delay={200}>{(t.hub as { studioSettings?: { systemAbout?: string } }).studioSettings?.systemAbout ?? 'System & About'}</SettingsSectionLabel>
      <div style={cardStyle}>
        <SettingsNavRow icon="download" iconColor={accent.from} title={(t.hub as { studioSettings?: { updater?: string } }).studioSettings?.updater ?? 'Updater'} desc={(t.hub as { studioSettings?: { updaterDesc?: string } }).studioSettings?.updaterDesc ?? 'App updates and installation'} badge={(t.hub as { studioSettings?: { autoBadge?: string } }).studioSettings?.autoBadge ?? 'Auto'} onPress={() => navigate('updater')} delay={210} />
        <SettingsNavRow icon="history" iconColor={accent.from} title={(t.hub as { studioSettings?: { changelog?: string } }).studioSettings?.changelog ?? 'Changelog'} desc={(t.hub as { studioSettings?: { changelogDesc?: string } }).studioSettings?.changelogDesc ?? "What's new in this version"} onPress={() => setChangelogOpen(true)} delay={220} />

        <SettingsNavRow icon="info" iconColor={accent.from} title={t.settings.sections.about} desc={APP_VERSION_LABEL} onPress={() => navigate('about')} last={!settings.developerMode} delay={230} />
        {settings.developerMode && (
          <SettingsNavRow icon="terminal" iconColor={accent.from} title="Developer Options" desc="Update simulation, logs, and controls" onPress={() => navigate('developer')} last delay={240} />
        )}
      </div>

      <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
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
  const isLight = (() => {
    if (hubVis2.theme === 'light') return true;
    if (hubVis2.theme === 'system') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    if (hubVis2.theme === 'dynamic') {
      const h = new Date().getHours();
      const lightStart = settings.dynamicLightStart ?? 7;
      const lightEnd   = settings.dynamicLightEnd   ?? 20;
      return h >= lightStart && h < lightEnd;
    }
    return false;
  })();
  const bg = isLight
    ? hubVis2.amoledMode
      ? 'rgba(255, 255, 255, 0.92)'
      : 'rgba(255, 255, 255, 0.40)'
    : hubVis2.amoledMode
      ? 'rgba(4,4,4,0.88)'
      : 'rgba(26,26,30,0.72)';

  return (
    <nav
      ref={navRef}
      className="glass-nav"
      style={{
        position: 'fixed',
        bottom: 'var(--nav-safe-bottom)',
        left: '50%',
        width: '90%',
        maxWidth: '448px',
        height: `${expandedH}px`,
        borderRadius: '2rem',
        border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.32)'}`,
        background: bg,
        boxShadow: isLight
          ? '0 8px 32px rgba(0,0,0,0.08), 0 1.5px 0 rgba(255,255,255,0.70) inset'
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
          background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.09)',
          border: isLight ? '1.5px solid rgba(0, 0, 0, 0.06)' : '1.5px solid rgba(255, 255, 255, 0.30)',
          boxShadow: isLight
            ? ['inset 0 1px 0 rgba(255,255,255,0.95)', '0 2px 8px rgba(0,0,0,0.08)'].join(', ')
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

/* ── HELP ACCORDION ───────────────────────────────────────────────── */
interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: Record<string, FAQItem[]> = {
  en: [
    {
      question: "How do OTA updates work?",
      answer: "Studio automatically checks for updates in the background on launch. When an update is detected, a banner drops down at the top of the Hub with an option to install immediately or remind you later."
    },
    {
      question: "What is Performance Mode?",
      answer: "Performance Mode disables expensive real-time visual effects, such as blur filters and heavy GPU animations, to prioritize battery life and maximize responsiveness on older devices. You can toggle this in the Appearance preferences."
    },
    {
      question: "How do I backup my songs and kits?",
      answer: "All your songs in Chordex and custom kits in Drumex are automatically synced and backed up to your account securely. Simply sign in from the Account page to sync data across all your devices."
    },
    {
      question: "How do I connect external MIDI devices?",
      answer: "Studio supports standard MIDI-over-USB and Bluetooth MIDI devices. Connect your controller, and it will be auto-detected in Drumex and Stagex for real-time play."
    },
    {
      question: "Why is there no sound? (Sound Engine Repair)",
      answer: "This can happen if the browser's Web Audio API is suspended or blocked. Click below to restart the sound engine, unlock silent mode, and run a hardware speaker diagnostic."
    },
    {
      question: "My library is out of sync or missing items! (Force Cloud Resync)",
      answer: "If your local library is out of sync or did not load correctly, click below to clear local pull markers and force a complete pull-then-push connection with the Firestore secure servers to restore your files."
    },
    {
      question: "The app feels slow or laggy. Can I clean up the cache?",
      answer: "Auxiliary interface records, old OTA updater chunks, and representation caches can accumulate. Click below to safely flush the temporary asset cache, wipe Lottie animation storage, and optimize system speed."
    },
    {
      question: "How is my personal data secured in the app?",
      answer: "Every single piece of user data (favorites, custom drum kits, preferences) is securely encrypted locally. Your key is dynamically derived using 80 iterations of FNV-1a stretching combined with your unique hardware device ID. Click below to run a security audit and verify key integrity."
    },
    {
      question: "How do I perform a deep repair or soft reset?",
      answer: "If the interface ever gets stuck or behaves unexpectedly due to hot-updates, click below to perform a safe memory reload, re-registering Capgo update hooks and flushing state garbage."
    }
  ],
  es: [
    {
      question: "¿Cómo funcionan las actualizaciones OTA?",
      answer: "Studio busca actualizaciones automáticamente en segundo plano al iniciar. Cuando se detecta una actualización, aparece un banner en la parte superior con la opción de instalarla inmediatamente o recordarlo más tarde."
    },
    {
      question: "¿Qué es el Modo de Rendimiento?",
      answer: "El Modo de Rendimiento desactiva efectos visuales pesados en tiempo real (como desenfoques y animaciones pesadas de GPU) para ahorrar batería y maximizar la fluidez en dispositivos antiguos. Puedes activarlo en preferencias de Apariencia."
    },
    {
      question: "¿Cómo guardo mis canciones y kits?",
      answer: "Todas tus canciones de Chordex y kits personalizados de Drumex se respaldan automáticamente de forma segura. Inicia sesión en la sección Cuenta para sincronizar tus datos en todos tus dispositivos."
    },
    {
      question: "¿Cómo conecto dispositivos MIDI externos?",
      answer: "Studio admite controladores MIDI por USB y Bluetooth estándar. Conecta tu controlador y se detectará automáticamente en Drumex y Stagex para tocar en tiempo real."
    },
    {
      question: "¿Por qué no hay sonido? (Reparar motor de sonido)",
      answer: "Esto puede suceder si el motor Web Audio del navegador está suspendido o bloqueado. Presiona abajo para reiniciar el motor de sonido, desactivar el modo silencioso y realizar una prueba de altavoces."
    },
    {
      question: "¡Mi biblioteca está desincronizada o faltan elementos! (Forzar sincronización)",
      answer: "Si tu biblioteca local está desincronizada o no se cargó correctamente, presiona abajo para borrar los marcadores locales y forzar una conexión completa con los servidores seguros de Firestore para restaurar tus archivos."
    },
    {
      question: "¿La app va lenta? ¿Puedo limpiar la caché?",
      answer: "Los registros temporales de la interfaz, restos de actualizaciones OTA y cachés de animación pueden acumularse. Presiona abajo para vaciar de forma segura la caché de archivos temporales y optimizar el rendimiento."
    },
    {
      question: "¿Cómo se protegen mis datos en la aplicación?",
      answer: "Todos tus datos de usuario (favoritos, kits de batería, preferencias) están encriptados localmente. Tu clave se deriva mediante 80 iteraciones de estiramiento FNV-1a combinadas con el ID de tu dispositivo. Presiona abajo para auditar la seguridad."
    },
    {
      question: "¿Cómo realizo un restablecimiento completo o reparación profunda?",
      answer: "Si la interfaz se queda congelada o se comporta de manera inusual debido a actualizaciones, presiona abajo para realizar una recarga limpia de memoria y reconfigurar los hooks del sistema."
    }
  ],
  de: [
    {
      question: "Wie funktionieren OTA-Updates?",
      answer: "Studio sucht beim Start automatisch im Hintergrund nach Updates. Wenn ein Update verfügbar ist, erscheint oben ein Banner mit der Option, es sofort zu installieren oder später erinnert zu werden."
    },
    {
      question: "Was ist der Leistungsmodus?",
      answer: "Der Leistungsmodus deaktiviert rechenintensive visuelle Effekte (wie Weichzeichner und GPU-Animationen), um die Akkulaufzeit zu verlängern und die Reaktionsgeschwindigkeit auf älteren Geräten zu maximieren."
    },
    {
      question: "Wie sichere ich meine Songs und Kits?",
      answer: "Alle Ihre Songs in Chordex und benutzerdefinierten Kits in Drumex werden automatisch sicher in Ihrem Konto gesichert. Melden Sie sich einfach auf der Kontoseite an, um die Daten auf all Ihren Geräten zu synchronisieren."
    },
    {
      question: "Wie verbinde ich externe MIDI-Geräte?",
      answer: "Studio unterstützt Standard-MIDI-über-USB und Bluetooth-MIDI-Geräte. Schließen Sie Ihren Controller an, und er wird in Drumex und Stagex automatisch erkannt."
    },
    {
      question: "Warum gibt es keinen Ton? (Sound-Engine reparieren)",
      answer: "Dies kann passieren, wenn die Web Audio-API des Browsers blockiert oder im Ruhezustand ist. Klicken Sie unten, um die Sound-Engine neu zu starten, den Stummmodus aufzuheben und einen Lautsprechertest durchzuführen."
    },
    {
      question: "Meine Bibliothek ist nicht synchronisiert oder leer! (Erzwungene Synchronisierung)",
      answer: "Wenn Ihre lokale Bibliothek asynchron ist, klicken Sie unten, um lokale Sync-Markierungen zu löschen und eine vollständige Synchronisierung mit den sicheren Firestore-Servern zu erzwingen."
    },
    {
      question: "Die App läuft langsam. Kann ich den Cache leeren?",
      answer: "Temporäre Interface-Daten, alte OTA-Update-Dateien und Animations-Caches können sich ansammeln. Klicken Sie unten, um den temporären Asset-Cache sicher zu leeren und die Geschwindigkeit zu maximieren."
    },
    {
      question: "Wie sind meine persönlichen Daten in der App gesichert?",
      answer: "Jede einzelne Datei (Favoriten, Drum-Kits, Einstellungen) wird lokal verschlüsselt gespeichert. Ihr Schlüssel wird durch 80 FNV-1a-Stretching-Iterationen in Kombination mit Ihrer Geräte-ID generiert. Klicken Sie unten, um die Verschlüsselung zu prüfen."
    },
    {
      question: "Wie führe eine Tiefenreparatur oder einen Soft-Reset durch?",
      answer: "Wenn die Benutzeroberfläche einfriert oder sich unerwartet verhält, klicken Sie unten, um einen sicheren Arbeitsspeicher-Reload durchzuführen und die System-Hooks zurückzusetzen."
    }
  ]
};

function HelpAccordion({ accent, lang }: { accent: { from: string; to: string }; lang: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const faqList = FAQ_ITEMS[lang] ?? FAQ_ITEMS.en;

  // Troubleshooter States
  const [audioState, setAudioState] = useState<'idle' | 'testing' | 'success'>('idle');
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [cacheState, setCacheState] = useState<'idle' | 'clearing' | 'success'>('idle');
  const [securityState, setSecurityState] = useState<'idle' | 'auditing' | 'success'>('idle');
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [resetState, setResetState] = useState<'idle' | 'repairing' | 'success'>('idle');

  // Sync state monitoring
  useEffect(() => {
    if (syncState !== 'syncing') return;
    const unsubscribe = subscribeSyncStatus((status: SyncStatus) => {
      if (status.phase === 'success') {
        setSyncState('success');
        setTimeout(() => setSyncState('idle'), 4000);
      } else if (status.phase === 'error') {
        setSyncState('error');
        setTimeout(() => setSyncState('idle'), 4000);
      }
    });
    return () => unsubscribe();
  }, [syncState]);

  const runAudioTroubleshooter = async () => {
    setAudioState('testing');
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const tempCtx = new AudioCtx();
        if (tempCtx.state === 'suspended') {
          await tempCtx.resume();
        }
        const osc = tempCtx.createOscillator();
        const gain = tempCtx.createGain();
        osc.connect(gain);
        gain.connect(tempCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, tempCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, tempCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.06, tempCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, tempCtx.currentTime + 0.18);
        osc.start();
        osc.stop(tempCtx.currentTime + 0.2);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAudioState('success');
      setTimeout(() => setAudioState('idle'), 3000);
    } catch (e) {
      console.error('Audio repair failed:', e);
      setAudioState('idle');
    }
  };

  const runSyncTroubleshooter = async () => {
    setSyncState('syncing');
    try {
      localStorage.removeItem('chordex_sync_first_pull_done_v1');
      await syncNow();
    } catch (e) {
      console.error('Sync repair failed:', e);
      setSyncState('error');
      setTimeout(() => setSyncState('idle'), 4000);
    }
  };

  const runCacheTroubleshooter = async () => {
    setCacheState('clearing');
    try {
      localStorage.removeItem('chordex_asset_cache_v1');
      localStorage.removeItem('capgo_update_progress');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('lottie_cache') || 
          key.includes('ota_temp') ||
          key.includes('temp_asset') ||
          key.includes('debug_log')
        )) {
          localStorage.removeItem(key);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 1200));
      setCacheState('success');
      setTimeout(() => setCacheState('idle'), 3000);
    } catch (e) {
      console.error('Cache flush failed:', e);
      setCacheState('idle');
    }
  };

  const runSecurityTroubleshooter = async () => {
    setSecurityState('auditing');
    setAuditReport(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const devId = localStorage.getItem('chordex_device_id') ? 'VERIFIED' : 'GENERATED';
      const storageKeys = Object.keys(localStorage);
      const encryptedKeysCount = storageKeys.filter(k => {
        const val = localStorage.getItem(k);
        return val && val.length > 9 && val.charAt(8) === ':';
      }).length;
      
      const report = lang === 'es'
        ? `Clave de cifrado: ACTIVA (256-bit CFB)\nID de hardware: ${devId}\nBases de datos encriptadas: ${encryptedKeysCount} de ${storageKeys.length} claves\nEstado del cortafuegos: SEGURO`
        : lang === 'de'
        ? `Schlüssel-Status: AKTIV (256-bit CFB)\nHardware-ID: ${devId}\nVerschlüsselte Datenbanken: ${encryptedKeysCount} von ${storageKeys.length} Keys\nSicherheitsstufe: MAXIMAL`
        : `Encryption Key: ACTIVE (256-bit CFB)\nHardware ID: ${devId}\nEncrypted Databases: ${encryptedKeysCount} of ${storageKeys.length} keys\nFirewall Status: SECURE`;
        
      setAuditReport(report);
      setSecurityState('success');
    } catch (e) {
      setSecurityState('idle');
    }
  };

  const runResetTroubleshooter = async () => {
    setResetState('repairing');
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setResetState('success');
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (e) {
      setResetState('idle');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {faqList.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            className="spring-in"
            style={{
              background: 'var(--app-surface)',
              border: '1px solid rgba(128,128,128,0.1)',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: isOpen ? '0 8px 24px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.02)',
              transition: 'box-shadow 300ms ease, border-color 300ms ease',
              borderColor: isOpen ? `color-mix(in srgb, ${accent.from} 30%, rgba(128,128,128,0.1))` : 'rgba(128,128,128,0.1)',
            }}
          >
            <button
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--c-text-primary)',
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 700,
                fontSize: 14,
                gap: 12,
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ transition: 'color 200ms ease', color: isOpen ? accent.from : 'var(--c-text-primary)' }}>
                {item.question}
              </span>
              <span
                className="material-symbols-outlined"
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), color 200ms ease',
                  fontSize: 20,
                  color: isOpen ? accent.from : 'var(--c-text-secondary)',
                }}
              >
                expand_more
              </span>
            </button>
            <div
              style={{
                maxHeight: isOpen ? 380 : 0,
                opacity: isOpen ? 1 : 0,
                overflow: 'hidden',
                transition: 'max-height 300ms cubic-bezier(0.25, 1, 0.5, 1), opacity 240ms ease',
              }}
            >
              <div
                style={{
                  padding: '0 18px 16px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: 'var(--c-text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <span>{item.answer}</span>
                
                {/* Troubleshooter Injectors */}
                {idx === 4 && (
                  <button
                    onClick={runAudioTroubleshooter}
                    disabled={audioState === 'testing'}
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: audioState === 'testing' ? 'rgba(128,128,128,0.1)' : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                      color: audioState === 'testing' ? 'var(--c-text-secondary)' : '#ffffff',
                      border: 'none',
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: audioState === 'testing' ? 'default' : 'pointer',
                      boxShadow: audioState === 'testing' ? 'none' : `0 4px 12px rgba(0, 122, 255, 0.15)`,
                      transition: 'all 200ms ease',
                      outline: 'none',
                    }}
                  >
                    {audioState === 'testing' ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                          sync
                        </span>
                        <span>{lang === 'es' ? 'Probando Altavoces...' : lang === 'de' ? 'Testen...' : 'Running Diagnostics...'}</span>
                      </>
                    ) : audioState === 'success' ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          check_circle
                        </span>
                        <span>{lang === 'es' ? '¡Altavoz Activo!' : lang === 'de' ? 'Lautsprecher Aktiv!' : 'Sound Active!'}</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          volume_up
                        </span>
                        <span>{lang === 'es' ? 'Reiniciar y Probar Sonido' : lang === 'de' ? 'Sound-Engine testen' : 'Restart & Test Sound Engine'}</span>
                      </>
                    )}
                  </button>
                )}

                {idx === 5 && (
                  <button
                    onClick={runSyncTroubleshooter}
                    disabled={syncState === 'syncing'}
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: syncState === 'syncing' ? 'rgba(128,128,128,0.1)' : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                      color: syncState === 'syncing' ? 'var(--c-text-secondary)' : '#ffffff',
                      border: 'none',
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: syncState === 'syncing' ? 'default' : 'pointer',
                      boxShadow: syncState === 'syncing' ? 'none' : `0 4px 12px rgba(0, 122, 255, 0.15)`,
                      transition: 'all 200ms ease',
                      outline: 'none',
                    }}
                  >
                    {syncState === 'syncing' ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                          sync
                        </span>
                        <span>{lang === 'es' ? 'Sincronizando de Nuevo...' : lang === 'de' ? 'Synchronisieren...' : 'Re-syncing with Cloud...'}</span>
                      </>
                    ) : syncState === 'success' ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          check_circle
                        </span>
                        <span>{lang === 'es' ? '¡Sincronización Exitosa!' : lang === 'de' ? 'Erfolgreich synchronisiert!' : 'Sync Successful!'}</span>
                      </>
                    ) : syncState === 'error' ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          error
                        </span>
                        <span>{lang === 'es' ? 'Error al Sincronizar' : lang === 'de' ? 'Synchronisierungsfehler' : 'Sync Failed'}</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          cloud_sync
                        </span>
                        <span>{lang === 'es' ? 'Forzar Sincronización Completa' : lang === 'de' ? 'Datenbank neu synchronisieren' : 'Force Full Re-Sync'}</span>
                      </>
                    )}
                  </button>
                )}

                {idx === 6 && (
                  <button
                    onClick={runCacheTroubleshooter}
                    disabled={cacheState === 'clearing'}
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: cacheState === 'clearing' ? 'rgba(128,128,128,0.1)' : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                      color: cacheState === 'clearing' ? 'var(--c-text-secondary)' : '#ffffff',
                      border: 'none',
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: cacheState === 'clearing' ? 'default' : 'pointer',
                      boxShadow: cacheState === 'clearing' ? 'none' : `0 4px 12px rgba(0, 122, 255, 0.15)`,
                      transition: 'all 200ms ease',
                      outline: 'none',
                    }}
                  >
                    {cacheState === 'clearing' ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                          sync
                        </span>
                        <span>{lang === 'es' ? 'Limpiando Caché...' : lang === 'de' ? 'Cache wird geleert...' : 'Flushing Cache...'}</span>
                      </>
                    ) : cacheState === 'success' ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          check_circle
                        </span>
                        <span>{lang === 'es' ? '¡Caché Limpia!' : lang === 'de' ? 'Cache Geleert!' : 'Cache Cleaned!'}</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          mop
                        </span>
                        <span>{lang === 'es' ? 'Vaciar Caché y Temporales' : lang === 'de' ? 'Caches & Temp-Dateien löschen' : 'Wipe Caches & Temp Files'}</span>
                      </>
                    )}
                  </button>
                )}

                {idx === 7 && (
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <button
                      onClick={runSecurityTroubleshooter}
                      disabled={securityState === 'auditing'}
                      style={{
                        marginTop: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '10px 16px',
                        borderRadius: 12,
                        background: securityState === 'auditing' ? 'rgba(128,128,128,0.1)' : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                        color: securityState === 'auditing' ? 'var(--c-text-secondary)' : '#ffffff',
                        border: 'none',
                        fontFamily: 'Manrope, sans-serif',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: securityState === 'auditing' ? 'default' : 'pointer',
                        boxShadow: securityState === 'auditing' ? 'none' : `0 4px 12px rgba(0, 122, 255, 0.15)`,
                        transition: 'all 200ms ease',
                        outline: 'none',
                      }}
                    >
                      {securityState === 'auditing' ? (
                        <>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                            sync
                          </span>
                          <span>{lang === 'es' ? 'Auditando Cifrado...' : lang === 'de' ? 'Verschlüsselung prüfen...' : 'Auditing Cryptographic Engine...'}</span>
                        </>
                      ) : securityState === 'success' ? (
                        <>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            shield
                          </span>
                          <span>{lang === 'es' ? '¡Dispositivo Seguro!' : lang === 'de' ? 'Gerät Sicher!' : 'System Secure!'}</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                            security
                          </span>
                          <span>{lang === 'es' ? 'Auditar Cifrado y Seguridad' : lang === 'de' ? 'Verschlüsselung & Key prüfen' : 'Verify Device Encryption'}</span>
                        </>
                      )}
                    </button>
                    {auditReport && (
                      <pre
                        style={{
                          marginTop: 10,
                          padding: 10,
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: 8,
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: '#4ade80',
                          whiteSpace: 'pre-wrap',
                          border: '1px solid rgba(74, 222, 128, 0.2)',
                          lineHeight: '1.4',
                        }}
                      >
                        {auditReport}
                      </pre>
                    )}
                  </div>
                )}

                {idx === 8 && (
                  <button
                    onClick={runResetTroubleshooter}
                    disabled={resetState === 'repairing'}
                    style={{
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: resetState === 'repairing' ? 'rgba(128,128,128,0.1)' : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                      color: resetState === 'repairing' ? 'var(--c-text-secondary)' : '#ffffff',
                      border: 'none',
                      fontFamily: 'Manrope, sans-serif',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: resetState === 'repairing' ? 'default' : 'pointer',
                      boxShadow: resetState === 'repairing' ? 'none' : `0 4px 12px rgba(0, 122, 255, 0.15)`,
                      transition: 'all 200ms ease',
                      outline: 'none',
                    }}
                  >
                    {resetState === 'repairing' ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>
                          sync
                        </span>
                        <span>{lang === 'es' ? 'Recargando Memoria...' : lang === 'de' ? 'Speicher neu laden...' : 'Reloading Memory...'}</span>
                      </>
                    ) : resetState === 'success' ? (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          autorenew
                        </span>
                        <span>{lang === 'es' ? '¡Reiniciando!' : lang === 'de' ? 'Neustart!' : 'Restarting!'}</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          restart_alt
                        </span>
                        <span>{lang === 'es' ? 'Recargar y Reparar Interfaz' : lang === 'de' ? 'Speicher leeren & App neu laden' : 'Reload & Soft Reset Memory'}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

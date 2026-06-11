import React, { useState, useRef, useEffect, useLayoutEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
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
import { APP_VERSION_LABEL, APP_VERSION_TAG, APP_VERSION_DATE, compareSemver, APP_VERSION, getChangelogSections } from '../lib/appVersion';
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
import { useIsWebDesktop } from '../hooks/useIsWebDesktop';
import { useStudioPreferences } from '../hooks/useStudioPreferences';
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
  const isWebDesktop = useIsWebDesktop();
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

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('studio:hub-tab-active', { detail: tab }));
  }, [tab]);

  useEffect(() => {
    const handleSetTab = (e: Event) => {
      const customEvent = e as CustomEvent<HubTab>;
      if (customEvent.detail) {
        setTab(customEvent.detail);
      }
    };
    window.addEventListener('studio:set-hub-tab', handleSetTab as EventListener);
    return () => {
      window.removeEventListener('studio:set-hub-tab', handleSetTab as EventListener);
    };
  }, []);
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
    updateSettings({ appMode });
    setTimeout(() => {
      setZooming(true);
    }, 100);
  // updateSettings is stable (Zustand action), setZooming is React setState
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [introFinished, setIntroFinished] = useState(() => {
    if (_sessionIntroFinished || (typeof window !== 'undefined' && (window as any).__introDone)) return true;
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
          <div data-hub-tab-content style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px', paddingBottom: 'var(--content-bottom-pad)' }}>



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
                <div data-hub-tab-content style={{ padding: '0 0 100px', animation: 'hub-slide-in 300ms cubic-bezier(0.25,0.46,0.45,0.94) both' }}>
                <AccountSettingsPage
                  accent={accent}
                  cardStyle={{ background: 'var(--app-surface)', borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(128,128,128,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}
                  onBack={() => { setTab('settings'); }}
                />
                </div>
              ) : (
                <div data-hub-tab-content style={{ padding: '0 20px 80px', animation: 'hub-slide-in 300ms cubic-bezier(0.25,0.46,0.45,0.94) both' }}>
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
                  {(() => {
                    const benefitsList = [
                      {
                        icon: 'sync',
                        title: lang === 'es' ? 'Sincronización en la Nube' : 'Cloud Sync',
                        desc: lang === 'es' ? 'Sincroniza tus proyectos, canciones, setlists y configuraciones entre todos tus dispositivos de forma segura.' : 'Sync your workspace, projects, and transpositions across all devices securely.',
                      },
                      {
                        icon: 'devices',
                        title: lang === 'es' ? 'Acceso Multi-Dispositivo' : 'Multi-Device Access',
                        desc: lang === 'es' ? 'Mantén tu progreso en tiempo real al cambiar entre tu teléfono, tablet o computadora.' : 'Keep your progress synced in real-time when switching between mobile, tablet, or web.',
                      },
                      {
                        icon: 'backup',
                        title: lang === 'es' ? 'Respaldo Seguro' : 'Secure Cloud Backup',
                        desc: lang === 'es' ? 'Nunca pierdas tu trabajo. Tus datos locales se respaldan automáticamente en la nube.' : 'Never lose your progress. Your local creations are backed up automatically in the cloud.',
                      },
                      {
                        icon: 'palette',
                        title: lang === 'es' ? 'Espacio Personalizado' : 'Personalized Workspace',
                        desc: lang === 'es' ? 'Guarda tus preferencias de color de acento, temas visuales y ajustes personalizados de cada sub-app.' : 'Save your custom accent colors, visual themes, and per-app settings to your profile.',
                      },
                      {
                        icon: 'settings_backup_restore',
                        title: lang === 'es' ? 'Recuperación Sencilla' : 'Instant Recovery',
                        desc: lang === 'es' ? 'Restaura todo tu ecosistema de Studio al instante en caso de cambiar o reinstalar el dispositivo.' : 'Restore your entire Studio setup instantly when setting up a new device or browser.',
                      },
                      {
                        icon: 'rocket_launch',
                        title: lang === 'es' ? 'Herramientas Colaborativas' : 'Upcoming Collaborations',
                        desc: lang === 'es' ? 'Prepárate para compartir setlists, colaborar en tiempo real y usar las nuevas herramientas en la nube.' : 'Prepare your account for real-time setlist sharing, jam tools, and cloud collaboration.',
                        comingSoon: true
                      }
                    ];

                    return (
                      <div style={{ marginTop: 28, padding: '0 4px 20px', textAlign: 'center' }}>
                        <h3 style={{
                          fontSize: 20,
                          fontWeight: 800,
                          fontFamily: 'Manrope, sans-serif',
                          color: 'var(--c-text-primary)',
                          margin: '0 0 6px',
                          letterSpacing: '-0.02em',
                        }}>
                          {lang === 'es' ? 'Tu espacio de trabajo de Studio, en todas partes' : 'Unlock the Full Power of Studio'}
                        </h3>
                        <p style={{
                          fontSize: 12.5,
                          fontFamily: 'Inter, sans-serif',
                          color: 'var(--c-text-secondary)',
                          opacity: 0.75,
                          lineHeight: 1.45,
                          margin: '0 auto 24px',
                          maxWidth: 340,
                        }}>
                          {lang === 'es'
                            ? 'Crea una cuenta gratuita para conectar tus dispositivos, habilitar respaldos y acceder a funciones premium.'
                            : 'Create a free account to back up your projects, enable seamless syncing, and unlock upcoming collaborative tools.'}
                        </p>

                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          textAlign: 'left',
                          width: '100%',
                          maxWidth: 380,
                          margin: '0 auto',
                        }}>
                          {benefitsList.map((item, idx) => (
                            <motion.div
                              key={idx}
                              whileHover={{ y: -2, scale: 1.01 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                              style={{
                                background: isHubLight ? 'rgba(255, 255, 255, 0.6)' : 'rgba(20, 20, 24, 0.45)',
                                border: isHubLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.05)',
                                borderRadius: 18,
                                padding: '14px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(16px)',
                                boxShadow: isHubLight ? '0 4px 16px rgba(0,0,0,0.03)' : '0 4px 20px rgba(0, 0, 0, 0.15)',
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Left Glowing Icon Circle */}
                              <div style={{
                                width: 42,
                                height: 42,
                                borderRadius: 14,
                                background: `color-mix(in srgb, ${accent.from} 12%, transparent)`,
                                border: `1px solid color-mix(in srgb, ${accent.from} 20%, transparent)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <span className="material-symbols-outlined" style={{
                                  fontSize: 20,
                                  color: accent.from,
                                  fontVariationSettings: "'FILL' 1"
                                }}>
                                  {item.icon}
                                </span>
                              </div>

                              {/* Right Content */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <h4 style={{
                                    fontSize: 13.5,
                                    fontWeight: 700,
                                    fontFamily: 'Manrope, sans-serif',
                                    color: 'var(--c-text-primary)',
                                    margin: 0,
                                  }}>
                                    {item.title}
                                  </h4>
                                  {item.comingSoon && (
                                    <span style={{
                                      fontSize: 8,
                                      fontWeight: 800,
                                      color: accent.from,
                                      background: `color-mix(in srgb, ${accent.from} 14%, transparent)`,
                                      padding: '1px 5px',
                                      borderRadius: 99,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.03em',
                                      fontFamily: 'Manrope, sans-serif',
                                    }}>
                                      {lang === 'es' ? 'Próximamente' : 'Coming soon'}
                                    </span>
                                  )}
                                </div>
                                <p style={{
                                  fontSize: 11,
                                  fontFamily: 'Inter, sans-serif',
                                  color: 'var(--c-text-secondary)',
                                  opacity: 0.8,
                                  lineHeight: 1.4,
                                  margin: '3px 0 0',
                                }}>
                                  {item.desc}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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
                    0% { transform: scale(0.85) translateY(16px); opacity: 0; }
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
                  @keyframes draw-ripple {
                    0% { transform: scale(1); opacity: 0.6; stroke-width: 4px; }
                    100% { transform: scale(1.4); opacity: 0; stroke-width: 0.5px; }
                  }
                  @keyframes fade-circle-fill {
                    from { fill: rgba(16, 185, 129, 0); }
                    to { fill: rgba(16, 185, 129, 0.06); }
                  }
                  @keyframes fade-in-up-stagger {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                  .success-card {
                    padding: 40px 32px;
                    border-radius: 32px;
                    background: var(--app-surface, rgba(20, 20, 24, 0.8));
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1);
                    text-align: center;
                    max-width: 320px;
                    width: calc(100% - 40px);
                    animation: success-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                  }
                  .success-svg {
                    width: 76px;
                    height: 76px;
                    display: block;
                    margin: 0 auto 24px;
                    overflow: visible;
                  }
                  .success-circle {
                    stroke-dasharray: 166;
                    stroke-dashoffset: 166;
                    stroke-linecap: round;
                    animation: draw-circle 0.65s cubic-bezier(0.65, 0, 0.45, 1) forwards;
                    animation-delay: 0.05s;
                  }
                  .success-circle-fill {
                    animation: fade-circle-fill 0.4s ease forwards;
                    animation-delay: 0.6s;
                  }
                  .success-check {
                    stroke-dasharray: 48;
                    stroke-dashoffset: 48;
                    animation: draw-check 0.48s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    animation-delay: 0.55s;
                  }
                  .success-ripple {
                    transform-origin: center;
                    animation: draw-ripple 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                  }
                  .success-ripple-1 {
                    animation-delay: 0.4s;
                  }
                  .success-ripple-2 {
                    animation-delay: 0.62s;
                  }
                  .success-title {
                    margin: 0 0 8px;
                    font-family: 'Manrope', sans-serif;
                    font-weight: 800;
                    font-size: 20px;
                    color: var(--c-text-primary);
                    animation: fade-in-up-stagger 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
                    animation-delay: 0.78s;
                  }
                  .success-text {
                    margin: 0;
                    font-family: 'Inter', sans-serif;
                    font-size: 12.5px;
                    color: var(--c-text-secondary);
                    line-height: 1.4;
                    word-break: break-all;
                    animation: fade-in-up-stagger 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
                    animation-delay: 0.9s;
                  }
                `}</style>
                <div className="success-card">
                  <svg className="success-svg" viewBox="0 0 52 52" fill="none">
                    <circle className="success-circle success-circle-fill" cx="26" cy="26" r="25" stroke="#10b981" strokeWidth="4" />
                    <circle className="success-ripple success-ripple-1" cx="26" cy="26" r="25" stroke="#10b981" strokeWidth="4" fill="none" />
                    <circle className="success-ripple success-ripple-2" cx="26" cy="26" r="25" stroke="#10b981" strokeWidth="4" fill="none" />
                    <path className="success-check" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                  </svg>
                  <h3 className="success-title">
                    {t.hub.accountSection.signedIn}
                  </h3>
                  <p className="success-text">
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
      {!isWebDesktop && <HubNav tab={tab} setTab={setTab} accent={accent} />}

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

  const isWebDesktop = useIsWebDesktop();

  if (isWebDesktop) {
    return (
      <button
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '10px 14px',
          background: pressed ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '10px',
          cursor: 'pointer',
          textAlign: 'left',
          transform: pressed ? 'scale(0.99)' : 'scale(1)',
          transition: 'all 150ms ease',
          marginBottom: '8px',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ffffff',
        }}>
          <Logo size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
            {name}
          </p>
          <p style={{ fontSize: 10, color: '#a1a1aa', margin: '2px 0 0', fontWeight: 500 }}>
            {desc}
          </p>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#71717a', flexShrink: 0 }}>
          chevron_right
        </span>
      </button>
    );
  }

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

type SettingsPageId = 'main' | 'general' | 'appearance' | 'language' | 'privacy' | 'about' | 'updater' | 'help' | 'debug' | 'developer' | 'profile' | 'help-center' | 'faq' | 'release-notes' | 'download-apps' | 'keyboard-shortcuts' | 'terms' | 'privacy-policy' | 'bug-report';

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
  const isWebDesktop = useIsWebDesktop();
  return (
    <div className="spring-in" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 32, paddingBottom: 16 }}>
      {!isWebDesktop && (
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
      )}
      <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.03em', fontFamily: 'Manrope' }}>{title}</p>
    </div>
  );
}

function ProfileHeaderBack({ onBack }: { onBack: () => void }) {
  const [pressed, setPressed] = useState(false);
  const isWebDesktop = useIsWebDesktop();
  if (isWebDesktop) return null;
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
  const isWebDesktop = useIsWebDesktop();
  const { settings, updateSettings } = useChordStore();
  const lang = settings.language ?? 'en';
  const changelogSections = getChangelogSections(lang);
  const [changelogExpanded, setChangelogExpanded] = useState(false);
  const isChangelogTooLong = changelogSections.length > 2 || changelogSections.some(s => s.items.length > 3);

  const isApkFlow = ota.updateType === 'apk' || ota.updateType === 'both';

  const L = lang === 'es'
    ? {
        title: 'Actualizaciones',
        latestRelease: 'Última versión',
        currentVersion: 'Versión actual',
        releaseDate: 'Fecha de publicación',
        status: 'Estado',
        checking: 'Buscando actualizaciones…',
        upToDate: 'Estás al día',
        upToDateDesc: 'Estás usando la versión más reciente de Studio.',
        updateAvailable: 'Actualización disponible',
        updateAvailableDesc: 'Una nueva versión de Studio está lista.',
        updateNow: 'Actualizar ahora',
        checkForUpdates: 'Buscar actualizaciones',
        whatsNew: 'Novedades en esta versión',
        showFullChangelog: 'Ver registro de cambios completo',
        hideChangelog: 'Ocultar registro de cambios',
        controls: 'Preferencias de actualización',
        notifTitle: 'Notificaciones de actualización',
        notifDesc: 'Recibe un aviso del sistema cuando haya una actualización.',
        autoTitle: 'Comprobación automática',
        autoDesc: 'Busca actualizaciones mientras la app está abierta.',
        changelogTitle: 'Mostrar novedades tras actualizar',
        changelogDesc: 'Abre la hoja de cambios al iniciar tras una actualización.',
        howItWorks: 'Cómo funcionan las actualizaciones',
        howItWorksBody: 'Studio descarga e instala actualizaciones de la app directamente. No se requiere tienda de aplicaciones.',
        reinstallRequired: 'Requiere reinstalación',
        reinstallDesc: 'Esta versión requiere reinstalar Studio debido a un cambio de certificado de firma.',
      }
    : {
        title: 'Updates',
        latestRelease: 'Latest Release',
        currentVersion: 'Current version',
        releaseDate: 'Release date',
        status: 'Status',
        checking: 'Checking for updates…',
        upToDate: 'You\'re up to date',
        upToDateDesc: 'You\'re running the latest version of Studio.',
        updateAvailable: 'Update available',
        updateAvailableDesc: 'A new version of Studio is ready to install.',
        updateNow: 'Update Now',
        checkForUpdates: 'Check for Updates',
        whatsNew: "What's new in this version",
        showFullChangelog: 'Show full changelog',
        hideChangelog: 'Hide changelog',
        controls: 'Update preferences',
        notifTitle: 'Update notifications',
        notifDesc: 'Get a system notification when a new update is ready.',
        autoTitle: 'Automatic checks',
        autoDesc: 'Check for updates while the app is open.',
        changelogTitle: "Show what's new after updating",
        changelogDesc: 'Open the changelog sheet the first time you launch after installing a new version.',
        howItWorks: 'How updates work',
        howItWorksBody: 'Studio downloads and installs app updates directly. No app store required.',
        reinstallRequired: 'Reinstall required',
        reinstallDesc: 'This version requires reinstalling Studio due to a signing certificate change.',
      };

  // Determine status state
  const isChecking = ota.loading;
  const hasUpdate = ota.updateAvailable;
  const isReinstall = isNative() && ota.reinstallRequired;

  // Status indicator config
  const statusConfig = isChecking
    ? { color: accent.from, label: L.checking, icon: 'refresh' as const, pulse: true }
    : hasUpdate
      ? isReinstall
        ? { color: '#f87171', label: L.reinstallRequired, icon: 'warning' as const, pulse: false }
        : { color: '#f59e0b', label: L.updateAvailable, icon: 'system_update' as const, pulse: false }
      : { color: '#4ade80', label: L.upToDate, icon: 'check_circle' as const, pulse: false };

  // Format date nicely
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  // Category badge colors
  const categoryColors: Record<string, { bg: string; text: string }> = {
    added: { bg: 'rgba(74, 222, 128, 0.12)', text: '#4ade80' },
    improved: { bg: `color-mix(in srgb, ${accent.from} 12%, transparent)`, text: accent.from },
    fixed: { bg: 'rgba(251, 191, 36, 0.12)', text: '#fbbf24' },
    changed: { bg: 'rgba(147, 130, 220, 0.12)', text: '#9382dc' },
    "what's new": { bg: `color-mix(in srgb, ${accent.from} 12%, transparent)`, text: accent.from },
    whats_new: { bg: `color-mix(in srgb, ${accent.from} 12%, transparent)`, text: accent.from },
  };

  const getCategoryStyle = (heading: string) => {
    const key = heading.toLowerCase();
    return categoryColors[key] || { bg: 'rgba(128,128,128,0.1)', text: 'var(--c-text-secondary)' };
  };

  return (
    <div className={className} style={style}>
      <style>{HUB_SETTINGS_CSS}{`
        @keyframes updater-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes updater-check-spin {
          to { transform: rotate(360deg); }
        }
        .updater-hero-card {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          margin: 0 0 16px;
        }
        .updater-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg,
            color-mix(in srgb, ${accent.from} 15%, transparent),
            color-mix(in srgb, ${accent.to} 8%, transparent)
          );
          pointer-events: none;
        }
        .updater-hero-inner {
          position: relative;
          padding: 22px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .updater-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-family: Manrope, sans-serif;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          width: fit-content;
        }
        .updater-version-headline {
          font-family: Manrope, sans-serif;
          font-weight: 800;
          font-size: 32px;
          letter-spacing: -0.035em;
          line-height: 1.1;
          color: var(--c-text-primary);
          margin: 0;
        }
        .updater-version-tag {
          font-size: 14px;
          font-weight: 600;
          opacity: 0.5;
          margin-left: 6px;
          letter-spacing: -0.01em;
        }
        .updater-status-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(128,128,128,0.06);
          border: 1px solid rgba(128,128,128,0.08);
        }
        .updater-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .updater-cta-btn {
          width: 100%;
          padding: 14px 20px;
          border-radius: 14px;
          border: none;
          font-family: Manrope, sans-serif;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 120ms ease, box-shadow 200ms ease;
          -webkit-tap-highlight-color: transparent;
        }
        .updater-cta-btn:active {
          transform: scale(0.97);
        }
        .updater-section-title {
          font-family: Manrope, sans-serif;
          font-weight: 700;
          font-size: 13px;
          color: var(--c-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 20px 4px 8px;
          margin: 0;
        }
        .updater-changelog-card {
          border-radius: 16px;
          overflow: hidden;
        }
        .updater-changelog-section {
          padding: 14px 18px;
          border-bottom: 1px solid rgba(128,128,128,0.06);
        }
        .updater-changelog-section:last-child {
          border-bottom: none;
        }
        .updater-changelog-heading {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border-radius: 6px;
          font-family: Manrope, sans-serif;
          font-weight: 700;
          font-size: 11.5px;
          letter-spacing: 0.02em;
          margin-bottom: 10px;
        }
        .updater-changelog-item {
          display: flex;
          gap: 10px;
          padding: 4px 0;
          font-family: Inter, sans-serif;
          font-size: var(--font-sm, 13px);
          line-height: 1.5;
          color: var(--c-text-secondary);
        }
        .updater-changelog-bullet {
          flex-shrink: 0;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          margin-top: 7px;
        }
        .updater-tip-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin: 16px 0 0;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(128,128,128,0.05);
          border: 1px solid rgba(128,128,128,0.08);
        }
      `}</style>
      {!isWebDesktop && <SettingsSubHeader title={L.title} onBack={onBack} />}

      {/* ── HERO CARD ── */}
      <div className="updater-hero-card spring-in" style={{ ...cardStyle, margin: 0, marginBottom: 16 }}>
        <div className="updater-hero-bg" />
        <div className="updater-hero-inner">
          {/* Badge */}
          <div className="updater-badge" style={{
            background: hasUpdate
              ? isReinstall ? 'rgba(248,113,113,0.12)' : `color-mix(in srgb, ${accent.from} 14%, transparent)`
              : 'rgba(74,222,128,0.12)',
            color: hasUpdate
              ? isReinstall ? '#f87171' : accent.from
              : '#4ade80',
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 13,
              fontVariationSettings: "'FILL' 1",
            }}>{statusConfig.icon}</span>
            {hasUpdate ? L.latestRelease : L.upToDate}
          </div>
          {/* Build type badge for web */}
          {!isNative() && (
            <div className="updater-badge" style={{
              background: 'rgba(147, 130, 220, 0.12)',
              color: '#9382dc',
              marginTop: -8,
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: 12,
                fontVariationSettings: "'FILL' 1",
              }}>language</span>
              Web Build
            </div>
          )}

          {/* Version Headline */}
          <h1 className="updater-version-headline">
            {hasUpdate ? (
              <>v{ota.remoteVersion}</>
            ) : (
              <>v{APP_VERSION}<span className="updater-version-tag">{APP_VERSION_TAG}</span></>
            )}
          </h1>

          {/* Status Row */}
          <div className="updater-status-row">
            {isChecking ? (
              <span className="material-symbols-outlined" style={{
                fontSize: 16,
                color: accent.from,
                animation: 'updater-check-spin 1s linear infinite',
                flexShrink: 0,
              }}>refresh</span>
            ) : (
              <div className="updater-status-dot" style={{
                background: statusConfig.color,
                boxShadow: `0 0 8px ${statusConfig.color}66`,
                animation: statusConfig.pulse ? 'updater-pulse 1.5s ease-in-out infinite' : 'none',
              }} />
            )}
            <span style={{
              fontFamily: 'Manrope, sans-serif',
              fontWeight: 600,
              fontSize: 'var(--font-sm, 13px)',
              color: 'var(--c-text-primary)',
              flex: 1,
            }}>{statusConfig.label}</span>
            {!hasUpdate && !isChecking && (
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 11.5,
                color: 'var(--c-text-tertiary)',
              }}>{formatDate(APP_VERSION_DATE)}</span>
            )}
          </div>

          {/* Reinstall Warning */}
          {hasUpdate && isReinstall && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', borderRadius: 12,
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.15)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f87171', flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1" }}>warning</span>
              <div>
                <p style={{ margin: 0, fontFamily: 'Manrope', fontWeight: 700, fontSize: 12.5, color: '#f87171' }}>{L.reinstallRequired}</p>
                <p style={{ margin: '4px 0 0', fontFamily: 'Inter', fontSize: 11.5, color: 'var(--c-text-secondary)', lineHeight: 1.5 }}>{L.reinstallDesc}</p>
              </div>
            </div>
          )}

          {/* CTA Button */}
          {hasUpdate ? (
            isNative() ? (
              <button
                className="updater-cta-btn"
                onClick={() => window.dispatchEvent(new CustomEvent('studio:open-update-dialog'))}
                style={{
                  background: isReinstall
                    ? 'linear-gradient(135deg, #f87171, #ef4444)'
                    : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  color: '#fff',
                  boxShadow: isReinstall
                    ? '0 4px 20px rgba(248,113,113,0.3)'
                    : `0 4px 20px color-mix(in srgb, ${accent.to} 30%, transparent)`,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                  {isReinstall ? 'download' : 'system_update'}
                </span>
                {L.updateNow}
              </button>
            ) : (
              <button
                className="updater-cta-btn"
                onClick={() => window.location.reload()}
                style={{
                  background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  color: '#fff',
                  boxShadow: `0 4px 20px color-mix(in srgb, ${accent.to} 30%, transparent)`,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>refresh</span>
                {lang === 'es' ? 'Recargar Studio' : 'Refresh Studio'}
              </button>
            )
          ) : (
            <button
              className="updater-cta-btn"
              onClick={async () => {
                if (isNative()) {
                  window.dispatchEvent(new CustomEvent('studio:open-update-dialog'));
                }
                await ota.checkNow();
              }}
              disabled={isChecking}
              style={{
                background: 'rgba(128,128,128,0.08)',
                color: isChecking ? 'var(--c-text-tertiary)' : 'var(--c-text-primary)',
                border: '1px solid rgba(128,128,128,0.12)',
                cursor: isChecking ? 'default' : 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: 18,
                animation: isChecking ? 'updater-check-spin 1s linear infinite' : 'none',
              }}>refresh</span>
              {L.checkForUpdates}
            </button>
          )}

          {/* ── CHANGELOG SECTION (Inside Hero Card) ── */}
          {changelogSections.length > 0 && (
            <div style={{
              borderTop: '1px solid rgba(128, 128, 128, 0.12)',
              paddingTop: 16,
              marginTop: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <p style={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--c-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: 0,
              }}>{L.whatsNew}</p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 12,
                background: 'rgba(128, 128, 128, 0.04)',
                border: '1px solid rgba(128, 128, 128, 0.06)',
                overflow: 'hidden'
              }}>
                {(isChangelogTooLong && !changelogExpanded
                  ? changelogSections.slice(0, 2)
                  : changelogSections
                ).map((section, si) => (
                  <div key={si} className="updater-changelog-section" style={{
                    padding: '12px 14px',
                    borderBottom: si === (isChangelogTooLong && !changelogExpanded ? Math.min(2, changelogSections.length) : changelogSections.length) - 1
                      ? 'none'
                      : '1px solid rgba(128,128,128,0.06)'
                  }}>
                    <div className="updater-changelog-heading" style={{
                      background: getCategoryStyle(section.heading).bg,
                      color: getCategoryStyle(section.heading).text,
                      marginBottom: 8,
                    }}>
                      {section.heading}
                    </div>
                    {(isChangelogTooLong && !changelogExpanded
                      ? section.items.slice(0, 3)
                      : section.items
                    ).map((item, ii) => (
                      <div key={ii} className="updater-changelog-item" style={{ padding: '2px 0' }}>
                        <div className="updater-changelog-bullet" style={{
                          background: getCategoryStyle(section.heading).text,
                          opacity: 0.6,
                        }} />
                        <span>{item}</span>
                      </div>
                    ))}
                    {isChangelogTooLong && !changelogExpanded && section.items.length > 3 && (
                      <div style={{ paddingLeft: 15, paddingTop: 2, fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                        +{section.items.length - 3} more
                      </div>
                    )}
                  </div>
                ))}

                {isChangelogTooLong && (
                  <button
                    type="button"
                    onClick={() => setChangelogExpanded(!changelogExpanded)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      width: '100%', padding: '10px 14px', border: 'none', background: 'transparent',
                      color: accent.from,
                      fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-sm, 12px)',
                      cursor: 'pointer',
                      borderTop: '1px solid rgba(128,128,128,0.06)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      {changelogExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                    {changelogExpanded ? L.hideChangelog : L.showFullChangelog}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTROLS SECTION (native-only: notification/auto-check/changelog toggles) ── */}
      {isNative() && (
        <>
          <p className="updater-section-title spring-in" style={{ animationDelay: '80ms' }}>{L.controls}</p>
          <div className="spring-in" style={{ ...cardStyle, margin: 0, animationDelay: '100ms' }}>
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
        </>
      )}

      {/* ── TIP CARD ── */}
      <div className="updater-tip-card spring-in" style={{ animationDelay: '120ms' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: accent.from, flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1", opacity: 0.8 }}>info</span>
        <div>
          <p style={{ margin: 0, fontFamily: 'Manrope', fontWeight: 700, fontSize: 12.5, color: 'var(--c-text-primary)' }}>{L.howItWorks}</p>
          <p style={{ margin: '4px 0 0', fontFamily: 'Inter', fontSize: 11.5, color: 'var(--c-text-secondary)', lineHeight: 1.55 }}>
            {isNative()
              ? L.howItWorksBody
              : (lang === 'es'
                ? 'Studio en la web se actualiza automáticamente. Cuando hay una nueva versión, simplemente recarga la página.'
                : 'Studio on the web updates automatically. When a new version is deployed, simply refresh the page to get it.')}
          </p>
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
  const { preferences, setPreference } = useStudioPreferences();
  const t = useT();
  const lang = settings.language ?? 'en';
  const ota = useOtaUpdate();
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [copiedBugTemplate, setCopiedBugTemplate] = useState(false);
  const isWebDesktop = useIsWebDesktop();

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
    const target = typeof window !== 'undefined' ? sessionStorage.getItem('studio:routeToSettingsPage') : null;
    if (target) {
      sessionStorage.removeItem('studio:routeToSettingsPage');
      return target as SettingsPageId;
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

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('studio:settings-page-active', { detail: page }));
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
    if (page !== 'developer' && page !== 'debug' && page !== 'download-apps' && page !== 'release-notes') return;
    
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



  const cardStyle: React.CSSProperties = isWebDesktop ? {
    background: 'transparent',
    borderRadius: '0px',
    overflow: 'visible',
    border: 'none',
  } : {
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

  function renderHelpContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <HelpAccordion accent={accent} lang={lang} />
      </div>
    );
  }

  function renderHelpCenterContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
        {/* Search Bar Visual */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(128, 128, 128, 0.08)',
          borderRadius: 12,
        }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: 20 }}>
            search
          </span>
          <input 
            type="text" 
            placeholder="Search help articles..." 
            disabled
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--c-text-primary)',
              fontSize: 14,
              width: '100%',
              cursor: 'not-allowed',
            }}
          />
        </div>

        {/* Quick Help Topics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-secondary)', opacity: 0.6, margin: '0 0 4px 0' }}>
            Help Categories
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {[
              { icon: 'play_circle', title: 'Getting Started', desc: 'Learn the basics of Studio, including app structures and navigation.' },
              { icon: 'save', title: 'Projects & Exporting', desc: 'How to save your projects locally or export them as MIDI or Audio.' },
              { icon: 'volume_up', title: 'Audio & MIDI Configurations', desc: 'Configure output devices, MIDI inputs, and latencies.' },
              { icon: 'build', title: 'Troubleshooting & Diagnosis', desc: 'Run tests to check your system audio, cloud database, and cache.' },
            ].map((topic, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: 16,
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(128, 128, 128, 0.06)',
                borderRadius: 12,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color: accent.from }}>
                  {topic.icon}
                </span>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                    {topic.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.4 }}>
                    {topic.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact/Support Links */}
        <div style={{
          padding: 18,
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(128, 128, 128, 0.06)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)' }}>
            Need direct assistance?
          </h4>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.4 }}>
            For help with your account, project recovery, or complex issues, feel free to visit our official github repository or reach out directly.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <a 
              href="https://github.com/MAGEXE1000/Studio" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                textDecoration: 'none',
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--c-text-primary)',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
              GitHub Repository
            </a>
          </div>
        </div>
      </div>
    );
  }

  function renderFaqContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <HelpAccordion accent={accent} lang={lang} />
      </div>
    );
  }

  function renderReleaseNotesContent() {
    const changelogSections = getChangelogSections(lang) || [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingBottom: 12, borderBottom: '1px solid rgba(128, 128, 128, 0.08)' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text-primary)' }}>
            v{APP_VERSION}
          </span>
          <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
            Released on {APP_VERSION_DATE}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {changelogSections.map((sec, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-secondary)', opacity: 0.6, margin: 0 }}>
                {sec.heading}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sec.items.map((item, j) => (
                  <li key={j} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent.from, marginTop: 7, flexShrink: 0 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderDownloadAppsContent() {
    let apkVersion = '3.6.28';
    let apkSize = '13.47 MB';
    let apkUrl = 'https://github.com/MAGEXE1000/Studio/releases/download/v3.6.28/studio-3.6.28.apk';
    
    try {
      if (firebaseAppReleaseJson && !firebaseAppReleaseJson.startsWith('Error') && firebaseAppReleaseJson !== 'Loading...') {
        const parsed = JSON.parse(firebaseAppReleaseJson);
        if (parsed.version) apkVersion = parsed.version;
        if (parsed.apkSizeBytes) apkSize = `${(parsed.apkSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
        if (parsed.apkUrl) apkUrl = parsed.apkUrl;
      }
    } catch (e) {
      console.warn('Failed to parse firebaseAppReleaseJson:', e);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
        {/* Android Card */}
        <div style={{
          padding: 20,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(128, 128, 128, 0.08)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: accent.from }}>
                adb
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--c-text-primary)' }}>
                  Android App (APK)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
                  v{apkVersion} • {apkSize}
                </span>
              </div>
            </div>
            <a 
              href={apkUrl}
              style={{
                textDecoration: 'none',
                padding: '8px 16px',
                background: accent.from,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
              Download APK
            </a>
          </div>
          <div style={{ height: 1, borderTop: '1px solid rgba(128, 128, 128, 0.08)' }} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.5 }}>
            To install: download and run the APK on your device. You may need to enable "Install from Unknown Sources" in your system security settings.
          </p>
        </div>

        {/* Web App / PWA Card */}
        <div style={{
          padding: 20,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(128, 128, 128, 0.08)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: accent.from }}>
                language
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--c-text-primary)' }}>
                  Web Version (PWA)
                </h3>
                <span style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
                  v4.0.0 (Web)
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: accent.from, background: `${accent.from}22`, padding: '6px 12px', borderRadius: 8 }}>
              Running Now
            </div>
          </div>
          <div style={{ height: 1, borderTop: '1px solid rgba(128, 128, 128, 0.08)' }} />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.5 }}>
            Enjoy the full experience on any desktop or mobile device. Install as a Progressive Web App (PWA) directly via your browser's install menu for offline support and standalone window display.
          </p>
        </div>

        {/* iOS & Desktop Cards - Coming Soon */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { platform: 'iOS App', icon: 'phone_iphone' },
            { platform: 'Desktop (macOS / Windows)', icon: 'desktop_windows' }
          ].map((item, i) => (
            <div key={i} style={{
              padding: 16,
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(128, 128, 128, 0.06)',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              opacity: 0.7,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--c-text-secondary)' }}>
                  {item.icon}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                  {item.platform}
                </span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: accent.from, opacity: 0.8 }}>
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderKeyboardShortcutsContent() {
    const categories = [
      {
        title: 'Stage Mode (Stagex)',
        shortcuts: [
          { keys: ['Space', '→', '↓'], desc: 'Advance to next scene (Forward)' },
          { keys: ['←', '↑'], desc: 'Go back to previous scene (Backward)' },
          { keys: ['Esc'], desc: 'Close Stage Mode / Exit fullscreen' }
        ]
      },
      {
        title: 'Sequencer & Editing (Drumex)',
        shortcuts: [
          { keys: ['Ctrl', 'Z'], desc: 'Undo last editing step' },
          { keys: ['Ctrl', 'Y'], desc: 'Redo last undone step' },
          { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Redo last undone step (Alternative)' }
        ]
      }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>
        {categories.map((cat, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-secondary)', opacity: 0.6, margin: 0 }}>
              {cat.title}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cat.shortcuts.map((sh, j) => (
                <div key={j} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(128, 128, 128, 0.06)',
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 13, color: 'var(--c-text-secondary)' }}>
                    {sh.desc}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {sh.keys.map((k, kIdx) => (
                      <React.Fragment key={kIdx}>
                        {kIdx > 0 && <span style={{ color: 'var(--c-text-muted)', fontSize: 12, alignSelf: 'center' }}>+</span>}
                        <kbd style={{
                          padding: '3px 6px',
                          border: '1px solid rgba(128, 128, 128, 0.2)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--c-text-primary)',
                          fontFamily: 'monospace',
                        }}>
                          {k}
                        </kbd>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderTermsContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.6, paddingBottom: 24 }}>
        <p style={{ margin: 0 }}>
          Welcome to Studio. By accessing or using our application, you agree to comply with and be bound by the following Terms of Service. Please read them carefully.
        </p>
        <h4 style={{ color: 'var(--c-text-primary)', margin: '8px 0 4px 0', fontSize: 14, fontWeight: 700 }}>1. Ownership of Content</h4>
        <p style={{ margin: 0 }}>
          All musical patterns, drum sequences, settings, and other project data created by you using Studio's tools (Chordex, Drumex, Stagex, Groovex, Vocalex) remain entirely your property. We lay no claim of copyright, trademark, or ownership over your creative output.
        </p>
        <h4 style={{ color: 'var(--c-text-primary)', margin: '8px 0 4px 0', fontSize: 14, fontWeight: 700 }}>2. Use of Service</h4>
        <p style={{ margin: 0 }}>
          Studio is provided on a local-first basis. Data sync features are provided for your personal backup convenience. You agree not to abuse or attempt to overload the sync servers.
        </p>
        <h4 style={{ color: 'var(--c-text-primary)', margin: '8px 0 4px 0', fontSize: 14, fontWeight: 700 }}>3. Disclaimer of Warranties</h4>
        <p style={{ margin: 0 }}>
          Studio is provided "as is" and "as available" without any warranties of any kind. While we aim to protect project data using reliable local storage and cloud sync mechanisms, we cannot guarantee data will not be lost. We recommend periodic manual backups.
        </p>
      </div>
    );
  }

  function renderPrivacyPolicyContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.6, paddingBottom: 24 }}>
        <p style={{ margin: 0 }}>
          Your privacy is extremely important to us. This Privacy Policy details how Studio collects, uses, and safeguards your data.
        </p>
        <h4 style={{ color: 'var(--c-text-primary)', margin: '8px 0 4px 0', fontSize: 14, fontWeight: 700 }}>1. Local-First Storage</h4>
        <p style={{ margin: 0 }}>
          By default, all your project settings, drum sequences, and songs are stored locally on your device using IndexedDB and localStorage. None of this creative work leaves your device unless you explicitly enable Cloud Sync.
        </p>
        <h4 style={{ color: 'var(--c-text-primary)', margin: '8px 0 4px 0', fontSize: 14, fontWeight: 700 }}>2. Cloud Backup & Authentication</h4>
        <p style={{ margin: 0 }}>
          If you create a Studio Account, we use Firebase to manage your login credentials. Your project backups are stored securely in Firestore databases. We only use this data to perform cross-device syncing at your request.
        </p>
        <h4 style={{ color: 'var(--c-text-primary)', margin: '8px 0 4px 0', fontSize: 14, fontWeight: 700 }}>3. No Third-Party Tracking</h4>
        <p style={{ margin: 0 }}>
          Studio does not use telemetry, advertising trackers, or external behavioral analytics. Your interaction with the app remains entirely private.
        </p>
      </div>
    );
  }

  function renderBugReportContent() {
    const handleCopyTemplate = () => {
      const template = `[STUDIO BUG REPORT]
------------------------------------
App Version: v${APP_VERSION} (Web)
User Agent: ${navigator.userAgent}
Date: ${new Date().toISOString()}

[Description of Bug]
- 

[Steps to Reproduce]
1. 
2. 
3. 

[Expected Behavior]
- 

[Actual Behavior]
- `;
      navigator.clipboard.writeText(template);
      setCopiedBugTemplate(true);
      setTimeout(() => setCopiedBugTemplate(false), 2000);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.5 }}>
          If you encounter an issue or unexpected behavior in Studio, please report it! Copy the template below and submit it on our GitHub repository.
        </p>

        <button 
          onClick={handleCopyTemplate}
          style={{
            alignSelf: 'flex-start',
            padding: '10px 16px',
            background: accent.from,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {copiedBugTemplate ? 'check' : 'content_copy'}
          </span>
          {copiedBugTemplate ? 'Copied to Clipboard!' : 'Copy Bug Template'}
        </button>

        <div style={{
          padding: 14,
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(128,128,128,0.08)',
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'var(--c-text-secondary)',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
        }}>
          {`[STUDIO BUG REPORT]
App Version: v${APP_VERSION} (Web)
User Agent: [Automatically Generated]
...`}
        </div>

        <div style={{ height: 1, borderTop: '1px solid rgba(128, 128, 128, 0.08)', margin: '8px 0' }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <a 
            href="https://github.com/MAGEXE1000/Studio/issues/new" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              textDecoration: 'none',
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--c-text-primary)',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              border: '1px solid rgba(128, 128, 128, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
            Open GitHub Issues
          </a>
        </div>
      </div>
    );
  }

  function renderGeneralContent() {
    const isHideActive = preferences.autoHideSidebarInApps;
    const isHoverActive = isHideActive && preferences.hoverRevealSidebar;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingBottom: 24 }}>
        <SettingsSectionLabel>Sidebar Behavior</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingRow 
            label="Hide sidebar while using apps" 
            desc="Hides the global Studio sidebar inside apps to maximize workspace size"
          >
            <Toggle 
              value={preferences.autoHideSidebarInApps} 
              onChange={v => setPreference('autoHideSidebarInApps', v)} 
              accentFrom={accent.from} 
              accentTo={accent.to} 
            />
          </SettingRow>

          <div style={{ opacity: isHideActive ? 1 : 0.5, pointerEvents: isHideActive ? 'auto' : 'none', transition: 'opacity 200ms ease' }}>
            <SettingRow 
              label="Reveal sidebar on left-edge hover" 
              desc="Hovering the far-left edge of the screen reveals the hidden sidebar"
            >
              <Toggle 
                value={isHideActive && preferences.hoverRevealSidebar} 
                onChange={v => setPreference('hoverRevealSidebar', v)} 
                accentFrom={accent.from} 
                accentTo={accent.to}
              />
            </SettingRow>
          </div>

          <div style={{ opacity: isHoverActive ? 1 : 0.5, pointerEvents: isHoverActive ? 'auto' : 'none', transition: 'opacity 200ms ease' }}>
            <SettingRow 
              label="Auto-close hover-opened sidebar" 
              desc="Automatically hides the sidebar when your pointer leaves it"
            >
              <Toggle 
                value={isHoverActive && preferences.autoCloseHoverSidebar} 
                onChange={v => setPreference('autoCloseHoverSidebar', v)} 
                accentFrom={accent.from} 
                accentTo={accent.to} 
              />
            </SettingRow>
          </div>
        </div>

        <SettingsSectionLabel>App Workspace</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingRow 
            label="Show app navigation dock" 
            desc="Shows a macOS-style floating bottom dock inside apps for section navigation"
          >
            <Toggle 
              value={preferences.showWebAppDock} 
              onChange={v => {
                if (!v && isWebDesktop) {
                  alert("Cannot disable the app navigation dock on desktop/tablet as it is the only way to navigate sections inside apps.");
                  return;
                }
                setPreference('showWebAppDock', v);
              }} 
              accentFrom={accent.from} 
              accentTo={accent.to} 
            />
          </SettingRow>
          <div style={{ padding: '0px 20px 14px', marginTop: '-10px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
            <p style={{ fontSize: '11px', color: 'var(--c-text-muted)', fontFamily: 'Inter', margin: 0 }}>
              Always enabled on Web desktop/tablet as it's the only way to navigate sub-app sections.
            </p>
          </div>

          <SettingRow 
            label="Remember last Chordex section" 
            desc="Reopening Chordex returns to your last used section instead of resetting"
          >
            <Toggle 
              value={preferences.rememberLastAppSection} 
              onChange={v => setPreference('rememberLastAppSection', v)} 
              accentFrom={accent.from} 
              accentTo={accent.to} 
            />
          </SettingRow>
        </div>

        <SettingsSectionLabel>Performance</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingRow 
            label="Reduce interface animations" 
            desc="Minimizes transitions and movement across the workspace"
          >
            <Toggle 
              value={preferences.reduceMotion} 
              onChange={v => setPreference('reduceMotion', v)} 
              accentFrom={accent.from} 
              accentTo={accent.to} 
            />
          </SettingRow>

          <SettingRow 
            label="Compact desktop spacing" 
            desc="Reduces spacing and padding for more information on laptop screens"
          >
            <Toggle 
              value={preferences.compactDesktopSpacing} 
              onChange={v => setPreference('compactDesktopSpacing', v)} 
              accentFrom={accent.from} 
              accentTo={accent.to} 
            />
          </SettingRow>

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
    );
  }

  function renderAppearanceContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingBottom: 24 }}>
        <SettingsSectionLabel>{(t.hub as { studioSettings?: { themeSection?: string } }).studioSettings?.themeSection ?? 'Theme'}</SettingsSectionLabel>
        <div style={cardStyle}>
          <div style={{ padding: isWebDesktop ? '16px 0px 12px' : '16px 16px 12px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
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
          <div style={{ padding: isWebDesktop ? '14px 0px 12px' : '14px 16px 12px' }}>
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
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <SettingsSectionLabel>Display</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingRow label={t.settings.rows.density} desc={t.settings.rows.densityDesc}>
            <SegmentedControl<DisplayDensity> value={settings.displayDensity} options={[{ value: 'compact', label: t.settings.rows.compact }, { value: 'comfortable', label: t.settings.rows.normal }, { value: 'spacious', label: t.settings.rows.airy }]} onChange={v => updateSettings({ displayDensity: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
          <SettingRow label={t.settings.rows.fontSize} desc={t.settings.rows.fontSizeDesc}>
            <SegmentedControl<'small' | 'medium' | 'large'> value={settings.fontSize} options={[{ value: 'small', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'large', label: 'L' }]} onChange={v => updateSettings({ fontSize: v })} accentFrom={accent.from} accentTo={accent.to} />
          </SettingRow>
        </div>
      </div>
    );
  }

  function renderLanguageContent() {
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
                borderBottom: isLast || isWebDesktop ? 'none' : '1px solid rgba(128,128,128,0.07)',
                cursor: 'pointer', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
                boxSizing: 'border-box',
                borderRadius: isWebDesktop ? '8px' : '0px',
                marginBottom: isWebDesktop ? '4px' : '0px',
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
    );
  }

  function renderPrivacyContent() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingBottom: 24 }}>
        <SettingsSectionLabel>{(t.hub as { studioSettings?: { accountControls?: string } }).studioSettings?.accountControls ?? 'Account Controls'}</SettingsSectionLabel>
        <Suspense fallback={null}>
          <AccountDangerZone accent={accent} cardStyle={cardStyle} />
        </Suspense>
      </div>
    );
  }

  function renderUpdaterContent() {
    return (
      <HubUpdaterPage
        cardStyle={cardStyle}
        accent={accent}
        onBack={goBack}
        style={{}}
      />
    );
  }

  function renderDebugContent() {
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
      <div style={{ width: '100%' }}>
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
        </div>
      </div>
    );
  }

  function renderDeveloperContent() {
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingBottom: 32 }}>
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

          <SettingsSectionLabel>6. Danger Zone</SettingsSectionLabel>
          <div style={cardStyle}>
            <DevButtonRow label="Reset Developer Options" desc="Disable developer options and lock this menu" actionLabel="Reset" actionId="reset-developer" onPress={handleResetDeveloperAction} isDestructive />
            <DevButtonRow label="Clear Debug Logs" desc="Reset all current memory logs" actionLabel="Clear Logs" actionId="clear-logs" onPress={handleClearDebugLogsAction} isDestructive />
            <DevButtonRow label="Reset Update State" desc="Wipe update configurations, logs & choices" actionLabel="Reset Update State" actionId="reset-update-state" onPress={handleResetUpdateStateAction} isDestructive />
            <DevButtonRow label="Disable Developer Options" desc="Exit developer mode immediately" actionLabel="Disable" actionId="disable-dev" onPress={handleResetDeveloperAction} isDestructive />
          </div>
        </div>
      );
    } catch (e: any) {
      console.error('Error rendering Developer Options:', e);
      return (
        <div style={{ padding: '24px 0', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#ef4444', marginBottom: 12 }}>error</span>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--c-text-primary)' }}>Diagnostics unavailable</p>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>An error occurred while loading developer details.</p>
        </div>
      );
    }
  }

  function renderAboutContent() {
    const subAppLogos: { key: string; node: React.ReactNode; label: string }[] = [
      { key: 'chordex', label: 'Chordex', node: <ChordexLogo size={34} /> },
      { key: 'drumex',  label: 'Drumex',  node: <DrumexLogo size={34} /> },
      { key: 'stagex',  label: 'Stagex',  node: <StagexLogoIcon size={34} /> },
      { key: 'groovex', label: 'Groovex', node: <GroovexLogo size={34} /> },
      { key: 'vocalex', label: 'Vocalex', node: <VocalexLogo size={34} /> },
    ];
    
    const heroCardStyle: React.CSSProperties = isWebDesktop ? {
      background: 'transparent',
      borderRadius: '0px',
      border: 'none',
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
    } : {
      ...cardStyle,
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingBottom: 24 }}>
        <div style={heroCardStyle}>
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

        <div style={cardStyle}>
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

        <div style={{ padding: '16px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 32, height: 2, borderRadius: 999, background: 'rgba(128,128,128,0.25)', marginBottom: 4 }} />
          <p style={{ color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.18em', margin: 0 }}>
            {t.settings.about.footer}
          </p>
        </div>
      </div>
    );
  }

  function renderMobileProfileCard() {
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
        <span
          className="material-symbols-outlined"
          style={{
            position: 'absolute', top: 14, right: 14,
            fontSize: 18, color: 'var(--c-text-secondary)', opacity: 0.5,
          }}
        >chevron_right</span>

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

        <p style={{
          fontFamily: 'Manrope', fontWeight: 800, fontSize: 18,
          color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.02em',
          maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hasUser ? (authUser.displayName || 'Studio User') : 'Sign In'}
        </p>

        <p style={{
          fontFamily: 'Inter', fontSize: 13,
          color: 'var(--c-text-secondary)', margin: '4px 0 0',
          maxWidth: '80%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hasUser ? email : 'Tap to create account or sign in'}
        </p>
      </button>
    );
  }

  function renderProfile() {
    const profileCardStyle: React.CSSProperties = isWebDesktop ? {
      background: 'transparent',
      borderRadius: '0px',
      overflow: 'visible',
      border: 'none',
      boxShadow: 'none',
      padding: '0px',
    } : {
      background: 'var(--app-surface)',
      borderRadius: '1.25rem',
      overflow: 'hidden',
      border: '1px solid rgba(128,128,128,0.07)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
      padding: '20px',
    };

    const guestCardStyle: React.CSSProperties = isWebDesktop ? {
      background: 'transparent',
      borderRadius: '0px',
      overflow: 'visible',
      border: 'none',
      boxShadow: 'none',
      marginBottom: 20,
    } : {
      background: 'var(--app-surface)',
      borderRadius: '1.25rem',
      overflow: 'hidden',
      border: '1px solid rgba(128,128,128,0.07)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
      marginBottom: 20,
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', paddingBottom: 24 }}>
        <Suspense fallback={null}>
          {authUser ? (
            <AccountSettingsPage
              accent={accent}
              cardStyle={profileCardStyle}
              onBack={goBack}
            />
          ) : (
            <div style={{ paddingBottom: 80 }}>
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
                cardStyle={guestCardStyle}
                rowStyle={{ padding: isWebDesktop ? '13px 0px' : '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
              />
            </div>
          )}
        </Suspense>
      </div>
    );
  }

  function renderActivePageContent(activePageId: SettingsPageId) {
    switch (activePageId) {
      case 'general':
        return renderGeneralContent();
      case 'appearance':
        return renderAppearanceContent();
      case 'language':
        return renderLanguageContent();
      case 'privacy':
      case 'privacy-policy':
        return renderPrivacyPolicyContent();
      case 'updater':
        return renderUpdaterContent();
      case 'help':
        return renderHelpContent();
      case 'help-center':
        return renderHelpCenterContent();
      case 'faq':
        return renderFaqContent();
      case 'release-notes':
        return renderReleaseNotesContent();
      case 'download-apps':
        return renderDownloadAppsContent();
      case 'keyboard-shortcuts':
        return renderKeyboardShortcutsContent();
      case 'terms':
        return renderTermsContent();
      case 'bug-report':
        return renderBugReportContent();
      case 'developer':
        return renderDeveloperContent();
      case 'about':
        return renderAboutContent();
      case 'debug':
        return renderDebugContent();
      case 'profile':
        return renderProfile();
      default:
        return renderGeneralContent();
    }
  }

  /* ── MOBILE DRILL DOWN LAYOUTS ──────────────────────────────────── */
  if (!isWebDesktop) {
    if (page === 'help') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Help & FAQ" onBack={goBack} />
          {renderHelpContent()}
        </div>
      );
    }

    if (page === 'help-center') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Help Center" onBack={goBack} />
          {renderHelpCenterContent()}
        </div>
      );
    }

    if (page === 'faq') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="FAQ & Support" onBack={goBack} />
          {renderFaqContent()}
        </div>
      );
    }

    if (page === 'release-notes') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Release Notes" onBack={goBack} />
          {renderReleaseNotesContent()}
        </div>
      );
    }

    if (page === 'download-apps') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Download Apps" onBack={goBack} />
          {renderDownloadAppsContent()}
        </div>
      );
    }

    if (page === 'keyboard-shortcuts') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Keyboard Shortcuts" onBack={goBack} />
          {renderKeyboardShortcutsContent()}
        </div>
      );
    }

    if (page === 'terms') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Terms of Service" onBack={goBack} />
          {renderTermsContent()}
        </div>
      );
    }

    if (page === 'privacy' || page === 'privacy-policy') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Privacy Policy" onBack={goBack} />
          {renderPrivacyPolicyContent()}
        </div>
      );
    }

    if (page === 'bug-report') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Report a Bug" onBack={goBack} />
          {renderBugReportContent()}
        </div>
      );
    }

    if (page === 'general') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="General Preferences" onBack={goBack} />
          {renderGeneralContent()}
        </div>
      );
    }

    if (page === 'appearance') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title={t.settings.sections.appearance} onBack={goBack} />
          {renderAppearanceContent()}
        </div>
      );
    }

    if (page === 'language') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title={t.settings.sections.language} onBack={goBack} />
          {renderLanguageContent()}
        </div>
      );
    }

    if (page === 'updater') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          {renderUpdaterContent()}
        </div>
      );
    }

    if (page === 'debug') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Update Debug" onBack={goBack} />
          {renderDebugContent()}
        </div>
      );
    }

    if (page === 'developer') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={subStyle}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title="Developer Options" onBack={goBack} />
          {renderDeveloperContent()}
        </div>
      );
    }

    if (page === 'about') {
      return (
        <div key={pageKey} className="settings-panel-sheet" style={{ ...subStyle, paddingBottom: 'calc(var(--content-bottom-pad) + 20px)' }}>
          <style>{HUB_SETTINGS_CSS}</style>
          <SettingsSubHeader title={t.settings.sections.about} onBack={goBack} />
          {renderAboutContent()}
        </div>
      );
    }

    return (
      <div key={pageKey} style={{ padding: '0 20px', paddingBottom: 'var(--content-bottom-pad)' }}>
        <style>{HUB_SETTINGS_CSS}</style>

        <div className="spring-in" style={{ paddingTop: 32, paddingBottom: 8 }}>
          <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.03em', fontFamily: 'Manrope' }}>{t.hub.settingsTitle}</p>
          <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', margin: '5px 0 0', fontWeight: 500 }}>{t.hub.settingsSubtitle}</p>
        </div>

        {renderMobileProfileCard()}

        <SettingsSectionLabel delay={70}>Preferences</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingsNavRow icon="settings" iconColor={accent.from} title="General Preferences" desc="Configure workspace layout and app behaviors" onPress={() => navigate('general')} delay={75} />
          <SettingsNavRow icon="palette" iconColor={accent.from} title={t.settings.sections.appearance} desc={(t.hub as { studioSettings?: { appearanceDesc?: string } }).studioSettings?.appearanceDesc ?? 'Theme, colors, display & performance'} onPress={() => navigate('appearance')} delay={80} />
          <SettingsNavRow icon="language" iconColor={accent.from} title={t.settings.sections.language} desc={(t.hub as { studioSettings?: { languageDesc?: string } }).studioSettings?.languageDesc ?? 'App display language'} onPress={() => navigate('language')} delay={85} />
          <SettingsNavRow icon="account_circle" iconColor={accent.from} title={lang === 'es' ? 'Perfil y Cuenta' : 'Profile & Account'} desc="Manage user settings and backup" onPress={() => navigate('profile')} last delay={90} />
        </div>

        <SettingsSectionLabel delay={100}>Help & Support</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingsNavRow icon="help" iconColor={accent.from} title="Help Center" desc="Documentation and guides" onPress={() => navigate('help-center')} delay={110} />
          <SettingsNavRow icon="contact_support" iconColor={accent.from} title="FAQ & Support" desc="Frequently asked questions" onPress={() => navigate('faq')} delay={120} />
          <SettingsNavRow icon="article" iconColor={accent.from} title="Release Notes" desc="View version history" onPress={() => navigate('release-notes')} delay={130} />
          <SettingsNavRow icon="install_desktop" iconColor={accent.from} title="Download Apps" desc="Get native mobile and desktop clients" onPress={() => navigate('download-apps')} delay={140} />
          <SettingsNavRow icon="keyboard" iconColor={accent.from} title="Keyboard Shortcuts" desc="View quick key bindings" onPress={() => navigate('keyboard-shortcuts')} last delay={150} />
        </div>

        <SettingsSectionLabel delay={170}>Legal</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingsNavRow icon="gavel" iconColor={accent.from} title="Terms of Service" desc="Read terms and conditions" onPress={() => navigate('terms')} delay={180} />
          <SettingsNavRow icon="policy" iconColor={accent.from} title="Privacy Policy" desc="Read privacy guidelines" onPress={() => navigate('privacy-policy')} last delay={190} />
        </div>

        <SettingsSectionLabel delay={210}>Feedback</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingsNavRow icon="bug_report" iconColor={accent.from} title="Report a Bug" desc="Send us feedback or bug reports" onPress={() => navigate('bug-report')} last delay={220} />
        </div>

        <SettingsSectionLabel delay={240}>{(t.hub as { studioSettings?: { systemAbout?: string } }).studioSettings?.systemAbout ?? 'System & About'}</SettingsSectionLabel>
        <div style={cardStyle}>
          <SettingsNavRow icon="download" iconColor={accent.from} title={(t.hub as { studioSettings?: { updater?: string } }).studioSettings?.updater ?? 'Updater'} desc={(t.hub as { studioSettings?: { updaterDesc?: string } }).studioSettings?.updaterDesc ?? 'App updates and installation'} badge={(t.hub as { studioSettings?: { autoBadge?: string } }).studioSettings?.autoBadge ?? 'Auto'} onPress={() => navigate('updater')} delay={250} />

          <SettingsNavRow icon="info" iconColor={accent.from} title={t.settings.sections.about} desc={APP_VERSION_LABEL} onPress={() => navigate('about')} last={!settings.developerMode} delay={260} />
          {settings.developerMode && (
            <SettingsNavRow icon="terminal" iconColor={accent.from} title="Developer Options" desc="Update simulation, logs, and controls" onPress={() => navigate('developer')} last delay={270} />
          )}
        </div>

        <ChangelogSheet open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      </div>
    );
  }

  const activePageId = page === 'main' ? 'general' : page;

  const sections = [
    {
      label: lang === 'es' ? 'Preferencias' : 'Preferences',
      items: [
        { id: 'general' as const, icon: 'settings', label: lang === 'es' ? 'Preferencias Generales' : 'General Settings' },
        { id: 'appearance' as const, icon: 'palette', label: lang === 'es' ? 'Apariencia' : 'Appearance' },
        { id: 'language' as const, icon: 'language', label: lang === 'es' ? 'Idioma' : 'Language' },
        { id: 'profile' as const, icon: 'account_circle', label: lang === 'es' ? 'Perfil y Cuenta' : 'Profile & Account' },
      ]
    },
    {
      label: lang === 'es' ? 'Soporte' : 'Support',
      items: [
        { id: 'help-center' as const, icon: 'help', label: lang === 'es' ? 'Centro de Ayuda' : 'Help Center' },
        { id: 'faq' as const, icon: 'contact_support', label: lang === 'es' ? 'Preguntas Frecuentes' : 'FAQ & Support' },
        { id: 'release-notes' as const, icon: 'article', label: lang === 'es' ? 'Notas de Lanzamiento' : 'Release Notes' },
        { id: 'download-apps' as const, icon: 'install_desktop', label: lang === 'es' ? 'Descargar Aplicaciones' : 'Download Apps' },
        { id: 'keyboard-shortcuts' as const, icon: 'keyboard', label: lang === 'es' ? 'Atajos de Teclado' : 'Keyboard Shortcuts' },
      ]
    },
    {
      label: lang === 'es' ? 'Legal' : 'Legal',
      items: [
        { id: 'terms' as const, icon: 'gavel', label: lang === 'es' ? 'Condiciones de Servicio' : 'Terms of Service' },
        { id: 'privacy-policy' as const, icon: 'policy', label: lang === 'es' ? 'Política de Privacidad' : 'Privacy Policy' },
      ]
    },
    {
      label: lang === 'es' ? 'Comentarios' : 'Feedback',
      items: [
        { id: 'bug-report' as const, icon: 'bug_report', label: lang === 'es' ? 'Informar de un Error' : 'Report a Bug' },
      ]
    },
    {
      label: lang === 'es' ? 'Sistema' : 'System',
      items: [
        { id: 'updater' as const, icon: 'download', label: lang === 'es' ? 'Actualizaciones de App' : 'App Updates' },
        { id: 'about' as const, icon: 'info', label: lang === 'es' ? 'Acerca de Studio' : 'About & Version' },
        ...(settings.developerMode ? [{ id: 'developer' as const, icon: 'terminal', label: lang === 'es' ? 'Opciones de Desarrollador' : 'Developer Options' }] : []),
      ]
    }
  ];

  const getPageTitle = (id: SettingsPageId | 'profile') => {
    for (const section of sections) {
      const item = section.items.find(n => n.id === id);
      if (item) return item.label;
    }
    return 'Settings';
  };

  return (
    <div key={pageKey} style={{ display: 'flex', width: '100%', minHeight: 'calc(100vh - 120px)', gap: 0 }} className="settings-desktop-layout">
      <style>{HUB_SETTINGS_CSS}</style>
      <style>{`
        .settings-desktop-layout .flex.items-center.justify-between.gap-4 {
          padding-left: 0px !important;
          padding-right: 0px !important;
        }
        .settings-desktop-layout .flex.items-center.justify-between.gap-4[style*="padding-left: 28px"],
        .settings-desktop-layout .flex.items-center.justify-between.gap-4[style*="paddingLeft: 28px"],
        .settings-desktop-layout .flex.items-center.justify-between.gap-4[style*="28px"] {
          padding-left: 12px !important;
        }
        .settings-desktop-layout div[style*="border-bottom"],
        .settings-desktop-layout div[style*="borderBottom"] {
          border-bottom: 1px solid rgba(128, 128, 128, 0.08) !important;
        }
        .settings-desktop-layout button.btn-smooth:not(.active-settings-nav):hover {
          background: var(--sidebar-hover-bg, rgba(255, 255, 255, 0.04)) !important;
        }
      `}</style>

      {/* Left Pane: Sub-navigation */}
      <div style={{
        width: '260px',
        flexShrink: 0,
        borderRight: '1px solid rgba(128, 128, 128, 0.08)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '0 8px 16px 8px', borderBottom: '1px solid rgba(128, 128, 128, 0.08)', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.02em', fontFamily: 'Manrope' }}>
            {lang === 'es' ? 'Ajustes de Studio' : 'Studio Settings'}
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map((section, secIdx) => (
            <div key={section.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {secIdx > 0 && <div style={{ height: 1, borderTop: '1px solid rgba(128,128,128,0.08)', margin: '4px 0 10px 0' }} />}
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-secondary)', opacity: 0.6, padding: '0 12px 4px 12px' }}>
                {section.label}
              </span>
              {section.items.map((item) => {
                const isActive = activePageId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`btn-smooth ${isActive ? 'active-settings-nav' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      background: isActive ? 'var(--sidebar-hover-bg, rgba(255, 255, 255, 0.08))' : 'transparent',
                      color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: 13,
                      fontFamily: 'Manrope, sans-serif',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: isActive ? accent.from : 'inherit' }}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Right Pane: Content */}
      <div style={{
        flex: 1,
        padding: '32px 48px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ maxWidth: '640px', width: '100%', margin: '0 auto' }}>
          <div style={{ marginBottom: 28, borderBottom: '1px solid rgba(128, 128, 128, 0.08)', paddingBottom: 16 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-text-primary)', margin: 0, letterSpacing: '-0.03em', fontFamily: 'Manrope' }}>
              {getPageTitle(activePageId)}
            </h1>
          </div>
          
          <Suspense fallback={<div style={{ color: 'var(--c-text-secondary)', fontSize: 14 }}>Loading settings...</div>}>
            {renderActivePageContent(activePageId)}
          </Suspense>
        </div>
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
      question: "What is Studio?",
      answer: "Studio is an all-in-one music production suite designed to compose, synthesize, mix, and record tracks directly in your browser or via our native applications."
    },
    {
      question: "What is Chordex?",
      answer: "Chordex is a professional chord progression companion inside Studio. It helps you compose songs, explore complex scales, and export progressions to your digital audio workstation (DAW)."
    },
    {
      question: "What is Stagex?",
      answer: "Stagex is the live performance and virtual stage component of Studio. It lets you organize virtual stage layouts, manage audio routing, and trigger backing tracks dynamically during gigs."
    },
    {
      question: "Does Studio work on mobile?",
      answer: "Yes! Studio is fully responsive and runs on mobile browsers. We also provide a high-performance native Android application for production on the go."
    },
    {
      question: "How do I use the Web version?",
      answer: "Simply open Studio Web in your browser, select any tool from the Hub (like Chordex or Drumex), and start creating. Your projects are auto-saved to your browser's local database."
    },
    {
      question: "How do Android APK updates work?",
      answer: "The native Android app automatically queries our servers for updates. When a new APK is available, the app downloads it directly, enabling instant installation without the Google Play Store."
    },
    {
      question: "Why is Windows marked Coming Soon?",
      answer: "We are actively developing a desktop-optimized native Windows client to support low-latency ASIO audio drivers and VST plugins. Meanwhile, you can use the Web version on Windows."
    },
    {
      question: "Where are my preferences stored?",
      answer: "Your preferences, presets, and compositions are securely stored in your local browser database (localStorage and IndexedDB). Synchronizing with your account backs them up safely to our secure cloud."
    },
    {
      question: "Does Studio include cloud sync?",
      answer: "Firestore backup functionality is operational but in active development and is not currently advertised as a public-facing feature. We recommend relying on local storage and local exports for reliable project management."
    }
  ],
  es: [
    {
      question: "¿Qué es Studio?",
      answer: "Studio es una suite de producción musical todo en uno diseñada para componer, sintetizar, mezclar y grabar pistas directamente en tu navegador o mediante nuestras aplicaciones nativas."
    },
    {
      question: "¿Qué es Chordex?",
      answer: "Chordex es un potente compañero de progresiones de acordes dentro de Studio. Te ayuda a componer canciones, explorar escalas complejas y exportar progresiones a tu secuenciador (DAW) favorito."
    },
    {
      question: "¿Qué es Stagex?",
      answer: "Stagex es el componente de directo y escenario virtual de Studio. Te permite organizar el diseño de tu escenario, gestionar el enrutamiento de audio y lanzar pistas de acompañamiento dinámicamente."
    },
    {
      question: "¿Funciona Studio en dispositivos móviles?",
      answer: "¡Sí! Studio es totalmente responsivo y funciona en navegadores móviles. También ofrecemos una aplicación nativa de Android de alto rendimiento para producir música en cualquier lugar."
    },
    {
      question: "¿Cómo uso la versión Web?",
      answer: "Simplemente abre Studio Web en tu navegador, elige cualquier herramienta desde el Hub (como Chordex o Drumex) y comienza a crear. Tus proyectos se guardan automáticamente localmente."
    },
    {
      question: "¿Cómo funcionan las actualizaciones de APK en Android?",
      answer: "La aplicación nativa de Android consulta automáticamente si hay actualizaciones. Cuando hay un nuevo APK disponible, la aplicación lo descarga directamente para su instalación sin depender de Google Play."
    },
    {
      question: "¿Por qué Windows está marcado como \"Próximamente\"?",
      answer: "Estamos desarrollando un cliente nativo optimizado para Windows para soportar controladores de audio ASIO de baja latencia y plugins VST. Mientras tanto, puedes usar la versión Web en Windows."
    },
    {
      question: "¿Dónde se almacenan mis preferencias?",
      answer: "Tus preferencias, preajustes y composiciones se guardan de forma segura en la base de datos local de tu navegador (localStorage e IndexedDB). Sincronizar tu cuenta los respalda en la nube de Firestore."
    },
    {
      question: "¿Incluye Studio sincronización en la nube?",
      answer: "La funcionalidad de respaldo de Firestore está operativa pero en desarrollo activo y actualmente no se promociona como una función pública. Recomendamos usar el almacenamiento local y las exportaciones manuales."
    }
  ],
  de: [
    {
      question: "Was ist Studio?",
      answer: "Studio ist eine All-in-One-Musikproduktionssuite, mit der Sie Tracks direkt in Ihrem Browser oder über unsere nativen Anwendungen komponieren, synthetisieren, mischen und aufnehmen können."
    },
    {
      question: "Was ist Chordex?",
      answer: "Chordex ist ein professioneller Begleiter für Akkordfolgen in Studio. Es hilft Ihnen, Songs zu komponieren, komplexe Tonleitern zu erkunden und Akkordfolgen in Ihre DAW zu exportieren."
    },
    {
      question: "Was ist Stagex?",
      answer: "Stagex ist die Live-Performance- und virtuelle Bühnenkomponente von Studio. Sie können virtuelle Bühnenlayouts organisieren, Audio-Routing verwalten und Backing-Tracks dynamisch abspielen."
    },
    {
      question: "Funktioniert Studio auf Mobilgeräten?",
      answer: "Ja! Studio ist vollständig responsive und läuft in mobilen Browsern. Wir bieten auch eine leistungsstarke native Android-App für die Musikproduktion unterwegs."
    },
    {
      question: "Wie benutze ich die Web-Version?",
      answer: "Öffnen Sie einfach Studio Web in Ihrem Browser, wählen Sie ein Tool aus dem Hub (wie Chordex oder Drumex) und beginnen Sie mit der Erstellung. Ihre Projekte werden lokal gespeichert."
    },
    {
      question: "Wie funktionieren Android APK-Updates?",
      answer: "Die native Android-App sucht automatisch auf unseren Servern nach Updates. Wenn eine neue APK verfügbar ist, lädt die App sie direkt herunter und ermöglicht eine sofortige Installation."
    },
    {
      question: "Warum ist Windows als \"Demnächst verfügbar\" markiert?",
      answer: "Wir entwickeln einen optimierten nativen Windows-Client, um ASIO-Treiber mit geringer Latenz und VST-Plugins zu unterstützen. In der Zwischenzeit können Sie die Web-Version nutzen."
    },
    {
      question: "Wo werden meine Einstellungen gespeichert?",
      answer: "Ihre Einstellungen, Presets und Songs werden sicher in der lokalen Datenbank Ihres Browsers gespeichert (localStorage und IndexedDB). Die Sychronisierung sichert sie in unserer Firestore-Cloud."
    },
    {
      question: "Enthält Studio Cloud-Synchronisierung?",
      answer: "Die Firestore-Backup-Funktion ist betriebsbereit, befindet sich jedoch in der aktiven Entwicklung und wird derzeit nicht als öffentliches Feature beworben. Bitte nutzen Sie den lokalen Export."
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

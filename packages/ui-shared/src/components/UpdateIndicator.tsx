import { useOtaUpdate, type StructuredReleaseNotes, otaDiagnostics, otaDebugLogs, APP_VERSION_LABEL, compareSemver, normalizeSemver, applyUpdate, isNative, fadeToBlackAndReload, useChordStore, isAppInstallerAvailable } from '@workspace/studio-core';
import { applyUpdateDirect, shareDownloadedApk, getDiagnosticsReport } from '@workspace/studio-core';
/**
 * Floating "update available" indicator — top of the Hub.
 *
 * Two-phase behaviour:
 *  1. BANNER — when an update is first detected, a wide pill drops in
 *     from the top of the screen, CENTERED horizontally, announcing
 *     "Version X.Y.Z available" with a minimize button. Stays for
 *     ~6 seconds (or until the user taps minimize), then…
 *  2. PILL — smoothly morphs into a small circular badge that travels
 *     to the top-right corner. Tapping the pill re-opens the modal.
 *     The pill STAYS VISIBLE FOREVER until the user actually updates
 *     (or a newer remote version replaces this one). "Later" only
 *     suppresses the auto-opening of the modal — it does NOT hide
 *     the pill, so the user always has a one-tap path back.
 *
 * Theme integration:
 *   The indicator pulls its accent from the Studio-wide theme variables
 *   `--accent-from` / `--accent-to` set on <html> by App.tsx. Whatever
 *   accent color the user picked in Studio settings (blue, purple, etc.)
 *   automatically tints the banner / pill / modal. The `accentFrom`
 *   and `accentTo` props are kept as fallbacks for the rare boot frame
 *   where the CSS vars haven't been written yet.
 *
 * Skip-version semantics:
 *   The OTA detector always reports the LATEST remote version. A user
 *   on 3.0.21 with 3.0.24 published will be offered 3.0.24 directly —
 *   they never have to walk through 3.0.22 / 3.0.23. The Capgo bundle
 *   download is also a single shot to the newest manifest.
 */

import { useState, useEffect, useRef } from 'react';
import StudioSpinner from './animata/progress/spinner';
import AnimatedActionButton from './animata/container/animated-border-trail';
import StudioUpdateScreen from './StudioUpdateScreen';
import UpdateDiagnosticsSheet from './UpdateDiagnosticsSheet';
import { DownloadIcon } from './DownloadIcon';
import {
  enableLiquidGlass,
  tagLiquidTarget,
  untagLiquidTarget,
} from '@workspace/studio-core';

function CheckIconSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="#22c55e"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GithubIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ flexShrink: 0 }}>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function SpinnerSvg({ cFrom, cTo, size = 14, strokeWidth = 3.2 }: { cFrom: string; cTo: string; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      style={{
        animation: 'lg-spin-spinner 1s linear infinite',
        flexShrink: 0,
      }}
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="url(#lg-spinner-grad-indicator)" strokeWidth={strokeWidth} />
      <defs>
        <linearGradient id="lg-spinner-grad-indicator" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={cFrom} />
          <stop offset="100%" stopColor={cTo} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** How long the full banner stays visible before auto-minimizing. */
const BANNER_AUTO_MINIMIZE_MS = 6000;

/** Session flag so the banner shows at most once per page session. */
const BANNER_SHOWN_KEY = 'studio:updateBannerShown';

/**
 * localStorage key recording the latest version for which the user
 * tapped "Later". This SUPPRESSES the auto-open of the modal so we
 * stop nagging — but the corner pill remains visible so they can tap
 * it whenever they decide they're ready. A NEWER remote version
 * resets this and the modal auto-opens once again.
 */
const LATER_VERSION_KEY = 'studio:laterUpdateVersion';

/** sessionStorage key recording the latest version for which we have
 *  already auto-opened the update modal IN THIS SESSION. */
const AUTO_OPENED_VERSION_KEY = 'studio:autoOpenedUpdateVersion';

/** Legacy key from before "Later" stopped hiding the pill. We wipe
 *  it on mount so old installs aren't stuck with a hidden indicator. */
const LEGACY_DISMISSED_KEY = 'studio:dismissedUpdateVersion';

function readAutoOpenedVersion(): string | null {
  try {
    const raw = sessionStorage.getItem(AUTO_OPENED_VERSION_KEY);
    if (!raw || normalizeSemver(raw) === null) return null;
    return raw;
  } catch { return null; }
}
function writeAutoOpenedVersion(v: string): void {
  try { sessionStorage.setItem(AUTO_OPENED_VERSION_KEY, v); } catch { /* ignore */ }
  try { localStorage.removeItem(AUTO_OPENED_VERSION_KEY); } catch { /* ignore */ }
}

function readLaterVersion(): string | null {
  try {
    const raw = sessionStorage.getItem(LATER_VERSION_KEY);
    if (!raw || normalizeSemver(raw) === null) return null;
    return raw;
  } catch { return null; }
}
function writeLaterVersion(v: string): void {
  try { sessionStorage.setItem(LATER_VERSION_KEY, v); } catch { /* quota / privacy */ }
}
function clearLegacyDismissed(): void {
  try {
    localStorage.removeItem(LEGACY_DISMISSED_KEY);
    localStorage.removeItem(LATER_VERSION_KEY); // Also clean up any stale legacy persisted storage entry
  } catch { /* ignore */ }
}

type Phase = 'banner' | 'pill';

function readInitialPhase(): Phase {
  return 'banner';
}

function markBannerShown(): void {
  try {
    sessionStorage.setItem(BANNER_SHOWN_KEY, '1');
  } catch {
    /* private mode / quota — silently ignore */
  }
}

export default function UpdateIndicator({
  accentFrom,
  accentTo,
}: {
  /** Boot-frame fallback only — actual color comes from --accent-from. */
  accentFrom: string;
  /** Boot-frame fallback only — actual color comes from --accent-to. */
  accentTo: string;
}) {
  const ota = useOtaUpdate();
  const [phase, setPhase] = useState<Phase>(readInitialPhase);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [laterVersion, setLaterVersion] = useState<string | null>(readLaterVersion);

  const checkRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLButtonElement | null>(null);

  const { settings } = useChordStore();
  const hubVis = settings.perApp?.hub ?? { theme: settings.theme ?? 'dark', amoledMode: settings.amoledMode ?? false };
  const isLight = (() => {
    if (hubVis.theme === 'light') return true;
    if (hubVis.theme === 'system') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    if (hubVis.theme === 'dynamic') {
      const h = new Date().getHours();
      const lightStart = settings.dynamicLightStart ?? 7;
      const lightEnd   = settings.dynamicLightEnd   ?? 20;
      return h >= lightStart && h < lightEnd;
    }
    return false;
  })();

  useEffect(() => {
    console.log('[INSTRUMENTATION] [REACT] UpdateIndicator component mounted!');
    clearLegacyDismissed();
    return () => {
      console.log('[INSTRUMENTATION] [REACT] UpdateIndicator component unmounted!');
    };
  }, []);

  useEffect(() => {
    if (ota.validApkExists && ota.remoteVersion) {
      if (ota.shouldShowRecoveryReminder(ota.remoteVersion)) {
        console.log('[Smart Recovery] Valid APK exists on startup and reminder policy allows it. Opening modal.');
        setOpen(true);
      } else {
        console.log('[Smart Recovery] Valid APK exists on startup, but suppressed by reminder policy.');
      }
    }
  }, [ota.validApkExists, ota.remoteVersion]);

  useEffect(() => {
    console.log('[INSTRUMENTATION] [REACT] Add open-update-dialog event listener');
    const id = requestAnimationFrame(() => setEntered(true));
    const handleOpen = () => {
      console.log('[INSTRUMENTATION] [REACT] studio:open-update-dialog event fired');
      setOpen(true);
    };
    window.addEventListener('studio:open-update-dialog', handleOpen);
    return () => {
      console.log('[INSTRUMENTATION] [REACT] Remove open-update-dialog event listener');
      cancelAnimationFrame(id);
      window.removeEventListener('studio:open-update-dialog', handleOpen);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let listener: any = null;
    let timer: any = null;
    
    if (open && ota.updateState === 'installed') {
      console.log('[Updater Handoff] UpdateState is "installed". Monitoring background transition...');
      import('@capacitor/app').then(async ({ App }) => {
        if (!active) return;
        listener = await App.addListener('appStateChange', (state) => {
          if (!state.isActive && active) {
            console.log('[Updater Handoff] App moved to background, dismissing updater.');
            setOpen(false);
            ota.dismissUpdate();
          }
        });
      }).catch(err => console.warn('Failed to load App plugin:', err));
      
      // Fallback timer: close after 6 seconds if app backgrounding wasn't detected
      timer = setTimeout(async () => {
        if (active) {
          console.log('[Updater Handoff] Fallback timer reached, closing updater and minimizing.');
          setOpen(false);
          ota.dismissUpdate();
          if (isNative()) {
            try {
              const { App } = await import('@capacitor/app');
              await App.minimizeApp();
            } catch {}
          }
        }
      }, 6000);
    }
    
    return () => {
      active = false;
      if (listener) listener.remove();
      if (timer) clearTimeout(timer);
    };
  }, [open, ota.updateState]);

  // Auto-minimize disabled per user request so the banner remains fully visible.

  // Auto-OPEN the update modal is disabled to protect the application startup sequence.
  // The user will see a subtle pill in the corner, or they can click Check for Updates in settings.

  // WEB-ONLY: track whether the user dismissed the web refresh banner this session
  const [webBannerDismissed, setWebBannerDismissed] = useState(() => {
    if (isNative()) return false;
    try {
      const dismissed = sessionStorage.getItem('studio:web-update-dismissed');
      return dismissed === ota.remoteVersion;
    } catch { return false; }
  });

  // CHECK-STATUS PILL ─────────────────────────────────────────────────
  // When there's NO update available we still want the user to see that
  // the app actually checked. Phases:
  //   'checking'  — spinner + "Checking…" while ota.loading is true
  //   'ok'        — green check + "Up to date" for ~1.6 s
  //   'fading'    — spins 360° while shrinking + fading away (~700 ms)
  //   'gone'      — unmounted
  // If an update IS available, this whole branch is skipped and the
  // existing banner/pill flow takes over.
  const [checkPhase, setCheckPhase] = useState<
    'checking' | 'ok' | 'fading' | 'gone'
  >('checking');
  useEffect(() => {
    if (ota.updateAvailable) {
      setCheckPhase('gone');
      return;
    }
    if (ota.loading) {
      setCheckPhase('checking');
      return;
    }
    setCheckPhase('ok');
    const tFade = window.setTimeout(() => setCheckPhase('fading'), 1600);
    const tGone = window.setTimeout(() => setCheckPhase('gone'), 1600 + 920);
    return () => {
      window.clearTimeout(tFade);
      window.clearTimeout(tGone);
    };
  }, [ota.loading, ota.updateAvailable]);

  // Tag "Up to date" check indicator with Liquid Glass
  useEffect(() => {
    const el = checkRef.current;
    if (!el) return;
    enableLiquidGlass();
    tagLiquidTarget(el);
    return () => {
      untagLiquidTarget(el);
    };
  }, [checkPhase]);

  // Tag "Update available" indicator with Liquid Glass
  useEffect(() => {
    const el = pillRef.current;
    if (!el) return;
    enableLiquidGlass();
    tagLiquidTarget(el);
    return () => {
      untagLiquidTarget(el);
    };
  }, [phase, ota.updateAvailable]);

  if (!ota.updateAvailable) {
    if (!open) return null;
    // Only show the full update modal on native
    if (!isNative()) return null;
    return (
      <UpdateModal
        fromLabel={APP_VERSION_LABEL}
        toVersion={ota.remoteVersion ?? '—'}
        mandatory={ota.mandatory}
        downloadUrl={ota.downloadUrl}
        accentFrom={`var(--accent-from, ${accentFrom})`}
        accentTo={`var(--accent-to, ${accentTo})`}
        onLater={() => setOpen(false)}
        onClose={() => {
          setOpen(false);
          if (ota.updateState === 'failed') {
            ota.dismissUpdate();
          }
        }}
      />
    );
  }

  /* ── WEB-ONLY: slim non-blocking refresh banner ─────────────────────── */
  if (!isNative()) {
    if (webBannerDismissed) return null;
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            height: 40,
            background: `linear-gradient(135deg, var(--accent-from, ${accentFrom}), var(--accent-to, ${accentTo}))`,
            color: '#fff',
            fontFamily: 'Manrope, Inter, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
            animation: 'web-refresh-bar-enter 400ms cubic-bezier(0.34, 1.12, 0.64, 1) both',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, opacity: 0.9 }}
          >
            system_update
          </span>
          <span>
            {ota.remoteVersion
              ? `Studio v${ota.remoteVersion} available`
              : 'New version available'}
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: 'rgba(255,255,255,0.22)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              padding: '4px 12px',
              cursor: 'pointer',
              letterSpacing: '0.02em',
              backdropFilter: 'blur(6px)',
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setWebBannerDismissed(true);
              try {
                if (ota.remoteVersion) {
                  sessionStorage.setItem('studio:web-update-dismissed', ota.remoteVersion);
                }
              } catch { /* ignore */ }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>
        <style>{`
          @keyframes web-refresh-bar-enter {
            from { transform: translateY(-100%); opacity: 0; }
            to   { transform: translateY(0);     opacity: 1; }
          }
        `}</style>
      </>
    );
  }

  const minimize = () => {
    setPhase('pill');
    markBannerShown();
  };

  const handleLater = () => {
    // Stop auto-opening the modal for this version, but KEEP the
    // pill visible in the corner so the user always has a one-tap
    // path back to update.
    setOpen(false);
    ota.dismissUpdate();
    if (ota.remoteVersion) {
      writeLaterVersion(ota.remoteVersion);
      setLaterVersion(ota.remoteVersion);
      ota.recordDismissal(ota.remoteVersion);
      try {
        const key = 'studio:dismissedVersions';
        const val = localStorage.getItem(key);
        const list = val ? JSON.parse(val) : [];
        if (!list.includes(ota.remoteVersion)) {
          list.push(ota.remoteVersion);
          localStorage.setItem(key, JSON.stringify(list));
        }
      } catch (err) {
        console.warn('[OTA] Failed to write dismissedVersion:', err);
      }
    }
    setPhase('pill');
    markBannerShown();
  };

  const isBanner = phase === 'banner';

  // Use theme CSS vars when available (Studio user-chosen accent),
  // fall back to the props during the brief boot frame before App.tsx
  // has written them. Wrapping in `var(--name, fallback)` makes the
  // swap atomic and cross-fades correctly when the user changes their
  // accent in Studio settings.
  const cFrom = `var(--accent-from, ${accentFrom})`;
  const cTo   = `var(--accent-to, ${accentTo})`;
  // For tinted backgrounds we need an alpha-mixed version. color-mix
  // is supported on every Android Chrome WebView ≥ 111 (we ship Capgo
  // on a far newer baseline) so we can mix the live CSS var directly.
  const tint  = (pct: number) => `color-mix(in srgb, ${cTo} ${pct}%, transparent)`;
  const tintFrom = (pct: number) => `color-mix(in srgb, ${cFrom} ${pct}%, transparent)`;

  const amoledBg = isLight
    ? 'rgba(255, 255, 255, 0.40)'
    : 'rgba(26, 26, 30, 0.72)';
  const fallbackBorder = isLight
    ? '1px solid rgba(0, 0, 0, 0.08)'
    : '1px solid rgba(255, 255, 255, 0.28)';
  const fallbackShadow = isBanner
    ? (isLight ? '0 16px 40px rgba(0, 0, 0, 0.12), inset 0 1.5px 0 rgba(255, 255, 255, 0.70)' : '0 16px 40px rgba(0, 0, 0, 0.40), inset 0 1.5px 0 rgba(255, 255, 255, 0.08)')
    : (isLight ? '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1.5px 0 rgba(255, 255, 255, 0.70)' : '0 12px 48px rgba(0, 0, 0, 0.50), inset 0 1.5px 0 rgba(255, 255, 255, 0.08)');

  return (
    <>
      <button
        ref={pillRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          isBanner
            ? `New update available — version ${ota.remoteVersion ?? ''} — tap for details`
            : 'Update available'
        }
        style={{
          position: 'fixed',
          top: isBanner ? 'calc(env(safe-area-inset-top) + 14px)' : 'calc(env(safe-area-inset-top) + 28px)',
          right: isBanner ? '50%' : '20px',
          zIndex: 8900,
          width: isBanner ? 'min(360px, calc(100vw - 28px))' : 36,
          height: isBanner ? 52 : 36,
          padding: isBanner ? '0 12px 0 14px' : 0,
          borderRadius: isBanner ? 16 : 999,
          display: 'flex',
          alignItems: 'center',
          gap: isBanner ? 10 : 0,
          justifyContent: isBanner ? 'flex-start' : 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          background: amoledBg,
          border: fallbackBorder,
          color: 'var(--c-text-primary)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: fallbackShadow,
          fontFamily: 'Manrope, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.005em',
          textAlign: 'left',
          cursor: 'pointer',
          opacity: entered ? 1 : 0,
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
          transform: [
            isBanner ? 'translateX(50%)' : 'translateX(0)',
            entered ? 'translateY(0)' : 'translateY(-16px)',
          ].join(' '),
          transition: [
            'top 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'right 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'width 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'height 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'padding 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'border-radius 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'gap 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'background 380ms ease',
            'border-color 380ms ease',
            'box-shadow 620ms ease',
            'opacity 380ms ease',
            'transform 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
          ].join(', '),
          willChange: 'right, width, height, transform, border-radius',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isBanner ? 18 : 20,
            height: isBanner ? 18 : 20,
            flexShrink: 0,
            filter: isBanner ? undefined : 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25))',
            animation: isBanner ? undefined : 'pill-download-bounce 1.6s ease-in-out infinite',
            transition: 'width 620ms cubic-bezier(0.34, 1.12, 0.64, 1), height 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
          }}
        >
          <DownloadIcon size={isBanner ? 18 : 20} color={isLight ? cTo : '#fff'} />
        </span>

        <span
          style={{
            position: isBanner ? 'static' : 'absolute',
            flex: isBanner ? 1 : undefined,
            opacity: isBanner ? 1 : 0,
            transform: isBanner ? 'translateX(0)' : 'translateX(-8px)',
            transition: isBanner
              ? 'opacity 280ms 200ms ease, transform 280ms 200ms ease'
              : 'opacity 200ms ease, transform 200ms ease',
            pointerEvents: isBanner ? 'auto' : 'none',
          }}
        >
          {ota.remoteVersion ? `Studio update v${ota.remoteVersion} available` : 'Studio update available'}
        </span>

        <span
          role="button"
          tabIndex={isBanner ? 0 : -1}
          aria-label="Minimize"
          onClick={(e) => {
            e.stopPropagation();
            if (isBanner) minimize();
          }}
          onKeyDown={(e) => {
            if (!isBanner) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              minimize();
            }
          }}
          className="material-symbols-outlined"
          style={{
            position: isBanner ? 'static' : 'absolute',
            fontSize: 18,
            color: 'var(--c-text-secondary)',
            flexShrink: 0,
            cursor: isBanner ? 'pointer' : 'default',
            padding: 4,
            borderRadius: 8,
            opacity: isBanner ? 0.6 : 0,
            transform: isBanner ? 'scale(1)' : 'scale(0.7)',
            transition: isBanner
              ? 'opacity 240ms 180ms ease, transform 240ms 180ms ease'
              : 'opacity 160ms ease, transform 160ms ease',
            pointerEvents: isBanner ? 'auto' : 'none',
          }}
        >
          close
        </span>
      </button>

      {open && (
        <UpdateModal
          fromLabel={APP_VERSION_LABEL}
          toVersion={ota.remoteVersion ?? '—'}
          mandatory={ota.mandatory}
          downloadUrl={ota.downloadUrl}
          accentFrom={cFrom}
          accentTo={cTo}
          onLater={handleLater}
          onClose={() => {
            setOpen(false);
            if (ota.updateState === 'failed') {
              ota.dismissUpdate();
            }
            if (phase === 'banner') {
              setPhase('pill');
              markBannerShown();
            }
            if (ota.remoteVersion) {
              ota.recordDismissal(ota.remoteVersion);
            }
          }}
        />
      )}

      <style>{`
        @keyframes pill-pulse {
          0%, 100% { box-shadow: 0 4px 14px ${tint(19)}; }
          50%      { box-shadow: 0 4px 14px ${tint(19)}, 0 0 0 6px ${tint(12)}; }
        }
        @keyframes pill-download-bounce {
          0%   { transform: translateY(-3px); opacity: 0.55; }
          45%  { transform: translateY(2px);  opacity: 1; }
          60%  { transform: translateY(2px);  opacity: 1; }
          100% { transform: translateY(-3px); opacity: 0.55; }
        }
        @keyframes lg-spin-spinner {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes lg-indeterminate-progress {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </>
  );
}

function UpdateModal({
  fromLabel,
  toVersion,
  mandatory,
  downloadUrl,
  accentFrom,
  accentTo,
  onClose,
  onLater,
}: {
  fromLabel: string;
  toVersion: string;
  mandatory: boolean;
  downloadUrl: string | null;
  accentFrom: string;
  accentTo: string;
  onClose: () => void;
  onLater: () => void;
}) {
  const ota = useOtaUpdate();
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showGitHubConfirm, setShowGitHubConfirm] = useState(false);

  const isApkFlow = ota.updateType === 'apk' || ota.updateType === 'both';

  // Signature purple/pink colors override
  const purpleFrom = '#b57bee';
  const purpleTo = '#db2777';

  const handleStartUpdate = async () => {
    try {
      await ota.downloadUpdate('UpdateIndicator: UpdateModal');
      await ota.applyUpdate('UpdateIndicator: UpdateModal');
    } catch (err) {
      console.error('[UpdateIndicator] Start update failed:', err);
    }
  };

  const handleInstallApk = async () => {
    try {
      if (isNative()) {
        const { AppInstaller } = await import('@workspace/studio-core');
        const hasPerm = (await AppInstaller.canRequestPackageInstalls()).value;
        if (!hasPerm) {
          setPermissionBlocked(true);
          return;
        }
      }
      
      // Attempt to launch installer
      await ota.applyUpdate('UpdateIndicator: UpdateModal');
    } catch (err) {
      console.error('[UpdateIndicator] APK Install failed:', err);
    }
  };

  const handleOpenSettings = async () => {
    try {
      const { AppInstaller } = await import('@workspace/studio-core');
      await AppInstaller.openUnknownAppSourcesSettings();
    } catch (err) {
      console.error('[UpdateIndicator] Failed to open settings:', err);
    }
  };

  const handleOpenGitHub = async () => {
    try {
      const { resolveReleasePageUrl } = await import('@workspace/studio-core');
      const fallbackUrl = await resolveReleasePageUrl(ota.remoteVersion ?? undefined);
      window.open(fallbackUrl, '_system');
    } catch (err) {
      window.open('https://github.com/MAGEXE1000/Studio/releases', '_system');
    }
  };

  useEffect(() => {
    if (!permissionBlocked) return;
    let active = true;
    let nativeListener: { remove: () => Promise<void> } | undefined;

    const checkPerm = async () => {
      try {
        const { AppInstaller } = await import('@workspace/studio-core');
        const hasPerm = (await AppInstaller.canRequestPackageInstalls()).value;
        if (hasPerm && active) {
          setPermissionBlocked(false);
          await ota.applyUpdate('UpdateIndicator: UpdateModal');
        }
      } catch (err) {
        console.warn('[Permissions] Failed to query status:', err);
      }
    };

    import('@capacitor/app').then(async ({ App }) => {
      if (!active) return;
      nativeListener = await App.addListener('appStateChange', (s) => {
        if (s.isActive) checkPerm();
      });
    }).catch(() => {});

    window.addEventListener('focus', checkPerm);
    return () => {
      active = false;
      window.removeEventListener('focus', checkPerm);
      nativeListener?.remove().catch(() => {});
    };
  }, [permissionBlocked, ota]);



  // Select Icon and Colors based on State
  let iconName = 'download';
  let iconColor = purpleFrom;
  let title = 'Update available';
  let description: React.ReactNode = '';
  let showProgress = false;
  let progressVal = ota.progress;
  let showButtons = true;
  let showSpinner = false;

  let state = permissionBlocked ? 'permission_blocked' : ota.updateState;
  if (ota.updateState === 'update_available') {
    if (ota.reinstallRequired) {
      state = 'reinstall_warning';
    } else if (ota.apkUpdateRequired && !isAppInstallerAvailable()) {
      state = 'manual_apk_required';
    } else {
      state = 'available';
    }
  } else if (ota.updateState === 'waiting_for_confirmation') {
    state = 'available';
  } else if (ota.updateState === 'ready_to_install') {
    state = 'readyForInstallPrompt';
  } else if (ota.updateState === 'completed') {
    state = 'installedOrReady';
  } else if (ota.updateState === 'idle') {
    if (ota.error) {
      if (ota.error.includes('Signature mismatch')) {
        state = 'signature_mismatch';
      } else if (ota.error.includes('versionCode_low')) {
        state = 'versionCode_low';
      } else {
        state = 'failed';
      }
    } else {
      state = 'idle';
    }
  }

  // Collapsible changelog section state
  const [changelogExpanded, setChangelogExpanded] = useState(state === 'available' || state === 'reinstall_warning');

  useEffect(() => {
    setChangelogExpanded(state === 'available' || state === 'reinstall_warning');
  }, [state]);

  switch (state) {
    case 'reinstall_warning':
      iconName = 'warning';
      iconColor = '#f87171';
      title = 'Manual reinstall required';
      description = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', fontSize: 13, marginTop: 4 }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#f87171', lineHeight: 1.4 }}>
            This version requires reinstalling Studio.
          </p>
          <p style={{ margin: 0, color: 'var(--c-text-secondary)', lineHeight: 1.5 }}>
            Android cannot install this APK over your current app because the signing certificate changed. To install this version, uninstall the current app first, then install the new APK.
          </p>
          <p style={{ margin: 0, color: 'var(--c-text-tertiary)', fontSize: 12, lineHeight: 1.4 }}>
            Local app data may be removed when uninstalling. Cloud data will be restored after signing in if sync is working.
          </p>
        </div>
      );
      break;

    case 'permission_blocked':
      iconName = 'security';
      iconColor = '#eab308';
      title = 'Automatic installation blocked';
      description = "Please enable the 'Install unknown apps' permission for Studio in system settings to install the update.";
      break;

    case 'checking':
      iconName = 'sync';
      iconColor = purpleFrom;
      showSpinner = true;
      title = 'Checking for updates';
      description = 'Connecting to release server...';
      showButtons = false;
      break;

    case 'idle':
      iconName = 'check_circle';
      iconColor = '#22c55e';
      title = 'Studio is up to date';
      description = 'You’re running the latest version of Studio.';
      break;

    case 'available':
      iconName = 'system_update';
      iconColor = purpleFrom;
      title = 'Studio update available';
      description = 'A new version of Studio is ready to install.';
      break;

    case 'manual_apk_required':
      iconName = 'download_for_offline';
      iconColor = '#eab308';
      title = 'Manual update required';
      description = 'This version of Studio cannot install updates automatically. Please download and install Studio manually once. Future updates will install automatically.';
      break;

    case 'preparing':
      iconName = 'sync';
      iconColor = purpleFrom;
      showSpinner = true;
      title = 'Preparing update';
      description = 'Initializing update system...';
      showButtons = false;
      break;

    case 'enteringProgressScreen':
      iconName = 'sync';
      iconColor = purpleFrom;
      showSpinner = true;
      title = 'Starting update';
      description = 'Transitioning to progress screen...';
      showButtons = false;
      break;

    case 'downloading':
      iconName = 'cloud_download';
      iconColor = purpleFrom;
      title = 'Downloading update';
      description = 'Studio is downloading the latest app package.';
      showProgress = true;
      showButtons = false;
      break;

    case 'verifying':
      iconName = 'verified_user';
      iconColor = purpleFrom;
      title = 'Verifying update';
      description = ota.statusText || 'Studio is checking the update package before installation.';
      showSpinner = true;
      showButtons = false;
      break;

    case 'readyForInstallPrompt':
      iconName = 'task_alt';
      iconColor = '#22c55e';
      title = 'Ready to install';
      description = 'The update package is verified. Android will now ask you to confirm the installation.';
      break;

    case 'waitingForUserInstallConfirmation':
      iconName = 'security';
      iconColor = '#eab308';
      title = 'Installation pending';
      description = 'Please follow system prompts to complete installation.';
      showSpinner = true;
      break;

    case 'installing':
    case 'installedOrReady':
    case 'installed':
      iconName = 'sync';
      iconColor = purpleFrom;
      showSpinner = true;
      title = 'Installing update...';
      description = ota.statusText || 'Waiting for system confirmation...';
      showButtons = false;
      break;

    case 'signature_mismatch':
      iconName = 'warning';
      iconColor = '#f87171';
      title = 'Signature Mismatch Detected';
      description = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', fontSize: 13, marginTop: 4 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#f87171', lineHeight: 1.4 }}>
              Technical Explanation:
            </p>
            <p style={{ margin: '2px 0 0', color: 'var(--c-text-secondary)', lineHeight: 1.4 }}>
              The cryptographic signature of the downloaded update package does not match the signature of the installed application.
            </p>
          </div>

          <div>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--c-text-primary)', lineHeight: 1.4 }}>
              Human Explanation:
            </p>
            <p style={{ margin: '2px 0 0', color: 'var(--c-text-secondary)', lineHeight: 1.4 }}>
              Android security policy blocks overwriting applications signed with different certificate keys to prevent spoofing and unauthorized modification. This usually occurs if you switch between the official production releases and developer builds.
            </p>
          </div>

          <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', padding: '10px 12px', borderRadius: 10 }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#f87171' }}>
              Detected Cause & Root Cause:
            </p>
            <p style={{ margin: '2px 0 0', color: 'var(--c-text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
              {otaDebugLogs.rootCause || (otaDebugLogs.eligibilitySigningMatch === false 
                ? 'Wrong certificate signature. The downloaded update signature differs from the installed app signing key.'
                : otaDebugLogs.downloadedIsValidApk === false
                  ? 'Corrupted download. The cached package is incomplete or not a valid Android APK.'
                  : otaDiagnostics.shaExpected !== otaDiagnostics.shaCalculated
                    ? 'Invalid SHA checksum. The downloaded file signature does not match the expected release hash.'
                    : 'PackageInstaller issue. The system installer rejected the session handoff.')}
            </p>
            {otaDebugLogs.suggestedFix && (
              <div style={{ marginTop: 6, borderTop: '1px solid rgba(248,113,113,0.15)', paddingTop: 6 }}>
                <strong style={{ color: 'var(--c-text-primary)', fontSize: 11 }}>Suggested Fix:</strong>
                <p style={{ margin: '2px 0 0', color: 'var(--c-text-secondary)', fontSize: 11, lineHeight: 1.45 }}>
                  {otaDebugLogs.suggestedFix}
                </p>
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(128,128,128,0.03)', border: '1px solid rgba(128,128,128,0.1)', padding: '10px 12px', borderRadius: 10 }}>
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--c-text-secondary)' }}>
              Recovery Attempts Performed:
            </p>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: 'var(--c-text-secondary)', fontSize: 12, lineHeight: 1.45 }}>
              <li>Revalidated APK package structure</li>
              <li>Recreated PackageInstaller sessions</li>
              <li>Recreated installation PendingIntents</li>
              <li>Revalidated SHA-256 integrity checks</li>
              {otaDebugLogs.recoveryAttemptsPerformed && otaDebugLogs.recoveryAttemptsPerformed.map((attempt: string, idx: number) => (
                <li key={idx}>{attempt}</li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, fontFamily: 'monospace' }}>
            <div style={{ background: 'rgba(128,128,128,0.04)', padding: '8px 10px', borderRadius: 8 }}>
              <strong>Validation Stage:</strong><br />
              {otaDebugLogs.validationStage || 'N/A'}
            </div>
            <div style={{ background: 'rgba(128,128,128,0.04)', padding: '8px 10px', borderRadius: 8 }}>
              <strong>Exact Failing Stage:</strong><br />
              {otaDebugLogs.exactFailingStage || 'N/A'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, fontFamily: 'monospace' }}>
            <div style={{ background: 'rgba(128,128,128,0.04)', padding: '8px 10px', borderRadius: 8 }}>
              <strong>Installed Version:</strong><br />
              v{fromLabel} (code {otaDebugLogs.installedVersionCode || 'N/A'})
            </div>
            <div style={{ background: 'rgba(128,128,128,0.04)', padding: '8px 10px', borderRadius: 8 }}>
              <strong>Latest Release:</strong><br />
              v{toVersion || 'N/A'} (code {otaDebugLogs.downloadedVersionCode || 'N/A'})
            </div>
          </div>

          <div style={{ background: 'rgba(128,128,128,0.04)', padding: '10px 12px', borderRadius: 10, fontFamily: 'monospace', fontSize: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <strong style={{ color: 'var(--c-text-primary)' }}>Certificate comparison:</strong>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Expected Production: {otaDebugLogs.expectedSigningSha256 || '900cf259185c81100cda8bb08571fa23552e9789131cf07a8f4056e4d4129206'}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Installed App:        {otaDebugLogs.installedSigningSha256 || 'N/A'}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Downloaded APK:       {otaDebugLogs.downloadedSigningSha256 || 'N/A'}</div>
              <div style={{ marginTop: 2, fontWeight: 'bold', color: otaDebugLogs.eligibilitySigningMatch ? '#4ade80' : '#f87171' }}>
                Comparison Result: {otaDebugLogs.eligibilitySigningMatch === true ? 'MATCH' : 'MISMATCH'}
              </div>
            </div>
            {(otaDebugLogs.certificateSubject || otaDebugLogs.certificateIssuer) && (
              <div style={{ borderTop: '1px solid rgba(128,128,128,0.08)', paddingTop: 4 }}>
                <strong style={{ color: 'var(--c-text-primary)' }}>Certificate Info:</strong>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Subject: {otaDebugLogs.certificateSubject || 'N/A'}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Issuer:  {otaDebugLogs.certificateIssuer || 'N/A'}</div>
              </div>
            )}
            <div style={{ borderTop: '1px solid rgba(128,128,128,0.08)', paddingTop: 4 }}>
              <strong style={{ color: 'var(--c-text-primary)' }}>SHA comparison:</strong>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Expected Release SHA: {otaDiagnostics.shaExpected || 'N/A'}</div>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Calculated APK SHA:   {otaDiagnostics.shaCalculated || 'N/A'}</div>
            </div>
          </div>
        </div>
      );
      break;

    case 'versionCode_low':
      iconName = 'error';
      iconColor = '#f87171';
      title = 'Invalid update package';
      description = 'This update cannot be installed because its Android versionCode is not newer than the installed app.';
      break;

    case 'failed':
      if (ota.recoveryMode) {
        iconName = 'healing';
        iconColor = '#eab308';
        title = 'Update Recovery Mode';
        description = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', fontSize: 13, marginTop: 4 }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#eab308', lineHeight: 1.4 }}>
              Studio failed to update automatically multiple times.
            </p>
            <p style={{ margin: 0, color: 'var(--c-text-secondary)', lineHeight: 1.45 }}>
              Use the fail-safe recovery options below to install the update directly, share the update package, or download from alternative mirror sites.
            </p>
          </div>
        );
      } else {
        iconName = 'error';
        iconColor = '#f87171';
        title = 'Update download failed';
        if (ota.error && (ota.error.includes('404') || ota.error.includes('non-OK status: 404'))) {
          description = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', fontSize: 13, marginTop: 4 }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#f87171', lineHeight: 1.4 }}>
                Studio update package was not found on the release server.
              </p>
              <div style={{ background: 'rgba(128,128,128,0.05)', padding: '10px 12px', borderRadius: 10, fontFamily: 'monospace', fontSize: 11, border: '1px solid rgba(128,128,128,0.1)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>Target Version: {ota.remoteVersion || 'N/A'}</div>
                <div style={{ wordBreak: 'break-all' }}>APK URL: {ota.apkUrl || 'N/A'}</div>
                <div>HTTP Status: 404 (Not Found)</div>
                <div>Metadata (app-release.json) fetched: Yes</div>
              </div>
              <p style={{ margin: 0, color: 'var(--c-text-secondary)', fontSize: 12, lineHeight: 1.4 }}>
                <strong>Suggested action:</strong> Try again later. This usually means the release metadata was published before the APK upload completed.
              </p>
            </div>
          );
        } else {
          description = ota.error || 'Studio could not complete the update. You can try again or copy diagnostics.';
        }
      }
      break;
  }

  // Visual custom styles overrides using HSL purple/pink colors
  const primaryButtonStyle: React.CSSProperties = {
    flex: 1, height: 44, borderRadius: 12,
    background: `linear-gradient(135deg, ${purpleFrom}, ${purpleTo})`,
    border: 'none', color: 'white',
    fontFamily: 'Manrope', fontWeight: 800, fontSize: 13,
    cursor: 'pointer',
    boxShadow: `0 4px 14px color-mix(in srgb, ${purpleTo} 25%, transparent)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 200ms ease, transform 150ms ease',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    flex: 1, height: 44, borderRadius: 12,
    background: 'rgba(128, 128, 128, 0.06)',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    color: 'var(--c-text-secondary)',
    fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 200ms ease, border-color 200ms ease',
  };

  const halfSecondaryButtonStyle: React.CSSProperties = {
    flex: 1, height: 42, borderRadius: 12,
    background: 'transparent',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    color: 'var(--c-text-primary)',
    fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const tertiaryButtonStyle: React.CSSProperties = {
    width: '100%', height: 40, borderRadius: 12,
    background: 'transparent',
    border: 'none',
    color: 'var(--c-text-secondary)',
    fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
    cursor: 'pointer',
    marginTop: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const animatedPrimaryButtonStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
    background: `linear-gradient(135deg, ${purpleFrom}, ${purpleTo})`,
    border: 'none', color: 'white',
    fontFamily: 'Manrope', fontWeight: 800, fontSize: 13,
    cursor: 'pointer',
    boxShadow: `0 4px 14px color-mix(in srgb, ${purpleTo} 25%, transparent)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  };

  const renderButtons = () => {
    if (!showButtons) return null;

    if (state === 'permission_blocked') {
      return (
        <div style={{ display: 'flex', gap: 8, marginTop: 18, width: '100%' }}>
          <button
            type="button"
            onClick={() => setPermissionBlocked(false)}
            style={secondaryButtonStyle}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOpenSettings}
            style={primaryButtonStyle}
          >
            Open Settings
          </button>
        </div>
      );
    }

    if (state === 'idle') {
      return (
        <div style={{ marginTop: 18, width: '100%' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ ...primaryButtonStyle, width: '100%' }}
          >
            Close
          </button>
        </div>
      );
    }

    if (state === 'reinstall_warning') {
      const copyDiagnostics = async () => {
        const diagnosticText = getDiagnosticsText();
        try {
          await navigator.clipboard.writeText(diagnosticText);
          alert('Diagnostics copied to clipboard!');
        } catch (err) {
          console.error('Failed to copy diagnostics:', err);
        }
      };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, width: '100%' }}>
          <button
            type="button"
            onClick={() => setShowGitHubConfirm(true)}
            style={primaryButtonStyle}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6 }}>download</span>
            Download Latest Release
          </button>
          
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              type="button"
              onClick={copyDiagnostics}
              style={halfSecondaryButtonStyle}
            >
              Copy diagnostics
            </button>
            <button
              type="button"
              onClick={onClose}
              style={halfSecondaryButtonStyle}
            >
              I understand
            </button>
          </div>

          <button
            type="button"
            onClick={onLater}
            style={tertiaryButtonStyle}
          >
            Cancel
          </button>
        </div>
      );
    }

    if (state === 'available') {
      return (
        <div style={{ width: '100%' }}>
          {ota.validApkExists ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, width: '100%' }}>
              <button
                type="button"
                onClick={async () => {
                  await ota.applyUpdate('Modal: Continue Installation');
                }}
                style={primaryButtonStyle}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6 }}>play_circle</span>
                Continue Installation
              </button>
              <button
                type="button"
                onClick={onLater}
                style={secondaryButtonStyle}
              >
                Later
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 18, width: '100%' }}>
              <button
                type="button"
                onClick={onLater}
                style={secondaryButtonStyle}
              >
                Later
              </button>
              <AnimatedActionButton
                type="button"
                onClick={handleStartUpdate}
                wrapStyle={{ flex: 1, height: 44 }}
                borderRadius={12}
                trailColor={purpleTo}
                style={animatedPrimaryButtonStyle}
              >
                Update Now
              </AnimatedActionButton>
            </div>
          )}
        </div>
      );
    }

    if (state === 'manual_apk_required') {
      const manualApkUrl = ota.manualApkUrl || `https://studio-30f44.web.app/apk/studio-${ota.remoteVersion}.bin`;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, width: '100%' }}>
          <button
            type="button"
            onClick={() => window.open(manualApkUrl, '_system')}
            style={{ ...primaryButtonStyle, width: '100%' }}
          >
            Download APK
          </button>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(manualApkUrl);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                } catch (err) {
                  console.error('Failed to copy manual APK URL:', err);
                }
              }}
              style={halfSecondaryButtonStyle}
            >
              {linkCopied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              type="button"
              onClick={handleOpenGitHub}
              style={halfSecondaryButtonStyle}
            >
              GitHub Fallback
            </button>
          </div>
          <button
            type="button"
            onClick={onLater}
            style={tertiaryButtonStyle}
          >
            Later
          </button>
        </div>
      );
    }

    if (state === 'ready_to_install') {
      return (
        <div style={{ display: 'flex', gap: 8, marginTop: 18, width: '100%' }}>
          <button
            type="button"
            onClick={onLater}
            style={secondaryButtonStyle}
          >
            Later
          </button>
          <button
            type="button"
            onClick={handleInstallApk}
            style={primaryButtonStyle}
          >
            Install
          </button>
        </div>
      );
    }

    const getDiagnosticsText = () => {
      return [
        '=== STUDIO UPDATE DIAGNOSTICS ===',
        `Failure Timestamp: ${otaDiagnostics.timestamp || 'N/A'}`,
        `Device Model/Manufacturer: ${otaDiagnostics.deviceModel || 'N/A'}`,
        `Android Version: ${otaDiagnostics.androidVersion || 'N/A'}`,
        `Permission State: ${otaDiagnostics.permissionState || 'N/A'}`,
        `Exception Message: ${otaDiagnostics.exceptionMessage || 'N/A'}`,
        `Failure Reason & Stack Trace:`,
        otaDiagnostics.failureReason || 'N/A',
        `Download URL Used: ${otaDiagnostics.downloadUrl || 'N/A'}`,
        `APK Path: ${otaDiagnostics.apkPath || 'N/A'}`,
        `File Size: ${otaDiagnostics.fileSize || 'N/A'}`,
        `SHA-256 Expected: ${otaDiagnostics.shaExpected || 'N/A'}`,
        `SHA-256 Calculated: ${otaDiagnostics.shaCalculated || 'N/A'}`,
        `Installer Result: ${otaDiagnostics.installerResult || 'N/A'}`,
        '',
        '=== COMPREHENSIVE DEBUG LOGS ===',
        `App Version (APP_VERSION): ${otaDebugLogs.appVersion}`,
        `APK Version (Wrapper): ${otaDebugLogs.nativeApkVersion || 'N/A'}`,
        `Update System: APK only`,
        `OTA System: disabled`,
        `AppInstaller Available: ${otaDebugLogs.appInstallerAvailable}`,
        `downloadApk Available: ${otaDebugLogs.downloadApkAvailable}`,
        `verifyApkSha256 Available: ${otaDebugLogs.verifyApkSha256Available}`,
        `installApk Available: ${otaDebugLogs.installApkAvailable}`,
        `openInstallPermissionSettings Available: ${otaDebugLogs.openInstallPermissionSettingsAvailable}`,
        `Registered Capacitor Plugins: ${otaDebugLogs.registeredPlugins}`,
        `Plugin Method Check: ${otaDebugLogs.pluginMethodCheck}`,
        `Fetched version.json: ${otaDebugLogs.fetchedVersionJson || 'N/A'}`,
        `Fetched app-release.json: ${otaDebugLogs.fetchedAppReleaseJson || 'N/A'}`,
        `Update Type: ${otaDebugLogs.updateType || 'N/A'}`,
        `Download Status: ${otaDebugLogs.downloadStatus || 'N/A'}`,
        `SHA Verification Status: ${otaDebugLogs.shaVerification || 'N/A'}`,
        `File Details: ${otaDebugLogs.fileDetails || 'N/A'}`,
        `Install Error / Log: ${otaDebugLogs.installError || 'N/A'}`,
        `Installer Launch Status: ${otaDebugLogs.installerLaunchStatus || 'N/A'}`,
        `Last Exception Stack Trace:`,
        otaDebugLogs.lastExceptionStackTrace || 'N/A',
        '',
        '=== ELIGIBILITY DETAILS ===',
        `Installed package: ${otaDebugLogs.installedPackageName || 'N/A'}`,
        `Installed versionName: ${otaDebugLogs.installedVersionName || 'N/A'}`,
        `Installed versionCode: ${otaDebugLogs.installedVersionCode || 'N/A'}`,
        `Installed signing SHA-256: ${otaDebugLogs.installedSigningSha256 || 'N/A'}`,
        `Installed debuggable: ${otaDebugLogs.installedDebuggable !== null ? otaDebugLogs.installedDebuggable : 'N/A'}`,
        '',
        `Downloaded package: ${otaDebugLogs.downloadedPackageName || 'N/A'}`,
        `Downloaded versionName: ${otaDebugLogs.downloadedVersionName || 'N/A'}`,
        `Downloaded versionCode: ${otaDebugLogs.downloadedVersionCode || 'N/A'}`,
        `Downloaded signing SHA-256: ${otaDebugLogs.downloadedSigningSha256 || 'N/A'}`,
        `Downloaded debuggable: ${otaDebugLogs.downloadedDebuggable !== null ? otaDebugLogs.downloadedDebuggable : 'N/A'}`,
        `Downloaded isValidApk: ${otaDebugLogs.downloadedIsValidApk !== null ? otaDebugLogs.downloadedIsValidApk : 'N/A'}`,
        `Downloaded isUniversalApk: ${otaDebugLogs.downloadedIsUniversalApk !== null ? otaDebugLogs.downloadedIsUniversalApk : 'N/A'}`,
        `Downloaded size: ${otaDebugLogs.downloadedApkSize || 'N/A'}`,
        '',
        `Eligibility package match: ${otaDebugLogs.eligibilityPackageNameMatch !== null ? otaDebugLogs.eligibilityPackageNameMatch : 'N/A'}`,
        `Eligibility signing match: ${otaDebugLogs.eligibilitySigningMatch !== null ? otaDebugLogs.eligibilitySigningMatch : 'N/A'}`,
        `Eligibility versionCode higher: ${otaDebugLogs.eligibilityVersionCodeHigher !== null ? otaDebugLogs.eligibilityVersionCodeHigher : 'N/A'}`,
        `Eligibility release build: ${otaDebugLogs.eligibilityReleaseBuild !== null ? otaDebugLogs.eligibilityReleaseBuild : 'N/A'}`,
        `Eligibility valid APK: ${otaDebugLogs.eligibilityValidApk !== null ? otaDebugLogs.eligibilityValidApk : 'N/A'}`,
        `Eligibility final install: ${otaDebugLogs.eligibilityFinalInstall || 'N/A'}`,
        `Eligibility reason: ${otaDebugLogs.eligibilityReason || 'N/A'}`
      ].join('\n');
    };

    if (state === 'signature_mismatch') {
      const copyDiagnostics = async () => {
        try {
          const report = await getDiagnosticsReport();
          await navigator.clipboard.writeText(report);
          alert('Diagnostics health report copied to clipboard!');
        } catch (err) {
          console.error('Failed to copy diagnostics:', err);
        }
      };
      
      const handleRetryRecovery = async () => {
        try {
          await ota.runSignatureMismatchRecovery();
        } catch (err: any) {
          alert(`Recovery failed: ${err.message || String(err)}`);
        }
      };

      const handleGitHubInstall = async () => {
        try {
          await ota.downloadAndInstallGitHubApk();
        } catch (err: any) {
          alert(`GitHub install failed: ${err.message || String(err)}`);
        }
      };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              type="button"
              onClick={handleRetryRecovery}
              style={halfSecondaryButtonStyle}
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onLater}
              style={halfSecondaryButtonStyle}
            >
              Cancel
            </button>
          </div>

          <button
            type="button"
            onClick={handleGitHubInstall}
            style={primaryButtonStyle}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6 }}>download</span>
            Install Latest APK from GitHub
          </button>
          
          <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4 }}>
            <button
              type="button"
              onClick={handleOpenGitHub}
              style={{ ...halfSecondaryButtonStyle, fontSize: 11, height: 36 }}
            >
              GitHub Release Page
            </button>
            <button
              type="button"
              onClick={copyDiagnostics}
              style={{ ...halfSecondaryButtonStyle, fontSize: 11, height: 36 }}
            >
              Copy Diagnostics
            </button>
            <button
              type="button"
              onClick={() => setDiagnosticsOpen(true)}
              style={{ ...halfSecondaryButtonStyle, fontSize: 11, height: 36 }}
            >
              Diagnostics UI
            </button>
          </div>
        </div>
      );
    }

    if (state === 'versionCode_low') {
      const copyDiagnostics = async () => {
        const diagnosticText = getDiagnosticsText();
        try {
          await navigator.clipboard.writeText(diagnosticText);
          alert('Diagnostics copied to clipboard!');
        } catch (err) {
          console.error('Failed to copy diagnostics:', err);
        }
      };

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              type="button"
              onClick={copyDiagnostics}
              style={halfSecondaryButtonStyle}
            >
              Copy Diagnostics
            </button>
            <button
              type="button"
              onClick={() => setDiagnosticsOpen(true)}
              style={halfSecondaryButtonStyle}
            >
              Diagnostics UI
            </button>
          </div>

          <button
            type="button"
            onClick={onLater}
            style={primaryButtonStyle}
          >
            Later
          </button>
        </div>
      );
    }

    if (state === 'failed') {
      const copyDiagnostics = async () => {
        try {
          const report = await getDiagnosticsReport();
          await navigator.clipboard.writeText(report);
          alert('Diagnostics health report copied to clipboard!');
        } catch (err) {
          console.error('Failed to copy diagnostics:', err);
        }
      };

      const exportDiagnostics = async () => {
        try {
          const report = await getDiagnosticsReport();
          const { Share } = await import('@capacitor/share');
          await Share.share({
            title: 'Studio Updater Diagnostics',
            text: report,
            dialogTitle: 'Export Diagnostics'
          });
        } catch (err) {
          console.error('Failed to export diagnostics, copying instead:', err);
          await copyDiagnostics();
        }
      };

      if (ota.validApkExists) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, width: '100%' }}>
            <h4 style={{ margin: '4px 0 2px', fontSize: 13, fontWeight: 800, color: 'var(--c-text-primary)', fontFamily: 'Manrope', alignSelf: 'flex-start' }}>
              Installation could not be started
            </h4>
            <p style={{ margin: '0 0 6px', fontSize: 11.5, color: 'var(--c-text-secondary)', fontFamily: 'Inter', lineHeight: 1.45, textAlign: 'left' }}>
              {ota.error || 'Studio could not start the installation automatically. Please choose an option below to recover.'}
            </p>

            <button
              type="button"
              onClick={async () => {
                await ota.applyUpdate('Recovery Center: Retry Installation');
              }}
              style={primaryButtonStyle}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6 }}>refresh</span>
              Retry Installation
            </button>

            <button
              type="button"
              onClick={async () => {
                await ota.applyUpdate('Recovery Center: Continue Installation');
              }}
              style={secondaryButtonStyle}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6 }}>play_circle</span>
              Continue Installation
            </button>

            <button
              type="button"
              onClick={() => setShowGitHubConfirm(true)}
              style={{
                width: '100%', height: 44, borderRadius: 12,
                background: 'transparent',
                border: '1px solid rgba(128, 128, 128, 0.25)',
                color: 'var(--c-text-secondary)',
                fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background-color 200ms ease',
              }}
            >
              <GithubIcon size={18} color="var(--c-text-secondary)" />
              Download from GitHub
            </button>

            <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
              <button
                type="button"
                onClick={copyDiagnostics}
                style={halfSecondaryButtonStyle}
              >
                Copy Diagnostics
              </button>
              <button
                type="button"
                onClick={exportDiagnostics}
                style={halfSecondaryButtonStyle}
              >
                Export Diagnostics
              </button>
            </div>

            <button
              type="button"
              onClick={onLater}
              style={tertiaryButtonStyle}
            >
              Cancel
            </button>
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, width: '100%' }}>
          <h4 style={{ margin: '4px 0 2px', fontSize: 13, fontWeight: 800, color: 'var(--c-text-primary)', fontFamily: 'Manrope', alignSelf: 'flex-start' }}>
            Update Recovery Center
          </h4>
          <p style={{ margin: '0 0 6px', fontSize: 11.5, color: 'var(--c-text-secondary)', fontFamily: 'Inter', lineHeight: 1.45, textAlign: 'left' }}>
            {ota.error || 'Studio could not complete the update automatically. Please choose a recovery action below.'}
          </p>

          <button
            type="button"
            onClick={async () => {
              if (ota.updateAvailable) {
                await handleStartUpdate();
              } else {
                await ota.checkNow();
              }
            }}
            style={primaryButtonStyle}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 6 }}>refresh</span>
            Retry Update
          </button>

          <button
            type="button"
            onClick={() => setShowGitHubConfirm(true)}
            style={{
              width: '100%', height: 44, borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(128, 128, 128, 0.25)',
              color: 'var(--c-text-secondary)',
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background-color 200ms ease',
            }}
          >
            <GithubIcon size={18} color="var(--c-text-secondary)" />
            Download Latest Release
          </button>

          <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 4 }}>
            <button
              type="button"
              onClick={copyDiagnostics}
              style={halfSecondaryButtonStyle}
            >
              Copy Diagnostics
            </button>
            <button
              type="button"
              onClick={exportDiagnostics}
              style={halfSecondaryButtonStyle}
            >
              Export Diagnostics
            </button>
          </div>

          <button
            type="button"
            onClick={onLater}
            style={tertiaryButtonStyle}
          >
            Cancel
          </button>
        </div>
      );
    }

    return null;
  };

  const renderIndeterminateProgress = () => {
    return (
      <div style={{ width: '100%', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope', color: 'var(--c-text-primary)' }}>
          <span>Installing update...</span>
          <span>In progress</span>
        </div>
        <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.12)', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            width: '40%', height: '100%',
            background: `linear-gradient(90deg, ${purpleFrom}, ${purpleTo})`,
            animation: 'lg-indeterminate-progress 1.5s infinite linear',
            borderRadius: 3,
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-secondary)', fontFamily: 'Inter', opacity: 0.8, textAlign: 'left' }}>
          {ota.statusText || 'Waiting for system confirmation...'}
        </div>
      </div>
    );
  };

  const renderProgress = () => {
    if (state === 'installing' || state === 'installedOrReady') {
      return renderIndeterminateProgress();
    }
    if (!showProgress) return null;
    const pct = Math.round(progressVal * 100);
    const fileName = `studio-update-${toVersion || 'latest'}.apk`;
    return (
      <div style={{ width: '100%', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope', color: 'var(--c-text-primary)' }}>
          <span>Downloading update</span>
          <span>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.12)', overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: `linear-gradient(90deg, ${purpleFrom}, ${purpleTo})`,
            transition: 'width 200ms ease-out',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text-secondary)', fontFamily: 'monospace', opacity: 0.8 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%', textAlign: 'left' }}>
            {fileName}
          </span>
          {otaDebugLogs.downloadedApkSize && otaDebugLogs.downloadedApkSize !== 'N/A' && (
            <span>{otaDebugLogs.downloadedApkSize}</span>
          )}
        </div>
      </div>
    );
  };

  const renderSpinner = () => {
    if (!showSpinner) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '12px 0 6px' }}>
        <SpinnerSvg cFrom={purpleFrom} cTo={purpleTo} />
      </div>
    );
  };

  const renderIcon = () => {
    if (showSpinner) {
      return (
        <div style={{
          width: 58, height: 58, borderRadius: '50%',
          background: 'rgba(128,128,128,0.06)',
          border: '1.5px solid rgba(128,128,128,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 10,
        }}>
          <SpinnerSvg cFrom={purpleFrom} cTo={purpleTo} size={28} strokeWidth={3.6} />
        </div>
      );
    }

    return (
      <div style={{
        width: 58, height: 58, borderRadius: '50%',
        background: `color-mix(in srgb, ${iconColor} 12%, var(--app-surface))`,
        border: `1.5px solid color-mix(in srgb, ${iconColor} 28%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 20px color-mix(in srgb, ${iconColor} 18%, transparent)`,
        marginBottom: 10,
      }}>
        {iconName === 'download' ? (
          <DownloadIcon size={26} color={iconColor} />
        ) : (
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: iconColor }}>
            {iconName}
          </span>
        )}
      </div>
    );
  };

  const renderChangelog = () => {
    const releaseNotes = ota.releaseNotes;

    // Check if we have structured release notes with at least one item
    const hasStructured = releaseNotes && typeof releaseNotes === 'object' && !Array.isArray(releaseNotes) && (
      ((releaseNotes as StructuredReleaseNotes).added && (releaseNotes as StructuredReleaseNotes).added!.length > 0) ||
      ((releaseNotes as StructuredReleaseNotes).improved && (releaseNotes as StructuredReleaseNotes).improved!.length > 0) ||
      ((releaseNotes as StructuredReleaseNotes).fixed && (releaseNotes as StructuredReleaseNotes).fixed!.length > 0) ||
      ((releaseNotes as StructuredReleaseNotes).changed && (releaseNotes as StructuredReleaseNotes).changed!.length > 0)
    );

    if (hasStructured) {
      const rn = releaseNotes as StructuredReleaseNotes;
      const categories = [
        { label: 'Added', items: rn.added },
        { label: 'Improved', items: rn.improved },
        { label: 'Fixed', items: rn.fixed },
        { label: 'Changed', items: rn.changed },
      ].filter(cat => cat.items && cat.items.length > 0);

      return (
        <div style={{
          width: '100%',
          margin: '12px 0 4px',
          borderRadius: 14,
          background: 'rgba(128, 128, 128, 0.05)',
          border: '1px solid rgba(128, 128, 128, 0.08)',
          overflow: 'hidden',
          transition: 'all 200ms ease',
        }}>
          {/* Toggle Header */}
          <button
            type="button"
            onClick={() => setChangelogExpanded(!changelogExpanded)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              color: 'var(--c-text-primary)',
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: 12.5,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: purpleFrom }}>info</span>
              <span>What's New</span>
            </div>
            <span className="material-symbols-outlined" style={{
              fontSize: 16,
              color: 'var(--c-text-secondary)',
              transform: changelogExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
            }}>
              expand_more
            </span>
          </button>

          {/* Categories list */}
          {changelogExpanded && (
            <div style={{
              maxHeight: 150,
              overflowY: 'auto',
              padding: '0 14px 12px',
              borderTop: '1px solid rgba(128, 128, 128, 0.06)',
            }}>
              {categories.map((cat, idx) => (
                <div key={idx} style={{ marginTop: idx === 0 ? 8 : 12 }}>
                  <div style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: 'var(--c-text-primary)',
                    fontFamily: 'Manrope',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                  }}>
                    {cat.label}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--c-text-secondary)', fontFamily: 'Inter', lineHeight: 1.55 }}>
                    {cat.items!.map((item: string, itemIdx: number) => (
                      <li key={itemIdx} style={{ marginBottom: 4 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Fallback to flat list or plain text splits
    const bullets = Array.isArray(releaseNotes)
      ? (releaseNotes as string[])
      : (ota.changelog ? ota.changelog.split('\n').map(l => l.trim()).filter(Boolean) : []);

    if (bullets.length === 0) return null;

    return (
      <div style={{
        width: '100%',
        margin: '12px 0 4px',
        borderRadius: 14,
        background: 'rgba(128, 128, 128, 0.05)',
        border: '1px solid rgba(128, 128, 128, 0.08)',
        overflow: 'hidden',
        transition: 'all 200ms ease',
      }}>
        {/* Toggle Header */}
        <button
          type="button"
          onClick={() => setChangelogExpanded(!changelogExpanded)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            color: 'var(--c-text-primary)',
            fontFamily: 'Manrope',
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: purpleFrom }}>info</span>
            <span>What's New</span>
          </div>
          <span className="material-symbols-outlined" style={{
            fontSize: 16,
            color: 'var(--c-text-secondary)',
            transform: changelogExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}>
            expand_more
          </span>
        </button>

        {/* Bullet List Container */}
        {changelogExpanded && (
          <div style={{
            maxHeight: 150,
            overflowY: 'auto',
            padding: '0 14px 12px',
            borderTop: '1px solid rgba(128, 128, 128, 0.06)',
          }}>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--c-text-secondary)', fontFamily: 'Inter', lineHeight: 1.55 }}>
              {bullets.map((bullet, idx) => (
                <li key={idx} style={{ marginBottom: 5 }}>
                  {bullet.replace(/^-\s*/, '')}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };
  const isProgressScreenActive = [
    'preparing',
    'enteringProgressScreen',
    'downloading',
    'verifying',
    'readyForInstallPrompt',
    'waitingForUserInstallConfirmation',
    'installing',
    'installedOrReady',
    'installed',
    'failed'
  ].includes(state);

  if (isProgressScreenActive && !showGitHubConfirm) {
    let actionButtons: React.ReactNode = null;
    if (state === 'failed') {
      actionButtons = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={handleStartUpdate}
              style={{
                flex: 1, padding: '12px', borderRadius: 12,
                background: `linear-gradient(90deg, ${purpleFrom}, ${purpleTo})`,
                color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
                transition: 'opacity 200ms ease',
              }}
            >
              Retry
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '12px', borderRadius: 12,
                background: 'rgba(128,128,128,0.12)',
                color: 'var(--c-text-primary)', border: 'none', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
                transition: 'background-color 200ms ease',
              }}
            >
              Cancel
            </button>
          </div>
          <button
            onClick={() => setShowGitHubConfirm(true)}
            style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(128, 128, 128, 0.25)',
              color: 'var(--c-text-secondary)', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background-color 200ms ease',
            }}
          >
            <GithubIcon size={18} color="var(--c-text-secondary)" />
            Download from GitHub
          </button>
        </div>
      );
    }

    return (
      <StudioUpdateScreen
        progress={progressVal}
        accentFrom={purpleFrom}
        accentTo={purpleTo}
        statusText={description}
        actionButtons={actionButtons}
        updateState={state}
      />
    );
  }

  if (showGitHubConfirm) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        onClick={() => setShowGitHubConfirm(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9000,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'fade-in 200ms ease-out both',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: 380,
            width: '100%',
            background: 'var(--app-surface)',
            borderRadius: 22,
            overflow: 'hidden',
            border: '1px solid rgba(128,128,128,0.15)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            animation: 'rise-in 240ms cubic-bezier(0.34,1.15,0.64,1) both',
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
            <div style={{
              width: 58, height: 58, borderRadius: '50%',
              background: 'rgba(128,128,128,0.06)',
              border: '1.5px solid rgba(128,128,128,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 10,
            }}>
              <GithubIcon size={28} color="var(--c-text-primary)" />
            </div>
            
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: 'Manrope', color: 'var(--c-text-primary)' }}>
              Download Official Release
            </h3>
            
            <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text-secondary)', fontFamily: 'Inter', lineHeight: 1.5, textAlign: 'left' }}>
              The automatic updater could not complete this installation.<br /><br />
              Studio publishes every official production APK on GitHub. You can safely download the latest signed release directly from the official repository.<br /><br />
              This is the recommended recovery method whenever automatic installation cannot complete.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, width: '100%' }}>
              <button
                type="button"
                onClick={async () => {
                  await handleOpenGitHub();
                  setShowGitHubConfirm(false);
                }}
                style={primaryButtonStyle}
              >
                Open GitHub
              </button>
              <button
                type="button"
                onClick={() => setShowGitHubConfirm(false)}
                style={tertiaryButtonStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fade-in 200ms ease-out both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 380,
          width: '100%',
          background: 'var(--app-surface)',
          borderRadius: 22,
          overflow: 'hidden',
          border: '1px solid rgba(128,128,128,0.15)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          animation: 'rise-in 240ms cubic-bezier(0.34,1.15,0.64,1) both',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
          {renderIcon()}

          <p style={{
            margin: 0, fontSize: 20, fontWeight: 800,
            color: 'var(--c-text-primary)',
            fontFamily: 'Manrope', letterSpacing: '-0.02em',
          }}>
            {title}
          </p>

          <div style={{
            margin: '2px 0 0', fontSize: 13.5,
            color: 'var(--c-text-secondary)',
            fontFamily: 'Inter', lineHeight: 1.5,
          }}>
            {description}
          </div>

          {(state === 'available' || state === 'ready_to_install' || state === 'verifying_apk') && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6, width: '100%',
              alignItems: 'center', margin: '8px 0 2px',
              fontSize: 12.5, fontFamily: 'Manrope', fontWeight: 700,
              color: 'var(--c-text-secondary)'
            }}>
              {(state === 'available' || state === 'ready_to_install') && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <span>Current: <span style={{ color: 'var(--c-text-primary)', fontFamily: 'monospace' }}>{fromLabel}</span></span>
                  <span>New: <span style={{ color: 'var(--c-text-primary)', fontFamily: 'monospace' }}>{toVersion}</span></span>
                </div>
              )}
              {state === 'ready_to_install' && otaDebugLogs.downloadedApkSize && otaDebugLogs.downloadedApkSize !== 'N/A' && (
                <span style={{ fontSize: 11.5, color: 'var(--c-text-secondary)', opacity: 0.85 }}>
                  Size: <span style={{ color: 'var(--c-text-primary)', fontFamily: 'monospace' }}>{otaDebugLogs.downloadedApkSize}</span>
                </span>
              )}
              {state === 'verifying_apk' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', opacity: 0.85, width: '100%', padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: otaDebugLogs.shaVerification === 'SUCCESS' ? '#22c55e' : '#f59e0b', animation: otaDebugLogs.shaVerification ? 'none' : 'lg-spin-spinner 1.2s linear infinite' }}>
                      {otaDebugLogs.shaVerification === 'SUCCESS' ? 'verified' : (otaDebugLogs.shaVerification === 'FAILED' ? 'warning' : 'sync')}
                    </span>
                    <span style={{ fontSize: 12 }}>SHA-256 Checksum: {otaDebugLogs.shaVerification === 'SUCCESS' ? 'Verified' : (otaDebugLogs.shaVerification === 'FAILED' ? 'Failed' : 'Verifying...')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#f59e0b', animation: 'lg-spin-spinner 1.2s linear infinite' }}>
                      sync
                    </span>
                    <span style={{ fontSize: 12 }}>Package Compatibility: Checking...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {renderChangelog()}
          {renderProgress()}
          {renderSpinner()}

          {mandatory && state === 'available' && (
            <p style={{
              margin: '6px 0 0', fontSize: 11.5,
              color: '#f59e0b', fontFamily: 'Inter', fontWeight: 600,
            }}>
              This update is required.
            </p>
          )}

          {renderButtons()}
        </div>
        <UpdateDiagnosticsSheet open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rise-in {
          from { opacity: 0; transform: translateY(14px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lg-spin-spinner {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

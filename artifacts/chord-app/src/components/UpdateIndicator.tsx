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
import { useOtaUpdate } from '../lib/otaUpdate';
import UpdateDiagnosticsSheet from './UpdateDiagnosticsSheet';
import { APP_VERSION_LABEL, compareSemver, normalizeSemver } from '../lib/appVersion';
import { applyUpdate, isNative, fadeToBlackAndReload } from '../lib/capgoUpdater';
import { DownloadIcon } from './DownloadIcon';
import { useChordStore } from '../store/useChordStore';
import {
  enableLiquidGlass,
  tagLiquidTarget,
  untagLiquidTarget,
} from '../lib/liquidGlass';

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

function SpinnerSvg({ cFrom, cTo }: { cFrom: string; cTo: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      style={{
        animation: 'lg-spin-spinner 1s linear infinite',
        flexShrink: 0,
      }}
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="url(#lg-spinner-grad-indicator)" />
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

  // Wipe the legacy "dismissed forever" key on mount so users who tapped
  // Later in a previous build aren't stuck without an indicator.
  useEffect(() => { clearLegacyDismissed(); }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Auto-minimize disabled per user request so the banner remains fully visible.

  // Auto-OPEN the update modal whenever an update is available.
  useEffect(() => {
    if (!ota.updateAvailable || !ota.remoteVersion) return;
    if (ota.updateState === 'dismissed') return;

    const autoOpened = readAutoOpenedVersion();
    if (autoOpened === ota.remoteVersion) return;

    setOpen(true);
    writeAutoOpenedVersion(ota.remoteVersion);
  }, [ota.updateAvailable, ota.remoteVersion, ota.updateState]);

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
    if (checkPhase === 'gone') return null;
    const fading = checkPhase === 'fading';
    const isOk   = checkPhase === 'ok' || fading;
    const cFrom = `var(--accent-from, ${accentFrom})`;
    const cTo   = `var(--accent-to, ${accentTo})`;

    const amoledBg = isLight
      ? 'rgba(255, 255, 255, 0.40)'
      : 'rgba(26, 26, 30, 0.72)';
    const fallbackBorder = isLight
      ? '1px solid rgba(0, 0, 0, 0.08)'
      : '1px solid rgba(255, 255, 255, 0.28)';
    const fallbackShadow = isLight
      ? '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1.5px 0 rgba(255, 255, 255, 0.70)'
      : '0 12px 48px rgba(0, 0, 0, 0.50), inset 0 1.5px 0 rgba(255, 255, 255, 0.08)';

    return (
      <>
        <div
          ref={checkRef}
          aria-live="polite"
          aria-label={isOk ? 'App is up to date' : 'Checking for updates'}
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top) + 14px)',
            right: 14,
            zIndex: 60,
            height: 32,
            padding: '0 14px 0 10px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            background: amoledBg,
            border: fallbackBorder,
            color: 'var(--c-text-primary)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: fallbackShadow,
            fontFamily: 'Manrope, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '-0.005em',
            opacity: entered && !fading ? 1 : 0,
            transform: entered && !fading ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.95)',
            transition: 'opacity 800ms cubic-bezier(0.16, 1, 0.3, 1), transform 800ms cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        >
          {isOk ? (
            <CheckIconSvg />
          ) : (
            <SpinnerSvg cFrom={cFrom} cTo={cTo} />
          )}
          <span>{isOk ? 'Up to date' : 'Checking\u2026'}</span>
        </div>
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
    if (ota.remoteVersion) {
      writeLaterVersion(ota.remoteVersion);
      setLaterVersion(ota.remoteVersion);
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
          top: 'calc(env(safe-area-inset-top) + 14px)',
          right: isBanner ? '50%' : '14px',
          zIndex: 60,
          width: isBanner ? 'min(360px, calc(100vw - 28px))' : 44,
          height: isBanner ? 52 : 44,
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
            width: isBanner ? 18 : 24,
            height: isBanner ? 18 : 24,
            flexShrink: 0,
            filter: isBanner ? undefined : 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25))',
            animation: isBanner ? undefined : 'pill-download-bounce 1.6s ease-in-out infinite',
            transition: 'width 620ms cubic-bezier(0.34, 1.12, 0.64, 1), height 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
          }}
        >
          <DownloadIcon size={isBanner ? 18 : 24} color={isLight ? cTo : '#fff'} />
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
          {ota.updateType === 'ota'
            ? (ota.remoteVersion ? `Version ${ota.remoteVersion} available` : 'Studio update available')
            : 'App update available'}
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
            if (phase === 'banner') {
              setPhase('pill');
              markBannerShown();
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
  
  // For APK updates, we do NOT show the fullscreen progress overlay when state is 'ready',
  // because we want to show the "Install Studio update?" confirmation dialog instead.
  const isApkFlow = ota.updateType === 'apk' || ota.updateType === 'both';
  
  const isDownloading = ota.updateState === 'downloading' || ota.updateState === 'applied' || (!isApkFlow && ota.updateState === 'ready');
  const progress = ota.progress;

  if (ota.updateState === 'manual_apk_required') {
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
            textAlign: 'center',
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#eab308' }}>download_for_offline</span>
            <p style={{
              margin: 0, fontSize: 20, fontWeight: 800,
              color: 'var(--c-text-primary)',
              fontFamily: 'Manrope', letterSpacing: '-0.02em',
            }}>Manual update required</p>
            
            <p style={{
              margin: '6px 0 0', fontSize: 13,
              color: 'var(--c-text-secondary)',
              fontFamily: 'Inter', lineHeight: 1.55,
            }}>
              This installed version of Studio cannot install native updates automatically. Please install the latest Studio APK manually once. Future updates will install from inside Studio.
            </p>
            
            <div style={{ display: 'flex', gap: 8, marginTop: 18, width: '100%' }}>
              <button
                type="button"
                onClick={onLater}
                style={{
                  flex: 1, height: 42, borderRadius: 12,
                  background: 'transparent',
                  border: '1px solid rgba(128,128,128,0.22)',
                  color: 'var(--c-text-secondary)',
                  fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Later
              </button>
              <button
                type="button"
                onClick={async () => {
                  const apkUrl = ota.apkUrl || `https://github.com/MAGEXE1000/Studio/releases/download/v${ota.remoteVersion}/studio-${ota.remoteVersion}.apk`;
                  window.open(apkUrl, '_system');
                  onClose();
                }}
                style={{
                  flex: 1, height: 42, borderRadius: 12,
                  background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})`,
                  border: 'none', color: 'white',
                  fontFamily: 'Manrope', fontWeight: 800, fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: `0 6px 18px color-mix(in srgb, ${accentTo} 30%, transparent)`,
                }}
              >
                Download APK
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleStartUpdate = async () => {
    try {
      await ota.downloadUpdate();
      if (!isApkFlow) {
        await ota.applyUpdate();
      }
    } catch (err) {
      console.error('[UpdateIndicator] Start update failed:', err);
    }
  };

  const handleInstallApk = async () => {
    try {
      if (isNative()) {
        const { AppInstaller } = await import('../lib/apkDownloader');
        const hasPerm = (await AppInstaller.canRequestPackageInstalls()).value;
        if (!hasPerm) {
          setPermissionBlocked(true);
          return;
        }
      }
      await ota.applyUpdate();
    } catch (err) {
      console.error('[UpdateIndicator] APK Install failed:', err);
    }
  };

  const handleOpenSettings = async () => {
    try {
      const { AppInstaller } = await import('../lib/apkDownloader');
      await AppInstaller.openUnknownAppSourcesSettings();
    } catch (err) {
      console.error('[UpdateIndicator] Failed to open settings:', err);
    }
  };

  useEffect(() => {
    if (!permissionBlocked) return;

    let active = true;
    let nativeListener: { remove: () => Promise<void> } | undefined;

    const checkPerm = async () => {
      try {
        const { AppInstaller } = await import('../lib/apkDownloader');
        const hasPerm = (await AppInstaller.canRequestPackageInstalls()).value;
        if (hasPerm && active) {
          setPermissionBlocked(false);
          await ota.applyUpdate();
        }
      } catch (err) {
        console.warn('[Permissions] Failed to query status:', err);
      }
    };

    import('@capacitor/app').then(async ({ App }) => {
      if (!active) return;
      nativeListener = await App.addListener('appStateChange', (s) => {
        if (s.isActive) {
          checkPerm();
        }
      });
    }).catch(() => {});

    window.addEventListener('focus', checkPerm);

    return () => {
      active = false;
      window.removeEventListener('focus', checkPerm);
      nativeListener?.remove().catch(() => {});
    };
  }, [permissionBlocked, ota]);

  const handleOpenGitHub = async () => {
    try {
      const { resolveReleasePageUrl } = await import('../lib/apkDownloader');
      const fallbackUrl = await resolveReleasePageUrl(ota.remoteVersion ?? undefined);
      window.open(fallbackUrl, '_system');
      onClose();
    } catch (err) {
      window.open('https://github.com/MAGEXE1000/Studio/releases', '_system');
      onClose();
    }
  };

  if (permissionBlocked) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        onClick={() => setPermissionBlocked(false)}
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
            textAlign: 'center',
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#eab308' }}>security</span>
            <p style={{
              margin: 0, fontSize: 18, fontWeight: 800,
              color: 'var(--c-text-primary)',
              fontFamily: 'Manrope', letterSpacing: '-0.02em',
            }}>Automatic installation blocked</p>
            
            <p style={{
              margin: '6px 0 0', fontSize: 13,
              color: 'var(--c-text-secondary)',
              fontFamily: 'Inter', lineHeight: 1.55,
            }}>
              Please enable the 'Install unknown apps' permission for Studio in Android system settings to install the update.
            </p>
            
            <div style={{ display: 'flex', gap: 8, marginTop: 18, width: '100%' }}>
              <button
                type="button"
                onClick={() => setPermissionBlocked(false)}
                style={{
                  flex: 1, height: 42, borderRadius: 12,
                  background: 'transparent',
                  border: '1px solid rgba(128,128,128,0.22)',
                  color: 'var(--c-text-secondary)',
                  fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOpenSettings}
                style={{
                  flex: 1, height: 42, borderRadius: 12,
                  background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})`,
                  border: 'none', color: 'white',
                  fontFamily: 'Manrope', fontWeight: 800, fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: `0 6px 18px color-mix(in srgb, ${accentTo} 30%, transparent)`,
                }}
              >
                Open Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isDownloading) {
    return (
      <StudioUpdateScreen
        progress={progress}
        accentFrom={accentFrom}
        accentTo={accentTo}
        statusText={ota.statusText}
      />
    );
  }

  // Fallback Error UI
  if (ota.updateState === 'error') {
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
            textAlign: 'center',
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#f87171' }}>error</span>
            <p style={{
              margin: 0, fontSize: 18, fontWeight: 800,
              color: 'var(--c-text-primary)',
              fontFamily: 'Manrope', letterSpacing: '-0.02em',
            }}>Automatic update failed. Open download page?</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18, width: '100%' }}>
              <button
                type="button"
                onClick={() => setDiagnosticsOpen(true)}
                style={{
                  width: '100%', height: 42, borderRadius: 12,
                  background: 'rgba(128,128,128,0.08)',
                  border: '1px solid rgba(128,128,128,0.15)',
                  color: 'var(--c-text-primary)',
                  fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Open Update Diagnostics
              </button>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1, height: 42, borderRadius: 12,
                    background: 'transparent',
                    border: '1px solid rgba(128,128,128,0.22)',
                    color: 'var(--c-text-secondary)',
                    fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOpenGitHub}
                  style={{
                    flex: 1, height: 42, borderRadius: 12,
                    background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})`,
                    border: 'none', color: 'white',
                    fontFamily: 'Manrope', fontWeight: 800, fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: `0 6px 18px color-mix(in srgb, ${accentTo} 30%, transparent)`,
                  }}
                >
                  Open GitHub
                </button>
              </div>
            </div>
            <UpdateDiagnosticsSheet open={diagnosticsOpen} onClose={() => setDiagnosticsOpen(false)} />
          </div>
        </div>
      </div>
    );
  }

  // Confirmation dialog when APK is ready to install
  if (ota.updateState === 'ready' && isApkFlow) {
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
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            textAlign: 'center',
          }}>
            <div style={{
              width: 58, height: 58, borderRadius: '50%',
              background: `color-mix(in srgb, ${accentFrom} 12%, var(--app-surface))`,
              border: `1.5px solid color-mix(in srgb, ${accentFrom} 28%, transparent)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 26, color: accentFrom }}>system_update</span>
            </div>
            
            <p style={{
              margin: 0, fontSize: 20, fontWeight: 800,
              color: 'var(--c-text-primary)',
              fontFamily: 'Manrope', letterSpacing: '-0.02em',
            }}>Install update?</p>
            
            <p style={{
              margin: '6px 0 0', fontSize: 13,
              color: 'var(--c-text-secondary)',
              fontFamily: 'Inter', lineHeight: 1.55,
            }}>
              Android will ask for confirmation before installing.
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 18, width: '100%' }}>
              <button
                type="button"
                onClick={onLater}
                style={{
                  flex: 1, height: 42, borderRadius: 12,
                  background: 'transparent',
                  border: '1px solid rgba(128,128,128,0.22)',
                  color: 'var(--c-text-secondary)',
                  fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleInstallApk}
                style={{
                  flex: 1, height: 42, borderRadius: 12,
                  background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})`,
                  border: 'none', color: 'white',
                  fontFamily: 'Manrope', fontWeight: 800, fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: `0 6px 18px color-mix(in srgb, ${accentTo} 30%, transparent)`,
                }}
              >
                Install
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pre-download modal: standard OTA or APK update notification
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
        }}
      >
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', padding: '32px 24px 22px', gap: 12,
        }}>
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: `color-mix(in srgb, ${accentFrom} 12%, var(--app-surface))`,
            border: `1.5px solid color-mix(in srgb, ${accentFrom} 28%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 20px color-mix(in srgb, ${accentFrom} 18%, transparent)`,
          }}>
            <DownloadIcon size={26} color={accentFrom} />
          </div>

          <p style={{
            margin: 0, fontSize: 20, fontWeight: 800,
            color: 'var(--c-text-primary)',
            fontFamily: 'Manrope', letterSpacing: '-0.02em',
          }}>
            {isApkFlow ? 'Studio update available' : 'App update available'}
          </p>

          {!isApkFlow && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 11px', borderRadius: 9999,
              background: `color-mix(in srgb, ${accentFrom} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accentFrom} 28%, transparent)`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: accentFrom, display: 'block', flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700, color: accentFrom,
                fontFamily: 'Manrope', letterSpacing: '0.04em',
              }}>v{toVersion}</span>
            </div>
          )}
        </div>

        <div style={{
          background: 'var(--app-surface-high)',
          padding: '20px 22px 24px',
          borderTop: '1px solid rgba(128,128,128,0.1)',
        }}>
          <p style={{
            margin: 0, fontSize: 13,
            color: 'var(--c-text-secondary)',
            fontFamily: 'Inter', lineHeight: 1.55,
          }}>
            {isApkFlow 
              ? 'Native update required. Studio will download and guide you through the installation.'
              : `Version ${toVersion} is ready. You're on ${fromLabel}.`
            }
          </p>

          {mandatory && (
            <p style={{
              margin: '10px 0 0', fontSize: 11,
              color: '#f59e0b', fontFamily: 'Inter', fontWeight: 600,
            }}>
              This update is required.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              type="button"
              onClick={onLater}
              style={{
                flex: 1, height: 42, borderRadius: 12,
                background: 'transparent',
                border: '1px solid rgba(128,128,128,0.22)',
                color: 'var(--c-text-secondary)',
                fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isApkFlow ? 'Later' : 'Remind me later'}
            </button>
            <AnimatedActionButton
              type="button"
              onClick={handleStartUpdate}
              wrapStyle={{ flex: 2, height: 42 }}
              borderRadius={12}
              trailColor={accentTo}
              style={{
                height: '100%',
                background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})`,
                border: 'none', color: 'white',
                fontFamily: 'Manrope', fontWeight: 800, fontSize: 13,
                cursor: 'pointer',
                boxShadow: `0 6px 18px color-mix(in srgb, ${accentTo} 30%, transparent)`,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 7,
              }}
            >
              {isApkFlow ? 'Install update' : 'Update now'}
            </AnimatedActionButton>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rise-in {
          from { opacity: 0; transform: translateY(14px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

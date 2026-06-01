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

import { useState, useEffect } from 'react';
import StudioSpinner from './animata/progress/spinner';
import AnimatedActionButton from './animata/container/animated-border-trail';
import StudioUpdateScreen from './StudioUpdateScreen';
import { useOtaUpdate } from '../lib/otaUpdate';
import { APP_VERSION_LABEL, compareSemver, normalizeSemver } from '../lib/appVersion';
import { applyUpdate, isNative, fadeToBlackAndReload } from '../lib/capgoUpdater';
import { DownloadIcon } from './DownloadIcon';

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
    const raw = localStorage.getItem(LATER_VERSION_KEY);
    if (!raw || normalizeSemver(raw) === null) return null;
    return raw;
  } catch { return null; }
}
function writeLaterVersion(v: string): void {
  try { localStorage.setItem(LATER_VERSION_KEY, v); } catch { /* quota / privacy */ }
}
function clearLegacyDismissed(): void {
  try { localStorage.removeItem(LEGACY_DISMISSED_KEY); } catch { /* ignore */ }
}

type Phase = 'banner' | 'pill';

function readInitialPhase(): Phase {
  try {
    return sessionStorage.getItem(BANNER_SHOWN_KEY) === '1' ? 'pill' : 'banner';
  } catch {
    return 'banner';
  }
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

  // Wipe the legacy "dismissed forever" key on mount so users who tapped
  // Later in a previous build aren't stuck without an indicator.
  useEffect(() => { clearLegacyDismissed(); }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Auto-minimize the banner after BANNER_AUTO_MINIMIZE_MS.
  useEffect(() => {
    if (!ota.updateAvailable || phase !== 'banner') return;
    const t = window.setTimeout(() => {
      setPhase('pill');
      markBannerShown();
    }, BANNER_AUTO_MINIMIZE_MS);
    return () => window.clearTimeout(t);
  }, [ota.updateAvailable, phase]);

  // Auto-OPEN the update modal once per remote version, UNLESS the
  // user has already tapped "Later" for that exact version (or newer).
  useEffect(() => {
    if (!ota.updateAvailable || !ota.remoteVersion) return;
    if (
      laterVersion &&
      compareSemver(laterVersion, ota.remoteVersion) >= 0
    ) return;
    const already = readAutoOpenedVersion();
    if (already && compareSemver(already, ota.remoteVersion) >= 0) return;
    writeAutoOpenedVersion(ota.remoteVersion);
    setOpen(true);
  }, [ota.updateAvailable, ota.remoteVersion, laterVersion]);

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

  if (!ota.updateAvailable) {
    if (checkPhase === 'gone') return null;
    const fading = checkPhase === 'fading';
    const isOk   = checkPhase === 'ok' || fading;
    const cFrom = `var(--accent-from, ${accentFrom})`;
    const cTo   = `var(--accent-to, ${accentTo})`;
    const tint  = (pct: number) =>
      `color-mix(in srgb, ${cTo} ${pct}%, transparent)`;
    const tintFrom = (pct: number) =>
      `color-mix(in srgb, ${cFrom} ${pct}%, transparent)`;
    return (
      <>
        <div
          aria-live="polite"
          aria-label={isOk ? 'App is up to date' : 'Checking for updates'}
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top) + 14px)',
            right: 14,
            zIndex: 60,
            height: 32,
            padding: '0 12px 0 10px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            whiteSpace: 'nowrap',
            background: `linear-gradient(135deg, ${tintFrom(18)}, ${tint(18)})`,
            border: `1px solid ${tint(32)}`,
            color: 'var(--c-text-primary)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: `0 4px 14px ${tint(15)}`,
            fontFamily: 'Manrope, sans-serif',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '-0.005em',
            opacity: entered && !fading ? 1 : 0,
            transition: 'opacity 900ms cubic-bezier(0.4, 0, 0.2, 1)',
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        >
          {isOk ? (
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#22c55e' }}>check_circle</span>
          ) : (
            <StudioSpinner outerSize="h-4 w-4" childSize="h-3 w-3" colorFrom={cFrom} colorTo={cTo} />
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

  return (
    <>
      <button
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
          background: `linear-gradient(135deg, ${tintFrom(22)}, ${tint(22)})`,
          border: `1px solid ${tint(40)}`,
          color: 'var(--c-text-primary)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: isBanner
            ? `0 16px 40px ${tint(25)}, inset 0 0 0 1px ${tint(13)}`
            : `0 8px 24px ${tint(25)}, inset 0 0 0 1px ${tint(13)}`,
          fontFamily: 'Manrope, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.005em',
          textAlign: 'left',
          cursor: 'pointer',
          opacity: entered ? 1 : 0,
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
            filter: isBanner ? undefined : `drop-shadow(0 2px 10px color-mix(in srgb, ${cTo} 60%, transparent))`,
            animation: isBanner ? undefined : 'pill-download-bounce 1.6s ease-in-out infinite',
          }}
        >
          <DownloadIcon size={isBanner ? 18 : 24} color={cTo} />
        </span>

        <span
          style={{
            flex: 1,
            opacity: isBanner ? 1 : 0,
            transform: isBanner ? 'translateX(0)' : 'translateX(-8px)',
            transition: isBanner
              ? 'opacity 280ms 200ms ease, transform 280ms 200ms ease'
              : 'opacity 200ms ease, transform 200ms ease',
            pointerEvents: isBanner ? 'auto' : 'none',
          }}
        >
          {ota.remoteVersion
            ? `Version ${ota.remoteVersion} available`
            : 'New update available'}
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
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const canCapgoUpdate = isNative() && !!downloadUrl && toVersion !== '—';

  const handleReload = async () => {
    if (downloading) return;
    setErrMsg(null);
    if (canCapgoUpdate) {
      setDownloading(true);
      setProgress(0);
      const res = await applyUpdate({
        url: downloadUrl!,
        version: toVersion,
        onProgress: (p) => setProgress((prev) => Math.max(prev, p)),
      });
      setDownloading(false);
      if (!res.ok) {
        setErrMsg(res.error ?? 'Update failed');
        return;
      }
      onClose();
      return;
    }
    if (isNative()) {
      setErrMsg(
        "Update available but the server didn't publish a download link. Try again later.",
      );
      return;
    }
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    setDownloading(true);
    setProgress(1.0);
    await new Promise((resolve) => setTimeout(resolve, 800));
    await fadeToBlackAndReload(() => {
      window.location.reload();
    });
  };

  if (downloading) {
    return (
      <StudioUpdateScreen
        progress={progress}
        accentFrom={accentFrom}
        accentTo={accentTo}
      />
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
        }}
      >
        <>
            {/* ── Top section: icon + title + badge ── */}
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
              }}>Update Available</p>

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
            </div>

            {/* ── Tinted bottom section ── */}
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
                Version {toVersion} is ready. You&apos;re on {fromLabel}.
              </p>

              {mandatory && (
                <p style={{
                  margin: '10px 0 0', fontSize: 11,
                  color: '#f59e0b', fontFamily: 'Inter', fontWeight: 600,
                }}>
                  This update is required.
                </p>
              )}

              {errMsg && (
                <p style={{
                  margin: '10px 0 0', fontSize: 11,
                  color: '#f87171', fontFamily: 'Inter',
                  fontWeight: 600, textAlign: 'center',
                }}>
                  {errMsg}
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
                  Remind me later
                </button>
                <AnimatedActionButton
                  type="button"
                  onClick={handleReload}
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
                  Update now
                </AnimatedActionButton>
              </div>
            </div>
          </>
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

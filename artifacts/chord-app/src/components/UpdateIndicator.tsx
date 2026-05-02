/**
 * Floating "update available" indicator — top of the Hub.
 *
 * Two-phase behaviour:
 *  1. BANNER — when an update is first detected, a wide pill drops in
 *     from the top of the screen, CENTERED horizontally, announcing
 *     "Version X.Y.Z available" with a minimize button. Stays for
 *     ~6 seconds (or until the user taps minimize), then…
 *  2. PILL — smoothly morphs into a small circular badge that travels
 *     to the top-right corner. The element's right edge slides from
 *     the viewport center to `right: 14px` while the width contracts;
 *     border-radius eases from 14 → 999, producing a single fluid
 *     "rectangle becomes a circle and tucks itself away" motion.
 *
 * Why the right-edge anchor trick:
 *   The morph animates `right: 50%` → `right: 14px` and
 *   `transform: translateX(50%)` → `translateX(0)` together. Both are
 *   interpolatable CSS values, so a single transition handles both
 *   the centering and the shrink — no JS measurement, no layout
 *   thrash, GPU-accelerated end-to-end.
 *
 * The banner-shown flag is stored in sessionStorage so the user only
 * sees the full banner once per session — subsequent navigations
 * within the same session render the pill directly. A hard reload
 * (or the next day's session) plays the banner again.
 *
 * Lives inside StudioHub. Sub-apps deliberately don't show this —
 * when the user is inside Drumex / etc. they're focused on a task
 * and shouldn't be interrupted.
 */

import { useState, useEffect } from 'react';
import { useOtaUpdate } from '../lib/otaUpdate';
import { APP_VERSION_LABEL, compareSemver, normalizeSemver } from '../lib/appVersion';
import { applyUpdate, isNative } from '../lib/capgoUpdater';

/** How long the full banner stays visible before auto-minimizing. */
const BANNER_AUTO_MINIMIZE_MS = 6000;

/** Session flag so the banner shows at most once per page session. */
const BANNER_SHOWN_KEY = 'studio:updateBannerShown';

/**
 * localStorage key recording the latest version the user has
 * explicitly dismissed (via "Later" in the modal). When the remote
 * version equals this, we render nothing — the pill is no longer
 * "always there nagging". A NEWER remote version surfaces a fresh
 * banner.
 */
const DISMISSED_VERSION_KEY = 'studio:dismissedUpdateVersion';

function readDismissedVersion(): string | null {
  try {
    const raw = localStorage.getItem(DISMISSED_VERSION_KEY);
    // Reject anything that isn't a strictly-valid semver. Without
    // this, a corrupted/tampered value would feed compareSemver
    // garbage, which returns 0 ("equal"), permanently suppressing
    // the indicator. A parse failure → treat as "no prior dismissal"
    // and let the user see the banner again.
    if (!raw || normalizeSemver(raw) === null) return null;
    return raw;
  } catch {
    return null;
  }
}
function writeDismissedVersion(v: string): void {
  try { localStorage.setItem(DISMISSED_VERSION_KEY, v); } catch { /* quota / privacy */ }
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
  accentFrom: string;
  accentTo: string;
}) {
  const ota = useOtaUpdate();
  const [phase, setPhase] = useState<Phase>(readInitialPhase);
  const [open, setOpen] = useState(false);
  // Tiny entrance flag — start at translateY(-16px)/opacity 0 on first
  // paint, then flip on next frame so the CSS transition runs.
  const [entered, setEntered] = useState(false);
  // Version the user has explicitly dismissed via "Later". Re-read on
  // mount; updated locally when the modal's Later button fires so we
  // can hide immediately without a remount.
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(readDismissedVersion);

  useEffect(() => {
    // Defer one frame so the initial style commits, then transition in.
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

  if (ota.loading || !ota.updateAvailable) return null;

  // Hide entirely if the user has already dismissed THIS exact version
  // (or a newer one). A future remote bump will exceed the dismissed
  // marker and the banner will surface again.
  if (
    dismissedVersion &&
    ota.remoteVersion &&
    compareSemver(dismissedVersion, ota.remoteVersion) >= 0
  ) {
    return null;
  }

  const minimize = () => {
    setPhase('pill');
    markBannerShown();
  };

  const dismissForever = () => {
    if (ota.remoteVersion) {
      writeDismissedVersion(ota.remoteVersion);
      setDismissedVersion(ota.remoteVersion);
    }
  };

  const isBanner = phase === 'banner';

  return (
    <>
      {/* Single morphing element: banner ↔ pill. The position trick
          keeps the right edge as the morph anchor so the element can
          smoothly slide from the screen center to the top-right
          corner WITHOUT any "left/auto" non-interpolatable gaps:
            - banner: right: 50% + translateX(50%)  → centered
            - pill:   right: 14px + translateX(0)   → corner
          Both halves of that pair animate as plain numeric CSS, so
          the entire morph (position + size + radius) is one fluid
          GPU-accelerated transition. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          isBanner
            ? `New update available — version ${ota.remoteVersion ?? ''} — tap for details`
            : 'Update available'
        }
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 14px)',
          // Anchor the RIGHT edge: 50% of viewport while centered,
          // 14px from corner once minimized. Both values are length
          // units so the browser can interpolate smoothly between them.
          right: isBanner ? '50%' : '14px',
          zIndex: 60,
          // Width/height morph. Width contracts; the right edge stays
          // pinned to wherever `right` currently points.
          width: isBanner ? 'min(360px, calc(100vw - 28px))' : 38,
          height: isBanner ? 52 : 38,
          padding: isBanner ? '0 12px 0 14px' : 0,
          borderRadius: isBanner ? 16 : 999,
          // Layout
          display: 'flex',
          alignItems: 'center',
          gap: isBanner ? 10 : 0,
          justifyContent: isBanner ? 'flex-start' : 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          // Visuals
          background: `linear-gradient(135deg, ${accentFrom}38, ${accentTo}38)`,
          border: `1px solid ${accentTo}66`,
          color: 'var(--c-text-primary)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: isBanner
            ? `0 16px 40px ${accentTo}40, inset 0 0 0 1px ${accentTo}22`
            : `0 4px 14px ${accentTo}30`,
          // Text
          fontFamily: 'Manrope, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.005em',
          textAlign: 'left',
          cursor: 'pointer',
          // Entrance fades + drops from above; morph slides the
          // right-edge anchor (translateX 50% → 0) from screen-center
          // to top-right. Both transforms are combined so a single
          // `transform` transition drives the whole motion.
          opacity: entered ? 1 : 0,
          transform: [
            isBanner ? 'translateX(50%)' : 'translateX(0)',
            entered ? 'translateY(0)' : 'translateY(-16px)',
          ].join(' '),
          // Slightly longer + more pronounced overshoot for the morph
          // so the "rectangle → circle that tucks into the corner"
          // motion reads as deliberate and luxurious, not snappy.
          transition: [
            'right 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'width 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'height 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'padding 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'border-radius 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'gap 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            'background 620ms ease',
            'box-shadow 620ms ease',
            'opacity 380ms ease',
            'transform 620ms cubic-bezier(0.34, 1.12, 0.64, 1)',
          ].join(', '),
          animation: isBanner ? undefined : 'pill-pulse 2.6s ease-in-out infinite',
          // willChange hints to the compositor so the morph stays on
          // the GPU even on lower-end Androids — without it some
          // devices fall back to layout-driven animation and stutter.
          willChange: 'right, width, height, transform, border-radius',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 18,
            // Banner phase: tinted with accent (matches the gradient).
            // Pill phase: theme-aware foreground (white on dark themes,
            // black on light themes) so the icon always reads cleanly
            // against any per-app accent.
            color: isBanner ? accentTo : 'var(--c-text-primary)',
            flexShrink: 0,
            transition: 'transform 520ms cubic-bezier(0.34, 1.15, 0.64, 1), color 380ms ease',
          }}
        >
          download
        </span>

        {/* Text label — fades + slides out as the element morphs to a circle.
            Shows the version number so the user knows exactly what they're
            being offered before they tap through to the modal. */}
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

        {/* Minimize affordance — only meaningful in banner phase. We
            keep the element mounted but collapse it so the morph
            doesn't have to add/remove a child mid-transition. */}
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
          changelog={ota.changelog}
          mandatory={ota.mandatory}
          downloadUrl={ota.downloadUrl}
          accentFrom={accentFrom}
          accentTo={accentTo}
          onLater={() => {
            // "Later" = stop nagging me about THIS version. Persist
            // the dismissal and unmount the indicator. A future
            // higher remote version will resurface it.
            setOpen(false);
            dismissForever();
          }}
          onClose={() => {
            // Backdrop / programmatic close (no explicit dismissal).
            // Collapse the banner to the pill if needed but keep the
            // pill visible so the user can come back to it.
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
          0%, 100% { box-shadow: 0 4px 14px ${accentTo}30; }
          50%      { box-shadow: 0 4px 14px ${accentTo}30, 0 0 0 6px ${accentTo}1f; }
        }
      `}</style>
    </>
  );
}

function UpdateModal({
  fromLabel,
  toVersion,
  changelog,
  mandatory,
  downloadUrl,
  accentFrom,
  accentTo,
  onClose,
  onLater,
}: {
  fromLabel: string;
  toVersion: string;
  changelog: string | null;
  mandatory: boolean;
  downloadUrl: string | null;
  accentFrom: string;
  accentTo: string;
  /** Backdrop / soft-close. Pill stays visible. */
  onClose: () => void;
  /** Explicit "Later" button. Persists per-version dismissal. */
  onLater: () => void;
}) {
  // Reload-button state machine: idle → downloading (with %) → done/failed.
  // On native we drive Capgo's download() and surface progress; on web we
  // fall through to the legacy service-worker reload immediately.
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const canCapgoUpdate = isNative() && !!downloadUrl && toVersion !== '—';

  const handleReload = async () => {
    // Re-entrancy guard — between the fast double-tap and React
    // committing `disabled={downloading}` there is a frame where a
    // second click can still slip through. Refuse it explicitly.
    if (downloading) return;
    setErrMsg(null);
    if (canCapgoUpdate) {
      setDownloading(true);
      setProgress(0);
      const res = await applyUpdate({
        url: downloadUrl!,
        version: toVersion,
        onProgress: (p) => setProgress(p),
      });
      // On success, Capgo will reload the WebView itself, so we never
      // get here. If we DO get here, something went wrong.
      setDownloading(false);
      if (!res.ok) {
        setErrMsg(res.error ?? 'Update failed');
        return;
      }
      // Belt-and-braces — Capgo should have reloaded already.
      onClose();
      return;
    }
    // On NATIVE without a downloadUrl, "reloading" would just rerun
    // the same bundled JS — surface that explicitly instead of
    // pretending an update happened.
    if (isNative()) {
      setErrMsg(
        "Update available but the server didn't publish a download link. Try again later.",
      );
      return;
    }
    // Web fallback: clear caches + reload, the existing flow.
    onClose();
    try {
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    setTimeout(() => window.location.reload(), 120);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => {
        // Refuse backdrop dismissal mid-download — losing the modal
        // would orphan the in-flight request and leave the user with
        // no progress indicator or error surface.
        if (downloading) return;
        onClose();
      }}
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
          padding: 24,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          animation: 'rise-in 240ms cubic-bezier(0.34,1.15,0.64,1) both',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 24, color: 'white' }}
          >
            download
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: 'var(--c-text-primary)',
            fontFamily: 'Manrope',
            letterSpacing: '-0.02em',
          }}
        >
          Update available
        </p>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 13,
            color: 'var(--c-text-secondary)',
            fontFamily: 'Inter',
            lineHeight: 1.5,
          }}
        >
          Version {toVersion} is ready. You're on {fromLabel}.
        </p>

        {changelog && (
          <div
            style={{
              marginTop: 18,
              padding: 14,
              background: 'rgba(128,128,128,0.08)',
              borderRadius: 12,
              fontSize: 12,
              color: 'var(--c-text-secondary)',
              fontFamily: 'Inter',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {changelog}
          </div>
        )}

        {mandatory && (
          <p
            style={{
              margin: '14px 0 0',
              fontSize: 11,
              color: '#f59e0b',
              fontFamily: 'Inter',
              fontWeight: 600,
            }}
          >
            This update is required.
          </p>
        )}

        {/* Download progress bar — only visible while a Capgo download
            is in flight. Sits between the changelog and the buttons so
            the user sees forward motion without any layout jump. */}
        {downloading && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: 'rgba(128,128,128,0.18)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
                  transition: 'width 220ms ease',
                }}
              />
            </div>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 11,
                color: 'var(--c-text-muted)',
                fontFamily: 'Inter',
                textAlign: 'center',
              }}
            >
              Downloading update… {Math.round(progress * 100)}%
            </p>
          </div>
        )}

        {errMsg && !downloading && (
          <p
            style={{
              margin: '14px 0 0',
              fontSize: 11,
              color: '#f87171',
              fontFamily: 'Inter',
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            {errMsg}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          <button
            type="button"
            onClick={onLater}
            disabled={downloading}
            style={{
              flex: 1,
              padding: '11px 14px',
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(128,128,128,0.25)',
              color: 'var(--c-text-secondary)',
              fontFamily: 'Manrope',
              fontWeight: 700,
              fontSize: 13,
              cursor: downloading ? 'not-allowed' : 'pointer',
              opacity: downloading ? 0.5 : 1,
            }}
          >
            Later
          </button>
          <button
            type="button"
            onClick={handleReload}
            disabled={downloading}
            style={{
              flex: 1,
              padding: '11px 14px',
              borderRadius: 12,
              background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})`,
              border: 'none',
              color: 'white',
              fontFamily: 'Manrope',
              fontWeight: 800,
              fontSize: 13,
              cursor: downloading ? 'wait' : 'pointer',
              boxShadow: `0 6px 18px ${accentTo}44`,
              opacity: downloading ? 0.85 : 1,
            }}
          >
            {downloading ? 'Updating…' : 'Update'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rise-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}

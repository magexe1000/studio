/**
 * Floating "update available" indicator — top of the Hub.
 *
 * Two-phase behaviour:
 *  1. BANNER — when an update is first detected, a full-width pill
 *     drops down from the top of the screen with the message
 *     "New update available" and a minimize button. Stays for
 *     ~6 seconds (or until the user taps the minimize button), then
 *     smoothly morphs into…
 *  2. PILL — a small circular badge anchored to the top-right with
 *     just a download icon, gently pulsing. It stays there until the
 *     user actually applies the update (Reload). Tapping it re-opens
 *     the update modal.
 *
 * The banner-shown flag is stored in sessionStorage so the user only
 * sees the full banner once per session — subsequent navigations
 * within the same session render the pill directly. A hard reload
 * (or the next day's session) plays the banner again.
 *
 * The morph between banner and pill uses a single element with CSS
 * transitions on width/height/border-radius/etc., so the motion is
 * GPU-accelerated and butter-smooth.
 *
 * Lives inside StudioHub. Sub-apps deliberately don't show this —
 * when the user is inside Drumex / etc. they're focused on a task
 * and shouldn't be interrupted.
 */

import { useState, useEffect } from 'react';
import { useOtaUpdate } from '../lib/otaUpdate';
import { APP_VERSION_LABEL } from '../lib/appVersion';

/** How long the full banner stays visible before auto-minimizing. */
const BANNER_AUTO_MINIMIZE_MS = 6000;

/** Session flag so the banner shows at most once per page session. */
const BANNER_SHOWN_KEY = 'studio:updateBannerShown';

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

  const minimize = () => {
    setPhase('pill');
    markBannerShown();
  };

  const isBanner = phase === 'banner';

  return (
    <>
      {/* Single morphing element: banner ↔ pill. The right edge stays
          anchored so the contraction reads as "rolling up into the
          top-right corner". */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isBanner ? 'New update available — tap for details' : 'Update available'}
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 14px)',
          right: 14,
          zIndex: 60,
          // Width/height morph — width contracts toward the right edge.
          width: isBanner ? 'min(360px, calc(100% - 28px))' : 38,
          height: isBanner ? 48 : 38,
          padding: isBanner ? '0 12px 0 14px' : 0,
          borderRadius: isBanner ? 14 : 999,
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
            ? `0 10px 32px ${accentTo}33, inset 0 0 0 1px ${accentTo}22`
            : `0 4px 14px ${accentTo}30`,
          // Text
          fontFamily: 'Manrope, sans-serif',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '-0.005em',
          textAlign: 'left',
          cursor: 'pointer',
          // Entrance + morph motion. The cubic-bezier is a soft
          // overshoot, the duration is tuned so the morph feels
          // weighted but not sluggish.
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateY(0)' : 'translateY(-16px)',
          transition: [
            'width 520ms cubic-bezier(0.34, 1.15, 0.64, 1)',
            'height 520ms cubic-bezier(0.34, 1.15, 0.64, 1)',
            'padding 520ms cubic-bezier(0.34, 1.15, 0.64, 1)',
            'border-radius 520ms cubic-bezier(0.34, 1.15, 0.64, 1)',
            'gap 520ms cubic-bezier(0.34, 1.15, 0.64, 1)',
            'background 520ms ease',
            'box-shadow 520ms ease',
            'opacity 380ms ease',
            'transform 460ms cubic-bezier(0.34, 1.18, 0.64, 1)',
          ].join(', '),
          animation: isBanner ? undefined : 'pill-pulse 2.6s ease-in-out infinite',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 18,
            color: accentTo,
            flexShrink: 0,
            transition: 'transform 520ms cubic-bezier(0.34, 1.15, 0.64, 1)',
          }}
        >
          download
        </span>

        {/* Text label — fades + slides out as the element morphs to a circle */}
        <span
          style={{
            flex: 1,
            opacity: isBanner ? 1 : 0,
            transform: isBanner ? 'translateX(0)' : 'translateX(-8px)',
            transition: isBanner
              ? 'opacity 280ms 140ms ease, transform 280ms 140ms ease'
              : 'opacity 200ms ease, transform 200ms ease',
            pointerEvents: isBanner ? 'auto' : 'none',
          }}
        >
          New update available
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
          accentFrom={accentFrom}
          accentTo={accentTo}
          onClose={() => {
            setOpen(false);
            // If the user opened the modal directly from the banner,
            // collapse to the pill on close — they've seen the message.
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
  accentFrom,
  accentTo,
  onClose,
}: {
  fromLabel: string;
  toVersion: string;
  changelog: string | null;
  mandatory: boolean;
  accentFrom: string;
  accentTo: string;
  onClose: () => void;
}) {
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

        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          <button
            type="button"
            onClick={onClose}
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
              cursor: 'pointer',
            }}
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              // Reload triggers the service worker / browser to pull
              // the new bundle. Belt-and-braces: clear caches first if
              // the API is available so a stale shell can't pin us
              // to the old version.
              try {
                if ('caches' in window) {
                  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
                }
              } catch {
                /* ignore */
              }
              setTimeout(() => window.location.reload(), 120);
            }}
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
              cursor: 'pointer',
              boxShadow: `0 6px 18px ${accentTo}44`,
            }}
          >
            Reload
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

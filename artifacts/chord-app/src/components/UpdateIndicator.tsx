/**
 * Tiny floating "update available" pill — top-right corner of the Hub.
 *
 * Behaviour:
 *  - Hidden when no update is available (no DOM at all — zero cost).
 *  - Visible as a minimal badge with a download arrow + "Update".
 *  - Tapping it opens a modal showing the remote version + changelog.
 *
 * Lives inside StudioHub (the "Studio" surface, per the spec). Sub-apps
 * deliberately don't show this — when the user is inside Drumex / etc.
 * they're focused on a task and shouldn't be interrupted.
 */

import { useState } from 'react';
import { useOtaUpdate } from '../lib/otaUpdate';
import { APP_VERSION_LABEL } from '../lib/appVersion';

export default function UpdateIndicator({
  accentFrom,
  accentTo,
}: {
  accentFrom: string;
  accentTo: string;
}) {
  const ota = useOtaUpdate();
  const [open, setOpen] = useState(false);

  if (ota.loading || !ota.updateAvailable) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Update available"
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 14px)',
          right: 16,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px 6px 8px',
          borderRadius: 999,
          background: `linear-gradient(135deg, ${accentFrom}33, ${accentTo}33)`,
          border: `1px solid ${accentTo}55`,
          color: 'var(--c-text-primary)',
          fontFamily: 'Manrope, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.02em',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          animation: 'pulse-soft 2.4s ease-in-out infinite',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 14, color: accentTo }}
        >
          download
        </span>
        Update
      </button>

      {open && (
        <UpdateModal
          fromLabel={APP_VERSION_LABEL}
          toVersion={ota.remoteVersion ?? '—'}
          changelog={ota.changelog}
          mandatory={ota.mandatory}
          accentFrom={accentFrom}
          accentTo={accentTo}
          onClose={() => setOpen(false)}
        />
      )}

      <style>{`
        @keyframes pulse-soft {
          0%, 100% { box-shadow: 0 0 0 0 ${accentTo}00; }
          50%      { box-shadow: 0 0 0 6px ${accentTo}1a; }
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

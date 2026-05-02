/**
 * Post-update flow:
 *   1. The lightweight "You just updated" toast (UpdatedToast) shows
 *      ONLY the version number — no changelog body. It auto-dismisses.
 *   2. Tapping "View changes" on the toast (or opening it from
 *      Settings) reveals the full changelog as a Metrolist-style
 *      bottom sheet.
 *
 * State is tracked in localStorage by `lib/otaUpdate` (`usePostUpdateChangelog`)
 * so the toast doesn't re-appear unless the bundle advances again.
 *
 * Mounted at the App root so it overlays whichever sub-app the user
 * is on at launch. It's a polite, fully dismissable overlay — it
 * never blocks back-nav or input.
 */

import { useState } from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { usePostUpdateChangelog } from '../lib/otaUpdate';
import { APP_VERSION_LABEL } from '../lib/appVersion';
import { useT } from '../lib/useT';
import ChangelogSheet from './ChangelogSheet';

export default function ChangelogModal() {
  const { show, fromVersion, toVersion, dismiss } = usePostUpdateChangelog();
  const { settings } = useChordStore();
  const t = useT();
  const accentKey = settings.perApp?.hub?.accentColor ?? settings.accentColor ?? 'blue';
  const accent = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;

  const [sheetOpen, setSheetOpen] = useState(false);

  if (!show && !sheetOpen) return null;

  const closeToastAndSheet = () => { setSheetOpen(false); dismiss(); };

  return (
    <>
      {show && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={dismiss}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'cl-fade-in 220ms ease-out both',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 360,
              width: '100%',
              background: 'var(--app-surface)',
              borderRadius: 22,
              padding: 24,
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              animation: 'cl-rise-in 300ms cubic-bezier(0.34,1.15,0.64,1) both',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52, height: 52,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26, color: 'white' }}>
                check
              </span>
            </div>

            <p style={{
              margin: 0, fontSize: 20, fontWeight: 800,
              color: 'var(--c-text-primary)', fontFamily: 'Manrope',
              letterSpacing: '-0.02em',
            }}>
              {t.hub.justUpdatedTitle ?? 'Updated'}
            </p>
            <p style={{
              margin: '8px 0 0', fontSize: 13,
              color: 'var(--c-text-secondary)',
              fontFamily: 'Inter', lineHeight: 1.5,
            }}>
              {fromVersion ? (
                <>{(t.hub.justUpdatedFromTo ?? 'Now on {to}, from {from}.')
                  .replace('{from}', fromVersion)
                  .replace('{to}', APP_VERSION_LABEL)}</>
              ) : (
                <>{(t.hub.justUpdatedNowOn ?? 'Now on {to} ({version}).')
                  .replace('{to}', APP_VERSION_LABEL)
                  .replace('{version}', toVersion)}</>
              )}
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
              <button
                type="button"
                onClick={dismiss}
                style={{
                  flex: 1, padding: '11px 14px', borderRadius: 12,
                  background: 'transparent',
                  border: '1px solid rgba(128,128,128,0.25)',
                  color: 'var(--c-text-secondary)',
                  fontFamily: 'Manrope', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer',
                }}
              >{t.hub.gotIt ?? 'Got it'}</button>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                style={{
                  flex: 1, padding: '11px 14px', borderRadius: 12,
                  background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  border: 'none', color: 'white',
                  fontFamily: 'Manrope', fontWeight: 800, fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: `0 6px 18px ${accent.to}44`,
                }}
              >{t.hub.viewChanges ?? 'View changes'}</button>
            </div>
          </div>

          <style>{`
            @keyframes cl-fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes cl-rise-in {
              from { opacity: 0; transform: translateY(12px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0)    scale(1); }
            }
          `}</style>
        </div>
      )}

      <ChangelogSheet
        open={sheetOpen}
        onClose={closeToastAndSheet}
      />
    </>
  );
}

/**
 * Post-update changelog modal — shown ONCE, on the first launch after
 * the user receives a new bundle. State is tracked in localStorage by
 * `lib/otaUpdate` so the modal doesn't re-appear unless the bundle
 * advances again.
 *
 * Mounted at the App root so it overlays whichever sub-app the user
 * is on at launch (Hub, Chordex, Drumex, ...). It's a polite, fully
 * dismissable overlay — it never blocks back-nav or input.
 */

import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { usePostUpdateChangelog } from '../lib/otaUpdate';
import { APP_VERSION_LABEL, APP_CHANGELOG } from '../lib/appVersion';

export default function ChangelogModal() {
  const { show, fromVersion, toVersion, dismiss } = usePostUpdateChangelog();
  const { settings } = useChordStore();
  const accentKey = settings.perApp?.hub?.accentColor ?? settings.accentColor ?? 'blue';
  const accent = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'cl-fade-in 240ms ease-out both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 400,
          width: '100%',
          background: 'var(--app-surface)',
          borderRadius: 24,
          padding: 26,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 28px 70px rgba(0,0,0,0.55)',
          animation: 'cl-rise-in 320ms cubic-bezier(0.34,1.15,0.64,1) both',
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 26, color: 'white' }}
          >
            celebration
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--c-text-primary)',
            fontFamily: 'Manrope',
            letterSpacing: '-0.02em',
          }}
        >
          You're up to date
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
          {fromVersion ? (
            <>
              Updated from {fromVersion} to <strong style={{ color: 'var(--c-text-primary)' }}>{APP_VERSION_LABEL}</strong>.
            </>
          ) : (
            <>
              Now on <strong style={{ color: 'var(--c-text-primary)' }}>{APP_VERSION_LABEL}</strong> ({toVersion}).
            </>
          )}
        </p>

        {APP_CHANGELOG.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '20px 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {APP_CHANGELOG.map((line, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  fontSize: 13,
                  color: 'var(--c-text-secondary)',
                  fontFamily: 'Inter',
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                    marginTop: 7,
                  }}
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={dismiss}
          style={{
            width: '100%',
            marginTop: 24,
            padding: '12px 14px',
            borderRadius: 14,
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            border: 'none',
            color: 'white',
            fontFamily: 'Manrope',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: `0 8px 22px ${accent.to}44`,
          }}
        >
          Got it
        </button>
      </div>

      <style>{`
        @keyframes cl-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cl-rise-in {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}

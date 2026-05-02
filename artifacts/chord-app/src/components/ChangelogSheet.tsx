/**
 * ChangelogSheet — Metrolist-style bottom sheet that lists the release
 * notes for a single version.
 *
 * Behaviour:
 *   • Slides up from the bottom of the viewport with a soft overshoot.
 *   • The user can swipe DOWN on the sheet to dismiss it. We follow
 *     the finger 1-for-1, then either snap closed (if the drag
 *     exceeded ~110 px or the release velocity is high) or spring
 *     back to rest. Tapping the dimmed backdrop also closes it.
 *   • Render-once portal: appears at body root so the sheet stacks
 *     above any sub-app's own scroll containers.
 *
 * Used by:
 *   • ChangelogModal — auto-opens the first launch after an OTA update.
 *   • Settings → About → Changelog row — opens on demand.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import {
  APP_VERSION,
  APP_VERSION_DATE,
  APP_CHANGELOG_SECTIONS,
  type ChangelogSection,
} from '../lib/appVersion';
import { useT } from '../lib/useT';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Version to label the entry with. Defaults to APP_VERSION. */
  version?: string;
  /** ISO date for the entry. Defaults to APP_VERSION_DATE. */
  date?: string;
  /** Sections to render. Defaults to the current bundle's changelog. */
  sections?: ChangelogSection[];
};

const SWIPE_DISMISS_PX = 110;
const SWIPE_DISMISS_VELOCITY = 0.55; // px/ms

export default function ChangelogSheet({
  open,
  onClose,
  version = APP_VERSION,
  date = APP_VERSION_DATE,
  sections = APP_CHANGELOG_SECTIONS,
}: Props) {
  const t = useT();
  const { settings } = useChordStore();
  const accentKey = settings.perApp?.hub?.accentColor ?? settings.accentColor ?? 'blue';
  const accent = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartT = useRef<number>(0);
  const dragOffset = useRef<number>(0);

  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);

  // Mount/unmount pipeline so the close animation gets to play before
  // the portal disappears. `open` -> mount + slide-in. `!open` -> mark
  // closing, wait one anim cycle, unmount.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setDrag(0);
      return;
    }
    if (mounted) {
      setClosing(true);
      const id = window.setTimeout(() => {
        setMounted(false);
        setClosing(false);
        setDrag(0);
      }, 300);
      return () => window.clearTimeout(id);
    }
    return;
  }, [open, mounted]);

  // Lock background scroll while the sheet is up.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  if (!mounted) return null;

  const beginDrag = (clientY: number) => {
    // Only allow swipe-to-dismiss when the inner scroller is at the top.
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
    dragStartY.current = clientY;
    dragStartT.current = performance.now();
    dragOffset.current = 0;
  };
  const moveDrag = (clientY: number) => {
    if (dragStartY.current === null) return;
    const delta = Math.max(0, clientY - dragStartY.current);
    dragOffset.current = delta;
    setDrag(delta);
  };
  const endDrag = () => {
    if (dragStartY.current === null) return;
    const dt = Math.max(1, performance.now() - dragStartT.current);
    const v = dragOffset.current / dt; // px/ms
    dragStartY.current = null;
    if (dragOffset.current > SWIPE_DISMISS_PX || v > SWIPE_DISMISS_VELOCITY) {
      onClose();
    } else {
      setDrag(0);
    }
  };

  const overlayOpacity = closing
    ? 0
    : Math.max(0, 1 - drag / 380);

  const sheetTransform = closing
    ? 'translateY(100%)'
    : drag > 0
      ? `translateY(${drag}px)`
      : 'translateY(0)';

  const sheetTransition = drag > 0
    ? 'none'
    : 'transform 320ms cubic-bezier(0.34, 1.32, 0.64, 1)';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.hub.changelogTitle ?? 'Changelog'}
      style={{
        position: 'fixed', inset: 0, zIndex: 9700,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          opacity: overlayOpacity,
          transition: 'opacity 280ms ease',
        }}
      />

      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => beginDrag(e.touches[0].clientY)}
        onTouchMove={(e) => moveDrag(e.touches[0].clientY)}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
        onMouseDown={(e) => { if (e.button === 0) beginDrag(e.clientY); }}
        onMouseMove={(e) => { if (dragStartY.current !== null) moveDrag(e.clientY); }}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          maxHeight: '88vh',
          background: 'var(--app-surface)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: sheetTransform,
          transition: sheetTransition,
          animation: closing
            ? undefined
            : drag > 0 ? undefined : 'cl-sheet-up 360ms cubic-bezier(0.34, 1.32, 0.64, 1) both',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          touchAction: 'pan-y',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', flexShrink: 0 }}>
          <div style={{
            width: 44, height: 4, borderRadius: 999,
            background: 'rgba(180,180,180,0.45)',
          }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '14px 24px 10px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0,
            fontFamily: 'Manrope', fontWeight: 800,
            fontSize: 32, letterSpacing: '-0.02em',
            color: 'var(--c-text-primary)',
          }}>
            {t.hub.changelogTitle ?? 'Changelog'}
          </h2>
          <Squiggle color={accent.from} />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', marginTop: 6,
          }}>
            <span style={{
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 12,
              padding: '5px 10px', borderRadius: 999,
              background: `${accent.from}26`,
              color: accent.from,
              letterSpacing: '0.01em',
            }}>v{version}</span>
            <span style={{
              fontFamily: 'Inter', fontSize: 12,
              color: 'var(--c-text-muted)',
            }}>{date}</span>
          </div>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px 16px 12px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {sections.map((sec, i) => (
            <section key={i} style={{
              background: 'rgba(128,128,128,0.07)',
              border: '1px solid rgba(128,128,128,0.12)',
              borderRadius: 18,
              padding: '18px 18px 14px',
              marginBottom: 12,
            }}>
              <h3 style={{
                margin: '0 0 12px',
                textAlign: 'center',
                fontFamily: 'Manrope', fontWeight: 800, fontSize: 18,
                color: 'var(--c-text-primary)',
                letterSpacing: '-0.01em',
              }}>{sec.heading}</h3>
              <ul style={{
                listStyle: 'none', padding: 0, margin: 0,
                display: 'flex', flexDirection: 'column',
              }}>
                {sec.items.map((line, j) => (
                  <li key={j} style={{
                    display: 'flex', gap: 10,
                    padding: '10px 0',
                    borderTop: j === 0 ? 'none' : '1px solid rgba(128,128,128,0.10)',
                    fontFamily: 'Inter', fontSize: 14, lineHeight: 1.5,
                    color: 'var(--c-text-secondary)',
                  }}>
                    <span style={{
                      flexShrink: 0,
                      width: 5, height: 5, borderRadius: '50%',
                      marginTop: 9,
                      background: accent.from,
                    }} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes cl-sheet-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

function Squiggle({ color }: { color: string }) {
  // A short repeating wavy line, tinted with the current accent.
  return (
    <svg
      width="180" height="14" viewBox="0 0 180 14"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      <path
        d="M0 7 Q 7.5 0, 15 7 T 30 7 T 45 7 T 60 7 T 75 7 T 90 7 T 105 7 T 120 7 T 135 7 T 150 7 T 165 7 T 180 7"
        fill="none"
        stroke={color}
        strokeOpacity="0.55"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

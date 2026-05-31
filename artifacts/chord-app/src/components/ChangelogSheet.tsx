/**
 * ChangelogSheet — bottom sheet that lists release notes for one version.
 *
 * Studio's own minimalist take (deliberately not a Metrolist clone):
 *   • Slim drag handle, no decorative squiggle, no chunky cards.
 *   • Header is a single tight line: version pill on the left, date on
 *     the right, nothing else competing for attention.
 *   • Sections are flush text blocks separated by hairlines, with the
 *     section title as a small all-caps label and bullets as soft dots.
 *   • The accent colour appears only as a tiny dot on each bullet and
 *     a subtle tint on the version pill — nothing screams.
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
  getChangelogSections,
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
  sections,
}: Props) {
  const t = useT();
  const { settings } = useChordStore();
  const accentKey = settings.perApp?.hub?.accentColor ?? settings.accentColor ?? 'blue';
  const accent = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;
  // v3.0.55 — pick localized changelog when caller didn't override it.
  const renderSections: ChangelogSection[] = sections ?? getChangelogSections(settings.language ?? 'en');
  void APP_CHANGELOG_SECTIONS; // keep import compatibility for any consumer relying on the re-export shape

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

  const overlayOpacity = closing ? 0 : Math.max(0, 1 - drag / 380);

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
          background: 'rgba(0,0,0,0.55)',
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
          maxHeight: '86vh',
          background: 'var(--app-surface)',
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -16px 48px rgba(0,0,0,0.45)',
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
        {/* Drag handle — smaller and quieter than the Metrolist one. */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 6px', flexShrink: 0 }}>
          <div style={{
            width: 36, height: 3.5, borderRadius: 999,
            background: 'rgba(160,160,160,0.35)',
          }} />
        </div>

        {/* Header — one tight line. Version pill anchored left, date
            anchored right. No squiggle, no big title block. */}
        <div style={{
          padding: '10px 22px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              fontFamily: 'Manrope', fontWeight: 800, fontSize: 22,
              letterSpacing: '-0.02em',
              color: 'var(--c-text-primary)',
            }}>
              v{version}
            </span>
            <span style={{
              fontFamily: 'Inter', fontSize: 11, fontWeight: 600,
              padding: '3px 8px', borderRadius: 999,
              background: `${accent.from}22`,
              color: accent.from,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}>
              {t.hub.changelogTitle ?? 'Changelog'}
            </span>
          </div>
          <span style={{
            fontFamily: 'Inter', fontSize: 12,
            color: 'var(--c-text-muted)',
          }}>{date}</span>
        </div>

        {/* Hairline separating header from body. */}
        <div style={{
          height: 1,
          background: 'rgba(128,128,128,0.16)',
          flexShrink: 0,
        }} />

        {/* Scrollable content — flush text blocks, no boxed cards. */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 22px 16px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {renderSections.map((sec, i) => (
            <section key={i} style={{
              marginBottom: i === renderSections.length - 1 ? 0 : 22,
            }}>
              <h3 style={{
                margin: '0 0 10px',
                fontFamily: 'Manrope', fontWeight: 700, fontSize: 11,
                color: 'var(--c-text-muted)',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
              }}>
                {sec.heading}
              </h3>
              <ul style={{
                listStyle: 'none', padding: 0, margin: 0,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                {sec.items.map((line, j) => (
                  <li key={j} style={{
                    display: 'flex', gap: 12,
                    fontFamily: 'Inter', fontSize: 14, lineHeight: 1.55,
                    color: 'var(--c-text-secondary)',
                  }}>
                    <span style={{
                      flexShrink: 0,
                      width: 4, height: 4, borderRadius: '50%',
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

      {/* Gradient border ring — 1 px animated conic border on the sheet */}
      <div className="gb-border-ring" aria-hidden="true" style={{ borderRadius: '22px 22px 0 0' }} />

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

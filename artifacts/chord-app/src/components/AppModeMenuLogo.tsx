/**
 * AppModeMenuLogo — app switcher pill in every panel header.
 *
 * Visual model:
 *   Closed → [logo  Chordex  ▾]                       (compact pill)
 *   Open   →             [⮕ Chordex · Drumex · Stagex … ⮐]
 *                          ↑
 *                          └ floating glass pill of "chip" buttons,
 *                            screen-centered horizontally, vertically
 *                            aligned to where the trigger sits.
 *
 *   On open the trigger's logo, label AND chevron all collapse away
 *   (max-width + opacity → 0). The trigger fully disappears so the
 *   centered chip pill becomes the only focal element. Outside-tap
 *   or Esc closes.
 *
 * Why screen-centered (instead of "right of trigger" like before):
 *   The user wanted the trigger logo to vanish on open. With the
 *   trigger gone, anchoring the pill to the trigger's left edge
 *   leaves it offset to one side and visually unbalanced. Centering
 *   on the viewport gives the pill the "popover floats into the
 *   middle of the screen" feel iOS uses for similar switchers.
 *
 * Animations:
 *   - Open uses a spring/overshoot easing (`cubic-bezier(0.34,1.56,
 *     0.64,1)`) for a bouncy "snap" into place.
 *   - Close uses a flat ease-in so dismiss feels intentional.
 *   - Chips fade + translate in with a tiny stagger after the pill
 *     finishes growing, so they read as content arriving rather
 *     than rubber-banding with the container.
 *
 * Edge handling:
 *   - The chip pill's max width is `min(420 px, viewport − 32 px)`
 *     so it never touches the side wall, even on narrow phones.
 *     If chips would still overflow, the inner row scrolls instead
 *     of clipping.
 */

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChordexLogo, DrumexLogo, StudioLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

type AppValue = 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex';

export function AppModeMenuLogo({ color, size = 14 }: { color?: string; size?: number }) {
  const { settings, updateSettings } = useChordStore();
  const [open, setOpen] = useState(false);
  // Vertical anchor for the centered pill — measured from the trigger
  // every time we open. We don't track horizontal because the pill
  // is centered on the viewport.
  const [anchorY, setAnchorY] = useState<number>(0);
  const [maxPillWidth, setMaxPillWidth] = useState(360);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);

  // ── Theme-aware colors ────────────────────────────────────────────
  const appKey = settings.appMode ?? 'chords';
  const activeVis = settings.perApp?.[appKey as keyof typeof settings.perApp] ?? {
    theme:       settings.theme       ?? 'dark',
    accentColor: settings.accentColor ?? 'blue',
    amoledMode:  settings.amoledMode  ?? false,
  };
  const isLight = (activeVis as { theme: string }).theme === 'light' ||
    ((activeVis as { theme: string }).theme === 'system' && typeof window !== 'undefined' &&
     window.matchMedia('(prefers-color-scheme: light)').matches);
  const resolvedColor = color ?? (isLight ? '#18181b' : '#d4d4d8');

  const accentKey = ((activeVis as { accentColor?: string }).accentColor ?? settings.accentColor ?? 'blue') as keyof typeof ACCENT_COLORS;
  const accent = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;

  const borderColor = isLight ? 'rgba(0,0,0,0.08)'  : 'rgba(255,255,255,0.08)';
  const bgColor     = isLight ? 'rgba(252,252,253,0.98)' : 'rgba(18,18,22,0.96)';
  const idleChipBg  = isLight ? 'rgba(0,0,0,0.04)'  : 'rgba(255,255,255,0.05)';
  const idleChipFg  = isLight ? 'rgba(0,0,0,0.62)'  : 'rgba(225,225,230,0.85)';
  const chipBorder  = isLight ? 'rgba(0,0,0,0.06)'  : 'rgba(255,255,255,0.06)';

  // ── Outside click / Esc dismiss ───────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      // The pill is rendered outside `wrapRef` (position:fixed, body-
      // level visually), but it's still a descendant in the DOM tree
      // — so contains() correctly excludes both the trigger and the
      // pill from "outside" taps.
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ── Measure vertical anchor + viewport-safe max width on open ─────
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const t = triggerRef.current;
      if (!t) return;
      const rect = t.getBoundingClientRect();
      setAnchorY(rect.top + rect.height / 2);
      // Centered pill is bounded by viewport with 16 px of breathing
      // room on each side. Cap at 420 px so it doesn't stretch to
      // absurd widths on tablets — chips read better in a compact row.
      const room = window.innerWidth - 32;
      setMaxPillWidth(Math.max(180, Math.min(420, room)));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    // The trigger sits inside scrollable panels — keep the anchor
    // following the trigger if the user scrolls while the menu is up
    // (rare but happens when keyboard pushes layout).
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('scroll', update);
    };
  }, [open]);

  // ── On open, scroll the active chip into view (centered) ──────────
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>('[data-active="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 240);
    return () => clearTimeout(t);
  }, [open]);

  const currentMode = (settings.appMode ?? 'chords') as AppValue | 'hub';

  const OPTIONS: { value: AppValue; Icon: React.FC<{ size?: number }>; label: string }[] = [
    { value: 'chords',  Icon: ChordexLogo,    label: 'Chordex' },
    { value: 'drums',   Icon: DrumexLogo,     label: 'Drumex'  },
    { value: 'stage',   Icon: StagexLogoIcon, label: 'Stagex'  },
    { value: 'groovex', Icon: GroovexLogo,    label: 'Groovex' },
    { value: 'vocalex', Icon: VocalexLogo,    label: 'Vocalex' },
  ];

  const select = (val: AppValue) => {
    setOpen(false);
    if (val !== currentMode) updateSettings({ appMode: val });
  };
  const goToHub = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('studio-hub-return'));
  };

  // Active app label/icon for the trigger.
  const ACTIVE_LABEL: Record<string, string> = {
    chords: 'Chordex', drums: 'Drumex', stage: 'Stagex', groovex: 'Groovex', vocalex: 'Vocalex',
  };
  const activeLabel = ACTIVE_LABEL[currentMode] ?? 'Chordex';
  const ActiveIcon  =
    currentMode === 'drums'   ? DrumexLogo  :
    currentMode === 'stage'   ? StagexLogoIcon :
    currentMode === 'groovex' ? GroovexLogo :
    currentMode === 'vocalex' ? VocalexLogo :
                                ChordexLogo;

  // Easings.
  const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';   // bouncy
  const SMOOTH = 'cubic-bezier(0.4, 0, 0.2, 1)';        // calm

  // Per-chip arrival stagger so they read as content arriving.
  const chipDelay = (i: number): number => open ? 140 + i * 32 : 0;

  // All chips in render order: 5 apps + Hub at the end.
  const ALL_CHIPS: { key: string; label: string; Icon: React.FC<{ size?: number }>; onClick: () => void; isActive: boolean }[] = [
    ...OPTIONS.map(opt => ({
      key: opt.value,
      label: opt.label,
      Icon: opt.Icon,
      onClick: () => select(opt.value),
      isActive: currentMode === opt.value,
    })),
    {
      key: 'hub',
      label: 'Studio Hub',
      Icon: StudioLogo,
      onClick: goToHub,
      isActive: false,
    },
  ];

  // Shared transition for the three trigger children that collapse on open.
  // max-width + opacity together produce a clean horizontal squeeze.
  const collapseTransition = open
    ? `max-width 240ms ${SMOOTH}, opacity 160ms ${SMOOTH}, transform 220ms ${SMOOTH}`
    : `max-width 320ms ${SPRING} 80ms, opacity 220ms ${SMOOTH} 140ms, transform 320ms ${SPRING} 80ms`;

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      {/* Self-contained: hide the WebKit scrollbar inside the swipe row. */}
      <style>{`
        .app-mode-swipe::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Trigger pill (always in flow). When open, ALL three children
          (logo, label, chevron) collapse so the trigger fully vanishes
          and the centered chip pill stands alone. */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        // When open, trigger is invisible; suppress hit-testing so a
        // tap on the now-empty trigger area doesn't accidentally toggle
        // and fight with outside-tap dismiss.
        style={{
          display: 'flex', alignItems: 'center', gap: open ? 0 : 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '4px 6px 4px 0', margin: '-4px 0',
          color: resolvedColor,
          pointerEvents: open ? 'none' : 'auto',
          transition: `gap 280ms ${open ? SMOOTH : SPRING}`,
        }}
      >
        {/* Logo — collapses on open. */}
        <span style={{
          display: 'inline-flex', overflow: 'hidden',
          maxWidth: open ? 0 : size + 4,
          opacity:  open ? 0 : 1,
          transform: open ? 'scale(0.6)' : 'scale(1)',
          transition: collapseTransition,
        }}>
          <ActiveIcon size={size} />
        </span>

        {/* Label — collapses on open. */}
        <span style={{
          display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap',
          maxWidth: open ? 0 : 120,
          opacity:  open ? 0 : 1,
          transform: open ? 'translateX(-4px)' : 'translateX(0)',
          transition: collapseTransition,
          fontSize: 13, fontWeight: 700, fontFamily: 'Manrope',
          letterSpacing: '-0.02em', color: resolvedColor,
        }}>{activeLabel}</span>

        {/* Chevron — also collapses so the trigger area is fully empty
            when the pill is open. (When closed, it rotates 180° on open
            briefly during the open animation, then is hidden by the
            collapse — gives a tiny "spinning shrink" cue.) */}
        <span style={{
          display: 'inline-block', overflow: 'hidden',
          maxWidth: open ? 0 : 12,
          opacity:  open ? 0 : 0.45,
          marginLeft: open ? 0 : -2,
          fontSize: 9, color: resolvedColor,
          transform: open ? 'rotate(-180deg) scale(0.6)' : 'rotate(0deg) scale(1)',
          transition: collapseTransition,
        }}>▾</span>
      </button>

      {/* ── Floating chip pill — centered on viewport, anchored
          vertically to the (now invisible) trigger. */}
      <div
        role="menu"
        aria-hidden={!open}
        style={{
          position: 'fixed',
          top: anchorY,
          left: '50%',
          // Center the pill on its own width, then add a tiny scale
          // for the bouncy entrance.
          transform: open
            ? 'translate(-50%, -50%) scale(1)'
            : 'translate(-50%, -50%) scale(0.55)',
          transformOrigin: 'center center',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: open
            ? `transform 440ms ${SPRING}, opacity 220ms ease 60ms`
            : `transform 240ms ${SMOOTH}, opacity 180ms ease`,
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 999,
          padding: '4px 6px',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: isLight
            ? '0 12px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)'
            : '0 16px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center',
          maxWidth: maxPillWidth,
          zIndex: 9999,
          willChange: 'transform, opacity',
        }}
      >
        <div
          ref={scrollRef}
          className="app-mode-swipe"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            padding: '0 2px',
          }}
        >
          {ALL_CHIPS.map((chip, i) => {
            const activeBg = `${accent.from}1f`;
            const activeBorder = `${accent.from}55`;
            const chipColor = chip.isActive ? accent.from : idleChipFg;
            return (
              <button
                key={chip.key}
                data-active={chip.isActive}
                onClick={chip.onClick}
                aria-label={chip.label}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  flexShrink: 0, scrollSnapAlign: 'center',
                  height: 30, padding: '0 12px 0 9px', borderRadius: 999,
                  background: chip.isActive ? activeBg : idleChipBg,
                  border: `1px solid ${chip.isActive ? activeBorder : chipBorder}`,
                  color: chipColor,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.92)',
                  transition: open
                    ? `opacity 240ms ${SMOOTH} ${chipDelay(i)}ms, transform 380ms ${SPRING} ${chipDelay(i)}ms, background 180ms ${SMOOTH}, color 180ms ${SMOOTH}, border-color 180ms ${SMOOTH}`
                    : `opacity 140ms ${SMOOTH}, transform 200ms ${SMOOTH}, background 180ms ${SMOOTH}, color 180ms ${SMOOTH}`,
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, color: chipColor,
                }}>
                  <chip.Icon size={13} />
                </span>
                <span style={{
                  fontFamily: 'Manrope', fontWeight: 700, fontSize: 11.5,
                  letterSpacing: '-0.01em', color: chipColor,
                }}>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * AppModeMenuLogo — app switcher pill that lives in every panel header.
 *
 * Visual model:
 *   Closed → [logo  Chordex  ▾]                      (compact pill)
 *   Open   → [logo] [⮕ Chordex · Drumex · Stagex … ⮐]
 *               ↑      ↑
 *               │      └ floating glass pill of "chip" buttons. Each
 *               │        chip shows the app's icon AND name. The row
 *               │        is horizontally swipe-scrollable with
 *               │        scroll-snap so flicking through apps feels
 *               │        native on touch.
 *               │
 *               └ when opening, the trigger's text label collapses
 *                 away (animated max-width + opacity) so the trigger
 *                 shrinks to just the logo. This makes room for the
 *                 chip pill to slide out next to it without crowding
 *                 the header on narrow phones.
 *
 * Animations:
 *   - Open uses a spring-y overshoot (`cubic-bezier(0.34,1.56,0.64,1)`)
 *     for a "bounce into place" feel.
 *   - Close uses a calm ease-in so dismiss feels intentional, not
 *     spring-loaded.
 *   - Chips fade + translate in with a small stagger after the pill
 *     finishes growing, so they read as content arriving rather than
 *     stretching with the container.
 *
 * Edge handling:
 *   - The chip pill's max width is measured against the trigger's
 *     distance to the right edge of the viewport (with a 16 px safety
 *     gap), so it never touches the side wall. If chips would overflow,
 *     the inner row scrolls instead of clipping.
 */

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChordexLogo, DrumexLogo, StudioLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

type AppValue = 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex';

export function AppModeMenuLogo({ color, size = 14 }: { color?: string; size?: number }) {
  const { settings, updateSettings } = useChordStore();
  const [open, setOpen] = useState(false);
  const [maxPillWidth, setMaxPillWidth] = useState(320);
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

  // ── Measure room from trigger to right edge so the chip pill never
  // touches the side wall. Recomputed on open and on viewport changes.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const t = triggerRef.current;
      if (!t) return;
      const rect = t.getBoundingClientRect();
      const SAFETY_RIGHT = 16;
      const GAP_FROM_TRIGGER = 8;
      // After the label collapses the trigger shrinks; budget against
      // the icon-only width (~28 px) instead of the current rect.right.
      const triggerLeft = rect.left;
      const room = window.innerWidth - triggerLeft - 28 - SAFETY_RIGHT - GAP_FROM_TRIGGER;
      setMaxPillWidth(Math.max(160, Math.min(420, room)));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [open]);

  // ── On open, scroll the active chip into view (centered) ──────────
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>('[data-active="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 220);
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

  // Render-time helper for chip stagger (later chips arrive a bit later).
  const chipDelay = (i: number): number => open ? 120 + i * 32 : 0;

  // All chips in render order: 5 apps + Hub at the end.
  const ALL_CHIPS: { key: string; label: string; Icon: React.FC<{ size?: number }>; onClick: () => void; isActive: boolean; isHub?: boolean }[] = [
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
      isHub: true,
    },
  ];

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      {/* Self-contained: hide WebKit scrollbar inside the swipe row. */}
      <style>{`
        .app-mode-swipe::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Trigger pill (always in flow). When open, the text label
          collapses (max-width → 0, opacity → 0) so the trigger
          shrinks to just the logo, leaving room for the chip pill. */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: open ? 2 : 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '4px 6px 4px 0', margin: '-4px 0',
          color: resolvedColor,
          transition: `gap 280ms ${open ? SPRING : SMOOTH}`,
        }}
      >
        {/* Logo — gets a tiny bouncy scale when toggling. */}
        <span style={{
          display: 'inline-flex',
          transform: open ? 'scale(1.06)' : 'scale(1)',
          transition: `transform 320ms ${SPRING}`,
        }}>
          <ActiveIcon size={size} />
        </span>

        {/* Label that collapses when open. max-width animation gives
            a clean horizontal "swipe-away" of the text without any
            layout flicker. */}
        <span style={{
          display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap',
          maxWidth: open ? 0 : 100,
          opacity:  open ? 0 : 1,
          transform: open ? 'translateX(-4px)' : 'translateX(0)',
          transition: open
            ? `max-width 260ms ${SMOOTH}, opacity 160ms ${SMOOTH}, transform 220ms ${SMOOTH}`
            : `max-width 320ms ${SPRING} 80ms, opacity 220ms ${SMOOTH} 120ms, transform 320ms ${SPRING} 80ms`,
          fontSize: 13, fontWeight: 700, fontFamily: 'Manrope',
          letterSpacing: '-0.02em', color: resolvedColor,
        }}>{activeLabel}</span>

        {/* Chevron rotates 180° on open. */}
        <span style={{
          fontSize: 9, opacity: 0.45, marginLeft: -2, color: resolvedColor,
          display: 'inline-block',
          transform: open ? 'rotate(-180deg)' : 'rotate(0deg)',
          transition: `transform 320ms ${SPRING}`,
        }}>▾</span>
      </button>

      {/* ── Floating chip pill — slides out from the trigger ────────── */}
      <div
        role="menu"
        aria-hidden={!open}
        style={{
          position: 'absolute',
          top: '50%', left: '100%',
          transform: open
            ? 'translate(8px, -50%) scaleX(1)'
            : 'translate(-6px, -50%) scaleX(0.2)',
          transformOrigin: 'left center',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: open
            ? `transform 420ms ${SPRING}, opacity 220ms ease 60ms`
            : `transform 240ms ${SMOOTH}, opacity 180ms ease`,
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 999,
          padding: '4px 6px',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: isLight
            ? '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)'
            : '0 12px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)',
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
                  // Per-chip arrival animation: each chip pops in with a
                  // tiny stagger after the pill finishes its scaleX growth.
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.92)',
                  transition: open
                    ? `opacity 240ms ${SMOOTH} ${chipDelay(i)}ms, transform 360ms ${SPRING} ${chipDelay(i)}ms, background 180ms ${SMOOTH}, color 180ms ${SMOOTH}, border-color 180ms ${SMOOTH}`
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

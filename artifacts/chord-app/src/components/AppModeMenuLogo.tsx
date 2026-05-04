/**
 * AppModeMenuLogo — the trigger that lives in every panel header and
 * lets the user jump between Studio apps (Chordex, Drumex, Stagex,
 * Groovex, Vocalex) and the Studio Hub.
 *
 * Visual model: a "pill" that grows horizontally to the right. The
 * trigger always shows the current app's logo + name. Tapping it
 * reveals a second floating pill — also rounded, glassy, blurred —
 * that contains every app icon plus a Studio Hub button. The icons
 * are horizontally swipe-scrollable with `scroll-snap`, so on narrow
 * phones the user can flick through them; tap to switch.
 *
 * Why a separate floating pill (instead of expanding the trigger
 * itself):
 *   - Trigger stays in normal flex flow → header layout doesn't jump
 *     when the menu opens/closes.
 *   - The expansion is a single absolutely-positioned element that
 *     can be animated independently with transform + opacity.
 *
 * Why measure available width on every open:
 *   - The trigger's distance from the right edge changes with
 *     orientation, font size, and per-panel header layout. We cap
 *     the floating pill's max width to whatever fits with a small
 *     safety margin from the screen edge — never lets the pill
 *     touch the side wall.
 *
 * Animations: open uses a soft overshoot easing for a "snap into
 * place" feel; close uses a flatter ease-in for a calm dismiss.
 */

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChordexLogo, DrumexLogo, StudioLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

type AppValue = 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex';

export function AppModeMenuLogo({ color, size = 14 }: { color?: string; size?: number }) {
  const { settings, updateSettings } = useChordStore();
  const [open, setOpen] = useState(false);
  const [maxPillWidth, setMaxPillWidth] = useState(280);
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
  const divider     = isLight ? 'rgba(0,0,0,0.10)'  : 'rgba(255,255,255,0.10)';
  const idleIconBg  = isLight ? 'rgba(0,0,0,0.04)'  : 'rgba(255,255,255,0.05)';
  const idleIconFg  = isLight ? 'rgba(0,0,0,0.55)'  : 'rgba(220,220,225,0.78)';

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

  // ── Measure available room so the pill never touches the right wall.
  // Recomputed on open and on resize/orientation change.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const t = triggerRef.current;
      if (!t) return;
      const rect = t.getBoundingClientRect();
      const SAFETY_RIGHT = 16;            // breathing room from screen edge
      const GAP_FROM_TRIGGER = 8;         // gap between trigger and floating pill
      const room = window.innerWidth - rect.right - SAFETY_RIGHT - GAP_FROM_TRIGGER;
      setMaxPillWidth(Math.max(140, Math.min(360, room)));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [open]);

  // ── On open, scroll the active icon into view (centered) so the user
  // sees their current selection inside the swipe row.
  useEffect(() => {
    if (!open) return;
    // Wait for the open transition to roughly finish before scrolling
    // — scrollIntoView during a scaleX animation gets clipped.
    const t = setTimeout(() => {
      const el = scrollRef.current?.querySelector<HTMLElement>('[data-active="true"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 180);
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

  // Active app's display bits for the trigger.
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

  // Easings: spring-y for open, calm for close.
  const OPEN_EASE  = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
  const CLOSE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      {/* Local style for hiding the WebKit scrollbar inside the swipe row.
          Inlined here so this component is fully self-contained. */}
      <style>{`
        .app-mode-swipe::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Trigger pill (always in flow) ───────────────────────────── */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '4px 6px 4px 0', margin: '-4px 0',
          color: resolvedColor,
          // Subtle transform feedback when open so the trigger feels
          // "linked" to the floating pill that just appeared.
          transform: open ? 'translateX(-1px)' : 'translateX(0)',
          transition: `transform 240ms ${open ? OPEN_EASE : CLOSE_EASE}`,
        }}
      >
        <ActiveIcon size={size} />
        <span style={{
          fontSize: 13, fontWeight: 700, fontFamily: 'Manrope',
          letterSpacing: '-0.02em', color: resolvedColor,
        }}>{activeLabel}</span>
        <span style={{
          fontSize: 9, opacity: 0.45, marginLeft: -3, color: resolvedColor,
          display: 'inline-block',
          transform: open ? 'rotate(-180deg)' : 'rotate(0deg)',
          transition: `transform 280ms ${OPEN_EASE}`,
        }}>▾</span>
      </button>

      {/* ── Floating expansion pill — slides in from the trigger ────── */}
      <div
        role="menu"
        aria-hidden={!open}
        style={{
          position: 'absolute',
          top: '50%', left: '100%',
          // Translate Y to center vertically; X grows the gap as it opens
          // so it visually "pops out" from the trigger.
          transform: open
            ? 'translate(8px, -50%) scaleX(1)'
            : 'translate(-4px, -50%) scaleX(0.18)',
          transformOrigin: 'left center',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: open
            ? `transform 360ms ${OPEN_EASE}, opacity 220ms ease 60ms`
            : `transform 240ms ${CLOSE_EASE}, opacity 180ms ease`,
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
        {/* Swipeable horizontal icon row.
            overflow-x: auto + scroll-snap gives the native, momentum
            "flick through apps" feel the user asked for. The internal
            container is what scrolls — the outer pill stays fixed. */}
        <div
          ref={scrollRef}
          className="app-mode-swipe"
          style={{
            display: 'flex', alignItems: 'center', gap: 2,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            // Stagger reveal: icons fade up just after the pill finishes growing.
            transition: `opacity 200ms ease ${open ? '120ms' : '0ms'}`,
            opacity: open ? 1 : 0,
            // overscrollBehavior keeps the page from scrolling when the
            // user flicks past the last icon.
            overscrollBehavior: 'contain',
            padding: '0 2px',
          }}
        >
          {OPTIONS.map(opt => {
            const isActive = currentMode === opt.value;
            return (
              <button
                key={opt.value}
                data-active={isActive}
                onClick={() => select(opt.value)}
                title={opt.label}
                aria-label={opt.label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30, borderRadius: 999, flexShrink: 0,
                  scrollSnapAlign: 'center',
                  background: isActive ? `${accent.from}22` : idleIconBg,
                  border: `1px solid ${isActive ? `${accent.from}55` : 'transparent'}`,
                  color: isActive ? accent.from : idleIconFg,
                  cursor: 'pointer',
                  transition: 'background 180ms, color 180ms, border-color 180ms, transform 180ms',
                  // Subtle pop on the active one so it stands out in the row.
                  transform: isActive ? 'scale(1.06)' : 'scale(1)',
                }}
              >
                <opt.Icon size={14} />
              </button>
            );
          })}

          {/* Divider before Hub — visually separates app switcher from
              navigation back to the Studio home. */}
          <div style={{
            width: 1, height: 16, background: divider,
            margin: '0 4px', flexShrink: 0,
          }} />

          <button
            onClick={goToHub}
            title="Studio Hub"
            aria-label="Studio Hub"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 999, flexShrink: 0,
              scrollSnapAlign: 'center',
              background: idleIconBg,
              border: '1px solid transparent',
              color: idleIconFg,
              cursor: 'pointer',
              transition: 'background 180ms, color 180ms',
            }}
          >
            <StudioLogo size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * StudioThemeToggler — Animated 4-mode theme picker.
 *
 * Implements the MagicUI AnimatedThemeToggler clip-path view-transition
 * (circle / square / diamond / star etc.) adapted for 4 modes:
 *   System · Light · Dark · AMOLED
 *
 * Animation contract:
 *   1. On selection, DOM theme classes are applied synchronously inside
 *      `startViewTransition → flushSync` so the browser snapshot captures
 *      the new state correctly.
 *   2. The JS `Element.animate()` on `::view-transition-new(root)` drives the
 *      clip-path reveal from the clicked button's centre.
 *   3. `onChange(theme, amoledMode)` is called in `transition.finished.finally`
 *      so it fires after the animation — the zustand/App.tsx effect re-applies
 *      the same classes (no-op visually).
 *   4. Falls back to instant class swap + immediate `onChange` when the
 *      View Transitions API is unavailable.
 */

import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { Theme } from '../store/useChordStore';

// ── Types ─────────────────────────────────────────────────────────────────

export type TransitionVariant =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'rectangle'
  | 'star';

export interface StudioThemeTogglerProps {
  currentTheme: Theme;
  currentAmoled: boolean;
  accentFrom: string;
  onChange: (theme: Theme, amoledMode: boolean) => void;
  labels?: {
    system?: string;
    light?: string;
    dark?: string;
    amoled?: string;
  };
  variant?: TransitionVariant;
  /** Animation duration in ms. Default 500 — feels fluid without being slow. */
  duration?: number;
}

// ── Clip-path helpers (ported from MagicUI official source) ───────────────

function polygonCollapsed(cx: number, cy: number, n: number): string {
  return `polygon(${Array.from({ length: n }, () => `${cx}px ${cy}px`).join(', ')})`;
}

function getClipPaths(
  variant: TransitionVariant,
  cx: number, cy: number,
  maxR: number,
  vw: number, vh: number,
): [string, string] {
  switch (variant) {
    case 'circle':
      return [
        'circle(0px at 50vw 50vh)',
        'circle(120vmax at 50vw 50vh)',
      ];

    case 'square':
      return [
        'polygon(50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh)',
        'polygon(-100vw -100vh, 200vw -100vh, 200vw 200vh, -100vw 200vh)',
      ];

    case 'triangle':
      return [
        'polygon(50vw 50vh, 50vw 50vh, 50vw 50vh)',
        'polygon(50vw -150vh, 250vw 150vh, -150vw 150vh)',
      ];

    case 'diamond':
      return [
        'polygon(50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh)',
        'polygon(50vw -100vh, 200vw 50vh, 50vw 200vh, -100vw 50vh)',
      ];

    case 'hexagon':
      return [
        'polygon(50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh)',
        'polygon(50vw -100vh, 180vw -25vh, 180vw 125vh, 50vw 200vh, -80vw 125vh, -80vw -25vh)',
      ];

    case 'rectangle':
      return [
        'polygon(50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh)',
        'polygon(-100vw -100vh, 200vw -100vh, 200vw 200vh, -100vw 200vh)',
      ];

    case 'star': {
      const collapsed = 'polygon(50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh, 50vw 50vh)';
      const verts: string[] = [];
      const ir = 0.42;
      for (let i = 0; i < 5; i++) {
        const oa = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        verts.push(`calc(50vw + ${150 * Math.cos(oa)}vmax) calc(50vh + ${150 * Math.sin(oa)}vmax)`);
        const ia = oa + Math.PI / 5;
        verts.push(`calc(50vw + ${150 * ir * Math.cos(ia)}vmax) calc(50vh + ${150 * ir * Math.sin(ia)}vmax)`);
      }
      return [collapsed, `polygon(${verts.join(', ')})`];
    }

    default:
      return [
        'circle(0px at 50vw 50vh)',
        'circle(120vmax at 50vw 50vh)',
      ];
  }
}

// ── DOM class helper ──────────────────────────────────────────────────────

function applyThemeClasses(theme: Theme, amoled: boolean) {
  const root = document.documentElement;
  root.classList.remove('light', 'theme-system', 'amoled');
  if (theme === 'light')        root.classList.add('light');
  else if (theme === 'system')  root.classList.add('theme-system');
  if (amoled)                   root.classList.add('amoled');
}

// ── Static option list ────────────────────────────────────────────────────

type LabelKey = 'system' | 'light' | 'dark' | 'amoled';

const OPTIONS: { theme: Theme; amoled: boolean; icon: string; key: LabelKey; def: string }[] = [
  { theme: 'system', amoled: false, icon: 'brightness_auto', key: 'system', def: 'System' },
  { theme: 'light',  amoled: false, icon: 'light_mode',      key: 'light',  def: 'Light'  },
  { theme: 'dark',   amoled: false, icon: 'dark_mode',       key: 'dark',   def: 'Dark'   },
  { theme: 'dark',   amoled: true,  icon: 'contrast',        key: 'amoled', def: 'AMOLED' },
];

// ── Component ─────────────────────────────────────────────────────────────

export default function StudioThemeToggler({
  currentTheme,
  currentAmoled,
  accentFrom,
  onChange,
  labels,
  variant = 'circle',
  duration = 500,
}: StudioThemeTogglerProps) {

  const handleSelect = useCallback((
    btn: HTMLButtonElement,
    newTheme: Theme,
    newAmoled: boolean,
  ) => {
    const alreadyActive = newAmoled
      ? currentAmoled
      : newTheme === currentTheme && !currentAmoled;
    if (alreadyActive) return;

    const vw = window.visualViewport?.width  ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;
    const maxR = Math.hypot(cx, cy);

    const [clipFrom, clipTo] = getClipPaths(variant, cx, cy, maxR, vw, vh);

    if (typeof document.startViewTransition !== 'function') {
      applyThemeClasses(newTheme, newAmoled);
      onChange(newTheme, newAmoled);
      return;
    }

    const root = document.documentElement;
    root.dataset.studioThemeVt = 'active';
    root.style.setProperty('--studio-theme-vt-duration', `${duration}ms`);
    root.style.setProperty('--studio-theme-vt-clip-from', clipFrom);

    const cleanup = () => {
      delete root.dataset.studioThemeVt;
      root.style.removeProperty('--studio-theme-vt-duration');
      root.style.removeProperty('--studio-theme-vt-clip-from');
      onChange(newTheme, newAmoled);
    };

    const transition = document.startViewTransition(() => {
      flushSync(() => { applyThemeClasses(newTheme, newAmoled); });
    });

    if (typeof transition?.finished?.finally === 'function') {
      transition.finished.finally(cleanup);
    } else {
      cleanup();
    }

    transition?.ready?.then(() => {
      root.animate(
        { clipPath: [clipFrom, clipTo] },
        {
          duration,
          // Fast-out: starts at full velocity (masks snapshot-capture delay),
          // then decelerates smoothly — no aggressive punch-through.
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    });
  }, [currentTheme, currentAmoled, variant, duration, onChange]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 8,
      }}
    >
      {OPTIONS.map((opt, i) => {
        const isActive = opt.amoled
          ? currentAmoled
          : currentTheme === opt.theme && !currentAmoled;
        const label = labels?.[opt.key] ?? opt.def;

        return (
          <button
            key={i}
            type="button"
            className="btn-smooth"
            onClick={(e) => handleSelect(e.currentTarget, opt.theme, opt.amoled)}
            style={{
              padding: '12px 6px',
              borderRadius: 12,
              background: isActive
                ? `color-mix(in srgb, ${accentFrom} 18%, transparent)`
                : 'var(--app-surface-high)',
              border: `1.5px solid ${isActive ? accentFrom : 'transparent'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              transition: 'background 200ms ease, border-color 200ms ease, transform 160ms cubic-bezier(0.34,1.56,0.64,1)',
              cursor: 'pointer',
              transform: isActive ? 'scale(1.04)' : 'scale(1)',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 22,
                color: isActive ? accentFrom : 'var(--c-text-secondary)',
                fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                transition: 'color 200ms ease, font-variation-settings 200ms ease',
                filter: isActive
                  ? `drop-shadow(0 0 6px color-mix(in srgb, ${accentFrom} 40%, transparent))`
                  : 'none',
              }}
            >
              {opt.icon}
            </span>
            <p
              style={{
                color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
                fontFamily: 'Manrope',
                fontWeight: 700,
                fontSize: 'var(--font-xs)',
                transition: 'color 200ms ease',
                margin: 0,
              }}
            >
              {label}
            </p>
          </button>
        );
      })}
    </div>
  );
}

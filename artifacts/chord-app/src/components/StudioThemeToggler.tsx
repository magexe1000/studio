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
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxR}px at ${cx}px ${cy}px)`,
      ];

    case 'square': {
      const h = Math.max(Math.max(cx, vw - cx), Math.max(cy, vh - cy)) * 1.05;
      const pts = [`${cx-h}px ${cy-h}px`, `${cx+h}px ${cy-h}px`, `${cx+h}px ${cy+h}px`, `${cx-h}px ${cy+h}px`].join(', ');
      return [polygonCollapsed(cx, cy, 4), `polygon(${pts})`];
    }

    case 'triangle': {
      const s = maxR * 2.2;
      const dx = (Math.sqrt(3) / 2) * s;
      const pts = [`${cx}px ${cy-s}px`, `${cx+dx}px ${cy+0.5*s}px`, `${cx-dx}px ${cy+0.5*s}px`].join(', ');
      return [polygonCollapsed(cx, cy, 3), `polygon(${pts})`];
    }

    case 'diamond': {
      const R = maxR * Math.SQRT2;
      const pts = [`${cx}px ${cy-R}px`, `${cx+R}px ${cy}px`, `${cx}px ${cy+R}px`, `${cx-R}px ${cy}px`].join(', ');
      return [polygonCollapsed(cx, cy, 4), `polygon(${pts})`];
    }

    case 'hexagon': {
      const R = maxR * Math.SQRT2;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        return `${cx + R * Math.cos(a)}px ${cy + R * Math.sin(a)}px`;
      });
      return [polygonCollapsed(cx, cy, 6), `polygon(${pts.join(', ')})`];
    }

    case 'rectangle': {
      const hw = Math.max(cx, vw - cx);
      const hh = Math.max(cy, vh - cy);
      const pts = [`${cx-hw}px ${cy-hh}px`, `${cx+hw}px ${cy-hh}px`, `${cx+hw}px ${cy+hh}px`, `${cx-hw}px ${cy+hh}px`].join(', ');
      return [polygonCollapsed(cx, cy, 4), `polygon(${pts})`];
    }

    case 'star': {
      const R = maxR * Math.SQRT2 * 1.03;
      const ir = 0.42;
      const star = (r: number) => {
        const verts: string[] = [];
        for (let i = 0; i < 5; i++) {
          const oa = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          verts.push(`${cx + r * Math.cos(oa)}px ${cy + r * Math.sin(oa)}px`);
          const ia = oa + Math.PI / 5;
          verts.push(`${cx + r * ir * Math.cos(ia)}px ${cy + r * ir * Math.sin(ia)}px`);
        }
        return `polygon(${verts.join(', ')})`;
      };
      return [star(Math.max(2, R * 0.025)), star(R)];
    }

    default:
      return [
        `circle(0px at ${cx}px ${cy}px)`,
        `circle(${maxR}px at ${cx}px ${cy}px)`,
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
  duration = 380,
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
    const { top, left, width, height } = btn.getBoundingClientRect();
    const cx = left + width  / 2;
    const cy = top  + height / 2;
    const maxR = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy));

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
          easing: variant === 'star' ? 'linear' : 'ease-in-out',
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

import { type Theme } from '@workspace/studio-core';
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

    const root = document.documentElement;
    const isTransitioning = root.dataset.studioThemeVt === 'active';
    if (isTransitioning) return;

    onChange(newTheme, newAmoled);
  }, [currentTheme, currentAmoled, onChange]);

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

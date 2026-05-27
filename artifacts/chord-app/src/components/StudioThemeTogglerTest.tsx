/**
 * StudioThemeTogglerTest — isolated manual-test harness.
 *
 * Renders the StudioThemeToggler with its own local state so every
 * transition (System → Light → Dark → AMOLED and back) can be verified
 * without touching the real settings store.
 *
 * Usage: drop <StudioThemeTogglerTest /> anywhere in the app temporarily.
 */

import { useState } from 'react';
import StudioThemeToggler from './StudioThemeToggler';
import type { StudioThemeTogglerProps } from './StudioThemeToggler';
import type { Theme } from '../store/useChordStore';

const VARIANTS: StudioThemeTogglerProps['variant'][] = [
  'circle', 'square', 'diamond', 'triangle', 'hexagon', 'rectangle', 'star',
];

export default function StudioThemeTogglerTest() {
  const [theme, setTheme]   = useState<Theme>('dark');
  const [amoled, setAmoled] = useState(false);
  const [variant, setVariant] = useState<StudioThemeTogglerProps['variant']>('circle');

  const activeLabel = amoled ? 'AMOLED' : theme.charAt(0).toUpperCase() + theme.slice(1);

  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        maxWidth: 380,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div>
        <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 16, margin: '0 0 4px', color: 'var(--c-text-primary)' }}>
          StudioThemeToggler — isolated test
        </p>
        <p style={{ fontFamily: 'Inter', fontSize: 12, margin: 0, color: 'var(--c-text-secondary)' }}>
          Active: <strong>{activeLabel}</strong>
        </p>
      </div>

      {/* The toggler under test */}
      <StudioThemeToggler
        currentTheme={theme}
        currentAmoled={amoled}
        accentFrom="var(--accent-from)"
        onChange={(t, a) => { setTheme(t); setAmoled(a); }}
        variant={variant}
        labels={{
          system: 'System',
          light: 'Light',
          dark: 'Dark',
          amoled: 'AMOLED',
        }}
      />

      {/* Variant picker */}
      <div>
        <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, margin: '0 0 8px', color: 'var(--c-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Transition variant
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {VARIANTS.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              style={{
                padding: '5px 10px',
                borderRadius: 8,
                fontFamily: 'Manrope',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                background: variant === v ? 'var(--accent-from)' : 'var(--app-surface-high)',
                color: variant === v ? '#fff' : 'var(--c-text-secondary)',
                border: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* State readout */}
      <pre
        style={{
          fontFamily: 'monospace',
          fontSize: 11,
          background: 'var(--app-surface-high)',
          borderRadius: 8,
          padding: 12,
          margin: 0,
          color: 'var(--c-text-secondary)',
        }}
      >
        {JSON.stringify({ theme, amoled, variant }, null, 2)}
      </pre>
    </div>
  );
}

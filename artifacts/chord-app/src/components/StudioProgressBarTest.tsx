/**
 * StudioProgressBarTest — isolated manual-test harness.
 *
 * Tests: 35%, 60%, 100% (static), plus a live animated demo cycling 0→100.
 * Usage: drop <StudioProgressBarTest /> anywhere temporarily.
 */

import { useEffect, useState } from 'react';
import StudioProgressBar from './StudioProgressBar';

const CASES = [
  { value: 35,  label: '35%' },
  { value: 60,  label: '60%' },
  { value: 100, label: '100%' },
];

export default function StudioProgressBarTest() {
  const [live, setLive] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (live >= 100) { setRunning(false); return; }
    const id = setTimeout(() => setLive(v => Math.min(100, v + 2)), 80);
    return () => clearTimeout(id);
  }, [running, live]);

  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        maxWidth: 380,
        margin: '0 auto',
      }}
    >
      <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 16, margin: 0, color: 'var(--c-text-primary)' }}>
        StudioProgressBar — isolated test
      </p>

      {/* Static cases */}
      {CASES.map(({ value, label }) => (
        <div key={value} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 12, color: 'var(--c-text-secondary)' }}>
              Static
            </span>
            <span style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 13, color: 'var(--accent-from)' }}>
              {label}
            </span>
          </div>
          <StudioProgressBar
            value={value}
            accentFrom="var(--accent-from)"
            accentTo="var(--accent-to)"
            height={6}
          />
        </div>
      ))}

      {/* Live demo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 12, color: 'var(--c-text-secondary)' }}>
            Live spring
          </span>
          <span style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 13, color: 'var(--accent-from)' }}>
            {Math.round(live)}%
          </span>
        </div>
        <StudioProgressBar
          value={live}
          accentFrom="var(--accent-from)"
          accentTo="var(--accent-to)"
          height={6}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => { setLive(0); setRunning(true); }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
              background: 'var(--accent-from)', color: '#fff',
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 12,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            Run
          </button>
          <button
            type="button"
            onClick={() => { setLive(0); setRunning(false); }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
              background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)',
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 12,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Accent-colored variant */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 12, color: 'var(--c-text-secondary)' }}>
          Groovex accent (gx-accent)
        </span>
        <StudioProgressBar
          value={72}
          accentFrom="var(--gx-accent-container, #4f9eff)"
          accentTo="var(--gx-accent, #007aff)"
          height={6}
        />
      </div>
    </div>
  );
}

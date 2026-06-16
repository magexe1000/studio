import React, { memo } from 'react';
import { type AccentColor } from '../store/useChordStore';

// ── Shared primitives used across SettingsPanel and HubSettings ────────────────

export interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  accentFrom: string;
  accentTo: string;
}

export const Toggle = memo(function Toggle({ value, onChange, accentFrom, accentTo }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="btn-smooth relative flex-none"
      style={{
        width: '48px',
        height: '28px',
        borderRadius: '9999px',
        background: value ? `linear-gradient(135deg, ${accentFrom}, ${accentTo})` : 'rgba(72,72,72,0.2)',
        transition: 'background 300ms ease',
        boxShadow: value ? `0 2px 12px ${accentTo}44` : 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '3px',
          left: value ? 'calc(100% - 25px)' : '3px',
          width: '22px',
          height: '22px',
          borderRadius: '9999px',
          background: value ? 'white' : '#acabaa',
          transition: 'left 280ms cubic-bezier(0.34, 1.56, 0.64, 1), background 280ms ease',
          display: 'block',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
});

export const SectionHeader = memo(function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6 spring-in">
      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--c-text-secondary)' }}>{icon}</span>
      <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 'var(--font-xs)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{title}</p>
    </div>
  );
});

export function SettingRow({ label, desc, children, indent }: { label: string; desc?: string; children: React.ReactNode; indent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4" style={{ padding: '14px 20px', paddingLeft: indent ? '28px' : '20px', borderBottom: '1px solid rgba(72,72,72,0.07)' }}>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: indent ? 'var(--font-sm)' : 'var(--font-base)', fontWeight: 600, color: indent ? 'var(--c-text-secondary)' : 'var(--c-text-primary)', fontFamily: 'Manrope' }}>{label}</p>
        {desc && <p style={{ fontSize: 'var(--font-sm)', marginTop: '2px', lineHeight: 1.3, color: 'var(--c-text-secondary)', fontFamily: 'Inter', opacity: indent ? 0.75 : 1 }}>{desc}</p>}
      </div>
      <div className="flex-none">{children}</div>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value, options, onChange, accentFrom, accentTo,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  accentFrom: string;
  accentTo: string;
}) {
  return (
    <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '9999px', padding: '2px', display: 'flex', transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="btn-smooth"
          style={{
            padding: '4px 12px',
            borderRadius: '9999px',
            fontFamily: 'Manrope',
            fontSize: 'var(--font-xs)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: value === opt.value ? `linear-gradient(135deg, ${accentFrom}, ${accentTo})` : 'transparent',
            color: value === opt.value ? 'white' : '#acabaa',
            transition: 'background 250ms ease, color 250ms ease',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export const COLOR_OPTIONS: { id: AccentColor; from: string; to: string }[] = [
  { id: 'blue',   from: '#679cff', to: '#007aff' },
  { id: 'purple', from: '#b57bee', to: '#7c3aed' },
  { id: 'green',  from: '#34d399', to: '#059669' },
  { id: 'orange', from: '#fb923c', to: '#ea580c' },
  { id: 'pink',   from: '#f472b6', to: '#db2777' },
  { id: 'teal',   from: '#2dd4bf', to: '#0891b2' },
];

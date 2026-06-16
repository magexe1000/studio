import React from 'react';

export function IconSongs({ active }: { active: boolean }) {
  const sw = active ? 2.1 : 1.7;
  const ao = active ? 1 : 0;
  const trans = 'fill-opacity 140ms cubic-bezier(0.34,1.56,0.64,1)';
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <path d="M9 18V7l10-2.5V16" stroke="currentColor" strokeWidth={sw}
        style={{ transition: 'stroke-width 120ms ease' }} />
      <circle cx="7" cy="18" r="2.5"
        fill="currentColor" fillOpacity={ao}
        stroke="currentColor" strokeWidth={sw - 0.2}
        style={{ transition: trans }} />
      <circle cx="17" cy="16" r="2.5"
        fill="currentColor" fillOpacity={ao}
        stroke="currentColor" strokeWidth={sw - 0.2}
        style={{ transition: trans }} />
    </svg>
  );
}

export function IconLibrary({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.7;
  const ao = active ? 1 : 0;
  const trans = 'fill-opacity 140ms cubic-bezier(0.34,1.56,0.64,1)';
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="3" y="4" width="5" height="16" rx="1.5" strokeWidth={sw}
        fill="currentColor" fillOpacity={ao} style={{ transition: trans }} />
      <rect x="10" y="7" width="4" height="13" rx="1.5" strokeWidth={sw}
        fill="currentColor" fillOpacity={ao} style={{ transition: `${trans.replace('140ms', '120ms')}` }} />
      <rect x="16" y="9" width="5" height="11" rx="1.5" strokeWidth={sw}
        fill="currentColor" fillOpacity={ao} style={{ transition: `${trans.replace('140ms', '100ms')}` }} />
    </svg>
  );
}

export function IconChords({ active }: { active: boolean }) {
  const sw     = active ? 1.8 : 1.5;
  const dotAo  = active ? 1 : 0;
  const dotTr  = 'fill-opacity 130ms cubic-bezier(0.34,1.56,0.64,1)';
  const lineTr = 'stroke-opacity 130ms ease';

  const strings = [6, 12, 18];
  const frets   = [7, 12, 17];
  const dots = [[0, 1], [1, 0], [2, 2]];

  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <line x1="4" y1="4.5" x2="20" y2="4.5"
        stroke="currentColor" strokeWidth={sw + 0.6} strokeLinecap="round"
        style={{ transition: 'stroke-width 120ms ease' }} />

      {frets.map((y, fi) => (
        <line key={`f${fi}`} x1="4" y1={y} x2="20" y2={y}
          stroke="currentColor" strokeWidth={sw - 0.5} strokeOpacity={active ? 0.5 : 0.45}
          style={{ transition: lineTr }} />
      ))}

      {strings.map((x, si) => (
        <line key={`s${si}`} x1={x} y1="4.5" x2={x} y2="20"
          stroke="currentColor" strokeWidth={sw - 0.5} strokeOpacity={active ? 0.5 : 0.45}
          style={{ transition: lineTr }} />
      ))}

      {dots.map(([si, fi], i) => (
        <circle key={i}
          cx={strings[si]}
          cy={(frets[fi] + (fi > 0 ? frets[fi - 1] : 4.5)) / 2}
          r="2.4"
          fill="currentColor"
          fillOpacity={dotAo}
          stroke="currentColor"
          strokeWidth={active ? 0 : sw - 0.3}
          strokeOpacity={active ? 0 : 0.7}
          style={{ transition: dotTr }} />
      ))}
    </svg>
  );
}

export function IconSettings({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.7;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <line x1="4" y1="6"  x2="20" y2="6"  />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8"  cy="6"  r="2.2" fill={active ? 'currentColor' : 'var(--app-bg)'} />
      <circle cx="16" cy="12" r="2.2" fill={active ? 'currentColor' : 'var(--app-bg)'} />
      <circle cx="10" cy="18" r="2.2" fill={active ? 'currentColor' : 'var(--app-bg)'} />
    </svg>
  );
}

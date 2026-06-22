import { getAllChords, searchChords, getChordById, getRelatedChords, type ChordType, useChordStore, ACCENT_COLORS, SONGS, GENRE_META, type Genre, SPANISH_DESCRIPTIONS, useScrollHide, useT, useIsWebDesktop, setBackHandler, playChord, stopChordPlayback, type GuitarChordData, type SongChart } from '@workspace/studio-core';
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { SongPracticeView } from '../components/SongPracticeView';
import EmptyStateLottie from '../components/lottie/EmptyStateLottie';
import ChordDiagram from '../components/ChordDiagram';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import { AnimatedAppHeader, StaggeredReveal } from '../components/AppAnimationSystem';
import { useScrollFade } from '../components/ScrollFade';
import GuitarDiagram from '../components/GuitarDiagram';
import PianoDiagram from '../components/PianoDiagram';
import FourStringDiagram from '../components/FourStringDiagram';
import { WebEmptyState } from '../components/WebDesignSystem';

function RelatedPlayBtn({ guitar, accent, isLight }: {
  guitar: GuitarChordData;
  accent: { from: string; to: string; mid: string };
  isLight?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const handlePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (playing) { stopChordPlayback(); setPlaying(false); return; }
    setPlaying(true);
    playChord(guitar);
    setTimeout(() => setPlaying(false), 2800);
  }, [guitar, playing]);

  return (
    <button
      aria-label="Play chord"
      onClick={handlePlay}
      style={{
        width: 24, height: 24, borderRadius: '50%',
        background: playing ? `${accent.from}30` : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'),
        border: 'none', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 0,
        transition: 'background 200ms ease',
      }}
    >
      <span className="material-symbols-outlined" style={{
        fontSize: '13px',
        color: playing ? accent.from : 'var(--c-text-secondary)',
        fontVariationSettings: "'FILL' 1",
        transition: 'color 200ms ease',
      }}>{playing ? 'stop' : 'play_arrow'}</span>
    </button>
  );
}

// ── Category definitions ──────────────────────────────────────
const CATEGORIES: {
  type: ChordType | 'all';
  icon: string;
  label: string;
  desc: string;
  wide?: boolean;
  noDecor?: boolean;
  color: string;
}[] = [
  { type: 'major',   icon: '',                    label: 'Major',        desc: 'Bright, happy, foundational.',     wide: true, noDecor: true, color: '#679cff' },
  { type: 'minor',   icon: 'dark_mode',           label: 'Minor',        desc: 'Moody & emotional.',                color: '#bb5551' },
  { type: '7th',     icon: 'electric_bolt',       label: '7th',          desc: 'Jazz & blues backbone.',            color: '#9d9da6' },
  { type: 'maj7',    icon: 'stars',               label: 'Maj7',         desc: 'Lush & dreamy.',                   color: '#679cff' },
  { type: 'min7',    icon: 'nightlight',          label: 'Min7',         desc: 'Smooth & introspective.',          color: '#bb5551' },
  { type: 'dim',     icon: 'warning',             label: 'Diminished',   desc: 'Tense & dissonant.',               color: '#ee7d77' },
  { type: 'aug',     icon: 'trending_up',         label: 'Augmented',    desc: 'Mysterious & floating.',           color: '#9d9da6' },
  { type: 'sus2',    icon: 'waves',               label: 'Sus2',         desc: 'Open & airy.',                     color: '#2dd4bf' },
  { type: 'sus4',    icon: 'hourglass_empty',     label: 'Sus4',         desc: 'Suspended tension.',               color: '#2dd4bf' },
  { type: '9th',     icon: 'tune',                label: '9th',          desc: 'Rich & funky.',                    color: '#b57bee' },
  { type: 'maj9',    icon: 'auto_awesome',        label: 'Maj9',         desc: 'Romantic & complex.',              color: '#b57bee' },
  { type: 'min9',    icon: 'cloud',               label: 'Min9',         desc: 'Dark & jazzy.',                    color: '#b57bee' },
  { type: 'add9',    icon: 'add_circle',          label: 'Add9',         desc: 'Major with color.',                color: '#34d399' },
  { type: '6th',     icon: 'hexagon',             label: '6th',          desc: 'Sweet & vintage.',                 color: '#fbbf24' },
  { type: 'min6',    icon: 'star_half',           label: 'Min6',         desc: 'Bittersweet.',                     color: '#fbbf24' },
  { type: 'halfdim', icon: 'contrast',            label: 'Half-Dim ø7',  desc: 'Jazz & classical tension.',        color: '#ee7d77' },
  { type: 'dim7',    icon: 'block',               label: 'Dim7',         desc: 'Symmetrical & eerie.',             color: '#ee7d77' },
  { type: '11th',    icon: 'stacked_bar_chart',   label: '11th',         desc: 'Dense & modern.',                  color: '#b57bee' },
  { type: '13th',    icon: 'equalizer',           label: '13th',         desc: 'Full jazz voicing.',               color: '#b57bee' },
  { type: '7sus4',   icon: 'pending',             label: '7sus4',        desc: 'Funky & unresolved.',              color: '#34d399' },
  { type: '7sus2',   icon: 'radio_button_unchecked', label: '7sus2',     desc: 'Open dominant.',                   color: '#34d399' },
  { type: 'maj6',    icon: 'grade',               label: 'Maj6',         desc: 'Vintage & melodic.',               color: '#fbbf24' },
  // ── New types ──
  { type: 'power',   icon: 'flash_on',            label: 'Power',        desc: 'Rock & metal essential.',          color: '#ee7d77' },
  { type: 'minmaj7', icon: 'merge',               label: 'm/maj7',       desc: 'Jazz sophistication.',             color: '#b57bee' },
  { type: 'aug7',    icon: 'north_east',          label: 'Aug7',         desc: 'Tense jazz transition.',           color: '#2dd4bf' },
  { type: '7b9',     icon: 'south',               label: '7b9',          desc: 'Dark Spanish-jazz tension.',       color: '#ee7d77' },
  { type: '7s9',     icon: 'bolt',                label: '7#9',          desc: 'The Hendrix chord.',               color: '#9d9da6' },
  { type: '69',      icon: 'grain',               label: '6/9',          desc: 'Jazz & bossa nova color.',         color: '#fbbf24' },
  { type: '9sus4',   icon: 'blur_on',             label: '9sus4',        desc: 'Soulful & unresolved.',            color: '#34d399' },
];

// ── Instrument decorative silhouette for category tiles ───────
function BigInstrumentDecor({ instrument, accentFrom }: { instrument: string; accentFrom: string }) {
  const wrap: React.CSSProperties = {
    position: 'absolute',
    right: '-18px',
    bottom: '-44px',
    opacity: 0.13,
    pointerEvents: 'none',
    filter: `drop-shadow(0 0 28px ${accentFrom}66)`,
  };

  if (instrument === 'guitar') {
    // Electric guitar — SG-style double cutaway, cherry red
    return (
      <div style={{ ...wrap, transform: 'rotate(-18deg)' }}>
        <svg viewBox="0 0 40 64" width="94" height="150" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Angular electric headstock */}
          <path d="M14 0 L26 0 L27 8 L13 8 Z" fill="#1a0e08" />
          <circle cx="11" cy="2.5" r="2" fill="#c8a84b" />
          <circle cx="11" cy="5.5" r="2" fill="#c8a84b" />
          <circle cx="11" cy="8.5" r="1.8" fill="#c8a84b" />
          <circle cx="29" cy="2.5" r="2" fill="#c8a84b" />
          <circle cx="29" cy="5.5" r="2" fill="#c8a84b" />
          <circle cx="29" cy="8.5" r="1.8" fill="#c8a84b" />
          <rect x="14" y="8" width="12" height="1.2" rx="0.5" fill="#e0dcd6" />
          {/* Neck */}
          <rect x="17.5" y="9.2" width="5" height="20" rx="1" fill="#8B5E3C" />
          {[13, 16, 19, 22, 26].map(y => (
            <line key={y} x1="17.5" y1={y} x2="22.5" y2={y} stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
          ))}
          <circle cx="20" cy="14.5" r="0.9" fill="rgba(255,255,255,0.45)" />
          <circle cx="20" cy="21" r="0.9" fill="rgba(255,255,255,0.45)" />
          {/* SG body — symmetrical double cutaway */}
          <path d="M9 31 Q5 27 7 22 Q9 18 13 20 Q17 23 18 28 L20 28 L22 28 Q23 23 27 20 Q31 18 33 22 Q35 27 31 31 Q36 36 36 44 Q36 57 20 59 Q4 57 4 44 Q4 36 9 31Z" fill="#CC2200" />
          <path d="M9 31 Q6 28 8 23 Q10 20 13 21" stroke="rgba(255,140,80,0.22)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* Neck pickup */}
          <rect x="13" y="33" width="14" height="4.5" rx="1" fill="rgba(0,0,0,0.42)" />
          {/* Bridge pickup */}
          <rect x="13" y="44.5" width="14" height="4.5" rx="1" fill="rgba(0,0,0,0.42)" />
          {/* Pickup poles */}
          {[-2.2, -1.1, 0, 1.1, 2.2].map((dx, i) => (
            <g key={i}>
              <circle cx={20 + dx} cy={35.25} r="0.55" fill="rgba(200,168,75,0.6)" />
              <circle cx={20 + dx} cy={46.75} r="0.55" fill="rgba(200,168,75,0.6)" />
            </g>
          ))}
          {/* Stop-bar tailpiece */}
          <rect x="15" y="51" width="10" height="1.5" rx="0.5" fill="#c8a84b" />
          <rect x="16.5" y="53" width="7" height="1" rx="0.4" fill="#c8a84b" />
          <circle cx="20" cy="57.5" r="1.2" fill="#c8a84b" />
          {/* Knobs */}
          <circle cx="28" cy="39.5" r="1.5" fill="#c8a84b" opacity="0.75" />
          <circle cx="12" cy="39.5" r="1.5" fill="#c8a84b" opacity="0.75" />
          <circle cx="28" cy="43" r="1.5" fill="#c8a84b" opacity="0.75" />
          <circle cx="12" cy="43" r="1.5" fill="#c8a84b" opacity="0.75" />
          {/* Strings */}
          {[-1.5, -0.9, -0.2, 0.5, 1.2, 1.9].map((dx, i) => (
            <line key={i} x1={20 + dx} y1="9.2" x2={20 + dx} y2="52"
              stroke="rgba(255,255,255,0.28)" strokeWidth={i < 2 ? '0.65' : '0.45'} />
          ))}
        </svg>
      </div>
    );
  }

  if (instrument === 'bass') {
    return (
      <div style={{ ...wrap, transform: 'rotate(-18deg)' }}>
        <svg viewBox="0 0 40 64" width="94" height="150" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="15" y="1" width="10" height="11" rx="2" fill="#d4c8b4" />
          <circle cx="13" cy="5" r="2.2" fill="#c8a84b" />
          <circle cx="13" cy="9" r="2.2" fill="#c8a84b" />
          <circle cx="27" cy="5" r="2.2" fill="#c8a84b" />
          <circle cx="27" cy="9" r="2.2" fill="#c8a84b" />
          <rect x="14.5" y="12" width="11" height="1.5" rx="0.8" fill="#d4c8b4" />
          <rect x="16.5" y="13.5" width="7" height="22" rx="1" fill="#d4c8b4" />
          {[17, 22, 27, 31].map(y => (
            <line key={y} x1="16.5" y1={y} x2="23.5" y2={y} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
          ))}
          <path d="M8 36 Q8 28 16 28 L24 28 Q32 28 32 36 Q32 41 28 44 Q34 47 34 54 Q34 63 20 63 Q6 63 6 54 Q6 46 12 43 Q8 40 8 36Z" fill="#e7e5e4" />
          <ellipse cx="16" cy="48" rx="5" ry="9" fill="rgba(255,255,255,0.07)" />
          <rect x="16" y="44" width="12" height="4" rx="1" fill="rgba(0,0,0,0.30)" />
          <rect x="16" y="50" width="12" height="3.5" rx="1" fill="rgba(0,0,0,0.30)" />
          <rect x="16" y="56" width="8" height="2.5" rx="1" fill="#c8a84b" />
          {[-1, -0.3, 0.4, 1.1].map((dx, i) => (
            <line key={i} x1={20 + dx} y1="13.5" x2={20 + dx} y2="57"
              stroke="rgba(255,255,255,0.35)" strokeWidth={i < 2 ? '0.7' : '0.5'} />
          ))}
        </svg>
      </div>
    );
  }

  if (instrument === 'piano') {
    // Grand piano — plan view from above, showing full curved body + keyboard
    return (
      <div style={{ ...wrap, right: '-10px', bottom: '-24px', transform: 'rotate(-10deg)' }}>
        <svg viewBox="0 0 56 46" width="164" height="135" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Full grand piano body (curved plan silhouette) */}
          <path d="M2 5 Q2 2 6 2 L32 2 Q44 2 50 12 Q54 20 52 30 Q48 40 36 44 Q22 48 10 42 Q2 36 2 26 L2 5Z" fill="#1a1a1a" />
          {/* Lacquer sheen on lid */}
          <path d="M8 3 L32 3 Q42 3 48 11" stroke="rgba(255,255,255,0.10)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* Lid prop stick */}
          <line x1="32" y1="2" x2="28" y2="10" stroke="#c8a84b" strokeWidth="1.2" />
          {/* Keyboard section */}
          <rect x="2" y="24" width="30" height="16" rx="1" fill="#242424" />
          {/* White keys */}
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <rect key={i} x={3 + i * 3.9} y={25} width={3.4} height={14} rx={0.8}
              fill="rgba(250,246,240,0.94)" stroke="rgba(0,0,0,0.12)" strokeWidth={0.4} />
          ))}
          {/* Black keys */}
          {[1, 2, 4, 5, 6].map(pos => (
            <rect key={pos} x={3 + pos * 3.9 - 1.2} y={25} width={2.6} height={8.5} rx={0.5}
              fill="rgba(8,5,2,0.92)" />
          ))}
          {/* Strings (subtle diagonal fan in body) */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <line key={i} x1={20 + i * 4} y1={4} x2={26 + i * 3.5} y2={22}
              stroke="rgba(200,168,75,0.11)" strokeWidth={0.7} />
          ))}
          {/* Music desk */}
          <rect x="28" y="5" width="18" height="2.5" rx="1" fill="#2d2d2d" />
          {/* Legs */}
          <ellipse cx="6" cy="44" rx="3" ry="1.2" fill="#0d0d0d" />
          <ellipse cx="31" cy="44.5" rx="3" ry="1.2" fill="#0d0d0d" />
          <ellipse cx="48" cy="37" rx="2.5" ry="1.2" fill="#0d0d0d" />
        </svg>
      </div>
    );
  }

  // fallback
  return (
    <div style={{ ...wrap, transform: 'rotate(-18deg)' }}>
      <svg viewBox="0 0 36 62" width="88" height="152" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="1" width="8" height="9" rx="2" fill="#d4c8b4" />
        <circle cx="11.5" cy="4" r="2" fill="#c8a84b" />
        <circle cx="11.5" cy="7.5" r="2" fill="#c8a84b" />
        <circle cx="24.5" cy="4" r="2" fill="#c8a84b" />
        <circle cx="24.5" cy="7.5" r="2" fill="#c8a84b" />
        <rect x="13.5" y="10" width="9" height="1.5" rx="0.7" fill="#d4c8b4" />
        <rect x="15.5" y="11.5" width="5" height="16" rx="1" fill="#d4c8b4" />
        {[15, 19, 23].map(y => (
          <line key={y} x1="15.5" y1={y} x2="20.5" y2={y} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
        ))}
        <ellipse cx="18" cy="36" rx="10" ry="9" fill="#e7e5e4" />
        <rect x="12" y="36" width="12" height="5" fill="#e7e5e4" />
        <ellipse cx="18" cy="49" rx="12" ry="11" fill="#e7e5e4" />
        <ellipse cx="15" cy="44" rx="4.5" ry="7" fill="rgba(255,255,255,0.09)" />
        <circle cx="18" cy="42" r="4" fill="rgba(0,0,0,0.25)" />
        <rect x="13.5" y="52" width="9" height="2" rx="1" fill="#c8a84b" />
        {[-0.8, -0.2, 0.4, 1].map((dx, i) => (
          <line key={i} x1={18 + dx} y1="11.5" x2={18 + dx} y2="53.5"
            stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
        ))}
      </svg>
    </div>
  );
}

// ── Mini fretboard preview (faded, for category tiles) ──
type MiniBarre = { fret: number; fromString: number; toString: number };
function MiniChordPreview({ frets, baseFret = 1, barres = [], isDark = true }: {
  frets: number[];
  baseFret?: number;
  barres?: MiniBarre[];
  isDark?: boolean;
}) {
  const W = 56, H = 62;
  const n = Math.min(frets.length, 6);
  const fretCount = 4;
  const padL = 5, padR = 5, padT = 13, padB = 5;
  const fw = (W - padL - padR) / (n - 1);
  const fh = (H - padT - padB) / fretCount;
  const r = 4.2;
  const active = frets.filter(f => f > 0);
  const minActive = active.length ? Math.min(...active) : 1;
  const base = baseFret > 1 ? baseFret : Math.max(1, minActive);
  const isOpenPosition = base <= 1;

  // Flip colours to dark on light theme so the diagram is visible
  const c = isDark ? '255,255,255' : '0,0,0';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Nut / top line */}
      <line x1={padL} y1={padT} x2={W - padR} y2={padT}
        stroke={`rgba(${c},0.65)`} strokeWidth={isOpenPosition ? 3 : 1.2} strokeLinecap="round" />
      {/* Fret lines */}
      {Array.from({ length: fretCount }).map((_, i) => (
        <line key={i} x1={padL} y1={padT + (i + 1) * fh} x2={W - padR} y2={padT + (i + 1) * fh}
          stroke={`rgba(${c},0.22)`} strokeWidth={0.8} />
      ))}
      {/* String lines */}
      {Array.from({ length: n }).map((_, i) => (
        <line key={i} x1={padL + i * fw} y1={padT} x2={padL + i * fw} y2={padT + fretCount * fh}
          stroke={`rgba(${c},0.28)`} strokeWidth={i === 0 || i === n - 1 ? 1 : 0.65} />
      ))}
      {/* Barre bars */}
      {barres.map((b, bi) => {
        const d = b.fret - (base - 1);
        if (d < 1 || d > fretCount) return null;
        const x1 = padL + (b.toString - 1) * fw;
        const x2 = padL + (b.fromString - 1) * fw;
        const cy = padT + (d - 0.5) * fh;
        return (
          <rect key={`b${bi}`}
            x={Math.min(x1, x2)} y={cy - r}
            width={Math.abs(x2 - x1)} height={r * 2}
            rx={r} fill={`rgba(${c},0.80)`}
          />
        );
      })}
      {/* Individual dots — skip strings covered by a barre */}
      {frets.slice(0, n).map((fret, i) => {
        if (fret <= 0) return null;
        const d = fret - (base - 1);
        if (d < 1 || d > fretCount) return null;
        const coveredByBarre = barres.some(b =>
          b.fret === fret && i >= b.toString - 1 && i <= b.fromString - 1
        );
        if (coveredByBarre) return null;
        return <circle key={i} cx={padL + i * fw} cy={padT + (d - 0.5) * fh} r={r} fill={`rgba(${c},0.80)`} />;
      })}
      {/* Open / mute indicators above nut */}
      {frets.slice(0, n).map((fret, i) => {
        const cx = padL + i * fw;
        if (fret === 0) return <circle key={i} cx={cx} cy={padT - 5.5} r={2.2} stroke={`rgba(${c},0.42)`} strokeWidth={0.9} fill="none" />;
        if (fret === -1) {
          const dd = 1.8;
          return (
            <g key={i}>
              <line x1={cx - dd} y1={padT - 7 - dd} x2={cx + dd} y2={padT - 7 + dd} stroke={`rgba(${c},0.30)`} strokeWidth={1} />
              <line x1={cx + dd} y1={padT - 7 - dd} x2={cx - dd} y2={padT - 7 + dd} stroke={`rgba(${c},0.30)`} strokeWidth={1} />
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

// ── Chord card (2-col grid view) ──────────────────────────────
function ChordPlayBtn({ chord, accent, size = 26 }: {
  chord: NonNullable<ReturnType<typeof getChordById>>;
  accent: { from: string; to: string; mid: string };
  size?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const handlePlay = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (playing) { stopChordPlayback(); setPlaying(false); return; }
    setPlaying(true);
    playChord(chord.guitar);
    setTimeout(() => setPlaying(false), 2800);
  }, [chord.guitar, playing]);

  return (
    <button
      aria-label="Play chord"
      onClick={handlePlay}
      onKeyDown={e => e.key === 'Enter' && handlePlay(e)}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: playing ? `${accent.from}30` : 'rgba(255,255,255,0.07)',
        border: 'none', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 0,
        transition: 'background 200ms ease, transform 150ms cubic-bezier(0.34,1.56,0.64,1)',
        flexShrink: 0,
      }}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
    >
      <span className="material-symbols-outlined" style={{
        fontSize: `${Math.round(size * 0.54)}px`,
        color: playing ? accent.from : 'var(--c-text-secondary)',
        fontVariationSettings: "'FILL' 1",
        transition: 'color 200ms ease',
      }}>{playing ? 'stop' : 'play_arrow'}</span>
    </button>
  );
}

function ChordCard({
  chord, isSelected, onClick, accent,
}: {
  chord: NonNullable<ReturnType<typeof getChordById>>;
  isSelected: boolean;
  onClick: () => void;
  accent: { from: string; to: string; mid: string };
}) {
  return (
    <div role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className="card-hover cursor-pointer"
      style={{
        background: isSelected ? `${accent.to}16` : 'var(--app-surface)',
        borderRadius: '1.25rem',
        border: isSelected ? `1.5px solid ${accent.to}33` : '1px solid rgba(72,72,72,0.08)',
        padding: '14px 12px 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '8px',
        transition: 'background-color 200ms ease, border-color 200ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
      }}>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
        <ChordPlayBtn chord={chord} accent={accent} size={26} />
      </div>
      <p style={{
        color: isSelected ? accent.from : 'var(--c-text-primary)',
        fontFamily: 'Manrope', fontWeight: 800, fontSize: '16px',
        letterSpacing: '-0.02em', lineHeight: 1,
        transition: 'color 200ms ease',
        paddingRight: 30,
      }}>{chord.name}</p>
      <div style={{
        background: 'rgba(255,255,255,0.035)',
        borderRadius: '0.625rem',
        padding: '8px 8px 4px',
        transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        <ChordDiagram data={chord.guitar} accentFrom={accent.from} />
      </div>
      <p style={{
        color: 'var(--c-text-muted)',
        fontFamily: 'Inter', fontSize: '9.5px', letterSpacing: '0.05em',
        fontWeight: 500, textAlign: 'center',
      }}>{chord.notes.join(' · ')}</p>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────
export default function LibraryPanel() {
  const isWebDesktop = useIsWebDesktop();
  const { selectedChordId, recentChords, favorites, selectChord, settings, activePanel, toggleFavorite, addToProgression } = useChordStore();
  const [chordPlaying, setChordPlaying] = useState(false);

  const handleChordClick = (chordId: string) => {
    if (isWebDesktop) {
      useChordStore.setState((state) => {
        const recent = [chordId, ...state.recentChords.filter(id => id !== chordId)].slice(0, 10);
        return { selectedChordId: chordId, recentChords: recent };
      });
    } else {
      selectChord(chordId);
    }
  };
  const { ref: recentScrollRef, fadeClass: recentFadeClass } = useScrollFade();
  const { ref: favoritesScrollRef, fadeClass: favoritesFadeClass } = useScrollFade();
  const { ref: genreScrollRef, fadeClass: genreFadeClass } = useScrollFade();
  const accent = ACCENT_COLORS[settings.perApp?.chords?.accentColor ?? settings.accentColor] ?? ACCENT_COLORS.blue;
  const t = useT();
  const isLight = settings.theme === 'light' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const isDark = !isLight;

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);

  // Library tab state
  const [mainTab, setMainTab]     = useState<'explore' | 'discover'>('explore');
  const [query, setQuery]         = useState('');
  const [activeType, setActiveType] = useState<ChordType | 'all' | null>(null);

  // Discover state
  const [activeGenre, setActiveGenre]   = useState<Genre | null>(null);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const DISCOVER_PAGE_SIZE = 20;
  const [discoverLimit, setDiscoverLimit] = useState(DISCOVER_PAGE_SIZE);
  const [activePracticeSong, setActivePracticeSong] = useState<SongChart | null>(null);

  // Reset pagination whenever the filter or search changes so the user
  // always sees the first page of results for the new query.
  useEffect(() => { setDiscoverLimit(DISCOVER_PAGE_SIZE); }, [activeGenre, discoverQuery]);

  // ── Back navigation ──────────────────────────────────────────────────────
  const backHandlerRef = useRef<() => boolean>(() => false);
  useEffect(() => {
    backHandlerRef.current = () => {
      if (query)       { setQuery('');        return true; }
      if (activeType)  { setActiveType(null); return true; }
      if (activeGenre) { setActiveGenre(null); return true; }
      return false;
    };
  }, [query, activeType, activeGenre]);

  useEffect(() => {
    if (activePanel !== 'library') return;
    setBackHandler(() => backHandlerRef.current());
    return () => setBackHandler(null);
  }, [activePanel]);

  const allChords = getAllChords();
  const chord = useMemo(() => selectedChordId ? getChordById(selectedChordId) : null, [selectedChordId]);

  const relatedChords = useMemo(
    () => (chord && settings.chordAssistant && settings.assistantSmartSuggestions)
      ? getRelatedChords(chord).slice(0, 4) : [],
    [chord, settings.chordAssistant, settings.assistantSmartSuggestions]
  );

  const sampleChords = useMemo(() => {
    const all = getAllChords();
    const map: Partial<Record<string, NonNullable<ReturnType<typeof getChordById>>>> = {};
    for (const cat of CATEGORIES) {
      if (cat.type !== 'all') {
        const first = all.find(ch => ch.type === cat.type);
        if (first) map[cat.type] = first;
      }
    }
    return map;
  }, []);

  const searchResults = useMemo(() => {
    if (!query) return [];
    return searchChords(query).slice(0, 20);
  }, [query]);

  const filteredByType = useMemo(() => {
    if (!activeType || activeType === 'all') return [];
    const seen = new Set<string>();
    return allChords.filter(c => {
      if (c.type !== activeType) return false;
      const key = c.guitar.frets.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activeType, allChords]);

  const recentList = recentChords
    .map(id => getChordById(id)).filter(Boolean).slice(0, 5) as NonNullable<ReturnType<typeof getChordById>>[];
  const favoritesList = favorites
    .map(id => getChordById(id)).filter(Boolean).slice(0, 5) as NonNullable<ReturnType<typeof getChordById>>[];

  const activeCat   = CATEGORIES.find(c => c.type === activeType);
  const showSearch  = query.length > 0;
  const showType    = !showSearch && !!activeType && activeType !== 'all';
  const showDefault = !showSearch && !showType;
  const goBack      = () => setActiveType(null);

  // Pull current language so Discover descriptions can be shown in
  // Spanish when applicable. Fallback chain: Spanish map → English
  // description → empty. Search also matches against the localized
  // description so es users can search using Spanish words.
  const language = useChordStore(s => s.settings.language);
  const isSpanish = language === 'es';
  const describe = useCallback(
    (songId: string, fallback: string): string =>
      (isSpanish && SPANISH_DESCRIPTIONS[songId]) || fallback,
    [isSpanish],
  );
  const localizedGenre = useCallback(
    (g: Genre, fallback: string): string =>
      ((t.library as { genres?: Record<string, string> }).genres?.[g]) ?? fallback,
    [t.library],
  );

  const discoverSongs = useMemo(() => {
    let songs = activeGenre ? SONGS.filter(s => s.genre === activeGenre) : SONGS;
    if (discoverQuery.trim()) {
      const q = discoverQuery.toLowerCase();
      songs = songs.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        describe(s.id, s.description).toLowerCase().includes(q)
      );
    }
    return songs;
  }, [activeGenre, discoverQuery, describe]);

  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 220);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const renderChordDetail = () => {
    if (!chord) return null;

    const favorite = favorites.includes(chord.id);
    const notesStr = chord.notes.join(' - ');
    const typeStr = chord.type.charAt(0).toUpperCase() + chord.type.slice(1) + ' Chord';

    const handlePlayChord = () => {
      if (chordPlaying) {
        stopChordPlayback();
        setChordPlaying(false);
        return;
      }
      setChordPlaying(true);
      playChord(chord.guitar);
      setTimeout(() => setChordPlaying(false), 2800);
    };

    const handleAddToProgression = () => {
      addToProgression(chord.id);
    };

    const renderDetailDiagram = () => {
      const props = {
        chordName: chord.name,
        notes: chord.notes,
        intervals: chord.intervals,
        showNoteNames: settings.showNoteNames,
        showIntervals: settings.showIntervals,
        size: 'lg' as const,
      };
      if (settings.instrument === 'guitar') {
        return <GuitarDiagram chordData={chord.guitar} {...props} leftHanded={settings.leftHanded} />;
      } else if (settings.instrument === 'bass') {
        return <FourStringDiagram chordData={chord.guitar} {...props} instrument={settings.instrument} fiveString={settings.bassFiveString} />;
      } else {
        return <PianoDiagram chordData={chord.piano} {...props} />;
      }
    };

    return (
      <div className="flex-1 overflow-y-auto no-scrollbar p-6" style={{ background: 'var(--app-bg)' }}>
        <div className="max-w-xl mx-auto space-y-6">
          {/* Header & Title */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1" style={{ fontFamily: 'Manrope' }}>
                {t.chord.instruments[settings.instrument]}
              </p>
              <h2 className="text-3xl font-extrabold tracking-tighter text-[var(--c-text-primary)]" style={{ fontFamily: 'Manrope' }}>
                {chord.name.replace(/\s/g, '')}
              </h2>
              <p className="text-xs text-[var(--c-text-secondary)] mt-1" style={{ fontFamily: 'Inter' }}>
                {notesStr} ({typeStr})
              </p>
            </div>
            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handlePlayChord}
                className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all border ${
                  isLight 
                    ? 'border-zinc-200 hover:border-zinc-300 bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700' 
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-300'
                }`}
                title="Play chord"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: chordPlaying ? "'FILL' 1" : "'FILL' 0" }}>
                  {chordPlaying ? 'stop' : 'play_arrow'}
                </span>
              </button>
              <button
                onClick={() => toggleFavorite(chord.id)}
                className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all border ${
                  isLight 
                    ? `border-zinc-200 hover:border-zinc-300 bg-zinc-100 hover:bg-zinc-200/80 ${favorite ? 'text-rose-500' : 'text-zinc-500'}` 
                    : `border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 ${favorite ? 'text-rose-500' : 'text-zinc-400'}`
                }`}
                title="Toggle favorite"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: favorite ? "'FILL' 1" : "'FILL' 0" }}>
                  favorite
                </span>
              </button>
              <button
                onClick={handleAddToProgression}
                className={`h-10 px-4 rounded-full flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                  isLight 
                    ? 'border-zinc-200 hover:border-zinc-300 bg-zinc-100 hover:bg-zinc-200/80 text-zinc-750' 
                    : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 text-zinc-300'
                } text-xs font-bold uppercase tracking-wider`}
                style={{ fontFamily: 'Manrope' }}
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add
              </button>
            </div>
          </div>

          {/* Diagram Container */}
          <div className={`border rounded-2xl p-6 flex justify-center items-center ${isLight ? 'bg-white border-zinc-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' : 'border-zinc-900 bg-zinc-950/20'}`}>
            {renderDetailDiagram()}
          </div>

          {/* Voicings & Variations */}
          {settings.chordAssistant && settings.assistantSmartSuggestions && relatedChords.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[9.5px] font-extrabold uppercase tracking-widest text-zinc-500" style={{ fontFamily: 'Inter' }}>
                {t.chord.voicings}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {relatedChords.slice(0, 2).map(related => (
                  <button
                    key={related.id}
                    onClick={() => handleChordClick(related.id)}
                    className={`block text-left p-4 rounded-xl border transition-all cursor-pointer w-full relative ${
                      isLight 
                        ? 'border-zinc-200 bg-white hover:border-zinc-300 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' 
                        : 'border-zinc-900 bg-zinc-950/40 hover:border-zinc-800'
                    }`}
                  >
                    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                      <RelatedPlayBtn guitar={related.guitar} accent={accent} isLight={isLight} />
                    </div>
                    <span className="font-bold text-[var(--c-text-primary)] text-xs block mb-2" style={{ fontFamily: 'Manrope' }}>
                      {related.name}
                    </span>
                    <div className={`${isLight ? 'bg-zinc-100' : 'bg-black/40'} rounded-lg p-3`}>
                      <ChordDiagram data={related.guitar} accentFrom={accent.from} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Harmonic Context */}
          <div className="space-y-3">
            <h3 className="text-[9.5px] font-extrabold uppercase tracking-widest text-zinc-500" style={{ fontFamily: 'Inter' }}>
              {t.chord.harmonicContext}
            </h3>
            <div className={`border rounded-xl divide-y ${
              isLight 
                ? 'border-zinc-200 bg-zinc-50/50 divide-zinc-200/80' 
                : 'border-zinc-900 bg-zinc-950/20 divide-zinc-900/60'
            }`}>
              <div className="flex justify-between items-center p-3 text-xs">
                <span className="text-[var(--c-text-secondary)] font-medium">Interval Spacing</span>
                <span className="text-[var(--c-text-primary)] font-bold">{chord.intervals.join(' - ')}</span>
              </div>
              {settings.instrument === 'guitar' && (
                <div className="flex justify-between items-center p-3 text-xs">
                  <span className="text-[var(--c-text-secondary)] font-medium">Fingering</span>
                  <span className="text-[var(--c-text-primary)] font-bold">{chord.guitar.frets.map(f => f === -1 ? 'x' : f === 0 ? 'O' : f).join(' - ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isWebDesktop) {
    return (
      <div className="flex w-full h-full overflow-hidden bg-[var(--app-bg)]" style={{ position: 'relative' }}>
        {/* Left Column: Categories / Search / Discover list */}
        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`, height: '100%', overflow: 'hidden' }}>
          
          {/* Tabs header: Explore / Discover */}
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`, flexShrink: 0 }}>
            <div className={`flex p-0.5 rounded-lg gap-1 border ${isLight ? 'bg-zinc-200/50 border-zinc-200/80' : 'bg-zinc-950/80 border-zinc-900'}`}>
              {(['explore', 'discover'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setMainTab(tab); setQuery(''); setActiveType(null); }}
                  className={`flex-1 py-1.5 text-[10.5px] uppercase font-bold tracking-wider rounded-md border-none outline-none cursor-pointer transition-all ${
                    mainTab === tab 
                      ? (isLight ? 'bg-white text-zinc-900 shadow-sm font-extrabold' : 'bg-white text-black font-extrabold') 
                      : (isLight ? 'text-zinc-500 hover:text-zinc-900 bg-transparent' : 'text-zinc-500 hover:text-zinc-200 bg-transparent')
                  }`}
                  style={{ fontFamily: 'Manrope' }}
                >
                  {tab === 'explore' ? t.library.tabExplore : t.library.tabDiscover}
                </button>
              ))}
            </div>
          </div>

          {/* List Scrollable Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar" style={{ padding: '8px' }}>
            {mainTab === 'explore' ? (
              // EXPLORE TAB
              <div className="space-y-4">
                {/* Search */}
                <div style={{ padding: '0 4px 4px' }}>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" style={{ fontSize: '15px' }}>search</span>
                    <input
                      type="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={t.library.searchPlaceholder}
                      className={`w-full py-1.5 pl-8 pr-3 text-xs outline-none rounded-lg border ${
                        isLight 
                          ? 'bg-zinc-100/80 border-zinc-200/80 text-zinc-900 placeholder-zinc-400' 
                          : 'bg-zinc-950/60 border-zinc-900 text-white'
                      }`}
                      style={{ fontFamily: 'Inter' }}
                    />
                  </div>
                </div>

                {showSearch ? (
                  // Search results list
                  <div className="space-y-1">
                    <div style={{ padding: '2px 8px', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)' }}>
                      {t.library.results(searchResults.length)}
                    </div>
                    {searchResults.length === 0 ? (
                      <div style={{ padding: '16px 8px', color: 'var(--c-text-muted)', fontSize: '11px' }}>
                        {t.library.noResults(query)}
                      </div>
                    ) : (
                      searchResults.map(chord => {
                        const isActive = selectedChordId === chord.id;
                        return (
                          <button
                            key={chord.id}
                            onClick={() => handleChordClick(chord.id)}
                            className={`w-full px-3 py-2 rounded-lg text-left text-xs font-semibold truncate transition-all outline-none border-none cursor-pointer flex justify-between items-center ${
                              isActive 
                                ? (isLight ? 'bg-zinc-200 text-zinc-900 font-bold' : 'bg-zinc-100 text-[#030303] font-bold') 
                                : (isLight ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/40' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30')
                            }`}
                            style={{ fontFamily: 'Manrope' }}
                          >
                            <span>{chord.name}</span>
                            <span className="text-[9px] opacity-65 font-bold uppercase">{chord.type}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : showType && activeCat ? (
                  // Category chord list
                  <div className="space-y-1">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px 6px' }}>
                      <button
                        onClick={goBack}
                        className="w-6 h-6 rounded-full flex items-center justify-center border border-zinc-800 bg-zinc-950/40 text-zinc-300 cursor-pointer hover:border-zinc-700"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_back</span>
                      </button>
                      <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-primary)' }}>
                        {activeCat.label} ({filteredByType.length})
                      </span>
                    </div>
                    {filteredByType.map(chord => {
                      const isActive = selectedChordId === chord.id;
                      return (
                        <button
                          key={chord.id}
                          onClick={() => handleChordClick(chord.id)}
                          className={`w-full px-3 py-2 rounded-lg text-left text-xs font-semibold truncate transition-all outline-none border-none cursor-pointer flex justify-between items-center ${
                            isActive 
                              ? (isLight ? 'bg-zinc-200 text-zinc-900 font-bold' : 'bg-zinc-100 text-[#030303] font-bold') 
                              : (isLight ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/40' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30')
                          }`}
                          style={{ fontFamily: 'Manrope' }}
                        >
                          <span>{chord.name}</span>
                          <span className="text-[9px] opacity-65 font-bold uppercase">{chord.notes.join(' · ')}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  // Categories list (Explore Default)
                  <div className="space-y-3">
                    <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {CATEGORIES.map(cat => {
                        const labelText = (t.library.cats as Record<string, { label: string; desc: string }>)[cat.type]?.label ?? cat.label;
                        return (
                          <button
                            key={cat.type}
                            onClick={() => setActiveType(cat.type)}
                            className="w-full px-3 py-2 rounded-lg text-left text-xs font-semibold transition-all outline-none border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 cursor-pointer flex justify-between items-center"
                            style={{ fontFamily: 'Manrope' }}
                          >
                            <span className="text-zinc-300 font-bold">{labelText}</span>
                            <span className="material-symbols-outlined text-zinc-600" style={{ fontSize: '14px' }}>chevron_right</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // DISCOVER TAB
              <div className="space-y-4">
                {/* Search */}
                <div style={{ padding: '0 4px 4px' }}>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" style={{ fontSize: '15px' }}>search</span>
                    <input
                      type="text"
                      value={discoverQuery}
                      onChange={e => setDiscoverQuery(e.target.value)}
                      placeholder="Search songs..."
                      className={`w-full py-1.5 pl-8 pr-3 text-xs outline-none rounded-lg border ${
                        isLight 
                          ? 'bg-zinc-100/80 border-zinc-200/80 text-zinc-900 placeholder-zinc-400' 
                          : 'bg-zinc-950/60 border-zinc-900 text-white'
                      }`}
                      style={{ fontFamily: 'Inter' }}
                    />
                  </div>
                </div>

                {/* Genre chips row */}
                <div style={{ padding: '0 4px' }} className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setActiveGenre(null)}
                    className={`px-2 py-1 rounded-full font-bold text-[9px] uppercase tracking-wider transition-all border outline-none cursor-pointer ${
                      !activeGenre 
                        ? (isLight ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-black border-white') 
                        : (isLight ? 'bg-zinc-200/65 text-zinc-600 border-zinc-200/80 hover:text-zinc-900 hover:bg-zinc-200' : 'bg-zinc-900/60 text-zinc-400 border-zinc-900 hover:text-zinc-200')
                    }`}
                    style={{ fontFamily: 'Manrope' }}
                  >
                    All
                  </button>
                  {Object.entries(GENRE_META).map(([key, meta]) => {
                    const isActive = activeGenre === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveGenre(isActive ? null : key as Genre)}
                        className={`px-2 py-1 rounded-full font-bold text-[9px] uppercase tracking-wider transition-all border outline-none cursor-pointer ${
                          isActive 
                            ? (isLight ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-800 text-white border-zinc-700') 
                            : (isLight ? 'bg-transparent text-zinc-600 border-zinc-200/80 hover:text-zinc-900 hover:border-zinc-300' : 'bg-transparent text-zinc-500 border-zinc-900 hover:text-zinc-400')
                        }`}
                        style={{ fontFamily: 'Manrope' }}
                      >
                        {localizedGenre(key as Genre, meta.label)}
                      </button>
                    );
                  })}
                </div>

                {/* Discover songs list */}
                <div style={{ padding: '0 4px' }} className="space-y-2">
                  {discoverSongs.length === 0 ? (
                    <div style={{ padding: '24px 8px', color: 'var(--c-text-muted)', fontSize: '11px', textAlign: 'center' }}>
                      No songs found
                    </div>
                  ) : (
                    discoverSongs.map(song => {
                      const meta = GENRE_META[song.genre];
                      return (
                        <div
                          key={song.id}
                          className="p-3 rounded-lg border border-zinc-900 bg-zinc-950/40 space-y-2"
                        >
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--c-text-primary)', fontFamily: 'Manrope' }} className="truncate">
                                {song.title}
                              </span>
                              <span style={{ fontSize: '8px', color: meta.color, background: `${meta.color}15`, border: `1px solid ${meta.color}30`, padding: '1px 4px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
                                {localizedGenre(song.genre, meta.label)}
                              </span>
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--c-text-secondary)', fontFamily: 'Inter' }}>
                              {song.artist}
                            </div>
                          </div>
                          {/* Chord progression pills clickable */}
                          <div className="flex flex-wrap gap-1">
                            {song.progression.map((chordName, i) => {
                              const displayId = allChords.find(c => c.name.toLowerCase().replace(/\s/g,'') === chordName.toLowerCase().replace(/\s/g,''))?.id;
                              return (
                                <button
                                  key={i}
                                  onClick={() => displayId && handleChordClick(displayId)}
                                  disabled={!displayId}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border-none outline-none ${
                                    displayId 
                                      ? 'bg-[var(--app-surface-hover)] text-[var(--c-text-primary)] hover:bg-[var(--c-accent)] hover:text-white cursor-pointer' 
                                      : 'bg-[var(--app-surface)] text-[var(--c-text-muted)] cursor-not-allowed'
                                  }`}
                                  style={{ fontFamily: 'Manrope' }}
                                >
                                  {chordName}
                                </button>
                              );
                            })}
                          </div>
                          
                          {/* Mobile Practice trigger row */}
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-900/60">
                            <span style={{ fontSize: '9px', color: 'var(--c-text-muted)', fontFamily: 'Inter' }}>
                              {song.bpm ? `${song.bpm} BPM` : ''} {song.capo ? `· Capo ${song.capo}` : ''}
                            </span>
                            <button
                              onClick={() => setActivePracticeSong(song)}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', fontSize: '9px', fontWeight: 800,
                                background: 'var(--c-accent)', border: 'none', color: '#ffffff',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                                fontFamily: 'Manrope'
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>play_circle</span>
                              {isSpanish ? 'Práctica' : 'Practice'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chord Detail, Category Grid, or Empty State */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative', background: 'var(--app-bg)' }}>
          {chord ? (
            renderChordDetail()
          ) : showSearch && searchResults.length > 0 ? (
            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
              <div className="mb-6">
                <h3 className="text-sm font-extrabold text-[var(--c-text-primary)] uppercase tracking-wider" style={{ fontFamily: 'Manrope' }}>
                  Search Results Catalog
                </h3>
                <p className="text-xs text-zinc-500 mt-1" style={{ fontFamily: 'Inter' }}>
                  Matches for "{query}"
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {searchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleChordClick(c.id)}
                    className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 transition-all text-left cursor-pointer flex flex-col justify-between h-[120px]"
                  >
                    <div>
                      <span className="font-bold text-[var(--c-text-primary)] text-xs block" style={{ fontFamily: 'Manrope' }}>
                        {c.name}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-1" style={{ fontFamily: 'Inter' }}>
                        {c.notes.join(' · ')}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                      {c.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : activeType && activeType !== 'all' && filteredByType.length > 0 ? (
            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
              <div className="mb-6">
                <h3 className="text-sm font-extrabold text-[var(--c-text-primary)] uppercase tracking-wider" style={{ fontFamily: 'Manrope' }}>
                  {activeCat?.label || 'Chords'} Catalog
                </h3>
                <p className="text-xs text-zinc-500 mt-1" style={{ fontFamily: 'Inter' }}>
                  Select a chord to view fretboard diagrams and harmonic details.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredByType.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleChordClick(c.id)}
                    className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 hover:border-zinc-800 transition-all text-left cursor-pointer flex flex-col justify-between h-[120px]"
                  >
                    <div>
                      <span className="font-bold text-[var(--c-text-primary)] text-xs block" style={{ fontFamily: 'Manrope' }}>
                        {c.name}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-1" style={{ fontFamily: 'Inter' }}>
                        {c.notes.join(' · ')}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                      {c.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <WebEmptyState message="Select a chord to view details" icon="music_note" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden app-bg" style={{ position: 'relative' }}>

      {/* ── Scroll-to-top button (Discover tab) — always mounted, animated via transition ── */}
      <button
        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
        style={{
          position: 'absolute',
          bottom: '88px',
          right: '20px',
          zIndex: 50,
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 6px 28px ${accent.to}60, 0 2px 8px rgba(0,0,0,0.30)`,
          opacity: mainTab === 'discover' && showScrollTop ? 1 : 0,
          transform: mainTab === 'discover' && showScrollTop
            ? 'scale(1) translateY(0)'
            : 'scale(0.55) translateY(18px)',
          pointerEvents: mainTab === 'discover' && showScrollTop ? 'auto' : 'none',
          transition: 'opacity 300ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 300ms ease',
        }}>
        <span
          className="material-symbols-outlined"
          style={{ color: '#fff', fontSize: '24px', fontVariationSettings: "'FILL' 1" }}>
          keyboard_arrow_up
        </span>
      </button>

      {!isWebDesktop && (
        <header className="flex-none px-5 pt-6 pb-3 app-bg"
          style={{
            display: 'flex', alignItems: 'center', gap: '0',
            transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
          }}>
          {/* Back button — slides in/out to animate the logo position */}
          <div style={{
            overflow: 'hidden',
            flexShrink: 0,
            width: (mainTab === 'explore' && showType) ? '46px' : '0px',
            opacity: (mainTab === 'explore' && showType) ? 1 : 0,
            transition: 'width 300ms cubic-bezier(0.34,1.1,0.64,1), opacity 200ms ease',
          }}>
            <button onClick={goBack} data-testid="back-button" className="btn-smooth"
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--app-surface-high)',
                border: '1px solid rgba(128,128,128,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 500ms cubic-bezier(0.4,0,0.2,1)',
              }} aria-label="Back">
              <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: '18px' }}>arrow_back</span>
            </button>
          </div>
          <h1
            style={{
              fontSize: '14px', fontWeight: 700,
              color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em',
              display: 'flex', alignItems: 'center', gap: '7px',
              margin: 0,
            }}>
            <AppModeMenuLogo />
          </h1>
        </header>
      )}



      {/* ── Tab bar: Explore | Discover ── */}
      {(mainTab === 'explore' ? showDefault || showSearch : true) && (
        <div className="flex-none px-5 pb-3" style={{ paddingTop: isWebDesktop ? '20px' : '0' }}>
          {/* Title */}
          <AnimatedAppHeader
            title={mainTab === 'explore' ? t.library.title : t.library.tabDiscover}
            subtitle={mainTab === 'explore'
              ? t.library.subtitle
              : (t.library as { discoverSubtitle?: string }).discoverSubtitle ?? 'Real songs, iconic progressions, filtered by genre.'}
          />

          {/* Explore / Discover switcher */}
          <div className="flex mb-4 p-1 rounded-xl gap-1" style={{ background: 'var(--app-surface)' }}>
            {(['explore', 'discover'] as const).map(tab => (
              <button key={tab} onClick={() => { setMainTab(tab); setQuery(''); setActiveType(null); }}
                className="btn-smooth flex-1 py-2 text-sm font-bold capitalize"
                style={{
                  borderRadius: '0.625rem',
                  fontFamily: 'Manrope',
                  fontSize: '13px',
                  color: mainTab === tab ? '#0d0e0f' : '#acabaa',
                  background: mainTab === tab ? accent.from : 'transparent',
                  transition: 'background-color 200ms ease, color 200ms ease',
                }}>
                {tab === 'explore' ? t.library.tabExplore : t.library.tabDiscover}
              </button>
            ))}
          </div>

          {/* Search (Explore only) */}
          {mainTab === 'explore' && (
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-secondary)', fontSize: '17px' }}>search</span>
              <input data-testid="search-input" type="search" value={query}
                onChange={e => setQuery(e.target.value)} placeholder={t.library.searchPlaceholder}
                className="w-full py-2.5 pl-10 pr-4 text-sm outline-none"
                style={{
                  background: 'var(--app-surface-low)',
                  border: '1px solid rgba(72,72,72,0.15)',
                  borderRadius: '0.5rem', color: 'var(--c-text-primary)', fontFamily: 'Inter',
                  transition: 'border-color 200ms ease, background-color 700ms cubic-bezier(0.4,0,0.2,1)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = `${accent.to}66`; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(72,72,72,0.15)'; }} />
            </div>
          )}
        </div>
      )}

      {mainTab === 'explore' && showType && activeCat && (
        <div className="flex-none pb-5 pt-1" style={{ paddingLeft: 20, paddingRight: 24, paddingTop: isWebDesktop ? '20px' : '4px' }}>
          {isWebDesktop && (
            <button
              onClick={goBack}
              data-testid="back-button"
              className="btn-smooth mb-3"
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--app-surface-high)',
                border: '1px solid rgba(128,128,128,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 500ms cubic-bezier(0.4,0,0.2,1)',
                cursor: 'pointer',
              }}
              aria-label="Back"
            >
              <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: '18px' }}>arrow_back</span>
            </button>
          )}
          <h2 className="font-extrabold tracking-tighter leading-none" style={{ fontSize: '2rem', color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>
            {activeCat.label}
          </h2>
          <p style={{ color: activeCat.color, fontFamily: 'Inter', fontSize: '12px', marginTop: '3px', fontWeight: 600 }}>
            {t.library.chordCount(filteredByType.length)}
          </p>
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar" style={{ willChange: 'transform', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'], overscrollBehavior: 'contain', paddingBottom: 'var(--content-bottom-pad)' }}>
       <div key={mainTab} className="library-tab-fade">

        {/* ══ EXPLORE: Search results ══ */}
        {mainTab === 'explore' && showSearch && (
          <div className="px-5 pb-32 spring-in">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
              {t.library.results(searchResults.length)}
            </p>
            {searchResults.length === 0 ? (
              <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px' }}>{t.library.noResults(query)}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {searchResults.map(chord => (
                  <ChordCard key={chord.id} chord={chord}
                    isSelected={selectedChordId === chord.id}
                    onClick={() => handleChordClick(chord.id)} accent={accent} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ EXPLORE: Category chord grid ══ */}
        {mainTab === 'explore' && showType && (
          <div key={activeType} className="px-5 pb-32 content-enter">
            <div className="grid grid-cols-2 gap-3">
              {filteredByType.map(chord => (
                <ChordCard key={chord.id} chord={chord}
                  isSelected={selectedChordId === chord.id}
                  onClick={() => handleChordClick(chord.id)} accent={accent} />
              ))}
            </div>
          </div>
        )}

        {/* ══ EXPLORE: Default bento grid ══ */}
        {mainTab === 'explore' && showDefault && (
          <div key="default-grid" className="flex flex-col justify-between h-full pb-32 content-enter">
            <div className="flex-1 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <StaggeredReveal staggerInterval={40}>
                  {CATEGORIES.map(cat => (
                  <button key={cat.type} data-testid={`category-${cat.type}`}
                    onClick={() => setActiveType(cat.type)}
                    className={`card-hover relative overflow-hidden text-left p-5 ${cat.wide ? 'col-span-2' : ''}`}
                    style={{
                      background: 'var(--app-surface)', borderRadius: '1.5rem',
                      minHeight: cat.wide ? '90px' : '110px',
                      transition: 'background-color 200ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}>
                    <div className="relative z-10" style={{ paddingRight: '68px' }}>
                      <h3 className="font-bold" style={{ color: 'var(--c-text-primary)', fontSize: '15px', fontFamily: 'Manrope' }}>{(t.library.cats as Record<string, { label: string; desc: string }>)[cat.type]?.label ?? cat.label}</h3>
                      <p style={{ color: 'var(--c-text-secondary)', fontSize: '10px', fontFamily: 'Inter', marginTop: '2px' }}>{(t.library.cats as Record<string, { label: string; desc: string }>)[cat.type]?.desc ?? cat.desc}</p>
                    </div>
                    {cat.wide && !cat.noDecor && (
                      <BigInstrumentDecor instrument={settings.instrument} accentFrom={accent.from} />
                    )}
                    {(!cat.wide || cat.noDecor) && sampleChords[cat.type] && (
                      <div style={{
                        position: 'absolute', right: '6px', top: '50%',
                        transform: 'translateY(-50%)',
                        opacity: isDark ? 0.30 : 0.55,
                        pointerEvents: 'none', width: '72px', height: '80px',
                        maskImage: 'linear-gradient(to left, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                        WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                      }}>
                        <MiniChordPreview
                          frets={sampleChords[cat.type]!.guitar.frets}
                          baseFret={sampleChords[cat.type]!.guitar.baseFret}
                          barres={sampleChords[cat.type]!.guitar.barres}
                          isDark={isDark}
                        />
                      </div>
                    )}
                  </button>
                ))}
              </StaggeredReveal>
            </div>
          </div>

            {/* Recent / Favorites strip */}
            {(recentList.length > 0 || favoritesList.length > 0) && (
              <div className="flex-none px-5 pb-2">
                {recentList.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>{t.library.recent}</h4>
                    <div className="scroll-fade-container">
                      <div className={`scroll-fade-content flex gap-2 overflow-x-auto no-scrollbar pb-1 ${recentFadeClass}`} ref={recentScrollRef}>
                        {recentList.map(chord => (
                        <button key={chord.id} onClick={() => handleChordClick(chord.id)}
                          className="btn-smooth flex-none"
                          style={{
                            width: '76px',
                            padding: '9px 8px 7px',
                            background: selectedChordId === chord.id ? `${accent.to}20` : 'var(--app-surface)',
                            borderRadius: '1rem',
                            border: selectedChordId === chord.id ? `1.5px solid ${accent.to}33` : '1px solid rgba(72,72,72,0.1)',
                            display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '5px',
                            transition: 'background-color 200ms ease, border-color 200ms ease',
                          }}>
                          <p style={{ color: selectedChordId === chord.id ? accent.from : 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '12px', letterSpacing: '-0.02em', lineHeight: 1, textAlign: 'left' }}>
                            {chord.name.replace(/\s/g, '')}
                          </p>
                          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '4px 4px 2px' }}>
                            <ChordDiagram data={chord.guitar} accentFrom={selectedChordId === chord.id ? accent.from : accent.from} />
                          </div>
                        </button>
                      ))}
                      </div>
                    </div>
                  </div>
                )}
                {favoritesList.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>{t.library.saved}</h4>
                    <div className="scroll-fade-container">
                      <div className={`scroll-fade-content flex gap-2 overflow-x-auto no-scrollbar pb-1 ${favoritesFadeClass}`} ref={favoritesScrollRef}>
                        {favoritesList.map(chord => (
                        <button key={chord.id} onClick={() => handleChordClick(chord.id)}
                          className="btn-smooth flex-none"
                          style={{
                            width: '76px',
                            padding: '9px 8px 7px',
                            background: selectedChordId === chord.id ? `${accent.to}20` : 'var(--app-surface)',
                            borderRadius: '1rem',
                            border: selectedChordId === chord.id ? `1.5px solid ${accent.to}33` : '1px solid rgba(72,72,72,0.1)',
                            display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '5px',
                            transition: 'background-color 200ms ease, border-color 200ms ease',
                          }}>
                          <p style={{ color: selectedChordId === chord.id ? accent.from : 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '12px', letterSpacing: '-0.02em', lineHeight: 1, textAlign: 'left' }}>
                            {chord.name.replace(/\s/g, '')}
                          </p>
                          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '4px 4px 2px' }}>
                            <ChordDiagram data={chord.guitar} accentFrom={accent.from} />
                          </div>
                        </button>
                      ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ DISCOVER ══ */}
        {mainTab === 'discover' && (
          <div className="pb-32 spring-in">

            {/* Search bar */}
            <div className="px-5 mb-4">
              <div className="flex items-center gap-3 px-4"
                style={{
                  background: 'var(--app-surface)',
                  borderRadius: '1rem',
                  border: '1px solid rgba(72,72,72,0.12)',
                  height: '44px',
                }}>
                <span className="material-symbols-outlined flex-none" style={{ color: 'var(--c-text-secondary)', fontSize: '18px' }}>search</span>
                <input
                  type="text"
                  value={discoverQuery}
                  onChange={e => setDiscoverQuery(e.target.value)}
                  placeholder={(t.library as { discoverSearchPlaceholder?: string }).discoverSearchPlaceholder ?? 'Search songs or artists…'}
                  className="flex-1 bg-transparent outline-none"
                  style={{
                    color: 'var(--c-text-primary)',
                    fontFamily: 'Inter',
                    fontSize: '14px',
                    caretColor: accent.from,
                  }}
                />
                {discoverQuery && (
                  <button onClick={() => setDiscoverQuery('')}
                    className="flex-none btn-smooth"
                    style={{ color: 'var(--c-text-secondary)', lineHeight: 1 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Genre filter chips */}
            <div className="scroll-fade-container px-5 mb-5">
              <div className={`scroll-fade-content flex gap-2 overflow-x-auto no-scrollbar pb-2 ${genreFadeClass}`} ref={genreScrollRef}>
                <button
                  onClick={() => setActiveGenre(null)}
                  className="btn-smooth flex-none px-4 py-2 font-bold text-xs"
                  style={{
                    borderRadius: '9999px', fontFamily: 'Manrope',
                    background: !activeGenre ? accent.from : 'var(--app-surface)',
                    color: !activeGenre ? '#0d0e0f' : '#acabaa',
                    border: !activeGenre ? 'none' : '1px solid rgba(72,72,72,0.15)',
                    transition: 'background 200ms ease, color 200ms ease',
                  }}>
                  {t.library.allGenres}
                </button>
                {Object.entries(GENRE_META).map(([key, meta]) => {
                  const isActive = activeGenre === key;
                  return (
                    <button key={key}
                      onClick={() => setActiveGenre(isActive ? null : key as Genre)}
                      className="btn-smooth flex-none px-4 py-2 font-bold text-xs"
                      style={{
                        borderRadius: '9999px', fontFamily: 'Manrope',
                        background: isActive ? `${meta.color}22` : 'var(--app-surface)',
                        color: isActive ? meta.color : '#acabaa',
                        border: isActive ? `1px solid ${meta.color}55` : '1px solid rgba(72,72,72,0.15)',
                        transition: 'background 200ms ease, color 200ms ease, border-color 200ms ease',
                      }}>
                      {localizedGenre(key as Genre, meta.label)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Song count */}
            <div className="px-5 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
                {((t.library as { songCount?: (s: number, t: number) => string }).songCount?.(
                  Math.min(discoverLimit, discoverSongs.length),
                  discoverSongs.length,
                ) ?? `${Math.min(discoverLimit, discoverSongs.length)} / ${discoverSongs.length} song${discoverSongs.length !== 1 ? 's' : ''}`)}
                {activeGenre ? ` · ${localizedGenre(activeGenre, GENRE_META[activeGenre].label)}` : ''}
                {discoverQuery.trim() ? ` · "${discoverQuery.trim()}"` : ''}
              </p>
            </div>

            {/* Song cards */}
            <div className="px-5 space-y-3">
              {discoverSongs.length === 0 && (
                <div className="py-12 flex flex-col items-center gap-3" style={{ color: 'var(--c-text-secondary)' }}>
                  <EmptyStateLottie app="chordex" size={52} isLight={isLight} style={{ marginBottom: 2 }} />
                  <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '15px', color: 'var(--c-text-primary)' }}>{(t.library as { noSongsFound?: string }).noSongsFound ?? 'No songs found'}</p>
                  <p style={{ fontFamily: 'Inter', fontSize: '13px', textAlign: 'center', maxWidth: '220px' }}>
                    {(t.library as { noSongsHint?: string }).noSongsHint ?? 'Try a different search term or clear the filter.'}
                  </p>
                  <button onClick={() => { setDiscoverQuery(''); setActiveGenre(null); }}
                    className="btn-smooth mt-2 px-5 py-2 rounded-full font-bold text-xs"
                    style={{ background: accent.from, color: '#0d0e0f', fontFamily: 'Manrope' }}>
                    {(t.library as { clearSearch?: string }).clearSearch ?? 'Clear search'}
                  </button>
                </div>
              )}
              {discoverSongs.slice(0, discoverLimit).map(song => {
                const meta = GENRE_META[song.genre];
                return (
                  <div key={song.id}
                    style={{
                      background: 'var(--app-surface)',
                      borderRadius: '1.25rem',
                      padding: '16px',
                      border: '1px solid rgba(72,72,72,0.08)',
                      transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
                    }}>
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold leading-tight" style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontSize: '15px' }}>
                          {song.title}
                        </h3>
                        <p className="font-semibold" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '12px', marginTop: '1px' }}>
                          {song.artist}{song.era ? ` · ${song.era}` : ''}
                        </p>
                      </div>
                      {/* Genre badge */}
                      <span className="flex-none px-2.5 py-1 text-[10px] font-bold rounded-full"
                        style={{
                          background: `${meta.color}18`,
                          color: meta.color,
                          fontFamily: 'Manrope',
                          border: `1px solid ${meta.color}33`,
                        }}>
                        {localizedGenre(song.genre, meta.label)}
                      </span>
                    </div>

                    {/* Chord progression pills */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {song.progression.map((chordName, i) => (
                        <span key={i}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '9999px',
                            background: 'var(--app-surface-high)',
                            color: 'var(--c-text-primary)',
                            fontFamily: 'Manrope',
                            fontSize: '12px',
                            fontWeight: 700,
                            transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
                          }}>
                          {chordName}
                        </span>
                      ))}
                    </div>

                    {/* Roman numeral label */}
                    <p className="text-[10px] font-bold mb-2" style={{ color: meta.color, fontFamily: 'Manrope', letterSpacing: '0.03em' }}>
                      {song.progressionLabel}
                    </p>

                    {/* Description (localized — Spanish when language is es) */}
                    <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '12px', lineHeight: '1.5' }}>
                      {describe(song.id, song.description)}
                    </p>

                    {/* Key + BPM + Capo + Start Practice button */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-900/40">
                      <div className="flex gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                          style={{ background: 'var(--app-surface-low)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
                          {(t.library as { keyOf?: (k: string) => string }).keyOf?.(song.key) ?? `Key of ${song.key}`}
                        </span>
                        {song.bpm && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                            style={{ background: 'var(--app-surface-low)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
                            {(t.library as { bpmShort?: (n: number) => string }).bpmShort?.(song.bpm) ?? `${song.bpm} BPM`}
                          </span>
                        )}
                        {song.capo !== undefined && song.capo > 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                            style={{ background: 'var(--app-surface-low)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
                            Capo {song.capo}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setActivePracticeSong(song)}
                        style={{
                          padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 800,
                          background: 'var(--c-accent)', border: 'none', color: '#ffffff',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                          fontFamily: 'Manrope'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>play_circle</span>
                        {t.library.startPractice}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Load more — shown when there are more songs to reveal */}
              {discoverLimit < discoverSongs.length && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setDiscoverLimit(n => n + DISCOVER_PAGE_SIZE)}
                    className="btn-smooth px-6 py-3 font-bold"
                    style={{
                      borderRadius: '9999px',
                      background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                      color: '#0d0e0f',
                      fontFamily: 'Manrope',
                      fontSize: '13px',
                      letterSpacing: '-0.01em',
                      boxShadow: `0 4px 18px ${accent.to}33`,
                      display: 'flex', alignItems: 'center', gap: '8px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>expand_more</span>
                    {(t.library as { loadMore?: (n: number) => string }).loadMore?.(Math.min(DISCOVER_PAGE_SIZE, discoverSongs.length - discoverLimit)) ?? `Load ${Math.min(DISCOVER_PAGE_SIZE, discoverSongs.length - discoverLimit)} more`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
       </div>
      </div>
      {activePracticeSong && (
        <SongPracticeView
          song={activePracticeSong}
          onClose={() => setActivePracticeSong(null)}
        />
      )}
    </div>
  );
}

// ── Chord list item ───────────────────────────────────────────
function ChordListItem({
  chord, isSelected, onClick, tag, accent, showDiagram = false,
}: {
  chord: NonNullable<ReturnType<typeof getChordById>>;
  isSelected: boolean;
  onClick: () => void;
  tag?: string;
  accent: { from: string; to: string; mid: string };
  showDiagram?: boolean;
}) {
  const typeColor =
    chord.type === 'major' ? accent.from :
    chord.type === 'minor' ? '#bb5551' :
    '#9d9da6';

  return (
    <div role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className="card-hover flex items-center gap-3 cursor-pointer"
      style={{
        padding: showDiagram ? '10px 14px' : '14px 16px',
        background: isSelected ? `${accent.to}18` : 'var(--app-surface-high)',
        borderRadius: '1rem',
        border: isSelected ? `1px solid ${accent.to}33` : '1px solid rgba(72,72,72,0.05)',
        transition: 'background-color 200ms ease, border-color 200ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
      {showDiagram ? (
        <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '0.625rem', padding: '5px 4px', flexShrink: 0, width: '64px', transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)' }}>
          <ChordDiagram data={chord.guitar} accentFrom={accent.from} />
        </div>
      ) : (
        <div style={{
          width: '44px', height: '44px', background: 'var(--app-surface-lowest)',
          borderRadius: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: typeColor, fontSize: '11px', fontFamily: 'Manrope', fontWeight: 900, flexShrink: 0,
          transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
        }}>
          {chord.name.replace(/\s/g, '')}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>{chord.name}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
          {chord.type.toUpperCase()}{tag ? ` · ${tag}` : ''}
        </p>
      </div>
      {showDiagram && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
          <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '10px' }}>{chord.notes.join(' ')}</p>
          <span className="material-symbols-outlined" style={{ color: 'var(--c-text-muted)', fontSize: '14px' }}>chevron_right</span>
        </div>
      )}
      {!showDiagram && (
        <span className="material-symbols-outlined flex-none" style={{ color: 'var(--c-text-secondary)', fontSize: '18px' }}>chevron_right</span>
      )}
    </div>
  );
}

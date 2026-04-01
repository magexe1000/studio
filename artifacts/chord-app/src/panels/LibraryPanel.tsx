import React, { useState, useMemo, useRef, useEffect } from 'react';
import { getAllChords, searchChords, getChordById, type ChordType } from '../data/chords';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { SONGS, GENRE_META, type Genre } from '../data/progressions';
import { useScrollHide } from '../lib/navScroll';
import ChordDiagram from '../components/ChordDiagram';
import { useT } from '../lib/useT';
import { ChordexLogo } from '../components/ChordexLogo';

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

  // ukulele
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
function MiniChordPreview({ frets, baseFret = 1, barres = [] }: {
  frets: number[];
  baseFret?: number;
  barres?: MiniBarre[];
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Nut / top line */}
      <line x1={padL} y1={padT} x2={W - padR} y2={padT}
        stroke="rgba(255,255,255,0.65)" strokeWidth={isOpenPosition ? 3 : 1.2} strokeLinecap="round" />
      {/* Fret lines */}
      {Array.from({ length: fretCount }).map((_, i) => (
        <line key={i} x1={padL} y1={padT + (i + 1) * fh} x2={W - padR} y2={padT + (i + 1) * fh}
          stroke="rgba(255,255,255,0.22)" strokeWidth={0.8} />
      ))}
      {/* String lines */}
      {Array.from({ length: n }).map((_, i) => (
        <line key={i} x1={padL + i * fw} y1={padT} x2={padL + i * fw} y2={padT + fretCount * fh}
          stroke="rgba(255,255,255,0.28)" strokeWidth={i === 0 || i === n - 1 ? 1 : 0.65} />
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
            rx={r} fill="rgba(255,255,255,0.80)"
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
        return <circle key={i} cx={padL + i * fw} cy={padT + (d - 0.5) * fh} r={r} fill="rgba(255,255,255,0.80)" />;
      })}
      {/* Open / mute indicators above nut */}
      {frets.slice(0, n).map((fret, i) => {
        const cx = padL + i * fw;
        if (fret === 0) return <circle key={i} cx={cx} cy={padT - 5.5} r={2.2} stroke="rgba(255,255,255,0.42)" strokeWidth={0.9} fill="none" />;
        if (fret === -1) {
          const dd = 1.8;
          return (
            <g key={i}>
              <line x1={cx - dd} y1={padT - 7 - dd} x2={cx + dd} y2={padT - 7 + dd} stroke="rgba(255,255,255,0.30)" strokeWidth={1} />
              <line x1={cx + dd} y1={padT - 7 - dd} x2={cx - dd} y2={padT - 7 + dd} stroke="rgba(255,255,255,0.30)" strokeWidth={1} />
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

// ── Chord card (2-col grid view) ──────────────────────────────
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
      }}>
      {/* Chord name */}
      <p style={{
        color: isSelected ? accent.from : 'var(--c-text-primary)',
        fontFamily: 'Manrope', fontWeight: 800, fontSize: '16px',
        letterSpacing: '-0.02em', lineHeight: 1,
        transition: 'color 200ms ease',
      }}>{chord.name}</p>
      {/* Fretboard diagram */}
      <div style={{
        background: 'rgba(255,255,255,0.035)',
        borderRadius: '0.625rem',
        padding: '8px 8px 4px',
        transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        <ChordDiagram data={chord.guitar} accentFrom={accent.from} />
      </div>
      {/* Notes */}
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
  const { selectedChordId, recentChords, favorites, selectChord, settings } = useChordStore();
  const accent = ACCENT_COLORS[settings.accentColor];
  const t = useT();

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);

  // Library tab state
  const [mainTab, setMainTab]     = useState<'explore' | 'discover'>('explore');
  const [query, setQuery]         = useState('');
  const [activeType, setActiveType] = useState<ChordType | 'all' | null>(null);

  // Discover state
  const [activeGenre, setActiveGenre]   = useState<Genre | null>(null);
  const [discoverQuery, setDiscoverQuery] = useState('');

  const allChords = getAllChords();

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

  const discoverSongs = useMemo(() => {
    let songs = activeGenre ? SONGS.filter(s => s.genre === activeGenre) : SONGS;
    if (discoverQuery.trim()) {
      const q = discoverQuery.toLowerCase();
      songs = songs.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return songs;
  }, [activeGenre, discoverQuery]);

  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 220);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden app-bg" style={{ position: 'relative', paddingBottom: 'calc(max(10px, env(safe-area-inset-bottom)) + 76px)' }}>

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

      {/* ── Back button (category view) ── */}
      {mainTab === 'explore' && showType && (
        <button onClick={goBack} data-testid="back-button" className="btn-smooth"
          style={{
            position: 'absolute', top: '18px', left: '16px', zIndex: 40,
            width: '40px', height: '40px', borderRadius: '50%',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            background: 'rgba(31,32,32,0.75)',
            border: '1px solid rgba(72,72,72,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.30)',
            animation: 'spring-in 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }} aria-label="Back">
          <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: '20px' }}>arrow_back</span>
        </button>
      )}

      {/* ── Fixed header ── */}
      <header className="flex-none px-6 pt-6 pb-3 app-bg"
        style={{ transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)' }}>
        <h1 className="text-base font-bold"
          style={{
            color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em',
            paddingLeft: (mainTab === 'explore' && showType) ? '52px' : '0',
            transition: 'padding-left 280ms cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex', alignItems: 'center', gap: '7px',
          }}>
          <ChordexLogo />
          {t.appName}
        </h1>
      </header>

      {/* ── Tab bar: Explore | Discover ── */}
      {(mainTab === 'explore' ? showDefault || showSearch : true) && (
        <div className="flex-none px-5 pb-3">
          {/* Title */}
          <h2 className="font-extrabold tracking-tighter leading-none mb-3"
            style={{ fontSize: '2.6rem', color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>
            {mainTab === 'explore' ? t.library.title : t.library.tabDiscover}
          </h2>
          <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '12px', marginBottom: '14px' }}>
            {mainTab === 'explore'
              ? t.library.subtitle
              : 'Real songs, iconic progressions, filtered by genre.'}
          </p>

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

      {/* ── Category header (inside a chord type) ── */}
      {mainTab === 'explore' && showType && activeCat && (
        <div className="flex-none px-6 pb-5 pt-1" style={{ paddingLeft: '68px' }}>
          <h2 className="font-extrabold tracking-tighter leading-none" style={{ fontSize: '2rem', color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>
            {activeCat.label}
          </h2>
          <p style={{ color: activeCat.color, fontFamily: 'Inter', fontSize: '12px', marginTop: '3px', fontWeight: 600 }}>
            {t.library.chordCount(filteredByType.length)}
          </p>
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">

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
                    onClick={() => selectChord(chord.id)} accent={accent} />
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
                  onClick={() => selectChord(chord.id)} accent={accent} />
              ))}
            </div>
          </div>
        )}

        {/* ══ EXPLORE: Default bento grid ══ */}
        {mainTab === 'explore' && showDefault && (
          <div key="default-grid" className="flex flex-col justify-between h-full pb-32 content-enter">
            <div className="flex-1 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
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
                        position: 'absolute', right: '-4px', top: '50%',
                        transform: 'translateY(-50%)',
                        opacity: 0.30, pointerEvents: 'none', width: '84px', height: '88px',
                        maskImage: 'linear-gradient(to left, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                        WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
                      }}>
                        <MiniChordPreview
                          frets={sampleChords[cat.type]!.guitar.frets}
                          baseFret={sampleChords[cat.type]!.guitar.baseFret}
                          barres={sampleChords[cat.type]!.guitar.barres}
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent / Favorites strip */}
            {(recentList.length > 0 || favoritesList.length > 0) && (
              <div className="flex-none px-5 pb-2">
                {recentList.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>{t.library.recent}</h4>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {recentList.map(chord => (
                        <button key={chord.id} onClick={() => selectChord(chord.id)}
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
                )}
                {favoritesList.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>{t.library.saved}</h4>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {favoritesList.map(chord => (
                        <button key={chord.id} onClick={() => selectChord(chord.id)}
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
                  placeholder="Search songs or artists…"
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
            <div className="px-5 mb-5">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
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
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Song count */}
            <div className="px-5 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
                {discoverSongs.length} song{discoverSongs.length !== 1 ? 's' : ''}
                {activeGenre ? ` · ${GENRE_META[activeGenre].label}` : ''}
                {discoverQuery.trim() ? ` · "${discoverQuery.trim()}"` : ''}
              </p>
            </div>

            {/* Song cards */}
            <div className="px-5 space-y-3">
              {discoverSongs.length === 0 && (
                <div className="py-12 flex flex-col items-center gap-3" style={{ color: 'var(--c-text-secondary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '40px', opacity: 0.4 }}>search_off</span>
                  <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '15px', color: 'var(--c-text-primary)' }}>No songs found</p>
                  <p style={{ fontFamily: 'Inter', fontSize: '13px', textAlign: 'center', maxWidth: '220px' }}>
                    Try a different search term or clear the filter.
                  </p>
                  <button onClick={() => { setDiscoverQuery(''); setActiveGenre(null); }}
                    className="btn-smooth mt-2 px-5 py-2 rounded-full font-bold text-xs"
                    style={{ background: accent.from, color: '#0d0e0f', fontFamily: 'Manrope' }}>
                    Clear search
                  </button>
                </div>
              )}
              {discoverSongs.map(song => {
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
                        {meta.label}
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

                    {/* Description */}
                    <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '12px', lineHeight: '1.5' }}>
                      {song.description}
                    </p>

                    {/* Key + BPM */}
                    <div className="flex gap-3 mt-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                        style={{ background: 'var(--app-surface-low)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
                        Key of {song.key}
                      </span>
                      {song.bpm && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                          style={{ background: 'var(--app-surface-low)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
                          {song.bpm} BPM
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
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

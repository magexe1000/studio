import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import {
  useDrumStore, KIT_INSTRUMENTS, INSTRUMENT_COLOR, KIT_FAMILY,
  stepsPerMeasure, INST_VARIATIONS, GROOVE_TAGS,
  type DrumInstrument, type KitType, type DrumSong, type DrumMeasure, type NoteVariation,
  type DrumPattern, type DrumHit, type GrooveEntry, type GrooveTag,
} from '../store/useDrumStore';
import {
  drumScheduler, samplePool, loadDrumSamples, KIT_DEFAULTS,
  getSoundForVariation,
  type SampleStatus,
} from '../lib/drumAudio';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';

// ── Layout ─────────────────────────────────────────────────────────────────
const LABEL_W  = 72;
const ROW_H    = 40;
const RULER_H  = 20;
const SYS_SEP  = 10;
const MIN_STEP = 16;

// Core instruments always visible; extras are collapsible.
// Order mirrors KIT_INSTRUMENTS display order: high → low pitch.
const CORE_INSTS: DrumInstrument[] = ['hihat-closed', 'snare', 'kick', 'crash'];

// Staff lines within each row (fraction of ROW_H)
const STAFF_YF = [0.29, 0.52, 0.75] as const;

// Notehead vertical position within ROW_H — mirrors real notation positions
const NOTE_YF: Record<DrumInstrument, number> = {
  crash:          0.12,
  'hihat-closed': 0.12,
  'hihat-open':   0.12,
  ride:           0.12,
  'tom-high':     0.29,
  snare:          0.52,
  'tom-mid':      0.65,
  'tom-floor':    0.78,
  kick:           0.88,
  'hihat-foot':   0.88,
};


const SHORT_LABEL: Record<DrumInstrument, string> = {
  kick: 'Kick', snare: 'Snare', 'hihat-closed': 'HH', 'hihat-open': 'O.HH',
  'hihat-foot': 'HHF', 'tom-high': 'Hi', 'tom-mid': 'Mid',
  'tom-floor': 'Floor', crash: 'Crash', ride: 'Ride',
};
const INST_LABEL: Record<DrumInstrument, string> = {
  kick: 'Kick', snare: 'Snare', 'hihat-closed': 'Hi-Hat', 'hihat-open': 'Open HH',
  'hihat-foot': 'HH Foot', 'tom-high': 'Tom Hi', 'tom-mid': 'Tom Mid',
  'tom-floor': 'Floor Tom', crash: 'Crash', ride: 'Ride',
};
const KIT_LABEL: Record<KitType, string> = {
  ludwig: 'Ludwig Classic', jazz: 'Jazz Kit',     rock: 'Rock Kit',   vintage: "Vintage '60s",
  studio: 'Studio A',       r8:   'Roland R8',    linn: 'LinnDrum',   funk: 'Funk Kit',
  cr78:   'Roland CR-78',   tr808:'Roland TR-808', techno:'Techno Kit', stark:'Stark Industrial',
};
const KIT_DESC: Record<KitType, string> = {
  ludwig: 'Warm natural acoustic · full kit',
  jazz:   'Tight brushes · dry cymbals · small kit',
  rock:   'Big punchy kick · fat cracking snare',
  vintage:'Woodsy warm tones · open resonance',
  studio: 'Clean compressed bright studio kit',
  r8:     '1989 electronic-acoustic hybrid',
  linn:   '1982 sample-based drum machine',
  funk:   'Tight snappy groove machine',
  cr78:   'Vintage 1978 analog drum machine',
  tr808:  'Deep bass hip-hop classic · 1980',
  techno: 'Hard punching industrial rave',
  stark:  'Cold metallic machine sounds',
};
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const KIT_IMAGE: Record<KitType, string> = {
  ludwig: `${BASE}/kit-acoustic.webp`,
  jazz:   `${BASE}/kit-jazz.webp`,
  rock:   `${BASE}/kit-rock.webp`,
  vintage:`${BASE}/kit-vintage.webp`,
  studio: `${BASE}/kit-studio.webp`,
  r8:     `${BASE}/kit-advanced.webp`,
  linn:   `${BASE}/kit-linn.webp`,
  funk:   `${BASE}/kit-funk.webp`,
  cr78:   `${BASE}/kit-cr78.webp`,
  tr808:  `${BASE}/kit-tr808.webp`,
  techno: `${BASE}/kit-electronic.webp`,
  stark:  `${BASE}/kit-stark.webp`,
};
const KIT_CATEGORIES: { id: string; label: string; kits: KitType[] }[] = [
  { id: 'acoustic', label: 'Acoustic Drums', kits: ['ludwig', 'jazz', 'rock', 'vintage'] },
  { id: 'studio',   label: 'Studio Drums',   kits: ['studio', 'r8', 'linn', 'funk'] },
  { id: 'electric', label: 'Electric Drums', kits: ['cr78', 'tr808', 'techno', 'stark'] },
];

// ── Tabs ───────────────────────────────────────────────────────────────────
type DrumTab = 'songs' | 'patterns';

// ── SVG note heads ─────────────────────────────────────────────────────────
function CircleHead({ r, color }: { r: number; color: string }) {
  return <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} />;
}
function XHead({ r, color }: { r: number; color: string }) {
  const d = r * 0.85;
  return (
    <>
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </>
  );
}
// Ghost: small faded circle
function GhostHead({ r, color }: { r: number; color: string }) {
  return <ellipse cx={0} cy={0} rx={r * 0.62} ry={r * 0.62 * 0.82} fill={color} opacity={0.40} />;
}
// Rimshot: open ellipse with X inside
function RimshotHead({ r, color }: { r: number; color: string }) {
  const d = r * 0.60;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill="none" stroke={color} strokeWidth={1.3} />
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </>
  );
}
// Flam: small grace note above-left + main filled circle
function FlamHead({ r, color }: { r: number; color: string }) {
  const gr = r * 0.50;
  return (
    <>
      <ellipse cx={-r * 1.05} cy={-r * 0.95} rx={gr} ry={gr * 0.82} fill={color} opacity={0.72} />
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} />
    </>
  );
}
// Accent: caret above + solid circle
function AccentHead({ r, color }: { r: number; color: string }) {
  const oy = r * 2.1;
  return (
    <>
      <polyline
        points={`${-r * 0.58},${-oy} 0,${-oy - r * 0.72} ${r * 0.58},${-oy}`}
        fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"
      />
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} />
    </>
  );
}
// Open HH: circle with X inside (standard open-hihat notation)
function OpenHHHead({ r, color }: { r: number; color: string }) {
  const d = r * 0.62;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill="none" stroke={color} strokeWidth={1.4} />
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </>
  );
}
// Bell (ride): filled diamond
function BellHead({ r, color }: { r: number; color: string }) {
  const rx = r * 0.82; const ry = r * 0.95;
  return <polygon points={`0,${-ry} ${rx},0 0,${ry} ${-rx},0`} fill={color} />;
}
// Choke (crash): circle around X
function ChokeHead({ r, color }: { r: number; color: string }) {
  const d = r * 0.62;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r * 1.08} ry={r * 0.92} fill="none" stroke={color} strokeWidth={1.2} />
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </>
  );
}

// Render the right head for a given instrument + variation
function NoteHead({ inst, variation, r, color }: {
  inst: DrumInstrument; variation: NoteVariation; r: number; color: string;
}) {
  // HH-family and cymbals that default to X
  if (inst === 'hihat-closed') {
    if (variation === 'open')  return <OpenHHHead r={r} color={color} />;
    if (variation === 'pedal') return <XHead      r={r} color={color} />;
    return <XHead r={r} color={color} />;
  }
  if (inst === 'crash') {
    if (variation === 'choke') return <ChokeHead r={r} color={color} />;
    return <XHead r={r} color={color} />;
  }
  if (inst === 'ride') {
    if (variation === 'bell') return <BellHead r={r} color={color} />;
    return <XHead r={r} color={color} />;
  }
  // Circle-family instruments
  if (inst === 'snare') {
    if (variation === 'ghost')   return <GhostHead   r={r} color={color} />;
    if (variation === 'rimshot') return <RimshotHead r={r} color={color} />;
    if (variation === 'flam')    return <FlamHead    r={r} color={color} />;
    return <CircleHead r={r} color={color} />;
  }
  if (variation === 'accent') return <AccentHead r={r} color={color} />;
  return <CircleHead r={r} color={color} />;
}

// Stable empty map — prevents creating a new reference each render for muted rows
const EMPTY_HIT_MAP: Map<number, NoteVariation> = new Map();

// ── Instrument row SVG ─────────────────────────────────────────────────────
interface RowProps {
  inst: DrumInstrument;
  mStartIdx: number;
  rowMeasures: { id: string; hits: Partial<Record<DrumInstrument, { step: number; length: number; variation?: NoteVariation }[]>> }[];
  spm: number;
  stepsPerBeat: number;
  STEP_W: number;
  MEASURE_W: number;
  hitMap: Map<number, NoteVariation>;
  noteColor: string;
  staffColor: string;
  barColor: string;
  altBg: string;
}
const InstrumentRow = memo(({
  inst, mStartIdx, rowMeasures, spm, stepsPerBeat, STEP_W, MEASURE_W,
  hitMap, noteColor, staffColor, barColor, altBg,
}: RowProps) => {
  const totalW     = rowMeasures.length * MEASURE_W;
  const defaultNoteY = NOTE_YF[inst] * ROW_H;
  const NOTE_R     = 4.5;

  return (
    <svg width={totalW} height={ROW_H} viewBox={`0 0 ${totalW} ${ROW_H}`} style={{ display: 'block', overflow: 'visible', flexShrink: 0 }}>
      {/* Alternating beat backgrounds */}
      {rowMeasures.map((_, mi) =>
        Array.from({ length: Math.floor(spm / stepsPerBeat) }, (__, bi) => {
          const x = (mi * spm + bi * stepsPerBeat) * STEP_W;
          return bi % 2 === 1 ? <rect key={`${mi}-${bi}`} x={x} y={0} width={stepsPerBeat * STEP_W} height={ROW_H} fill={altBg} /> : null;
        })
      )}
      {/* Staff lines */}
      {STAFF_YF.map((yf, i) => (
        <line key={i} x1={0} y1={yf * ROW_H} x2={totalW} y2={yf * ROW_H} stroke={staffColor} strokeWidth={0.7} />
      ))}
      {/* Beat sub-dividers */}
      {rowMeasures.map((_, mi) =>
        Array.from({ length: spm / stepsPerBeat }, (__, bi) => {
          if (bi === 0) return null;
          const x = (mi * spm + bi * stepsPerBeat) * STEP_W;
          return <line key={`b-${mi}-${bi}`} x1={x} y1={0} x2={x} y2={ROW_H} stroke={staffColor} strokeWidth={0.4} opacity={0.5} />;
        })
      )}
      {/* Measure bar lines */}
      {rowMeasures.map((_, mi) => (
        <line key={mi} x1={mi * MEASURE_W} y1={0} x2={mi * MEASURE_W} y2={ROW_H} stroke={barColor} strokeWidth={mi === 0 ? 1.5 : 1.2} />
      ))}
      <line x1={totalW} y1={0} x2={totalW} y2={ROW_H} stroke={barColor} strokeWidth={1.5} />
      {/* Note heads */}
      {rowMeasures.map((_, mi) =>
        Array.from({ length: spm }, (__, s) => {
          const globalStep = (mStartIdx + mi) * spm + s;
          if (!hitMap.has(globalStep)) return null;
          const variation = hitMap.get(globalStep) ?? 'normal';

          // Pedal variation of HH sits at the bottom of the row (foot position)
          const noteY = (inst === 'hihat-closed' && variation === 'pedal')
            ? ROW_H * 0.86
            : defaultNoteY;

          const cx     = (mi * spm + s) * STEP_W + STEP_W / 2;
          const cy     = noteY;
          const stemUp = cy > ROW_H * 0.5;
          const stemY1 = stemUp ? cy - NOTE_R * 0.9  : cy + NOTE_R * 0.9;
          const stemY2 = stemUp ? cy - NOTE_R * 3.5  : cy + NOTE_R * 3.5;

          // Ghost notes: draw a faint parenthesis pair instead of stem
          const isGhost = variation === 'ghost';

          return (
            <g key={`${mi}-${s}`} transform={`translate(${cx}, ${cy})`}>
              {isGhost ? (
                <>
                  <text x={-NOTE_R * 1.9} y={NOTE_R * 0.38} fontSize={NOTE_R * 1.7} fill={noteColor} opacity={0.38} fontFamily="serif" dominantBaseline="middle">(</text>
                  <text x={NOTE_R * 0.95}  y={NOTE_R * 0.38} fontSize={NOTE_R * 1.7} fill={noteColor} opacity={0.38} fontFamily="serif" dominantBaseline="middle">)</text>
                </>
              ) : (
                <line
                  x1={stemUp ? NOTE_R * 0.75 : -NOTE_R * 0.75} y1={stemY1 - cy}
                  x2={stemUp ? NOTE_R * 0.75 : -NOTE_R * 0.75} y2={stemY2 - cy}
                  stroke={noteColor} strokeWidth={1.2} strokeLinecap="round"
                />
              )}
              <NoteHead inst={inst} variation={variation} r={NOTE_R} color={noteColor} />
            </g>
          );
        })
      )}
    </svg>
  );
});

// ── Tab icons ──────────────────────────────────────────────────────────────
function IconDrumSongs({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6; const ao = active ? 0.13 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={ao} />
      <line x1="7.5" y1="8"  x2="16.5" y2="8"  stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
      <line x1="7.5" y1="16" x2="13"   y2="16" stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
    </svg>
  );
}
function IconPatterns({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6; const ao = active ? 0.18 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <rect x="3" y="5" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={ao} />
      <rect x="3" y="14" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={ao * 0.5} />
      <rect x="12" y="5" width="9" height="5" rx="1.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={ao * 0.7} />
      <rect x="12" y="14" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={ao * 0.3} />
    </svg>
  );
}
function IconMixer({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6; const ao = active ? 1 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <line x1="5"  y1="19" x2="5"  y2="10" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="5"  cy="10" r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor" strokeWidth={active ? 0 : sw - 0.3} />
      <line x1="12" y1="19" x2="12" y2="6" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="12" cy="6"  r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor" strokeWidth={active ? 0 : sw - 0.3} />
      <line x1="19" y1="19" x2="19" y2="13" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="19" cy="13" r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor" strokeWidth={active ? 0 : sw - 0.3} />
    </svg>
  );
}

// ── Bottom nav (Songs / Patterns) ───────────────────────────────────────────
const ALL_NAV_TABS: { id: DrumTab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'songs',    label: 'Songs',    Icon: IconDrumSongs },
  { id: 'patterns', label: 'Patterns', Icon: IconPatterns  },
];
function DrumNav({ activeTab, setTab, accent, isLight, isAmoled }: {
  activeTab: DrumTab; setTab: (t: DrumTab) => void;
  accent: { from: string; to: string };
  isLight: boolean; isAmoled: boolean;
}) {
  const navRef  = useRef<HTMLElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const prevIdx = useRef(ALL_NAV_TABS.findIndex(x => x.id === activeTab));
  const strT    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressed, setPressed] = useState<DrumTab | null>(null);

  const measure = (idx: number) => {
    const btn = btnRefs.current[idx]; const nav = navRef.current;
    if (!btn || !nav) return null;
    const nr = nav.getBoundingClientRect(); const br = btn.getBoundingClientRect();
    return { left: br.left - nr.left, right: br.right - nr.left };
  };
  useEffect(() => {
    const m = measure(ALL_NAV_TABS.findIndex(x => x.id === activeTab));
    if (m) setPill({ ...m, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ni = ALL_NAV_TABS.findIndex(x => x.id === activeTab);
    const oi = prevIdx.current;
    if (ni === oi) return;
    prevIdx.current = ni;
    if (strT.current) { clearTimeout(strT.current); strT.current = null; }
    const nm = measure(ni);
    if (!nm) return;
    const om = measure(oi);
    if (ni > oi) {
      setPill(p => ({ ...p, left: om?.left ?? p.left, right: nm.right }));
      strT.current = setTimeout(() => setPill(p => ({ ...p, left: nm.left })), 70);
    } else {
      setPill(p => ({ ...p, left: nm.left, right: om?.right ?? p.right }));
      strT.current = setTimeout(() => setPill(p => ({ ...p, right: nm.right })), 70);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <nav ref={navRef} style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: 'max(10px, env(safe-area-inset-bottom))',
      width: '72%', maxWidth: 280,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '6px 8px', borderRadius: '2rem',
      border: isLight ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.10)',
      background: isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)'),
      boxShadow: isLight
        ? '0 8px 32px rgba(0,0,0,0.14), 0 1.5px 0 rgba(255,255,255,0.80) inset'
        : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
      zIndex: 50, overflow: 'hidden',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)',
    }}>
      {pill.ready && (
        <div aria-hidden style={{
          position: 'absolute', top: 4, left: pill.left, width: pill.right - pill.left,
          height: 'calc(100% - 8px)', borderRadius: '9999px',
          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
          pointerEvents: 'none', zIndex: 0,
          transition: 'left 150ms cubic-bezier(0.34,1.56,0.64,1), width 150ms cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      )}
      {ALL_NAV_TABS.map(({ id, label, Icon }, i) => {
        const isActive = activeTab === id; const isPressed = pressed === id;
        return (
          <button key={id} ref={el => { btnRefs.current[i] = el; }}
            onPointerDown={() => setPressed(id)}
            onPointerUp={() => { setPressed(null); setTab(id); }}
            onPointerLeave={() => setPressed(null)} onPointerCancel={() => setPressed(null)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '8px 4px', borderRadius: '9999px', background: 'transparent', border: 'none',
              cursor: 'pointer', color: isActive ? '#fff' : (isLight ? 'rgba(0,0,0,0.4)' : '#71717a'), position: 'relative', zIndex: 1,
              transform: isPressed ? 'scale(0.91)' : 'scale(1)',
              transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34,1.56,0.64,1)',
            }}>
            <Icon active={isActive} />
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '9px', letterSpacing: '0.09em', textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'var(--c-text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 8px', padding: '0 20px' }}>{children}</p>;
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ margin: '0 16px 20px', background: 'var(--app-surface)', borderRadius: 14, border: '1px solid rgba(128,128,128,0.07)', overflow: 'hidden', ...style }}>{children}</div>;
}

// ── Export config ───────────────────────────────────────────────────────────
interface DrumExportConfig {
  theme: 'light' | 'dark';
  style: 'compact' | 'normal' | 'elegant';
}
const DEFAULT_DRUM_EXPORT_CONFIG: DrumExportConfig = { theme: 'dark', style: 'normal' };

// ── JSON export ─────────────────────────────────────────────────────────────
async function exportDrumSongJSON(patterns: DrumPattern[], song: DrumSong | null, mode: 'save' | 'share' = 'share') {
  const payload = {
    _app: 'Drumex',
    exportedAt: new Date().toISOString(),
    song: song ? { id: song.id, name: song.name, artist: song.artist, notes: song.notes } : null,
    patterns: patterns.map(p => ({
      id: p.id, name: p.name, bpm: p.bpm, subdivision: p.subdivision,
      mutedInstruments: p.mutedInstruments ?? [],
      measures: p.measures.map((m: DrumMeasure) => ({ id: m.id, hits: m.hits })),
    })),
  };
  const fileName = `${song?.name ?? 'drumex'}.json`;
  const jsonStr  = JSON.stringify(payload, null, 2);
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share }                 = await import('@capacitor/share');
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      const written = await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Cache, recursive: true });
      if (mode === 'share') await Share.share({ title: fileName, url: written.uri });
      else await Filesystem.writeFile({ path: `Download/${fileName}`, data: b64, directory: Directory.ExternalStorage, recursive: true });
    } catch { /* fall through to web download */ }
    return;
  }
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export ──────────────────────────────────────────────────────────────
const HEX_TO_RGB = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

async function exportDrumSongPDF(
  patterns: DrumPattern[],
  song:     DrumSong | null,
  accent:   { from: string; to: string },
  cfg:      DrumExportConfig = DEFAULT_DRUM_EXPORT_CONFIG,
  pdfName   = '',
  mode: 'save' | 'share' = 'share',
): Promise<boolean> {
  const { jsPDF } = await import('jspdf');
  const ALL_I     = CORE_INSTS as readonly DrumInstrument[];
  const dark      = cfg.theme === 'dark';
  const [ar, ag, ab] = HEX_TO_RGB(accent.from);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = 297, PH = 210;
  const MT = 14, MB = 16, ML = 14, MR = 14;
  const LW    = 26;   // label column width
  const ROW_H = 7.5;  // instrument row height
  const GRID_W = PW - ML - MR - LW; // available width for step cells

  // Palette — match the app's grid visually
  const bg      = dark ? [13,  13,  15 ] : [252, 252, 254];
  const cellA   = dark ? [22,  22,  26 ] : [242, 242, 248]; // beat group A
  const cellB   = dark ? [28,  28,  34 ] : [232, 232, 240]; // beat group B
  const label   = dark ? [160, 160, 170] : [80,  80,  90 ];
  const gridLine= dark ? [38,  38,  45 ] : [195, 195, 205];
  const beatLine= dark ? [60,  60,  72 ] : [160, 160, 175];
  const barLine = dark ? [90,  90,  110] : [120, 120, 140];

  let page = 1;
  const drawPage = (cont: boolean) => {
    doc.setFillColor(...bg as [number,number,number]); doc.rect(0, 0, PW, PH, 'F');
    doc.setFillColor(ar, ag, ab); doc.rect(ML, MT, 3, 10, 'F');
    doc.setFontSize(13).setFont('helvetica', 'bold').setTextColor(ar, ag, ab);
    doc.text(pdfName || song?.name || 'Drumex Export', ML + 7, MT + 7.5);
    if (song?.artist) {
      doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...label as [number,number,number]);
      const tw = doc.getTextWidth(pdfName || song?.name || 'Drumex Export');
      doc.text(song.artist, ML + 7 + tw + 5, MT + 7.5);
    }
    if (cont) { doc.setFontSize(7).setTextColor(130,130,130); doc.text('(continued)', PW - MR, MT + 6, { align: 'right' }); }
    doc.setFontSize(6.5).setTextColor(120,120,120); doc.text(`Page ${page}`, PW - MR, PH - 5, { align: 'right' });
    doc.setDrawColor(ar, ag, ab); doc.setLineWidth(0.2);
    doc.line(ML, MT + 12.5, PW - MR, MT + 12.5);
  };
  const newPage = () => { doc.addPage(); page++; drawPage(true); };

  drawPage(false);
  let curY = MT + 16;

  for (const pat of patterns) {
    const subs  = pat.subdivision ?? 16;
    const insts = ALL_I.filter(i => !(pat.mutedInstruments ?? []).includes(i));
    if (insts.length === 0) continue;

    // Fit as many bars per row as possible with cells at least 4mm wide
    const barsPerRow = Math.max(1, Math.min(pat.measures.length, Math.floor(GRID_W / (subs * 4))));
    const CELL = GRID_W / (barsPerRow * subs); // fills full grid width
    const systemH = insts.length * ROW_H;

    // Pattern label
    const patHdrH = 9;
    if (curY + patHdrH + systemH > PH - MB) { newPage(); curY = MT + 16; }
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(ar, ag, ab);
    doc.text(`${pat.name}  ·  ${pat.bpm} BPM  ·  1/${subs}`, ML, curY + 6);
    curY += patHdrH;

    // Iterate rows of bars
    for (let rowStart = 0; rowStart < pat.measures.length; rowStart += barsPerRow) {
      const rowBars = pat.measures.slice(rowStart, rowStart + barsPerRow);
      if (curY + systemH + 2 > PH - MB) { newPage(); curY = MT + 16; }

      // Bar numbers above the grid
      for (const [bi, _m] of rowBars.entries()) {
        const bx = ML + LW + bi * subs * CELL;
        doc.setFontSize(5.5).setFont('helvetica', 'normal').setTextColor(120,120,120);
        doc.text(`${rowStart + bi + 1}`, bx + (subs * CELL) / 2, curY - 1.5, { align: 'center' });
      }

      // Draw each instrument row
      for (const [ri, inst] of insts.entries()) {
        const rowY = curY + ri * ROW_H;
        const [cr, cg, cb] = HEX_TO_RGB(INSTRUMENT_COLOR[inst] ?? accent.from);

        // Label
        doc.setFontSize(5.5).setFont('helvetica', 'normal').setTextColor(...label as [number,number,number]);
        doc.text(INST_LABEL[inst], ML + LW - 1, rowY + ROW_H / 2 + 1.9, { align: 'right' });

        for (const [bi, meas] of rowBars.entries()) {
          const barStartX = ML + LW + bi * subs * CELL;

          for (let s = 0; s < subs; s++) {
            const cx = barStartX + s * CELL;
            const beatGroup = Math.floor(s / 4) % 2;
            const cellColor = beatGroup === 0 ? cellA : cellB;

            // Cell bg
            doc.setFillColor(...cellColor as [number,number,number]);
            doc.rect(cx, rowY, CELL, ROW_H, 'F');

            // Hit fill
            if (meas.hits[inst]?.find?.((h: DrumHit) => h.step === s)) {
              doc.setFillColor(cr, cg, cb);
              const pad = 0.7;
              const rr  = Math.min(1.5, (CELL - 2 * pad) / 2, (ROW_H - 2 * pad) / 2);
              doc.roundedRect(cx + pad, rowY + pad, CELL - 2 * pad, ROW_H - 2 * pad, rr, rr, 'F');
            }

            // Step cell border
            doc.setDrawColor(...gridLine as [number,number,number]);
            doc.setLineWidth(0.08);
            doc.rect(cx, rowY, CELL, ROW_H);
          }

          // Beat group dividers (every 4 steps, thicker)
          for (let b = 0; b <= subs; b += 4) {
            const bx = barStartX + b * CELL;
            doc.setDrawColor(...beatLine as [number,number,number]);
            doc.setLineWidth(0.22);
            doc.line(bx, rowY, bx, rowY + ROW_H);
          }

          // Bar separator (right edge of each bar)
          doc.setDrawColor(...barLine as [number,number,number]);
          doc.setLineWidth(0.5);
          doc.line(barStartX + subs * CELL, rowY, barStartX + subs * CELL, rowY + ROW_H);
        }
      }

      // Outer grid border
      const totalW = rowBars.length * subs * CELL;
      doc.setDrawColor(...barLine as [number,number,number]);
      doc.setLineWidth(0.4);
      doc.rect(ML + LW, curY, totalW, systemH);

      // Horizontal row dividers
      for (let ri = 1; ri < insts.length; ri++) {
        doc.setDrawColor(...gridLine as [number,number,number]);
        doc.setLineWidth(0.12);
        doc.line(ML + LW, curY + ri * ROW_H, ML + LW + totalW, curY + ri * ROW_H);
      }

      curY += systemH + 5;
    }
    curY += 6;
  }

  const fileName = `${pdfName || song?.name || 'drumex'}.pdf`;
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const b64 = doc.output('datauristring').split(',')[1];
      if (mode === 'save') {
        try { await Filesystem.writeFile({ path: `Download/${fileName}`, data: b64, directory: Directory.ExternalStorage, recursive: true }); return true; }
        catch { await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.External, recursive: true }); return true; }
      } else {
        const written = await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Cache, recursive: true });
        await Share.share({ title: fileName, url: written.uri });
        return true;
      }
    } catch { return false; }
  }
  doc.save(fileName);
  return true;
}

// ── DrumPaperPreview ────────────────────────────────────────────────────────
function DrumPaperPreview({ patterns, song, cfg, accent }: {
  patterns: DrumPattern[];
  song: DrumSong | null;
  cfg: DrumExportConfig;
  accent: { from: string; to: string };
}) {
  const dark  = cfg.theme === 'dark';
  const ALL_I = CORE_INSTS as readonly DrumInstrument[];

  const bg       = dark ? '#0d0d0f' : '#f8f8fc';
  const sub      = dark ? '#555'    : '#999';
  const cellA    = dark ? '#16161e' : '#e8e8f0';
  const cellB    = dark ? '#1c1c26' : '#dcdcea';
  const divLine  = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.10)';
  const beatDiv  = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.16)';
  const barDiv   = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.24)';

  const ROW_PX = 8; // preview row height in px
  const previewPats = patterns.slice(0, 2);

  return (
    <div style={{ background: bg, borderRadius: 10, overflow: 'hidden', width: '100%', aspectRatio: '1.414 / 1',
      boxShadow: dark ? '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)' : '0 16px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.07)',
      transition: 'background 250ms, box-shadow 250ms' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 10px', borderBottom: `1px solid ${divLine}` }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, background: accent.from, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, color: accent.from, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {song?.name ?? 'Drumex Export'}
          </p>
          {song?.artist && <p style={{ margin: 0, fontFamily: 'Inter', fontSize: 7, color: sub, marginTop: 1 }}>{song.artist}</p>}
        </div>
      </div>

      {/* Patterns */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        {previewPats.map(pat => {
          const insts = ALL_I.filter(i => !(pat.mutedInstruments ?? []).includes(i));
          const subs  = pat.subdivision ?? 16;
          const previewMeasures = pat.measures.slice(0, 4); // show up to 4 bars in preview
          return (
            <div key={pat.id}>
              <p style={{ margin: '0 0 4px', fontFamily: 'Manrope', fontWeight: 700, fontSize: 7, color: accent.from }}>
                {pat.name} · {pat.bpm} BPM · 1/{subs}
              </p>
              {/* Grid: labels + measures */}
              <div style={{ display: 'flex', gap: 3 }}>
                {/* Labels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                  {insts.map(inst => (
                    <div key={inst} style={{ height: ROW_PX, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 5, fontFamily: 'Manrope', fontWeight: 600, color: sub, whiteSpace: 'nowrap', paddingRight: 3 }}>
                        {INST_LABEL[inst].split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Bars */}
                <div style={{ flex: 1, display: 'flex', gap: 1.5, overflow: 'hidden' }}>
                  {previewMeasures.map((meas, bi) => (
                    <div key={bi} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, borderRight: bi < previewMeasures.length - 1 ? `1px solid ${barDiv}` : 'none', paddingRight: bi < previewMeasures.length - 1 ? 1.5 : 0 }}>
                      {insts.map((inst, ri) => {
                        const color = INSTRUMENT_COLOR[inst] ?? accent.from;
                        return (
                          <div key={inst} style={{ display: 'flex', height: ROW_PX, gap: 0 }}>
                            {Array.from({ length: subs }, (_, s) => {
                              const hit = meas.hits[inst]?.find?.((h: DrumHit) => h.step === s);
                              const bg2 = Math.floor(s / 4) % 2 === 0 ? cellA : cellB;
                              return (
                                <div key={s} style={{
                                  flex: 1, height: '100%',
                                  background: hit ? color : bg2,
                                  borderRadius: hit ? 1 : 0,
                                  outline: `0.5px solid ${s % 4 === 0 && s > 0 ? beatDiv : divLine}`,
                                  outlineOffset: '-0.5px',
                                }} />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {pat.measures.length > 4 && (
                    <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                      <span style={{ fontSize: 5, color: sub }}>+{pat.measures.length - 4}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {patterns.length > 2 && (
          <p style={{ margin: 0, fontFamily: 'Manrope', fontSize: 6, color: sub }}>
            +{patterns.length - 2} more pattern{patterns.length - 2 > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── DrumExportModal ─────────────────────────────────────────────────────────
function DrumExportModal({ patterns, song, accent, onClose }: {
  patterns: DrumPattern[];
  song:     DrumSong | null;
  accent:   { from: string; to: string };
  onClose:  () => void;
}) {
  const [cfg,       setCfg]     = useState<DrumExportConfig>({ ...DEFAULT_DRUM_EXPORT_CONFIG });
  const [pdfName,   setPdfName] = useState('');
  const [saving,    setSaving]  = useState(false);
  const [sharing,   setSharing] = useState(false);
  const [saveRes,   setSaveRes] = useState<'ok' | 'fail' | null>(null);
  const [closing,   setClosing] = useState(false);
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();

  const update = <K extends keyof DrumExportConfig>(k: K, v: DrumExportConfig[K]) =>
    setCfg(prev => ({ ...prev, [k]: v }));

  const handleClose = () => { setClosing(true); setTimeout(onClose, 320); };

  const handlePDF = async (mode: 'save' | 'share') => {
    if (mode === 'save') setSaving(true); else setSharing(true);
    await new Promise(r => setTimeout(r, 80));
    try {
      const ok = await exportDrumSongPDF(patterns, song, accent, cfg, pdfName, mode);
      if (mode === 'save') {
        setSaveRes(ok ? 'ok' : 'fail');
        setTimeout(() => setSaveRes(null), 3000);
      } else { handleClose(); }
    } finally {
      if (mode === 'save') setSaving(false); else setSharing(false);
    }
  };

  const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
    <button onClick={onChange} className="btn-smooth"
      style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, position: 'relative',
        background: on ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(72,72,72,0.25)',
        transition: 'background 220ms' }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10,
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
        transition: 'left 220ms cubic-bezier(0.34,1.56,0.64,1)' }} />
    </button>
  );

  const Segment = <T extends string>({ options, value, onChange }: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
  }) => (
    <div style={{ display: 'flex', background: 'var(--app-surface)', borderRadius: 10, padding: 3, gap: 2 }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} className="btn-smooth"
            style={{ flex: 1, padding: '6px 10px', borderRadius: 7, fontFamily: 'Manrope', fontWeight: 700,
              fontSize: 11, whiteSpace: 'nowrap',
              background: active ? 'var(--app-surface-highest)' : 'transparent',
              color: active ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.18)' : 'none',
              transition: 'all 160ms' }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const Row = ({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', background: 'var(--app-surface-high)', borderRadius: 14 }}>
      <div>
        <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 14, color: 'var(--c-text-primary)' }}>{label}</p>
        {sub && <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-secondary)', marginTop: 1 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--app-bg)', display: 'flex', flexDirection: 'column',
      animation: closing ? 'sheet-down 320ms cubic-bezier(0.25,0.46,0.45,0.94) both' : 'sheet-up 340ms cubic-bezier(0.25,0.46,0.45,0.94) both' }}>

      {/* Header */}
      <div style={{ paddingTop: 'max(16px,env(safe-area-inset-top))', padding: 'max(16px,env(safe-area-inset-top)) 20px 12px',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={handleClose} className="btn-smooth"
          style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--app-surface-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: 20 }}>arrow_back</span>
        </button>
        <p style={{ flex: 1, fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, color: 'var(--c-text-primary)' }}>Export PDF</p>
      </div>

      {/* Scrollable body */}
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 0' }}>

        {/* Paper preview */}
        <div style={{ marginBottom: 28 }}>
          <DrumPaperPreview patterns={patterns} song={song} cfg={cfg} accent={accent} />
        </div>

        <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, letterSpacing: '0.25em',
          textTransform: 'uppercase', color: 'var(--c-text-secondary)', marginBottom: 12 }}>
          Export Settings
        </p>

        {/* File name */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ padding: '14px 16px', background: 'var(--app-surface-high)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 14, color: 'var(--c-text-primary)' }}>File name</p>
            <input type="text" value={pdfName} onChange={e => setPdfName(e.target.value)}
              placeholder={song?.name ?? 'Beat'}
              maxLength={80}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--app-surface)',
                border: '1px solid rgba(72,72,72,0.15)', color: 'var(--c-text-primary)',
                fontFamily: 'Manrope', fontWeight: 600, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <Row label="Dark theme" sub="Black background, light text"
            right={<Toggle on={cfg.theme === 'dark'} onChange={() => update('theme', cfg.theme === 'dark' ? 'light' : 'dark')} />}
          />
          <Row label="Layout style" sub="Visual density of the grid"
            right={
              <Segment
                options={[{ value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'elegant', label: 'Elegant' }]}
                value={cfg.style}
                onChange={v => update('style', v as DrumExportConfig['style'])}
              />
            }
          />
        </div>

        {/* Info note */}
        <div style={{ padding: '14px 16px', borderRadius: 14, background: `${accent.from}0d`, border: `1px solid ${accent.from}22`,
          display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: 18, flexShrink: 0, marginTop: 1 }}>info</span>
          <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.5, margin: 0 }}>
            The PDF contains the step-sequencer grid for all patterns. Hidden rows (pattern mixer) are excluded from the export.
          </p>
        </div>
      </div>

      {/* Bottom actions */}
      <div style={{ padding: '12px 20px', paddingBottom: 'max(20px,env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
        borderTop: '1px solid rgba(72,72,72,0.08)', background: 'var(--app-bg)' }}>
        {saveRes && (
          <div style={{ textAlign: 'center', fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, padding: '4px 0',
            color: saveRes === 'ok' ? '#34d399' : '#f87171' }}>
            {saveRes === 'ok' ? 'Saved to Downloads!' : 'Could not save — try Share instead'}
          </div>
        )}
        {isNative ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => handlePDF('save')} disabled={saving || sharing} className="btn-smooth"
              style={{ flex: 1, padding: 16, borderRadius: 9999, fontFamily: 'Manrope', fontWeight: 800, fontSize: 14,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: (saving || sharing) ? 'rgba(72,72,72,0.3)' : `linear-gradient(135deg,${accent.from},${accent.to})`,
                boxShadow: (saving || sharing) ? 'none' : `0 6px 24px ${accent.to}50`, transition: 'all 200ms' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                {saving ? 'hourglass_empty' : 'save'}
              </span>
              {saving ? 'Generating…' : 'Save to Device'}
            </button>
            <button onClick={() => handlePDF('share')} disabled={saving || sharing} className="btn-smooth"
              style={{ flex: 1, padding: 16, borderRadius: 9999, fontFamily: 'Manrope', fontWeight: 800, fontSize: 14,
                color: accent.from, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'var(--app-surface-high)', transition: 'all 200ms' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                {sharing ? 'hourglass_empty' : 'share'}
              </span>
              {sharing ? 'Generating…' : 'Share'}
            </button>
          </div>
        ) : (
          <button onClick={() => handlePDF('share')} disabled={sharing} className="btn-smooth"
            style={{ width: '100%', padding: 16, borderRadius: 9999, fontFamily: 'Manrope', fontWeight: 800, fontSize: 15,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: sharing ? 'rgba(72,72,72,0.3)' : `linear-gradient(135deg,${accent.from},${accent.to})`,
              boxShadow: sharing ? 'none' : `0 6px 24px ${accent.to}50`, transition: 'all 200ms' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
              {sharing ? 'hourglass_empty' : 'download'}
            </span>
            {sharing ? 'Generating…' : 'Download PDF'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── DrumImportModal ─────────────────────────────────────────────────────────
function DrumImportModal({ accent, onImport, onClose }: {
  accent: { from: string; to: string };
  onImport: (name: string, artist: string, notes: string, patterns: DrumPattern[], activePatternId: string) => void;
  onClose: () => void;
}) {
  type Stage = 'idle' | 'preview' | 'error';
  const [stage, setStage]     = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview]   = useState<{ name: string; artist: string; notes: string; patterns: DrumPattern[]; activePatternId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setErrorMsg('Please select a Drumex .json file.'); setStage('error'); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (!raw || typeof raw !== 'object' || raw._app !== 'Drumex')
          throw new Error('Not a valid Drumex JSON file.');
        if (!Array.isArray(raw.patterns) || raw.patterns.length === 0)
          throw new Error('No patterns found in file.');
        const reconstructed: DrumPattern[] = (raw.patterns as any[]).map((p: any) => ({
          id: `p-import-${Math.random().toString(36).slice(2)}`,
          name: p.name ?? 'Pattern',
          bpm: Math.max(40, Math.min(280, Number(p.bpm) || 120)),
          subdivision: ([8, 16].includes(Number(p.subdivision)) ? Number(p.subdivision) : 16) as 8 | 16,
          timeSignature: [4, 4] as [number, number],
          mutedInstruments: Array.isArray(p.mutedInstruments) ? p.mutedInstruments : [],
          measures: Array.isArray(p.measures)
            ? (p.measures as any[]).map((m: any) => ({ id: `m-import-${Math.random().toString(36).slice(2)}`, hits: m.hits ?? {} }))
            : [],
        }));
        const songName   = (raw.song?.name   ?? '').trim() || 'Imported Beat';
        const artist     = (raw.song?.artist ?? '').trim();
        const notes      = (raw.song?.notes  ?? '').trim();
        setPreview({ name: songName, artist, notes, patterns: reconstructed, activePatternId: reconstructed[0].id });
        setStage('preview');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Could not parse file.'); setStage('error');
      }
    };
    reader.onerror = () => { setErrorMsg('Failed to read file.'); setStage('error'); };
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) parseFile(file); e.target.value = '';
  };

  const totalBars = preview ? preview.patterns.reduce((n, p) => n + p.measures.length, 0) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 300ms cubic-bezier(0.34,1.56,0.64,1) both', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(128,128,128,0.25)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 20px 16px', flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif' }}>Import Beat</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)' }}>
          {stage === 'idle' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
              style={{ border: `2px dashed ${dragOver ? accent.from : 'rgba(128,128,128,0.25)'}`, borderRadius: 16, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer', background: dragOver ? `${accent.from}08` : 'transparent', transition: 'all 200ms' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: accent.from }}>upload_file</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)' }}>Tap to select a Drumex JSON file</span>
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>or drag & drop here</span>
            </div>
          )}

          {stage === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="material-symbols-outlined" style={{ color: '#f87171', fontSize: 20, flexShrink: 0, marginTop: 1 }}>error</span>
                <span style={{ fontSize: 13, color: '#f87171', lineHeight: 1.5 }}>{errorMsg}</span>
              </div>
              <button onClick={() => { setStage('idle'); setErrorMsg(''); }} className="btn-smooth"
                style={{ padding: '12px', borderRadius: 12, background: 'var(--app-surface-high)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 600 }}>
                Try another file
              </button>
            </div>
          )}

          {stage === 'preview' && preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--app-surface-high)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.name}</span>
                </div>
                {preview.artist && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{preview.artist}</span>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: `${accent.from}18`, color: accent.from, borderRadius: 6, padding: '3px 8px' }}>{preview.patterns.length} pattern{preview.patterns.length !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(128,128,128,0.10)', color: 'var(--c-text-secondary)', borderRadius: 6, padding: '3px 8px' }}>{totalBars} bar{totalBars !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {preview.patterns.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--app-surface-high)', borderRadius: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{p.bpm} BPM · {p.measures.length} bar{p.measures.length !== 1 ? 's' : ''}</span>
                </div>
              ))}
              <button onClick={() => { onImport(preview.name, preview.artist, preview.notes, preview.patterns, preview.activePatternId); onClose(); }}
                className="btn-smooth"
                style={{ padding: '15px', borderRadius: 9999, background: `linear-gradient(135deg,${accent.from},${accent.to})`, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 6px 24px ${accent.to}50` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                Import to Library
              </button>
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileInput} />
      </div>
    </div>
  );
}

// ── DrumEditor ─────────────────────────────────────────────────────────────
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
  const {
    patterns, activePatternId,
    soundMap, volumeMap, masterVolume,
    kitType, activeInstruments,
    setKitType, toggleInstrument, setMasterVolume, setVolumeForInstrument,
    toggleHit, addMeasure, deleteMeasure, clearMeasure, duplicateMeasure, updatePattern,
    addBlankPattern, duplicatePattern, deletePattern, renamePattern, setActivePattern,
    drumSongs, saveDrumSong, createBlankDrumSong, loadDrumSong, deleteDrumSong, updateDrumSong,
    restorePatterns, insertMeasureAfter, togglePatternMute, importDrumSong,
    grooves, saveGroove, deleteGroove, renameGroove, loadGrooveReplace, loadGrooveAppend, duplicateGroove,
  } = useDrumStore();

  const pattern = useMemo(
    () => patterns.find(p => p.id === activePatternId) ?? patterns[0],
    [patterns, activePatternId],
  );
  const accent = ACCENT_COLORS[settings.accentColor] ?? ACCENT_COLORS.blue;
  const spm    = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];
  const kit    = kitType ?? 'ludwig';
  const ALL_INSTS = KIT_INSTRUMENTS[kit] ?? KIT_INSTRUMENTS.ludwig;

  // ── Theme ───────────────────────────────────────────────────────────────
  const isLight = settings.theme === 'light' ||
    (settings.theme === 'system' && typeof window !== 'undefined' &&
     window.matchMedia('(prefers-color-scheme: light)').matches);
  const isAmoled = !isLight && (settings.amoledMode ?? false);
  // SVG/canvas colors — CSS vars can't be used directly in SVG props
  const noteColor  = isLight ? '#111118' : '#f0f0f2';
  const staffColor = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.18)';
  const barColor   = isLight ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.45)';
  const altBg      = isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.018)';

  // ── State ────────────────────────────────────────────────────────────────
  const [inEditor,       setInEditor]       = useState(false);
  const [activeTab,      setActiveTab]      = useState<DrumTab>('songs');
  const [playing, setPlaying]               = useState(false);
  const [looping, setLooping]               = useState(true);
  const [sampleStatus, setSampleStatus]     = useState<SampleStatus>('idle');
  const [showBpmPanel,   setShowBpmPanel]   = useState(false);
  const [showHamburger,  setShowHamburger]  = useState(false);
  const [expandedCats,   setExpandedCats]   = useState<Set<string>>(() => new Set(['acoustic']));
  const [focusedInst,    setFocusedInst]    = useState<DrumInstrument | null>(null);
  // Songs panel state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName,     setCreateName]     = useState('');
  const [createArtist,   setCreateArtist]   = useState('');
  const [createBpm,      setCreateBpm]      = useState('120');
  const [createNotes,    setCreateNotes]    = useState('');
  const [createFamily,   setCreateFamily]   = useState<string>('acoustic');
  const [createVariant,  setCreateVariant]  = useState<KitType>('ludwig');
  const [showSaveForm,     setShowSaveForm]     = useState(false);
  const [saveName,         setSaveName]         = useState('');
  const [saveArtist,       setSaveArtist]       = useState('');
  const [saveNotes,        setSaveNotes]        = useState('');
  const [deletingId,       setDeletingId]       = useState<string | null>(null);
  const [editingSong,      setEditingSong]      = useState<DrumSong | null>(null);
  const [editingName,      setEditingName]      = useState('');
  const [editingArtist,    setEditingArtist]    = useState('');
  const [activeDrumSongId, setActiveDrumSongId] = useState<string | null>(null);

  // ── Row visibility (persisted to localStorage) ───────────────────────────
  const [showExtraRows, setShowExtraRows] = useState<boolean>(() => {
    try { const v = JSON.parse(localStorage.getItem('chordex-drum-ui') ?? '{}'); return v.showExtraRows !== false; }
    catch { return true; }
  });

  // ── Undo / Redo stacks ───────────────────────────────────────────────────
  type HistoryEntry = { patterns: typeof patterns; activePatternId: string | null };
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [historyCount, setHistoryCount] = useState(0);

  // ── Bar copy/paste clipboard ──────────────────────────────────────────────
  const [copiedMeasure, setCopiedMeasure] = useState<DrumMeasure | null>(null);
  const [openBarMenu,   setOpenBarMenu]   = useState<string | null>(null); // measureId
  const [flashBarId,    setFlashBarId]    = useState<string | null>(null); // brief highlight on paste

  // ── Quick mixer sheet + export modal + import modal ──────────────────────
  const [showMixerSheet,    setShowMixerSheet]    = useState(false);
  const [showExportModal,   setShowExportModal]   = useState(false);
  const [showImportDrum,    setShowImportDrum]    = useState(false);
  const [showClearConfirm,  setShowClearConfirm]  = useState(false);

  // ── Groove Library state ──────────────────────────────────────────────────
  const [grooveFilter,     setGrooveFilter]     = useState<GrooveTag>('');
  const [patRenameId,      setPatRenameId]      = useState<string | null>(null);
  const [patRenameName,    setPatRenameName]    = useState('');
  const [grooveMenuId,     setGrooveMenuId]     = useState<string | null>(null);
  const [previewingGrooveId, setPreviewingGrooveId] = useState<string | null>(null);
  const [showSaveGroove,   setShowSaveGroove]   = useState(false);
  const [savGrName,        setSavGrName]        = useState('');
  const [savGrTag,         setSavGrTag]         = useState<GrooveTag>('');
  const [grooveRenameId,   setGrooveRenameId]   = useState<string | null>(null);
  const [grooveRenameName, setGrooveRenameName] = useState('');
  const [grooveRenameTag,  setGrooveRenameTag]  = useState<GrooveTag>('');

  // ── Container width ──────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(340);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(el.clientWidth);
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Visible instruments ───────────────────────────────────────────────────
  const extraInsts   = useMemo(() => ALL_INSTS.filter(i => !CORE_INSTS.includes(i)), [ALL_INSTS]);
  const patternMuted = useMemo(() => new Set(pattern.mutedInstruments ?? []), [pattern.mutedInstruments]);
  const visibleInsts = useMemo(
    () => {
      const base = showExtraRows ? ALL_INSTS : ALL_INSTS.filter(i => CORE_INSTS.includes(i));
      return base.filter(i => !patternMuted.has(i));
    },
    [ALL_INSTS, showExtraRows, patternMuted],
  );

  // ── Layout ───────────────────────────────────────────────────────────────
  const availableW     = containerW - LABEL_W;
  const measuresPerRow = Math.max(1, Math.floor(availableW / (spm * MIN_STEP)));
  const MEASURE_W      = availableW / measuresPerRow;
  const STEP_W         = MEASURE_W / spm;
  const SYSTEM_H       = RULER_H + visibleInsts.length * ROW_H;
  const FULL_SYS_H     = SYSTEM_H + SYS_SEP;

  const spmRef      = useRef(spm);            spmRef.current = spm;
  const mprRef      = useRef(measuresPerRow); mprRef.current = measuresPerRow;
  const stepWRef    = useRef(STEP_W);         stepWRef.current = STEP_W;
  const measureWRef = useRef(MEASURE_W);      measureWRef.current = MEASURE_W;
  const sysHRef     = useRef(FULL_SYS_H);    sysHRef.current = FULL_SYS_H;
  const allInstsRef = useRef(visibleInsts);   allInstsRef.current = visibleInsts;

  // ── System rows ──────────────────────────────────────────────────────────
  const systemRows = useMemo(() => {
    const rows: typeof pattern.measures[] = [];
    for (let i = 0; i < pattern.measures.length; i += measuresPerRow)
      rows.push(pattern.measures.slice(i, i + measuresPerRow));
    return rows;
  }, [pattern.measures, measuresPerRow]);

  // ── Hit maps (step → variation) ──────────────────────────────────────────
  const allHitMaps = useMemo(() => {
    const map = new Map<DrumInstrument, Map<number, NoteVariation>>();
    visibleInsts.forEach(inst => {
      const m2 = new Map<number, NoteVariation>();
      pattern.measures.forEach((m, mIdx) => {
        m.hits[inst]?.forEach(h => m2.set(mIdx * spm + h.step, h.variation ?? 'normal'));
      });
      map.set(inst, m2);
    });
    return map;
  }, [pattern, spm, visibleInsts]);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const scrollRef    = useRef<HTMLDivElement>(null);
  const playheadRef  = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    samplePool.onStatusChange = s => setSampleStatus(s);
    setSampleStatus(samplePool.status);
    return () => { samplePool.onStatusChange = null; };
  }, []);
  useEffect(() => { if (kitType) loadDrumSamples(kitType); }, [kitType]);
  useEffect(() => { if (playing) drumScheduler.updatePattern(pattern); }, [pattern, playing]);

  // ── Auto-save: persist patterns/kit into the loaded song whenever they change
  useEffect(() => {
    if (!activeDrumSongId) return;
    const t = setTimeout(() => {
      updateDrumSong(activeDrumSongId, {
        patterns: JSON.parse(JSON.stringify(patterns)),
        activePatternId: activePatternId ?? patterns[0]?.id ?? '',
        kitType,
      });
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patterns, activePatternId, kitType, activeDrumSongId]);


  // ── Playhead ─────────────────────────────────────────────────────────────
  useEffect(() => {
    drumScheduler.onStep = (gs, mIdx, stepInM) => {
      if (gs < 0) { if (playheadRef.current) playheadRef.current.style.display = 'none'; return; }
      const sp = spmRef.current; const mpr = mprRef.current; const sw = stepWRef.current; const sh = sysHRef.current;
      const systemIdx = Math.floor(mIdx / mpr); const measureInRow = mIdx % mpr; const stepInRow = measureInRow * sp + stepInM;
      const x = LABEL_W + stepInRow * sw; const y = systemIdx * sh;
      if (playheadRef.current) { playheadRef.current.style.transform = `translate(${x}px, ${y}px)`; playheadRef.current.style.display = 'block'; }
      const el = scrollRef.current;
      if (el) { const rowBottom = y + RULER_H + allInstsRef.current.length * ROW_H; if (y < el.scrollTop || rowBottom > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, y - 40); }
    };
    return () => { drumScheduler.onStep = null; };
  }, []);
  useEffect(() => () => { drumScheduler.stop(); }, []);

  // ── Row visibility persistence ────────────────────────────────────────────
  useEffect(() => {
    try {
      const prev = JSON.parse(localStorage.getItem('chordex-drum-ui') ?? '{}');
      localStorage.setItem('chordex-drum-ui', JSON.stringify({ ...prev, showExtraRows }));
    } catch {}
  }, [showExtraRows]);

  // ── Undo / Redo helpers ────────────────────────────────────────────────────
  const pushUndo = useCallback(() => {
    const { patterns: pts, activePatternId: actId } = useDrumStore.getState();
    undoStack.current.push({ patterns: JSON.parse(JSON.stringify(pts)), activePatternId: actId });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setHistoryCount(undoStack.current.length);
  }, []);

  const handleUndo = useCallback(() => {
    if (!undoStack.current.length) return;
    const { patterns: pts, activePatternId: actId } = useDrumStore.getState();
    redoStack.current.push({ patterns: JSON.parse(JSON.stringify(pts)), activePatternId: actId });
    const prev = undoStack.current.pop()!;
    restorePatterns(prev.patterns, prev.activePatternId);
    setHistoryCount(undoStack.current.length);
  }, [restorePatterns]);

  const handleRedo = useCallback(() => {
    if (!redoStack.current.length) return;
    const { patterns: pts, activePatternId: actId } = useDrumStore.getState();
    undoStack.current.push({ patterns: JSON.parse(JSON.stringify(pts)), activePatternId: actId });
    const next = redoStack.current.pop()!;
    restorePatterns(next.patterns, next.activePatternId);
    setHistoryCount(undoStack.current.length);
  }, [restorePatterns]);

  // ── Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) ──────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // ── Play/stop ────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    const sm  = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
    const vol: Partial<Record<DrumInstrument, number>> = {};
    activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
    else { loadDrumSamples(kit); drumScheduler.start(pattern, sm, vol, masterVolume, looping, kit); setPlaying(true); }
  }, [pattern, kit, soundMap, volumeMap, activeInstruments, masterVolume, looping]);

  // ── Kit ──────────────────────────────────────────────────────────────────
  const handleKitSelect = useCallback((k: KitType) => {
    if (kitType === k) return;
    setKitType(k, KIT_DEFAULTS[k].soundMap);
    loadDrumSamples(k);
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
  }, [setKitType, kitType]);

  // ── Groove Library ────────────────────────────────────────────────────────
  const filteredGrooves = grooveFilter
    ? grooves.filter(g => g.tag === grooveFilter)
    : grooves;

  const handleGroovePreview = useCallback((groove: GrooveEntry) => {
    if (previewingGrooveId === groove.id && drumScheduler.isPlaying) {
      drumScheduler.stop(); setPlaying(false); setPreviewingGrooveId(null); return;
    }
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
    const sm = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
    const vol: Partial<Record<DrumInstrument, number>> = {};
    activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
    const tempPat: DrumPattern = {
      id: groove.id, name: groove.name, bpm: groove.bpm,
      timeSignature: [4, 4], subdivision: groove.subdivision,
      measures: groove.measures,
    };
    loadDrumSamples(kit);
    drumScheduler.start(tempPat, sm, vol, masterVolume, true, kit);
    setPreviewingGrooveId(groove.id);
    setPlaying(false);
  }, [previewingGrooveId, kit, soundMap, volumeMap, activeInstruments, masterVolume]);

  // ── BPM ──────────────────────────────────────────────────────────────────
  const adjustBpm = useCallback((d: number) => {
    const bpm = Math.max(40, Math.min(280, pattern.bpm + d));
    updatePattern(pattern.id, { bpm });
    if (drumScheduler.isPlaying) {
      const sm = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
      const vol: Partial<Record<DrumInstrument, number>> = {};
      activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
      const updated = useDrumStore.getState().patterns.find(p => p.id === pattern.id)!;
      drumScheduler.start(updated, sm, vol, masterVolume, looping, kit);
    }
  }, [pattern, kit, soundMap, volumeMap, activeInstruments, masterVolume, looping, updatePattern]);

  // ── Subdivision ──────────────────────────────────────────────────────────
  const toggleSub = useCallback(() => {
    updatePattern(pattern.id, { subdivision: pattern.subdivision === 16 ? 8 : 16 });
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
  }, [pattern, updatePattern]);

  // ── Clear ────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    pushUndo();
    const cleared = pattern.measures.map(m => ({ ...m, hits: {} as Record<DrumInstrument, never[]> }));
    updatePattern(pattern.id, { measures: cleared } as Parameters<typeof updatePattern>[1]);
    if (drumScheduler.isPlaying) drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === pattern.id)!);
  }, [pattern, updatePattern, pushUndo]);

  // ── Cell tap ─────────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (openBarMenu) setOpenBarMenu(null);
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };
  const handlePointerUp   = (e: React.PointerEvent) => {
    const s = pointerStart.current; if (!s) return; pointerStart.current = null;
    if (Math.abs(e.clientX - s.x) > 12 || Math.abs(e.clientY - s.y) > 12) return;
    const el = scrollRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx   = e.clientX - rect.left - LABEL_W;
    const cy   = e.clientY - rect.top + el.scrollTop;
    if (cx < 0) return;
    const sh       = sysHRef.current;
    const sysIdx   = Math.floor(cy / sh);
    const yInSys   = cy % sh - RULER_H;
    if (yInSys < 0) return;
    const instIdx      = Math.floor(yInSys / ROW_H);
    const measureInRow = Math.floor(cx / measureWRef.current);
    const mIdx         = sysIdx * mprRef.current + measureInRow;
    const stepInM      = Math.floor((cx % measureWRef.current) / stepWRef.current);
    const vis = allInstsRef.current;
    if (instIdx < 0 || instIdx >= vis.length) return;
    if (mIdx < 0 || mIdx >= pattern.measures.length) return;
    if (stepInM < 0 || stepInM >= spm) return;
    const inst = vis[instIdx];
    const m    = pattern.measures[mIdx];
    if (!m) return;
    pushUndo();
    toggleHit(pattern.id, m.id, inst, stepInM);
    // Read new state to determine the current variation for correct preview sound
    const newPat     = useDrumStore.getState().patterns.find(p => p.id === pattern.id);
    const newMeasure = newPat?.measures.find(ms => ms.id === m.id);
    const newHit     = newMeasure?.hits[inst]?.find(h => h.step === stepInM);
    const variation  = newHit?.variation ?? 'normal';
    const kitDefs    = KIT_DEFAULTS[kit].soundMap;
    const previewId  = getSoundForVariation(inst, variation, soundMap, kitDefs);
    const previewVol = variation === 'ghost' ? 0.25 : 0.55;
    if (drumScheduler.isPlaying) drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === pattern.id)!);
    drumScheduler.previewSound(previewId, previewVol, kit);
    setFocusedInst(inst);
  };

  // ── Back ─────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (inEditor) {
      if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
      setShowHamburger(false); setShowBpmPanel(false);
      setInEditor(false); setActiveTab('songs');
    } else {
      drumScheduler.stop();
      updateSettings({ appMode: 'chords' });
    }
  };

  // ── Create Beat ───────────────────────────────────────────────────────────
  const handleCreateBeat = useCallback(() => {
    if (!createName.trim()) return;
    const bpm = Math.max(40, Math.min(280, parseInt(createBpm, 10) || 120));
    const id = createBlankDrumSong(createName, createArtist, bpm, createNotes, createVariant);
    loadDrumSong(id);
    setKitType(createVariant, KIT_DEFAULTS[createVariant].soundMap);
    loadDrumSamples(createVariant);
    setActiveDrumSongId(id);
    setInEditor(true);
    setActiveTab('songs');
    setShowCreateForm(false);
    setCreateName(''); setCreateArtist(''); setCreateBpm('120'); setCreateNotes('');
    setCreateFamily('acoustic'); setCreateVariant('ludwig');
  }, [createName, createArtist, createBpm, createNotes, createVariant, createBlankDrumSong, loadDrumSong, setKitType]);

  // ── Songs ─────────────────────────────────────────────────────────────────
  const handleOpenSaveForm = useCallback(() => {
    if (activeDrumSongId) {
      const song = drumSongs.find(s => s.id === activeDrumSongId);
      if (song) { setSaveName(song.name); setSaveArtist(song.artist); setSaveNotes(song.notes ?? ''); }
    } else {
      setSaveName(''); setSaveArtist(''); setSaveNotes('');
    }
    setShowSaveForm(true);
  }, [activeDrumSongId, drumSongs]);

  const handleSaveAsNew = useCallback(() => {
    if (!saveName.trim()) return;
    saveDrumSong(saveName, saveArtist, saveNotes);
    setSaveName(''); setSaveArtist(''); setSaveNotes('');
    setShowSaveForm(false);
    setActiveDrumSongId(null);
  }, [saveName, saveArtist, saveNotes, saveDrumSong]);

  const handleUpdateSong = useCallback(() => {
    if (!saveName.trim() || !activeDrumSongId) return;
    updateDrumSong(activeDrumSongId, {
      name: saveName.trim(),
      artist: saveArtist.trim(),
      notes: saveNotes.trim(),
      patterns: JSON.parse(JSON.stringify(patterns)),
      activePatternId: activePatternId ?? patterns[0]?.id ?? '',
      kitType: kitType,
    });
    setShowSaveForm(false);
  }, [saveName, saveArtist, saveNotes, activeDrumSongId, updateDrumSong, patterns, activePatternId, kitType]);

  const handleLoadSong = useCallback((song: DrumSong) => {
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
    loadDrumSong(song.id);
    if (song.kitType) {
      setKitType(song.kitType, KIT_DEFAULTS[song.kitType].soundMap);
      loadDrumSamples(song.kitType);
    }
    setActiveDrumSongId(song.id);
    setInEditor(true);
    setActiveTab('songs');
  }, [loadDrumSong, setKitType]);

  const handleStartEdit = useCallback((song: DrumSong) => {
    setEditingSong(song);
    setEditingName(song.name);
    setEditingArtist(song.artist);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingSong) return;
    updateDrumSong(editingSong.id, { name: editingName.trim() || editingSong.name, artist: editingArtist.trim() });
    setEditingSong(null);
  }, [editingSong, editingName, editingArtist, updateDrumSong]);

  // ── Convenience: active song ─────────────────────────────────────────────
  const activeSong = activeDrumSongId ? drumSongs.find(s => s.id === activeDrumSongId) ?? null : null;

  // ── Render ────────────────────────────────────────────────────────────────
  const inputSt: React.CSSProperties = { width: '100%', background: 'var(--app-surface-high)', border: '1px solid rgba(72,72,72,0.12)', borderRadius: '0.625rem', padding: '11px 14px', color: 'var(--c-text-primary)', fontFamily: 'Inter', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelSt: React.CSSProperties = { color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 6 };
  const menuItemSt: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-primary)', fontSize: 12.5, fontFamily: 'Manrope', fontWeight: 600, textAlign: 'left', transition: 'background 120ms' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--app-bg)', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>

      {/* ── Safe-area spacer ─────────────────────────────────────────────── */}
      <div style={{ height: 'env(safe-area-inset-top)', background: 'var(--app-bg)', flexShrink: 0 }} />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, height: 52, display: 'flex', alignItems: 'center', padding: '10px 14px 0', gap: 8, background: 'var(--app-bg)' }}>
        {inEditor ? (
          <>
            <button onClick={handleBack} style={{ height: 30, width: 30, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-secondary)', flexShrink: 0, padding: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            {activeSong && (
              <p style={{ flex: 1, color: 'var(--c-text-primary)', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0, minWidth: 0 }}>
                {activeSong.name}
              </p>
            )}
            {!activeSong && <div style={{ flex: 1 }} />}
            {/* Editor controls — only on the grid tab */}
            {activeTab === 'songs' && (<>
              {/* Undo / Redo */}
              <button onClick={handleUndo} disabled={historyCount === 0} title="Undo (Ctrl+Z)"
                style={{ height: 30, width: 30, borderRadius: 8, background: historyCount > 0 ? 'rgba(128,128,128,0.08)' : 'transparent', border: `1px solid ${historyCount > 0 ? 'rgba(128,128,128,0.18)' : 'transparent'}`, cursor: historyCount > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: historyCount > 0 ? 'var(--c-text-secondary)' : 'var(--c-text-muted)', opacity: historyCount > 0 ? 1 : 0.35, flexShrink: 0, transition: 'all 180ms', padding: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 17, lineHeight: 1 }}>undo</span>
              </button>
              <button onClick={handleRedo} disabled={redoStack.current.length === 0} title="Redo (Ctrl+Y)"
                style={{ height: 30, width: 30, borderRadius: 8, background: redoStack.current.length > 0 ? 'rgba(128,128,128,0.08)' : 'transparent', border: `1px solid ${redoStack.current.length > 0 ? 'rgba(128,128,128,0.18)' : 'transparent'}`, cursor: redoStack.current.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: redoStack.current.length > 0 ? 'var(--c-text-secondary)' : 'var(--c-text-muted)', opacity: redoStack.current.length > 0 ? 1 : 0.35, flexShrink: 0, transition: 'all 180ms', padding: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 17, lineHeight: 1 }}>redo</span>
              </button>
              {/* EQ / quick-mixer button */}
              <button onClick={() => setShowMixerSheet(s => !s)} title="Mixer"
                style={{ height: 30, width: 30, borderRadius: 8, background: showMixerSheet ? `${accent.from}1e` : 'rgba(128,128,128,0.08)', border: `1px solid ${showMixerSheet ? accent.from + '33' : 'rgba(128,128,128,0.18)'}`, cursor: 'pointer', color: showMixerSheet ? accent.from : 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              </button>
              <button onClick={() => setShowHamburger(h => !h)} style={{ height: 30, width: 38, borderRadius: 8, background: showHamburger ? `${accent.from}1e` : 'rgba(128,128,128,0.08)', border: `1px solid ${showHamburger ? accent.from + '33' : 'rgba(128,128,128,0.1)'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', flexShrink: 0, transition: 'all 180ms' }}>
                {[0, 1, 2].map(i => <span key={i} style={{ display: 'block', width: i === 1 ? 10 : 14, height: 1.5, background: showHamburger ? accent.from : 'var(--c-text-secondary)', borderRadius: 2, transition: 'all 200ms' }} />)}
              </button>
            </>)}
          </>
        ) : (
          <>
            <AppModeMenuLogo color={isLight ? '#18181b' : '#d4d4d8'} size={13} />
            <div style={{ flex: 1 }} />
          </>
        )}
      </div>

      {/* ── Hamburger panel ──────────────────────────────────────────────── */}
      {inEditor && showHamburger && (
        <div style={{ flexShrink: 0, overflow: 'hidden', background: isAmoled ? '#000' : (isLight ? 'rgba(250,249,247,0.98)' : 'rgba(14,14,17,0.98)'), borderBottom: '1px solid rgba(128,128,128,0.10)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', animation: 'drumHamburgerIn 200ms cubic-bezier(0.22,1,0.36,1)' }}>
          <div style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 12 }}>
              <span style={{ flex: 1, color: 'var(--c-text-primary)', fontSize: 13, fontWeight: 500 }}>Loop</span>
              <button onClick={() => setLooping(l => !l)} style={{ width: 40, height: 22, borderRadius: 11, background: looping ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.18)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 220ms', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 3, left: looping ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)', display: 'block' }} />
              </button>
            </div>
            <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--c-text-primary)', fontSize: 13, fontWeight: 500 }}>Step Resolution</span>
                <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: 11, marginTop: 1 }}>{pattern.subdivision === 16 ? '16th notes' : '8th notes'}</span>
              </div>
              <button onClick={toggleSub} style={{ height: 28, padding: '0 14px', borderRadius: 8, background: `${accent.from}18`, border: `1px solid ${accent.from}33`, cursor: 'pointer', color: accent.from, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>1/{pattern.subdivision}</button>
            </div>
            <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 8 }}>
              <span style={{ flex: 1, color: 'var(--c-text-secondary)', fontSize: 13, fontWeight: 500 }}>Export</span>
              {/* JSON icon button */}
              <button onClick={() => { exportDrumSongJSON(patterns, activeSong); setShowHamburger(false); }}
                title="Export as JSON" className="btn-smooth"
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--app-surface-high)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: 17 }}>data_object</span>
              </button>
              {/* PDF icon button */}
              <button onClick={() => { setShowHamburger(false); setShowExportModal(true); }}
                title="Export as PDF" className="btn-smooth"
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--app-surface-high)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: 17 }}>picture_as_pdf</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ═══ SONGS LIST (Songs tab, not in editor) ═══════════════════════ */}
        {activeTab === 'songs' && !inEditor && (
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }} className="no-scrollbar">
            <div style={{ padding: '0 20px', marginTop: 12, marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '2.6rem', color: 'var(--c-text-primary)', letterSpacing: '-0.04em', lineHeight: 1, margin: 0 }}>Beats</h2>
              <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 13, marginTop: 4, margin: '4px 0 0' }}>Your drum songs</p>
            </div>
            {drumSongs.length === 0 ? (
              <div className="spring-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', margin: '0 20px', background: 'var(--app-surface)', borderRadius: '1.5rem', gap: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${accent.to}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>🥁</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, margin: 0 }}>No beats yet</p>
                  <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 13, marginTop: 4, margin: '4px 0 0' }}>Create your first drum beat to get started.</p>
                </div>
                <button onClick={() => setShowCreateForm(true)} className="btn-smooth"
                  style={{ padding: '12px 24px', borderRadius: 9999, background: `linear-gradient(135deg,${accent.from},${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: `0 4px 20px ${accent.to}44` }}>
                  New Beat
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }}>
                {drumSongs.map(song => {
                  const isDeleting = deletingId === song.id;
                  const isEditing  = editingSong?.id === song.id;
                  const kitLabel   = song.kitType ? KIT_LABEL[song.kitType] : 'No kit';
                  const pCount     = song.patterns.length;
                  const activePat  = song.patterns.find(p => p.id === song.activePatternId) ?? song.patterns[0];
                  const bpm        = activePat?.bpm ?? 120;
                  return (
                    <div key={song.id} className="card-hover" style={{ background: 'var(--app-surface)', borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(72,72,72,0.06)' }}>
                      {isEditing ? (
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input value={editingName} onChange={e => setEditingName(e.target.value)} autoFocus placeholder="Beat name" style={{ ...inputSt, fontWeight: 700 }} />
                          <input value={editingArtist} onChange={e => setEditingArtist(e.target.value)} placeholder="Artist (optional)" style={{ ...inputSt, fontSize: 13 }} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleSaveEdit} className="btn-smooth" style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: `linear-gradient(135deg,${accent.from},${accent.to})`, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700 }}>Save</button>
                            <button onClick={() => setEditingSong(null)} className="btn-smooth" style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 13, fontWeight: 600 }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button onClick={() => handleLoadSong(song)} style={{ width: '100%', textAlign: 'left', padding: '16px', display: 'flex', alignItems: 'center', gap: 14, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${accent.to}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 22 }}>🥁</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{song.name}</p>
                              {song.artist && <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 12, margin: '2px 0 0' }}>{song.artist}</p>}
                              <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, fontFamily: 'Manrope', fontWeight: 700, color: 'var(--c-text-primary)', background: 'var(--app-surface-high)', padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>{kitLabel}</span>
                                <span style={{ fontSize: 10, fontFamily: 'Manrope', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 11, lineHeight: 1 }}>speed</span>
                                  {bpm} BPM
                                </span>
                                <span style={{ fontSize: 10, fontFamily: 'Manrope', fontWeight: 700, color: 'var(--c-text-muted)' }}>{pCount} pattern{pCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: 20, flexShrink: 0 }}>chevron_right</span>
                          </button>
                          <div style={{ display: 'flex', borderTop: '1px solid rgba(72,72,72,0.07)' }}>
                            <button onClick={() => handleStartEdit(song)} className="btn-smooth" style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, background: 'transparent', border: 'none', borderRight: '1px solid rgba(72,72,72,0.07)', cursor: 'pointer' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14, flexShrink: 0 }}>edit</span>
                              Edit
                            </button>
                            {isDeleting ? (
                              <>
                                <button onClick={() => { deleteDrumSong(song.id); setDeletingId(null); }} className="btn-smooth" style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#ee7d77', fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, background: 'rgba(238,125,119,0.10)', border: 'none', cursor: 'pointer', borderRight: '1px solid rgba(72,72,72,0.07)' }}>
                                  Confirm
                                </button>
                                <button onClick={() => setDeletingId(null)} className="btn-smooth" style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button onClick={() => setDeletingId(song.id)} className="btn-smooth" style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#ee7d77', fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, flexShrink: 0 }}>delete</span>
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ DRUM GRID EDITOR (Songs tab, in editor) ══════════════════════ */}
        {activeTab === 'songs' && inEditor && (
          <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Row visibility toggle */}
            {extraInsts.length > 0 && (
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: 30, borderBottom: `1px solid ${barColor}`, background: 'var(--app-bg)' }}>
                <span style={{ color: 'var(--c-text-muted)', fontSize: 9.5, fontFamily: 'Manrope', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {showExtraRows ? `All rows (${visibleInsts.length})` : `Core rows (${visibleInsts.length})`}
                </span>
                <button onClick={() => setShowExtraRows(v => !v)} className="btn-smooth"
                  style={{ height: 22, padding: '0 10px', borderRadius: 999, background: showExtraRows ? `${accent.from}15` : 'rgba(128,128,128,0.10)', border: `1px solid ${showExtraRows ? accent.from + '30' : 'rgba(128,128,128,0.16)'}`, cursor: 'pointer', color: showExtraRows ? accent.from : 'var(--c-text-secondary)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 180ms' }}>
                  {showExtraRows ? (
                    <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 15l-6-6-6 6"/></svg>Hide extras</>
                  ) : (
                    <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>Show all</>
                  )}
                </button>
              </div>
            )}
            <div
              ref={scrollRef}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 8, paddingBottom: 100, position: 'relative' }}
              className="no-scrollbar"
            >
              <div ref={playheadRef} style={{ position: 'absolute', top: 8 + RULER_H, left: 0, width: 2, height: visibleInsts.length * ROW_H, background: accent.from, boxShadow: `0 0 8px ${accent.from}88`, pointerEvents: 'none', zIndex: 10, display: 'none', borderRadius: 1, willChange: 'transform', transform: 'translateZ(0)' }} />
              {systemRows.map((rowMeasures, sysIdx) => {
                const mStartIdx = sysIdx * measuresPerRow;
                return (
                  <div key={sysIdx} style={{ marginBottom: SYS_SEP }}>
                    <div style={{ display: 'flex', height: RULER_H, marginLeft: LABEL_W, borderBottom: `1px solid ${barColor}` }}>
                      {rowMeasures.map((m, mi) => {
                        const globalM   = mStartIdx + mi;
                        const canDelete = pattern.measures.length > 1;
                        const menuOpen  = openBarMenu === m.id;
                        const isFlash   = flashBarId  === m.id;
                        return (
                          <div key={mi} style={{ width: MEASURE_W, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 6, paddingRight: 2, borderLeft: mi > 0 ? `1px solid ${barColor}` : 'none', gap: 4, position: 'relative', background: isFlash ? `${accent.from}22` : 'transparent', transition: 'background 400ms' }}>
                            <span style={{ color: 'var(--c-text-primary)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope, sans-serif', opacity: 0.65, flexShrink: 0 }}>{globalM + 1}</span>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                              {Array.from({ length: pattern.timeSignature[0] }, (_, bi) => (
                                <div key={bi} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                  <div style={{ width: 1, height: bi === 0 ? 8 : 5, background: 'var(--c-text-primary)', opacity: bi === 0 ? 0.45 : 0.20 }} />
                                </div>
                              ))}
                            </div>
                            {/* ··· menu button */}
                            <button
                              onPointerDown={e => e.stopPropagation()}
                              onPointerUp={e => { e.stopPropagation(); setOpenBarMenu(menuOpen ? null : m.id); }}
                              style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: menuOpen ? `${accent.from}22` : 'transparent', border: `1px solid ${menuOpen ? accent.from + '44' : 'rgba(128,128,128,0.22)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: menuOpen ? accent.from : 'var(--c-text-muted)', fontSize: 8, letterSpacing: '0.05em', fontWeight: 900, lineHeight: 1, padding: 0, transition: 'all 140ms' }}
                            >···</button>
                            {/* Dropdown menu */}
                            {menuOpen && (
                              <div onPointerDown={e => e.stopPropagation()}
                                style={{ position: 'absolute', top: RULER_H + 2, left: 0, zIndex: 92, background: isAmoled ? 'rgba(4,4,4,0.98)' : (isLight ? 'rgba(255,255,255,0.98)' : 'rgba(18,18,22,0.98)'), border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.10)', borderRadius: 10, boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.14)' : '0 8px 32px rgba(0,0,0,0.55)', padding: '4px 0', minWidth: 148, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', animation: 'drumHamburgerIn 150ms cubic-bezier(0.22,1,0.36,1)' }}>
                                <button onPointerUp={e => { e.stopPropagation(); setCopiedMeasure(JSON.parse(JSON.stringify(m))); setOpenBarMenu(null); }} style={menuItemSt}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  Copy bar
                                </button>
                                <button onPointerUp={e => { e.stopPropagation(); pushUndo(); duplicateMeasure(pattern.id, m.id); setOpenBarMenu(null); }} style={menuItemSt}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="13" height="13" rx="2"/><path d="M9 17v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2"/></svg>
                                  Duplicate
                                </button>
                                {copiedMeasure && (
                                  <button onPointerUp={e => {
                                    e.stopPropagation();
                                    pushUndo();
                                    const newId = insertMeasureAfter(pattern.id, m.id, copiedMeasure.hits);
                                    setOpenBarMenu(null);
                                    setFlashBarId(newId);
                                    setTimeout(() => setFlashBarId(null), 700);
                                  }} style={{ ...menuItemSt, color: accent.from }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                                    Paste after
                                  </button>
                                )}
                                {canDelete && (
                                  <>
                                    <div style={{ height: 1, background: 'rgba(128,128,128,0.10)', margin: '4px 0' }} />
                                    <button onPointerUp={e => { e.stopPropagation(); pushUndo(); if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); } deleteMeasure(pattern.id, m.id); setOpenBarMenu(null); }} style={{ ...menuItemSt, color: '#f87171' }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                      Delete bar
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {visibleInsts.map((inst, instIdx) => {
                      const hitMap = allHitMaps.get(inst) ?? EMPTY_HIT_MAP;
                      const isFoc  = focusedInst === inst;
                      const varList = INST_VARIATIONS[inst];
                      return (
                        <div key={inst} style={{ display: 'flex', height: ROW_H, borderBottom: instIdx < visibleInsts.length - 1 ? `1px solid ${staffColor}` : `1.5px solid ${barColor}`, background: isFoc ? (isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.018)') : 'transparent' }}>
                          <div style={{ width: LABEL_W, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 12, paddingRight: 6, borderRight: `1px solid ${barColor}` }}>
                            <span style={{ fontSize: 8, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: isFoc ? 'var(--c-text-primary)' : 'var(--c-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'color 200ms' }}>{INST_LABEL[inst]}</span>
                            {varList && varList.length > 1 && (
                              <span style={{ fontSize: 6.5, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-muted)', opacity: 0.55, letterSpacing: '0.02em', whiteSpace: 'nowrap', marginTop: 1 }}>{varList.join(' · ')}</span>
                            )}
                          </div>
                          <InstrumentRow inst={inst} mStartIdx={mStartIdx} rowMeasures={rowMeasures} spm={spm} stepsPerBeat={stepsPerBeat} STEP_W={STEP_W} MEASURE_W={MEASURE_W} hitMap={hitMap} noteColor={noteColor} staffColor={staffColor} barColor={barColor} altBg={altBg} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 32, paddingTop: 8 }}>
                <button onClick={() => { pushUndo(); addMeasure(pattern.id); }} style={{ height: 36, padding: '0 24px', borderRadius: 999, background: 'transparent', border: 'var(--add-bar-border)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
                  onPointerEnter={e => { e.currentTarget.style.borderColor = accent.from + '70'; e.currentTarget.style.color = accent.from; }}
                  onPointerLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}>
                  <span style={{ fontSize: 16 }}>+</span><span>Add Bar</span>
                </button>
              </div>
            </div>
            {/* BPM + Play */}
            <div style={{ position: 'fixed', right: 14, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)', zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {/* Clear button — black bg, red trash icon */}
              <div style={{ position: 'relative' }}>
                {showClearConfirm && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, background: isAmoled ? 'rgba(4,4,4,0.98)' : (isLight ? 'rgba(250,250,252,0.98)' : 'rgba(18,18,22,0.98)'), border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', minWidth: 190, animation: 'drumHamburgerIn 150ms cubic-bezier(0.22,1,0.36,1)', zIndex: 80 }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif', lineHeight: 1.4 }}>Clear all hits?</p>
                    <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--c-text-muted)', lineHeight: 1.4 }}>This will erase every note in this pattern. You can undo after.</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setShowClearConfirm(false)} className="btn-smooth"
                        style={{ flex: 1, padding: '7px 0', borderRadius: 9, background: 'rgba(128,128,128,0.12)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope,sans-serif' }}>Cancel</button>
                      <button onClick={() => { handleClear(); setShowClearConfirm(false); }} className="btn-smooth"
                        style={{ flex: 1, padding: '7px 0', borderRadius: 9, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#f87171', fontFamily: 'Manrope,sans-serif' }}>Clear</button>
                    </div>
                  </div>
                )}
                <button onClick={() => setShowClearConfirm(s => !s)} title="Clear pattern" className="btn-smooth"
                  style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: showClearConfirm ? 'rgba(239,68,68,0.18)' : (isAmoled ? 'rgba(4,4,4,0.92)' : 'rgba(14,14,16,0.88)'), backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: showClearConfirm ? '0 2px 12px rgba(239,68,68,0.3)' : '0 2px 12px rgba(0,0,0,0.55)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: showClearConfirm ? '1.5px solid rgba(239,68,68,0.4)' : '1.5px solid rgba(255,255,255,0.08)', transition: 'all 160ms' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {showBpmPanel && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', right: 0, background: isAmoled ? 'rgba(0,0,0,0.97)' : (isLight ? 'rgba(255,255,255,0.96)' : 'rgba(18,18,22,0.96)'), border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.12)' : '0 8px 32px rgba(0,0,0,0.50)', whiteSpace: 'nowrap', animation: 'drumHamburgerIn 160ms cubic-bezier(0.22,1,0.36,1)' }}>
                    {([-10, -1, +1, +10] as const).map(d => (
                      <button key={d} onClick={() => adjustBpm(d)} style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(128,128,128,0.10)', border: '1px solid rgba(128,128,128,0.14)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 11, fontWeight: 700 }}>{d > 0 ? `+${d}` : d}</button>
                    ))}
                    <div style={{ width: 1, height: 24, background: 'rgba(128,128,128,0.2)', margin: '0 2px' }} />
                    <span style={{ color: accent.from, fontSize: 16, fontWeight: 800, minWidth: 36, textAlign: 'center' }}>{pattern.bpm}</span>
                  </div>
                )}
                <button onClick={() => setShowBpmPanel(s => !s)} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: showBpmPanel ? `${accent.from}22` : (isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)')), boxShadow: isLight ? '0 2px 12px rgba(0,0,0,0.10)' : '0 2px 12px rgba(0,0,0,0.50)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', cursor: 'pointer', transition: 'all 160ms', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: showBpmPanel ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(255,255,255,0.10)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 4h6l1.5 12H7.5L9 4Z" stroke={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} strokeWidth="1.7" strokeLinejoin="round" />
                    <line x1="12" y1="4" x2="17" y2="13" stroke={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} strokeWidth="1.7" strokeLinecap="round" />
                    <rect x="10" y="2" width="4" height="2.5" rx="1" fill={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} />
                  </svg>
                </button>
              </div>
              <button onClick={handlePlay} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: playing ? (isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)')) : `linear-gradient(135deg, ${accent.from}, ${accent.to})`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: playing ? 13 : 14, color: playing ? 'var(--c-text-secondary)' : '#fff', boxShadow: playing ? '0 4px 20px rgba(0,0,0,0.40), 0 0 0 1.5px rgba(255,255,255,0.08)' : `0 4px 20px ${accent.from}55, 0 0 0 1.5px rgba(255,255,255,0.12)`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', transition: 'all 170ms' }}>
                {playing ? '⏹' : '▶'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ PATTERNS TAB ═════════════════════════════════════════════════ */}
        {activeTab === 'patterns' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20, paddingBottom: 100 }} className="no-scrollbar">

            {/* ── Song Patterns ─────────────────────────────────────────── */}
            <SectionLabel>This Song's Patterns</SectionLabel>
            <Card>
              {patterns.map((p, i) => {
                const isCurrent = p.id === activePatternId;
                const isRenaming = patRenameId === p.id;
                return (
                  <div key={p.id} style={{ borderTop: i > 0 ? '1px solid rgba(128,128,128,0.07)' : 'none', background: isCurrent ? `${accent.from}10` : 'transparent' }}>
                    {isRenaming ? (
                      <div style={{ padding: '10px 14px', display: 'flex', gap: 6 }}>
                        <input
                          autoFocus
                          value={patRenameName}
                          onChange={e => setPatRenameName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { renamePattern(p.id, patRenameName.trim() || p.name); setPatRenameId(null); } else if (e.key === 'Escape') setPatRenameId(null); }}
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, background: 'var(--app-bg)', border: `1.5px solid ${accent.from}55`, color: 'var(--c-text-primary)', fontSize: 13, fontFamily: 'Manrope,sans-serif', outline: 'none' }}
                        />
                        <button onClick={() => setPatRenameId(null)} className="btn-smooth"
                          style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--c-text-secondary)' }}>✕</button>
                        <button onClick={() => { renamePattern(p.id, patRenameName.trim() || p.name); setPatRenameId(null); }} className="btn-smooth"
                          style={{ padding: '7px 12px', borderRadius: 8, background: `linear-gradient(135deg,${accent.from},${accent.to})`, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff' }}>OK</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
                        {isCurrent && <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent.from, flexShrink: 0 }} />}
                        <button
                          onClick={() => { setActivePattern(p.id); setActiveTab('songs'); setInEditor(true); }}
                          style={{ flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', minWidth: 0 }}>
                          <div style={{ color: isCurrent ? accent.from : 'var(--c-text-primary)', fontSize: 13.5, fontWeight: isCurrent ? 700 : 500, fontFamily: 'Manrope, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ color: 'var(--c-text-muted)', fontSize: 11, marginTop: 2 }}>{p.bpm} BPM · {p.timeSignature[0]}/{p.timeSignature[1]} · {p.measures.length} bar{p.measures.length !== 1 ? 's' : ''}</div>
                        </button>
                        <button onClick={() => { setPatRenameName(p.name); setPatRenameId(p.id); }} title="Rename" className="btn-smooth"
                          style={{ width: 30, height: 30, borderRadius: 7, background: 'transparent', border: '1px solid rgba(128,128,128,0.12)', cursor: 'pointer', color: 'var(--c-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                        </button>
                        <button onClick={() => duplicatePattern(p.id)} title="Duplicate" className="btn-smooth"
                          style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.12)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⧉</button>
                        {patterns.length > 1 && (
                          <button onClick={() => deletePattern(p.id)} title="Delete" className="btn-smooth"
                            style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer', color: '#f87171', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
            <div style={{ padding: '0 16px 24px', display: 'flex', gap: 8 }}>
              <button onClick={() => { addBlankPattern(); }} className="btn-smooth"
                style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'var(--app-surface)', border: '1px dashed rgba(128,128,128,0.22)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>+</span> New Pattern
              </button>
              <button onClick={() => duplicatePattern(activePatternId ?? patterns[0].id)} className="btn-smooth" title="Duplicate current"
                style={{ padding: '11px 14px', borderRadius: 12, background: 'var(--app-surface)', border: '1px solid rgba(128,128,128,0.15)', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⧉</button>
            </div>

            {/* ── Groove Library ────────────────────────────────────────── */}
            <SectionLabel>Groove Library</SectionLabel>

            {/* Save current pattern as groove */}
            <div style={{ padding: '0 16px 14px' }}>
              <button onClick={() => { setSavGrName(pattern.name); setSavGrTag(''); setShowSaveGroove(true); }} className="btn-smooth"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 14, background: `linear-gradient(135deg,${accent.from}18,${accent.to}12)`, border: `1px solid ${accent.from}30`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${accent.from},${accent.to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 16 }}>bookmark_add</span>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: accent.from, fontFamily: 'Manrope,sans-serif' }}>Save as Groove</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 1 }}>Store "{pattern.name}" to your library</div>
                </div>
              </button>
            </div>

            {/* Tag filter chips */}
            {grooves.length > 0 && (
              <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 16px 12px' }}>
                {(['', ...GROOVE_TAGS] as (GrooveTag | '')[]).map(tag => {
                  const label = tag === '' ? 'All' : tag;
                  const active = grooveFilter === tag;
                  return (
                    <button key={label} onClick={() => setGrooveFilter(tag as GrooveTag)} className="btn-smooth"
                      style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', border: active ? `1.5px solid ${accent.from}` : '1.5px solid rgba(128,128,128,0.18)', background: active ? `${accent.from}18` : 'transparent', color: active ? accent.from : 'var(--c-text-secondary)', transition: 'all 150ms' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Groove list */}
            {grooves.length === 0 ? (
              <div style={{ margin: '0 16px 24px', padding: '28px 20px', borderRadius: 14, background: 'var(--app-surface)', border: '1px dashed rgba(128,128,128,0.18)', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--c-text-muted)', display: 'block', marginBottom: 8 }}>library_music</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--c-text-secondary)', fontFamily: 'Manrope,sans-serif' }}>No grooves saved yet</p>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--c-text-muted)' }}>Save any pattern above to build your library</p>
              </div>
            ) : filteredGrooves.length === 0 ? (
              <div style={{ margin: '0 16px 24px', padding: '20px', textAlign: 'center', color: 'var(--c-text-muted)', fontSize: 12 }}>
                No grooves tagged "{grooveFilter}"
              </div>
            ) : (
              <Card>
                {filteredGrooves.map((g, i) => {
                  const isPreviewPlaying = previewingGrooveId === g.id && drumScheduler.isPlaying;
                  const menuOpen = grooveMenuId === g.id;
                  const isRenaming = grooveRenameId === g.id;
                  return (
                    <div key={g.id} style={{ borderTop: i > 0 ? '1px solid rgba(128,128,128,0.07)' : 'none', position: 'relative' }}>
                      {isRenaming ? (
                        /* Inline rename form */
                        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input
                            autoFocus
                            value={grooveRenameName}
                            onChange={e => setGrooveRenameName(e.target.value)}
                            style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--app-bg)', border: '1px solid rgba(128,128,128,0.22)', color: 'var(--c-text-primary)', fontSize: 13, fontFamily: 'Manrope,sans-serif', outline: 'none' }}
                          />
                          <div className="no-scrollbar" style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
                            {(['', ...GROOVE_TAGS] as (GrooveTag | '')[]).map(tag => {
                              const label = tag === '' ? 'None' : tag;
                              const active = grooveRenameTag === tag;
                              return (
                                <button key={label} onClick={() => setGrooveRenameTag(tag as GrooveTag)} className="btn-smooth"
                                  style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 16, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: active ? `1.5px solid ${accent.from}` : '1.5px solid rgba(128,128,128,0.18)', background: active ? `${accent.from}18` : 'transparent', color: active ? accent.from : 'var(--c-text-muted)' }}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setGrooveRenameId(null)} className="btn-smooth"
                              style={{ flex: 1, padding: '7px', borderRadius: 8, background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--c-text-secondary)' }}>Cancel</button>
                            <button onClick={() => { renameGroove(g.id, grooveRenameName, grooveRenameTag); setGrooveRenameId(null); }} className="btn-smooth"
                              style={{ flex: 1, padding: '7px', borderRadius: 8, background: `linear-gradient(135deg,${accent.from},${accent.to})`, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff' }}>Save</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
                          {/* Play preview button */}
                          <button onClick={() => handleGroovePreview(g)} className="btn-smooth"
                            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isPreviewPlaying ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.12)', color: isPreviewPlaying ? '#fff' : 'var(--c-text-secondary)', transition: 'all 160ms' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{isPreviewPlaying ? 'stop' : 'play_arrow'}</span>
                          </button>
                          {/* Groove info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                              {g.tag && <span style={{ fontSize: 9.5, fontWeight: 800, color: accent.from, background: `${accent.from}15`, borderRadius: 5, padding: '2px 6px', flexShrink: 0, letterSpacing: '0.03em' }}>{g.tag}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 1 }}>{g.bpm} BPM · {g.bars} bar{g.bars !== 1 ? 's' : ''} · 1/{g.subdivision}</div>
                          </div>
                          {/* 3-dots menu button */}
                          <button onClick={() => setGrooveMenuId(menuOpen ? null : g.id)} className="btn-smooth"
                            style={{ width: 36, height: 36, borderRadius: 9, border: menuOpen ? `1px solid ${accent.from}44` : '1px solid rgba(128,128,128,0.15)', background: menuOpen ? `${accent.from}12` : 'rgba(128,128,128,0.06)', cursor: 'pointer', color: menuOpen ? accent.from : 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 140ms' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>more_vert</span>
                          </button>
                        </div>
                      )}

                      {/* Context menu */}
                      {menuOpen && !isRenaming && (
                        <div style={{ margin: '0 14px 10px', background: isAmoled ? 'rgba(4,4,4,0.98)' : (isLight ? 'rgba(250,250,252,0.98)' : 'rgba(20,20,26,0.98)'), borderRadius: 12, border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', overflow: 'hidden', animation: 'drumHamburgerIn 150ms cubic-bezier(0.22,1,0.36,1)' }}>
                          {[
                            { label: 'Use this groove', sublabel: 'Replaces current pattern hits', icon: 'file_download', action: () => { loadGrooveReplace(g.id); setGrooveMenuId(null); setActiveTab('songs'); } },
                            { label: 'Append to pattern', sublabel: 'Add bars after current end', icon: 'playlist_add', action: () => { loadGrooveAppend(g.id); setGrooveMenuId(null); setActiveTab('songs'); } },
                            { label: 'Duplicate', sublabel: 'Save a copy to the library', icon: 'content_copy', action: () => { duplicateGroove(g.id); setGrooveMenuId(null); } },
                            { label: 'Rename / Retag', sublabel: 'Edit name or genre tag', icon: 'edit', action: () => { setGrooveRenameName(g.name); setGrooveRenameTag(g.tag); setGrooveRenameId(g.id); setGrooveMenuId(null); } },
                          ].map((item, idx) => (
                            <button key={item.label} onClick={item.action} className="btn-smooth"
                              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderTop: idx > 0 ? '1px solid rgba(128,128,128,0.08)' : 'none', cursor: 'pointer', textAlign: 'left' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-secondary)', flexShrink: 0 }}>{item.icon}</span>
                              <div>
                                <div style={{ color: 'var(--c-text-primary)', fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                                <div style={{ color: 'var(--c-text-muted)', fontSize: 10.5, marginTop: 1 }}>{item.sublabel}</div>
                              </div>
                            </button>
                          ))}
                          <div style={{ height: 1, background: 'rgba(128,128,128,0.10)', margin: '0 10px' }} />
                          <button onClick={() => { deleteGroove(g.id); setGrooveMenuId(null); if (previewingGrooveId === g.id) { drumScheduler.stop(); setPreviewingGrooveId(null); } }} className="btn-smooth"
                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 13, textAlign: 'left' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        )}


      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <DrumNav activeTab={activeTab} setTab={setActiveTab} accent={accent} isLight={isLight} isAmoled={isAmoled} />

      {/* ── Floating buttons (songs list only): import above + add ──────── */}
      {!inEditor && activeTab === 'songs' && (
        <div style={{ position: 'fixed', right: 20, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'none', zIndex: 50 }}>
          {/* Import JSON button */}
          <button
            onClick={() => setShowImportDrum(true)}
            className="btn-smooth"
            title="Import Drumex JSON"
            style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--app-surface-high)', border: '1px solid rgba(128,128,128,0.18)', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.28)', pointerEvents: 'auto', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>upload_file</span>
          </button>
          {/* New beat button */}
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-smooth"
            style={{ width: 54, height: 54, borderRadius: '50%', background: `linear-gradient(135deg,${accent.from},${accent.to})`, color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 20px ${accent.to}66`, pointerEvents: 'auto' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, fontVariationSettings: "'wght' 400" }}>add</span>
          </button>
        </div>
      )}

      {/* ── Save Groove sheet ────────────────────────────────────────────── */}
      {showSaveGroove && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setShowSaveGroove(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 300ms cubic-bezier(0.34,1.56,0.64,1) both', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(128,128,128,0.25)' }} />
            </div>
            <div style={{ padding: '8px 20px 16px', display: 'flex', alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif' }}>Save to Groove Library</span>
              <button onClick={() => setShowSaveGroove(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(128,128,128,0.12)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
            <div style={{ padding: '0 20px 16px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>NAME</label>
              <input
                autoFocus
                value={savGrName}
                onChange={e => setSavGrName(e.target.value)}
                placeholder="Groove name…"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--app-bg)', border: '1px solid rgba(128,128,128,0.2)', color: 'var(--c-text-primary)', fontSize: 14, fontFamily: 'Manrope,sans-serif', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>TAG</label>
              <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                {(['', ...GROOVE_TAGS] as (GrooveTag | '')[]).map(tag => {
                  const label = tag === '' ? 'None' : tag;
                  const active = savGrTag === tag;
                  return (
                    <button key={label} onClick={() => setSavGrTag(tag as GrooveTag)} className="btn-smooth"
                      style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', border: active ? `1.5px solid ${accent.from}` : '1.5px solid rgba(128,128,128,0.18)', background: active ? `${accent.from}18` : 'transparent', color: active ? accent.from : 'var(--c-text-secondary)', transition: 'all 140ms' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: '0 20px' }}>
              <button
                disabled={!savGrName.trim()}
                onClick={() => {
                  if (!savGrName.trim()) return;
                  saveGroove(savGrName.trim(), savGrTag);
                  setShowSaveGroove(false);
                }}
                className="btn-smooth"
                style={{ width: '100%', padding: '14px', borderRadius: 14, background: savGrName.trim() ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.12)', border: 'none', cursor: savGrName.trim() ? 'pointer' : 'default', color: savGrName.trim() ? '#fff' : 'var(--c-text-muted)', fontSize: 15, fontWeight: 700, fontFamily: 'Manrope,sans-serif', transition: 'all 200ms' }}>
                Save Groove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Mixer sheet (EQ button in editor toolbar) ──────────────── */}
      {showMixerSheet && inEditor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => setShowMixerSheet(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 300ms cubic-bezier(0.34,1.56,0.64,1) both', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(72,72,72,0.3)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 20px 10px', flexShrink: 0 }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)' }}>Pattern Mixer</span>
              <span style={{ fontSize: 11, color: 'var(--c-text-muted)', background: 'rgba(128,128,128,0.10)', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>{pattern.name}</span>
            </div>
            <div style={{ overflowY: 'auto', flexShrink: 1, paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)' }}>
              {/* Master Volume row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px 10px', borderBottom: '1px solid rgba(128,128,128,0.12)', marginBottom: 2 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent.from, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)', flex: 1 }}>Master</span>
                <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{Math.round(masterVolume * 100)}%</span>
                <input type="range" min={0} max={1} step={0.01} value={masterVolume}
                  onChange={e => setMasterVolume(parseFloat(e.target.value))}
                  style={{ width: 90, accentColor: accent.from, flexShrink: 0 }} />
                <div style={{ width: 32, flexShrink: 0 }} />
              </div>
              {ALL_INSTS.map((inst, i) => {
                const vol    = volumeMap[inst] ?? 1;
                const hidden = patternMuted.has(inst);
                const color  = INSTRUMENT_COLOR[inst] ?? accent.from;
                return (
                  <div key={inst} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderTop: i > 0 ? '1px solid rgba(128,128,128,0.07)' : 'none', opacity: hidden ? 0.5 : 1, transition: 'opacity 150ms' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: hidden ? 'var(--c-text-muted)' : 'var(--c-text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{INST_LABEL[inst]}</span>
                    <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{Math.round(vol * 100)}%</span>
                    <input type="range" min={0} max={1} step={0.01} value={vol}
                      onChange={e => setVolumeForInstrument(inst, parseFloat(e.target.value))}
                      style={{ width: 90, accentColor: color, flexShrink: 0 }} />
                    <button onClick={() => togglePatternMute(pattern.id, inst)} title={hidden ? 'Show row' : 'Hide row'}
                      style={{ width: 32, height: 32, borderRadius: 8, background: hidden ? 'rgba(128,128,128,0.08)' : `${color}18`, border: hidden ? '1px solid rgba(128,128,128,0.12)' : `1px solid ${color}30`, cursor: 'pointer', color: hidden ? 'var(--c-text-muted)' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 180ms', padding: 0 }}>
                      {hidden
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Export modal (full-screen) ────────────────────────────────────── */}
      {showExportModal && (
        <DrumExportModal
          patterns={patterns}
          song={activeSong}
          accent={accent}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* ── Import modal ─────────────────────────────────────────────────── */}
      {showImportDrum && (
        <DrumImportModal
          accent={accent}
          onImport={(name, artist, notes, pats, activeId) => {
            importDrumSong(name, artist, notes, pats, activeId);
            setShowImportDrum(false);
          }}
          onClose={() => setShowImportDrum(false)}
        />
      )}

      {/* ── Create Beat modal ────────────────────────────────────────────── */}
      {showCreateForm && (() => {
        const activeFamilyEntry = KIT_FAMILY.find(f => f.id === createFamily) ?? KIT_FAMILY[0];
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
            <div onClick={() => setShowCreateForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="no-scrollbar">
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
                <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(72,72,72,0.3)' }} />
              </div>
              <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: 20, margin: 0 }}>New Beat</p>

                {/* ── Beat info ── */}
                <div><label style={labelSt}>Beat Title</label><input value={createName} onChange={e => setCreateName(e.target.value)} autoFocus placeholder="e.g. Funky Groove" style={inputSt} onKeyDown={e => { if (e.key === 'Enter' && createName.trim()) handleCreateBeat(); }} /></div>
                <div><label style={labelSt}>Artist</label><input value={createArtist} onChange={e => setCreateArtist(e.target.value)} placeholder="e.g. The Beatmakers" style={inputSt} /></div>

                {/* ── BPM ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelSt}>BPM</label>
                    <input type="number" min={40} max={280} value={createBpm} onChange={e => setCreateBpm(e.target.value)} style={inputSt} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 42 }}>
                      {([80, 100, 120, 140] as const).map(b => (
                        <button key={b} onClick={() => setCreateBpm(String(b))} className="btn-smooth"
                          style={{ flex: 1, height: 34, borderRadius: 8, background: createBpm === String(b) ? `${accent.from}22` : 'var(--app-surface-high)', border: `1px solid ${createBpm === String(b) ? accent.from + '44' : 'rgba(72,72,72,0.12)'}`, cursor: 'pointer', color: createBpm === String(b) ? accent.from : 'var(--c-text-muted)', fontSize: 10, fontWeight: 700 }}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Drum Kit ── */}
                <div>
                  <label style={labelSt}>Drum Kit</label>
                  <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 8 }}>
                    {KIT_FAMILY.map(fam => {
                      const isActive = fam.id === createFamily;
                      return (
                        <button key={fam.id} className="btn-smooth"
                          onClick={() => {
                            setCreateFamily(fam.id);
                            setCreateVariant(fam.variations[0].kit);
                          }}
                          style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 14px', borderRadius: 14, cursor: 'pointer', background: isActive ? `linear-gradient(135deg,${accent.from}22,${accent.to}12)` : 'var(--app-surface-high)', border: isActive ? `1.5px solid ${accent.from}55` : '1.5px solid transparent', transition: 'all 160ms' }}>
                          <span style={{ fontSize: 22 }}>{fam.emoji}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', color: isActive ? accent.from : 'var(--c-text-secondary)', whiteSpace: 'nowrap' }}>{fam.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Variation chips ── */}
                <div>
                  <label style={labelSt}>Sound</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {activeFamilyEntry.variations.map(v => {
                      const isSel = createVariant === v.kit;
                      return (
                        <button key={v.kit} className="btn-smooth"
                          onClick={() => {
                            setCreateVariant(v.kit);
                            loadDrumSamples(v.kit);
                            const sm = KIT_DEFAULTS[v.kit].soundMap;
                            const kickId = sm.kick ?? 'kick-std';
                            const hhId   = sm['hihat-closed'] ?? 'hh-c-tight';
                            drumScheduler.previewSound(kickId, 0.82, v.kit);
                            setTimeout(() => drumScheduler.previewSound(hhId, 0.6, v.kit), 95);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, cursor: 'pointer', background: isSel ? `linear-gradient(135deg,${accent.from}18,${accent.to}10)` : 'var(--app-bg)', border: isSel ? `1.5px solid ${accent.from}55` : '1.5px solid rgba(128,128,128,0.12)', transition: 'all 150ms' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: isSel ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: isSel ? '#fff' : 'var(--c-text-muted)' }}>
                              {isSel ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: isSel ? accent.from : 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif', transition: 'color 150ms' }}>{v.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 1 }}>{v.desc}</div>
                          </div>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-text-muted)', flexShrink: 0 }}>volume_up</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Notes (collapsed by default feel) ── */}
                <div><label style={labelSt}>Notes</label><textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)} rows={2} placeholder="Optional notes…" style={{ ...inputSt, resize: 'none', lineHeight: 1.5 } as React.CSSProperties} /></div>

                {/* ── Actions ── */}
                <div style={{ display: 'flex', gap: 10, paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
                  <button onClick={() => setShowCreateForm(false)} className="btn-smooth" style={{ flex: 1, padding: 14, borderRadius: 9999, background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleCreateBeat} className="btn-smooth"
                    style={{ flex: 2, padding: 14, borderRadius: 9999, background: createName.trim() ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(72,72,72,0.2)', color: createName.trim() ? '#fff' : '#acabaa', fontFamily: 'Manrope', fontWeight: 800, border: 'none', cursor: createName.trim() ? 'pointer' : 'default', boxShadow: createName.trim() ? `0 4px 20px ${accent.to}40` : 'none', transition: 'all 200ms' }}>
                    Create Beat
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

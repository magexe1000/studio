import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import {
  useDrumStore, KIT_INSTRUMENTS,
  stepsPerMeasure, INST_VARIATIONS,
  type DrumInstrument, type KitType, type DrumSong, type NoteVariation,
} from '../store/useDrumStore';
import {
  drumScheduler, samplePool, loadDrumSamples, KIT_DEFAULTS,
  getSoundForVariation,
  type SampleStatus,
} from '../lib/drumAudio';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';

// ── Layout ─────────────────────────────────────────────────────────────────
const LABEL_W  = 72;
const ROW_H    = 52;
const RULER_H  = 26;
const SYS_SEP  = 20;
const MIN_STEP = 16;

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
  ludwig: `${BASE}/kit-acoustic.png`,
  jazz:   `${BASE}/kit-jazz.png`,
  rock:   `${BASE}/kit-rock.png`,
  vintage:`${BASE}/kit-vintage.png`,
  studio: `${BASE}/kit-studio.png`,
  r8:     `${BASE}/kit-advanced.png`,
  linn:   `${BASE}/kit-linn.png`,
  funk:   `${BASE}/kit-funk.png`,
  cr78:   `${BASE}/kit-cr78.png`,
  tr808:  `${BASE}/kit-tr808.png`,
  techno: `${BASE}/kit-electronic.png`,
  stark:  `${BASE}/kit-stark.png`,
};
const KIT_CATEGORIES: { id: string; label: string; kits: KitType[] }[] = [
  { id: 'acoustic', label: 'Acoustic Drums', kits: ['ludwig', 'jazz', 'rock', 'vintage'] },
  { id: 'studio',   label: 'Studio Drums',   kits: ['studio', 'r8', 'linn', 'funk'] },
  { id: 'electric', label: 'Electric Drums', kits: ['cr78', 'tr808', 'techno', 'stark'] },
];

// ── Tabs / Mode ────────────────────────────────────────────────────────────
type DrumTab  = 'kit' | 'songs';
type DrumMode = 'edit' | 'nav'; // edit = full-screen sheet; nav = kit/songs settings

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
const InstrumentRow = ({
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
};

// ── Tab icons ──────────────────────────────────────────────────────────────
function IconKit({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6; const ao = active ? 0.15 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <circle cx="12" cy="15" r="6.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={ao} />
      <circle cx="12" cy="15" r="2.8" fill="currentColor" fillOpacity={active ? 0.6 : 0} />
      <line x1="5" y1="5.5" x2="10.5" y2="5.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="13.5" y1="5.5" x2="19" y2="5.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}
function IconMix({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6; const ao = active ? 1 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <line x1="5"  y1="18" x2="5"  y2="10" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="5"  cy="10" r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor" strokeWidth={active ? 0 : sw - 0.3} />
      <line x1="12" y1="18" x2="12" y2="7" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="12" cy="7"  r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor" strokeWidth={active ? 0 : sw - 0.3} />
      <line x1="19" y1="18" x2="19" y2="13" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="19" cy="13" r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor" strokeWidth={active ? 0 : sw - 0.3} />
    </svg>
  );
}

function IconEditor({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <line x1="3" y1="5"  x2="21" y2="5"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="3" y1="9"  x2="15" y2="9"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="3" y1="13" x2="21" y2="13" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="3" y1="17" x2="15" y2="17" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}
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

// ── Settings bottom nav (songs / editor / kit) ─────────────────────────────
type AllTab = 'songs' | 'editor' | 'kit';
const ALL_NAV_TABS: { id: AllTab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'songs',  label: 'Songs',  Icon: IconDrumSongs },
  { id: 'editor', label: 'Editor', Icon: IconEditor    },
  { id: 'kit',    label: 'Kit',    Icon: IconKit        },
];
function SettingsNav({ activeTab, setTab, drumMode, setDrumMode, accent, isLight, isAmoled }: {
  activeTab: DrumTab; setTab: (t: DrumTab) => void;
  drumMode: DrumMode; setDrumMode: (m: DrumMode) => void;
  accent: { from: string; to: string };
  isLight: boolean; isAmoled: boolean;
}) {
  const currentId: AllTab = drumMode === 'edit' ? 'editor' : activeTab;
  const navRef  = useRef<HTMLElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const prevIdx = useRef(ALL_NAV_TABS.findIndex(x => x.id === currentId));
  const strT    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressed, setPressed] = useState<AllTab | null>(null);

  const measure = (idx: number) => {
    const btn = btnRefs.current[idx]; const nav = navRef.current;
    if (!btn || !nav) return null;
    const nr = nav.getBoundingClientRect(); const br = btn.getBoundingClientRect();
    return { left: br.left - nr.left, right: br.right - nr.left };
  };
  useEffect(() => {
    const m = measure(ALL_NAV_TABS.findIndex(x => x.id === currentId));
    if (m) setPill({ ...m, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handlePress = (id: AllTab) => {
    if (id === 'editor') { setDrumMode('edit'); }
    else { setDrumMode('nav'); setTab(id as DrumTab); }
  };

  // Pill stretch animation — cancel and resolve both edges cleanly on rapid tap
  useEffect(() => {
    const ni = ALL_NAV_TABS.findIndex(x => x.id === currentId);
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
  }, [currentId]);

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
        const isActive = currentId === id; const isPressed = pressed === id;
        return (
          <button key={id} ref={el => { btnRefs.current[i] = el; }}
            onPointerDown={() => setPressed(id)}
            onPointerUp={() => { setPressed(null); handlePress(id); }}
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

// ── DrumEditor ─────────────────────────────────────────────────────────────
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
  const {
    patterns, activePatternId,
    soundMap, volumeMap, masterVolume,
    kitType, activeInstruments,
    setKitType, toggleInstrument, setMasterVolume,
    toggleHit, addMeasure, deleteMeasure, updatePattern,
    drumSongs, saveDrumSong, loadDrumSong, deleteDrumSong, updateDrumSong,
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
  const [drumMode, setDrumMode]         = useState<DrumMode>('nav');
  const [activeTab, setActiveTab]       = useState<DrumTab>('songs');
  const [playing, setPlaying]           = useState(false);
  const [looping, setLooping]           = useState(true);
  const [sampleStatus, setSampleStatus] = useState<SampleStatus>('idle');
  const [showBpmPanel,   setShowBpmPanel]   = useState(false);
  const [showHamburger,  setShowHamburger]  = useState(false);
  const [expandedCats,   setExpandedCats]   = useState<Set<string>>(() => new Set(['acoustic']));
  const [focusedInst,    setFocusedInst]    = useState<DrumInstrument | null>(null);
  // Songs panel state
  const [showSaveForm,     setShowSaveForm]     = useState(false);
  const [saveName,         setSaveName]         = useState('');
  const [saveArtist,       setSaveArtist]       = useState('');
  const [saveNotes,        setSaveNotes]        = useState('');
  const [deletingId,       setDeletingId]       = useState<string | null>(null);
  const [editingSong,      setEditingSong]      = useState<DrumSong | null>(null);
  const [editingName,      setEditingName]      = useState('');
  const [editingArtist,    setEditingArtist]    = useState('');
  const [activeDrumSongId, setActiveDrumSongId] = useState<string | null>(null);

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

  // ── Layout ───────────────────────────────────────────────────────────────
  const availableW     = containerW - LABEL_W;
  const measuresPerRow = Math.max(1, Math.floor(availableW / (spm * MIN_STEP)));
  const MEASURE_W      = availableW / measuresPerRow;
  const STEP_W         = MEASURE_W / spm;
  const SYSTEM_H       = RULER_H + ALL_INSTS.length * ROW_H;
  const FULL_SYS_H     = SYSTEM_H + SYS_SEP;

  const spmRef      = useRef(spm);          spmRef.current = spm;
  const mprRef      = useRef(measuresPerRow); mprRef.current = measuresPerRow;
  const stepWRef    = useRef(STEP_W);        stepWRef.current = STEP_W;
  const measureWRef = useRef(MEASURE_W);     measureWRef.current = MEASURE_W;
  const sysHRef     = useRef(FULL_SYS_H);   sysHRef.current = FULL_SYS_H;
  const allInstsRef = useRef(ALL_INSTS);     allInstsRef.current = ALL_INSTS;

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
    ALL_INSTS.forEach(inst => {
      const m2 = new Map<number, NoteVariation>();
      pattern.measures.forEach((m, mIdx) => {
        m.hits[inst]?.forEach(h => m2.set(mIdx * spm + h.step, h.variation ?? 'normal'));
      });
      map.set(inst, m2);
    });
    return map;
  }, [pattern, spm, ALL_INSTS]);

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
    const cleared = pattern.measures.map(m => ({ ...m, hits: {} as Record<DrumInstrument, never[]> }));
    updatePattern(pattern.id, { measures: cleared } as Parameters<typeof updatePattern>[1]);
    if (drumScheduler.isPlaying) drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === pattern.id)!);
  }, [pattern, updatePattern]);

  // ── Cell tap ─────────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => { pointerStart.current = { x: e.clientX, y: e.clientY }; };
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
    if (instIdx < 0 || instIdx >= ALL_INSTS.length) return;
    if (mIdx < 0 || mIdx >= pattern.measures.length) return;
    if (stepInM < 0 || stepInM >= spm) return;
    const inst = ALL_INSTS[instIdx];
    const m    = pattern.measures[mIdx];
    if (!m) return;
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
    if (drumMode === 'edit') { setDrumMode('nav'); }
    else { drumScheduler.stop(); updateSettings({ appMode: 'chords' }); }
  };

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
    setActiveDrumSongId(song.id);
    setDrumMode('edit');
  }, [loadDrumSong]);

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--app-bg)', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>

      {/* ── Safe-area spacer ─────────────────────────────────────────────── */}
      <div style={{ height: 'env(safe-area-inset-top)', background: 'var(--app-bg)', flexShrink: 0 }} />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 52,
        display: 'flex', alignItems: 'center', padding: '10px 24px 0', gap: 10,
        background: 'var(--app-bg)',
      }}>
        {/* Logo — always visible */}
        <AppModeMenuLogo color={isLight ? '#18181b' : '#d4d4d8'} size={13} />

        <div style={{ flex: 1 }} />

        {/* Clear + Save — only in editor */}
        {drumMode === 'edit' && (<>
          <button onClick={handleClear} style={{ height: 30, padding: '0 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(128,128,128,0.18)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            Clear
          </button>

          {/* Save */}
          <button
            onClick={handleOpenSaveForm}
            style={{ height: 30, padding: '0 12px', borderRadius: 8, background: activeDrumSongId ? `linear-gradient(135deg,${accent.from}22,${accent.to}18)` : 'rgba(128,128,128,0.08)', border: `1px solid ${activeDrumSongId ? accent.from + '44' : 'rgba(128,128,128,0.18)'}`, cursor: 'pointer', color: activeDrumSongId ? accent.from : 'var(--c-text-secondary)', fontSize: 11, fontWeight: 700, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
            aria-label="Save beat"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            Save
          </button>

          {/* Loop */}
          <button
            onClick={() => setLooping(l => !l)}
            style={{ height: 30, width: 38, borderRadius: 8, background: looping ? `${accent.from}22` : 'rgba(128,128,128,0.08)', border: `1px solid ${looping ? accent.from + '44' : 'rgba(128,128,128,0.14)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: looping ? accent.from : 'var(--c-text-muted)', transition: 'all 180ms', flexShrink: 0 }}
            aria-label="Toggle loop"
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>⟳</span>
          </button>

          {/* Step resolution */}
          <button
            onClick={toggleSub}
            style={{ height: 30, padding: '0 10px', borderRadius: 8, background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.14)', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 10, fontWeight: 800, transition: 'all 180ms', flexShrink: 0 }}
            aria-label="Step resolution"
          >
            1/{pattern.subdivision}
          </button>

          {/* Hamburger ≡ */}
          <button
            onClick={() => setShowHamburger(h => !h)}
            style={{ height: 30, width: 38, borderRadius: 8, background: showHamburger ? `${accent.from}1e` : 'rgba(128,128,128,0.08)', border: `1px solid ${showHamburger ? accent.from + '33' : 'rgba(128,128,128,0.1)'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', flexShrink: 0, transition: 'all 180ms' }}
            aria-label="Options"
          >
            {[0, 1, 2].map(i => (
              <span key={i} style={{ display: 'block', width: i === 1 ? 10 : 14, height: 1.5, background: showHamburger ? accent.from : 'var(--c-text-secondary)', borderRadius: 2, transition: 'all 200ms' }} />
            ))}
          </button>
        </>)}
      </div>

      {/* ── Hamburger panel ────────────────────────────────────────────────── */}
      {showHamburger && (
        <div style={{
          flexShrink: 0, overflow: 'hidden',
          background: isAmoled ? '#000' : (isLight ? 'rgba(250,249,247,0.98)' : 'rgba(14,14,17,0.98)'),
          borderBottom: '1px solid rgba(128,128,128,0.10)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          animation: 'drumHamburgerIn 200ms cubic-bezier(0.22,1,0.36,1)',
        }}>
          <div style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Row: Loop */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 12 }}>
              <span style={{ flex: 1, color: 'var(--c-text-primary)', fontSize: 13, fontWeight: 500 }}>Loop</span>
              <button onClick={() => setLooping(l => !l)} style={{ width: 40, height: 22, borderRadius: 11, background: looping ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.18)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 220ms', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 3, left: looping ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)', display: 'block' }} />
              </button>
            </div>

            <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 4px' }} />

            {/* Row: Step resolution */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--c-text-primary)', fontSize: 13, fontWeight: 500 }}>Step Resolution</span>
                <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: 11, marginTop: 1 }}>{pattern.subdivision === 16 ? '16th notes' : '8th notes'}</span>
              </div>
              <button onClick={toggleSub} style={{ height: 28, padding: '0 14px', borderRadius: 8, background: `${accent.from}18`, border: `1px solid ${accent.from}33`, cursor: 'pointer', color: accent.from, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>1/{pattern.subdivision}</button>
            </div>

            <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 4px' }} />

            {/* Row: Master Volume */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 12 }}>
              <span style={{ flex: 1, color: 'var(--c-text-primary)', fontSize: 13, fontWeight: 500 }}>Volume</span>
              <span style={{ color: 'var(--c-text-secondary)', fontSize: 12, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>{Math.round(masterVolume * 100)}%</span>
              <input type="range" min={0} max={1} step={0.01} value={masterVolume}
                onChange={e => setMasterVolume(parseFloat(e.target.value))}
                style={{ width: 100, accentColor: accent.from, flexShrink: 0 }} />
            </div>

          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ═══ SHEET MUSIC EDITOR ═══════════════════════════════════════════ */}
        {drumMode === 'edit' && (
          <div ref={containerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              ref={scrollRef}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', paddingTop: 12, paddingBottom: 100, position: 'relative' }}
              className="no-scrollbar"
            >
              {/* Playhead */}
              <div ref={playheadRef} style={{ position: 'absolute', top: 12, left: 0, width: 2, height: ALL_INSTS.length * ROW_H, background: accent.from, boxShadow: `0 0 8px ${accent.from}88`, pointerEvents: 'none', zIndex: 10, display: 'none', borderRadius: 1 }} />

              {/* System rows */}
              {systemRows.map((rowMeasures, sysIdx) => {
                const mStartIdx = sysIdx * measuresPerRow;
                return (
                  <div key={sysIdx} style={{ marginBottom: SYS_SEP }}>
                    {/* Ruler */}
                    <div style={{ display: 'flex', height: RULER_H, marginLeft: LABEL_W, borderBottom: `1px solid ${barColor}` }}>
                      {rowMeasures.map((m, mi) => {
                        const globalM   = mStartIdx + mi;
                        const canDelete = globalM > 0;
                        return (
                          <div key={mi} style={{ width: MEASURE_W, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 6, paddingRight: 4, borderLeft: mi > 0 ? `1px solid ${barColor}` : 'none', gap: 4 }}>
                            <span style={{ color: 'var(--c-text-primary)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope, sans-serif', opacity: 0.65 }}>
                              {globalM + 1}
                            </span>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                              {Array.from({ length: pattern.timeSignature[0] }, (_, bi) => (
                                <div key={bi} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                  <div style={{ width: 1, height: bi === 0 ? 8 : 5, background: 'var(--c-text-primary)', opacity: bi === 0 ? 0.45 : 0.20 }} />
                                </div>
                              ))}
                            </div>
                            {/* Delete measure button — only for measures after the first */}
                            {canDelete && (
                              <button
                                onPointerDown={e => e.stopPropagation()}
                                onPointerUp={e => {
                                  e.stopPropagation();
                                  if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
                                  deleteMeasure(pattern.id, m.id);
                                }}
                                style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.30)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#f87171', lineHeight: 1, padding: 0 }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Instrument staves */}
                    {ALL_INSTS.map((inst, instIdx) => {
                      const hitMap = allHitMaps.get(inst) ?? new Map<number, NoteVariation>();
                      const isFoc  = focusedInst === inst;
                      // Build a short sub-label showing available variations
                      const varList = INST_VARIATIONS[inst];
                      return (
                        <div key={inst} style={{
                          display: 'flex', height: ROW_H,
                          borderBottom: instIdx < ALL_INSTS.length - 1 ? `1px solid ${staffColor}` : `1.5px solid ${barColor}`,
                          background: isFoc ? (isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.018)') : 'transparent',
                        }}>
                          <div style={{ width: LABEL_W, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 12, paddingRight: 6, borderRight: `1px solid ${barColor}` }}>
                            <span style={{ fontSize: 8, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: isFoc ? 'var(--c-text-primary)' : 'var(--c-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'color 200ms' }}>
                              {INST_LABEL[inst]}
                            </span>
                            {varList && varList.length > 1 && (
                              <span style={{ fontSize: 6.5, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-muted)', opacity: 0.55, letterSpacing: '0.02em', whiteSpace: 'nowrap', marginTop: 1 }}>
                                {varList.join(' · ')}
                              </span>
                            )}
                          </div>
                          <InstrumentRow
                            inst={inst} mStartIdx={mStartIdx} rowMeasures={rowMeasures}
                            spm={spm} stepsPerBeat={stepsPerBeat} STEP_W={STEP_W} MEASURE_W={MEASURE_W}
                            hitMap={hitMap} noteColor={noteColor} staffColor={staffColor}
                            barColor={barColor} altBg={altBg}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Add Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 32, paddingTop: 8 }}>
                <button
                  onClick={() => addMeasure(pattern.id)}
                  style={{
                    height: 36, padding: '0 24px', borderRadius: 999, background: 'transparent',
                    border: 'var(--add-bar-border)',
                    cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 160ms',
                  }}
                  onPointerEnter={e => { e.currentTarget.style.borderColor = accent.from + '70'; e.currentTarget.style.color = accent.from; }}
                  onPointerLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
                >
                  <span style={{ fontSize: 16 }}>+</span>
                  <span>Add Bar</span>
                </button>
              </div>
            </div>

            {/* ── BPM + Play stacked vertically at bottom-right ── */}
            <div style={{
              position: 'fixed', right: 14,
              bottom: 'max(10px, env(safe-area-inset-bottom))',
              zIndex: 60,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              {/* BPM / metronome button (top) */}
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* BPM adjuster panel — pops up above the button */}
                {showBpmPanel && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 10px)', right: 0,
                    background: isAmoled ? 'rgba(0,0,0,0.97)' : (isLight ? 'rgba(255,255,255,0.96)' : 'rgba(18,18,22,0.96)'),
                    border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6,
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.12)' : '0 8px 32px rgba(0,0,0,0.50)',
                    whiteSpace: 'nowrap',
                    animation: 'drumHamburgerIn 160ms cubic-bezier(0.22,1,0.36,1)',
                  }}>
                    {([-10, -1, +1, +10] as const).map(d => (
                      <button key={d} onClick={() => adjustBpm(d)} style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(128,128,128,0.10)', border: '1px solid rgba(128,128,128,0.14)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 11, fontWeight: 700 }}>
                        {d > 0 ? `+${d}` : d}
                      </button>
                    ))}
                    <div style={{ width: 1, height: 24, background: 'rgba(128,128,128,0.2)', margin: '0 2px' }} />
                    <span style={{ color: accent.from, fontSize: 16, fontWeight: 800, minWidth: 36, textAlign: 'center' }}>{pattern.bpm}</span>
                  </div>
                )}
                <button
                  onClick={() => setShowBpmPanel(s => !s)}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', border: 'none',
                    background: showBpmPanel ? `${accent.from}22` : (isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)')),
                    boxShadow: isLight ? '0 2px 12px rgba(0,0,0,0.10)' : '0 2px 12px rgba(0,0,0,0.50)',
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    cursor: 'pointer', transition: 'all 160ms',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    outline: showBpmPanel ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(255,255,255,0.10)',
                  }}
                  aria-label={`BPM: ${pattern.bpm}`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 4h6l1.5 12H7.5L9 4Z" stroke={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} strokeWidth="1.7" strokeLinejoin="round" />
                    <line x1="12" y1="4" x2="17" y2="13" stroke={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} strokeWidth="1.7" strokeLinecap="round" />
                    <rect x="10" y="2" width="4" height="2.5" rx="1" fill={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} />
                  </svg>
                </button>
              </div>

              {/* Play button (bottom — aligned with nav bar) */}
              <button
                onClick={handlePlay}
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: 'none',
                  background: playing
                    ? (isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)'))
                    : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: playing ? 13 : 14, color: playing ? 'var(--c-text-secondary)' : '#fff',
                  boxShadow: playing
                    ? '0 4px 20px rgba(0,0,0,0.40), 0 0 0 1.5px rgba(255,255,255,0.08)'
                    : `0 4px 20px ${accent.from}55, 0 0 0 1.5px rgba(255,255,255,0.12)`,
                  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                  transition: 'all 170ms',
                }}
              >
                {playing ? '⏹' : '▶'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ SONGS ════════════════════════════════════════════════════════ */}
        {drumMode === 'nav' && activeTab === 'songs' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }} className="no-scrollbar">

            {/* Songs list */}
            {drumSongs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '72px 24px 48px', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--app-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🥁</div>
                <p style={{ color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 600, margin: 0, textAlign: 'center' }}>No saved beats yet</p>
                <p style={{ color: 'var(--c-text-muted)', fontSize: 12, margin: 0, textAlign: 'center', lineHeight: 1.5 }}>Go to the Editor, build your beat, then tap <strong>Save</strong> in the top bar to store it here.</p>
              </div>
            ) : (
              <div style={{ padding: '8px 16px 0' }}>
                <p style={{ color: 'var(--c-text-muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 10px 2px' }}>
                  {drumSongs.length} saved beat{drumSongs.length !== 1 ? 's' : ''}
                </p>
                {drumSongs.map(song => {
                  const isDeleting = deletingId === song.id;
                  const isEditing  = editingSong?.id === song.id;
                  const isActive   = activeDrumSongId === song.id;
                  const kitLabel   = song.kitType ? KIT_LABEL[song.kitType] : 'No kit';
                  const pCount     = song.patterns.length;
                  const ts         = new Date(song.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <div key={song.id} style={{
                      background: isActive ? `linear-gradient(135deg,${accent.from}0e,${accent.to}08)` : 'var(--app-surface)', borderRadius: 14,
                      border: isActive ? `1.5px solid ${accent.from}33` : '1px solid rgba(128,128,128,0.07)', marginBottom: 10, overflow: 'hidden',
                    }}>
                      {isEditing ? (
                        /* ── Edit name / artist inline ── */
                        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input
                            value={editingName} onChange={e => setEditingName(e.target.value)}
                            autoFocus
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.18)', background: 'var(--app-bg)', color: 'var(--c-text-primary)', fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                            placeholder="Song name"
                          />
                          <input
                            value={editingArtist} onChange={e => setEditingArtist(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.18)', background: 'var(--app-bg)', color: 'var(--c-text-secondary)', fontSize: 12, fontFamily: 'Manrope, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                            placeholder="Artist (optional)"
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleSaveEdit} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: `linear-gradient(135deg,${accent.from},${accent.to})`, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700 }}>Save</button>
                            <button onClick={() => setEditingSong(null)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 12, fontWeight: 600 }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        /* ── Normal song card ── */
                        <div>
                          <button
                            onClick={() => handleLoadSong(song)}
                            style={{ width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
                          >
                            {/* Drum icon */}
                            <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg,${accent.from}22,${accent.to}22)`, border: `1.5px solid ${accent.from}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                              🥁
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: 'var(--c-text-primary)', fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</p>
                              {song.artist && <p style={{ color: 'var(--c-text-secondary)', fontSize: 11, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artist}</p>}
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                              <span style={{ fontSize: 15, color: isDeleting ? '#f87171' : accent.from }}>▶</span>
                            </div>
                          </button>
                          {/* Meta row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px 10px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${accent.from}18`, color: accent.from }}>{kitLabel}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-muted)' }}>{pCount} pattern{pCount !== 1 ? 's' : ''}</span>
                            <div style={{ flex: 1 }} />
                            <button onClick={() => handleStartEdit(song)} style={{ fontSize: 11, color: 'var(--c-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✎ Edit</button>
                            {isDeleting ? (
                              <>
                                <button onClick={() => { deleteDrumSong(song.id); setDeletingId(null); }} style={{ fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.10)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '2px 8px', fontWeight: 700 }}>Delete</button>
                                <button onClick={() => setDeletingId(null)} style={{ fontSize: 11, color: 'var(--c-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => setDeletingId(song.id)} style={{ fontSize: 11, color: 'var(--c-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>🗑</button>
                            )}
                            <span style={{ fontSize: 10, color: 'var(--c-text-muted)', marginLeft: 4 }}>{ts}</span>
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

        {/* ═══ KIT ══════════════════════════════════════════════════════════ */}
        {drumMode === 'nav' && activeTab === 'kit' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20, paddingBottom: 100 }} className="no-scrollbar">
            {KIT_CATEGORIES.map(cat => {
              const open = expandedCats.has(cat.id);
              const hasSelected = cat.kits.includes(kit);
              return (
                <div key={cat.id} style={{ marginBottom: 12 }}>
                  {/* Category header */}
                  <button
                    onClick={() => setExpandedCats(prev => {
                      const next = new Set(prev);
                      next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                      return next;
                    })}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '0 16px 8px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 8 }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.07em', textTransform: 'uppercase', color: hasSelected ? accent.from : 'var(--c-text-secondary)', flex: 1 }}>
                      {cat.label}
                    </span>
                    {hasSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent.from, flexShrink: 0 }} />}
                    <span style={{ fontSize: 12, color: 'var(--c-text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)', flexShrink: 0, lineHeight: 1 }}>⌄</span>
                  </button>
                  {/* Kits inside category */}
                  {open && (
                    <Card style={{ animation: 'drumHamburgerIn 180ms cubic-bezier(0.22,1,0.36,1)' }}>
                      {cat.kits.map((k, i) => {
                        const sel = k === kit;
                        return (
                          <button
                            key={k}
                            onClick={() => handleKitSelect(k)}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px', background: sel ? `${accent.from}10` : 'transparent', border: 'none', borderTop: i > 0 ? '1px solid rgba(128,128,128,0.07)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 150ms' }}
                          >
                            <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, overflow: 'hidden', border: sel ? `1.5px solid ${accent.from}55` : '1.5px solid rgba(128,128,128,0.12)', position: 'relative' }}>
                              <img src={KIT_IMAGE[k]} alt={KIT_LABEL[k]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              {sel && (
                                <div style={{ position: 'absolute', inset: 0, background: `${accent.from}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: `linear-gradient(135deg,${accent.from},${accent.to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>✓</div>
                                </div>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: 'var(--c-text-primary)', fontSize: 13.5, fontWeight: 600 }}>{KIT_LABEL[k]}</div>
                              <div style={{ color: 'var(--c-text-muted)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{KIT_DESC[k]}</div>
                            </div>
                            {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent.from, flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </Card>
                  )}
                </div>
              );
            })}
            {sampleStatus !== 'idle' && (
              <div style={{ padding: '0 16px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: sampleStatus === 'loading' ? 'rgba(245,158,11,0.08)' : 'rgba(74,222,128,0.06)', border: `1px solid ${sampleStatus === 'loading' ? '#f59e0b20' : '#4ade8020'}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: sampleStatus === 'loading' ? '#f59e0b' : '#4ade80' }} />
                  <span style={{ color: sampleStatus === 'loading' ? '#d97706' : '#4ade80', fontSize: 12, fontWeight: 600 }}>{sampleStatus === 'loading' ? 'Loading samples…' : 'Samples ready'}</span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Bottom nav (always visible) ─────────────────────────────────── */}
      <SettingsNav
        activeTab={activeTab} setTab={setActiveTab}
        drumMode={drumMode} setDrumMode={setDrumMode}
        accent={accent} isLight={isLight} isAmoled={isAmoled}
      />

      {/* ── Save Beat form overlay ───────────────────────────────────────── */}
      {showSaveForm && (
        <div
          onClick={() => setShowSaveForm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: isAmoled ? '#080808' : (isLight ? '#f5f5f7' : '#18181b'),
              borderRadius: '20px 20px 0 0',
              padding: '20px 20px max(20px,env(safe-area-inset-bottom)) 20px',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
              animation: 'drumHamburgerIn 220ms cubic-bezier(0.22,1,0.36,1)',
            }}
          >
            {/* Handle bar */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(128,128,128,0.3)', margin: '0 auto 18px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ color: 'var(--c-text-primary)', fontSize: 17, fontWeight: 800, fontFamily: 'Manrope, sans-serif', margin: 0 }}>
                {activeDrumSongId ? 'Edit Beat' : 'Save Beat'}
              </p>
              {/* BPM badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: `${accent.from}18`, border: `1px solid ${accent.from}28` }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: accent.from, fontFamily: 'Manrope, sans-serif' }}>{pattern.bpm} BPM</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={saveName} onChange={e => setSaveName(e.target.value)}
                autoFocus
                placeholder="Beat name (required)"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${saveName.trim() ? accent.from + '66' : 'rgba(128,128,128,0.18)'}`, background: 'var(--app-bg)', color: 'var(--c-text-primary)', fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 180ms' }}
                onKeyDown={e => { if (e.key === 'Enter' && saveName.trim()) { activeDrumSongId ? handleUpdateSong() : handleSaveAsNew(); } }}
              />
              <input
                value={saveArtist} onChange={e => setSaveArtist(e.target.value)}
                placeholder="Artist (optional)"
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(128,128,128,0.18)', background: 'var(--app-bg)', color: 'var(--c-text-secondary)', fontSize: 13, fontFamily: 'Manrope, sans-serif', outline: 'none', boxSizing: 'border-box' }}
              />
              <textarea
                value={saveNotes} onChange={e => setSaveNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid rgba(128,128,128,0.18)', background: 'var(--app-bg)', color: 'var(--c-text-secondary)', fontSize: 12, fontFamily: 'Manrope, sans-serif', outline: 'none', boxSizing: 'border-box', resize: 'none', lineHeight: 1.5 }}
              />
            </div>

            {activeDrumSongId ? (
              /* ── Editing an existing beat: Update + Save as New ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                <button
                  onClick={handleUpdateSong}
                  disabled={!saveName.trim()}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 10, background: saveName.trim() ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.15)', border: 'none', cursor: saveName.trim() ? 'pointer' : 'default', color: saveName.trim() ? '#fff' : 'var(--c-text-muted)', fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif', transition: 'all 200ms', boxShadow: saveName.trim() ? `0 4px 14px ${accent.from}44` : 'none' }}
                >
                  Update Beat
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleSaveAsNew}
                    disabled={!saveName.trim()}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.16)', cursor: saveName.trim() ? 'pointer' : 'default', color: saveName.trim() ? 'var(--c-text-primary)' : 'var(--c-text-muted)', fontSize: 13, fontWeight: 600, fontFamily: 'Manrope, sans-serif' }}
                  >
                    Save as New
                  </button>
                  <button
                    onClick={() => setShowSaveForm(false)}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 13, fontWeight: 600, fontFamily: 'Manrope, sans-serif' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── New beat: Save + Cancel ── */
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => setShowSaveForm(false)}
                  style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 600, fontFamily: 'Manrope, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsNew}
                  disabled={!saveName.trim()}
                  style={{ flex: 2, padding: '12px 0', borderRadius: 10, background: saveName.trim() ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.15)', border: 'none', cursor: saveName.trim() ? 'pointer' : 'default', color: saveName.trim() ? '#fff' : 'var(--c-text-muted)', fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif', transition: 'all 200ms', boxShadow: saveName.trim() ? `0 4px 14px ${accent.from}44` : 'none' }}
                >
                  Save Beat
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

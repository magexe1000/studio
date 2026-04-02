import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import {
  useDrumStore, KIT_INSTRUMENTS,
  stepsPerMeasure,
  type DrumInstrument, type KitType,
} from '../store/useDrumStore';
import {
  drumScheduler, samplePool, loadDrumSamples, KIT_DEFAULTS,
  type SampleStatus,
} from '../lib/drumAudio';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';

// ── Layout ─────────────────────────────────────────────────────────────────
const LABEL_W  = 58;
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

type HeadShape = 'circle' | 'x' | 'open';
const NOTE_HEAD: Record<DrumInstrument, HeadShape> = {
  crash: 'x', 'hihat-closed': 'x', 'hihat-open': 'open', ride: 'x',
  'tom-high': 'circle', snare: 'circle', 'tom-mid': 'circle',
  'tom-floor': 'circle', kick: 'circle', 'hihat-foot': 'x',
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
  ludwig: 'Ludwig Classic', cr78: 'Roland CR-78', r8: 'Roland R8', tr808: 'TR-808', techno: 'Techno Kit',
};
const KIT_DESC: Record<KitType, string> = {
  ludwig: 'Warm natural acoustic · full kit',
  cr78:   'Vintage 1978 analog drum machine',
  r8:     '1989 electronic-acoustic hybrid',
  tr808:  'Deep bass hip-hop classic · 1980',
  techno: 'Hard industrial electronic',
};
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const KIT_IMAGE: Record<KitType, string> = {
  ludwig: `${BASE}/kit-acoustic.png`,
  cr78:   `${BASE}/kit-cr78.png`,
  r8:     `${BASE}/kit-advanced.png`,
  tr808:  `${BASE}/kit-tr808.png`,
  techno: `${BASE}/kit-electronic.png`,
};

// ── Tabs / Mode ────────────────────────────────────────────────────────────
type DrumTab  = 'kit';
type DrumMode = 'edit' | 'nav'; // edit = full-screen sheet; nav = kit settings

// ── SVG note heads ─────────────────────────────────────────────────────────
function CircleHead({ r, color }: { r: number; color: string }) {
  return <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} />;
}
function OpenHead({ r, color }: { r: number; color: string }) {
  return <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill="none" stroke={color} strokeWidth={1.4} />;
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

// ── Instrument row SVG ─────────────────────────────────────────────────────
interface RowProps {
  inst: DrumInstrument;
  mStartIdx: number;
  rowMeasures: { id: string; hits: Partial<Record<DrumInstrument, { step: number; length: number }[]>> }[];
  spm: number;
  stepsPerBeat: number;
  STEP_W: number;
  MEASURE_W: number;
  hitSet: Set<number>;
  noteColor: string;
  staffColor: string;
  barColor: string;
  altBg: string;
}
const InstrumentRow = ({
  inst, mStartIdx, rowMeasures, spm, stepsPerBeat, STEP_W, MEASURE_W,
  hitSet, noteColor, staffColor, barColor, altBg,
}: RowProps) => {
  const totalW = rowMeasures.length * MEASURE_W;
  const noteY  = NOTE_YF[inst] * ROW_H;
  const head   = NOTE_HEAD[inst];
  const NOTE_R = 4.5;

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
          if (!hitSet.has(globalStep)) return null;
          const cx = (mi * spm + s) * STEP_W + STEP_W / 2;
          const cy = noteY;
          const stemUp = cy > ROW_H * 0.5;
          const stemY1 = stemUp ? cy - NOTE_R * 0.9 : cy + NOTE_R * 0.9;
          const stemY2 = stemUp ? cy - NOTE_R * 3.5 : cy + NOTE_R * 3.5;
          return (
            <g key={`${mi}-${s}`} transform={`translate(${cx}, ${cy})`}>
              <line x1={stemUp ? NOTE_R * 0.75 : -NOTE_R * 0.75} y1={stemY1 - cy}
                x2={stemUp ? NOTE_R * 0.75 : -NOTE_R * 0.75} y2={stemY2 - cy}
                stroke={noteColor} strokeWidth={1.2} strokeLinecap="round" />
              {head === 'circle' && <CircleHead r={NOTE_R} color={noteColor} />}
              {head === 'open'   && <OpenHead   r={NOTE_R} color={noteColor} />}
              {head === 'x'      && <XHead      r={NOTE_R} color={noteColor} />}
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

// ── Settings bottom nav (editor / kit) ────────────────────────────────────
type AllTab = 'editor' | 'kit';
const ALL_NAV_TABS: { id: AllTab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'editor', label: 'Editor', Icon: IconEditor },
  { id: 'kit',    label: 'Kit',    Icon: IconKit    },
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
  useEffect(() => {
    const ni = ALL_NAV_TABS.findIndex(x => x.id === currentId);
    const oi = prevIdx.current;
    if (ni === oi) return;
    prevIdx.current = ni;
    if (strT.current) clearTimeout(strT.current);
    const nm = measure(ni);
    if (!nm) return;
    if (ni > oi) { setPill(p => ({ ...p, right: nm.right })); strT.current = setTimeout(() => setPill(p => ({ ...p, left: nm.left })), 70); }
    else { setPill(p => ({ ...p, left: nm.left })); strT.current = setTimeout(() => setPill(p => ({ ...p, right: nm.right })), 70); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const handlePress = (id: AllTab) => {
    if (id === 'editor') { setDrumMode('edit'); }
    else { setDrumMode('nav'); setTab(id as DrumTab); }
  };

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
  const KITS: KitType[] = ['ludwig', 'cr78', 'r8', 'tr808', 'techno'];

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
  const [activeTab, setActiveTab]       = useState<DrumTab>('kit');
  const [playing, setPlaying]           = useState(false);
  const [looping, setLooping]           = useState(true);
  const [sampleStatus, setSampleStatus] = useState<SampleStatus>('idle');
  const [showBpmPanel,   setShowBpmPanel]   = useState(false);
  const [showHamburger,  setShowHamburger]  = useState(false);
  const [focusedInst,    setFocusedInst]    = useState<DrumInstrument | null>(null);

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

  // ── Hit sets ─────────────────────────────────────────────────────────────
  const allHitSets = useMemo(() => {
    const map = new Map<DrumInstrument, Set<number>>();
    ALL_INSTS.forEach(inst => {
      const s = new Set<number>();
      pattern.measures.forEach((m, mIdx) => {
        m.hits[inst]?.forEach(h => s.add(mIdx * spm + h.step));
      });
      map.set(inst, s);
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
    if (drumScheduler.isPlaying) drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === pattern.id)!);
    drumScheduler.previewSound(KIT_DEFAULTS[kit].soundMap[inst] ?? inst, 0.55, kit);
    setFocusedInst(inst);
  };

  // ── Back ─────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (drumMode === 'edit') { setDrumMode('nav'); }
    else { drumScheduler.stop(); updateSettings({ appMode: 'chords' }); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--app-bg)', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 52,
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        borderBottom: '1px solid rgba(128,128,128,0.1)', background: 'var(--app-bg)',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        {/* Logo — always visible */}
        <AppModeMenuLogo color={isLight ? '#18181b' : '#d4d4d8'} size={13} />

        <div style={{ flex: 1 }} />

        {/* Clear — only in editor */}
        {drumMode === 'edit' && (<>
          <button onClick={handleClear} style={{ height: 30, padding: '0 12px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(128,128,128,0.18)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            Clear
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
                      const hitSet = allHitSets.get(inst) ?? new Set<number>();
                      const isFoc  = focusedInst === inst;
                      return (
                        <div key={inst} style={{
                          display: 'flex', height: ROW_H,
                          borderBottom: instIdx < ALL_INSTS.length - 1 ? `1px solid ${staffColor}` : `1.5px solid ${barColor}`,
                          background: isFoc ? (isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.018)') : 'transparent',
                        }}>
                          <div style={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 12, paddingRight: 6, borderRight: `1px solid ${barColor}` }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: isFoc ? 'var(--c-text-primary)' : 'var(--c-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'color 200ms' }}>
                              {SHORT_LABEL[inst]}
                            </span>
                          </div>
                          <InstrumentRow
                            inst={inst} mStartIdx={mStartIdx} rowMeasures={rowMeasures}
                            spm={spm} stepsPerBeat={stepsPerBeat} STEP_W={STEP_W} MEASURE_W={MEASURE_W}
                            hitSet={hitSet} noteColor={noteColor} staffColor={staffColor}
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

        {/* ═══ KIT ══════════════════════════════════════════════════════════ */}
        {drumMode === 'nav' && activeTab === 'kit' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20, paddingBottom: 100 }} className="no-scrollbar">
            <SectionLabel>Drum Kit</SectionLabel>
            <Card>
              {KITS.map((k, i) => {
                const sel = k === kit;
                return (
                  <button
                    key={k}
                    onClick={() => handleKitSelect(k)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 16px', background: sel ? `${accent.from}10` : 'transparent', border: 'none', borderTop: i > 0 ? '1px solid rgba(128,128,128,0.07)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 150ms' }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, overflow: 'hidden', border: sel ? `1.5px solid ${accent.from}55` : '1.5px solid rgba(128,128,128,0.12)', position: 'relative' }}>
                      <img src={KIT_IMAGE[k]} alt={KIT_LABEL[k]} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      {sel && (
                        <div style={{ position: 'absolute', inset: 0, background: `${accent.from}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: `linear-gradient(135deg,${accent.from},${accent.to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</div>
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--c-text-primary)', fontSize: 14, fontWeight: 600 }}>{KIT_LABEL[k]}</div>
                      <div style={{ color: 'var(--c-text-muted)', fontSize: 11.5, marginTop: 2 }}>{KIT_DESC[k]}</div>
                    </div>
                    {sel && <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent.from, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </Card>
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
    </div>
  );
}

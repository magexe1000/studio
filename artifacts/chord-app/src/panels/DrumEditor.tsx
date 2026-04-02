import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import {
  useDrumStore, INSTRUMENT_COLOR, KIT_INSTRUMENTS,
  stepsPerMeasure,
  type DrumInstrument, type KitType,
} from '../store/useDrumStore';
import {
  drumScheduler, samplePool, loadDrumSamples, KIT_DEFAULTS,
  type SampleStatus,
} from '../lib/drumAudio';

// ── Layout ────────────────────────────────────────────────────────────────────
const LABEL_W = 58;   // instrument label column
const ROW_H   = 36;   // each instrument row height
const RULER_H = 26;   // beat ruler height
const CELL_W  = 22;   // width per step
const NAV_H   = 72;   // bottom nav pill height
const FLOAT_H = 60;   // floating instrument bar

// ── Labels ────────────────────────────────────────────────────────────────────
const INST_LABEL: Record<DrumInstrument, string> = {
  kick:           'Kick',
  snare:          'Snare',
  'hihat-closed': 'Hi-Hat',
  'hihat-open':   'Open HH',
  'hihat-foot':   'HH Foot',
  'tom-high':     'Tom Hi',
  'tom-mid':      'Tom Mid',
  'tom-floor':    'Floor Tom',
  crash:          'Crash',
  ride:           'Ride',
};
const SHORT_LABEL: Record<DrumInstrument, string> = {
  kick:           'Kick',
  snare:          'Snare',
  'hihat-closed': 'HH',
  'hihat-open':   'O.HH',
  'hihat-foot':   'HHF',
  'tom-high':     'TomH',
  'tom-mid':      'TomM',
  'tom-floor':    'Floor',
  crash:          'Crash',
  ride:           'Ride',
};

const KIT_ICONS: Record<KitType, string> = { acoustic: '🥁', advanced: '🎶', electronic: '⚡' };
const KIT_LABEL: Record<KitType, string> = { acoustic: 'Acoustic', advanced: 'Advanced', electronic: 'Electronic' };
const KIT_DESC:  Record<KitType, string> = {
  acoustic:   'Real acoustic drum samples',
  advanced:   'Roland R8 drum machine',
  electronic: 'Techno & FM synthesized',
};

// ── Tabs ──────────────────────────────────────────────────────────────────────
type DrumTab  = 'editor' | 'kit' | 'mix';
type DrumMode = 'nav' | 'edit'; // nav = 3-tab bar visible; edit = full piano roll + float bar

// ── Tab icons ─────────────────────────────────────────────────────────────────
function IconEditor({ active }: { active: boolean }) {
  const ao = active ? 1 : 0;
  const sw = active ? 1.8 : 1.5;
  const tr = 'fill-opacity 140ms cubic-bezier(0.34,1.56,0.64,1)';
  const cols = [3, 8, 13, 18];
  const rows = [6, 12, 18];
  const filled = new Set(['0,0','2,0','1,1','3,1','0,2','2,2']);
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      {rows.map((y, ri) => cols.map((x, ci) => {
        const f = filled.has(`${ci},${ri}`);
        return (
          <rect key={`${ci}-${ri}`} x={x} y={y} width={3} height={3} rx={1}
            fill="currentColor" fillOpacity={f ? ao : 0}
            stroke="currentColor" strokeWidth={f ? 0 : sw - 0.3} strokeOpacity={f ? 0 : 0.55}
            style={{ transition: tr }}
          />
        );
      }))}
    </svg>
  );
}
function IconKit({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  const ao = active ? 0.15 : 0;
  const tr = 'fill-opacity 140ms cubic-bezier(0.34,1.56,0.64,1)';
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <circle cx="12" cy="15" r="6.5" stroke="currentColor" strokeWidth={sw}
        fill="currentColor" fillOpacity={ao} style={{ transition: tr }} />
      <circle cx="12" cy="15" r="2.8" fill="currentColor" fillOpacity={active ? 0.6 : 0} style={{ transition: tr }} />
      <line x1="5" y1="5.5" x2="10.5" y2="5.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="13.5" y1="5.5" x2="19" y2="5.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}
function IconMix({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  const ao = active ? 1 : 0;
  const tr = 'fill-opacity 140ms cubic-bezier(0.34,1.56,0.64,1)';
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <line x1="5" y1="18" x2="5" y2="10" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="5" cy="10" r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor"
        strokeWidth={active ? 0 : sw - 0.3} style={{ transition: tr }} />
      <line x1="12" y1="18" x2="12" y2="7" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="12" cy="7" r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor"
        strokeWidth={active ? 0 : sw - 0.3} style={{ transition: tr }} />
      <line x1="19" y1="18" x2="19" y2="13" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="19" cy="13" r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor"
        strokeWidth={active ? 0 : sw - 0.3} style={{ transition: tr }} />
    </svg>
  );
}

// ── Bottom nav ────────────────────────────────────────────────────────────────
const TAB_META: { tab: DrumTab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { tab: 'editor', label: 'Editor', Icon: IconEditor },
  { tab: 'kit',    label: 'Kit',    Icon: IconKit    },
  { tab: 'mix',    label: 'Mix',    Icon: IconMix    },
];

function DrumBottomNav({
  activeTab, setTab, accent, visible,
}: {
  activeTab: DrumTab;
  setTab: (t: DrumTab) => void;
  accent: { from: string; to: string };
  visible: boolean;
}) {
  const navRef  = useRef<HTMLElement | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const prevIdx = useRef(TAB_META.findIndex(x => x.tab === activeTab));
  const strT    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pill, setPill]     = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const [pressed, setPressed] = useState<DrumTab | null>(null);

  const measureBtn = (idx: number) => {
    const btn = btnRefs.current[idx]; const nav = navRef.current;
    if (!btn || !nav) return null;
    const nr = nav.getBoundingClientRect(); const br = btn.getBoundingClientRect();
    return { left: br.left - nr.left, right: br.right - nr.left };
  };

  useEffect(() => {
    const m = measureBtn(TAB_META.findIndex(x => x.tab === activeTab));
    if (m) setPill({ ...m, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const newIdx = TAB_META.findIndex(x => x.tab === activeTab);
    const oldIdx = prevIdx.current;
    if (newIdx === oldIdx) return;
    prevIdx.current = newIdx;
    if (strT.current) clearTimeout(strT.current);
    const newM = measureBtn(newIdx);
    if (!newM) return;
    if (newIdx > oldIdx) {
      setPill(p => ({ ...p, right: newM.right }));
      strT.current = setTimeout(() => setPill(p => ({ ...p, left: newM.left })), 70);
    } else {
      setPill(p => ({ ...p, left: newM.left }));
      strT.current = setTimeout(() => setPill(p => ({ ...p, right: newM.right })), 70);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <nav ref={navRef} className="glass-nav" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: 'max(10px, env(safe-area-inset-bottom))',
      width: '88%', maxWidth: 400,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      padding: '6px 8px', borderRadius: '2rem',
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(20,20,24,0.90)',
      boxShadow: '0 12px 48px rgba(0,0,0,0.60), 0 1.5px 0 rgba(255,255,255,0.08) inset',
      zIndex: 50, overflow: 'hidden',
      // Slide animation
      transition: 'transform 320ms cubic-bezier(0.32,0.72,0,1)',
      ...(visible ? {} : {
        transform: 'translateX(-50%) translateY(calc(100% + 30px))',
      }),
    }}>
      {pill.ready && (
        <div aria-hidden style={{
          position: 'absolute', top: 4,
          left: pill.left, width: pill.right - pill.left,
          height: 'calc(100% - 8px)', borderRadius: '9999px',
          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
          boxShadow: `0 2px 16px ${accent.to}55`,
          pointerEvents: 'none', zIndex: 0,
          transition: 'left 150ms cubic-bezier(0.34,1.56,0.64,1), width 150ms cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      )}
      {TAB_META.map(({ tab, label, Icon }, i) => {
        const isActive = activeTab === tab;
        const isPressed = pressed === tab;
        return (
          <button key={tab} ref={el => { btnRefs.current[i] = el; }}
            onPointerDown={() => setPressed(tab)}
            onPointerUp={() => { setPressed(null); setTab(tab); }}
            onPointerLeave={() => setPressed(null)}
            onPointerCancel={() => setPressed(null)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '8px 4px',
              borderRadius: '9999px', background: 'transparent', border: 'none',
              cursor: 'pointer', color: isActive ? '#fff' : '#52525b',
              position: 'relative', zIndex: 1,
              transform: isPressed ? 'scale(0.91)' : 'scale(1)',
              transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34,1.56,0.64,1)',
            }}>
            <Icon active={isActive} />
            <span style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 700,
              fontSize: '9px', letterSpacing: '0.09em',
              textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Card / SectionLabel helpers ───────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      color: '#3f3f46', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      margin: '0 0 8px', padding: '0 20px',
    }}>{children}</p>
  );
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      margin: '0 16px 20px', background: '#0e0e12',
      borderRadius: 14, border: '1px solid #1c1c22',
      overflow: 'hidden', ...style,
    }}>{children}</div>
  );
}

// ── DrumEditor ────────────────────────────────────────────────────────────────
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
  const {
    patterns, activePatternId,
    soundMap, volumeMap, masterVolume,
    kitType, activeInstruments,
    setKitType, toggleInstrument, setMasterVolume,
    toggleHit, addMeasure, updatePattern,
  } = useDrumStore();

  const pattern      = useMemo(
    () => patterns.find(p => p.id === activePatternId) ?? patterns[0],
    [patterns, activePatternId],
  );
  const accent       = ACCENT_COLORS[settings.accentColor] ?? ACCENT_COLORS.blue;
  const spm          = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];
  const totalSteps   = spm * pattern.measures.length;
  const kit          = kitType ?? 'acoustic';
  const ALL_INSTS    = KIT_INSTRUMENTS[kit] ?? KIT_INSTRUMENTS.acoustic;
  const KITS: KitType[] = ['acoustic', 'advanced', 'electronic'];

  // ── State ──────────────────────────────────────────────────────────────────
  const [drumMode, setDrumMode]         = useState<DrumMode>('nav');
  const [activeTab, setActiveTab]       = useState<DrumTab>('editor');
  const [playing, setPlaying]           = useState(false);
  const [looping, setLooping]           = useState(true);
  const [sampleStatus, setSampleStatus] = useState<SampleStatus>('idle');
  const [focusedInst, setFocusedInst]   = useState<DrumInstrument | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const rulerRef      = useRef<HTMLDivElement>(null);
  const playheadRef   = useRef<HTMLDivElement>(null);
  const spmRef        = useRef(spm);
  spmRef.current = spm;
  const totalStepsRef = useRef(totalSteps);
  totalStepsRef.current = totalSteps;
  const pointerStart  = useRef<{ x: number; y: number } | null>(null);

  // ── Hit map for all instruments ────────────────────────────────────────────
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

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    samplePool.onStatusChange = s => setSampleStatus(s);
    setSampleStatus(samplePool.status);
    return () => { samplePool.onStatusChange = null; };
  }, []);

  useEffect(() => { if (kitType) loadDrumSamples(kitType); }, [kitType]);

  useEffect(() => {
    if (playing) drumScheduler.updatePattern(pattern);
  }, [pattern, playing]);

  // ── Playhead (zero-lag, direct DOM) ───────────────────────────────────────
  useEffect(() => {
    drumScheduler.onStep = (gs, mIdx, stepInM) => {
      if (gs < 0) {
        if (playheadRef.current) playheadRef.current.style.display = 'none';
        return;
      }
      const sp = spmRef.current;
      const globalStep = mIdx * sp + stepInM;
      const x = globalStep * CELL_W;

      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${x}px)`;
        playheadRef.current.style.display   = 'block';
      }

      // Auto-scroll to keep playhead visible
      const el = gridScrollRef.current;
      if (el) {
        const visLeft  = el.scrollLeft;
        const visRight = visLeft + el.clientWidth;
        if (x < visLeft || x + CELL_W * 2 > visRight) {
          el.scrollLeft = Math.max(0, x - el.clientWidth * 0.25);
        }
      }
    };
    return () => { drumScheduler.onStep = null; };
  }, []);

  useEffect(() => () => { drumScheduler.stop(); }, []);

  // ── Sync ruler scroll with grid scroll ────────────────────────────────────
  const onGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (rulerRef.current) rulerRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  // ── Play / Stop ────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    const sm  = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
    const vol: Partial<Record<DrumInstrument, number>> = {};
    activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
    if (drumScheduler.isPlaying) {
      drumScheduler.stop(); setPlaying(false);
    } else {
      loadDrumSamples(kit);
      drumScheduler.start(pattern, sm, vol, masterVolume, looping, kit);
      setPlaying(true);
    }
  }, [pattern, kit, soundMap, volumeMap, activeInstruments, masterVolume, looping]);

  // ── Kit ────────────────────────────────────────────────────────────────────
  const handleKitSelect = useCallback((k: KitType) => {
    setKitType(k, KIT_DEFAULTS[k].soundMap);
    loadDrumSamples(k);
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
  }, [setKitType]);

  // ── BPM ────────────────────────────────────────────────────────────────────
  const adjustBpm = useCallback((d: number) => {
    const bpm = Math.max(40, Math.min(280, pattern.bpm + d));
    updatePattern(pattern.id, { bpm });
    if (drumScheduler.isPlaying) {
      const sm  = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
      const vol: Partial<Record<DrumInstrument, number>> = {};
      activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
      const updated = useDrumStore.getState().patterns.find(p => p.id === pattern.id)!;
      drumScheduler.start(updated, sm, vol, masterVolume, looping, kit);
    }
  }, [pattern, kit, soundMap, volumeMap, activeInstruments, masterVolume, looping, updatePattern]);

  // ── Subdivision ────────────────────────────────────────────────────────────
  const toggleSub = useCallback(() => {
    updatePattern(pattern.id, { subdivision: pattern.subdivision === 16 ? 8 : 16 });
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
  }, [pattern, updatePattern]);

  // ── Clear all ──────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    const cleared = pattern.measures.map(m => ({ ...m, hits: {} as Record<DrumInstrument, never[]> }));
    updatePattern(pattern.id, { measures: cleared } as Parameters<typeof updatePattern>[1]);
    if (drumScheduler.isPlaying) drumScheduler.updatePattern(
      useDrumStore.getState().patterns.find(p => p.id === pattern.id)!
    );
  }, [pattern, updatePattern]);

  // ── Cell tap (piano roll) ──────────────────────────────────────────────────
  const handleGridPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleGridPointerUp = (e: React.PointerEvent) => {
    const s = pointerStart.current;
    if (!s) return;
    pointerStart.current = null;
    if (Math.abs(e.clientX - s.x) > 12 || Math.abs(e.clientY - s.y) > 12) return;

    const el = gridScrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx   = e.clientX - rect.left + el.scrollLeft;
    const cy   = e.clientY - rect.top;

    const instIdx = Math.floor(cy / ROW_H);
    const stepIdx = Math.floor(cx / CELL_W);
    if (instIdx < 0 || instIdx >= ALL_INSTS.length) return;
    if (stepIdx < 0 || stepIdx >= totalStepsRef.current) return;

    const inst   = ALL_INSTS[instIdx];
    const mIdx   = Math.floor(stepIdx / spmRef.current);
    const stepInM = stepIdx % spmRef.current;
    const m = pattern.measures[mIdx];
    if (!m) return;

    toggleHit(pattern.id, m.id, inst, stepInM);
    if (drumScheduler.isPlaying)
      drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === pattern.id)!);

    drumScheduler.previewSound(KIT_DEFAULTS[kit].soundMap[inst] ?? inst, 0.55, kit);
    setFocusedInst(inst);
  };

  // ── Tab select ─────────────────────────────────────────────────────────────
  const handleTabSelect = (tab: DrumTab) => {
    setActiveTab(tab);
    if (tab === 'editor') setDrumMode('edit');
    else setDrumMode('nav');
  };

  // ── Back ───────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (drumMode === 'edit') {
      setDrumMode('nav');
    } else {
      drumScheduler.stop();
      updateSettings({ appMode: 'chords' });
    }
  };

  // ── Computed sizes ─────────────────────────────────────────────────────────
  const gridTotalW   = totalSteps * CELL_W + 40; // +40 for Add Bar button
  const gridTotalH   = ALL_INSTS.length * ROW_H;
  const navVisible   = drumMode === 'nav';
  const floatVisible = drumMode === 'edit';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', background: '#09090b',
      overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none',
    }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 52,
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 10,
        borderBottom: '1px solid #18181f',
        background: '#09090b',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        {/* Back */}
        <button onClick={handleBack} style={{
          width: 36, height: 36, borderRadius: 10,
          background: '#13131a', border: '1px solid #1e1e28',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, color: '#71717a', lineHeight: 1 }}>‹</span>
        </button>

        <span style={{
          color: '#d4d4d8', fontSize: 13, fontWeight: 700,
          fontFamily: 'Manrope, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Drums
        </span>

        {/* Status dot */}
        <div style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: sampleStatus === 'loading' ? '#f59e0b' : sampleStatus === 'ready' ? '#4ade80' : 'transparent',
        }} />

        <div style={{ flex: 1 }} />

        {/* Clear — only in edit/editor mode */}
        {(drumMode === 'edit' || activeTab === 'editor') && (
          <button onClick={handleClear} style={{
            height: 28, padding: '0 12px', borderRadius: 7,
            background: 'transparent', border: '1px solid #27272a',
            cursor: 'pointer', color: '#52525b', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.04em',
          }}>
            Clear
          </button>
        )}

        {/* Loop */}
        <button onClick={() => setLooping(l => !l)} style={{
          width: 32, height: 32, borderRadius: 9,
          background: looping ? `${accent.from}1e` : '#13131a',
          border: `1px solid ${looping ? accent.from + '44' : '#1e1e28'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: looping ? accent.from : '#3f3f46',
          transition: 'all 150ms',
        }}>⟳</button>

        {/* Play */}
        <button onClick={handlePlay} style={{
          width: 36, height: 36, borderRadius: 10,
          background: playing ? '#1e1e28' : `linear-gradient(135deg,${accent.from},${accent.to})`,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: playing ? 13 : 14, color: '#fff',
          boxShadow: playing ? 'none' : `0 2px 14px ${accent.from}44`,
          transition: 'all 160ms',
        }}>
          {playing ? '⏹' : '▶'}
        </button>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ═══ EDITOR (piano roll) — always rendered, shown in edit mode ═══ */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          // In nav mode for non-editor tabs, shrink to zero
          ...(drumMode === 'nav' && activeTab !== 'editor' ? { display: 'none' } : {}),
        }}>

          {/* ── Beat ruler ─────────────────────────────────────────────── */}
          <div style={{
            flexShrink: 0, display: 'flex',
            background: '#0c0c11',
            borderBottom: '1px solid #18181f',
          }}>
            {/* Label spacer */}
            <div style={{
              width: LABEL_W, flexShrink: 0,
              height: RULER_H,
              borderRight: '1px solid #1a1a22',
              background: '#09090b',
            }} />
            {/* Ruler (hidden scrollbar, synced via JS) */}
            <div ref={rulerRef} style={{ flex: 1, overflowX: 'hidden' }}>
              <div style={{ display: 'inline-flex', width: gridTotalW }}>
                {Array.from({ length: totalSteps }, (_, s) => {
                  const isMeasureStart = s > 0 && s % spm === 0;
                  const isBeatStart    = s % stepsPerBeat === 0;
                  const mIdx           = Math.floor(s / spm);
                  const beatInM        = Math.floor((s % spm) / stepsPerBeat);
                  return (
                    <div key={s} style={{
                      width: CELL_W, height: RULER_H, flexShrink: 0,
                      display: 'flex', alignItems: 'center', paddingLeft: 3,
                      borderRight: isMeasureStart
                        ? '1.5px solid #232330'
                        : isBeatStart ? '1px solid #1b1b26' : '1px solid #14141c',
                      background: isMeasureStart ? '#0f0f16' : 'transparent',
                    }}>
                      {isMeasureStart && (
                        <span style={{ color: '#52525b', fontSize: 9, fontWeight: 700 }}>
                          {mIdx + 1}
                        </span>
                      )}
                      {!isMeasureStart && isBeatStart && (
                        <span style={{ color: '#27272a', fontSize: 8 }}>
                          {beatInM + 1}
                        </span>
                      )}
                    </div>
                  );
                })}
                {/* Add Bar */}
                <button
                  onClick={() => addMeasure(pattern.id)}
                  style={{
                    width: 40, height: RULER_H, flexShrink: 0,
                    background: 'transparent', border: 'none',
                    cursor: 'pointer', color: '#3f3f46',
                    fontSize: 16, fontWeight: 300,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onPointerEnter={e => { e.currentTarget.style.color = accent.from; }}
                  onPointerLeave={e => { e.currentTarget.style.color = '#3f3f46'; }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* ── Piano roll grid ─────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Sticky instrument labels */}
            <div style={{
              width: LABEL_W, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              background: '#09090b',
              borderRight: '1px solid #1a1a22',
              overflowY: 'hidden',
            }}>
              {ALL_INSTS.map(inst => {
                const color  = INSTRUMENT_COLOR[inst] ?? accent.from;
                const isFoc  = focusedInst === inst;
                return (
                  <div key={inst} style={{
                    height: ROW_H, flexShrink: 0,
                    display: 'flex', alignItems: 'center',
                    padding: '0 8px 0 10px', gap: 6,
                    borderBottom: '1px solid #13131a',
                    background: isFoc ? `${color}09` : 'transparent',
                    transition: 'background 200ms',
                  }}>
                    <div style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: color, flexShrink: 0,
                      opacity: isFoc ? 1 : 0.6,
                      boxShadow: isFoc ? `0 0 5px ${color}` : 'none',
                      transition: 'all 200ms',
                    }} />
                    <span style={{
                      color: isFoc ? '#d4d4d8' : '#52525b',
                      fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      lineHeight: 1, whiteSpace: 'nowrap',
                      transition: 'color 200ms',
                    }}>
                      {SHORT_LABEL[inst]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Scrollable step grid */}
            <div
              ref={gridScrollRef}
              onScroll={onGridScroll}
              onPointerDown={handleGridPointerDown}
              onPointerUp={handleGridPointerUp}
              style={{
                flex: 1, overflowX: 'auto', overflowY: 'hidden',
                position: 'relative', touchAction: 'pan-x',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: floatVisible ? FLOAT_H + 20 : NAV_H + 20,
              }}
              className="no-scrollbar"
            >
              {/* Inner — fixed-width for all steps */}
              <div style={{
                position: 'relative',
                width: gridTotalW,
                height: gridTotalH,
                minHeight: '100%',
              }}>
                {/* Vertical playhead line */}
                <div ref={playheadRef} style={{
                  position: 'absolute', top: 0, left: 0,
                  width: 2, height: gridTotalH,
                  background: accent.from,
                  boxShadow: `0 0 8px ${accent.from}77`,
                  pointerEvents: 'none', zIndex: 5, display: 'none',
                  borderRadius: 1,
                }} />

                {/* Instrument rows */}
                {ALL_INSTS.map((inst, instIdx) => {
                  const color   = INSTRUMENT_COLOR[inst] ?? accent.from;
                  const hitSet  = allHitSets.get(inst)!;
                  const isFoc   = focusedInst === inst;
                  return (
                    <div key={inst} style={{
                      display: 'flex', height: ROW_H,
                      borderBottom: '1px solid #131318',
                      background: isFoc ? `${color}06` : instIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)',
                    }}>
                      {Array.from({ length: totalSteps }, (_, s) => {
                        const isMeasureBound = s > 0 && s % spm === 0;
                        const isBeatBound    = !isMeasureBound && s % stepsPerBeat === 0;
                        const hit            = hitSet.has(s);
                        return (
                          <div key={s} style={{
                            width: CELL_W, height: ROW_H, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRight: isMeasureBound
                              ? '1.5px solid #202028'
                              : isBeatBound
                                ? '1px solid #18181f'
                                : '1px solid #111118',
                            background: isMeasureBound ? 'rgba(255,255,255,0.012)' : 'transparent',
                          }}>
                            {hit ? (
                              <div style={{
                                width: CELL_W - 6,
                                height: Math.round(ROW_H * 0.54),
                                borderRadius: 3,
                                background: color,
                                opacity: isFoc ? 0.95 : 0.75,
                                boxShadow: isFoc ? `0 0 7px ${color}66` : 'none',
                                transition: 'opacity 200ms, box-shadow 200ms',
                              }} />
                            ) : (
                              <div style={{
                                width: 3, height: 3, borderRadius: '50%',
                                background: '#1a1a22',
                              }} />
                            )}
                          </div>
                        );
                      })}
                      {/* Spacer for Add Bar button */}
                      <div style={{ width: 40, flexShrink: 0 }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ KIT TAB ═══════════════════════════════════════════════════════ */}
        {drumMode === 'nav' && activeTab === 'kit' && (
          <div style={{
            flex: 1, overflowY: 'auto', paddingTop: 20,
            paddingBottom: NAV_H + 20,
          }} className="no-scrollbar">
            <SectionLabel>Drum Kit</SectionLabel>
            <Card>
              {KITS.map((k, i) => {
                const sel = k === kit;
                return (
                  <button key={k} onClick={() => handleKitSelect(k)} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    width: '100%', padding: '14px 16px',
                    background: sel ? `${accent.from}12` : 'transparent',
                    border: 'none', borderTop: i > 0 ? '1px solid #1a1a22' : 'none',
                    cursor: 'pointer', textAlign: 'left', transition: 'background 140ms',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: sel ? `linear-gradient(135deg,${accent.from},${accent.to})` : '#141420',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    }}>{KIT_ICONS[k]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: sel ? '#fff' : '#d4d4d8', fontSize: 14, fontWeight: 600 }}>
                        {KIT_LABEL[k]}
                      </div>
                      <div style={{ color: '#3f3f46', fontSize: 12, marginTop: 2 }}>{KIT_DESC[k]}</div>
                    </div>
                    {sel && (
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: `linear-gradient(135deg,${accent.from},${accent.to})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: '#fff', flexShrink: 0,
                      }}>✓</div>
                    )}
                  </button>
                );
              })}
            </Card>

            {sampleStatus !== 'idle' && (
              <div style={{ padding: '0 16px', marginBottom: 20 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 10,
                  background: sampleStatus === 'loading' ? 'rgba(245,158,11,0.08)' : 'rgba(74,222,128,0.06)',
                  border: `1px solid ${sampleStatus === 'loading' ? '#f59e0b20' : '#4ade8020'}`,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: sampleStatus === 'loading' ? '#f59e0b' : '#4ade80',
                  }} />
                  <span style={{
                    color: sampleStatus === 'loading' ? '#d97706' : '#4ade80',
                    fontSize: 12, fontWeight: 600,
                  }}>{sampleStatus === 'loading' ? 'Loading samples…' : 'Samples ready'}</span>
                </div>
              </div>
            )}

            <SectionLabel>Instruments</SectionLabel>
            <Card>
              {ALL_INSTS.map((inst, i) => {
                const color   = INSTRUMENT_COLOR[inst] ?? accent.from;
                const enabled = activeInstruments.includes(inst);
                return (
                  <button key={inst} onClick={() => toggleInstrument(inst)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '11px 16px',
                    background: 'transparent', border: 'none',
                    borderTop: i > 0 ? '1px solid #1a1a22' : 'none',
                    cursor: 'pointer', textAlign: 'left',
                    opacity: enabled ? 1 : 0.4, transition: 'opacity 150ms',
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ color: '#c4c4c8', fontSize: 13, fontWeight: 500, flex: 1 }}>
                      {INST_LABEL[inst]}
                    </span>
                    <div style={{
                      width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                      background: enabled ? `linear-gradient(135deg,${accent.from},${accent.to})` : '#1e1e28',
                      position: 'relative', transition: 'background 200ms',
                    }}>
                      <div style={{
                        position: 'absolute', top: 2, left: enabled ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)',
                      }} />
                    </div>
                  </button>
                );
              })}
            </Card>
          </div>
        )}

        {/* ═══ MIX TAB ════════════════════════════════════════════════════════ */}
        {drumMode === 'nav' && activeTab === 'mix' && (
          <div style={{
            flex: 1, overflowY: 'auto', paddingTop: 20,
            paddingBottom: NAV_H + 20,
          }} className="no-scrollbar">
            <SectionLabel>Tempo</SectionLabel>
            <Card>
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '16px 18px', gap: 10,
                borderBottom: '1px solid #1a1a22',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#71717a', fontSize: 11, fontWeight: 600, marginBottom: 2 }}>BPM</div>
                  <div style={{ color: '#e4e4e7', fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
                    {pattern.bpm}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[-10, -1, +1, +10].map(d => (
                    <button key={d} onClick={() => adjustBpm(d)} style={{
                      width: d === -10 || d === 10 ? 40 : 36, height: 36, borderRadius: 9,
                      background: '#141420', border: '1px solid #1e1e28',
                      cursor: 'pointer', color: '#a1a1aa', fontSize: 12, fontWeight: 700,
                    }}>
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', padding: '12px 18px', gap: 10,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#c4c4c8', fontSize: 13, fontWeight: 500 }}>Step Resolution</div>
                  <div style={{ color: '#3f3f46', fontSize: 11, marginTop: 2 }}>
                    {pattern.subdivision === 16 ? '16th notes' : '8th notes'}
                  </div>
                </div>
                <button onClick={toggleSub} style={{
                  height: 32, padding: '0 14px', borderRadius: 9,
                  background: '#141420', border: `1px solid ${accent.from}44`,
                  cursor: 'pointer', color: accent.from, fontSize: 12, fontWeight: 700,
                }}>1/{pattern.subdivision}</button>
              </div>
            </Card>

            <SectionLabel>Playback</SectionLabel>
            <Card>
              <button onClick={() => setLooping(l => !l)} style={{
                display: 'flex', alignItems: 'center', width: '100%',
                padding: '13px 18px', gap: 12, background: 'transparent', border: 'none',
                borderBottom: '1px solid #1a1a22', cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#c4c4c8', fontSize: 13, fontWeight: 500 }}>Loop</div>
                  <div style={{ color: '#3f3f46', fontSize: 11, marginTop: 2 }}>Repeat pattern continuously</div>
                </div>
                <div style={{
                  width: 42, height: 24, borderRadius: 12, flexShrink: 0,
                  background: looping ? `linear-gradient(135deg,${accent.from},${accent.to})` : '#1e1e28',
                  position: 'relative', transition: 'background 200ms',
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: looping ? 20 : 3,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)',
                  }} />
                </div>
              </button>
              <div style={{ padding: '13px 18px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
                }}>
                  <div style={{ color: '#c4c4c8', fontSize: 13, fontWeight: 500 }}>Master Volume</div>
                  <span style={{ color: '#52525b', fontSize: 12, fontWeight: 600 }}>
                    {Math.round(masterVolume * 100)}%
                  </span>
                </div>
                <input type="range" min={0} max={1} step={0.01} value={masterVolume}
                  onChange={e => setMasterVolume(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: accent.from }}
                />
              </div>
            </Card>

            <SectionLabel>Pattern</SectionLabel>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', padding: '13px 18px', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#c4c4c8', fontSize: 13, fontWeight: 500 }}>Bars</div>
                  <div style={{ color: '#3f3f46', fontSize: 11, marginTop: 2 }}>
                    {pattern.measures.length} {pattern.measures.length === 1 ? 'bar' : 'bars'}
                  </div>
                </div>
                <button onClick={() => addMeasure(pattern.id)} style={{
                  height: 32, padding: '0 16px', borderRadius: 9,
                  background: `${accent.from}18`, border: `1px solid ${accent.from}33`,
                  cursor: 'pointer', color: accent.from, fontSize: 12, fontWeight: 700,
                }}>+ Add Bar</button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ── Bottom nav (3 tabs) — slides down when entering edit mode ──── */}
      <DrumBottomNav
        activeTab={activeTab}
        setTab={handleTabSelect}
        accent={accent}
        visible={navVisible}
      />

      {/* ── Floating instrument bar — slides up in edit mode ─────────────── */}
      <div style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 'max(10px, env(safe-area-inset-bottom))',
        width: '92%', maxWidth: 440,
        height: FLOAT_H,
        background: 'rgba(16,16,20,0.94)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '2rem',
        boxShadow: '0 12px 40px rgba(0,0,0,0.60), 0 1.5px 0 rgba(255,255,255,0.07) inset',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center',
        paddingLeft: 12, paddingRight: 12, gap: 8,
        overflowX: 'auto',
        zIndex: 50,
        // Slide animation
        transition: 'transform 320ms cubic-bezier(0.32,0.72,0,1)',
        ...(floatVisible
          ? {}
          : { transform: 'translateX(-50%) translateY(calc(100% + 30px))' }),
      }}
        className="no-scrollbar"
      >
        {ALL_INSTS.map(inst => {
          const color  = INSTRUMENT_COLOR[inst] ?? accent.from;
          const isFoc  = focusedInst === inst;
          return (
            <button
              key={inst}
              onPointerUp={() => {
                setFocusedInst(isFoc ? null : inst);
                drumScheduler.previewSound(KIT_DEFAULTS[kit].soundMap[inst] ?? inst, 0.5, kit);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 34, padding: '0 11px', borderRadius: 999, flexShrink: 0,
                background: isFoc ? `${color}20` : 'transparent',
                border: `1.5px solid ${isFoc ? color + '60' : 'rgba(255,255,255,0.07)'}`,
                cursor: 'pointer', transition: 'all 150ms',
              }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: color, flexShrink: 0,
                boxShadow: isFoc ? `0 0 5px ${color}` : 'none',
                transition: 'box-shadow 150ms',
              }} />
              <span style={{
                color: isFoc ? '#e4e4e7' : '#71717a',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                {INST_LABEL[inst]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

// ── Layout constants ──────────────────────────────────────────────────────────
const TOP_H    = 52;
const STEP_H   = 52;
const NAV_H    = 72; // bottom nav height

// ── Short instrument labels ───────────────────────────────────────────────────
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

const KIT_ICONS: Record<KitType, string> = {
  acoustic: '🥁', advanced: '🎶', electronic: '⚡',
};
const KIT_LABEL: Record<KitType, string> = {
  acoustic: 'Acoustic', advanced: 'Advanced', electronic: 'Electronic',
};
const KIT_DESC: Record<KitType, string> = {
  acoustic:   'Real acoustic drum samples',
  advanced:   'Roland R8 drum machine',
  electronic: 'Techno & FM synthesized',
};

// ── Tab type ──────────────────────────────────────────────────────────────────
type DrumTab = 'editor' | 'kit' | 'mix';
const DRUM_TABS: DrumTab[] = ['editor', 'kit', 'mix'];

// ── Tab icons ─────────────────────────────────────────────────────────────────
function IconEditor({ active }: { active: boolean }) {
  const ao = active ? 1 : 0;
  const sw = active ? 1.8 : 1.5;
  const tr = 'fill-opacity 140ms cubic-bezier(0.34,1.56,0.64,1)';
  const cols = [3, 8, 13, 18];
  const rows = [6, 12, 18];
  const filled = [[0,0],[2,0],[1,1],[3,1],[0,2],[2,2]];
  const filledSet = new Set(filled.map(([c,r]) => `${c},${r}`));
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      {rows.map((y, ri) =>
        cols.map((x, ci) => {
          const isFilled = filledSet.has(`${ci},${ri}`);
          return (
            <rect
              key={`${ci}-${ri}`}
              x={x} y={y} width={3} height={3} rx={1}
              fill="currentColor"
              fillOpacity={isFilled ? ao : 0}
              stroke="currentColor"
              strokeWidth={isFilled ? 0 : sw - 0.3}
              strokeOpacity={isFilled ? 0 : 0.55}
              style={{ transition: tr }}
            />
          );
        })
      )}
    </svg>
  );
}

function IconKit({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  const ao = active ? 1 : 0;
  const tr = 'fill-opacity 140ms cubic-bezier(0.34,1.56,0.64,1)';
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      {/* Bass drum */}
      <circle cx="12" cy="15" r="6.5" stroke="currentColor" strokeWidth={sw}
        fill="currentColor" fillOpacity={ao * 0.15} style={{ transition: tr }} />
      <circle cx="12" cy="15" r="3" fill="currentColor" fillOpacity={ao * 0.5}
        style={{ transition: tr }} />
      {/* Hi-hat */}
      <line x1="5" y1="5" x2="10.5" y2="5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="13.5" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
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

// ── Drum bottom nav ───────────────────────────────────────────────────────────
const TAB_LABELS: Record<DrumTab, string> = {
  editor: 'Editor',
  kit:    'Kit',
  mix:    'Mix',
};
const TAB_ICONS: Record<DrumTab, React.FC<{ active: boolean }>> = {
  editor: IconEditor,
  kit:    IconKit,
  mix:    IconMix,
};

function DrumBottomNav({
  activeTab, setTab, accent,
}: {
  activeTab: DrumTab;
  setTab: (t: DrumTab) => void;
  accent: { from: string; to: string };
}) {
  const navRef   = useRef<HTMLElement | null>(null);
  const btnRefs  = useRef<(HTMLButtonElement | null)[]>([]);
  const prevIdx  = useRef(DRUM_TABS.indexOf(activeTab));
  const stretchT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pill, setPill]     = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const [pressed, setPressed] = useState<DrumTab | null>(null);

  const measureBtn = (idx: number) => {
    const btn = btnRefs.current[idx];
    const nav = navRef.current;
    if (!btn || !nav) return null;
    const nr = nav.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return { left: br.left - nr.left, right: br.right - nr.left };
  };

  useEffect(() => {
    const m = measureBtn(DRUM_TABS.indexOf(activeTab));
    if (m) setPill({ ...m, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const newIdx = DRUM_TABS.indexOf(activeTab);
    const oldIdx = prevIdx.current;
    if (newIdx === oldIdx) return;
    prevIdx.current = newIdx;
    if (stretchT.current) clearTimeout(stretchT.current);
    const newM = measureBtn(newIdx);
    if (!newM) return;
    if (newIdx > oldIdx) {
      setPill(p => ({ ...p, right: newM.right }));
      stretchT.current = setTimeout(() => setPill(p => ({ ...p, left: newM.left })), 70);
    } else {
      setPill(p => ({ ...p, left: newM.left }));
      stretchT.current = setTimeout(() => setPill(p => ({ ...p, right: newM.right })), 70);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <nav
      ref={navRef}
      className="glass-nav"
      style={{
        position: 'fixed',
        left: '50%', transform: 'translateX(-50%)',
        bottom: 'max(10px, env(safe-area-inset-bottom))',
        width: '90%', maxWidth: 420,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '6px 8px',
        borderRadius: '2rem',
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(26,26,30,0.82)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {/* Elastic pill */}
      {pill.ready && (
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 4,
            left: pill.left, width: pill.right - pill.left,
            height: 'calc(100% - 8px)',
            borderRadius: '9999px',
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            boxShadow: `0 2px 18px ${accent.to}60`,
            pointerEvents: 'none', zIndex: 0,
            transition: [
              'left  150ms cubic-bezier(0.34,1.56,0.64,1)',
              'width 150ms cubic-bezier(0.34,1.56,0.64,1)',
            ].join(', '),
          }}
        />
      )}

      {DRUM_TABS.map((tab, i) => {
        const isActive  = activeTab === tab;
        const isPressed = pressed === tab;
        const Icon = TAB_ICONS[tab];
        return (
          <button
            key={tab}
            ref={el => { btnRefs.current[i] = el; }}
            onPointerDown={() => setPressed(tab)}
            onPointerUp={() => { setPressed(null); setTab(tab); }}
            onPointerLeave={() => setPressed(null)}
            onPointerCancel={() => setPressed(null)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '8px 4px',
              borderRadius: '9999px', background: 'transparent', border: 'none',
              cursor: 'pointer',
              color: isActive ? '#fff' : 'var(--c-text-secondary, #71717a)',
              position: 'relative', zIndex: 1,
              transform: isPressed ? 'scale(0.91)' : 'scale(1)',
              transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34,1.56,0.64,1)',
              WebkitFontSmoothing: 'antialiased',
            }}
          >
            <Icon active={isActive} />
            <span style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 700,
              fontSize: '9.5px', letterSpacing: '0.08em',
              textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap',
              WebkitFontSmoothing: 'antialiased',
            }}>
              {TAB_LABELS[tab]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ── Small helper: icon button ─────────────────────────────────────────────────
function Btn({
  onClick, children, style,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── MeasureRow ────────────────────────────────────────────────────────────────
const MeasureRow = ({
  mIdx, spm, stepsPerBeat, hitSet, instColor, accent,
}: {
  mIdx: number;
  spm: number;
  stepsPerBeat: number;
  hitSet: Set<number>;
  instColor: string;
  accent: { from: string };
}) => {
  const base = mIdx * spm;
  return (
    <div style={{ position: 'relative', height: STEP_H, display: 'flex', borderBottom: '1px solid #131318' }}>
      {/* Measure number */}
      <div style={{
        width: 22, flexShrink: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        borderRight: '1px solid #18181f',
      }}>
        <span style={{ color: '#3f3f46', fontSize: 9, fontWeight: 700 }}>{mIdx + 1}</span>
      </div>

      {/* Steps */}
      {Array.from({ length: spm }, (_, s) => {
        const gs      = base + s;
        const hit     = hitSet.has(gs);
        const beatStart = s % stepsPerBeat === 0;
        const beatGroup = Math.floor(s / stepsPerBeat) % 2 === 0;
        return (
          <div
            key={s}
            style={{
              flex: 1, position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRight: s < spm - 1 ? `1px solid ${beatStart ? '#1d1d24' : '#141419'}` : 'none',
              background: beatGroup ? 'rgba(255,255,255,0.012)' : 'transparent',
            }}
          >
            {hit ? (
              <div style={{
                width: '70%', height: '62%', borderRadius: 5,
                background: instColor,
                boxShadow: `0 0 8px ${instColor}55`,
                opacity: 0.92,
              }} />
            ) : (
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#1e1e26',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Section wrappers for Kit and Mix tabs ─────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      color: '#52525b', fontSize: 11, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      margin: '0 0 10px', padding: '0 20px',
    }}>
      {children}
    </p>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      margin: '0 16px 16px',
      background: '#111113', borderRadius: 16,
      border: '1px solid #1c1c22',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── DrumEditor ────────────────────────────────────────────────────────────────
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
  const {
    patterns, activePatternId,
    soundMap, volumeMap, masterVolume,
    kitType, activeInstruments,
    setKitType,
    toggleHit, addMeasure, updatePattern, toggleInstrument, setMasterVolume,
  } = useDrumStore();

  const pattern = useMemo(
    () => patterns.find(p => p.id === activePatternId) ?? patterns[0],
    [patterns, activePatternId],
  );

  const accent       = ACCENT_COLORS[settings.accentColor] ?? ACCENT_COLORS.blue;
  const spm          = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];

  // ── Local state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState<DrumTab>('editor');
  const [playing, setPlaying]             = useState(false);
  const [looping, setLooping]             = useState(true);
  const [sampleStatus, setSampleStatus]   = useState<SampleStatus>('idle');
  const [selectedInst, setSelectedInst]   = useState<DrumInstrument>(
    () => activeInstruments[0] ?? 'kick',
  );

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const gridScrollRef  = useRef<HTMLDivElement>(null);
  const playheadRef    = useRef<HTMLDivElement>(null);
  const spmRef         = useRef(spm);
  spmRef.current = spm;
  const pointerStart   = useRef<{ x: number; y: number } | null>(null);

  // ── Derived hit-set for the selected instrument ──────────────────────────────
  const hitSet = useMemo(() => {
    const s = new Set<number>();
    pattern.measures.forEach((m, mIdx) => {
      m.hits[selectedInst]?.forEach(h => s.add(mIdx * spm + h.step));
    });
    return s;
  }, [pattern, selectedInst, spm]);

  // ── Sample pool status ───────────────────────────────────────────────────────
  useEffect(() => {
    samplePool.onStatusChange = s => setSampleStatus(s);
    setSampleStatus(samplePool.status);
    return () => { samplePool.onStatusChange = null; };
  }, []);

  // ── Load samples on kit change ───────────────────────────────────────────────
  useEffect(() => { if (kitType) loadDrumSamples(kitType); }, [kitType]);

  // ── Keep scheduler in sync when pattern changes ──────────────────────────────
  useEffect(() => {
    if (playing) drumScheduler.updatePattern(pattern);
  }, [pattern, playing]);

  // ── Zero-lag onStep — direct DOM, no React re-render ────────────────────────
  useEffect(() => {
    drumScheduler.onStep = (gs, mIdx, stepInM) => {
      if (gs < 0) {
        if (playheadRef.current) playheadRef.current.style.display = 'none';
        return;
      }
      const sp    = spmRef.current;
      const el    = gridScrollRef.current;
      const gridW = (el?.offsetWidth ?? 390) - 22; // subtract measure-number column

      const x = 22 + (stepInM / sp) * gridW; // offset by measure-number column width
      const y = mIdx * STEP_H;

      if (playheadRef.current) {
        playheadRef.current.style.transform = `translate(${x}px, ${y}px)`;
        playheadRef.current.style.display   = 'block';
      }

      if (el) {
        const rowTop = mIdx * STEP_H;
        if (rowTop < el.scrollTop || rowTop + STEP_H > el.scrollTop + el.clientHeight) {
          el.scrollTop = Math.max(0, rowTop - STEP_H * 0.5);
        }
      }
    };
    return () => { drumScheduler.onStep = null; };
  }, []);

  // ── Stop on unmount ──────────────────────────────────────────────────────────
  useEffect(() => () => { drumScheduler.stop(); }, []);

  // ── Play / Stop ──────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    const kit  = kitType ?? 'acoustic';
    const sm   = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
    const vol: Partial<Record<DrumInstrument, number>> = {};
    activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });

    if (drumScheduler.isPlaying) {
      drumScheduler.stop();
      setPlaying(false);
    } else {
      loadDrumSamples(kit);
      drumScheduler.start(pattern, sm, vol, masterVolume, looping, kit);
      setPlaying(true);
    }
  }, [pattern, kitType, soundMap, volumeMap, activeInstruments, masterVolume, looping]);

  // ── Kit selection ────────────────────────────────────────────────────────────
  const handleKitSelect = useCallback((kit: KitType) => {
    setKitType(kit, KIT_DEFAULTS[kit].soundMap);
    loadDrumSamples(kit);
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
    const defaultInsts = KIT_INSTRUMENTS[kit];
    if (!defaultInsts.includes(selectedInst)) setSelectedInst(defaultInsts[0]);
  }, [setKitType, selectedInst]);

  // ── BPM ──────────────────────────────────────────────────────────────────────
  const adjustBpm = useCallback((d: number) => {
    const bpm = Math.max(40, Math.min(280, pattern.bpm + d));
    updatePattern(pattern.id, { bpm });
    if (drumScheduler.isPlaying) {
      const kit = kitType ?? 'acoustic';
      const sm  = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
      const vol: Partial<Record<DrumInstrument, number>> = {};
      activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
      const updated = useDrumStore.getState().patterns.find(p => p.id === pattern.id)!;
      drumScheduler.start(updated, sm, vol, masterVolume, looping, kit);
    }
  }, [pattern, kitType, soundMap, volumeMap, activeInstruments, masterVolume, looping, updatePattern]);

  // ── Subdivision toggle ───────────────────────────────────────────────────────
  const toggleSub = useCallback(() => {
    updatePattern(pattern.id, { subdivision: pattern.subdivision === 16 ? 8 : 16 });
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
  }, [pattern, updatePattern]);

  // ── Cell tap ─────────────────────────────────────────────────────────────────
  const handleGridPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleGridPointerUp = (e: React.PointerEvent) => {
    const s = pointerStart.current;
    if (!s) return;
    pointerStart.current = null;
    if (Math.abs(e.clientX - s.x) > 14 || Math.abs(e.clientY - s.y) > 14) return;

    const el = gridScrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cy   = e.clientY - rect.top + el.scrollTop;
    const cx   = e.clientX - rect.left - 22; // subtract measure-number col

    if (cx < 0) return;
    const mIdx = Math.max(0, Math.min(pattern.measures.length - 1, Math.floor(cy / STEP_H)));
    const step = Math.max(0, Math.min(spm - 1, Math.floor((cx / (rect.width - 22)) * spm)));
    const m = pattern.measures[mIdx];
    if (!m) return;

    toggleHit(pattern.id, m.id, selectedInst, step);
    if (drumScheduler.isPlaying)
      drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === pattern.id)!);

    const kit = kitType ?? 'acoustic';
    drumScheduler.previewSound(KIT_DEFAULTS[kit].soundMap[selectedInst] ?? selectedInst, 0.55, kit);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const instColor = INSTRUMENT_COLOR[selectedInst] ?? accent.from;
  const kit       = kitType ?? 'acoustic';
  const KITS: KitType[] = ['acoustic', 'advanced', 'electronic'];
  const ALL_INSTS = KIT_INSTRUMENTS[kit] ?? KIT_INSTRUMENTS.acoustic;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', background: '#09090b',
      overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none',
    }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: TOP_H, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 10,
        borderBottom: '1px solid #1a1a1f',
        background: '#09090b',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        {/* Back */}
        <Btn
          onClick={() => { drumScheduler.stop(); updateSettings({ appMode: 'chords' }); }}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#18181b', flexShrink: 0 }}
        >
          <span style={{ fontSize: 19, color: '#a1a1aa', lineHeight: 1 }}>‹</span>
        </Btn>

        {/* Title */}
        <span style={{
          color: '#e4e4e7', fontSize: 15, fontWeight: 700,
          fontFamily: 'Manrope, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Drums
        </span>

        {/* Sample status dot */}
        {sampleStatus === 'loading' && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
        )}
        {sampleStatus === 'ready' && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
        )}

        <div style={{ flex: 1 }} />

        {/* Loop toggle */}
        <Btn
          onClick={() => setLooping(l => !l)}
          style={{
            width: 34, height: 34, borderRadius: 10,
            background: looping ? `${accent.from}22` : '#18181b',
            border: `1px solid ${looping ? accent.from + '55' : '#27272a'}`,
            color: looping ? accent.from : '#52525b',
            fontSize: 15, transition: 'all 150ms',
          }}
        >
          ⟳
        </Btn>

        {/* Play / Stop */}
        <Btn
          onClick={handlePlay}
          style={{
            width: 38, height: 38, borderRadius: 11,
            background: playing
              ? '#27272a'
              : `linear-gradient(135deg,${accent.from},${accent.to})`,
            border: 'none',
            fontSize: playing ? 14 : 15, color: '#fff',
            boxShadow: playing ? 'none' : `0 2px 12px ${accent.from}55`,
            transition: 'all 160ms',
          }}
        >
          {playing ? '⏹' : '▶'}
        </Btn>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ═══════════════════ EDITOR TAB ════════════════════════════════════ */}
        {activeTab === 'editor' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Instrument selector chips */}
            <div style={{
              flexShrink: 0, height: 48,
              display: 'flex', alignItems: 'center',
              padding: '0 12px', gap: 6,
              overflowX: 'auto', overflowY: 'hidden',
              borderBottom: '1px solid #131318',
            }}
              className="no-scrollbar"
            >
              {ALL_INSTS.map(inst => {
                const color   = INSTRUMENT_COLOR[inst] ?? accent.from;
                const isSel   = inst === selectedInst;
                return (
                  <button
                    key={inst}
                    onPointerUp={() => setSelectedInst(inst)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      height: 32, padding: '0 12px',
                      borderRadius: 999, flexShrink: 0,
                      background: isSel ? `${color}22` : '#18181b',
                      border: `1.5px solid ${isSel ? color + '77' : '#27272a'}`,
                      cursor: 'pointer', transition: 'all 140ms',
                    }}
                  >
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: color,
                      boxShadow: isSel ? `0 0 6px ${color}` : 'none',
                      transition: 'box-shadow 140ms',
                    }} />
                    <span style={{
                      color: isSel ? '#e4e4e7' : '#71717a',
                      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>
                      {INST_LABEL[inst]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Grid */}
            <div
              ref={gridScrollRef}
              onPointerDown={handleGridPointerDown}
              onPointerUp={handleGridPointerUp}
              style={{
                flex: 1, overflowY: 'auto', overflowX: 'hidden',
                position: 'relative', touchAction: 'pan-y',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: NAV_H + 16,
              }}
              className="no-scrollbar"
            >
              {/* Beat ruler — sticky */}
              <div style={{
                position: 'sticky', top: 0, zIndex: 10,
                height: 20, display: 'flex',
                background: '#09090b',
                borderBottom: '1px solid #131318',
              }}>
                <div style={{ width: 22, flexShrink: 0, borderRight: '1px solid #18181f' }} />
                {Array.from({ length: spm }, (_, s) => {
                  const isBeat = s % stepsPerBeat === 0;
                  return (
                    <div key={s} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRight: s < spm - 1 ? '1px solid #13131a' : 'none',
                    }}>
                      {isBeat && (
                        <span style={{ color: '#3f3f46', fontSize: 9, fontWeight: 700 }}>
                          {s / stepsPerBeat + 1}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rows + playhead */}
              <div style={{ position: 'relative' }}>
                <div
                  ref={playheadRef}
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    width: 2, height: STEP_H,
                    background: accent.from,
                    boxShadow: `0 0 6px ${accent.from}88`,
                    pointerEvents: 'none', zIndex: 5, display: 'none',
                  }}
                />

                {pattern.measures.map((m, mIdx) => (
                  <MeasureRow
                    key={m.id}
                    mIdx={mIdx}
                    spm={spm}
                    stepsPerBeat={stepsPerBeat}
                    hitSet={hitSet}
                    instColor={instColor}
                    accent={accent}
                  />
                ))}

                {/* Add bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '20px 0',
                }}>
                  <button
                    onClick={() => addMeasure(pattern.id)}
                    style={{
                      height: 36, padding: '0 24px', borderRadius: 999,
                      background: 'transparent', border: '1px dashed #2a2a30',
                      cursor: 'pointer', color: '#52525b', fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 8, transition: 'all 160ms',
                    }}
                    onPointerEnter={e => {
                      e.currentTarget.style.borderColor = accent.from + '80';
                      e.currentTarget.style.color = accent.from;
                    }}
                    onPointerLeave={e => {
                      e.currentTarget.style.borderColor = '#2a2a30';
                      e.currentTarget.style.color = '#52525b';
                    }}
                  >
                    <span style={{ fontSize: 17 }}>+</span>
                    <span>Add Bar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════ KIT TAB ═══════════════════════════════════════ */}
        {activeTab === 'kit' && (
          <div style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            paddingTop: 20, paddingBottom: NAV_H + 16,
          }}
            className="no-scrollbar"
          >
            <SectionLabel>Drum Kit</SectionLabel>
            <Card>
              {KITS.map((k, i) => {
                const sel = k === kit;
                return (
                  <button
                    key={k}
                    onClick={() => handleKitSelect(k)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      width: '100%', padding: '14px 16px',
                      background: sel ? `${accent.from}14` : 'transparent',
                      border: 'none',
                      borderTop: i > 0 ? '1px solid #1a1a20' : 'none',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background 140ms',
                    }}
                  >
                    <div style={{
                      width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                      background: sel ? `linear-gradient(135deg,${accent.from},${accent.to})` : '#1a1a20',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>
                      {KIT_ICONS[k]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: sel ? '#fff' : '#d4d4d8',
                        fontSize: 15, fontWeight: 600,
                      }}>
                        {KIT_LABEL[k]}
                      </div>
                      <div style={{ color: '#52525b', fontSize: 12, marginTop: 2 }}>
                        {KIT_DESC[k]}
                      </div>
                    </div>
                    {sel && (
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: `linear-gradient(135deg,${accent.from},${accent.to})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: '#fff', flexShrink: 0,
                      }}>
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </Card>

            {/* Sample status */}
            {sampleStatus !== 'idle' && (
              <div style={{ padding: '0 20px', marginBottom: 16 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderRadius: 10,
                  background: sampleStatus === 'loading' ? '#1a1400' : '#0a1a0a',
                  border: `1px solid ${sampleStatus === 'loading' ? '#f59e0b22' : '#4ade8022'}`,
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: sampleStatus === 'loading' ? '#f59e0b' : '#4ade80',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    color: sampleStatus === 'loading' ? '#d97706' : '#4ade80',
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {sampleStatus === 'loading' ? 'Loading samples…' : 'Samples ready'}
                  </span>
                </div>
              </div>
            )}

            <SectionLabel>Instruments</SectionLabel>
            <Card>
              {ALL_INSTS.map((inst, i) => {
                const color   = INSTRUMENT_COLOR[inst] ?? accent.from;
                const enabled = activeInstruments.includes(inst);
                return (
                  <button
                    key={inst}
                    onClick={() => toggleInstrument(inst)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '12px 16px',
                      background: 'transparent', border: 'none',
                      borderTop: i > 0 ? '1px solid #1a1a20' : 'none',
                      cursor: 'pointer', textAlign: 'left',
                      opacity: enabled ? 1 : 0.45, transition: 'opacity 150ms',
                    }}
                  >
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: color, flexShrink: 0,
                    }} />
                    <span style={{ color: '#d4d4d8', fontSize: 14, fontWeight: 500, flex: 1 }}>
                      {INST_LABEL[inst]}
                    </span>
                    {/* Toggle pill */}
                    <div style={{
                      width: 38, height: 22, borderRadius: 11,
                      background: enabled ? `linear-gradient(135deg,${accent.from},${accent.to})` : '#27272a',
                      position: 'relative', flexShrink: 0, transition: 'background 200ms',
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: 3, left: enabled ? 19 : 3,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)',
                      }} />
                    </div>
                  </button>
                );
              })}
            </Card>
          </div>
        )}

        {/* ═══════════════════ MIX TAB ════════════════════════════════════════ */}
        {activeTab === 'mix' && (
          <div style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            paddingTop: 20, paddingBottom: NAV_H + 16,
          }}
            className="no-scrollbar"
          >
            <SectionLabel>Tempo</SectionLabel>
            <Card>
              {/* BPM */}
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '16px 18px', gap: 12,
                borderBottom: '1px solid #1a1a20',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#a1a1aa', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>BPM</div>
                  <div style={{ color: '#e4e4e7', fontSize: 28, fontWeight: 800 }}>
                    {pattern.bpm}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[-10, -1, +1, +10].map(d => (
                    <button
                      key={d}
                      onClick={() => adjustBpm(d)}
                      style={{
                        width: d === -10 || d === 10 ? 42 : 38,
                        height: 38, borderRadius: 10,
                        background: '#18181b', border: '1px solid #27272a',
                        cursor: 'pointer', color: '#a1a1aa',
                        fontSize: 13, fontWeight: 700, transition: 'all 120ms',
                      }}
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subdivision */}
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '14px 18px', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#a1a1aa', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Step Resolution</div>
                  <div style={{ color: '#71717a', fontSize: 13 }}>
                    {pattern.subdivision === 16 ? '16th notes (finer)' : '8th notes (coarser)'}
                  </div>
                </div>
                <button
                  onClick={toggleSub}
                  style={{
                    height: 34, padding: '0 14px', borderRadius: 10,
                    background: '#18181b', border: `1px solid ${accent.from}55`,
                    cursor: 'pointer', color: accent.from,
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  1/{pattern.subdivision}
                </button>
              </div>
            </Card>

            <SectionLabel>Playback</SectionLabel>
            <Card>
              {/* Loop */}
              <button
                onClick={() => setLooping(l => !l)}
                style={{
                  display: 'flex', alignItems: 'center',
                  width: '100%', padding: '14px 18px', gap: 12,
                  background: 'transparent', border: 'none',
                  borderBottom: '1px solid #1a1a20',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#d4d4d8', fontSize: 14, fontWeight: 500 }}>Loop</div>
                  <div style={{ color: '#52525b', fontSize: 12, marginTop: 2 }}>
                    Repeat pattern continuously
                  </div>
                </div>
                <div style={{
                  width: 44, height: 26, borderRadius: 13,
                  background: looping ? `linear-gradient(135deg,${accent.from},${accent.to})` : '#27272a',
                  position: 'relative', flexShrink: 0, transition: 'background 200ms',
                }}>
                  <div style={{
                    position: 'absolute', top: 3,
                    left: looping ? 21 : 3,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)',
                  }} />
                </div>
              </button>

              {/* Master volume */}
              <div style={{ padding: '14px 18px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 10,
                }}>
                  <div style={{ color: '#d4d4d8', fontSize: 14, fontWeight: 500 }}>Master Volume</div>
                  <span style={{ color: '#71717a', fontSize: 13, fontWeight: 600 }}>
                    {Math.round(masterVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={masterVolume}
                  onChange={e => setMasterVolume(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: accent.from }}
                />
              </div>
            </Card>

            <SectionLabel>Pattern</SectionLabel>
            <Card>
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '14px 18px', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#d4d4d8', fontSize: 14, fontWeight: 500 }}>Bars</div>
                  <div style={{ color: '#52525b', fontSize: 12, marginTop: 2 }}>
                    {pattern.measures.length} {pattern.measures.length === 1 ? 'bar' : 'bars'} in pattern
                  </div>
                </div>
                <button
                  onClick={() => addMeasure(pattern.id)}
                  style={{
                    height: 34, padding: '0 16px', borderRadius: 10,
                    background: `${accent.from}18`,
                    border: `1px solid ${accent.from}44`,
                    cursor: 'pointer', color: accent.from,
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  + Add Bar
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <DrumBottomNav activeTab={activeTab} setTab={setActiveTab} accent={accent} />
    </div>
  );
}

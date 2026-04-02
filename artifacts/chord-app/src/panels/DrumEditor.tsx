import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import {
  useDrumStore, DRUM_INSTRUMENTS, INSTRUMENT_NAME, INSTRUMENT_COLOR,
  KIT_INSTRUMENTS, stepsPerMeasure,
  type DrumInstrument, type KitType,
} from '../store/useDrumStore';
import {
  drumScheduler, samplePool, loadDrumSamples, KIT_DEFAULTS,
  type SampleStatus,
} from '../lib/drumAudio';

// ── Constants ─────────────────────────────────────────────────────────────────
const TOP_H   = 50;   // top header bar
const INST_H  = 52;   // instrument column header
const BOT_H   = 54;   // bottom action bar
const ROW_H_16 = 28;  // row height for 16th note steps
const ROW_H_8  = 38;  // row height for 8th note steps

const KIT_ICONS: Record<KitType, string> = {
  acoustic:   '🥁',
  advanced:   '🎶',
  electronic: '⚡',
};
const KIT_LABEL: Record<KitType, string> = {
  acoustic:   'Acoustic',
  advanced:   'Advanced',
  electronic: 'Electronic',
};
const INST_SHORT: Record<DrumInstrument, string> = {
  kick:           'KICK',
  snare:          'SNARE',
  'hihat-closed': 'HH',
  'hihat-open':   'OPEN',
  'hihat-foot':   'HH-F',
  'tom-high':     'TOM H',
  'tom-mid':      'TOM M',
  'tom-floor':    'FLOOR',
  crash:          'CRASH',
  ride:           'RIDE',
};

// ── KitSelectorSheet ─────────────────────────────────────────────────────────
function KitSelectorSheet({
  accent, onSelect, onClose,
}: {
  accent: { from: string; to: string };
  onSelect: (k: KitType) => void;
  onClose?: () => void;
}) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const id = setTimeout(() => setVis(true), 10); return () => clearTimeout(id); }, []);
  const KITS: KitType[] = ['acoustic', 'advanced', 'electronic'];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: vis ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)',
        transition: 'background 280ms',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        width: '100%', background: '#18181b',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '10px 0 36px',
        transform: vis ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 330ms cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -10px 48px rgba(0,0,0,0.7)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#3f3f46', margin: '0 auto 18px' }} />
        <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 4px 22px' }}>
          Choose your kit
        </p>
        <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 18px 22px' }}>
          Each kit loads real sampled drum sounds
        </p>

        {KITS.map(kit => {
          const info = KIT_DEFAULTS[kit];
          return (
            <button
              key={kit}
              onClick={() => onSelect(kit)}
              style={{
                display: 'flex', alignItems: 'center', gap: 18,
                width: '100%', padding: '17px 22px',
                background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', transition: 'background 120ms',
              }}
              onPointerEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onPointerLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: `linear-gradient(135deg,${accent.from},${accent.to})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>
                {KIT_ICONS[kit]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                  {KIT_ICONS[kit]} {info.label}
                </div>
                <div style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
                  {info.description}
                </div>
              </div>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                border: `2px solid ${accent.from}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: accent.from, fontSize: 14 }}>›</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── InstrumentSheet (toggle active instruments) ───────────────────────────────
function InstrumentSheet({
  activeInstruments, accent, onToggle, onClose,
}: {
  activeInstruments: DrumInstrument[];
  accent: { from: string; to: string };
  onToggle: (inst: DrumInstrument) => void;
  onClose: () => void;
}) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const id = setTimeout(() => setVis(true), 10); return () => clearTimeout(id); }, []);
  const activeSet = useMemo(() => new Set(activeInstruments), [activeInstruments]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: vis ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
        transition: 'background 250ms',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', background: '#18181b',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '10px 0 40px',
        transform: vis ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#3f3f46', margin: '0 auto 14px' }} />
        <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: '0 0 14px 20px' }}>
          Active Instruments
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '0 18px' }}>
          {DRUM_INSTRUMENTS.map(inst => {
            const on = activeSet.has(inst);
            return (
              <button
                key={inst}
                onClick={() => onToggle(inst)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', borderRadius: 50,
                  border: `2px solid ${on ? INSTRUMENT_COLOR[inst] : '#3f3f46'}`,
                  background: on ? `${INSTRUMENT_COLOR[inst]}22` : 'transparent',
                  cursor: 'pointer', transition: 'all 150ms',
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: on ? INSTRUMENT_COLOR[inst] : '#52525b',
                }} />
                <span style={{ color: on ? '#fff' : '#71717a', fontSize: 13, fontWeight: 600 }}>
                  {INSTRUMENT_NAME[inst]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main DrumEditor ───────────────────────────────────────────────────────────
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
  const {
    patterns, activePatternId,
    soundMap, volumeMap, masterVolume,
    kitType, activeInstruments,
    setKitType, toggleInstrument,
    toggleHit, addMeasure, updatePattern,
  } = useDrumStore();

  const pattern = useMemo(
    () => patterns.find(p => p.id === activePatternId) ?? patterns[0],
    [patterns, activePatternId],
  );

  const accent  = ACCENT_COLORS[settings.accentColor] ?? ACCENT_COLORS.blue;
  const spm     = stepsPerMeasure(pattern);
  const totalSteps = spm * pattern.measures.length;
  const rowH    = pattern.subdivision === 8 ? ROW_H_8 : ROW_H_16;

  // Local state
  const [playing, setPlaying]         = useState(false);
  const [looping, setLooping]         = useState(true);
  const [sampleStatus, setSampleStatus] = useState<SampleStatus>('idle');
  const [showKitSheet, setShowKitSheet]   = useState(!kitType);
  const [showInstrSheet, setShowInstrSheet] = useState(false);

  // Refs for zero-lag playhead (no React re-render on step)
  const gridScrollRef  = useRef<HTMLDivElement>(null);
  const playheadRef    = useRef<HTMLDivElement>(null);
  const rowHLRef       = useRef<HTMLDivElement>(null);
  const pointerStart   = useRef<{ x: number; y: number } | null>(null);
  const rowHRef        = useRef(rowH);
  rowHRef.current = rowH;

  // hitSet for O(1) cell lookup — only recomputes when pattern changes
  const hitSet = useMemo(() => {
    const s = new Set<string>();
    pattern.measures.forEach((m, mIdx) => {
      DRUM_INSTRUMENTS.forEach(inst => {
        m.hits[inst]?.forEach(h => s.add(`${mIdx}:${inst}:${h.step}`));
      });
    });
    return s;
  }, [pattern]);

  // Subscribe to sample pool status
  useEffect(() => {
    samplePool.onStatusChange = (s) => setSampleStatus(s);
    setSampleStatus(samplePool.status);
    return () => { samplePool.onStatusChange = null; };
  }, []);

  // Load samples whenever the kit changes
  useEffect(() => {
    if (kitType) loadDrumSamples(kitType);
  }, [kitType]);

  // Keep scheduler in sync when pattern changes while playing
  useEffect(() => {
    if (playing) drumScheduler.updatePattern(pattern);
  }, [pattern, playing]);

  // Zero-lag onStep — direct DOM mutation, no React state
  useEffect(() => {
    drumScheduler.onStep = (gs, _mIdx, _sInM) => {
      if (gs < 0) {
        if (playheadRef.current) playheadRef.current.style.display = 'none';
        if (rowHLRef.current)    rowHLRef.current.style.display    = 'none';
        return;
      }
      const rh = rowHRef.current;
      const y  = gs * rh;
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateY(${y}px)`;
        playheadRef.current.style.display   = 'block';
      }
      if (rowHLRef.current) {
        rowHLRef.current.style.transform = `translateY(${y}px)`;
        rowHLRef.current.style.display   = 'block';
      }
      // Auto-scroll
      const el = gridScrollRef.current;
      if (el) {
        if (y < el.scrollTop - 10 || y > el.scrollTop + el.clientHeight - rh * 4) {
          el.scrollTop = Math.max(0, y - el.clientHeight * 0.30);
        }
      }
    };
    return () => { drumScheduler.onStep = null; };
  }, []);

  // Stop on unmount
  useEffect(() => () => { drumScheduler.stop(); }, []);

  // ── Play / Stop ─────────────────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    const kit    = kitType ?? 'acoustic';
    const sm     = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
    const volMap: Partial<Record<DrumInstrument, number>> = {};
    activeInstruments.forEach(i => { volMap[i] = volumeMap[i] ?? 1.0; });

    if (drumScheduler.isPlaying) {
      drumScheduler.stop();
      setPlaying(false);
    } else {
      loadDrumSamples(kit);
      drumScheduler.start(pattern, sm, volMap, masterVolume, looping, kit);
      setPlaying(true);
    }
  }, [pattern, kitType, soundMap, volumeMap, activeInstruments, masterVolume, looping]);

  // ── Kit selection ───────────────────────────────────────────────────────────
  const handleKitSelect = useCallback((kit: KitType) => {
    const sm = KIT_DEFAULTS[kit].soundMap;
    setKitType(kit, sm);
    loadDrumSamples(kit);
    setShowKitSheet(false);
    if (drumScheduler.isPlaying) {
      drumScheduler.stop();
      setPlaying(false);
    }
  }, [setKitType]);

  // ── BPM ─────────────────────────────────────────────────────────────────────
  const adjustBpm = useCallback((delta: number) => {
    const newBpm = Math.max(40, Math.min(280, pattern.bpm + delta));
    updatePattern(pattern.id, { bpm: newBpm });
    if (drumScheduler.isPlaying) {
      const kit = kitType ?? 'acoustic';
      const sm  = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
      const volMap: Partial<Record<DrumInstrument, number>> = {};
      activeInstruments.forEach(i => { volMap[i] = volumeMap[i] ?? 1.0; });
      const updated = useDrumStore.getState().patterns.find(p => p.id === pattern.id)!;
      drumScheduler.start(updated, sm, volMap, masterVolume, looping, kit);
    }
  }, [pattern, kitType, soundMap, volumeMap, activeInstruments, masterVolume, looping, updatePattern]);

  // ── Subdivision toggle ──────────────────────────────────────────────────────
  const toggleSubdivision = useCallback(() => {
    const next: 8 | 16 = pattern.subdivision === 16 ? 8 : 16;
    updatePattern(pattern.id, { subdivision: next });
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
  }, [pattern, updatePattern]);

  // ── Hit tap interaction ─────────────────────────────────────────────────────
  const cellFromPointer = (e: React.PointerEvent): {
    mIdx: number; inst: DrumInstrument; step: number;
  } | null => {
    const el = gridScrollRef.current;
    if (!el) return null;
    const rect   = el.getBoundingClientRect();
    const cy     = e.clientY - rect.top + el.scrollTop;
    const cx     = e.clientX - rect.left;
    const numCols = activeInstruments.length;
    if (numCols === 0) return null;
    const colW = rect.width / numCols;
    const gs   = Math.max(0, Math.min(totalSteps - 1, Math.floor(cy / rowH)));
    const col  = Math.max(0, Math.min(numCols - 1, Math.floor(cx / colW)));
    const mIdx = Math.floor(gs / spm);
    const step = gs % spm;
    if (mIdx >= pattern.measures.length) return null;
    return { mIdx, inst: activeInstruments[col], step };
  };

  const handleGridPointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleGridPointerUp = (e: React.PointerEvent) => {
    const s = pointerStart.current;
    if (!s) return;
    pointerStart.current = null;
    if (Math.abs(e.clientX - s.x) < 12 && Math.abs(e.clientY - s.y) < 12) {
      const cell = cellFromPointer(e);
      if (cell) {
        const { mIdx, inst, step } = cell;
        const m = pattern.measures[mIdx];
        if (m) {
          toggleHit(pattern.id, m.id, inst, step);
          if (drumScheduler.isPlaying)
            drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === pattern.id)!);
          // Haptic preview on tap
          drumScheduler.previewSound(
            KIT_DEFAULTS[kitType ?? 'acoustic'].soundMap[inst] ?? inst,
            0.5, kitType,
          );
        }
      }
    }
  };

  // ── Instrument header tap = preview sound ───────────────────────────────────
  const handleInstHeaderTap = useCallback((inst: DrumInstrument) => {
    const kit = kitType ?? 'acoustic';
    const sid = KIT_DEFAULTS[kit].soundMap[inst] ?? inst;
    drumScheduler.previewSound(sid, 0.65, kit);
  }, [kitType]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: '#09090b', overflow: 'hidden',
      userSelect: 'none', WebkitUserSelect: 'none',
    }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: TOP_H, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
        background: '#09090b',
        borderBottom: '1px solid #1c1c1f',
      }}>
        {/* Back */}
        <button
          onClick={() => { drumScheduler.stop(); updateSettings({ appMode: 'chords' }); }}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#18181b', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#a1a1aa', fontSize: 18,
          }}
        >‹</button>

        <span style={{ color: '#71717a', fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
          DRUMS
        </span>

        {/* Kit badge */}
        <button
          onClick={() => setShowKitSheet(true)}
          style={{
            height: 30, padding: '0 12px', borderRadius: 20,
            background: `${accent.from}22`,
            border: `1.5px solid ${accent.from}55`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 14 }}>{KIT_ICONS[kitType ?? 'acoustic']}</span>
          <span style={{ color: accent.from, fontSize: 12, fontWeight: 700 }}>
            {KIT_LABEL[kitType ?? 'acoustic']}
          </span>
        </button>

        <div style={{ flex: 1 }} />

        {/* BPM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => adjustBpm(-5)}
            style={{ width: 28, height: 28, borderRadius: 8, background: '#18181b', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: 16 }}
          >−</button>
          <div style={{ minWidth: 44, textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{pattern.bpm}</div>
            <div style={{ color: '#52525b', fontSize: 9, letterSpacing: 0.5 }}>BPM</div>
          </div>
          <button
            onClick={() => adjustBpm(5)}
            style={{ width: 28, height: 28, borderRadius: 8, background: '#18181b', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: 16 }}
          >+</button>
        </div>

        {/* Subdivision */}
        <button
          onClick={toggleSubdivision}
          style={{
            height: 30, padding: '0 12px', borderRadius: 20,
            background: '#18181b', border: '1.5px solid #3f3f46',
            cursor: 'pointer', color: '#a1a1aa', fontSize: 12, fontWeight: 700,
          }}
        >
          1/{pattern.subdivision}
        </button>

        {/* Sample status */}
        {sampleStatus === 'loading' && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
        )}
        {sampleStatus === 'ready' && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
        )}
      </div>

      {/* ── Instrument column headers (fixed, above grid) ────────────────────── */}
      <div style={{
        height: INST_H, flexShrink: 0,
        display: 'flex', background: '#0d0d0f',
        borderBottom: '2px solid #27272a',
        overflowX: 'hidden',
      }}>
        {activeInstruments.map(inst => (
          <button
            key={inst}
            onClick={() => handleInstHeaderTap(inst)}
            style={{
              flex: 1, minWidth: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 4, border: 'none', cursor: 'pointer',
              background: 'transparent',
              borderRight: '1px solid #18181b',
              padding: '6px 2px',
            }}
          >
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: INSTRUMENT_COLOR[inst],
              boxShadow: `0 0 6px ${INSTRUMENT_COLOR[inst]}99`,
            }} />
            <span style={{
              color: '#a1a1aa', fontSize: 9, fontWeight: 700,
              letterSpacing: 0.3, textAlign: 'center', lineHeight: 1.1,
            }}>
              {INST_SHORT[inst]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Scrollable grid ──────────────────────────────────────────────────── */}
      <div
        ref={gridScrollRef}
        onPointerDown={handleGridPointerDown}
        onPointerUp={handleGridPointerUp}
        style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          position: 'relative',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        }}
        className="no-scrollbar"
      >
        {/* Row highlight — updated via ref, zero React re-render */}
        <div
          ref={rowHLRef}
          style={{
            position: 'absolute', left: 0, right: 0,
            height: rowH, top: 0,
            background: `${accent.from}18`,
            pointerEvents: 'none', zIndex: 1,
            display: 'none',
          }}
        />

        {/* Playhead line — updated via ref */}
        <div
          ref={playheadRef}
          style={{
            position: 'absolute', left: 0, right: 0,
            height: 2, top: 0,
            background: accent.from,
            boxShadow: `0 0 8px ${accent.from}`,
            pointerEvents: 'none', zIndex: 3,
            display: 'none',
          }}
        />

        {/* Step rows */}
        {Array.from({ length: totalSteps }, (_, gs) => {
          const mIdx      = Math.floor(gs / spm);
          const stepInM   = gs % spm;
          const isMeasureStart = stepInM === 0 && gs > 0;
          const isBeat    = stepInM % stepsPerBeat === 0;
          const bgColor   = isBeat ? '#111315' : '#0d0d0f';

          return (
            <div
              key={gs}
              style={{
                display: 'flex',
                height: rowH,
                background: bgColor,
                borderTop: isMeasureStart
                  ? '2px solid #3f3f46'
                  : isBeat
                    ? '1px solid #1f1f23'
                    : '1px solid #131316',
                position: 'relative', zIndex: 2,
              }}
            >
              {activeInstruments.map(inst => {
                const hasHit = hitSet.has(`${mIdx}:${inst}:${stepInM}`);
                return (
                  <div
                    key={inst}
                    style={{
                      flex: 1, minWidth: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRight: '1px solid #18181b',
                    }}
                  >
                    {hasHit && (
                      <div style={{
                        width: '82%', height: rowH - 7,
                        borderRadius: 4,
                        background: INSTRUMENT_COLOR[inst],
                        boxShadow: `0 1px 6px ${INSTRUMENT_COLOR[inst]}55`,
                        flexShrink: 0,
                      }} />
                    )}
                  </div>
                );
              })}

              {/* Measure label at start of each measure */}
              {stepInM === 0 && (
                <div style={{
                  position: 'absolute', left: 4, top: 2,
                  fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                  color: '#3f3f46', pointerEvents: 'none', zIndex: 4,
                }}>
                  M{mIdx + 1}
                </div>
              )}
            </div>
          );
        })}

        {/* Spacer so last rows aren't hidden under bottom bar */}
        <div style={{ height: 16 }} />
      </div>

      {/* ── Bottom action bar ─────────────────────────────────────────────────── */}
      <div style={{
        height: BOT_H, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', gap: 8,
        background: '#09090b',
        borderTop: '1px solid #1c1c1f',
      }}>

        {/* Instruments toggle */}
        <button
          onClick={() => setShowInstrSheet(true)}
          style={{
            height: 36, padding: '0 14px', borderRadius: 20,
            background: '#18181b', border: '1.5px solid #3f3f46',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            color: '#a1a1aa', fontSize: 12, fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 14 }}>🎼</span>
          <span>{activeInstruments.length} inst</span>
        </button>

        {/* Add measure */}
        <button
          onClick={() => addMeasure(pattern.id)}
          style={{
            height: 36, padding: '0 14px', borderRadius: 20,
            background: '#18181b', border: '1.5px solid #3f3f46',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            color: '#a1a1aa', fontSize: 12, fontWeight: 600,
          }}
        >
          <span>+ Bar</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Loop */}
        <button
          onClick={() => setLooping(l => !l)}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: looping ? `${accent.from}33` : '#18181b',
            border: `1.5px solid ${looping ? accent.from : '#3f3f46'}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: looping ? accent.from : '#52525b',
          }}
          title="Loop"
        >
          ⟳
        </button>

        {/* Play / Stop */}
        <button
          onClick={handlePlay}
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: playing
              ? '#3f3f46'
              : `linear-gradient(135deg,${accent.from},${accent.to})`,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: '#fff',
            boxShadow: playing ? 'none' : `0 4px 18px ${accent.from}66`,
            transition: 'all 180ms',
          }}
        >
          {playing ? '⏹' : '▶'}
        </button>
      </div>

      {/* ── Kit selector sheet ─────────────────────────────────────────────────── */}
      {showKitSheet && (
        <KitSelectorSheet
          accent={accent}
          onSelect={handleKitSelect}
          onClose={() => kitType && setShowKitSheet(false)}
        />
      )}

      {/* ── Instrument toggle sheet ───────────────────────────────────────────── */}
      {showInstrSheet && (
        <InstrumentSheet
          activeInstruments={activeInstruments}
          accent={accent}
          onToggle={toggleInstrument}
          onClose={() => setShowInstrSheet(false)}
        />
      )}
    </div>
  );
}

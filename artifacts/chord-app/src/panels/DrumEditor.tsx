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
const TOP_H    = 52;   // top bar height
const BAR_NUM_W = 28;  // left column: measure number
const STEP_H   = 54;   // each measure row height (touch-friendly)
const BOT_H    = 80;   // bottom instrument bar height (includes safe-area)

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

// ── KitSelectorSheet ─────────────────────────────────────────────────────────
function KitSelectorSheet({
  accent, currentKit, onSelect, onClose,
}: {
  accent: { from: string; to: string };
  currentKit: KitType | null;
  onSelect: (k: KitType) => void;
  onClose: () => void;
}) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const id = setTimeout(() => setVis(true), 10); return () => clearTimeout(id); }, []);
  const KITS: KitType[] = ['acoustic', 'advanced', 'electronic'];
  const INFO: Record<KitType, string> = {
    acoustic:   'Real acoustic drum samples',
    advanced:   'Roland R8 drum machine',
    electronic: 'Techno & FM synthesized',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: vis ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        transition: 'background 250ms',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', background: '#111113',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        transform: vis ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#3f3f46', margin: '12px auto 20px' }} />

        <div style={{ padding: '0 20px 8px' }}>
          <p style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>Drum Kit</p>
          <p style={{ color: '#52525b', fontSize: 13, margin: '3px 0 0' }}>Choose a sound character</p>
        </div>

        <div style={{ padding: '4px 12px 24px' }}>
          {KITS.map(kit => {
            const selected = kit === currentKit;
            return (
              <button
                key={kit}
                onClick={() => onSelect(kit)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  width: '100%', padding: '13px 10px', borderRadius: 14,
                  background: selected ? `${accent.from}18` : 'none',
                  border: `1.5px solid ${selected ? accent.from + '60' : 'transparent'}`,
                  cursor: 'pointer', textAlign: 'left', marginBottom: 4,
                  transition: 'all 150ms',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: selected ? `linear-gradient(135deg,${accent.from},${accent.to})` : '#1c1c1f',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {KIT_ICONS[kit]}
                </div>
                <div>
                  <div style={{ color: selected ? '#fff' : '#d4d4d8', fontSize: 15, fontWeight: 600 }}>
                    {KIT_LABEL[kit]}
                  </div>
                  <div style={{ color: '#52525b', fontSize: 12, marginTop: 2 }}>{INFO[kit]}</div>
                </div>
                {selected && (
                  <div style={{ marginLeft: 'auto', color: accent.from, fontSize: 18 }}>✓</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
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
    toggleHit, addMeasure, updatePattern,
  } = useDrumStore();

  const pattern = useMemo(
    () => patterns.find(p => p.id === activePatternId) ?? patterns[0],
    [patterns, activePatternId],
  );

  const accent      = ACCENT_COLORS[settings.accentColor] ?? ACCENT_COLORS.blue;
  const spm         = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];

  // ── Local state ─────────────────────────────────────────────────────────────
  const [playing, setPlaying]         = useState(false);
  const [looping, setLooping]         = useState(true);
  const [sampleStatus, setSampleStatus] = useState<SampleStatus>('idle');
  const [showKitSheet, setShowKitSheet]   = useState(!kitType);
  // Selected instrument for placing notes
  const [selectedInst, setSelectedInst] = useState<DrumInstrument>(
    () => activeInstruments[0] ?? 'kick',
  );

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const playheadRef   = useRef<HTMLDivElement>(null);
  const spmRef        = useRef(spm);
  spmRef.current = spm;
  const pointerStart  = useRef<{ x: number; y: number } | null>(null);

  // ── Derived hit-set for the selected instrument ──────────────────────────────
  const hitSet = useMemo(() => {
    const s = new Set<number>(); // global step index
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
      const sp = spmRef.current;
      const el = gridScrollRef.current;
      const gridW = el?.offsetWidth ?? 390;

      const x = (stepInM / sp) * gridW;
      const y = mIdx * STEP_H;

      if (playheadRef.current) {
        playheadRef.current.style.transform = `translate(${x}px, ${y}px)`;
        playheadRef.current.style.display   = 'block';
      }

      // Auto-scroll to keep current measure visible
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
    setShowKitSheet(false);
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
    // Reset active instruments to kit defaults
    const defaultInsts = KIT_INSTRUMENTS[kit];
    if (!defaultInsts.includes(selectedInst)) setSelectedInst(defaultInsts[0]);
  }, [setKitType, selectedInst]);

  // ── BPM ──────────────────────────────────────────────────────────────────────
  const adjustBpm = useCallback((d: number) => {
    const bpm = Math.max(40, Math.min(280, pattern.bpm + d));
    updatePattern(pattern.id, { bpm });
    if (drumScheduler.isPlaying) {
      const kit  = kitType ?? 'acoustic';
      const sm   = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
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

    const el   = gridScrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cy   = e.clientY - rect.top + el.scrollTop;
    const cx   = e.clientX - rect.left;

    const mIdx = Math.max(0, Math.min(pattern.measures.length - 1, Math.floor(cy / STEP_H)));
    const step = Math.max(0, Math.min(spm - 1, Math.floor((cx / rect.width) * spm)));
    const m    = pattern.measures[mIdx];
    if (!m) return;

    toggleHit(pattern.id, m.id, selectedInst, step);
    if (drumScheduler.isPlaying)
      drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === pattern.id)!);

    // Audio preview on tap
    const kit = kitType ?? 'acoustic';
    drumScheduler.previewSound(KIT_DEFAULTS[kit].soundMap[selectedInst] ?? selectedInst, 0.55, kit);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const totalRows   = pattern.measures.length;
  const instColor   = INSTRUMENT_COLOR[selectedInst] ?? accent.from;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: '#09090b',
      overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none',
    }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: TOP_H, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 8,
        borderBottom: '1px solid #1a1a1f',
        background: '#09090b',
      }}>
        {/* Back */}
        <button
          onClick={() => { drumScheduler.stop(); updateSettings({ appMode: 'chords' }); }}
          style={btnStyle({ size: 36 })}
        >
          <span style={{ fontSize: 19, color: '#a1a1aa', lineHeight: 1 }}>‹</span>
        </button>

        {/* Kit selector */}
        <button
          onClick={() => setShowKitSheet(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 12px', borderRadius: 20,
            background: '#18181b',
            border: `1px solid ${sampleStatus === 'ready' ? '#27272a' : '#27272a'}`,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 13 }}>{KIT_ICONS[kitType ?? 'acoustic']}</span>
          <span style={{ color: '#71717a', fontSize: 12, fontWeight: 600 }}>
            {KIT_LABEL[kitType ?? 'acoustic']}
          </span>
          {/* status dot */}
          {sampleStatus === 'loading' && (
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b' }} />
          )}
          {sampleStatus === 'ready' && (
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80' }} />
          )}
        </button>

        <div style={{ flex: 1 }} />

        {/* BPM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button onClick={() => adjustBpm(-5)} style={btnStyle({ size: 26, small: true })}>
            <span style={{ color: '#71717a', fontSize: 14 }}>−</span>
          </button>
          <div style={{ minWidth: 38, textAlign: 'center' }}>
            <span style={{ color: '#e4e4e7', fontSize: 14, fontWeight: 700 }}>{pattern.bpm}</span>
            <span style={{ color: '#3f3f46', fontSize: 10, marginLeft: 2 }}>BPM</span>
          </div>
          <button onClick={() => adjustBpm(5)} style={btnStyle({ size: 26, small: true })}>
            <span style={{ color: '#71717a', fontSize: 14 }}>+</span>
          </button>
        </div>

        {/* Subdivision */}
        <button
          onClick={toggleSub}
          style={{
            height: 28, padding: '0 10px', borderRadius: 8,
            background: '#18181b', border: '1px solid #27272a',
            cursor: 'pointer', color: '#71717a', fontSize: 11, fontWeight: 700,
          }}
        >
          1/{pattern.subdivision}
        </button>

        {/* Loop */}
        <button
          onClick={() => setLooping(l => !l)}
          style={{
            width: 32, height: 32, borderRadius: 9,
            background: looping ? `${accent.from}22` : '#18181b',
            border: `1px solid ${looping ? accent.from + '55' : '#27272a'}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: looping ? accent.from : '#52525b',
          }}
        >
          ⟳
        </button>

        {/* Play */}
        <button
          onClick={handlePlay}
          style={{
            width: 36, height: 36, borderRadius: 11,
            background: playing
              ? '#27272a'
              : `linear-gradient(135deg,${accent.from},${accent.to})`,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: playing ? 14 : 15, color: '#fff',
            boxShadow: playing ? 'none' : `0 2px 12px ${accent.from}55`,
            transition: 'all 160ms',
          }}
        >
          {playing ? '⏹' : '▶'}
        </button>
      </div>

      {/* ── Selected instrument indicator ────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        height: 34,
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 8,
        background: '#09090b',
        borderBottom: '1px solid #131318',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: instColor, flexShrink: 0 }} />
        <span style={{ color: '#a1a1aa', fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>
          {INST_LABEL[selectedInst]}
        </span>
        <span style={{ color: '#3f3f46', fontSize: 11 }}>
          · {pattern.measures.length} {pattern.measures.length === 1 ? 'bar' : 'bars'} · {pattern.subdivision === 16 ? '16th' : '8th'} notes
        </span>
      </div>

      {/* ── Grid area ────────────────────────────────────────────────────────── */}
      <div
        ref={gridScrollRef}
        onPointerDown={handleGridPointerDown}
        onPointerUp={handleGridPointerUp}
        style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          position: 'relative',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: BOT_H,
        }}
        className="no-scrollbar"
      >
        {/* Beat ruler (sticky at top of scroll area) */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          height: 20, display: 'flex',
          background: '#09090b',
          borderBottom: '1px solid #131318',
        }}>
          {Array.from({ length: spm }, (_, s) => {
            const isBeat = s % stepsPerBeat === 0;
            return (
              <div
                key={s}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRight: '1px solid #13131a',
                }}
              >
                {isBeat && (
                  <span style={{ color: '#3f3f46', fontSize: 9, fontWeight: 700 }}>
                    {s / stepsPerBeat + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Measure rows + playhead */}
        <div style={{ position: 'relative' }}>
          {/* Playhead — zero-lag, ref-updated */}
          <div
            ref={playheadRef}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 2, height: STEP_H,
              background: accent.from,
              boxShadow: `0 0 6px ${accent.from}88`,
              pointerEvents: 'none', zIndex: 5,
              display: 'none',
            }}
          />

          {/* Measure blocks */}
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
            padding: '18px 0 20px',
          }}>
            <button
              onClick={() => addMeasure(pattern.id)}
              style={{
                height: 34, padding: '0 22px', borderRadius: 20,
                background: 'transparent',
                border: `1px dashed #2a2a30`,
                cursor: 'pointer', color: '#52525b', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 160ms',
              }}
              onPointerEnter={e => { e.currentTarget.style.borderColor = accent.from + '80'; e.currentTarget.style.color = accent.from; }}
              onPointerLeave={e => { e.currentTarget.style.borderColor = '#2a2a30'; e.currentTarget.style.color = '#52525b'; }}
            >
              <span style={{ fontSize: 16 }}>+</span>
              <span>Add Bar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom instrument bar (floating) ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: BOT_H,
        background: 'linear-gradient(to top, #09090b 70%, transparent)',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}>
        <div
          style={{
            pointerEvents: 'all',
            display: 'flex', alignItems: 'center',
            gap: 7, padding: '0 12px 10px',
            overflowX: 'auto', overflowY: 'hidden',
          }}
          className="no-scrollbar"
        >
          {activeInstruments.map(inst => {
            const active = inst === selectedInst;
            const color  = INSTRUMENT_COLOR[inst];
            return (
              <button
                key={inst}
                onClick={() => setSelectedInst(inst)}
                style={{
                  flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 5, padding: '9px 14px',
                  borderRadius: 14,
                  background: active ? `${color}20` : 'rgba(17,17,20,0.92)',
                  border: `1.5px solid ${active ? color + '80' : '#22222a'}`,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 150ms',
                  minWidth: 58,
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: active ? color : '#3f3f46',
                  boxShadow: active ? `0 0 6px ${color}` : 'none',
                  transition: 'all 150ms',
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: active ? '#f4f4f5' : '#52525b',
                  letterSpacing: 0.2, lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}>
                  {INST_LABEL[inst].toUpperCase().slice(0, 6)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Kit selector sheet ─────────────────────────────────────────────── */}
      {showKitSheet && (
        <KitSelectorSheet
          accent={accent}
          currentKit={kitType}
          onSelect={handleKitSelect}
          onClose={() => kitType && setShowKitSheet(false)}
        />
      )}
    </div>
  );
}

// ── MeasureRow — memoized for performance ─────────────────────────────────────
const MeasureRow = ({
  mIdx, spm, stepsPerBeat, hitSet, instColor, accent,
}: {
  mIdx:         number;
  spm:          number;
  stepsPerBeat: number;
  hitSet:       Set<number>;
  instColor:    string;
  accent:       { from: string; to: string };
}) => {
  const steps = Array.from({ length: spm }, (_, s) => s);

  return (
    <div style={{
      display: 'flex', height: STEP_H,
      borderBottom: '1px solid #131318',
      position: 'relative',
    }}>
      {/* Measure number label */}
      <div style={{
        position: 'absolute', left: 4, top: 4,
        fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
        color: '#2a2a32', pointerEvents: 'none', zIndex: 2,
      }}>
        {mIdx + 1}
      </div>

      {/* Step cells */}
      {steps.map(step => {
        const gs     = mIdx * spm + step;
        const isHit  = hitSet.has(gs);
        const beatGrp = Math.floor(step / stepsPerBeat) % 2 === 0;

        return (
          <div
            key={step}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: beatGrp ? 'rgba(255,255,255,0.013)' : 'transparent',
              borderRight: step === spm - 1 ? 'none' : `1px solid rgba(255,255,255,${step % stepsPerBeat === stepsPerBeat - 1 ? '0.055' : '0.022'})`,
            }}
          >
            {isHit ? (
              <div style={{
                width: '76%', height: '64%',
                borderRadius: 6,
                background: instColor,
                boxShadow: `0 1px 8px ${instColor}55`,
              }} />
            ) : (
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Shared button style helper ────────────────────────────────────────────────
function btnStyle({ size, small }: { size: number; small?: boolean }) {
  return {
    width: size, height: size,
    borderRadius: small ? 7 : 10,
    background: '#18181b' as const,
    border: '1px solid #27272a' as const,
    cursor: 'pointer' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0 as const,
  };
}

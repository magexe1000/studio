import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import {
  useDrumStore,
  DRUM_INSTRUMENTS,
  INSTRUMENT_NAME,
  INSTRUMENT_COLOR,
  stepsPerMeasure,
  measureHasHits,
  type DrumInstrument,
  type DrumPattern,
  type DrumMeasure,
} from '../store/useDrumStore';
import {
  drumScheduler,
  samplePool,
  loadDrumSamples,
  SOUND_VARIANTS,
  defaultSoundId,
  soundVariantLabel,
  type SampleStatus,
} from '../lib/drumAudio';

// ── Instrument display config ───────────────────────────────────────────────
// Short readable labels for the drum machine rows
const ROW_LABEL: Record<DrumInstrument, string> = {
  kick:           'Kick',
  snare:          'Snare',
  'hihat-closed': 'Hi-Hat',
  'hihat-open':   'Open HH',
  'hihat-foot':   'HH Foot',
  'tom-high':     'Tom Hi',
  'tom-mid':      'Tom Mid',
  'tom-floor':    'Floor',
  crash:          'Crash',
  ride:           'Ride',
};

// Default "core" instruments shown without expanding
const CORE_INSTRUMENTS: DrumInstrument[] = [
  'kick', 'snare', 'hihat-closed', 'hihat-open', 'crash', 'tom-high',
];
const EXTRA_INSTRUMENTS: DrumInstrument[] = [
  'hihat-foot', 'tom-mid', 'tom-floor', 'ride',
];

// ── Constants ───────────────────────────────────────────────────────────────
const ROW_H   = 42;
const LABEL_W = 82;

// ── Bottom nav ──────────────────────────────────────────────────────────────
type DrumTab = 'editor' | 'patterns' | 'tools';

function DrumBottomNav({
  active, onChange, accent, isLight,
}: {
  active: DrumTab;
  onChange: (t: DrumTab) => void;
  accent: { from: string; to: string };
  isLight: boolean;
}) {
  const tabs: { id: DrumTab; icon: string; label: string }[] = [
    { id: 'editor',   icon: 'grid_on',    label: 'Editor'   },
    { id: 'patterns', icon: 'queue_music',label: 'Patterns' },
    { id: 'tools',    icon: 'tune',       label: 'Tools'    },
  ];

  const navRef  = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; width: number; ready: boolean }>({ left: 0, width: 0, ready: false });

  const measure = (idx: number) => {
    const btn = btnRefs.current[idx];
    const nav = navRef.current;
    if (!btn || !nav) return null;
    const nb = nav.getBoundingClientRect();
    const bb = btn.getBoundingClientRect();
    return { left: bb.left - nb.left, width: bb.width };
  };

  useEffect(() => {
    const m = measure(tabs.findIndex(t => t.id === active));
    if (m) setPill({ ...m, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const idx = tabs.findIndex(t => t.id === active);
    const m = measure(idx);
    if (m) setPill({ ...m, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const amoled = useChordStore(s => s.settings.amoledMode);
  const bg = amoled ? 'rgba(4,4,4,0.94)' : isLight ? 'rgba(240,240,242,0.86)' : 'rgba(22,22,26,0.88)';

  return (
    <div
      ref={navRef}
      style={{
        position: 'fixed',
        bottom: 'max(10px, env(safe-area-inset-bottom))',
        left: '50%', transform: 'translateX(-50%)',
        width: '82%', maxWidth: 380,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '6px 8px',
        borderRadius: '2rem',
        background: bg,
        border: `1px solid ${isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.09)'}`,
        boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.14)' : '0 12px 48px rgba(0,0,0,0.55)',
        zIndex: 50, overflow: 'hidden',
      }}
    >
      {pill.ready && (
        <div aria-hidden style={{
          position: 'absolute', top: 4, left: pill.left, width: pill.width, height: 'calc(100% - 8px)',
          borderRadius: '9999px',
          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
          boxShadow: `0 2px 16px ${accent.to}60`,
          pointerEvents: 'none', zIndex: 0,
          transition: 'left 160ms cubic-bezier(0.34,1.56,0.64,1), width 160ms cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      )}
      {tabs.map(({ id, icon, label }, i) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            ref={el => { btnRefs.current[i] = el; }}
            onClick={() => onChange(id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3, padding: '7px 4px',
              borderRadius: '9999px', border: 'none', cursor: 'pointer',
              background: 'transparent', position: 'relative', zIndex: 1,
              color: isActive ? '#fff' : 'var(--c-text-secondary)',
              transition: 'color 130ms ease',
            }}
          >
            <span className="material-symbols-outlined" style={{
              fontSize: 20,
              fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
              transition: 'font-variation-settings 120ms ease',
            }}>{icon}</span>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 9, letterSpacing: '0.10em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Sample loading badge ─────────────────────────────────────────────────────
function SampleBadge({ status, loaded, total }: { status: SampleStatus; loaded: number; total: number }) {
  if (status === 'idle' || status === 'ready') return null;
  const label = status === 'loading'
    ? `Loading sounds… ${loaded}/${total}`
    : status === 'partial'
      ? `Sounds ${loaded}/${total} loaded`
      : 'Using synth sounds';
  const color = status === 'failed' ? '#f87171' : '#fbbf24';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: '9999px',
      background: `${color}18`, border: `1px solid ${color}40`,
    }}>
      {status === 'loading' && (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, animation: 'pulse 1s ease-in-out infinite' }} />
      )}
      <span style={{ fontFamily: 'Inter', fontSize: 9.5, color, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ── Instrument row ───────────────────────────────────────────────────────────
interface RowProps {
  pattern:     DrumPattern;
  measure:     DrumMeasure;
  instrument:  DrumInstrument;
  activeStep:  number;
  onPreview:   (inst: DrumInstrument) => void;
}

function InstrumentRow({ pattern, measure, instrument, activeStep, onPreview }: RowProps) {
  const { toggleHit } = useDrumStore();
  const steps         = stepsPerMeasure(pattern);
  const stepsPerBeat  = pattern.subdivision / pattern.timeSignature[1];
  const hits          = measure.hits[instrument] ?? [];
  const color         = INSTRUMENT_COLOR[instrument];
  const label         = ROW_LABEL[instrument];

  const rowRef  = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ adding: boolean } | null>(null);
  const touched  = useRef<Set<number>>(new Set());

  const stepAt = useCallback((clientX: number) => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return -1;
    return Math.max(0, Math.min(steps - 1, Math.floor((clientX - rect.left) / (rect.width / steps))));
  }, [steps]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const step    = stepAt(e.clientX);
    if (step < 0) return;
    const hasHit  = hits.some(h => step >= h.step && step < h.step + h.length);
    dragging.current = { adding: !hasHit };
    touched.current  = new Set([step]);
    toggleHit(pattern.id, measure.id, instrument, step);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const step = stepAt(e.clientX);
    if (step < 0 || touched.current.has(step)) return;
    touched.current.add(step);
    const hasHit = hits.some(h => step >= h.step && step < h.step + h.length);
    if (dragging.current.adding !== hasHit) toggleHit(pattern.id, measure.id, instrument, step);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragging.current = null;
    touched.current  = new Set();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: ROW_H, gap: 0 }}>
      {/* Instrument label button */}
      <button
        onClick={() => onPreview(instrument)}
        style={{
          width: LABEL_W, height: ROW_H - 6, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '0 10px',
          borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          transition: 'background 120ms ease',
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 11,
          color: 'rgba(255,255,255,0.70)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          {label}
        </span>
      </button>

      {/* Step grid */}
      <div
        ref={rowRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          flex: 1, height: '100%', display: 'flex', alignItems: 'center',
          cursor: 'pointer', userSelect: 'none', touchAction: 'none',
          paddingLeft: 6,
        }}
      >
        {Array.from({ length: steps }, (_, i) => {
          const beatIdx   = Math.floor(i / stepsPerBeat);
          const isOddBeat = beatIdx % 2 === 1;
          const hit       = hits.find(h => h.step === i);
          const isHit     = !!hit;
          const isActive  = i === activeStep;

          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: ROW_H - 16,
                marginLeft: i > 0 && i % stepsPerBeat === 0 ? 3 : 1,
                borderRadius: 5,
                background: isHit
                  ? color
                  : isActive
                    ? 'rgba(255,255,255,0.14)'
                    : isOddBeat
                      ? 'rgba(255,255,255,0.055)'
                      : 'rgba(255,255,255,0.025)',
                boxShadow: isHit ? `0 0 10px ${color}80` : 'none',
                outline: isActive && !isHit ? `1px solid rgba(255,255,255,0.30)` : 'none',
                transition: 'background 80ms ease, box-shadow 80ms ease',
                position: 'relative',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Beat number header ───────────────────────────────────────────────────────
function BeatHeader({ pattern }: { pattern: DrumPattern }) {
  const steps       = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];
  const beats        = steps / stepsPerBeat;

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 18, paddingLeft: LABEL_W + 6 }}>
      {Array.from({ length: beats }, (_, b) => (
        <div
          key={b}
          style={{
            flex: stepsPerBeat,
            marginLeft: b > 0 ? 3 : 0,
            display: 'flex', alignItems: 'center',
          }}
        >
          <span style={{
            fontFamily: 'Manrope, sans-serif', fontSize: 9, fontWeight: 800,
            color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em',
          }}>
            {b + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Measure view ─────────────────────────────────────────────────────────────
function MeasureView({
  pattern, measure, measureIdx, canDelete,
  isActive, activeStep, visibleInsts, onPreview,
}: {
  pattern:      DrumPattern;
  measure:      DrumMeasure;
  measureIdx:   number;
  canDelete:    boolean;
  isActive:     boolean;
  activeStep:   number;
  visibleInsts: DrumInstrument[];
  onPreview:    (inst: DrumInstrument) => void;
}) {
  const { deleteMeasure, clearMeasure, duplicateMeasure } = useDrumStore();
  const { settings } = useChordStore();
  const accent = ACCENT_COLORS[settings.accentColor];

  return (
    <div style={{
      marginBottom: 12,
      borderRadius: 16, overflow: 'hidden',
      background: 'var(--app-surface)',
      outline: isActive ? `1.5px solid ${accent.from}35` : 'none',
    }}>
      {/* Measure header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px 5px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isActive && (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent.from, boxShadow: `0 0 6px ${accent.from}` }} />
          )}
          <span style={{
            fontFamily: 'Manrope', fontWeight: 800, fontSize: 10,
            color: isActive ? accent.from : 'rgba(255,255,255,0.28)',
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            Measure {measureIdx + 1}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {([
            { icon: 'content_copy', action: () => duplicateMeasure(pattern.id, measure.id), danger: false },
            { icon: 'backspace',    action: () => clearMeasure(pattern.id, measure.id),     danger: false },
            ...(canDelete ? [{ icon: 'delete', action: () => deleteMeasure(pattern.id, measure.id), danger: true }] : []),
          ]).map(({ icon, action, danger }) => (
            <button
              key={icon} onClick={action}
              style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: danger ? '#f87171' : 'rgba(255,255,255,0.38)' }}>{icon}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Beat number header */}
      <div style={{ padding: '4px 10px 0' }}>
        <BeatHeader pattern={pattern} />

        {/* Instrument rows */}
        {visibleInsts.map(inst => (
          <InstrumentRow
            key={inst}
            pattern={pattern}
            measure={measure}
            instrument={inst}
            activeStep={isActive ? activeStep : -1}
            onPreview={onPreview}
          />
        ))}
      </div>

      {/* Separator row between measures (subtle) */}
      <div style={{ height: 4 }} />
    </div>
  );
}

// ── Pattern header controls ──────────────────────────────────────────────────
function PatternControls({ pattern, isPlaying, onPlay, onStop, accent }: {
  pattern:   DrumPattern;
  isPlaying: boolean;
  onPlay:    () => void;
  onStop:    () => void;
  accent:    { from: string; to: string };
}) {
  const { updatePattern } = useDrumStore();

  const TimeSigBtn = ({ n, d }: { n: number; d: number }) => {
    const isA = pattern.timeSignature[0] === n && pattern.timeSignature[1] === d;
    return (
      <button onClick={() => updatePattern(pattern.id, { timeSignature: [n, d] })} style={{
        padding: '4px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'Manrope', fontWeight: 700, fontSize: 10.5,
        background: isA ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.07)',
        color: isA ? '#fff' : 'rgba(255,255,255,0.42)', transition: 'all 130ms ease',
        boxShadow: isA ? `0 2px 10px ${accent.to}50` : 'none',
      }}>
        {n}/{d}
      </button>
    );
  };

  const SubBtn = ({ sub }: { sub: 8 | 16 }) => {
    const isA = pattern.subdivision === sub;
    return (
      <button onClick={() => updatePattern(pattern.id, { subdivision: sub })} style={{
        padding: '4px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'Manrope', fontWeight: 700, fontSize: 10.5,
        background: isA ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.07)',
        color: isA ? '#fff' : 'rgba(255,255,255,0.42)', transition: 'all 130ms ease',
        boxShadow: isA ? `0 2px 10px ${accent.to}50` : 'none',
      }}>
        {sub === 8 ? '1/8' : '1/16'}
      </button>
    );
  };

  return (
    <div style={{ padding: '8px 14px 8px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Play/Stop */}
      <button
        onClick={onPlay}
        style={{
          width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: isPlaying ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: isPlaying ? `0 3px 16px ${accent.to}60` : 'none',
          transition: 'all 150ms ease',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: isPlaying ? '#fff' : 'rgba(255,255,255,0.7)', fontVariationSettings: "'FILL' 1" }}>
          {isPlaying ? 'pause' : 'play_arrow'}
        </span>
      </button>
      {isPlaying && (
        <button onClick={onStop} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', fontVariationSettings: "'FILL' 1" }}>stop</span>
        </button>
      )}

      {/* BPM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <button onClick={() => updatePattern(pattern.id, { bpm: Math.max(20, pattern.bpm - 1) })}
          style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
        <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 13, color: 'var(--c-text-primary)', minWidth: 42, textAlign: 'center' }}>
          {pattern.bpm}<span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginLeft: 1 }}>BPM</span>
        </span>
        <button onClick={() => updatePattern(pattern.id, { bpm: Math.min(300, pattern.bpm + 1) })}
          style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>

      {/* Time sig */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <TimeSigBtn n={4} d={4} />
        <TimeSigBtn n={3} d={4} />
        <TimeSigBtn n={6} d={8} />
      </div>

      {/* Subdivision */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <SubBtn sub={8} />
        <SubBtn sub={16} />
      </div>
    </div>
  );
}

// ── Editor view (main drum machine grid) ────────────────────────────────────
function EditorView({
  pattern, activeMeasure, activeStep,
  isPlaying, onPlay, onStop,
  accent,
}: {
  pattern:      DrumPattern;
  activeMeasure: number;
  activeStep:   number;
  isPlaying:    boolean;
  onPlay:       () => void;
  onStop:       () => void;
  accent:       { from: string; to: string };
}) {
  const { addMeasure } = useDrumStore();
  const { soundMap, volumeMap, masterVolume } = useDrumStore();
  const [showExtra, setShowExtra] = useState(false);

  const visibleInsts: DrumInstrument[] = showExtra
    ? DRUM_INSTRUMENTS
    : CORE_INSTRUMENTS;

  const handlePreview = (inst: DrumInstrument) => {
    const soundId = soundMap[inst] ?? defaultSoundId(inst);
    const vol     = (volumeMap[inst] ?? 1) * masterVolume;
    drumScheduler.previewSound(soundId, vol);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Pattern controls */}
      <PatternControls
        pattern={pattern}
        isPlaying={isPlaying}
        onPlay={onPlay}
        onStop={onStop}
        accent={accent}
      />

      {/* Show/hide extra instruments */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 14px 2px', gap: 6 }}>
        <span style={{ flex: 1, fontFamily: 'Manrope', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Instruments
        </span>
        <button
          onClick={() => setShowExtra(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {showExtra ? 'expand_less' : 'expand_more'}
          </span>
          <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            {showExtra ? 'Less' : `+${EXTRA_INSTRUMENTS.length} more`}
          </span>
        </button>
      </div>

      {/* Scrollable measures */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px', paddingBottom: 110 }} className="no-scrollbar">
        {pattern.measures.map((measure, i) => (
          <MeasureView
            key={measure.id}
            pattern={pattern}
            measure={measure}
            measureIdx={i}
            canDelete={pattern.measures.length > 1}
            isActive={i === activeMeasure}
            activeStep={activeStep}
            visibleInsts={visibleInsts}
            onPreview={handlePreview}
          />
        ))}

        {/* Add measure */}
        <button
          onClick={() => addMeasure(pattern.id)}
          style={{
            width: '100%', padding: '11px', borderRadius: 14,
            border: '1.5px dashed rgba(255,255,255,0.09)',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'rgba(255,255,255,0.20)' }}>add</span>
          <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,0.20)', letterSpacing: '0.10em' }}>
            ADD MEASURE
          </span>
        </button>
      </div>
    </div>
  );
}

// ── Patterns view ────────────────────────────────────────────────────────────
function PatternsView({ accent }: { accent: { from: string; to: string } }) {
  const { patterns, activePatternId, setActivePattern, createPattern, deletePattern, duplicatePattern, renamePattern } = useDrumStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameVal, setNameVal]   = useState('');

  const commitRename = (id: string) => {
    if (nameVal.trim()) renamePattern(id, nameVal.trim());
    setRenaming(null);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', paddingBottom: 100 }} className="no-scrollbar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, color: 'var(--c-text-primary)', letterSpacing: '-0.03em' }}>Patterns</span>
        <button
          onClick={createPattern}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, border: 'none', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#fff' }}>add</span>
          <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: '#fff' }}>New Pattern</span>
        </button>
      </div>

      {patterns.map(p => {
        const isActive = p.id === activePatternId;
        return (
          <div key={p.id} style={{
            marginBottom: 8, borderRadius: 14, overflow: 'hidden',
            background: isActive ? `${accent.to}15` : 'var(--app-surface)',
            outline: isActive ? `1.5px solid ${accent.from}45` : 'none',
            transition: 'all 150ms ease',
          }}>
            <button
              onClick={() => setActivePattern(p.id)}
              style={{ width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              {renaming === p.id ? (
                <input
                  autoFocus value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onBlur={() => commitRename(p.id)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(p.id); if (e.key === 'Escape') setRenaming(null); }}
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: `1.5px solid ${accent.from}`, borderRadius: 6, padding: '3px 8px', color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, outline: 'none' }}
                />
              ) : (
                <div>
                  <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, color: isActive ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', display: 'block' }}>{p.name}</span>
                  <span style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 2, display: 'block' }}>
                    {p.bpm} BPM · {p.timeSignature[0]}/{p.timeSignature[1]} · {p.measures.length} measure{p.measures.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </button>
            <div style={{ display: 'flex', gap: 4, padding: '0 10px 10px' }}>
              {[
                { icon: 'edit',         label: 'Rename',    action: () => { setRenaming(p.id); setNameVal(p.name); } },
                { icon: 'content_copy', label: 'Duplicate', action: () => duplicatePattern(p.id) },
                { icon: 'delete',       label: 'Delete',    action: () => deletePattern(p.id), danger: true },
              ].map(btn => (
                <button
                  key={btn.icon} onClick={btn.action}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 7, background: (btn as { danger?: boolean }).danger ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12, color: (btn as { danger?: boolean }).danger ? '#f87171' : 'rgba(255,255,255,0.40)' }}>{btn.icon}</span>
                  <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, color: (btn as { danger?: boolean }).danger ? '#f87171' : 'rgba(255,255,255,0.40)' }}>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sound picker modal ───────────────────────────────────────────────────────
function SoundPicker({ instrument, currentSoundId, onClose, accent }: {
  instrument:    DrumInstrument;
  currentSoundId: string;
  onClose:       () => void;
  accent:        { from: string; to: string };
}) {
  const { setSoundForInstrument, masterVolume, volumeMap } = useDrumStore();
  const variants = SOUND_VARIANTS[instrument];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(6px)' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--app-surface-high, #1c1c24)', borderRadius: '20px 20px 0 0', padding: '16px 18px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)' }}>
            {INSTRUMENT_NAME[instrument]} Sounds
          </span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>close</span>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {variants.map(v => {
            const isSel = v.id === currentSoundId;
            return (
              <div
                key={v.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: isSel ? `${accent.to}20` : 'rgba(255,255,255,0.04)', outline: isSel ? `1.5px solid ${accent.from}60` : 'none', cursor: 'pointer', transition: 'all 130ms ease' }}
                onClick={() => setSoundForInstrument(instrument, v.id)}
              >
                <span style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 13, color: isSel ? 'var(--c-text-primary)' : 'var(--c-text-secondary)' }}>{v.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={e => { e.stopPropagation(); drumScheduler.previewSound(v.id, (volumeMap[instrument] ?? 1) * masterVolume); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>play_arrow</span>
                    <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Preview</span>
                  </button>
                  {isSel && <span className="material-symbols-outlined" style={{ fontSize: 16, color: accent.from }}>check_circle</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tools view ───────────────────────────────────────────────────────────────
function ToolsView({
  pattern, isPlaying, isLooping, onPlay, onStop, onToggleLoop, accent, sampleStatus, sampleLoaded, sampleTotal,
}: {
  pattern:      DrumPattern;
  isPlaying:    boolean;
  isLooping:    boolean;
  onPlay:       () => void;
  onStop:       () => void;
  onToggleLoop: () => void;
  accent:       { from: string; to: string };
  sampleStatus: SampleStatus;
  sampleLoaded: number;
  sampleTotal:  number;
}) {
  const { soundMap, volumeMap, masterVolume, setSoundForInstrument, setVolumeForInstrument, setMasterVolume } = useDrumStore();
  const [pickerInst, setPickerInst] = useState<DrumInstrument | null>(null);

  const card: React.CSSProperties = { background: 'var(--app-surface)', borderRadius: 16, overflow: 'hidden', marginBottom: 10 };
  const sectionTitle = (t: string) => (
    <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 10, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{t}</span>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', paddingBottom: 100 }} className="no-scrollbar">

      {/* Sample status */}
      {sampleStatus !== 'idle' && sampleStatus !== 'ready' && (
        <div style={card}>
          <div style={{ padding: '10px 14px' }}>
            <SampleBadge status={sampleStatus} loaded={sampleLoaded} total={sampleTotal} />
            {sampleStatus === 'failed' && (
              <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255,255,255,0.40)', marginTop: 6, lineHeight: 1.5 }}>
                Using high-quality synthesized drums. Real samples require an internet connection.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Playback */}
      <div style={card}>
        {sectionTitle('Playback')}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onPlay} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, boxShadow: `0 4px 20px ${accent.to}60`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#fff', fontVariationSettings: "'FILL' 1" }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>
          <button onClick={onStop} style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'rgba(255,255,255,0.65)', fontVariationSettings: "'FILL' 1" }}>stop</span>
          </button>
          <button onClick={onToggleLoop} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: '9999px', border: 'none', cursor: 'pointer', background: isLooping ? `${accent.to}22` : 'rgba(255,255,255,0.07)', outline: isLooping ? `1.5px solid ${accent.from}55` : 'none', transition: 'all 140ms ease' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: isLooping ? accent.from : 'rgba(255,255,255,0.40)' }}>repeat</span>
            <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: isLooping ? accent.from : 'rgba(255,255,255,0.40)' }}>Loop</span>
          </button>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 22, color: 'var(--c-text-primary)', letterSpacing: '-0.04em' }}>{pattern.bpm}</span>
            <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 3 }}>BPM</span>
          </div>
        </div>
      </div>

      {/* Master volume */}
      <div style={card}>
        {sectionTitle('Master Volume')}
        <div style={{ padding: '10px 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'rgba(255,255,255,0.40)', flexShrink: 0 }}>volume_up</span>
          <input
            type="range" min={0} max={1} step={0.01} value={masterVolume}
            onChange={e => { const v = parseFloat(e.target.value); setMasterVolume(v); drumScheduler.setMasterVolume(v); }}
            style={{ flex: 1, accentColor: accent.from }}
          />
          <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 12, color: 'rgba(255,255,255,0.50)', minWidth: 36, textAlign: 'right' }}>
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
      </div>

      {/* Mixer */}
      <div style={card}>
        {sectionTitle('Instruments')}
        <div style={{ padding: '4px 0' }}>
          {DRUM_INSTRUMENTS.map((inst, i) => {
            const color   = INSTRUMENT_COLOR[inst];
            const soundId = soundMap[inst] ?? defaultSoundId(inst);
            const vol     = volumeMap[inst] ?? 1;
            return (
              <div key={inst} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: i < DRUM_INSTRUMENTS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 62, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>{ROW_LABEL[inst]}</span>
                </div>
                <button
                  onClick={() => setPickerInst(inst)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', minWidth: 0 }}
                >
                  <span style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {soundVariantLabel(inst, soundId)}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(255,255,255,0.28)', flexShrink: 0 }}>chevron_right</span>
                </button>
                <input
                  type="range" min={0} max={1} step={0.01} value={vol}
                  onChange={e => setVolumeForInstrument(inst, parseFloat(e.target.value))}
                  style={{ width: 58, flexShrink: 0, accentColor: color }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {pickerInst && (
        <SoundPicker
          instrument={pickerInst}
          currentSoundId={soundMap[pickerInst] ?? defaultSoundId(pickerInst)}
          onClose={() => setPickerInst(null)}
          accent={accent}
        />
      )}
    </div>
  );
}

// ── Main DrumEditor ──────────────────────────────────────────────────────────
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
  const { patterns, activePatternId, setActivePattern, addMeasure, soundMap, volumeMap, masterVolume } = useDrumStore();
  const accent  = ACCENT_COLORS[settings.accentColor];
  const isLight = settings.theme === 'light' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [activeTab,     setActiveTab]     = useState<DrumTab>('editor');
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [isLooping,     setIsLooping]     = useState(true);
  const [activeMeasure, setActiveMeasure] = useState(0);
  const [activeStep,    setActiveStep]    = useState(-1);

  // Sample loading status
  const [sampleStatus, setSampleStatus] = useState<SampleStatus>('idle');
  const [sampleLoaded, setSampleLoaded] = useState(0);
  const [sampleTotal,  setSampleTotal]  = useState(0);

  // Register sample status listener once
  useEffect(() => {
    samplePool.onStatusChange = (s, ld, tot) => {
      setSampleStatus(s);
      setSampleLoaded(ld);
      setSampleTotal(tot);
    };
    return () => { samplePool.onStatusChange = null; };
  }, []);

  // Ensure active pattern
  useEffect(() => {
    if (!activePatternId && patterns.length > 0) setActivePattern(patterns[0].id);
  }, [activePatternId, patterns, setActivePattern]);

  const pattern = patterns.find(p => p.id === activePatternId) ?? patterns[0];

  // Scheduler step callback
  useEffect(() => {
    drumScheduler.onStep = (_gs, mIdx, sInM) => {
      setActiveMeasure(mIdx);
      setActiveStep(sInM);
    };
    return () => { drumScheduler.onStep = null; };
  }, []);

  // Keep scheduler in sync with live edits
  useEffect(() => {
    if (isPlaying && pattern) drumScheduler.updatePattern(pattern);
  }, [pattern, isPlaying]);

  // Stop on unmount
  useEffect(() => () => { drumScheduler.stop(); }, []);

  // Auto-add measure when last one gets its first hit
  const hitsKey = pattern?.measures.map(m => Object.values(m.hits).flat().length).join(',') ?? '';
  useEffect(() => {
    if (!pattern) return;
    const last = pattern.measures[pattern.measures.length - 1];
    if (last && measureHasHits(last)) addMeasure(pattern.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitsKey]);

  const handlePlay = () => {
    if (!pattern) return;
    // On first play: kick off sample loading
    if (sampleStatus === 'idle') loadDrumSamples();

    if (isPlaying) {
      drumScheduler.pause();
      setIsPlaying(false);
    } else {
      if (drumScheduler.isPlaying) {
        drumScheduler.resume(pattern, soundMap, volumeMap, masterVolume, isLooping);
      } else {
        drumScheduler.start(pattern, soundMap, volumeMap, masterVolume, isLooping);
      }
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    drumScheduler.stop();
    setIsPlaying(false);
    setActiveStep(-1);
    setActiveMeasure(0);
  };

  const handleToggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (isPlaying && pattern) {
      drumScheduler.pause();
      drumScheduler.resume(pattern, soundMap, volumeMap, masterVolume, next);
    }
  };

  if (!pattern) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--app-bg)', overflow: 'hidden' }}>
      <div style={{ paddingTop: 'env(safe-area-inset-top)', background: 'var(--app-bg)', flexShrink: 0 }} />

      {/* Top header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent.from, fontVariationSettings: "'FILL' 1" }}>album</span>
          <span style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: 18, color: 'var(--c-text-primary)', letterSpacing: '-0.03em' }}>
            {pattern.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SampleBadge status={sampleStatus} loaded={sampleLoaded} total={sampleTotal} />
          <button
            onClick={() => updateSettings({ appMode: 'chords' })}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>library_music</span>
            <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>Chordex</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'editor' && (
        <EditorView
          pattern={pattern}
          activeMeasure={isPlaying ? activeMeasure : -1}
          activeStep={isPlaying ? activeStep : -1}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onStop={handleStop}
          accent={accent}
        />
      )}
      {activeTab === 'patterns' && <PatternsView accent={accent} />}
      {activeTab === 'tools' && (
        <ToolsView
          pattern={pattern}
          isPlaying={isPlaying}
          isLooping={isLooping}
          onPlay={handlePlay}
          onStop={handleStop}
          onToggleLoop={handleToggleLoop}
          accent={accent}
          sampleStatus={sampleStatus}
          sampleLoaded={sampleLoaded}
          sampleTotal={sampleTotal}
        />
      )}

      <DrumBottomNav
        active={activeTab}
        onChange={setActiveTab}
        accent={accent}
        isLight={isLight}
      />
    </div>
  );
}

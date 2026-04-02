import { useCallback, useEffect, useRef, useState } from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import {
  useDrumStore,
  DRUM_INSTRUMENTS,
  INSTRUMENT_ABBR,
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
  SOUND_VARIANTS,
  defaultSoundId,
  soundVariantLabel,
} from '../lib/drumAudio';

// ── Constants ─────────────────────────────────────────────────
const LABEL_W = 44;
const CELL_H  = 30;

// ── Drum bottom nav ────────────────────────────────────────────
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
    { id: 'editor',   icon: 'grid_on',       label: 'Editor'   },
    { id: 'patterns', icon: 'queue_music',    label: 'Patterns' },
    { id: 'tools',    icon: 'tune',           label: 'Tools'    },
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

  const amoled  = useChordStore(s => s.settings.amoledMode);
  const bg = amoled
    ? 'rgba(4,4,4,0.92)'
    : isLight ? 'rgba(240,240,242,0.84)' : 'rgba(26,26,30,0.84)';

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
        border: `1px solid ${isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.10)'}`,
        boxShadow: isLight
          ? '0 8px 32px rgba(0,0,0,0.14)'
          : '0 12px 48px rgba(0,0,0,0.55)',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {pill.ready && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 4, left: pill.left, width: pill.width,
            height: 'calc(100% - 8px)',
            borderRadius: '9999px',
            background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            boxShadow: `0 2px 16px ${accent.to}60`,
            pointerEvents: 'none', zIndex: 0,
            transition: 'left 160ms cubic-bezier(0.34,1.56,0.64,1), width 160ms cubic-bezier(0.34,1.56,0.64,1)',
          }}
        />
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

// ── Beat ruler ─────────────────────────────────────────────────
function BeatRuler({ pattern }: { pattern: DrumPattern }) {
  const steps       = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];
  return (
    <div style={{ display: 'flex', height: 18, marginBottom: 2 }}>
      <div style={{ width: LABEL_W, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex' }}>
        {Array.from({ length: steps }, (_, i) => {
          const isBeat = i % stepsPerBeat === 0;
          const beatNum = Math.floor(i / stepsPerBeat) + 1;
          return (
            <div
              key={i}
              style={{
                flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                paddingBottom: 2,
                borderLeft: isBeat
                  ? '1.5px solid rgba(255,255,255,0.18)'
                  : (stepsPerBeat >= 4 && i % Math.floor(stepsPerBeat / 2) === 0)
                    ? '0.5px solid rgba(255,255,255,0.07)'
                    : 'none',
              }}
            >
              {isBeat && (
                <span style={{ fontSize: 8.5, fontFamily: 'Manrope', fontWeight: 800, color: 'rgba(255,255,255,0.32)', userSelect: 'none' }}>
                  {beatNum}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Drum row ───────────────────────────────────────────────────
interface RowProps {
  pattern: DrumPattern;
  measure: DrumMeasure;
  instrument: DrumInstrument;
  isLast: boolean;
  activeStep: number;
}

function DrumRow({ pattern, measure, instrument, isLast, activeStep }: RowProps) {
  const { toggleHit, setHitLength } = useDrumStore();
  const steps       = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];
  const hits         = measure.hits[instrument] ?? [];
  const color        = INSTRUMENT_COLOR[instrument];
  const rowRef  = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startStep: number } | null>(null);

  const stepAt = useCallback((clientX: number) => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(steps - 1, Math.floor((clientX - rect.left) / (rect.width / steps))));
  }, [steps]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const step = stepAt(e.clientX);
    const existing = hits.find(h => step >= h.step && step < h.step + h.length);
    if (existing) {
      toggleHit(pattern.id, measure.id, instrument, existing.step);
      dragRef.current = null;
    } else {
      toggleHit(pattern.id, measure.id, instrument, step);
      dragRef.current = { startStep: step };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const step = stepAt(e.clientX);
    if (step >= dragRef.current.startStep) {
      setHitLength(pattern.id, measure.id, instrument, dragRef.current.startStep, step - dragRef.current.startStep + 1);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: CELL_H, marginBottom: isLast ? 0 : 1 }}>
      <div style={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 9.5, fontFamily: 'Manrope, sans-serif', fontWeight: 800, color: 'rgba(255,255,255,0.50)', letterSpacing: '0.08em', userSelect: 'none' }}>
          {INSTRUMENT_ABBR[instrument]}
        </span>
      </div>

      <div
        ref={rowRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', cursor: 'pointer', userSelect: 'none', touchAction: 'none' }}
      >
        {/* Grid background cells */}
        {Array.from({ length: steps }, (_, i) => {
          const isBeat     = i % stepsPerBeat === 0;
          const isHalfBeat = stepsPerBeat >= 4 && i % Math.floor(stepsPerBeat / 2) === 0;
          const isActive   = i === activeStep;
          return (
            <div
              key={i}
              style={{
                flex: 1, height: '100%',
                background: isActive ? 'rgba(255,255,255,0.10)' : isBeat ? 'rgba(255,255,255,0.012)' : 'transparent',
                borderLeft: isBeat
                  ? '1.5px solid rgba(255,255,255,0.12)'
                  : isHalfBeat
                    ? '0.5px solid rgba(255,255,255,0.065)'
                    : '0.5px solid rgba(255,255,255,0.035)',
              }}
            />
          );
        })}

        {/* Playhead cursor */}
        {activeStep >= 0 && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: `${(activeStep / steps) * 100}%`,
              width: `${100 / steps}%`,
              top: 0, bottom: 0,
              background: 'rgba(255,255,255,0.08)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
        )}

        {/* Hit bars */}
        {hits.map(hit => {
          const isSingle = hit.length === 1;
          return (
            <div
              key={hit.step}
              style={{
                position: 'absolute',
                left: `${(hit.step / steps) * 100}%`,
                width: `${(hit.length / steps) * 100}%`,
                top: '50%', transform: 'translateY(-50%)',
                height: isSingle ? 16 : 14,
                borderRadius: isSingle ? '50%' : 7,
                background: color,
                boxShadow: `0 0 8px ${color}70`,
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Measure block ──────────────────────────────────────────────
interface MeasureBlockProps {
  pattern: DrumPattern;
  measure: DrumMeasure;
  index: number;
  canDelete: boolean;
  isActive: boolean;
  activeStep: number;
}

function MeasureBlock({ pattern, measure, index, canDelete, isActive, activeStep }: MeasureBlockProps) {
  const { deleteMeasure, clearMeasure, duplicateMeasure } = useDrumStore();
  const { settings } = useChordStore();
  const accent = ACCENT_COLORS[settings.accentColor];

  return (
    <div style={{
      marginBottom: 10,
      borderRadius: 16, overflow: 'hidden',
      background: 'var(--app-surface)',
      outline: isActive ? `1.5px solid ${accent.from}40` : 'none',
      transition: 'outline 120ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: 9.5, fontFamily: 'Manrope', fontWeight: 800, color: isActive ? accent.from : 'rgba(255,255,255,0.30)', letterSpacing: '0.18em', textTransform: 'uppercase', userSelect: 'none', transition: 'color 120ms ease' }}>
          {isActive ? '▶ ' : ''}Measure {index + 1}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[
            { icon: 'content_copy', action: () => duplicateMeasure(pattern.id, measure.id), color: 'rgba(255,255,255,0.35)' },
            { icon: 'backspace',    action: () => clearMeasure(pattern.id, measure.id),     color: 'rgba(255,255,255,0.35)' },
            ...(canDelete ? [{ icon: 'delete', action: () => deleteMeasure(pattern.id, measure.id), color: '#f87171' }] : []),
          ].map(({ icon, action, color }) => (
            <button
              key={icon}
              onClick={action}
              style={{ width: 25, height: 25, borderRadius: '50%', background: 'rgba(255,255,255,0.055)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12, color }}>{icon}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '4px 10px 8px' }}>
        <BeatRuler pattern={pattern} />
        {DRUM_INSTRUMENTS.map((inst, i) => (
          <DrumRow
            key={inst}
            pattern={pattern}
            measure={measure}
            instrument={inst}
            isLast={i === DRUM_INSTRUMENTS.length - 1}
            activeStep={isActive ? activeStep : -1}
          />
        ))}
      </div>
    </div>
  );
}

// ── Pattern controls (compact header row) ─────────────────────
function PatternControls({ pattern }: { pattern: DrumPattern }) {
  const { updatePattern, renamePattern } = useDrumStore();
  const { settings } = useChordStore();
  const accent = ACCENT_COLORS[settings.accentColor];
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal]   = useState(pattern.name);

  useEffect(() => setNameVal(pattern.name), [pattern.name]);

  const commitName = () => {
    if (nameVal.trim()) renamePattern(pattern.id, nameVal.trim());
    else setNameVal(pattern.name);
    setEditName(false);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px 8px', flexWrap: 'wrap' }}>
      {/* Pattern name */}
      {editName ? (
        <input
          autoFocus value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameVal(pattern.name); setEditName(false); } }}
          style={{ flex: 1, minWidth: 70, maxWidth: 140, background: 'rgba(255,255,255,0.08)', border: `1.5px solid ${accent.from}`, borderRadius: 8, padding: '3px 8px', color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 14, outline: 'none' }}
        />
      ) : (
        <button onClick={() => setEditName(true)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', letterSpacing: '-0.02em', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pattern.name}
          </span>
        </button>
      )}

      {/* BPM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <BpmButton label="−" onClick={() => updatePattern(pattern.id, { bpm: Math.max(20, pattern.bpm - 1) })} />
        <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 13, color: 'var(--c-text-primary)', minWidth: 36, textAlign: 'center' }}>
          {pattern.bpm}<span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginLeft: 1 }}>BPM</span>
        </span>
        <BpmButton label="+" onClick={() => updatePattern(pattern.id, { bpm: Math.min(300, pattern.bpm + 1) })} />
      </div>

      {/* Time sig */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {([[4,4],[3,4],[6,8],[2,4]] as [number,number][]).map(([n,d]) => {
          const isA = pattern.timeSignature[0] === n && pattern.timeSignature[1] === d;
          return (
            <Pill key={`${n}/${d}`} active={isA} accent={accent} onClick={() => updatePattern(pattern.id, { timeSignature: [n,d] })}>
              {n}/{d}
            </Pill>
          );
        })}
      </div>

      {/* Subdivision */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {([8,16] as const).map(sub => (
          <Pill key={sub} active={pattern.subdivision === sub} accent={accent} onClick={() => updatePattern(pattern.id, { subdivision: sub })}>
            1/{sub}
          </Pill>
        ))}
      </div>
    </div>
  );
}

function BpmButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {label}
    </button>
  );
}

function Pill({ children, active, accent, onClick }: { children: React.ReactNode; active: boolean; accent: { from: string; to: string }; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '3px 7px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'Manrope', fontWeight: 700, fontSize: 10.5, background: active ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.07)', color: active ? '#fff' : 'rgba(255,255,255,0.45)', transition: 'all 140ms ease', boxShadow: active ? `0 2px 8px ${accent.to}50` : 'none' }}>
      {children}
    </button>
  );
}

// ── Editor view ────────────────────────────────────────────────
function EditorView({ pattern, activeMeasure, activeStep, onAddMeasure }: {
  pattern: DrumPattern;
  activeMeasure: number;
  activeStep: number;
  onAddMeasure: () => void;
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', paddingBottom: 100 }} className="no-scrollbar">
      {pattern.measures.map((measure, i) => (
        <MeasureBlock
          key={measure.id}
          pattern={pattern}
          measure={measure}
          index={i}
          canDelete={pattern.measures.length > 1}
          isActive={i === activeMeasure}
          activeStep={activeStep}
        />
      ))}
      <button
        onClick={onAddMeasure}
        style={{ width: '100%', padding: '11px', borderRadius: 14, border: '1.5px dashed rgba(255,255,255,0.10)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'rgba(255,255,255,0.22)' }}>add</span>
        <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.10em' }}>ADD MEASURE</span>
      </button>
    </div>
  );
}

// ── Patterns view ──────────────────────────────────────────────
function PatternsView({ accent }: { accent: { from: string; to: string } }) {
  const { patterns, activePatternId, setActivePattern, createPattern, deletePattern, duplicatePattern } = useDrumStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameVal, setNameVal]   = useState('');
  const { renamePattern } = useDrumStore();

  const commitRename = (id: string) => {
    if (nameVal.trim()) renamePattern(id, nameVal.trim());
    setRenaming(null);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', paddingBottom: 100 }} className="no-scrollbar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, color: 'var(--c-text-primary)', letterSpacing: '-0.03em' }}>Patterns</span>
        <button
          onClick={createPattern}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: '9999px', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, border: 'none', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#fff' }}>add</span>
          <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: '#fff' }}>New</span>
        </button>
      </div>

      {patterns.map(p => {
        const isActive = p.id === activePatternId;
        return (
          <div
            key={p.id}
            style={{
              marginBottom: 8, borderRadius: 14, overflow: 'hidden',
              background: isActive ? `${accent.to}18` : 'var(--app-surface)',
              outline: isActive ? `1.5px solid ${accent.from}50` : 'none',
              transition: 'all 150ms ease',
            }}
          >
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
                  <span style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, display: 'block' }}>
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
                  key={btn.icon}
                  onClick={btn.action}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 7, background: btn.danger ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12, color: btn.danger ? '#f87171' : 'rgba(255,255,255,0.4)' }}>{btn.icon}</span>
                  <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, color: btn.danger ? '#f87171' : 'rgba(255,255,255,0.4)' }}>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Sound picker modal ─────────────────────────────────────────
function SoundPicker({ instrument, currentSoundId, onClose, accent }: {
  instrument: DrumInstrument;
  currentSoundId: string;
  onClose: () => void;
  accent: { from: string; to: string };
}) {
  const { setSoundForInstrument, masterVolume, volumeMap } = useDrumStore();
  const variants = SOUND_VARIANTS[instrument];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', background: 'var(--app-surface-high, #1c1c24)', borderRadius: '20px 20px 0 0', padding: '16px 18px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
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
            const isSelected = v.id === currentSoundId;
            return (
              <div
                key={v.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: isSelected ? `${accent.to}20` : 'rgba(255,255,255,0.04)', outline: isSelected ? `1.5px solid ${accent.from}60` : 'none', transition: 'all 140ms ease', cursor: 'pointer' }}
                onClick={() => setSoundForInstrument(instrument, v.id)}
              >
                <span style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 13, color: isSelected ? 'var(--c-text-primary)' : 'var(--c-text-secondary)' }}>{v.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={e => { e.stopPropagation(); drumScheduler.previewSound(v.id, (volumeMap[instrument] ?? 1) * masterVolume); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>play_arrow</span>
                    <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Preview</span>
                  </button>
                  {isSelected && <span className="material-symbols-outlined" style={{ fontSize: 16, color: accent.from }}>check_circle</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Tools view ─────────────────────────────────────────────────
function ToolsView({
  pattern, isPlaying, isLooping, onPlay, onStop, onToggleLoop, accent,
}: {
  pattern: DrumPattern;
  isPlaying: boolean;
  isLooping: boolean;
  onPlay: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  accent: { from: string; to: string };
}) {
  const { soundMap, volumeMap, masterVolume, setSoundForInstrument, setVolumeForInstrument, setMasterVolume } = useDrumStore();
  const [pickerInst, setPickerInst] = useState<DrumInstrument | null>(null);

  const card: React.CSSProperties = { background: 'var(--app-surface)', borderRadius: 16, overflow: 'hidden', marginBottom: 10 };
  const sectionTitle = (t: string) => (
    <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{t}</span>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', paddingBottom: 100 }} className="no-scrollbar">

      {/* Playback */}
      <div style={card}>
        {sectionTitle('Playback')}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onPlay}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, boxShadow: `0 4px 20px ${accent.to}60`, flexShrink: 0 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#fff', fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button
            onClick={onStop}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'rgba(255,255,255,0.65)', fontVariationSettings: "'FILL' 1" }}>stop</span>
          </button>

          <button
            onClick={onToggleLoop}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: '9999px', border: 'none', cursor: 'pointer', background: isLooping ? `${accent.to}25` : 'rgba(255,255,255,0.07)', outline: isLooping ? `1.5px solid ${accent.from}60` : 'none', transition: 'all 140ms ease' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: isLooping ? accent.from : 'rgba(255,255,255,0.4)' }}>repeat</span>
            <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, color: isLooping ? accent.from : 'rgba(255,255,255,0.4)' }}>Loop</span>
          </button>

          <div style={{ flex: 1, textAlign: 'right' }}>
            <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 20, color: 'var(--c-text-primary)', letterSpacing: '-0.03em' }}>{pattern.bpm}</span>
            <span style={{ fontFamily: 'Inter', fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 3 }}>BPM</span>
          </div>
        </div>
      </div>

      {/* Master volume */}
      <div style={card}>
        {sectionTitle('Master Volume')}
        <div style={{ padding: '10px 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>volume_up</span>
          <input
            type="range" min={0} max={1} step={0.01} value={masterVolume}
            onChange={e => { const v = parseFloat(e.target.value); setMasterVolume(v); drumScheduler.setMasterVolume(v); }}
            style={{ flex: 1, accentColor: accent.from }}
          />
          <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 34, textAlign: 'right' }}>
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
      </div>

      {/* Instrument mixer */}
      <div style={card}>
        {sectionTitle('Instrument Mix & Sounds')}
        <div style={{ padding: '4px 0' }}>
          {DRUM_INSTRUMENTS.map((inst, i) => {
            const color   = INSTRUMENT_COLOR[inst];
            const soundId = soundMap[inst] ?? defaultSoundId(inst);
            const vol     = volumeMap[inst] ?? 1;
            return (
              <div key={inst} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: i < DRUM_INSTRUMENTS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                {/* Color dot + abbr */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 44, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em' }}>{INSTRUMENT_ABBR[inst]}</span>
                </div>

                {/* Sound selector */}
                <button
                  onClick={() => setPickerInst(inst)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', minWidth: 0 }}
                >
                  <span style={{ fontFamily: 'Inter', fontSize: 11, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {soundVariantLabel(inst, soundId)}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>chevron_right</span>
                </button>

                {/* Volume slider */}
                <input
                  type="range" min={0} max={1} step={0.01} value={vol}
                  onChange={e => setVolumeForInstrument(inst, parseFloat(e.target.value))}
                  style={{ width: 60, flexShrink: 0, accentColor: color }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sound picker modal */}
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

// ── Main DrumEditor ────────────────────────────────────────────
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
  const { patterns, activePatternId, setActivePattern, addMeasure, soundMap, volumeMap, masterVolume } = useDrumStore();
  const accent  = ACCENT_COLORS[settings.accentColor];
  const isLight = settings.theme === 'light' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const [activeTab, setActiveTab]       = useState<DrumTab>('editor');
  const [isPlaying, setIsPlaying]       = useState(false);
  const [isLooping, setIsLooping]       = useState(true);
  const [activeMeasure, setActiveMeasure] = useState(0);
  const [activeStep, setActiveStep]     = useState(-1);

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

  // Keep scheduler in sync with pattern changes during playback
  useEffect(() => {
    if (isPlaying && pattern) drumScheduler.updatePattern(pattern);
  }, [pattern, isPlaying]);

  // Stop on unmount
  useEffect(() => () => { drumScheduler.stop(); }, []);

  // Auto-add measure when last one gets its first hit
  useEffect(() => {
    if (!pattern) return;
    const last = pattern.measures[pattern.measures.length - 1];
    if (last && measureHasHits(last)) addMeasure(pattern.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern?.measures.map(m => Object.values(m.hits).flat().length).join(',')]);

  const handlePlay = () => {
    if (!pattern) return;
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
      {/* Safe area */}
      <div style={{ paddingTop: 'env(safe-area-inset-top)', background: 'var(--app-bg)', flexShrink: 0 }} />

      {/* Top header */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent.from, fontVariationSettings: "'FILL' 1" }}>album</span>
            <span style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: 18, color: 'var(--c-text-primary)', letterSpacing: '-0.03em' }}>Drums</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Mini playback in header */}
            {activeTab === 'editor' && (
              <>
                <button
                  onClick={handlePlay}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer', background: isPlaying ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isPlaying ? `0 2px 12px ${accent.to}50` : 'none', transition: 'all 150ms ease' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: isPlaying ? '#fff' : 'rgba(255,255,255,0.65)', fontVariationSettings: "'FILL' 1" }}>
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                {isPlaying && (
                  <button
                    onClick={handleStop}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', fontVariationSettings: "'FILL' 1" }}>stop</span>
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => updateSettings({ appMode: 'chords' })}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 11px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>library_music</span>
              <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: 10.5, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em' }}>Chordex</span>
            </button>
          </div>
        </div>

        {/* Pattern controls (shown only in editor tab) */}
        {activeTab === 'editor' && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <PatternControls pattern={pattern} />
          </div>
        )}
      </div>

      {/* Content area */}
      {activeTab === 'editor' && (
        <EditorView
          pattern={pattern}
          activeMeasure={isPlaying ? activeMeasure : -1}
          activeStep={isPlaying ? activeStep : -1}
          onAddMeasure={() => addMeasure(pattern.id)}
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
        />
      )}

      {/* Bottom nav */}
      <DrumBottomNav
        active={activeTab}
        onChange={setActiveTab}
        accent={accent}
        isLight={isLight}
      />
    </div>
  );
}

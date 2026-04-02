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

const LABEL_W  = 44;
const CELL_H   = 30;
const ROW_GAP  = 1;

/* ── Beat ruler row ──────────────────────────────────────────── */
function BeatRuler({ pattern }: { pattern: DrumPattern }) {
  const steps       = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 20, marginBottom: 3 }}>
      <div style={{ width: LABEL_W, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', position: 'relative', height: '100%' }}>
        {Array.from({ length: steps }, (_, i) => {
          const isBeat = i % stepsPerBeat === 0;
          const beatNum = Math.floor(i / stepsPerBeat) + 1;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: 2,
                borderLeft: isBeat
                  ? '1.5px solid rgba(255,255,255,0.20)'
                  : i % (stepsPerBeat / 2 | 0) === 0
                    ? '0.5px solid rgba(255,255,255,0.08)'
                    : 'none',
              }}
            >
              {isBeat && (
                <span style={{
                  fontSize: 9,
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '0.05em',
                  userSelect: 'none',
                }}>
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

/* ── Drum row ────────────────────────────────────────────────── */
interface DrumRowProps {
  pattern: DrumPattern;
  measure: DrumMeasure;
  instrument: DrumInstrument;
  isLast: boolean;
}

function DrumRow({ pattern, measure, instrument, isLast }: DrumRowProps) {
  const { toggleHit, setHitLength } = useDrumStore();
  const { settings } = useChordStore();
  const accent = ACCENT_COLORS[settings.accentColor];

  const steps       = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];
  const hits         = measure.hits[instrument] ?? [];
  const color        = INSTRUMENT_COLOR[instrument];
  const dragRef = useRef<{ startStep: number } | null>(null);
  const rowRef  = useRef<HTMLDivElement>(null);

  const stepAtX = useCallback((clientX: number): number => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cellWidth = rect.width / steps;
    return Math.max(0, Math.min(steps - 1, Math.floor((clientX - rect.left) / cellWidth)));
  }, [steps]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const step = stepAtX(e.clientX);
    const existing = hits.find(h => step >= h.step && step < h.step + h.length);
    if (existing) {
      toggleHit(pattern.id, measure.id, instrument, existing.step);
      dragRef.current = null;
    } else {
      toggleHit(pattern.id, measure.id, instrument, step);
      dragRef.current = { startStep: step };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const step = stepAtX(e.clientX);
    if (step >= dragRef.current.startStep) {
      setHitLength(pattern.id, measure.id, instrument, dragRef.current.startStep, step - dragRef.current.startStep + 1);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: CELL_H, marginBottom: isLast ? 0 : ROW_GAP }}>
      {/* Instrument label */}
      <div style={{
        width: LABEL_W,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}>
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{
          fontSize: 9.5,
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.08em',
          userSelect: 'none',
        }}>
          {INSTRUMENT_ABBR[instrument]}
        </span>
      </div>

      {/* Grid area */}
      <div
        ref={rowRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          flex: 1,
          position: 'relative',
          height: '100%',
          display: 'flex',
          cursor: 'pointer',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* Background cells (grid lines) */}
        {Array.from({ length: steps }, (_, i) => {
          const isBeat     = i % stepsPerBeat === 0;
          const isHalfBeat = stepsPerBeat >= 4 && i % (stepsPerBeat / 2) === 0;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: '100%',
                borderLeft: isBeat
                  ? '1.5px solid rgba(255,255,255,0.13)'
                  : isHalfBeat
                    ? '0.5px solid rgba(255,255,255,0.07)'
                    : '0.5px solid rgba(255,255,255,0.04)',
                background: isBeat
                  ? 'rgba(255,255,255,0.015)'
                  : 'transparent',
              }}
            />
          );
        })}

        {/* Hits */}
        {hits.map(hit => {
          const leftPct  = (hit.step / steps) * 100;
          const widthPct = (hit.length / steps) * 100;
          const isSingle = hit.length === 1;
          return (
            <div
              key={hit.step}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                top: '50%',
                transform: 'translateY(-50%)',
                height: isSingle ? 16 : 14,
                borderRadius: isSingle ? '50%' : '6px',
                background: color,
                boxShadow: `0 0 8px ${color}80`,
                pointerEvents: 'none',
                padding: isSingle ? 0 : '0 2px',
                boxSizing: 'border-box',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Measure block ───────────────────────────────────────────── */
interface MeasureBlockProps {
  pattern: DrumPattern;
  measure: DrumMeasure;
  index: number;
  canDelete: boolean;
  accent: { from: string; to: string };
}

function MeasureBlock({ pattern, measure, index, canDelete, accent }: MeasureBlockProps) {
  const { deleteMeasure, clearMeasure, duplicateMeasure } = useDrumStore();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div style={{
      marginBottom: 12,
      borderRadius: 16,
      overflow: 'hidden',
      background: 'var(--app-surface)',
    }}>
      {/* Measure header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px 6px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{
          fontSize: 10,
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}>
          Measure {index + 1}
        </span>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => duplicateMeasure(pattern.id, measure.id)}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
            title="Duplicate measure"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>content_copy</span>
          </button>
          <button
            onClick={() => clearMeasure(pattern.id, measure.id)}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: 'none', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
            title="Clear measure"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>backspace</span>
          </button>
          {canDelete && (
            <button
              onClick={() => deleteMeasure(pattern.id, measure.id)}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(248,113,113,0.10)',
                border: 'none', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
              title="Delete measure"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#f87171' }}>delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Beat ruler */}
      <div style={{ padding: '4px 10px 0' }}>
        <BeatRuler pattern={pattern} />

        {/* Instrument rows */}
        {DRUM_INSTRUMENTS.map((inst, i) => (
          <DrumRow
            key={inst}
            pattern={pattern}
            measure={measure}
            instrument={inst}
            isLast={i === DRUM_INSTRUMENTS.length - 1}
          />
        ))}
      </div>

      {/* Bottom padding */}
      <div style={{ height: 8 }} />
    </div>
  );
}

/* ── Pattern controls bar ────────────────────────────────────── */
function PatternControls({ pattern, accent }: { pattern: DrumPattern; accent: { from: string; to: string } }) {
  const { updatePattern, renamePattern } = useDrumStore();
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmText, setBpmText] = useState(String(pattern.bpm));
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState(pattern.name);

  useEffect(() => { setBpmText(String(pattern.bpm)); }, [pattern.bpm]);
  useEffect(() => { setNameText(pattern.name); }, [pattern.name]);

  const commitBpm = () => {
    const v = parseInt(bpmText, 10);
    if (!isNaN(v) && v >= 20 && v <= 300) updatePattern(pattern.id, { bpm: v });
    else setBpmText(String(pattern.bpm));
    setEditingBpm(false);
  };

  const commitName = () => {
    if (nameText.trim()) renamePattern(pattern.id, nameText.trim());
    else setNameText(pattern.name);
    setEditingName(false);
  };

  const TIME_SIGS: [number, number][] = [[4, 4], [3, 4], [6, 8], [2, 4]];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexWrap: 'wrap',
    }}>
      {/* Pattern name */}
      {editingName ? (
        <input
          autoFocus
          value={nameText}
          onChange={e => setNameText(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameText(pattern.name); setEditingName(false); } }}
          style={{
            flex: 1, minWidth: 80, maxWidth: 160,
            background: 'rgba(255,255,255,0.08)',
            border: `1.5px solid ${accent.from}`,
            borderRadius: 8, padding: '4px 8px',
            color: 'var(--c-text-primary)',
            fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14,
            outline: 'none',
          }}
        />
      ) : (
        <button
          onClick={() => setEditingName(true)}
          style={{
            flex: 1, minWidth: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left', padding: 0,
          }}
        >
          <span style={{
            fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 15,
            color: 'var(--c-text-primary)', letterSpacing: '-0.02em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            display: 'block',
          }}>
            {pattern.name}
          </span>
        </button>
      )}

      {/* BPM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <button
          onClick={() => updatePattern(pattern.id, { bpm: Math.max(20, pattern.bpm - 1) })}
          style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >−</button>

        {editingBpm ? (
          <input
            autoFocus
            value={bpmText}
            onChange={e => setBpmText(e.target.value)}
            onBlur={commitBpm}
            onKeyDown={e => { if (e.key === 'Enter') commitBpm(); if (e.key === 'Escape') { setBpmText(String(pattern.bpm)); setEditingBpm(false); } }}
            style={{
              width: 44, textAlign: 'center',
              background: 'rgba(255,255,255,0.08)',
              border: `1.5px solid ${accent.from}`,
              borderRadius: 6, padding: '3px 4px',
              color: 'var(--c-text-primary)',
              fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 12,
              outline: 'none',
            }}
          />
        ) : (
          <button
            onClick={() => setEditingBpm(true)}
            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, padding: '3px 6px', cursor: 'pointer' }}
          >
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 12, color: 'var(--c-text-primary)' }}>
              {pattern.bpm}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 2, fontFamily: 'Inter, sans-serif' }}>BPM</span>
          </button>
        )}

        <button
          onClick={() => updatePattern(pattern.id, { bpm: Math.min(300, pattern.bpm + 1) })}
          style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >+</button>
      </div>

      {/* Time signature */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {TIME_SIGS.map(([n, d]) => {
          const isActive = pattern.timeSignature[0] === n && pattern.timeSignature[1] === d;
          return (
            <button
              key={`${n}/${d}`}
              onClick={() => updatePattern(pattern.id, { timeSignature: [n, d] })}
              style={{
                padding: '3px 7px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 11,
                background: isActive ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.07)',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 150ms ease',
              }}
            >{n}/{d}</button>
          );
        })}
      </div>

      {/* Subdivision */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {([8, 16] as const).map(sub => {
          const isActive = pattern.subdivision === sub;
          return (
            <button
              key={sub}
              onClick={() => updatePattern(pattern.id, { subdivision: sub })}
              style={{
                padding: '3px 7px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 11,
                background: isActive ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.07)',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 150ms ease',
              }}
            >1/{sub}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Pattern tabs ────────────────────────────────────────────── */
function PatternTabs({ accent }: { accent: { from: string; to: string } }) {
  const { patterns, activePatternId, setActivePattern, createPattern, deletePattern } = useDrumStore();
  const tabsRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px 0', overflowX: 'auto' }} className="no-scrollbar">
      <div ref={tabsRef} style={{ display: 'flex', gap: 6, flex: 1 }}>
        {patterns.map(p => {
          const isActive = p.id === activePatternId;
          return (
            <button
              key={p.id}
              onClick={() => setActivePattern(p.id)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                background: isActive ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.08)',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 150ms ease',
                boxShadow: isActive ? `0 2px 10px ${accent.to}50` : 'none',
              }}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      <button
        onClick={createPattern}
        style={{
          flexShrink: 0,
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="New pattern"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>add</span>
      </button>
    </div>
  );
}

/* ── Legend ──────────────────────────────────────────────────── */
function InstrumentLegend() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ margin: '0 16px 12px' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        <span style={{ fontSize: 10, fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Key {expanded ? '▲' : '▼'}
        </span>
      </button>
      {expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 6 }}>
          {DRUM_INSTRUMENTS.map(inst => (
            <div key={inst} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: INSTRUMENT_COLOR[inst] }} />
              <span style={{ fontSize: 10, fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.4)' }}>
                {INSTRUMENT_ABBR[inst]} = {INSTRUMENT_NAME[inst]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main DrumEditor ─────────────────────────────────────────── */
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
  const { patterns, activePatternId, setActivePattern, addMeasure } = useDrumStore();
  const accent = ACCENT_COLORS[settings.accentColor];
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ensure an active pattern
  useEffect(() => {
    if (!activePatternId && patterns.length > 0) {
      setActivePattern(patterns[0].id);
    }
  }, [activePatternId, patterns, setActivePattern]);

  const pattern = patterns.find(p => p.id === activePatternId) ?? patterns[0];

  // Auto-add a new empty measure when the last one gets its first hit
  useEffect(() => {
    if (!pattern) return;
    const last = pattern.measures[pattern.measures.length - 1];
    if (last && measureHasHits(last)) {
      addMeasure(pattern.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern?.measures.map(m => Object.values(m.hits).flat().length).join(',')]);

  if (!pattern) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', background: 'var(--app-bg)',
      overflow: 'hidden',
    }}>
      {/* Safe area top */}
      <div style={{ paddingTop: 'env(safe-area-inset-top)', background: 'var(--app-bg)', flexShrink: 0 }} />

      {/* Header */}
      <div style={{ flexShrink: 0, background: 'var(--app-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 6px' }}>
          {/* Logo + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: accent.from, fontVariationSettings: "'FILL' 1" }}>
              album
            </span>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: 18, color: 'var(--c-text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              Drums
            </h1>
          </div>

          {/* Back to Chordex */}
          <button
            onClick={() => updateSettings({ appMode: 'chords' })}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: '9999px',
              background: 'rgba(255,255,255,0.08)',
              border: 'none', cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>library_music</span>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.02em' }}>
              Chordex
            </span>
          </button>
        </div>

        {/* Pattern tabs */}
        <PatternTabs accent={accent} />

        {/* Pattern controls */}
        <div style={{ marginTop: 6 }}>
          <PatternControls pattern={pattern} accent={accent} />
        </div>
      </div>

      {/* Scrollable grid */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 16px',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        }}
        className="no-scrollbar"
      >
        <InstrumentLegend />

        {pattern.measures.map((measure, i) => (
          <MeasureBlock
            key={measure.id}
            pattern={pattern}
            measure={measure}
            index={i}
            canDelete={pattern.measures.length > 1}
            accent={accent}
          />
        ))}

        {/* Add measure button */}
        <button
          onClick={() => addMeasure(pattern.id)}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 16,
            border: `1.5px dashed rgba(255,255,255,0.12)`,
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'rgba(255,255,255,0.25)' }}>add</span>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 12, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>
            ADD MEASURE
          </span>
        </button>
      </div>
    </div>
  );
}

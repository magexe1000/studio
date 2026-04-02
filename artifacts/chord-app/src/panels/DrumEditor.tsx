import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import {
  useDrumStore, DRUM_INSTRUMENTS, INSTRUMENT_NAME, INSTRUMENT_COLOR,
  stepsPerMeasure,
  type DrumInstrument, type DrumPattern, type KitType,
} from '../store/useDrumStore';
import {
  drumScheduler, samplePool, loadDrumSamples, KIT_DEFAULTS,
  type SampleStatus,
} from '../lib/drumAudio';

// ── Layout constants ─────────────────────────────────────────────────────────
const ROW_H   = 40;   // px per instrument row
const LABEL_W = 68;   // px for fixed instrument-name column
const HDR_H   = 24;   // px for measure/beat header
const BAR_H   = 50;   // px for top header bar
const BTM_H   = 52;   // px for bottom bar

const cellW = (sub: 8 | 16) => (sub === 16 ? 20 : 28);

const KIT_ICONS: Record<KitType, string> = {
  acoustic:   '🥁',
  advanced:   '🎶',
  electronic: '⚡',
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
        position: 'fixed', inset: 0, zIndex: 100,
        background: vis ? 'rgba(0,0,0,0.60)' : 'rgba(0,0,0,0)',
        transition: 'background 280ms',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{
        width: '100%',
        background: '#18181b',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        padding: '10px 0 32px',
        transform: vis ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 330ms cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -10px 48px rgba(0,0,0,0.7)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#3f3f46', margin: '0 auto 16px' }} />

        <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 4px 22px' }}>
          Please select your instrument
        </p>
        <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 18px 22px' }}>
          Each kit has a distinct sound character
        </p>

        {KITS.map(kit => (
          <button
            key={kit}
            onClick={() => onSelect(kit)}
            style={{
              display: 'flex', alignItems: 'center', gap: 18,
              width: '100%', padding: '17px 22px',
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', transition: 'background 120ms',
            }}
          >
            <span style={{ fontSize: 38, lineHeight: 1 }}>{KIT_ICONS[kit]}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 600 }}>
                {KIT_DEFAULTS[kit].label}
              </p>
              <p style={{ margin: '3px 0 0', color: '#71717a', fontSize: 13 }}>
                {KIT_DEFAULTS[kit].description}
              </p>
            </div>
            {kit === 'electronic' && (
              <span style={{
                background: accent.from, color: '#000',
                fontSize: 10, fontWeight: 800, padding: '2px 7px',
                borderRadius: 4, letterSpacing: 1, flexShrink: 0,
              }}>PRO</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── InstrumentPaletteSheet ───────────────────────────────────────────────────
function InstrumentPaletteSheet({
  activeInstruments, kitType, accent,
  onToggle, onKitChange, onClose,
}: {
  activeInstruments: DrumInstrument[];
  kitType: KitType | null;
  accent: { from: string; to: string };
  onToggle: (i: DrumInstrument) => void;
  onKitChange: () => void;
  onClose: () => void;
}) {
  const [vis, setVis] = useState(false);
  useEffect(() => { const id = setTimeout(() => setVis(true), 10); return () => clearTimeout(id); }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative', zIndex: 1, pointerEvents: 'auto',
        background: '#18181b',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: '10px 16px 28px',
        boxShadow: '0 -6px 36px rgba(0,0,0,0.55)',
        transform: vis ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#3f3f46', margin: '2px auto 14px' }} />

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700, flex: 1 }}>Instruments</span>
          {kitType && (
            <button
              onClick={onKitChange}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#27272a', border: `1px solid ${accent.from}55`,
                borderRadius: 20, padding: '5px 13px',
                color: accent.from, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15 }}>{KIT_ICONS[kitType]}</span>
              {KIT_DEFAULTS[kitType].label}
            </button>
          )}
        </div>

        {/* 5-column instrument grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {DRUM_INSTRUMENTS.map(inst => {
            const on    = activeInstruments.includes(inst);
            const color = INSTRUMENT_COLOR[inst];
            return (
              <button
                key={inst}
                onClick={() => onToggle(inst)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '11px 4px 9px', borderRadius: 12,
                  border: on ? `2px solid ${color}` : '2px solid #3f3f46',
                  background: on ? `${color}1a` : '#27272a',
                  cursor: 'pointer', transition: 'all 140ms',
                }}
              >
                <div style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: on ? color : '#52525b', marginBottom: 7,
                  boxShadow: on ? `0 0 8px ${color}99` : 'none',
                  transition: 'all 140ms',
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 600, textAlign: 'center', lineHeight: 1.2,
                  color: on ? color : '#71717a',
                }}>
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

// ── PianoRollGrid ────────────────────────────────────────────────────────────
function PianoRollGrid({
  pattern, activeInstruments, activeGlobalStep, onToggleHit, accent,
}: {
  pattern: DrumPattern;
  activeInstruments: DrumInstrument[];
  activeGlobalStep: number;
  onToggleHit: (inst: DrumInstrument, mIdx: number, step: number) => void;
  accent: { from: string; to: string };
}) {
  const scrollRef   = useRef<HTMLDivElement>(null);
  const dragging    = useRef(false);
  const lastKey     = useRef('');
  const cw          = cellW(pattern.subdivision);
  const spm         = stepsPerMeasure(pattern);
  const totalSteps  = spm * pattern.measures.length;
  const gridW       = totalSteps * cw;
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];

  // Keep playhead in view
  useEffect(() => {
    if (activeGlobalStep < 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const px = activeGlobalStep * cw;
    if (px < el.scrollLeft + 20 || px > el.scrollLeft + el.clientWidth - 50) {
      el.scrollLeft = Math.max(0, px - el.clientWidth * 0.28);
    }
  }, [activeGlobalStep, cw]);

  // Build hit lookup set
  const hitSet = useMemo(() => {
    const s = new Set<string>();
    pattern.measures.forEach((m, mIdx) => {
      DRUM_INSTRUMENTS.forEach(inst => {
        (m.hits[inst] ?? []).forEach(h => s.add(`${mIdx}:${inst}:${h.step}`));
      });
    });
    return s;
  }, [pattern]);

  const cellFromPointer = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return null;
    const rect   = el.getBoundingClientRect();
    const cx     = e.clientX - rect.left + el.scrollLeft;
    const cy     = e.clientY - rect.top - HDR_H;
    const gs     = Math.max(0, Math.min(totalSteps - 1, Math.floor(cx / cw)));
    const row    = Math.max(0, Math.min(activeInstruments.length - 1, Math.floor(cy / ROW_H)));
    const mIdx   = Math.floor(gs / spm);
    const step   = gs % spm;
    return { inst: activeInstruments[row], mIdx, step, key: `${row}:${gs}` };
  }, [totalSteps, cw, spm, activeInstruments]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    lastKey.current  = '';
    const c = cellFromPointer(e);
    if (!c) return;
    lastKey.current = c.key;
    onToggleHit(c.inst, c.mIdx, c.step);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const c = cellFromPointer(e);
    if (!c || c.key === lastKey.current) return;
    lastKey.current = c.key;
    onToggleHit(c.inst, c.mIdx, c.step);
  };
  const onPointerUp = () => { dragging.current = false; };

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* Fixed left column */}
      <div style={{
        width: LABEL_W, flexShrink: 0,
        background: '#0e0e10', borderRight: '1px solid #27272a', zIndex: 2,
      }}>
        {/* Corner spacer */}
        <div style={{ height: HDR_H, borderBottom: '1px solid #27272a' }} />
        {activeInstruments.map(inst => (
          <div key={inst} style={{
            height: ROW_H, display: 'flex', alignItems: 'center',
            paddingLeft: 10, paddingRight: 6,
            borderBottom: '1px solid #1e1e21',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: INSTRUMENT_COLOR[inst], flexShrink: 0, marginRight: 7,
            }} />
            <span style={{
              fontSize: 11, color: '#a1a1aa', fontWeight: 600,
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              {INSTRUMENT_NAME[inst]}
            </span>
          </div>
        ))}
      </div>

      {/* Scrollable grid */}
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{
          flex: 1, overflowX: 'auto', overflowY: 'hidden',
          position: 'relative', touchAction: 'pan-y',
          cursor: 'crosshair', userSelect: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div style={{ width: gridW, position: 'relative', minHeight: '100%' }}>

          {/* Header row */}
          <div style={{
            height: HDR_H, display: 'flex',
            background: '#0c0c0e', borderBottom: '1px solid #27272a',
            position: 'sticky', top: 0, zIndex: 5,
          }}>
            {pattern.measures.map((_, mIdx) => (
              <div key={mIdx} style={{
                width: spm * cw, flexShrink: 0, position: 'relative',
                borderLeft: mIdx > 0 ? '2px solid #2a2a2d' : 'none',
              }}>
                <span style={{
                  position: 'absolute', left: 5, top: 5,
                  fontSize: 10, fontWeight: 700, color: '#52525b', letterSpacing: 0.4,
                }}>{mIdx + 1}</span>
                {/* Beat ticks */}
                {Array.from({ length: pattern.timeSignature[0] }, (_, b) => b > 0 && (
                  <div key={b} style={{
                    position: 'absolute',
                    left: b * stepsPerBeat * cw,
                    top: 0, bottom: 0, width: 1,
                    background: '#25252a',
                  }}>
                    <span style={{
                      position: 'absolute', left: 3, top: 6,
                      fontSize: 9, color: '#3a3a40', fontWeight: 600,
                    }}>{b + 1}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Instrument rows */}
          {activeInstruments.map((inst, ri) => {
            const color = INSTRUMENT_COLOR[inst];
            return (
              <div key={inst} style={{
                display: 'flex', height: ROW_H,
                background: ri % 2 === 0 ? '#111113' : '#0d0d0f',
                borderBottom: '1px solid #1a1a1d',
              }}>
                {pattern.measures.map((m, mIdx) => (
                  <div key={m.id} style={{
                    display: 'flex', width: spm * cw, flexShrink: 0,
                    borderLeft: mIdx > 0 ? '2px solid #252528' : 'none',
                  }}>
                    {Array.from({ length: spm }, (_, s) => {
                      const gs      = mIdx * spm + s;
                      const isHit   = hitSet.has(`${mIdx}:${inst}:${s}`);
                      const isHead  = gs === activeGlobalStep;
                      const isBeat  = s > 0 && s % stepsPerBeat === 0;
                      return (
                        <div key={s} style={{
                          width: cw, height: '100%', flexShrink: 0,
                          borderLeft: s > 0 ? `1px solid ${isBeat ? '#222225' : '#171719'}` : 'none',
                          background: isHead ? `${accent.from}1e` : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isHit ? (
                            <div style={{
                              width: Math.max(8, cw - 5), height: ROW_H - 14,
                              borderRadius: 3, background: color,
                              boxShadow: isHead
                                ? `0 0 12px ${color}dd, 0 0 4px ${color}`
                                : `0 1px 4px ${color}55`,
                            }} />
                          ) : isHead ? (
                            <div style={{ width: 1, height: '55%', background: `${accent.from}55` }} />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Playhead line */}
          {activeGlobalStep >= 0 && (
            <div style={{
              position: 'absolute',
              left: activeGlobalStep * cw + Math.floor(cw / 2) - 1,
              top: 0, bottom: 0, width: 2,
              background: accent.from,
              boxShadow: `0 0 14px ${accent.from}cc, 0 0 4px ${accent.from}`,
              pointerEvents: 'none', zIndex: 4,
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── SampleBadge ──────────────────────────────────────────────────────────────
function SampleBadge({ status, loaded, total }: { status: SampleStatus; loaded: number; total: number }) {
  if (status === 'idle' || status === 'ready') return null;
  const text  = status === 'loading' ? `Loading ${loaded}/${total}…`
    : status === 'partial' ? `Samples ${loaded}/${total}`
    : 'Synth only';
  const color = status === 'failed' ? '#ef4444' : '#facc15';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: `${color}22`, color, letterSpacing: 0.3, flexShrink: 0,
    }}>{text}</span>
  );
}

// ── DrumEditor (main) ────────────────────────────────────────────────────────
export default function DrumEditor() {
  const accentKey       = useChordStore(s => s.settings.accentColor);
  const updateSettings  = useChordStore(s => s.updateSettings);
  const accent    = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;

  const {
    patterns, activePatternId,
    soundMap, volumeMap, masterVolume,
    kitType, activeInstruments,
    setKitType, toggleInstrument,
    updatePattern, addMeasure, toggleHit,
  } = useDrumStore();

  const pattern = patterns.find(p => p.id === activePatternId) ?? patterns[0];

  // Playback
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [activeGStep,  setActiveGStep]  = useState(-1);
  const [isLooping,    setIsLooping]    = useState(true);

  // Sample loading feedback
  const [sStatus, setSStatus] = useState<SampleStatus>('idle');
  const [sLoaded, setSLoaded] = useState(0);
  const [sTotal,  setSTotal]  = useState(0);

  // UI sheets
  const [showKitPicker, setShowKitPicker] = useState(kitType === null);
  const [showInstSheet, setShowInstSheet] = useState(false);

  useEffect(() => {
    samplePool.onStatusChange = (s, l, t) => {
      setSStatus(s); setSLoaded(l); setSTotal(t);
    };
    return () => { samplePool.onStatusChange = null; };
  }, []);

  useEffect(() => {
    drumScheduler.onStep = (gs) => setActiveGStep(gs);
    return () => { drumScheduler.onStep = null; };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      drumScheduler.updatePattern(pattern);
    }
  }, [pattern, soundMap, volumeMap, masterVolume, isPlaying, isLooping]);

  const handlePlay = useCallback(() => {
    if (isPlaying) {
      drumScheduler.stop();
      setIsPlaying(false);
      setActiveGStep(-1);
    } else {
      loadDrumSamples();
      drumScheduler.start(pattern, soundMap, volumeMap, masterVolume, isLooping);
      setIsPlaying(true);
    }
  }, [isPlaying, pattern, soundMap, volumeMap, masterVolume, isLooping]);

  const handleToggleHit = useCallback((inst: DrumInstrument, mIdx: number, step: number) => {
    const m = pattern.measures[mIdx];
    if (!m) return;
    toggleHit(pattern.id, m.id, inst, step);
  }, [pattern, toggleHit]);

  const handleKitSelect = useCallback((kit: KitType) => {
    setKitType(kit, KIT_DEFAULTS[kit].soundMap);
    setShowKitPicker(false);
  }, [setKitType]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0c',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>

      {/* ── Top header ── */}
      <div style={{
        height: BAR_H, background: '#111113',
        borderBottom: '1px solid #27272a',
        display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: 8, flexShrink: 0, zIndex: 10,
      }}>
        {/* Back */}
        <button
          onClick={() => { drumScheduler.stop(); updateSettings({ appMode: 'chords' }); }}
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'none', border: '1px solid #3f3f46',
            color: '#a1a1aa', cursor: 'pointer', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >‹</button>

        {/* Kit badge */}
        {kitType && (
          <button
            onClick={() => setShowKitPicker(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#1c1c1e', border: `1px solid ${accent.from}55`,
              borderRadius: 20, padding: '4px 11px',
              color: accent.from, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13 }}>{KIT_ICONS[kitType]}</span>
            {KIT_DEFAULTS[kitType].label}
          </button>
        )}

        {/* Pattern name */}
        <span style={{
          flex: 1, fontSize: 14, fontWeight: 600, color: '#e4e4e7',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>{pattern.name}</span>

        <SampleBadge status={sStatus} loaded={sLoaded} total={sTotal} />

        {/* BPM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <button
            onClick={() => updatePattern(pattern.id, { bpm: Math.max(40, pattern.bpm - 1) })}
            style={{ width: 26, height: 26, borderRadius: 6, background: '#27272a', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: 13, cursor: 'pointer' }}
          >−</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: accent.from, minWidth: 40, textAlign: 'center' }}>
            {pattern.bpm}
          </span>
          <button
            onClick={() => updatePattern(pattern.id, { bpm: Math.min(300, pattern.bpm + 1) })}
            style={{ width: 26, height: 26, borderRadius: 6, background: '#27272a', border: '1px solid #3f3f46', color: '#e4e4e7', fontSize: 13, cursor: 'pointer' }}
          >+</button>
        </div>

        {/* Subdivision */}
        <button
          onClick={() => updatePattern(pattern.id, { subdivision: pattern.subdivision === 16 ? 8 : 16 })}
          style={{
            padding: '4px 9px', borderRadius: 6,
            background: '#27272a', border: '1px solid #3f3f46',
            color: '#a1a1aa', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}
        >1/{pattern.subdivision}</button>
      </div>

      {/* ── Piano roll (fills all remaining space) ── */}
      <PianoRollGrid
        pattern={pattern}
        activeInstruments={activeInstruments}
        activeGlobalStep={activeGStep}
        onToggleHit={handleToggleHit}
        accent={accent}
      />

      {/* ── Bottom bar ── */}
      <div style={{
        height: BTM_H, background: '#111113',
        borderTop: '1px solid #27272a',
        display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: 8, flexShrink: 0, zIndex: 10,
      }}>
        {/* Instruments toggle */}
        <button
          onClick={() => setShowInstSheet(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: showInstSheet ? `${accent.from}22` : '#1c1c1e',
            border: `1px solid ${showInstSheet ? accent.from : '#3f3f46'}`,
            borderRadius: 20, padding: '7px 13px',
            color: showInstSheet ? accent.from : '#a1a1aa',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14 }}>🥁</span>
          Drums
          <span style={{ fontSize: 10, opacity: 0.6 }}>{showInstSheet ? '▼' : '▲'}</span>
        </button>

        {/* Active instrument chips */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 5,
          overflowX: 'auto', padding: '2px 0',
        }} className="no-scrollbar">
          {activeInstruments.map(inst => (
            <span key={inst} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#1c1c1e', borderRadius: 12, padding: '3px 9px',
              fontSize: 10, fontWeight: 600,
              color: INSTRUMENT_COLOR[inst], whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: INSTRUMENT_COLOR[inst], display: 'inline-block',
              }} />
              {INSTRUMENT_NAME[inst]}
            </span>
          ))}
        </div>

        {/* Add measure */}
        <button
          onClick={() => addMeasure(pattern.id)}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: '#1c1c1e', border: '1px solid #3f3f46',
            color: '#a1a1aa', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >+</button>

        {/* Loop */}
        <button
          onClick={() => setIsLooping(v => !v)}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: isLooping ? `${accent.from}22` : '#1c1c1e',
            border: `1px solid ${isLooping ? accent.from : '#3f3f46'}`,
            color: isLooping ? accent.from : '#52525b',
            fontSize: 14, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >⟳</button>

        {/* Play / Stop */}
        <button
          onClick={handlePlay}
          style={{
            width: 46, height: 46, borderRadius: '50%',
            background: isPlaying
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
            border: 'none', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 22px ${isPlaying ? '#ef444466' : accent.from + '66'}`,
            transition: 'background 200ms, box-shadow 200ms',
          }}
        >
          {isPlaying
            ? <span style={{ fontSize: 15, color: '#fff' }}>■</span>
            : <span style={{ fontSize: 18, color: '#fff', marginLeft: 3 }}>▶</span>}
        </button>
      </div>

      {/* ── Instrument palette sheet ── */}
      {showInstSheet && (
        <InstrumentPaletteSheet
          activeInstruments={activeInstruments}
          kitType={kitType}
          accent={accent}
          onToggle={toggleInstrument}
          onKitChange={() => { setShowInstSheet(false); setShowKitPicker(true); }}
          onClose={() => setShowInstSheet(false)}
        />
      )}

      {/* ── Kit selector sheet ── */}
      {showKitPicker && (
        <KitSelectorSheet
          accent={accent}
          onSelect={handleKitSelect}
          onClose={kitType ? () => setShowKitPicker(false) : undefined}
        />
      )}
    </div>
  );
}

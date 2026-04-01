import { useState, useCallback, useMemo } from 'react';
import { useChordStore, ACCENT_COLORS, type CustomChord, type BarreDef } from '../store/useChordStore';
import {
  detectChordName, chromaticToName,
  OPEN_NOTES, STRING_LABELS, notesFromFrets, notesFromPianoKeys,
} from '../lib/chordDetect';
import { setNavHidden } from '../lib/navScroll';
import { useEffect } from 'react';
import ChordDiagram from './ChordDiagram';
import type { GuitarChordData } from '../data/chords';

type Instrument = 'guitar' | 'piano' | 'bass' | 'ukulele';

/* ════════════════════════════════════════════════════════════════
   MINI DIAGRAM COMPONENTS (used in the chord list)
   ════════════════════════════════════════════════════════════════ */

/** Modern mini fretboard for N strings — matches the style of ChordDiagram */
function MiniDotN({ frets, baseFret, accentFrom, numStrings, barres = [] }: {
  frets: number[]; baseFret: number; accentFrom: string; numStrings: number; barres?: BarreDef[];
}) {
  const W = 44, H = 56;
  const numF = 4;
  const pL = 10, pT = 13, pR = 6;
  const cW = (W - pL - pR) / (numStrings - 1);
  const cH = (H - pT - 9) / numF;
  const r  = 4;
  const min = baseFret;
  const nut = baseFret === 1;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', flexShrink: 0 }}>
      {/* Nut / fret label */}
      {nut
        ? <rect x={pL - 1} y={pT - 4} width={(numStrings - 1) * cW + 2} height={4} rx={1.5} fill={accentFrom} />
        : <text x={pL - 3} y={pT + cH * 0.5} fontFamily="Manrope" fontSize={6.5} fill="#808080" textAnchor="end" dominantBaseline="middle">{baseFret}fr</text>
      }
      {/* Fret lines */}
      {Array.from({ length: numF + 1 }).map((_, i) => (
        <line key={i} x1={pL} y1={pT + i * cH} x2={pL + (numStrings - 1) * cW} y2={pT + i * cH}
          stroke={i === 0 && !nut ? '#666' : '#484848'}
          strokeOpacity={i === 0 && !nut ? 0.55 : 0.3}
          strokeWidth={i === 0 && !nut ? 1.2 : 0.7} />
      ))}
      {/* String lines */}
      {Array.from({ length: numStrings }).map((_, i) => (
        <line key={i} x1={pL + i * cW} y1={pT} x2={pL + i * cW} y2={pT + numF * cH}
          stroke="#8a8a8a"
          strokeOpacity={i === 0 || i === numStrings - 1 ? 0.35 : 0.22}
          strokeWidth={i === 0 || i === numStrings - 1 ? 1 : 0.75} />
      ))}
      {/* Barres */}
      {barres.map((b, bi) => {
        const fp = b.fret - min;
        if (fp < 0 || fp >= numF) return null;
        const x1 = pL + (b.toString - 1) * cW;
        const x2 = pL + (b.fromString - 1) * cW;
        const cy = pT + fp * cH + cH / 2;
        return <rect key={bi} x={Math.min(x1, x2)} y={cy - r} width={Math.abs(x2 - x1)} height={r * 2} rx={r} fill={accentFrom} />;
      })}
      {/* Finger dots */}
      {frets.map((f, si) => {
        if (f <= 0) return null;
        const fp = f - min;
        if (fp < 0 || fp >= numF) return null;
        const cx = pL + si * cW, cy = pT + fp * cH + cH / 2;
        return (
          <g key={si}>
            <circle cx={cx} cy={cy} r={r + 1.5} fill={accentFrom} opacity={0.15} />
            <circle cx={cx} cy={cy} r={r} fill={accentFrom} />
          </g>
        );
      })}
      {/* Mute / open symbols */}
      {frets.map((f, si) => {
        const cx = pL + si * cW;
        if (f === -1) return <text key={si} x={cx} y={pT - 6} fontFamily="Manrope" fontSize={7} fill="#ee7d77" textAnchor="middle">✕</text>;
        if (f === 0)  return <circle key={si} cx={cx} cy={pT - 7} r={3} fill="none" stroke={accentFrom} strokeWidth={1} opacity={0.6} />;
        return null;
      })}
    </svg>
  );
}

/** Mini piano display for chord list (1 octave) */
function PianoMini({ keys, accentFrom }: { keys: number[]; accentFrom: string }) {
  const W = 40, H = 50;
  const WHITE = [0, 2, 4, 5, 7, 9, 11];
  const BLACK_CHROMAS = [1, 3, 6, 8, 10];
  const BLACK_POS     = [0.55, 1.55, 3.55, 4.55, 5.55];
  const wkW = W / 7, wkH = H;
  const bkW = wkW * 0.65, bkH = wkH * 0.58;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', flexShrink: 0 }}>
      {WHITE.map((chroma, i) => (
        <rect key={i} x={i * wkW + 0.5} y={1} width={wkW - 1} height={wkH - 2}
          rx={2} fill={keys.includes(chroma) ? accentFrom : 'rgba(240,240,240,0.9)'}
          stroke="rgba(100,100,100,0.25)" strokeWidth={0.5} />
      ))}
      {BLACK_POS.map((pos, i) => (
        <rect key={i} x={pos * wkW - bkW / 2} y={1} width={bkW} height={bkH}
          rx={1.5} fill={keys.includes(BLACK_CHROMAS[i]) ? accentFrom : '#1a1a1a'} />
      ))}
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════
   BARRE HELPERS
   ════════════════════════════════════════════════════════════════ */

/** Auto-compute barres: any 2+ strings sharing the same fret get connected */
function computeBarres(frets: number[]): BarreDef[] {
  const map: Record<number, number[]> = {};
  frets.forEach((f, si) => { if (f > 0) (map[f] ??= []).push(si); });
  return Object.entries(map)
    .filter(([, strs]) => strs.length >= 2)
    .map(([fretStr, strs]) => ({
      fret: Number(fretStr),
      fromString: Math.min(...strs) + 1,
      toString: Math.max(...strs) + 1,
    }));
}

/** Routes to correct mini display based on instrument type */
export function CustomMiniDiagram({ chord, accentFrom }: { chord: CustomChord; accentFrom: string }) {
  if (chord.instrument === 'piano') {
    return <PianoMini keys={chord.pianoKeys ?? []} accentFrom={accentFrom} />;
  }
  if (chord.instrument === 'guitar') {
    const frets = chord.frets ?? [0, 0, 0, 0, 0, 0];
    const activeFrets = frets.filter(f => f > 0);
    const baseFret = activeFrets.length > 0 ? Math.min(...activeFrets) : 1;
    const data: GuitarChordData = { frets, fingers: [], barres: chord.barres ?? [], baseFret };
    return <ChordDiagram data={data} accentFrom={accentFrom} />;
  }
  const frets = chord.frets ?? [];
  const numStrings = STRING_LABELS[chord.instrument as 'bass' | 'ukulele']?.length ?? 4;
  const activeFrets = frets.filter(f => f > 0);
  const baseFret = activeFrets.length > 0 ? Math.min(...activeFrets) : 1;
  return <MiniDotN frets={frets} baseFret={baseFret} accentFrom={accentFrom} numStrings={numStrings} barres={chord.barres ?? []} />;
}

/* ════════════════════════════════════════════════════════════════
   GUITAR / BASS / UKULELE FRETBOARD
   ════════════════════════════════════════════════════════════════ */

function FretboardBuilder({ instrument, frets, onChange, barres = [], onBarresChange = () => {}, accent }: {
  instrument: 'guitar' | 'bass' | 'ukulele';
  frets: number[];
  onChange: (f: number[]) => void;
  barres?: BarreDef[];
  onBarresChange?: (b: BarreDef[]) => void;
  accent: { from: string; to: string };
}) {
  const [baseFret, setBaseFret] = useState(1);
  const [barreMode, setBarreMode] = useState(false);
  const VISIBLE = 5;
  const labels   = STRING_LABELS[instrument];
  const openNotes = OPEN_NOTES[instrument];
  const numStrings = labels.length;

  // Display strings in reverse order (high string at top, like a guitar chord diagram)
  const displayOrder = useMemo(
    () => Array.from({ length: numStrings }, (_, i) => numStrings - 1 - i),
    [numStrings],
  );

  const handleFretClick = useCallback((sIdx: number, fret: number) => {
    const next = [...frets];
    next[sIdx] = next[sIdx] === fret ? 0 : fret;
    onChange(next);
    if (barreMode) onBarresChange(computeBarres(next));
  }, [frets, onChange, barreMode, onBarresChange]);

  const handleHeadClick = useCallback((sIdx: number) => {
    const next = [...frets];
    next[sIdx] = next[sIdx] === -1 ? 0 : -1;
    onChange(next);
  }, [frets, onChange]);

  const toggleBarreMode = () => {
    setBarreMode(prev => !prev);
  };

  const CELL_H   = 42;
  const LABEL_W  = 26;
  const HEAD_W   = 34;
  const NUT_W    = baseFret === 1 ? 3 : 0;

  return (
    <div style={{ userSelect: 'none', touchAction: 'none' }}>
      {/* Navigation + Barre toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 10px', gap: '8px' }}>
        <button onClick={() => setBaseFret(bf => Math.max(1, bf - 1))} disabled={baseFret === 1}
          className="btn-smooth"
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--app-surface-high)', color: baseFret === 1 ? 'var(--c-text-muted)' : 'var(--c-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: baseFret === 1 ? 0.35 : 1, flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
        </button>
        <span style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '12px', color: 'var(--c-text-secondary)', flex: 1, textAlign: 'center' }}>
          {baseFret === 1 ? 'Open · Frets 1–5' : `Frets ${baseFret}–${baseFret + VISIBLE - 1}`}
        </span>
        {/* Barre toggle */}
        <button onClick={toggleBarreMode} className="btn-smooth"
          style={{
            padding: '5px 11px', borderRadius: '9999px', flexShrink: 0,
            background: barreMode ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'var(--app-surface-high)',
            border: barreMode ? 'none' : '1px solid rgba(72,72,72,0.15)',
            color: barreMode ? '#fff' : 'var(--c-text-secondary)',
            fontFamily: 'Manrope', fontWeight: 800, fontSize: '11px',
            display: 'flex', alignItems: 'center', gap: '4px',
            boxShadow: barreMode ? `0 2px 10px ${accent.to}55` : 'none',
            transition: 'all 180ms ease',
          }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>horizontal_rule</span>
          Barre
        </button>
        <button onClick={() => setBaseFret(bf => Math.min(8, bf + 1))} disabled={baseFret >= 8}
          className="btn-smooth"
          style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--app-surface-high)', color: baseFret >= 8 ? 'var(--c-text-muted)' : 'var(--c-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: baseFret >= 8 ? 0.35 : 1, flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
        </button>
      </div>
      {barreMode && (
        <p style={{ fontFamily: 'Inter', fontSize: '11px', color: accent.from, marginBottom: '8px', textAlign: 'center' }}>
          Tap 2+ positions on the same fret — they'll connect as a barre
        </p>
      )}

      {/* Fret number header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
        <div style={{ width: LABEL_W + HEAD_W + NUT_W }} />
        {Array.from({ length: VISIBLE }, (_, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 700, fontSize: '10px', color: 'var(--c-text-muted)' }}>
            {baseFret + i}
          </div>
        ))}
      </div>

      {/* String rows */}
      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(72,72,72,0.12)' }}>
        {displayOrder.map((sIdx, rowIdx) => {
          const label = labels[sIdx];
          const state = frets[sIdx]; // -1=muted, 0=open, n=fret
          const openNote = openNotes[sIdx];
          const isLast = rowIdx === numStrings - 1;
          return (
            <div key={sIdx} style={{
              display: 'flex', alignItems: 'center', height: `${CELL_H}px`,
              borderBottom: isLast ? 'none' : '1px solid rgba(72,72,72,0.08)',
              background: 'var(--app-surface-low)',
            }}>
              {/* String label */}
              <div style={{ width: LABEL_W, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 800, fontSize: '11px', color: 'var(--c-text-secondary)', flexShrink: 0 }}>
                {label}
              </div>

              {/* O/X head button */}
              <button onClick={() => handleHeadClick(sIdx)} className="btn-smooth"
                style={{
                  width: HEAD_W, height: `${CELL_H - 8}px`, marginRight: '4px',
                  borderRadius: '8px', flexShrink: 0,
                  background: state === -1 ? 'rgba(238,125,119,0.18)' : state === 0 ? 'rgba(74,222,128,0.14)' : 'rgba(72,72,72,0.1)',
                  color: state === -1 ? '#ee7d77' : state === 0 ? '#4ade80' : 'var(--c-text-muted)',
                  fontFamily: 'Manrope', fontWeight: 900, fontSize: '13px',
                  transition: 'background 150ms ease, color 150ms ease',
                }}>
                {state === -1 ? '✕' : 'O'}
              </button>

              {/* Nut line (when at first position) */}
              {baseFret === 1 && (
                <div style={{ width: NUT_W, height: `${CELL_H - 4}px`, background: 'rgba(180,180,180,0.5)', borderRadius: '1px', flexShrink: 0 }} />
              )}

              {/* Fret cells */}
              {Array.from({ length: VISIBLE }, (_, fIdx) => {
                const fret     = baseFret + fIdx;
                const isActive = state === fret;
                const noteAtFret = fret <= 12 ? chromaticToName((openNote + fret) % 12) : '';
                // Is this cell part of a barre?
                const barre = barres.find(b =>
                  b.fret === fret &&
                  sIdx >= b.fromString - 1 &&
                  sIdx <= b.toString - 1,
                );
                const isBarreCell = !!barre;
                // display is reversed (high sIdx = top row), so visual top = toString-1
                const isBarreStart = isBarreCell && sIdx === barre!.toString - 1;
                const isBarreEnd   = isBarreCell && sIdx === barre!.fromString - 1;
                return (
                  <button key={fIdx} onClick={() => fret <= 12 && handleFretClick(sIdx, fret)}
                    className="btn-smooth"
                    data-testid={`fret-cell-s${sIdx}-f${fret}`}
                    style={{
                      flex: 1, height: '100%', position: 'relative',
                      borderLeft: `1px solid rgba(72,72,72,${fIdx === 0 ? '0.2' : '0.1'})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent',
                      cursor: fret <= 12 ? 'pointer' : 'default',
                    }}>
                    {/* String line */}
                    <div style={{ position: 'absolute', left: 0, right: 0, height: '1.5px', background: `rgba(160,160,160,${sIdx === 0 || sIdx === numStrings - 1 ? '0.4' : '0.25'})`, top: '50%', transform: 'translateY(-50%)' }} />
                    {/* Barre vertical connector (spans full row height) */}
                    {isBarreCell && (
                      <div style={{
                        position: 'absolute',
                        left: '50%', transform: 'translateX(-50%)',
                        width: '10px',
                        top: isBarreStart ? '50%' : '0',
                        bottom: isBarreEnd ? '50%' : '0',
                        background: accent.from,
                        opacity: 0.75,
                        zIndex: 1,
                        borderRadius: isBarreStart ? '5px 5px 0 0' : isBarreEnd ? '0 0 5px 5px' : '0',
                      }} />
                    )}
                    {/* Finger dot or barre pill */}
                    {isActive && (
                      isBarreCell ? (
                        <div style={{
                          width: '10px', height: '26px', borderRadius: '5px',
                          position: 'relative', zIndex: 2,
                          background: accent.from,
                          boxShadow: `0 2px 8px ${accent.to}66`,
                        }} />
                      ) : (
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '50%', position: 'relative', zIndex: 2,
                          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                          boxShadow: `0 2px 10px ${accent.to}55`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '8px', color: '#fff' }}>{noteAtFret}</span>
                        </div>
                      )
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Quick-clear button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
        <button onClick={() => onChange(new Array(numStrings).fill(0))} className="btn-smooth"
          style={{ padding: '5px 14px', borderRadius: '9999px', background: 'var(--app-surface-high)', color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>restart_alt</span>
          Clear all
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PIANO KEYBOARD
   ════════════════════════════════════════════════════════════════ */

const WHITE_CHROMAS = [0, 2, 4, 5, 7, 9, 11] as const; // C D E F G A B
const BLACK_CHROMAS = [1, 3, 6, 8, 10] as const;       // C# D# F# G# A#
const BLACK_POS     = [0.55, 1.55, 3.55, 4.55, 5.55] as const;

function PianoKeyboard({ pianoKeys, onChange, accent }: {
  pianoKeys: number[];
  onChange: (keys: number[]) => void;
  accent: { from: string; to: string };
}) {
  const NUM_OCTAVES = 2;
  const TOTAL_WHITE = NUM_OCTAVES * 7;

  const toggle = useCallback((chroma: number) => {
    const c = ((chroma % 12) + 12) % 12;
    onChange(pianoKeys.includes(c) ? pianoKeys.filter(k => k !== c) : [...pianoKeys, c]);
  }, [pianoKeys, onChange]);

  return (
    <div>
      {/* Octave label */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '6px', padding: '0 2px' }}>
        {Array.from({ length: NUM_OCTAVES }, (_, i) => (
          <span key={i} style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '10px', color: 'var(--c-text-muted)' }}>Octave {i + 1}</span>
        ))}
      </div>

      {/* Keyboard */}
      <div style={{ position: 'relative', userSelect: 'none', touchAction: 'none', height: '88px' }}>
        {/* White keys */}
        <div style={{ display: 'flex', gap: '1.5px', height: '100%', padding: '0 2px' }}>
          {Array.from({ length: TOTAL_WHITE }, (_, i) => {
            const posInOct = i % 7;
            const chroma   = WHITE_CHROMAS[posInOct];
            const isOn     = pianoKeys.includes(chroma);
            return (
              <div key={i} onClick={() => toggle(chroma)}
                style={{
                  flex: 1, borderRadius: '0 0 6px 6px',
                  background: isOn ? `linear-gradient(180deg, ${accent.from}99, ${accent.from})` : 'rgba(240,240,240,0.94)',
                  border: isOn ? `1px solid ${accent.to}44` : '1px solid rgba(0,0,0,0.12)',
                  borderTop: 'none', cursor: 'pointer',
                  transition: 'background 120ms ease',
                  boxShadow: isOn ? `0 2px 8px ${accent.to}44` : 'none',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '4px',
                }}>
                {isOn && (
                  <span style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '8px', color: '#fff' }}>
                    {chromaticToName(chroma)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Black keys */}
        {Array.from({ length: NUM_OCTAVES }, (_, octave) =>
          BLACK_POS.map((relPos, bIdx) => {
            const chroma  = BLACK_CHROMAS[bIdx];
            const isOn    = pianoKeys.includes(chroma);
            const pct     = ((octave * 7 + relPos) / TOTAL_WHITE) * 100;
            const wPct    = (1 / TOTAL_WHITE) * 100 * 0.62;
            return (
              <div key={`${octave}-${bIdx}`} onClick={(e) => { e.stopPropagation(); toggle(chroma); }}
                style={{
                  position: 'absolute', left: `${pct}%`, top: '1px',
                  width: `${wPct}%`, height: '55%',
                  borderRadius: '0 0 4px 4px',
                  background: isOn ? `linear-gradient(180deg, ${accent.from}, ${accent.to})` : '#1c1c1e',
                  cursor: 'pointer', zIndex: 2,
                  transform: 'translateX(-50%)',
                  transition: 'background 120ms ease',
                  boxShadow: isOn ? `0 2px 12px ${accent.to}77` : '0 3px 6px rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '3px',
                }}>
                {isOn && (
                  <span style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '7px', color: '#fff' }}>
                    {chromaticToName(chroma)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Selected notes row */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '10px', minHeight: '20px' }}>
        {[...pianoKeys].sort((a, b) => a - b).map(k => (
          <button key={k} onClick={() => toggle(k)} className="btn-smooth"
            style={{ padding: '3px 9px', borderRadius: '9999px', background: `${accent.from}20`, border: `1px solid ${accent.from}44`, color: accent.from, fontFamily: 'Manrope', fontWeight: 800, fontSize: '11px' }}>
            {chromaticToName(k)}
          </button>
        ))}
        {pianoKeys.length === 0 && (
          <span style={{ fontFamily: 'Inter', fontSize: '11px', color: 'var(--c-text-muted)' }}>Tap keys to select notes</span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
        <button onClick={() => onChange([])} className="btn-smooth"
          style={{ padding: '5px 14px', borderRadius: '9999px', background: 'var(--app-surface-high)', color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>restart_alt</span>
          Clear all
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   INSTRUMENT ICONS
   ════════════════════════════════════════════════════════════════ */

const INSTRUMENTS: { id: Instrument; label: string; image: string }[] = [
  { id: 'guitar',  label: 'Guitar',  image: '/instruments/guitar.png'  },
  { id: 'piano',   label: 'Piano',   image: '/instruments/piano.png'   },
  { id: 'bass',    label: 'Bass',    image: '/instruments/bass.png'    },
  { id: 'ukulele', label: 'Ukulele', image: '/instruments/ukulele.png' },
];

function genId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ════════════════════════════════════════════════════════════════
   MAIN BUILDER MODAL
   ════════════════════════════════════════════════════════════════ */

interface Props {
  accent: { from: string; to: string; mid: string };
  editChord?: CustomChord | null;
  onSave: (chord: CustomChord) => void;
  onClose: () => void;
}

export default function CustomChordBuilder({ accent, editChord, onSave, onClose }: Props) {
  const { settings } = useChordStore();
  const resolvedAccent = ACCENT_COLORS[settings.accentColor];

  const [instrument, setInstrument] = useState<Instrument>(editChord?.instrument ?? 'guitar');
  const [frets, setFrets] = useState<number[]>(() => {
    if (editChord?.frets) return [...editChord.frets];
    const n = editChord?.instrument === 'bass' || editChord?.instrument === 'ukulele' ? 4 : 6;
    return new Array(n).fill(0);
  });
  const [barres, setBarres] = useState<BarreDef[]>(editChord?.barres ?? []);
  const [pianoKeys, setPianoKeys] = useState<number[]>(editChord?.pianoKeys ?? []);
  const [name, setName] = useState(editChord?.name ?? '');
  const [nameTouched, setNameTouched] = useState(!!editChord?.name);

  // Nav bar — hide while builder is open
  useEffect(() => {
    setNavHidden(true);
    return () => setNavHidden(false);
  }, []);

  // Recompute notes whenever inputs change
  const notes = useMemo(() => {
    if (instrument === 'piano') return notesFromPianoKeys(pianoKeys);
    return notesFromFrets(frets, OPEN_NOTES[instrument]);
  }, [instrument, frets, pianoKeys]);

  // Auto-suggest chord name
  const chromaticIndices = useMemo(() => {
    if (instrument === 'piano') return pianoKeys;
    return frets
      .map((f, i) => f < 0 ? null : (OPEN_NOTES[instrument][i] + f) % 12)
      .filter((v): v is number => v !== null);
  }, [instrument, frets, pianoKeys]);

  const suggested = useMemo(() => detectChordName(chromaticIndices), [chromaticIndices]);

  // When instrument changes, reset fret state
  const handleInstrumentChange = (inst: Instrument) => {
    setInstrument(inst);
    if (inst === 'guitar') setFrets(new Array(6).fill(0));
    else if (inst === 'bass' || inst === 'ukulele') setFrets(new Array(4).fill(0));
    else setFrets([]);
    setBarres([]);
    setPianoKeys([]);
    if (!nameTouched) setName('');
  };

  const handleSave = () => {
    const finalName = name.trim() || suggested || 'Custom Chord';
    const chord: CustomChord = {
      id: editChord?.id ?? genId(),
      name: finalName,
      instrument,
      frets: instrument !== 'piano' ? frets : undefined,
      barres: instrument !== 'piano' ? barres : undefined,
      pianoKeys: instrument === 'piano' ? pianoKeys : undefined,
      notes,
      createdAt: editChord?.createdAt ?? Date.now(),
    };
    onSave(chord);
  };

  // Build live preview data for guitar
  const previewData: GuitarChordData | null = instrument === 'guitar' ? (() => {
    const activeFrets = frets.filter(f => f > 0);
    const baseFret = activeFrets.length > 0 ? Math.min(...activeFrets) : 1;
    return { frets, fingers: [], barres, baseFret };
  })() : null;

  // Build live preview data for bass/ukulele
  const fretboardPreview = (instrument === 'bass' || instrument === 'ukulele') ? (() => {
    const activeFrets = frets.filter(f => f > 0);
    const baseFret = activeFrets.length > 0 ? Math.min(...activeFrets) : 1;
    return { frets, baseFret };
  })() : null;

  const hasAnyNote = instrument === 'piano'
    ? pianoKeys.length >= 1
    : frets.some(f => f >= 0) && notes.length >= 1;

  const isEditing = !!editChord;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }} />

      {/* Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'var(--app-bg)',
        borderRadius: '1.5rem 1.5rem 0 0',
        maxHeight: '92dvh',
        display: 'flex', flexDirection: 'column',
        animation: 'sheet-up 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        overflow: 'hidden',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'rgba(72,72,72,0.3)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 12px', flexShrink: 0, gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: `linear-gradient(135deg, ${resolvedAccent.from}, ${resolvedAccent.to})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#fff' }}>
              {isEditing ? 'edit' : 'add_circle'}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'Manrope', fontWeight: 900, fontSize: '18px', color: 'var(--c-text-primary)', lineHeight: 1 }}>
              {isEditing ? 'Edit Chord' : 'Custom Chord'}
            </p>
            <p style={{ fontFamily: 'Inter', fontSize: '11px', color: 'var(--c-text-muted)', marginTop: '2px' }}>
              {isEditing ? 'Modify your chord shape' : 'Build your own chord visually'}
            </p>
          </div>
          <button onClick={onClose} className="btn-smooth" style={{ color: 'var(--c-text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>

          {/* ── Instrument selector ── */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Instrument</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {INSTRUMENTS.map(inst => {
                const active = instrument === inst.id;
                const clipId = `img-clip-${inst.id}`;
                return (
                  <button
                    key={inst.id}
                    onClick={() => handleInstrumentChange(inst.id)}
                    className="btn-smooth"
                    style={{
                      flex: 1,
                      padding: 0,
                      borderRadius: '14px',
                      background: 'var(--app-surface)',
                      border: `2px solid ${active ? resolvedAccent.from : 'rgba(72,72,72,0.14)'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                      overflow: 'hidden',
                      transition: 'border-color 220ms ease, transform 160ms ease, box-shadow 220ms ease',
                      transform: active ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: active ? `0 6px 20px ${resolvedAccent.to}55` : 'none',
                    }}
                  >
                    {/* SVG image with clipPath for crisp rounded display */}
                    <svg
                      viewBox="0 0 100 100"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ display: 'block', width: '100%', aspectRatio: '1' }}
                    >
                      <defs>
                        <clipPath id={clipId}>
                          <rect width="100" height="100" rx="0" ry="0" />
                        </clipPath>
                        <linearGradient id={`grad-${inst.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={resolvedAccent.from} stopOpacity={active ? 0.18 : 0.06} />
                          <stop offset="100%" stopColor={resolvedAccent.to} stopOpacity={active ? 0.10 : 0.03} />
                        </linearGradient>
                      </defs>
                      {/* Dark background */}
                      <rect width="100" height="100" fill="rgba(20,20,24,1)" />
                      {/* Instrument photo */}
                      <image
                        href={inst.image}
                        x="8" y="6" width="84" height="84"
                        preserveAspectRatio="xMidYMid meet"
                        clipPath={`url(#${clipId})`}
                      />
                      {/* Accent tint overlay when active */}
                      <rect width="100" height="100" fill={`url(#grad-${inst.id})`} />
                    </svg>
                    {/* Label strip */}
                    <div style={{
                      padding: '5px 4px 6px',
                      background: active
                        ? `linear-gradient(135deg, ${resolvedAccent.from}, ${resolvedAccent.to})`
                        : 'var(--app-surface)',
                      transition: 'background 220ms ease',
                      textAlign: 'center',
                    }}>
                      <span style={{
                        fontFamily: 'Manrope', fontWeight: 800, fontSize: '10px',
                        color: active ? '#fff' : 'var(--c-text-secondary)',
                        letterSpacing: '0.03em',
                      }}>
                        {inst.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Chord name input ── */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Chord Name</p>
            <div style={{ position: 'relative' }}>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setNameTouched(true); }}
                placeholder={suggested ? `Detected: ${suggested}` : 'e.g. Cmaj7, My Riff...'}
                style={{
                  width: '100%', background: 'var(--app-surface)', border: '1px solid rgba(72,72,72,0.15)', borderRadius: '12px',
                  padding: '12px 14px', color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700,
                  fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 200ms ease',
                }}
                onFocus={e => { e.target.style.borderColor = resolvedAccent.from; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(72,72,72,0.15)'; }}
              />
              {suggested && !nameTouched && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: `${resolvedAccent.from}18`, border: `1px solid ${resolvedAccent.from}33`, borderRadius: '9999px', padding: '2px 8px' }}>
                  <span style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '10px', color: resolvedAccent.from }}>auto</span>
                </div>
              )}
            </div>
            {suggested && name.trim() === '' && (
              <p style={{ fontFamily: 'Inter', fontSize: '11px', color: resolvedAccent.from, marginTop: '5px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '12px', verticalAlign: 'middle' }}>auto_fix_high</span>
                {' '}Detected: <strong>{suggested}</strong> — will be used if left empty
              </p>
            )}
          </div>

          {/* ── Builder ── */}
          <div style={{ marginBottom: '4px' }}>
            {/* Header row: label + live preview */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '11px', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {instrument === 'piano' ? 'Piano Keyboard' : 'Fretboard'}
              </p>
              {/* Live diagram preview — guitar */}
              {previewData && (
                <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '10px', padding: '4px 4px 2px', width: '68px', flexShrink: 0 }}>
                  <ChordDiagram data={previewData} accentFrom={resolvedAccent.from} />
                </div>
              )}
              {/* Live diagram preview — bass / ukulele */}
              {fretboardPreview && (
                <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '10px', padding: '6px 7px 4px', flexShrink: 0 }}>
                  <MiniDotN
                    frets={fretboardPreview.frets}
                    baseFret={fretboardPreview.baseFret}
                    accentFrom={resolvedAccent.from}
                    numStrings={4}
                    barres={barres}
                  />
                </div>
              )}
              {/* Live diagram preview — piano */}
              {instrument === 'piano' && pianoKeys.length > 0 && (
                <div style={{ background: 'var(--app-surface-lowest)', borderRadius: '10px', padding: '6px 6px 4px', flexShrink: 0 }}>
                  <PianoMini keys={pianoKeys} accentFrom={resolvedAccent.from} />
                </div>
              )}
            </div>

            {instrument === 'piano' ? (
              <PianoKeyboard pianoKeys={pianoKeys} onChange={setPianoKeys} accent={resolvedAccent} />
            ) : (
              <FretboardBuilder
                instrument={instrument}
                frets={frets}
                onChange={setFrets}
                barres={barres}
                onBarresChange={setBarres}
                accent={resolvedAccent}
              />
            )}
          </div>

          {/* ── Notes summary ── */}
          {notes.length > 0 && (
            <div style={{ marginTop: '16px', padding: '12px 14px', background: 'var(--app-surface)', borderRadius: '12px', border: '1px solid rgba(72,72,72,0.08)' }}>
              <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '10px', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Notes</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {notes.map((note, i) => (
                  <span key={i} style={{ padding: '3px 10px', borderRadius: '9999px', background: `${resolvedAccent.from}18`, color: resolvedAccent.from, fontFamily: 'Manrope', fontWeight: 800, fontSize: '12px', border: `1px solid ${resolvedAccent.from}30` }}>
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Save button ── */}
        <div style={{ padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', borderTop: '1px solid rgba(72,72,72,0.08)', flexShrink: 0, background: 'var(--app-bg)' }}>
          <button onClick={handleSave} disabled={!hasAnyNote} className="btn-smooth" data-testid="custom-chord-save-btn"
            style={{
              width: '100%', padding: '16px',
              borderRadius: '9999px',
              background: hasAnyNote
                ? `linear-gradient(135deg, ${resolvedAccent.from}, ${resolvedAccent.to})`
                : 'var(--app-surface)',
              color: hasAnyNote ? '#fff' : 'var(--c-text-muted)',
              fontFamily: 'Manrope', fontWeight: 800, fontSize: '15px',
              boxShadow: hasAnyNote ? `0 4px 24px ${resolvedAccent.to}50` : 'none',
              transition: 'all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: hasAnyNote ? 'scale(1)' : 'scale(0.98)',
            }}>
            {isEditing ? 'Update Chord' : 'Save Chord'}
          </button>
          {!hasAnyNote && (
            <p style={{ textAlign: 'center', fontFamily: 'Inter', fontSize: '11px', color: 'var(--c-text-muted)', marginTop: '8px' }}>
              {instrument === 'piano' ? 'Tap at least one key to continue' : 'Place at least one finger to continue'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

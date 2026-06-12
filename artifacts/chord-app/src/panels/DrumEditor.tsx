import {
  memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import ElasticSlider from '../components/ElasticSlider';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import EmptyStateLottie from '../components/lottie/EmptyStateLottie';
import LoadingLottie from '../components/lottie/LoadingLottie';
import SuccessLottie from '../components/lottie/SuccessLottie';
import { useT } from '../lib/useT';
import {
  useDrumStore, KIT_INSTRUMENTS, INSTRUMENT_COLOR, INSTRUMENT_NAME, KIT_FAMILY, HOUSE_MICS, HOUSE_CRASH_MODELS, CYMBAL_PACKS,
  stepsPerMeasure, INST_VARIATIONS, GROOVE_TAGS, DEFAULT_INST_FX, emptyMeasure, DRUM_INSTRUMENTS,
  DEFAULT_VELOCITY, MIN_VELOCITY, MAX_VELOCITY, clampVelocity,
  SWING_MIN, SWING_MAX, SWING_PRESETS, clampSwing,
  clampLoopRange,
  type DrumInstrument, type KitType, type HouseMic, type HouseCrashModel, type CymbalPack, type DrumSong, type DrumMeasure, type NoteVariation,
  type DrumPattern, type DrumHit, type GrooveEntry, type GrooveTag, type InstFX,
  type InstPlugin, type LoopRange,
} from '../store/useDrumStore';
import {
  drumScheduler, samplePool, loadDrumSamples, loadHouseKit, houseKitPool,
  setHouseKitMic, setHouseInstVelOverrides, HOUSE_VEL_CONFIGS, HOUSE_INST_LABELS,
  setHouseCrashModel as audioSetHouseCrashModel,
  setCymbalPackAudio, setRandomVariations, setHumanizeVelocity,
  KIT_DEFAULTS, getSoundForVariation, setInstFXMap, setInstPluginMap,
  getAudioCtx,
  type SampleStatus, type HouseInstName,
} from '../lib/drumAudio';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import DrumPrefsPanel from './DrumPrefsPanel';
import { AnimatedAppHeader, StaggeredReveal } from '../components/AppAnimationSystem';
import { setBackHandler } from '../lib/backStack';
import { useNavCollapsed, setNavCollapsed } from '../lib/navScroll';
import { useLiquidGlassNav } from '../lib/useLiquidGlassNav';
import { DRUM_LIBRARY, LIBRARY_CATEGORIES, LIBRARY_GENRES, type LibraryCategory, type LibraryGenre, type LibraryPattern } from '../lib/drumLibrary';
import { useIsWebDesktop } from '../hooks/useIsWebDesktop';
import WebAppSectionDock from '../components/WebAppSectionDock';

// ── Layout ─────────────────────────────────────────────────────────────────
const LABEL_W  = 72;
const ROW_H    = 40;
const RULER_H  = 20;
const SYS_SEP  = 10;
const MIN_STEP = 16;

// Core instruments always visible; extras are collapsible.
// Order mirrors KIT_INSTRUMENTS display order: high → low pitch.
const CORE_INSTS: DrumInstrument[] = ['hihat-closed', 'snare', 'kick', 'crash'];

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


const SHORT_LABEL: Record<DrumInstrument, string> = {
  kick: 'Kick', snare: 'Snare', 'hihat-closed': 'HH', 'hihat-open': 'O.HH',
  'hihat-foot': 'HHF', 'tom-high': 'Hi', 'tom-mid': 'Mid',
  'tom-floor': 'Floor', crash: 'Cym', ride: 'Ride',
};
const INST_LABEL: Record<DrumInstrument, string> = {
  kick: 'Kick', snare: 'Snare', 'hihat-closed': 'Hi-Hat', 'hihat-open': 'Open HH',
  'hihat-foot': 'HH Foot', 'tom-high': 'Tom Hi', 'tom-mid': 'Tom Mid',
  'tom-floor': 'Floor Tom', crash: 'Cymbal', ride: 'Ride',
};
const KIT_LABEL: Record<KitType, string> = {
  ludwig: 'Pearl Master Studio',  jazz: 'Pearl Master (Brushed)', rock: 'Rock Kit',   vintage: "Vintage '60s",
  studio: 'Studio A',             r8:   'Roland R8',    linn: 'LinnDrum',   funk: 'Funk Kit',
  cr78:   'Roland CR-78',         tr808:'Roland TR-808', techno:'Techno Kit', stark:'Stark Industrial',
  rmm:    'Real Music Media OSDK', chrome:'Chrome Acoustic', house: 'House Kit',
};

// ── Per-instrument character presets ─────────────────────────────────────────
// Each preset applies a curated combination of FX values in one tap.
// Values use the same range as the sliders (0-1 for knobs, ±12 for EQ dB).
type FXPreset = { label: string; values: Partial<InstFX> };
const INST_PRESETS: Partial<Record<DrumInstrument, FXPreset[]>> = {
  snare: [
    { label: 'Tight',  values: { gate: 0.72, eqHigh: 5,   eqMid: 3,  compress: 0.5,  attack: 0.08, reverb: 0    } },
    { label: 'Fat',    values: { eqLow: 6,   eqLowMid: 3, eqMid: 1,  compress: 0.38, attack: 0.3,  reverb: 0.12 } },
    { label: 'Crack',  values: { eqHigh: 8,  eqMid: 5,    gate: 0.42, compress: 0.6,  attack: 0.04, reverb: 0    } },
    { label: 'Brush',  values: { eqLow: 2,   eqHigh: -3,  reverb: 0.3, compress: 0.18, attack: 0.42              } },
  ],
  kick: [
    { label: 'Sub',    values: { eqLow: 8,   eqMid: -4,   eqHigh: -2, gate: 0.3                                  } },
    { label: 'Punch',  values: { eqLowMid: 5, compress: 0.5, attack: 0.15, gate: 0.28                             } },
    { label: 'Click',  values: { eqMid: 6,   eqLow: -3,   compress: 0.35, attack: 0.04                           } },
    { label: 'Tight',  values: { gate: 0.65, eqHigh: 2,   compress: 0.55, attack: 0.06                           } },
  ],
  'hihat-closed': [
    { label: 'Bright', values: { eqHigh: 6                                                                         } },
    { label: 'Dark',   values: { eqHigh: -5, eqLowMid: 2                                                          } },
    { label: 'Crisp',  values: { eqHigh: 4,  compress: 0.3,  attack: 0.04                                        } },
  ],
  'hihat-open': [
    { label: 'Bright', values: { eqHigh: 5                                                                         } },
    { label: 'Dark',   values: { eqHigh: -5                                                                        } },
    { label: 'Wash',   values: { reverb: 0.38, eqHigh: 2                                                          } },
  ],
  crash: [
    { label: 'Bright', values: { eqHigh: 6                                                                         } },
    { label: 'Dark',   values: { eqHigh: -5, reverb: 0.22                                                          } },
    { label: 'Long',   values: { reverb: 0.45                                                                       } },
  ],
  ride: [
    { label: 'Bright', values: { eqHigh: 5                                                                         } },
    { label: 'Dark',   values: { eqHigh: -4, reverb: 0.18                                                          } },
    { label: 'Bell',   values: { eqHigh: 3,  eqMid: 4, compress: 0.3, attack: 0.05                                } },
  ],
  'tom-high': [
    { label: 'Warm',   values: { eqLow: 4,  eqHigh: -2, reverb: 0.15                                             } },
    { label: 'Attack', values: { eqMid: 4,  compress: 0.45, attack: 0.08, gate: 0.32                             } },
  ],
  'tom-mid': [
    { label: 'Warm',   values: { eqLow: 4,  eqHigh: -2, reverb: 0.15                                             } },
    { label: 'Attack', values: { eqMid: 4,  compress: 0.45, attack: 0.08, gate: 0.32                             } },
  ],
  'tom-floor': [
    { label: 'Deep',   values: { eqLow: 6,  eqMid: -2, reverb: 0.12                                              } },
    { label: 'Punch',  values: { eqLowMid: 4, compress: 0.42, attack: 0.1                                        } },
  ],
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const KIT_IMAGE: Record<KitType, string> = {
  ludwig: `${BASE}/kit-warm.webp`,
  jazz:   `${BASE}/kit-soft.webp`,
  rmm:    `${BASE}/kit-punchy.webp`,
  chrome: `${BASE}/kit-bright.webp`,
  rock:   `${BASE}/kit-rock.webp`,
  vintage:`${BASE}/kit-vintage.webp`,
  studio: `${BASE}/kit-studio.webp`,
  r8:     `${BASE}/kit-advanced.webp`,
  linn:   `${BASE}/kit-linn.webp`,
  funk:   `${BASE}/kit-funk.webp`,
  cr78:   `${BASE}/kit-cr78.webp`,
  tr808:  `${BASE}/kit-tr808.webp`,
  techno: `${BASE}/kit-electronic.webp`,
  stark:  `${BASE}/kit-stark.webp`,
  house:  `${BASE}/kit-house.webp`,
};
const KIT_CATEGORIES: { id: string; kits: KitType[] }[] = [
  { id: 'acoustic', kits: ['ludwig', 'jazz', 'rmm', 'chrome'] },
  { id: 'studio',   kits: ['studio', 'r8', 'linn', 'funk'] },
  { id: 'electric', kits: ['cr78', 'tr808', 'techno', 'stark'] },
  { id: 'ultrahd',  kits: ['house'] },
];

// ── Tabs ───────────────────────────────────────────────────────────────────
type DrumTab = 'songs' | 'patterns' | 'prefs';
const TAB_ORDER: DrumTab[] = ['songs', 'patterns', 'prefs'];

// ── SVG note heads (memoized — rendered hundreds of times in the grid) ─────
const CircleHead = memo(function CircleHead({ r, color, strokeColor }: { r: number; color: string; strokeColor?: string }) {
  return <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} stroke={strokeColor} strokeWidth={strokeColor ? 1 : 0} />;
});
const XHead = memo(function XHead({ r, color, opacity = 1, strokeColor }: { r: number; color: string; opacity?: number; strokeColor?: string }) {
  const d = r * 0.85;
  return (
    <g opacity={opacity}>
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
});
const GhostHead = memo(function GhostHead({ r, color, strokeColor }: { r: number; color: string; strokeColor?: string }) {
  return <ellipse cx={0} cy={0} rx={r * 0.62} ry={r * 0.62 * 0.82} fill={color} opacity={0.40} stroke={strokeColor} strokeWidth={strokeColor ? 0.8 : 0} />;
});
const RimshotHead = memo(function RimshotHead({ r, color, strokeColor }: { r: number; color: string; strokeColor?: string }) {
  const d = r * 0.60;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill="none" stroke={color} strokeWidth={1.3} />
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </>
  );
});
const FlamHead = memo(function FlamHead({ r, color, strokeColor }: { r: number; color: string; strokeColor?: string }) {
  const gr = r * 0.50;
  return (
    <>
      <ellipse cx={-r * 1.05} cy={-r * 0.95} rx={gr} ry={gr * 0.82} fill={color} opacity={0.72} stroke={strokeColor} strokeWidth={strokeColor ? 0.8 : 0} />
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} stroke={strokeColor} strokeWidth={strokeColor ? 1 : 0} />
    </>
  );
});
const AccentHead = memo(function AccentHead({ r, color, strokeColor }: { r: number; color: string; strokeColor?: string }) {
  const oy = r * 2.1;
  return (
    <>
      <polyline
        points={`${-r * 0.58},${-oy} 0,${-oy - r * 0.72} ${r * 0.58},${-oy}`}
        fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"
      />
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} stroke={strokeColor} strokeWidth={strokeColor ? 1 : 0} />
    </>
  );
});
const OpenHHHead = memo(function OpenHHHead({ r, color, strokeColor }: { r: number; color: string; strokeColor?: string }) {
  const d = r * 0.62;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill="none" stroke={color} strokeWidth={1.4} />
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </>
  );
});
const BellHead = memo(function BellHead({ r, color, strokeColor }: { r: number; color: string; strokeColor?: string }) {
  const rx = r * 0.82; const ry = r * 0.95;
  return <polygon points={`0,${-ry} ${rx},0 0,${ry} ${-rx},0`} fill={color} />;
});
const ChokeHead = memo(function ChokeHead({ r, color, strokeColor }: { r: number; color: string; strokeColor?: string }) {
  const d = r * 0.62;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r * 1.08} ry={r * 0.92} fill="none" stroke={color} strokeWidth={1.2} />
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </>
  );
});

const NoteHead = memo(function NoteHead({ inst, variation, r, color, strokeColor }: {
  inst: DrumInstrument; variation: NoteVariation; r: number; color: string; strokeColor?: string;
}) {
  // HH-family and cymbals that default to X
  if (inst === 'hihat-closed') {
    if (variation === 'open')  return <OpenHHHead r={r} color={color} strokeColor={strokeColor} />;
    if (variation === 'pedal') return <XHead      r={r} color={color} strokeColor={strokeColor} />;
    return <XHead r={r} color={color} strokeColor={strokeColor} />;
  }
  if (inst === 'crash') {
    if (variation === 'choke') return <ChokeHead r={r} color={color} strokeColor={strokeColor} />;
    if (variation === 'bell')  return <BellHead  r={r} color={color} strokeColor={strokeColor} />;
    if (variation === 'ride')  return <XHead     r={r} color={color} strokeColor={strokeColor} opacity={0.65} />;
    return <XHead r={r} color={color} strokeColor={strokeColor} />;
  }
  if (inst === 'ride') {
    if (variation === 'bell') return <BellHead r={r} color={color} strokeColor={strokeColor} />;
    return <XHead r={r} color={color} strokeColor={strokeColor} />;
  }
  // Circle-family instruments
  if (inst === 'snare') {
    if (variation === 'ghost')   return <GhostHead   r={r} color={color} strokeColor={strokeColor} />;
    if (variation === 'rimshot') return <RimshotHead r={r} color={color} strokeColor={strokeColor} />;
    if (variation === 'flam')    return <FlamHead    r={r} color={color} strokeColor={strokeColor} />;
    return <CircleHead r={r} color={color} strokeColor={strokeColor} />;
  }
  if (variation === 'accent') return <AccentHead r={r} color={color} strokeColor={strokeColor} />;
  return <CircleHead r={r} color={color} strokeColor={strokeColor} />;
});

// A cell's hit info: variation + velocity (0–127). Replaces what used to be
// just a NoteVariation so the row can render velocity bars without a second
// store lookup.


// ── Instrument row SVG ─────────────────────────────────────────────────────
interface RowProps {
  inst: DrumInstrument;
  mStartIdx: number;
  rowMeasures: DrumMeasure[];
  spm: number;
  stepsPerBeat: number;
  STEP_W: number;
  MEASURE_W: number;
  noteColor: string;
  staffColor: string;
  barColor: string;
  altBg: string;
  showVariations: boolean;
  gridEmphasis: boolean;
  accentFrom: string;
  ROW_H: number;
  isLight: boolean;
}
const InstrumentRow = memo(({
  inst, mStartIdx, rowMeasures, spm, stepsPerBeat, STEP_W, MEASURE_W,
  noteColor, staffColor, barColor, altBg, showVariations, gridEmphasis, accentFrom, ROW_H, isLight,
}: RowProps) => {
  const totalW     = rowMeasures.length * MEASURE_W;
  const defaultNoteY = NOTE_YF[inst] * ROW_H;
  const NOTE_R     = 4.5;

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
      {/* Per-step cell dividers */}
      {rowMeasures.map((_, mi) =>
        Array.from({ length: spm }, (__, s) => {
          if (s === 0) return null;
          const x = (mi * spm + s) * STEP_W;
          const onBeat = s % stepsPerBeat === 0;
          return <line key={`s-${mi}-${s}`} x1={x} y1={0} x2={x} y2={ROW_H}
            stroke={isLight ? 'rgba(9, 9, 11, 0.15)' : 'rgba(255, 255, 255, 0.08)'}
            strokeWidth={onBeat ? 1.0 : 0.7}
            opacity={onBeat ? (gridEmphasis ? 1.0 : 0.75) : (gridEmphasis ? 0.6 : 0.4)} />;
        })
      )}
      {/* Top + bottom row borders */}
      <line x1={0} y1={0} x2={totalW} y2={0} stroke={isLight ? 'rgba(9, 9, 11, 0.12)' : 'rgba(255, 255, 255, 0.06)'} strokeWidth={0.8} />
      <line x1={0} y1={ROW_H} x2={totalW} y2={ROW_H} stroke={isLight ? 'rgba(9, 9, 11, 0.12)' : 'rgba(255, 255, 255, 0.06)'} strokeWidth={0.8} />
      {/* Measure bar lines */}
      {rowMeasures.map((_, mi) => (
        <line key={mi} x1={mi * MEASURE_W} y1={0} x2={mi * MEASURE_W} y2={ROW_H} stroke={barColor} strokeWidth={mi === 0 ? 1.5 : 1.2} />
      ))}
      <line x1={totalW} y1={0} x2={totalW} y2={ROW_H} stroke={barColor} strokeWidth={1.5} />
      {/* Velocity bars */}
      {rowMeasures.map((m, mi) => {
        const hits = m.hits[inst] ?? [];
        return Array.from({ length: spm }, (__, s) => {
          const hit = hits.find(h => h.step === s);
          if (!hit) return null;
          const vel     = typeof hit.velocity === 'number' ? hit.velocity : DEFAULT_VELOCITY;
          const cellW   = STEP_W - 3;
          const frac    = Math.max(0.06, Math.min(1, vel / MAX_VELOCITY));
          const w       = cellW * frac;
          const x       = (mi * spm + s) * STEP_W + (STEP_W - w) / 2;
          const op      = 0.32 + frac * 0.45;
          return (
            <rect
              key={`v-${mi}-${s}`}
              x={x} y={ROW_H - 2.4}
              width={w} height={1.4}
              rx={0.7}
              fill={accentFrom}
              opacity={op}
              pointerEvents="none"
            />
          );
        });
      })}
      {/* Note heads */}
      {rowMeasures.map((m, mi) => {
        const hits = m.hits[inst] ?? [];
        return Array.from({ length: spm }, (__, s) => {
          const hit = hits.find(h => h.step === s);
          if (!hit) return null;
          const rawVariation = hit.variation ?? 'normal';
          const variation: NoteVariation = showVariations ? rawVariation : 'normal';

          const noteY =
            (inst === 'hihat-closed' && rawVariation === 'pedal' && showVariations) ? ROW_H * 0.86 :
            (inst === 'crash' && (rawVariation === 'ride' || rawVariation === 'bell') && showVariations) ? ROW_H * 0.28 :
            defaultNoteY;

          const cx     = (mi * spm + s) * STEP_W + STEP_W / 2;
          const cy     = noteY;
          const stemUp = cy > ROW_H * 0.5;
          const stemY1 = stemUp ? cy - NOTE_R * 0.9  : cy + NOTE_R * 0.9;
          const stemY2 = stemUp ? cy - NOTE_R * 3.5  : cy + NOTE_R * 3.5;

          const isGhost = showVariations && variation === 'ghost';
          
          const strokeColor = isLight ? '#ffffff' : '#141418';
          const instColor = INSTRUMENT_COLOR[inst] ?? noteColor;

          return (
            <g key={`${mi}-${s}`} transform={`translate(${cx}, ${cy})`}>
              {isGhost ? (
                <>
                  <text x={-NOTE_R * 1.9} y={NOTE_R * 0.38} fontSize={NOTE_R * 1.7} fill={instColor} opacity={0.38} fontFamily="serif" dominantBaseline="middle">(</text>
                  <text x={NOTE_R * 0.95}  y={NOTE_R * 0.38} fontSize={NOTE_R * 1.7} fill={instColor} opacity={0.38} fontFamily="serif" dominantBaseline="middle">)</text>
                </>
              ) : (
                <line
                  x1={stemUp ? NOTE_R * 0.75 : -NOTE_R * 0.75} y1={stemY1 - cy}
                  x2={stemUp ? NOTE_R * 0.75 : -NOTE_R * 0.75} y2={stemY2 - cy}
                  stroke={instColor} strokeWidth={1.2} strokeLinecap="round"
                />
              )}
              <NoteHead inst={inst} variation={variation} r={NOTE_R} color={instColor} strokeColor={strokeColor} />
            </g>
          );
        });
      })}
    </svg>
  );
}, (prev, next) => {
  if (prev.inst !== next.inst) return false;
  if (prev.mStartIdx !== next.mStartIdx) return false;
  if (prev.spm !== next.spm) return false;
  if (prev.stepsPerBeat !== next.stepsPerBeat) return false;
  if (prev.STEP_W !== next.STEP_W) return false;
  if (prev.MEASURE_W !== next.MEASURE_W) return false;
  if (prev.noteColor !== next.noteColor) return false;
  if (prev.staffColor !== next.staffColor) return false;
  if (prev.barColor !== next.barColor) return false;
  if (prev.altBg !== next.altBg) return false;
  if (prev.showVariations !== next.showVariations) return false;
  if (prev.gridEmphasis !== next.gridEmphasis) return false;
  if (prev.accentFrom !== next.accentFrom) return false;
  if (prev.ROW_H !== next.ROW_H) return false;
  if (prev.isLight !== next.isLight) return false;

  if (prev.rowMeasures.length !== next.rowMeasures.length) return false;

  for (let i = 0; i < prev.rowMeasures.length; i++) {
    const prevHits = prev.rowMeasures[i].hits[prev.inst];
    const nextHits = next.rowMeasures[i].hits[next.inst];
    if (prevHits !== nextHits) return false;
  }
  return true;
});

// ── Tab icons ──────────────────────────────────────────────────────────────
function IconDrumSongs({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6; const ao = active ? 0.13 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth={sw} fill="currentColor" fillOpacity={ao} />
      <line x1="7.5" y1="8"  x2="16.5" y2="8"  stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
      <line x1="7.5" y1="16" x2="13"   y2="16" stroke="currentColor" strokeWidth={sw - 0.4} strokeLinecap="round" />
    </svg>
  );
}
function IconPatterns({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth={sw} />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth={sw * 0.7} />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth={sw * 0.7} />
      <circle cx="7" cy="6" r="1.2" fill="currentColor" />
      <circle cx="12" cy="6" r="1.2" fill="currentColor" />
      <circle cx="17" cy="12" r="1.2" fill="currentColor" />
      <circle cx="7" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="18" r="1.2" fill="currentColor" />
      <circle cx="17" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}
function IconMixer({ active }: { active: boolean }) {
  const sw = active ? 2 : 1.6; const ao = active ? 1 : 0;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <line x1="5"  y1="19" x2="5"  y2="10" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="5"  cy="10" r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor" strokeWidth={active ? 0 : sw - 0.3} />
      <line x1="12" y1="19" x2="12" y2="6" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="12" cy="6"  r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor" strokeWidth={active ? 0 : sw - 0.3} />
      <line x1="19" y1="19" x2="19" y2="13" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <circle cx="19" cy="13" r="2.2" fill="currentColor" fillOpacity={ao} stroke="currentColor" strokeWidth={active ? 0 : sw - 0.3} />
    </svg>
  );
}

function IconPrefs({ active }: { active: boolean }) {
  const sw = active ? 2.2 : 1.7;
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" style={{ display: 'block' }}>
      <line x1="4" y1="6"  x2="20" y2="6"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="8" y1="3"  x2="8"  y2="9"  stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="14" y1="9" x2="14" y2="15" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      <line x1="10" y1="15" x2="10" y2="21" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

// ── Bottom nav (Songs / Patterns / Prefs) ──────────────────────────────────
function useDrumNavTabs(): { id: DrumTab; label: string; Icon: React.FC<{ active: boolean }> }[] {
  const t = useT();
  return [
    { id: 'songs',    label: t.drum.songs,       Icon: IconDrumSongs },
    { id: 'patterns', label: t.drum.patterns,     Icon: IconPatterns  },
    { id: 'prefs',    label: t.drum.preferences,  Icon: IconPrefs     },
  ];
}
function DrumNav({ activeTab, setTab, accent, isLight, isAmoled, hidden }: {
  activeTab: DrumTab; setTab: (t: DrumTab) => void;
  accent: { from: string; to: string };
  isLight: boolean; isAmoled: boolean;
  hidden?: boolean;
}) {
  const ALL_NAV_TABS = useDrumNavTabs();
  const navRef  = useRef<HTMLElement | null>(null);
  useLiquidGlassNav(navRef);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const prevIdx = useRef(ALL_NAV_TABS.findIndex(x => x.id === activeTab));
  const strT    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressed, setPressed] = useState<DrumTab | null>(null);
  const navCollapsed = useNavCollapsed();
  const [expandedH, setExpandedH] = useState(56);
  const [expandedW, setExpandedW] = useState(360);
  useEffect(() => {
    if (navRef.current) {
      setExpandedH(navRef.current.offsetHeight);
      setExpandedW(navRef.current.offsetWidth);
    }
  }, []);

  const measure = (idx: number) => {
    const btn = btnRefs.current[idx]; const nav = navRef.current;
    if (!btn || !nav) return null;
    const nr = nav.getBoundingClientRect(); const br = btn.getBoundingClientRect();
    return { left: br.left - nr.left, right: br.right - nr.left };
  };
  useEffect(() => {
    const m = measure(ALL_NAV_TABS.findIndex(x => x.id === activeTab));
    if (m) setPill({ ...m, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ni = ALL_NAV_TABS.findIndex(x => x.id === activeTab);
    const oi = prevIdx.current;
    if (ni === oi) return;
    prevIdx.current = ni;
    if (strT.current) { clearTimeout(strT.current); strT.current = null; }
    const nm = measure(ni);
    if (!nm) return;
    const om = measure(oi);
    if (ni > oi) {
      setPill(p => ({ ...p, left: om?.left ?? p.left, right: nm.right }));
      strT.current = setTimeout(() => setPill(p => ({ ...p, left: nm.left })), 90);
    } else {
      setPill(p => ({ ...p, left: nm.left, right: om?.right ?? p.right }));
      strT.current = setTimeout(() => setPill(p => ({ ...p, right: nm.right })), 90);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <nav ref={navRef} className="glass-nav" style={{
      position: 'fixed', left: '50%',
      transform: `translateX(-50%) translateY(${hidden ? 'calc(100% + 32px)' : '0px'})`,
      bottom: 'max(10px, env(safe-area-inset-bottom))',
      width: '88%',
      maxWidth: '360px',
      height: `${expandedH}px`,
      borderRadius: '2rem',
      border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.32)'}`,
      background: isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(255, 255, 255, 0.40)' : 'rgba(26,26,30,0.82)'),
      boxShadow: isLight
        ? '0 8px 32px rgba(0,0,0,0.14), 0 1.5px 0 rgba(255,255,255,0.80) inset'
        : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
      zIndex: 50, overflow: 'hidden',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      clipPath: navCollapsed
        ? `inset(${Math.max(0, expandedH - 5)}px ${Math.max(0, Math.floor((expandedW - 90) / 2))}px 0 ${Math.max(0, Math.floor((expandedW - 90) / 2))}px round 99px)`
        : 'inset(0 0 0 0 round 2rem)',
      willChange: 'clip-path, transform',
      transition: [
        navCollapsed
          ? 'clip-path 500ms cubic-bezier(0.4,0,0.2,1)'
          : 'clip-path 380ms cubic-bezier(0.16,1,0.3,1)',
        navCollapsed
          ? 'transform 500ms cubic-bezier(0.4,0,0.2,1)'
          : 'transform 380ms cubic-bezier(0.16,1,0.3,1)',
        'background-color 300ms ease',
      ].join(', '),
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '6px 8px',
        opacity: navCollapsed ? 0 : 1,
        transition: navCollapsed ? 'opacity 100ms ease' : 'opacity 350ms ease 180ms',
        willChange: 'opacity',
      }}>
      {pill.ready && (
        <div aria-hidden style={{
          position: 'absolute', top: 4, left: pill.left, width: pill.right - pill.left,
          height: 'calc(100% - 8px)', borderRadius: '9999px',
          background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.09)',
          border: isLight ? '1.5px solid rgba(0,0,0,0.14)' : '1.5px solid rgba(255,255,255,0.30)',
          boxShadow: isLight
            ? 'inset 0 1px 0 rgba(255,255,255,0.90), 0 2px 8px rgba(0,0,0,0.10)'
            : 'inset 0 1px 0 rgba(255,255,255,0.40), 0 2px 16px rgba(255,255,255,0.06)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'none', zIndex: 0,
          opacity: 1,
          transition: 'left 300ms cubic-bezier(0.16,1,0.3,1), width 300ms cubic-bezier(0.16,1,0.3,1)',
        }} />
      )}
      {ALL_NAV_TABS.map(({ id, label, Icon }, i) => {
        const isActive = activeTab === id; const isPressed = pressed === id;
        return (
          <button key={id} ref={el => { btnRefs.current[i] = el; }}
            onPointerDown={() => setPressed(id)}
            onPointerUp={() => { setPressed(null); setTab(id); }}
            onPointerLeave={() => setPressed(null)} onPointerCancel={() => setPressed(null)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '8px 4px', borderRadius: '9999px', background: 'transparent', border: 'none',
              cursor: 'pointer', color: isActive ? (isLight ? accent.from : '#fff') : (isLight ? 'rgba(0,0,0,0.4)' : '#71717a'), position: 'relative', zIndex: 1,
              opacity: 1,
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
      </div>
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

// ── Export config ───────────────────────────────────────────────────────────
interface DrumExportConfig {
  theme: 'light' | 'dark';
  style: 'compact' | 'normal' | 'elegant';
}
const DEFAULT_DRUM_EXPORT_CONFIG: DrumExportConfig = { theme: 'dark', style: 'normal' };

// ── JSON export ─────────────────────────────────────────────────────────────
async function exportDrumSongJSON(patterns: DrumPattern[], song: DrumSong | null, mode: 'save' | 'share' = 'share') {
  const payload = {
    _app: 'Drumex',
    exportedAt: new Date().toISOString(),
    song: song ? { id: song.id, name: song.name, artist: song.artist, notes: song.notes } : null,
    patterns: patterns.map(p => ({
      id: p.id, name: p.name, bpm: p.bpm, subdivision: p.subdivision,
      mutedInstruments: p.mutedInstruments ?? [],
      measures: p.measures.map((m: DrumMeasure) => ({ id: m.id, hits: m.hits })),
    })),
  };
  const fileName = `${song?.name ?? 'drumex'}.json`;
  const jsonStr  = JSON.stringify(payload, null, 2);
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share }                 = await import('@capacitor/share');
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      const written = await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Cache, recursive: true });
      if (mode === 'share') await Share.share({ title: fileName, url: written.uri });
      else await Filesystem.writeFile({ path: `Download/${fileName}`, data: b64, directory: Directory.ExternalStorage, recursive: true });
    } catch { /* fall through to web download */ }
    return;
  }
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export ──────────────────────────────────────────────────────────────
const HEX_TO_RGB = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Instruments that use an X notehead (cymbals)
const IS_CYMBAL: Partial<Record<DrumInstrument, boolean>> = {
  crash: true, ride: true, 'hihat-closed': true, 'hihat-open': true, 'hihat-foot': true,
};
// Instruments whose stem goes downward
const STEM_DOWN: Partial<Record<DrumInstrument, boolean>> = {
  kick: true, 'hihat-foot': true,
};

async function exportDrumSongPDF(
  patterns: DrumPattern[],
  song:     DrumSong | null,
  accent:   { from: string; to: string },
  _cfg:     DrumExportConfig = DEFAULT_DRUM_EXPORT_CONFIG,
  pdfName   = '',
  mode: 'save' | 'share' = 'share',
): Promise<boolean> {
  const { jsPDF } = await import('jspdf');
  const [ar, ag, ab] = HEX_TO_RGB(accent.from);

  // ── Page setup — A3 landscape ─────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const PW = 420, PH = 297;
  const ML = 10, MR = 10, MT = 12, MB = 10;

  // ── Layout constants ──────────────────────────────────────────────────────
  const LABEL_COL = 30;       // mm — left label column
  const GRID_W    = PW - ML - MR - LABEL_COL;  // 370mm usable grid
  const ROW_H     = 8.5;      // mm per instrument row (larger = more readable)
  const SYS_GAP   = 6;        // mm between systems
  const PAT_GAP   = 12;       // mm between patterns
  const HDR_H     = 22;       // mm for song header
  const NR        = 1.35;     // notehead radius
  const BARS_PER_ROW = 4;     // always 4 bars per system row

  // ── Dark editor palette ───────────────────────────────────────────────────
  const BG     = [17,  17,  23 ] as const;
  const LBG    = [22,  22,  32 ] as const;
  const CELL_A = [22,  22,  30 ] as const;
  const CELL_B = [28,  28,  38 ] as const;
  const C_ROW  = [38,  38,  52 ] as const;
  const C_BEAT = [55,  55,  70 ] as const;
  const C_BAR  = [75,  75,  95 ] as const;
  const C_NOTE = [230, 230, 240] as const;
  const C_TXT  = [210, 210, 220] as const;
  const C_SUB  = [110, 110, 128] as const;

  const fill   = (r: number, g: number, b: number) => doc.setFillColor(r, g, b);
  const stroke = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b);
  const textC  = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);

  const drawXNote = (cx: number, cy: number, r: number) => {
    const d = r * 0.9;
    doc.setLineWidth(0.85);
    doc.line(cx - d, cy - d, cx + d, cy + d);
    doc.line(cx - d, cy + d, cx + d, cy - d);
  };

  const drawOvalNote = (cx: number, cy: number, filled: boolean) => {
    doc.setLineWidth(0.38);
    doc.ellipse(cx, cy, NR * 1.25, NR * 0.85, filled ? 'FD' : 'D');
  };

  const drawStemNote = (cx: number, cy: number, stemDown: boolean, rowTop: number) => {
    doc.setLineWidth(0.38);
    const sx = cx + (stemDown ? -NR * 0.9 : NR * 0.9);
    const sy1 = cy + (stemDown ?  NR * 0.38 : -NR * 0.38);
    const sy2 = stemDown ? (rowTop + ROW_H - 0.8) : (rowTop + 0.8);
    doc.line(sx, sy1, sx, sy2);
  };

  // ── Page header ───────────────────────────────────────────────────────────
  let page = 1;
  const drawHeader = (cont: boolean) => {
    fill(BG[0], BG[1], BG[2]); doc.rect(0, 0, PW, PH, 'F');
    const title  = pdfName || song?.name || 'Drum Sheet';
    const artist = song?.artist ?? '';
    fill(ar, ag, ab); doc.rect(ML, MT + 2, 3.5, 14, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(20); textC(C_TXT[0], C_TXT[1], C_TXT[2]);
    doc.text(title.toUpperCase(), ML + 9, MT + 12);
    if (artist) {
      doc.setFont('helvetica', 'normal').setFontSize(10); textC(C_SUB[0], C_SUB[1], C_SUB[2]);
      doc.text(artist, ML + 9, MT + 18);
    }
    stroke(ar, ag, ab); doc.setLineWidth(0.4);
    doc.line(ML, MT + HDR_H - 1, PW - MR, MT + HDR_H - 1);
    doc.setFont('helvetica', 'normal').setFontSize(8); textC(C_SUB[0], C_SUB[1], C_SUB[2]);
    doc.text(`${page}`, PW - MR, PH - 5, { align: 'right' });
    if (cont) doc.text('(cont.)', ML, PH - 5);
  };
  const newPage = () => { doc.addPage(); page++; drawHeader(true); };
  drawHeader(false);
  let curY = MT + HDR_H;

  // ── Render each pattern ───────────────────────────────────────────────────
  for (let patIdx = 0; patIdx < patterns.length; patIdx++) {
    const pat  = patterns[patIdx];
    const subs = pat.subdivision ?? 16;
    const [timN, timD] = pat.timeSignature ?? [4, 4];
    const stepsPerBeat = subs / timN;

    const allInsts: DrumInstrument[] = DRUM_INSTRUMENTS.filter((i: DrumInstrument) =>
      !(pat.mutedInstruments ?? []).includes(i) &&
      pat.measures.some((m: DrumMeasure) => (m.hits[i]?.length ?? 0) > 0)
    );
    if (allInsts.length === 0) continue;

    const SYS_H   = allInsts.length * ROW_H;
    const PAT_HDR = 9;
    // Fixed bars-per-row so the grid always uses full page width
    const barsPerRow = Math.min(pat.measures.length, BARS_PER_ROW);
    const CELL = GRID_W / (barsPerRow * subs); // always fills GRID_W exactly

    // Pattern header row
    if (curY + PAT_HDR + SYS_H > PH - MB) { newPage(); curY = MT + HDR_H; }
    fill(ar, ag, ab); doc.rect(ML, curY, PW - ML - MR, PAT_HDR - 1, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9); textC(255, 255, 255); doc.setTextColor(255, 255, 255);
    doc.text(pat.name, ML + LABEL_COL + 3, curY + 6.5);
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    doc.text(`   ♩ = ${pat.bpm}   ${timN}/${timD}   1/${subs}`,
      ML + LABEL_COL + 3 + doc.getTextWidth(pat.name), curY + 6.5);
    curY += PAT_HDR;

    // ── Systems (rows of bars) ───────────────────────────────────────────────
    for (let rowStart = 0; rowStart < pat.measures.length; rowStart += barsPerRow) {
      if (curY + SYS_H + 4 > PH - MB) { newPage(); curY = MT + HDR_H; }

      const rowBars  = pat.measures.slice(rowStart, rowStart + barsPerRow);
      const gridLeft = ML + LABEL_COL;
      const rowW     = GRID_W; // always full page width

      // ── Background cells — always fill full rowW including empty ghost bars ─
      for (let ri = 0; ri < allInsts.length; ri++) {
        const rowTop = curY + ri * ROW_H;
        for (let bi = 0; bi < barsPerRow; bi++) {       // ← barsPerRow, not rowBars.length
          for (let s = 0; s < subs; s++) {
            const beat = Math.floor(s / stepsPerBeat);
            const bg = beat % 2 === 0 ? CELL_A : CELL_B;
            fill(bg[0], bg[1], bg[2]);
            doc.rect(gridLeft + (bi * subs + s) * CELL, rowTop, CELL, ROW_H, 'F');
          }
        }
      }

      // ── Label column ─────────────────────────────────────────────────────
      fill(LBG[0], LBG[1], LBG[2]); doc.rect(ML, curY, LABEL_COL, SYS_H, 'F');
      for (let ri = 0; ri < allInsts.length; ri++) {
        const inst   = allInsts[ri];
        const rowTop = curY + ri * ROW_H;
        const [cr, cg, cb] = HEX_TO_RGB(INSTRUMENT_COLOR[inst as DrumInstrument] ?? accent.from);
        fill(cr, cg, cb); doc.rect(ML + 2, rowTop + ROW_H * 0.22, 2.5, ROW_H * 0.56, 'F');
        doc.setFont('helvetica', 'bold').setFontSize(6); textC(C_TXT[0], C_TXT[1], C_TXT[2]);
        doc.text(INST_LABEL[inst as DrumInstrument] ?? inst, ML + 6.5, rowTop + ROW_H * 0.60);
        if (ri > 0) { stroke(C_ROW[0], C_ROW[1], C_ROW[2]); doc.setLineWidth(0.22); doc.line(ML, rowTop, ML + LABEL_COL + rowW, rowTop); }
      }

      // ── Grid lines: beat + bar (draw across full barsPerRow width) ────────
      for (let bi = 0; bi < barsPerRow; bi++) {         // ← barsPerRow
        for (let s = 1; s < subs; s++) {
          const lx = gridLeft + (bi * subs + s) * CELL;
          if (s % stepsPerBeat === 0) { stroke(C_BEAT[0], C_BEAT[1], C_BEAT[2]); doc.setLineWidth(0.32); }
          else { stroke(C_ROW[0], C_ROW[1], C_ROW[2]); doc.setLineWidth(0.14); }
          doc.line(lx, curY, lx, curY + SYS_H);
        }
      }
      for (let bi = 0; bi <= barsPerRow; bi++) {        // ← barsPerRow
        const bx = gridLeft + bi * subs * CELL;
        stroke(C_BAR[0], C_BAR[1], C_BAR[2]); doc.setLineWidth(bi === 0 || bi === barsPerRow ? 0.6 : 0.45);
        doc.line(bx, curY, bx, curY + SYS_H);
        if (bi < rowBars.length) { // bar numbers only for actual bars
          doc.setFont('helvetica', 'normal').setFontSize(5.5); textC(C_SUB[0], C_SUB[1], C_SUB[2]);
          doc.text(`${rowStart + bi + 1}`, bx + 1.2, curY - 1.2);
        }
      }
      // Top/bottom system borders (full width)
      stroke(C_BAR[0], C_BAR[1], C_BAR[2]); doc.setLineWidth(0.5);
      doc.line(ML, curY, ML + LABEL_COL + rowW, curY);
      doc.line(ML, curY + SYS_H, ML + LABEL_COL + rowW, curY + SYS_H);

      // ── Draw hits ────────────────────────────────────────────────────────
      for (let ri = 0; ri < allInsts.length; ri++) {
        const inst    = allInsts[ri];
        const rowTop  = curY + ri * ROW_H;
        const cy      = rowTop + ROW_H / 2;
        const isCym   = !!IS_CYMBAL[inst as DrumInstrument];
        const stemDn  = !!STEM_DOWN[inst as DrumInstrument];

        for (let bi = 0; bi < rowBars.length; bi++) {
          const meas = rowBars[bi];
          const hits = meas.hits[inst as DrumInstrument];
          if (!hits?.length) continue;
          for (const hit of hits) {
            const cx = gridLeft + (bi * subs + hit.step + 0.5) * CELL;
            stroke(C_NOTE[0], C_NOTE[1], C_NOTE[2]); fill(C_NOTE[0], C_NOTE[1], C_NOTE[2]);
            if (isCym) {
              drawXNote(cx, cy, NR);
              if (hit.variation === 'open' || inst === 'hihat-open') {
                doc.setLineWidth(0.28);
                doc.ellipse(cx, cy - NR * 2.1, NR * 0.85, NR * 0.6, 'D');
              }
              if (hit.variation === 'bell') {
                fill(C_NOTE[0], C_NOTE[1], C_NOTE[2]); doc.ellipse(cx, cy, NR * 0.45, NR * 0.35, 'F');
              }
            } else {
              const isGhost = hit.variation === 'ghost';
              drawOvalNote(cx, cy, !isGhost);
              if (isGhost) {
                doc.setFontSize(6.5); textC(C_NOTE[0], C_NOTE[1], C_NOTE[2]);
                doc.text('(', cx - NR * 2.0, cy + NR * 1.0);
                doc.text(')', cx + NR * 0.85, cy + NR * 1.0);
              }
              if (hit.variation === 'accent') {
                doc.setFont('helvetica', 'bold').setFontSize(6); textC(C_NOTE[0], C_NOTE[1], C_NOTE[2]);
                doc.text('>', cx - NR * 0.4, stemDn ? cy + NR * 4.5 : cy - NR * 3.2);
              }
            }
            stroke(C_NOTE[0], C_NOTE[1], C_NOTE[2]); drawStemNote(cx, cy, stemDn, rowTop);
          }
        }
      }

      curY += SYS_H + SYS_GAP;
    }
    if (patIdx < patterns.length - 1) curY += PAT_GAP - SYS_GAP;
  }

  const fileName = `${pdfName || song?.name || 'drumex'}.pdf`;
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const b64 = doc.output('datauristring').split(',')[1];
      if (mode === 'save') {
        try { await Filesystem.writeFile({ path: `Download/${fileName}`, data: b64, directory: Directory.ExternalStorage, recursive: true }); return true; }
        catch { await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.External, recursive: true }); return true; }
      } else {
        const written = await Filesystem.writeFile({ path: fileName, data: b64, directory: Directory.Cache, recursive: true });
        await Share.share({ title: fileName, url: written.uri });
        return true;
      }
    } catch { return false; }
  }
  doc.save(fileName);
  return true;
}

// ── DrumPaperPreview ────────────────────────────────────────────────────────
// Renders the same layout as exportDrumSongPDF but as a scaled-down SVG.
// Uses the identical coordinate space (mm units, A3 landscape = 420×297)
// so it looks exactly like the real PDF, just smaller.
function DrumPaperPreview({ patterns, song, accent }: {
  patterns: DrumPattern[];
  song: DrumSong | null;
  cfg: DrumExportConfig;
  accent: { from: string; to: string };
}) {
  // ── Same constants as exportDrumSongPDF ──────────────────────────────────
  const PW = 420, PH = 297;
  const ML = 10, MR = 10, MT = 12, MB = 10;
  const LABEL_COL  = 30;
  const GRID_W     = PW - ML - MR - LABEL_COL;   // 370
  const ROW_H      = 8.5;
  const SYS_GAP    = 6;
  const PAT_GAP    = 12;
  const HDR_H      = 22;
  const NR         = 1.35;
  const BARS_PER_ROW = 4;
  const PAT_HDR    = 9;

  // ── Same palette as the PDF dark theme ───────────────────────────────────
  const BG     = '#111117';
  const LBG    = '#16161e';
  const CELL_A = '#16161e';
  const CELL_B = '#1c1c26';
  const C_ROW  = '#262634';
  const C_BEAT = '#373748';
  const C_BAR  = '#4b4b5f';
  const C_NOTE = '#e6e6f0';
  const C_TXT  = '#d2d2dc';
  const C_SUB  = '#6e6e80';

  // ── Build SVG elements ───────────────────────────────────────────────────
  const elems: React.ReactNode[] = [];
  let key = 0;
  const k = () => key++;

  // Background
  elems.push(<rect key={k()} x={0} y={0} width={PW} height={PH} fill={BG} />);

  // Header: accent bar + title
  const title  = song?.name ?? 'Drum Sheet';
  const artist = song?.artist ?? '';
  elems.push(<rect key={k()} x={ML} y={MT + 2} width={3.5} height={14} fill={accent.from} rx={0.5} />);
  elems.push(<text key={k()} x={ML + 9} y={MT + 12} fontFamily="Helvetica" fontWeight="bold"
    fontSize={20} fill={C_TXT}>{title.toUpperCase()}</text>);
  if (artist) {
    elems.push(<text key={k()} x={ML + 9} y={MT + 18} fontFamily="Helvetica" fontSize={10} fill={C_SUB}>{artist}</text>);
  }
  elems.push(<line key={k()} x1={ML} y1={MT + HDR_H - 1} x2={PW - MR} y2={MT + HDR_H - 1}
    stroke={accent.from} strokeWidth={0.4} />);

  let curY = MT + HDR_H;

  for (let patIdx = 0; patIdx < patterns.length; patIdx++) {
    const pat  = patterns[patIdx];
    const subs = pat.subdivision ?? 16;
    const [timN, timD] = pat.timeSignature ?? [4, 4];
    const stepsPerBeat = subs / timN;

    const allInsts: DrumInstrument[] = DRUM_INSTRUMENTS.filter((i: DrumInstrument) =>
      !(pat.mutedInstruments ?? []).includes(i) &&
      pat.measures.some((m: DrumMeasure) => (m.hits[i]?.length ?? 0) > 0)
    );
    if (allInsts.length === 0) continue;

    const SYS_H = allInsts.length * ROW_H;
    const barsPerRow = Math.min(pat.measures.length, BARS_PER_ROW);
    const CELL = GRID_W / (barsPerRow * subs);

    // Pattern header bar
    if (curY + PAT_HDR + SYS_H > PH - MB) break; // no room — stop
    elems.push(<rect key={k()} x={ML} y={curY} width={PW - ML - MR} height={PAT_HDR - 1} fill={accent.from} />);
    elems.push(<text key={k()} x={ML + LABEL_COL + 3} y={curY + 6.5} fontFamily="Helvetica" fontWeight="bold"
      fontSize={9} fill="#ffffff">{pat.name}</text>);
    elems.push(<text key={k()} x={ML + LABEL_COL + 3 + pat.name.length * 5.2} y={curY + 6.5}
      fontFamily="Helvetica" fontSize={7.5} fill="#ffffff">
      {`   ♩ = ${pat.bpm}   ${timN}/${timD}   1/${subs}`}
    </text>);
    curY += PAT_HDR;

    // ── Systems ────────────────────────────────────────────────────────────
    for (let rowStart = 0; rowStart < pat.measures.length; rowStart += barsPerRow) {
      if (curY + SYS_H + 4 > PH - MB) break;

      const rowBars  = pat.measures.slice(rowStart, rowStart + barsPerRow);
      const gridLeft = ML + LABEL_COL;

      // Background cells — full width (including ghost bars for short last row)
      for (let ri = 0; ri < allInsts.length; ri++) {
        const rowTop = curY + ri * ROW_H;
        for (let bi = 0; bi < barsPerRow; bi++) {
          for (let s = 0; s < subs; s++) {
            const beat = Math.floor(s / stepsPerBeat);
            const bg2  = beat % 2 === 0 ? CELL_A : CELL_B;
            elems.push(<rect key={k()} x={gridLeft + (bi * subs + s) * CELL} y={rowTop}
              width={CELL} height={ROW_H} fill={bg2} />);
          }
        }
      }

      // Label column
      elems.push(<rect key={k()} x={ML} y={curY} width={LABEL_COL} height={SYS_H} fill={LBG} />);
      for (let ri = 0; ri < allInsts.length; ri++) {
        const inst   = allInsts[ri];
        const rowTop = curY + ri * ROW_H;
        const color  = INSTRUMENT_COLOR[inst as DrumInstrument] ?? accent.from;
        elems.push(<rect key={k()} x={ML + 2} y={rowTop + ROW_H * 0.22} width={2.5} height={ROW_H * 0.56}
          fill={color} rx={0.5} />);
        elems.push(<text key={k()} x={ML + 6.5} y={rowTop + ROW_H * 0.60}
          fontFamily="Helvetica" fontWeight="bold" fontSize={6} fill={C_TXT}
          dominantBaseline="middle">
          {INST_LABEL[inst as DrumInstrument] ?? inst}
        </text>);
        if (ri > 0) {
          elems.push(<line key={k()} x1={ML} y1={rowTop} x2={ML + LABEL_COL + GRID_W} y2={rowTop}
            stroke={C_ROW} strokeWidth={0.22} />);
        }
      }

      // Grid lines: subdivisions, beats, bars
      for (let bi = 0; bi < barsPerRow; bi++) {
        for (let s = 1; s < subs; s++) {
          const lx = gridLeft + (bi * subs + s) * CELL;
          const isBeat = s % stepsPerBeat === 0;
          elems.push(<line key={k()} x1={lx} y1={curY} x2={lx} y2={curY + SYS_H}
            stroke={isBeat ? C_BEAT : C_ROW} strokeWidth={isBeat ? 0.32 : 0.14} />);
        }
      }
      for (let bi = 0; bi <= barsPerRow; bi++) {
        const bx = gridLeft + bi * subs * CELL;
        const thick = bi === 0 || bi === barsPerRow;
        elems.push(<line key={k()} x1={bx} y1={curY} x2={bx} y2={curY + SYS_H}
          stroke={C_BAR} strokeWidth={thick ? 0.6 : 0.45} />);
        if (bi < rowBars.length) {
          elems.push(<text key={k()} x={bx + 1.2} y={curY - 1.2} fontFamily="Helvetica"
            fontSize={5.5} fill={C_SUB}>{rowStart + bi + 1}</text>);
        }
      }
      // Top/bottom borders
      elems.push(<line key={k()} x1={ML} y1={curY} x2={ML + LABEL_COL + GRID_W} y2={curY}
        stroke={C_BAR} strokeWidth={0.5} />);
      elems.push(<line key={k()} x1={ML} y1={curY + SYS_H} x2={ML + LABEL_COL + GRID_W} y2={curY + SYS_H}
        stroke={C_BAR} strokeWidth={0.5} />);

      // Notes
      for (let ri = 0; ri < allInsts.length; ri++) {
        const inst   = allInsts[ri];
        const rowTop = curY + ri * ROW_H;
        const cy     = rowTop + ROW_H / 2;
        const isCym  = !!IS_CYMBAL[inst as DrumInstrument];
        const stemDn = !!STEM_DOWN[inst as DrumInstrument];

        for (let bi = 0; bi < rowBars.length; bi++) {
          for (const hit of (rowBars[bi].hits[inst as DrumInstrument] ?? [])) {
            const cx  = gridLeft + (bi * subs + hit.step + 0.5) * CELL;
            const sx  = cx + (stemDn ? -NR : NR) * 0.9;
            const sy1 = cy + (stemDn ? NR : -NR) * 0.38;
            const sy2 = stemDn ? rowTop + ROW_H - 0.8 : rowTop + 0.8;
            // Stem
            elems.push(<line key={k()} x1={sx} y1={sy1} x2={sx} y2={sy2}
              stroke={C_NOTE} strokeWidth={0.38} />);
            // Head
            if (isCym) {
              const d = NR * 0.9;
              elems.push(<line key={k()} x1={cx - d} y1={cy - d} x2={cx + d} y2={cy + d}
                stroke={C_NOTE} strokeWidth={0.85} />);
              elems.push(<line key={k()} x1={cx - d} y1={cy + d} x2={cx + d} y2={cy - d}
                stroke={C_NOTE} strokeWidth={0.85} />);
              if (hit.variation === 'open' || inst === 'hihat-open') {
                elems.push(<ellipse key={k()} cx={cx} cy={cy - NR * 2.1}
                  rx={NR * 0.85} ry={NR * 0.6}
                  stroke={C_NOTE} strokeWidth={0.28} fill="none" />);
              }
              if (hit.variation === 'bell') {
                elems.push(<ellipse key={k()} cx={cx} cy={cy}
                  rx={NR * 0.45} ry={NR * 0.35} fill={C_NOTE} />);
              }
            } else {
              const isGhost = hit.variation === 'ghost';
              elems.push(<ellipse key={k()} cx={cx} cy={cy}
                rx={NR * 1.25} ry={NR * 0.85}
                stroke={C_NOTE} strokeWidth={0.38}
                fill={isGhost ? 'none' : C_NOTE} />);
              if (isGhost) {
                elems.push(<text key={k()} x={cx - NR * 2.0} y={cy + NR * 1.0}
                  fontSize={6.5} fill={C_NOTE} fontFamily="Helvetica">(</text>);
                elems.push(<text key={k()} x={cx + NR * 0.85} y={cy + NR * 1.0}
                  fontSize={6.5} fill={C_NOTE} fontFamily="Helvetica">)</text>);
              }
              if (hit.variation === 'accent') {
                elems.push(<text key={k()} x={cx - NR * 0.4}
                  y={stemDn ? cy + NR * 4.5 : cy - NR * 3.2}
                  fontSize={6} fill={C_NOTE} fontFamily="Helvetica" fontWeight="bold">&gt;</text>);
              }
            }
          }
        }
      }

      curY += SYS_H + SYS_GAP;
    }
    if (patIdx < patterns.length - 1) curY += PAT_GAP - SYS_GAP;
  }

  return (
    <div style={{ width: '100%', aspectRatio: `${PW} / ${PH}`,
      borderRadius: 8, overflow: 'hidden',
      boxShadow: '0 16px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' }}>
      <svg viewBox={`0 0 ${PW} ${PH}`} width="100%" height="100%"
        style={{ display: 'block' }}>
        {elems}
      </svg>
    </div>
  );
}

// ── DrumExportModal ─────────────────────────────────────────────────────────
function DrumExportModal({ patterns, song, accent, onClose }: {
  patterns: DrumPattern[];
  song:     DrumSong | null;
  accent:   { from: string; to: string };
  onClose:  () => void;
}) {
  const [cfg,       setCfg]     = useState<DrumExportConfig>({ ...DEFAULT_DRUM_EXPORT_CONFIG });
  const [pdfName,   setPdfName] = useState('');
  const [saving,    setSaving]  = useState(false);
  const [sharing,   setSharing] = useState(false);
  const [saveRes,   setSaveRes] = useState<'ok' | 'fail' | null>(null);
  const [closing,   setClosing] = useState(false);
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [barVisible, setBarVisible] = useState(true);
  const lastScrollTop = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const sy = el.scrollTop;
      setBarVisible(sy <= lastScrollTop.current || sy < 50);
      lastScrollTop.current = sy;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const update = <K extends keyof DrumExportConfig>(k: K, v: DrumExportConfig[K]) =>
    setCfg(prev => ({ ...prev, [k]: v }));

  const handleClose = () => { setClosing(true); setTimeout(onClose, 320); };

  const handlePDF = async (mode: 'save' | 'share') => {
    if (mode === 'save') setSaving(true); else setSharing(true);
    await new Promise(r => setTimeout(r, 80));
    try {
      const ok = await exportDrumSongPDF(patterns, song, accent, cfg, pdfName, mode);
      if (mode === 'save') {
        setSaveRes(ok ? 'ok' : 'fail');
        setTimeout(() => setSaveRes(null), 3000);
      } else { handleClose(); }
    } finally {
      if (mode === 'save') setSaving(false); else setSharing(false);
    }
  };

  const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
    <button onClick={onChange} className="btn-smooth"
      style={{ width: 44, height: 26, borderRadius: 13, flexShrink: 0, position: 'relative',
        background: on ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(72,72,72,0.25)',
        transition: 'background 220ms' }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10,
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
        transition: 'left 220ms cubic-bezier(0.34,1.56,0.64,1)' }} />
    </button>
  );

  const Segment = <T extends string>({ options, value, onChange }: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
  }) => (
    <div style={{ display: 'flex', background: 'var(--app-surface)', borderRadius: 10, padding: 3, gap: 2 }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)} className="btn-smooth"
            style={{ flex: 1, padding: '6px 10px', borderRadius: 7, fontFamily: 'Manrope', fontWeight: 700,
              fontSize: 11, whiteSpace: 'nowrap',
              background: active ? 'var(--app-surface-highest)' : 'transparent',
              color: active ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.18)' : 'none',
              transition: 'all 160ms' }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const Row = ({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', background: 'var(--app-surface-high)', borderRadius: 14 }}>
      <div>
        <p style={{ fontFamily: 'Manrope', fontWeight: 600, fontSize: 14, color: 'var(--c-text-primary)' }}>{label}</p>
        {sub && <p style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-secondary)', marginTop: 1 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );

  const isWebDesktop = useIsWebDesktop();

  return (
    <div style={isWebDesktop ? { position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : { position: 'fixed', inset: 0, zIndex: 300, background: '#0e0e0e', display: 'flex', flexDirection: 'column', animation: closing ? 'sheet-down 320ms cubic-bezier(0.25,0.46,0.45,0.94) both' : 'sheet-up 340ms cubic-bezier(0.25,0.46,0.45,0.94) both' }}>
      <div style={isWebDesktop ? { position: 'relative', width: '560px', maxWidth: '90vw', maxHeight: '85vh', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', overflow: 'hidden' } : { display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
        {/* ── Header ── */}
        <div style={{ paddingTop: isWebDesktop ? '0' : 'env(safe-area-inset-top)', background: isWebDesktop ? 'transparent' : '#191a1a', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={handleClose} className="btn-smooth"
              style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: 22 }}>arrow_back</span>
            </button>
            <p style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#e7e5e4', lineHeight: 1 }}>
              Export Preview
            </p>
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, color: '#484848', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(72,72,72,0.3)' }}>
            PDF
          </span>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div ref={scrollRef} className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 170 }}>

        {/* Paper stage */}
        <div style={{ padding: '32px 24px 28px', background: '#0a0a0a', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <DrumPaperPreview patterns={patterns} song={song} cfg={cfg} accent={accent} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3a3a3a' }}>
              {patterns.length} {patterns.length === 1 ? 'pattern' : 'patterns'}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#3a3a3a', display: 'inline-block' }} />
            <span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3a3a3a' }}>
              A3 Landscape
            </span>
          </div>
        </div>

        {/* File name + note */}
        <div style={{ padding: '28px 20px 8px' }}>
          <p style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#484848', marginBottom: 10 }}>
            File Name
          </p>
          <input type="text" value={pdfName} onChange={e => setPdfName(e.target.value)}
            placeholder={song?.name ?? 'Beat'} maxLength={80}
            style={{ width: '100%', padding: '13px 16px', borderRadius: 12, background: '#191a1a',
              border: '1px solid rgba(72,72,72,0.25)', color: '#e7e5e4', fontFamily: 'Manrope', fontWeight: 600,
              fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 24,
              transition: 'border-color 200ms ease' }} />
          <div style={{ padding: '14px 16px', borderRadius: 12, background: `${accent.from}0d`, border: `1px solid ${accent.from}18`,
            display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: 15, flexShrink: 0, marginTop: 1, fontVariationSettings: "'FILL' 1" }}>info</span>
            <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#6e6e80', lineHeight: 1.55, margin: 0 }}>
              The PDF contains the step-sequencer grid for all patterns. Hidden rows (pattern mixer) are excluded from the export.
            </p>
          </div>
        </div>
      </div>

      {/* ── Floating bottom bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 400,
        transform: barVisible ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
        background: 'rgba(15,15,15,0.94)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Options row */}
        <div style={{ padding: '14px 16px 10px', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Dark theme chip */}
          <button onClick={() => update('theme', cfg.theme === 'dark' ? 'light' : 'dark')} className="btn-smooth"
            style={{ padding: '5px 12px', borderRadius: 8, fontFamily: 'Inter', fontWeight: 700, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5,
              background: cfg.theme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)',
              color: cfg.theme === 'dark' ? '#e7e5e4' : '#6e6e80',
              border: cfg.theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.04)',
              transition: 'all 160ms ease' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: cfg.theme === 'dark' ? "'FILL' 1" : "'FILL' 0" }}>dark_mode</span>
            Dark
          </button>

          {/* Layout style */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 2, gap: 1 }}>
            {([['compact', 'Cmp'] as const, ['normal', 'Nor'] as const, ['elegant', 'Ele'] as const]).map(([v, lbl]) => {
              const active = cfg.style === v;
              return (
                <button key={v} onClick={() => update('style', v as DrumExportConfig['style'])} className="btn-smooth"
                  style={{ padding: '5px 11px', borderRadius: 6, fontFamily: 'Inter', fontWeight: 700, fontSize: 10, letterSpacing: '0.05em',
                    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: active ? '#e7e5e4' : '#6e6e80',
                    transition: 'all 160ms ease' }}>
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>

        {/* Export button */}
        <div style={{ padding: '6px 16px', paddingBottom: 'max(20px,env(safe-area-inset-bottom))', display: 'flex', gap: 10, position: 'relative' }}>
          {saveRes && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, textAlign: 'center', padding: 6,
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 12, color: saveRes === 'ok' ? '#34d399' : '#f87171' }}>
              {saveRes === 'ok' ? 'Saved to Downloads!' : 'Could not save — try Share instead'}
            </div>
          )}
          {isNative ? (
            <>
              <button onClick={() => handlePDF('save')} disabled={saving || sharing} className="btn-smooth"
                style={{ flex: 1, padding: 14, borderRadius: 9999, fontFamily: 'Manrope', fontWeight: 800, fontSize: 14, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: (saving || sharing) ? 'rgba(72,72,72,0.3)' : `linear-gradient(135deg,${accent.from},${accent.to})`,
                  boxShadow: (saving || sharing) ? 'none' : `0 4px 20px ${accent.to}40`, transition: 'all 200ms ease' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 17, fontVariationSettings: "'FILL' 1" }}>
                  {saving ? 'hourglass_empty' : 'save'}
                </span>
                {saving ? 'Generating…' : 'Save'}
              </button>
              <button onClick={() => handlePDF('share')} disabled={saving || sharing} className="btn-smooth"
                style={{ flex: 1, padding: 14, borderRadius: 9999, fontFamily: 'Manrope', fontWeight: 800, fontSize: 14,
                  color: accent.from, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.06)', transition: 'all 200ms ease' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 17, fontVariationSettings: "'FILL' 1" }}>
                  {sharing ? 'hourglass_empty' : 'share'}
                </span>
                {sharing ? 'Generating…' : 'Share'}
              </button>
            </>
          ) : (
            <button onClick={() => handlePDF('share')} disabled={sharing} className="btn-smooth"
              style={{ flex: 1, padding: 15, borderRadius: 9999, fontFamily: 'Manrope', fontWeight: 800, fontSize: 15, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: sharing ? 'rgba(72,72,72,0.3)' : `linear-gradient(135deg,${accent.from},${accent.to})`,
                boxShadow: sharing ? 'none' : `0 4px 24px ${accent.to}40`, transition: 'all 200ms ease' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 19, fontVariationSettings: "'FILL' 1" }}>
                {sharing ? 'hourglass_empty' : 'download'}
              </span>
              {sharing ? 'Generating…' : 'Download PDF'}
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// ── DrumImportModal ─────────────────────────────────────────────────────────
function DrumImportModal({ accent, onImport, onClose }: {
  accent: { from: string; to: string };
  onImport: (name: string, artist: string, notes: string, patterns: DrumPattern[], activePatternId: string) => void;
  onClose: () => void;
}) {
  type Stage = 'idle' | 'preview' | 'error';
  const [stage, setStage]     = useState<Stage>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview]   = useState<{ name: string; artist: string; notes: string; patterns: DrumPattern[]; activePatternId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setErrorMsg('Please select a Drumex .json file.'); setStage('error'); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (!raw || typeof raw !== 'object' || raw._app !== 'Drumex')
          throw new Error('Not a valid Drumex JSON file.');
        if (!Array.isArray(raw.patterns) || raw.patterns.length === 0)
          throw new Error('No patterns found in file.');
        const reconstructed: DrumPattern[] = (raw.patterns as any[]).map((p: any) => ({
          id: `p-import-${Math.random().toString(36).slice(2)}`,
          name: p.name ?? 'Pattern',
          bpm: Math.max(40, Math.min(280, Number(p.bpm) || 120)),
          subdivision: ([8, 16].includes(Number(p.subdivision)) ? Number(p.subdivision) : 16) as 8 | 16,
          timeSignature: [4, 4] as [number, number],
          mutedInstruments: Array.isArray(p.mutedInstruments) ? p.mutedInstruments : [],
          measures: Array.isArray(p.measures)
            ? (p.measures as any[]).map((m: any) => ({ id: `m-import-${Math.random().toString(36).slice(2)}`, hits: m.hits ?? {} }))
            : [],
        }));
        const songName   = (raw.song?.name   ?? '').trim() || 'Imported Beat';
        const artist     = (raw.song?.artist ?? '').trim();
        const notes      = (raw.song?.notes  ?? '').trim();
        setPreview({ name: songName, artist, notes, patterns: reconstructed, activePatternId: reconstructed[0].id });
        setStage('preview');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Could not parse file.'); setStage('error');
      }
    };
    reader.onerror = () => { setErrorMsg('Failed to read file.'); setStage('error'); };
    reader.readAsText(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) parseFile(file); e.target.value = '';
  };

  const totalBars = preview ? preview.patterns.reduce((n, p) => n + p.measures.length, 0) : 0;

  const isWebDesktop = useIsWebDesktop();

  return (
    <div style={isWebDesktop ? { position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' } : { position: 'fixed', inset: 0, zIndex: 300 }}>
      <div onClick={onClose} style={isWebDesktop ? { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
      <div style={isWebDesktop ? { position: 'relative', width: '520px', maxWidth: '90vw', maxHeight: '85vh', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 0' } : { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!isWebDesktop && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(128,128,128,0.25)' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 20px 16px', flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif' }}>Import Beat</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)' }}>
          {stage === 'idle' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}
              style={{ border: `2px dashed ${dragOver ? accent.from : 'rgba(128,128,128,0.25)'}`, borderRadius: 16, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer', background: dragOver ? `${accent.from}08` : 'transparent', transition: 'all 200ms' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: accent.from }}>upload_file</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)' }}>Tap to select a Drumex JSON file</span>
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>or drag & drop here</span>
            </div>
          )}

          {stage === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span className="material-symbols-outlined" style={{ color: '#f87171', fontSize: 20, flexShrink: 0, marginTop: 1 }}>error</span>
                <span style={{ fontSize: 13, color: '#f87171', lineHeight: 1.5 }}>{errorMsg}</span>
              </div>
              <button onClick={() => { setStage('idle'); setErrorMsg(''); }} className="btn-smooth"
                style={{ padding: '12px', borderRadius: 12, background: 'var(--app-surface-high)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 600 }}>
                Try another file
              </button>
            </div>
          )}

          {stage === 'preview' && preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--app-surface-high)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.name}</span>
                </div>
                {preview.artist && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{preview.artist}</span>}
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: `${accent.from}18`, color: accent.from, borderRadius: 6, padding: '3px 8px' }}>{preview.patterns.length} pattern{preview.patterns.length !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(128,128,128,0.10)', color: 'var(--c-text-secondary)', borderRadius: 6, padding: '3px 8px' }}>{totalBars} bar{totalBars !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {preview.patterns.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--app-surface-high)', borderRadius: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{p.bpm} BPM · {p.measures.length} bar{p.measures.length !== 1 ? 's' : ''}</span>
                </div>
              ))}
              <button onClick={() => { onImport(preview.name, preview.artist, preview.notes, preview.patterns, preview.activePatternId); onClose(); }}
                className="btn-smooth"
                style={{ padding: '15px', borderRadius: 9999, background: `linear-gradient(135deg,${accent.from},${accent.to})`, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 6px 24px ${accent.to}50` }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                Import to Library
              </button>
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileInput} />
      </div>
    </div>
  );
}

const LIB_INSTS: DrumInstrument[] = ['hihat-closed','snare','kick','crash','tom-high','tom-mid','tom-floor'];

const LibMiniGrid = memo(function LibMiniGrid({ lp, isLight }: { lp: LibraryPattern; isLight: boolean }) {
  const totalSteps = lp.subdivision === 16 ? 16 : 8;
  const m0 = lp.measures[0];
  if (!m0) return null;
  const usedInsts = LIB_INSTS.filter(inst => m0.hits[inst]?.length);
  return (
    <div style={{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.35)', borderRadius: 10, padding: '8px 6px', overflow: 'hidden' }}>
      {usedInsts.slice(0, 4).map(inst => {
        const instHits = m0.hits[inst] ?? [];
        const color = INSTRUMENT_COLOR[inst] ?? '#888';
        const hitSet = new Set(instHits.map(h => h.step));
        const ghostSet = new Set(instHits.filter(h => h.variation === 'ghost').map(h => h.step));
        return (
          <div key={inst} style={{ display: 'flex', gap: 2, marginBottom: 2 }}>
            {Array.from({ length: totalSteps }, (_, s) => {
              const isHit = hitSet.has(s);
              const isGhost = ghostSet.has(s);
              return (
                <div key={s} style={{
                  flex: 1, height: isHit ? (isGhost ? 4 : 6) : 3,
                  borderRadius: 2,
                  background: isHit ? (isGhost ? `${color}55` : color) : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'),
                  opacity: isHit ? (isGhost ? 0.6 : 0.85) : 1,
                }} />
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

interface LibCardProps {
  lp: LibraryPattern;
  isPreviewPlaying: boolean;
  accent: { from: string; to: string };
  isLight: boolean;
  onPreview: (lp: LibraryPattern) => void;
  onReplace: (lp: LibraryPattern) => void;
  onInsert: (lp: LibraryPattern) => void;
}

const LibCard = memo(function LibCard({ lp, isPreviewPlaying, accent, isLight, onPreview, onReplace, onInsert }: LibCardProps) {
  const isWebDesktop = useIsWebDesktop();
  return (
    <div style={{
      background: isWebDesktop ? (isLight ? '#ffffff' : '#000000') : 'var(--app-surface)',
      borderRadius: isWebDesktop ? 12 : 14,
      overflow: 'hidden',
      border: isWebDesktop ? (isLight ? '1px solid #e4e4e7' : '1px solid #18181b') : '1px solid rgba(128,128,128,0.06)',
      transition: 'border-color 200ms'
    }} className="group hover:border-zinc-800">
      <div style={{ padding: '14px 14px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#09090b' : '#ffffff', fontFamily: 'Manrope,sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{lp.name}</div>
            <div style={{ fontSize: 9.5, color: '#71717a', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter,sans-serif', fontWeight: 700 }}>{lp.category} · {lp.genre} · {lp.bpm} BPM</div>
          </div>
          <button onClick={() => onPreview(lp)} title={isPreviewPlaying ? "Stop Preview" : "Preview Groove"} className="btn-smooth cursor-pointer"
            style={{ 
              width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', 
              background: isPreviewPlaying ? `linear-gradient(135deg,${accent.from},${accent.to})` : (isLight ? '#f4f4f5' : '#18181b'), 
              color: isPreviewPlaying ? '#fff' : (isLight ? '#27272a' : '#a1a1aa'), transition: 'all 160ms' 
            }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{isPreviewPlaying ? 'stop' : 'play_arrow'}</span>
          </button>
        </div>
      </div>
      <div style={{ padding: '0 14px 10px' }}>
        <LibMiniGrid lp={lp} isLight={isLight} />
      </div>
      <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6 }}>
        <button onClick={() => onReplace(lp)} title="Replace current pattern with this groove" className="btn-smooth cursor-pointer"
          style={{ 
            flex: 1, padding: '7px', borderRadius: 8, 
            background: isLight ? '#f4f4f5' : '#09090b', 
            border: isLight ? '1px solid #e4e4e7' : '1px solid #18181b', 
            color: isLight ? '#27272a' : '#e4e4e7', fontSize: 10.5, fontWeight: 800, fontFamily: 'Manrope,sans-serif', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 160ms' 
          }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>file_download</span>
          <span>USE</span>
        </button>
        <button onClick={() => onInsert(lp)} title="Append this groove to the end of the pattern" className="btn-smooth cursor-pointer"
          style={{ 
            flex: 1, padding: '7px', borderRadius: 8, 
            background: isLight ? '#f4f4f5' : '#09090b', 
            border: isLight ? '1px solid #e4e4e7' : '1px solid #18181b', 
            color: isLight ? '#27272a' : '#e4e4e7', fontSize: 10.5, fontWeight: 800, fontFamily: 'Manrope,sans-serif', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 160ms' 
          }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>playlist_add</span>
          <span>APPEND</span>
        </button>
      </div>
    </div>
  );
});

const VISIBLE_BATCH = 20;

// ── DrumEditor ─────────────────────────────────────────────────────────────
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
  const isWebDesktop = useIsWebDesktop();
  const [isLargeDesktop, setIsLargeDesktop] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  });

  useEffect(() => {
    if (!isWebDesktop) return;
    const handleResize = () => {
      setIsLargeDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isWebDesktop]);
  const {
    patterns, activePatternId,
    soundMap, volumeMap, masterVolume,
    kitType, activeInstruments,
    setKitType, toggleInstrument, setMasterVolume, setVolumeForInstrument,
    toggleHit, simpleToggleHit, setHitVelocity, addMeasure, deleteMeasure, clearMeasure, duplicateMeasure, updatePattern,
    addBlankPattern, duplicatePattern, deletePattern, renamePattern, setActivePattern,
    drumSongs, saveDrumSong, createBlankDrumSong, loadDrumSong, deleteDrumSong, updateDrumSong,
    restorePatterns, insertMeasureAfter, togglePatternMute, importDrumSong,
    grooves, saveGroove, deleteGroove, renameGroove, loadGrooveReplace, loadGrooveAppend, duplicateGroove,
    instFX, setInstFX,
    instPlugins, setInstPlugins,
    houseKitMic, setHouseKitMic: storeSetHouseKitMic,
    houseInstVelOverride, setHouseInstVelOverride: storeSetInstVelOverride,
    houseCrashModel, setHouseCrashModel: storeSetHouseCrashModel,
    cymbalPack, setCymbalPack: storeSetCymbalPack,
    drumPrefs, updateDrumPrefs,
  } = useDrumStore();

  const pattern = useMemo(
    () => patterns.find(p => p.id === activePatternId) ?? patterns[0],
    [patterns, activePatternId],
  );
  const accent = ACCENT_COLORS[(settings.perApp?.drums?.accentColor ?? settings.accentColor) as keyof typeof ACCENT_COLORS] ?? ACCENT_COLORS.blue;
  const spm    = stepsPerMeasure(pattern);
  const stepsPerBeat = pattern.subdivision / pattern.timeSignature[1];
  const kit    = kitType ?? 'ludwig';
  const ALL_INSTS = KIT_INSTRUMENTS[kit] ?? KIT_INSTRUMENTS.ludwig;

  // ── Theme — use per-app drums theme, fall back to global ─────────────────
  const drumsVis = settings.perApp?.drums ?? { theme: settings.theme ?? 'dark', amoledMode: settings.amoledMode ?? false };
  const isLight = (() => {
    if (drumsVis.theme === 'light') return true;
    if (drumsVis.theme === 'system') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    if (drumsVis.theme === 'dynamic') {
      const h = new Date().getHours();
      const lightStart = settings.dynamicLightStart ?? 7;
      const lightEnd   = settings.dynamicLightEnd   ?? 20;
      return h >= lightStart && h < lightEnd;
    }
    return false;
  })();
  const isAmoled = !isLight && (drumsVis.amoledMode ?? false);
  // SVG/canvas colors — CSS vars can't be used directly in SVG props
  const noteColor  = isLight ? '#111118' : '#ffffff';
  const staffColor = isLight ? 'rgba(9, 9, 11, 0.08)' : 'rgba(255, 255, 255, 0.05)';
  const barColor   = isLight ? 'rgba(9, 9, 11, 0.25)' : 'rgba(255, 255, 255, 0.15)';
  const altBg      = isLight ? 'rgba(9, 9, 11, 0.015)' : 'rgba(255, 255, 255, 0.008)';

  const ROW_H      = isWebDesktop ? 68 : 42;
  const rowGap     = isWebDesktop ? 8 : 0;

  // ── Landscape detection ──────────────────────────────────────────────────
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight && window.innerWidth >= 600
  );
  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth >= 600);
    const mql = window.matchMedia('(orientation: landscape)');
    if (mql.addEventListener) { mql.addEventListener('change', check); } else { mql.addListener(check); }
    window.addEventListener('resize', check);
    return () => {
      if (mql.removeEventListener) { mql.removeEventListener('change', check); } else { mql.removeListener(check); }
      window.removeEventListener('resize', check);
    };
  }, []);

  // ── State ────────────────────────────────────────────────────────────────
  const [inEditor,       setInEditor]       = useState(false);
  const [activeTab,      setActiveTab]      = useState<DrumTab>(() => {
    // Session restore wins over pinned default — but only when the user
    // has enabled session restore. Otherwise fall back to the pinned
    // default (or 'songs' if that's unset / out-of-schema).
    const st = useChordStore.getState();
    if (st.settings.restoreLastSession) {
      const last = st.lastSession?.drumexTab;
      if (last === 'songs' || last === 'patterns' || last === 'prefs') return last;
    }
    const dt = st.settings.defaultDrumTab;
    return (dt === 'songs' || dt === 'patterns' || dt === 'prefs') ? dt : 'songs';
  });
  // Persist the active Drumex tab on every change.
  useEffect(() => {
    useChordStore.getState().setLastSession({ drumexTab: activeTab });
  }, [activeTab]);
  const [playing, setPlaying]               = useState(false);
  const [looping, setLooping]               = useState(() => drumPrefs.loopPlayback);
  const [countingIn, setCountingIn]         = useState(false);
  const [sampleStatus, setSampleStatus]     = useState<SampleStatus>('idle');
  const [houseLoaded,  setHouseLoaded]      = useState(false);
  const [houseProgress, setHouseProgress]  = useState({ loaded: 0, total: 0 });
  const [showBpmPanel,   setShowBpmPanel]   = useState(false);
  const [showLoopPanel,  setShowLoopPanel]  = useState(false);
  const [showHamburger,     setShowHamburger]     = useState(false);
  const [hamburgerClosing,  setHamburgerClosing]  = useState(false);
  const [showSoundCharacter, setShowSoundCharacter] = useState(false);
  const [expandedCats,   setExpandedCats]   = useState<Set<string>>(() => new Set(['ultrahd']));
  const [focusedInst,    setFocusedInst]    = useState<DrumInstrument | null>(null);
  const [sideTab,        setSideTab]        = useState<'kit' | 'mixer' | 'fx'>('kit');
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  // Songs panel state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName,     setCreateName]     = useState('');
  const [createArtist,   setCreateArtist]   = useState('');
  const [createBpm,      setCreateBpm]      = useState('120');
  const [createNotes,    setCreateNotes]    = useState('');
  const [createFamily,   setCreateFamily]   = useState<string>('ultrahd');
  const [createVariant,  setCreateVariant]  = useState<KitType>('house');
  const [showSaveForm,     setShowSaveForm]     = useState(false);
  const [saveName,         setSaveName]         = useState('');
  const [saveArtist,       setSaveArtist]       = useState('');
  const [saveNotes,        setSaveNotes]        = useState('');
  const [deletingId,       setDeletingId]       = useState<string | null>(null);
  const [songSearch,       setSongSearch]       = useState('');
  const [songKitFilter,    setSongKitFilter]    = useState('all');
  const [songSort,         setSongSort]         = useState<'recent' | 'name' | 'bpm'>('recent');
  const [songMenuId,       setSongMenuId]       = useState<string | null>(null);
  const [editingSong,      setEditingSong]      = useState<DrumSong | null>(null);
  const [editingName,      setEditingName]      = useState('');
  const [editingArtist,    setEditingArtist]    = useState('');
  const [activeDrumSongId, setActiveDrumSongId] = useState<string | null>(null);
  const [tabAnim, setTabAnim] = useState<'panel-enter-right' | 'panel-enter-left'>('panel-enter-right');

  const filteredSongs = useMemo(() => {
    let list = [...drumSongs];
    if (songKitFilter !== 'all') {
      list = list.filter(s => s.kitType === songKitFilter);
    }
    if (songSearch.trim()) {
      const q = songSearch.toLowerCase();
      list = list.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.artist && s.artist.toLowerCase().includes(q))
      );
    }
    if (songSort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (songSort === 'bpm') {
      list.sort((a, b) => {
        const aPat = a.patterns.find((p: any) => p.id === a.activePatternId) ?? a.patterns[0];
        const bPat = b.patterns.find((p: any) => p.id === b.activePatternId) ?? b.patterns[0];
        const aBpm = aPat?.bpm ?? 120;
        const bBpm = bPat?.bpm ?? 120;
        return bBpm - aBpm;
      });
    } else {
      list.reverse();
    }
    return list;
  }, [drumSongs, songSearch, songKitFilter, songSort]);
  const [collapsedKitSections, setCollapsedKitSections] = useState<Record<string, boolean>>({
    'drum-kit': false,
    'kit-variant': false,
    'mic-position': true,
    'sound-character': true,
    'advanced-kit-options': true,
  });
  const [collapsedMixerSections, setCollapsedMixerSections] = useState<Record<string, boolean>>({
    'master': false,
    'levels': false,
    'pan': true,
    'room-send': true,
  });
  const [collapsedFxSections, setCollapsedFxSections] = useState<Record<string, boolean>>({
    'global-fx': false,
    'per-instrument-fx': false,
    'reverb-room': true,
    'humanize-groove-feel': true,
  });
  const handleSetTab = (newTab: DrumTab) => {
    const oldIdx = TAB_ORDER.indexOf(activeTab);
    const newIdx = TAB_ORDER.indexOf(newTab);
    setTabAnim(newIdx >= oldIdx ? 'panel-enter-right' : 'panel-enter-left');
    setActiveTab(newTab);
    setNavCollapsed(false);
    drumNavLastY.current = 0;
  };
  const [humanizeFeedback,   setHumanizeFeedback]   = useState(false);

  // ── Row visibility (persisted to localStorage) ───────────────────────────
  const [showExtraRows, setShowExtraRows] = useState<boolean>(() => {
    try { const v = JSON.parse(localStorage.getItem('chordex-drum-ui') ?? '{}'); return v.showExtraRows !== false; }
    catch { return true; }
  });

  // ── Undo / Redo stacks ───────────────────────────────────────────────────
  type HistoryEntry = { patterns: typeof patterns; activePatternId: string | null };
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [historyCount, setHistoryCount] = useState(0);

  // ── Bar copy/paste clipboard ──────────────────────────────────────────────
  const [copiedMeasure, setCopiedMeasure] = useState<DrumMeasure | null>(null);
  const [openBarMenu,   setOpenBarMenu]   = useState<string | null>(null); // measureId
  const [flashBarId,    setFlashBarId]    = useState<string | null>(null); // brief highlight on paste

  // ── Per-instrument FX sheet ────────────────────────────────────────────────
  const [showFXSheet,      setShowFXSheet]      = useState(false);
  const [fxInst,           setFxInst]           = useState<DrumInstrument>('kick');


  // Sync instFX + instPlugins store → drumAudio module whenever they change
  useEffect(() => { setInstFXMap(instFX); }, [instFX]);
  useEffect(() => { setInstPluginMap(instPlugins); }, [instPlugins]);
  useEffect(() => { setHouseInstVelOverrides(houseInstVelOverride); }, [houseInstVelOverride]);
  useEffect(() => { audioSetHouseCrashModel(houseCrashModel); }, [houseCrashModel]);
  useEffect(() => { setCymbalPackAudio(cymbalPack); }, [cymbalPack]);
  useEffect(() => { setRandomVariations(drumPrefs.randomVariations); }, [drumPrefs.randomVariations]);
  useEffect(() => { setHumanizeVelocity(drumPrefs.humanizeVelocity); }, [drumPrefs.humanizeVelocity]);

  // ── Quick mixer sheet + export modal + import modal ──────────────────────
  const [showMixerSheet,    setShowMixerSheet]    = useState(false);
  const [showExportModal,   setShowExportModal]   = useState(false);
  const [showImportDrum,    setShowImportDrum]    = useState(false);
  const [showClearConfirm,  setShowClearConfirm]  = useState(false);

  // ── Groove Library state ──────────────────────────────────────────────────
  const [grooveFilter,     setGrooveFilter]     = useState<GrooveTag>('');
  const [patRenameId,      setPatRenameId]      = useState<string | null>(null);
  const [patRenameName,    setPatRenameName]    = useState('');
  const [grooveMenuId,     setGrooveMenuId]     = useState<string | null>(null);
  const [previewingGrooveId, setPreviewingGrooveId] = useState<string | null>(null);
  const [showSaveGroove,   setShowSaveGroove]   = useState(false);
  const [savGrName,        setSavGrName]        = useState('');
  const [savGrTag,         setSavGrTag]         = useState<GrooveTag>('');
  const [grooveRenameId,   setGrooveRenameId]   = useState<string | null>(null);
  const [grooveRenameName, setGrooveRenameName] = useState('');
  const [grooveRenameTag,  setGrooveRenameTag]  = useState<GrooveTag>('');

  // ── Built-in Library state ─────────────────────────────────────────────
  const [libCategory, setLibCategory] = useState<LibraryCategory | 'All' | 'My Grooves'>('All');
  const [libGenre, setLibGenre] = useState<LibraryGenre | ''>('');
  const [libSearch, setLibSearch] = useState('');
  const [libSearchDebounced, setLibSearchDebounced] = useState('');
  const [libVisible, setLibVisible] = useState(VISIBLE_BATCH);
  const libSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLibSearchChange = useCallback((val: string) => {
    setLibSearch(val);
    if (libSearchTimer.current) clearTimeout(libSearchTimer.current);
    libSearchTimer.current = setTimeout(() => setLibSearchDebounced(val), 180);
  }, []);

  useEffect(() => {
    setLibVisible(VISIBLE_BATCH);
  }, [libCategory, libGenre, libSearchDebounced]);

  // ── Container width ──────────────────────────────────────────────────────
  // Use a stable callback ref so the observer re-attaches every time the
  // container div mounts (e.g. first open of the editor, or after a tab switch
  // remounts the content wrapper). A plain useEffect(fn,[]) misses mounts that
  // happen after the initial render because containerRef.current is null then.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const _roRef  = useRef<ResizeObserver | null>(null);
  const _rafRef = useRef<number | null>(null);

  const containerCallbackRef = useCallback((el: HTMLDivElement | null) => {
    // Tear down previous observer / animation frame
    if (_roRef.current)  { _roRef.current.disconnect(); _roRef.current = null; }
    if (_rafRef.current !== null) { cancelAnimationFrame(_rafRef.current); _rafRef.current = null; }
    // Keep the imperative ref in sync (used by pointer/playhead handlers)
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    if (!el) return;

    const update = (w: number) => { if (w > 0) setContainerW(w); };

    let tries = 0;
    const poll = () => {
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w > 0) { update(w); return; }
      if (tries++ < 40) _rafRef.current = requestAnimationFrame(poll);
    };
    poll();

    const ro = new ResizeObserver(e => update(e[0].contentRect.width));
    ro.observe(el);
    _roRef.current = ro;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Visible instruments ───────────────────────────────────────────────────
  const extraInsts   = useMemo(() => ALL_INSTS.filter(i => !CORE_INSTS.includes(i)), [ALL_INSTS]);
  const patternMuted = useMemo(() => new Set(pattern.mutedInstruments ?? []), [pattern.mutedInstruments]);
  const visibleInsts = useMemo(
    () => {
      const base = showExtraRows ? ALL_INSTS : ALL_INSTS.filter(i => CORE_INSTS.includes(i));
      return base.filter(i => !patternMuted.has(i));
    },
    [ALL_INSTS, showExtraRows, patternMuted],
  );

  // ── Layout ───────────────────────────────────────────────────────────────
  const availableW     = containerW - LABEL_W;
  // rawMpr: how many measures fit per row at the minimum step width.
  // In landscape the screen is wider so rawMpr is naturally larger →
  // more measures shown per row without stretching any of them.
  const rawMpr         = Math.max(1, Math.floor(availableW / (spm * MIN_STEP)));
  const measuresPerRow = isLandscape ? pattern.measures.length : 1;
  const MEASURE_W      = isLandscape
    ? (pattern.measures.length <= 2 ? (availableW - 16) / Math.max(1, pattern.measures.length) : Math.max(340, availableW / 2.5))
    : availableW;
  const STEP_W         = MEASURE_W / spm;
  const SYSTEM_H       = RULER_H + visibleInsts.length * ROW_H + (visibleInsts.length > 0 ? (visibleInsts.length - 1) * rowGap : 0);
  const FULL_SYS_H     = SYSTEM_H + SYS_SEP;

  const spmRef      = useRef(spm);            spmRef.current = spm;
  const mprRef      = useRef(measuresPerRow); mprRef.current = measuresPerRow;
  const stepWRef    = useRef(STEP_W);         stepWRef.current = STEP_W;
  const measureWRef = useRef(MEASURE_W);      measureWRef.current = MEASURE_W;
  const sysHRef     = useRef(FULL_SYS_H);    sysHRef.current = FULL_SYS_H;
  const allInstsRef = useRef(visibleInsts);   allInstsRef.current = visibleInsts;
  const totalStepsRef = useRef(spm * pattern.measures.length);
  totalStepsRef.current = spm * pattern.measures.length;
  const secPerStepRef = useRef(0);
  secPerStepRef.current = (60 / pattern.bpm) / (pattern.subdivision / pattern.timeSignature[1]);

  // ── System rows ──────────────────────────────────────────────────────────
  const systemRows = useMemo(() => {
    const rows: typeof pattern.measures[] = [];
    for (let i = 0; i < pattern.measures.length; i += measuresPerRow)
      rows.push(pattern.measures.slice(i, i + measuresPerRow));
    return rows;
  }, [pattern.measures, measuresPerRow]);

  // ── Smart loop range (clamped against current bar count) ─────────────────
  // Always derive a valid range; `loopActive` gates visual + audio behavior.
  const effectiveLoop = useMemo<LoopRange>(
    () => clampLoopRange(pattern.loopRange, pattern.measures.length),
    [pattern.loopRange, pattern.measures.length],
  );
  const loopActive = effectiveLoop.enabled && pattern.measures.length > 0;

  // ── Landscape auto-fill: ensure enough empty measures to fill one row ───
  useEffect(() => {
    if (!isLandscape || !inEditor) return;
    const needed = measuresPerRow - pattern.measures.length;
    if (needed > 0) {
      const extra = Array.from({ length: needed }, () => emptyMeasure());
      updatePattern(pattern.id, { measures: [...pattern.measures, ...extra] });
    }
  }, [isLandscape, inEditor, measuresPerRow, pattern.measures.length, pattern.id]);

  // ── Hit maps (step → { variation, velocity }) ────────────────────────────


  // ── Scroll-hide for bottom nav ────────────────────────────────────────────
  const drumNavLastY = useRef(0);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const scrollRef      = useRef<HTMLDivElement>(null);
  const playheadRef    = useRef<HTMLDivElement>(null);
  const pointerStart   = useRef<{ x: number; y: number } | null>(null);
  const isDragging     = useRef(false);
  const dragFilled     = useRef(new Set<string>());
  const countInTimers  = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Lifecycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    samplePool.onStatusChange = s => setSampleStatus(s);
    setSampleStatus(samplePool.status);
    return () => { samplePool.onStatusChange = null; };
  }, []);
  // Cleanup on unmount: stop scheduler + clear any pending count-in timers
  useEffect(() => {
    return () => {
      drumScheduler.stop();
      countInTimers.current.forEach(clearTimeout);
      countInTimers.current = [];
    };
  }, []);
  useEffect(() => { if (kitType) loadDrumSamples(kitType); }, [kitType]);

  // House kit: load Opus samples when kit === 'house' or mic changes
  useEffect(() => {
    if (kit !== 'house') return;
    houseKitPool.onStatusChange = (loaded, total) => {
      setHouseProgress({ loaded, total });
      if (loaded >= total) setHouseLoaded(true);
    };
    setHouseLoaded(houseKitPool.ready);
    loadHouseKit(houseKitMic);
    return () => { houseKitPool.onStatusChange = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit, houseKitMic]);

  useEffect(() => { if (playing) drumScheduler.updatePattern(pattern); }, [pattern, playing]);

  // ── Scroll-hide: attach to grid scroll container ──────────────────────────
  const drumScrollHide = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    if (y < 30) { setNavCollapsed(false); drumNavLastY.current = y; return; }
    const dy = y - drumNavLastY.current;
    if (Math.abs(dy) < 6) return;
    setNavCollapsed(dy > 0);
    drumNavLastY.current = y;
  }, []);

  // ── Auto-save: persist patterns/kit into the loaded song whenever they change
  useEffect(() => {
    if (!activeDrumSongId) return;
    const t = setTimeout(() => {
      updateDrumSong(activeDrumSongId, {
        patterns: JSON.parse(JSON.stringify(patterns)),
        activePatternId: activePatternId ?? patterns[0]?.id ?? '',
        kitType,
      });
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patterns, activePatternId, kitType, activeDrumSongId]);


  // ── Playhead ─────────────────────────────────────────────────────────────
  const endAdvTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drumPrefsRef    = useRef(drumPrefs);
  useEffect(() => { drumPrefsRef.current = drumPrefs; }, [drumPrefs]);
  // Low latency now lives globally (Studio Hub → Performance) and is wired in App.tsx.

  useEffect(() => {
    drumScheduler.onStep = (gs, mIdx, stepInM) => {
      if (endAdvTimerRef.current) { clearTimeout(endAdvTimerRef.current); endAdvTimerRef.current = null; }
      if (gs < 0) {
        if (playheadRef.current) {
          playheadRef.current.style.transform = `translate(${LABEL_W}px, 0px)`;
          playheadRef.current.style.display = 'block';
        }
        return;
      }
      const sp = spmRef.current; const mpr = mprRef.current; const sw = stepWRef.current; const sh = sysHRef.current;
      const systemIdx = Math.floor(mIdx / mpr); const measureInRow = mIdx % mpr; const stepInRow = measureInRow * sp + stepInM;
      const x = LABEL_W + stepInRow * sw; const y = systemIdx * sh;
      if (playheadRef.current) { playheadRef.current.style.transform = `translate(${x}px, ${y}px)`; playheadRef.current.style.display = 'block'; }
      const el = scrollRef.current;
      if (el) {
        const rowBottom = y + RULER_H + allInstsRef.current.length * ROW_H + (allInstsRef.current.length > 0 ? (allInstsRef.current.length - 1) * rowGap : 0);
        if (y < el.scrollTop || rowBottom > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, y - 40);
        
        // Horizontal auto-scroll
        const leftBound = el.scrollLeft + LABEL_W;
        const rightBound = el.scrollLeft + el.clientWidth;
        if (x < leftBound) {
          el.scrollLeft = Math.max(0, x - LABEL_W - 20);
        } else if (x > rightBound - 40) {
          el.scrollLeft = x - el.clientWidth + 40;
        }
      }
      // ── Metronome ──────────────────────────────────────────────────────────
      if (drumPrefsRef.current.metronome) {
        const spBeat = spmRef.current / 4; // steps per beat (assumes 4/4)
        if (gs % spBeat === 0) {
          const isBeat1 = gs % (spBeat * 4) === 0;
          const ctx = getAudioCtx();
          if (ctx) {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.connect(env); env.connect(ctx.destination);
            osc.frequency.value = isBeat1 ? 1200 : 880;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(0.28, t + 0.002);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
            osc.start(t); osc.stop(t + 0.07);
          }
        }
      }
      // ── Auto-expand ────────────────────────────────────────────────────────
      const totalSteps = drumScheduler.totalSteps;
      if (drumPrefsRef.current.autoExpandPattern && gs === totalSteps - 1) {
        const { patterns: pts, activePatternId: actId } = useDrumStore.getState();
        const curPat = pts.find(p => p.id === actId);
        if (curPat) useDrumStore.getState().addMeasure(curPat.id);
      }
      // On the last step, advance the playhead to the end bar line after one step duration
      if (gs === totalStepsRef.current - 1) {
        const endX = LABEL_W + (stepInRow + 1) * sw;
        endAdvTimerRef.current = setTimeout(() => {
          if (playheadRef.current) playheadRef.current.style.transform = `translate(${endX}px, ${y}px)`;
          endAdvTimerRef.current = null;
        }, secPerStepRef.current * 1000);
      }
    };
    return () => { drumScheduler.onStep = null; };
  }, []);
  useEffect(() => () => { drumScheduler.stop(); }, []);

  // ── Master volume → audio engine ─────────────────────────────────────────
  useEffect(() => { drumScheduler.setMasterVolume(masterVolume); }, [masterVolume]);

  // ── Row visibility persistence ────────────────────────────────────────────
  useEffect(() => {
    try {
      const prev = JSON.parse(localStorage.getItem('chordex-drum-ui') ?? '{}');
      localStorage.setItem('chordex-drum-ui', JSON.stringify({ ...prev, showExtraRows }));
    } catch {}
  }, [showExtraRows]);

  // ── Undo / Redo helpers ────────────────────────────────────────────────────
  const pushUndo = useCallback(() => {
    const { patterns: pts, activePatternId: actId } = useDrumStore.getState();
    undoStack.current.push({ patterns: JSON.parse(JSON.stringify(pts)), activePatternId: actId });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setHistoryCount(undoStack.current.length);
  }, []);

  const handleUndo = useCallback(() => {
    if (!undoStack.current.length) return;
    const { patterns: pts, activePatternId: actId } = useDrumStore.getState();
    redoStack.current.push({ patterns: JSON.parse(JSON.stringify(pts)), activePatternId: actId });
    const prev = undoStack.current.pop()!;
    restorePatterns(prev.patterns, prev.activePatternId);
    setHistoryCount(undoStack.current.length);
  }, [restorePatterns]);

  const handleRedo = useCallback(() => {
    if (!redoStack.current.length) return;
    const { patterns: pts, activePatternId: actId } = useDrumStore.getState();
    undoStack.current.push({ patterns: JSON.parse(JSON.stringify(pts)), activePatternId: actId });
    const next = redoStack.current.pop()!;
    restorePatterns(next.patterns, next.activePatternId);
    setHistoryCount(undoStack.current.length);
  }, [restorePatterns]);

  const handleAddBar = useCallback(() => {
    pushUndo();
    addMeasure(pattern.id);
  }, [pattern.id, addMeasure, pushUndo]);

  const prevMeasureCount = useRef(pattern.measures.length);
  useLayoutEffect(() => {
    const currentCount = pattern.measures.length;
    if (currentCount > prevMeasureCount.current) {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          left: scrollRef.current.scrollWidth,
          behavior: 'smooth'
        });
      }
    }
    prevMeasureCount.current = currentCount;
  }, [pattern.measures.length]);

  // ── Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) ──────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // ── Metronome click ──────────────────────────────────────────────────────
  const playMetronomeClick = useCallback((isBeat1: boolean) => {
    const ctx = getAudioCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env); env.connect(ctx.destination);
    osc.frequency.value = isBeat1 ? 1200 : 880;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.32, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.start(t); osc.stop(t + 0.08);
  }, []);

  // ── Play/stop ────────────────────────────────────────────────────────────
  const startPattern = useCallback(() => {
    setRandomVariations(useDrumStore.getState().drumPrefs.randomVariations);
    const sm  = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
    const vol: Partial<Record<DrumInstrument, number>> = {};
    activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
    if (kit === 'house') loadHouseKit(houseKitMic); else loadDrumSamples(kit);
    drumScheduler.start(pattern, sm, vol, masterVolume, looping, kit); setPlaying(true);
  }, [pattern, kit, soundMap, volumeMap, activeInstruments, masterVolume, looping, houseKitMic]);

  const handlePlay = useCallback(() => {
    if (drumScheduler.isPlaying || countingIn) {
      countInTimers.current.forEach(clearTimeout); countInTimers.current = [];
      drumScheduler.stop(); setPlaying(false); setCountingIn(false); return;
    }
    if (drumPrefs.countIn) {
      // Resume audio context first
      const ctx = getAudioCtx();
      if (ctx && ctx.state !== 'running') ctx.resume();
      const spBeat = pattern.subdivision / pattern.timeSignature[1];
      const msPerBeat = (60 / pattern.bpm) * 1000 / spBeat;
      setCountingIn(true);
      playMetronomeClick(true);
      [1, 2, 3].forEach(i => {
        const id = setTimeout(() => {
          playMetronomeClick(i === 0);
          if (i === 3) { setCountingIn(false); startPattern(); }
        }, i * msPerBeat);
        countInTimers.current.push(id);
      });
    } else {
      startPattern();
    }
  }, [startPattern, countingIn, drumPrefs.countIn, pattern.bpm, pattern.subdivision, pattern.timeSignature, playMetronomeClick]);

  // ── Kit ──────────────────────────────────────────────────────────────────
  const handleKitSelect = useCallback((k: KitType) => {
    if (kitType === k) return;
    setKitType(k, KIT_DEFAULTS[k].soundMap);
    if (k === 'house') loadHouseKit(houseKitMic);
    else loadDrumSamples(k);
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
  }, [setKitType, kitType, houseKitMic]);

  // ── Groove Library ────────────────────────────────────────────────────────
  const filteredGrooves = grooveFilter
    ? grooves.filter(g => g.tag === grooveFilter)
    : grooves;

  const handleGroovePreview = useCallback((groove: GrooveEntry) => {
    if (previewingGrooveId === groove.id && drumScheduler.isPlaying) {
      drumScheduler.stop(); setPlaying(false); setPreviewingGrooveId(null);
      setRandomVariations(useDrumStore.getState().drumPrefs.randomVariations);
      return;
    }
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
    const sm = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
    const vol: Partial<Record<DrumInstrument, number>> = {};
    activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
    const tempPat: DrumPattern = {
      id: groove.id, name: groove.name, bpm: groove.bpm,
      timeSignature: [4, 4], subdivision: groove.subdivision,
      measures: groove.measures,
    };
    loadDrumSamples(kit);
    drumScheduler.start(tempPat, sm, vol, masterVolume, true, kit);
    setPreviewingGrooveId(groove.id);
    setPlaying(false);
  }, [previewingGrooveId, kit, soundMap, volumeMap, activeInstruments, masterVolume]);

  const handleLibPreview = useCallback((lp: LibraryPattern) => {
    if (previewingGrooveId === lp.id && drumScheduler.isPlaying) {
      drumScheduler.stop(); setPlaying(false); setPreviewingGrooveId(null);
      setRandomVariations(useDrumStore.getState().drumPrefs.randomVariations);
      return;
    }
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
    const libKit: KitType = 'house';
    const sm = { ...KIT_DEFAULTS[libKit].soundMap };
    const vol: Partial<Record<DrumInstrument, number>> = {};
    activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
    const flatMeasures = lp.measures.map(m => {
      const hits: typeof m.hits = {};
      for (const [inst, arr] of Object.entries(m.hits)) {
        hits[inst as DrumInstrument] = (arr as DrumHit[]).map(h =>
          h.variation && h.variation !== 'normal'
            ? { ...h, variation: 'normal' as const }
            : h
        );
      }
      return { ...m, hits };
    });
    const tempPat: DrumPattern = {
      id: lp.id, name: lp.name, bpm: lp.bpm,
      timeSignature: [4, 4], subdivision: lp.subdivision,
      measures: flatMeasures,
    };
    setRandomVariations(false);
    loadHouseKit('blend');
    drumScheduler.start(tempPat, sm, vol, masterVolume, true, libKit);
    setPreviewingGrooveId(lp.id);
    setPlaying(false);
  }, [previewingGrooveId, volumeMap, activeInstruments, masterVolume]);

  const handleLibInsert = useCallback((lp: LibraryPattern) => {
    if (!pattern) return;
    const newMeasures = lp.measures.map(m => ({
      ...m,
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      hits: { ...m.hits },
    }));
    updatePattern(pattern.id, {
      measures: [...pattern.measures, ...newMeasures],
    });
    setActiveTab('songs');
    setInEditor(true);
  }, [pattern, updatePattern]);

  const handleLibReplace = useCallback((lp: LibraryPattern) => {
    if (!pattern) return;
    const newMeasures = lp.measures.map(m => ({
      ...m,
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      hits: { ...m.hits },
    }));
    updatePattern(pattern.id, {
      measures: newMeasures,
      bpm: lp.bpm,
      subdivision: lp.subdivision,
    });
    setActiveTab('songs');
    setInEditor(true);
  }, [pattern, updatePattern]);

  const filteredLibrary = useMemo(() => {
    let items = DRUM_LIBRARY;
    if (libCategory !== 'All' && libCategory !== 'My Grooves') {
      items = items.filter(p => p.category === libCategory);
    }
    if (libGenre) {
      items = items.filter(p => p.genre === libGenre);
    }
    if (libSearchDebounced.trim()) {
      const q = libSearchDebounced.trim().toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.genre.toLowerCase().includes(q)
      );
    }
    return items;
  }, [libCategory, libGenre, libSearchDebounced]);

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
    if (drumScheduler.isPlaying) {
      drumScheduler.stop();
      setPlaying(false);
    }
    drumScheduler.seekTo(0);
    pushUndo();
    const clearedMeasures = pattern.measures.map(m => ({ ...m, hits: {} }));
    updatePattern(pattern.id, { measures: clearedMeasures });
  }, [pattern, updatePattern, pushUndo]);

  // ── Cell tap / drag ──────────────────────────────────────────────────────
  // Resolve which grid cell a pointer event falls on; returns null if outside grid
  const resolveCell = (clientX: number, clientY: number) => {
    const el = scrollRef.current; if (!el) return null;
    const rect = el.getBoundingClientRect();
    let cx = clientX - rect.left - LABEL_W;
    const cy   = clientY - rect.top + el.scrollTop;
    if (cx < 0) return null;
    const sysIdx   = Math.floor(cy / sysHRef.current);
    const yInSys   = cy % sysHRef.current - RULER_H;
    if (yInSys < 0) return null;
    const instIdx      = Math.floor(yInSys / ROW_H);
    const measureInRow = Math.floor(cx / measureWRef.current);
    const mIdx         = sysIdx * mprRef.current + measureInRow;
    // snapToGrid=false → quantize to beat rather than subdivision step
    let stepInM = Math.floor((cx % measureWRef.current) / stepWRef.current);
    if (!useDrumStore.getState().drumPrefs.snapToGrid) {
      const spBeat = spmRef.current / 4;
      stepInM = Math.floor(stepInM / spBeat) * spBeat;
    }
    const vis = allInstsRef.current;
    const { patterns: pts, activePatternId: actId } = useDrumStore.getState();
    const curPat = pts.find(p => p.id === actId);
    if (!curPat) return null;
    if (instIdx < 0 || instIdx >= vis.length) return null;
    if (mIdx < 0 || mIdx >= curPat.measures.length) return null;
    if (stepInM < 0 || stepInM >= spmRef.current) return null;
    return { inst: vis[instIdx], m: curPat.measures[mIdx], stepInM, mIdx, instIdx };
  };

  const applyHitToCell = useCallback((inst: DrumInstrument, m: DrumMeasure, stepInM: number, patternId: string, preview = true) => {
    const prefs = useDrumStore.getState().drumPrefs;
    const useSimple = !prefs.noteVariationsCycle;
    if (useSimple) {
      simpleToggleHit(patternId, m.id, inst, stepInM);
    } else {
      toggleHit(patternId, m.id, inst, stepInM);
    }
    if (preview) {
      const newPat     = useDrumStore.getState().patterns.find(p => p.id === patternId);
      const newMeasure = newPat?.measures.find(ms => ms.id === m.id);
      const newHit     = newMeasure?.hits[inst]?.find(h => h.step === stepInM);
      const variation  = newHit?.variation ?? 'normal';
      const kitDefs    = KIT_DEFAULTS[kit].soundMap;
      const previewId  = getSoundForVariation(inst, variation, soundMap, kitDefs);
      const previewVol = variation === 'ghost' ? 0.25 : 0.55;
      drumScheduler.previewSound(previewId, previewVol, kit);
    }
    if (drumScheduler.isPlaying) drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === patternId)!);
    // Auto-play on edit
    const livePrefs = useDrumStore.getState().drumPrefs;
    if (livePrefs.autoPlayOnEdit && !drumScheduler.isPlaying) {
      const sm  = { ...KIT_DEFAULTS[kit].soundMap, ...soundMap };
      const vol: Partial<Record<DrumInstrument, number>> = {};
      activeInstruments.forEach(i => { vol[i] = volumeMap[i] ?? 1.0; });
      const latestPat = useDrumStore.getState().patterns.find(p => p.id === patternId)!;
      if (kit === 'house') loadHouseKit(houseKitMic); else loadDrumSamples(kit);
      drumScheduler.start(latestPat, sm, vol, masterVolume, livePrefs.loopPlayback, kit);
      setPlaying(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kit, soundMap, volumeMap, activeInstruments, masterVolume, houseKitMic, toggleHit, simpleToggleHit]);

  const cancelPointer = () => {
    pointerStart.current = null;
    isDragging.current   = false;
    dragFilled.current.clear();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (openBarMenu) setOpenBarMenu(null);
    pointerStart.current = { x: e.clientX, y: e.clientY };
    isDragging.current   = false;
    dragFilled.current.clear();
    // Capture the pointer so move/up fire even if finger leaves the element
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!useDrumStore.getState().drumPrefs.dragToFill) return;
    if (!pointerStart.current) return;
    const s = pointerStart.current;
    const dist = Math.hypot(e.clientX - s.x, e.clientY - s.y);
    if (dist < 8) return; // minimum drag threshold
    if (!isDragging.current) { isDragging.current = true; pushUndo(); }
    const cell = resolveCell(e.clientX, e.clientY);
    if (!cell) return;
    const key = `${cell.inst}:${cell.mIdx}:${cell.stepInM}`;
    if (dragFilled.current.has(key)) return; // already filled in this drag
    dragFilled.current.add(key);
    // When dragging, only add notes (don't remove), so use simpleToggleHit-style
    const { patterns: pts, activePatternId: actId } = useDrumStore.getState();
    const curPat = pts.find(p => p.id === actId); if (!curPat) return;
    const existing = cell.m.hits[cell.inst]?.find(h => h.step === cell.stepInM);
    if (!existing) {
      simpleToggleHit(curPat.id, cell.m.id, cell.inst, cell.stepInM);
      if (drumScheduler.isPlaying) drumScheduler.updatePattern(useDrumStore.getState().patterns.find(p => p.id === curPat.id)!);
    }
    setFocusedInst(cell.inst);
  };

  const handlePointerUp   = (e: React.PointerEvent) => {
    const s = pointerStart.current; if (!s) return; pointerStart.current = null;
    // If this was a drag-to-fill event, just clean up
    if (isDragging.current) { isDragging.current = false; dragFilled.current.clear(); return; }
    if (Math.abs(e.clientX - s.x) > 12 || Math.abs(e.clientY - s.y) > 12) return;
    const cell = resolveCell(e.clientX, e.clientY);
    if (!cell) return;
    const { activePatternId: actId } = useDrumStore.getState();
    if (!actId) return;
    pushUndo();
    applyHitToCell(cell.inst, cell.m, cell.stepInM, actId);
    setFocusedInst(cell.inst);
  };

  // ── Back ─────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (inEditor) {
      if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
      setShowHamburger(false); setShowBpmPanel(false);
      setInEditor(false); setActiveTab('songs');
    } else {
      drumScheduler.stop();
      updateSettings({ appMode: 'chords' });
    }
  };

  useEffect(() => {
    const handler = (): boolean => {
      // 1. Confirmations and Modals
      if (showClearConfirm) { setShowClearConfirm(false); return true; }
      if (showExportModal) { setShowExportModal(false); return true; }
      if (showImportDrum) { setShowImportDrum(false); return true; }
      if (showSaveGroove) { setShowSaveGroove(false); return true; }

      // 2. Forms
      if (showCreateForm) { setShowCreateForm(false); return true; }
      if (showSaveForm) { setShowSaveForm(false); return true; }

      // 3. Sheets / Menus / Panels
      if (showMixerSheet) { setShowMixerSheet(false); return true; }
      if (showFXSheet) { setShowFXSheet(false); return true; }
      if (showBpmPanel) { setShowBpmPanel(false); return true; }
      if (showLoopPanel) { setShowLoopPanel(false); return true; }
      if (showSoundCharacter) { setShowSoundCharacter(false); return true; }
      if (showHamburger) { setShowHamburger(false); return true; }

      // 4. Default view exit
      if (inEditor) {
        if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
        setInEditor(false); setActiveTab('songs');
        return true;
      }
      return false;
    };
    setBackHandler(handler);
    return () => setBackHandler(null);
  }, [
    inEditor, showClearConfirm, showExportModal, showImportDrum, showSaveGroove,
    showCreateForm, showSaveForm, showMixerSheet, showFXSheet, showBpmPanel,
    showLoopPanel, showSoundCharacter, showHamburger
  ]);

  // ── Create Beat ───────────────────────────────────────────────────────────
  const handleCreateBeat = useCallback(() => {
    if (!createName.trim()) return;
    const bpm = Math.max(40, Math.min(280, parseInt(createBpm, 10) || 120));
    const id = createBlankDrumSong(createName, createArtist, bpm, createNotes, createVariant);
    loadDrumSong(id);
    setKitType(createVariant, KIT_DEFAULTS[createVariant].soundMap);
    if (createVariant === 'house') loadHouseKit(houseKitMic); else loadDrumSamples(createVariant);
    setActiveDrumSongId(id);
    setInEditor(true);
    setActiveTab('songs');
    setShowCreateForm(false);
    setCreateName(''); setCreateArtist(''); setCreateBpm('120'); setCreateNotes('');
    setCreateFamily('acoustic'); setCreateVariant('ludwig');
  }, [createName, createArtist, createBpm, createNotes, createVariant, createBlankDrumSong, loadDrumSong, setKitType]);

  // ── Songs ─────────────────────────────────────────────────────────────────
  const handleOpenSaveForm = useCallback(() => {
    if (activeDrumSongId) {
      const song = drumSongs.find(s => s.id === activeDrumSongId);
      if (song) { setSaveName(song.name); setSaveArtist(song.artist); setSaveNotes(song.notes ?? ''); }
    } else {
      setSaveName(''); setSaveArtist(''); setSaveNotes('');
    }
    setShowSaveForm(true);
  }, [activeDrumSongId, drumSongs]);

  const handleSaveAsNew = useCallback(() => {
    if (!saveName.trim()) return;
    saveDrumSong(saveName, saveArtist, saveNotes);
    setSaveName(''); setSaveArtist(''); setSaveNotes('');
    setShowSaveForm(false);
    setActiveDrumSongId(null);
  }, [saveName, saveArtist, saveNotes, saveDrumSong]);

  const handleUpdateSong = useCallback(() => {
    if (!saveName.trim() || !activeDrumSongId) return;
    updateDrumSong(activeDrumSongId, {
      name: saveName.trim(),
      artist: saveArtist.trim(),
      notes: saveNotes.trim(),
      patterns: JSON.parse(JSON.stringify(patterns)),
      activePatternId: activePatternId ?? patterns[0]?.id ?? '',
      kitType: kitType,
    });
    setShowSaveForm(false);
  }, [saveName, saveArtist, saveNotes, activeDrumSongId, updateDrumSong, patterns, activePatternId, kitType]);

  const handleLoadSong = useCallback((song: DrumSong) => {
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
    loadDrumSong(song.id);
    if (song.kitType) {
      setKitType(song.kitType, KIT_DEFAULTS[song.kitType].soundMap);
      if (song.kitType === 'house') loadHouseKit(houseKitMic); else loadDrumSamples(song.kitType);
    }
    setActiveDrumSongId(song.id);
    setInEditor(true);
    setActiveTab('songs');
  }, [loadDrumSong, setKitType, houseKitMic]);

  const handleStartEdit = useCallback((song: DrumSong) => {
    setEditingSong(song);
    setEditingName(song.name);
    setEditingArtist(song.artist);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingSong) return;
    updateDrumSong(editingSong.id, { name: editingName.trim() || editingSong.name, artist: editingArtist.trim() });
    setEditingSong(null);
  }, [editingSong, editingName, editingArtist, updateDrumSong]);

  // ── Humanize ──────────────────────────────────────────────────────────────
  // Applies subtle variation to note types across the active pattern,
  // producing a more human feel without drastically altering the groove.
  const handleHumanize = useCallback(() => {
    if (!pattern) return;
    const HUMANIZE_RULES: Partial<Record<DrumInstrument, { from: NoteVariation; to: NoteVariation; chance: number }[]>> = {
      snare:          [{ from: 'normal', to: 'ghost',  chance: 0.28 }],
      kick:           [{ from: 'normal', to: 'accent', chance: 0.18 }],
      'hihat-closed': [{ from: 'normal', to: 'open',   chance: 0.14 }],
      ride:           [{ from: 'normal', to: 'bell',   chance: 0.14 }],
    };
    const newMeasures: DrumMeasure[] = pattern.measures.map(measure => {
      const newHits: DrumMeasure['hits'] = {};
      for (const [instKey, hitList] of Object.entries(measure.hits)) {
        const inst = instKey as DrumInstrument;
        const rules = HUMANIZE_RULES[inst];
        if (!hitList || !rules) { newHits[inst] = hitList; continue; }
        newHits[inst] = hitList.map(hit => {
          const variation = hit.variation ?? 'normal';
          for (const rule of rules) {
            if (variation === rule.from && Math.random() < rule.chance) {
              return { ...hit, variation: rule.to };
            }
          }
          return hit;
        });
      }
      return { ...measure, hits: newHits };
    });
    updatePattern(pattern.id, { measures: newMeasures });
    setHumanizeFeedback(true);
    setTimeout(() => setHumanizeFeedback(false), 900);
  }, [pattern, updatePattern]);

  // ── Convenience: active song ─────────────────────────────────────────────
  const activeSong = activeDrumSongId ? drumSongs.find(s => s.id === activeDrumSongId) ?? null : null;

  // ── Render ────────────────────────────────────────────────────────────────
  const inputSt: React.CSSProperties = { width: '100%', background: 'var(--app-surface-high)', border: '1px solid rgba(72,72,72,0.12)', borderRadius: '0.625rem', padding: '11px 14px', color: 'var(--c-text-primary)', fontFamily: 'Inter', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelSt: React.CSSProperties = { color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block', marginBottom: 6 };
  const renderCollapsibleSection = (
    id: string,
    title: string,
    collapsedState: Record<string, boolean>,
    onToggle: (id: string) => void,
    content: React.ReactNode
  ) => {
    const isCollapsed = collapsedState[id];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid rgba(255, 255, 255, 0.04)', paddingBottom: isCollapsed ? 6 : 10 }}>
        <div
          onClick={() => onToggle(id)}
          className="btn-smooth hover:bg-white/5"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: isCollapsed ? 'var(--c-text-secondary)' : '#fff' }}>
            {title}
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--c-text-muted)', transition: 'transform 200ms', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            expand_more
          </span>
        </div>
        {!isCollapsed && (
          <div style={{ padding: '6px 4px 2px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {content}
          </div>
        )}
      </div>
    );
  };
  const menuItemSt: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-primary)', fontSize: 12.5, fontFamily: 'Manrope', fontWeight: 600, textAlign: 'left', transition: 'background 120ms' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--app-bg)', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>

      {/* ── Safe-area spacer ─────────────────────────────────────────────── */}
      {!(isLandscape && inEditor) && (
        <div style={{ height: 'env(safe-area-inset-top)', background: 'var(--app-bg)', flexShrink: 0 }} />
      )}

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      {!isWebDesktop ? (
        <div style={{ flexShrink: 0, height: inEditor ? (isLandscape ? 40 : 52) : (isWebDesktop ? 0 : undefined), display: (isWebDesktop && !inEditor) ? 'none' : 'flex', alignItems: 'center', padding: isLandscape && inEditor ? '0 10px' : inEditor ? '0 20px' : (isWebDesktop ? '0' : '24px 24px 4px'), gap: isLandscape && inEditor ? 6 : 8, background: 'var(--app-bg)', borderBottom: isLandscape && inEditor ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
          {inEditor ? (
            <>
              <button onClick={handleBack} className="btn-smooth" aria-label="Back" style={{ width: isLandscape ? 30 : 36, height: isLandscape ? 30 : 36, borderRadius: '50%', background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.10)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: isLandscape ? 17 : 20 }}>arrow_back</span>
              </button>
              {activeSong && (
                <p style={{ flex: 1, color: 'var(--c-text-primary)', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: isLandscape ? 12 : 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0, minWidth: 0 }}>
                  {activeSong.name}
                </p>
              )}
              {!activeSong && <div style={{ flex: 1 }} />}
              {/* Editor controls — only on the grid tab */}
              {activeTab === 'songs' && (<>
                {/* Landscape inline BPM + Play */}
                {isLandscape && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(128,128,128,0.06)', borderRadius: 8, padding: '0 4px', height: 28 }}>
                      <button onClick={() => adjustBpm(-1)} className="btn-smooth" title="Decrease BPM by 1" aria-label="Decrease BPM by 1" style={{ width: 22, height: 22, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'Manrope,sans-serif', color: accent.from, minWidth: 28, textAlign: 'center' }}>{pattern.bpm}</span>
                      <button onClick={() => adjustBpm(1)} className="btn-smooth" title="Increase BPM by 1" aria-label="Increase BPM by 1" style={{ width: 22, height: 22, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <div style={{ width: 1, height: 18, background: 'rgba(128,128,128,0.12)' }} />
                    <button onClick={handlePlay} className="btn-smooth" title={playing ? "Stop Playback" : "Start Playback"} aria-label={playing ? "Stop" : "Play"} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: playing ? 'rgba(128,128,128,0.12)' : `linear-gradient(135deg,${accent.from},${accent.to})`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: playing ? 'var(--c-text-secondary)' : '#fff', transition: 'all 150ms', flexShrink: 0 }}>
                      {playing ? '⏹' : '▶'}
                    </button>
                    <div style={{ width: 1, height: 18, background: 'rgba(128,128,128,0.12)' }} />
                  </>
                )}
                {/* Undo / Redo */}
                <button onClick={handleUndo} disabled={historyCount === 0} title="Undo (Ctrl+Z)"
                  style={{ height: 30, width: 30, borderRadius: 8, background: historyCount > 0 ? 'rgba(128,128,128,0.08)' : 'transparent', border: `1px solid ${historyCount > 0 ? 'rgba(128,128,128,0.18)' : 'transparent'}`, cursor: historyCount > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: historyCount > 0 ? 'var(--c-text-secondary)' : 'var(--c-text-muted)', opacity: historyCount > 0 ? 1 : 0.35, flexShrink: 0, transition: 'all 180ms', padding: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, lineHeight: 1 }}>undo</span>
                </button>
                <button onClick={handleRedo} disabled={redoStack.current.length === 0} title="Redo (Ctrl+Y)"
                  style={{ height: 30, width: 30, borderRadius: 8, background: redoStack.current.length > 0 ? 'rgba(128,128,128,0.08)' : 'transparent', border: `1px solid ${redoStack.current.length > 0 ? 'rgba(128,128,128,0.18)' : 'transparent'}`, cursor: redoStack.current.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: redoStack.current.length > 0 ? 'var(--c-text-secondary)' : 'var(--c-text-muted)', opacity: redoStack.current.length > 0 ? 1 : 0.35, flexShrink: 0, transition: 'all 180ms', padding: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 17, lineHeight: 1 }}>redo</span>
                </button>
                <button onClick={() => {
                  if (showHamburger) {
                    setHamburgerClosing(true);
                    setTimeout(() => { setShowHamburger(false); setHamburgerClosing(false); }, 170);
                  } else {
                    setShowHamburger(true);
                  }
                }} title="Toggle Menu" aria-label="Toggle Menu" style={{ height: 30, width: 38, borderRadius: 8, background: showHamburger ? `${accent.from}1e` : 'rgba(128,128,128,0.08)', border: `1px solid ${showHamburger ? accent.from + '33' : 'rgba(128,128,128,0.1)'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', flexShrink: 0, transition: 'all 180ms' }}>
                  {[0, 1, 2].map(i => <span key={i} style={{ display: 'block', width: i === 1 ? 10 : 14, height: 1.5, background: showHamburger ? accent.from : 'var(--c-text-secondary)', borderRadius: 2, transition: 'all 200ms' }} />)}
                </button>
              </>)}
            </>
          ) : (
            <>
              <AppModeMenuLogo color={isLight ? '#18181b' : '#d4d4d8'} size={13} />
              <div style={{ flex: 1 }} />
            </>
          )}
        </div>
      ) : (
        inEditor && (
          <div className={`h-12 border-b px-5 flex items-center justify-between flex-shrink-0 select-none ${
            isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-900 bg-[#000000]'
          }`}>
            {/* Left Group: App Logo + Section + Title */}
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              {/* Module Brand */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isLight ? 'text-zinc-900' : 'text-white'}`}>DRUMEX</span>
                <span className={`text-[10px] font-bold ${isLight ? 'text-zinc-300' : 'text-zinc-800'}`}>|</span>
                <span className={`text-[9.5px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-450'}`}>STEP SEQUENCER</span>
              </div>
              <div className={`h-4.5 w-[1px] ${isLight ? 'bg-zinc-200' : 'bg-zinc-850'}`} />
              {/* Back button */}
              <button 
                onClick={handleBack} 
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                  isLight 
                    ? 'bg-transparent text-zinc-700 border-zinc-200 hover:border-zinc-350 hover:text-black' 
                    : 'bg-transparent text-zinc-405 border-zinc-900 hover:text-white hover:border-zinc-800'
                }`}
                title="Back to Beats"
                aria-label="Back"
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
              </button>
              
              {/* Beat title */}
              <div className="flex flex-col min-w-0">
                <span className={`text-[11px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-800' : 'text-white'} truncate`}>
                  {activeSong?.name || 'Untitled Beat'}
                </span>
              </div>
            </div>

            {/* Center Group: Transport Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '4px 12px', height: 40 }}>
                {/* Play/Stop */}
                <button onClick={handlePlay} className="btn-smooth" title={playing ? "Stop Playback" : "Start Playback"} aria-label={playing ? "Stop" : "Play"} style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: playing ? '#ef4444' : (isLight ? '#18181b' : '#ffffff'),
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: playing ? '#ffffff' : (isLight ? '#ffffff' : '#18181b'), transition: 'all 150ms', flexShrink: 0
                }}>
                  {playing ? '⏹' : '▶'}
                </button>

                <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

                {/* BPM adjusters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => adjustBpm(-10)} className="btn-smooth" title="Decrease BPM by 10" aria-label="Decrease BPM by 10" style={{ width: 22, height: 22, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 10, fontWeight: 700 }}>-10</button>
                  <button onClick={() => adjustBpm(-1)} className="btn-smooth" title="Decrease BPM by 1" aria-label="Decrease BPM by 1" style={{ width: 20, height: 20, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 700 }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'Manrope,sans-serif', color: accent.from, minWidth: 32, textAlign: 'center' }}>{pattern.bpm}</span>
                  <button onClick={() => adjustBpm(1)} className="btn-smooth" title="Increase BPM by 1" aria-label="Increase BPM by 1" style={{ width: 20, height: 20, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 700 }}>+</button>
                  <button onClick={() => adjustBpm(10)} className="btn-smooth" title="Increase BPM by 10" aria-label="Increase BPM by 10" style={{ width: 22, height: 22, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 10, fontWeight: 700 }}>+10</button>
                  <span style={{ fontSize: 10, color: 'var(--c-text-muted)', fontWeight: 600, marginLeft: 2 }}>BPM</span>
                </div>

                <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

                {/* Swing slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text-secondary)', letterSpacing: '0.04em' }}>SWING</span>
                  <input
                    type="range"
                    min={SWING_MIN}
                    max={SWING_MAX}
                    step={1}
                    value={pattern.swing ?? 0}
                    onPointerDown={() => pushUndo()}
                    onChange={e => updatePattern(pattern.id, { swing: clampSwing(Number(e.target.value)) })}
                    style={{ width: 70, height: 16, accentColor: accent.from, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, color: (pattern.swing ?? 0) > 0 ? accent.from : 'var(--c-text-muted)', minWidth: 28 }}>{pattern.swing ?? 0}%</span>
                </div>

                <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

                {/* Subdivision */}
                <button onClick={toggleSub} className="btn-smooth" title="Step Resolution (Subdivision)" aria-label="Step Resolution (Subdivision)" style={{
                  height: 24, padding: '0 8px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 10.5, fontWeight: 700
                }}>
                  1/{pattern.subdivision}
                </button>

                <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

                {/* Loop toggle */}
                <button onClick={() => { setLooping(l => { const n = !l; updateDrumPrefs({ loopPlayback: n }); return n; }); }} className="btn-smooth" style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none',
                  background: looping ? `${accent.from}1a` : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: looping ? accent.from : 'var(--c-text-secondary)', transition: 'all 150ms'
                }} title="Loop Playback" aria-label="Loop Playback">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>repeat</span>
                </button>

                {/* Metronome toggle */}
                <button onClick={() => updateDrumPrefs({ metronome: !drumPrefs.metronome })} className="btn-smooth" style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none',
                  background: drumPrefs.metronome ? `${accent.from}1a` : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: drumPrefs.metronome ? accent.from : 'var(--c-text-secondary)', transition: 'all 150ms'
                }} title="Metronome" aria-label="Metronome">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>music_note</span>
                </button>
              </div>
            </div>

            {/* Right Group: Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flex: '1 1 0%', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Undo / Redo */}
                <button onClick={handleUndo} disabled={historyCount === 0} title="Undo (Ctrl+Z)" aria-label="Undo" className="btn-smooth"
                  style={{ height: 30, width: 30, borderRadius: 8, background: 'transparent', border: 'none', cursor: historyCount > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: historyCount > 0 ? 'var(--c-text-secondary)' : 'var(--c-text-muted)', opacity: historyCount > 0 ? 1 : 0.35 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>undo</span>
                </button>
                <button onClick={handleRedo} disabled={redoStack.current.length === 0} title="Redo (Ctrl+Y)" aria-label="Redo" className="btn-smooth"
                  style={{ height: 30, width: 30, borderRadius: 8, background: 'transparent', border: 'none', cursor: redoStack.current.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: redoStack.current.length > 0 ? 'var(--c-text-secondary)' : 'var(--c-text-muted)', opacity: redoStack.current.length > 0 ? 1 : 0.35 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>redo</span>
                </button>

                <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

                {/* Add Bar */}
                <button onClick={handleAddBar} title="Add new measure (bar)" aria-label="Add Bar" className="btn-smooth" style={{
                  height: 30, padding: '0 12px', borderRadius: 8,
                  background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                  border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  color: 'var(--c-text-primary)', fontSize: 11, fontWeight: 700
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                  <span>Add Bar</span>
                </button>

                {/* Clear */}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowClearConfirm(s => !s)} title="Clear pattern" aria-label="Clear pattern" className="btn-smooth" style={{
                    height: 30, width: 30, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ee7d77'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                  </button>
                  {showClearConfirm && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'rgba(10, 10, 12, 0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', minWidth: 190, zIndex: 100 }}>
                      <p style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif', lineHeight: 1.4 }}>Reset pattern?</p>
                      <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--c-text-muted)', lineHeight: 1.4 }}>All hits will be removed, preserving your bar count. You can undo after.</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setShowClearConfirm(false)} className="btn-smooth"
                          style={{ flex: 1, padding: '7px 0', borderRadius: 9, background: 'rgba(128,128,128,0.12)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope,sans-serif' }}>Cancel</button>
                        <button onClick={() => { handleClear(); setShowClearConfirm(false); }} className="btn-smooth"
                          style={{ flex: 1, padding: '7px 0', borderRadius: 9, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#f87171', fontFamily: 'Manrope,sans-serif' }}>Clear</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Groove */}
                <button onClick={() => { setSavGrName(pattern.name); setSavGrTag(''); setShowSaveGroove(true); }} title="Save pattern to Groove Library" aria-label="Save pattern to Groove Library" className="btn-smooth" style={{
                  height: 30, width: 30, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent.from
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bookmark</span>
                </button>

                <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

                {/* Export JSON / PDF */}
                <button onClick={() => { exportDrumSongJSON(patterns, activeSong); }} title="Export pattern as JSON file" aria-label="Export pattern as JSON file" className="btn-smooth"
                  style={{ height: 30, width: 30, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-secondary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>data_object</span>
                </button>
                <button onClick={() => { setShowExportModal(true); }} title="Export as PDF" className="btn-smooth"
                  style={{ height: 30, width: 30, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-secondary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>picture_as_pdf</span>
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Hamburger panel ──────────────────────────────────────────────── */}
      {inEditor && (showHamburger || hamburgerClosing) && (
        <div style={{ flexShrink: 0, overflow: 'hidden', background: isAmoled ? '#000' : (isLight ? 'rgba(250,249,247,0.98)' : 'rgba(14,14,17,0.98)'), borderBottom: '1px solid rgba(128,128,128,0.10)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', animation: hamburgerClosing ? 'drumHamburgerOut 170ms cubic-bezier(0.4,0,1,1) both' : 'drumHamburgerIn 200ms cubic-bezier(0.22,1,0.36,1)', maxHeight: kit === 'house' ? '70vh' : undefined }}>
          <div className="no-scrollbar" style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: kit === 'house' ? 'auto' : 'visible', maxHeight: kit === 'house' ? '70vh' : undefined }}>
            {/* ── House Kit mic selector ──────────────────────────────────── */}
            {kit === 'house' && (<>
              <div style={{ padding: '8px 4px 4px' }}>
                <span style={{ color: 'var(--c-text-secondary)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Mic Position
                </span>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {HOUSE_MICS.map(m => {
                    const active = houseKitMic === m.id;
                    return (
                      <button key={m.id} className="btn-smooth"
                        onClick={() => {
                          storeSetHouseKitMic(m.id);
                          setHouseKitMic(m.id);
                        }}
                        style={{ flex: 1, height: 30, borderRadius: 8, border: active ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(128,128,128,0.12)', background: active ? `${accent.from}1a` : 'rgba(128,128,128,0.06)', color: active ? accent.from : 'var(--c-text-secondary)', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 160ms', fontFamily: 'Manrope,sans-serif' }}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
                {!houseLoaded && (
                  <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <LoadingLottie width={16} />
                    <span style={{ fontSize: 10.5, color: 'var(--c-text-muted)', fontFamily: 'Inter,sans-serif' }}>
                      {houseProgress.total > 0
                        ? `${houseProgress.loaded}/${houseProgress.total}`
                        : 'Loading…'}
                    </span>
                  </div>
                )}
                {houseLoaded && (
                  <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <SuccessLottie size={16} isLight={isLight} />
                    <span style={{ fontSize: 10.5, color: accent.from, fontFamily: 'Inter,sans-serif' }}>
                      Samples ready
                    </span>
                  </div>
                )}
              </div>
              <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '8px 4px 4px' }} />

              {/* ── Per-instrument velocity flavor (collapsible) ── */}
              <div style={{ padding: '4px 4px 6px' }}>
                <button
                  onClick={() => setShowSoundCharacter(s => !s)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 6px' }}>
                  <span style={{ color: 'var(--c-text-secondary)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>
                    Sound Character
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 200ms', transform: showSoundCharacter ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {showSoundCharacter && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                  {((['kick', 'snare', 'tom10', 'tom12', 'tom14'] as HouseInstName[])).map(hInst => {
                    const locked = houseInstVelOverride[hInst];
                    return (
                      <div key={hInst}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-text-primary)', flex: 1, fontFamily: 'Manrope,sans-serif' }}>
                            {HOUSE_INST_LABELS[hInst]}
                          </span>
                          {locked && (
                            <button
                              onClick={() => storeSetInstVelOverride(hInst, undefined)}
                              style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontFamily: 'Manrope,sans-serif', letterSpacing: '0.04em' }}>
                              AUTO
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {HOUSE_VEL_CONFIGS[hInst].map(v => {
                            const active = locked === v.id;
                            return (
                              <button key={v.id} className="btn-smooth"
                                onClick={() => storeSetInstVelOverride(hInst, active ? undefined : v.id)}
                                style={{ height: 26, padding: '0 10px', borderRadius: 6, border: active ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(128,128,128,0.14)', background: active ? `${accent.from}1a` : 'rgba(128,128,128,0.06)', color: active ? accent.from : 'var(--c-text-secondary)', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', transition: 'all 140ms', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>
                                {v.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* ── Crash Cymbal model selector ── */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-text-primary)', flex: 1, fontFamily: 'Manrope,sans-serif' }}>Crash Cymbal</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {HOUSE_CRASH_MODELS.map(m => {
                        const active = houseCrashModel === m.id;
                        return (
                          <button key={m.id} className="btn-smooth"
                            onClick={() => storeSetHouseCrashModel(m.id as HouseCrashModel)}
                            title={m.desc}
                            style={{ height: 26, padding: '0 10px', borderRadius: 6, border: active ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(128,128,128,0.14)', background: active ? `${accent.from}1a` : 'rgba(128,128,128,0.06)', color: active ? accent.from : 'var(--c-text-secondary)', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', transition: 'all 140ms', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Cymbal Pack selector ── */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-text-primary)', flex: 1, fontFamily: 'Manrope,sans-serif' }}>Cymbal Pack</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {CYMBAL_PACKS.map(p => {
                        const active = cymbalPack === p.id;
                        return (
                          <button key={p.id} className="btn-smooth"
                            onClick={() => storeSetCymbalPack(p.id as CymbalPack)}
                            title={p.desc}
                            style={{ height: 26, padding: '0 10px', borderRadius: 6, border: active ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(128,128,128,0.14)', background: active ? `${accent.from}1a` : 'rgba(128,128,128,0.06)', color: active ? accent.from : 'var(--c-text-secondary)', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', transition: 'all 140ms', fontFamily: 'Manrope,sans-serif', whiteSpace: 'nowrap' }}>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Random Variations toggle ── */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
                    <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif' }}>Random Variations</span>
                    <button onClick={() => updateDrumPrefs({ randomVariations: !drumPrefs.randomVariations })} style={{ width: 36, height: 20, borderRadius: 10, background: drumPrefs.randomVariations ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.18)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 220ms', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 2.5, left: drumPrefs.randomVariations ? 18 : 2.5, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)', display: 'block' }} />
                    </button>
                  </div>
                </div>}
              </div>

              <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 4px' }} />
            </>)}
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 12 }}>
              <span style={{ flex: 1, color: 'var(--c-text-primary)', fontSize: 13, fontWeight: 500 }}>Loop</span>
              <button onClick={() => { setLooping(l => { const n = !l; updateDrumPrefs({ loopPlayback: n }); return n; }); }} style={{ width: 40, height: 22, borderRadius: 11, background: looping ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.18)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 220ms', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 3, left: looping ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)', display: 'block' }} />
              </button>
            </div>
            <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--c-text-primary)', fontSize: 13, fontWeight: 500 }}>Step Resolution</span>
                <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: 11, marginTop: 1 }}>{pattern.subdivision === 16 ? '16th notes' : '8th notes'}</span>
              </div>
              <button onClick={toggleSub} style={{ height: 28, padding: '0 14px', borderRadius: 8, background: `${accent.from}18`, border: `1px solid ${accent.from}33`, cursor: 'pointer', color: accent.from, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>1/{pattern.subdivision}</button>
            </div>
            {/* ── Humanize ──────────────────────────────────────────────── */}
            <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ color: 'var(--c-text-primary)', fontSize: 13, fontWeight: 500 }}>Humanize</span>
                <span style={{ display: 'block', color: 'var(--c-text-muted)', fontSize: 11, marginTop: 1 }}>
                  {humanizeFeedback ? 'Applied!' : 'Add subtle variation to the pattern'}
                </span>
              </div>
              <button
                onClick={handleHumanize}
                className="btn-smooth"
                style={{
                  height: 28, padding: '0 12px', borderRadius: 8,
                  background: humanizeFeedback ? `${accent.from}22` : `${accent.from}18`,
                  border: `1px solid ${humanizeFeedback ? accent.from + '55' : accent.from + '33'}`,
                  cursor: 'pointer', color: accent.from,
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                  transition: 'all 200ms',
                  fontFamily: 'Manrope,sans-serif',
                }}
              >
                {humanizeFeedback ? '✓ Done' : 'Apply'}
              </button>
            </div>

            {/* ── Preferences ───────────────────────────────────────────── */}
            <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 4px' }} />
            <button
              onClick={() => { setShowHamburger(false); handleSetTab('prefs'); }}
              className="btn-smooth"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 13, fontFamily: 'Manrope,sans-serif', fontWeight: 500, textAlign: 'left' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="6" x2="8" y2="3"/><line x1="8" y1="6" x2="8" y2="9"/>
                <line x1="4" y1="12" x2="20" y2="12"/><line x1="14" y1="12" x2="14" y2="9"/><line x1="14" y1="12" x2="14" y2="15"/>
                <line x1="4" y1="18" x2="20" y2="18"/><line x1="10" y1="18" x2="10" y2="15"/><line x1="10" y1="18" x2="10" y2="21"/>
              </svg>
              <span>Preferences</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>

            <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', padding: '9px 4px', gap: 8 }}>
              <span style={{ flex: 1, color: 'var(--c-text-secondary)', fontSize: 13, fontWeight: 500 }}>Export</span>
              {/* JSON icon button */}
              <button onClick={() => { exportDrumSongJSON(patterns, activeSong); setShowHamburger(false); }}
                title="Export as JSON" className="btn-smooth"
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--app-surface-high)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: 17 }}>data_object</span>
              </button>
              {/* PDF icon button */}
              <button onClick={() => { setShowHamburger(false); setShowExportModal(true); }}
                title="Export as PDF" className="btn-smooth"
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--app-surface-high)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: 17 }}>picture_as_pdf</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: (isWebDesktop && isLargeDesktop) ? 'row' : 'column', 
          flex: 1, 
          width: '100%', 
          height: '100%', 
          overflow: 'hidden' 
        }}
      >
        {isWebDesktop && (
          <WebAppSectionDock 
            app="drums" 
            activeSection={activeTab} 
            onChangeSection={handleSetTab} 
          />
        )}
        <div key={activeTab} className={tabAnim} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingBottom: '0px' }}>
          
          {/* Top bar / header for desktop */}
          {isWebDesktop && !inEditor && (
            <div className={`h-12 border-b px-5 flex items-center justify-between flex-shrink-0 select-none ${
              isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-900 bg-[#000000]'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isLight ? 'text-zinc-900' : 'text-white'}`}>DRUMEX</span>
                <span className={`text-[10px] font-bold ${isLight ? 'text-zinc-300' : 'text-zinc-800'}`}>|</span>
                <span className={`text-[9.5px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-450'}`}>
                  {activeTab === 'songs' ? 'BEATS' : activeTab === 'patterns' ? 'GROOVE LIBRARY' : 'PREFERENCES'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {activeTab === 'songs' && (
                  <>
                    <button
                      onClick={() => setShowImportDrum(true)}
                      className={`h-7.5 px-3 rounded-lg border text-[9.5px] font-extrabold tracking-widest uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                        isLight
                          ? 'border-zinc-200 bg-zinc-100/50 text-zinc-650 hover:bg-zinc-200 hover:text-black'
                          : 'border-zinc-900 bg-zinc-950/20 text-zinc-400 hover:bg-zinc-900 hover:text-white hover:border-zinc-800'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">upload_file</span>
                      <span>IMPORT</span>
                    </button>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className={`h-7.5 px-3.5 rounded-lg border text-[9.5px] font-extrabold tracking-widest uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                        isLight 
                          ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' 
                          : 'border-blue-900/60 bg-blue-950/40 text-blue-400 hover:bg-blue-900/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">add</span>
                      <span>NEW BEAT</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

        {/* ═══ SONGS LIST (Songs tab, not in editor) ═══════════════════════ */}
        {activeTab === 'songs' && !inEditor && (
          <div onScroll={drumScrollHide} style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }} className="no-scrollbar panel-enter-left flex flex-col">
            {!isWebDesktop && (
              <div style={{ padding: '0 20px', marginTop: 12, marginBottom: 24 }}>
                <AnimatedAppHeader
                  title="Beats"
                  subtitle="Your drum songs"
                />
              </div>
            )}

            {/* Desktop Secondary Toolbar */}
            {isWebDesktop && (
              <div className={`h-10 border-b px-5 flex items-center justify-between flex-shrink-0 text-[11px] font-manrope ${
                isLight ? 'border-zinc-200 bg-zinc-50/50' : 'border-zinc-900 bg-[#000000]'
              }`}>
                {/* Left: Search input */}
                <div className="flex items-center gap-2 flex-1 max-w-xs relative">
                  <span className="material-symbols-outlined text-[14px] text-zinc-500 absolute left-2">search</span>
                  <input
                    value={songSearch}
                    onChange={e => setSongSearch(e.target.value)}
                    placeholder="Search beats..."
                    className={`w-full pl-7 pr-2.5 py-1 rounded-md border text-[10.5px] outline-none transition-all ${
                      isLight 
                        ? 'bg-white border-zinc-200 text-zinc-850 focus:border-zinc-350 placeholder-zinc-400' 
                        : 'bg-[#000000] border-zinc-850 text-white focus:border-zinc-750 placeholder-zinc-650'
                    }`}
                  />
                </div>
                
                {/* Right: Filters & Sorting */}
                <div className="flex items-center gap-4">
                  {/* Kit filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 uppercase tracking-wider text-[9px] font-bold">Kit:</span>
                    <select
                      value={songKitFilter}
                      onChange={e => setSongKitFilter(e.target.value)}
                      className={`px-2 py-0.5 rounded border text-[10.5px] font-bold outline-none cursor-pointer ${
                        isLight 
                          ? 'bg-white border-zinc-200 text-zinc-700' 
                          : 'bg-[#000000] border-zinc-850 text-zinc-300'
                      }`}
                    >
                      <option value="all">All Kits</option>
                      {Object.entries(KIT_LABEL).map(([val, lbl]) => (
                        <option key={val} value={val}>{lbl}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Sort */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 uppercase tracking-wider text-[9px] font-bold">Sort:</span>
                    <select
                      value={songSort}
                      onChange={e => setSongSort(e.target.value as any)}
                      className={`px-2 py-0.5 rounded border text-[10.5px] font-bold outline-none cursor-pointer ${
                        isLight 
                          ? 'bg-white border-zinc-200 text-zinc-700' 
                          : 'bg-[#000000] border-zinc-850 text-zinc-300'
                      }`}
                    >
                      <option value="recent">Recent</option>
                      <option value="name">Name</option>
                      <option value="bpm">BPM</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            {drumSongs.length === 0 ? (
              <div className={`spring-in flex flex-col items-center justify-center p-12 mx-5 border rounded-2xl gap-5 ${
                isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-[#000000] border-zinc-900'
              }`}>
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center border ${
                  isLight ? 'border-zinc-200 bg-zinc-100/50 text-zinc-650' : 'border-zinc-900 bg-zinc-950/20 text-zinc-400'
                }`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="7" rx="10" ry="4"/><path d="M2 7c0 2.21 4.48 4 10 4s10-1.79 10-4"/><path d="M2 7v5c0 2.21 4.48 4 10 4s10-1.79 10-4V7"/><path d="M2 12v5c0 2.21 4.48 4 10 4s10-1.79 10-4v-5"/></svg>
                </div>
                <div className="text-center">
                  <span className={`block text-sm font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-800' : 'text-white'}`}>No beats yet</span>
                  <span className="block text-[10px] text-zinc-500 font-extrabold uppercase tracking-wide mt-1.5">Create your first drum beat to get started.</span>
                </div>
                <button 
                  onClick={() => setShowCreateForm(true)} 
                  className={`py-2 px-5 rounded-lg border text-[10px] font-extrabold tracking-widest uppercase transition-all cursor-pointer ${
                    isLight 
                      ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' 
                      : 'border-blue-900/60 bg-blue-950/40 text-blue-400 hover:bg-blue-900/40'
                  }`}
                >
                  New Beat
                </button>
              </div>
            ) : filteredSongs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
                <span className="material-symbols-outlined text-[36px] mb-3">search_off</span>
                <span className="text-xs font-bold uppercase tracking-wider">No matching beats found</span>
                <span className="text-[10px] mt-1">Try refining your search term or filters.</span>
              </div>
            ) : (
              <div className={isWebDesktop ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6" : "flex flex-col gap-2.5 px-4"}>
                <StaggeredReveal staggerInterval={40}>
                  {filteredSongs.map((song: any) => {
                  const isDeleting = deletingId === song.id;
                  const isEditing  = editingSong?.id === song.id;
                  const kitLabel   = song.kitType ? KIT_LABEL[song.kitType as KitType] : 'No kit';
                  const pCount     = song.patterns.length;
                  const activePat  = song.patterns.find((p: any) => p.id === song.activePatternId) ?? song.patterns[0];
                  const bpm        = activePat?.bpm ?? 120;
                  return (
                    <div key={song.id} className={`border rounded-xl overflow-hidden transition-all duration-300 ${
                      isLight 
                        ? 'bg-zinc-50 border-zinc-200 hover:border-zinc-300' 
                        : 'bg-[#000000] border-zinc-900 hover:border-zinc-800'
                    }`}>
                      {isEditing ? (
                        <div className="p-3.5 flex flex-col gap-2.5">
                          <input 
                            value={editingName} 
                            onChange={e => setEditingName(e.target.value)} 
                            autoFocus 
                            placeholder="Beat name" 
                            className={`w-full py-1.5 px-2.5 rounded-lg border text-[12px] font-extrabold outline-none transition-all ${
                              isLight 
                                ? 'bg-white border-zinc-200 text-zinc-800 focus:border-zinc-350' 
                                : 'bg-[#000000] border-zinc-850 text-white focus:border-zinc-750'
                            }`} 
                          />
                          <input 
                            value={editingArtist} 
                            onChange={e => setEditingArtist(e.target.value)} 
                            placeholder="Artist (optional)" 
                            className={`w-full py-1.5 px-2.5 rounded-lg border text-[11px] outline-none transition-all ${
                              isLight 
                                ? 'bg-white border-zinc-200 text-zinc-800 focus:border-zinc-350' 
                                : 'bg-[#000000] border-zinc-850 text-white focus:border-zinc-750'
                            }`}
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={handleSaveEdit} 
                              className={`flex-1 py-1.5 rounded-lg border text-[10px] font-extrabold tracking-widest uppercase transition-all cursor-pointer ${
                                isLight 
                                  ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100' 
                                  : 'border-blue-900/60 bg-blue-950/40 text-blue-400 hover:bg-blue-900/40'
                              }`}
                            >
                              Save
                            </button>
                            <button 
                              onClick={() => setEditingSong(null)} 
                              className={`flex-1 py-1.5 rounded-lg border text-[10px] font-extrabold tracking-widest uppercase transition-all cursor-pointer ${
                                isLight 
                                  ? 'border-zinc-200 bg-zinc-100/50 text-zinc-700 hover:bg-zinc-200' 
                                  : 'border-zinc-900 bg-zinc-950/20 text-zinc-400 hover:bg-zinc-900 hover:text-white'
                              }`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : isDeleting ? (
                        <div className="p-4 flex flex-col justify-center items-center text-center gap-3 flex-1">
                          <span className={`text-[10.5px] font-extrabold uppercase tracking-wide ${isLight ? 'text-zinc-800' : 'text-white'}`}>
                            Delete this beat?
                          </span>
                          <div className="flex gap-2 w-full max-w-[180px]">
                            <button 
                              onClick={() => { deleteDrumSong(song.id); setDeletingId(null); }} 
                              className="flex-1 py-1 rounded-lg text-[9.5px] font-extrabold tracking-widest uppercase border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer"
                            >
                              Yes
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)} 
                              className={`flex-1 py-1 rounded-lg text-[9.5px] font-extrabold tracking-widest uppercase border cursor-pointer ${
                                isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-650' : 'border-zinc-900 bg-zinc-950 text-zinc-400'
                              }`}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col flex-1 relative">
                          {/* Menu button (···) */}
                          <div className="absolute right-2 top-2 z-10">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSongMenuId(songMenuId === song.id ? null : song.id); }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                                songMenuId === song.id 
                                  ? (isLight ? 'bg-zinc-100 border-zinc-350 text-black' : 'bg-zinc-900 border-zinc-800 text-white')
                                  : (isLight ? 'bg-transparent border-transparent text-zinc-450 hover:border-zinc-250 hover:text-black' : 'bg-transparent border-transparent text-zinc-500 hover:border-zinc-800 hover:text-white')
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">more_vert</span>
                            </button>
                            
                            {/* Dropdown Menu */}
                            {songMenuId === song.id && (
                              <div className={`absolute right-0 top-8 z-20 w-32 py-1 rounded-lg border shadow-lg ${
                                isLight ? 'bg-white border-zinc-200' : 'bg-[#080808] border-zinc-900'
                              }`}>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleStartEdit(song); setSongMenuId(null); }}
                                  className={`w-full text-left px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
                                    isLight ? 'text-zinc-700 hover:bg-zinc-50 hover:text-black' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[13px]">edit</span>
                                  Rename
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setDeletingId(song.id); setSongMenuId(null); }}
                                  className="w-full text-left px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors text-red-400 hover:bg-red-500/10"
                                >
                                  <span className="material-symbols-outlined text-[13px]">delete</span>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Card click area */}
                          <button 
                            onClick={() => handleLoadSong(song)} 
                            className="w-full text-left p-4 flex items-start gap-3.5 bg-transparent border-none cursor-pointer transition-all hover:bg-zinc-500/5 flex-1"
                          >
                            <div className={`w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center border ${
                              isLight ? 'border-zinc-200 bg-zinc-100' : 'border-zinc-900 bg-zinc-950'
                            }`}>
                              {song.kitType && KIT_IMAGE[song.kitType as KitType] ? (
                                <img src={KIT_IMAGE[song.kitType as KitType]} alt={kitLabel} className="w-full h-full object-cover" />
                              ) : (
                                <span className={`material-symbols-outlined text-[18px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>music_note</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pr-6">
                              <span className={`block text-[12.5px] font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-800' : 'text-white'} truncate`}>
                                {song.name}
                              </span>
                              {song.artist && (
                                <span className={`block text-[9px] font-extrabold uppercase tracking-wider truncate mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-450'}`}>
                                  {song.artist}
                                </span>
                              )}
                              <div className="flex gap-2 mt-2 items-center flex-wrap">
                                <span className={`text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 border rounded-full ${
                                  isLight ? 'bg-zinc-100 border-zinc-200 text-zinc-650' : 'bg-zinc-900/30 border-zinc-900 text-zinc-400'
                                }`}>
                                  {kitLabel}
                                </span>
                                <span className={`text-[8.5px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                  <span className="material-symbols-outlined text-[10px]">speed</span>
                                  {bpm} BPM
                                </span>
                                <span className={`text-[8.5px] font-extrabold uppercase tracking-wider ${isLight ? 'text-zinc-450' : 'text-zinc-550'}`}>
                                  {pCount} pattern{pCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </button>
                          
                          {/* Bottom hover bar or indicator */}
                          <div className={`h-1 w-full transition-all duration-300 mt-auto ${
                            isLight ? 'bg-zinc-100 group-hover:bg-blue-600' : 'bg-zinc-950 group-hover:bg-blue-500/80'
                          }`} />
                        </div>
                      )}
                    </div>
                  );
                })}
                </StaggeredReveal>
              </div>
            )}
          </div>
        )}

        {/* ═══ DRUM GRID EDITOR (Songs tab, in editor) ══════════════════════ */}
        {activeTab === 'songs' && inEditor && (
          <div className="panel-enter-right" style={{ flex: 1, display: 'flex', flexDirection: isWebDesktop ? 'row' : 'column', overflow: 'hidden', position: 'relative' }}>
            <div ref={containerCallbackRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {/* Row visibility toggle */}
            {extraInsts.length > 0 && (
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', height: 30, borderBottom: `1px solid ${barColor}`, background: 'var(--app-bg)' }}>
                <span style={{ color: 'var(--c-text-muted)', fontSize: 9.5, fontFamily: 'Manrope', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {showExtraRows ? `All rows (${visibleInsts.length})` : `Core rows (${visibleInsts.length})`}
                </span>
                <button onClick={() => setShowExtraRows(v => !v)} className="btn-smooth"
                  style={{ height: 22, padding: '0 10px', borderRadius: 999, background: showExtraRows ? `${accent.from}15` : 'rgba(128,128,128,0.10)', border: `1px solid ${showExtraRows ? accent.from + '30' : 'rgba(128,128,128,0.16)'}`, cursor: 'pointer', color: showExtraRows ? accent.from : 'var(--c-text-secondary)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 180ms' }}>
                  {showExtraRows ? (
                    <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 15l-6-6-6 6"/></svg>Hide extras</>
                  ) : (
                    <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>Show all</>
                  )}
                </button>
              </div>
            )}
            <div
              ref={scrollRef}
              onScroll={drumScrollHide}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={cancelPointer}
              onPointerCancel={cancelPointer}
              style={{ flex: 1, overflowY: 'auto', overflowX: (pattern.measures.length > 2) ? 'auto' : 'hidden', paddingTop: 8, paddingBottom: isWebDesktop ? 110 : (isLandscape ? 20 : 100), position: 'relative' }}
              className="no-scrollbar"
            >
              {/* Playhead — extends into ruler, draggable handle at top */}
              <div ref={playheadRef} style={{ position: 'absolute', top: 8, left: 0, width: 2, height: RULER_H + visibleInsts.length * ROW_H, background: accent.from, boxShadow: `0 0 8px ${accent.from}88`, pointerEvents: 'none', zIndex: 10, display: 'block', borderRadius: 1, willChange: 'transform', transform: `translate(${LABEL_W}px, 0px)` }}>
                {/* Draggable handle — downward triangle above the ruler */}
                <div
                  onPointerDown={e => {
                    e.stopPropagation();
                    const el = scrollRef.current;
                    if (!el) return;
                    const onMove = (ev: PointerEvent) => {
                      const rect = el.getBoundingClientRect();
                      const relX = ev.clientX - rect.left + el.scrollLeft - LABEL_W;
                      const step = Math.max(0, Math.floor(relX / stepWRef.current));
                      drumScheduler.seekTo(step);
                    };
                    const onUp = () => {
                      document.removeEventListener('pointermove', onMove);
                      document.removeEventListener('pointerup', onUp);
                    };
                    document.addEventListener('pointermove', onMove);
                    document.addEventListener('pointerup', onUp);
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  style={{
                    position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '7px solid transparent',
                    borderRight: '7px solid transparent',
                    borderTop: `10px solid ${accent.from}`,
                    cursor: 'ew-resize',
                    pointerEvents: 'auto',
                    filter: `drop-shadow(0 0 4px ${accent.from}88)`,
                  }}
                />
              </div>
              {containerW > LABEL_W && systemRows.map((rowMeasures, sysIdx) => {
                const mStartIdx = sysIdx * measuresPerRow;
                return (
                  <div key={sysIdx} style={{ marginBottom: SYS_SEP }}>
                    <div style={{ display: 'flex', height: RULER_H, borderBottom: `1px solid ${barColor}`, position: 'relative' }}>
                      <div style={{
                        width: LABEL_W,
                        flexShrink: 0,
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        background: 'var(--app-bg)',
                        borderRight: `1px solid ${barColor}`,
                        height: '100%',
                      }} />
                      {rowMeasures.map((m, mi) => {
                        const globalM   = mStartIdx + mi;
                        const canDelete = pattern.measures.length > 1;
                        const menuOpen  = openBarMenu === m.id;
                        const isFlash   = flashBarId  === m.id;
                        return (
                          <div key={mi} style={{ width: MEASURE_W, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 6, paddingRight: 2, borderLeft: mi > 0 ? `1px solid ${barColor}` : 'none', gap: 4, position: 'relative', background: isFlash ? `${accent.from}22` : (loopActive && globalM >= effectiveLoop.startBar && globalM <= effectiveLoop.endBar ? `${accent.from}1a` : 'transparent'), transition: 'background 400ms' }}>
                            {/* Loop range bracket markers — small ▸ at startBar, ◂ at endBar */}
                            {loopActive && globalM === effectiveLoop.startBar && (
                              <span aria-hidden style={{ position: 'absolute', top: 2, left: 2, fontSize: 8, fontWeight: 900, color: accent.from, lineHeight: 1, pointerEvents: 'none' }}>▸</span>
                            )}
                            {loopActive && globalM === effectiveLoop.endBar && (
                              <span aria-hidden style={{ position: 'absolute', top: 2, right: 2, fontSize: 8, fontWeight: 900, color: accent.from, lineHeight: 1, pointerEvents: 'none' }}>◂</span>
                            )}
                            <span style={{ color: loopActive && globalM >= effectiveLoop.startBar && globalM <= effectiveLoop.endBar ? accent.from : 'var(--c-text-primary)', fontSize: 10, fontWeight: 700, fontFamily: 'Manrope, sans-serif', opacity: loopActive && globalM >= effectiveLoop.startBar && globalM <= effectiveLoop.endBar ? 0.95 : 0.65, flexShrink: 0 }}>{globalM + 1}</span>
                            <svg
                              style={{ position: 'absolute', bottom: 0, left: 0, width: MEASURE_W, height: 13, pointerEvents: 'none' }}
                              viewBox={`0 0 ${MEASURE_W} 13`}
                              preserveAspectRatio="none"
                            >
                              {Array.from({ length: spm }, (_, s) => {
                                const x      = s * STEP_W;
                                const isBeat = s % stepsPerBeat === 0;
                                const isDown = s === 0;
                                const h      = isDown ? 11 : isBeat ? 7 : 4;
                                const op     = isDown ? 0.55 : isBeat ? 0.30 : 0.14;
                                return (
                                  <line key={s} x1={x} y1={13 - h} x2={x} y2={13}
                                    stroke="var(--c-text-primary)" strokeWidth={isDown ? 1.2 : 0.8} opacity={op} />
                                );
                              })}
                            </svg>
                            {/* ··· menu button */}
                            <button
                              onPointerDown={e => e.stopPropagation()}
                              onPointerUp={e => { e.stopPropagation(); setOpenBarMenu(menuOpen ? null : m.id); }}
                              style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: menuOpen ? `${accent.from}22` : 'transparent', border: `1px solid ${menuOpen ? accent.from + '44' : 'rgba(128,128,128,0.22)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: menuOpen ? accent.from : 'var(--c-text-muted)', fontSize: 8, letterSpacing: '0.05em', fontWeight: 900, lineHeight: 1, padding: 0, transition: 'all 140ms' }}
                            >···</button>
                            {/* Dropdown menu */}
                            {menuOpen && (
                              <div onPointerDown={e => e.stopPropagation()}
                                style={{ position: 'absolute', top: RULER_H + 2, left: 0, zIndex: 92, background: isAmoled ? 'rgba(4,4,4,0.98)' : (isLight ? 'rgba(255,255,255,0.98)' : 'rgba(18,18,22,0.98)'), border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.10)', borderRadius: 10, boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.14)' : '0 8px 32px rgba(0,0,0,0.55)', padding: '4px 0', minWidth: 148, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', animation: 'drumHamburgerIn 150ms cubic-bezier(0.22,1,0.36,1)' }}>
                                <button onPointerUp={e => { e.stopPropagation(); setCopiedMeasure(JSON.parse(JSON.stringify(m))); setOpenBarMenu(null); }} style={menuItemSt}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                  Copy bar
                                </button>
                                <button onPointerUp={e => { e.stopPropagation(); pushUndo(); duplicateMeasure(pattern.id, m.id); setOpenBarMenu(null); }} style={menuItemSt}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="13" height="13" rx="2"/><path d="M9 17v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2"/></svg>
                                  Duplicate
                                </button>
                                {copiedMeasure && (
                                  <button onPointerUp={e => {
                                    e.stopPropagation();
                                    pushUndo();
                                    const newId = insertMeasureAfter(pattern.id, m.id, copiedMeasure.hits);
                                    setOpenBarMenu(null);
                                    setFlashBarId(newId);
                                    setTimeout(() => setFlashBarId(null), 700);
                                  }} style={{ ...menuItemSt, color: accent.from }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                                    Paste after
                                  </button>
                                )}
                                {canDelete && (
                                  <>
                                    <div style={{ height: 1, background: 'rgba(128,128,128,0.10)', margin: '4px 0' }} />
                                    <button onPointerUp={e => { e.stopPropagation(); pushUndo(); if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); } deleteMeasure(pattern.id, m.id); setOpenBarMenu(null); }} style={{ ...menuItemSt, color: '#f87171' }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                      Delete bar
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {visibleInsts.map((inst, instIdx) => {
                      const isFoc  = focusedInst === inst;
                      const varList = INST_VARIATIONS[inst];
                      return (
                        <div key={inst} style={{
                          display: 'flex',
                          height: ROW_H,
                          marginBottom: rowGap,
                          borderRadius: isWebDesktop ? 8 : 0,
                          border: isWebDesktop ? (isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)') : 'none',
                          borderBottom: isWebDesktop ? (isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)') : (instIdx < visibleInsts.length - 1 ? `1px solid ${staffColor}` : `1.5px solid ${barColor}`),
                          background: (isFoc && drumPrefs.highlightActiveInst)
                            ? (isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.018)')
                            : (isWebDesktop ? 'var(--app-surface)' : 'transparent'),
                          overflow: isWebDesktop ? 'hidden' : 'visible'
                        }}>
                          <div style={{
                            width: LABEL_W,
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            paddingLeft: 12,
                            paddingRight: 6,
                            borderRight: isWebDesktop ? (isLight ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.06)') : `1px solid ${barColor}`,
                            position: 'sticky',
                            left: 0,
                            zIndex: 10,
                            background: (isFoc && drumPrefs.highlightActiveInst)
                              ? (isLight ? '#eae9e6' : '#1b1b21')
                              : (isWebDesktop ? 'var(--app-surface)' : 'var(--app-bg)'),
                          }}>
                            <span style={{ fontSize: 8, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: (isFoc && drumPrefs.highlightActiveInst) ? 'var(--c-text-primary)' : 'var(--c-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'color 200ms' }}>{INST_LABEL[inst]}</span>
                            {varList && varList.length > 1 && (
                              <span style={{ fontSize: 6.5, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-muted)', opacity: 0.55, letterSpacing: '0.02em', whiteSpace: 'normal', lineHeight: 1.35, marginTop: 1, width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{varList.join(' · ')}</span>
                            )}
                          </div>
                          <InstrumentRow inst={inst} mStartIdx={mStartIdx} rowMeasures={rowMeasures} spm={spm} stepsPerBeat={stepsPerBeat} STEP_W={STEP_W} MEASURE_W={MEASURE_W} noteColor={noteColor} staffColor={staffColor} barColor={barColor} altBg={altBg} showVariations={drumPrefs.showNoteVariations} gridEmphasis={drumPrefs.gridLinesEmphasis} accentFrom={accent.from} ROW_H={ROW_H} isLight={isLight} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {/* BPM + Play (hidden in landscape / desktop — controls are in the top bar) */}
            <div style={{ position: 'fixed', right: 14, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)', zIndex: 60, display: (isWebDesktop || isLandscape) ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {/* Clear button — black bg, red trash icon */}
              <div style={{ position: 'relative' }}>
                {showClearConfirm && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, background: isAmoled ? 'rgba(4,4,4,0.98)' : (isLight ? 'rgba(250,250,252,0.98)' : 'rgba(18,18,22,0.98)'), border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', minWidth: 190, animation: 'drumHamburgerIn 150ms cubic-bezier(0.22,1,0.36,1)', zIndex: 80 }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif', lineHeight: 1.4 }}>Reset pattern?</p>
                    <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--c-text-muted)', lineHeight: 1.4 }}>All hits and extra bars will be removed, leaving one empty bar. You can undo after.</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setShowClearConfirm(false)} className="btn-smooth"
                        style={{ flex: 1, padding: '7px 0', borderRadius: 9, background: 'rgba(128,128,128,0.12)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope,sans-serif' }}>Cancel</button>
                      <button onClick={() => { handleClear(); setShowClearConfirm(false); }} className="btn-smooth"
                        style={{ flex: 1, padding: '7px 0', borderRadius: 9, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#f87171', fontFamily: 'Manrope,sans-serif' }}>Clear</button>
                    </div>
                  </div>
                )}
                <button onClick={() => setShowClearConfirm(s => !s)} title="Clear pattern" className="btn-smooth"
                  style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: showClearConfirm ? 'rgba(239,68,68,0.18)' : (isAmoled ? 'rgba(4,4,4,0.92)' : isLight ? 'rgba(220,220,224,0.92)' : 'rgba(14,14,16,0.88)'), backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: showClearConfirm ? '0 2px 12px rgba(239,68,68,0.3)' : (isLight ? '0 2px 12px rgba(0,0,0,0.12)' : '0 2px 12px rgba(0,0,0,0.55)'), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: showClearConfirm ? '1.5px solid rgba(239,68,68,0.4)' : (isLight ? '1.5px solid rgba(0,0,0,0.12)' : '1.5px solid rgba(255,255,255,0.08)'), transition: 'all 160ms' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
              {/* ── Smart Loop button + popover ─────────────────────────── */}
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {showLoopPanel && (() => {
                  const barCount = pattern.measures.length;
                  const lr       = effectiveLoop;
                  const enabled  = lr.enabled;
                  const setLR    = (next: Partial<LoopRange>) => {
                    const merged = clampLoopRange({ ...lr, ...next }, barCount);
                    updatePattern(pattern.id, { loopRange: merged });
                  };
                  const presets: { id: string; label: string; bars: number | 'full' }[] = [
                    { id: '1bar',  label: '1 Bar',  bars: 1 },
                    { id: '2bars', label: '2 Bars', bars: 2 },
                    { id: 'full',  label: 'Full',   bars: 'full' },
                  ];
                  const applyPreset = (bars: number | 'full') => {
                    pushUndo();
                    if (bars === 'full') {
                      setLR({ startBar: 0, endBar: Math.max(0, barCount - 1), enabled: true });
                    } else {
                      const span = Math.min(bars, barCount);
                      const start = Math.min(lr.startBar, Math.max(0, barCount - span));
                      setLR({ startBar: start, endBar: start + span - 1, enabled: true });
                    }
                  };
                  const isPresetActive = (bars: number | 'full') => {
                    if (!enabled) return false;
                    if (bars === 'full') return lr.startBar === 0 && lr.endBar === barCount - 1;
                    return (lr.endBar - lr.startBar + 1) === bars;
                  };
                  const dimIfDisabled: React.CSSProperties = enabled ? {} : { opacity: 0.42, pointerEvents: 'none' };
                  return (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', right: 0, background: isAmoled ? 'rgba(0,0,0,0.97)' : (isLight ? 'rgba(255,255,255,0.96)' : 'rgba(18,18,22,0.96)'), border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.12)' : '0 8px 32px rgba(0,0,0,0.50)', whiteSpace: 'nowrap', animation: 'drumHamburgerIn 160ms cubic-bezier(0.22,1,0.36,1)', minWidth: 232 }}>
                      {/* Header: label + on/off toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', flex: 1 }}>Smart Loop</span>
                        <button
                          onClick={() => { pushUndo(); setLR({ enabled: !enabled }); }}
                          aria-pressed={enabled}
                          aria-label="Toggle smart loop"
                          style={{ width: 40, height: 22, borderRadius: 11, background: enabled ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.20)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms', flexShrink: 0 }}
                        >
                          <div style={{ position: 'absolute', top: 2, left: enabled ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 200ms cubic-bezier(0.4, 0, 0.2, 1)' }} />
                        </button>
                      </div>
                      {/* Bar range row */}
                      <div style={{ height: 1, background: 'rgba(128,128,128,0.18)', margin: '2px -4px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...dimIfDisabled }}>
                        <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 38 }}>Bars</span>
                        {/* Start bar -/+ */}
                        <button onPointerDown={() => pushUndo()} onClick={() => setLR({ startBar: Math.max(0, lr.startBar - 1) })}
                          style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(128,128,128,0.10)', border: '1px solid rgba(128,128,128,0.14)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 800, lineHeight: 1 }}>−</button>
                        <span style={{ color: accent.from, fontSize: 13, fontWeight: 800, fontFamily: 'Manrope, sans-serif', minWidth: 18, textAlign: 'center' }}>{lr.startBar + 1}</span>
                        <button onPointerDown={() => pushUndo()} onClick={() => setLR({ startBar: Math.min(lr.endBar, lr.startBar + 1) })}
                          style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(128,128,128,0.10)', border: '1px solid rgba(128,128,128,0.14)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 800, lineHeight: 1 }}>+</button>
                        <span style={{ color: 'var(--c-text-muted)', fontSize: 11, fontWeight: 700, padding: '0 2px' }}>–</span>
                        {/* End bar -/+ */}
                        <button onPointerDown={() => pushUndo()} onClick={() => setLR({ endBar: Math.max(lr.startBar, lr.endBar - 1) })}
                          style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(128,128,128,0.10)', border: '1px solid rgba(128,128,128,0.14)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 800, lineHeight: 1 }}>−</button>
                        <span style={{ color: accent.from, fontSize: 13, fontWeight: 800, fontFamily: 'Manrope, sans-serif', minWidth: 18, textAlign: 'center' }}>{lr.endBar + 1}</span>
                        <button onPointerDown={() => pushUndo()} onClick={() => setLR({ endBar: Math.min(barCount - 1, lr.endBar + 1) })}
                          style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(128,128,128,0.10)', border: '1px solid rgba(128,128,128,0.14)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 14, fontWeight: 800, lineHeight: 1 }}>+</button>
                      </div>
                      {/* Preset chips */}
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {presets.map(p => {
                          const active = isPresetActive(p.bars);
                          const tooBig = typeof p.bars === 'number' && p.bars > barCount;
                          return (
                            <button
                              key={p.id}
                              disabled={tooBig}
                              onClick={() => applyPreset(p.bars)}
                              style={{
                                height: 24, padding: '0 10px', borderRadius: 7,
                                background: active ? `${accent.from}26` : 'rgba(128,128,128,0.10)',
                                border: active ? `1px solid ${accent.from}66` : '1px solid rgba(128,128,128,0.14)',
                                color: active ? accent.from : 'var(--c-text-secondary)',
                                fontSize: 10, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                                letterSpacing: '0.03em', cursor: tooBig ? 'not-allowed' : 'pointer',
                                opacity: tooBig ? 0.35 : 1, transition: 'all 140ms',
                              }}
                            >{p.label}</button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <button
                  onClick={() => setShowLoopPanel(s => !s)}
                  title="Smart loop"
                  aria-label="Smart loop"
                  className="btn-smooth"
                  style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: loopActive ? `${accent.from}26` : (showLoopPanel ? `${accent.from}18` : (isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)'))), boxShadow: isLight ? '0 2px 12px rgba(0,0,0,0.10)' : '0 2px 12px rgba(0,0,0,0.50)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', cursor: 'pointer', transition: 'all 160ms', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: loopActive ? `1.5px solid ${accent.from}88` : (showLoopPanel ? `1.5px solid ${accent.from}66` : (isLight ? '1.5px solid rgba(0,0,0,0.10)' : '1.5px solid rgba(255,255,255,0.08)')) }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={loopActive ? accent.from : 'var(--c-text-secondary)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 1l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </button>
              </div>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {showBpmPanel && (() => {
                  const swing = pattern.swing ?? 0;
                  const presetLabels: Record<typeof SWING_PRESETS[number]['id'], string> = {
                    tight:  'Tight',
                    groove: 'Groove',
                    funky:  'Funky',
                  };
                  return (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 10px)', right: 0, background: isAmoled ? 'rgba(0,0,0,0.97)' : (isLight ? 'rgba(255,255,255,0.96)' : 'rgba(18,18,22,0.96)'), border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: isLight ? '0 8px 32px rgba(0,0,0,0.12)' : '0 8px 32px rgba(0,0,0,0.50)', whiteSpace: 'nowrap', animation: 'drumHamburgerIn 160ms cubic-bezier(0.22,1,0.36,1)' }}>
                      {/* BPM row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {([-10, -1, +1, +10] as const).map(d => (
                          <button key={d} onClick={() => adjustBpm(d)} style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(128,128,128,0.10)', border: '1px solid rgba(128,128,128,0.14)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 11, fontWeight: 700 }}>{d > 0 ? `+${d}` : d}</button>
                        ))}
                        <div style={{ width: 1, height: 24, background: 'rgba(128,128,128,0.2)', margin: '0 2px' }} />
                        <span style={{ color: accent.from, fontSize: 16, fontWeight: 800, minWidth: 36, textAlign: 'center' }}>{pattern.bpm}</span>
                      </div>
                      {/* Swing row — label, slider, value, preset chips */}
                      <div style={{ height: 1, background: 'rgba(128,128,128,0.18)', margin: '2px -4px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 38 }}>Swing</span>
                        <input
                          type="range"
                          min={SWING_MIN}
                          max={SWING_MAX}
                          step={1}
                          value={swing}
                          onPointerDown={() => pushUndo()}
                          onChange={e => updatePattern(pattern.id, { swing: clampSwing(Number(e.target.value)) })}
                          aria-label="Swing"
                          style={{
                            width: 132, height: 22, accentColor: accent.from,
                            cursor: 'pointer', verticalAlign: 'middle',
                          }}
                        />
                        <span style={{ color: swing > 0 ? accent.from : 'var(--c-text-muted)', fontSize: 13, fontWeight: 800, fontFamily: 'Manrope, sans-serif', minWidth: 34, textAlign: 'right' }}>{swing}%</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {SWING_PRESETS.map(p => {
                          const active = swing === p.value;
                          return (
                            <button
                              key={p.id}
                              onClick={() => { pushUndo(); updatePattern(pattern.id, { swing: p.value }); }}
                              style={{
                                height: 24, padding: '0 10px', borderRadius: 7,
                                background: active ? `${accent.from}26` : 'rgba(128,128,128,0.10)',
                                border: active ? `1px solid ${accent.from}66` : '1px solid rgba(128,128,128,0.14)',
                                color: active ? accent.from : 'var(--c-text-secondary)',
                                fontSize: 10, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                                letterSpacing: '0.03em', cursor: 'pointer', transition: 'all 140ms',
                              }}
                            >{presetLabels[p.id]}</button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <button onClick={() => setShowBpmPanel(s => !s)} title="BPM & Swing" style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: showBpmPanel ? `${accent.from}22` : (isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)')), boxShadow: isLight ? '0 2px 12px rgba(0,0,0,0.10)' : '0 2px 12px rgba(0,0,0,0.50)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', cursor: 'pointer', transition: 'all 160ms', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: showBpmPanel ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(255,255,255,0.10)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 4h6l1.5 12H7.5L9 4Z" stroke={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} strokeWidth="1.7" strokeLinejoin="round" />
                    <line x1="12" y1="4" x2="17" y2="13" stroke={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} strokeWidth="1.7" strokeLinecap="round" />
                    <rect x="10" y="2" width="4" height="2.5" rx="1" fill={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} />
                  </svg>
                </button>
              </div>
              <button onClick={handlePlay} title={playing ? "Stop" : "Play"} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: playing ? (isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)')) : `linear-gradient(135deg, ${accent.from}, ${accent.to})`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: playing ? 13 : 14, color: playing ? 'var(--c-text-secondary)' : '#fff', boxShadow: playing ? '0 4px 20px rgba(0,0,0,0.40), 0 0 0 1.5px rgba(255,255,255,0.08)' : `0 4px 20px ${accent.from}55, 0 0 0 1.5px rgba(255,255,255,0.12)`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', transition: 'all 170ms' }}>
                {playing ? '⏹' : '▶'}
              </button>
            </div>
            </div>

            {isWebDesktop && (
              <button
                onClick={() => setIsRightPanelCollapsed(v => !v)}
                title={isRightPanelCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={isRightPanelCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: isRightPanelCollapsed ? 0 : 320,
                  transform: 'translateY(-50%)',
                  zIndex: 99,
                  width: 18,
                  height: 64,
                  background: isLight ? 'rgba(240, 240, 242, 0.95)' : 'rgba(20, 20, 24, 0.95)',
                  border: isLight ? '1px solid rgba(0, 0, 0, 0.15)' : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRight: 'none',
                  borderRadius: '8px 0 0 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--c-text-secondary)',
                  transition: 'right 250ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 200ms, color 200ms',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  boxShadow: isLight ? '-2px 0 8px rgba(0,0,0,0.06)' : '-2px 0 8px rgba(0,0,0,0.3)',
                }}
                onPointerOver={e => e.currentTarget.style.color = accent.from}
                onPointerOut={e => e.currentTarget.style.color = 'var(--c-text-secondary)'}
              >
                {isRightPanelCollapsed ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                )}
              </button>
            )}

            {/* Right Side Panel (Desktop only) */}
            {isWebDesktop && (
              <div style={{
                width: isRightPanelCollapsed ? 0 : 320,
                flexShrink: 0,
                borderLeft: isRightPanelCollapsed ? 'none' : (isLight ? '1px solid #e4e4e7' : '1px solid #18181b'),
                background: isLight ? '#f9f9fb' : '#000000',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'width 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}>
                {/* Tab Switcher */}
                <div style={{ display: 'flex', borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #18181b', padding: '12px 16px', gap: 8, flexShrink: 0 }}>
                  {(['kit', 'mixer', 'fx'] as const).map(tab => {
                    const active = sideTab === tab;
                    return (
                      <button key={tab} onClick={() => setSideTab(tab)} className="btn-smooth" title={`Switch to ${tab} panel`} aria-label={`Switch to ${tab} panel`} style={{
                        flex: 1, padding: '6px 0', borderRadius: '8px', fontSize: '10px', fontWeight: 800, fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
                        background: active ? (isLight ? '#f4f4f5' : '#18181b') : 'transparent',
                        border: active ? (isLight ? '1px solid #e4e4e7' : '1px solid #27272a') : '1px solid transparent',
                        color: active ? (isLight ? '#09090b' : '#ffffff') : (isLight ? '#71717a' : '#a1a1aa'), transition: 'all 160ms'
                      }}>
                        {tab}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Contents */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }} className="no-scrollbar">
                  
                  {/* KIT TAB */}
                  {sideTab === 'kit' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {renderCollapsibleSection(
                        'drum-kit',
                        'Drum Kit',
                        collapsedKitSections,
                        (id) => setCollapsedKitSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div>
                          <select value={KIT_FAMILY.find(fam => fam.variations.some(v => v.kit === kitType))?.id || createFamily} onChange={e => {
                            const famId = e.target.value;
                            setCreateFamily(famId);
                            const variant = KIT_FAMILY.find(f => f.id === famId)?.variations[0].kit;
                            if (variant) {
                              setKitType(variant, KIT_DEFAULTS[variant].soundMap);
                              loadDrumSamples(variant);
                              if (activeDrumSongId) updateDrumSong(activeDrumSongId, { kitType: variant });
                            }
                          }} style={{ ...inputSt, padding: '6px 10px', fontSize: 13, background: 'var(--app-surface-high)' }}>
                            {KIT_FAMILY.map(fam => <option key={fam.id} value={fam.id}>{fam.label}</option>)}
                          </select>
                        </div>
                      )}

                      {renderCollapsibleSection(
                        'kit-variant',
                        'Kit Variant',
                        collapsedKitSections,
                        (id) => setCollapsedKitSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {KIT_FAMILY.find(f => f.id === (KIT_FAMILY.find(fam => fam.variations.some(v => v.kit === kitType))?.id || createFamily))?.variations.map(v => {
                            const isSel = kitType === v.kit;
                            return (
                              <button key={v.kit} onClick={() => {
                                setKitType(v.kit, KIT_DEFAULTS[v.kit].soundMap);
                                loadDrumSamples(v.kit);
                                if (activeDrumSongId) updateDrumSong(activeDrumSongId, { kitType: v.kit });
                              }} className="btn-smooth" style={{
                                display: 'flex', alignItems: 'center', padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                                background: isSel ? `${accent.from}15` : 'rgba(255,255,255,0.03)',
                                border: isSel ? `1px solid ${accent.from}55` : '1px solid rgba(255,255,255,0.08)',
                                textAlign: 'left', width: '100%'
                              }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: isSel ? accent.from : 'var(--c-text-primary)', flex: 1 }}>{v.label}</span>
                                {isSel && <span className="material-symbols-outlined" style={{ fontSize: 14, color: accent.from }}>check_circle</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {kitType === 'house' && renderCollapsibleSection(
                        'mic-position',
                        'Mic Position',
                        collapsedKitSections,
                        (id) => setCollapsedKitSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', gap: 6 }}>
                          {HOUSE_MICS.map(m => {
                            const active = houseKitMic === m.id;
                            return (
                              <button key={m.id} className="btn-smooth"
                                onClick={() => {
                                  storeSetHouseKitMic(m.id);
                                  setHouseKitMic(m.id);
                                }}
                                style={{ flex: 1, height: 28, borderRadius: 8, border: active ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(255,255,255,0.1)', background: active ? `${accent.from}1a` : 'rgba(255,255,255,0.03)', color: active ? accent.from : 'var(--c-text-secondary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                {m.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {kitType === 'house' && renderCollapsibleSection(
                        'sound-character',
                        'Sound Character',
                        collapsedKitSections,
                        (id) => setCollapsedKitSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {((['kick', 'snare', 'tom10', 'tom12', 'tom14'] as HouseInstName[])).map(hInst => {
                            const locked = houseInstVelOverride[hInst];
                            return (
                              <div key={hInst} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-primary)', flex: 1 }}>{HOUSE_INST_LABELS[hInst]}</span>
                                  {locked && (
                                    <button onClick={() => storeSetInstVelOverride(hInst, undefined)} style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--c-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>AUTO</button>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {HOUSE_VEL_CONFIGS[hInst].map(v => {
                                    const active = locked === v.id;
                                    return (
                                      <button key={v.id} className="btn-smooth"
                                        onClick={() => storeSetInstVelOverride(hInst, active ? undefined : v.id)}
                                        style={{ height: 24, padding: '0 8px', borderRadius: 6, border: active ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(255,255,255,0.1)', background: active ? `${accent.from}1a` : 'rgba(255,255,255,0.03)', color: active ? accent.from : 'var(--c-text-secondary)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                        {v.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {kitType === 'house' && renderCollapsibleSection(
                        'advanced-kit-options',
                        'Advanced Kit Options',
                        collapsedKitSections,
                        (id) => setCollapsedKitSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--c-text-secondary)', display: 'block', marginBottom: 4 }}>Crash Cymbal Model</span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {HOUSE_CRASH_MODELS.map(m => {
                                const active = houseCrashModel === m.id;
                                return (
                                  <button key={m.id} className="btn-smooth"
                                    onClick={() => storeSetHouseCrashModel(m.id as HouseCrashModel)}
                                    title={m.desc}
                                    style={{ height: 24, padding: '0 8px', borderRadius: 6, border: active ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(255,255,255,0.1)', background: active ? `${accent.from}1a` : 'rgba(255,255,255,0.03)', color: active ? accent.from : 'var(--c-text-secondary)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                    {m.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--c-text-secondary)', display: 'block', marginBottom: 4 }}>Cymbal Pack</span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {CYMBAL_PACKS.map(p => {
                                const active = cymbalPack === p.id;
                                return (
                                  <button key={p.id} className="btn-smooth"
                                    onClick={() => storeSetCymbalPack(p.id as CymbalPack)}
                                    title={p.desc}
                                    style={{ height: 24, padding: '0 8px', borderRadius: 6, border: active ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(255,255,255,0.1)', background: active ? `${accent.from}1a` : 'rgba(255,255,255,0.03)', color: active ? accent.from : 'var(--c-text-secondary)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                    {p.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>Random Variations</span>
                            <button onClick={() => updateDrumPrefs({ randomVariations: !drumPrefs.randomVariations })} style={{ width: 36, height: 20, borderRadius: 10, background: drumPrefs.randomVariations ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 220ms', flexShrink: 0 }}>
                              <span style={{ position: 'absolute', top: 2.5, left: drumPrefs.randomVariations ? 18 : 2.5, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)', display: 'block' }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MIXER TAB */}
                  {sideTab === 'mixer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {renderCollapsibleSection(
                        'master',
                        'Master',
                        collapsedMixerSections,
                        (id) => setCollapsedMixerSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>Master Volume</span>
                            <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 700 }}>{(masterVolume * 100).toFixed(1)}%</span>
                          </div>
                          <ElasticSlider
                            min={0} max={1} step={0.005} value={masterVolume}
                            onChange={setMasterVolume}
                            accentColor={accent.from}
                            style={{ width: '100%' }}
                          />
                        </div>
                      )}

                      {renderCollapsibleSection(
                        'levels',
                        'Levels',
                        collapsedMixerSections,
                        (id) => setCollapsedMixerSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {activeInstruments.map(inst => {
                            const vol = volumeMap[inst] ?? 1;
                            const muted = patternMuted.has(inst);
                            const color = INSTRUMENT_COLOR[inst] ?? accent.from;
                            return (
                              <div key={inst} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', opacity: muted ? 0.5 : 1 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{INST_LABEL[inst]}</span>
                                <ElasticSlider
                                  min={0} max={1} step={0.01} value={vol}
                                  onChange={v => setVolumeForInstrument(inst, v)}
                                  accentColor={color}
                                  style={{ width: 80 }}
                                />
                                <button onClick={() => togglePatternMute(pattern.id, inst)} style={{
                                  width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
                                  background: muted ? 'rgba(255,255,255,0.05)' : `${color}18`,
                                  color: muted ? 'var(--c-text-muted)' : color, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{muted ? 'volume_off' : 'volume_up'}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {renderCollapsibleSection(
                        'pan',
                        'Pan',
                        collapsedMixerSections,
                        (id) => setCollapsedMixerSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <span style={{ fontSize: 9.5, color: 'var(--c-text-muted)', fontStyle: 'italic', marginBottom: 4, display: 'block' }}>
                            Note: Stereo panning is simulated (Future Update)
                          </span>
                          {activeInstruments.map(inst => {
                            const color = INSTRUMENT_COLOR[inst] ?? accent.from;
                            return (
                              <div key={`pan-${inst}`} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{INST_LABEL[inst]}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text-muted)' }}>L</span>
                                  <input type="range" min="-50" max="50" defaultValue="0" disabled style={{ width: 75, accentColor: color, cursor: 'not-allowed' }} />
                                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-text-muted)' }}>R</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {renderCollapsibleSection(
                        'room-send',
                        'Room / Send',
                        collapsedMixerSections,
                        (id) => setCollapsedMixerSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {activeInstruments.map(inst => {
                            const curFX = { ...DEFAULT_INST_FX, ...(instFX[inst] ?? {}) };
                            const rev = curFX.reverb ?? 0;
                            const color = INSTRUMENT_COLOR[inst] ?? accent.from;
                            return (
                              <div key={`rev-${inst}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{INST_LABEL[inst]}</span>
                                <ElasticSlider
                                  min={0} max={1} step={0.01} value={rev}
                                  onChange={v => setInstFX(inst, { ...curFX, reverb: v })}
                                  accentColor={color}
                                  style={{ width: 80 }}
                                />
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-muted)', width: 26, textAlign: 'right' }}>
                                  {Math.round(rev * 100)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setMasterVolume(1.0);
                          activeInstruments.forEach(inst => {
                            setVolumeForInstrument(inst, 1.0);
                            if (patternMuted.has(inst)) {
                              togglePatternMute(pattern.id, inst);
                            }
                          });
                        }}
                        className="btn-smooth bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 w-full mt-2"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '8px 12px', borderRadius: '8px', cursor: 'pointer'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>restart_alt</span>
                        Reset Mix
                      </button>
                    </div>
                  )}

                  {/* FX TAB */}
                  {sideTab === 'fx' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {renderCollapsibleSection(
                        'global-fx',
                        'Global FX',
                        collapsedFxSections,
                        (id) => setCollapsedFxSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)' }}>Swing</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: accent.from }}>{pattern.swing ?? 0}%</span>
                            </div>
                            <ElasticSlider
                              min={0} max={100} step={1} value={pattern.swing ?? 0}
                              onChange={v => updatePattern(pattern.id, { swing: v })}
                              accentColor={accent.from}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                      )}

                      {renderCollapsibleSection(
                        'per-instrument-fx',
                        'Per-Instrument FX',
                        collapsedFxSections,
                        (id) => setCollapsedFxSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <label style={labelSt}>Instrument</label>
                            <select value={fxInst} onChange={e => setFxInst(e.target.value as DrumInstrument)} style={{ ...inputSt, padding: '6px 10px', fontSize: 13, background: 'var(--app-surface-high)' }}>
                              {activeInstruments.map(inst => <option key={inst} value={inst}>{INST_LABEL[inst]}</option>)}
                            </select>
                          </div>

                          {INST_PRESETS[fxInst] && INST_PRESETS[fxInst]!.length > 0 && (
                            <div>
                              <span style={labelSt}>Character</span>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {INST_PRESETS[fxInst]!.map(preset => {
                                  const curFX = { ...DEFAULT_INST_FX, ...(instFX[fxInst] ?? {}) };
                                  const active = Object.keys(preset.values).every(
                                    k => Math.abs((curFX[k as keyof InstFX] ?? 0) - (preset.values[k as keyof InstFX] ?? 0)) < 0.05
                                  );
                                  const color = INSTRUMENT_COLOR[fxInst] ?? accent.from;
                                  return (
                                    <button key={preset.label} onClick={() => setInstFX(fxInst, { ...DEFAULT_INST_FX, ...preset.values })} title={`Apply "${preset.label}" FX character to ${INST_LABEL[fxInst] || fxInst}`} className="btn-smooth" style={{
                                      padding: '4px 10px', borderRadius: 12, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                                      background: active ? color : 'rgba(255,255,255,0.03)',
                                      border: active ? `1.5px solid ${color}` : '1.5px solid rgba(255,255,255,0.08)',
                                      color: active ? '#fff' : 'var(--c-text-secondary)'
                                    }}>{preset.label}</button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(() => {
                              const curFX = { ...DEFAULT_INST_FX, ...(instFX[fxInst] ?? {}) };
                              const color = INSTRUMENT_COLOR[fxInst] ?? accent.from;
                              type SliderDef = { key: keyof InstFX; label: string; min: number; max: number; step: number };
                              const sliders: SliderDef[] = [
                                { key: 'compress', label: 'Compress',  min: 0,   max: 1,   step: 0.01 },
                                { key: 'attack',   label: 'Attack',    min: 0,   max: 1,   step: 0.01 },
                                { key: 'gate',     label: 'Gate',      min: 0,   max: 1,   step: 0.01 },
                                { key: 'eqLow',    label: 'Low 80Hz',  min: -12, max: 12,  step: 0.5  },
                                { key: 'eqLowMid', label: 'Lo-Mid 350',min: -12, max: 12,  step: 0.5  },
                                { key: 'eqMid',    label: 'Mid 2kHz',  min: -12, max: 12,  step: 0.5  },
                                { key: 'eqHigh',   label: 'High 10k',  min: -12, max: 12,  step: 0.5  },
                              ];
                              return sliders.map(s => {
                                const val = curFX[s.key] ?? 0;
                                const isEQ = s.key.startsWith('eq');
                                const dispVal = isEQ ? (val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1)) + 'dB' : `${Math.round(val * 100)}%`;
                                const active = val !== 0;
                                return (
                                  <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'white' : 'var(--c-text-secondary)' }}>{s.label}</span>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? color : 'var(--c-text-muted)' }}>{dispVal}</span>
                                    </div>
                                    <ElasticSlider
                                      min={s.min} max={s.max} step={s.step} value={val}
                                      onChange={v => setInstFX(fxInst, { ...curFX, [s.key]: v })}
                                      accentColor={color}
                                      style={{ width: '100%' }}
                                    />
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {renderCollapsibleSection(
                        'reverb-room',
                        'Reverb / Room',
                        collapsedFxSections,
                        (id) => setCollapsedFxSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div>
                          {(() => {
                            const curFX = { ...DEFAULT_INST_FX, ...(instFX[fxInst] ?? {}) };
                            const color = INSTRUMENT_COLOR[fxInst] ?? accent.from;
                            const reverbVal = curFX.reverb ?? 0;
                            const saturateVal = curFX.saturate ?? 0;
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: reverbVal > 0 ? 'white' : 'var(--c-text-secondary)' }}>Reverb Send</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: reverbVal > 0 ? color : 'var(--c-text-muted)' }}>{Math.round(reverbVal * 100)}%</span>
                                  </div>
                                  <ElasticSlider
                                    min={0} max={1} step={0.01} value={reverbVal}
                                    onChange={v => setInstFX(fxInst, { ...curFX, reverb: v })}
                                    accentColor={color}
                                    style={{ width: '100%' }}
                                  />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: saturateVal > 0 ? 'white' : 'var(--c-text-secondary)' }}>Saturation</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: saturateVal > 0 ? color : 'var(--c-text-muted)' }}>{Math.round(saturateVal * 100)}%</span>
                                  </div>
                                  <ElasticSlider
                                    min={0} max={1} step={0.01} value={saturateVal}
                                    onChange={v => setInstFX(fxInst, { ...curFX, saturate: v })}
                                    accentColor={color}
                                    style={{ width: '100%' }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {renderCollapsibleSection(
                        'humanize-groove-feel',
                        'Humanize / Groove Feel',
                        collapsedFxSections,
                        (id) => setCollapsedFxSections(prev => ({ ...prev, [id]: !prev[id] })),
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>Humanize Velocity</span>
                            <button onClick={() => updateDrumPrefs({ humanizeVelocity: !drumPrefs.humanizeVelocity })} style={{ width: 36, height: 20, borderRadius: 10, background: drumPrefs.humanizeVelocity ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 220ms', flexShrink: 0 }}>
                              <span style={{ position: 'absolute', top: 2.5, left: drumPrefs.humanizeVelocity ? 18 : 2.5, width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'left 200ms cubic-bezier(0.34,1.56,0.64,1)', display: 'block' }} />
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => setInstFX(fxInst, { ...DEFAULT_INST_FX })}
                        className="btn-smooth bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 w-full mt-2"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '8px 12px', borderRadius: '8px', cursor: 'pointer'
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>restart_alt</span>
                        Reset {INST_LABEL[fxInst]} FX
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        )}

        {/* ═══ LIBRARY TAB ═════════════════════════════════════════════════ */}
        {activeTab === 'patterns' && (
          <div onScroll={drumScrollHide} className="flex-1 overflow-y-auto pt-3 pb-24 no-scrollbar">

            {/* ── Search ──────────────────────────────────────────────── */}
            <div className="px-4 pb-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-zinc-500 pointer-events-none">search</span>
                <input
                  value={libSearch}
                  onChange={e => handleLibSearchChange(e.target.value)}
                  placeholder="Search patterns, genres, or moods..."
                  className={`w-full py-2 pl-9 pr-4 rounded-xl border text-[13px] font-manrope outline-none transition-all ${
                    isLight 
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder-zinc-400 focus:border-zinc-350 focus:bg-white' 
                      : 'bg-zinc-950/20 border-zinc-900 text-white placeholder-zinc-600 focus:border-zinc-800 focus:bg-[#000000]'
                  }`}
                />
              </div>
            </div>

            {/* ── Category chips ──────────────────────────────────────── */}
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
              {(['All', ...LIBRARY_CATEGORIES, 'My Grooves'] as (LibraryCategory | 'All' | 'My Grooves')[]).map(cat => {
                const active = libCategory === cat;
                return (
                  <button 
                    key={cat} 
                    onClick={() => { setLibCategory(cat); if (cat === 'My Grooves') setLibGenre(''); }} 
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[10px] font-extrabold font-manrope uppercase tracking-widest transition-all cursor-pointer border ${
                      active 
                        ? (isLight 
                            ? 'bg-blue-50 text-blue-600 border-blue-200' 
                            : 'bg-blue-950/40 text-blue-400 border-blue-900/60') 
                        : (isLight 
                            ? 'bg-zinc-100/50 text-zinc-650 border-zinc-200/50 hover:bg-zinc-200/50 hover:text-black' 
                            : 'bg-zinc-900/30 text-zinc-400 border-zinc-950 hover:bg-zinc-800/40 hover:text-white')
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* ── Genre filter (not shown for My Grooves) ────────────── */}
            {libCategory !== 'My Grooves' && (
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-4">
                {(['', ...LIBRARY_GENRES] as (LibraryGenre | '')[]).map(g => {
                  const label = g === '' ? 'All Genres' : g;
                  const active = libGenre === g;
                  return (
                    <button 
                      key={label} 
                      onClick={() => setLibGenre(g)} 
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-[9px] font-extrabold tracking-widest uppercase transition-all cursor-pointer border ${
                        active 
                          ? (isLight 
                              ? 'bg-blue-50/70 text-blue-600 border-blue-250' 
                              : 'bg-blue-950/20 text-blue-400 border-blue-900/40') 
                          : (isLight 
                              ? 'bg-transparent text-zinc-650 border-zinc-200 hover:border-zinc-350 hover:text-black' 
                              : 'bg-transparent text-zinc-450 border-zinc-900 hover:border-zinc-800 hover:text-white')
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── My Grooves section ─────────────────────────────────── */}
            {libCategory === 'My Grooves' && (
              <>
                <div style={{ padding: '0 16px 12px' }}>
                  <button onClick={() => { setSavGrName(pattern.name); setSavGrTag(''); setShowSaveGroove(true); }} className="btn-smooth"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 14, background: `linear-gradient(135deg,${accent.from}18,${accent.to}12)`, border: `1px solid ${accent.from}30`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${accent.from},${accent.to})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 16 }}>bookmark_add</span>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: accent.from, fontFamily: 'Manrope,sans-serif' }}>Save as Groove</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 1 }}>Store "{pattern.name}" to your library</div>
                    </div>
                  </button>
                </div>

                {grooves.length > 0 && (
                  <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 16px 12px' }}>
                    {(['', ...GROOVE_TAGS] as (GrooveTag | '')[]).map(tag => {
                      const label = tag === '' ? 'All' : tag;
                      const active = grooveFilter === tag;
                      return (
                        <button key={label} onClick={() => setGrooveFilter(tag as GrooveTag)} className="btn-smooth"
                          style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', border: active ? `1.5px solid ${accent.from}` : '1.5px solid rgba(128,128,128,0.18)', background: active ? `${accent.from}18` : 'transparent', color: active ? accent.from : 'var(--c-text-secondary)', transition: 'all 150ms' }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {grooves.length === 0 ? (
                  <div className={`mx-4 mb-6 p-7 border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-center ${
                    isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-[#000000] border-zinc-900'
                  }`}>
                    <EmptyStateLottie app="drumex" size={44} isLight={isLight} />
                    <div>
                      <span className={`block text-xs font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-800' : 'text-white'}`}>No grooves saved yet</span>
                      <span className="block text-[10px] text-zinc-500 font-extrabold uppercase tracking-wide mt-1">Save any pattern to build your personal library</span>
                    </div>
                  </div>
                ) : (
                  <div style={isWebDesktop ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, padding: '0 16px' } : { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredGrooves.map(g => {
                      const isPreviewPlaying = previewingGrooveId === g.id && drumScheduler.isPlaying;
                      const menuOpen = grooveMenuId === g.id;
                      const isRenaming = grooveRenameId === g.id;
                      return (
                        <div key={g.id} style={{
                          background: isWebDesktop ? 'rgba(15, 15, 20, 0.45)' : 'var(--app-surface)',
                          borderRadius: isWebDesktop ? 12 : 14,
                          overflow: 'hidden',
                          border: isWebDesktop ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(128,128,128,0.06)'
                        }}>
                          {isRenaming ? (
                            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <input autoFocus value={grooveRenameName} onChange={e => setGrooveRenameName(e.target.value)}
                                style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--app-bg)', border: '1px solid rgba(128,128,128,0.22)', color: 'var(--c-text-primary)', fontSize: 13, fontFamily: 'Manrope,sans-serif', outline: 'none' }} />
                              <div className="no-scrollbar" style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
                                {(['', ...GROOVE_TAGS] as (GrooveTag | '')[]).map(tag => {
                                  const label = tag === '' ? 'None' : tag;
                                  const act = grooveRenameTag === tag;
                                  return (
                                    <button key={label} onClick={() => setGrooveRenameTag(tag as GrooveTag)} className="btn-smooth"
                                      style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 16, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: act ? `1.5px solid ${accent.from}` : '1.5px solid rgba(128,128,128,0.18)', background: act ? `${accent.from}18` : 'transparent', color: act ? accent.from : 'var(--c-text-muted)' }}>
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => setGrooveRenameId(null)} className="btn-smooth"
                                  style={{ flex: 1, padding: '7px', borderRadius: 8, background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--c-text-secondary)' }}>Cancel</button>
                                <button onClick={() => { renameGroove(g.id, grooveRenameName, grooveRenameTag); setGrooveRenameId(null); }} className="btn-smooth"
                                  style={{ flex: 1, padding: '7px', borderRadius: 8, background: `linear-gradient(135deg,${accent.from},${accent.to})`, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff' }}>Save</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                                <button onClick={() => handleGroovePreview(g)} className="btn-smooth"
                                  style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isPreviewPlaying ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.12)', color: isPreviewPlaying ? '#fff' : 'var(--c-text-secondary)', transition: 'all 160ms' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{isPreviewPlaying ? 'stop' : 'play_arrow'}</span>
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                                    {g.tag && <span style={{ fontSize: 9.5, fontWeight: 800, color: accent.from, background: `${accent.from}15`, borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>{g.tag}</span>}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Inter,sans-serif' }}>{g.bpm} BPM · {g.bars} bar{g.bars !== 1 ? 's' : ''}</div>
                                </div>
                                <button onClick={() => setGrooveMenuId(menuOpen ? null : g.id)} className="btn-smooth"
                                  style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: menuOpen ? `${accent.from}12` : 'transparent', cursor: 'pointer', color: menuOpen ? accent.from : 'var(--c-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>more_vert</span>
                                </button>
                              </div>
                              {menuOpen && (
                                <div style={{ padding: '0 10px 10px' }}>
                                  <div style={{ background: isAmoled ? 'rgba(4,4,4,0.98)' : (isLight ? 'rgba(250,250,252,0.98)' : 'rgba(20,20,26,0.98)'), borderRadius: 12, border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                    {[
                                      { label: 'Use this groove', icon: 'file_download', action: () => { loadGrooveReplace(g.id); setGrooveMenuId(null); setActiveTab('songs'); } },
                                      { label: 'Append to pattern', icon: 'playlist_add', action: () => { loadGrooveAppend(g.id); setGrooveMenuId(null); setActiveTab('songs'); } },
                                      { label: 'Rename / Retag', icon: 'edit', action: () => { setGrooveRenameName(g.name); setGrooveRenameTag(g.tag); setGrooveRenameId(g.id); setGrooveMenuId(null); } },
                                    ].map((item, idx) => (
                                      <button key={item.label} onClick={item.action} className="btn-smooth"
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderTop: idx > 0 ? '1px solid rgba(128,128,128,0.08)' : 'none', cursor: 'pointer', color: 'var(--c-text-primary)', fontSize: 12.5, fontWeight: 600 }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-text-secondary)' }}>{item.icon}</span>
                                        {item.label}
                                      </button>
                                    ))}
                                    <button onClick={() => { deleteGroove(g.id); setGrooveMenuId(null); if (previewingGrooveId === g.id) { drumScheduler.stop(); setPreviewingGrooveId(null); setRandomVariations(useDrumStore.getState().drumPrefs.randomVariations); } }} className="btn-smooth"
                                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderTop: '1px solid rgba(128,128,128,0.08)', cursor: 'pointer', color: '#f87171', fontSize: 12.5, fontWeight: 600 }}>
                                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Built-in Library Cards ──────────────────────────────── */}
            {libCategory !== 'My Grooves' && (
              <div style={isWebDesktop ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, padding: '0 16px' } : { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredLibrary.length === 0 ? (
                  <div className={`p-7 border border-dashed rounded-xl flex flex-col items-center justify-center gap-3 text-center ${
                    isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-[#000000] border-zinc-900'
                  }`}>
                    <EmptyStateLottie app="drumex" size={36} isLight={isLight} />
                    <span className={`block text-xs font-extrabold uppercase tracking-widest ${isLight ? 'text-zinc-800' : 'text-white'}`}>No patterns found</span>
                  </div>
                ) : (<>
                  {filteredLibrary.slice(0, libVisible).map(lp => (
                    <LibCard key={lp.id} lp={lp}
                      isPreviewPlaying={previewingGrooveId === lp.id && drumScheduler.isPlaying}
                      accent={accent} isLight={isLight}
                      onPreview={handleLibPreview} onReplace={handleLibReplace} onInsert={handleLibInsert} />
                  ))}
                  {libVisible < filteredLibrary.length && (
                    <button onClick={() => setLibVisible(v => v + VISIBLE_BATCH)}
                      style={{ width: '100%', padding: '14px', borderRadius: 12, background: `${accent.from}12`, border: `1px solid ${accent.from}30`, cursor: 'pointer', color: accent.from, fontSize: 13, fontWeight: 700, fontFamily: 'Manrope,sans-serif', textAlign: 'center' }}>
                      Show more ({filteredLibrary.length - libVisible} remaining)
                    </button>
                  )}
                </>)}
              </div>
            )}
          </div>
        )}

        {/* ── Prefs tab ─────────────────────────────────────────────────── */}
        {activeTab === 'prefs' && <DrumPrefsPanel />}

        </div>
      </div>

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <DrumNav activeTab={activeTab} setTab={handleSetTab} accent={accent} isLight={isLight} isAmoled={isAmoled} hidden={isWebDesktop || (isLandscape && inEditor)} />

      {/* ── Floating buttons (songs list only): import above + add ──────── */}
      {!inEditor && activeTab === 'songs' && !isWebDesktop && (
        <div style={{ position: 'fixed', right: 20, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, pointerEvents: 'none', zIndex: 50 }}>
          {/* Import JSON button */}
          <button
            onClick={() => setShowImportDrum(true)}
            className="btn-smooth"
            title="Import Drumex JSON"
            style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--app-surface-high)', border: '1px solid rgba(128,128,128,0.18)', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.28)', pointerEvents: 'auto', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>upload_file</span>
          </button>
          {/* New beat button */}
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-smooth"
            style={{ width: 54, height: 54, borderRadius: '50%', background: `linear-gradient(135deg,${accent.from},${accent.to})`, color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 20px ${accent.to}66`, pointerEvents: 'auto' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, fontVariationSettings: "'wght' 400" }}>add</span>
          </button>
        </div>
      )}

      {/* ── Save Groove sheet ────────────────────────────────────────────── */}
      {showSaveGroove && (
        <div style={isWebDesktop ? { position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' } : { position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setShowSaveGroove(false)}>
          <div style={isWebDesktop ? { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />
          <div onClick={e => e.stopPropagation()} style={isWebDesktop ? { position: 'relative', width: '520px', maxWidth: '90vw', maxHeight: '85vh', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.55)', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '24px' } : { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            {!isWebDesktop && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(128,128,128,0.25)' }} />
              </div>
            )}
            <div style={{ padding: '8px 20px 16px', display: 'flex', alignItems: 'center' }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif' }}>Save to Groove Library</span>
              <button onClick={() => setShowSaveGroove(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(128,128,128,0.12)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>
            <div style={{ padding: '0 20px 16px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>NAME</label>
              <input
                autoFocus
                value={savGrName}
                onChange={e => setSavGrName(e.target.value)}
                placeholder="Groove name…"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--app-bg)', border: '1px solid rgba(128,128,128,0.2)', color: 'var(--c-text-primary)', fontSize: 14, fontFamily: 'Manrope,sans-serif', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>TAG</label>
              <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                {(['', ...GROOVE_TAGS] as (GrooveTag | '')[]).map(tag => {
                  const label = tag === '' ? 'None' : tag;
                  const active = savGrTag === tag;
                  return (
                    <button key={label} onClick={() => setSavGrTag(tag as GrooveTag)} className="btn-smooth"
                      style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', border: active ? `1.5px solid ${accent.from}` : '1.5px solid rgba(128,128,128,0.18)', background: active ? `${accent.from}18` : 'transparent', color: active ? accent.from : 'var(--c-text-secondary)', transition: 'all 140ms' }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ padding: '0 20px' }}>
              <button
                disabled={!savGrName.trim()}
                onClick={() => {
                  if (!savGrName.trim()) return;
                  saveGroove(savGrName.trim(), savGrTag);
                  setShowSaveGroove(false);
                }}
                className="btn-smooth"
                style={{ width: '100%', padding: '14px', borderRadius: 14, background: savGrName.trim() ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(128,128,128,0.12)', border: 'none', cursor: savGrName.trim() ? 'pointer' : 'default', color: savGrName.trim() ? '#fff' : 'var(--c-text-muted)', fontSize: 15, fontWeight: 700, fontFamily: 'Manrope,sans-serif', transition: 'all 200ms' }}>
                Save Groove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Mixer sheet (EQ button in editor toolbar) ──────────────── */}
      {showMixerSheet && inEditor && (
        <div style={isWebDesktop ? { position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' } : { position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => setShowMixerSheet(false)} style={isWebDesktop ? { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
          <div style={isWebDesktop ? { position: 'relative', width: '520px', maxWidth: '90vw', maxHeight: '80vh', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.55)', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '24px 0' } : { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {!isWebDesktop && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
                <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(72,72,72,0.3)' }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 20px 10px', flexShrink: 0 }}>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)' }}>Pattern Mixer</span>
              <span style={{ fontSize: 11, color: 'var(--c-text-muted)', background: 'rgba(128,128,128,0.10)', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>{pattern.name}</span>
            </div>
            <div style={{ overflowY: 'auto', flexShrink: 1, paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)' }}>
              {/* Master Volume row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px 10px', borderBottom: '1px solid rgba(128,128,128,0.12)', marginBottom: 2 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent.from, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)', flex: 1 }}>Master</span>
                <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{(masterVolume * 100).toFixed(1)}%</span>
                <ElasticSlider
                  min={0} max={1} step={0.005} value={masterVolume}
                  onChange={setMasterVolume}
                  accentColor={accent.from}
                  style={{ width: 110, flexShrink: 0 }}
                />
                <div style={{ width: 32, flexShrink: 0 }} />
              </div>
              {ALL_INSTS.map((inst, i) => {
                const vol    = volumeMap[inst] ?? 1;
                const hidden = patternMuted.has(inst);
                const color  = INSTRUMENT_COLOR[inst] ?? accent.from;
                return (
                  <div key={inst} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderTop: i > 0 ? '1px solid rgba(128,128,128,0.07)' : 'none', opacity: hidden ? 0.5 : 1, transition: 'opacity 150ms' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: hidden ? 'var(--c-text-muted)' : 'var(--c-text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{INST_LABEL[inst]}</span>
                    <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>{Math.round(vol * 100)}%</span>
                    <ElasticSlider
                      min={0} max={1} step={0.01} value={vol}
                      onChange={v => setVolumeForInstrument(inst, v)}
                      accentColor={color}
                      style={{ width: 90, flexShrink: 0 }}
                    />
                    <button onClick={() => togglePatternMute(pattern.id, inst)} title={hidden ? 'Show row' : 'Hide row'}
                      style={{ width: 32, height: 32, borderRadius: 8, background: hidden ? 'rgba(128,128,128,0.08)' : `${color}18`, border: hidden ? '1px solid rgba(128,128,128,0.12)' : `1px solid ${color}30`, cursor: 'pointer', color: hidden ? 'var(--c-text-muted)' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 180ms', padding: 0 }}>
                      {hidden
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Per-instrument FX sheet ──────────────────────────────────────── */}
      {showFXSheet && inEditor && (() => {
        const curFX: InstFX = { ...DEFAULT_INST_FX, ...(instFX[fxInst] ?? {}) };
        const color = INSTRUMENT_COLOR[fxInst] ?? accent.from;
        type SliderDef = { key: keyof InstFX; label: string; min: number; max: number; step: number; hint?: string };
        const fxSliders: SliderDef[] = [
          // ── Dynamics ────────────────────────────────────────────────────────
          { key: 'compress', label: 'Compress',  min: 0,   max: 1,   step: 0.01, hint: 'Squash dynamics' },
          { key: 'attack',   label: 'Attack',    min: 0,   max: 1,   step: 0.01, hint: '0=punchy, 1=slow build' },
          { key: 'gate',     label: 'Gate',      min: 0,   max: 1,   step: 0.01, hint: 'Chop the tail (tighter sound)' },
          // ── EQ (4-band) ─────────────────────────────────────────────────────
          { key: 'eqLow',    label: 'Low 80 Hz', min: -12, max: 12,  step: 0.5,  hint: 'Boom / thin' },
          { key: 'eqLowMid', label: 'Lo-Mid 350',min: -12, max: 12,  step: 0.5,  hint: 'Body / mud' },
          { key: 'eqMid',    label: 'Mid 2 kHz', min: -12, max: 12,  step: 0.5,  hint: 'Snap / honk' },
          { key: 'eqHigh',   label: 'High 10k',  min: -12, max: 12,  step: 0.5,  hint: 'Air / sheen' },
          // ── Space & character ────────────────────────────────────────────────
          { key: 'reverb',   label: 'Reverb',    min: 0,   max: 1,   step: 0.01, hint: 'Room / ambience' },
          { key: 'saturate', label: 'Saturate',  min: 0,   max: 1,   step: 0.01, hint: 'Tape warmth / drive' },
        ];
        const presets = INST_PRESETS[fxInst] ?? [];
        return (
          <div style={isWebDesktop ? { position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' } : { position: 'fixed', inset: 0, zIndex: 200 }}>
            <div onClick={() => setShowFXSheet(false)} style={isWebDesktop ? { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
            <div style={isWebDesktop ? { position: 'relative', width: '540px', maxWidth: '90vw', maxHeight: '85vh', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.55)', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '24px 0' } : { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {!isWebDesktop && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(72,72,72,0.3)' }} />
                </div>
              )}
              {/* header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '4px 20px 10px', flexShrink: 0, gap: 10 }}>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)' }}>Instrument FX</span>
                <button onClick={() => setInstFX(fxInst, { ...DEFAULT_INST_FX })} style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', background: 'rgba(128,128,128,0.10)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Manrope' }}>Reset</button>
              </div>
              {/* instrument chips */}
              <div style={{ display: 'flex', gap: 6, padding: '0 20px 12px', overflowX: 'auto', flexShrink: 0 }}>
                {activeInstruments.map(inst => {
                  const isAct = inst === fxInst;
                  const c = INSTRUMENT_COLOR[inst] ?? accent.from;
                  const hasFX = instFX[inst] && Object.values(instFX[inst]!).some(v => v !== 0);
                  return (
                    <button key={inst} onClick={() => setFxInst(inst)} style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: 'Manrope', cursor: 'pointer', background: isAct ? `${c}22` : 'var(--app-surface-high)', border: isAct ? `1.5px solid ${c}55` : '1.5px solid transparent', color: isAct ? c : 'var(--c-text-secondary)', position: 'relative', transition: 'all 130ms' }}>
                      {INSTRUMENT_NAME[inst] ?? inst.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())}
                      {hasFX && <span style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: c, display: 'block' }} />}
                    </button>
                  );
                })}
              </div>
              {/* scrollable body */}
              <div style={{ overflowY: 'auto', flexShrink: 1, paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)' }}>
                {/* ── Character presets ────────────────────────────────── */}
                {presets.length > 0 && (
                  <div style={{ padding: '0 20px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-muted)', fontFamily: 'Manrope' }}>Character</span>
                    <div style={{ display: 'flex', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
                      {presets.map(preset => {
                        const merged = { ...DEFAULT_INST_FX, ...preset.values };
                        const isActive = Object.keys(preset.values).every(
                          k => Math.abs((curFX[k as keyof InstFX] ?? 0) - (preset.values[k as keyof InstFX] ?? 0)) < 0.05
                        );
                        return (
                           <button key={preset.label}
                            onClick={() => setInstFX(fxInst, merged)}
                            title={`Apply "${preset.label}" FX character to ${INST_LABEL[fxInst] || fxInst}`}
                            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'Manrope', cursor: 'pointer', transition: 'all 140ms', background: isActive ? color : 'var(--app-surface-high)', color: isActive ? '#fff' : 'var(--c-text-secondary)', border: isActive ? `1.5px solid ${color}` : '1.5px solid rgba(128,128,128,0.15)' }}>
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* ── FX sliders ──────────────────────────────────────── */}
                {fxSliders.map(({ key, label, min, max, step, hint }) => {
                  const val = curFX[key] ?? 0;
                  const isEQ = key === 'eqLow' || key === 'eqLowMid' || key === 'eqMid' || key === 'eqHigh';
                  const dispVal = isEQ
                    ? (val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1)) + ' dB'
                    : `${Math.round(val * 100)}%`;
                  const active = val !== 0;
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 20px', borderBottom: '1px solid rgba(128,128,128,0.06)' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, opacity: active ? 1 : 0.22, transition: 'opacity 150ms' }} />
                      <div style={{ width: 90, flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', fontFamily: 'Manrope', lineHeight: 1.2 }}>{label}</div>
                        {hint && <div style={{ fontSize: 9, color: 'var(--c-text-muted)', fontFamily: 'Manrope', letterSpacing: '0.02em' }}>{hint}</div>}
                      </div>
                      <ElasticSlider
                        min={min} max={max} step={step} value={val}
                        onChange={v => setInstFX(fxInst, { ...curFX, [key]: v })}
                        accentColor={color}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? color : 'var(--c-text-muted)', minWidth: 58, textAlign: 'right', fontFamily: 'Manrope', transition: 'color 150ms' }}>{dispVal}</span>
                    </div>
                  );
                })}

                {/* ── Plugins section ──────────────────────────────── */}
                <div style={{ padding: '14px 20px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-muted)', fontFamily: 'Manrope', flex: 1 }}>Plugins</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 0 14px', color: 'var(--c-text-muted)', fontSize: 11.5, fontFamily: 'Manrope', fontStyle: 'italic', opacity: 0.7 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    Coming soon
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Export modal (full-screen) ────────────────────────────────────── */}
      {showExportModal && (
        <DrumExportModal
          patterns={patterns}
          song={activeSong}
          accent={accent}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* ── Import modal ─────────────────────────────────────────────────── */}
      {showImportDrum && (
        <DrumImportModal
          accent={accent}
          onImport={(name, artist, notes, pats, activeId) => {
            importDrumSong(name, artist, notes, pats, activeId);
            setShowImportDrum(false);
          }}
          onClose={() => setShowImportDrum(false)}
        />
      )}

      {/* ── Create Beat modal ────────────────────────────────────────────── */}
      {showCreateForm && (() => {
        const activeFamilyEntry = KIT_FAMILY.find(f => f.id === createFamily) ?? KIT_FAMILY[0];
        return (
          <div style={isWebDesktop ? { position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' } : { position: 'fixed', inset: 0, zIndex: 200 }}>
            <div onClick={() => setShowCreateForm(false)} style={isWebDesktop ? { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <div style={isWebDesktop ? { position: 'relative', width: '520px', maxWidth: '90vw', maxHeight: '85vh', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.55)', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '24px 0' } : { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="no-scrollbar">
              {!isWebDesktop && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(72,72,72,0.3)' }} />
                </div>
              )}
              <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: 20, margin: 0 }}>New Beat</p>

                {/* ── Beat info ── */}
                <div><label style={labelSt}>Beat Title</label><input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Funky Groove" style={inputSt} onKeyDown={e => { if (e.key === 'Enter' && createName.trim()) handleCreateBeat(); }} /></div>
                <div><label style={labelSt}>Artist</label><input value={createArtist} onChange={e => setCreateArtist(e.target.value)} placeholder="e.g. The Beatmakers" style={inputSt} /></div>

                {/* ── BPM ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelSt}>BPM</label>
                    <input type="number" min={40} max={280} value={createBpm} onChange={e => setCreateBpm(e.target.value)} style={inputSt} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 42 }}>
                      {([80, 100, 120, 140] as const).map(b => (
                        <button key={b} onClick={() => setCreateBpm(String(b))} className="btn-smooth"
                          style={{ flex: 1, height: 34, borderRadius: 8, background: createBpm === String(b) ? `${accent.from}22` : 'var(--app-surface-high)', border: `1px solid ${createBpm === String(b) ? accent.from + '44' : 'rgba(72,72,72,0.12)'}`, cursor: 'pointer', color: createBpm === String(b) ? accent.from : 'var(--c-text-muted)', fontSize: 10, fontWeight: 700 }}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Drum Kit ── */}
                <div>
                  <label style={labelSt}>Drum Kit</label>
                  <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 8 }}>
                    {KIT_FAMILY.map(fam => {
                      const isActive = fam.id === createFamily;
                      return (
                        <button key={fam.id} className="btn-smooth"
                          onClick={() => {
                            setCreateFamily(fam.id);
                            setCreateVariant(fam.variations[0].kit);
                          }}
                          style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 14, cursor: 'pointer', background: isActive ? `linear-gradient(135deg,${accent.from}22,${accent.to}12)` : 'var(--app-surface-high)', border: isActive ? `1.5px solid ${accent.from}55` : '1.5px solid transparent', transition: 'all 160ms' }}>
                          <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
                            <img src={KIT_IMAGE[fam.variations[0].kit]} alt={fam.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Manrope,sans-serif', color: isActive ? accent.from : 'var(--c-text-secondary)', whiteSpace: 'nowrap' }}>{fam.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Variation chips ── */}
                <div>
                  <label style={labelSt}>Sound</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {activeFamilyEntry.variations.map(v => {
                      const isSel = createVariant === v.kit;
                      const kitImg = KIT_IMAGE[v.kit];
                      return (
                        <button key={v.kit} className="btn-smooth"
                          onClick={() => {
                            setCreateVariant(v.kit);
                            loadDrumSamples(v.kit);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12, cursor: 'pointer', background: isSel ? `linear-gradient(135deg,${accent.from}18,${accent.to}10)` : 'var(--app-bg)', border: isSel ? `1.5px solid ${accent.from}55` : '1.5px solid rgba(128,128,128,0.12)', transition: 'all 150ms' }}>
                          <div style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, overflow: 'hidden', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: isSel ? `1.5px solid ${accent.from}55` : '1.5px solid rgba(128,128,128,0.08)', transition: 'all 150ms' }}>
                            {kitImg ? (
                              <img src={kitImg} alt={v.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--c-text-muted)' }}>music_note</span>
                            )}
                          </div>
                          <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: isSel ? accent.from : 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif', transition: 'color 150ms' }}>{v.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 1 }}>{v.desc}</div>
                          </div>
                          {isSel && <span className="material-symbols-outlined" style={{ fontSize: 18, color: accent.from, flexShrink: 0 }}>check_circle</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Notes (collapsed by default feel) ── */}
                <div><label style={labelSt}>Notes</label><textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)} rows={2} placeholder="Optional notes…" style={{ ...inputSt, resize: 'none', lineHeight: 1.5 } as React.CSSProperties} /></div>

                {/* ── Actions ── */}
                <div style={{ display: 'flex', gap: 10, paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
                  <button onClick={() => setShowCreateForm(false)} className="btn-smooth" style={{ flex: 1, padding: 14, borderRadius: 9999, background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleCreateBeat} className="btn-smooth"
                    style={{ flex: 2, padding: 14, borderRadius: 9999, background: createName.trim() ? `linear-gradient(135deg,${accent.from},${accent.to})` : 'rgba(72,72,72,0.2)', color: createName.trim() ? '#fff' : '#acabaa', fontFamily: 'Manrope', fontWeight: 800, border: 'none', cursor: createName.trim() ? 'pointer' : 'default', boxShadow: createName.trim() ? `0 4px 20px ${accent.to}40` : 'none', transition: 'all 200ms' }}>
                    Create Beat
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
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
  ludwig: `${BASE}/kit-warm.png`,
  jazz:   `${BASE}/kit-soft.png`,
  rmm:    `${BASE}/kit-punchy.png`,
  chrome: `${BASE}/kit-bright.png`,
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
  house:  `${BASE}/kit-house.png`,
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
const CircleHead = memo(function CircleHead({ r, color }: { r: number; color: string }) {
  return <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} />;
});
const XHead = memo(function XHead({ r, color, opacity = 1 }: { r: number; color: string; opacity?: number }) {
  const d = r * 0.85;
  return (
    <g opacity={opacity}>
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );
});
const GhostHead = memo(function GhostHead({ r, color }: { r: number; color: string }) {
  return <ellipse cx={0} cy={0} rx={r * 0.62} ry={r * 0.62 * 0.82} fill={color} opacity={0.40} />;
});
const RimshotHead = memo(function RimshotHead({ r, color }: { r: number; color: string }) {
  const d = r * 0.60;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill="none" stroke={color} strokeWidth={1.3} />
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </>
  );
});
const FlamHead = memo(function FlamHead({ r, color }: { r: number; color: string }) {
  const gr = r * 0.50;
  return (
    <>
      <ellipse cx={-r * 1.05} cy={-r * 0.95} rx={gr} ry={gr * 0.82} fill={color} opacity={0.72} />
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} />
    </>
  );
});
const AccentHead = memo(function AccentHead({ r, color }: { r: number; color: string }) {
  const oy = r * 2.1;
  return (
    <>
      <polyline
        points={`${-r * 0.58},${-oy} 0,${-oy - r * 0.72} ${r * 0.58},${-oy}`}
        fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round"
      />
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill={color} />
    </>
  );
});
const OpenHHHead = memo(function OpenHHHead({ r, color }: { r: number; color: string }) {
  const d = r * 0.62;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.82} fill="none" stroke={color} strokeWidth={1.4} />
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </>
  );
});
const BellHead = memo(function BellHead({ r, color }: { r: number; color: string }) {
  const rx = r * 0.82; const ry = r * 0.95;
  return <polygon points={`0,${-ry} ${rx},0 0,${ry} ${-rx},0`} fill={color} />;
});
const ChokeHead = memo(function ChokeHead({ r, color }: { r: number; color: string }) {
  const d = r * 0.62;
  return (
    <>
      <ellipse cx={0} cy={0} rx={r * 1.08} ry={r * 0.92} fill="none" stroke={color} strokeWidth={1.2} />
      <line x1={-d} y1={-d} x2={d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <line x1={d}  y1={-d} x2={-d} y2={d} stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </>
  );
});

const NoteHead = memo(function NoteHead({ inst, variation, r, color }: {
  inst: DrumInstrument; variation: NoteVariation; r: number; color: string;
}) {
  // HH-family and cymbals that default to X
  if (inst === 'hihat-closed') {
    if (variation === 'open')  return <OpenHHHead r={r} color={color} />;
    if (variation === 'pedal') return <XHead      r={r} color={color} />;
    return <XHead r={r} color={color} />;
  }
  if (inst === 'crash') {
    if (variation === 'choke') return <ChokeHead r={r} color={color} />;
    if (variation === 'bell')  return <BellHead  r={r} color={color} />;
    if (variation === 'ride')  return <XHead     r={r} color={color} opacity={0.65} />;
    return <XHead r={r} color={color} />;
  }
  if (inst === 'ride') {
    if (variation === 'bell') return <BellHead r={r} color={color} />;
    return <XHead r={r} color={color} />;
  }
  // Circle-family instruments
  if (inst === 'snare') {
    if (variation === 'ghost')   return <GhostHead   r={r} color={color} />;
    if (variation === 'rimshot') return <RimshotHead r={r} color={color} />;
    if (variation === 'flam')    return <FlamHead    r={r} color={color} />;
    return <CircleHead r={r} color={color} />;
  }
  if (variation === 'accent') return <AccentHead r={r} color={color} />;
  return <CircleHead r={r} color={color} />;
});

// A cell's hit info: variation + velocity (0–127). Replaces what used to be
// just a NoteVariation so the row can render velocity bars without a second
// store lookup.
export interface HitInfo { variation: NoteVariation; velocity: number; }

// Stable empty map — prevents creating a new reference each render for muted rows
const EMPTY_HIT_MAP: Map<number, HitInfo> = new Map();

// ── Instrument row SVG ─────────────────────────────────────────────────────
interface RowProps {
  inst: DrumInstrument;
  mStartIdx: number;
  rowMeasures: { id: string; hits: Partial<Record<DrumInstrument, { step: number; length: number; variation?: NoteVariation; velocity?: number }[]>> }[];
  spm: number;
  stepsPerBeat: number;
  STEP_W: number;
  MEASURE_W: number;
  hitMap: Map<number, HitInfo>;
  noteColor: string;
  staffColor: string;
  barColor: string;
  altBg: string;
  showVariations: boolean;
  gridEmphasis: boolean;
  accentFrom: string;
}
const InstrumentRow = memo(({
  inst, mStartIdx, rowMeasures, spm, stepsPerBeat, STEP_W, MEASURE_W,
  hitMap, noteColor, staffColor, barColor, altBg, showVariations, gridEmphasis, accentFrom,
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
      {/* Per-step cell dividers — gives every note slot a visible square box.
          Uses a high-contrast color so the squares pop in both light & dark themes. */}
      {rowMeasures.map((_, mi) =>
        Array.from({ length: spm }, (__, s) => {
          if (s === 0) return null;
          const x = (mi * spm + s) * STEP_W;
          const onBeat = s % stepsPerBeat === 0;
          return <line key={`s-${mi}-${s}`} x1={x} y1={0} x2={x} y2={ROW_H}
            stroke="var(--c-text-primary)"
            strokeWidth={onBeat ? 1.2 : 0.9}
            opacity={onBeat ? 0.55 : 0.32} />;
        })
      )}
      {/* Top + bottom row borders — close the cell squares vertically */}
      <line x1={0} y1={0} x2={totalW} y2={0} stroke="var(--c-text-primary)" strokeWidth={0.9} opacity={0.45} />
      <line x1={0} y1={ROW_H} x2={totalW} y2={ROW_H} stroke="var(--c-text-primary)" strokeWidth={0.9} opacity={0.45} />
      {/* Measure bar lines */}
      {rowMeasures.map((_, mi) => (
        <line key={mi} x1={mi * MEASURE_W} y1={0} x2={mi * MEASURE_W} y2={ROW_H} stroke={barColor} strokeWidth={mi === 0 ? 1.5 : 1.2} />
      ))}
      <line x1={totalW} y1={0} x2={totalW} y2={ROW_H} stroke={barColor} strokeWidth={1.5} />
      {/* Velocity bars — thin accent-tinted bar at the bottom of each active
          cell, width proportional to velocity. Drawn before noteheads so the
          notation always reads on top. */}
      {rowMeasures.map((_, mi) =>
        Array.from({ length: spm }, (__, s) => {
          const globalStep = (mStartIdx + mi) * spm + s;
          const info = hitMap.get(globalStep);
          if (!info) return null;
          const cellW   = STEP_W - 3;
          const frac    = Math.max(0.06, Math.min(1, info.velocity / MAX_VELOCITY));
          const w       = cellW * frac;
          const x       = (mi * spm + s) * STEP_W + (STEP_W - w) / 2;
          // Subtle: blends in for low velocity, more vivid for hard hits.
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
        })
      )}
      {/* Note heads */}
      {rowMeasures.map((_, mi) =>
        Array.from({ length: spm }, (__, s) => {
          const globalStep = (mStartIdx + mi) * spm + s;
          const info = hitMap.get(globalStep);
          if (!info) return null;
          // showVariations=false → all notes look identical (normal)
          const rawVariation = info.variation;
          const variation: NoteVariation = showVariations ? rawVariation : 'normal';

          // Pedal HH sits at the bottom; ride hits on the cymbal row sit slightly lower
          const noteY =
            (inst === 'hihat-closed' && rawVariation === 'pedal' && showVariations) ? ROW_H * 0.86 :
            (inst === 'crash' && (rawVariation === 'ride' || rawVariation === 'bell') && showVariations) ? ROW_H * 0.28 :
            defaultNoteY;

          const cx     = (mi * spm + s) * STEP_W + STEP_W / 2;
          const cy     = noteY;
          const stemUp = cy > ROW_H * 0.5;
          const stemY1 = stemUp ? cy - NOTE_R * 0.9  : cy + NOTE_R * 0.9;
          const stemY2 = stemUp ? cy - NOTE_R * 3.5  : cy + NOTE_R * 3.5;

          // Ghost notes: draw a faint parenthesis pair instead of stem
          const isGhost = showVariations && variation === 'ghost';

          return (
            <g key={`${mi}-${s}`} transform={`translate(${cx}, ${cy})`}>
              {isGhost ? (
                <>
                  <text x={-NOTE_R * 1.9} y={NOTE_R * 0.38} fontSize={NOTE_R * 1.7} fill={noteColor} opacity={0.38} fontFamily="serif" dominantBaseline="middle">(</text>
                  <text x={NOTE_R * 0.95}  y={NOTE_R * 0.38} fontSize={NOTE_R * 1.7} fill={noteColor} opacity={0.38} fontFamily="serif" dominantBaseline="middle">)</text>
                </>
              ) : (
                <line
                  x1={stemUp ? NOTE_R * 0.75 : -NOTE_R * 0.75} y1={stemY1 - cy}
                  x2={stemUp ? NOTE_R * 0.75 : -NOTE_R * 0.75} y2={stemY2 - cy}
                  stroke={noteColor} strokeWidth={1.2} strokeLinecap="round"
                />
              )}
              <NoteHead inst={inst} variation={variation} r={NOTE_R} color={noteColor} />
            </g>
          );
        })
      )}
    </svg>
  );
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#0e0e0e', display: 'flex', flexDirection: 'column',
      animation: closing ? 'sheet-down 320ms cubic-bezier(0.25,0.46,0.45,0.94) both' : 'sheet-up 340ms cubic-bezier(0.25,0.46,0.45,0.94) both' }}>

      {/* ── Header ── */}
      <div style={{ paddingTop: 'env(safe-area-inset-top)', background: '#191a1a', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(128,128,128,0.25)' }} />
        </div>
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
  return (
    <div style={{ background: 'var(--app-surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(128,128,128,0.06)' }}>
      <div style={{ padding: '14px 14px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'Manrope,sans-serif' }}>{lp.name}</div>
            <div style={{ fontSize: 10.5, color: 'var(--c-text-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>{lp.category} · {lp.genre} · {lp.bpm} BPM</div>
          </div>
          <button onClick={() => onPreview(lp)} className="btn-smooth"
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isPreviewPlaying ? `linear-gradient(135deg,${accent.from},${accent.to})` : `${accent.from}12`, color: isPreviewPlaying ? '#fff' : accent.from, transition: 'all 160ms', boxShadow: isPreviewPlaying ? `0 4px 16px ${accent.from}44` : 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{isPreviewPlaying ? 'stop' : 'play_arrow'}</span>
          </button>
        </div>
      </div>
      <div style={{ padding: '0 14px 10px' }}>
        <LibMiniGrid lp={lp} isLight={isLight} />
      </div>
      <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6 }}>
        <button onClick={() => onReplace(lp)} className="btn-smooth"
          style={{ flex: 1, padding: '10px', borderRadius: 10, background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'var(--c-text-primary)', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 160ms' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>file_download</span>
          Use
        </button>
        <button onClick={() => onInsert(lp)} className="btn-smooth"
          style={{ flex: 1, padding: '10px', borderRadius: 10, background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'var(--c-text-primary)', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 160ms' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>playlist_add</span>
          Append
        </button>
      </div>
    </div>
  );
});

const VISIBLE_BATCH = 20;

// ── DrumEditor ─────────────────────────────────────────────────────────────
export default function DrumEditor() {
  const { settings, updateSettings } = useChordStore();
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
  const noteColor  = isLight ? '#111118' : '#f0f0f2';
  const staffColor = isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.18)';
  const barColor   = isLight ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.45)';
  const altBg      = isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.018)';

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
  const [editingSong,      setEditingSong]      = useState<DrumSong | null>(null);
  const [editingName,      setEditingName]      = useState('');
  const [editingArtist,    setEditingArtist]    = useState('');
  const [activeDrumSongId, setActiveDrumSongId] = useState<string | null>(null);
  const [tabAnim, setTabAnim] = useState<'panel-enter-right' | 'panel-enter-left'>('panel-enter-right');
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
  const measuresPerRow = isLandscape ? rawMpr : 1;
  const MEASURE_W      = availableW / measuresPerRow;
  const STEP_W         = MEASURE_W / spm;
  const SYSTEM_H       = RULER_H + visibleInsts.length * ROW_H;
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
  const allHitMaps = useMemo(() => {
    const map = new Map<DrumInstrument, Map<number, HitInfo>>();
    visibleInsts.forEach(inst => {
      const m2 = new Map<number, HitInfo>();
      pattern.measures.forEach((m, mIdx) => {
        m.hits[inst]?.forEach(h => m2.set(mIdx * spm + h.step, {
          variation: h.variation ?? 'normal',
          velocity: typeof h.velocity === 'number' ? h.velocity : DEFAULT_VELOCITY,
        }));
      });
      map.set(inst, m2);
    });
    return map;
  }, [pattern, spm, visibleInsts]);

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
      if (gs < 0) { if (playheadRef.current) playheadRef.current.style.display = 'none'; return; }
      const sp = spmRef.current; const mpr = mprRef.current; const sw = stepWRef.current; const sh = sysHRef.current;
      const systemIdx = Math.floor(mIdx / mpr); const measureInRow = mIdx % mpr; const stepInRow = measureInRow * sp + stepInM;
      const x = LABEL_W + stepInRow * sw; const y = systemIdx * sh;
      if (playheadRef.current) { playheadRef.current.style.transform = `translate(${x}px, ${y}px)`; playheadRef.current.style.display = 'block'; }
      const el = scrollRef.current;
      if (el) { const rowBottom = y + RULER_H + allInstsRef.current.length * ROW_H; if (y < el.scrollTop || rowBottom > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, y - 40); }
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
      if (drumPrefsRef.current.autoExpandPattern && gs === totalStepsRef.current - 1) {
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
    pushUndo();
    updatePattern(pattern.id, { measures: [emptyMeasure()] } as Parameters<typeof updatePattern>[1]);
    if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
  }, [pattern.id, updatePattern, pushUndo]);

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
      if (inEditor) {
        if (drumScheduler.isPlaying) { drumScheduler.stop(); setPlaying(false); }
        setShowHamburger(false); setShowBpmPanel(false);
        setInEditor(false); setActiveTab('songs');
        return true;
      }
      return false;
    };
    setBackHandler(handler);
    return () => setBackHandler(null);
  }, [inEditor]);

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
  const menuItemSt: React.CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-primary)', fontSize: 12.5, fontFamily: 'Manrope', fontWeight: 600, textAlign: 'left', transition: 'background 120ms' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--app-bg)', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>

      {/* ── Safe-area spacer ─────────────────────────────────────────────── */}
      {!(isLandscape && inEditor) && (
        <div style={{ height: 'env(safe-area-inset-top)', background: 'var(--app-bg)', flexShrink: 0 }} />
      )}

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, height: inEditor ? (isLandscape ? 40 : 52) : undefined, display: 'flex', alignItems: 'center', padding: isLandscape && inEditor ? '0 10px' : inEditor ? '0 20px' : '24px 24px 4px', gap: isLandscape && inEditor ? 6 : 8, background: 'var(--app-bg)', borderBottom: isLandscape && inEditor ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
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
                    <button onClick={() => adjustBpm(-1)} className="btn-smooth" style={{ width: 22, height: 22, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'Manrope,sans-serif', color: accent.from, minWidth: 28, textAlign: 'center' }}>{pattern.bpm}</span>
                    <button onClick={() => adjustBpm(1)} className="btn-smooth" style={{ width: 22, height: 22, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                  <div style={{ width: 1, height: 18, background: 'rgba(128,128,128,0.12)' }} />
                  <button onClick={handlePlay} className="btn-smooth" style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: playing ? 'rgba(128,128,128,0.12)' : `linear-gradient(135deg,${accent.from},${accent.to})`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: playing ? 'var(--c-text-secondary)' : '#fff', transition: 'all 150ms', flexShrink: 0 }}>
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
              {/* EQ / quick-mixer button */}
              <button onClick={() => setShowMixerSheet(s => !s)} title="Mixer"
                style={{ height: 30, width: 30, borderRadius: 8, background: showMixerSheet ? `${accent.from}1e` : 'rgba(128,128,128,0.08)', border: `1px solid ${showMixerSheet ? accent.from + '33' : 'rgba(128,128,128,0.18)'}`, cursor: 'pointer', color: showMixerSheet ? accent.from : 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', padding: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
              </button>
              {/* Per-instrument FX button */}
              <button onClick={() => { if (!showFXSheet) setFxInst(activeInstruments[0] ?? 'kick'); setShowFXSheet(s => !s); }} title="Instrument FX"
                style={{ height: 30, width: 36, borderRadius: 8, background: showFXSheet ? `${accent.from}1e` : 'rgba(128,128,128,0.08)', border: `1px solid ${showFXSheet ? accent.from + '33' : 'rgba(128,128,128,0.18)'}`, cursor: 'pointer', color: showFXSheet ? accent.from : 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms', padding: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Manrope,sans-serif', letterSpacing: '0.04em' }}>FX</span>
              </button>
              <button onClick={() => {
                if (showHamburger) {
                  setHamburgerClosing(true);
                  setTimeout(() => { setShowHamburger(false); setHamburgerClosing(false); }, 170);
                } else {
                  setShowHamburger(true);
                }
              }} style={{ height: 30, width: 38, borderRadius: 8, background: showHamburger ? `${accent.from}1e` : 'rgba(128,128,128,0.08)', border: `1px solid ${showHamburger ? accent.from + '33' : 'rgba(128,128,128,0.1)'}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', flexShrink: 0, transition: 'all 180ms' }}>
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
      <div key={activeTab} className={tabAnim} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ═══ SONGS LIST (Songs tab, not in editor) ═══════════════════════ */}
        {activeTab === 'songs' && !inEditor && (
          <div onScroll={drumScrollHide} style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }} className="no-scrollbar panel-enter-left">
            <div style={{ padding: '0 20px', marginTop: 12, marginBottom: 24 }}>
              <AnimatedAppHeader
                title="Beats"
                subtitle="Your drum songs"
              />
            </div>
            {drumSongs.length === 0 ? (
              <div className="spring-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', margin: '0 20px', background: 'var(--app-surface)', borderRadius: '1.5rem', gap: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${accent.to}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={accent.from} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="7" rx="10" ry="4"/><path d="M2 7c0 2.21 4.48 4 10 4s10-1.79 10-4"/><path d="M2 7v5c0 2.21 4.48 4 10 4s10-1.79 10-4V7"/><path d="M2 12v5c0 2.21 4.48 4 10 4s10-1.79 10-4v-5"/></svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: 18, margin: 0 }}>No beats yet</p>
                  <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 13, marginTop: 4, margin: '4px 0 0' }}>Create your first drum beat to get started.</p>
                </div>
                <button onClick={() => setShowCreateForm(true)} className="btn-smooth"
                  style={{ padding: '12px 24px', borderRadius: 9999, background: `linear-gradient(135deg,${accent.from},${accent.to})`, color: '#fff', fontFamily: 'Manrope', fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: `0 4px 20px ${accent.to}44` }}>
                  New Beat
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }}>
                <StaggeredReveal staggerInterval={40}>
                  {drumSongs.map(song => {
                  const isDeleting = deletingId === song.id;
                  const isEditing  = editingSong?.id === song.id;
                  const kitLabel   = song.kitType ? KIT_LABEL[song.kitType] : 'No kit';
                  const pCount     = song.patterns.length;
                  const activePat  = song.patterns.find(p => p.id === song.activePatternId) ?? song.patterns[0];
                  const bpm        = activePat?.bpm ?? 120;
                  return (
                    <div key={song.id} className="card-hover" style={{ background: 'var(--app-surface)', borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(72,72,72,0.06)' }}>
                      {isEditing ? (
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input value={editingName} onChange={e => setEditingName(e.target.value)} autoFocus placeholder="Beat name" style={{ ...inputSt, fontWeight: 700 }} />
                          <input value={editingArtist} onChange={e => setEditingArtist(e.target.value)} placeholder="Artist (optional)" style={{ ...inputSt, fontSize: 13 }} />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleSaveEdit} className="btn-smooth" style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: `linear-gradient(135deg,${accent.from},${accent.to})`, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700 }}>Save</button>
                            <button onClick={() => setEditingSong(null)} className="btn-smooth" style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(128,128,128,0.10)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 13, fontWeight: 600 }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button onClick={() => handleLoadSong(song)} style={{ width: '100%', textAlign: 'left', padding: '16px', display: 'flex', alignItems: 'center', gap: 14, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(0,0,0,0.35)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${accent.from}22` }}>
                              {song.kitType && KIT_IMAGE[song.kitType] ? (
                                <img src={KIT_IMAGE[song.kitType]} alt={kitLabel} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accent.from} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="7" rx="10" ry="4"/><path d="M2 7c0 2.21 4.48 4 10 4s10-1.79 10-4"/><path d="M2 7v5c0 2.21 4.48 4 10 4s10-1.79 10-4V7"/><path d="M2 12v5c0 2.21 4.48 4 10 4s10-1.79 10-4v-5"/></svg>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{song.name}</p>
                              {song.artist && <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: 12, margin: '2px 0 0' }}>{song.artist}</p>}
                              <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, fontFamily: 'Manrope', fontWeight: 700, color: 'var(--c-text-primary)', background: 'var(--app-surface-high)', padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>{kitLabel}</span>
                                <span style={{ fontSize: 10, fontFamily: 'Manrope', fontWeight: 700, color: 'var(--c-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: 11, lineHeight: 1 }}>speed</span>
                                  {bpm} BPM
                                </span>
                                <span style={{ fontSize: 10, fontFamily: 'Manrope', fontWeight: 700, color: 'var(--c-text-muted)' }}>{pCount} pattern{pCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: 20, flexShrink: 0 }}>chevron_right</span>
                          </button>
                          <div style={{ display: 'flex', borderTop: '1px solid rgba(72,72,72,0.07)' }}>
                            <button onClick={() => handleStartEdit(song)} className="btn-smooth" style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, background: 'transparent', border: 'none', borderRight: '1px solid rgba(72,72,72,0.07)', cursor: 'pointer' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14, flexShrink: 0 }}>edit</span>
                              Edit
                            </button>
                            {isDeleting ? (
                              <>
                                <button onClick={() => { deleteDrumSong(song.id); setDeletingId(null); }} className="btn-smooth" style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#ee7d77', fontFamily: 'Manrope', fontWeight: 800, fontSize: 11, background: 'rgba(238,125,119,0.10)', border: 'none', cursor: 'pointer', borderRight: '1px solid rgba(72,72,72,0.07)' }}>
                                  Confirm
                                </button>
                                <button onClick={() => setDeletingId(null)} className="btn-smooth" style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button onClick={() => setDeletingId(song.id)} className="btn-smooth" style={{ flex: 1, padding: '9px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#ee7d77', fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, flexShrink: 0 }}>delete</span>
                                Delete
                              </button>
                            )}
                          </div>
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
          <div ref={containerCallbackRef} className="panel-enter-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
              style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: 8, paddingBottom: isLandscape ? 20 : 100, position: 'relative' }}
              className="no-scrollbar"
            >
              {/* Playhead — extends into ruler, draggable handle at top */}
              <div ref={playheadRef} style={{ position: 'absolute', top: 8, left: 0, width: 2, height: RULER_H + visibleInsts.length * ROW_H, background: accent.from, boxShadow: `0 0 8px ${accent.from}88`, pointerEvents: 'none', zIndex: 10, display: 'none', borderRadius: 1, willChange: 'transform', transform: 'translateZ(0)' }}>
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
                    <div style={{ display: 'flex', height: RULER_H, marginLeft: LABEL_W, borderBottom: `1px solid ${barColor}` }}>
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
                      const hitMap = allHitMaps.get(inst) ?? EMPTY_HIT_MAP;
                      const isFoc  = focusedInst === inst;
                      const varList = INST_VARIATIONS[inst];
                      return (
                        <div key={inst} style={{ display: 'flex', height: ROW_H, borderBottom: instIdx < visibleInsts.length - 1 ? `1px solid ${staffColor}` : `1.5px solid ${barColor}`, background: (isFoc && drumPrefs.highlightActiveInst) ? (isLight ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.018)') : 'transparent' }}>
                          <div style={{ width: LABEL_W, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 12, paddingRight: 6, borderRight: `1px solid ${barColor}` }}>
                            <span style={{ fontSize: 8, fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: (isFoc && drumPrefs.highlightActiveInst) ? 'var(--c-text-primary)' : 'var(--c-text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'color 200ms' }}>{INST_LABEL[inst]}</span>
                            {varList && varList.length > 1 && (
                              <span style={{ fontSize: 6.5, fontFamily: 'Manrope, sans-serif', color: 'var(--c-text-muted)', opacity: 0.55, letterSpacing: '0.02em', whiteSpace: 'normal', lineHeight: 1.35, marginTop: 1, width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{varList.join(' · ')}</span>
                            )}
                          </div>
                          <InstrumentRow inst={inst} mStartIdx={mStartIdx} rowMeasures={rowMeasures} spm={spm} stepsPerBeat={stepsPerBeat} STEP_W={STEP_W} MEASURE_W={MEASURE_W} hitMap={hitMap} noteColor={noteColor} staffColor={staffColor} barColor={barColor} altBg={altBg} showVariations={drumPrefs.showNoteVariations} gridEmphasis={drumPrefs.gridLinesEmphasis} accentFrom={accent.from} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 32, paddingTop: 8 }}>
                <button onClick={() => { pushUndo(); addMeasure(pattern.id); }} style={{ height: 36, padding: '0 24px', borderRadius: 999, background: 'transparent', border: 'var(--add-bar-border)', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
                  onPointerEnter={e => { e.currentTarget.style.borderColor = accent.from + '70'; e.currentTarget.style.color = accent.from; }}
                  onPointerLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}>
                  <span style={{ fontSize: 16 }}>+</span><span>Add Bar</span>
                </button>
              </div>
            </div>
            {/* BPM + Play (hidden in landscape — controls are in the top bar) */}
            <div style={{ position: 'fixed', right: 14, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)', zIndex: 60, display: isLandscape ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
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
                <button onClick={() => setShowBpmPanel(s => !s)} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: showBpmPanel ? `${accent.from}22` : (isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)')), boxShadow: isLight ? '0 2px 12px rgba(0,0,0,0.10)' : '0 2px 12px rgba(0,0,0,0.50)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', cursor: 'pointer', transition: 'all 160ms', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: showBpmPanel ? `1.5px solid ${accent.from}66` : '1.5px solid rgba(255,255,255,0.10)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M9 4h6l1.5 12H7.5L9 4Z" stroke={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} strokeWidth="1.7" strokeLinejoin="round" />
                    <line x1="12" y1="4" x2="17" y2="13" stroke={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} strokeWidth="1.7" strokeLinecap="round" />
                    <rect x="10" y="2" width="4" height="2.5" rx="1" fill={showBpmPanel ? accent.from : 'var(--c-text-secondary)'} />
                  </svg>
                </button>
              </div>
              <button onClick={handlePlay} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: playing ? (isAmoled ? 'rgba(4,4,4,0.88)' : (isLight ? 'rgba(240,240,242,0.82)' : 'rgba(26,26,30,0.82)')) : `linear-gradient(135deg, ${accent.from}, ${accent.to})`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: playing ? 13 : 14, color: playing ? 'var(--c-text-secondary)' : '#fff', boxShadow: playing ? '0 4px 20px rgba(0,0,0,0.40), 0 0 0 1.5px rgba(255,255,255,0.08)' : `0 4px 20px ${accent.from}55, 0 0 0 1.5px rgba(255,255,255,0.12)`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', transition: 'all 170ms' }}>
                {playing ? '⏹' : '▶'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ LIBRARY TAB ═════════════════════════════════════════════════ */}
        {activeTab === 'patterns' && (
          <div onScroll={drumScrollHide} style={{ flex: 1, overflowY: 'auto', paddingTop: 12, paddingBottom: 100 }} className="no-scrollbar">

            {/* ── Search ──────────────────────────────────────────────── */}
            <div style={{ padding: '0 16px 12px' }}>
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--c-text-muted)', pointerEvents: 'none' }}>search</span>
                <input
                  value={libSearch}
                  onChange={e => handleLibSearchChange(e.target.value)}
                  placeholder="Search patterns, genres, or moods..."
                  style={{ width: '100%', padding: '12px 14px 12px 38px', borderRadius: 12, background: 'var(--app-surface)', border: '1px solid rgba(128,128,128,0.10)', color: 'var(--c-text-primary)', fontSize: 13, fontFamily: 'Manrope,sans-serif', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* ── Category chips ──────────────────────────────────────── */}
            <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 16px 12px' }}>
              {(['All', ...LIBRARY_CATEGORIES, 'My Grooves'] as (LibraryCategory | 'All' | 'My Grooves')[]).map(cat => {
                const active = libCategory === cat;
                return (
                  <button key={cat} onClick={() => { setLibCategory(cat); if (cat === 'My Grooves') setLibGenre(''); }} className="btn-smooth"
                    style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'Manrope,sans-serif', cursor: 'pointer', border: 'none', background: active ? `linear-gradient(135deg,${accent.from},${accent.to})` : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'), color: active ? '#fff' : 'var(--c-text-secondary)', transition: 'all 150ms' }}>
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* ── Genre filter (not shown for My Grooves) ────────────── */}
            {libCategory !== 'My Grooves' && (
              <div className="no-scrollbar" style={{ display: 'flex', gap: 5, overflowX: 'auto', padding: '0 16px 16px' }}>
                {(['', ...LIBRARY_GENRES] as (LibraryGenre | '')[]).map(g => {
                  const label = g === '' ? 'All Genres' : g;
                  const active = libGenre === g;
                  return (
                    <button key={label} onClick={() => setLibGenre(g)} className="btn-smooth"
                      style={{ flexShrink: 0, padding: '4px 12px', borderRadius: 16, fontSize: 10.5, fontWeight: 700, fontFamily: 'Inter,sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', border: active ? `1.5px solid ${accent.from}` : '1.5px solid rgba(128,128,128,0.15)', background: active ? `${accent.from}15` : 'transparent', color: active ? accent.from : 'var(--c-text-muted)', transition: 'all 150ms' }}>
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
                  <div style={{ margin: '0 16px 24px', padding: '28px 20px', borderRadius: 14, background: 'var(--app-surface)', border: '1px dashed rgba(128,128,128,0.18)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <EmptyStateLottie app="drumex" size={52} isLight={isLight} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--c-text-secondary)', fontFamily: 'Manrope,sans-serif' }}>No grooves saved yet</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--c-text-muted)' }}>Save any pattern to build your personal library</p>
                  </div>
                ) : (
                  <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredGrooves.map(g => {
                      const isPreviewPlaying = previewingGrooveId === g.id && drumScheduler.isPlaying;
                      const menuOpen = grooveMenuId === g.id;
                      const isRenaming = grooveRenameId === g.id;
                      return (
                        <div key={g.id} style={{ background: 'var(--app-surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(128,128,128,0.06)' }}>
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
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredLibrary.length === 0 ? (
                  <div style={{ padding: '28px 20px', borderRadius: 14, background: 'var(--app-surface)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <EmptyStateLottie app="drumex" size={44} isLight={isLight} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--c-text-secondary)', fontFamily: 'Manrope,sans-serif' }}>No patterns found</p>
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

      {/* ── Bottom nav ───────────────────────────────────────────────────── */}
      <DrumNav activeTab={activeTab} setTab={handleSetTab} accent={accent} isLight={isLight} isAmoled={isAmoled} hidden={isLandscape && inEditor} />

      {/* ── Floating buttons (songs list only): import above + add ──────── */}
      {!inEditor && activeTab === 'songs' && (
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setShowSaveGroove(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(128,128,128,0.25)' }} />
            </div>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => setShowMixerSheet(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(72,72,72,0.3)' }} />
            </div>
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
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
            <div onClick={() => setShowFXSheet(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
                <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(72,72,72,0.3)' }} />
              </div>
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
          <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
            <div onClick={() => setShowCreateForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--app-surface)', borderRadius: '1.5rem 1.5rem 0 0', animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="no-scrollbar">
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
                <div style={{ width: 36, height: 4, borderRadius: 9999, background: 'rgba(72,72,72,0.3)' }} />
              </div>
              <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: 20, margin: 0 }}>New Beat</p>

                {/* ── Beat info ── */}
                <div><label style={labelSt}>Beat Title</label><input value={createName} onChange={e => setCreateName(e.target.value)} autoFocus placeholder="e.g. Funky Groove" style={inputSt} onKeyDown={e => { if (e.key === 'Enter' && createName.trim()) handleCreateBeat(); }} /></div>
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

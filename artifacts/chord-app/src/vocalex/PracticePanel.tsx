import { useState, useRef, useEffect, useCallback } from 'react';
import { CATEGORIES, EXERCISES, NOTE_FREQ, type Exercise, type ExerciseStep } from './exerciseData';
import { PracticeDetector, type DetectorState, type StepScore, statusColor, centsToAccuracy } from './practiceDetector';
import { playNoteVoice, stopVoice } from './vocalSynth';
import {
  BreathingBodyIllustration,
  HummingFaceIllustration,
  MouthShapeIllustration,
  SingingFaceIllustration,
  LipTrillIllustration,
  SireneSlideIllustration,
  StaccatoIllustration,
  SustainBodyIllustration,
} from './ExerciseIllustrations';

function stopActiveTone() {
  stopVoice();
}

function playNoteForStep(step: ExerciseStep) {
  if (!step.targetNote) return;
  playNoteVoice(step.targetNote, step.durationSec, step.syllable);
}

const CATEGORY_TECHNIQUES: Record<string, string[]> = {
  warmup: [
    'Keep lips and jaw relaxed — no tension',
    'Feel the vibration in your lips, nose & forehead',
    'Start gently — never force the voice at this stage',
    'Breathe through your nose between each repetition',
  ],
  breath: [
    'Expand your belly outward, not your chest upward',
    'Keep your shoulders still and relaxed',
    'Imagine a balloon inflating in your stomach',
    'Exhale on a steady stream — like blowing through a straw',
  ],
  pitch: [
    'Listen to the reference tone before singing',
    'Relax your jaw — tension makes you sharp',
    'Think the note in your head first, then sing it',
    'Watch the pitch indicator and adjust in real time',
  ],
  resonance: [
    'Feel where the sound vibrates — face, chest, or head',
    'Keep your throat open like a yawn inside',
    'Vowel shape matters — exaggerate mouth positions',
    'Forward placement gives a bright, carrying tone',
  ],
  range: [
    'Never push or force notes at the top of your range',
    'Think "light and forward" as you ascend',
    'Stay on the vowel shape through register transitions',
    'If it strains, drop the key lower and build up',
  ],
  agility: [
    'Start slow — accuracy first, speed follows',
    'Keep each note clean before increasing tempo',
    'Use a light, bouncy touch — diaphragm drives each note',
    'Record yourself: clarity sounds different than it feels',
  ],
  articulation: [
    'Exaggerate consonants more than feels natural',
    'Keep the vowel space open between consonants',
    'Tongue tip stays light and agile — don\'t over-tighten',
    'Speak it perfectly slow before you sing it fast',
  ],
};

const VISUAL_COACHING: Record<string, string[]> = {
  breathBar: [
    'Expand your belly like a balloon — shoulders stay down',
    'Let the breath fall out — don\'t push or force it',
    'Count slowly in your head to pace the flow',
  ],
  sustainHold: [
    'Engage your core — like bracing for a gentle punch',
    'Keep your throat relaxed while you hold',
    'Imagine a steady, even pressure — no jerking',
  ],
  pitchLadder: [
    'Listen to the tone playing — match it before singing',
    'Relax your jaw and let the pitch find its place',
    'Try a soft "mm" hum first, then open to the vowel',
  ],
  vowelShape: [
    'Exaggerate the lip and tongue shape more than normal',
    'Keep the back of your throat open — like a yawn',
    'Focus on where you feel the vibration in your face',
  ],
  trillWave: [
    'Loose, floppy lips — don\'t press them together tightly',
    'Let the air do the work — steady breath pressure',
    'If the trill stops, smile slightly and try again',
  ],
  sirene: [
    'Glide smoothly — no flipping or jumping',
    'Think of it as one continuous tone bending',
    'Stay on "oo" — it keeps your voice connected',
  ],
  intervalJump: [
    'Hear the target note in your head before you sing it',
    'Take a small breath between jumps',
    'Don\'t slide — aim for a clean landing on the note',
  ],
  dynamicBar: [
    'Imagine a speaker with a volume knob — control it',
    'Breath pressure drives dynamics, not throat tension',
    'Pianissimo should still feel resonant, not breathy',
  ],
};

function AccuracyRing({ state, size = 56 }: { state: DetectorState; size?: number }) {
  const r = (size - 6) / 2;
  const C = 2 * Math.PI * r;
  const fill = state.status !== 'silent' ? state.accuracy * C : 0;
  const color = statusColor(state.status);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#252626" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${fill} ${C - fill}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 150ms ease, stroke 150ms ease' }}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={state.status === 'good' ? 14 : 10} fontWeight="800" fontFamily="Manrope"
        style={{ transition: 'fill 150ms ease' }}
      >
        {state.status === 'silent' ? '—' :
         state.status === 'good' ? '✓' :
         state.centsOff > 0 ? '↑' : '↓'}
      </text>
    </svg>
  );
}

function ScoreDisplay({ scores, exerciseColor }: { scores: StepScore[]; exerciseColor: string }) {
  const totalAccuracy = scores.length > 0
    ? scores.filter(s => s.totalSamples > 0).reduce((sum, s) => sum + s.accuracy, 0) / Math.max(1, scores.filter(s => s.totalSamples > 0).length)
    : 0;
  const pct = Math.round(totalAccuracy * 100);
  const grade = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 55 ? 'Fair' : 'Keep Practicing';
  const gradeColor = pct >= 90 ? '#34d399' : pct >= 75 ? '#007aff' : pct >= 55 ? '#eab308' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: `${gradeColor}1a`, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 28, fontWeight: 800, color: gradeColor }}>{pct}%</span>
      </div>
      <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: gradeColor }}>{grade}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {scores.map((s, i) => {
          const stepPct = Math.round(s.accuracy * 100);
          const c = stepPct >= 80 ? '#34d399' : stepPct >= 55 ? '#eab308' : s.totalSamples === 0 ? '#484848' : '#ef4444';
          return (
            <div key={i} style={{
              width: 28, height: 28, borderRadius: 6, background: `${c}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${c}44`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: c, fontFamily: 'Inter, sans-serif' }}>
                {s.totalSamples === 0 ? '—' : stepPct >= 80 ? '✓' : stepPct >= 55 ? '~' : '✗'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BreathBarVisual({ progress, phase }: { progress: number; phase: string }) {
  const isIn = phase.toLowerCase().includes('breathe in') || phase.toLowerCase().includes('inhale') || phase.toLowerCase().includes('deep in');
  const isHold = phase.toLowerCase().includes('hold');
  const fillH = isIn ? progress * 100 : isHold ? 85 : (1 - progress) * 100;
  const label = isIn ? '↑ INHALE' : isHold ? '· HOLD' : '↓ EXHALE';
  const color = isIn ? '#34d399' : isHold ? '#eab308' : '#60a5fa';
  return (
    <div style={{ width: '100%', height: 72, borderRadius: 14, background: '#141515', position: 'relative', overflow: 'hidden', border: '1px solid #252626' }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: `${Math.max(4, fillH)}%`,
        background: `linear-gradient(to top, ${color}55, ${color}18)`,
        transition: 'height 200ms ease',
      }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 800, color, opacity: 0.9 }}>{label}</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575' }}>belly expands, chest stays still</span>
      </div>
    </div>
  );
}

function SustainHoldVisual({ progress }: { progress: number }) {
  const ringP = progress * 283;
  const pct = Math.round(progress * 100);
  return (
    <div style={{ width: '100%', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <svg viewBox="0 0 100 100" width={60} height={60}>
        <circle cx="50" cy="50" r="45" fill="none" stroke="#252626" strokeWidth="5" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#34d399" strokeWidth="5"
          strokeDasharray="283" strokeDashoffset={283 - ringP} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 200ms ease' }} />
        <text x="50" y="47" textAnchor="middle" fill="#e7e5e4" fontSize="15" fontWeight="700" fontFamily="Manrope">HOLD</text>
        <text x="50" y="62" textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="600" fontFamily="Inter">{pct}%</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575' }}>Core engaged</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575' }}>Throat open</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575' }}>Shoulders down</span>
      </div>
    </div>
  );
}

function PitchLadderVisual({ targetNote, detectorState, exerciseColor }: { targetNote?: string; detectorState?: DetectorState; exerciseColor: string }) {
  const scaleNotes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
  const detected = detectorState && detectorState.status !== 'silent' ? `${detectorState.currentPitch?.noteName}${detectorState.currentPitch?.octave}` : null;
  return (
    <div style={{ width: '100%' }}>
      <div style={{ width: '100%', height: 72, display: 'flex', alignItems: 'flex-end', gap: 3, padding: '0 4px', background: '#141515', borderRadius: 14, border: '1px solid #252626', overflow: 'hidden', position: 'relative' }}>
        {scaleNotes.map((note, i) => {
          const isTarget = targetNote?.includes(note.replace(/\d/, '')) || targetNote === note;
          const isDetected = detected === note;
          const h = 20 + ((i / Math.max(1, scaleNotes.length - 1)) * 65);
          const bg = isTarget ? exerciseColor : isDetected ? '#34d399' : '#252626';
          const opacity = isTarget ? 1 : isDetected ? 0.9 : 0.4;
          return (
            <div key={note} style={{
              flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0',
              background: bg, opacity,
              transition: 'background 200ms ease, opacity 200ms ease',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 3,
              position: 'relative',
            }}>
              {isTarget && (
                <span style={{ fontSize: 7, fontFamily: 'Inter, sans-serif', fontWeight: 700, color: '#fff', opacity: 0.9 }}>
                  {note.replace(/\d/, '')}
                </span>
              )}
              {!isTarget && (
                <span style={{ fontSize: 6, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#484848' }}>
                  {note.replace(/\d/, '')}
                </span>
              )}
            </div>
          );
        })}
        {targetNote && (
          <div style={{ position: 'absolute', top: 6, right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 800, color: exerciseColor }}>Target: {targetNote}</span>
          </div>
        )}
      </div>
      {detectorState && detectorState.status !== 'silent' && detectorState.currentPitch && (
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#767575' }}>You:</span>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: statusColor(detectorState.status) }}>
            {detectorState.currentPitch.noteName}{detectorState.currentPitch.octave}
            {detectorState.status === 'good' ? ' ✓ On pitch' : detectorState.centsOff > 0 ? ' ↑ Too high' : ' ↓ Too low'}
          </span>
        </div>
      )}
    </div>
  );
}

function VowelShapeVisual({ syllable, progress }: { syllable?: string; progress: number }) {
  const vowelDefs: Record<string, { w: number; h: number; label: string; hint: string; color: string }> = {
    'EE': { w: 48, h: 22, label: 'EE', hint: 'Teeth close, lips spread', color: '#60a5fa' },
    'EH': { w: 52, h: 30, label: 'EH', hint: 'Jaw slightly dropped', color: '#60a5fa' },
    'AH': { w: 56, h: 52, label: 'AH', hint: 'Wide open, jaw down', color: '#a78bfa' },
    'OH': { w: 46, h: 46, label: 'OH', hint: 'Rounded lips forward', color: '#a78bfa' },
    'OO': { w: 34, h: 38, label: 'OO', hint: 'Lips forward & pursed', color: '#ec4899' },
    'UH': { w: 42, h: 36, label: 'UH', hint: 'Neutral, relaxed jaw', color: '#f59e0b' },
    'IH': { w: 44, h: 26, label: 'IH', hint: 'Between EE and EH', color: '#60a5fa' },
    'NG': { w: 38, h: 20, label: 'NG', hint: 'Tongue to soft palate', color: '#34d399' },
  };
  const key = syllable?.split('→')[0].toUpperCase() ?? '';
  const def = vowelDefs[key] ?? { w: 44, h: 36, label: syllable ?? '—', hint: 'Shape your mouth', color: '#a78bfa' };

  const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.03;
  return (
    <div style={{ width: '100%', height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, background: '#141515', borderRadius: 14, border: '1px solid #252626' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: def.w * pulse, height: def.h * pulse,
          borderRadius: '50%', border: `3px solid ${def.color}`,
          background: `${def.color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 150ms ease',
          boxShadow: `0 0 20px ${def.color}30`,
        }}>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 800, color: def.color }}>{def.label}</span>
        </div>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#767575', textAlign: 'center' }}>mouth shape</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 120 }}>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: def.color }}>"{def.label}"</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#acabaa', lineHeight: 1.4 }}>{def.hint}</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575', lineHeight: 1.4 }}>Feel vibration in your face</span>
      </div>
    </div>
  );
}

function WaveVisual({ progress, color }: { progress: number; color: string }) {
  const pts = Array.from({ length: 40 }, (_, i) => {
    const x = (i / 39) * 100;
    const y = 32 + Math.sin((i * 0.6) + (progress * Math.PI * 8)) * 15 * (0.3 + Math.sin(progress * Math.PI) * 0.7);
    return `${x},${y}`;
  }).join(' ');
  return (
    <div style={{ width: '100%', height: 72, borderRadius: 14, background: '#141515', border: '1px solid #252626', overflow: 'hidden', position: 'relative' }}>
      <svg viewBox="0 0 100 64" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" opacity="0.7" />
      </svg>
      <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#484848' }}>loose floppy lips · steady airflow</span>
      </div>
    </div>
  );
}

function SireneVisual({ progress }: { progress: number }) {
  const y = 52 - Math.sin(progress * Math.PI) * 40;
  const path = Array.from({ length: 50 }, (_, i) => {
    const px = (i / 49) * 100;
    const py = 52 - Math.sin((i / 49) * Math.PI) * 40;
    return i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`;
  }).join(' ');
  return (
    <div style={{ width: '100%', height: 72, borderRadius: 14, background: '#141515', border: '1px solid #252626', overflow: 'hidden', position: 'relative' }}>
      <svg viewBox="0 0 100 64" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <path d={path} fill="none" stroke="#f59e0b44" strokeWidth="1.5" />
        <circle cx={progress * 100} cy={y} r="5" fill="#f59e0b" opacity="0.9" />
        <circle cx={progress * 100} cy={y} r="9" fill="#f59e0b" opacity="0.2" />
      </svg>
      <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#484848' }}>glide smoothly · no breaks or jumps</span>
      </div>
    </div>
  );
}

function IntervalJumpVisual({ targetNote, exerciseColor }: { targetNote?: string; exerciseColor: string }) {
  return (
    <div style={{ width: '100%', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#141515', borderRadius: 14, border: '1px solid #252626' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#767575', textTransform: 'uppercase' }}>Target</span>
        <div style={{ padding: '8px 18px', borderRadius: 10, background: `${exerciseColor}18`, border: `1px solid ${exerciseColor}44` }}>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: exerciseColor }}>{targetNote ?? '—'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575' }}>Hear it first</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575' }}>Then sing it</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575' }}>Aim clean</span>
      </div>
    </div>
  );
}

function DynamicBarVisual({ progress }: { progress: number }) {
  const intensity = Math.sin(progress * Math.PI);
  return (
    <div style={{ width: '100%', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, background: '#141515', borderRadius: 14, border: '1px solid #252626', padding: '0 12px', position: 'relative' }}>
      {Array.from({ length: 20 }, (_, i) => {
        const d = Math.abs(i - 9.5) / 9.5;
        const h = Math.max(8, (1 - d * 0.5) * intensity * 56);
        return <div key={i} style={{ flex: 1, height: h, borderRadius: 2, background: '#a78bfa', opacity: 0.3 + intensity * 0.6, transition: 'height 80ms ease' }} />;
      })}
      <div style={{ position: 'absolute', bottom: 5, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#484848' }}>breath pressure controls volume</span>
      </div>
    </div>
  );
}

function IllustrationForStep({ step, progress, exerciseColor }: { step: ExerciseStep; progress: number; exerciseColor: string }) {
  const syllable = step.syllable?.toLowerCase() ?? '';
  const instruction = step.instruction.toLowerCase();
  switch (step.visualType) {
    case 'breathBar':
      return <BreathingBodyIllustration progress={progress} color={exerciseColor} phase={step.instruction} />;
    case 'sustainHold':
      return <SustainBodyIllustration progress={progress} color={exerciseColor} />;
    case 'vowelShape':
      return <MouthShapeIllustration progress={progress} color={exerciseColor} vowel={step.syllable ?? 'AH'} />;
    case 'trillWave':
      return <LipTrillIllustration progress={progress} color={exerciseColor} />;
    case 'sirene':
      return <SireneSlideIllustration progress={progress} color={exerciseColor} />;
    case 'dynamicBar':
      if (instruction.includes('pant') || syllable.includes('huh'))
        return <StaccatoIllustration progress={progress} color={exerciseColor} />;
      return <SingingFaceIllustration progress={progress} color={exerciseColor} note={step.targetNote} />;
    case 'pitchLadder':
    case 'intervalJump':
      if (syllable.includes('mmm') || syllable.includes('hum'))
        return <HummingFaceIllustration progress={progress} color={exerciseColor} />;
      if (syllable.includes('ha '))
        return <StaccatoIllustration progress={progress} color={exerciseColor} />;
      return <SingingFaceIllustration progress={progress} color={exerciseColor} note={step.targetNote} />;
    default:
      return <SingingFaceIllustration progress={progress} color={exerciseColor} note={step.targetNote} />;
  }
}

function StepVisual({ step, progress, detectorState, exerciseColor }: { step: ExerciseStep; progress: number; detectorState?: DetectorState; exerciseColor: string }) {
  const dataVisual = (() => {
    switch (step.visualType) {
      case 'breathBar': return <BreathBarVisual progress={progress} phase={step.instruction} />;
      case 'sustainHold': return <SustainHoldVisual progress={progress} />;
      case 'pitchLadder': return <PitchLadderVisual targetNote={step.targetNote} detectorState={detectorState} exerciseColor={exerciseColor} />;
      case 'vowelShape': return <VowelShapeVisual syllable={step.syllable} progress={progress} />;
      case 'trillWave': return <WaveVisual progress={progress} color="#60a5fa" />;
      case 'sirene': return <SireneVisual progress={progress} />;
      case 'intervalJump': return <IntervalJumpVisual targetNote={step.targetNote} exerciseColor={exerciseColor} />;
      case 'dynamicBar': return <DynamicBarVisual progress={progress} />;
      default: return null;
    }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
        <IllustrationForStep step={step} progress={progress} exerciseColor={exerciseColor} />
      </div>
      {dataVisual}
    </div>
  );
}

function StaticStepVisual({ step, exerciseColor }: { step: ExerciseStep; exerciseColor: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0' }}>
        <IllustrationForStep step={step} progress={0.5} exerciseColor={exerciseColor} />
      </div>
    </div>
  );
}

function CoachingBubble({ tips, exerciseColor }: { tips: string[]; exerciseColor: string }) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setTipIndex(i => (i + 1) % tips.length), 5000);
    return () => clearTimeout(t);
  }, [tipIndex, tips.length]);

  if (!tips.length) return null;
  return (
    <div style={{
      background: '#1a1a1a',
      border: `1px solid ${exerciseColor}33`,
      borderRadius: 12, padding: '10px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 8,
      animation: 'fadeSlideIn 300ms ease',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: exerciseColor, flexShrink: 0, marginTop: 1 }}>tips_and_updates</span>
      <div>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: exerciseColor, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 2 }}>Coaching tip</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#acabaa', lineHeight: 1.4 }}>{tips[tipIndex]}</span>
      </div>
    </div>
  );
}

function ExerciseIntro({ exercise, onStart, starting }: { exercise: Exercise; onStart: () => void; starting: boolean }) {
  const [demoPlaying, setDemoPlaying] = useState(false);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const categoryTips = CATEGORY_TECHNIQUES[exercise.category] ?? [];
  const firstStep = exercise.steps[0];

  function handleTryIt() {
    if (demoPlaying) return;
    setDemoPlaying(true);
    if (firstStep?.targetNote) playNoteForStep(firstStep);
    demoTimerRef.current = setTimeout(() => setDemoPlaying(false), 3000);
  }

  useEffect(() => () => { clearTimeout(demoTimerRef.current); stopActiveTone(); }, []);

  return (
    <div style={{ padding: '16px 20px 32px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${exercise.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: exercise.color, fontVariationSettings: "'FILL' 1" }}>{exercise.icon}</span>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: exercise.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{exercise.level}</span>
            <span style={{ color: '#333', fontSize: 9 }}>·</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#767575' }}>{exercise.durationMin}</span>
            <span style={{ color: '#333', fontSize: 9 }}>·</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#767575' }}>{exercise.steps.length} steps</span>
          </div>
          <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, color: '#e7e5e4', margin: 0, letterSpacing: '-0.02em' }}>{exercise.name}</h2>
        </div>
      </div>

      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', margin: '0 0 20px', lineHeight: 1.6 }}>{exercise.description}</p>

      {/* Demo preview */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#767575', textTransform: 'uppercase', letterSpacing: '0.08em' }}>What it looks like</span>
          {firstStep?.targetNote && (
            <button onClick={handleTryIt} disabled={demoPlaying} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: demoPlaying ? `${exercise.color}18` : 'none',
              border: `1px solid ${exercise.color}44`,
              borderRadius: 20, padding: '4px 10px', cursor: demoPlaying ? 'default' : 'pointer',
              color: exercise.color, fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{demoPlaying ? 'volume_up' : 'play_circle'}</span>
              {demoPlaying ? 'Listen…' : 'Hear the note'}
            </button>
          )}
        </div>
        <StaticStepVisual step={firstStep} exerciseColor={exercise.color} />
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#767575', margin: '6px 0 0', textAlign: 'center', fontStyle: 'italic' }}>
          "{firstStep?.instruction}"
        </p>
      </div>

      {/* Technique tips */}
      {categoryTips.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#767575', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Technique tips</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {categoryTips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${exercise.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: exercise.color }}>{i + 1}</span>
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#acabaa', lineHeight: 1.5 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps overview */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#767575', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Step-by-step</span>
        <div style={{ background: '#1f2020', borderRadius: 14, overflow: 'hidden' }}>
          {exercise.steps.slice(0, 6).map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
              borderBottom: i < Math.min(5, exercise.steps.length - 1) ? '1px solid #252626' : 'none',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: i === 0 ? `${exercise.color}22` : '#252626',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: i === 0 ? exercise.color : '#767575' }}>{i + 1}</span>
              </div>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#acabaa', flex: 1 }}>{s.instruction}</span>
              <div style={{ display: 'flex', align: 'center', gap: 4, flexShrink: 0 }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#484848' }}>{s.durationSec}s</span>
                {s.listenForPitch && <span className="material-symbols-outlined" style={{ fontSize: 11, color: '#007aff' }}>mic</span>}
              </div>
            </div>
          ))}
          {exercise.steps.length > 6 && (
            <div style={{ padding: '8px 14px', textAlign: 'center' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#484848' }}>+ {exercise.steps.length - 6} more steps</span>
            </div>
          )}
        </div>
      </div>

      {exercise.steps.some(s => s.listenForPitch) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: '#007aff0d', border: '1px solid #007aff22', marginBottom: 20 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#007aff' }}>mic</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#007aff', lineHeight: 1.4 }}>Your microphone will listen and score your pitch accuracy in real time</span>
        </div>
      )}

      <button onClick={onStart} disabled={starting} style={{
        width: '100%', padding: '16px', borderRadius: 14,
        background: starting ? `${exercise.color}66` : `linear-gradient(135deg, ${exercise.color}, ${exercise.color}cc)`,
        border: 'none', cursor: starting ? 'wait' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: `0 8px 32px ${exercise.color}40`,
        transition: 'all 150ms ease',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#fff', fontVariationSettings: "'FILL' 1" }}>{starting ? 'mic' : 'play_arrow'}</span>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: '#fff' }}>{starting ? 'Requesting mic…' : 'Begin Exercise'}</span>
      </button>
    </div>
  );
}

function ExerciseRunner({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'running' | 'complete'>('intro');
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [starting, setStarting] = useState(false);
  const [detectorState, setDetectorState] = useState<DetectorState>({ listening: false, currentPitch: null, accuracy: 0, centsOff: 0, status: 'silent' });
  const [stepScores, setStepScores] = useState<StepScore[]>([]);
  const [showCoaching, setShowCoaching] = useState(false);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const tonePlayedRef = useRef(false);
  const detectorRef = useRef<PracticeDetector | null>(null);
  const mountedRef = useRef(true);
  const poorAccuracyStartRef = useRef<number | null>(null);
  const hasPitchSteps = exercise.steps.some(s => s.listenForPitch);

  const step = exercise.steps[currentStep];
  const totalSteps = exercise.steps.length;

  const tick = useCallback(() => {
    if (!step) return;
    const elapsed = (Date.now() - startRef.current) / 1000;
    const p = Math.min(1, elapsed / step.durationSec);
    setProgress(p);

    if (p >= 1) {
      const detector = detectorRef.current;
      if (detector && step.listenForPitch) {
        const score = detector.getStepScore();
        setStepScores(prev => { const n = [...prev]; n[currentStep] = score; return n; });
        detector.resetStepScore();
      } else {
        setStepScores(prev => { const n = [...prev]; n[currentStep] = { avgCentsOff: 0, accuracy: 0, samplesDetected: 0, totalSamples: 0 }; return n; });
      }
      setShowCoaching(false);
      poorAccuracyStartRef.current = null;
      if (currentStep < totalSteps - 1) {
        setCurrentStep(prev => prev + 1);
        startRef.current = Date.now();
        tonePlayedRef.current = false;
      } else {
        setPhase('complete');
        detectorRef.current?.stop();
      }
    }
    if (p < 1) rafRef.current = requestAnimationFrame(tick);
  }, [step, currentStep, totalSteps]);

  useEffect(() => {
    if (phase !== 'running') return;
    startRef.current = Date.now();
    tonePlayedRef.current = false;
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, currentStep, tick]);

  useEffect(() => {
    if (phase === 'running' && step?.targetNote && !tonePlayedRef.current) {
      tonePlayedRef.current = true;
      playNoteForStep(step);
      if (step.listenForPitch) detectorRef.current?.setTarget(step.targetNote);
    }
    if (phase === 'running' && step && !step.listenForPitch) {
      detectorRef.current?.setTarget(undefined);
    }
  }, [phase, currentStep, step]);

  useEffect(() => {
    if (phase !== 'running' || !step?.listenForPitch) return;
    if (detectorState.status !== 'silent' && detectorState.status !== 'good') {
      if (poorAccuracyStartRef.current === null) poorAccuracyStartRef.current = Date.now();
      else if (Date.now() - poorAccuracyStartRef.current > 3000) setShowCoaching(true);
    } else {
      poorAccuracyStartRef.current = null;
      if (detectorState.status === 'good') setShowCoaching(false);
    }
  }, [detectorState, phase, step]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stopActiveTone(); detectorRef.current?.stop(); };
  }, []);

  const handleStart = async () => {
    if (starting || phase === 'running') return;
    setStarting(true);
    setPhase('intro');
    setCurrentStep(0);
    setProgress(0);
    setStepScores([]);
    setShowCoaching(false);
    poorAccuracyStartRef.current = null;
    detectorRef.current?.stop();
    if (hasPitchSteps) {
      const det = new PracticeDetector();
      detectorRef.current = det;
      await det.start(setDetectorState);
      if (!mountedRef.current) { det.stop(); return; }
    }
    setStarting(false);
    setPhase('running');
  };

  const timeLeft = step ? Math.max(0, Math.ceil(step.durationSec * (1 - progress))) : 0;
  const coachingTips = VISUAL_COACHING[step?.visualType ?? ''] ?? [];

  if (phase === 'intro') {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => { detectorRef.current?.stop(); stopActiveTone(); onClose(); }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13, padding: 0,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span> Back
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ExerciseIntro exercise={exercise} onStart={handleStart} starting={starting} />
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    return (
      <div style={{ padding: '16px 20px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <button onClick={() => { detectorRef.current?.stop(); stopActiveTone(); onClose(); }} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13, marginBottom: 16, padding: 0,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span> Back
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: exercise.color, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 24, color: '#e7e5e4', margin: 0 }}>Complete!</h3>
          {hasPitchSteps && <ScoreDisplay scores={stepScores} exerciseColor={exercise.color} />}
          {!hasPitchSteps && (
            <div style={{ background: '#1f2020', borderRadius: 14, padding: '16px 20px', textAlign: 'center', maxWidth: 280 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', lineHeight: 1.6 }}>
                Great work. Consistent practice builds lasting vocal strength. Come back tomorrow to keep the momentum!
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleStart} style={{
              padding: '12px 24px', borderRadius: 9999, background: '#1f2020', border: 'none',
              color: '#e7e5e4', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>Repeat</button>
            <button onClick={() => { detectorRef.current?.stop(); onClose(); }} style={{
              padding: '12px 24px', borderRadius: 9999,
              background: `linear-gradient(135deg, ${exercise.color}, ${exercise.color}cc)`,
              border: 'none', color: '#fff', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              boxShadow: `0 4px 16px ${exercise.color}40`,
            }}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      <button onClick={() => { detectorRef.current?.stop(); stopActiveTone(); setPhase('intro'); }} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
        color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13, marginBottom: 16, padding: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span> Back to overview
      </button>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: '#e7e5e4' }}>{exercise.name}</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575' }}>Step {currentStep + 1} of {totalSteps}</span>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {exercise.steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i < currentStep ? exercise.color : i === currentStep ? `${exercise.color}80` : '#252626',
              transition: 'background 200ms ease',
            }} />
          ))}
        </div>
      </div>

      {step && (
        <div style={{ background: '#1f2020', borderRadius: 18, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {step.listenForPitch && <AccuracyRing state={detectorState} size={42} />}
              <div>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: '#e7e5e4', margin: 0, lineHeight: 1.4 }}>{step.instruction}</p>
                {step.syllable && (
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: exercise.color }}>"{step.syllable}"</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 800, color: exercise.color, fontVariantNumeric: 'tabular-nums' }}>{timeLeft}s</span>
              {step.targetNote && (
                <button onClick={() => playNoteForStep(step)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#767575' }}>volume_up</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575' }}>{step.targetNote}</span>
                </button>
              )}
            </div>
          </div>

          <StepVisual step={step} progress={progress} detectorState={step.listenForPitch ? detectorState : undefined} exerciseColor={exercise.color} />

          <div style={{ width: '100%', height: 4, borderRadius: 2, background: '#252626', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress * 100}%`, background: exercise.color, borderRadius: 2, transition: 'width 100ms linear' }} />
          </div>
        </div>
      )}

      {showCoaching && coachingTips.length > 0 && (
        <div style={{ marginTop: 12, animation: 'fadeSlideIn 300ms ease' }}>
          <CoachingBubble tips={coachingTips} exerciseColor={exercise.color} />
        </div>
      )}

      {!showCoaching && step && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: '#1a1a1a', borderRadius: 12, border: '1px solid #252626' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#767575', lineHeight: 1.5 }}>
            {step.listenForPitch
              ? 'Sing along — the mic is listening and checking your pitch automatically'
              : 'Follow the visual guide and the instructions above'}
          </span>
        </div>
      )}
    </div>
  );
}

function PitchGraphic() {
  const heights = [20, 40, 60, 75, 90, 75, 50, 30, 15, 55, 100, 65, 45];
  return (
    <div style={{ height: 48, width: '100%', background: '#0e0e0e', borderRadius: 10, padding: '6px 10px', display: 'flex', alignItems: 'flex-end', gap: 3, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,122,255,0.05), rgba(0,122,255,0.15))', opacity: 0.4 }} />
      {heights.map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 999, background: `rgba(0,122,255,${0.2 + (h / 100) * 0.6})` }} />)}
    </div>
  );
}

export default function PracticePanel() {
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  if (activeExercise) {
    return <ExerciseRunner exercise={activeExercise} onClose={() => setActiveExercise(null)} />;
  }

  const recommended = EXERCISES.find(e => e.id === 'major-scale')!;
  const exercisesByCategory = CATEGORIES.map(cat => ({
    ...cat,
    exercises: EXERCISES.filter(e => e.category === cat.id),
  }));

  return (
    <div style={{ padding: '20px 20px 40px', minHeight: '100%' }}>
      <section style={{ marginBottom: 28 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#007aff', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Personalized Training</span>
        <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 34, letterSpacing: '-0.03em', color: '#e7e5e4', margin: '0 0 8px', lineHeight: 1 }}>Practice</h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', margin: 0, lineHeight: 1.5, maxWidth: 320 }}>
          {EXERCISES.length} exercises across {CATEGORIES.length} categories. Each exercise starts with a guided walkthrough.
        </p>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div onClick={() => setActiveExercise(recommended)} style={{ background: '#1f2020', borderRadius: 18, padding: 20, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', right: -40, bottom: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(0,122,255,0.04)', filter: 'blur(60px)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span style={{ display: 'inline-block', background: 'rgba(0,122,255,0.1)', color: '#007aff', fontSize: 9, fontWeight: 700, fontFamily: 'Inter, sans-serif', padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Recommended</span>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, color: '#e7e5e4', margin: '0 0 6px' }}>{recommended.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>{recommended.durationMin}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>bar_chart</span>{recommended.level}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>Guided walkthrough
                  </span>
                </div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #007aff, #0066d6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,122,255,0.25)', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#fff', fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </div>
            </div>
            <PitchGraphic />
          </div>
        </div>
      </section>

      {exercisesByCategory.map(cat => (
        <section key={cat.id} style={{ marginBottom: 16 }}>
          <button
            onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: cat.color }}>{cat.icon}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: '#e7e5e4', margin: 0 }}>{cat.name}</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575', margin: '1px 0 0' }}>{cat.exercises.length} exercises · guided walkthrough</p>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#484848', transition: 'transform 200ms ease', transform: expandedCat === cat.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
          </button>

          {expandedCat === cat.id && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
              {cat.exercises.map(ex => (
                <div
                  key={ex.id}
                  onClick={() => setActiveExercise(ex)}
                  style={{ background: '#191a1a', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(72,72,72,0.08)', cursor: 'pointer' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#acabaa' }}>{ex.icon}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, color: '#e7e5e4', margin: 0 }}>{ex.name}</p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600, color: '#767575', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ex.subtitle}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575', fontWeight: 600 }}>{ex.durationMin}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: ex.color, textTransform: 'uppercase' }}>{ex.level}</span>
                      {ex.steps.some(s => s.listenForPitch) && <span className="material-symbols-outlined" style={{ fontSize: 10, color: '#007aff' }}>mic</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

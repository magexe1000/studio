import { useState, useRef, useEffect, useCallback } from 'react';

type ExerciseId = string;

interface ExerciseStep {
  instruction: string;
  durationSec: number;
  targetNote?: string;
  syllable?: string;
  visualType: 'breathBar' | 'pitchLadder' | 'sustainHold' | 'vowelShape' | 'trillWave' | 'sirene';
}

interface Exercise {
  id: ExerciseId;
  name: string;
  subtitle: string;
  icon: string;
  durationMin: string;
  level: string;
  color: string;
  description: string;
  steps: ExerciseStep[];
}

const EXERCISES: Exercise[] = [
  {
    id: 'diaphragm-breath',
    name: 'Diaphragmatic Breathing',
    subtitle: 'Foundation & Support',
    icon: 'air',
    durationMin: '4:00',
    level: 'Beginner',
    color: '#34d399',
    description: 'Build breath support with timed inhale-hold-exhale cycles. Focus on expanding your belly, not your chest.',
    steps: [
      { instruction: 'Breathe in slowly through your nose (belly expands)', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Hold your breath gently', durationSec: 4, visualType: 'sustainHold' },
      { instruction: 'Exhale slowly on "sss" (controlled hiss)', durationSec: 8, syllable: 'sss', visualType: 'breathBar' },
      { instruction: 'Breathe in again, deeper this time', durationSec: 4, visualType: 'breathBar' },
      { instruction: 'Hold', durationSec: 4, visualType: 'sustainHold' },
      { instruction: 'Exhale on "zzz" (feel the buzz)', durationSec: 8, syllable: 'zzz', visualType: 'breathBar' },
    ],
  },
  {
    id: 'lip-trills',
    name: 'Lip Trills',
    subtitle: 'Tension Release',
    icon: 'waves',
    durationMin: '3:00',
    level: 'Beginner',
    color: '#60a5fa',
    description: 'Relax your lips and blow air to create a "brrr" vibration. Slide up and down gently — this releases jaw and throat tension.',
    steps: [
      { instruction: 'Lip trill on a comfortable low note', durationSec: 6, targetNote: 'C3', syllable: 'brrr', visualType: 'trillWave' },
      { instruction: 'Trill sliding up a 5th', durationSec: 6, targetNote: 'C3→G3', syllable: 'brrr↑', visualType: 'sirene' },
      { instruction: 'Trill sliding back down', durationSec: 6, targetNote: 'G3→C3', syllable: 'brrr↓', visualType: 'sirene' },
      { instruction: 'Trill up an octave slowly', durationSec: 8, targetNote: 'C3→C4', syllable: 'brrr↑↑', visualType: 'sirene' },
      { instruction: 'Trill back down the octave', durationSec: 8, targetNote: 'C4→C3', syllable: 'brrr↓↓', visualType: 'sirene' },
    ],
  },
  {
    id: 'major-scale',
    name: 'Major Scale Warm-up',
    subtitle: 'Pitch Accuracy',
    icon: 'music_note',
    durationMin: '5:00',
    level: 'Intermediate',
    color: '#007aff',
    description: 'Sing each note of the major scale on "la". Match each pitch precisely, using the visual guide to stay centered.',
    steps: [
      { instruction: 'Sing Do (root)', durationSec: 4, targetNote: 'C4', syllable: 'la', visualType: 'pitchLadder' },
      { instruction: 'Sing Re', durationSec: 4, targetNote: 'D4', syllable: 'la', visualType: 'pitchLadder' },
      { instruction: 'Sing Mi', durationSec: 4, targetNote: 'E4', syllable: 'la', visualType: 'pitchLadder' },
      { instruction: 'Sing Fa', durationSec: 4, targetNote: 'F4', syllable: 'la', visualType: 'pitchLadder' },
      { instruction: 'Sing Sol', durationSec: 4, targetNote: 'G4', syllable: 'la', visualType: 'pitchLadder' },
      { instruction: 'Sing La', durationSec: 4, targetNote: 'A4', syllable: 'la', visualType: 'pitchLadder' },
      { instruction: 'Sing Ti', durationSec: 4, targetNote: 'B4', syllable: 'la', visualType: 'pitchLadder' },
      { instruction: 'Sing Do (octave)', durationSec: 4, targetNote: 'C5', syllable: 'la', visualType: 'pitchLadder' },
    ],
  },
  {
    id: 'vowel-placement',
    name: 'Vowel Resonance',
    subtitle: 'Placement & Clarity',
    icon: 'record_voice_over',
    durationMin: '4:00',
    level: 'Beginner',
    color: '#a78bfa',
    description: 'Sustain each pure vowel on a comfortable pitch. Feel where each vowel resonates — front, middle, or back of your mouth.',
    steps: [
      { instruction: 'Sustain "EE" — feel it in your mask/forehead', durationSec: 6, syllable: 'EE', targetNote: 'A3', visualType: 'vowelShape' },
      { instruction: 'Sustain "EH" — slightly more open', durationSec: 6, syllable: 'EH', targetNote: 'A3', visualType: 'vowelShape' },
      { instruction: 'Sustain "AH" — wide open, resonant', durationSec: 6, syllable: 'AH', targetNote: 'A3', visualType: 'vowelShape' },
      { instruction: 'Sustain "OH" — round your lips', durationSec: 6, syllable: 'OH', targetNote: 'A3', visualType: 'vowelShape' },
      { instruction: 'Sustain "OO" — small opening, feel the chest', durationSec: 6, syllable: 'OO', targetNote: 'A3', visualType: 'vowelShape' },
    ],
  },
  {
    id: 'sirene-slides',
    name: 'Sirene Slides',
    subtitle: 'Range & Registers',
    icon: 'trending_up',
    durationMin: '3:00',
    level: 'Intermediate',
    color: '#f59e0b',
    description: 'Glide smoothly from your lowest to highest comfortable note on "oo". This connects your chest and head voice seamlessly.',
    steps: [
      { instruction: 'Gentle slide from low to mid range', durationSec: 8, syllable: 'oo↑', targetNote: 'low→mid', visualType: 'sirene' },
      { instruction: 'Continue from mid to high', durationSec: 8, syllable: 'oo↑↑', targetNote: 'mid→high', visualType: 'sirene' },
      { instruction: 'Slide from high all the way down', durationSec: 10, syllable: 'oo↓↓', targetNote: 'high→low', visualType: 'sirene' },
      { instruction: 'Full range sirene — bottom to top', durationSec: 12, syllable: 'oo↑↓', targetNote: 'low→high→low', visualType: 'sirene' },
    ],
  },
  {
    id: 'staccato-control',
    name: 'Staccato Agility',
    subtitle: 'Precision & Speed',
    icon: 'electric_bolt',
    durationMin: '3:00',
    level: 'Advanced',
    color: '#ef4444',
    description: 'Short, sharp notes on "ha" — one per beat. This trains diaphragm control and vocal cord closure for clean onsets.',
    steps: [
      { instruction: 'Staccato on C4 — short "ha" bursts', durationSec: 8, syllable: 'ha ha ha ha', targetNote: 'C4', visualType: 'pitchLadder' },
      { instruction: 'Move up to E4', durationSec: 8, syllable: 'ha ha ha ha', targetNote: 'E4', visualType: 'pitchLadder' },
      { instruction: 'Move up to G4', durationSec: 8, syllable: 'ha ha ha ha', targetNote: 'G4', visualType: 'pitchLadder' },
      { instruction: 'Descend: G4, E4, C4 pattern', durationSec: 8, syllable: 'ha ha ha', targetNote: 'G4→E4→C4', visualType: 'pitchLadder' },
    ],
  },
];

const NOTE_FREQ: Record<string, number> = {
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00,
  'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00,
  'A4': 440.00, 'B4': 493.88, 'C5': 523.25,
};

let sharedToneCtx: AudioContext | null = null;
let activeOsc: OscillatorNode | null = null;
let activeGain: GainNode | null = null;

function stopActiveTone() {
  try {
    if (activeOsc) { activeOsc.stop(); activeOsc.disconnect(); }
    if (activeGain) activeGain.disconnect();
  } catch { /* already stopped */ }
  activeOsc = null;
  activeGain = null;
}

function cleanupToneCtx() {
  stopActiveTone();
  if (sharedToneCtx) { sharedToneCtx.close().catch(() => {}); sharedToneCtx = null; }
}

function playTone(freq: number, durationMs: number, type: OscillatorType = 'sine') {
  try {
    stopActiveTone();
    if (!sharedToneCtx || sharedToneCtx.state === 'closed') {
      sharedToneCtx = new AudioContext();
    }
    const ctx = sharedToneCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + (durationMs / 1000) - 0.1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + (durationMs / 1000));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    activeOsc = osc;
    activeGain = gain;
    osc.onended = () => { activeOsc = null; activeGain = null; };
  } catch { /* audio not available */ }
}

function BreathBarVisual({ progress, phase }: { progress: number; phase: string }) {
  const isInhale = phase.toLowerCase().includes('breathe in') || phase.toLowerCase().includes('inhale');
  const fillHeight = isInhale ? progress * 100 : (1 - progress) * 100;
  return (
    <div style={{
      width: '100%', height: 80, borderRadius: 12,
      background: '#191a1a', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: `${Math.max(4, fillHeight)}%`,
        background: 'linear-gradient(to top, rgba(52,211,153,0.4), rgba(52,211,153,0.1))',
        borderRadius: '0 0 12px 12px',
        transition: 'height 200ms ease',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700,
        color: '#34d399', opacity: 0.8,
      }}>
        {isInhale ? '↑ IN' : phase.toLowerCase().includes('hold') ? '· HOLD' : '↓ OUT'}
      </div>
    </div>
  );
}

function SustainHoldVisual({ progress }: { progress: number }) {
  const ringProgress = progress * 283;
  return (
    <div style={{ width: '100%', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" width={64} height={64}>
        <circle cx="50" cy="50" r="45" fill="none" stroke="#252626" strokeWidth="4" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#34d399" strokeWidth="4"
          strokeDasharray="283" strokeDashoffset={283 - ringProgress}
          strokeLinecap="round" transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 200ms ease' }}
        />
        <text x="50" y="54" textAnchor="middle" fill="#e7e5e4" fontSize="14" fontWeight="700" fontFamily="Manrope">
          HOLD
        </text>
      </svg>
    </div>
  );
}

function PitchLadderVisual({ targetNote, allNotes }: { targetNote?: string; allNotes: string[] }) {
  return (
    <div style={{
      width: '100%', height: 80, display: 'flex', alignItems: 'flex-end',
      gap: 3, padding: '0 4px',
    }}>
      {allNotes.map((note, i) => {
        const isActive = targetNote?.includes(note);
        const h = 20 + ((i / (allNotes.length - 1)) * 60);
        return (
          <div key={note} style={{
            flex: 1, height: `${h}%`, borderRadius: 4,
            background: isActive ? '#007aff' : '#252626',
            opacity: isActive ? 1 : 0.4,
            transition: 'background 200ms ease, opacity 200ms ease',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2,
          }}>
            <span style={{
              fontSize: 8, fontFamily: 'Inter, sans-serif', fontWeight: 600,
              color: isActive ? '#fff' : '#767575',
            }}>{note.replace(/\d/, '')}</span>
          </div>
        );
      })}
    </div>
  );
}

function VowelShapeVisual({ syllable }: { syllable?: string }) {
  const vowelSizes: Record<string, number> = { 'EE': 20, 'EH': 30, 'AH': 48, 'OH': 38, 'OO': 22 };
  const size = vowelSizes[syllable ?? ''] ?? 30;
  return (
    <div style={{
      width: '100%', height: 80, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        width: size, height: size * 1.2, borderRadius: '50%',
        border: '3px solid #a78bfa', opacity: 0.8,
        transition: 'all 300ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 800,
          color: '#a78bfa',
        }}>{syllable}</span>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {['Mask', 'Mouth', 'Chest'].map((zone, i) => (
          <div key={zone} style={{
            height: 6, width: 48, borderRadius: 3,
            background: (syllable === 'EE' && i === 0) || (syllable === 'AH' && i === 1) || (syllable === 'OO' && i === 2) || (syllable === 'EH' && i === 0) || (syllable === 'OH' && i === 2)
              ? '#a78bfa' : '#252626',
            opacity: (syllable === 'EE' && i === 0) || (syllable === 'AH' && i === 1) || (syllable === 'OO' && i === 2) || (syllable === 'EH' && i === 0) || (syllable === 'OH' && i === 2)
              ? 0.8 : 0.3,
            transition: 'all 200ms ease',
          }}>
            <span style={{ fontSize: 7, color: '#767575', marginLeft: 52, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{zone}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrillWaveVisual({ progress }: { progress: number }) {
  const points = Array.from({ length: 40 }, (_, i) => {
    const x = (i / 39) * 100;
    const wave = Math.sin((i * 0.6) + (progress * Math.PI * 8)) * 15;
    const y = 40 + wave * (0.3 + Math.sin(progress * Math.PI) * 0.7);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ width: '100%', height: 80, borderRadius: 12, background: '#191a1a', overflow: 'hidden' }}>
      <svg viewBox="0 0 100 80" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="2" opacity="0.7" />
      </svg>
    </div>
  );
}

function SireneVisual({ progress }: { progress: number }) {
  const y = 70 - Math.sin(progress * Math.PI) * 55;
  const trailPoints = Array.from({ length: 30 }, (_, i) => {
    const t = Math.max(0, progress - (30 - i) * 0.01);
    const px = (i / 29) * 100;
    const py = 70 - Math.sin(t * Math.PI) * 55;
    return `${px},${py}`;
  }).join(' ');

  return (
    <div style={{ width: '100%', height: 80, borderRadius: 12, background: '#191a1a', overflow: 'hidden' }}>
      <svg viewBox="0 0 100 80" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <polyline points={trailPoints} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.3" />
        <circle cx={progress * 100} cy={y} r="4" fill="#f59e0b" opacity="0.9" />
      </svg>
    </div>
  );
}

function StepVisual({ step, progress }: { step: ExerciseStep; progress: number }) {
  switch (step.visualType) {
    case 'breathBar': return <BreathBarVisual progress={progress} phase={step.instruction} />;
    case 'sustainHold': return <SustainHoldVisual progress={progress} />;
    case 'pitchLadder': {
      const scaleNotes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
      return <PitchLadderVisual targetNote={step.targetNote} allNotes={scaleNotes} />;
    }
    case 'vowelShape': return <VowelShapeVisual syllable={step.syllable} />;
    case 'trillWave': return <TrillWaveVisual progress={progress} />;
    case 'sirene': return <SireneVisual progress={progress} />;
    default: return null;
  }
}

function ExerciseRunner({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const tonePlayedRef = useRef(false);

  const step = exercise.steps[currentStep];
  const totalSteps = exercise.steps.length;

  const tick = useCallback(() => {
    if (!step) return;
    const elapsed = (Date.now() - startRef.current) / 1000;
    const p = Math.min(1, elapsed / step.durationSec);
    setProgress(p);
    if (p >= 1) {
      if (currentStep < totalSteps - 1) {
        setCurrentStep(prev => prev + 1);
        startRef.current = Date.now();
        tonePlayedRef.current = false;
      } else {
        setRunning(false);
        setComplete(true);
      }
    }
    if (p < 1) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [step, currentStep, totalSteps]);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    tonePlayedRef.current = false;
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, currentStep, tick]);

  useEffect(() => {
    if (running && step?.targetNote && !tonePlayedRef.current) {
      tonePlayedRef.current = true;
      const note = step.targetNote.split('→')[0].split(',')[0].trim();
      const freq = NOTE_FREQ[note];
      if (freq) playTone(freq, Math.min(2000, step.durationSec * 600));
    }
  }, [running, currentStep, step]);

  useEffect(() => {
    return () => { stopActiveTone(); };
  }, []);

  const handleStart = () => {
    setRunning(true);
    setComplete(false);
    setCurrentStep(0);
    setProgress(0);
  };

  const timeLeft = step ? Math.max(0, Math.ceil(step.durationSec * (1 - progress))) : 0;

  return (
    <div style={{
      padding: '16px 20px', minHeight: '100%',
      display: 'flex', flexDirection: 'column',
    }}>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
        color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13,
        marginBottom: 20, padding: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
        Back
      </button>

      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: `${exercise.color}1a`, padding: '4px 10px', borderRadius: 6,
          marginBottom: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: exercise.color }}>{exercise.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: exercise.color, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{exercise.level}</span>
        </div>
        <h2 style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 28,
          color: '#e7e5e4', margin: '0 0 6px', letterSpacing: '-0.02em',
        }}>{exercise.name}</h2>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa',
          margin: 0, lineHeight: 1.5,
        }}>{exercise.description}</p>
      </div>

      {complete ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: `${exercise.color}1a`, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 36, color: exercise.color,
              fontVariationSettings: "'FILL' 1",
            }}>check_circle</span>
          </div>
          <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22, color: '#e7e5e4', margin: 0 }}>Complete!</h3>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', textAlign: 'center', maxWidth: 260 }}>
            Great work. Consistent practice builds lasting vocal strength.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleStart} style={{
              padding: '10px 20px', borderRadius: 9999, background: '#1f2020',
              border: 'none', color: '#e7e5e4', fontFamily: 'Manrope, sans-serif',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>Repeat</button>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: 9999, background: exercise.color,
              border: 'none', color: '#fff', fontFamily: 'Manrope, sans-serif',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>Done</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            display: 'flex', gap: 3, marginBottom: 4,
          }}>
            {exercise.steps.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i < currentStep ? exercise.color : i === currentStep ? `${exercise.color}80` : '#252626',
                transition: 'background 200ms ease',
              }} />
            ))}
          </div>

          {running && step && (
            <>
              <div style={{
                background: '#1f2020', borderRadius: 16, padding: 20,
                display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
                    color: '#acabaa', textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>Step {currentStep + 1} of {totalSteps}</span>
                  <span style={{
                    fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 800,
                    color: exercise.color, fontVariantNumeric: 'tabular-nums',
                  }}>{timeLeft}s</span>
                </div>

                <p style={{
                  fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16,
                  color: '#e7e5e4', margin: 0, lineHeight: 1.4,
                }}>{step.instruction}</p>

                {step.syllable && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
                      color: '#767575', textTransform: 'uppercase',
                    }}>Sing:</span>
                    <span style={{
                      fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 800,
                      color: exercise.color,
                    }}>"{step.syllable}"</span>
                  </div>
                )}

                {step.targetNote && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#767575' }}>music_note</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#acabaa' }}>{step.targetNote}</span>
                    <button onClick={() => {
                      const note = step.targetNote!.split('→')[0].split(',')[0].trim();
                      const freq = NOTE_FREQ[note];
                      if (freq) playTone(freq, 1500);
                    }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                      color: exercise.color, display: 'flex',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>volume_up</span>
                    </button>
                  </div>
                )}

                <StepVisual step={step} progress={progress} />

                <div style={{
                  width: '100%', height: 3, borderRadius: 2, background: '#252626', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${progress * 100}%`, background: exercise.color,
                    borderRadius: 2, transition: 'width 100ms linear',
                  }} />
                </div>
              </div>
            </>
          )}

          {!running && (
            <div style={{
              background: '#1f2020', borderRadius: 16, padding: 24,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            }}>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8, width: '100%',
              }}>
                {exercise.steps.slice(0, 4).map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0', borderBottom: i < 3 ? '1px solid #252626' : 'none',
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', background: '#252626',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#767575',
                      flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{
                      fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#acabaa',
                      flex: 1,
                    }}>{s.instruction}</span>
                    <span style={{
                      fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#484848',
                      flexShrink: 0,
                    }}>{s.durationSec}s</span>
                  </div>
                ))}
                {exercise.steps.length > 4 && (
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#484848', textAlign: 'center' }}>
                    +{exercise.steps.length - 4} more steps
                  </span>
                )}
              </div>

              <button onClick={handleStart} style={{
                width: 64, height: 64, borderRadius: '50%',
                background: `linear-gradient(135deg, ${exercise.color}, ${exercise.color}cc)`,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 32px ${exercise.color}40`,
              }}>
                <span className="material-symbols-outlined" style={{
                  fontSize: 32, color: '#fff',
                  fontVariationSettings: "'FILL' 1",
                }}>play_arrow</span>
              </button>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#767575' }}>
                Tap to begin
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PitchGraphic() {
  const heights = [20, 40, 60, 75, 90, 75, 50, 30, 15, 55, 100, 65, 45];
  return (
    <div style={{
      height: 64, width: '100%', background: '#0e0e0e',
      borderRadius: 12, padding: '8px 12px',
      display: 'flex', alignItems: 'flex-end', gap: 3,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, rgba(0,122,255,0.05) 0%, rgba(0,122,255,0.15) 100%)',
        opacity: 0.4,
      }} />
      {heights.map((h, i) => (
        <div key={i} style={{
          flex: 1, height: `${h}%`, borderRadius: 999,
          background: `rgba(0,122,255,${0.2 + (h / 100) * 0.6})`,
          transition: 'height 300ms ease',
        }} />
      ))}
    </div>
  );
}

export default function PracticePanel() {
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);

  const recommended = EXERCISES[2];
  const focusExercise = EXERCISES[0];
  const library = EXERCISES.filter(e => e.id !== recommended.id && e.id !== focusExercise.id);

  if (activeExercise) {
    return <ExerciseRunner exercise={activeExercise} onClose={() => setActiveExercise(null)} />;
  }

  return (
    <div style={{ padding: '20px 20px 40px', minHeight: '100%' }}>
      {/* Hero */}
      <section style={{ marginBottom: 32 }}>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
          color: '#007aff', letterSpacing: '0.14em', textTransform: 'uppercase',
          marginBottom: 6, display: 'block',
        }}>Personalized Training</span>
        <h2 style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800,
          fontSize: 36, letterSpacing: '-0.03em',
          color: '#e7e5e4', margin: '0 0 10px', lineHeight: 1,
        }}>Practice</h2>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13,
          color: '#acabaa', margin: 0, lineHeight: 1.5, maxWidth: 320,
        }}>Precision exercises to expand your range, master resonance, and refine your vocal technique.</p>
      </section>

      {/* Recommended Card */}
      <section style={{ marginBottom: 16 }}>
        <div
          onClick={() => setActiveExercise(recommended)}
          style={{
            background: '#1f2020', borderRadius: 20, padding: 24,
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
          }}
        >
          <div style={{
            position: 'absolute', right: -40, bottom: -40,
            width: 180, height: 180, borderRadius: '50%',
            background: 'rgba(0,122,255,0.04)', filter: 'blur(60px)',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <span style={{
                  display: 'inline-block', background: 'rgba(0,122,255,0.1)',
                  color: '#007aff', fontSize: 9, fontWeight: 700, fontFamily: 'Inter, sans-serif',
                  padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: 10,
                }}>Recommended</span>
                <h3 style={{
                  fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22,
                  color: '#e7e5e4', margin: '0 0 8px', letterSpacing: '-0.01em',
                }}>{recommended.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                    {recommended.durationMin}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bar_chart</span>
                    {recommended.level}
                  </span>
                </div>
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, #007aff, #0066d6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0,122,255,0.25)',
                flexShrink: 0,
              }}>
                <span className="material-symbols-outlined" style={{
                  fontSize: 24, color: '#fff',
                  fontVariationSettings: "'FILL' 1",
                }}>play_arrow</span>
              </div>
            </div>
            <PitchGraphic />
          </div>
        </div>
      </section>

      {/* Focus Card */}
      <section style={{ marginBottom: 24 }}>
        <div
          onClick={() => setActiveExercise(focusExercise)}
          style={{
            background: '#1f2020', borderRadius: 20, padding: 20,
            border: '1px solid rgba(72,72,72,0.08)', cursor: 'pointer',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: '#252626', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: focusExercise.color }}>{focusExercise.icon}</span>
          </div>
          <h3 style={{
            fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 17,
            color: '#e7e5e4', margin: '0 0 4px',
          }}>{focusExercise.name}</h3>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#acabaa',
            margin: '0 0 16px', lineHeight: 1.4,
          }}>{focusExercise.description.slice(0, 70)}…</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#767575' }}>{focusExercise.durationMin}</span>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700,
              color: focusExercise.color, display: 'flex', alignItems: 'center', gap: 2,
            }}>
              START <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
            </span>
          </div>
        </div>
      </section>

      {/* Library */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h4 style={{
            fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16,
            color: '#e7e5e4', margin: 0,
          }}>Exercise Library</h4>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {library.map(ex => (
            <div
              key={ex.id}
              onClick={() => setActiveExercise(ex)}
              style={{
                background: '#191a1a', borderRadius: 14, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                border: '1px solid rgba(72,72,72,0.08)', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: '#0e0e0e', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#acabaa' }}>{ex.icon}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14,
                  color: '#e7e5e4', margin: 0,
                }}>{ex.name}</p>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
                  color: '#767575', margin: '2px 0 0', textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>{ex.subtitle}</p>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0,
              }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#767575', fontWeight: 600 }}>{ex.durationMin}</span>
                <span style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700,
                  color: ex.color, textTransform: 'uppercase',
                }}>{ex.level}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

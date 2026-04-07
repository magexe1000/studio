import { useState, useRef, useEffect, useCallback } from 'react';
import { CATEGORIES, EXERCISES, NOTE_FREQ, type Exercise, type ExerciseStep } from './exerciseData';
import { PracticeDetector, type DetectorState, type StepScore, statusColor, centsToAccuracy } from './practiceDetector';

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

function playTone(freq: number, durationMs: number) {
  try {
    stopActiveTone();
    if (!sharedToneCtx || sharedToneCtx.state === 'closed') sharedToneCtx = new AudioContext();
    const ctx = sharedToneCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const dur = durationMs / 1000;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + dur - 0.1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
    activeOsc = osc;
    activeGain = gain;
    osc.onended = () => { activeOsc = null; activeGain = null; };
  } catch { /* audio not available */ }
}

function playNoteForStep(step: ExerciseStep) {
  if (!step.targetNote) return;
  const note = step.targetNote.split('→')[0].split(',')[0].trim();
  const freq = NOTE_FREQ[note];
  if (freq) playTone(freq, Math.min(2000, step.durationSec * 500));
}

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
  const isIn = phase.toLowerCase().includes('breathe in') || phase.toLowerCase().includes('inhale');
  const fillH = isIn ? progress * 100 : (1 - progress) * 100;
  return (
    <div style={{ width: '100%', height: 64, borderRadius: 12, background: '#191a1a', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: `${Math.max(4, fillH)}%`,
        background: 'linear-gradient(to top, rgba(52,211,153,0.4), rgba(52,211,153,0.1))',
        transition: 'height 200ms ease',
      }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: '#34d399', opacity: 0.8,
      }}>
        {isIn ? '↑ IN' : phase.toLowerCase().includes('hold') ? '· HOLD' : '↓ OUT'}
      </div>
    </div>
  );
}

function SustainHoldVisual({ progress }: { progress: number }) {
  const ringP = progress * 283;
  return (
    <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" width={56} height={56}>
        <circle cx="50" cy="50" r="45" fill="none" stroke="#252626" strokeWidth="4" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#34d399" strokeWidth="4"
          strokeDasharray="283" strokeDashoffset={283 - ringP} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 200ms ease' }} />
        <text x="50" y="54" textAnchor="middle" fill="#e7e5e4" fontSize="14" fontWeight="700" fontFamily="Manrope">HOLD</text>
      </svg>
    </div>
  );
}

function PitchLadderVisual({ targetNote, allNotes }: { targetNote?: string; allNotes: string[] }) {
  return (
    <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'flex-end', gap: 3, padding: '0 4px' }}>
      {allNotes.map((note, i) => {
        const isActive = targetNote?.includes(note);
        const h = 20 + ((i / Math.max(1, allNotes.length - 1)) * 60);
        return (
          <div key={note} style={{
            flex: 1, height: `${h}%`, borderRadius: 4,
            background: isActive ? '#007aff' : '#252626',
            opacity: isActive ? 1 : 0.4,
            transition: 'background 200ms ease, opacity 200ms ease',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2,
          }}>
            <span style={{ fontSize: 7, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: isActive ? '#fff' : '#767575' }}>
              {note.replace(/\d/, '')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VowelShapeVisual({ syllable }: { syllable?: string }) {
  const sizes: Record<string, number> = { 'EE': 18, 'EH': 26, 'AH': 40, 'OH': 34, 'OO': 20, 'UH': 28 };
  const s = sizes[syllable?.split('→')[0] ?? ''] ?? 28;
  return (
    <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: s, height: s * 1.2, borderRadius: '50%', border: '3px solid #a78bfa', opacity: 0.8,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 300ms ease',
      }}>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>
          {syllable?.split('→')[0] ?? syllable}
        </span>
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
    <div style={{ width: '100%', height: 64, borderRadius: 12, background: '#191a1a', overflow: 'hidden' }}>
      <svg viewBox="0 0 100 64" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" opacity="0.7" />
      </svg>
    </div>
  );
}

function SireneVisual({ progress }: { progress: number }) {
  const y = 56 - Math.sin(progress * Math.PI) * 44;
  return (
    <div style={{ width: '100%', height: 64, borderRadius: 12, background: '#191a1a', overflow: 'hidden' }}>
      <svg viewBox="0 0 100 64" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <circle cx={progress * 100} cy={y} r="4" fill="#f59e0b" opacity="0.9" />
      </svg>
    </div>
  );
}

function DynamicBarVisual({ progress }: { progress: number }) {
  const intensity = Math.sin(progress * Math.PI);
  return (
    <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      {Array.from({ length: 16 }, (_, i) => {
        const d = Math.abs(i - 7.5) / 7.5;
        const h = Math.max(8, (1 - d) * intensity * 56);
        return <div key={i} style={{ width: 4, height: h, borderRadius: 2, background: '#a78bfa', opacity: 0.5 + intensity * 0.5, transition: 'height 100ms ease' }} />;
      })}
    </div>
  );
}

function IntervalJumpVisual({ targetNote }: { targetNote?: string }) {
  return (
    <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        padding: '8px 20px', borderRadius: 12, background: '#007aff1a', border: '1px solid #007aff33',
      }}>
        <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 800, color: '#007aff' }}>{targetNote ?? '—'}</span>
      </div>
    </div>
  );
}

function StepVisual({ step, progress }: { step: ExerciseStep; progress: number }) {
  const scaleNotes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
  switch (step.visualType) {
    case 'breathBar': return <BreathBarVisual progress={progress} phase={step.instruction} />;
    case 'sustainHold': return <SustainHoldVisual progress={progress} />;
    case 'pitchLadder': return <PitchLadderVisual targetNote={step.targetNote} allNotes={scaleNotes} />;
    case 'vowelShape': return <VowelShapeVisual syllable={step.syllable} />;
    case 'trillWave': return <WaveVisual progress={progress} color="#60a5fa" />;
    case 'sirene': return <SireneVisual progress={progress} />;
    case 'intervalJump': return <IntervalJumpVisual targetNote={step.targetNote} />;
    case 'dynamicBar': return <DynamicBarVisual progress={progress} />;
    default: return null;
  }
}

function ExerciseRunner({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [detectorState, setDetectorState] = useState<DetectorState>({ listening: false, currentPitch: null, accuracy: 0, centsOff: 0, status: 'silent' });
  const [stepScores, setStepScores] = useState<StepScore[]>([]);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const tonePlayedRef = useRef(false);
  const detectorRef = useRef<PracticeDetector | null>(null);
  const mountedRef = useRef(true);
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
      if (currentStep < totalSteps - 1) {
        setCurrentStep(prev => prev + 1);
        startRef.current = Date.now();
        tonePlayedRef.current = false;
      } else {
        setRunning(false);
        setComplete(true);
        detectorRef.current?.stop();
      }
    }
    if (p < 1) rafRef.current = requestAnimationFrame(tick);
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
      playNoteForStep(step);
      if (step.listenForPitch) detectorRef.current?.setTarget(step.targetNote);
    }
    if (running && step && !step.listenForPitch) {
      detectorRef.current?.setTarget(undefined);
    }
  }, [running, currentStep, step]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stopActiveTone(); detectorRef.current?.stop(); };
  }, []);

  const handleStart = async () => {
    if (starting || running) return;
    setStarting(true);
    setComplete(false);
    setCurrentStep(0);
    setProgress(0);
    setStepScores([]);
    detectorRef.current?.stop();
    if (hasPitchSteps) {
      const det = new PracticeDetector();
      detectorRef.current = det;
      await det.start(setDetectorState);
      if (!mountedRef.current) { det.stop(); return; }
    }
    setStarting(false);
    setRunning(true);
  };

  const timeLeft = step ? Math.max(0, Math.ceil(step.durationSec * (1 - progress))) : 0;

  return (
    <div style={{ padding: '16px 20px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <button onClick={() => { detectorRef.current?.stop(); stopActiveTone(); onClose(); }} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4,
        color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13, marginBottom: 16, padding: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span> Back
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: `${exercise.color}1a`, padding: '4px 10px', borderRadius: 6, marginBottom: 8,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: exercise.color }}>{exercise.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: exercise.color, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{exercise.level}</span>
        </div>
        <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 24, color: '#e7e5e4', margin: '0 0 4px', letterSpacing: '-0.02em' }}>{exercise.name}</h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#acabaa', margin: 0, lineHeight: 1.5 }}>{exercise.description}</p>
      </div>

      {complete ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: exercise.color, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, color: '#e7e5e4', margin: 0 }}>Complete!</h3>
          {hasPitchSteps && <ScoreDisplay scores={stepScores} exerciseColor={exercise.color} />}
          {!hasPitchSteps && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', textAlign: 'center' }}>Great work. Consistent practice builds lasting strength.</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleStart} style={{ padding: '10px 20px', borderRadius: 9999, background: '#1f2020', border: 'none', color: '#e7e5e4', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Repeat</button>
            <button onClick={() => { detectorRef.current?.stop(); onClose(); }} style={{ padding: '10px 20px', borderRadius: 9999, background: exercise.color, border: 'none', color: '#fff', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Done</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {exercise.steps.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < currentStep ? exercise.color : i === currentStep ? `${exercise.color}80` : '#252626', transition: 'background 200ms ease' }} />
            ))}
          </div>

          {running && step && (
            <div style={{ background: '#1f2020', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, color: '#acabaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Step {currentStep + 1}/{totalSteps}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {step.listenForPitch && <AccuracyRing state={detectorState} size={40} />}
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 800, color: exercise.color, fontVariantNumeric: 'tabular-nums' }}>{timeLeft}s</span>
                </div>
              </div>

              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: '#e7e5e4', margin: 0, lineHeight: 1.4 }}>{step.instruction}</p>

              {step.syllable && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600, color: '#767575', textTransform: 'uppercase' }}>Sing:</span>
                  <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 800, color: exercise.color }}>"{step.syllable}"</span>
                </div>
              )}

              {step.targetNote && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#767575' }}>music_note</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#acabaa' }}>{step.targetNote}</span>
                  <button onClick={() => playNoteForStep(step)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: exercise.color, display: 'flex' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>volume_up</span>
                  </button>
                  {step.listenForPitch && detectorState.currentPitch && detectorState.status !== 'silent' && (
                    <span style={{
                      fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
                      color: statusColor(detectorState.status),
                      marginLeft: 'auto',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {detectorState.currentPitch.noteName}{detectorState.currentPitch.octave}
                      {detectorState.status === 'good' ? (
                        <span style={{ fontSize: 10 }}>On pitch ✓</span>
                      ) : detectorState.centsOff > 0 ? (
                        <span style={{ fontSize: 10 }}>Too high ↑</span>
                      ) : (
                        <span style={{ fontSize: 10 }}>Too low ↓</span>
                      )}
                    </span>
                  )}
                </div>
              )}

              <StepVisual step={step} progress={progress} />

              <div style={{ width: '100%', height: 3, borderRadius: 2, background: '#252626', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress * 100}%`, background: exercise.color, borderRadius: 2, transition: 'width 100ms linear' }} />
              </div>
            </div>
          )}

          {!running && (
            <div style={{ background: '#1f2020', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                {exercise.steps.slice(0, 5).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < Math.min(4, exercise.steps.length - 1) ? '1px solid #252626' : 'none' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#252626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: '#767575', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#acabaa', flex: 1 }}>{s.instruction}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#484848', flexShrink: 0 }}>{s.durationSec}s</span>
                    {s.listenForPitch && <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#007aff', flexShrink: 0 }}>mic</span>}
                  </div>
                ))}
                {exercise.steps.length > 5 && (
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#484848', textAlign: 'center' }}>+{exercise.steps.length - 5} more steps</span>
                )}
              </div>

              {hasPitchSteps && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#007aff0d', border: '1px solid #007aff22' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#007aff' }}>mic</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#007aff' }}>Mic will listen to check your pitch</span>
                </div>
              )}

              <button onClick={handleStart} disabled={starting} style={{
                width: 56, height: 56, borderRadius: '50%',
                background: `linear-gradient(135deg, ${exercise.color}, ${exercise.color}cc)`,
                border: 'none', cursor: starting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 32px ${exercise.color}40`,
                opacity: starting ? 0.5 : 1, transition: 'opacity 150ms ease',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#fff', fontVariationSettings: "'FILL' 1" }}>{starting ? 'mic' : 'play_arrow'}</span>
              </button>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#767575' }}>{starting ? 'Requesting mic access…' : 'Tap to begin'}</span>
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
      {/* Hero */}
      <section style={{ marginBottom: 28 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#007aff', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Personalized Training</span>
        <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 34, letterSpacing: '-0.03em', color: '#e7e5e4', margin: '0 0 8px', lineHeight: 1 }}>Practice</h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', margin: 0, lineHeight: 1.5, maxWidth: 320 }}>
          {EXERCISES.length} exercises across {CATEGORIES.length} categories. Real-time pitch detection checks your accuracy.
        </p>
      </section>

      {/* Recommended */}
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
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>mic</span>Pitch check
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

      {/* Category sections */}
      {exercisesByCategory.map(cat => (
        <section key={cat.id} style={{ marginBottom: 16 }}>
          <button
            onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: cat.color }}>{cat.icon}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: '#e7e5e4', margin: 0 }}>{cat.name}</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575', margin: '1px 0 0' }}>{cat.exercises.length} exercises</p>
            </div>
            <span className="material-symbols-outlined" style={{
              fontSize: 18, color: '#484848', transition: 'transform 200ms ease',
              transform: expandedCat === cat.id ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>expand_more</span>
          </button>

          {expandedCat === cat.id && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
              {cat.exercises.map(ex => (
                <div
                  key={ex.id}
                  onClick={() => setActiveExercise(ex)}
                  style={{
                    background: '#191a1a', borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    border: '1px solid rgba(72,72,72,0.08)', cursor: 'pointer',
                  }}
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

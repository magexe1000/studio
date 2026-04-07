import { useState, useRef, useEffect, useCallback } from 'react';
import { yinDetect, type PitchResult } from './pitchYin';

const HISTORY_LEN = 20;
const SMOOTHING = 0.35;

function centsToColor(cents: number): string {
  const abs = Math.abs(cents);
  if (abs <= 5) return '#22c55e';
  if (abs <= 15) return '#eab308';
  return '#ef4444';
}

function centsToLabel(cents: number): string {
  const abs = Math.abs(cents);
  if (abs <= 5) return 'IN TUNE';
  if (abs <= 15) return 'CLOSE';
  return 'OFF KEY';
}

function centsToAngle(cents: number): number {
  return Math.max(-50, Math.min(50, cents)) * 1.8;
}

interface GaugeProps {
  noteName: string;
  octave: number;
  cents: number;
  frequency: number;
  confidence: number;
  active: boolean;
}

function PitchGauge({ noteName, octave, cents, frequency, confidence, active }: GaugeProps) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = 108;
  const needleAngle = centsToAngle(cents);
  const color = active ? centsToColor(cents) : 'rgba(255,255,255,0.15)';
  const label = active ? centsToLabel(cents) : '—';

  const startAngle = -90;
  const totalArc = 180;
  const greenZone = 5 * 1.8;
  const yellowZone = 15 * 1.8;

  const arcPath = (startDeg: number, endDeg: number, radius: number) => {
    const s = (startDeg - 90) * Math.PI / 180;
    const e = (endDeg - 90) * Math.PI / 180;
    const x1 = cx + radius * Math.cos(s);
    const y1 = cy + radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e);
    const y2 = cy + radius * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div style={{ position: 'relative', width: size, height: size * 0.85 }}>
      <svg width={size} height={size * 0.85} viewBox={`0 0 ${size} ${size * 0.85}`}>
        <path d={arcPath(startAngle, startAngle + totalArc, r)}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} strokeLinecap="round" />

        <path d={arcPath(startAngle, startAngle + totalArc / 2 - yellowZone, r)}
          fill="none" stroke="rgba(239,68,68,0.25)" strokeWidth={6} strokeLinecap="round" />
        <path d={arcPath(startAngle + totalArc / 2 - yellowZone, startAngle + totalArc / 2 - greenZone, r)}
          fill="none" stroke="rgba(234,179,8,0.25)" strokeWidth={6} strokeLinecap="round" />
        <path d={arcPath(startAngle + totalArc / 2 - greenZone, startAngle + totalArc / 2 + greenZone, r)}
          fill="none" stroke="rgba(34,197,94,0.35)" strokeWidth={6} strokeLinecap="round" />
        <path d={arcPath(startAngle + totalArc / 2 + greenZone, startAngle + totalArc / 2 + yellowZone, r)}
          fill="none" stroke="rgba(234,179,8,0.25)" strokeWidth={6} strokeLinecap="round" />
        <path d={arcPath(startAngle + totalArc / 2 + yellowZone, startAngle + totalArc, r)}
          fill="none" stroke="rgba(239,68,68,0.25)" strokeWidth={6} strokeLinecap="round" />

        {[-50, -25, 0, 25, 50].map(c => {
          const a = (c * 1.8 - 90) * Math.PI / 180;
          const x1 = cx + (r - 12) * Math.cos(a);
          const y1 = cy + (r - 12) * Math.sin(a);
          const x2 = cx + (r - 6) * Math.cos(a);
          const y2 = cy + (r - 6) * Math.sin(a);
          return <line key={c} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} strokeLinecap="round" />;
        })}

        <g style={{
          transform: `rotate(${needleAngle}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: 'transform 80ms cubic-bezier(0.4,0,0.2,1)',
        }}>
          <line x1={cx} y1={cy - r + 18} x2={cx} y2={cy - r + 40}
            stroke={color} strokeWidth={3} strokeLinecap="round"
            style={{ filter: active ? `drop-shadow(0 0 6px ${color})` : 'none' }} />
          <circle cx={cx} cy={cy - r + 16} r={3} fill={color}
            style={{ filter: active ? `drop-shadow(0 0 4px ${color})` : 'none' }} />
        </g>
      </svg>

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -30%)',
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)',
          marginBottom: 4,
        }}>CURRENT NOTE</div>
        <div style={{
          fontFamily: 'Manrope, sans-serif',
          fontSize: active ? 56 : 40,
          fontWeight: 800,
          color: active ? 'var(--c-text-primary)' : 'rgba(255,255,255,0.15)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          transition: 'font-size 200ms ease, color 200ms ease',
        }}>
          {active ? `${noteName}${octave}` : '—'}
        </div>
        <div style={{
          marginTop: 8,
          display: 'inline-block',
          padding: '3px 12px',
          borderRadius: 20,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.08em',
          background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
          color: active ? color : 'rgba(255,255,255,0.15)',
          border: `1px solid ${active ? `${color}33` : 'rgba(255,255,255,0.06)'}`,
          transition: 'all 200ms ease',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function HistoryBars({ history }: { history: PitchResult[] }) {
  const maxBars = HISTORY_LEN;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 3,
      height: 50, width: '100%', maxWidth: 320,
      padding: '0 4px',
    }}>
      {Array.from({ length: maxBars }, (_, i) => {
        const entry = history[history.length - maxBars + i];
        if (!entry) {
          return <div key={i} style={{
            flex: 1, height: 6, borderRadius: 3,
            background: 'rgba(255,255,255,0.04)',
          }} />;
        }
        const absCents = Math.abs(entry.cents);
        const h = Math.max(6, Math.min(50, (1 - absCents / 50) * 50));
        const color = centsToColor(entry.cents);
        return <div key={i} style={{
          flex: 1, height: h, borderRadius: 3,
          background: color,
          opacity: 0.7 + 0.3 * entry.confidence,
          transition: 'height 120ms ease, background 120ms ease',
        }} />;
      })}
    </div>
  );
}

export default function PitchPanel() {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<PitchResult | null>(null);
  const [history, setHistory] = useState<PitchResult[]>([]);
  const [permError, setPermError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const smoothedFreqRef = useRef<number>(0);

  const detectLoop = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return;

    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);

    let maxAmp = 0;
    for (let i = 0; i < buf.length; i++) {
      const a = Math.abs(buf[i]);
      if (a > maxAmp) maxAmp = a;
    }

    if (maxAmp < 0.01) {
      setResult(null);
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const raw = yinDetect(buf, ctx.sampleRate, 0.15);
    if (raw) {
      if (smoothedFreqRef.current === 0) {
        smoothedFreqRef.current = raw.frequency;
      } else {
        smoothedFreqRef.current =
          SMOOTHING * raw.frequency + (1 - SMOOTHING) * smoothedFreqRef.current;
      }

      const smoothed = { ...raw };
      smoothed.frequency = smoothedFreqRef.current;
      const midiNote = 12 * Math.log2(smoothed.frequency / 440) + 69;
      const roundedMidi = Math.round(midiNote);
      smoothed.cents = (midiNote - roundedMidi) * 100;

      setResult(smoothed);
      setHistory(prev => {
        const next = [...prev, smoothed];
        return next.length > HISTORY_LEN * 3 ? next.slice(-HISTORY_LEN * 2) : next;
      });
    } else {
      setResult(null);
    }

    rafRef.current = requestAnimationFrame(detectLoop);
  }, []);

  const startListening = useCallback(async () => {
    try {
      setPermError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      analyserRef.current = analyser;
      setListening(true);
      smoothedFreqRef.current = 0;
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setPermError(msg);
    }
  }, [detectLoop]);

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setListening(false);
    setResult(null);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  const handleReset = () => {
    setHistory([]);
    smoothedFreqRef.current = 0;
  };

  const active = listening && result !== null;

  return (
    <div style={{
      padding: '12px 20px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      minHeight: '100%',
    }}>
      <PitchGauge
        noteName={result?.noteName ?? '—'}
        octave={result?.octave ?? 0}
        cents={result?.cents ?? 0}
        frequency={result?.frequency ?? 0}
        confidence={result?.confidence ?? 0}
        active={active}
      />

      <div style={{
        display: 'flex', gap: 12, width: '100%', maxWidth: 320,
      }}>
        <div style={{
          flex: 1,
          background: 'var(--c-surface)',
          borderRadius: 14,
          padding: '12px 16px',
          border: '1px solid var(--c-border)',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--c-text-secondary)',
            fontFamily: 'Inter, sans-serif', marginBottom: 4,
          }}>FREQUENCY</div>
          <div style={{
            fontSize: 22, fontWeight: 800, fontFamily: 'Manrope, sans-serif',
            color: active ? 'var(--c-text-primary)' : 'rgba(255,255,255,0.15)',
            transition: 'color 200ms ease',
          }}>
            {active ? result!.frequency.toFixed(2) : '—'}
            <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 3, opacity: 0.5 }}>Hz</span>
          </div>
        </div>
        <div style={{
          flex: 1,
          background: 'var(--c-surface)',
          borderRadius: 14,
          padding: '12px 16px',
          border: '1px solid var(--c-border)',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--c-text-secondary)',
            fontFamily: 'Inter, sans-serif', marginBottom: 4,
          }}>PRECISION</div>
          <div style={{
            fontSize: 22, fontWeight: 800, fontFamily: 'Manrope, sans-serif',
            color: active ? centsToColor(result!.cents) : 'rgba(255,255,255,0.15)',
            transition: 'color 200ms ease',
          }}>
            {active ? (result!.cents >= 0 ? '+' : '') + result!.cents.toFixed(1) : '—'}
            <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 3, opacity: 0.5 }}>cents</span>
          </div>
        </div>
      </div>

      <HistoryBars history={history} />

      <div style={{
        display: 'flex', gap: 12, width: '100%', maxWidth: 320,
      }}>
        {listening && (
          <button
            onClick={handleReset}
            style={{
              flex: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '12px 20px',
              borderRadius: 28,
              border: '1px solid var(--c-border)',
              background: 'var(--c-surface)',
              color: 'var(--c-text-primary)',
              fontSize: 13, fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset
          </button>
        )}
        <button
          onClick={listening ? stopListening : startListening}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 20px',
            borderRadius: 28,
            border: 'none',
            background: listening
              ? 'rgba(239,68,68,0.85)'
              : 'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
            color: '#fff',
            fontSize: 14, fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            boxShadow: listening
              ? '0 4px 20px rgba(239,68,68,0.3)'
              : '0 4px 20px rgba(99,102,241,0.3)',
            transition: 'background 200ms ease, box-shadow 200ms ease',
          }}
        >
          {listening ? (
            <>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Stop
            </>
          ) : (
            <>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Start Listening
            </>
          )}
        </button>
      </div>

      {permError && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 12,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444',
          fontSize: 12,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          maxWidth: 320,
        }}>
          {permError}
        </div>
      )}
    </div>
  );
}

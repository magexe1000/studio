import { useState, useRef, useEffect, useCallback } from 'react';
import { detectPitch, type PitchResult } from './pitchYin';

const HISTORY_LEN = 16;
const SMOOTHING = 0.3;

function centsToColor(cents: number): string {
  const abs = Math.abs(cents);
  if (abs <= 5) return '#6366f1';
  if (abs <= 15) return '#eab308';
  return '#ef4444';
}

function centsToLabel(cents: number): string {
  const abs = Math.abs(cents);
  if (abs <= 5) return 'IN TUNE';
  if (abs <= 15) return 'CLOSE';
  return 'OFF KEY';
}

function centsToNeedleAngle(cents: number): number {
  return Math.max(-50, Math.min(50, cents)) * 1.6;
}

interface GaugeProps {
  noteName: string;
  octave: number;
  cents: number;
  active: boolean;
}

function PitchGauge({ noteName, octave, cents, active }: GaugeProps) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = 115;
  const needleAngle = centsToNeedleAngle(cents);
  const color = active ? centsToColor(cents) : 'rgba(255,255,255,0.08)';
  const label = active ? centsToLabel(cents) : '';

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

  const tickAngles = [-80, -60, -40, -20, 0, 20, 40, 60, 80];

  const leftBarH = active ? Math.max(8, Math.min(40, 40 - Math.abs(cents) * 0.6)) : 8;
  const rightBarH = leftBarH;

  return (
    <div style={{
      position: 'relative', width: size, height: size * 0.72,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
        <path d={arcPath(-90, 90, r)}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} strokeLinecap="round" />

        {tickAngles.map(deg => {
          const a = (deg - 90) * Math.PI / 180;
          const inner = r - 8;
          const outer = r;
          return <line key={deg}
            x1={cx + inner * Math.cos(a)} y1={cy + inner * Math.sin(a)}
            x2={cx + outer * Math.cos(a)} y2={cy + outer * Math.sin(a)}
            stroke="rgba(255,255,255,0.12)" strokeWidth={1.2} strokeLinecap="round" />;
        })}

        <g style={{
          transform: `rotate(${needleAngle}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: 'transform 80ms cubic-bezier(0.4,0,0.2,1)',
        }}>
          <line x1={cx} y1={cy - r + 2} x2={cx} y2={cy - r + 22}
            stroke={active ? '#6366f1' : 'rgba(255,255,255,0.1)'} strokeWidth={2.5} strokeLinecap="round"
            style={{ filter: active ? 'drop-shadow(0 0 6px rgba(99,102,241,0.5))' : 'none' }} />
          <circle cx={cx} cy={cy - r} r={2.5}
            fill={active ? '#6366f1' : 'rgba(255,255,255,0.1)'}
            style={{ filter: active ? 'drop-shadow(0 0 4px rgba(99,102,241,0.5))' : 'none' }} />
        </g>
      </svg>

      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -20%)',
        textAlign: 'center',
        pointerEvents: 'none',
        width: '100%',
      }}>
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.3)',
          marginBottom: 6,
        }}>CURRENT NOTE</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{
            width: 6, borderRadius: 3,
            height: leftBarH,
            background: active ? '#6366f1' : 'rgba(255,255,255,0.06)',
            transition: 'height 120ms ease, background 120ms ease',
            boxShadow: active ? '0 0 8px rgba(99,102,241,0.4)' : 'none',
          }} />

          <div style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: 64,
            fontWeight: 800,
            color: active ? '#ffffff' : 'rgba(255,255,255,0.08)',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            transition: 'color 200ms ease',
            minWidth: 120,
          }}>
            {active ? `${noteName}${octave}` : '—'}
          </div>

          <div style={{
            width: 6, borderRadius: 3,
            height: rightBarH,
            background: active ? '#6366f1' : 'rgba(255,255,255,0.06)',
            transition: 'height 120ms ease, background 120ms ease',
            boxShadow: active ? '0 0 8px rgba(99,102,241,0.4)' : 'none',
          }} />
        </div>

        {label && (
          <div style={{
            marginTop: 8,
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.1em',
            background: `${color}18`,
            color: color,
            border: `1px solid ${color}30`,
            transition: 'all 200ms ease',
          }}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryBars({ history }: { history: PitchResult[] }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4,
      height: 44, width: '100%', maxWidth: 300,
      padding: '0 8px',
    }}>
      {Array.from({ length: HISTORY_LEN }, (_, i) => {
        const entry = history[history.length - HISTORY_LEN + i];
        if (!entry) {
          return <div key={i} style={{
            flex: 1, maxWidth: 16, height: 5, borderRadius: 2.5,
            background: 'rgba(255,255,255,0.04)',
          }} />;
        }
        const absCents = Math.abs(entry.cents);
        const h = Math.max(5, Math.min(44, (1 - absCents / 50) * 44));
        const color = centsToColor(entry.cents);
        return <div key={i} style={{
          flex: 1, maxWidth: 16, height: h, borderRadius: 2.5,
          background: color,
          opacity: 0.65 + 0.35 * entry.confidence,
          transition: 'height 100ms ease',
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

    const raw = detectPitch(buf, ctx.sampleRate, 0.80);
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
      analyser.fftSize = 2048;
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
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      padding: '8px 20px 24px',
      minHeight: '100%',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 340,
        background: 'rgba(18,18,24,0.85)',
        borderRadius: 24,
        padding: '20px 16px 24px',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <PitchGauge
          noteName={result?.noteName ?? '—'}
          octave={result?.octave ?? 0}
          cents={result?.cents ?? 0}
          active={active}
        />
      </div>

      <div style={{
        display: 'flex', gap: 10, width: '100%', maxWidth: 340,
      }}>
        <div style={{
          flex: 1,
          background: 'rgba(18,18,24,0.85)',
          borderRadius: 16,
          padding: '14px 16px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
            fontFamily: 'Inter, sans-serif', marginBottom: 6,
          }}>FREQUENCY</div>
          <div style={{
            fontSize: 24, fontWeight: 800, fontFamily: 'Manrope, sans-serif',
            color: active ? '#ffffff' : 'rgba(255,255,255,0.1)',
            transition: 'color 200ms ease',
          }}>
            {active ? result!.frequency.toFixed(2) : '—'}
            {active && <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4, color: 'rgba(255,255,255,0.35)' }}>Hz</span>}
          </div>
        </div>
        <div style={{
          flex: 1,
          background: 'rgba(18,18,24,0.85)',
          borderRadius: 16,
          padding: '14px 16px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
            fontFamily: 'Inter, sans-serif', marginBottom: 6,
          }}>PRECISION</div>
          <div style={{
            fontSize: 24, fontWeight: 800, fontFamily: 'Manrope, sans-serif',
            color: active ? centsToColor(result!.cents) : 'rgba(255,255,255,0.1)',
            transition: 'color 200ms ease',
          }}>
            {active ? (result!.cents >= 0 ? '+' : '') + result!.cents.toFixed(1) : '—'}
            {active && <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4, color: 'rgba(255,255,255,0.35)' }}>cents</span>}
          </div>
        </div>
      </div>

      <div style={{
        width: '100%', maxWidth: 340,
        background: 'rgba(18,18,24,0.85)',
        borderRadius: 16,
        padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <HistoryBars history={history} />
      </div>

      <div style={{
        display: 'flex', gap: 10, width: '100%', maxWidth: 340,
      }}>
        <button
          onClick={handleReset}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '14px 22px',
            borderRadius: 28,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(18,18,24,0.85)',
            color: '#ffffff',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Reset
        </button>
        <button
          onClick={listening ? stopListening : startListening}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px',
            borderRadius: 28,
            border: 'none',
            background: listening
              ? 'rgba(239,68,68,0.85)'
              : '#6366f1',
            color: '#fff',
            fontSize: 14, fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
            boxShadow: listening
              ? '0 4px 20px rgba(239,68,68,0.25)'
              : '0 4px 20px rgba(99,102,241,0.25)',
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.5)',
          }} />
          {listening ? 'Stop' : 'Capture Take'}
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
          maxWidth: 340,
        }}>
          {permError}
        </div>
      )}
    </div>
  );
}

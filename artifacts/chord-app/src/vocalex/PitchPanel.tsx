import { useState, useRef, useEffect, useCallback } from 'react';
import { detectPitch, type PitchResult } from './pitchYin';

const HISTORY_LEN = 12;
const SMOOTHING = 0.3;

function centsToColor(cents: number): string {
  const abs = Math.abs(cents);
  if (abs <= 5) return '#007aff';
  if (abs <= 15) return '#eab308';
  return '#ef4444';
}

function centsToLabel(cents: number): string {
  const abs = Math.abs(cents);
  if (abs <= 5) return 'IN TUNE';
  if (abs <= 15) return 'CLOSE';
  return 'OFF KEY';
}

function centsToNeedleRotation(cents: number): number {
  return Math.max(-50, Math.min(50, cents)) * 1.6;
}

export default function PitchPanel({ active: panelActive = true }: { active?: boolean }) {
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
    if (audioCtxRef.current) return;
    try {
      setPermError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
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
      setPermError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [detectLoop]);

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setListening(false);
    setResult(null);
  }, []);

  useEffect(() => {
    if (panelActive) {
      startListening();
    } else {
      stopListening();
    }
  }, [panelActive, startListening, stopListening]);

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
  const needleRot = centsToNeedleRotation(active ? result!.cents : 0);
  const statusColor = active ? centsToColor(result!.cents) : '#007aff';
  const statusLabel = active ? centsToLabel(result!.cents) : '';

  const barHeights = [40, 60, 85, 70, 95, 50, 30, 65, 80, 45, 20, 55];
  const barColors  = [false, false, true, true, true, false, false, false, true, false, false, false];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 24px 24px', gap: 0, minHeight: '100%',
    }}>

      {/* ── Pitch Monitor ── */}
      <div style={{
        width: '100%', maxWidth: 360,
        aspectRatio: '1', position: 'relative',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle, rgba(0,122,255,0.05) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }} />

        <svg viewBox="0 0 100 100"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            transform: 'rotate(-90deg)',
          }}>
          <circle cx="50" cy="50" r="45" fill="none"
            stroke="rgba(72,72,72,0.3)" strokeWidth="0.5" />
          <path d="M 50 5 A 45 45 0 0 1 54.7 5.2"
            fill="none" stroke="#007aff" strokeWidth="4" strokeLinecap="round" />
          <path d="M 50 5 A 45 45 0 0 0 45.3 5.2"
            fill="none" stroke="#007aff" strokeWidth="4" strokeLinecap="round" />
        </svg>

        <div style={{
          position: 'absolute', top: 0, left: '50%',
          transform: `translateX(-50%) rotate(${needleRot}deg)`,
          transformOrigin: '50% 50cqw',
          width: 6, height: 48,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          transition: 'transform 80ms cubic-bezier(0.4,0,0.2,1)',
          zIndex: 2,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#007aff',
            boxShadow: '0 0 8px rgba(0,122,255,0.6)',
          }} />
          <div style={{
            width: 2, flex: 1,
            background: 'linear-gradient(to bottom, #007aff, transparent)',
          }} />
        </div>

        <div style={{
          position: 'absolute',
          left: 'calc(50% - 100px)',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 6,
          height: active ? Math.max(16, 50 - Math.abs(result!.cents)) : 16,
          borderRadius: 3,
          background: '#007aff',
          boxShadow: active ? '0 0 10px rgba(0,122,255,0.4)' : 'none',
          opacity: active ? 1 : 0.15,
          transition: 'height 120ms ease, opacity 200ms ease',
          zIndex: 2,
        }} />

        <div style={{ textAlign: 'center', zIndex: 1, position: 'relative' }}>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500,
            color: '#acabaa', letterSpacing: '0.2em', marginBottom: 8,
          }}>CURRENT NOTE</p>
          <h1 style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: 96, fontWeight: 800,
            color: active ? '#e7e5e4' : 'rgba(231,229,228,0.08)',
            lineHeight: 1, letterSpacing: '-0.04em',
            margin: 0,
            transition: 'color 200ms ease',
          }}>
            {active ? `${result!.noteName}${result!.octave}` : '—'}
          </h1>
          {(active && statusLabel) && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
              <span style={{
                fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
                color: statusColor,
                padding: '4px 14px', borderRadius: 9999,
                background: `${statusColor}1a`,
                border: `1px solid ${statusColor}33`,
              }}>{statusLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bento Grid ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        width: '100%', maxWidth: 360,
      }}>
        <div style={{
          background: '#191a1a', borderRadius: 12, padding: '16px 18px',
          borderLeft: '2px solid #007aff',
        }}>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
            color: '#acabaa', letterSpacing: '0.14em', textTransform: 'uppercase',
            margin: '0 0 4px',
          }}>Frequency</p>
          <p style={{
            fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700,
            color: active ? '#e7e5e4' : 'rgba(231,229,228,0.1)',
            margin: 0, transition: 'color 200ms ease',
          }}>
            {active ? result!.frequency.toFixed(2) : '—'}
            {active && <span style={{ fontSize: 14, fontWeight: 400, color: '#acabaa', marginLeft: 4 }}>Hz</span>}
          </p>
        </div>

        <div style={{
          background: '#191a1a', borderRadius: 12, padding: '16px 18px',
        }}>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
            color: '#acabaa', letterSpacing: '0.14em', textTransform: 'uppercase',
            margin: '0 0 4px',
          }}>Precision</p>
          <p style={{
            fontFamily: 'Manrope, sans-serif', fontSize: 24, fontWeight: 700,
            color: active ? '#e7e5e4' : 'rgba(231,229,228,0.1)',
            margin: 0, transition: 'color 200ms ease',
          }}>
            {active ? (result!.cents >= 0 ? '+' : '') + result!.cents.toFixed(1) : '—'}
            {active && <span style={{ fontSize: 14, fontWeight: 400, color: '#acabaa', marginLeft: 4 }}>cents</span>}
          </p>
        </div>

        <div style={{
          gridColumn: '1 / -1',
          background: '#1f2020', borderRadius: 12, padding: 16,
          height: 96, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            height: '100%', gap: 4, opacity: active ? 0.8 : 0.5,
            transition: 'opacity 300ms ease',
          }}>
            {Array.from({ length: HISTORY_LEN }, (_, i) => {
              const entry = history[history.length - HISTORY_LEN + i];
              let h: number;
              let bg: string;

              if (entry) {
                const absCents = Math.abs(entry.cents);
                h = Math.max(15, (1 - absCents / 50) * 100);
                bg = absCents <= 10 ? '#007aff' : '#484848';
              } else {
                h = barHeights[i] ?? 30;
                bg = barColors[i] ? '#007aff' : '#484848';
              }

              return (
                <div key={i} style={{
                  flex: 1, height: `${h}%`, borderRadius: 9999,
                  background: bg,
                  transition: 'height 100ms ease, background 100ms ease',
                }} />
              );
            })}
          </div>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, #1f2020, transparent)',
            pointerEvents: 'none',
          }} />
        </div>
      </div>

      {/* ── Reset Button ── */}
      <div style={{
        display: 'flex', gap: 12, width: '100%', maxWidth: 360, marginTop: 20,
      }}>
        <button
          onClick={handleReset}
          style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 48, borderRadius: 12,
            background: '#454747', border: 'none',
            color: '#d0d0d0',
            fontSize: 14, fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            cursor: 'pointer',
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Reset
        </button>
      </div>

      {permError && (
        <div style={{
          padding: '10px 16px', borderRadius: 12, marginTop: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444', fontSize: 12, fontFamily: 'Inter, sans-serif',
          textAlign: 'center', maxWidth: 360, width: '100%',
        }}>
          {permError}
        </div>
      )}
    </div>
  );
}

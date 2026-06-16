import { useState, useRef, useEffect, useCallback } from 'react';
import {
  saveTake, getAllTakes, deleteTake as dbDeleteTake,
  extractWaveformPeaks, blobToAudioBuffer,
  type TakeRecord,
} from './takesDb';
import LoadingLottie from '../components/lottie/LoadingLottie';
import SmartLoading from '../components/SmartLoading';
import { VocalexTakesSkeleton } from '../components/StudioSkeleton';
import EmptyStateLottie from '../components/lottie/EmptyStateLottie';
import { analyzeAudio, type VocalAnalysis, type AnalysisLabels } from './vocalAnalysis';
import { useT } from '../lib/useT';
import { setVocalexBack } from './headerBack';
import { createAudioContext } from '../lib/audioContextOptions';
import HarmonizerSheet from './HarmonizerSheet';
import { clearTakeCache } from './harmonyEngine';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDateI18n(ts: number, t: { today: string; yesterday: string; daysAgo: (n: number) => string }): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 86400000) {
    return `${t.today}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diff < 172800000) {
    return `${t.yesterday}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diff < 604800000) {
    return t.daysAgo(Math.floor(diff / 86400000));
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

type ViewState =
  | { mode: 'list' }
  | { mode: 'recording' }
  | { mode: 'detail'; takeId: string };

export default function TakesPanel() {
  const t = useT();
  const [takes, setTakes] = useState<TakeRecord[]>([]);
  const [view, setView] = useState<ViewState>({ mode: 'list' });
  const [loading, setLoading] = useState(true);

  const loadTakes = useCallback(async () => {
    try {
      const all = await getAllTakes();
      setTakes(all);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadTakes(); }, [loadTakes]);

  const handleRecordingComplete = useCallback(async (take: TakeRecord) => {
    await saveTake(take);
    await loadTakes();
    setView({ mode: 'detail', takeId: take.id });
  }, [loadTakes]);

  const handleDelete = useCallback(async (id: string) => {
    await dbDeleteTake(id);
    clearTakeCache(id);
    setTakes(prev => prev.filter(t => t.id !== id));
    if (view.mode === 'detail' && view.takeId === id) {
      setView({ mode: 'list' });
    }
  }, [view]);

  const handleSaveBounce = useCallback(async (newTake: TakeRecord) => {
    await saveTake(newTake);
    await loadTakes();
  }, [loadTakes]);

  if (view.mode === 'recording') {
    return <RecordingView onComplete={handleRecordingComplete} onCancel={() => setView({ mode: 'list' })} />;
  }

  if (view.mode === 'detail') {
    const take = takes.find(t => t.id === view.takeId);
    if (!take) return <div style={{ padding: 24, color: 'var(--vx-text-2)' }}>{t.vocalex.takeNotFound}</div>;
    return <TakeDetailView take={take} onBack={() => setView({ mode: 'list' })} onDelete={handleDelete} onSaveBounce={handleSaveBounce} />;
  }

  return (
    <div className="spring-in" style={{ padding: '24px 20px', minHeight: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800,
          fontSize: 34, letterSpacing: '-0.03em',
          color: 'var(--vx-text)', margin: '0 0 8px', lineHeight: 1,
        }}>{t.vocalex.takesTitle}</h2>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13,
          color: 'var(--vx-text-2)', margin: 0, lineHeight: 1.5,
        }}>{t.vocalex.takesSubtitle}</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 18px', borderRadius: 9999,
          background: 'var(--vx-edge)', border: 'none',
          color: 'var(--vx-text)', fontFamily: 'Manrope, sans-serif',
          fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sort</span>
          {t.vocalex.recent}
        </button>
        <button
          onClick={() => setView({ mode: 'recording' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 9999,
            background: 'var(--studio-accent)', border: 'none',
            color: '#fff', fontFamily: 'Manrope, sans-serif',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: 'var(--studio-accent-glow)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>mic</span>
          {t.vocalex.newTake}
        </button>
      </div>

      {loading ? (
        <SmartLoading
          fallbackSkeleton={<VocalexTakesSkeleton />}
          subtleLoading={
            <div style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 24, height: 24, border: '2.5px solid var(--vx-text)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ color: 'var(--vx-text-2)', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>{t.vocalex.loading}</span>
            </div>
          }
        />
      ) : takes.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          background: 'var(--vx-card-2)', borderRadius: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <EmptyStateLottie app="vocalex" size={56} style={{ marginBottom: 2 }} />
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--vx-text)', margin: 0 }}>{t.vocalex.noTakesYet}</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-2)', margin: 0 }}>{t.vocalex.noTakesHint}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {takes.map(take => (
            <TakeListItem
              key={take.id}
              take={take}
              onOpen={() => setView({ mode: 'detail', takeId: take.id })}
              onDelete={() => handleDelete(take.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TakeListItem({ take, onOpen, onDelete }: { take: TakeRecord; onOpen: () => void; onDelete: () => void }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);

  return (
    <div style={{
      background: 'var(--vx-edge)', borderRadius: 14,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div
        onClick={onOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, flex: 1,
          minWidth: 0, cursor: 'pointer',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--vx-card-2)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--vx-text)' }}>play_arrow</span>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h4 style={{
            fontFamily: 'Manrope, sans-serif', fontWeight: 600,
            fontSize: 14, color: 'var(--vx-text)', margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{take.name}</h4>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 3,
            fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--vx-text-2)',
          }}>
            <span>{formatDateI18n(take.createdAt, t.vocalex)}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--vx-text-4)' }} />
            <span>{formatDuration(take.durationMs)}</span>
          </div>
        </div>
        <MiniWaveform peaks={take.waveformPeaks} />
      </div>

      {confirming ? (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => { onDelete(); setConfirming(false); }}
            style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
              color: '#ef4444',
            }}
          >{t.vocalex.deleteTake}</button>
          <button
            onClick={() => setConfirming(false)}
            style={{
              background: 'var(--vx-input)', border: 'none',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
              color: 'var(--vx-text-2)',
            }}
          >{t.vocalex.cancelAction}</button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 6, flexShrink: 0, color: 'var(--vx-text-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
        </button>
      )}
    </div>
  );
}

function MiniWaveform({ peaks }: { peaks: number[] }) {
  const display = peaks.length > 8 ? peaks.filter((_, i) => i % Math.ceil(peaks.length / 8) === 0).slice(0, 8) : peaks;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 24, opacity: 0.4, flexShrink: 0 }}>
      {display.map((h, i) => (
        <div key={i} style={{ width: 2, height: `${Math.max(15, h)}%`, background: 'var(--vx-text)', borderRadius: 9999 }} />
      ))}
    </div>
  );
}

const VIZ_BARS = 48;
const SMOOTHING_FACTOR = 0.35;

function RecordingView({ onComplete, onCancel }: { onComplete: (take: TakeRecord) => void; onCancel: () => void }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'countdown' | 'recording' | 'processing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [countdownNum, setCountdownNum] = useState(3);
  const [freqBars, setFreqBars] = useState<number[]>(() => new Array(VIZ_BARS).fill(0));
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVocalexBack(onCancel);
    return () => setVocalexBack(null);
  }, [onCancel]);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const smoothedBarsRef = useRef<number[]>(new Array(VIZ_BARS).fill(0));
  const nameRef = useRef('');

  useEffect(() => { nameRef.current = name; }, [name]);

  const monitorFrequency = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);

    const bucketSize = Math.floor(freqData.length / VIZ_BARS);
    const newBars: number[] = [];
    for (let i = 0; i < VIZ_BARS; i++) {
      let sum = 0;
      const start = i * bucketSize;
      for (let j = start; j < start + bucketSize && j < freqData.length; j++) {
        sum += freqData[j];
      }
      const raw = (sum / bucketSize) / 255;
      const prev = smoothedBarsRef.current[i] ?? 0;
      const smoothed = prev * SMOOTHING_FACTOR + raw * (1 - SMOOTHING_FACTOR);
      newBars.push(smoothed);
    }
    smoothedBarsRef.current = newBars;
    setFreqBars([...newBars]);
    rafRef.current = requestAnimationFrame(monitorFrequency);
  }, []);

  const acquireMic = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      });
    } catch (constraintsErr) {
      console.warn('[TakesPanel] getUserMedia with constraints failed, falling back to simple audio:', constraintsErr);
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    streamRef.current = stream;

    const ctx = createAudioContext();
    ctxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    analyserRef.current = analyser;

    rafRef.current = requestAnimationFrame(monitorFrequency);
    return { stream, ctx, analyser };
  }, [monitorFrequency]);

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(200);
    startTimeRef.current = Date.now();
    setState('recording');

    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current);
    }, 50);
  }, []);

  const handleStart = useCallback(async () => {
    try {
      setError(null);
      await acquireMic();

      setState('countdown');
      setCountdownNum(3);

      let count = 3;
      const cdInterval = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(cdInterval);
          beginRecording();
        } else {
          setCountdownNum(count);
        }
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [acquireMic, beginRecording]);

  const stopRecording = useCallback(async () => {
    setState('processing');
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    const durationMs = Date.now() - startTimeRef.current;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    streamRef.current?.getTracks().forEach(t => t.stop());
    ctxRef.current?.close();

    const blob = new Blob(chunksRef.current, { type: recorder.mimeType });

    let waveformPeaks: number[] = [];
    let sampleRate = 44100;
    try {
      const audioBuffer = await blobToAudioBuffer(blob);
      waveformPeaks = extractWaveformPeaks(audioBuffer, 60);
      sampleRate = audioBuffer.sampleRate;
    } catch { /* fallback */ }

    const id = `take-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const currentName = nameRef.current;
    const takeName = currentName.trim() || `Take_${new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })}_${new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')}`;

    const take: TakeRecord = {
      id,
      name: takeName,
      createdAt: Date.now(),
      durationMs,
      audioBlob: blob,
      waveformPeaks,
      sampleRate,
    };

    onComplete(take);
  }, [onComplete]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      ctxRef.current?.close();
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
    };
  }, []);

  const isActive = state === 'recording' || state === 'countdown';
  const centerR = 56;
  const vizR = 100;

  return (
    <div className="spring-in" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100%', padding: '24px 20px',
      gap: 24, position: 'relative',
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes countPop {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes recPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {state === 'processing' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, border: '3px solid var(--studio-accent)',
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'var(--vx-text-2)' }}>{t.vocalex.processing}</p>
        </div>
      )}

      {state !== 'processing' && (
        <>
          {/* Circular visualizer + button */}
          <div style={{
            width: vizR * 2 + 40, height: vizR * 2 + 40,
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Frequency bars radiating from center */}
            <svg
              viewBox={`0 0 ${(vizR + 20) * 2} ${(vizR + 20) * 2}`}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                pointerEvents: 'none',
              }}
            >
              {freqBars.map((val, i) => {
                const angle = (i / VIZ_BARS) * Math.PI * 2 - Math.PI / 2;
                const innerR = centerR + 8;
                const barLen = Math.max(2, val * (vizR - centerR - 4));
                const cx = vizR + 20;
                const cy = vizR + 20;
                const x1 = cx + Math.cos(angle) * innerR;
                const y1 = cy + Math.sin(angle) * innerR;
                const x2 = cx + Math.cos(angle) * (innerR + barLen);
                const y2 = cy + Math.sin(angle) * (innerR + barLen);

                const hue = 210 + val * 30;
                const alpha = 0.3 + val * 0.7;

                return (
                  <line
                    key={i}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={`hsla(${hue}, 100%, 60%, ${alpha})`}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                );
              })}

              {isActive && (
                <circle
                  cx={vizR + 20} cy={vizR + 20} r={centerR + 6}
                  fill="none" stroke="rgba(var(--studio-accent-rgb), 0.15)" strokeWidth="1"
                />
              )}
            </svg>

            {/* Center button */}
            <div
              onClick={state === 'idle' ? handleStart : state === 'recording' ? stopRecording : undefined}
              style={{
                width: centerR * 2, height: centerR * 2, borderRadius: '50%',
                background: state === 'recording'
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : 'var(--studio-accent-gradient)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: state === 'recording'
                  ? '0 0 60px rgba(239,68,68,0.25), 0 0 120px rgba(239,68,68,0.1)'
                  : '0 0 60px rgba(var(--studio-accent-rgb), 0.2), 0 0 120px rgba(var(--studio-accent-rgb), 0.08)',
                cursor: state === 'countdown' ? 'default' : 'pointer',
                position: 'relative', zIndex: 2,
                transition: 'background 300ms ease, box-shadow 300ms ease',
              }}
            >
              {state === 'countdown' ? (
                <span
                  key={countdownNum}
                  style={{
                    fontFamily: 'Manrope, sans-serif', fontSize: 64, fontWeight: 800,
                    color: '#fff', animation: 'countPop 0.6s ease-out forwards',
                  }}
                >{countdownNum}</span>
              ) : state === 'recording' ? (
                <div style={{
                  width: 28, height: 28, borderRadius: 6, background: '#fff',
                  transition: 'border-radius 200ms ease',
                }} />
              ) : (
                <span className="material-symbols-outlined" style={{
                  fontSize: 44, color: '#fff',
                  fontVariationSettings: "'FILL' 1",
                }}>mic</span>
              )}
            </div>
          </div>

          {/* Timer / status */}
          <div style={{ textAlign: 'center' }}>
            {state === 'recording' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                  animation: 'recPulse 1.2s ease-in-out infinite',
                }} />
                <span style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600,
                  color: '#ef4444', letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>{t.vocalex.rec}</span>
              </div>
            )}
            <p style={{
              fontFamily: 'Manrope, sans-serif', fontSize: 48, fontWeight: 800,
              color: 'var(--vx-text)', margin: 0, letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatDuration(elapsed)}
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-2)',
              margin: '8px 0 0',
            }}>
              {state === 'countdown' ? t.vocalex.getReady :
               state === 'recording' ? t.vocalex.tapToStop :
               t.vocalex.tapToStart}
            </p>
          </div>

          {/* Name input */}
          {(state === 'idle' || state === 'recording') && (
            <input
              type="text"
              placeholder={t.vocalex.takeNamePlaceholder}
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width: '100%', maxWidth: 300,
                padding: '12px 16px', borderRadius: 12,
                background: 'var(--vx-card-2)', border: '1px solid var(--vx-text-4)',
                color: 'var(--vx-text)', fontFamily: 'Inter, sans-serif',
                fontSize: 14, outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--studio-accent)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--vx-text-4)'; }}
            />
          )}

          {error && (
            <div style={{
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', fontSize: 12, fontFamily: 'Inter, sans-serif',
              textAlign: 'center', maxWidth: 300, width: '100%',
            }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TakeDetailView({ take, onBack, onDelete, onSaveBounce }: {
  take: TakeRecord; onBack: () => void; onDelete: (id: string) => void;
  onSaveBounce: (newTake: TakeRecord) => Promise<void>;
}) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<VocalAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHarmonizer, setShowHarmonizer] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    setVocalexBack(() => onBack());
    return () => setVocalexBack(null);
  }, [onBack]);

  useEffect(() => {
    const url = URL.createObjectURL(take.audioBlob);
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      setPlaying(false);
      setProgress(0);
    };

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [take]);

  useEffect(() => {
    (async () => {
      try {
        const audioBuffer = await blobToAudioBuffer(take.audioBlob);
        const labels: AnalysisLabels = {
          noPitchTitle: t.vocalex.noPitchTitle,
          noPitchDetail: t.vocalex.noPitchDetail,
          pitchStability: t.vocalex.pitchStabilityTitle,
          stabilityExcellent: t.vocalex.stabilityExcellent,
          stabilityGood: t.vocalex.stabilityGood,
          stabilityPractice: t.vocalex.stabilityPractice,
          vocalRange: t.vocalex.vocalRangeTitle,
          semitones: t.vocalex.semitonesUnit,
          rangeWide: t.vocalex.rangeWide,
          rangeModerate: t.vocalex.rangeModerate,
          rangeNarrow: t.vocalex.rangeNarrow,
          rangeTo: t.vocalex.rangeTo,
          pitchTrend: t.vocalex.pitchTrendTitle,
          driftingFlat: t.vocalex.driftingFlat,
          driftingFlatDetail: t.vocalex.driftingFlatDetail,
          driftingSharp: t.vocalex.driftingSharp,
          driftingSharpDetail: t.vocalex.driftingSharpDetail,
          stableTrend: t.vocalex.stableTrend,
          stableTrendDetail: t.vocalex.stableTrendDetail,
          breathGaps: t.vocalex.breathGapsTitle,
          breathGapsDetail: t.vocalex.breathGapsDetail,
          inTuneRate: t.vocalex.inTuneRateTitle,
          inTuneExcellent: t.vocalex.inTuneExcellent,
          inTuneDecent: t.vocalex.inTuneDecent,
          inTunePractice: t.vocalex.inTunePractice,
        };
        const result = analyzeAudio(audioBuffer, labels);
        setAnalysis(result);
      } catch { /* empty */ }
      setAnalyzing(false);
    })();
  }, [take]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.duration && isFinite(audio.duration)) {
      setProgress((audio.currentTime / audio.duration) * 100);
    }
    rafRef.current = requestAnimationFrame(updateProgress);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    } else {
      audio.play();
      rafRef.current = requestAnimationFrame(updateProgress);
      setPlaying(true);
    }
  }, [playing, updateProgress]);

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !isFinite(audio.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = x * audio.duration;
    setProgress(x * 100);
  };

  const handleDelete = () => {
    if (audioRef.current) audioRef.current.pause();
    onDelete(take.id);
  };

  const currentTimeSec = audioRef.current?.currentTime ?? 0;
  const totalTimeSec = take.durationMs / 1000;

  return (
    <div className="spring-in" style={{ padding: '16px 20px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button
          data-testid="open-harmonizer-btn"
          onClick={() => {
            if (audioRef.current && !audioRef.current.paused) {
              audioRef.current.pause();
              if (rafRef.current) cancelAnimationFrame(rafRef.current);
              setPlaying(false);
            }
            setShowHarmonizer(true);
          }}
          style={{
            background: 'var(--studio-accent-soft)', border: '1px solid var(--studio-accent-border)',
            cursor: 'pointer', color: 'var(--studio-accent)',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 9999,
            fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
          Harmonize
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4,
            fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
          {t.vocalex.deleteTake}
        </button>
      </div>

      {showHarmonizer && (
        <HarmonizerSheet
          take={take}
          accent="var(--studio-accent)"
          onClose={() => setShowHarmonizer(false)}
          onBounce={async (newTake) => {
            await onSaveBounce(newTake);
            setShowHarmonizer(false);
            onBack();
          }}
        />
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div style={{
          background: 'var(--vx-edge)', borderRadius: 14, padding: 20,
          marginBottom: 16, border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--vx-text)', margin: '0 0 8px' }}>
            {t.vocalex.deleteConfirmTitle}
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-2)', margin: '0 0 16px', lineHeight: 1.5 }}>
            {t.vocalex.deleteConfirmBody}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowDeleteConfirm(false)} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              background: 'var(--vx-input-2)', border: 'none', color: 'var(--vx-text)',
              fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>{t.vocalex.cancelAction}</button>
            <button onClick={handleDelete} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              background: '#ef4444', border: 'none', color: '#fff',
              fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>{t.vocalex.deleteTake}</button>
          </div>
        </div>
      )}

      {/* Take info */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22,
          color: 'var(--vx-text)', margin: '0 0 4px', lineHeight: 1.2,
          wordBreak: 'break-word',
        }}>{take.name}</h2>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--vx-text-2)',
        }}>
          <span>{formatDateI18n(take.createdAt, t.vocalex)}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--vx-text-4)' }} />
          <span>{formatDuration(take.durationMs)}</span>
        </div>
      </div>

      {/* Player card */}
      <div style={{
        background: 'var(--vx-card-2)', borderRadius: 16, padding: 20,
        marginBottom: 24, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: playing ? 'var(--studio-accent)' : 'var(--vx-text-4)',
          transition: 'background 200ms ease',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <button onClick={togglePlay} style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--studio-accent)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--studio-accent-glow)', flexShrink: 0,
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 26, color: '#fff',
              fontVariationSettings: "'FILL' 1",
            }}>{playing ? 'pause' : 'play_arrow'}</span>
          </button>
          <div>
            <p style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14,
              color: playing ? 'var(--studio-accent)' : 'var(--vx-text-2)', margin: 0,
              transition: 'color 200ms ease',
            }}>
              {playing ? t.vocalex.playing : t.vocalex.tapToPlay}
            </p>
          </div>
        </div>

        {/* Waveform / scrubber */}
        <div
          onClick={seekTo}
          style={{
            height: 72, background: '#000', borderRadius: 10,
            display: 'flex', alignItems: 'center', padding: '0 10px',
            gap: 1.5, position: 'relative', overflow: 'hidden', cursor: 'pointer',
          }}
        >
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${progress}%`,
            background: 'rgba(var(--studio-accent-rgb), 0.08)',
            borderRight: '2px solid var(--studio-accent)',
            transition: playing ? 'none' : 'width 100ms ease',
          }} />
          {take.waveformPeaks.map((h, i) => {
            const isPlayed = (i / take.waveformPeaks.length) * 100 < progress;
            return (
              <div key={i} style={{
                flex: 1, height: `${Math.max(8, h)}%`, borderRadius: 9999,
                background: isPlayed ? 'rgba(var(--studio-accent-rgb), 0.6)' : 'rgba(172,171,170,0.2)',
                position: 'relative', zIndex: 1,
                minWidth: 1.5,
              }} />
            );
          })}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between',
          padding: '6px 2px 0',
          fontFamily: 'Inter, sans-serif', fontSize: 11,
          fontWeight: 700, color: 'var(--vx-text-2)', fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{formatDuration(currentTimeSec * 1000)}</span>
          <span>-{formatDuration((totalTimeSec - currentTimeSec) * 1000)}</span>
        </div>
      </div>

      {/* Analysis section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--studio-accent)' }}>insights</span>
          <h3 style={{
            fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18,
            color: 'var(--vx-text)', margin: 0,
          }}>{t.vocalex.vocalAnalysis}</h3>
        </div>

        {analyzing ? (
          <div style={{
            padding: 32, textAlign: 'center',
            background: 'var(--vx-card-2)', borderRadius: 14,
          }}>
            <div style={{
              width: 32, height: 32, border: '2px solid var(--studio-accent)',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
            }} />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-2)', margin: 0 }}>{t.vocalex.analyzing}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : analysis ? (
          <>
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <StatCard label={t.vocalex.avgFrequency} value={analysis.avgFrequency > 0 ? `${analysis.avgFrequency.toFixed(0)} Hz` : '—'} />
              <StatCard label={t.vocalex.stability} value={`${analysis.stabilityPercent}%`} color={analysis.stabilityPercent >= 80 ? '#34d399' : analysis.stabilityPercent >= 60 ? '#eab308' : '#ef4444'} />
              <StatCard label={t.vocalex.lowest} value={analysis.lowestNote} />
              <StatCard label={t.vocalex.highest} value={analysis.highestNote} />
            </div>

            {/* Pitch timeline */}
            {analysis.pitchTimeline.length > 0 && (
              <div style={{
                background: 'var(--vx-card-2)', borderRadius: 14, padding: 16,
                marginBottom: 16, height: 100, position: 'relative', overflow: 'hidden',
              }}>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
                  color: 'var(--vx-text-2)', letterSpacing: '0.12em', textTransform: 'uppercase',
                  margin: '0 0 8px', position: 'relative', zIndex: 1,
                }}>{t.vocalex.pitchTimeline}</p>
                <svg viewBox={`0 0 ${analysis.pitchTimeline.length} 60`} style={{
                  width: '100%', height: 56, display: 'block',
                }} preserveAspectRatio="none">
                  {(() => {
                    const pts = analysis.pitchTimeline;
                    const minF = Math.min(...pts.map(p => p.frequency));
                    const maxF = Math.max(...pts.map(p => p.frequency));
                    const range = maxF - minF || 1;
                    const path = pts.map((p, i) => {
                      const y = 56 - ((p.frequency - minF) / range) * 50 - 3;
                      return `${i === 0 ? 'M' : 'L'} ${i} ${y}`;
                    }).join(' ');
                    return (
                      <>
                        <path d={path} fill="none" stroke="var(--studio-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        <path d={`${path} L ${pts.length - 1} 60 L 0 60 Z`} fill="url(#pitchGrad)" opacity="0.3" />
                        <defs>
                          <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--studio-accent)" />
                            <stop offset="100%" stopColor="var(--studio-accent)" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}

            {/* Insights */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {analysis.insights.map((insight, i) => (
                <div key={i} style={{
                  background: 'var(--vx-card-2)', borderRadius: 14, padding: '16px 18px',
                  borderLeft: `3px solid ${insight.color}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span className="material-symbols-outlined" style={{
                      fontSize: 20, color: insight.color,
                      fontVariationSettings: "'FILL' 1",
                    }}>{insight.icon}</span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14,
                        color: 'var(--vx-text)',
                      }}>{insight.title}</span>
                      {insight.value && (
                        <span style={{
                          fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14,
                          color: insight.color,
                        }}>{insight.value}</span>
                      )}
                    </div>
                  </div>
                  <p style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 12.5,
                    color: 'var(--vx-text-2)', margin: 0, lineHeight: 1.6,
                  }}>{insight.detail}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{
            padding: 24, textAlign: 'center', background: 'var(--vx-card-2)', borderRadius: 14,
          }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-2)', margin: 0 }}>
              {t.vocalex.analysisError}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--vx-card-2)', borderRadius: 12, padding: '14px 16px' }}>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
        color: 'var(--vx-text-2)', letterSpacing: '0.12em', textTransform: 'uppercase',
        margin: '0 0 4px',
      }}>{label}</p>
      <p style={{
        fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700,
        color: color ?? 'var(--vx-text)', margin: 0,
      }}>{value}</p>
    </div>
  );
}

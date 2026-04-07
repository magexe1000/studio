import { useState, useRef, useEffect, useCallback } from 'react';
import {
  saveTake, getAllTakes, deleteTake as dbDeleteTake,
  extractWaveformPeaks, blobToAudioBuffer,
  type TakeRecord,
} from './takesDb';
import { analyzeAudio, type VocalAnalysis } from './vocalAnalysis';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 86400000) {
    return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diff < 172800000) {
    return `Yesterday, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diff < 604800000) {
    return `${Math.floor(diff / 86400000)} days ago`;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

type ViewState =
  | { mode: 'list' }
  | { mode: 'recording' }
  | { mode: 'detail'; takeId: string };

export default function TakesPanel() {
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
    setTakes(prev => prev.filter(t => t.id !== id));
    if (view.mode === 'detail' && view.takeId === id) {
      setView({ mode: 'list' });
    }
  }, [view]);

  if (view.mode === 'recording') {
    return <RecordingView onComplete={handleRecordingComplete} onCancel={() => setView({ mode: 'list' })} />;
  }

  if (view.mode === 'detail') {
    const take = takes.find(t => t.id === view.takeId);
    if (!take) return <div style={{ padding: 24, color: '#acabaa' }}>Take not found</div>;
    return <TakeDetailView take={take} onBack={() => setView({ mode: 'list' })} onDelete={handleDelete} />;
  }

  return (
    <div style={{ padding: '24px 20px', minHeight: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600,
          color: '#007aff', letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>Library</span>
        <h2 style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800,
          fontSize: 34, letterSpacing: '-0.03em',
          color: '#e7e5e4', margin: '4px 0 8px', lineHeight: 1,
        }}>Takes</h2>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13,
          color: '#acabaa', margin: 0, lineHeight: 1.5,
        }}>Review and manage your vocal performances.</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 18px', borderRadius: 9999,
          background: '#1f2020', border: 'none',
          color: '#e7e5e4', fontFamily: 'Manrope, sans-serif',
          fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sort</span>
          Recent
        </button>
        <button
          onClick={() => setView({ mode: 'recording' })}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 9999,
            background: '#007aff', border: 'none',
            color: '#fff', fontFamily: 'Manrope, sans-serif',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,122,255,0.25)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>mic</span>
          New Take
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Loading…</div>
      ) : takes.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          background: '#191a1a', borderRadius: 16,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#484848', marginBottom: 12, display: 'block' }}>mic_none</span>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: '#e7e5e4', margin: '0 0 6px' }}>No takes yet</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', margin: 0 }}>Tap "New Take" to record your first vocal.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {takes.map(take => (
            <button
              key={take.id}
              onClick={() => setView({ mode: 'detail', takeId: take.id })}
              style={{
                background: '#1f2020', borderRadius: 14,
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                border: 'none', cursor: 'pointer', width: '100%',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#191a1a', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#e7e5e4' }}>play_arrow</span>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4 style={{
                  fontFamily: 'Manrope, sans-serif', fontWeight: 600,
                  fontSize: 14, color: '#e7e5e4', margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{take.name}</h4>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 3,
                  fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#acabaa',
                }}>
                  <span>{formatDate(take.createdAt)}</span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#484848' }} />
                  <span>{formatDuration(take.durationMs)}</span>
                </div>
              </div>
              <MiniWaveform peaks={take.waveformPeaks} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniWaveform({ peaks }: { peaks: number[] }) {
  const display = peaks.length > 8 ? peaks.filter((_, i) => i % Math.ceil(peaks.length / 8) === 0).slice(0, 8) : peaks;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 24, opacity: 0.4, flexShrink: 0 }}>
      {display.map((h, i) => (
        <div key={i} style={{ width: 2, height: `${Math.max(15, h)}%`, background: '#e7e5e4', borderRadius: 9999 }} />
      ))}
    </div>
  );
}

function RecordingView({ onComplete, onCancel }: { onComplete: (take: TakeRecord) => void; onCancel: () => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);

  const monitorAmplitude = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    setAmplitude(Math.sqrt(sum / buf.length));
    rafRef.current = requestAnimationFrame(monitorAmplitude);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 1 },
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyserRef.current = analyser;

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
      }, 100);

      rafRef.current = requestAnimationFrame(monitorAmplitude);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [monitorAmplitude]);

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
    const takeName = name.trim() || `Take_${new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })}_${new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')}`;

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
  }, [name, onComplete]);

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

  const ringScale = 1 + amplitude * 1.5;
  const pulseOpacity = 0.15 + amplitude * 0.6;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100%', padding: '24px 20px',
      gap: 32,
    }}>
      {state === 'processing' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, border: '3px solid #007aff',
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#acabaa' }}>Processing recording…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {state !== 'processing' && (
        <>
          {/* Back button */}
          <button onClick={onCancel} style={{
            position: 'absolute', top: 20, left: 20,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
            Cancel
          </button>

          {/* Animated ring */}
          <div style={{
            width: 200, height: 200, position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: `radial-gradient(circle, rgba(0,122,255,${pulseOpacity}) 0%, transparent 70%)`,
              transform: `scale(${ringScale})`,
              transition: 'transform 100ms ease, background 100ms ease',
            }} />
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: state === 'recording'
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #007aff, #0066d6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: state === 'recording'
                ? '0 8px 40px rgba(239,68,68,0.3)'
                : '0 8px 40px rgba(0,122,255,0.3)',
              cursor: 'pointer',
              transition: 'background 200ms ease, box-shadow 200ms ease',
            }}
              onClick={state === 'recording' ? stopRecording : startRecording}
            >
              {state === 'recording' ? (
                <div style={{ width: 32, height: 32, borderRadius: 6, background: '#fff' }} />
              ) : (
                <span className="material-symbols-outlined" style={{
                  fontSize: 48, color: '#fff',
                  fontVariationSettings: "'FILL' 1",
                }}>mic</span>
              )}
            </div>
          </div>

          {/* Timer */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontFamily: 'Manrope, sans-serif', fontSize: 48, fontWeight: 800,
              color: '#e7e5e4', margin: 0, letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatDuration(elapsed)}
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa',
              margin: '8px 0 0',
            }}>
              {state === 'recording' ? 'Recording…' : 'Tap to start recording'}
            </p>
          </div>

          {/* Name input */}
          <input
            type="text"
            placeholder="Take name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%', maxWidth: 300,
              padding: '12px 16px', borderRadius: 12,
              background: '#191a1a', border: '1px solid #484848',
              color: '#e7e5e4', fontFamily: 'Inter, sans-serif',
              fontSize: 14, outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#007aff'; }}
            onBlur={e => { e.target.style.borderColor = '#484848'; }}
          />

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

function TakeDetailView({ take, onBack, onDelete }: {
  take: TakeRecord; onBack: () => void; onDelete: (id: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<VocalAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

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
        const result = analyzeAudio(audioBuffer);
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
    <div style={{ padding: '16px 20px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          color: '#007aff', fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          Takes
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
          Delete
        </button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div style={{
          background: '#1f2020', borderRadius: 14, padding: 20,
          marginBottom: 16, border: '1px solid rgba(239,68,68,0.2)',
        }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: '#e7e5e4', margin: '0 0 8px' }}>
            Delete this take?
          </p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', margin: '0 0 16px', lineHeight: 1.5 }}>
            This recording will be permanently deleted and cannot be recovered.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowDeleteConfirm(false)} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              background: '#454747', border: 'none', color: '#e7e5e4',
              fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleDelete} style={{
              flex: 1, padding: '10px 16px', borderRadius: 10,
              background: '#ef4444', border: 'none', color: '#fff',
              fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>Delete</button>
          </div>
        </div>
      )}

      {/* Take info */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 22,
          color: '#e7e5e4', margin: '0 0 4px', lineHeight: 1.2,
          wordBreak: 'break-word',
        }}>{take.name}</h2>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#acabaa',
        }}>
          <span>{formatDate(take.createdAt)}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#484848' }} />
          <span>{formatDuration(take.durationMs)}</span>
        </div>
      </div>

      {/* Player card */}
      <div style={{
        background: '#191a1a', borderRadius: 16, padding: 20,
        marginBottom: 24, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: playing ? '#007aff' : '#484848',
          transition: 'background 200ms ease',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <button onClick={togglePlay} style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#007aff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,122,255,0.3)', flexShrink: 0,
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 26, color: '#fff',
              fontVariationSettings: "'FILL' 1",
            }}>{playing ? 'pause' : 'play_arrow'}</span>
          </button>
          <div>
            <p style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14,
              color: playing ? '#007aff' : '#acabaa', margin: 0,
              transition: 'color 200ms ease',
            }}>
              {playing ? 'Playing' : 'Tap to play'}
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
            background: 'rgba(0,122,255,0.08)',
            borderRight: '2px solid #007aff',
            transition: playing ? 'none' : 'width 100ms ease',
          }} />
          {take.waveformPeaks.map((h, i) => {
            const isPlayed = (i / take.waveformPeaks.length) * 100 < progress;
            return (
              <div key={i} style={{
                flex: 1, height: `${Math.max(8, h)}%`, borderRadius: 9999,
                background: isPlayed ? 'rgba(0,122,255,0.6)' : 'rgba(172,171,170,0.2)',
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
          fontWeight: 700, color: '#acabaa', fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{formatDuration(currentTimeSec * 1000)}</span>
          <span>-{formatDuration((totalTimeSec - currentTimeSec) * 1000)}</span>
        </div>
      </div>

      {/* Analysis section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#007aff' }}>insights</span>
          <h3 style={{
            fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18,
            color: '#e7e5e4', margin: 0,
          }}>Vocal Analysis</h3>
        </div>

        {analyzing ? (
          <div style={{
            padding: 32, textAlign: 'center',
            background: '#191a1a', borderRadius: 14,
          }}>
            <div style={{
              width: 32, height: 32, border: '2px solid #007aff',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
            }} />
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', margin: 0 }}>Analyzing your vocal…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : analysis ? (
          <>
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <StatCard label="Avg Frequency" value={analysis.avgFrequency > 0 ? `${analysis.avgFrequency.toFixed(0)} Hz` : '—'} />
              <StatCard label="Stability" value={`${analysis.stabilityPercent}%`} color={analysis.stabilityPercent >= 80 ? '#34d399' : analysis.stabilityPercent >= 60 ? '#eab308' : '#ef4444'} />
              <StatCard label="Lowest" value={analysis.lowestNote} />
              <StatCard label="Highest" value={analysis.highestNote} />
            </div>

            {/* Pitch timeline */}
            {analysis.pitchTimeline.length > 0 && (
              <div style={{
                background: '#191a1a', borderRadius: 14, padding: 16,
                marginBottom: 16, height: 100, position: 'relative', overflow: 'hidden',
              }}>
                <p style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
                  color: '#acabaa', letterSpacing: '0.12em', textTransform: 'uppercase',
                  margin: '0 0 8px', position: 'relative', zIndex: 1,
                }}>Pitch Timeline</p>
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
                        <path d={path} fill="none" stroke="#007aff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        <path d={`${path} L ${pts.length - 1} 60 L 0 60 Z`} fill="url(#pitchGrad)" opacity="0.3" />
                        <defs>
                          <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#007aff" />
                            <stop offset="100%" stopColor="#007aff" stopOpacity="0" />
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
                  background: '#191a1a', borderRadius: 14, padding: '16px 18px',
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
                        color: '#e7e5e4',
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
                    color: '#acabaa', margin: 0, lineHeight: 1.6,
                  }}>{insight.detail}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{
            padding: 24, textAlign: 'center', background: '#191a1a', borderRadius: 14,
          }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', margin: 0 }}>
              Could not analyze this recording.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#191a1a', borderRadius: 12, padding: '14px 16px' }}>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700,
        color: '#acabaa', letterSpacing: '0.12em', textTransform: 'uppercase',
        margin: '0 0 4px',
      }}>{label}</p>
      <p style={{
        fontFamily: 'Manrope, sans-serif', fontSize: 20, fontWeight: 700,
        color: color ?? '#e7e5e4', margin: 0,
      }}>{value}</p>
    </div>
  );
}

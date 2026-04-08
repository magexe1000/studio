import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllSessions, saveSession, deleteSession, createLayer, createDefaultEffects, type LabSession, type LabLayer, type TrackEffect } from './labSessionDb';
import { getAllTakes, type TakeRecord } from './takesDb';

const SESSION_ICONS = ['graphic_eq', 'layers', 'multiline_chart', 'equalizer', 'tune', 'mic', 'queue_music', 'stacked_line_chart'];
function randomIcon() { return SESSION_ICONS[Math.floor(Math.random() * SESSION_ICONS.length)]; }
function formatDate(ts: number): string {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}
function formatDur(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function dbToDisplay(v: number) {
  if (v <= 0) return '-∞';
  const db = 20 * Math.log10(v);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

const EFFECT_LABELS: Record<string, { icon: string; label: string }> = {
  reverb: { icon: 'water_drop', label: 'Reverb' },
  delay: { icon: 'schedule', label: 'Delay' },
  chorus: { icon: 'waves', label: 'Chorus' },
  distortion: { icon: 'electric_bolt', label: 'Drive' },
  highpass: { icon: 'filter_alt', label: 'High Pass' },
  lowpass: { icon: 'filter_alt', label: 'Low Pass' },
};

const SOURCE_ICONS: Record<string, string> = {
  recorded: 'mic',
  take: 'video_library',
  file: 'audio_file',
};

async function blobToBuffer(ctx: AudioContext, blob: Blob): Promise<AudioBuffer> {
  const arr = await blob.arrayBuffer();
  return ctx.decodeAudioData(arr);
}

function generateImpulse(ctx: AudioContext, decay: number): AudioBuffer {
  const len = ctx.sampleRate * Math.max(0.5, Math.min(decay, 5));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function buildEffectChain(ctx: AudioContext, effects: TrackEffect[], source: AudioNode, dest: AudioNode) {
  let current = source;
  for (const fx of effects) {
    if (!fx.enabled) continue;
    if (fx.type === 'reverb') {
      const convolver = ctx.createConvolver();
      convolver.buffer = generateImpulse(ctx, fx.params.decay ?? 2);
      const dry = ctx.createGain();
      dry.gain.value = 1 - (fx.params.mix ?? 0.3);
      const wet = ctx.createGain();
      wet.gain.value = fx.params.mix ?? 0.3;
      const merge = ctx.createGain();
      current.connect(dry).connect(merge);
      current.connect(convolver).connect(wet).connect(merge);
      current = merge;
    } else if (fx.type === 'delay') {
      const delay = ctx.createDelay(2);
      delay.delayTime.value = fx.params.time ?? 0.3;
      const feedback = ctx.createGain();
      feedback.gain.value = fx.params.feedback ?? 0.3;
      const dry = ctx.createGain();
      dry.gain.value = 1 - (fx.params.mix ?? 0.25);
      const wet = ctx.createGain();
      wet.gain.value = fx.params.mix ?? 0.25;
      const merge = ctx.createGain();
      current.connect(dry).connect(merge);
      current.connect(delay).connect(feedback).connect(delay);
      delay.connect(wet).connect(merge);
      current = merge;
    } else if (fx.type === 'chorus') {
      const delay = ctx.createDelay(0.05);
      delay.delayTime.value = 0.02;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = fx.params.rate ?? 1.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = (fx.params.depth ?? 0.5) * 0.005;
      lfo.connect(lfoGain).connect(delay.delayTime);
      lfo.start();
      const dry = ctx.createGain();
      dry.gain.value = 1 - (fx.params.mix ?? 0.3);
      const wet = ctx.createGain();
      wet.gain.value = fx.params.mix ?? 0.3;
      const merge = ctx.createGain();
      current.connect(dry).connect(merge);
      current.connect(delay).connect(wet).connect(merge);
      current = merge;
    } else if (fx.type === 'distortion') {
      const ws = ctx.createWaveShaper();
      const amount = (fx.params.amount ?? 0.3) * 100;
      const samples = 44100;
      const curve = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
      }
      ws.curve = curve;
      ws.oversample = '4x';
      const dry = ctx.createGain();
      dry.gain.value = 1 - (fx.params.mix ?? 0.2);
      const wet = ctx.createGain();
      wet.gain.value = fx.params.mix ?? 0.2;
      const merge = ctx.createGain();
      current.connect(dry).connect(merge);
      current.connect(ws).connect(wet).connect(merge);
      current = merge;
    } else if (fx.type === 'highpass') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = fx.params.frequency ?? 200;
      filter.Q.value = fx.params.q ?? 0.7;
      current.connect(filter);
      current = filter;
    } else if (fx.type === 'lowpass') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = fx.params.frequency ?? 8000;
      filter.Q.value = fx.params.q ?? 0.7;
      current.connect(filter);
      current = filter;
    }
  }
  current.connect(dest);
}

function EffectSlider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575', minWidth: 48, textTransform: 'capitalize' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#679cff', height: 3, cursor: 'pointer' }} />
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#484848', minWidth: 28, textAlign: 'right' }}>{value.toFixed(step < 1 ? 1 : 0)}</span>
    </div>
  );
}

function EffectRow({ effect, onChange }: { effect: TrackEffect; onChange: (e: TrackEffect) => void }) {
  const meta = EFFECT_LABELS[effect.type] || { icon: 'tune', label: effect.type };
  const [expanded, setExpanded] = useState(false);
  const paramEntries = Object.entries(effect.params);
  const RANGES: Record<string, [number, number, number]> = {
    mix: [0, 1, 0.05], decay: [0.5, 5, 0.1], time: [0.05, 1, 0.05],
    feedback: [0, 0.9, 0.05], rate: [0.1, 5, 0.1], depth: [0, 1, 0.05],
    amount: [0, 1, 0.05], frequency: [20, 12000, 10], q: [0.1, 10, 0.1],
  };

  return (
    <div style={{ background: '#0e0e0e', borderRadius: 10, overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer',
      }}>
        <button
          onClick={e => { e.stopPropagation(); onChange({ ...effect, enabled: !effect.enabled }); }}
          style={{
            width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer',
            background: effect.enabled ? '#007aff' : '#252626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {effect.enabled && <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#fff' }}>check</span>}
        </button>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: effect.enabled ? '#679cff' : '#484848' }}>{meta.icon}</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, color: effect.enabled ? '#e7e5e4' : '#767575', flex: 1 }}>{meta.label}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#484848', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms ease' }}>expand_more</span>
      </div>
      {expanded && (
        <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {paramEntries.map(([key, val]) => {
            const [mn, mx, st] = RANGES[key] || [0, 1, 0.1];
            return <EffectSlider key={key} label={key} value={val} min={mn} max={mx} step={st}
              onChange={v => onChange({ ...effect, params: { ...effect.params, [key]: v } })} />;
          })}
        </div>
      )}
    </div>
  );
}

function TrackChannel({ layer, hasSolo, onUpdate, onDelete, isPlaying }: {
  layer: LabLayer; hasSolo: boolean; onUpdate: (l: LabLayer) => void; onDelete: () => void; isPlaying: boolean;
}) {
  const [showFx, setShowFx] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(layer.name);
  const isMuted = layer.muted || (hasSolo && !layer.solo);
  const accent = layer.solo ? '#f59e0b' : '#679cff';

  const saveName = () => {
    setEditName(false);
    if (name.trim() && name !== layer.name) onUpdate({ ...layer, name: name.trim() });
    else setName(layer.name);
  };

  return (
    <div style={{
      background: '#161717', borderRadius: 14, padding: '14px 16px',
      border: `1px solid ${isPlaying ? '#007aff30' : '#1f2020'}`,
      transition: 'border-color 200ms ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: '#0e0e0e',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: isMuted ? '#484848' : accent }}>{SOURCE_ICONS[layer.sourceType] || 'mic'}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editName ? (
            <input value={name} onChange={e => setName(e.target.value)} onBlur={saveName}
              onKeyDown={e => e.key === 'Enter' && saveName()} autoFocus
              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, color: '#e7e5e4', background: 'none', border: 'none', borderBottom: '1px solid #007aff', outline: 'none', padding: 0, width: '100%' }} />
          ) : (
            <p onClick={() => setEditName(true)} style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13,
              color: isMuted ? '#484848' : '#e7e5e4', margin: 0, cursor: 'pointer',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{layer.name}</p>
          )}
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#484848', margin: '1px 0 0' }}>
            {formatDur(layer.durationMs)} · {layer.sourceType}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <button onClick={() => onUpdate({ ...layer, muted: !layer.muted })} style={{
            width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: layer.muted ? '#7f2927' : '#252626',
            fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 800,
            color: layer.muted ? '#ff9993' : '#767575',
          }}>M</button>
          <button onClick={() => onUpdate({ ...layer, solo: !layer.solo })} style={{
            width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: layer.solo ? '#f59e0b22' : '#252626',
            fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 800,
            color: layer.solo ? '#f59e0b' : '#767575',
            border: layer.solo ? '1px solid #f59e0b40' : '1px solid transparent',
          }}>S</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#484848' }}>volume_up</span>
        <input type="range" min={0} max={1} step={0.01} value={layer.volume}
          onChange={e => onUpdate({ ...layer, volume: parseFloat(e.target.value) })}
          style={{ flex: 1, accentColor: accent, height: 3, cursor: 'pointer', opacity: isMuted ? 0.3 : 1 }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#484848', minWidth: 42, textAlign: 'right' }}>
          {dbToDisplay(layer.volume)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#484848' }}>swap_horiz</span>
        <input type="range" min={-1} max={1} step={0.01} value={layer.pan}
          onChange={e => onUpdate({ ...layer, pan: parseFloat(e.target.value) })}
          style={{ flex: 1, accentColor: '#a78bfa', height: 3, cursor: 'pointer' }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#484848', minWidth: 28, textAlign: 'right' }}>
          {layer.pan === 0 ? 'C' : layer.pan < 0 ? `L${Math.round(Math.abs(layer.pan) * 100)}` : `R${Math.round(layer.pan * 100)}`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: showFx ? 10 : 0 }}>
        <button onClick={() => setShowFx(!showFx)} style={{
          display: 'flex', alignItems: 'center', gap: 4, background: '#0e0e0e',
          border: '1px solid #1f2020', borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: layer.effects.some(e => e.enabled) ? '#679cff' : '#484848',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>tune</span>
          FX {layer.effects.filter(e => e.enabled).length > 0 && `(${layer.effects.filter(e => e.enabled).length})`}
        </button>
        {confirmDel ? (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button onClick={() => { onDelete(); setConfirmDel(false); }} style={{ background: '#7f2927', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: '#ff9993' }}>Delete</button>
            <button onClick={() => setConfirmDel(false)} style={{ background: '#252626', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: '#acabaa' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#484848', display: 'flex', marginLeft: 'auto' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
          </button>
        )}
      </div>

      {showFx && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {layer.effects.map((fx, i) => (
            <EffectRow key={fx.type} effect={fx} onChange={updated => {
              const newFx = [...layer.effects];
              newFx[i] = updated;
              onUpdate({ ...layer, effects: newFx });
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddTrackSheet({ session, onAdd, onClose }: {
  session: LabSession;
  onAdd: (layer: LabLayer) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'takes' | 'file' | 'record'>('takes');
  const [takes, setTakes] = useState<TakeRecord[]>([]);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getAllTakes().then(setTakes); }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, []);

  const importTake = (take: TakeRecord) => {
    onAdd(createLayer({
      name: take.name,
      audioBlob: take.audioBlob,
      durationMs: take.durationMs,
      sourceType: 'take',
    }));
  };

  const importFile = async (file: File) => {
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const ctx = new AudioContext();
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      onAdd(createLayer({
        name: file.name.replace(/\.[^.]+$/, ''),
        audioBlob: blob,
        durationMs: buf.duration * 1000,
        sourceType: 'file',
      }));
    } finally { ctx.close(); }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const dur = Date.now() - startRef.current;
        onAdd(createLayer({
          name: `Recording ${session.layers.length + 1}`,
          audioBlob: blob,
          durationMs: dur,
          sourceType: 'recorded',
        }));
      };
      recorderRef.current = rec;
      startRef.current = Date.now();
      rec.start(250);
      setRecording(true);
    } catch { /* mic denied */ }
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const tabs = [
    { id: 'takes' as const, label: 'From Takes', icon: 'video_library' },
    { id: 'file' as const, label: 'Audio File', icon: 'audio_file' },
    { id: 'record' as const, label: 'Record', icon: 'mic' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', background: '#191a1a', borderRadius: '20px 20px 0 0',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px' }}>
          <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18, color: '#e7e5e4', margin: 0 }}>Add Track</h3>
          <button onClick={onClose} style={{ background: '#252626', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#acabaa' }}>close</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '8px 20px 12px' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t.id ? '#007aff' : '#252626',
              color: tab === t.id ? '#fff' : '#767575',
              fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700,
              transition: 'all 150ms ease',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
          {tab === 'takes' && (
            takes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#484848' }}>video_library</span>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#767575', margin: '8px 0 0' }}>No takes yet. Record some in the Takes tab first.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {takes.map(take => (
                  <div key={take.id} onClick={() => importTake(take)} style={{
                    background: '#0e0e0e', borderRadius: 10, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    transition: 'background 150ms ease',
                  }}
                    onPointerDown={e => (e.currentTarget.style.background = '#1a1a1a')}
                    onPointerUp={e => (e.currentTarget.style.background = '#0e0e0e')}
                    onPointerLeave={e => (e.currentTarget.style.background = '#0e0e0e')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#679cff' }}>video_library</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, color: '#e7e5e4', margin: 0 }}>{take.name}</p>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575', margin: '1px 0 0' }}>{formatDur(take.durationMs)}</p>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#484848' }}>add_circle</span>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'file' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
              <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); }} />
              <button onClick={() => fileRef.current?.click()} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                width: '100%', padding: '32px 20px', borderRadius: 14,
                background: '#0e0e0e', border: '2px dashed #252626', cursor: 'pointer',
                transition: 'border-color 150ms ease',
              }}
                onPointerDown={e => (e.currentTarget.style.borderColor = '#007aff')}
                onPointerUp={e => (e.currentTarget.style.borderColor = '#252626')}
                onPointerLeave={e => (e.currentTarget.style.borderColor = '#252626')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#679cff' }}>upload_file</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#acabaa' }}>Tap to choose an audio file</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#484848' }}>MP3, WAV, OGG, M4A, WebM</span>
              </button>
            </div>
          )}

          {tab === 'record' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '32px 0' }}>
              {recording ? (
                <>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>Recording...</p>
                  <button onClick={stopRec} style={{
                    width: 64, height: 64, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(239,68,68,0.3)',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#fff', fontVariationSettings: "'FILL' 1" }}>stop</span>
                  </button>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#679cff' }}>mic</span>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', textAlign: 'center' }}>Record a new vocal track directly into this session.</p>
                  <button onClick={startRec} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '14px 24px', borderRadius: 9999,
                    background: 'linear-gradient(135deg, #679cff, #007aff)', border: 'none', cursor: 'pointer',
                    fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff',
                    boxShadow: '0 8px 32px rgba(0,122,255,0.25)',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>mic</span>
                    Start Recording
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MixerView({ session, onBack, onUpdate }: {
  session: LabSession; onBack: () => void; onUpdate: (s: LabSession) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(session.name);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const startTimeRef = useRef(0);
  const animRef = useRef(0);

  const hasSolo = session.layers.some(l => l.solo);
  const maxDuration = Math.max(...session.layers.map(l => l.durationMs), 0);

  const saveName = () => {
    setEditingName(false);
    if (name.trim() && name !== session.name) {
      const updated = { ...session, name: name.trim(), updatedAt: Date.now() };
      saveSession(updated).then(() => onUpdate(updated));
    } else setName(session.name);
  };

  const updateLayer = (updated: LabLayer) => {
    const newSession = { ...session, layers: session.layers.map(l => l.id === updated.id ? updated : l), updatedAt: Date.now() };
    saveSession(newSession).then(() => onUpdate(newSession));
  };

  const removeLayer = (id: string) => {
    const newSession = { ...session, layers: session.layers.filter(l => l.id !== id), updatedAt: Date.now() };
    saveSession(newSession).then(() => onUpdate(newSession));
  };

  const addLayer = (layer: LabLayer) => {
    const newSession = { ...session, layers: [...session.layers, layer], updatedAt: Date.now() };
    saveSession(newSession).then(() => onUpdate(newSession));
    setShowAddSheet(false);
  };

  const handleDelete = async () => {
    await deleteSession(session.id);
    onBack();
  };

  const updateMasterVol = (v: number) => {
    const updated = { ...session, masterVolume: v, updatedAt: Date.now() };
    saveSession(updated).then(() => onUpdate(updated));
  };

  const stopPlayback = useCallback(() => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    sourcesRef.current = [];
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  const playAll = useCallback(async () => {
    if (playing) { stopPlayback(); return; }
    const audibleLayers = session.layers.filter(l => {
      if (l.muted) return false;
      if (hasSolo && !l.solo) return false;
      return true;
    });
    if (audibleLayers.length === 0) return;

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = session.masterVolume ?? 0.8;
    master.connect(ctx.destination);

    const sources: AudioBufferSourceNode[] = [];
    for (const layer of audibleLayers) {
      try {
        const buffer = await blobToBuffer(ctx, layer.audioBlob);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = layer.volume;
        const panner = ctx.createStereoPanner();
        panner.pan.value = layer.pan;
        source.connect(gain);
        buildEffectChain(ctx, layer.effects, gain, panner);
        panner.connect(master);
        sources.push(source);
      } catch {}
    }

    sourcesRef.current = sources;
    startTimeRef.current = ctx.currentTime;
    sources.forEach(s => s.start());
    setPlaying(true);

    const longestMs = Math.max(...audibleLayers.map(l => l.durationMs));
    const tick = () => {
      if (!ctxRef.current) return;
      const elapsed = (ctxRef.current.currentTime - startTimeRef.current) * 1000;
      setCurrentTime(elapsed);
      if (elapsed >= longestMs) { stopPlayback(); return; }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    sources.forEach(s => { s.onended = () => {
      if (sources.every(src => src.context.state === 'closed' || !ctxRef.current)) return;
    }; });
  }, [playing, session, hasSolo, stopPlayback]);

  useEffect(() => {
    return () => { stopPlayback(); };
  }, [stopPlayback]);

  return (
    <div style={{ padding: '16px 20px', paddingBottom: 120, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => { stopPlayback(); onBack(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#acabaa', fontFamily: 'Inter, sans-serif', fontSize: 13, padding: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span> Back
        </button>
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleDelete} style={{ background: '#7f2927', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#ff9993' }}>Delete</button>
            <button onClick={() => setConfirmDelete(false)} style={{ background: '#252626', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#acabaa' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#484848', display: 'flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#679cff' }}>{session.icon}</span>
        </div>
        {editingName ? (
          <input value={name} onChange={e => setName(e.target.value)} onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()} autoFocus
            style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 24, color: '#e7e5e4', background: 'none', border: 'none', borderBottom: '2px solid #007aff', outline: 'none', padding: '0 0 4px', width: '100%', letterSpacing: '-0.02em' }} />
        ) : (
          <h2 onClick={() => setEditingName(true)} style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 24, color: '#e7e5e4', margin: '0 0 4px', cursor: 'pointer', letterSpacing: '-0.02em' }}>{session.name}</h2>
        )}
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#767575', margin: 0 }}>
          {session.layers.length} {session.layers.length === 1 ? 'track' : 'tracks'} · {formatDur(maxDuration)}
        </p>
      </div>

      <div style={{
        background: '#0e0e0e', borderRadius: 14, padding: '14px 16px', marginBottom: 16,
        border: '1px solid #1f2020',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button onClick={playAll} style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: playing ? '#ef4444' : 'linear-gradient(135deg, #679cff, #007aff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: playing ? '0 4px 20px rgba(239,68,68,0.3)' : '0 4px 20px rgba(0,122,255,0.25)',
            transition: 'all 200ms ease',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#fff', fontVariationSettings: "'FILL' 1" }}>
              {playing ? 'stop' : 'play_arrow'}
            </span>
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, color: '#e7e5e4', margin: 0 }}>
              {playing ? 'Playing' : 'Ready'}
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#484848', margin: '2px 0 0' }}>
              {formatDur(currentTime)} / {formatDur(maxDuration)}
            </p>
          </div>
        </div>

        {maxDuration > 0 && (
          <div style={{ height: 3, borderRadius: 2, background: '#252626', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, #679cff, #007aff)',
              width: `${Math.min((currentTime / maxDuration) * 100, 100)}%`,
              transition: playing ? 'none' : 'width 200ms ease',
            }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: '#767575', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Master</span>
          <input type="range" min={0} max={1} step={0.01} value={session.masterVolume ?? 0.8}
            onChange={e => updateMasterVol(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#679cff', height: 3, cursor: 'pointer' }} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#484848', minWidth: 42, textAlign: 'right' }}>
            {dbToDisplay(session.masterVolume ?? 0.8)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#767575', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tracks</span>
        <button onClick={() => setShowAddSheet(true)} style={{
          display: 'flex', alignItems: 'center', gap: 4, background: '#252626', border: 'none',
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#679cff',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          Add Track
        </button>
      </div>

      {session.layers.length === 0 ? (
        <div style={{ background: '#161717', borderRadius: 14, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#484848' }}>queue_music</span>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#767575', margin: 0, textAlign: 'center' }}>No tracks yet. Add a take, record something, or import an audio file.</p>
          <button onClick={() => setShowAddSheet(true)} style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 9999,
            background: 'linear-gradient(135deg, #679cff, #007aff)', border: 'none', cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Add First Track
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {session.layers.map(layer => (
            <TrackChannel key={layer.id} layer={layer} hasSolo={hasSolo} isPlaying={playing}
              onUpdate={updateLayer} onDelete={() => removeLayer(layer.id)} />
          ))}
        </div>
      )}

      {showAddSheet && <AddTrackSheet session={session} onAdd={addLayer} onClose={() => setShowAddSheet(false)} />}
    </div>
  );
}

function SessionCard({ session, onOpen, onDelete }: {
  session: LabSession; onOpen: (s: LabSession) => void; onDelete: (id: string) => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div style={{
      background: '#1f2020', borderRadius: 14, padding: '16px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'background 150ms ease', cursor: 'pointer',
    }}
      onClick={() => onOpen(session)}
      onPointerDown={e => (e.currentTarget.style.background = '#2c2c2c')}
      onPointerUp={e => (e.currentTarget.style.background = '#1f2020')}
      onPointerLeave={e => (e.currentTarget.style.background = '#1f2020')}
    >
      <div style={{ width: 42, height: 42, borderRadius: 10, background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#679cff' }}>{session.icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: '#e7e5e4', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.name}</h4>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: '#767575', margin: 0 }}>
          {session.layers.length} {session.layers.length === 1 ? 'track' : 'tracks'} · {formatDate(session.createdAt)}
        </p>
      </div>
      {confirmDel ? (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { onDelete(session.id); setConfirmDel(false); }} style={{ background: '#7f2927', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#ff9993' }}>Delete</button>
          <button onClick={() => setConfirmDel(false)} style={{ background: '#252626', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#acabaa' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={e => { e.stopPropagation(); setConfirmDel(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#484848', display: 'flex', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
        </button>
      )}
    </div>
  );
}

export default function LabPanel() {
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeSession, setActiveSession] = useState<LabSession | null>(null);
  const [showAll, setShowAll] = useState(false);

  const loadSessions = useCallback(async () => {
    const all = await getAllSessions();
    setSessions(all);
    setLoaded(true);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const createSession = async () => {
    const session: LabSession = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: `Session ${sessions.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      layers: [],
      icon: randomIcon(),
      masterVolume: 0.8,
    };
    await saveSession(session);
    await loadSessions();
    setActiveSession(session);
  };

  const handleUpdate = (updated: LabSession) => {
    setActiveSession(updated);
    loadSessions();
  };

  const handleBack = () => {
    setActiveSession(null);
    loadSessions();
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    loadSessions();
  };

  if (activeSession) {
    return <MixerView session={activeSession} onBack={handleBack} onUpdate={handleUpdate} />;
  }

  const displaySessions = showAll ? sessions : sessions.slice(0, 6);

  return (
    <div style={{ padding: '20px 20px 40px', minHeight: '100%' }}>
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 34, letterSpacing: '-0.03em', color: '#e7e5e4', margin: '0 0 8px', lineHeight: 1 }}>Lab</h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#acabaa', margin: 0, lineHeight: 1.6, maxWidth: 320 }}>
          Build harmonies, layer vocals, add effects, and mix everything together.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <button onClick={createSession} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(135deg, #679cff, #007aff)',
          border: 'none', cursor: 'pointer', padding: '14px 24px',
          borderRadius: 9999, fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14,
          color: '#fff', letterSpacing: '0.02em',
          boxShadow: '0 8px 32px rgba(0,122,255,0.25)',
          transition: 'transform 100ms ease',
        }}
          onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
          onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, fontWeight: 700 }}>add</span>
          New Session
        </button>
      </section>

      {loaded && sessions.length > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 18, color: '#e7e5e4', margin: 0 }}>Sessions</h3>
            {sessions.length > 6 && (
              <button onClick={() => setShowAll(!showAll)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#679cff',
                textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>
                {showAll ? 'Show Less' : 'View All'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {displaySessions.map(s => (
              <SessionCard key={s.id} session={s} onOpen={setActiveSession} onDelete={handleDeleteSession} />
            ))}
          </div>
        </section>
      )}

      {loaded && sessions.length === 0 && (
        <section style={{ textAlign: 'center', padding: '40px 0' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#484848', marginBottom: 8 }}>science</span>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#767575', margin: '8px 0 0' }}>
            Create your first session to start mixing.
          </p>
        </section>
      )}
    </div>
  );
}

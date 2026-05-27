import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MicWavesLottie from '../components/lottie/MicWavesLottie';
import { getAllSessions, saveSession, deleteSession, createLayer, createDefaultEffects, type LabSession, type LabLayer, type TrackEffect } from './labSessionDb';
import { getAllTakes, type TakeRecord } from './takesDb';
import { useT } from '../lib/useT';
import { setVocalexBack } from './headerBack';
import { createAudioContext } from '../lib/audioContextOptions';
import HarmonizerSheet from './HarmonizerSheet';

const SESSION_ICONS = ['graphic_eq', 'layers', 'multiline_chart', 'equalizer', 'tune', 'mic', 'queue_music', 'stacked_line_chart'];
function randomIcon() { return SESSION_ICONS[Math.floor(Math.random() * SESSION_ICONS.length)]; }
function formatDate(ts: number, months: readonly string[]): string {
  const d = new Date(ts);
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

const EFFECT_ICONS: Record<string, string> = {
  reverb: 'water_drop',
  delay: 'schedule',
  chorus: 'waves',
  distortion: 'electric_bolt',
  highpass: 'filter_alt',
  lowpass: 'filter_alt',
};

function getEffectLabel(key: string, t: any): { icon: string; label: string } {
  const labelMap: Record<string, string> = {
    reverb: t.vocalex.effectReverb,
    delay: t.vocalex.effectDelay,
    chorus: t.vocalex.effectChorus,
    distortion: t.vocalex.effectDrive,
    highpass: t.vocalex.effectHighPass,
    lowpass: t.vocalex.effectLowPass,
  };
  return { icon: EFFECT_ICONS[key] ?? 'tune', label: labelMap[key] ?? key };
}

const SOURCE_ICONS: Record<string, string> = {
  recorded: 'mic',
  take: 'video_library',
  file: 'audio_file',
};

const LAB_ANIM_CSS = `
@keyframes lab-fx-expand {
  from { opacity: 0; max-height: 0; transform: translateY(-4px); }
  to   { opacity: 1; max-height: 500px; transform: translateY(0); }
}
@keyframes lab-fx-row-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes lab-slider-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.02); }
  100% { transform: scale(1); }
}
@keyframes lab-param-expand {
  from { opacity: 0; max-height: 0; }
  to   { opacity: 1; max-height: 300px; }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

function useLabAnimStyle() {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const s = document.createElement('style');
    s.textContent = LAB_ANIM_CSS;
    document.head.appendChild(s);
    return () => { s.remove(); injected.current = false; };
  }, []);
}

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

interface TrackNodes {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
  effectInputGain: GainNode;
  effectNodes: AudioNode[];
  effectOutputGain: GainNode;
}

function connectEffectChain(ctx: AudioContext, effects: TrackEffect[], input: AudioNode, output: AudioNode) {
  const nodes: AudioNode[] = [];
  let current = input;
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
      nodes.push(convolver, dry, wet, merge);
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
      nodes.push(delay, feedback, dry, wet, merge);
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
      nodes.push(delay, lfo, lfoGain, dry, wet, merge);
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
      nodes.push(ws, dry, wet, merge);
      current = merge;
    } else if (fx.type === 'highpass') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = fx.params.frequency ?? 200;
      filter.Q.value = fx.params.q ?? 0.7;
      current.connect(filter);
      nodes.push(filter);
      current = filter;
    } else if (fx.type === 'lowpass') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = fx.params.frequency ?? 8000;
      filter.Q.value = fx.params.q ?? 0.7;
      current.connect(filter);
      nodes.push(filter);
      current = filter;
    }
  }
  current.connect(output);
  return nodes;
}

function disconnectNodes(nodes: AudioNode[]) {
  for (const n of nodes) {
    try { n.disconnect(); } catch {}
    if (n instanceof OscillatorNode) { try { n.stop(); } catch {} }
  }
}

function rebuildTrackEffects(ctx: AudioContext, track: TrackNodes, effects: TrackEffect[]) {
  try { track.effectInputGain.disconnect(); } catch {}
  disconnectNodes(track.effectNodes);
  try { track.effectOutputGain.disconnect(); } catch {}

  track.effectNodes = connectEffectChain(ctx, effects, track.effectInputGain, track.effectOutputGain);
  track.effectOutputGain.connect(track.pannerNode);
}

function EffectSlider({ label, value, min, max, step, onChange, accentColor }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; accentColor?: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'lab-fx-row-in 250ms cubic-bezier(0.22,1,0.36,1) both',
    }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--vx-text-3)', minWidth: 48, textTransform: 'capitalize' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: accentColor || '#679cff', height: 3, cursor: 'pointer', transition: 'opacity 150ms ease' }} />
      <span style={{
        fontFamily: 'Inter, sans-serif', fontSize: 9, color: 'var(--vx-text-4)', minWidth: 28, textAlign: 'right',
        transition: 'color 150ms ease',
      }}>{value.toFixed(step < 1 ? 1 : 0)}</span>
    </div>
  );
}

function EffectRow({ effect, onChange, index }: { effect: TrackEffect; onChange: (e: TrackEffect) => void; index: number }) {
  const t = useT();
  const meta = getEffectLabel(effect.type, t);
  const [expanded, setExpanded] = useState(false);
  const paramEntries = Object.entries(effect.params);
  const RANGES: Record<string, [number, number, number]> = {
    mix: [0, 1, 0.05], decay: [0.5, 5, 0.1], time: [0.05, 1, 0.05],
    feedback: [0, 0.9, 0.05], rate: [0.1, 5, 0.1], depth: [0, 1, 0.05],
    amount: [0, 1, 0.05], frequency: [20, 12000, 10], q: [0.1, 10, 0.1],
  };

  return (
    <div style={{
      background: 'var(--vx-deep)', borderRadius: 10, overflow: 'hidden',
      animation: `lab-fx-row-in 300ms cubic-bezier(0.22,1,0.36,1) ${index * 40}ms both`,
      transition: 'box-shadow 200ms ease',
      boxShadow: effect.enabled ? '0 0 12px rgba(103,156,255,0.05)' : 'none',
    }}>
      <div onClick={() => setExpanded(!expanded)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer',
        transition: 'background 150ms ease',
        background: expanded ? '#121313' : 'transparent',
      }}>
        <button
          onClick={e => { e.stopPropagation(); onChange({ ...effect, enabled: !effect.enabled }); }}
          style={{
            width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer',
            background: effect.enabled ? '#007aff' : 'var(--vx-input)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 200ms ease, transform 150ms cubic-bezier(0.34,1.56,0.64,1)',
            transform: effect.enabled ? 'scale(1)' : 'scale(0.9)',
          }}
        >
          {effect.enabled && <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#fff' }}>check</span>}
        </button>
        <span className="material-symbols-outlined" style={{
          fontSize: 14,
          color: effect.enabled ? '#679cff' : 'var(--vx-text-4)',
          transition: 'color 200ms ease',
        }}>{meta.icon}</span>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
          color: effect.enabled ? 'var(--vx-text)' : 'var(--vx-text-3)', flex: 1,
          transition: 'color 200ms ease',
        }}>{meta.label}</span>
        <span className="material-symbols-outlined" style={{
          fontSize: 14, color: 'var(--vx-text-4)',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>expand_more</span>
      </div>
      <div style={{
        overflow: 'hidden',
        maxHeight: expanded ? 300 : 0,
        opacity: expanded ? 1 : 0,
        transition: 'max-height 350ms cubic-bezier(0.22,1,0.36,1), opacity 250ms ease',
      }}>
        <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {paramEntries.map(([key, val]) => {
            const [mn, mx, st] = RANGES[key] || [0, 1, 0.1];
            return <EffectSlider key={key} label={key} value={val} min={mn} max={mx} step={st}
              onChange={v => onChange({ ...effect, params: { ...effect.params, [key]: v } })} />;
          })}
        </div>
      </div>
    </div>
  );
}

function TrackChannel({ layer, hasSolo, onUpdate, onDelete, onHarmonize, isPlaying }: {
  layer: LabLayer; hasSolo: boolean; onUpdate: (l: LabLayer) => void; onDelete: () => void;
  onHarmonize: () => void; isPlaying: boolean;
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
      background: 'var(--vx-card)', borderRadius: 14, padding: '14px 16px',
      border: `1px solid ${isPlaying ? '#007aff30' : 'var(--vx-edge)'}`,
      transition: 'border-color 300ms ease, box-shadow 300ms ease',
      boxShadow: isPlaying ? '0 0 16px rgba(0,122,255,0.06)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: 'var(--vx-deep)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span className="material-symbols-outlined" style={{
            fontSize: 16, color: isMuted ? 'var(--vx-text-4)' : accent,
            transition: 'color 200ms ease',
          }}>{SOURCE_ICONS[layer.sourceType] || 'mic'}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editName ? (
            <input value={name} onChange={e => setName(e.target.value)} onBlur={saveName}
              onKeyDown={e => e.key === 'Enter' && saveName()} autoFocus
              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--vx-text)', background: 'none', border: 'none', borderBottom: '1px solid #007aff', outline: 'none', padding: 0, width: '100%' }} />
          ) : (
            <p onClick={() => setEditName(true)} style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13,
              color: isMuted ? 'var(--vx-text-4)' : 'var(--vx-text)', margin: 0, cursor: 'pointer',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'color 200ms ease',
            }}>{layer.name}</p>
          )}
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: 'var(--vx-text-4)', margin: '1px 0 0' }}>
            {formatDur(layer.durationMs)} · {layer.sourceType}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <button onClick={() => onUpdate({ ...layer, muted: !layer.muted })} style={{
            width: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
            background: layer.muted ? '#7f2927' : 'var(--vx-input)',
            fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 800,
            color: layer.muted ? '#ff9993' : 'var(--vx-text-3)',
            transition: 'background 200ms ease, color 200ms ease, transform 100ms ease',
          }}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
            onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >M</button>
          <button onClick={() => onUpdate({ ...layer, solo: !layer.solo })} style={{
            width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
            background: layer.solo ? '#f59e0b22' : 'var(--vx-input)',
            fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 800,
            color: layer.solo ? '#f59e0b' : 'var(--vx-text-3)',
            border: layer.solo ? '1px solid #f59e0b40' : '1px solid transparent',
            transition: 'background 200ms ease, color 200ms ease, border-color 200ms ease, transform 100ms ease',
          }}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
            onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >S</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{
          fontSize: 14, color: 'var(--vx-text-4)',
          transition: 'color 150ms ease',
          ...(isMuted ? {} : { color: '#5a5a5a' }),
        }}>volume_up</span>
        <input type="range" min={0} max={1} step={0.01} value={layer.volume}
          onChange={e => onUpdate({ ...layer, volume: parseFloat(e.target.value) })}
          style={{
            flex: 1, accentColor: accent, height: 3, cursor: 'pointer',
            opacity: isMuted ? 0.3 : 1,
            transition: 'opacity 200ms ease',
          }} />
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 9, color: 'var(--vx-text-4)', minWidth: 42, textAlign: 'right',
          transition: 'color 150ms ease',
        }}>
          {dbToDisplay(layer.volume)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--vx-text-4)' }}>swap_horiz</span>
        <input type="range" min={-1} max={1} step={0.01} value={layer.pan}
          onChange={e => onUpdate({ ...layer, pan: parseFloat(e.target.value) })}
          style={{ flex: 1, accentColor: '#a78bfa', height: 3, cursor: 'pointer' }} />
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 9, color: 'var(--vx-text-4)', minWidth: 28, textAlign: 'right',
          transition: 'color 150ms ease',
        }}>
          {layer.pan === 0 ? 'C' : layer.pan < 0 ? `L${Math.round(Math.abs(layer.pan) * 100)}` : `R${Math.round(layer.pan * 100)}`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: showFx ? 10 : 0, transition: 'margin-bottom 200ms ease' }}>
        <button onClick={() => setShowFx(!showFx)} style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'var(--vx-deep)',
          border: '1px solid var(--vx-edge)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700,
          color: layer.effects.some(e => e.enabled) ? '#679cff' : 'var(--vx-text-4)',
          transition: 'color 200ms ease, border-color 200ms ease, transform 100ms ease',
          borderColor: showFx ? '#679cff30' : 'var(--vx-edge)',
        }}
          onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
          onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span className="material-symbols-outlined" style={{
            fontSize: 12,
            transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1)',
            transform: showFx ? 'rotate(90deg)' : 'rotate(0)',
          }}>tune</span>
          FX {layer.effects.filter(e => e.enabled).length > 0 && `(${layer.effects.filter(e => e.enabled).length})`}
        </button>

        <button onClick={onHarmonize} style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(103,156,255,0.10)',
          border: '1px solid rgba(103,156,255,0.22)', borderRadius: 6, padding: '4px 9px', cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: '#679cff',
          transition: 'background 150ms ease, transform 100ms ease',
        }}
          onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
          onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>graphic_eq</span>
          Harmonize
        </button>

        {confirmDel ? (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button onClick={() => { onDelete(); setConfirmDel(false); }} style={{ background: '#7f2927', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: '#ff9993' }}>Delete</button>
            <button onClick={() => setConfirmDel(false)} style={{ background: 'var(--vx-input)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: 'var(--vx-text-2)' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--vx-text-4)', display: 'flex', marginLeft: 'auto' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
          </button>
        )}
      </div>

      <div style={{
        overflow: 'hidden',
        maxHeight: showFx ? 1000 : 0,
        opacity: showFx ? 1 : 0,
        transition: 'max-height 400ms cubic-bezier(0.22,1,0.36,1), opacity 300ms ease',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {layer.effects.map((fx, i) => (
            <EffectRow key={fx.type} effect={fx} index={i} onChange={updated => {
              const newFx = [...layer.effects];
              newFx[i] = updated;
              onUpdate({ ...layer, effects: newFx });
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AddTrackSheet({ session, onAdd, onClose }: {
  session: LabSession;
  onAdd: (layer: LabLayer) => void;
  onClose: () => void;
}) {
  const t = useT();
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
    const ctx = createAudioContext();
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
      rec.start();
      setRecording(true);
    } catch {}
  };

  const stopRec = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500, maxHeight: '70vh', overflow: 'auto',
          background: 'var(--vx-card)', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--vx-text)', margin: 0 }}>{t.vocalex.addTrack}</h3>
          <button onClick={onClose} style={{ background: 'var(--vx-input)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--vx-text-3)' }}>close</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--vx-deep)', borderRadius: 10, padding: 3 }}>
          {(['takes', 'file', 'record'] as const).map(tabKey => {
            const tabLabels: Record<string, string> = { takes: t.vocalex.tabTakes, file: t.vocalex.tabFile, record: t.vocalex.tabRecord };
            return (
            <button key={tabKey} onClick={() => setTab(tabKey)} style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700,
              background: tab === tabKey ? 'var(--vx-input)' : 'transparent',
              color: tab === tabKey ? 'var(--vx-text)' : 'var(--vx-text-3)',
              textTransform: 'capitalize',
              transition: 'background 200ms ease, color 200ms ease',
            }}>
              {tabLabels[tabKey]}
            </button>
            );
          })}
        </div>

        {tab === 'takes' && (
          takes.length === 0 ? (
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-3)', textAlign: 'center', padding: '20px 0' }}>{t.vocalex.noTakesForImport}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {takes.map(take => (
                <div key={take.id} onClick={() => importTake(take)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  background: 'var(--vx-deep)', borderRadius: 10, cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
                  onPointerDown={e => (e.currentTarget.style.background = '#1a1a1a')}
                  onPointerUp={e => (e.currentTarget.style.background = 'var(--vx-deep)')}
                  onPointerLeave={e => (e.currentTarget.style.background = 'var(--vx-deep)')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#679cff' }}>video_library</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--vx-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{take.name}</p>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--vx-text-3)', margin: '1px 0 0' }}>{formatDur(take.durationMs)}</p>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--vx-text-4)' }}>add_circle</span>
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
              background: 'var(--vx-deep)', border: '2px dashed var(--vx-input)', cursor: 'pointer',
              transition: 'border-color 150ms ease',
            }}
              onPointerDown={e => (e.currentTarget.style.borderColor = '#007aff')}
              onPointerUp={e => (e.currentTarget.style.borderColor = 'var(--vx-input)')}
              onPointerLeave={e => (e.currentTarget.style.borderColor = 'var(--vx-input)')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#679cff' }}>upload_file</span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--vx-text-2)' }}>{t.vocalex.tapToChooseAudio}</span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--vx-text-4)' }}>{t.vocalex.audioFormats}</span>
            </button>
          </div>
        )}

        {tab === 'record' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '32px 0' }}>
            {recording ? (
              <>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>{t.vocalex.recording}</p>
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
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-2)', textAlign: 'center' }}>{t.vocalex.recordPrompt}</p>
                <button onClick={startRec} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '14px 24px', borderRadius: 9999,
                  background: 'linear-gradient(135deg, #679cff, #007aff)', border: 'none', cursor: 'pointer',
                  fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff',
                  boxShadow: '0 8px 32px rgba(0,122,255,0.25)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>mic</span>
                  {t.vocalex.startRecording}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MixerView({ session, sessionNumber, onBack, onUpdate }: {
  session: LabSession; sessionNumber: number; onBack: () => void; onUpdate: (s: LabSession) => void;
}) {
  useLabAnimStyle();
  const t = useT();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(session.name);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [harmonizingLayer, setHarmonizingLayer] = useState<LabLayer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const trackNodesRef = useRef<Map<string, TrackNodes>>(new Map());
  const masterGainRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef(0);
  const animRef = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const hasSolo = session.layers.some(l => l.solo);
  const maxDuration = Math.max(...session.layers.map(l => l.durationMs), 0);

  const saveName = () => {
    setEditingName(false);
    if (name.trim() && name !== session.name) {
      const updated = { ...session, name: name.trim(), updatedAt: Date.now() };
      saveSession(updated).then(() => onUpdate(updated));
    } else setName(session.name);
  };

  const saveAndNotify = useCallback((newSession: LabSession) => {
    saveSession(newSession).then(() => onUpdate(newSession));
  }, [onUpdate]);

  const updateLayer = useCallback((updated: LabLayer) => {
    const cur = sessionRef.current;
    const newSession = { ...cur, layers: cur.layers.map(l => l.id === updated.id ? updated : l), updatedAt: Date.now() };

    if (ctxRef.current && playing) {
      const nodes = trackNodesRef.current.get(updated.id);
      if (nodes) {
        const ctx = ctxRef.current;
        const oldLayer = cur.layers.find(l => l.id === updated.id);

        const newHasSolo = newSession.layers.some(l => l.solo);
        const isAudible = !updated.muted && (!newHasSolo || updated.solo);
        nodes.gainNode.gain.setTargetAtTime(isAudible ? updated.volume : 0, ctx.currentTime, 0.015);
        nodes.pannerNode.pan.setTargetAtTime(updated.pan, ctx.currentTime, 0.015);

        const fxChanged = !oldLayer ||
          JSON.stringify(oldLayer.effects) !== JSON.stringify(updated.effects);
        if (fxChanged) {
          rebuildTrackEffects(ctx, nodes, updated.effects);
        }

        for (const [id, tn] of trackNodesRef.current) {
          if (id === updated.id) continue;
          const lay = newSession.layers.find(l => l.id === id);
          if (!lay) continue;
          const aud = !lay.muted && (!newHasSolo || lay.solo);
          tn.gainNode.gain.setTargetAtTime(aud ? lay.volume : 0, ctx.currentTime, 0.015);
        }
      }
    }

    saveAndNotify(newSession);
  }, [playing, saveAndNotify]);

  const removeLayer = (id: string) => {
    const newSession = { ...session, layers: session.layers.filter(l => l.id !== id), updatedAt: Date.now() };
    saveAndNotify(newSession);
  };

  const addLayer = (layer: LabLayer) => {
    const newSession = { ...session, layers: [...session.layers, layer], updatedAt: Date.now() };
    saveAndNotify(newSession);
    setShowAddSheet(false);
  };

  const handleDelete = async () => {
    await deleteSession(session.id);
    onBack();
  };

  const updateMasterVol = useCallback((v: number) => {
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(v, ctxRef.current.currentTime, 0.015);
    }
    const updated = { ...sessionRef.current, masterVolume: v, updatedAt: Date.now() };
    saveAndNotify(updated);
  }, [saveAndNotify]);

  const stopPlayback = useCallback(() => {
    for (const [, nodes] of trackNodesRef.current) {
      try { nodes.source.stop(); } catch {}
      try { nodes.source.disconnect(); } catch {}
      disconnectNodes(nodes.effectNodes);
    }
    trackNodesRef.current.clear();
    masterGainRef.current = null;
    if (ctxRef.current) { ctxRef.current.close(); ctxRef.current = null; }
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
    setCurrentTime(0);
  }, []);

  const playAll = useCallback(async () => {
    if (playing) { stopPlayback(); return; }
    const cur = sessionRef.current;
    if (cur.layers.length === 0) return;

    const ctx = createAudioContext();
    ctxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = cur.masterVolume ?? 0.8;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    const curHasSolo = cur.layers.some(l => l.solo);
    const nodeMap = new Map<string, TrackNodes>();

    for (const layer of cur.layers) {
      try {
        const buffer = await blobToBuffer(ctx, layer.audioBlob);
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = ctx.createGain();
        const isAudible = !layer.muted && (!curHasSolo || layer.solo);
        gainNode.gain.value = isAudible ? layer.volume : 0;

        const pannerNode = ctx.createStereoPanner();
        pannerNode.pan.value = layer.pan;

        const effectInputGain = ctx.createGain();
        effectInputGain.gain.value = 1;
        const effectOutputGain = ctx.createGain();
        effectOutputGain.gain.value = 1;

        source.connect(gainNode);
        gainNode.connect(effectInputGain);
        const effectNodes = connectEffectChain(ctx, layer.effects, effectInputGain, effectOutputGain);
        effectOutputGain.connect(pannerNode);
        pannerNode.connect(master);

        const trackNode: TrackNodes = { source, gainNode, pannerNode, effectInputGain, effectNodes, effectOutputGain };
        nodeMap.set(layer.id, trackNode);
      } catch {}
    }

    trackNodesRef.current = nodeMap;
    startTimeRef.current = ctx.currentTime;
    for (const [, nodes] of nodeMap) { nodes.source.start(); }
    setPlaying(true);

    const longestMs = Math.max(...cur.layers.map(l => l.durationMs));
    const tick = () => {
      if (!ctxRef.current) return;
      const elapsed = (ctxRef.current.currentTime - startTimeRef.current) * 1000;
      setCurrentTime(elapsed);
      if (elapsed >= longestMs) { stopPlayback(); return; }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, [playing, stopPlayback]);

  useEffect(() => {
    return () => { stopPlayback(); };
  }, [stopPlayback]);

  useEffect(() => {
    const handler = () => { stopPlayback(); onBack(); };
    setVocalexBack(handler);
    return () => setVocalexBack(null);
  }, [onBack, stopPlayback]);

  // Format the session number with a leading zero (01, 02, ...) so it always
  // takes the same visual space — the header tag stays consistent in width.
  const sessionTag = `#${String(sessionNumber).padStart(2, '0')}`;

  return (
    <div style={{ padding: '16px 20px', paddingBottom: 120, minHeight: '100%' }}>

      {/* ── Session header ─────────────────────────────────────────────
          Single coherent block with: session icon, session number tag,
          editable session name (with explicit pencil affordance), and
          the delete control on the right. ─────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--vx-deep)', border: '1px solid var(--vx-edge)',
        borderRadius: 16, padding: '12px 14px', marginBottom: 16,
      }}>
        {/* Icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(103,156,255,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#679cff' }}>{session.icon}</span>
        </div>

        {/* Number + name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 800,
            color: '#679cff', letterSpacing: '0.12em', textTransform: 'uppercase',
            margin: 0, lineHeight: 1,
          }}>
            {t.vocalex.session ?? 'Session'} {sessionTag}
          </p>
          {editingName ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setName(session.name); setEditingName(false); } }}
              autoFocus
              maxLength={48}
              style={{
                fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18,
                color: 'var(--vx-text)', background: 'none',
                border: 'none', borderBottom: '2px solid #679cff',
                outline: 'none', padding: '2px 0',
                width: '100%', letterSpacing: '-0.02em', marginTop: 4,
              }}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              title="Rename session"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', padding: '2px 0', marginTop: 2,
                cursor: 'pointer', color: 'var(--vx-text)',
                width: '100%', textAlign: 'left',
              }}
            >
              <span style={{
                fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18,
                letterSpacing: '-0.02em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, minWidth: 0,
              }}>
                {session.name}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--vx-text-4)', flexShrink: 0 }}>edit</span>
            </button>
          )}
        </div>

        {/* Delete (with inline confirm) */}
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={handleDelete} style={{ background: '#7f2927', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#ff9993' }}>{t.vocalex.deleteTake}</button>
            <button onClick={() => setConfirmDelete(false)} style={{ background: 'var(--vx-input)', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--vx-text-2)' }}>{t.vocalex.cancelAction}</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete session"
            style={{
              flexShrink: 0,
              width: 36, height: 36, borderRadius: 10,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--vx-text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 150ms ease, color 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--vx-text-3)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
          </button>
        )}
      </div>

      {/* Meta line — track count + total duration */}
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--vx-text-3)', margin: '0 0 16px 4px' }}>
        {t.vocalex.trackCount(session.layers.length)} · {formatDur(maxDuration)}
      </p>

      <div style={{
        background: 'var(--vx-deep)', borderRadius: 14, padding: '14px 16px', marginBottom: 16,
        border: '1px solid var(--vx-edge)',
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
            <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--vx-text)', margin: 0 }}>
              {playing ? t.vocalex.playing : t.vocalex.ready}
            </p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--vx-text-4)', margin: '2px 0 0' }}>
              {formatDur(currentTime)} / {formatDur(maxDuration)}
            </p>
          </div>
        </div>

        {maxDuration > 0 && (
          <div style={{ height: 3, borderRadius: 2, background: 'var(--vx-input)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, #679cff, #007aff)',
              width: `${Math.min((currentTime / maxDuration) * 100, 100)}%`,
              transition: playing ? 'none' : 'width 200ms ease',
            }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 700, color: 'var(--vx-text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.vocalex.master}</span>
          <input type="range" min={0} max={1} step={0.01} value={session.masterVolume ?? 0.8}
            onChange={e => updateMasterVol(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#679cff', height: 3, cursor: 'pointer' }} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: 'var(--vx-text-4)', minWidth: 42, textAlign: 'right' }}>
            {dbToDisplay(session.masterVolume ?? 0.8)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--vx-text-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.vocalex.tracks}</span>
        <button onClick={() => setShowAddSheet(true)} style={{
          display: 'flex', alignItems: 'center', gap: 4, background: 'var(--vx-input)', border: 'none',
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#679cff',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          {t.vocalex.addTrack}
        </button>
      </div>

      {session.layers.length === 0 ? (
        <div style={{ background: 'var(--vx-card)', borderRadius: 14, padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <MicWavesLottie size={52} />
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-3)', margin: 0, textAlign: 'center' }}>{t.vocalex.noTracksYet}</p>
          <button onClick={() => setShowAddSheet(true)} style={{
            marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 9999,
            background: 'linear-gradient(135deg, #679cff, #007aff)', border: 'none', cursor: 'pointer',
            fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            {t.vocalex.addFirstTrack}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {session.layers.map(layer => (
            <TrackChannel key={layer.id} layer={layer} hasSolo={hasSolo} isPlaying={playing}
              onUpdate={updateLayer} onDelete={() => removeLayer(layer.id)}
              onHarmonize={() => setHarmonizingLayer(layer)} />
          ))}
        </div>
      )}

      {showAddSheet && <AddTrackSheet session={session} onAdd={addLayer} onClose={() => setShowAddSheet(false)} />}

      {harmonizingLayer && (
        <HarmonizerSheet
          take={{
            id:            harmonizingLayer.id,
            name:          harmonizingLayer.name,
            createdAt:     Date.now(),
            durationMs:    harmonizingLayer.durationMs,
            audioBlob:     harmonizingLayer.audioBlob,
            waveformPeaks: [],
            sampleRate:    44100,
          }}
          onClose={() => setHarmonizingLayer(null)}
          onBounce={async (newTake) => {
            addLayer(createLayer({
              name:       newTake.name,
              audioBlob:  newTake.audioBlob,
              durationMs: newTake.durationMs,
              sourceType: 'take',
            }));
            setHarmonizingLayer(null);
          }}
        />
      )}
    </div>
  );
}

function SessionCard({ session, onOpen, onDelete }: {
  session: LabSession; onOpen: (s: LabSession) => void; onDelete: (id: string) => void;
}) {
  const t = useT();
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div style={{
      background: 'var(--vx-edge)', borderRadius: 14, padding: '16px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'background 150ms ease', cursor: 'pointer',
    }}
      onClick={() => onOpen(session)}
      onPointerDown={e => (e.currentTarget.style.background = '#2c2c2c')}
      onPointerUp={e => (e.currentTarget.style.background = 'var(--vx-edge)')}
      onPointerLeave={e => (e.currentTarget.style.background = 'var(--vx-edge)')}
    >
      <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--vx-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#679cff' }}>{session.icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--vx-text)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.name}</h4>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'var(--vx-text-3)', margin: 0 }}>
          {t.vocalex.trackCount(session.layers.length)} · {formatDate(session.createdAt, t.vocalex.months)}
        </p>
      </div>
      {confirmDel ? (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { onDelete(session.id); setConfirmDel(false); }} style={{ background: '#7f2927', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: '#ff9993' }}>{t.vocalex.deleteTake}</button>
          <button onClick={() => setConfirmDel(false)} style={{ background: 'var(--vx-input)', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--vx-text-2)' }}>{t.vocalex.cancelAction}</button>
        </div>
      ) : (
        <button onClick={e => { e.stopPropagation(); setConfirmDel(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--vx-text-4)', display: 'flex', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
        </button>
      )}
    </div>
  );
}

export default function LabPanel() {
  const t = useT();
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
      name: t.vocalex.sessionName(sessions.length + 1),
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
    // Determine the session's display number from its position in the list
    // sorted by creation time. New sessions are pushed at the end so this is
    // stable and matches the user's mental ordering ("Session #03" = the
    // third one created). Falls back to 1 if not yet present in the list.
    const ordered = [...sessions].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const idx = ordered.findIndex(s => s.id === activeSession.id);
    const sessionNumber = idx >= 0 ? idx + 1 : 1;
    return <MixerView session={activeSession} sessionNumber={sessionNumber} onBack={handleBack} onUpdate={handleUpdate} />;
  }

  const displaySessions = showAll ? sessions : sessions.slice(0, 6);

  return (
    <div style={{ padding: '20px 20px 40px', minHeight: '100%' }}>
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 34, letterSpacing: '-0.03em', color: 'var(--vx-text)', margin: '0 0 8px', lineHeight: 1 }}>{t.vocalex.labTitle}</h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-2)', margin: 0, lineHeight: 1.6, maxWidth: 320 }}>
          {t.vocalex.labSubtitle}
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
          {t.vocalex.newSession}
        </button>
      </section>

      {loaded && sessions.length > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--vx-text)', margin: 0 }}>{t.vocalex.sessionsLabel}</h3>
            {sessions.length > 6 && (
              <button onClick={() => setShowAll(!showAll)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700, color: '#679cff',
                textTransform: 'uppercase', letterSpacing: '0.12em',
              }}>
                {showAll ? t.vocalex.showLess : t.vocalex.viewAll}
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
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--vx-text-4)', marginBottom: 8 }}>science</span>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--vx-text-3)', margin: '8px 0 0' }}>
            {t.vocalex.noSessionsHint}
          </p>
        </section>
      )}
    </div>
  );
}

import { type TakeRecord, blobToAudioBuffer, createAudioContext } from '@workspace/studio-core';
/**
 * HarmonizerSheet — Full-screen professional vocal harmonizer for Vocalex.
 *
 * Features:
 *   • 9 harmony interval types with musical descriptions
 *   • Per-layer: volume, pan, mute, solo, fine-tune, custom interval
 *   • Add / remove layers freely
 *   • Waveform display with live playhead
 *   • Advanced processing: humanize + formant correction sliders
 *   • Key detection from pitch analysis
 *   • Export: Save as new take, Download full mix (WAV), Download harmony only (WAV)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import ElasticSlider from '../components/ElasticSlider';
import {
  HARMONIES, DEFAULT_HARMONY_LAYERS,
  startHarmonyPlayback, bounceHarmonizedTake,
  layerSemitones, detectKey,
  type HarmonyId, type HarmonyLayerState, type HarmonyPlaybackSession,
} from './harmonyEngine';
import { detectPitch } from './pitchYin';
import { bufferToMono } from './pitchShift';

// ─── helpers ──────────────────────────────────────────────────────────────

function fmt(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── types ────────────────────────────────────────────────────────────────

interface Props {
  take:     TakeRecord;
  accent?:  string;
  onClose:  () => void;
  onBounce: (newTake: TakeRecord) => void | Promise<void>;
}

// ─── Main component ────────────────────────────────────────────────────────

export default function HarmonizerSheet({ take, accent = '#007aff', onClose, onBounce }: Props) {
  const [layers, setLayers]               = useState<HarmonyLayerState[]>(() => DEFAULT_HARMONY_LAYERS.map(l => ({ ...l })));
  const [dryGain, setDryGain]             = useState(1.0);
  const [humanize, setHumanize]           = useState(0.28);
  const [formant, setFormant]             = useState(0.40);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [isGenerating, setIsGenerating]   = useState(false);
  const [playProgress, setPlayProgress]   = useState(0);
  const [showAdvanced, setShowAdvanced]   = useState(false);
  const [showAddLayer, setShowAddLayer]   = useState(false);
  const [showExport, setShowExport]       = useState(false);
  const [detectedKey, setDetectedKey]     = useState<string | null>(null);
  const [isBouncing, setIsBouncing]       = useState(false);
  const [bounceError, setBounceError]     = useState<string | null>(null);
  const [playError, setPlayError]         = useState<string | null>(null);

  const ctxRef        = useRef<AudioContext | null>(null);
  const sessionRef    = useRef<HarmonyPlaybackSession | null>(null);
  const rafRef        = useRef<number>(0);
  const isPlayingRef  = useRef(false);
  const durationRef   = useRef(take.durationMs / 1000);

  // ── Key detection ────────────────────────────────────────────────────────
  useEffect(() => {
    blobToAudioBuffer(take.audioBlob).then(buf => {
      const mono = bufferToMono(buf);
      const chunkSize = 2048;
      const hopSize   = 4096;
      const timeline: { noteName: string; frequency: number }[] = [];
      for (let off = 0; off + chunkSize <= mono.length; off += hopSize) {
        const chunk  = mono.slice(off, off + chunkSize);
        const result = detectPitch(chunk, buf.sampleRate, 0.8);
        if (result) timeline.push({ noteName: result.noteName, frequency: result.frequency });
      }
      setDetectedKey(detectKey(timeline));
    }).catch(() => {});
  }, [take]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => () => {
    sessionRef.current?.stop();
    cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close();
  }, []);

  // ── Playback ─────────────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    cancelAnimationFrame(rafRef.current);
    isPlayingRef.current = false;
    setIsPlaying(false);
    setPlayProgress(0);
  }, []);

  const handlePlayStop = useCallback(async () => {
    if (isPlayingRef.current) { stopPlayback(); return; }

    let ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') {
      ctx = createAudioContext();
      ctxRef.current = ctx;
    }
    if (ctx.state === 'suspended') await ctx.resume();

    setPlayError(null);
    setIsGenerating(true);
    try {
      const session = await startHarmonyPlayback(take, layers, ctx, {
        dryGain, humanize, formantCorrection: formant,
      });
      sessionRef.current = session;
      durationRef.current = session.duration;

      const startTime = ctx.currentTime;
      isPlayingRef.current = true;
      setIsGenerating(false);
      setIsPlaying(true);

      session.onEnded(() => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setPlayProgress(0);
        cancelAnimationFrame(rafRef.current);
      });

      const tick = () => {
        if (!isPlayingRef.current) return;
        const elapsed = ctx!.currentTime - startTime;
        setPlayProgress(Math.min(1, elapsed / durationRef.current));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setIsGenerating(false);
      setPlayError('Failed to generate harmonies. Please try again.');
    }
  }, [take, layers, dryGain, humanize, formant, stopPlayback]);

  // ── Layer management ──────────────────────────────────────────────────────
  const updateLayer = useCallback((index: number, patch: Partial<HarmonyLayerState>) => {
    setLayers(prev => prev.map((l, i) => i === index ? { ...l, ...patch } : l));
  }, []);

  const removeLayer = useCallback((index: number) => {
    setLayers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const addLayer = useCallback((id: HarmonyId) => {
    const panOptions = [-0.3, 0.3, -0.5, 0.5, -0.15, 0.15, 0, 0.4, -0.4];
    setLayers(prev => [...prev, {
      id,
      enabled:        true,
      gain:           0.75,
      pan:            panOptions[prev.length % panOptions.length],
      mute:           false,
      solo:           false,
      fineTune:       0,
      customSemitones: 5,
    }]);
    setShowAddLayer(false);
  }, []);

  // ── Bounce / export ───────────────────────────────────────────────────────
  const doBounce = useCallback(async (opts: { harmonyOnly?: boolean; download?: boolean } = {}) => {
    const { harmonyOnly = false, download = false } = opts;
    stopPlayback();
    setBounceError(null);
    setIsBouncing(true);
    setShowExport(false);
    try {
      const enabledNames = layers.filter(l => l.enabled && !l.mute)
        .map(l => HARMONIES.find(h => h.id === l.id)?.short ?? '')
        .filter(Boolean).join(' ');
      const newName = `${take.name} (${harmonyOnly ? 'Harmony' : `Harmonized ${enabledNames}`})`.trim();
      const newTake = await bounceHarmonizedTake(take, layers, newName, {
        dryGain:           harmonyOnly ? 0 : dryGain,
        humanize,
        formantCorrection: formant,
      });
      if (download) {
        const url = URL.createObjectURL(newTake.audioBlob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `${take.name}${harmonyOnly ? '-harmony' : '-mix'}.wav`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await onBounce(newTake);
        onClose();
      }
    } catch {
      setBounceError('Export failed. Please try again.');
    }
    setIsBouncing(false);
  }, [take, layers, dryGain, humanize, formant, stopPlayback, onBounce, onClose]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalDuration  = take.durationMs / 1000;
  const currentTimeSec = playProgress * durationRef.current;
  const activeCount    = layers.filter(l => l.enabled && !l.mute).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--vx-bg, #0b0b11)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
    }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <button
          onClick={() => { stopPlayback(); onClose(); }}
          style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer',
            color: 'var(--vx-text-2, rgba(255,255,255,0.45))',
            display: 'flex', alignItems: 'center',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h2 style={{
              fontFamily: 'Manrope, sans-serif', fontWeight: 800,
              fontSize: 17, color: 'var(--vx-text, #fff)',
              margin: 0, letterSpacing: '-0.02em',
            }}>Harmonizer</h2>
            {detectedKey && (
              <span style={{
                background: `${accent}22`, border: `1px solid ${accent}55`,
                borderRadius: 6, padding: '2px 7px',
                fontSize: 10, fontWeight: 800, color: accent,
                fontFamily: 'Manrope, sans-serif', letterSpacing: '0.06em',
                flexShrink: 0,
              }}>
                {detectedKey}
              </span>
            )}
          </div>
          <p style={{
            fontSize: 11, color: 'var(--vx-text-2, rgba(255,255,255,0.4))',
            margin: '1px 0 0',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{take.name}</p>
        </div>

        {/* Layer count badge */}
        <div style={{
          background: 'rgba(255,255,255,0.07)', borderRadius: 8,
          padding: '4px 9px', fontSize: 11, fontWeight: 700,
          color: 'rgba(255,255,255,0.5)', flexShrink: 0,
        }}>
          {activeCount} layer{activeCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── SCROLLABLE BODY ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }} className="no-scrollbar">

        {/* WAVEFORM PLAYER */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 14,
            padding: '12px 12px 10px',
            position: 'relative',
          }}>
            {/* Waveform bars */}
            <div style={{
              height: 60, display: 'flex', alignItems: 'center',
              gap: 1.5, borderRadius: 8,
              background: 'rgba(0,0,0,0.35)', padding: '0 8px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${playProgress * 100}%`,
                background: `${accent}18`,
                borderRight: `2px solid ${accent}`,
                transition: isPlaying ? 'none' : 'width 80ms ease',
              }} />
              {take.waveformPeaks.map((h, i) => {
                const played = (i / take.waveformPeaks.length) < playProgress;
                return (
                  <div key={i} style={{
                    flex: 1, minWidth: 1.5,
                    height: `${Math.max(8, h)}%`,
                    borderRadius: 9999, position: 'relative', zIndex: 1,
                    background: played ? `${accent}bb` : 'rgba(172,171,170,0.16)',
                  }} />
                );
              })}
            </div>

            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <button
                onClick={handlePlayStop}
                disabled={isBouncing}
                style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: isGenerating ? `${accent}55` : accent,
                  border: 'none',
                  cursor: isGenerating || isBouncing ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: `0 4px 14px ${accent}44`,
                  transition: 'background 150ms',
                }}
              >
                <span className="material-symbols-outlined" style={{
                  fontSize: 20, color: '#fff',
                  fontVariationSettings: "'FILL' 1",
                  animation: isGenerating ? 'hz-spin 1s linear infinite' : 'none',
                }}>
                  {isGenerating ? 'progress_activity' : isPlaying ? 'stop' : 'play_arrow'}
                </span>
              </button>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: 'rgba(255,255,255,0.4)',
                }}>
                  <span>{fmt(currentTimeSec)}</span>
                  <span style={{ color: isGenerating ? accent : 'rgba(255,255,255,0.4)' }}>
                    {isGenerating ? 'Generating…' : isPlaying ? 'Playing' : 'Ready'}
                  </span>
                  <span>−{fmt(totalDuration - currentTimeSec)}</span>
                </div>

                {/* Thin progress track */}
                <div style={{ height: 3, borderRadius: 9999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 9999,
                    width: `${playProgress * 100}%`,
                    background: accent,
                    transition: isPlaying ? 'none' : 'width 80ms ease',
                  }} />
                </div>
              </div>
            </div>

            {playError && (
              <p style={{ fontSize: 11, color: '#ef4444', margin: '8px 0 0', textAlign: 'center' }}>{playError}</p>
            )}

            {/* Gradient border ring */}
            <div className="gb-border-ring" aria-hidden="true" />
          </div>
        </div>

        {/* DRY GAIN ROW */}
        <div style={{ padding: '10px 16px 0' }}>
          <SliderRow
            icon="mic"
            label="Lead Vocal"
            value={dryGain}
            min={0} max={1.5} step={0.01}
            accent="rgba(255,255,255,0.55)"
            display={`${Math.round(dryGain * 100)}%`}
            onChange={setDryGain}
          />
        </div>

        {/* LAYERS SECTION */}
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 10,
          }}>
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)',
            }}>Harmony Layers</span>

            <button
              onClick={() => setShowAddLayer(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 8,
                background: showAddLayer ? `${accent}22` : 'rgba(255,255,255,0.07)',
                border: showAddLayer ? `1px solid ${accent}55` : '1px solid rgba(255,255,255,0.1)',
                color: showAddLayer ? accent : 'rgba(255,255,255,0.55)',
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
              Add
            </button>
          </div>

          {/* Add-layer picker grid */}
          {showAddLayer && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 6, marginBottom: 10,
              padding: 10, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {HARMONIES.map(h => (
                <button
                  key={h.id}
                  onClick={() => addLayer(h.id)}
                  style={{
                    padding: '8px 4px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: h.color, margin: '0 auto 4px',
                    boxShadow: `0 0 6px ${h.color}80`,
                  }} />
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: '#fff',
                    fontFamily: 'Manrope, sans-serif',
                  }}>{h.short}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{h.label}</div>
                </button>
              ))}
            </div>
          )}

          {/* Layer cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {layers.map((layer, i) => (
              <LayerCard
                key={`${layer.id}-${i}`}
                layer={layer}
                canDelete={layers.length > 1}
                onChange={patch => updateLayer(i, patch)}
                onDelete={() => removeLayer(i)}
              />
            ))}
          </div>
        </div>

        {/* ADVANCED SETTINGS */}
        <div style={{ padding: '12px 16px 0' }}>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '10px 13px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', color: 'rgba(255,255,255,0.55)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>tune</span>
              Advanced Processing
            </div>
            <span className="material-symbols-outlined" style={{
              fontSize: 18,
              transform: showAdvanced ? 'rotate(180deg)' : 'none',
              transition: 'transform 200ms ease',
            }}>expand_more</span>
          </button>

          {showAdvanced && (
            <div style={{
              marginTop: 6, padding: '14px 13px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <AdvSlider
                label="Humanize"
                hint="Adds natural micro-timing and pitch variation between layers"
                value={humanize}
                color="#32d74b"
                icon="person"
                onChange={setHumanize}
              />
              <AdvSlider
                label="Formant Correction"
                hint="Preserves vocal character when shifting large intervals"
                value={formant}
                color="#ff9f0a"
                icon="graphic_eq"
                onChange={setFormant}
              />
              <p style={{
                fontSize: 10, color: 'rgba(255,255,255,0.25)',
                margin: 0, lineHeight: 1.5,
              }}>
                Changes apply on next playback. Larger corrections increase generation time.
              </p>
            </div>
          )}
        </div>

        {bounceError && (
          <div style={{ padding: '10px 16px 0' }}>
            <div style={{
              padding: '9px 13px', borderRadius: 10,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444', fontSize: 12,
            }}>{bounceError}</div>
          </div>
        )}

        <div style={{ height: 110 }} />
      </div>

      {/* ── FIXED BOTTOM BAR ────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '11px 16px calc(11px + env(safe-area-inset-bottom, 0px))',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(11,11,17,0.96)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        display: 'flex', gap: 8,
      }}>
        {/* Save as Take */}
        <button
          onClick={() => doBounce()}
          disabled={isBouncing || activeCount === 0}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 12,
            background: isBouncing ? 'rgba(0,122,255,0.08)' : `${accent}22`,
            border: `1px solid ${accent}44`,
            color: activeCount === 0 ? 'rgba(0,122,255,0.35)' : accent,
            fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13,
            cursor: isBouncing || activeCount === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: activeCount === 0 ? 0.5 : 1,
          }}
        >
          <span className="material-symbols-outlined" style={{
            fontSize: 15,
            animation: isBouncing ? 'hz-spin 1s linear infinite' : 'none',
          }}>
            {isBouncing ? 'progress_activity' : 'save'}
          </span>
          {isBouncing ? 'Saving…' : 'Save as Take'}
        </button>

        {/* Export dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExport(v => !v)}
            disabled={isBouncing || activeCount === 0}
            style={{
              padding: '12px 14px', borderRadius: 12,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: activeCount === 0 ? 'rgba(255,255,255,0.25)' : '#fff',
              fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13,
              cursor: isBouncing || activeCount === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: activeCount === 0 ? 0.5 : 1,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
            Export
            <span className="material-symbols-outlined" style={{
              fontSize: 13,
              transform: showExport ? 'rotate(180deg)' : 'none',
              transition: 'transform 180ms ease',
            }}>expand_more</span>
          </button>

          {showExport && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
              background: 'rgba(22,22,28,0.98)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, overflow: 'hidden',
              boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
              minWidth: 200, zIndex: 10,
            }}>
              {[
                { label: 'Full Mix  (WAV)', icon: 'audio_file', harmonyOnly: false },
                { label: 'Harmony Only  (WAV)', icon: 'music_note', harmonyOnly: true },
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => doBounce({ harmonyOnly: opt.harmonyOnly, download: true })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '12px 15px',
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: '#fff',
                    fontFamily: 'Inter, sans-serif', fontSize: 13,
                    fontWeight: 500, textAlign: 'left',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 17, color: 'rgba(255,255,255,0.4)' }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes hz-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Layer Card ───────────────────────────────────────────────────────────

function LayerCard({
  layer, canDelete, onChange, onDelete,
}: {
  layer:     HarmonyLayerState;
  canDelete: boolean;
  onChange:  (patch: Partial<HarmonyLayerState>) => void;
  onDelete:  () => void;
}) {
  const def     = HARMONIES.find(h => h.id === layer.id)!;
  const semis   = layerSemitones(layer);
  const isActive = layer.enabled && !layer.mute;

  return (
    <div style={{
      borderRadius: 13,
      background: isActive ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${isActive ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)'}`,
      padding: '11px 12px',
      opacity: layer.mute ? 0.5 : 1,
      transition: 'opacity 150ms, background 150ms',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {/* Color dot = enable toggle */}
        <button
          onClick={() => onChange({ enabled: !layer.enabled })}
          title={layer.enabled ? 'Disable layer' : 'Enable layer'}
          style={{
            width: 11, height: 11, borderRadius: '50%',
            background: layer.enabled ? def.color : 'rgba(255,255,255,0.18)',
            border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
            boxShadow: layer.enabled ? `0 0 8px ${def.color}80` : 'none',
            transition: 'background 150ms, box-shadow 150ms',
          }}
        />

        {/* Interval info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{
              fontSize: 12.5, fontWeight: 700, color: layer.enabled ? '#fff' : 'rgba(255,255,255,0.35)',
              fontFamily: 'Manrope, sans-serif',
            }}>{def.label}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: def.color,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {semis > 0 ? '+' : ''}{semis.toFixed(1)} st
            </span>
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>{def.hint}</div>
        </div>

        {/* Mute */}
        <MiniButton
          active={layer.mute}
          activeColor="rgba(239,68,68,0.3)"
          activeBorder="rgba(239,68,68,0.5)"
          activeTextColor="#ef4444"
          onClick={() => onChange({ mute: !layer.mute })}
          label="M"
          title={layer.mute ? 'Unmute' : 'Mute'}
        />

        {/* Solo */}
        <MiniButton
          active={layer.solo}
          activeColor="rgba(255,204,0,0.2)"
          activeBorder="rgba(255,204,0,0.4)"
          activeTextColor="#ffcc00"
          onClick={() => onChange({ solo: !layer.solo })}
          label="S"
          title={layer.solo ? 'Unsolo' : 'Solo'}
        />

        {/* Delete */}
        {canDelete && (
          <button
            onClick={onDelete}
            title="Remove layer"
            style={{
              width: 26, height: 26, borderRadius: 7,
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.22)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        )}
      </div>

      {/* Volume */}
      <SliderRow
        icon="volume_up"
        label="VOL"
        value={layer.gain}
        min={0} max={1.5} step={0.01}
        accent={def.color}
        display={`${Math.round(layer.gain * 100)}%`}
        onChange={v => onChange({ gain: v })}
        compact
      />

      {/* Pan */}
      <SliderRow
        icon="spatial_audio"
        label="PAN"
        value={layer.pan}
        min={-1} max={1} step={0.01}
        accent={def.color}
        display={layer.pan === 0 ? 'C' : layer.pan < 0 ? `L${Math.round(-layer.pan * 100)}` : `R${Math.round(layer.pan * 100)}`}
        onChange={v => onChange({ pan: v })}
        compact
      />

      {/* Fine tune */}
      <SliderRow
        icon="piano"
        label="FINE"
        value={layer.fineTune}
        min={-1} max={1} step={0.01}
        accent={def.color}
        display={`${layer.fineTune >= 0 ? '+' : ''}${layer.fineTune.toFixed(2)} st`}
        onChange={v => onChange({ fineTune: v })}
        compact
      />

      {/* Custom interval */}
      {layer.id === 'custom' && (
        <SliderRow
          icon="tune"
          label="INT"
          value={layer.customSemitones}
          min={-24} max={24} step={0.5}
          accent={def.color}
          display={`${layer.customSemitones >= 0 ? '+' : ''}${layer.customSemitones} st`}
          onChange={v => onChange({ customSemitones: v })}
          compact
        />
      )}
    </div>
  );
}

// ─── MiniButton ───────────────────────────────────────────────────────────

function MiniButton({
  active, activeColor, activeBorder, activeTextColor,
  onClick, label, title,
}: {
  active: boolean; activeColor: string; activeBorder: string; activeTextColor: string;
  onClick: () => void; label: string; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26, borderRadius: 7,
        background: active ? activeColor : 'rgba(255,255,255,0.06)',
        border: `1px solid ${active ? activeBorder : 'rgba(255,255,255,0.09)'}`,
        color: active ? activeTextColor : 'rgba(255,255,255,0.4)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Manrope, sans-serif', fontSize: 9, fontWeight: 800,
        transition: 'background 150ms, border-color 150ms, color 150ms',
      }}
    >{label}</button>
  );
}

// ─── SliderRow ────────────────────────────────────────────────────────────

function SliderRow({
  icon, label, value, min, max, step, accent, display, onChange, compact = false,
}: {
  icon: string; label: string; value: number; min: number; max: number; step: number;
  accent: string; display: string; onChange: (v: number) => void; compact?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      marginTop: compact ? 7 : 0,
      padding: compact ? 0 : '9px 13px',
      background: compact ? 'none' : 'rgba(255,255,255,0.04)',
      borderRadius: compact ? 0 : 10,
    }}>
      <span className="material-symbols-outlined" style={{
        fontSize: 13, color: 'rgba(255,255,255,0.3)',
        fontVariationSettings: "'FILL' 1", flexShrink: 0,
      }}>{icon}</span>
      <span style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
        color: 'rgba(255,255,255,0.28)', width: 24, flexShrink: 0,
      }}>{label}</span>
      <ElasticSlider
        min={min} max={max} step={step} value={value}
        onChange={onChange}
        accentColor={accent}
        style={{ flex: 1 }}
      />
      <span style={{
        fontSize: 9.5, fontVariantNumeric: 'tabular-nums',
        color: 'rgba(255,255,255,0.3)', width: 38,
        textAlign: 'right', flexShrink: 0,
      }}>{display}</span>
    </div>
  );
}

// ─── AdvSlider ────────────────────────────────────────────────────────────

function AdvSlider({
  label, hint, value, color, icon, onChange,
}: {
  label: string; hint: string; value: number;
  color: string; icon: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span className="material-symbols-outlined" style={{
          fontSize: 14, color, fontVariationSettings: "'FILL' 1",
        }}>{icon}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', flex: 1 }}>{label}</span>
        <span style={{
          fontSize: 10.5, fontVariantNumeric: 'tabular-nums',
          color: 'rgba(255,255,255,0.4)',
        }}>{Math.round(value * 100)}%</span>
      </div>
      <ElasticSlider
        min={0} max={1} step={0.01} value={value}
        onChange={onChange}
        accentColor={color}
        style={{ width: '100%' }}
      />
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', margin: '5px 0 0', lineHeight: 1.5 }}>{hint}</p>
    </div>
  );
}

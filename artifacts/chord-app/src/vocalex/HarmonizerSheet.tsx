/**
 * HarmonizerSheet — bottom-sheet modal that lets the user duplicate a take
 * into Major-3rd / Perfect-5th / Octave harmony layers, preview them in
 * real time, and bounce the mix as a new take.
 *
 * UX:
 *   • Three layer rows. Each has an on/off toggle and a volume slider.
 *   • Big "Preview" play button at the bottom plays dry + enabled layers
 *     in sync. Slider changes apply live (setGain).
 *   • "Save as new take" renders an offline bounce and persists via the
 *     parent's onBounce callback.
 *
 * Audio is fully lazy: nothing is rendered until the user enables a layer
 * and presses Preview, so the sheet has zero cost when first opened.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { TakeRecord } from './takesDb';
import {
  HARMONIES, DEFAULT_HARMONY_STATE,
  startHarmonyPlayback, bounceHarmonizedTake,
  type HarmonyId, type HarmonyLayerState, type HarmonyPlaybackSession,
} from './harmonyEngine';

interface Props {
  take:      TakeRecord;
  accent?:   string;        // colour token (defaults to Vocalex blue)
  onClose:   () => void;
  onBounce:  (newTake: TakeRecord) => void | Promise<void>;
}

export default function HarmonizerSheet({ take, accent = '#007aff', onClose, onBounce }: Props) {
  const [layers, setLayers] = useState<HarmonyLayerState[]>(() =>
    DEFAULT_HARMONY_STATE.map(l => ({ ...l })),
  );
  const [dryGain, setDryGain] = useState(1.0);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState<'idle' | 'rendering' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);

  const ctxRef     = useRef<AudioContext | null>(null);
  const sessionRef = useRef<HarmonyPlaybackSession | null>(null);

  const enabledCount = useMemo(() => layers.filter(l => l.enabled).length, [layers]);

  // Ensure playback halts on unmount.
  useEffect(() => () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
  }, []);

  const ensureCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current!.state === 'suspended') void ctxRef.current!.resume();
    return ctxRef.current!;
  }, []);

  const setLayer = useCallback((id: HarmonyId, patch: Partial<HarmonyLayerState>) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l;
      const next = { ...l, ...patch };
      // Push gain changes to the live session so sliders feel real-time.
      if (sessionRef.current && patch.gain !== undefined) {
        sessionRef.current.setGain(id, patch.enabled === false ? 0 : next.gain);
      }
      if (sessionRef.current && patch.enabled !== undefined) {
        // Toggling while playing — fade the layer in/out via gain since we
        // can't add a source mid-stream cheaply.
        sessionRef.current.setGain(id, patch.enabled ? next.gain : 0);
      }
      return next;
    }));
  }, []);

  const handleDryGain = useCallback((v: number) => {
    setDryGain(v);
    sessionRef.current?.setGain('dry', v);
  }, []);

  const stopPreview = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setPreviewing(false);
  }, []);

  const startPreview = useCallback(async () => {
    setError(null);
    try {
      const ctx = ensureCtx();
      setBusy('rendering');
      // Pass current layer states; engine pre-renders shifted buffers as
      // needed. The first preview after enabling a new harmony incurs a
      // tiny render delay (cached after).
      const session = await startHarmonyPlayback(take, layers, ctx, dryGain);
      sessionRef.current = session;
      session.onEnded(() => {
        sessionRef.current = null;
        setPreviewing(false);
      });
      setPreviewing(true);
    } catch (e) {
      setError('Could not start preview. Try again.');
      console.error('[Harmonizer] preview failed', e);
    } finally {
      setBusy('idle');
    }
  }, [take, layers, dryGain, ensureCtx]);

  const togglePreview = useCallback(() => {
    if (previewing) stopPreview();
    else void startPreview();
  }, [previewing, stopPreview, startPreview]);

  const handleBounce = useCallback(async () => {
    if (!enabledCount) return;
    stopPreview();
    setError(null);
    setBusy('saving');
    try {
      const enabledNames = layers.filter(l => l.enabled)
        .map(l => HARMONIES.find(h => h.id === l.id)?.short ?? '')
        .filter(Boolean).join(' ');
      const newName = `${take.name} (Harmonized ${enabledNames})`.trim();
      const bounced = await bounceHarmonizedTake(take, layers, newName, dryGain);
      await onBounce(bounced);
      onClose();
    } catch (e) {
      setError('Could not bounce harmonized take.');
      console.error('[Harmonizer] bounce failed', e);
    } finally {
      setBusy('idle');
    }
  }, [enabledCount, layers, take, dryGain, onBounce, onClose, stopPreview]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={() => { stopPreview(); onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Vocal harmonizer"
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl"
        style={{
          background: 'var(--vx-bg, var(--app-surface))',
          maxHeight: '92vh', overflowY: 'auto',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.45)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          animation: 'spring-in 200ms cubic-bezier(0.22,1,0.36,1)',
        }}
        onClick={e => e.stopPropagation()}
        data-testid="harmonizer-sheet"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
              Harmonize
            </p>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--vx-text)', margin: '2px 0 0', letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
              {take.name}
            </h2>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: 'var(--vx-text-2)', margin: '2px 0 0' }}>
              Layer pitch-shifted copies of your vocal
            </p>
          </div>
          <button
            onClick={() => { stopPreview(); onClose(); }}
            aria-label="Close"
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--vx-input-2, var(--app-surface-high))', border: 'none', cursor: 'pointer',
              color: 'var(--vx-text-2)', fontSize: 18, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Dry-vocal row */}
        <div className="px-5 pb-2">
          <LayerRow
            id="dry"
            label="Original"
            sub="Your dry vocal"
            enabled
            gain={dryGain}
            onToggle={() => { /* dry stays on */ }}
            onGain={handleDryGain}
            accent={accent}
            data-testid="dry-row"
            isDry
          />
        </div>

        {/* Harmony layers */}
        <div className="px-5 pb-2 flex flex-col gap-2">
          {layers.map(l => {
            const def = HARMONIES.find(h => h.id === l.id)!;
            return (
              <LayerRow
                key={l.id}
                id={l.id}
                label={def.label}
                sub={def.hint}
                enabled={l.enabled}
                gain={l.gain}
                onToggle={() => setLayer(l.id, { enabled: !l.enabled })}
                onGain={v => setLayer(l.id, { gain: v })}
                accent={accent}
              />
            );
          })}
        </div>

        {error && (
          <p data-testid="harmonizer-error" style={{
            margin: '0 20px 8px', padding: '8px 12px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, color: '#ef4444',
            fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600,
          }}>{error}</p>
        )}

        {/* Action row */}
        <div className="px-5 pt-3 pb-1 flex gap-2">
          <button
            data-testid="harmonizer-preview-btn"
            onClick={togglePreview}
            disabled={busy === 'saving'}
            style={{
              flex: 1, height: 48, borderRadius: 9999,
              background: previewing ? 'var(--vx-input-2, var(--app-surface-high))' : accent,
              color: previewing ? 'var(--vx-text)' : '#fff',
              border: 'none', cursor: busy === 'saving' ? 'not-allowed' : 'pointer',
              fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: previewing ? 'none' : `0 4px 16px ${accent}55`,
              transition: 'background 200ms ease',
              opacity: busy === 'saving' ? 0.5 : 1,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
              {busy === 'rendering' ? 'progress_activity' : previewing ? 'stop' : 'play_arrow'}
            </span>
            {busy === 'rendering' ? 'Loading…' : previewing ? 'Stop Preview' : 'Preview Harmonies'}
          </button>
          <button
            data-testid="harmonizer-bounce-btn"
            onClick={handleBounce}
            disabled={!enabledCount || busy !== 'idle'}
            title={!enabledCount ? 'Enable at least one harmony layer' : 'Save as a new take'}
            style={{
              height: 48, padding: '0 18px', borderRadius: 9999,
              background: 'var(--vx-input-2, var(--app-surface-high))',
              color: enabledCount ? accent : 'var(--vx-text-4)',
              border: 'none',
              cursor: enabledCount && busy === 'idle' ? 'pointer' : 'not-allowed',
              fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: enabledCount ? 1 : 0.5,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
            {busy === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>

        <p style={{
          margin: '8px 20px 0', fontSize: 10.5, color: 'var(--vx-text-4)',
          fontFamily: 'Inter, sans-serif', textAlign: 'center', lineHeight: 1.5,
        }}>
          Harmonies are generated by granular pitch-shifting — best with sustained vowels.
        </p>
      </div>
      <style>{`
        @keyframes spring-in {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Layer row ─────────────────────────────────────────────────────────────

interface LayerRowProps {
  id:       HarmonyId | 'dry';
  label:    string;
  sub:      string;
  enabled:  boolean;
  gain:     number;
  onToggle: () => void;
  onGain:   (v: number) => void;
  accent:   string;
  isDry?:   boolean;
  ['data-testid']?: string;
}

function LayerRow({ id, label, sub, enabled, gain, onToggle, onGain, accent, isDry, ...rest }: LayerRowProps) {
  const dim = !enabled && !isDry;
  return (
    <div
      data-testid={(rest as any)['data-testid'] ?? `harmony-row-${id}`}
      style={{
        background: enabled || isDry ? 'var(--vx-card-2, var(--app-surface-high))' : 'transparent',
        border: enabled
          ? `1px solid ${accent}55`
          : '1px solid rgba(128,128,128,0.18)',
        borderRadius: 14, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        opacity: dim ? 0.6 : 1, transition: 'all 180ms ease',
      }}
    >
      {/* Toggle */}
      {!isDry ? (
        <button
          data-testid={`harmony-toggle-${id}`}
          onClick={onToggle}
          aria-pressed={enabled}
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
          style={{
            width: 36, height: 22, borderRadius: 9999, position: 'relative',
            background: enabled ? accent : 'rgba(128,128,128,0.30)',
            border: 'none', cursor: 'pointer', transition: 'background 180ms ease',
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: enabled ? 16 : 2,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 180ms cubic-bezier(0.22,1,0.36,1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}/>
        </button>
      ) : (
        <span className="material-symbols-outlined" style={{ fontSize: 22, color: accent, fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
      )}

      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 13,
          color: 'var(--vx-text)', margin: 0, lineHeight: 1.2,
        }}>{label}</p>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 10.5,
          color: 'var(--vx-text-2)', margin: '2px 0 0', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{sub}</p>
      </div>

      {/* Volume slider — show even when disabled (greyed) so layout is stable */}
      <div style={{ width: 90, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <input
          data-testid={`harmony-vol-${id}`}
          type="range"
          min={0} max={1.5} step={0.05}
          value={gain}
          onChange={e => onGain(Number(e.target.value))}
          disabled={!enabled && !isDry}
          aria-label={`${label} volume`}
          style={{
            width: '100%', height: 4, accentColor: accent,
            cursor: enabled || isDry ? 'pointer' : 'not-allowed',
          }}
        />
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 700,
          color: 'var(--vx-text-2)', fontVariantNumeric: 'tabular-nums',
        }}>{gainToDb(gain)}</span>
      </div>
    </div>
  );
}

function gainToDb(g: number): string {
  if (g <= 0.001) return '−∞';
  const db = 20 * Math.log10(g);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

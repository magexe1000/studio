/**
 * ProgressionGenerator — bottom-sheet modal for the auto chord-progression
 * generator. Pure UI: all theory lives in src/lib/progressionGen.ts.
 *
 * UX flow:
 *   1. Pick Key, Scale, Style.
 *   2. Tap "Generate Progression"  → 4-8 chord pills appear.
 *   3. Tap any chord pill → swap picker (7 diatonic chords) or remove.
 *   4. Regenerate cycles to a *different* template under the same inputs.
 *   5. Use → loads into currentProgressionChords (replaces existing).
 *   6. Load to Song → opens preset picker, appends chords to chosen song.
 *   7. Save → asks for a name, persists via saveProgression().
 *
 * Animations: sheet slides up on mount, slides down on close — `closing`
 * state defers the actual onClose() callback until the exit animation
 * finishes. The bottom nav is hidden + locked for the lifetime of the
 * sheet so it doesn't peek through the backdrop.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useChordStore } from '../store/useChordStore';
import { getChordById } from '../data/chords';
import {
  KEYS, SCALE_TYPES, STYLES,
  generateProgression, diatonicChordIds, romanToChordId, labelKey,
  type Key, type ScaleType, type Style, type GeneratedProgression,
} from '../lib/progressionGen';
import { setBackHandler } from '../lib/backStack';
import { setNavLocked, setNavHidden, useScrollHide } from '../lib/navScroll';
import { useT } from '../lib/useT';
import type { SongPreset } from '../store/useChordStore';

interface Props {
  accent: { from: string; to: string; mid: string };
  onClose: () => void;
  defaultKey?:   Key;
  defaultScale?: ScaleType;
  defaultStyle?: Style;
}

const EXIT_MS = 240;

export default function ProgressionGenerator({
  accent, onClose,
  defaultKey   = 'C',
  defaultScale = 'major',
  defaultStyle = 'pop',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);
  const settings        = useChordStore(s => s.settings);
  const presets         = useChordStore(s => s.presets);
  const setProgression  = useChordStore.getState().clearProgression;     // we use clear + add to atomically replace
  const addToProgression = useChordStore.getState().addToProgression;
  const saveProgression  = useChordStore.getState().saveProgression;
  const addChordToPreset = useChordStore.getState().addChordToPreset;
  const addChordToSection = useChordStore.getState().addChordToSection;
  const t = useT();

  const [key,   setKey]   = useState<Key>(defaultKey);
  const [scale, setScale] = useState<ScaleType>(defaultScale);
  const [style, setStyle] = useState<Style>(defaultStyle);

  const [result,  setResult]  = useState<GeneratedProgression | null>(null);
  // local override for individual chord swaps so user edits don't get lost
  // when the surrounding result object is reassigned.
  const [editedChordIds, setEditedChordIds] = useState<string[] | null>(null);

  const [swapOpenIdx, setSwapOpenIdx] = useState<number | null>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [progName, setProgName] = useState('');

  // Preset picker (Load-to-Song flow). `Closing` flips first to play the
  // exit animation; `Open` flips off after EXIT_MS via the timer below.
  const [presetPickerOpen, setPresetPickerOpen] = useState(false);
  const [presetPickerClosing, setPresetPickerClosing] = useState(false);
  const presetPickerCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Brief confirmation toast after a successful "load to song" action.
  const [loadedToName, setLoadedToName] = useState<string | null>(null);

  const requestClosePicker = useCallback(() => {
    if (presetPickerClosing || !presetPickerOpen) return;
    setPresetPickerClosing(true);
    if (presetPickerCloseTimer.current) clearTimeout(presetPickerCloseTimer.current);
    presetPickerCloseTimer.current = setTimeout(() => {
      setPresetPickerOpen(false);
      setPresetPickerClosing(false);
    }, EXIT_MS);
  }, [presetPickerClosing, presetPickerOpen]);

  useEffect(() => () => {
    if (presetPickerCloseTimer.current) clearTimeout(presetPickerCloseTimer.current);
  }, []);

  // Animated close — set to true to play exit anim, then onClose() fires
  // after EXIT_MS via the timer in the effect below.
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide + lock the bottom nav for the entire life of the sheet. We unlock
  // explicitly in this effect's cleanup so a hidden+locked state never
  // leaks past unmount.
  useEffect(() => {
    setNavLocked(true);
    setNavHidden(true);
    return () => {
      setNavLocked(false);
      setNavHidden(false);
    };
  }, []);

  // Public close path — always go through this so the exit anim plays.
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      onClose();
    }, EXIT_MS);
  }, [closing, onClose]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  // Hook into the platform back-button: closing the swap picker first, then
  // the save prompt or preset picker, then the modal itself. Prevents the
  // back gesture from popping the user all the way out of Chordex by accident.
  useEffect(() => {
    setBackHandler(() => {
      if (swapOpenIdx !== null)  { setSwapOpenIdx(null); return true; }
      if (presetPickerOpen)      { requestClosePicker(); return true; }
      if (savePromptOpen)        { setSavePromptOpen(false); return true; }
      requestClose(); return true;
    });
    return () => setBackHandler(null);
  }, [swapOpenIdx, savePromptOpen, presetPickerOpen, requestClose, requestClosePicker]);

  const activeChordIds = editedChordIds ?? result?.chordIds ?? [];

  const handleGenerate = useCallback(() => {
    const next = generateProgression(key, scale, style);
    setResult(next);
    setEditedChordIds(null);
    setSwapOpenIdx(null);
  }, [key, scale, style]);

  const handleRegenerate = useCallback(() => {
    const next = generateProgression(key, scale, style, result?.templateIdx);
    setResult(next);
    setEditedChordIds(null);
    setSwapOpenIdx(null);
  }, [key, scale, style, result?.templateIdx]);

  const handleSwap = useCallback((idx: number, newChordId: string) => {
    const next = [...activeChordIds];
    next[idx] = newChordId;
    setEditedChordIds(next);
    setSwapOpenIdx(null);
  }, [activeChordIds]);

  const handleRemove = useCallback((idx: number) => {
    const next = activeChordIds.filter((_, i) => i !== idx);
    setEditedChordIds(next);
    setSwapOpenIdx(null);
  }, [activeChordIds]);

  const handleAppendDiatonic = useCallback(() => {
    if (!result) return;
    // Default-append the tonic (I or i) — safe musical choice.
    const tonic = romanToChordId(scale === 'major' ? 'I' : 'i', key);
    if (!tonic) return;
    setEditedChordIds([...activeChordIds, tonic]);
  }, [activeChordIds, key, scale, result]);

  const handleUse = useCallback(() => {
    if (!activeChordIds.length) return;
    setProgression();
    activeChordIds.forEach(id => addToProgression(id));
    requestClose();
  }, [activeChordIds, setProgression, addToProgression, requestClose]);

  const handleSaveConfirm = useCallback(() => {
    const trimmed = progName.trim();
    if (!trimmed || !activeChordIds.length) return;
    // saveProgression saves the *current* progression, so we need to load
    // first. Use the same atomic replace pattern as handleUse.
    setProgression();
    activeChordIds.forEach(id => addToProgression(id));
    saveProgression(trimmed);
    setSavePromptOpen(false);
    setProgName('');
    requestClose();
  }, [progName, activeChordIds, setProgression, addToProgression, saveProgression, requestClose]);

  // Append all generated chords to the chosen preset. If the preset uses
  // sections, append to the LAST section to keep musical context intact;
  // otherwise append to the flat chord list.
  const handleLoadToPreset = useCallback((preset: SongPreset) => {
    if (!activeChordIds.length) return;
    if (preset.sections && preset.sections.length > 0) {
      const last = preset.sections[preset.sections.length - 1];
      activeChordIds.forEach(id => addChordToSection(preset.id, last.id, id));
    } else {
      activeChordIds.forEach(id => addChordToPreset(preset.id, id));
    }
    requestClosePicker();
    setLoadedToName(preset.name);
    // Brief celebration, then close. 900ms is long enough to read the toast
    // but short enough not to feel sluggish.
    setTimeout(() => requestClose(), 900);
  }, [activeChordIds, addChordToPreset, addChordToSection, requestClose, requestClosePicker]);

  // Diatonic chord pool for the swap picker (memoised, recomputed on key/scale)
  const diatonic = useMemo(() => diatonicChordIds(key, scale), [key, scale]);

  const keyDisplay = labelKey(key, !!settings.preferFlats);

  // ── Visual styles ──────────────────────────────────────────────────────
  const chipBase: React.CSSProperties = {
    height: 32, padding: '0 12px', borderRadius: 9999,
    fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 12,
    letterSpacing: '0.02em', cursor: 'pointer', transition: 'all 140ms',
    border: '1px solid rgba(128,128,128,0.16)',
    background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
  const chipActive: React.CSSProperties = {
    background: `${accent.from}22`,
    color: accent.from,
    border: `1px solid ${accent.from}55`,
  };

  // Most-recently-edited preset bubbles to the top of the picker.
  const sortedPresets = useMemo(
    () => [...presets].sort((a, b) => b.updatedAt - a.updatedAt),
    [presets],
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center ${closing ? 'overlay-fade-out' : 'overlay-fade-in'}`}
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
      aria-label="Generate chord progression"
    >
      <div
        className={`w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl ${closing ? 'sheet-exit' : 'sheet-enter'}`}
        ref={scrollRef}
        style={{
          background: 'var(--app-surface)',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          willChange: 'transform, opacity',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text-primary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', margin: 0 }}>
              Generate Progression
            </h2>
            <p style={{ fontSize: 11.5, color: 'var(--c-text-muted)', fontFamily: 'Inter', margin: '2px 0 0' }}>
              Built from real harmonic templates — no random chords.
            </p>
          </div>
          <button
            onClick={requestClose}
            aria-label="Close"
            className="btn-smooth"
            style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--app-surface-high)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
        </div>

        {/* ── Inputs ────────────────────────────────────────────────── */}
        <div className="px-5 pb-2 flex flex-col gap-3">
          {/* Key */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>Key</p>
            <div className="flex flex-wrap gap-1.5">
              {KEYS.map(k => {
                const active = k === key;
                return (
                  <button key={k} onClick={() => setKey(k)} aria-pressed={active}
                    style={{ ...chipBase, ...(active ? chipActive : {}), height: 30, padding: '0 10px', minWidth: 36 }}>
                    {labelKey(k, !!settings.preferFlats)}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Scale + Style row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>Scale</p>
              <div className="flex flex-wrap gap-1.5">
                {SCALE_TYPES.map(s => {
                  const active = s.id === scale;
                  return (
                    <button key={s.id} onClick={() => setScale(s.id)} aria-pressed={active}
                      style={{ ...chipBase, ...(active ? chipActive : {}) }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>Style</p>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map(s => {
                  const active = s.id === style;
                  return (
                    <button key={s.id} onClick={() => setStyle(s.id)} aria-pressed={active} title={s.blurb}
                      style={{ ...chipBase, ...(active ? chipActive : {}) }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Generate / Regenerate primary action ──────────────────── */}
        <div className="px-5 pt-3">
          {!result ? (
            <button
              data-testid="generate-progression-btn"
              onClick={handleGenerate}
              className="btn-smooth w-full py-3 font-bold"
              style={{
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                color: 'white', borderRadius: 9999, fontFamily: 'Manrope', fontSize: 14,
                boxShadow: `0 4px 20px ${accent.to}40`, border: 'none', cursor: 'pointer',
              }}
            >Generate Progression</button>
          ) : (
            <div className="flex gap-2">
              <button
                data-testid="regenerate-progression-btn"
                onClick={handleRegenerate}
                className="btn-smooth flex-1 py-3 font-bold"
                style={{
                  background: 'var(--app-surface-high)', color: accent.from,
                  borderRadius: 9999, fontFamily: 'Manrope', fontSize: 13,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                Regenerate
              </button>
              <button
                onClick={handleGenerate}
                className="btn-smooth py-3 px-4 font-bold"
                aria-label="New random template"
                title="New random template"
                style={{
                  background: 'var(--app-surface-high)', color: 'var(--c-text-secondary)',
                  borderRadius: 9999, fontFamily: 'Manrope', fontSize: 13,
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>casino</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Result ────────────────────────────────────────────────── */}
        {result && (
          <div className="px-5 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', fontFamily: 'Inter', margin: 0 }}>
                <span style={{ color: accent.from, fontWeight: 800 }}>{result.templateName}</span>
                <span style={{ opacity: 0.7 }}>{`  in  `}{keyDisplay} {scale === 'major' ? 'Major' : 'Minor'}</span>
              </p>
            </div>

            {/* Editable chord row */}
            <div
              className="flex flex-wrap gap-2 p-3 rounded-2xl"
              style={{ background: 'var(--app-surface-low)', border: '1px solid rgba(128,128,128,0.10)' }}
              data-testid="generated-progression"
            >
              {activeChordIds.map((id, i) => {
                const c = getChordById(id);
                const roman = result.romans[i] ?? '';
                const swapOpen = swapOpenIdx === i;
                return (
                  <div key={`${id}-${i}`} style={{ position: 'relative' }}>
                    <button
                      data-testid={`gen-chord-${i}`}
                      onClick={() => setSwapOpenIdx(swapOpen ? null : i)}
                      className="btn-smooth"
                      aria-label={`Edit chord ${c?.name ?? id}`}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '8px 12px', minWidth: 64, borderRadius: 14,
                        background: swapOpen ? `${accent.from}26` : 'var(--app-surface-high)',
                        border: swapOpen ? `1px solid ${accent.from}66` : '1px solid rgba(128,128,128,0.14)',
                        cursor: 'pointer', transition: 'all 140ms',
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: 700, color: swapOpen ? accent.from : 'var(--c-text-muted)', fontFamily: 'Manrope', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>{roman}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text-primary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', marginTop: 3, lineHeight: 1 }}>{c?.name ?? id}</span>
                    </button>
                    {/* Swap picker */}
                    {swapOpen && (
                      <div
                        style={{
                          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
                          background: 'var(--app-surface)', border: '1px solid rgba(128,128,128,0.18)',
                          borderRadius: 12, padding: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                          minWidth: 220, animation: 'spring-in 160ms cubic-bezier(0.22,1,0.36,1)',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--c-text-muted)', fontFamily: 'Manrope', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px', padding: '0 4px' }}>
                          Swap with diatonic chord
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {diatonic.map(d => {
                            const dc   = getChordById(d.chordId);
                            const same = d.chordId === id;
                            return (
                              <button
                                key={d.chordId}
                                onClick={() => handleSwap(i, d.chordId)}
                                className="btn-smooth"
                                style={{
                                  padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                                  background: same ? `${accent.from}22` : 'rgba(128,128,128,0.08)',
                                  border: same ? `1px solid ${accent.from}44` : '1px solid rgba(128,128,128,0.14)',
                                  color: same ? accent.from : 'var(--c-text-primary)',
                                  fontFamily: 'Manrope', fontWeight: 700, fontSize: 12,
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, lineHeight: 1.1,
                                }}
                              >
                                <span style={{ fontSize: 8.5, opacity: 0.8 }}>{d.roman}</span>
                                <span>{dc?.name ?? d.chordId}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ height: 1, background: 'rgba(128,128,128,0.14)', margin: '6px -4px' }} />
                        <button
                          onClick={() => handleRemove(i)}
                          className="btn-smooth w-full"
                          style={{ padding: '6px 8px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#f87171', fontFamily: 'Manrope', fontWeight: 700, fontSize: 11, textAlign: 'left' }}
                        >Remove this chord</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Append button */}
              <button
                onClick={handleAppendDiatonic}
                aria-label="Add chord"
                className="btn-smooth"
                style={{
                  padding: '8px 12px', minWidth: 44, borderRadius: 14,
                  background: 'transparent', border: '1px dashed rgba(128,128,128,0.30)',
                  color: 'var(--c-text-muted)', fontFamily: 'Manrope', fontWeight: 700, fontSize: 18, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >+</button>
            </div>

            {/* ── Bottom actions ───────────────────────────────────── */}
            <div className="mt-4 flex gap-2">
              <button
                data-testid="use-progression-btn"
                onClick={handleUse}
                disabled={!activeChordIds.length}
                className="btn-smooth flex-1 py-3 font-bold"
                style={{
                  background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  color: 'white', borderRadius: 9999, fontFamily: 'Manrope', fontSize: 13,
                  boxShadow: `0 4px 20px ${accent.to}40`, border: 'none',
                  cursor: activeChordIds.length ? 'pointer' : 'not-allowed', opacity: activeChordIds.length ? 1 : 0.5,
                }}
              >Use Progression</button>
              <button
                data-testid="load-to-song-btn"
                onClick={() => setPresetPickerOpen(true)}
                disabled={!activeChordIds.length}
                className="btn-smooth py-3 px-4 font-bold"
                aria-label={t.chord.loadToSong}
                title={t.chord.loadToSong}
                style={{
                  background: 'var(--app-surface-high)', color: accent.from,
                  borderRadius: 9999, fontFamily: 'Manrope', fontSize: 13,
                  border: 'none', cursor: activeChordIds.length ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: activeChordIds.length ? 1 : 0.5,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>queue_music</span>
              </button>
              <button
                data-testid="save-progression-favorite-btn"
                onClick={() => setSavePromptOpen(true)}
                disabled={!activeChordIds.length}
                className="btn-smooth py-3 px-4 font-bold"
                aria-label="Save as favorite"
                title="Save as favorite"
                style={{
                  background: 'var(--app-surface-high)', color: accent.from,
                  borderRadius: 9999, fontFamily: 'Manrope', fontSize: 13,
                  border: 'none', cursor: activeChordIds.length ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: activeChordIds.length ? 1 : 0.5,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bookmark_add</span>
              </button>
            </div>

            {savePromptOpen && (
              <div className="mt-3 spring-in flex gap-2">
                <input
                  autoFocus
                  data-testid="save-favorite-name-input"
                  value={progName}
                  onChange={e => setProgName(e.target.value)}
                  placeholder="Name your progression…"
                  className="flex-1 py-2.5 px-4 text-sm outline-none"
                  style={{ background: 'var(--app-surface-low)', color: 'var(--c-text-primary)', borderRadius: 9999, border: '1px solid rgba(72,72,72,0.15)', fontFamily: 'Inter' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveConfirm();
                    if (e.key === 'Escape') setSavePromptOpen(false);
                  }}
                />
                <button
                  data-testid="save-favorite-confirm"
                  onClick={handleSaveConfirm}
                  disabled={!progName.trim()}
                  className="btn-smooth px-5 py-2.5 font-bold text-sm"
                  style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: 'white', borderRadius: 9999, fontFamily: 'Manrope', border: 'none', cursor: progName.trim() ? 'pointer' : 'not-allowed', opacity: progName.trim() ? 1 : 0.5 }}
                >Save</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Preset picker (Load-to-Song) ─────────────────────────── */}
      {presetPickerOpen && (
        <PresetPickerSheet
          accent={accent}
          presets={sortedPresets}
          chordCount={activeChordIds.length}
          closing={presetPickerClosing}
          onPick={handleLoadToPreset}
          onClose={requestClosePicker}
        />
      )}

      {/* ── Confirmation toast after load-to-song ────────────────── */}
      {loadedToName && (
        <div
          aria-live="polite"
          className="fixed left-1/2 spring-in"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
            transform: 'translateX(-50%)',
            background: 'var(--app-surface-high)',
            color: 'var(--c-text-primary)',
            padding: '10px 16px',
            borderRadius: 9999,
            fontFamily: 'Manrope',
            fontWeight: 700,
            fontSize: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
            border: `1px solid ${accent.from}44`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 70,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: accent.from }}>check_circle</span>
          {t.chord.addedToSong.replace('{name}', loadedToName)}
        </div>
      )}
    </div>
  );
}

// ─── Sub-modal: Preset picker ─────────────────────────────────────────────
interface PresetPickerProps {
  accent: { from: string; to: string; mid: string };
  presets: SongPreset[];
  chordCount: number;
  /** Parent-controlled exit-anim flag. When true, the picker plays its
   *  sheet-exit / overlay-fade-out classes; the parent unmounts after
   *  the animation completes. */
  closing: boolean;
  onPick: (p: SongPreset) => void;
  /** Asks the parent to start the close animation. */
  onClose: () => void;
}

function PresetPickerSheet({ accent, presets, chordCount, closing, onPick, onClose }: PresetPickerProps) {
  const t = useT();

  const chordsLabel = chordCount === 1
    ? t.chord.chordsCountOne
    : t.chord.chordsCountOther.replace('{count}', String(chordCount));

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end sm:items-center justify-center ${closing ? 'overlay-fade-out' : 'overlay-fade-in'}`}
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.chord.chooseSongPreset}
    >
      <div
        className={`w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl ${closing ? 'sheet-exit' : 'sheet-enter'}`}
        style={{
          background: 'var(--app-surface)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          willChange: 'transform, opacity',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-text-primary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', margin: 0 }}>
              {t.chord.chooseSongPreset}
            </h3>
            <p style={{ fontSize: 11.5, color: 'var(--c-text-muted)', fontFamily: 'Inter', margin: '2px 0 0' }}>
              {chordsLabel} · {t.chord.appendChordsHint}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn-smooth"
            style={{ width: 32, height: 32, flexShrink: 0, borderRadius: '50%', background: 'var(--app-surface-high)', border: 'none', cursor: 'pointer', color: 'var(--c-text-secondary)', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}
          >×</button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', padding: '4px 12px 8px' }}>
          {presets.length === 0 ? (
            <div
              className="spring-in"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '36px 20px', gap: 8, textAlign: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--c-text-muted)', opacity: 0.7 }}>library_music</span>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'Manrope', margin: '4px 0 0' }}>
                {t.chord.noPresetsYet}
              </p>
              <p style={{ fontSize: 12, color: 'var(--c-text-muted)', fontFamily: 'Inter', margin: 0 }}>
                {t.chord.noPresetsHint}
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {presets.map(p => {
                const presetChordCount =
                  p.sections && p.sections.length > 0
                    ? p.sections.reduce((sum, s) => sum + s.chords.length, 0)
                    : p.chords.length;
                const presetChordsLabel = presetChordCount === 1
                  ? t.chord.chordsCountOne
                  : t.chord.chordsCountOther.replace('{count}', String(presetChordCount));
                return (
                  <li key={p.id}>
                    <button
                      data-testid={`pick-preset-${p.id}`}
                      onClick={() => onPick(p)}
                      className="btn-smooth"
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '12px 14px', borderRadius: 14,
                        background: 'var(--app-surface-high)',
                        border: '1px solid rgba(128,128,128,0.12)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 36, height: 36, flexShrink: 0,
                          borderRadius: 10,
                          background: `linear-gradient(135deg, ${accent.from}33, ${accent.to}22)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: accent.from,
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>music_note</span>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: 'Manrope', fontSize: 13.5, fontWeight: 800, color: 'var(--c-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name || 'Untitled'}
                        </div>
                        <div style={{ fontFamily: 'Inter', fontSize: 11, color: 'var(--c-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                          {[p.artist?.trim(), `${p.key || '—'}`, presetChordsLabel].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--c-text-muted)' }}>chevron_right</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

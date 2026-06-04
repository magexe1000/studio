import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import AnimatedActionButton from '../components/animata/container/animated-border-trail';
import { useScrollHide } from '../lib/navScroll';
import { getChordById, getRelatedChords, suggestNextChord } from '../data/chords';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { useT } from '../lib/useT';
import GuitarDiagram from '../components/GuitarDiagram';
import PianoDiagram from '../components/PianoDiagram';
import FourStringDiagram from '../components/FourStringDiagram';
import ChordDiagram from '../components/ChordDiagram';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import CustomChordBuilder from '../components/CustomChordBuilder';
import ProgressionGenerator from '../components/ProgressionGenerator';
import { setBackHandler } from '../lib/backStack';
import { playChord, stopChordPlayback } from '../lib/guitarAudio';
import type { GuitarChordData } from '../data/chords';
import MusicNotesLottie from '../components/lottie/MusicNotesLottie';
import { useScrollFade } from '../components/ScrollFade';

function RelatedPlayBtn({ guitar, accent }: {
  guitar: GuitarChordData;
  accent: { from: string; to: string; mid: string };
}) {
  const [playing, setPlaying] = useState(false);
  const handlePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (playing) { stopChordPlayback(); setPlaying(false); return; }
    setPlaying(true);
    playChord(guitar);
    setTimeout(() => setPlaying(false), 2800);
  }, [guitar, playing]);

  return (
    <button
      aria-label="Play chord"
      onClick={handlePlay}
      style={{
        width: 24, height: 24, borderRadius: '50%',
        background: playing ? `${accent.from}30` : 'rgba(255,255,255,0.07)',
        border: 'none', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 0,
        transition: 'background 200ms ease',
      }}
    >
      <span className="material-symbols-outlined" style={{
        fontSize: '13px',
        color: playing ? accent.from : 'var(--c-text-secondary)',
        fontVariationSettings: "'FILL' 1",
        transition: 'color 200ms ease',
      }}>{playing ? 'stop' : 'play_arrow'}</span>
    </button>
  );
}

export default function ChordPanel() {
  const {
    selectedChordId,
    activePanel,
    settings,
    toggleFavorite,
    isFavorite,
    addToProgression,
    currentProgressionChords,
    recentChords,
    selectChord,
    trackChordUsage,
  } = useChordStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollHide(scrollRef);
  const t = useT();
  const { ref: recentScrollRef, fadeClass: recentFadeClass } = useScrollFade();

  const [saving, setSaving] = useState(false);
  const [progName, setProgName] = useState('');
  const [showFinder, setShowFinder] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [chordPlaying, setChordPlaying] = useState(false);

  // Register back handler when Chord panel is active and the finder is open.
  // Generator owns its own back-handler while open (registered in the modal),
  // so we only intercept here when the finder is the active overlay.
  useEffect(() => {
    if (activePanel !== 'chord') return;
    if (showGenerator) return; // generator handles its own back stack
    if (!showFinder) { setBackHandler(null); return; }
    setBackHandler(() => { setShowFinder(false); return true; });
    return () => setBackHandler(null);
  }, [activePanel, showFinder, showGenerator]);

  const chord = selectedChordId ? getChordById(selectedChordId) : null;

  const handlePlayChord = useCallback(() => {
    if (!chord) return;
    if (chordPlaying) { stopChordPlayback(); setChordPlaying(false); return; }
    setChordPlaying(true);
    playChord(chord.guitar);
    setTimeout(() => setChordPlaying(false), 2800);
  }, [chord, chordPlaying]);
  const favorite = chord ? isFavorite(chord.id) : false;
  const accent = ACCENT_COLORS[settings.perApp?.chords?.accentColor ?? settings.accentColor] ?? ACCENT_COLORS.blue;

  useEffect(() => {
    if (chord && settings.chordAssistant && settings.assistantLearning) {
      trackChordUsage(chord.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chord?.id]);

  const relatedChords = useMemo(
    () => (chord && settings.chordAssistant && settings.assistantSmartSuggestions)
      ? getRelatedChords(chord).slice(0, 4) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chord?.id, settings.chordAssistant, settings.assistantSmartSuggestions],
  );
  const progressionChords = useMemo(
    () => currentProgressionChords.map(id => getChordById(id)).filter(Boolean),
    [currentProgressionChords],
  );
  const suggestions = useMemo(
    () => (settings.chordAssistant && settings.assistantProgressionTips)
      ? suggestNextChord(progressionChords as any).slice(0, 5) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressionChords, settings.chordAssistant, settings.assistantProgressionTips],
  );

  const recentList = recentChords
    .map(id => getChordById(id))
    .filter(Boolean)
    .slice(0, 6) as NonNullable<ReturnType<typeof getChordById>>[];

  const handleAddToProgression = useCallback(() => {
    if (chord) addToProgression(chord.id);
  }, [chord, addToProgression]);

  if (!chord) {
    return (
      <div className="flex flex-col h-full app-bg" style={{ position: 'relative' }}>
        <header className="flex-none px-6 pt-6 pb-1 app-bg spring-in">
          <h1 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <AppModeMenuLogo />
          </h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-6 spring-in">
          <MusicNotesLottie size={52} isLight={settings.theme === 'light'} style={{ marginBottom: 16 }} />
          <p style={{ color: 'var(--c-text-secondary)', fontSize: '14px', fontFamily: 'Inter', marginBottom: '20px', textAlign: 'center' }}>{t.chord.emptyState}</p>
          <button
            onClick={() => setShowFinder(true)}
            className="btn-smooth flex items-center gap-2 px-5 py-3 font-bold"
            style={{
              background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              color: 'white', borderRadius: '9999px', fontFamily: 'Manrope', fontSize: '14px',
              boxShadow: `0 4px 20px ${accent.to}40`,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
            {t.chordFinder.openFinder}
          </button>
          <AnimatedActionButton
            data-testid="open-generator-empty"
            onClick={() => setShowGenerator(true)}
            className="btn-smooth flex items-center gap-2 px-5 py-2.5 font-bold mt-3"
            trailColor={accent.from}
            style={{
              background: 'transparent', color: accent.from,
              border: `1.5px solid ${accent.from}55`,
              fontFamily: 'Manrope', fontSize: '13px', cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>auto_awesome</span>
            Generate Progression
          </AnimatedActionButton>
        </div>
        {showFinder && (
          <CustomChordBuilder
            accent={accent}
            mode="find"
            onClose={() => setShowFinder(false)}
          />
        )}
        {showGenerator && (
          <ProgressionGenerator
            accent={accent}
            onClose={() => setShowGenerator(false)}
          />
        )}
      </div>
    );
  }

  const notesStr = chord.notes.join(' - ');
  const typeStr = chord.type.charAt(0).toUpperCase() + chord.type.slice(1) + ' Chord';

  const renderDiagram = (size: 'sm' | 'md' | 'lg' = 'lg') => {
    const props = {
      chordName: chord.name,
      notes: chord.notes,
      intervals: chord.intervals,
      showNoteNames: settings.showNoteNames,
      showIntervals: settings.showIntervals,
      size,
    };
    if (settings.instrument === 'guitar') {
      return <GuitarDiagram chordData={chord.guitar} {...props} leftHanded={settings.leftHanded} />;
    } else if (settings.instrument === 'bass') {
      return <FourStringDiagram chordData={chord.guitar} {...props} instrument={settings.instrument} fiveString={settings.bassFiveString} />;
    } else {
      return <PianoDiagram chordData={chord.piano} {...props} />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden app-bg">
      {/* Minimal top label */}
      <header className="flex-none px-6 pt-6 pb-1 app-bg spring-in">
        <h1 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '7px' }}>
          <AppModeMenuLogo />
        </h1>
      </header>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar pb-32 spring-in">
        {/* Hero chord card */}
        <div
          className="mx-4 mt-4 rounded-3xl p-6 relative overflow-hidden"
          style={{ background: 'var(--app-surface)', transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)' }}
        >
          <div className="absolute top-5 right-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}>
              {t.chord.instruments[settings.instrument]}
            </p>
          </div>

          <div className="mt-2 mb-6">
            <h2
              className="font-extrabold tracking-tighter leading-none"
              style={{ fontSize: 'clamp(3rem, 12vw, 4.5rem)', color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}
            >
              {chord.name.replace(/\s/g, '')}
            </h2>
            <p className="mt-2" style={{ color: 'var(--c-text-secondary)', fontSize: '14px', fontFamily: 'Inter' }}>
              {notesStr} ({typeStr})
            </p>
          </div>

          {/* Diagram */}
          <div
            className="rounded-2xl p-6 flex justify-center items-center"
            style={{ background: 'var(--app-surface-lowest)', transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)' }}
          >
            {renderDiagram('lg')}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handlePlayChord}
              className="btn-smooth flex items-center gap-2 px-5 py-3 font-bold"
              style={{
                background: chordPlaying ? `${accent.from}25` : 'var(--app-surface-high)',
                color: chordPlaying ? accent.from : 'var(--c-text-primary)',
                borderRadius: '9999px',
                fontFamily: 'Manrope',
                fontSize: '14px',
                transition: 'background-color 200ms ease, color 200ms ease, transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>{chordPlaying ? 'stop' : 'play_arrow'}</span>
            </button>
            <button
              data-testid="add-to-progression"
              onClick={handleAddToProgression}
              className="btn-smooth flex items-center gap-2 px-6 py-3 font-bold"
              style={{
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                color: 'white',
                borderRadius: '9999px',
                fontFamily: 'Manrope',
                fontSize: '14px',
                boxShadow: `0 4px 20px ${accent.to}40`,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
              {t.chord.addToProgression}
            </button>
            <button
              data-testid="toggle-favorite"
              onClick={() => toggleFavorite(chord.id)}
              className="btn-smooth px-4 py-3 font-bold"
              style={{
                background: favorite ? 'rgba(238,125,119,0.15)' : 'var(--app-surface-high)',
                color: favorite ? '#ee7d77' : '#e7e5e4',
                borderRadius: '9999px',
                fontFamily: 'Manrope',
                fontSize: '14px',
                transition: 'background-color 200ms ease, transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '22px', fontVariationSettings: favorite ? "'FILL' 1" : "'FILL' 0", transition: 'font-variation-settings 300ms ease' }}
              >
                favorite
              </span>
            </button>
          </div>
        </div>

        {/* Find Chord section */}
        <div className="mx-4 mt-4 rounded-3xl p-5 app-surface">
          <button
            onClick={() => setShowFinder(true)}
            className="btn-smooth flex items-center gap-3 w-full"
            style={{ textAlign: 'left' }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
              background: `${accent.from}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: accent.from }}>search</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: 'Manrope', fontWeight: 700, fontSize: '14px', color: 'var(--c-text-primary)' }}>{t.chordFinder.openFinder}</p>
              <p style={{ fontFamily: 'Inter', fontSize: '12px', color: 'var(--c-text-secondary)', marginTop: '2px' }}>{t.chordFinder.subtitle}</p>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--c-text-muted)' }}>chevron_right</span>
          </button>
        </div>

        {/* Voicings & Variations — gated on Smart Suggestions */}
        {settings.chordAssistant && settings.assistantSmartSuggestions && (
        <div className="mx-4 mt-4 rounded-3xl p-6 app-surface">
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter' }}>
            {t.chord.voicings}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {relatedChords.slice(0, 2).map(related => (
              <div
                key={related.id}
                className="card-hover text-left p-4"
                style={{ background: 'var(--app-surface-high)', borderRadius: '0.75rem', position: 'relative' }}
              >
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                  <RelatedPlayBtn guitar={related.guitar} accent={accent} />
                </div>
                <button
                  data-testid={`related-chord-${related.id}`}
                  onClick={() => selectChord(related.id)}
                  style={{ background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold" style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontSize: '13px' }}>{related.name}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '6px 6px 3px', transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)' }}>
                    <ChordDiagram data={related.guitar} accentFrom={accent.from} />
                  </div>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter' }}>{related.type}</p>
                </button>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Harmonic Context */}
        <div className="mx-4 mt-4 rounded-3xl p-6 app-surface">
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter' }}>
            {t.chord.harmonicContext}
          </h3>
          <div className="space-y-5">
            {[
              ...(settings.chordAssistant && settings.assistantProgressionTips ? [{ icon: 'analytics', label: t.chord.commonlyFollowedBy, value: suggestions.slice(0, 3).map(s => s.name).join(', ') || t.chord.exploreLibrary }] : []),
              { icon: 'piano', label: t.chord.intervalSpacing, value: chord.intervals.join(' - ') },
              ...(settings.instrument === 'guitar' ? [{ icon: 'settings_input_component', label: t.chord.fingering, value: chord.guitar.frets.map(f => f === -1 ? 'x' : f === 0 ? 'O' : f).join(' - ') }] : []),
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex-none flex items-center justify-center" style={{ background: '#3a3b42' }}>
                  <span className="material-symbols-outlined" style={{ color: accent.from, fontSize: '20px' }}>{icon}</span>
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter' }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Progression */}
        {progressionChords.length > 0 && (
          <div className="mx-4 mt-4 rounded-3xl p-6 app-surface">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter' }}>{t.chord.currentProgression}</h3>
              <div className="flex items-center gap-3">
                <button
                  data-testid="open-generator-header"
                  className="btn-smooth text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                  onClick={() => setShowGenerator(true)}
                  style={{ color: accent.from, fontFamily: 'Manrope' }}
                  title="Generate a new progression"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>auto_awesome</span>
                  Generate
                </button>
                <button
                  className="btn-smooth text-[10px] font-bold uppercase tracking-wider"
                  data-testid="clear-progression"
                  onClick={() => useChordStore.getState().clearProgression()}
                  style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope' }}
                >
                  {t.chord.clear}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {progressionChords.map((c, i) => c && (
                <button
                  key={`${c.id}-${i}`}
                  data-testid={`prog-chord-${i}`}
                  onClick={() => useChordStore.getState().removeFromProgression(i)}
                  className="btn-smooth px-4 py-2 font-medium text-sm"
                  style={{ background: 'var(--app-surface-high)', color: 'var(--c-text-primary)', borderRadius: '9999px', fontFamily: 'Manrope' }}
                  title={t.chord.tapToRemove}
                >
                  {c.name}
                </button>
              ))}
              <button
                onClick={handleAddToProgression}
                className="btn-smooth px-4 py-2 font-medium text-sm"
                style={{ background: 'transparent', color: 'var(--c-text-secondary)', borderRadius: '9999px', border: '1px dashed rgba(72,72,72,0.4)', fontFamily: 'Manrope', fontSize: '13px' }}
              >
                + {chord.name.replace(/\s/g, '')}
              </button>
            </div>
            {!saving ? (
              <button
                data-testid="save-progression-btn"
                onClick={() => setSaving(true)}
                className="btn-smooth w-full py-2.5 font-bold text-sm"
                style={{ background: 'var(--app-surface-high)', color: accent.from, borderRadius: '9999px', fontFamily: 'Manrope' }}
              >
                {t.chord.saveProgression}
              </button>
            ) : (
              <div className="flex gap-2 spring-in">
                <input
                  autoFocus
                  value={progName}
                  onChange={e => setProgName(e.target.value)}
                  placeholder={t.chord.namePlaceholder}
                  data-testid="progression-name-input"
                  className="flex-1 py-2.5 px-4 text-sm outline-none"
                  style={{ background: 'var(--app-surface-low)', color: 'var(--c-text-primary)', borderRadius: '9999px', border: '1px solid rgba(72,72,72,0.15)', fontFamily: 'Inter' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && progName.trim()) { useChordStore.getState().saveProgression(progName.trim()); setSaving(false); setProgName(''); }
                    if (e.key === 'Escape') setSaving(false);
                  }}
                />
                <button
                  onClick={() => { if (progName.trim()) { useChordStore.getState().saveProgression(progName.trim()); setSaving(false); setProgName(''); } }}
                  data-testid="save-progression-confirm"
                  className="btn-smooth px-5 py-2.5 font-bold text-sm"
                  style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, color: 'white', borderRadius: '9999px', fontFamily: 'Manrope' }}
                >
                  {t.chord.save}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Recent Chords */}
        {recentList.length > 0 && (
          <div className="mx-4 mt-4 rounded-3xl p-6 app-surface">
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter' }}>{t.chord.recentChords}</h3>
            <div className="scroll-fade-container">
              <div className={`scroll-fade-content flex gap-2 overflow-x-auto no-scrollbar pb-1 ${recentFadeClass}`} ref={recentScrollRef}>
                {recentList.map(c => (
                <button
                  key={c.id}
                  onClick={() => selectChord(c.id)}
                  className="btn-smooth flex-none"
                  style={{
                    width: '76px',
                    padding: '9px 8px 7px',
                    background: selectedChordId === c.id ? `${accent.to}20` : 'var(--app-surface-high)',
                    borderRadius: '1rem',
                    border: selectedChordId === c.id ? `1.5px solid ${accent.to}33` : '1px solid rgba(72,72,72,0.1)',
                    display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '5px',
                    transition: 'background-color 200ms ease, border-color 200ms ease, color 200ms ease, transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                >
                  <p style={{ color: selectedChordId === c.id ? accent.from : 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '12px', letterSpacing: '-0.02em', lineHeight: 1, textAlign: 'left' }}>
                    {c.name.replace(/\s/g, '')}
                  </p>
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '4px 4px 2px' }}>
                    <ChordDiagram data={c.guitar} accentFrom={accent.from} />
                  </div>
                </button>
              ))}
              </div>
            </div>
          </div>
        )}

        {/* Saved Progressions */}
        <SavedProgressions accent={accent} />
      </div>

      {/* Chord Finder modal */}
      {showFinder && (
        <CustomChordBuilder
          accent={accent}
          mode="find"
          onClose={() => setShowFinder(false)}
        />
      )}
      {/* Progression Generator modal */}
      {showGenerator && (
        <ProgressionGenerator
          accent={accent}
          onClose={() => setShowGenerator(false)}
        />
      )}
    </div>
  );
}

function SavedProgressions({ accent }: { accent: { from: string; to: string; mid: string } }) {
  const { progressions, loadProgression, deleteProgression } = useChordStore();
  const t = useT();
  if (progressions.length === 0) return null;

  return (
    <div className="mx-4 mt-4 rounded-3xl p-6 app-surface">
      <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter' }}>{t.chord.savedProgressions}</h3>
      <div className="space-y-3">
        {progressions.map(prog => {
          const chordNames = prog.chords.map(id => getChordById(id)?.name?.replace(/\s/g, '') || '?').join(' → ');
          return (
            <div key={prog.id} className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--app-surface-high)', borderRadius: '0.75rem' }}>
              <div className="flex-1 min-w-0 mr-4">
                <p className="font-bold text-sm truncate" style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>{prog.name}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter' }}>{chordNames}</p>
              </div>
              <div className="flex items-center gap-3">
                <button data-testid={`load-prog-${prog.id}`} onClick={() => loadProgression(prog.id)} className="btn-smooth" style={{ color: accent.from, fontFamily: 'Manrope', fontSize: '12px', fontWeight: 700 }}>{t.chord.load}</button>
                <button data-testid={`del-prog-${prog.id}`} onClick={() => deleteProgression(prog.id)} className="btn-smooth" style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontSize: '18px' }}>×</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

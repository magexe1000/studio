import { useScrollHide, getChordById, getAllChords, getRelatedChords, suggestNextChord, useChordStore, ACCENT_COLORS, useT, useBackHandler, setBackHandler, playChord, stopChordPlayback, type GuitarChordData, useIsWebDesktop, registerDebugProvider, unregisterDebugProvider } from '@workspace/studio-core';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import AnimatedActionButton from '../components/animata/container/animated-border-trail';
import GuitarDiagram from '../components/GuitarDiagram';
import PianoDiagram from '../components/PianoDiagram';
import FourStringDiagram from '../components/FourStringDiagram';
import ChordDiagram from '../components/ChordDiagram';
import { AppModeMenuLogo } from '../components/AppModeMenuLogo';
import CustomChordBuilder from '../components/CustomChordBuilder';
import ProgressionGenerator from '../components/ProgressionGenerator';
import MusicNotesLottie from '../components/lottie/MusicNotesLottie';
import { useScrollFade } from '../components/ScrollFade';

function RelatedPlayBtn({ guitar, accent, isLight }: {
  guitar: GuitarChordData;
  accent: { from: string; to: string; mid: string };
  isLight?: boolean;
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
        background: playing ? `${accent.from}30` : (isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'),
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
  const isWebDesktop = useIsWebDesktop();
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
    setLibraryActiveType,
    setActivePanel,
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

  useEffect(() => {
    registerDebugProvider({
      id: 'chordex',
      name: 'Chordex Editor',
      getDebugState: () => ({
        selectedChordId,
        activePanel,
        currentProgressionChords,
        recentChordsCount: recentChords?.length || 0,
        transposeState: useChordStore.getState().transpositions,
        finderOpen: showFinder,
        generatorOpen: showGenerator,
        playingState: chordPlaying ? 'playing' : 'stopped'
      })
    });
    return () => {
      unregisterDebugProvider('chordex');
    };
  }, [selectedChordId, activePanel, currentProgressionChords, recentChords, showFinder, showGenerator, chordPlaying]);

  // Register back handler when Chord panel is active
  useBackHandler('nested', () => {
    if (activePanel !== 'chord') return false;
    if (showGenerator) return false; // generator handles its own back stack
    if (showFinder) {
      setShowFinder(false);
      return true;
    }
    if (!isWebDesktop && selectedChordId) {
      selectChord(null as any);
      return true;
    }
    return false;
  }, [activePanel, showFinder, showGenerator, isWebDesktop, selectedChordId]);

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
  const chordsVis = settings.perApp?.chords ?? { theme: settings.theme ?? 'dark', amoledMode: settings.amoledMode ?? false };
  const isLight = settings.theme === 'light' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const getPanelClass = (padding: string = 'p-6') => {
    return isWebDesktop
      ? `mx-4 mt-4 rounded-xl border ${padding} ${isLight ? 'bg-white/80 border-zinc-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' : 'border-zinc-900 bg-zinc-950/40'}`
      : `mx-4 mt-4 rounded-3xl ${padding} app-surface`;
  };
  const renderChordDiagram = (c: any, size: 'sm' | 'md' | 'lg' = 'lg') => {
    if (!c) return null;
    const props = {
      chordName: c.name,
      notes: c.notes,
      intervals: c.intervals,
      showNoteNames: settings.showNoteNames,
      showIntervals: settings.showIntervals,
      size,
    };
    if (settings.instrument === 'guitar') {
      return <GuitarDiagram chordData={c.guitar} {...props} leftHanded={settings.leftHanded} />;
    } else if (settings.instrument === 'bass') {
      return <FourStringDiagram chordData={c.guitar} {...props} instrument={settings.instrument} fiveString={settings.bassFiveString} />;
    } else {
      return <PianoDiagram chordData={c.piano} {...props} />;
    }
  };

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

  // Deterministic daily chord rotating offline
  const dailyChord = useMemo(() => {
    const chords = getAllChords();
    if (chords.length === 0) return null;
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const hash = (year * 367) + (month * 31) + day;
    return chords[Math.abs(hash) % chords.length];
  }, []);

  const [dailyPlaying, setDailyPlaying] = useState(false);

  const handlePlayDaily = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dailyChord) return;
    if (dailyPlaying) {
      stopChordPlayback();
      setDailyPlaying(false);
      return;
    }
    setDailyPlaying(true);
    playChord(dailyChord.guitar);
    setTimeout(() => setDailyPlaying(false), 2800);
  }, [dailyChord, dailyPlaying]);

  const isSpanish = settings.language === 'es';

  const getPracticeTip = (c: typeof dailyChord, isSp: boolean) => {
    if (!c) return "";
    const tipsEn: Record<string, string> = {
      major: "Major chords sound bright and happy. Focus on clean fingering for all active strings.",
      minor: "Minor chords carry a sad or reflective mood. Ensure the minor third note rings out clearly.",
      dom7: "Dominant 7th chords create tension that wants to resolve back to the tonic (I) chord.",
      maj7: "Major 7th chords have a dreamy, jazz-like quality. Make sure the major seventh interval is heard.",
      min7: "Minor 7th chords offer a mellow, sophisticated sound. Perfect for jazz, neo-soul, and lo-fi.",
      sus4: "Suspended chords build anticipation. Try resolving it immediately to the standard major chord.",
      sus2: "Suspended 2 chords sound open and modern. Excellent for atmospheric acoustic strumming."
    };
    const tipsEs: Record<string, string> = {
      major: "Los acordes mayores suenan brillantes y alegres. Enfócate en una digitación limpia en todas las cuerdas.",
      minor: "Los acordes menores transmiten una sensación triste o reflexiva. Asegúrate de que la tercera menor suene clara.",
      dom7: "Los acordes de séptima dominante crean tensión que se resuelve regresando al acorde tónico (I).",
      maj7: "Los acordes de séptima mayor tienen una cualidad de ensueño y jazz. Asegúrate de escuchar la séptima mayor.",
      min7: "Los acordes de séptima menor ofrecen un sonido suave y sofisticado. Perfecto para jazz y lo-fi.",
      sus4: "Los acordes suspendidos crean anticipación. Intenta resolverlo inmediatamente a un acorde mayor estándar.",
      sus2: "Los acordes suspendidos 2 suenan abiertos y modernos. Excelente para rasgueo acústico atmosférico."
    };
    const tips = isSp ? tipsEs : tipsEn;
    return tips[c.type] || (isSp ? "Practica la transición fluida a esta forma desde otros acordes en tu progresión." : "Practice transitioning smoothly to this shape from other chords in your progression.");
  };

  const QUICK_CATS = [
    {
      type: 'major' as const,
      icon: 'wb_sunny',
      label: isSpanish ? 'Mayor' : 'Major',
      desc: isSpanish ? 'Brillante, alegre, fundacional.' : 'Bright, happy, foundational.',
      color: '#679cff'
    },
    {
      type: 'minor' as const,
      icon: 'dark_mode',
      label: isSpanish ? 'Menor' : 'Minor',
      desc: isSpanish ? 'Melancólico y emocional.' : 'Moody & emotional.',
      color: '#bb5551'
    },
    {
      type: '7th' as const,
      icon: 'electric_bolt',
      label: isSpanish ? '7ma Dominante' : 'Dominant 7th',
      desc: isSpanish ? 'Columna del jazz y blues.' : 'Jazz & blues backbone.',
      color: '#9d9da6'
    },
    {
      type: 'maj7' as const,
      icon: 'stars',
      label: isSpanish ? '7ma Mayor' : 'Major 7th',
      desc: isSpanish ? 'Exuberante y de ensueño.' : 'Lush & dreamy.',
      color: '#679cff'
    },
    {
      type: 'min7' as const,
      icon: 'nightlight',
      label: isSpanish ? '7ma Menor' : 'Minor 7th',
      desc: isSpanish ? 'Suave e introspectivo.' : 'Smooth & introspective.',
      color: '#bb5551'
    },
    {
      type: 'sus4' as const,
      icon: 'hourglass_empty',
      label: isSpanish ? 'Suspendido' : 'Suspended',
      desc: isSpanish ? 'Tensión suspendida.' : 'Suspended tension.',
      color: '#2dd4bf'
    },
  ];

  if (!chord) {
    if (!dailyChord) return null;
    return (
      <div className="flex flex-col h-full app-bg" style={{ position: 'relative' }}>
        {!isWebDesktop && (
          <header className="flex-none px-6 pt-6 pb-1 app-bg spring-in">
            <h1 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <AppModeMenuLogo />
            </h1>
          </header>
        )}
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar pb-32 spring-in" style={{ paddingTop: isWebDesktop ? '20px' : '0' }}>
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Deterministic Chord of the Day Card */}
            {dailyChord && (
              <div style={{
                background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                border: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.05)',
                borderRadius: '24px',
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Subtle background glow */}
                <div style={{
                  position: 'absolute',
                  top: '-50px',
                  right: '-50px',
                  width: '150px',
                  height: '150px',
                  background: `radial-gradient(circle, ${accent.from}15 0%, transparent 70%)`,
                  pointerEvents: 'none'
                }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: accent.from,
                      background: `${accent.from}15`,
                      padding: '4px 10px',
                      borderRadius: '99px',
                    }}>
                      {isSpanish ? 'Acorde del Día' : 'Chord of the Day'}
                    </span>
                    <h3 style={{
                      fontSize: '32px',
                      fontWeight: 900,
                      margin: '12px 0 4px',
                      color: 'var(--c-text-primary)',
                      fontFamily: 'Manrope',
                      letterSpacing: '-0.02em',
                    }} className="truncate">
                      {dailyChord.name}
                    </h3>
                    <p style={{
                      fontSize: '13px',
                      color: 'var(--c-text-secondary)',
                      margin: 0,
                      fontFamily: 'Inter',
                    }} className="truncate">
                      {dailyChord.notes.join(' - ')} ({dailyChord.type.charAt(0).toUpperCase() + dailyChord.type.slice(1)})
                    </p>
                  </div>

                  <div style={{
                    background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                    borderRadius: '16px',
                    padding: '8px',
                    width: '90px',
                    height: '90px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(128,128,128,0.1)',
                    flexShrink: 0
                  }}>
                    {renderChordDiagram(dailyChord, 'sm')}
                  </div>
                </div>

                <div style={{
                  background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                  borderRadius: '14px',
                  padding: '12px 16px',
                  fontSize: '12px',
                  color: 'var(--c-text-secondary)',
                  lineHeight: '1.5',
                  borderLeft: `3px solid ${accent.from}`,
                  marginBottom: '20px',
                  fontFamily: 'Inter',
                  textAlign: 'left'
                }}>
                  <strong>{isSpanish ? 'Tip de práctica: ' : 'Practice Tip: '}</strong>
                  {getPracticeTip(dailyChord, isSpanish)}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handlePlayDaily}
                    style={{
                      flex: '1 1 auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      height: '40px',
                      borderRadius: '12px',
                      background: dailyPlaying ? `${accent.from}25` : 'var(--app-surface-high)',
                      border: 'none',
                      color: dailyPlaying ? accent.from : 'var(--c-text-primary)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'Manrope',
                      transition: 'all 200ms ease',
                      minWidth: '80px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: dailyPlaying ? "'FILL' 1" : undefined }}>
                      {dailyPlaying ? 'stop' : 'play_arrow'}
                    </span>
                    {dailyPlaying ? (isSpanish ? 'Detener' : 'Stop') : (isSpanish ? 'Escuchar' : 'Listen')}
                  </button>

                  <button
                    onClick={() => addToProgression(dailyChord.id)}
                    style={{
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '12px',
                      background: 'var(--app-surface-high)',
                      border: 'none',
                      color: 'var(--c-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform 150ms ease',
                    }}
                    className="btn-smooth"
                    title={isSpanish ? 'Agregar a la progresión' : 'Add to progression'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                  </button>

                  <button
                    onClick={() => toggleFavorite(dailyChord.id)}
                    style={{
                      height: '40px',
                      padding: '0 12px',
                      borderRadius: '12px',
                      background: isFavorite(dailyChord.id) ? 'rgba(238,125,119,0.15)' : 'var(--app-surface-high)',
                      border: 'none',
                      color: isFavorite(dailyChord.id) ? '#ee7d77' : 'var(--c-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform 150ms ease',
                    }}
                    className="btn-smooth"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: isFavorite(dailyChord.id) ? "'FILL' 1" : undefined }}>
                      favorite
                    </span>
                  </button>

                  <button
                    onClick={() => selectChord(dailyChord.id)}
                    style={{
                      height: '40px',
                      padding: '0 16px',
                      borderRadius: '12px',
                      background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                      border: 'none',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: `0 4px 12px ${accent.to}30`,
                    }}
                    className="btn-smooth"
                  >
                    {isSpanish ? 'Detalles' : 'Details'}
                  </button>
                </div>
              </div>
            )}

            {/* Quick Categories Grid */}
            <div>
              <h4 style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--c-text-secondary)',
                marginBottom: '12px',
                fontFamily: 'Manrope',
                textAlign: 'left'
              }}>
                {isSpanish ? 'Categorías Rápidas' : 'Quick Categories'}
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
              }}>
                {QUICK_CATS.map(cat => (
                  <button
                    key={cat.type}
                    onClick={() => {
                      setLibraryActiveType(cat.type);
                      setActivePanel('library');
                    }}
                    style={{
                      background: 'var(--app-surface-high)',
                      border: '1px solid rgba(128,128,128,0.06)',
                      borderRadius: '16px',
                      padding: '12px 14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 200ms ease',
                    }}
                    className="btn-smooth"
                  >
                    <span className="material-symbols-outlined" style={{
                      fontSize: '18px',
                      color: cat.color,
                    }}>
                      {cat.icon || 'music_note'}
                    </span>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--c-text-primary)', fontFamily: 'Manrope' }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontFamily: 'Inter', lineHeight: '1.3' }}>
                      {cat.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Progression Generator buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setShowFinder(true)}
                className="btn-smooth flex items-center justify-center gap-2 px-5 py-3 font-bold"
                style={{
                  background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  color: 'white', borderRadius: '16px', fontFamily: 'Manrope', fontSize: '13px',
                  boxShadow: `0 4px 20px ${accent.to}25`,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
                {t.chordFinder.openFinder}
              </button>
              <AnimatedActionButton
                data-testid="open-generator-empty"
                onClick={() => setShowGenerator(true)}
                className="btn-smooth flex items-center justify-center gap-2 px-5 py-2.5 font-bold"
                trailColor={accent.from}
                style={{
                  background: 'transparent', color: accent.from,
                  border: `1.5px solid ${accent.from}55`,
                  borderRadius: '16px',
                  fontFamily: 'Manrope', fontSize: '12px', cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>auto_awesome</span>
                {isSpanish ? 'Generar Progresión' : 'Generate Progression'}
              </AnimatedActionButton>
            </div>
          </div>
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
    return renderChordDiagram(chord, size);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden app-bg">
      {!isWebDesktop && (
        <header className="flex-none px-6 pt-6 pb-1 app-bg spring-in">
          <h1 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-secondary)', fontFamily: 'Manrope', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <AppModeMenuLogo />
          </h1>
        </header>
      )}

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar pb-32 spring-in" style={{ paddingTop: isWebDesktop ? '20px' : '0' }}>
        {/* Hero chord card */}
        <div
          className={`${getPanelClass('p-6')} relative overflow-hidden`}
          style={isWebDesktop ? { position: 'relative' } : { background: 'var(--app-surface)', transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)' }}
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
                color: favorite ? '#ee7d77' : 'var(--c-text-primary)',
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
        <div className={getPanelClass('p-5')}>
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
        <div className={getPanelClass('p-6')}>
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
                  <RelatedPlayBtn guitar={related.guitar} accent={accent} isLight={isLight} />
                </div>
                <button
                  data-testid={`related-chord-${related.id}`}
                  onClick={() => selectChord(related.id)}
                  style={{ background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold" style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontSize: '13px' }}>{related.name}</span>
                  </div>
                  <div style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '6px 6px 3px', transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1)' }}>
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
        <div className={getPanelClass('p-6')}>
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
                <div className="w-10 h-10 rounded-full flex-none flex items-center justify-center" style={{ background: 'var(--app-surface-low)' }}>
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
          <div className={getPanelClass('p-6')}>
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
          <div className={getPanelClass('p-6')}>
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
                  <div style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)', borderRadius: '0.5rem', padding: '4px 4px 2px' }}>
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
  const isWebDesktop = useIsWebDesktop();
  const { settings, progressions, loadProgression, deleteProgression } = useChordStore();
  const t = useT();
  if (progressions.length === 0) return null;

  const isLight = settings.theme === 'light' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const getPanelClass = (padding: string = 'p-6') => {
    return isWebDesktop
      ? `mx-4 mt-4 rounded-xl border ${padding} ${isLight ? 'bg-white/80 border-zinc-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]' : 'border-zinc-900 bg-zinc-950/40'}`
      : `mx-4 mt-4 rounded-3xl ${padding} app-surface`;
  };

  return (
    <div className={getPanelClass('p-6')}>
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

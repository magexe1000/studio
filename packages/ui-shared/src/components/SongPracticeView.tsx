import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useChordStore } from '@workspace/studio-core';
import type { SongChart, SongChartSection, ChordMarker } from '@workspace/studio-core';

interface SongPracticeViewProps {
  song: SongChart;
  onClose: () => void;
}

interface ChordSegment {
  chord?: string;
  text: string;
}

// Partition a lyrics line into chord-text segments for inline-flex rendering
function getLineSegments(lyrics: string, chords: ChordMarker[]): ChordSegment[] {
  if (!chords || chords.length === 0) {
    return [{ text: lyrics || ' ' }];
  }
  const sortedChords = [...chords].sort((a, b) => a.offset - b.offset);
  const segments: ChordSegment[] = [];
  
  let lastOffset = 0;
  for (let i = 0; i < sortedChords.length; i++) {
    const chord = sortedChords[i];
    const nextOffset = i + 1 < sortedChords.length ? sortedChords[i + 1].offset : lyrics.length;
    
    // Text before the first chord
    if (i === 0 && chord.offset > 0) {
      segments.push({ text: lyrics.substring(0, chord.offset) });
    }
    
    segments.push({
      chord: chord.chord,
      text: lyrics.substring(chord.offset, nextOffset) || ' '
    });
    lastOffset = nextOffset;
  }
  
  if (lastOffset < lyrics.length) {
    segments.push({ text: lyrics.substring(lastOffset) });
  }
  
  return segments;
}

export function SongPracticeView({ song, onClose }: SongPracticeViewProps) {
  const language = useChordStore(s => s.settings.language);
  const isSpanish = language === 'es';

  // Configuration settings (persisted locally)
  const [practiceMode, setPracticeMode] = useState<'static' | 'scroll' | 'focus' | 'highlight'>(() => {
    return (localStorage.getItem('chordex:practice:mode') as any) ?? 'static';
  });
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(() => {
    return (localStorage.getItem('chordex:practice:fontSize') as any) ?? 'md';
  });
  const [chordSize, setChordSize] = useState<'sm' | 'md' | 'lg'>(() => {
    return (localStorage.getItem('chordex:practice:chordSize') as any) ?? 'md';
  });
  const [spacing, setSpacing] = useState<'tight' | 'normal' | 'wide'>(() => {
    return (localStorage.getItem('chordex:practice:spacing') as any) ?? 'normal';
  });
  const [contrastMode, setContrastMode] = useState<'normal' | 'high' | 'amoled'>(() => {
    return (localStorage.getItem('chordex:practice:contrast') as any) ?? 'normal';
  });
  const [tempo, setTempo] = useState<number>(song.bpm || 120);

  // Playback/scrolling states
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // References
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Save settings when changed
  useEffect(() => { localStorage.setItem('chordex:practice:mode', practiceMode); }, [practiceMode]);
  useEffect(() => { localStorage.setItem('chordex:practice:fontSize', fontSize); }, [fontSize]);
  useEffect(() => { localStorage.setItem('chordex:practice:chordSize', chordSize); }, [chordSize]);
  useEffect(() => { localStorage.setItem('chordex:practice:spacing', spacing); }, [spacing]);
  useEffect(() => { localStorage.setItem('chordex:practice:contrast', contrastMode); }, [contrastMode]);

  // Floating chord overlay persistent position
  const [overlayPos, setOverlayPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('chordex:practice:overlayPosition');
    if (saved) {
      try { setOverlayPos(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleDragEnd = (event: any, info: any) => {
    const nextPos = { x: info.offset.x + overlayPos.x, y: info.offset.y + overlayPos.y };
    setOverlayPos(nextPos);
    localStorage.setItem('chordex:practice:overlayPosition', JSON.stringify(nextPos));
  };

  // Compile a flat list of lines and calculate timestamps
  const parsedLines = useMemo(() => {
    const list: { sectionName: string; lineIndex: number; lyrics: string; chords: ChordMarker[]; timestamp: number; duration: number }[] = [];
    let currentTime = 0;
    const beatDurationMs = (60 / tempo) * 1000;
    const lineDurationMs = 8 * beatDurationMs; // 8 beats per line fallback

    let lineCounter = 0;
    song.sections.forEach((section) => {
      section.lines.forEach((line) => {
        const lineTime = line.timestamp !== undefined ? line.timestamp : currentTime;
        const lineDur = line.duration !== undefined ? line.duration : lineDurationMs;

        list.push({
          sectionName: section.name,
          lineIndex: lineCounter++,
          lyrics: line.lyrics,
          chords: line.chords || [],
          timestamp: lineTime,
          duration: lineDur,
        });
        currentTime = lineTime + lineDur;
      });
    });
    return list;
  }, [song, tempo]);

  // Total song duration derived from lines
  const totalDuration = useMemo(() => {
    if (parsedLines.length === 0) return 0;
    const last = parsedLines[parsedLines.length - 1];
    return last.timestamp + last.duration;
  }, [parsedLines]);

  // Flat list of chords with timestamps
  const flatChords = useMemo(() => {
    const list: { chord: string; time: number }[] = [];
    parsedLines.forEach((line) => {
      if (line.chords.length > 0) {
        const sorted = [...line.chords].sort((a, b) => a.offset - b.offset);
        sorted.forEach((marker) => {
          const relativeRatio = marker.offset / Math.max(1, line.lyrics.length);
          const chordTime = marker.timestamp !== undefined ? marker.timestamp : (line.timestamp + relativeRatio * line.duration);
          list.push({ chord: marker.chord, time: chordTime });
        });
      }
    });
    return list.sort((a, b) => a.time - b.time);
  }, [parsedLines]);

  // Resolve current active line and active chords
  const activeLine = useMemo(() => {
    const current = parsedLines.find((line, idx) => {
      const next = parsedLines[idx + 1];
      return elapsedTime >= line.timestamp && (!next || elapsedTime < next.timestamp);
    });
    return current ?? parsedLines[0];
  }, [parsedLines, elapsedTime]);

  const activeChordIndex = useMemo(() => {
    return flatChords.findIndex((c, idx) => {
      const next = flatChords[idx + 1];
      return elapsedTime >= c.time && (!next || elapsedTime < next.time);
    });
  }, [flatChords, elapsedTime]);

  const currentChord = activeChordIndex !== -1 ? flatChords[activeChordIndex].chord : (flatChords[0]?.chord || '—');
  const nextChord = activeChordIndex !== -1 && activeChordIndex + 1 < flatChords.length 
    ? flatChords[activeChordIndex + 1].chord 
    : '—';

  // Animation frame loop for playback
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const tick = () => {
      const delta = Date.now() - startTimeRef.current;
      const nextTime = Math.min(totalDuration, delta);
      setElapsedTime(nextTime);

      if (nextTime >= totalDuration) {
        setIsPlaying(false);
      } else {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    startTimeRef.current = Date.now() - elapsedTime;
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, totalDuration]);

  // Trigger scrolling to active line when it changes
  useEffect(() => {
    if (practiceMode === 'static' || !activeLine) return;
    const activeEl = lineRefs.current.get(activeLine.lineIndex);
    const container = scrollContainerRef.current;
    if (activeEl && container) {
      const containerHeight = container.clientHeight;
      const activeHeight = activeEl.clientHeight;
      const activeTop = activeEl.offsetTop;
      container.scrollTo({
        top: activeTop - containerHeight / 2 + activeHeight / 2,
        behavior: 'smooth'
      });
    }
  }, [activeLine, practiceMode]);

  // Clean play/pause trigger
  const handlePlayToggle = () => {
    if (elapsedTime >= totalDuration) {
      setElapsedTime(0);
    }
    setIsPlaying(!isPlaying);
  };

  // Skip/seek handler
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = parseFloat(e.target.value);
    setElapsedTime(nextTime);
    if (isPlaying) {
      startTimeRef.current = Date.now() - nextTime;
    }
  };

  // Font sizing styles
  const fontClass = fontSize === 'sm' ? 'text-xs' : (fontSize === 'lg' ? 'text-lg' : (fontSize === 'xl' ? 'text-xl' : 'text-sm'));
  const chordFontClass = chordSize === 'sm' ? 'text-[10px]' : (chordSize === 'lg' ? 'text-sm' : 'text-xs');
  const spacingStyle = spacing === 'tight' ? 'py-1' : (spacing === 'wide' ? 'py-4' : 'py-2');

  // Theme overrides
  const getThemeStyles = (): React.CSSProperties => {
    if (contrastMode === 'high') {
      return { background: '#ffffff', color: '#09090b', '--c-text-primary': '#09090b', '--c-text-secondary': '#4c4f52', '--c-text-muted': '#808285', '--c-accent': '#7c3aed' } as any;
    }
    if (contrastMode === 'amoled') {
      return { background: '#000000', color: '#ffffff', '--c-text-primary': '#ffffff', '--c-text-secondary': '#acabaa', '--c-text-muted': '#5c5f62', '--c-accent': '#a855f7' } as any;
    }
    return { background: 'var(--app-bg)', color: 'var(--c-text-primary)' };
  };

  const themeStyle = getThemeStyles();
  const isContrastLight = contrastMode === 'high';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, sans-serif', overflow: 'hidden',
        ...themeStyle
      }}
    >
      {/* Draggable Floating Chord Overlay */}
      {practiceMode !== 'static' && (
        <motion.div
          drag
          dragMomentum={false}
          dragConstraints={containerRef}
          onDragEnd={handleDragEnd}
          animate={{ x: overlayPos.x, y: overlayPos.y }}
          style={{
            position: 'absolute', top: 80, right: 20, zIndex: 101000,
            width: 130, padding: '12px 14px', borderRadius: 16,
            background: isContrastLight ? 'rgba(255,255,255,0.95)' : 'rgba(15,15,20,0.85)',
            border: isContrastLight ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(12px)',
            cursor: 'grab', display: 'flex', flexDirection: 'column', gap: 6
          }}
        >
          <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-muted)', fontWeight: 700 }}>
            {isSpanish ? 'Acorde' : 'Chord'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--c-accent)', lineHeight: 1 }}>
              {currentChord}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '8px', color: 'var(--c-text-muted)' }}>{isSpanish ? 'Sig.' : 'Next'}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text-secondary)' }}>
                {nextChord}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Top Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: isContrastLight ? '2px solid #09090b' : '1px solid rgba(128,128,128,0.1)',
        background: isContrastLight ? '#ffffff' : 'rgba(15,15,20,0.4)',
        backdropFilter: 'blur(10px)', flexShrink: 0
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: '16px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', color: 'var(--c-text-primary)' }} className="truncate">
              {song.title}
            </h1>
            <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'var(--c-accent)20', color: 'var(--c-accent)' }}>
              {song.key}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--c-text-secondary)', margin: '2px 0 0', fontWeight: 500 }}>
            {song.artist} {song.capo ? `· Capo ${song.capo}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: 'none', border: 'none', color: 'var(--c-text-primary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>settings</span>
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
              background: 'var(--c-accent)', border: 'none', color: '#ffffff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_back</span>
            {isSpanish ? 'Salir' : 'Exit'}
          </button>
        </div>
      </div>

      {/* Main Lyrics & Chords Scrollable Container */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '32px 20px 120px',
          boxSizing: 'border-box', scrollBehavior: 'smooth'
        }}
      >
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {song.sections.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: '28px' }}>
              {/* Section Header */}
              <h3 style={{
                fontSize: '11px', fontWeight: 900, color: 'var(--c-accent)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                borderBottom: isContrastLight ? '1px solid #09090b' : '1px solid rgba(128,128,128,0.1)',
                paddingBottom: '4px', marginBottom: '12px'
              }}>
                {section.name}
              </h3>
              
              {/* Lines rendering */}
              <div className="space-y-1">
                {section.lines.map((line, lIdx) => {
                  // Find corresponding parsed line
                  const parsed = parsedLines.find(p => p.sectionName === section.name && p.lyrics === line.lyrics);
                  const isLineActive = activeLine && parsed && activeLine.lineIndex === parsed.lineIndex;
                  const showHighlight = practiceMode !== 'static' && isLineActive;

                  // Split line by chord markers for responsive flex block rendering
                  const segments = getLineSegments(line.lyrics, line.chords);

                  return (
                    <div
                      key={lIdx}
                      ref={el => { if (el && parsed) lineRefs.current.set(parsed.lineIndex, el); }}
                      className={`rounded px-2 transition-all duration-300 ${spacingStyle}`}
                      style={{
                        background: showHighlight ? 'var(--c-accent)0d' : 'transparent',
                        borderLeft: showHighlight ? '3px solid var(--c-accent)' : '3px solid transparent',
                        paddingLeft: showHighlight ? '8px' : '8px'
                      }}
                    >
                      <div className="flex flex-wrap items-end" style={{ rowGap: '12px' }}>
                        {segments.map((seg, segIdx) => (
                          <div
                            key={segIdx}
                            style={{
                              display: 'inline-flex', flexDirection: 'column',
                              alignItems: 'flex-start', minWidth: seg.chord ? '18px' : 'auto'
                            }}
                          >
                            {/* Chord line */}
                            <span
                              className={`font-black ${chordFontClass}`}
                              style={{
                                color: 'var(--c-accent)', height: '14px', lineHeight: '14px',
                                display: 'block', marginBottom: '2px', pointerEvents: 'none',
                                opacity: seg.chord ? 1 : 0
                              }}
                            >
                              {seg.chord || ''}
                            </span>
                            {/* Lyric segment line */}
                            <span
                              className={`${fontClass} font-medium`}
                              style={{
                                color: 'var(--c-text-primary)', whiteSpace: 'pre',
                                lineHeight: '1.2'
                              }}
                            >
                              {seg.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings Side Sheet */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 102000,
                background: '#000000', pointerEvents: 'auto'
              }}
            />
            {/* Sidebar container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 103000,
                width: '80%', maxWidth: '300px', padding: '24px 20px',
                display: 'flex', flexDirection: 'column', gap: 16,
                boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
                background: isContrastLight ? '#ffffff' : '#0d0d11',
                borderLeft: isContrastLight ? '2px solid #09090b' : '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--c-text-primary)' }}>
                  {isSpanish ? 'Ajustes de Práctica' : 'Practice Settings'}
                </h3>
                <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--c-text-primary)', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>

              {/* Presentation mode selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {isSpanish ? 'Presentación' : 'Presentation'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {(['static', 'scroll'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPracticeMode(m)}
                      style={{
                        padding: '6px', borderRadius: 8, fontSize: '10px', fontWeight: 700,
                        background: practiceMode === m ? 'var(--c-accent)' : 'rgba(128,128,128,0.1)',
                        border: 'none', color: practiceMode === m ? '#ffffff' : 'var(--c-text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {m === 'static' ? (isSpanish ? 'Fijo' : 'Static') : (isSpanish ? 'Flujo' : 'Scroll')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {isSpanish ? 'Tamaño de Letra' : 'Font Size'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setFontSize(sz)}
                      style={{
                        padding: '6px 2px', borderRadius: 6, fontSize: '10px', fontWeight: 800,
                        background: fontSize === sz ? 'var(--c-accent)' : 'rgba(128,128,128,0.1)',
                        border: 'none', color: fontSize === sz ? '#ffffff' : 'var(--c-text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {sz.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chord Size Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {isSpanish ? 'Tamaño de Acordes' : 'Chord Size'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  {(['sm', 'md', 'lg'] as const).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setChordSize(sz)}
                      style={{
                        padding: '6px 2px', borderRadius: 6, fontSize: '10px', fontWeight: 800,
                        background: chordSize === sz ? 'var(--c-accent)' : 'rgba(128,128,128,0.1)',
                        border: 'none', color: chordSize === sz ? '#ffffff' : 'var(--c-text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {sz.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Spacing Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {isSpanish ? 'Espaciado' : 'Spacing'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  {(['tight', 'normal', 'wide'] as const).map((sp) => (
                    <button
                      key={sp}
                      onClick={() => setSpacing(sp)}
                      style={{
                        padding: '6px 2px', borderRadius: 6, fontSize: '10px', fontWeight: 800,
                        background: spacing === sp ? 'var(--c-accent)' : 'rgba(128,128,128,0.1)',
                        border: 'none', color: spacing === sp ? '#ffffff' : 'var(--c-text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {sp === 'tight' ? (isSpanish ? 'Corto' : 'Tight') : (sp === 'wide' ? (isSpanish ? 'Ancho' : 'Wide') : (isSpanish ? 'Normal' : 'Normal'))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contrast Mode Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {isSpanish ? 'Contraste / Tema' : 'Contrast / Theme'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                  {(['normal', 'high', 'amoled'] as const).map((ct) => (
                    <button
                      key={ct}
                      onClick={() => setContrastMode(ct)}
                      style={{
                        padding: '8px', borderRadius: 8, fontSize: '10px', fontWeight: 700,
                        background: contrastMode === ct ? 'var(--c-accent)' : 'rgba(128,128,128,0.1)',
                        border: 'none', color: contrastMode === ct ? '#ffffff' : 'var(--c-text-secondary)',
                        cursor: 'pointer', textAlign: 'left', paddingLeft: '12px'
                      }}
                    >
                      {ct === 'normal' ? (isSpanish ? 'Predeterminado' : 'App Theme') : (ct === 'high' ? (isSpanish ? 'Alto Contraste (Claro)' : 'High Contrast (Light)') : (isSpanish ? 'AMOLED Oscuro' : 'AMOLED Black'))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tempo / speed modifier */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
                <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {isSpanish ? 'Tempo / Velocidad' : 'Tempo / Speed'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setTempo(t => Math.max(40, t - 5))} style={{ background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 6, width: 28, height: 28, color: 'var(--c-text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: 800, color: 'var(--c-text-primary)' }}>{tempo} BPM</span>
                  <button onClick={() => setTempo(t => Math.min(240, t + 5))} style={{ background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 6, width: 28, height: 28, color: 'var(--c-text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Playback Control Bar (Only for Flow/Scroll mode) */}
      {practiceMode !== 'static' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100500,
          padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 8,
          background: isContrastLight ? '#ffffff' : 'rgba(10,10,14,0.92)',
          borderTop: isContrastLight ? '2px solid #09090b' : '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(16px)'
        }}>
          {/* Progress Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '9px', color: 'var(--c-text-muted)', fontFamily: 'monospace' }}>
              {Math.floor(elapsedTime / 1000)}s
            </span>
            <input
              type="range"
              min="0"
              max={totalDuration}
              value={elapsedTime}
              onChange={handleProgressChange}
              style={{
                flex: 1, height: '4px', borderRadius: '2px',
                accentColor: 'var(--c-accent)', outline: 'none', cursor: 'pointer'
              }}
            />
            <span style={{ fontSize: '9px', color: 'var(--c-text-muted)', fontFamily: 'monospace' }}>
              {Math.floor(totalDuration / 1000)}s
            </span>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <button
              onClick={() => setElapsedTime(0)}
              style={{ background: 'none', border: 'none', color: 'var(--c-text-secondary)', cursor: 'pointer', display: 'flex' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>replay</span>
            </button>
            
            <button
              onClick={handlePlayToggle}
              style={{
                width: '46px', height: '46px', borderRadius: '50%',
                background: 'var(--c-accent)', border: 'none', color: '#ffffff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px var(--c-accent)40'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '26px', fontVariationSettings: "'FILL' 1" }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{ background: 'none', border: 'none', color: 'var(--c-text-secondary)', cursor: 'pointer', display: 'flex' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>tune</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

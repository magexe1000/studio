import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  useChordStore, 
  setNavLocked, 
  setNavHidden, 
  getChordByName, 
  normalizeChordName,
  useT, 
  useBackHandler, 
  getChordChart, 
  importChartFromUrl,
  type NormalizedChordChart, 
  type NormalizedSection, 
  type NormalizedLyricsLine, 
  type NormalizedChordMarker, 
  type SongChart, 
  type SongChartSection 
} from '@workspace/studio-core';
import ChordDiagram from './ChordDiagram';

interface SongPracticeViewProps {
  song: SongChart;
  onClose: () => void;
}

interface ChordSegment {
  chord?: string;
  text: string;
}

// Partition a lyrics line into chord-text segments for inline-flex rendering
function getLineSegments(lyrics: string, chords: NormalizedChordMarker[]): ChordSegment[] {
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
      chord: normalizeChordName(chord.chord),
      text: lyrics.substring(chord.offset, nextOffset) || ' '
    });
    lastOffset = nextOffset;
  }
  
  if (lastOffset < lyrics.length) {
    segments.push({ text: lyrics.substring(lastOffset) });
  }
  
  return segments;
}

// Parse standard chords-above-lyrics or ChordPro chart into structured sections
function parseTextChart(text: string): SongChartSection[] {
  const lines = text.split('\n');
  const sections: SongChartSection[] = [];
  let currentSection: SongChartSection = { name: 'Song', lines: [] };
  
  const isChordLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    
    const chordTokenRegex = /^[A-G][b#]?(m|maj|min|sus|dim|aug|add|7|9|11|13|5|6|17|22)?(sus\d)?(add\d)?(\/[A-G][b#]?)?(\(\d\))?$/i;
    const tokens = trimmed.split(/\s+/);
    for (const t of tokens) {
      if (t === '|' || t === '/' || t === '-') continue;
      const cleanToken = t.replace(/[()]/g, '');
      if (!chordTokenRegex.test(cleanToken)) {
        return false;
      }
    }
    return true;
  };

  let pendingChords: { chord: string; offset: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (!trimmed) continue;
    
    // Section headers like [Verse], [Chorus]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { name: trimmed.substring(1, trimmed.length - 1), lines: [] };
      pendingChords = [];
      continue;
    }
    if (trimmed.match(/^(intro|verse|chorus|bridge|outro|solo|coda|pre-chorus)(\s+\d+)?$/i)) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { name: trimmed, lines: [] };
      pendingChords = [];
      continue;
    }
    
    if (isChordLine(line)) {
      pendingChords = [];
      const regex = /\S+/g;
      let match;
      while ((match = regex.exec(line)) !== null) {
        pendingChords.push({
          chord: match[0],
          offset: match.index
        });
      }
    } else {
      currentSection.lines.push({
        lyrics: line,
        chords: pendingChords.map(c => ({
          chord: c.chord,
          offset: Math.min(c.offset, line.length)
        }))
      });
      pendingChords = [];
    }
  }
  
  if (currentSection.lines.length > 0 || sections.length === 0) {
    sections.push(currentSection);
  }
  
  return sections;
}

function cleanChordName(name: string): string {
  return normalizeChordName(name);
}

function generateTextRepresentation(chart: NormalizedChordChart): string {
  let output = '';
  chart.sections.forEach(sec => {
    output += `[${sec.name}]\n`;
    sec.lines.forEach(line => {
      if (line.chords && line.chords.length > 0) {
        let chordLine = '';
        let lastOffset = 0;
        const sortedChords = [...line.chords].sort((a, b) => a.offset - b.offset);
        sortedChords.forEach(c => {
          const padding = ' '.repeat(Math.max(0, c.offset - lastOffset));
          chordLine += padding + c.chord;
          lastOffset = c.offset + c.chord.length;
        });
        output += chordLine + '\n';
      }
      output += line.lyrics + '\n';
    });
    output += '\n';
  });
  return output.trim();
}

export function SongPracticeView({ song, onClose }: SongPracticeViewProps) {
  const t = useT();

  // Hide bottom nav strictly inside Chordex Song Practice screen
  useEffect(() => {
    setNavLocked(true);
    setNavHidden(true);
    return () => {
      setNavLocked(false);
      setNavHidden(false);
    };
  }, []);

  // Exit practice mode on back button/swipe back gesture
  useBackHandler('nested', () => {
    onClose();
    return true;
  }, [onClose]);

  // Sizing and spacing styles (persisted locally)
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>(() => {
    return (localStorage.getItem('chordex:practice:fontSize') as any) ?? 'md';
  });
  const [chordSize, setChordSize] = useState<'sm' | 'md' | 'lg'>(() => {
    return (localStorage.getItem('chordex:practice:chordSize') as any) ?? 'md';
  });
  const [spacing, setSpacing] = useState<'tight' | 'normal' | 'wide'>(() => {
    return (localStorage.getItem('chordex:practice:spacing') as any) ?? 'normal';
  });
  const [showChordOverlay, setShowChordOverlay] = useState<boolean>(() => {
    return localStorage.getItem('chordex:practice:showOverlay') !== 'false';
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

  // Chord Provider States
  const [activeChart, setActiveChart] = useState<NormalizedChordChart | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartDiagnostics, setChartDiagnostics] = useState<{
    provider: string;
    success: boolean;
    confidence: number;
    type: 'synced' | 'plain' | 'unavailable';
    duration: number;
  } | null>(null);

  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'paste' | 'url'>('paste');
  const [importUrl, setImportUrl] = useState('');
  const [importLoadingState, setImportLoadingState] = useState<'idle' | 'fetching' | 'parsing' | 'success' | 'failed'>('idle');
  const [importError, setImportError] = useState('');
  const [previewChart, setPreviewChart] = useState<NormalizedChordChart | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const diagLogs = useMemo(() => {
    if (!previewChart) return null;
    let totalChords = 0;
    let lyricLinesCount = 0;
    
    const uniqueRawChords = new Set<string>();
    const rawToNormalized = new Map<string, string>();
    
    previewChart.sections.forEach(sec => {
      sec.lines.forEach(line => {
        lyricLinesCount++;
        line.chords.forEach(c => {
          totalChords++;
          uniqueRawChords.add(c.chord);
        });
      });
    });
    
    let resolvedCount = 0;
    let missingCount = 0;
    let slashFallbackCount = 0;
    const missingChordList = new Set<string>();
    const normalizedChordList = new Set<string>();
    const sourceToNormalizedMapping: { from: string; to: string }[] = [];
    
    uniqueRawChords.forEach(raw => {
      const normalized = normalizeChordName(raw);
      rawToNormalized.set(raw, normalized);
      normalizedChordList.add(normalized);
      sourceToNormalizedMapping.push({ from: raw, to: normalized });
      
      // Determine if this unique chord is resolved (either exact, or slash fallback)
      let found = getChordByName(normalized);
      if (!found && normalized.includes('/')) {
        const basePart = normalized.split('/')[0].trim();
        found = getChordByName(basePart);
      }
      if (!found) {
        missingChordList.add(normalized);
      }
    });
    
    // Now count the actual markers
    previewChart.sections.forEach(sec => {
      sec.lines.forEach(line => {
        line.chords.forEach(c => {
          const norm = rawToNormalized.get(c.chord) || normalizeChordName(c.chord);
          let foundExact = getChordByName(norm);
          let isResolved = false;
          let isSlashFallback = false;
          
          if (foundExact) {
            isResolved = true;
          } else if (norm.includes('/')) {
            const basePart = norm.split('/')[0].trim();
            const foundBase = getChordByName(basePart);
            if (foundBase) {
              isResolved = true;
              isSlashFallback = true;
            }
          }
          
          if (isResolved) {
            resolvedCount++;
            if (isSlashFallback) {
              slashFallbackCount++;
            }
          } else {
            missingCount++;
          }
        });
      });
    });
    
    const diagnosticsObject = {
      totalChords,
      lyricLinesCount,
      uniqueChordsCount: uniqueRawChords.size,
      uniqueRawChords: Array.from(uniqueRawChords),
      normalizedChords: Array.from(normalizedChordList),
      resolvedCount,
      missingCount,
      missingChordList: Array.from(missingChordList),
      sourceToNormalizedMapping,
      slashFallbackCount
    };

    console.log('[Chordex Import Diagnostics]', diagnosticsObject);
    return diagnosticsObject;
  }, [previewChart]);

  const isSpanish = useMemo(() => {
    return useChordStore.getState().settings.language === 'es';
  }, []);

  // Fetch chart using the search orchestrator
  const fetchChordChart = useCallback(async (force = false) => {
    setChartLoading(true);
    setChartError(null);
    const startTime = Date.now();

    try {
      const chart = await getChordChart(song, force);
      setActiveChart(chart);
      
      if (chart) {
        setChartDiagnostics({
          provider: chart.source,
          success: true,
          confidence: chart.confidence,
          type: chart.sections.some(s => s.lines.some(l => l.timestamp !== undefined)) ? 'synced' : 'plain',
          duration: Date.now() - startTime
        });
      } else {
        setChartDiagnostics({
          provider: 'none',
          success: false,
          confidence: 0,
          type: 'unavailable',
          duration: Date.now() - startTime
        });
      }
    } catch (e: any) {
      console.error('[Chordex Practice] Chart fetch error:', e);
      setChartError(e.message || 'Error loading chord chart');
    } finally {
      setChartLoading(false);
    }
  }, [song]);

  useEffect(() => {
    fetchChordChart();
  }, [fetchChordChart]);

  const handleClearCacheAndRetry = () => {
    localStorage.removeItem(`chordex:chords:cache:${song.id}`);
    fetchChordChart(true);
  };

  // Save settings
  useEffect(() => { localStorage.setItem('chordex:practice:fontSize', fontSize); }, [fontSize]);
  useEffect(() => { localStorage.setItem('chordex:practice:chordSize', chordSize); }, [chordSize]);
  useEffect(() => { localStorage.setItem('chordex:practice:spacing', spacing); }, [spacing]);
  useEffect(() => { localStorage.setItem('chordex:practice:showOverlay', String(showChordOverlay)); }, [showChordOverlay]);

  // Drag overlay position
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

  const handleSaveCustomChart = () => {
    if (!importText.trim()) return;
    try {
      const parsed = parseTextChart(importText);
      localStorage.setItem(`chordex:practice:custom_chart:${song.id}`, JSON.stringify(parsed));
      localStorage.setItem(`chordex:practice:custom_chart_text:${song.id}`, importText);
      setShowImportModal(false);
      fetchChordChart(true);
    } catch (_) {
      alert('Error parsing chart. Please verify spacing and headers.');
    }
  };

  const handleClearCustomChart = () => {
    localStorage.removeItem(`chordex:practice:custom_chart:${song.id}`);
    localStorage.removeItem(`chordex:practice:custom_chart_text:${song.id}`);
    localStorage.removeItem(`chordex:practice:custom_chart_source:${song.id}`);
    fetchChordChart(true);
  };

  const handleUrlImport = async () => {
    if (!importUrl.trim()) return;
    setImportLoadingState('fetching');
    setImportError('');
    try {
      setImportLoadingState('parsing');
      const chart = await importChartFromUrl(importUrl.trim(), song);
      setPreviewChart(chart);
      setImportLoadingState('success');
      setShowPreviewModal(true);
      setShowImportModal(false);
    } catch (err: any) {
      setImportLoadingState('failed');
      setImportError(err.message || 'Failed to import from URL.');
    }
  };

  const handleSavePreviewChart = () => {
    if (!previewChart) return;
    try {
      const savedSections: SongChartSection[] = previewChart.sections.map(sec => ({
        name: sec.name,
        lines: sec.lines.map(line => ({
          lyrics: line.lyrics,
          chords: line.chords.map(c => ({
            chord: c.chord,
            offset: c.offset,
            timestamp: c.timestamp
          })),
          timestamp: line.timestamp,
          duration: line.duration
        }))
      }));
      localStorage.setItem(`chordex:practice:custom_chart:${song.id}`, JSON.stringify(savedSections));
      
      localStorage.setItem(`chordex:practice:custom_chart_source:${song.id}`, JSON.stringify({
        url: importUrl,
        site: previewChart.source,
        importedAt: Date.now()
      }));

      const textRep = generateTextRepresentation(previewChart);
      localStorage.setItem(`chordex:practice:custom_chart_text:${song.id}`, textRep);

      setShowPreviewModal(false);
      fetchChordChart(true);
    } catch (err: any) {
      alert(`Error saving chart: ${err.message || err}`);
    }
  };

  // Determine if actual chords exist in the chart
  const hasRealChords = useMemo(() => {
    if (!activeChart) return false;
    return activeChart.chartStatus === 'verified' || activeChart.chartStatus === 'user' || activeChart.chartStatus === 'provider';
  }, [activeChart]);

  // Resolved active sections directly from activeChart (No suggested fallback chords)
  const activeSections = useMemo(() => {
    return activeChart ? activeChart.sections : [];
  }, [activeChart]);

  // Compile a flat list of lines and calculate timestamps
  const parsedLines = useMemo(() => {
    const list: { sectionName: string; lineIndex: number; lyrics: string; chords: NormalizedChordMarker[]; timestamp: number; duration: number }[] = [];
    let currentTime = 0;
    const beatDurationMs = (60 / tempo) * 1000;
    const lineDurationMs = 8 * beatDurationMs;

    let lineCounter = 0;
    activeSections.forEach((section) => {
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
  }, [activeSections, tempo]);

  // Total song duration
  const totalDuration = useMemo(() => {
    if (parsedLines.length === 0) return 0;
    const last = parsedLines[parsedLines.length - 1];
    return last.timestamp + last.duration;
  }, [parsedLines]);

  // Flat list of chords with timestamps interpolated accurately
  const flatChords = useMemo(() => {
    const list: { chord: string; time: number }[] = [];
    parsedLines.forEach((line) => {
      if (line.chords.length > 0) {
        const sorted = [...line.chords].sort((a, b) => a.offset - b.offset);
        sorted.forEach((marker) => {
          const relativeRatio = marker.offset / Math.max(1, line.lyrics.length);
          const chordTime = marker.timestamp !== undefined 
            ? marker.timestamp 
            : (line.timestamp + relativeRatio * line.duration);
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

  // Retrieve actual Chord shape from the library, supporting slash chord fallbacks
  const resolvedChordData = useMemo(() => {
    if (currentChord === '—') return { chordObj: null, bassNote: '' };
    const cleaned = cleanChordName(currentChord);
    
    // 1. Try exact match first
    let found = getChordByName(cleaned);
    if (found) {
      return { chordObj: found, bassNote: '' };
    }
    
    // 2. If it's a slash chord, try splitting it
    const slashIdx = cleaned.indexOf('/');
    if (slashIdx !== -1) {
      const basePart = cleaned.substring(0, slashIdx).trim();
      const bassPart = cleaned.substring(slashIdx + 1).trim();
      
      found = getChordByName(basePart);
      if (found) {
        return { chordObj: found, bassNote: bassPart };
      }
    }
    
    return { chordObj: null, bassNote: '' };
  }, [currentChord]);

  const currentChordObj = resolvedChordData.chordObj;
  const currentBassNote = resolvedChordData.bassNote;

  // Playback timer loop
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
  }, [isPlaying, totalDuration, elapsedTime]);

  // Scroll to active line
  useEffect(() => {
    if (activeSections.length === 0 || !activeLine) return;
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
  }, [activeLine, activeSections.length]);

  const handlePlayToggle = () => {
    if (elapsedTime >= totalDuration) {
      setElapsedTime(0);
    }
    setIsPlaying(!isPlaying);
  };

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

  // Status Badge Configuration Info
  const statusInfo = useMemo(() => {
    if (!activeChart) {
      return { 
        text: isSpanish ? 'Indisponible' : 'Unavailable', 
        bg: 'rgba(239,68,68,0.06)', 
        color: '#ef4444', 
        border: '1px solid rgba(239,68,68,0.2)',
        desc: 'No chords or lyrics available' 
      };
    }
    switch (activeChart.chartStatus) {
      case 'verified':
        return {
          text: isSpanish ? 'Verificados' : 'Verified Chords',
          bg: 'rgba(16, 185, 129, 0.1)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          desc: isSpanish ? 'Acordes oficiales verificados' : 'Verified official chords'
        };
      case 'user':
        return {
          text: isSpanish ? 'Usuario (Importado)' : 'User Imported',
          bg: 'rgba(139, 92, 246, 0.1)',
          color: '#8b5cf6',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          desc: isSpanish ? 'Acordes importados por el usuario' : 'User imported chords'
        };
      case 'provider':
        return {
          text: 'Provider Chords',
          bg: 'rgba(59, 130, 246, 0.1)',
          color: '#3b82f6',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          desc: isSpanish ? 'Acordes obtenidos de base de datos en línea' : 'Chords fetched from online provider'
        };
      case 'unavailable':
      default:
        return {
          text: isSpanish ? 'Solo Letra' : 'Lyrics Only',
          bg: 'rgba(107, 114, 128, 0.1)',
          color: '#9ca3af',
          border: '1px solid rgba(107, 114, 128, 0.2)',
          desc: isSpanish ? 'Solo letra disponible, sin acordes' : 'Lyrics available without chords'
        };
    }
  }, [activeChart, isSpanish]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, sans-serif', overflow: 'hidden',
        background: 'var(--app-bg)', color: 'var(--c-text-primary)'
      }}
    >
      {/* Draggable Floating Chord Overlay (Only renders when real chord markers exist) */}
      {showChordOverlay && flatChords.length > 0 && hasRealChords && (
        <motion.div
          drag
          dragMomentum={false}
          dragConstraints={containerRef}
          onDragEnd={handleDragEnd}
          animate={{ x: overlayPos.x, y: overlayPos.y }}
          style={{
            position: 'absolute', top: 80, right: 20, zIndex: 101000,
            width: chordSize === 'sm' ? 100 : (chordSize === 'lg' ? 140 : 120),
            padding: '12px 14px', borderRadius: 16,
            background: 'rgba(15,15,20,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(16px)',
            cursor: 'grab', display: 'flex', flexDirection: 'column', gap: 8
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 4 }}>
            <span style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-muted)', fontWeight: 700 }}>
              {t.practice.practiceTitle || 'Practice'}
            </span>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '8px 4px', height: 75, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currentChordObj && currentChordObj.guitar ? (
              <ChordDiagram data={currentChordObj.guitar} accentFrom="var(--c-accent)" />
            ) : (
              <span style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 600, textAlign: 'center', padding: '0 8px' }}>
                {isSpanish ? 'Diagrama no disponible' : 'Diagram unavailable'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--c-accent)' }}>
              {normalizeChordName(currentChord)}
            </span>
            {currentBassNote && (
              <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--c-text-secondary)', marginTop: -2 }}>
                {isSpanish ? 'Bajo' : 'Bass'}: {currentBassNote}
              </span>
            )}
            <span style={{ display: 'flex', gap: 6, fontSize: '9px', color: 'var(--c-text-muted)' }}>
              <span>{t.practice.next}:</span>
              <span style={{ fontWeight: 700, color: 'var(--c-text-secondary)' }}>{normalizeChordName(nextChord)}</span>
            </span>
          </div>
        </motion.div>
      )}

      {/* Top Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid rgba(128,128,128,0.1)',
        background: 'rgba(15,15,20,0.4)',
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
            {/* Status Badge Pill */}
            <span style={{
              fontSize: '8px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 4,
              background: statusInfo.bg,
              color: statusInfo.color,
              border: statusInfo.border || 'none'
            }} title={statusInfo.desc}>
              {statusInfo.text}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--c-text-secondary)', margin: '2px 0 0', fontWeight: 500 }}>
            {song.artist} {song.capo ? `· Capo ${song.capo}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
              background: 'var(--c-accent)', border: 'none', color: '#ffffff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_back</span>
            {t.practice.exit}
          </button>
        </div>
      </div>

      {/* Main Lyrics Viewport */}
      {chartLoading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--c-accent)', animation: 'spin 0.8s linear infinite' }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: '12px', color: 'var(--c-text-secondary)' }}>
            {isSpanish ? 'Buscando acordes y letras...' : 'Searching for chords and lyrics...'}
          </p>
        </div>
      ) : activeSections.length > 0 ? (
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '32px 20px 120px',
            boxSizing: 'border-box', scrollBehavior: 'smooth'
          }}
        >
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {/* Banner: No verified chords available yet (Only shown in lyrics-only mode) */}
            {activeChart && activeChart.chartStatus === 'unavailable' && (
              <div style={{
                background: 'rgba(128,128,128,0.04)',
                border: '1px solid rgba(128,128,128,0.15)',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: '20px',
                textAlign: 'left',
                fontSize: '11px',
                color: 'var(--c-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--c-text-muted)' }}>info</span>
                  <span>
                    {isSpanish 
                      ? 'No hay acordes verificados disponibles aún para esta canción.' 
                      : 'No verified chords available yet for this song.'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const rawText = localStorage.getItem(`chordex:practice:custom_chart_text:${song.id}`) || '';
                    setImportText(rawText);
                    setShowImportModal(true);
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: '10px', fontWeight: 800,
                    background: 'var(--c-accent)', border: 'none', color: '#ffffff', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  {isSpanish ? 'Importar Acordes' : 'Import Chart'}
                </button>
              </div>
            )}

            {activeSections.map((section, sIdx) => (
              <div key={sIdx} style={{ marginBottom: '28px' }}>
                {/* Section Header */}
                <h3 style={{
                  fontSize: '11px', fontWeight: 900, color: 'var(--c-accent)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  borderBottom: '1px solid rgba(128,128,128,0.1)',
                  paddingBottom: '4px', marginBottom: '12px'
                }}>
                  {section.name}
                </h3>
                
                {/* Lines Rendering */}
                <div className="space-y-1" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {section.lines.map((line, lIdx) => {
                    const parsed = parsedLines.find(p => p.sectionName === section.name && p.lyrics === line.lyrics);
                    const isLineActive = activeLine && parsed && activeLine.lineIndex === parsed.lineIndex;
                    const showHighlight = isLineActive;

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
                        <div className="flex flex-wrap items-end" style={{ rowGap: '16px' }}>
                          {segments.map((seg, segIdx) => (
                            <div
                              key={segIdx}
                              style={{
                                display: 'inline-flex', flexDirection: 'column',
                                alignItems: 'flex-start', minWidth: seg.chord ? '18px' : 'auto'
                              }}
                            >
                              {/* Chord Label (only visible if chords actually exist) */}
                              {hasRealChords && (
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
                              )}
                              {/* Lyric Text */}
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
      ) : (
        /* Empty State Viewport */
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '24px', boxSizing: 'border-box',
          textAlign: 'center', gap: 16
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'var(--c-accent)12',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-accent)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36 }}>music_off</span>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: 'var(--c-text-primary)' }}>
            {t.practice.chartUnavailable}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--c-text-secondary)', maxWidth: '320px', margin: 0, lineHeight: 1.6 }}>
            {t.practice.chartUnavailableDesc}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              onClick={() => {
                setImportText('');
                setShowImportModal(true);
              }}
              style={{
                padding: '10px 20px', borderRadius: 8, fontSize: '13px', fontWeight: 700,
                background: 'var(--c-accent)', border: 'none', color: '#ffffff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 12px var(--c-accent)30'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
              {t.practice.importBtn}
            </button>
            <button
              onClick={handleClearCacheAndRetry}
              style={{
                padding: '10px 20px', borderRadius: 8, fontSize: '13px', fontWeight: 700,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--c-text-primary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'Inter, sans-serif'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
              Retry Search
            </button>
          </div>
        </div>
      )}

      {/* Settings Side Sheet */}
      <AnimatePresence>
        {showSettings && (
          <>
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
                background: '#0d0d11',
                borderLeft: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--c-text-primary)' }}>
                  {t.practice.settingsTitle}
                </h3>
                <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--c-text-primary)', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>

              {/* Font Size Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {t.practice.settingsFont}
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

              {/* Chord Size Selector (Only shown if chart contains real chords) */}
              {hasRealChords && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {t.practice.settingsChords}
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
              )}

              {/* Line Spacing Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {t.practice.spacing}
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
                      {sp === 'tight' ? t.practice.spacingTight : (sp === 'wide' ? t.practice.spacingWide : t.practice.spacingNormal)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show/Hide Chord Overlay (Only shown if chart contains real chords) */}
              {hasRealChords && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(128,128,128,0.06)', borderBottom: '1px solid rgba(128,128,128,0.06)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--c-text-secondary)' }}>
                    {t.practice.showOverlay}
                  </span>
                  <input
                    type="checkbox"
                    checked={showChordOverlay}
                    onChange={e => setShowChordOverlay(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--c-accent)', cursor: 'pointer' }}
                  />
                </div>
              )}

              {/* Tempo Speed Modifier */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {t.practice.tempoSpeed}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setTempo(t => Math.max(40, t - 5))} style={{ background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 6, width: 28, height: 28, color: 'var(--c-text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: 800, color: 'var(--c-text-primary)' }}>{tempo} BPM</span>
                  <button onClick={() => setTempo(t => Math.min(240, t + 5))} style={{ background: 'rgba(128,128,128,0.1)', border: 'none', borderRadius: 6, width: 28, height: 28, color: 'var(--c-text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                </div>
              </div>

              {/* Diagnostics */}
              {chartDiagnostics && (
                <div style={{
                  borderTop: '1px solid rgba(128,128,128,0.1)',
                  paddingTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: '9px',
                  color: 'var(--c-text-muted)',
                  fontFamily: 'monospace'
                }}>
                  <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-secondary)', fontSize: '8px', marginBottom: 2 }}>
                    Diagnostics
                  </div>
                  <div>Provider: {chartDiagnostics.provider}</div>
                  <div>Status: {chartDiagnostics.success ? 'Success' : 'Unavailable'}</div>
                  <div>Type: {chartDiagnostics.type}</div>
                  <div>Match Score: {chartDiagnostics.confidence.toFixed(2)}</div>
                  <div>Fetch Time: {chartDiagnostics.duration}ms</div>
                </div>
              )}

              {/* Clear Cache Button */}
              <button
                onClick={handleClearCacheAndRetry}
                style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: '10px', fontWeight: 800,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--c-text-secondary)', cursor: 'pointer', textAlign: 'center', marginTop: 4
                }}
              >
                {isSpanish ? 'Refrescar Cache de Acordes' : 'Refresh Chords Cache'}
              </button>

              {/* Custom Chart Options */}
              {activeChart && activeChart.chartStatus === 'user' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                  <button
                    onClick={() => {
                      const rawText = localStorage.getItem(`chordex:practice:custom_chart_text:${song.id}`) || '';
                      setImportText(rawText);
                      setShowImportModal(true);
                      setShowSettings(false);
                    }}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                      color: 'var(--c-text-primary)', cursor: 'pointer', fontFamily: 'Inter'
                    }}
                  >
                    {t.practice.editBtn || 'Edit Chords & Lyrics'}
                  </button>
                  <button
                    onClick={handleClearCustomChart}
                    style={{
                      width: '100%', padding: '10px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                      color: '#ef4444', cursor: 'pointer', fontFamily: 'Inter'
                    }}
                  >
                    {t.practice.clearCustomBtn || 'Reset to Default'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setImportText('');
                    setShowImportModal(true);
                    setShowSettings(false);
                  }}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--c-text-primary)', cursor: 'pointer', marginTop: 'auto', fontFamily: 'Inter'
                  }}
                >
                  {t.practice.importBtn}
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Importer Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 105000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
              style={{ position: 'absolute', inset: 0, background: '#000000' }}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                position: 'relative', width: '100%', maxWidth: '450px',
                background: '#0d0d11', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column',
                gap: 16, zIndex: 105100, boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', gap: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setImportTab('paste');
                    setImportError('');
                  }}
                  style={{
                    background: 'none', border: 'none', padding: '4px 8px', fontSize: '12px',
                    fontWeight: 700, color: importTab === 'paste' ? 'var(--c-accent)' : 'var(--c-text-secondary)',
                    borderBottom: importTab === 'paste' ? '2px solid var(--c-accent)' : 'none',
                    cursor: 'pointer', fontFamily: 'Inter'
                  }}
                >
                  {isSpanish ? 'Pegar Manualmente' : 'Paste Manually'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportTab('url');
                    setImportError('');
                  }}
                  style={{
                    background: 'none', border: 'none', padding: '4px 8px', fontSize: '12px',
                    fontWeight: 700, color: importTab === 'url' ? 'var(--c-accent)' : 'var(--c-text-secondary)',
                    borderBottom: importTab === 'url' ? '2px solid var(--c-accent)' : 'none',
                    cursor: 'pointer', fontFamily: 'Inter'
                  }}
                >
                  {isSpanish ? 'Importar desde URL' : 'Import from URL'}
                </button>
              </div>

              {importTab === 'paste' ? (
                <>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-primary)', margin: 0, fontFamily: 'Inter' }}>
                    {t.practice.pasteChartTitle}
                  </h3>
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder="Example:&#10;[Verse]&#10;Am          C&#10;Agradecido de tenerte dulce soledad&#10;G           F&#10;No me cabe duda que me vienes a buscar"
                    style={{
                      width: '100%', height: '200px', background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                      padding: 12, color: '#ffffff', fontFamily: 'monospace', fontSize: '11px',
                      lineHeight: '1.5', resize: 'none', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setShowImportModal(false)}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                        background: 'rgba(128,128,128,0.1)', border: 'none', color: 'var(--c-text-secondary)',
                        cursor: 'pointer', fontFamily: 'Inter'
                      }}
                    >
                      {t.practice.cancelBtn}
                    </button>
                    <button
                      onClick={handleSaveCustomChart}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                        background: 'var(--c-accent)', border: 'none', color: '#ffffff',
                        cursor: 'pointer', fontFamily: 'Inter'
                      }}
                    >
                      {t.practice.saveBtn}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--c-text-primary)', margin: 0, fontFamily: 'Inter' }}>
                    {isSpanish ? 'Pegar enlace del diagrama de acordes' : 'Paste chord chart web address'}
                  </h3>
                  <input
                    type="text"
                    value={importUrl}
                    onChange={e => setImportUrl(e.target.value)}
                    placeholder="https://www.cifraclub.com.br/the-beatles/let-it-be/"
                    style={{
                      width: '100%', background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                      padding: 12, color: '#ffffff', fontFamily: 'Inter', fontSize: '12px',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                  
                  <div style={{ fontSize: '10px', color: 'var(--c-text-muted)', lineHeight: '1.4', fontFamily: 'Inter' }}>
                    {isSpanish 
                      ? 'Importa solo diagramas que tengas derecho a usar. Los diagramas importados se almacenan localmente para tu práctica personal.'
                      : 'Only import charts you have the right to use. Imported charts are stored locally for your personal practice.'}
                  </div>

                  <div style={{ marginTop: 4, padding: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, fontSize: '10px', fontFamily: 'Inter' }}>
                    <strong style={{ color: 'var(--c-text-secondary)', display: 'block', marginBottom: 6, fontSize: '11px' }}>
                      {isSpanish ? 'Sitios Soportados' : 'Supported sites'}
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, maxHeight: '110px', overflowY: 'auto', paddingRight: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                        <span>• Cifra Club</span>
                        <span style={{ fontWeight: 'bold' }}>{isSpanish ? 'Soportado' : 'Supported'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                        <span>• E-Chords</span>
                        <span style={{ fontWeight: 'bold' }}>{isSpanish ? 'Soportado' : 'Supported'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                        <span>• {isSpanish ? 'Texto / ChordPro genérico' : 'Generic Text / ChordPro'}</span>
                        <span style={{ fontWeight: 'bold' }}>{isSpanish ? 'Soportado' : 'Supported'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
                        <span>• Songsterr</span>
                        <span style={{ fontWeight: 'bold' }}>{isSpanish ? 'Limitado' : 'Limited'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
                        <span>• Chordify</span>
                        <span style={{ fontWeight: 'bold' }}>{isSpanish ? 'Limitado' : 'Limited'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
                        <span>• ChordU</span>
                        <span style={{ fontWeight: 'bold' }}>{isSpanish ? 'Limitado' : 'Limited'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                        <span>• Ultimate Guitar</span>
                        <span style={{ fontWeight: 'bold' }}>{isSpanish ? 'Bloqueado (Copiar)' : 'Blocked (Paste)'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                        <span>• GuitarTuna</span>
                        <span style={{ fontWeight: 'bold' }}>{isSpanish ? 'No Soportado' : 'Unsupported'}</span>
                      </div>
                    </div>
                  </div>

                  {importLoadingState !== 'idle' && importLoadingState !== 'success' && (
                    <div style={{ fontSize: '11px', color: 'var(--c-accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter' }}>
                      <span className="material-symbols-outlined spin" style={{ fontSize: 16 }}>sync</span>
                      <span>
                        {importLoadingState === 'fetching' 
                          ? (isSpanish ? 'Descargando página...' : 'Fetching web page...')
                          : (isSpanish ? 'Analizando acordes...' : 'Parsing chord chart...')}
                      </span>
                    </div>
                  )}

                  {importError && (
                    <div style={{
                      padding: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 8, color: '#ef4444', fontSize: '11px', lineHeight: '1.4', fontFamily: 'Inter',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {importError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      onClick={() => setShowImportModal(false)}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                        background: 'rgba(128,128,128,0.1)', border: 'none', color: 'var(--c-text-secondary)',
                        cursor: 'pointer', fontFamily: 'Inter'
                      }}
                    >
                      {t.practice.cancelBtn}
                    </button>
                    <button
                      onClick={handleUrlImport}
                      disabled={importLoadingState === 'fetching' || importLoadingState === 'parsing' || !importUrl.trim()}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                        background: (importLoadingState === 'fetching' || importLoadingState === 'parsing' || !importUrl.trim()) ? 'rgba(255,255,255,0.05)' : 'var(--c-accent)',
                        border: 'none', color: (importLoadingState === 'fetching' || importLoadingState === 'parsing' || !importUrl.trim()) ? 'var(--c-text-muted)' : '#ffffff',
                        cursor: (importLoadingState === 'fetching' || importLoadingState === 'parsing' || !importUrl.trim()) ? 'default' : 'pointer',
                        fontFamily: 'Inter'
                      }}
                    >
                      {isSpanish ? 'Cargar Acordes' : 'Load Chart'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && previewChart && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 105200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPreviewModal(false)}
              style={{ position: 'absolute', inset: 0, background: '#000000' }}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                position: 'relative', width: '100%', maxWidth: '550px', maxHeight: '85vh',
                background: '#0d0d11', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column',
                gap: 16, zIndex: 105300, boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--c-text-primary)', margin: 0, fontFamily: 'Inter' }}>
                {isSpanish ? 'Vista Previa del Diagrama' : 'Chart Import Preview'}
              </h3>
              
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px',
                padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 10,
                fontSize: '11px', color: 'var(--c-text-secondary)', fontFamily: 'Inter'
              }}>
                <div><strong>Title:</strong> {previewChart.title}</div>
                <div><strong>Artist:</strong> {previewChart.artist}</div>
                <div><strong>Key:</strong> {previewChart.key}</div>
                <div><strong>Capo:</strong> {previewChart.capo ? `${previewChart.capo} fret` : 'None'}</div>
                <div><strong>Source:</strong> {previewChart.source}</div>
                <div><strong>License:</strong> {previewChart.licenseInfo}</div>
                {previewChart.importDiagnostics && (
                  <div style={{ gridColumn: 'span 2', marginTop: 4, padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                    <strong style={{ color: 'var(--c-accent)', fontSize: '11px', display: 'block', marginBottom: 4 }}>Parser Diagnostic Logs:</strong>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: 16, fontSize: '10px', color: 'var(--c-text-secondary)', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {previewChart.importDiagnostics.map((d, idx) => <li key={idx}>{d}</li>)}
                      {diagLogs && (
                        <>
                          <li>{isSpanish ? 'Marcadores de acorde' : 'Total chord markers'}: {diagLogs.totalChords}</li>
                          <li>{isSpanish ? 'Acordes únicos' : 'Unique chords'}: {diagLogs.uniqueRawChords.join(', ')}</li>
                          <li>{isSpanish ? 'Nombres normalizados' : 'Normalized names'}: {diagLogs.normalizedChords.join(', ')}</li>
                          <li>{isSpanish ? 'Diagramas resueltos' : 'Diagrams resolved'}: {diagLogs.resolvedCount}</li>
                          <li>{isSpanish ? 'Diagramas faltantes' : 'Diagrams missing'}: {diagLogs.missingCount}</li>
                          <li>{isSpanish ? 'Reemplazos de bajo (Slash)' : 'Slash chord fallbacks'}: {diagLogs.slashFallbackCount}</li>
                          {diagLogs.missingChordList.length > 0 && (
                            <li style={{ color: '#ef4444' }}>
                              {isSpanish ? 'Diagramas faltantes' : 'Missing diagrams'}: {diagLogs.missingChordList.join(', ')}
                            </li>
                          )}
                          <li style={{ marginTop: '4px', listStyleType: 'none', background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '4px' }}>
                            <strong style={{ display: 'block', marginBottom: '2px', fontSize: '9px', color: 'var(--c-accent)' }}>
                              {isSpanish ? 'Mapeo de Acordes (Original → Normalizado):' : 'Chord Mapping (Original → Normalized):'}
                            </strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '9px' }}>
                              {diagLogs.sourceToNormalizedMapping.map((m, idx) => (
                                <span key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '3px' }}>
                                  {m.from} → {m.to}
                                </span>
                              ))}
                            </div>
                          </li>
                          {diagLogs.missingCount > 0 && (
                            <li style={{ color: '#fbbf24', listStyleType: 'none', marginTop: '4px', fontWeight: 'bold' }}>
                              ⚠️ {isSpanish 
                                ? 'Algunos diagramas no están disponibles, pero el diagrama se importó correctamente.' 
                                : 'Some diagrams are unavailable, but the chart was imported successfully.'}
                            </li>
                          )}
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div style={{
                flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12,
                padding: 16, maxHeight: '350px', boxSizing: 'border-box'
              }}>
                {previewChart.sections.map((sec, sIdx) => (
                  <div key={sIdx} style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: '10px', fontWeight: 950, color: 'var(--c-accent)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {sec.name}
                    </h4>
                    {sec.lines.map((line, lIdx) => (
                      <div key={lIdx} style={{ marginBottom: 6, fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre', lineHeight: '1.4' }}>
                        {line.chords && line.chords.length > 0 && (
                          <div style={{ color: 'var(--c-accent)', fontWeight: 700 }}>
                            {(() => {
                              let chordLine = '';
                              let lastOffset = 0;
                              const sortedChords = [...line.chords].sort((a, b) => a.offset - b.offset);
                              sortedChords.forEach(c => {
                                const padding = ' '.repeat(Math.max(0, c.offset - lastOffset));
                                chordLine += padding + c.chord;
                                lastOffset = c.offset + c.chord.length;
                              });
                              return chordLine;
                            })()}
                          </div>
                        )}
                        <div style={{ color: '#ffffff' }}>{line.lyrics}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  style={{
                    padding: '10px 20px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                    background: 'rgba(128,128,128,0.1)', border: 'none', color: 'var(--c-text-secondary)',
                    cursor: 'pointer', fontFamily: 'Inter'
                  }}
                >
                  {isSpanish ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  onClick={() => {
                    const textRep = generateTextRepresentation(previewChart);
                    setImportText(textRep);
                    setShowPreviewModal(false);
                    setShowImportModal(true);
                    setImportTab('paste');
                  }}
                  style={{
                    padding: '10px 20px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--c-text-primary)', cursor: 'pointer', fontFamily: 'Inter'
                  }}
                >
                  {isSpanish ? 'Editar' : 'Edit Manually'}
                </button>
                <button
                  onClick={handleSavePreviewChart}
                  style={{
                    padding: '10px 20px', borderRadius: 8, fontSize: '11px', fontWeight: 700,
                    background: 'var(--c-accent)', border: 'none', color: '#ffffff',
                    cursor: 'pointer', fontFamily: 'Inter'
                  }}
                >
                  {isSpanish ? 'Confirmar y Guardar' : 'Confirm & Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Playback Control Bar */}
      {activeSections.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100500,
          padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 8,
          background: 'rgba(10,10,14,0.92)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
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

          {/* Action Control Row */}
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

import { getChordById, type GuitarChordData, useChordStore, ACCENT_COLORS, type SongPreset, setNavHidden, transposeChordId } from '@workspace/studio-core';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ElasticSlider from './ElasticSlider';

interface LiveModeProps {
  preset: SongPreset;
  onClose: () => void;
  transposeOffset?: number;
}

type VisualStyle = 'both' | 'diagram' | 'name';
type BeatsPerChord = 1 | 2 | 4 | 8;

/* ── Full-size chord diagram ───────────────────────────────── */
function LiveDiagram({ data, accentFrom, accentTo }: { data: GuitarChordData; accentFrom: string; accentTo: string }) {
  const W = 200, H = 230;
  const numS = 6, numF = 5;
  const pL = 28, pT = 28, pR = 10, pB = 16;
  const cW = (W - pL - pR) / (numS - 1);
  const cH = (H - pT - pB) / numF;
  const r = 10;
  const { frets, baseFret, barres } = data;
  const allPositive = frets.filter(f => f > 0);
  const minActive = allPositive.length ? Math.min(...allPositive) : 1;
  const minF = baseFret > 1 ? baseFret : Math.max(1, minActive);
  const showNut = minF <= 1;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="dot-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accentFrom} />
          <stop offset="100%" stopColor={accentTo} />
        </linearGradient>
        {barres && barres.map((_, bi) => (
          <linearGradient key={bi} id={`barre-grad-${bi}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accentFrom} />
            <stop offset="100%" stopColor={accentTo} />
          </linearGradient>
        ))}
      </defs>

      {/* Nut */}
      {showNut && <rect x={pL - 1} y={pT - 6} width={(numS - 1) * cW + 2} height={6} rx={2} fill="#e7e5e4" opacity={0.7} />}
      {/* Position number */}
      {!showNut && (
        <text x={pL - 8} y={pT + cH * 0.5} fontFamily="Manrope" fontSize={11} fontWeight="bold" fill="#acabaa" textAnchor="end" dominantBaseline="middle">
          {minF}
        </text>
      )}
      {/* Fret lines */}
      {Array.from({ length: numF + 1 }).map((_, i) => (
        <line key={i} x1={pL} y1={pT + i * cH} x2={pL + (numS - 1) * cW} y2={pT + i * cH}
          stroke="rgba(255,255,255,0.12)" strokeWidth={i === 0 && !showNut ? 1.5 : 0.8} />
      ))}
      {/* String lines */}
      {Array.from({ length: numS }).map((_, i) => (
        <line key={i} x1={pL + i * cW} y1={pT} x2={pL + i * cW} y2={pT + numF * cH}
          stroke="rgba(255,255,255,0.18)" strokeWidth={0.8} />
      ))}
      {/* Barres */}
      {barres && barres.map((barre, bi) => {
        const fp = barre.fret - minF;
        if (fp < 0 || fp >= numF) return null;
        const x1 = pL + (numS - barre.fromString) * cW;
        const x2 = pL + (numS - barre.toString) * cW;
        const cy = pT + fp * cH + cH / 2;
        return (
          <rect key={bi}
            x={Math.min(x1, x2) - r / 2} y={cy - r}
            width={Math.abs(x2 - x1) + r} height={r * 2}
            rx={r} fill={`url(#barre-grad-${bi})`} opacity={0.92} />
        );
      })}
      {/* Dots */}
      {frets.map((f, si) => {
        if (f <= 0) return null;
        const fp = f - minF;
        if (fp < 0 || fp >= numF) return null;
        const stringNum = numS - si;
        const onBarre = barres && barres.some(b => b.fret === f && stringNum >= b.toString && stringNum <= b.fromString);
        if (onBarre) return null;
        const cx = pL + si * cW;
        const cy = pT + fp * cH + cH / 2;
        return (
          <g key={si}>
            <circle cx={cx} cy={cy} r={r + 4} fill={accentFrom} opacity={0.15} />
            <circle cx={cx} cy={cy} r={r} fill="url(#dot-grad)" />
          </g>
        );
      })}
      {/* Open / muted strings */}
      {frets.map((f, si) => {
        if (f !== 0 && f !== -1) return null;
        const cx = pL + si * cW;
        const cy = pT - 16;
        return f === 0
          ? <circle key={si} cx={cx} cy={cy} r={5} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} />
          : <text key={si} x={cx} y={cy + 4} textAnchor="middle" fontFamily="Manrope" fontSize={11} fill="rgba(255,255,255,0.3)">×</text>;
      })}
    </svg>
  );
}

/* ── Mini diagram for context chords ──────────────────────── */
function MiniLiveDiagram({ data, accentFrom }: { data: GuitarChordData; accentFrom: string }) {
  const W = 72, H = 82;
  const numS = 6, numF = 4;
  const pL = 10, pT = 12, pR = 4, pB = 8;
  const cW = (W - pL - pR) / (numS - 1);
  const cH = (H - pT - pB) / numF;
  const r = 3.5;
  const { frets, baseFret, barres } = data;
  const allPos = frets.filter(f => f > 0);
  const minAct = allPos.length ? Math.min(...allPos) : 1;
  const minF = baseFret > 1 ? baseFret : Math.max(1, minAct);
  const showNut = minF <= 1;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {showNut && <rect x={pL - 0.5} y={pT - 3} width={(numS - 1) * cW + 1} height={3} rx={1} fill="#acabaa" />}
      {Array.from({ length: numF + 1 }).map((_, i) => (
        <line key={i} x1={pL} y1={pT + i * cH} x2={pL + (numS - 1) * cW} y2={pT + i * cH}
          stroke="rgba(255,255,255,0.1)" strokeWidth={0.6} />
      ))}
      {Array.from({ length: numS }).map((_, i) => (
        <line key={i} x1={pL + i * cW} y1={pT} x2={pL + i * cW} y2={pT + numF * cH}
          stroke="rgba(255,255,255,0.1)" strokeWidth={0.6} />
      ))}
      {barres && barres.map((barre, bi) => {
        const fp = barre.fret - minF;
        if (fp < 0 || fp >= numF) return null;
        const x1 = pL + (numS - barre.fromString) * cW;
        const x2 = pL + (numS - barre.toString) * cW;
        const cy = pT + fp * cH + cH / 2;
        return <rect key={`b-${bi}`} x={Math.min(x1, x2)} y={cy - r} width={Math.abs(x2 - x1)} height={r * 2} rx={r} fill={accentFrom} opacity={0.9} />;
      })}
      {frets.map((f, si) => {
        if (f <= 0) return null;
        const fp = f - minF;
        if (fp < 0 || fp >= numF) return null;
        const stringNum = numS - si;
        const onBarre = barres && barres.some(b => b.fret === f && stringNum >= b.toString && stringNum <= b.fromString);
        if (onBarre) return null;
        const cx = pL + si * cW;
        const cy = pT + fp * cH + cH / 2;
        return <circle key={si} cx={cx} cy={cy} r={r} fill={accentFrom} />;
      })}
    </svg>
  );
}

export default function LiveMode({ preset, onClose, transposeOffset = 0 }: LiveModeProps) {
  const { settings } = useChordStore();
  const accent = ACCENT_COLORS[settings.accentColor];

  const [currentIdx, setCurrentIdx]     = useState(0);
  const [direction, setDirection]       = useState<'forward' | 'backward'>('forward');
  const [autoPlay, setAutoPlay]         = useState(false);
  const [shownIdx, setShownIdx]         = useState(0);
  const [phase, setPhase]               = useState<'idle' | 'exit' | 'enter-prep'>('idle');
  const [transDir, setTransDir]         = useState<'forward' | 'backward'>('forward');
  const [showSettings, setShowSettings] = useState(false);
  const [isExiting, setIsExiting]       = useState(false);
  const exitTimerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    setNavHidden(false);
    exitTimerRef.current = setTimeout(() => onClose(), 290);
  }, [isExiting, onClose]);

  useEffect(() => () => { if (exitTimerRef.current) clearTimeout(exitTimerRef.current); }, []);

  // Hide the app bottom nav while live mode is open
  useEffect(() => {
    setNavHidden(true);
    return () => setNavHidden(false);
  }, []);

  /* Live options */
  const [visualStyle, setVisualStyle]     = useState<VisualStyle>('both');
  const [beatsPerChord, setBeatsPerChord] = useState<BeatsPerChord>(4);
  const [showContext, setShowContext]     = useState(true);
  const [bpmOverride, setBpmOverride]     = useState(preset.bpm);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { chords, sectionLabels } = useMemo(() => {
    const ids: string[] = [];
    const labels: (string | null)[] = [];
    preset.chords.forEach(id => { ids.push(id); labels.push(null); });
    (preset.sections ?? []).forEach(sec => {
      sec.chords.forEach(id => { ids.push(id); labels.push(sec.name); });
    });
    const finalIds = transposeOffset !== 0 ? ids.map(id => transposeChordId(id, transposeOffset)) : ids;
    return { chords: finalIds, sectionLabels: labels };
  }, [preset.chords, preset.sections, transposeOffset]);
  const total  = chords.length;

  const currentChord = chords[currentIdx] ? getChordById(chords[currentIdx]) : null;
  const prevChord    = currentIdx > 0 && chords[currentIdx - 1] ? getChordById(chords[currentIdx - 1]) : null;
  const nextChord    = currentIdx < total - 1 && chords[currentIdx + 1] ? getChordById(chords[currentIdx + 1]) : null;

  const goNext = useCallback(() => {
    setDirection('forward');
    setCurrentIdx(i => (i + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) {
      setDirection('backward');
      setCurrentIdx(i => i - 1);
    }
  }, [currentIdx]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoPlay && bpmOverride > 0) {
      const ms = (60000 / bpmOverride) * beatsPerChord;
      intervalRef.current = setInterval(goNext, ms);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoPlay, bpmOverride, beatsPerChord, goNext]);

  // Smooth exit → enter transition when chord changes
  const prevIdxRef = useRef<number>(-1);
  useEffect(() => {
    if (prevIdxRef.current === -1) {
      prevIdxRef.current = currentIdx;
      setShownIdx(currentIdx);
      return;
    }
    if (currentIdx === prevIdxRef.current) return;
    prevIdxRef.current = currentIdx;

    if (!settings.liveModeAnimations) {
      setShownIdx(currentIdx);
      return;
    }

    setTransDir(direction);
    setPhase('exit');

    const t = setTimeout(() => {
      setShownIdx(currentIdx);
      setPhase('enter-prep');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase('idle');
        });
      });
    }, 170);

    return () => clearTimeout(t);
  }, [currentIdx, direction, settings.liveModeAnimations]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') { if (showSettings) setShowSettings(false); else handleClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goNext, goPrev, handleClose, showSettings]);

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showSettings) return;
    if (e.clientX < window.innerWidth / 2) goPrev(); else goNext();
  };

  const shownChord = chords[shownIdx] ? getChordById(chords[shownIdx]) : null;

  // CSS-transition-based chord swap: scale+fade exit → scale+spring enter (no left/right slide)
  const chordStyle: React.CSSProperties = (() => {
    if (!settings.liveModeAnimations) return {};
    if (phase === 'exit')
      return {
        opacity: 0,
        transform: 'scale(0.82) translateY(10px)',
        filter: 'blur(4px)',
        transition: 'opacity 170ms ease-in, transform 170ms ease-in, filter 170ms ease-in',
      };
    if (phase === 'enter-prep')
      return {
        opacity: 0,
        transform: 'scale(1.10) translateY(-14px)',
        filter: 'blur(6px)',
        transition: 'none',
      };
    // idle — spring back to natural position
    return {
      opacity: 1,
      transform: 'scale(1) translateY(0)',
      filter: 'blur(0px)',
      transition: 'opacity 320ms ease-out, transform 420ms cubic-bezier(0.34, 1.42, 0.64, 1), filter 280ms ease-out',
    };
  })();

  const msPerChord = (60000 / (bpmOverride || 120)) * beatsPerChord;

  const overlayAnim: React.CSSProperties = {
    animation: isExiting
      ? 'live-mode-exit 280ms cubic-bezier(0.4, 0, 1, 1) both'
      : 'live-mode-enter 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
  };

  if (total === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...overlayAnim }}>
        <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontSize: '18px' }}>No chords in this preset</p>
        <button onClick={handleClose} className="btn-smooth" style={{ marginTop: '24px', color: accent.from, fontFamily: 'Manrope', fontWeight: 700 }}>Close</button>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column', userSelect: 'none', ...overlayAnim }}
      onClick={handleTap}
    >
      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))', flexShrink: 0, pointerEvents: 'none' }}>
        <button onClick={e => { e.stopPropagation(); handleClose(); }} className="btn-smooth" data-testid="live-close"
          style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'all' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '20px' }}>close</span>
        </button>

        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '15px' }}>{preset.name}</p>
          <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '12px' }}>
            {preset.artist && `${preset.artist} · `}{preset.key && `${preset.key} · `}
            <span style={{ color: accent.from }}>{bpmOverride} BPM</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', pointerEvents: 'all' }}>
          <button onClick={e => { e.stopPropagation(); setShowSettings(s => !s); }} className="btn-smooth"
            style={{ width: '40px', height: '40px', borderRadius: '50%', background: showSettings ? `${accent.from}33` : 'rgba(255,255,255,0.08)', border: `1px solid ${showSettings ? accent.from + '55' : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: showSettings ? accent.from : '#acabaa', fontSize: '20px', fontVariationSettings: showSettings ? "'FILL' 1" : "'FILL' 0" }}>tune</span>
          </button>
          <button onClick={e => { e.stopPropagation(); setAutoPlay(a => !a); }} className="btn-smooth" data-testid="live-autoplay"
            style={{ padding: '6px 14px', borderRadius: '9999px', background: autoPlay ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.08)', border: `1px solid ${autoPlay ? 'transparent' : 'rgba(255,255,255,0.12)'}`, color: autoPlay ? '#fff' : '#acabaa', fontFamily: 'Manrope', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: autoPlay ? "'FILL' 1" : "'FILL' 0" }}>
              {autoPlay ? 'pause' : 'play_arrow'}
            </span>
            Auto
          </button>
        </div>
      </div>


      {/* ── Main chord display ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

        {/* Context: prev (left) */}
        {showContext && prevChord && (
          <div style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: 0.35, pointerEvents: 'none' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '14px' }}>chevron_left</span>
            {(visualStyle === 'diagram' || visualStyle === 'both') && prevChord.guitar && (
              <MiniLiveDiagram data={prevChord.guitar} accentFrom={accent.from} />
            )}
            <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '12px' }}>{prevChord.name.replace(/\s/g, '')}</p>
          </div>
        )}

        {/* Context: next (right) */}
        {showContext && nextChord && (
          <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: 0.35, pointerEvents: 'none' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '14px' }}>chevron_right</span>
            {(visualStyle === 'diagram' || visualStyle === 'both') && nextChord.guitar && (
              <MiniLiveDiagram data={nextChord.guitar} accentFrom={accent.from} />
            )}
            <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '12px' }}>{nextChord.name.replace(/\s/g, '')}</p>
          </div>
        )}

        {/* ── Active chord ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', willChange: 'transform, opacity, filter', ...chordStyle }}>

          {/* Section label */}
          {sectionLabels[shownIdx] && (
            <p style={{
              color: accent.from, fontFamily: 'Manrope', fontWeight: 700,
              fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em',
              opacity: 0.7, marginBottom: '-2px',
            }}>
              {sectionLabels[shownIdx]}
            </p>
          )}

          {/* Full diagram */}
          {(visualStyle === 'diagram' || visualStyle === 'both') && shownChord?.guitar && (
            <div style={{ position: 'relative' }}>
              {/* Static ambient glow */}
              <div style={{ position: 'absolute', inset: '-20px', borderRadius: '50%', background: `radial-gradient(circle, ${accent.from}1a 0%, transparent 70%)`, pointerEvents: 'none' }} />
              {/* Bloom pulse on arrival — re-keyed per chord so it always replays */}
              {settings.liveModeAnimations && (
                <div key={`bloom-${shownIdx}`} style={{
                  position: 'absolute', inset: '-28px', borderRadius: '50%',
                  background: `radial-gradient(circle, ${accent.from}40 0%, ${accent.to}18 50%, transparent 70%)`,
                  pointerEvents: 'none',
                  animation: 'chord-bloom 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
                }} />
              )}
              <LiveDiagram data={shownChord.guitar} accentFrom={accent.from} accentTo={accent.to} />
            </div>
          )}

          {/* Chord name + notes */}
          {(visualStyle === 'name' || visualStyle === 'both') && (
            <div style={{ textAlign: 'center' }}>
              <p style={{
                fontFamily: 'Manrope', fontWeight: 900,
                fontSize: visualStyle === 'name' ? '100px' : '48px',
                lineHeight: 1, letterSpacing: '-0.04em',
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                paddingBottom: '2px',
              }}>
                {shownChord ? shownChord.name.replace(/\s/g, '') : '?'}
              </p>
              {shownChord && (
                <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Inter', fontSize: '13px', marginTop: '4px', letterSpacing: '0.06em' }}>
                  {shownChord.notes.join('  ·  ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Progress indicator ── */}
        <div style={{ position: 'absolute', bottom: '14px', display: 'flex', gap: '5px', alignItems: 'center' }}>
          {total <= 16 ? chords.map((_, i) => {
            const isActive = i === currentIdx;
            return isActive ? (
              /* Active dot: animated countdown capsule */
              <div key={`active-${currentIdx}`} style={{
                position: 'relative',
                width: '32px', height: '6px',
                borderRadius: '9999px',
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
                pointerEvents: 'all',
                flexShrink: 0,
                transition: 'width 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                <div key={`fill-${currentIdx}`} style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: '100%',
                  background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
                  borderRadius: '9999px',
                  transformOrigin: 'left center',
                  animation: autoPlay
                    ? `chord-countdown ${msPerChord}ms linear forwards`
                    : 'none',
                }} />
              </div>
            ) : (
              /* Inactive dot: tap to jump */
              <button key={i} onClick={e => { e.stopPropagation(); setDirection(i > currentIdx ? 'forward' : 'backward'); setCurrentIdx(i); }}
                style={{ width: '6px', height: '6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', pointerEvents: 'all', flexShrink: 0, padding: 0, transition: 'background 200ms ease' }} />
            );
          }) : (
            <p style={{ color: 'var(--c-text-muted)', fontFamily: 'Inter', fontSize: '12px' }}>{currentIdx + 1} / {total}</p>
          )}
        </div>
      </div>

      {/* ── Bottom nav row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 28px', paddingBottom: 'max(28px, env(safe-area-inset-bottom))', flexShrink: 0, pointerEvents: 'none' }}>
        <button onClick={e => { e.stopPropagation(); goPrev(); }} className="btn-smooth" data-testid="live-prev" disabled={currentIdx === 0}
          style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: currentIdx === 0 ? 0.25 : 1, pointerEvents: 'all', transition: 'opacity 200ms ease' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: '20px' }}>arrow_back</span>
        </button>
        <div style={{ width: '48px' }} />
        <button onClick={e => { e.stopPropagation(); goNext(); }} className="btn-smooth" data-testid="live-next"
          style={{ width: '48px', height: '48px', borderRadius: '50%', background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`, boxShadow: `0 4px 20px ${accent.to}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'all' }}>
          <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '20px' }}>arrow_forward</span>
        </button>
      </div>

      {/* ── Settings Sheet ── */}
      {showSettings && (
        <>
          <div onClick={e => { e.stopPropagation(); setShowSettings(false); }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 10 }} />

          <div onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#111', borderRadius: '1.5rem 1.5rem 0 0', zIndex: 11, animation: 'sheet-up 400ms cubic-bezier(0.16, 1, 0.3, 1) both', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>

            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.15)' }} />
            </div>

            <div style={{ padding: '4px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 800, fontSize: '18px' }}>Live Options</p>
              <button onClick={() => setShowSettings(false)} className="btn-smooth">
                <span className="material-symbols-outlined" style={{ color: 'var(--c-text-secondary)', fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div style={{ padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Visual style */}
              <div>
                <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '10px' }}>Visual</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {([
                    { value: 'both',    label: 'Diagram + Name', icon: 'tune'    },
                    { value: 'diagram', label: 'Diagram Only',   icon: 'grid_on' },
                    { value: 'name',    label: 'Name Only',      icon: 'title'   },
                  ] as { value: VisualStyle; label: string; icon: string }[]).map(opt => (
                    <button key={opt.value} onClick={() => setVisualStyle(opt.value)} className="btn-smooth"
                      style={{ padding: '10px 6px', borderRadius: '0.875rem', background: visualStyle === opt.value ? `${accent.from}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${visualStyle === opt.value ? accent.from + '55' : 'transparent'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'background 200ms ease, border-color 200ms ease' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: visualStyle === opt.value ? accent.from : '#acabaa', fontVariationSettings: visualStyle === opt.value ? "'FILL' 1" : "'FILL' 0" }}>{opt.icon}</span>
                      <p style={{ color: visualStyle === opt.value ? '#e7e5e4' : '#6b6b6b', fontFamily: 'Manrope', fontWeight: 700, fontSize: '10px', textAlign: 'center', lineHeight: 1.2 }}>{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* BPM */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Speed</p>
                  <p style={{ color: accent.from, fontFamily: 'Manrope', fontWeight: 800, fontSize: '14px' }}>{bpmOverride} BPM</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setBpmOverride(b => Math.max(20, b - 10))} className="btn-smooth"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: '20px' }}>remove</span>
                  </button>
                  <ElasticSlider
                    min={20} max={300} step={5} value={bpmOverride}
                    onChange={setBpmOverride}
                    accentColor={accent.from}
                    style={{ flex: 1 }}
                  />
                  <button onClick={() => setBpmOverride(b => Math.min(300, b + 10))} className="btn-smooth"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: '20px' }}>add</span>
                  </button>
                </div>
              </div>

              {/* Beats per chord */}
              <div>
                <p style={{ color: 'var(--c-text-secondary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '10px' }}>Beats Per Chord</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {([1, 2, 4, 8] as BeatsPerChord[]).map(b => (
                    <button key={b} onClick={() => setBeatsPerChord(b)} className="btn-smooth"
                      style={{ flex: 1, padding: '10px 4px', borderRadius: '0.75rem', background: beatsPerChord === b ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.06)', color: beatsPerChord === b ? '#fff' : '#acabaa', fontFamily: 'Manrope', fontWeight: 800, fontSize: '14px', border: 'none', boxShadow: beatsPerChord === b ? `0 2px 12px ${accent.to}44` : 'none', transition: 'background 200ms ease' }}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show context */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: 'var(--c-text-primary)', fontFamily: 'Manrope', fontWeight: 700, fontSize: '14px' }}>Surrounding Chords</p>
                  <p style={{ color: '#6b6b6b', fontFamily: 'Inter', fontSize: '12px', marginTop: '2px' }}>Show prev / next at the sides</p>
                </div>
                <button onClick={() => setShowContext(c => !c)} className="btn-smooth"
                  style={{ width: '48px', height: '28px', borderRadius: '9999px', background: showContext ? `linear-gradient(135deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.1)', position: 'relative', flexShrink: 0, transition: 'background 300ms ease', boxShadow: showContext ? `0 2px 10px ${accent.to}44` : 'none' }}>
                  <div style={{ position: 'absolute', top: '3px', left: showContext ? '23px' : '3px', width: '22px', height: '22px', borderRadius: '50%', background: '#fff', transition: 'left 300ms cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                </button>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}

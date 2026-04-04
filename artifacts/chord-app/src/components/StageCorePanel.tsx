import { useRef, useEffect, useCallback, useState } from 'react';
import { AppModeMenuLogo } from './AppModeMenuLogo';
import { setBackHandler } from '../lib/backStack';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

type StageWin = Window & {
  stageGoBack?: () => boolean;
  openPresetsPanel?: () => void;
  switchView?: (v: string) => void;
  __onViewChange?: (view: string) => void;
};

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function injectAccentVars(iframe: HTMLIFrameElement, from: string, to: string) {
  try {
    const doc  = iframe.contentDocument;
    const root = doc?.documentElement;
    if (!root) return;
    const [r, g, b] = hexToRgb(from);
    const [hr, hg, hb] = hexToRgb(to);
    root.style.setProperty('--accent',      from);
    root.style.setProperty('--accent-dark', '#fff');
    root.style.setProperty('--accent-08', `rgba(${r},${g},${b},0.08)`);
    root.style.setProperty('--accent-10', `rgba(${r},${g},${b},0.10)`);
    root.style.setProperty('--accent-12', `rgba(${r},${g},${b},0.12)`);
    root.style.setProperty('--accent-14', `rgba(${r},${g},${b},0.14)`);
    root.style.setProperty('--accent-20', `rgba(${r},${g},${b},0.20)`);
    root.style.setProperty('--accent-22', `rgba(${r},${g},${b},0.22)`);
    root.style.setProperty('--accent-30', `rgba(${r},${g},${b},0.30)`);
    root.style.setProperty('--accent-40', `rgba(${r},${g},${b},0.40)`);
    root.style.setProperty('--accent-50', `rgba(${r},${g},${b},0.50)`);
    root.style.setProperty('--accent-60', `rgba(${r},${g},${b},0.60)`);
    root.style.setProperty('--accent-70', `rgba(${r},${g},${b},0.70)`);
    root.style.setProperty('--hot',      to);
    root.style.setProperty('--hot-dark', `rgba(${hr},${hg},${hb},0.25)`);
    root.style.setProperty('--hot-10',   `rgba(${hr},${hg},${hb},0.10)`);
    root.style.setProperty('--hot-20',   `rgba(${hr},${hg},${hb},0.20)`);
    // Also paint the sliding nav pill directly so it always reflects the live accent
    // even if CSS variable inheritance is delayed by the browser paint cycle
    const pill = doc?.getElementById('sc-nav-pill');
    if (pill) pill.style.background = from;
  } catch { /* cross-origin guard */ }
}

export default function StageCorePanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { settings } = useChordStore();
  const [curView, setCurView] = useState<string>('Editor');

  // Always follow the global hub accent so Stagex matches whatever theme the user has selected
  const accentKey = (settings.accentColor ?? 'blue') as keyof typeof ACCENT_COLORS;
  const accent    = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;

  // Derive the stage-specific theme so the wrapper background matches the splash
  const stageVis  = settings.perApp?.stage ?? { theme: 'dark' as const, accentColor: 'blue' as const, amoledMode: false };
  const isLight   = stageVis.theme === 'light';
  const isAmoled  = stageVis.amoledMode;
  const stageBg   = isAmoled ? '#000000' : isLight ? '#f5f5f5' : '#0e0e0e';
  const stageHdr  = isAmoled ? '#000000' : isLight ? '#f5f5f5' : '#0e0e0e';

  // Show back button only inside the four sub-sections of Setup (not on SetupHub or Preferences)
  const showBack = curView === 'Rider' || curView === 'Setlist' || curView === 'Gear' || curView === 'Members';

  const getWin = useCallback((): StageWin | null => {
    try { return iframeRef.current?.contentWindow as StageWin | null; }
    catch { return null; }
  }, []);

  // Register __onViewChange callback and inject accent vars on iframe load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      try { iframe.contentWindow?.postMessage('stage-core-ping', '*'); } catch {}
      injectAccentVars(iframe, accent.from, accent.to);
      // Register view-change callback so React knows when to show/hide back button
      try {
        (iframe.contentWindow as StageWin).__onViewChange = (view: string) => setCurView(view);
      } catch {}
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [accent.from, accent.to]);

  // Re-inject accent vars whenever accent changes (after iframe is loaded)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    injectAccentVars(iframe, accent.from, accent.to);
  }, [accent.from, accent.to]);

  // Register global back handler (OS back gesture / Android back button)
  useEffect(() => {
    const handler = (): boolean => getWin()?.stageGoBack?.() ?? false;
    setBackHandler(handler);
    return () => setBackHandler(null);
  }, [getWin]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: stageBg, transition: 'background 300ms ease' }}>

      {/* Safe-area spacer */}
      <div style={{ height: 'env(safe-area-inset-top)', background: stageHdr, flexShrink: 0 }} />

      {/* 52px header bar */}
      <div style={{
        flexShrink: 0,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px 0',
        background: stageHdr,
        gap: 8,
        position: 'relative',
      }}>

        {/* ── Back button — slides in/out, pushes logo right — identical to Chordex ── */}
        <div style={{
          overflow: 'hidden',
          flexShrink: 0,
          width: showBack ? '46px' : '0px',
          opacity: showBack ? 1 : 0,
          transition: 'width 300ms cubic-bezier(0.34,1.1,0.64,1), opacity 200ms ease',
        }}>
          <button
            onClick={() => getWin()?.stageGoBack?.()}
            className="btn-smooth"
            aria-label="Back"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--app-surface-high)',
              border: '1px solid rgba(128,128,128,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 500ms cubic-bezier(0.4,0,0.2,1)',
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--c-text-primary)', fontSize: 18 }}>
              arrow_back
            </span>
          </button>
        </div>

        {/* App mode logo — shifts right as back button slides in */}
        <AppModeMenuLogo color="rgba(255,255,255,0.90)" size={13} />

        <div style={{ flex: 1 }} />

        {/* SAVE + PDF buttons — only shown on the Stage canvas */}
        {curView === 'Editor' && <>
          <button
            onClick={() => getWin()?.openPresetsPanel?.()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: `${accent.from}22`, color: accent.from,
              border: `1px solid ${accent.from}44`, borderRadius: 8,
              padding: '5px 11px', fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, lineHeight: 1 }}>layers</span>
            Save
          </button>

          <button
            onClick={() => getWin()?.switchView?.('Export')}
            title="Export to PDF"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32,
              background: 'rgba(255,255,255,0.06)', color: 'rgba(180,185,200,0.7)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>picture_as_pdf</span>
          </button>
        </>}
      </div>

      {/* Stage Core iframe fills remaining space */}
      <iframe
        ref={iframeRef}
        src="/stage-core/index.html"
        title="Stagex"
        style={{ flex: 1, width: '100%', border: 'none', display: 'block' }}
        allow="clipboard-write"
      />
    </div>
  );
}

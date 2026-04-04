import { useRef, useEffect, useCallback, useState } from 'react';
import { AppModeMenuLogo } from './AppModeMenuLogo';
import { setBackHandler } from '../lib/backStack';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

type StageWin = Window & {
  stageGoBack?: () => boolean;
  openPresetsPanel?: () => void;
  switchView?: (v: string) => void;
  __onViewChange?: (view: string) => void;
  scActivateMeasure?: () => void;
  scToggleZones?: () => void;
  scToggleCableLength?: () => void;
  openTimelinePanel?: () => void;
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
    if (pill) {
      pill.style.background = `linear-gradient(135deg, ${from}, ${to})`;
      pill.style.boxShadow  = `0 2px 18px rgba(${r},${g},${b},0.35)`;
    }
  } catch { /* cross-origin guard */ }
}

function injectTheme(iframe: HTMLIFrameElement, theme: string) {
  try {
    const root = iframe.contentDocument?.documentElement;
    if (!root) return;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      const win = iframe.contentWindow as (Window & { updateCanvasBg?: (c: string) => void }) | null;
      win?.updateCanvasBg?.('#ffffff');
    } else {
      root.removeAttribute('data-theme');
      const win = iframe.contentWindow as (Window & { updateCanvasBg?: (c: string) => void }) | null;
      win?.updateCanvasBg?.('#1a1a1a');
    }
  } catch { /* cross-origin guard */ }
}

function injectAmoled(iframe: HTMLIFrameElement, amoled: boolean) {
  try {
    const root = iframe.contentDocument?.documentElement;
    if (!root) return;
    if (amoled) {
      root.setAttribute('data-amoled', '1');
      const win = iframe.contentWindow as (Window & { updateCanvasBg?: (c: string) => void }) | null;
      win?.updateCanvasBg?.('#000000');
    } else {
      root.removeAttribute('data-amoled');
    }
  } catch { /* cross-origin guard */ }
}

export default function StageCorePanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { settings } = useChordStore();
  const [curView, setCurView] = useState<string>('Editor');

  // Detect landscape orientation — collapses the React header bar so the
  // Stagex canvas gets full screen in landscape while on the Stage Editor.
  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: landscape) and (max-width: 960px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape) and (max-width: 960px)');
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Derive the stage-specific theme/accent from per-app settings, falling back to global
  const stageVis  = settings.perApp?.stage ?? { theme: 'dark' as const, accentColor: 'blue' as const, amoledMode: false };
  const accentKey = (stageVis.accentColor ?? settings.accentColor ?? 'blue') as keyof typeof ACCENT_COLORS;
  const accent    = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;
  const isLight   = stageVis.theme === 'light';

  const isAmoled  = stageVis.amoledMode;

  // Freeze the initial src with theme + accent colors in the hash.
  // The hash is read by a blocking inline script in index.html <head> before any CSS renders — no flash.
  const iframeSrc = useRef(
    `/stage-core/index.html#${isLight ? 'light' : 'dark'},${encodeURIComponent(accent.from)},${encodeURIComponent(accent.to)},${isAmoled ? '1' : '0'}`
  ).current;
  const stageBg   = isAmoled ? (isLight ? '#ffffff' : '#000000') : isLight ? '#f2f1ef' : '#1a1a1a';
  const stageHdr  = isAmoled ? (isLight ? '#ffffff' : '#000000') : isLight ? '#f2f1ef' : '#1a1a1a';

  // Show back button only inside the four sub-sections of Setup (not on SetupHub or Preferences)
  const showBack = curView === 'Rider' || curView === 'Setlist' || curView === 'Gear' || curView === 'Members';

  const getWin = useCallback((): StageWin | null => {
    try { return iframeRef.current?.contentWindow as StageWin | null; }
    catch { return null; }
  }, []);

  // Register __onViewChange callback and inject accent vars + theme on iframe load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      try { iframe.contentWindow?.postMessage('stage-core-ping', '*'); } catch {}
      injectAccentVars(iframe, accent.from, accent.to);
      injectTheme(iframe, stageVis.theme ?? 'dark');
      injectAmoled(iframe, isAmoled);
      // Register view-change callback so React knows when to show/hide back button
      try {
        (iframe.contentWindow as StageWin).__onViewChange = (view: string) => setCurView(view);
      } catch {}
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [accent.from, accent.to, stageVis.theme, isAmoled]);

  // Re-inject accent vars + theme whenever they change (after iframe is loaded)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    injectAccentVars(iframe, accent.from, accent.to);
    injectTheme(iframe, stageVis.theme ?? 'dark');
  }, [accent.from, accent.to, stageVis.theme]);

  // Re-inject AMOLED state whenever it changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    injectAmoled(iframe, isAmoled);
  }, [isAmoled]);

  // Register global back handler (OS back gesture / Android back button)
  useEffect(() => {
    const handler = (): boolean => getWin()?.stageGoBack?.() ?? false;
    setBackHandler(handler);
    return () => setBackHandler(null);
  }, [getWin]);

  // Collapse header in Export view or when landscape + Editor (immersive canvas mode)
  const collapseHeader = curView === 'Export' || (isLandscape && curView === 'Editor');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: stageBg, transition: 'background 180ms ease' }}>

      {/* Safe-area spacer + 52px header — collapses in Export view and in landscape on the Editor */}
      <div style={{
        flexShrink: 0,
        // overflow:hidden clips content during the height animation; visible allows the
        // app-switch dropdown to render below the header when fully expanded.
        overflow: collapseHeader ? 'hidden' : 'visible',
        height: collapseHeader ? 0 : 'calc(env(safe-area-inset-top) + 52px)',
        transition: 'height 260ms cubic-bezier(0.4,0,0.2,1)',
      }}>
      {/* Safe-area spacer */}
      <div style={{ height: 'env(safe-area-inset-top)', background: 'transparent', flexShrink: 0 }} />

      {/* 52px header bar */}
      <div style={{
        flexShrink: 0,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px 0',
        background: stageHdr,
        transition: 'background 180ms ease',
        gap: showBack ? 8 : 0,
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
        <AppModeMenuLogo color={isLight ? 'rgba(0,0,0,0.80)' : 'rgba(255,255,255,0.90)'} size={13} />

        <div style={{ flex: 1 }} />

        {/* SAVE + tool buttons — only shown on the Stage canvas */}
        {curView === 'Editor' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>

            {/* ── Tool pills: MEASURE · ZONES · LENGTH · HISTORY ── */}
            {(
              [
                { label: 'Measure', icon: 'straighten',  fn: () => getWin()?.scActivateMeasure?.()   },
                { label: 'Zones',   icon: 'grid_4x4',    fn: () => getWin()?.scToggleZones?.()       },
                { label: 'Length',  icon: 'cable',        fn: () => getWin()?.scToggleCableLength?.() },
                { label: 'History', icon: 'history',      fn: () => getWin()?.openTimelinePanel?.()   },
              ] as { label: string; icon: string; fn: () => void }[]
            ).map(({ label, icon, fn }) => (
              <button
                key={label}
                onClick={fn}
                title={label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32,
                  background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
                  color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.75)',
                  border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
              </button>
            ))}

            {/* ── Save preset ── */}
            <button
              onClick={() => getWin()?.openPresetsPanel?.()}
              title="Presets"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32,
                background: `${accent.from}22`, color: accent.from,
                border: `1px solid ${accent.from}44`, borderRadius: '50%',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>save</span>
            </button>

            {/* ── PDF export ── */}
            <button
              onClick={() => getWin()?.switchView?.('Export')}
              title="Export to PDF"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32,
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                color: isLight ? 'rgba(0,0,0,0.5)' : 'rgba(180,185,200,0.7)',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: '50%', cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>picture_as_pdf</span>
            </button>

          </div>
        )}
      </div>
      </div>{/* end collapsible header wrapper */}

      {/* Stage Core iframe fills remaining space */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Stagex"
        style={{ flex: 1, width: '100%', border: 'none', display: 'block', backgroundColor: stageBg }}
        allow="clipboard-write"
      />
    </div>
  );
}

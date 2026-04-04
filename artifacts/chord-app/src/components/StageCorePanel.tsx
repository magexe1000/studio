import { useRef, useEffect, useCallback } from 'react';
import { AppModeMenuLogo } from './AppModeMenuLogo';
import { setBackHandler } from '../lib/backStack';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';

type StageWin = Window & {
  stageGoBack?: () => boolean;
  openPresetsPanel?: () => void;
  switchView?: (v: string) => void;
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
    const root = iframe.contentDocument?.documentElement;
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
  } catch { /* cross-origin guard */ }
}

export default function StageCorePanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { settings } = useChordStore();

  const stageVis = settings.perApp?.stage ?? { accentColor: settings.accentColor ?? 'blue' };
  const accent   = ACCENT_COLORS[stageVis.accentColor as keyof typeof ACCENT_COLORS];

  const getWin = useCallback((): StageWin | null => {
    try { return iframeRef.current?.contentWindow as StageWin | null; }
    catch { return null; }
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      try { iframe.contentWindow?.postMessage('stage-core-ping', '*'); } catch {}
      injectAccentVars(iframe, accent.from, accent.to);
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [accent.from, accent.to]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    injectAccentVars(iframe, accent.from, accent.to);
  }, [accent.from, accent.to]);

  useEffect(() => {
    const handler = (): boolean => getWin()?.stageGoBack?.() ?? false;
    setBackHandler(handler);
    return () => setBackHandler(null);
  }, [getWin]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0e' }}>

      <div style={{ height: 'env(safe-area-inset-top)', background: '#0a0a0e', flexShrink: 0 }} />

      <div style={{
        flexShrink: 0,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px 0',
        background: '#0a0a0e',
        gap: 8,
      }}>
        <AppModeMenuLogo color="rgba(255,255,255,0.90)" size={13} />

        <div style={{ flex: 1 }} />

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
      </div>

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

import { useRef, useEffect, useCallback } from 'react';
import { AppModeMenuLogo } from './AppModeMenuLogo';
import { setBackHandler } from '../lib/backStack';

type StageWin = Window & {
  stageGoBack?: () => boolean;
  openPresetsPanel?: () => void;
  switchView?: (v: string) => void;
};

export default function StageCorePanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const getWin = useCallback((): StageWin | null => {
    try { return iframeRef.current?.contentWindow as StageWin | null; }
    catch { return null; }
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      try { iframe.contentWindow?.postMessage('stage-core-ping', '*'); } catch {}
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, []);

  useEffect(() => {
    const handler = (): boolean => getWin()?.stageGoBack?.() ?? false;
    setBackHandler(handler);
    return () => setBackHandler(null);
  }, [getWin]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0e' }}>

      {/* Safe-area spacer — matches Drumex/Chordex */}
      <div style={{ height: 'env(safe-area-inset-top)', background: '#0a0a0e', flexShrink: 0 }} />

      {/* 52px header bar — matches Drumex/Chordex exactly */}
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

        {/* SAVE button */}
        <button
          onClick={() => getWin()?.openPresetsPanel?.()}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,116,57,0.14)', color: '#ff7439',
            border: '1px solid rgba(255,116,57,0.28)', borderRadius: 8,
            padding: '5px 11px', fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13, lineHeight: 1 }}>layers</span>
          Save
        </button>

        {/* PDF / Export button */}
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

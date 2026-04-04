import { useRef, useEffect } from 'react';
import { AppModeMenuLogo } from './AppModeMenuLogo';

export default function StageCorePanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      try {
        iframe.contentWindow?.postMessage('stage-core-ping', '*');
      } catch {}
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src="/stage-core/index.html"
        title="Stagex"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        allow="clipboard-write"
      />

      {/* App-switcher logo overlay — same as Chordex/Drumex header */}
      <div style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top) + 10px)',
        left: 14,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
      }}>
        <AppModeMenuLogo color="rgba(255,255,255,0.90)" size={15} />
      </div>
    </div>
  );
}

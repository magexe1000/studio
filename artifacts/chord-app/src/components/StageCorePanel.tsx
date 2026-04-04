import { useRef, useEffect } from 'react';

export default function StageCorePanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const goToHub = () => {
    window.dispatchEvent(new CustomEvent('studio-hub-return'));
  };

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
        title="Stage Core"
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

      {/* Floating back-to-hub button */}
      <button
        onClick={goToHub}
        title="Back to Studio Hub"
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top) + 10px)',
          left: 10,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px 5px 7px',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 99,
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.80)',
          fontSize: 11,
          fontFamily: 'Manrope, sans-serif',
          fontWeight: 700,
          letterSpacing: '-0.01em',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Hub
      </button>
    </div>
  );
}

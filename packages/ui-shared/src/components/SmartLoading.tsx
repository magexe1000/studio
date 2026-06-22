import React, { useState, useEffect } from 'react';
import { type AppKey } from '@workspace/studio-core';
import { ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';

interface SmartLoadingProps {
  fallbackSkeleton?: React.ReactNode;
  subtleLoading?: React.ReactNode;
  delayMs?: number;      // threshold for showing subtle loading (150ms)
  skeletonMs?: number;  // threshold for showing full skeleton (400ms)
  app?: AppKey;
}

export function AppLoadingScreen({ app }: { app: AppKey }) {
  const logos = {
    chords: { Logo: ChordexLogo, name: 'Chordex', desc: 'Preparing chord theory engine...', color: '#a855f7' },
    drums: { Logo: DrumexLogo, name: 'Drumex', desc: 'Loading drum patterns...', color: '#ec4899' },
    stage: { Logo: StagexLogoIcon, name: 'Stagex', desc: 'Initializing 3D stage setup...', color: '#3b82f6' },
    groovex: { Logo: GroovexLogo, name: 'Groovex', desc: 'Loading audio channels...', color: '#10b981' },
    vocalex: { Logo: VocalexLogo, name: 'Vocalex', desc: 'Preparing vocal recorder...', color: '#f59e0b' },
  };

  const config = logos[app] || logos.chords;
  const Logo = config.Logo;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: '#09090b', // Sleek AMOLED dark background
        color: '#ffffff',
        fontFamily: 'Inter, sans-serif',
        animation: 'fade-in 200ms ease-out forwards',
      }}
    >
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse-logo {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 12px var(--shadow-color)); }
          50% { transform: scale(1.06); filter: drop-shadow(0 0 24px var(--shadow-color)); }
        }
      `}</style>
      <div
        style={{
          '--shadow-color': config.color,
          animation: 'pulse-logo 2s infinite ease-in-out',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        } as any}
      >
        <Logo size={80} />
      </div>
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: '8px',
          background: `linear-gradient(135deg, #ffffff 0%, ${config.color} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {config.name}
      </h1>
      <p
        style={{
          fontSize: '13px',
          color: '#a1a1aa',
          fontWeight: 500,
          margin: 0,
        }}
      >
        {config.desc}
      </p>
    </div>
  );
}

export default function SmartLoading({
  fallbackSkeleton,
  subtleLoading,
  delayMs = 150,
  skeletonMs = 400,
  app,
}: SmartLoadingProps) {
  const [loadState, setLoadState] = useState<'none' | 'subtle' | 'skeleton'>(
    app ? 'skeleton' : 'none'
  );

  useEffect(() => {
    if (app) return; // Skip timers if app loading screen is explicitly set

    const subtleTimer = setTimeout(() => {
      setLoadState('subtle');
    }, delayMs);

    const skeletonTimer = setTimeout(() => {
      setLoadState('skeleton');
    }, skeletonMs);

    return () => {
      clearTimeout(subtleTimer);
      clearTimeout(skeletonTimer);
    };
  }, [delayMs, skeletonMs, app]);

  if (loadState === 'none') {
    return null;
  }

  if (loadState === 'subtle') {
    return subtleLoading ? (
      <>{subtleLoading}</>
    ) : (
      <div className="studio-accent-loader">
        <div className="studio-accent-loader-bar" />
      </div>
    );
  }

  if (app) {
    return <AppLoadingScreen app={app} />;
  }

  return (
    <div style={{ animation: 'skeleton-fade-in 300ms ease both' }}>
      <style>{`
        @keyframes skeleton-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {fallbackSkeleton}
    </div>
  );
}

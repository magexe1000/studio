import React, { useState, useEffect } from 'react';
import { useChordStore, ACCENT_COLORS, type AppKey } from '../store/useChordStore';
import { useT } from '../lib/useT';
import { APP_SECTIONS } from '../lib/studioAppNavigationRegistry';

export default function WebAppSectionNav({
  app,
  activeSection,
  onChangeSection,
}: {
  app: string;
  activeSection: string;
  onChangeSection: (sectionId: any) => void;
}) {
  const [isLargeDesktop, setIsLargeDesktop] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsLargeDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { settings } = useChordStore();
  const t = useT();

  const appKey = app === 'stage' ? 'stage' : app;
  const activeVis = settings.perApp?.[appKey as AppKey] ?? {
    theme: settings.theme ?? 'dark',
    accentColor: settings.accentColor ?? 'blue',
    amoledMode: settings.amoledMode ?? false,
  };
  const accent = ACCENT_COLORS[activeVis.accentColor] ?? ACCENT_COLORS.blue;

  const sections = APP_SECTIONS[app];
  if (!sections || sections.length === 0) return null;

  const getSectionLabel = (labelKey: string) => {
    switch (labelKey) {
      case 'songs': return t.nav?.songs || 'Songs';
      case 'library': return t.nav?.library || 'Library';
      case 'chords': return t.nav?.chords || 'Chords';
      
      case 'drumSongs': return t.drum?.songs || 'Beats';
      case 'drumPatterns': return t.drum?.patterns || 'Patterns';
      case 'drumPreferences': return t.drum?.preferences || 'Preferences';
      
      case 'groovexLibrary': return t.groovex?.library || 'Library';
      case 'groovexPreferences': return t.groovex?.preferences || 'Preferences';
      
      case 'vocalexPractice': return t.vocalex?.navTips || 'Practice';
      case 'vocalexPitch': return t.vocalex?.navPitch || 'Pitch';
      case 'vocalexLab': return t.vocalex?.navLab || 'Vocal Lab';
      case 'vocalexTakes': return t.vocalex?.navTakes || 'Takes';
      
      case 'stagexStage': return t.stagex?.navStage || 'Stage';
      case 'stagexSetup': return t.stagex?.navSetup || 'Setup';
      case 'stagexPreferences': return t.stagex?.navPreferences || 'Preferences';
      
      default: return labelKey;
    }
  };

  const isLight = (() => {
    if (activeVis.theme === 'light') return true;
    if (activeVis.theme === 'system') {
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    if (activeVis.theme === 'dynamic') {
      const h = new Date().getHours();
      const lightStart = settings.dynamicLightStart ?? 7;
      const lightEnd   = settings.dynamicLightEnd   ?? 20;
      return h >= lightStart && h < lightEnd;
    }
    return false;
  })();

  const amoledBg = activeVis.amoledMode
    ? 'rgba(4,4,4,0.92)'
    : isLight
      ? 'rgba(255, 255, 255, 0.40)'
      : 'rgba(26,26,30,0.72)';

  if (isLargeDesktop) {
    // Render left subnav rail
    return (
      <div 
        style={{
          width: '72px',
          height: '100%',
          flexShrink: 0,
          background: amoledBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 0',
          gap: '12px',
          zIndex: 40,
          boxShadow: isLight
            ? '2px 0 8px rgba(0,0,0,0.02)'
            : '2px 0 16px rgba(0,0,0,0.2)',
          transition: 'background 300ms ease, border-color 300ms ease',
        }}
      >
        {sections.map(section => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onChangeSection(section.id)}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                border: 'none',
                background: isActive 
                  ? (isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.07)')
                  : 'transparent',
                color: isActive ? accent.from : 'var(--c-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 200ms ease',
                padding: '4px',
                outline: 'none',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.03)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {isActive && (
                <div 
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: '3px',
                    height: '24px',
                    borderRadius: '0 4px 4px 0',
                    background: `linear-gradient(to bottom, ${accent.from}, ${accent.to})`,
                  }}
                />
              )}
              <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                {section.icon}
              </span>
              <span 
                style={{ 
                  fontSize: '8px', 
                  textTransform: 'uppercase', 
                  fontWeight: 700, 
                  letterSpacing: '0.04em',
                  fontFamily: 'Manrope, sans-serif',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                {getSectionLabel(section.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    );
  } else {
    // Render top horizontal tabs (tablet/iPad view)
    return (
      <div 
        style={{
          width: '100%',
          padding: '12px 24px 8px',
          display: 'flex',
          justifyContent: 'center',
          background: 'transparent',
          zIndex: 40,
        }}
      >
        <div 
          style={{
            display: 'flex',
            background: isLight ? 'rgba(0,0,0,0.03)' : 'var(--app-surface)',
            borderRadius: '12px',
            padding: '3px',
            gap: '4px',
            width: '100%',
            maxWidth: '480px',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'}`,
            transition: 'background-color 300ms ease',
          }}
        >
          {sections.map(section => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => onChangeSection(section.id)}
                style={{
                  flex: 1,
                  height: '34px',
                  borderRadius: '9px',
                  border: 'none',
                  background: isActive ? accent.from : 'transparent',
                  color: isActive 
                    ? '#0d0e0f' 
                    : (isLight ? 'rgba(0,0,0,0.55)' : '#acabaa'),
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  fontSize: '12px',
                  fontFamily: 'Manrope, sans-serif',
                  transition: 'all 200ms ease',
                  outline: 'none',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {section.icon}
                </span>
                <span>{getSectionLabel(section.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
}

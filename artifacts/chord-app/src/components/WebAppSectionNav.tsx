import React, { useState } from 'react';
import { useChordStore, ACCENT_COLORS, type AppKey } from '../store/useChordStore';
import { useT } from '../lib/useT';
import { APP_SECTIONS } from '../lib/studioAppNavigationRegistry';
import { useStudioPreferences } from '../hooks/useStudioPreferences';

export default function WebAppSectionNav({
  app,
  activeSection,
  onChangeSection,
}: {
  app: string;
  activeSection: string;
  onChangeSection: (sectionId: any) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { settings } = useChordStore();
  const { preferences } = useStudioPreferences();
  const t = useT();

  const sections = APP_SECTIONS[app];
  if (!sections || sections.length === 0) return null;

  const appKey = app === 'stage' ? 'stage' : app;
  const activeVis = settings.perApp?.[appKey as AppKey] ?? {
    theme: settings.theme ?? 'dark',
    accentColor: settings.accentColor ?? 'blue',
    amoledMode: settings.amoledMode ?? false,
  };
  const accent = ACCENT_COLORS[activeVis.accentColor] ?? ACCENT_COLORS.blue;

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
    ? 'rgba(4, 4, 4, 0.75)'
    : isLight
      ? 'rgba(255, 255, 255, 0.50)'
      : 'rgba(20, 20, 25, 0.65)';

  const reduceTransitions = preferences.reduceMotion;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        padding: '6px',
        gap: '4px',
        borderRadius: '9999px',
        background: amoledBg,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isLight
          ? '0 8px 32px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.02)'
          : '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
        transition: reduceTransitions ? 'none' : 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {sections.map(section => {
        const isActive = activeSection === section.id;
        const isHovered = hoveredId === section.id;
        return (
          <button
            key={section.id}
            onClick={() => onChangeSection(section.id)}
            onMouseEnter={() => setHoveredId(section.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px',
              padding: '0 16px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer',
              outline: 'none',
              background: isActive 
                ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
                : isHovered 
                  ? (isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)')
                  : 'transparent',
              color: isActive
                ? '#ffffff'
                : (isLight ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)'),
              transform: (!reduceTransitions && isHovered) ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: (isActive && !reduceTransitions) 
                ? `0 4px 12px ${accent.from}44` 
                : 'none',
              transition: reduceTransitions ? 'none' : 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: 'Manrope, sans-serif',
              fontWeight: isActive ? 800 : 600,
              fontSize: '13px',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
              {section.icon}
            </span>
            <span>
              {getSectionLabel(section.labelKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

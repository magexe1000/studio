import React, { useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, MotionValue } from 'motion/react';
import { useChordStore, ACCENT_COLORS, type AppKey } from '../store/useChordStore';
import { useT } from '../lib/useT';
import { APP_SECTIONS } from '../lib/studioAppNavigationRegistry';
import { useStudioPreferences } from '../hooks/useStudioPreferences';

interface DockItemProps {
  id: string;
  label: string;
  icon: string;
  isActive: boolean;
  accent: any;
  isLight: boolean;
  reduceMotion: boolean;
  mouseX: MotionValue<number>;
  onClick: () => void;
}

function DockItem({
  id,
  label,
  icon,
  isActive,
  accent,
  isLight,
  reduceMotion,
  mouseX,
  onClick,
}: DockItemProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Proximity magnification logic
  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  // Scale item width/height from 46px to 72px based on distance (range: -150px to 150px)
  const sizeTransform = useTransform(distance, [-150, 0, 150], [46, 72, 46]);
  const size = useSpring(sizeTransform, {
    mass: 0.1,
    stiffness: 160,
    damping: 15,
  });

  // Scale icon size proportionally from 20px to 32px
  const iconSizeTransform = useTransform(distance, [-150, 0, 150], [20, 32, 20]);
  const iconSize = useSpring(iconSizeTransform, {
    mass: 0.1,
    stiffness: 160,
    damping: 15,
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              bottom: '100%',
              marginBottom: '12px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(10, 10, 12, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'Manrope, sans-serif',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 1000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        ref={ref}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: reduceMotion ? 46 : size,
          height: reduceMotion ? 46 : size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
          background: isActive
            ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
            : isLight
              ? 'rgba(0, 0, 0, 0.05)'
              : 'rgba(255, 255, 255, 0.06)',
          color: isActive
            ? '#ffffff'
            : isLight
              ? 'rgba(0, 0, 0, 0.7)'
              : 'rgba(255, 255, 255, 0.7)',
          boxShadow: (isActive && !reduceMotion)
            ? `0 6px 20px ${accent.from}55, inset 0 1.5px 0 rgba(255,255,255,0.3)`
            : 'none',
          transformOrigin: 'bottom center',
          transition: reduceMotion
            ? 'none'
            : 'background-color 200ms ease, color 200ms ease, transform 150ms ease',
        }}
        whileHover={reduceMotion ? {} : { y: -6 }}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
      >
        <motion.span
          className="material-symbols-outlined"
          style={{
            fontSize: reduceMotion ? 20 : iconSize,
            fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          {icon}
        </motion.span>
      </motion.button>
    </div>
  );
}

export default function WebAppSectionDock({
  app,
  activeSection,
  onChangeSection,
}: {
  app: string;
  activeSection: string;
  onChangeSection: (sectionId: any) => void;
}) {
  const { settings } = useChordStore();
  const { preferences } = useStudioPreferences();
  const t = useT();

  const mouseX = useMotionValue(Infinity);

  const sections = APP_SECTIONS[app];
  if (!sections || sections.length === 0) return null;

  // If dock is disabled in preferences, don't render it
  if (!preferences.showWebAppDock) return null;

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
    ? 'rgba(4, 4, 4, 0.9)'
    : isLight
      ? 'rgba(255, 255, 255, 0.45)'
      : 'rgba(15, 15, 20, 0.65)';

  const reduceMotion = preferences.reduceMotion;

  return (
    <motion.div
      onMouseMove={(e) => {
        if (!reduceMotion) mouseX.set(e.pageX);
      }}
      onMouseLeave={() => {
        if (!reduceMotion) mouseX.set(Infinity);
      }}
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        padding: '10px 14px',
        gap: '12px',
        borderRadius: '24px',
        background: amoledBg,
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: `1px solid ${isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isLight
          ? '0 12px 36px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.02)'
          : '0 16px 48px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25)',
        height: '58px', // Constrain container height to prevent layout jump on scale
        transition: reduceMotion ? 'none' : 'background-color 300ms ease, border-color 300ms ease',
      }}
    >
      {sections.map((section) => (
        <DockItem
          key={section.id}
          id={section.id}
          label={getSectionLabel(section.labelKey)}
          icon={section.icon}
          isActive={activeSection === section.id}
          accent={accent}
          isLight={isLight}
          reduceMotion={reduceMotion}
          mouseX={mouseX}
          onClick={() => onChangeSection(section.id)}
        />
      ))}
    </motion.div>
  );
}

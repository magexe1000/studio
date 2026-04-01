import { useEffect, useRef, useState } from 'react';
import { useChordStore, ACCENT_COLORS } from './store/useChordStore';
import LibraryPanel from './panels/LibraryPanel';
import ChordPanel from './panels/ChordPanel';
import SettingsPanel from './panels/SettingsPanel';
import SongsPanel from './panels/SongsPanel';
import BottomNav from './components/BottomNav';
import { setNavHidden } from './lib/navScroll';

// Ordered left-to-right (matches nav order) — used to compute slide direction
const NAV_ORDER = ['songs', 'library', 'chord', 'settings'] as const;
const ALL_PANELS = ['library', 'chord', 'songs', 'settings'] as const;

export default function App() {
  const { activePanel, settings, setActivePanel } = useChordStore();

  // On first mount, jump to the user's preferred start tab
  useEffect(() => {
    const tab = settings.defaultTab ?? 'library';
    if (tab !== 'library') setActivePanel(tab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which panel is fully visible (the "live" one)
  const [visiblePanel, setVisiblePanel] = useState(activePanel);
  // Which panel is animating out
  const [exitingPanel, setExitingPanel] = useState<string | null>(null);
  // Direction: 'right' = entering panel comes from the right
  const [slideDir, setSlideDir] = useState<'right' | 'left'>('right');

  const prevPanel = useRef(activePanel);
  const accent    = ACCENT_COLORS[settings.accentColor];

  // Always show the nav when switching panels — prevents it staying hidden
  // on a non-scrollable panel (e.g. Songs with no songs added yet)
  useEffect(() => {
    setNavHidden(false);
  }, [visiblePanel]);

  // Apply CSS vars for accent color globally
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-from', accent.from);
    root.style.setProperty('--accent-to',   accent.to);
    root.style.setProperty('--accent-mid',  accent.mid);
  }, [settings.accentColor]);

  // AMOLED mode
  useEffect(() => {
    const root = document.documentElement;
    settings.amoledMode ? root.classList.add('amoled') : root.classList.remove('amoled');
  }, [settings.amoledMode]);

  // Theme mode (dark / light / system)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'theme-system');
    if (settings.theme === 'light') {
      root.classList.add('light');
    } else if (settings.theme === 'system') {
      root.classList.add('theme-system');
    }
    // 'dark' is the default — no class needed
  }, [settings.theme]);

  // Animation speed → root data-attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-anim', settings.animationSpeed);
  }, [settings.animationSpeed]);

  // Font size
  useEffect(() => {
    const root = document.documentElement;
    const sizes = {
      small:  { base: '13px', sm: '11px', xs: '9px',  lg: '16px', xl: '20px', hero: '2.2rem' },
      medium: { base: '14px', sm: '12px', xs: '10px', lg: '18px', xl: '24px', hero: '2.8rem' },
      large:  { base: '16px', sm: '13px', xs: '11px', lg: '20px', xl: '26px', hero: '3.2rem' },
    };
    const s = sizes[settings.fontSize];
    root.style.setProperty('--font-base', s.base);
    root.style.setProperty('--font-sm',   s.sm);
    root.style.setProperty('--font-xs',   s.xs);
    root.style.setProperty('--font-lg',   s.lg);
    root.style.setProperty('--font-xl',   s.xl);
    root.style.setProperty('--font-hero', s.hero);
  }, [settings.fontSize]);

  // Display density
  useEffect(() => {
    const root = document.documentElement;
    const d = {
      compact:     { pad: '10px', rowPad: '10px 20px', gap: '8px',  cardGap: '6px'  },
      comfortable: { pad: '16px', rowPad: '14px 20px', gap: '12px', cardGap: '10px' },
      spacious:    { pad: '22px', rowPad: '20px 24px', gap: '18px', cardGap: '16px' },
    }[settings.displayDensity];
    root.style.setProperty('--density-pad',      d.pad);
    root.style.setProperty('--density-row-pad',  d.rowPad);
    root.style.setProperty('--density-gap',      d.gap);
    root.style.setProperty('--density-card-gap', d.cardGap);
  }, [settings.displayDensity]);

  // Panel transition with slide direction
  const durMs = settings.animationSpeed === 'fast' ? 160 : settings.animationSpeed === 'reduced' ? 0 : 300;

  useEffect(() => {
    if (activePanel === prevPanel.current) return;

    const prevIdx = NAV_ORDER.indexOf(prevPanel.current as typeof NAV_ORDER[number]);
    const nextIdx = NAV_ORDER.indexOf(activePanel as typeof NAV_ORDER[number]);
    const dir: 'right' | 'left' = nextIdx >= prevIdx ? 'right' : 'left';

    setSlideDir(dir);
    setExitingPanel(prevPanel.current);
    setVisiblePanel(activePanel);
    prevPanel.current = activePanel;

    const t = setTimeout(() => setExitingPanel(null), durMs + 20);
    return () => clearTimeout(t);
  }, [activePanel, durMs]);

  return (
    <div
      className="flex flex-col h-[100dvh] w-full overflow-hidden select-none app-bg"
      style={{
        position: 'relative',
        '--panel-dur': `${durMs}ms`,
      } as React.CSSProperties}
    >
      <div style={{ paddingTop: 'env(safe-area-inset-top)', background: 'var(--app-bg)' }} className="flex-none" />

      {/* Panel container */}
      <div className="flex-1 overflow-hidden relative">
        {ALL_PANELS.map(panel => {
          const isVisible  = visiblePanel === panel;
          const isExiting  = exitingPanel === panel;
          const isEntering = isVisible && exitingPanel !== null;

          // Determine CSS animation class
          let animClass = '';
          if (isEntering) animClass = slideDir === 'right' ? 'panel-enter-right' : 'panel-enter-left';
          else if (isExiting) animClass = slideDir === 'right' ? 'panel-exit-left' : 'panel-exit-right';

          if (!isVisible && !isExiting) {
            // Fully hidden — not in the animation at all
            return (
              <div
                key={panel}
                style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
              >
                {panel === 'library'  && <LibraryPanel />}
                {panel === 'chord'    && <ChordPanel />}
                {panel === 'songs'    && <SongsPanel />}
                {panel === 'settings' && <SettingsPanel />}
              </div>
            );
          }

          return (
            <div
              key={panel}
              className={animClass}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: isExiting && !animClass ? 0 : undefined,
                pointerEvents: isVisible && !isExiting ? 'auto' : 'none',
              }}
            >
              {panel === 'library'  && <LibraryPanel />}
              {panel === 'chord'    && <ChordPanel />}
              {panel === 'songs'    && <SongsPanel />}
              {panel === 'settings' && <SettingsPanel />}
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}

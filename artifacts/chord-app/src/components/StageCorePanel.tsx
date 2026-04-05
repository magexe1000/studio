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
    const pill = doc?.getElementById('sc-nav-pill');
    if (pill) {
      pill.style.background = `linear-gradient(135deg, ${from}, ${to})`;
      pill.style.boxShadow  = `0 2px 18px rgba(${r},${g},${b},0.35)`;
    }
  } catch {}
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
      win?.updateCanvasBg?.('#0e0e0e');
    }
  } catch {}
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
  } catch {}
}

const HIDE_IFRAME_UI = `
  #sc-fab-btn { opacity: 0 !important; pointer-events: none !important; }
  #sc-fab-wrap { bottom: 14px !important; right: 14px !important; }
  #mobile-nav-bar { opacity: 0 !important; pointer-events: none !important; }
`;

export default function StagexPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const { settings } = useChordStore();
  const [curView, setCurView] = useState<string>('Editor');

  /* ── Glassmorphism bottom nav state ─────────────────────── */
  const stageNavRef    = useRef<HTMLDivElement | null>(null);
  const stageBtnRefs   = useRef<(HTMLButtonElement | null)[]>([]);
  const prevTabRef     = useRef(0);
  const stageStretchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stagePill, setStagePill] = useState<{ left: number; right: number; ready: boolean }>({ left: 0, right: 0, ready: false });
  const [pressedTab, setPressedTab] = useState<string | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [stageNavHidden, setStageNavHidden] = useState(false);
  const [landscapeNavHidden, setLandscapeNavHidden] = useState(false);
  const [propPanelOpen, setPropPanelOpen] = useState(false);

  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: landscape) and (max-width: 960px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape) and (max-width: 960px)');
    const handler = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches);
      if (!e.matches) setLandscapeNavHidden(false);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const stageVis  = settings.perApp?.stage ?? { theme: 'dark' as const, accentColor: 'blue' as const, amoledMode: false };
  const accentKey = (stageVis.accentColor ?? settings.accentColor ?? 'blue') as keyof typeof ACCENT_COLORS;
  const accent    = ACCENT_COLORS[accentKey] ?? ACCENT_COLORS.blue;
  const isLight   = stageVis.theme === 'light';
  const isAmoled  = stageVis.amoledMode;

  const iframeSrc = useRef(
    `/stage-core/index.html#${isLight ? 'light' : 'dark'},${encodeURIComponent(accent.from)},${encodeURIComponent(accent.to)},${isAmoled ? '1' : '0'}`
  ).current;
  const stageBg   = isAmoled ? (isLight ? '#ffffff' : '#000000') : isLight ? '#f2f1ef' : '#0e0e0e';
  const stageHdr  = isAmoled ? (isLight ? '#ffffff' : '#000000') : isLight ? '#f2f1ef' : '#0e0e0e';

  const showBack = curView === 'Rider' || curView === 'Setlist' || curView === 'Gear' || curView === 'Members';

  const lastCallTime = useRef(0);
  const callIframe = useCallback((fn: string, arg?: string) => {
    const now = Date.now();
    if (now - lastCallTime.current < 200) return;
    lastCallTime.current = now;
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const win = iframe.contentWindow as Record<string, unknown> | null;
      const f = win?.[fn];
      if (typeof f === 'function') {
        arg !== undefined ? (f as (a: string) => void)(arg) : (f as () => void)();
        return;
      }
    } catch {}
    try {
      iframe.contentWindow?.postMessage({ type: 'sc-call', fn, arg }, window.location.origin);
    } catch {}
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      iframeReady.current = true;
      try { iframe.contentWindow?.postMessage('stage-core-ping', window.location.origin); } catch {}
      injectAccentVars(iframe, accent.from, accent.to);
      injectTheme(iframe, stageVis.theme ?? 'dark');
      injectAmoled(iframe, isAmoled);
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          let s = doc.getElementById('react-parent-overrides');
          if (!s) {
            s = doc.createElement('style');
            s.id = 'react-parent-overrides';
            s.textContent = HIDE_IFRAME_UI;
            doc.head.appendChild(s);
          }
          if (!doc.getElementById('sc-scroll-spy')) {
            const scr = doc.createElement('script');
            scr.id = 'sc-scroll-spy';
            scr.textContent = `(function(){
              var ly=0;
              function h(e){
                var t=e.target;
                if(t&&t.closest&&t.closest('#bottom-toolbar,#properties-panel'))return;
                var y=t.scrollTop;
                if(typeof y!=='number')return;
                if(y<30){window.parent.postMessage({type:'sc-scroll-dir',down:false},window.location.origin);ly=y;return;}
                var dy=y-ly;
                if(Math.abs(dy)<6)return;
                window.parent.postMessage({type:'sc-scroll-dir',down:dy>0},window.location.origin);
                ly=y;
              }
              document.addEventListener('scroll',h,{passive:true,capture:true});
            })();`;
            doc.body.appendChild(scr);
          }
        }
      } catch {}
      try {
        (iframe.contentWindow as StageWin).__onViewChange = (view: string) => {
          // 'Assistant' is the internal name for the Preferences view
          setCurView(view === 'Assistant' ? 'Preferences' : view);
        };
      } catch {}
    };
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, [accent.from, accent.to, stageVis.theme, isAmoled]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'sc-dial-state') setFabOpen(!!e.data.open);
      if (e.data?.type === 'sc-scroll-dir') setStageNavHidden(!!e.data.down);
      if (e.data?.type === 'sc-prop-state') setPropPanelOpen(e.data.state === 'open' || e.data.state === 'peek');
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    injectAccentVars(iframe, accent.from, accent.to);
    injectTheme(iframe, stageVis.theme ?? 'dark');
  }, [accent.from, accent.to, stageVis.theme]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    injectAmoled(iframe, isAmoled);
  }, [isAmoled]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (doc) {
        const ls = doc.getElementById('landscape-overrides');
        if (ls) ls.remove();
      }
    } catch {}
    try {
      iframe.contentWindow?.postMessage({ type: 'sc-landscape', landscape: isLandscape }, window.location.origin);
    } catch {}
  }, [isLandscape]);

  useEffect(() => {
    const handler = (): boolean => {
      try { return (iframeRef.current?.contentWindow as StageWin)?.stageGoBack?.() ?? false; }
      catch { return false; }
    };
    setBackHandler(handler);
    return () => setBackHandler(null);
  }, []);

  const collapseHeader = curView === 'Export' || (isLandscape && curView === 'Editor');
  const isLandscapeEditor = isLandscape && curView === 'Editor';

  const navTabs: { view: string; label: string; icon: string }[] = [
    { view: 'Editor', label: 'STAGE', icon: 'grid_view' },
    { view: 'Setup', label: 'SETUP', icon: 'folder_open' },
    { view: 'Preferences', label: 'PREFERENCES', icon: 'tune' },
  ];

  const isTabActive = (view: string) => {
    if (view === 'Editor') return curView === 'Editor';
    if (view === 'Setup') return ['SetupHub','Rider','Setlist','Gear','Members'].includes(curView);
    if (view === 'Preferences') return curView === 'Preferences';
    return false;
  };

  const handleNavTap = useCallback((view: string) => {
    setStageNavHidden(false);
    if (view === 'Setup') {
      callIframe('switchView', 'SetupHub');
    } else {
      callIframe('switchView', view);
    }
  }, [callIframe]);

  const handleFabTap = useCallback(() => {
    callIframe('toggleSCDial');
  }, [callIframe]);

  /* ── Glassmorphism pill bg ──────────────────────────────── */
  const stagePillBg = isAmoled
    ? 'rgba(4,4,4,0.88)'
    : isLight
      ? 'rgba(240,240,242,0.82)'
      : 'rgba(26,26,30,0.82)';

  /* ── Pill measurement helpers ───────────────────────────── */
  const measureStageBtn = (idx: number) => {
    const btn = stageBtnRefs.current[idx];
    const nav = stageNavRef.current;
    if (!btn || !nav) return null;
    const nr = nav.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return { left: br.left - nr.left, right: br.right - nr.left };
  };

  /* Init pill on mount */
  useEffect(() => {
    const idx = navTabs.findIndex(t => isTabActive(t.view));
    const m = measureStageBtn(idx >= 0 ? idx : 0);
    if (m) setStagePill({ left: m.left, right: m.right, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Animate pill when view changes */
  useEffect(() => {
    const newIdx = navTabs.findIndex(t => isTabActive(t.view));
    if (newIdx < 0) return;
    const oldIdx = prevTabRef.current;
    if (newIdx === oldIdx) return;
    prevTabRef.current = newIdx;
    const newM = measureStageBtn(newIdx);
    if (!newM) return;
    if (stageStretchRef.current) {
      clearTimeout(stageStretchRef.current);
      stageStretchRef.current = null;
      setStagePill(p => ({ ...p, left: newM.left, right: newM.right }));
      return;
    }
    if (newIdx > oldIdx) {
      setStagePill(p => ({ ...p, right: newM.right }));
      stageStretchRef.current = setTimeout(() => {
        setStagePill(p => ({ ...p, left: newM.left }));
        stageStretchRef.current = null;
      }, 70);
    } else {
      setStagePill(p => ({ ...p, left: newM.left }));
      stageStretchRef.current = setTimeout(() => {
        setStagePill(p => ({ ...p, right: newM.right }));
        stageStretchRef.current = null;
      }, 70);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curView]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: stageBg, transition: 'background 180ms ease' }}>

      <div style={{
        flexShrink: 0,
        overflow: collapseHeader ? 'hidden' : 'visible',
        height: collapseHeader ? 0 : 'calc(env(safe-area-inset-top) + 52px)',
        transition: 'height 260ms cubic-bezier(0.4,0,0.2,1)',
      }}>
      <div style={{ height: 'env(safe-area-inset-top)', background: 'transparent', flexShrink: 0 }} />

      <div style={{
        flexShrink: 0,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        background: stageHdr,
        transition: 'background 180ms ease',
        gap: showBack ? 8 : 0,
        position: 'relative',
      }}>

        <div style={{
          overflow: 'hidden',
          flexShrink: 0,
          width: showBack ? '46px' : '0px',
          opacity: showBack ? 1 : 0,
          transition: 'width 300ms cubic-bezier(0.34,1.1,0.64,1), opacity 200ms ease',
        }}>
          <button
            onClick={() => callIframe('stageGoBack')}
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

        <AppModeMenuLogo color={isLight ? 'rgba(0,0,0,0.80)' : 'rgba(255,255,255,0.90)'} size={13} />

        <div style={{ flex: 1 }} />

        {curView === 'Editor' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>

            {(
              [
                { label: 'Measure', icon: 'straighten',  fn: () => callIframe('scActivateMeasure')   },
                { label: 'Zones',   icon: 'grid_4x4',    fn: () => callIframe('scToggleZones')       },
                { label: 'Length',  icon: 'cable',        fn: () => callIframe('scToggleCableLength') },
                { label: 'History', icon: 'history',      fn: () => callIframe('openTimelinePanel')   },
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

            <button
              onClick={() => callIframe('openPresetsPanel')}
              title="Presets"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32,
                background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
                color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(180,185,200,0.75)',
                border: `1px solid ${isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>save</span>
            </button>

            <button
              onClick={() => callIframe('switchView', 'Export')}
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
      </div>

      <div style={{ position: 'relative', flex: 1 }}>
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Stagex"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', display: 'block', backgroundColor: stageBg }}
          allow="clipboard-write"
        />

        {curView === 'Editor' && (
          <button
            onClick={handleFabTap}
            onTouchEnd={(e) => { e.preventDefault(); handleFabTap(); }}
            aria-label="Add instrument"
            style={{
              position: 'absolute',
              bottom: isLandscapeEditor ? 14 : 90,
              right: 14,
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              border: 'none',
              zIndex: 20,
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              display: 'flex',
              opacity: (isLandscapeEditor && propPanelOpen) ? 0 : (stageNavHidden && !isLandscapeEditor) ? 0 : 1,
              pointerEvents: (isLandscapeEditor && propPanelOpen) ? 'none' as const : 'auto' as const,
              visibility: (isLandscapeEditor && propPanelOpen) ? 'hidden' as const : 'visible' as const,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: fabOpen
                ? `0 6px 32px ${accent.from}99, 0 3px 12px rgba(0,0,0,0.4)`
                : `0 4px 24px ${accent.from}80, 0 2px 8px rgba(0,0,0,0.3)`,
              padding: 0,
              transform: fabOpen ? 'rotate(45deg) scale(1.08)' : 'rotate(0deg) scale(1)',
              transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, opacity 420ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 24, lineHeight: 1, transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>add</span>
          </button>
        )}

        {isLandscapeEditor && landscapeNavHidden && (
          <button
            onClick={() => setLandscapeNavHidden(false)}
            aria-label="Show navigation"
            title="Show navigation"
            style={{
              position: 'absolute',
              bottom: 'max(4px, env(safe-area-inset-bottom))',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 48,
              height: 26,
              borderRadius: '12px 12px 0 0',
              background: stagePillBg,
              border: isLight ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.10)',
              borderBottom: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 10,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(160,160,180,0.8)', lineHeight: 1 }}>expand_less</span>
          </button>
        )}

        {isLandscapeEditor && !landscapeNavHidden && (
          <button
            onClick={() => setLandscapeNavHidden(true)}
            aria-label="Hide navigation"
            title="Hide navigation"
            style={{
              position: 'absolute',
              bottom: `calc(max(10px, env(safe-area-inset-bottom)) + ${isLandscapeEditor ? 34 : 52}px)`,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 48,
              height: 26,
              borderRadius: '12px 12px 0 0',
              background: stagePillBg,
              border: isLight ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.10)',
              borderBottom: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 11,
              transition: 'opacity 300ms ease',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(160,160,180,0.8)', lineHeight: 1 }}>expand_more</span>
          </button>
        )}

        {/* ── Glassmorphism bottom nav — matches Chordex BottomNav ── */}
        <div
          ref={stageNavRef}
          style={{
            position: 'absolute',
            bottom: 'max(10px, env(safe-area-inset-bottom))',
            left: '50%',
            transform: `translateX(-50%) translateY(${(isLandscapeEditor ? landscapeNavHidden : stageNavHidden) ? '140%' : '0'})`,
            width: isLandscapeEditor ? '70%' : '90%',
            maxWidth: isLandscapeEditor ? 320 : 400,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: isLandscapeEditor ? '3px 6px' : '6px 8px',
            borderRadius: '2rem',
            border: isLight ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.10)',
            background: stagePillBg,
            boxShadow: isLight
              ? '0 8px 32px rgba(0,0,0,0.14), 0 1.5px 0 rgba(255,255,255,0.80) inset'
              : '0 12px 48px rgba(0,0,0,0.50), 0 1.5px 0 rgba(255,255,255,0.08) inset',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 10,
            overflow: 'hidden',
            transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1), transform 420ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >

          {/* Elastic sliding pill */}
          {stagePill.ready && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: isLandscapeEditor ? 2 : 4,
                left: stagePill.left,
                width: stagePill.right - stagePill.left,
                height: isLandscapeEditor ? 'calc(100% - 4px)' : 'calc(100% - 8px)',
                borderRadius: 9999,
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                boxShadow: `0 2px 18px ${accent.to}60`,
                pointerEvents: 'none',
                zIndex: 0,
                transition: [
                  'left  150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  'width 150ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                ].join(', '),
              }}
            />
          )}

          {/* Nav buttons */}
          {navTabs.map(({ view, label, icon }, i) => {
            const active  = isTabActive(view);
            const pressed = pressedTab === view;
            return (
              <button
                key={view}
                ref={el => { stageBtnRefs.current[i] = el; }}
                onPointerDown={() => setPressedTab(view)}
                onPointerUp={() => { setPressedTab(null); handleNavTap(view); }}
                onPointerLeave={() => setPressedTab(null)}
                onPointerCancel={() => setPressedTab(null)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isLandscapeEditor ? 1 : 4,
                  padding: isLandscapeEditor ? '4px 4px' : '8px 4px',
                  borderRadius: 9999,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: active ? '#fff' : (isLight ? 'rgba(0,0,0,0.4)' : 'var(--c-text-secondary, rgba(160,160,180,0.8))'),
                  position: 'relative',
                  zIndex: 1,
                  transform: pressed ? 'scale(0.91)' : 'scale(1)',
                  transition: 'color 130ms ease, transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                  WebkitFontSmoothing: 'antialiased',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: isLandscapeEditor ? 16 : 20, lineHeight: 1 }}>{icon}</span>
                <span style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 700,
                  fontSize: isLandscapeEditor ? '7.5px' : '9.5px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  WebkitFontSmoothing: 'antialiased',
                }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

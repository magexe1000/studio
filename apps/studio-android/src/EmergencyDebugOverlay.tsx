import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useChordStore, NATIVE_VERSION } from '@workspace/studio-core';

interface BlockerInfo {
  tag: string;
  id: string;
  className: string;
  zIndex: string;
  opacity: string;
  pointerEvents: string;
  visibility: string;
  display: string;
}

interface AutoCaptureEntry {
  timestamp: number;
  navigationPath: string;
  appMode: string;
  activeSubApp: string;
  blockerDetectionResult: string;
  domSummary: string;
  fullPayload: any;
}

// Global log interceptor setup
const LOG_LIMIT = 200;
const recentLogs: Array<{ type: 'log' | 'warn' | 'error'; category: string; msg: string; timestamp: number }> = [];

if (typeof window !== 'undefined' && !(window as any).__logsIntercepted) {
  (window as any).__logsIntercepted = true;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const categorize = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes('hub') || lower.includes('studiohub')) return 'Hub';
    if (lower.includes('chordex')) return 'Chordex';
    if (lower.includes('drumex')) return 'Drumex';
    if (lower.includes('stagex')) return 'Stagex';
    if (lower.includes('updater') || lower.includes('capgo')) return 'Updater';
    if (lower.includes('network') || lower.includes('fetch') || lower.includes('http') || lower.includes('cors') || lower.includes('firestore') || lower.includes('firebase')) return 'Network';
    return 'System';
  };

  const addLog = (type: 'log' | 'warn' | 'error', args: any[]) => {
    try {
      const msg = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch (_) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      const category = categorize(msg);
      recentLogs.push({
        type,
        category,
        msg,
        timestamp: Date.now()
      });
      if (recentLogs.length > LOG_LIMIT) {
        recentLogs.shift();
      }
    } catch (_) {}
  };

  console.log = (...args: any[]) => {
    originalLog.apply(console, args);
    addLog('log', args);
  };
  console.warn = (...args: any[]) => {
    originalWarn.apply(console, args);
    addLog('warn', args);
  };
  console.error = (...args: any[]) => {
    originalError.apply(console, args);
    addLog('error', args);
  };
}

// Black screen classification function
const classifyBlackScreen = (state: any): string => {
  if (document.getElementById('fake-black-screen-layer')) {
    return 'SIMULATED_BLACK_LAYER_ACTIVE';
  }
  
  if (state.appMode !== 'hub') {
    return 'UNKNOWN_BLACK_SCREEN';
  }

  const shell = state.hubShellFound;
  const root = state.hubRootFound;
  const content = state.hubContentFound;
  const nav = state.hubNavFound;
  const painted = state.hubActuallyPainted;

  if (!painted && !shell) {
    return 'HUB_ROOT_MISSING';
  }

  if (painted && !root) {
    return 'DIAGNOSTIC_SELECTOR_FALSE_POSITIVE';
  }

  const hubLayout = document.querySelector('.app-main-layout');
  if (hubLayout) {
    const style = window.getComputedStyle(hubLayout);
    const isHidden = style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0;
    if (isHidden) {
      return 'HUB_CONTENT_PRESENT_BUT_NOT_VISIBLE';
    }
  }

  const centerEl = state.blockers?.center;
  if (centerEl) {
    const tag = centerEl.tag;
    const id = centerEl.id;
    const cls = centerEl.className || '';
    const isHubElement = centerEl.isHub || id === 'hub-root' || cls.includes('hub') || cls.includes('app-main-layout') || tag === 'body' || tag === 'html';
    if (isHubElement) {
      return 'HUB_VISIBLE_BUT_BLACK_PAINT';
    } else if (cls.includes('subapp') || cls.includes('overlay') || cls.includes('backdrop') || cls.includes('modal') || cls.includes('chordex')) {
      return 'HUB_CONTENT_PRESENT_BUT_NOT_VISIBLE';
    }
  }

  if (painted && root && centerEl && (centerEl.tag === 'body' || centerEl.tag === 'html')) {
    return 'NATIVE_WEBVIEW_BLACK_LAYER';
  }

  return 'UNKNOWN_BLACK_SCREEN';
};

function getWebViewPipelineStatus(snap: any) {
  if (!snap) return { status: 'UNKNOWN', color: 'rgba(255,255,255,0.4)', desc: 'No snapshot selected' };
  
  const root = snap.elements?.['root'] || snap.bounds?.['root'] || null;
  const rootExists = root ? !!root.exists : true;
  
  const appContainer = snap.elements?.['app-container'] || snap.bounds?.['app-container'] || null;
  const appContainerExists = appContainer ? !!appContainer.exists : false;
  
  const hub = snap.elements?.['hub-root'] || snap.bounds?.['hub-root'] || null;
  const hubMounted = !!hub?.exists;
  
  const renderAudit = snap.renderAudit || null;
  const hubAudit = renderAudit?.hub || null;
  
  const display = hubAudit?.display || snap.elements?.['hub-root']?.display || 'none';
  const visibility = hubAudit?.visibility || snap.elements?.['hub-root']?.visibility || 'hidden';
  const opacityVal = hubAudit?.opacity !== undefined ? hubAudit.opacity : snap.elements?.['hub-root']?.opacity;
  const opacity = parseFloat(opacityVal || '0');
  
  const domSaysVisible = hubMounted && display !== 'none' && visibility !== 'hidden' && opacity > 0.05;
  
  const probe = snap.visualProbe || null;
  const visuallyEmpty = !!probe?.allEmpty;
  
  const paintVerification = snap.paintVerification || snap.watchdogPaintVerification || null;
  const paintSaysBlack = paintVerification?.paintState === 'visually_black';
  
  if (rootExists && !appContainerExists) {
    return {
      status: 'ROOT_APP_TREE_MISSING',
      color: '#ef4444',
      desc: 'Root App Tree Missing: The outer React app shell (#root) exists but the root layout (.app-container) is unmounted or empty.'
    };
  }
  
  if (!hubMounted) {
    return {
      status: 'HUB_DOM_NOT_MOUNTED',
      color: '#ef4444',
      desc: 'Hub DOM Not Mounted: The layout container exists but the Hub DOM subtree is completely missing.'
    };
  }
  
  if (!domSaysVisible) {
    return {
      status: 'DOM_UNPAINTED',
      color: '#f59e0b',
      desc: `DOM Unpainted: Hub mounted but hidden via CSS (display: ${display}, visibility: ${visibility}, opacity: ${opacityVal}).`
    };
  }
  
  if (paintSaysBlack || (visuallyEmpty && !paintVerification)) {
    return {
      status: 'COMPOSITOR_FREEZE',
      color: '#ef4444',
      desc: 'WebView Compositor Freeze: Hub is fully mounted and visible in DOM/CSS, but pixel/canvas paint verification detects a black/empty screen. WebView is failing to repaint!'
    };
  }
  
  return {
    status: 'PIPELINE_OK',
    color: '#10b981',
    desc: 'Pipeline OK: Hub is visible in DOM and pixel probe detects active rendering.'
  };
}

export default function EmergencyDebugOverlay() {
  const isDebugModeEnabled = typeof window !== 'undefined' && (
    localStorage.getItem('studio_debug_mode') === 'true' ||
    (window as any).__studio_debug_mode === true
  );

  if (!isDebugModeEnabled) {
    return null;
  }

  const { settings, updateSettings } = useChordStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isPanicMenuOpen, setIsPanicMenuOpen] = useState(false);
  const [isBlackScreenSimulated, setIsBlackScreenSimulated] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'forensics' | 'nav_forensics' | 'failed_timeline' | 'blockers' | 'recovery' | 'captures' | 'dom'>('status');
  const [forensicCaptures, setForensicCaptures] = useState<any[]>([]);
  const [selectedForensicIdx, setSelectedForensicIdx] = useState<number>(0);
  const [lastSuccessfulForensic, setLastSuccessfulForensic] = useState<any>(null);
  const [lastFailedForensic, setLastFailedForensic] = useState<any>(null);
  const [lastFailedTimeline, setLastFailedTimeline] = useState<any>(null);
  const [repaintsLog, setRepaintsLog] = useState<any[]>([]);
  const [visualRepaintsLog, setVisualRepaintsLog] = useState<any[]>([]);
  const [nuclearRecoveriesLog, setNuclearRecoveriesLog] = useState<any[]>([]);
  const [leftSnapKey, setLeftSnapKey] = useState<string>('LEAVING_CHORDEX');
  const [rightSnapKey, setRightSnapKey] = useState<string>('T+2000ms');
  const [livePaintVerify, setLivePaintVerify] = useState<any>(null);
  const [verifyingPaint, setVerifyingPaint] = useState<boolean>(false);
  
  // Local state for live state updates
  const [tick, setTick] = useState(0);
  const [autoCaptures, setAutoCaptures] = useState<AutoCaptureEntry[]>([]);
  const [activeCaptureIdx, setActiveCaptureIdx] = useState<number | null>(null);
  const [hubRootMissingCapture, setHubRootMissingCapture] = useState<any>(null);
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null);
  const [portalKey, setPortalKey] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Overlay root watcher & auto-recreator
  useEffect(() => {
    const checkOverlayRoot = () => {
      let root = document.getElementById('livex-emergency-overlay-root');
      if (!root && typeof document !== 'undefined') {
        console.warn('Emergency overlay root missing! Re-creating...');
        root = document.createElement("div");
        root.id = "livex-emergency-overlay-root";
        root.style.position = "fixed";
        root.style.inset = "0";
        root.style.zIndex = "2147483647";
        root.style.isolation = "isolate";
        root.style.pointerEvents = "none";
        root.style.transform = "translateZ(0)";
        root.style.contain = "none";
        root.style.background = "transparent";
        document.body.appendChild(root);
      }
      if (root !== overlayRoot) {
        setOverlayRoot(root);
      }
    };
    
    checkOverlayRoot();
  }, [tick, overlayRoot]);

  // DBG Button exists check & portal key incrementer
  useEffect(() => {
    const root = document.getElementById('livex-emergency-overlay-root');
    if (root) {
      const btn = document.getElementById('livex-panic-dbg-button');
      if (!btn) {
        console.warn('DBG button missing from DOM! Auto-recreating debug portal...');
        setPortalKey(k => k + 1);
      }
    }
  }, [tick]);

  // Health check getter
  const getOverlayHealth = () => {
    const root = document.getElementById('livex-emergency-overlay-root');
    const btn = document.getElementById('livex-panic-dbg-button');
    const panel = document.getElementById('livex-emergency-panel');

    const rootExists = !!root;
    const dbgExists = !!btn;
    
    let dbgVisible = false;
    let dbgTopmost = false;
    
    if (btn) {
      const style = window.getComputedStyle(btn);
      dbgVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      
      try {
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const el = document.elementFromPoint(cx, cy);
        dbgTopmost = !!(el && (el === btn || btn.contains(el)));
      } catch (_) {}
    }

    let panelTopmost = false;
    if (panel) {
      try {
        const rect = panel.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const el = document.elementFromPoint(cx, cy);
        panelTopmost = !!(el && (el === panel || panel.contains(el)));
      } catch (_) {}
    }

    const childrenCount = root ? root.children.length : 0;

    return {
      overlayRootExists: rootExists,
      dbgButtonExists: dbgExists,
      dbgButtonVisible: dbgVisible,
      dbgButtonTopmost: dbgTopmost,
      panelTopmost,
      overlayChildrenCount: childrenCount
    };
  };

  // Health check registry on window
  useEffect(() => {
    (window as any).__emergencyOverlayHealthCheck = () => {
      const health = getOverlayHealth();
      const panel = document.getElementById("livex-emergency-panel");
      const elementsAbove: string[] = [];
      if (panel && !health.panelTopmost) {
        try {
          let curr = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
          while (curr && curr !== document.body && curr !== document.documentElement) {
            const style = window.getComputedStyle(curr);
            elementsAbove.push(`${curr.tagName.toLowerCase()}${curr.id ? '#' + curr.id : ''}${curr.className ? '.' + Array.from(curr.classList).join('.') : ''} (z-index: ${style.zIndex}, pointer-events: ${style.pointerEvents}, opacity: ${style.opacity})`);
            curr = curr.parentElement;
          }
        } catch (_) {}
      }
      return {
        ...health,
        elementsAbove
      };
    };
    
    return () => {
      delete (window as any).__emergencyOverlayHealthCheck;
    };
  }, []);

  const toggleSimulateBlackScreen = () => {
    const existing = document.getElementById("fake-black-screen-layer");
    if (existing) {
      existing.remove();
      setIsBlackScreenSimulated(false);
      setToastMsg("Simulated black screen removed.");
      setTimeout(() => setToastMsg(null), 2000);
    } else {
      const div = document.createElement("div");
      div.id = "fake-black-screen-layer";
      div.style.position = "fixed";
      div.style.inset = "0";
      div.style.background = "#000000";
      div.style.zIndex = "999999";
      div.style.pointerEvents = "all";
      document.body.appendChild(div);
      setIsBlackScreenSimulated(true);
      setToastMsg("Simulated black screen active!");
      setTimeout(() => setToastMsg(null), 2000);
    }
  };

  // ── GESTURE AND TRIGGER LOGIC ──────────────────────────────────────────
  useEffect(() => {
    let tapCount = 0;
    let lastTapTime = 0;
    const handleTap = (e: MouseEvent | TouchEvent) => {
      const now = Date.now();
      if (now - lastTapTime > 400) {
        tapCount = 1;
      } else {
        tapCount++;
      }
      lastTapTime = now;
      if (tapCount >= 3) {
        tapCount = 0;
        setIsOpen(prev => !prev);
      }
    };

    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    const handlePointerDown = (e: PointerEvent) => {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        setIsOpen(prev => !prev);
      }, 1500);
    };

    const handlePointerUp = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    window.addEventListener('click', handleTap);
    window.addEventListener('touchend', handleTap as any);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('pointermove', handlePointerUp);

    return () => {
      window.removeEventListener('click', handleTap);
      window.removeEventListener('touchend', handleTap as any);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerUp);
    };
  }, []);

  // Live state polling
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Global window hook and failed navigation timeline auto-open on startup
  useEffect(() => {
    (window as any).__openEmergencyOverlay = (targetTab?: string) => {
      setIsOpen(true);
      if (targetTab) {
        setActiveTab(targetTab as any);
      }
    };

    try {
      const unviewed = localStorage.getItem('studio_failed_navigation_unviewed') === 'true';
      if (unviewed) {
        localStorage.setItem('studio_failed_navigation_unviewed', 'false');
        setIsOpen(true);
        setActiveTab('failed_timeline');
      }
    } catch (e) {
      console.error('Failed to process studio_failed_navigation_unviewed', e);
    }

    return () => {
      delete (window as any).__openEmergencyOverlay;
    };
  }, []);

  // Load Auto Captures and HUB_ROOT_MISSING_CAPTURE from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studio_auto_captures');
      if (stored) {
        setAutoCaptures(JSON.parse(stored));
      }
      const missing = localStorage.getItem('HUB_ROOT_MISSING_CAPTURE');
      if (missing) {
        setHubRootMissingCapture(JSON.parse(missing));
      } else {
        setHubRootMissingCapture(null);
      }

      // Load Navigation Forensics telemetry
      const forensicsStored = localStorage.getItem('studio_forensic_captures');
      if (forensicsStored) {
        setForensicCaptures(JSON.parse(forensicsStored));
      } else {
        setForensicCaptures([]);
      }
      
      const lastSuccess = localStorage.getItem('studio_forensic_last_successful');
      if (lastSuccess) {
        setLastSuccessfulForensic(JSON.parse(lastSuccess));
      } else {
        setLastSuccessfulForensic(null);
      }

      const lastFailed = localStorage.getItem('studio_forensic_last_failed');
      if (lastFailed) {
        setLastFailedForensic(JSON.parse(lastFailed));
      } else {
        setLastFailedForensic(null);
      }

      const timelineStored = localStorage.getItem('studio_last_failed_navigation_timeline');
      if (timelineStored) {
        setLastFailedTimeline(JSON.parse(timelineStored));
      } else {
        setLastFailedTimeline(null);
      }

      const repaints = localStorage.getItem('studio_repaints_log');
      if (repaints) {
        setRepaintsLog(JSON.parse(repaints));
      } else {
        setRepaintsLog([]);
      }

      const visRepaints = localStorage.getItem('studio_visual_repaints_log');
      if (visRepaints) {
        setVisualRepaintsLog(JSON.parse(visRepaints));
      } else {
        setVisualRepaintsLog([]);
      }

      const nucRecoveries = localStorage.getItem('studio_nuclear_recoveries_log');
      if (nucRecoveries) {
        setNuclearRecoveriesLog(JSON.parse(nucRecoveries));
      } else {
        setNuclearRecoveriesLog([]);
      }
    } catch (_) {}
  }, [isOpen, tick]);

  // ── CAPTURE & TELEMETRY FUNCTIONS ───────────────────────────────────────
  const getComputedStylesSafe = (el: Element | null) => {
    if (!el) return null;
    try {
      return window.getComputedStyle(el);
    } catch (_) {
      return null;
    }
  };

  const getElementBlockerInfo = (el: Element | null): BlockerInfo => {
    if (!el) {
      return { tag: 'none', id: '', className: '', zIndex: 'N/A', opacity: 'N/A', pointerEvents: 'N/A', visibility: 'N/A', display: 'N/A' };
    }
    const style = getComputedStylesSafe(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      className: el.className || '',
      zIndex: style?.zIndex || 'auto',
      opacity: style?.opacity || '1',
      pointerEvents: style?.pointerEvents || 'auto',
      visibility: style?.visibility || 'visible',
      display: style?.display || 'block'
    };
  };

  const getVisualBlockers = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const coords = {
      center: [w / 2, h / 2],
      top: [w / 2, h * 0.1],
      bottom: [w / 2, h * 0.9],
      left: [w * 0.1, h / 2],
      right: [w * 0.9, h / 2]
    };

    const blockers: Record<string, BlockerInfo & { isHub: boolean }> = {};
    for (const [key, pt] of Object.entries(coords)) {
      try {
        const el = document.elementFromPoint(pt[0], pt[1]);
        const info = getElementBlockerInfo(el);
        const isHub = !!el?.closest?.('[data-livex-hub-root="true"]') || !!el?.closest?.('.app-main-layout');
        blockers[key] = { ...info, isHub };
      } catch (_) {
        blockers[key] = {
          tag: 'error', id: '', className: '', zIndex: 'error', opacity: 'error', pointerEvents: 'error', visibility: 'error', display: 'error', isHub: false
        };
      }
    }
    return blockers;
  };

  const getNavigationTrace = () => {
    const trace = (window as any).__navigationTraceHistory || [];
    return trace;
  };

  const getDiagnosticsPayload = () => {
    const statePayload = (window as any).__captureBlackScreenState?.() || {};

    const currentAppMode = settings.appMode || 'hub';
    const hubLayout = document.querySelector('.app-main-layout');
    const hubMounted = !!hubLayout;
    let hubVisible = false;
    let hubOpacity = 'unknown';
    let hubTransform = 'unknown';
    if (hubLayout) {
      const style = window.getComputedStyle(hubLayout);
      hubVisible = style.display !== 'none' && style.visibility !== 'hidden';
      hubOpacity = style.opacity;
      hubTransform = style.transform;
    }

    const hubShellFound = statePayload.hubShellFound !== undefined ? statePayload.hubShellFound : !!document.querySelector('.app-container.app-mode-hub .app-main-layout');
    const hubRootFound = statePayload.hubRootFound !== undefined ? statePayload.hubRootFound : !!document.querySelector('[data-livex-hub-root="true"]');
    const hubContentFound = statePayload.hubContentFound !== undefined ? statePayload.hubContentFound : (!!document.querySelector('[data-livex-hub-content="true"]') || !!document.querySelector('.gb-wrap'));
    const hubNavFound = statePayload.hubNavFound !== undefined ? statePayload.hubNavFound : !!document.querySelector('nav.glass-nav');
    const hubActuallyPainted = statePayload.hubActuallyPainted !== undefined ? statePayload.hubActuallyPainted : (hubRootFound || hubContentFound || hubNavFound);

    const subappWrapper = document.querySelector('.sc-subapp-wrapper');
    const subappWrapperMounted = !!subappWrapper;
    let subappWrapperOpacity = 'unknown';
    let subappWrapperZIndex = 'unknown';
    let subappWrapperPointerEvents = 'unknown';
    if (subappWrapper) {
      const style = window.getComputedStyle(subappWrapper);
      subappWrapperOpacity = style.opacity;
      subappWrapperZIndex = style.zIndex;
      subappWrapperPointerEvents = style.pointerEvents;
    }

    const suspenseActive = !!document.querySelector('.smart-loading, .fallback-skeleton, .studio-accent-loader, .studio-shimmer, [class*="skeleton"]');
    const errorBoundaryActive = !!document.querySelector('.error-boundary, [class*="error-boundary"]');

    const trace = getNavigationTrace();
    const lastAction = statePayload.lastNavigationAction || (trace.length > 0 ? trace[trace.length - 1] : null);

    const blockers = getVisualBlockers();

    return {
      timestamp: Date.now(),
      appMode: currentAppMode,
      activeSubApp: currentAppMode !== 'hub' ? currentAppMode : 'none',
      transitionActive: (window as any).studioTransitionActive || false,
      stableKey: statePayload.stableKey || (window as any).__studioStableKey || "none",
      hubShellFound,
      hubRootFound,
      hubContentFound,
      hubNavFound,
      hubActuallyPainted,
      hub: {
        mounted: hubMounted,
        visible: hubVisible,
        opacity: hubOpacity,
        transform: hubTransform,
        rootFound: hubRootFound,
      },
      subappWrapper: {
        mounted: subappWrapperMounted,
        opacity: subappWrapperOpacity,
        zIndex: subappWrapperZIndex,
        pointerEvents: subappWrapperPointerEvents
      },
      reactState: {
        suspenseFallbackActive: suspenseActive,
        errorBoundaryActive: errorBoundaryActive
      },
      lastNavigationAction: lastAction,
      navigationTrace: trace,
      blockers
    };
  };

  // Build a simplified DOM tree of visible elements
  const generateSimplifiedDOMTree = () => {
    let output = '';
    const walk = (el: Element, depth: number) => {
      // Avoid printing the large debugger panels to keep the output readable
      if (el.id === 'livex-emergency-panel' || el.closest('#livex-emergency-panel') || 
          el.id === 'livex-panic-menu' || el.closest('#livex-panic-menu')) {
        return;
      }

      const style = window.getComputedStyle(el);
      const isKeyElement = el.id === 'livex-emergency-overlay-root' || 
                            el.id === 'livex-panic-dbg-button' || 
                            el.id === 'fake-black-screen-layer' || 
                            el.classList.contains('app-container') || 
                            el.classList.contains('app-main-layout') || 
                            el.classList.contains('gb-wrap') || 
                            el.tagName.toLowerCase() === 'nav';
      
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0.01;
      if (!isVisible && !isKeyElement) return;

      const rect = el.getBoundingClientRect();
      const hasDimensions = rect.width > 0 && rect.height > 0;
      if (!hasDimensions && !isKeyElement) return;

      const indent = '  '.repeat(depth);
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = el.className ? `.${Array.from(el.classList).join('.')}` : '';
      
      // Grab all data attributes
      const dataAttrs: string[] = [];
      const attrs = el.attributes;
      for (let i = 0; i < attrs.length; i++) {
        if (attrs[i].name.startsWith('data-')) {
          dataAttrs.push(`${attrs[i].name}="${attrs[i].value}"`);
        }
      }
      const dataStr = dataAttrs.length > 0 ? ` [${dataAttrs.join(', ')}]` : '';

      // Computed styles
      const bg = style.backgroundColor;
      const fg = style.color;
      const op = style.opacity;
      const vis = style.visibility;
      const disp = style.display;
      const zi = style.zIndex;
      const pe = style.pointerEvents;
      
      const rectStr = `[rect:${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}]`;
      const styleStr = ` [bg:${bg}] [fg:${fg}] [op:${op}] [vis:${vis}] [disp:${disp}] [zi:${zi}] [pe:${pe}]`;

      // Text summary (first 30 characters of innerText for key text nodes)
      let textSummary = '';
      if (el.children.length === 0 && (el as HTMLElement).innerText?.trim()) {
        const txt = (el as HTMLElement).innerText.trim().replace(/\n/g, ' ');
        textSummary = ` "${txt.length > 30 ? txt.substring(0, 30) + '...' : txt}"`;
      }

      output += `${indent}${tag}${id}${classes}${rectStr}${dataStr}${styleStr}${textSummary}\n`;

      for (let i = 0; i < el.children.length; i++) {
        walk(el.children[i], depth + 1);
      }
    };

    if (document.body) {
      walk(document.body, 0);
    }
    return output;
  };

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setToastMsg(`${label} Copied`);
      setTimeout(() => setToastMsg(null), 1500);
    } catch (e) {
      setToastMsg(`Failed to copy: ${e}`);
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  // ── COPY DIAGNOSTIC ACTIONS ──────────────────────────────────────────────
  const copyEverything = () => {
    const payload = {
      timestamp: Date.now(),
      runtimeState: getDiagnosticsPayload(),
      navigationDiagnostics: (window as any).__navigationDiagnostics || null,
      lastBlackScreenCapture: (window as any).HUB_ROOT_MISSING_CAPTURE || null,
      domSnapshot: generateSimplifiedDOMTree(),
      visualBlockerReport: getVisualBlockers(),
      overlayHealthCheck: getOverlayHealth(),
      metadata: {
        appVersion: NATIVE_VERSION,
        versionCode: 95,
        platform: "Android"
      },
      recentLogs: recentLogs,
      localStorage: {
        studio_black_screen_diagnostics: localStorage.getItem("studio_black_screen_diagnostics"),
        HUB_ROOT_MISSING_CAPTURE: localStorage.getItem("HUB_ROOT_MISSING_CAPTURE")
      },
      deviceInfo: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screenOrientation: window.screen?.orientation?.type || "unknown",
        userAgent: navigator.userAgent,
        location: window.location.href,
        origin: window.location.origin,
        devicePixelRatio: window.devicePixelRatio
      },
      nativeDetection: {
        isCapacitor: !!(window as any).Capacitor
      }
    };
    copyToClipboard(JSON.stringify(payload, null, 2), "Everything");
  };

  const copyShortSummary = () => {
    const diag = getDiagnosticsPayload();
    const classification = classifyBlackScreen(diag);
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    let topmost = "unknown";
    try {
      const el = document.elementFromPoint(w / 2, h / 2);
      if (el) {
        topmost = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').join('.') : ''}`;
      }
    } catch (_) {}

    const lastNav = diag.lastNavigationAction;
    const summary = `App Version: ${NATIVE_VERSION} (Code 95)
App Mode: ${diag.appMode}
Active Sub-App: ${diag.activeSubApp}
Stable Key: ${diag.stableKey || "none"}
Hub Shell Found: ${diag.hubShellFound}
Hub Root Found: ${diag.hub.rootFound}
Hub Content Found: ${diag.hubContentFound}
Hub Nav Found: ${diag.hubNavFound}
Black Screen Classification: ${classification}
Topmost Element (Center): ${topmost}
Last Navigation Action: ${lastNav ? `${lastNav.fromApp} -> ${lastNav.toApp}` : "none"}`;

    copyToClipboard(summary, "Short Summary");
  };

  const copyDOMSnapshot = () => {
    const tree = generateSimplifiedDOMTree();
    copyToClipboard(tree, "DOM Snapshot");
  };

  const copyTopmostElements = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const coords = {
      center: [w / 2, h / 2],
      "top center": [w / 2, h * 0.1],
      "bottom center": [w / 2, h * 0.9],
      "left center": [w * 0.1, h / 2],
      "right center": [w * 0.9, h / 2],
      "DBG button center": (() => {
        const btn = document.getElementById("livex-panic-dbg-button");
        if (btn) {
          const r = btn.getBoundingClientRect();
          return [r.left + r.width / 2, r.top + r.height / 2];
        }
        return [12 + 24, h - 12 - 24];
      })(),
      "panel center": (() => {
        const panel = document.getElementById("livex-emergency-panel");
        if (panel) {
          const r = panel.getBoundingClientRect();
          return [r.left + r.width / 2, r.top + r.height / 2];
        }
        return [w / 2, h / 2];
      })()
    };

    const out: Record<string, any> = {};
    for (const [key, pt] of Object.entries(coords)) {
      try {
        const el = document.elementFromPoint(pt[0], pt[1]);
        if (el) {
          out[key] = {
            tag: el.tagName.toLowerCase(),
            id: el.id,
            className: el.className,
            zIndex: window.getComputedStyle(el).zIndex,
            pointerEvents: window.getComputedStyle(el).pointerEvents,
            opacity: window.getComputedStyle(el).opacity,
            rect: el.getBoundingClientRect()
          };
        } else {
          out[key] = "none";
        }
      } catch (e) {
        out[key] = `error: ${e}`;
      }
    }
    copyToClipboard(JSON.stringify(out, null, 2), "Topmost Elements");
  };

  const copyNavigationTimeline = () => {
    const trace = getNavigationTrace();
    const diag = (window as any).__navigationDiagnostics;
    const timeline = {
      traceHistory: trace,
      returnAttempts: diag?.returnAttempts || 0,
      failedReturns: diag?.failedReturns || 0,
      blackScreenDetections: diag?.blackScreenDetections || 0,
      lastBlocker: diag?.lastBlocker || 'none',
      history: diag?.history || []
    };
    copyToClipboard(JSON.stringify(timeline, null, 2), "Navigation Timeline");
  };

  const copyLogsWarnings = () => {
    const grouped: Record<string, Array<{ type: string; msg: string; timestamp: number }>> = {
      Hub: [],
      Chordex: [],
      Drumex: [],
      Stagex: [],
      Updater: [],
      Network: [],
      System: []
    };

    recentLogs.forEach(log => {
      const cat = log.category;
      if (grouped[cat]) {
        grouped[cat].push({
          type: log.type,
          msg: log.msg,
          timestamp: log.timestamp
        });
      } else {
        grouped.System.push({
          type: log.type,
          msg: log.msg,
          timestamp: log.timestamp
        });
      }
    });

    copyToClipboard(JSON.stringify(grouped, null, 2), "Logs & Warnings");
  };

  const copyLastCapture = () => {
    const stored = localStorage.getItem('studio_auto_captures');
    const missing = localStorage.getItem('HUB_ROOT_MISSING_CAPTURE');
    const captures = {
      lastAutoCapture: null,
      hubRootMissingCapture: null
    };

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) {
          captures.lastAutoCapture = parsed[0];
        }
      } catch (_) {}
    }
    if (missing) {
      try {
        captures.hubRootMissingCapture = JSON.parse(missing);
      } catch (_) {}
    }

    copyToClipboard(JSON.stringify(captures, null, 2), "Last Capture");
  };

  const copyOverlayHealth = () => {
    const health = getOverlayHealth();
    const panel = document.getElementById('livex-emergency-panel');
    let zIndexAudit = "unknown";
    let elementAbovePanel: any = null;

    if (panel) {
      const panelZ = parseInt(window.getComputedStyle(panel).zIndex) || 2147483647;
      zIndexAudit = `panel z-index is ${panelZ}`;
      const rect = panel.getBoundingClientRect();
      try {
        const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (el && el !== panel && !panel.contains(el)) {
          const style = window.getComputedStyle(el);
          elementAbovePanel = {
            tag: el.tagName.toLowerCase(),
            id: el.id,
            className: el.className,
            zIndex: style.zIndex,
            opacity: style.opacity,
            pointerEvents: style.pointerEvents
          };
        }
      } catch (_) {}
    }

    const report = {
      overlayRootStatus: health.overlayRootExists ? "exists" : "missing",
      dbgButtonStatus: health.dbgButtonExists ? "exists" : "missing",
      dbgButtonVisible: health.dbgButtonVisible,
      dbgButtonTopmost: health.dbgButtonTopmost,
      panelTopmostStatus: health.panelTopmost,
      overlayChildrenCount: health.overlayChildrenCount,
      zIndexAudit,
      elementAbovePanel
    };

    copyToClipboard(JSON.stringify(report, null, 2), "Overlay Health");
  };

  const formatElementStack = (elements: Element[]) => {
    return elements.map(el => {
      try {
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          className: el.className || '',
          zIndex: style.zIndex || 'auto',
          opacity: style.opacity || '1',
          visibility: style.visibility || 'visible',
          display: style.display || 'block',
          pointerEvents: style.pointerEvents || 'auto',
          position: style.position || 'static'
        };
      } catch (e) {
        return { tag: 'error', id: '', className: '', zIndex: '', opacity: '', visibility: '', display: '', pointerEvents: '', position: '' };
      }
    });
  };

  const scanFullscreenOverlays = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const overlays: any[] = [];
    document.querySelectorAll('*').forEach(el => {
      const htmlEl = el as HTMLElement;
      try {
        const style = window.getComputedStyle(htmlEl);
        const pos = style.position;
        if (pos === 'fixed' || pos === 'absolute') {
          const rect = htmlEl.getBoundingClientRect();
          if (rect.width >= w * 0.9 && rect.height >= h * 0.9) {
            overlays.push({
              selector: `${htmlEl.tagName.toLowerCase()}${htmlEl.id ? '#' + htmlEl.id : ''}${htmlEl.className ? '.' + htmlEl.className.trim().split(/\s+/).join('.') : ''}`,
              zIndex: style.zIndex || 'auto',
              opacity: style.opacity || '1',
              visibility: style.visibility || 'visible',
              pointerEvents: style.pointerEvents || 'auto',
              rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height
              }
            });
          }
        }
      } catch (_) {}
    });
    return overlays.sort((a, b) => {
      const az = parseInt(a.zIndex) || 0;
      const bz = parseInt(b.zIndex) || 0;
      return bz - az;
    });
  };

  const detectVisualObstruction = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let centerStack: Element[] = [];
    try {
      centerStack = document.elementsFromPoint(w / 2, h / 2) || [];
    } catch (_) {}

    const topmost = centerStack.length > 0 ? centerStack[0] : null;
    const topmostDesc = topmost ? `${topmost.tagName.toLowerCase()}${topmost.id ? '#' + topmost.id : ''}${topmost.className ? '.' + topmost.className.split(' ').join('.') : ''}` : 'none';

    const hubIndex = centerStack.findIndex(el => {
      const cls = el.className || '';
      const id = el.id || '';
      return el.closest?.('[data-livex-hub-root="true"]') || 
             el.closest?.('.app-main-layout') ||
             cls.includes('app-main-layout') ||
             id === 'hub-root' ||
             cls.includes('glass-nav');
    });

    const hubExistsInDOM = !!(document.querySelector('[data-livex-hub-root="true"]') || document.querySelector('.app-main-layout'));
    const hubExistsUnderCenter = hubIndex !== -1;
    const hubIsCovered = hubExistsUnderCenter && hubIndex > 0;

    let coveredBy: string[] = [];
    if (hubIsCovered) {
      coveredBy = centerStack.slice(0, hubIndex).map(el => {
        return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').join('.') : ''}`;
      });
    }

    const hubLayout = document.querySelector('.app-main-layout');
    let hasZeroPaintArea = false;
    let hasZeroBounds = false;
    let hubBounds = { width: 0, height: 0 };

    if (hubLayout) {
      const rect = hubLayout.getBoundingClientRect();
      hubBounds = { width: rect.width, height: rect.height };
      if (rect.width === 0 || rect.height === 0) {
        hasZeroBounds = true;
      }
      const style = window.getComputedStyle(hubLayout);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) {
        hasZeroPaintArea = true;
      }
    } else {
      hasZeroBounds = true;
      hasZeroPaintArea = true;
    }

    return {
      topmostElement: topmostDesc,
      hubExistsInDOM,
      hubExistsUnderCenter,
      hubIsCovered,
      coveredBy,
      hasZeroPaintArea,
      hasZeroBounds,
      hubBounds
    };
  };

  const auditReactRender = () => {
    const rootMounted = !!document.getElementById('root')?.children.length;
    const hubMounted = !!document.querySelector('.app-main-layout');
    const chordexMounted = !!document.querySelector('.app-sub-app-container') || !!document.querySelector('[class*="chordex"]');
    const suspenseActive = !!document.querySelector('.smart-loading, .fallback-skeleton, .studio-accent-loader, .studio-shimmer, [class*="skeleton"]');
    const errorBoundaryActive = !!document.querySelector('.error-boundary, [class*="error-boundary"]');

    let reactComponentNames: string[] = [];
    try {
      const rootEl = document.getElementById('root');
      if (rootEl) {
        const key = Object.keys(rootEl).find(k => k.startsWith('__reactContainer$'));
        if (key) {
          const fiber = (rootEl as any)[key];
          if (fiber) {
            const names = new Set<string>();
            const traverse = (node: any) => {
              if (!node) return;
              if (node.type && typeof node.type === 'function') {
                names.add(node.type.name || 'AnonymousComponent');
              }
              let child = node.child;
              while (child) {
                traverse(child);
                child = child.sibling;
              }
            };
            traverse(fiber.current || fiber);
            reactComponentNames = Array.from(names);
          }
        }
      }
    } catch (_) {}

    return {
      rootMounted,
      hubMounted,
      chordexMounted,
      suspenseActive,
      errorBoundaryActive,
      reactComponentNames
    };
  };

  const getWebViewDiagnostics = () => {
    const visualViewport = window.visualViewport ? {
      width: window.visualViewport.width,
      height: window.visualViewport.height,
      scale: window.visualViewport.scale,
      pageLeft: window.visualViewport.pageLeft,
      pageTop: window.visualViewport.pageTop
    } : null;

    return {
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      orientation: window.screen?.orientation?.type || String(window.orientation || 'unknown'),
      visualViewport,
      documentVisibilityState: document.visibilityState,
      hasFocus: document.hasFocus()
    };
  };

  const getPaintDiagnostics = () => {
    let bodyBg = 'unknown';
    let htmlBg = 'unknown';
    let rootBg = 'unknown';
    try {
      bodyBg = window.getComputedStyle(document.body).backgroundColor;
      htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
      const rootEl = document.getElementById('root');
      if (rootEl) {
        rootBg = window.getComputedStyle(rootEl).backgroundColor;
      }
    } catch (_) {}

    let allBlackFullscreenElementExists = false;
    let blackOverlaySelector = 'none';
    try {
      const w = window.innerWidth;
      const h = window.innerHeight;
      document.querySelectorAll('*').forEach(el => {
        if (allBlackFullscreenElementExists) return;
        const htmlEl = el as HTMLElement;
        if (htmlEl.id === 'livex-emergency-overlay-root' || htmlEl.closest('#livex-emergency-overlay-root')) {
          return;
        }
        const style = window.getComputedStyle(htmlEl);
        if (style.position === 'fixed' || style.position === 'absolute') {
          const rect = htmlEl.getBoundingClientRect();
          if (rect.width >= w * 0.9 && rect.height >= h * 0.9) {
            const bg = style.backgroundColor;
            const op = parseFloat(style.opacity || '1');
            const vis = style.visibility;
            const disp = style.display;
            
            const isBlack = bg === 'rgb(0, 0, 0)' || bg === 'rgba(0, 0, 0, 1)' || bg === '#000000' || bg === '#000' || bg.includes('black');
            const isVisible = op > 0.05 && vis !== 'hidden' && disp !== 'none';
            if (isBlack && isVisible) {
              allBlackFullscreenElementExists = true;
              blackOverlaySelector = `${htmlEl.tagName.toLowerCase()}${htmlEl.id ? '#' + htmlEl.id : ''}${htmlEl.className ? '.' + htmlEl.className.trim().split(/\s+/).join('.') : ''}`;
            }
          }
        }
      });
    } catch (_) {}

    return {
      bodyBackground: bodyBg,
      htmlBackground: htmlBg,
      rootBackground: rootBg,
      allBlackFullscreenElementExists,
      blackOverlaySelector
    };
  };

  const generateFilteredDOMTree = () => {
    let output = '';
    const walk = (el: Element, depth: number) => {
      if (el.id === 'livex-emergency-panel' || el.closest('#livex-emergency-panel') || 
          el.id === 'livex-panic-menu' || el.closest('#livex-panic-menu')) {
        return;
      }

      const style = window.getComputedStyle(el);
      const pos = style.position;
      const tag = el.tagName.toLowerCase();
      const isOverlay = el.classList.contains('modal') || 
                        el.classList.contains('overlay') || 
                        el.classList.contains('dialog') || 
                        el.classList.contains('sheet') || 
                        el.classList.contains('backdrop') ||
                        el.className.includes('overlay') ||
                        el.className.includes('backdrop') ||
                        el.className.includes('modal');
      
      const isRootOrContainer = el.id === 'root' || 
                                el.id === 'livex-emergency-overlay-root' ||
                                el.id === 'fake-black-screen-layer' ||
                                el.classList.contains('app-container') ||
                                el.classList.contains('app-main-layout') ||
                                el.classList.contains('sc-subapp-wrapper') ||
                                el.classList.contains('app-sub-app-container') ||
                                el.classList.contains('gb-wrap') ||
                                tag === 'iframe' ||
                                tag === 'nav';

      const isImportant = pos === 'fixed' || pos === 'absolute' || isOverlay || isRootOrContainer;

      const hasImportantDescendant = () => {
        return Array.from(el.querySelectorAll('*')).some(child => {
          try {
            const childStyle = window.getComputedStyle(child);
            const childTag = child.tagName.toLowerCase();
            const childIsOverlay = child.classList.contains('modal') || 
                                   child.classList.contains('overlay') || 
                                   child.classList.contains('dialog') || 
                                   child.classList.contains('sheet') || 
                                   child.classList.contains('backdrop') ||
                                   child.className.includes('overlay') ||
                                   child.className.includes('backdrop') ||
                                   child.className.includes('modal');
            const childIsRootOrContainer = child.id === 'root' || 
                                      child.id === 'livex-emergency-overlay-root' ||
                                      child.id === 'fake-black-screen-layer' ||
                                      child.classList.contains('app-container') ||
                                      child.classList.contains('app-main-layout') ||
                                      child.classList.contains('sc-subapp-wrapper') ||
                                      child.classList.contains('app-sub-app-container') ||
                                      child.classList.contains('gb-wrap') ||
                                      childTag === 'iframe' ||
                                      childTag === 'nav';
            return childStyle.position === 'fixed' || childStyle.position === 'absolute' || childIsOverlay || childIsRootOrContainer;
          } catch (_) {
            return false;
          }
        });
      };

      if (!isImportant && !hasImportantDescendant()) {
        return;
      }

      const indent = '  '.repeat(depth);
      const id = el.id ? `#${el.id}` : '';
      const classes = el.className && typeof el.className === 'string' ? `.${Array.from(el.classList).join('.')}` : '';
      const rect = el.getBoundingClientRect();
      const rectStr = `[rect:${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}]`;
      
      const bg = style.backgroundColor;
      const op = style.opacity;
      const vis = style.visibility;
      const disp = style.display;
      const zi = style.zIndex;
      const pe = style.pointerEvents;
      const styleStr = ` [pos: ${pos}] [bg:${bg}] [op:${op}] [vis:${vis}] [disp:${disp}] [zi:${zi}] [pe:${pe}]`;

      output += `${indent}${tag}${id}${classes}${rectStr}${styleStr}\n`;

      for (let i = 0; i < el.children.length; i++) {
        walk(el.children[i], depth + 1);
      }
    };

    if (document.body) {
      walk(document.body, 0);
    }
    return output;
  };

  const copyFullForensicsReport = () => {
    const diag = getDiagnosticsPayload();
    const classification = classifyBlackScreen(diag);
    const elementsStackCenter = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    const stackCenter = formatElementStack(elementsStackCenter);
    
    const overlays = scanFullscreenOverlays();
    const obstruction = detectVisualObstruction();
    const reactAudit = auditReactRender();
    const webViewDiag = getWebViewDiagnostics();
    const paintDiag = getPaintDiagnostics();
    const navTimeline = (window as any).__navigationDiagnostics || {};

    const formatStackPrint = (stack: any[]) => {
      return stack.map((el, idx) => `  [${idx}] ${el.tag}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').join('.') : ''}
      [pos: ${el.position}, z: ${el.zIndex}, op: ${el.opacity}, vis: ${el.visibility}, disp: ${el.display}, pe: ${el.pointerEvents}]`).join('\n') || '  (empty)';
    };

    const report = `==================================================
LIVE X BLACK SCREEN FORENSICS REPORT
==================================================
Timestamp: ${new Date().toISOString()}
App Version: ${NATIVE_VERSION} (Code 95)
Platform: Android WebView

--------------------------------------------------
1. NAVIGATION DIAGNOSTICS
--------------------------------------------------
appMode:            ${diag.appMode}
activeSubApp:       ${diag.activeSubApp}
transitionActive:   ${diag.transitionActive}
stableKey:          ${diag.stableKey || 'none'}
returnAttempts:     ${navTimeline.returnAttempts || 0}
failedReturns:      ${navTimeline.failedReturns || 0}
blackScreenDetections: ${navTimeline.blackScreenDetections || 0}
lastBlocker:        ${navTimeline.lastBlocker || 'none'}

--------------------------------------------------
2. BLACK SCREEN CLASSIFICATION
--------------------------------------------------
Classification:     ${classification}

--------------------------------------------------
3. VISUAL OBSTRUCTION DETECTOR
--------------------------------------------------
Topmost Element (Center):  ${obstruction.topmostElement}
Hub Exists in DOM:         ${obstruction.hubExistsInDOM}
Hub Exists Under Center:   ${obstruction.hubExistsUnderCenter}
Hub is Covered:            ${obstruction.hubIsCovered}
Covered By:                ${obstruction.coveredBy.join(', ') || 'none'}
Hub Zero Paint Area:       ${obstruction.hasZeroPaintArea}
Hub Zero Bounds:           ${obstruction.hasZeroBounds}
Hub Bounds:                width=${obstruction.hubBounds.width}, height=${obstruction.hubBounds.height}

--------------------------------------------------
4. WEBVIEW DIAGNOSTICS
--------------------------------------------------
Viewport Size:      ${webViewDiag.viewportSize}
DPR:                ${webViewDiag.dpr}
Orientation:        ${webViewDiag.orientation}
Document Visible:   ${webViewDiag.documentVisibilityState}
Has Focus:          ${webViewDiag.hasFocus}
VisualViewport:     ${webViewDiag.visualViewport ? JSON.stringify(webViewDiag.visualViewport, null, 2) : 'N/A'}

--------------------------------------------------
5. PAINT DIAGNOSTICS
--------------------------------------------------
HTML Bg Color:      ${paintDiag.htmlBackground}
Body Bg Color:      ${paintDiag.bodyBackground}
Root Bg Color:      ${paintDiag.rootBackground}
All-Black Fullscreen Element Exists: ${paintDiag.allBlackFullscreenElementExists}
Black Overlay Selector: ${paintDiag.blackOverlaySelector}

--------------------------------------------------
6. REACT RENDER AUDIT
--------------------------------------------------
App Root Mounted:   ${reactAudit.rootMounted}
Hub Mounted:        ${reactAudit.hubMounted}
Chordex Mounted:    ${reactAudit.chordexMounted}
Suspense Active:    ${reactAudit.suspenseActive}
ErrorBoundary Active: ${reactAudit.errorBoundaryActive}
Rendered React Component Names:
${reactAudit.reactComponentNames.map(name => `  - ${name}`).join('\n') || '  (none)'}

--------------------------------------------------
7. FULLSCREEN OVERLAYS (Sorted by highest z-index)
--------------------------------------------------
${overlays.map((o, idx) => `${idx + 1}. Selector: ${o.selector}
   z-index:        ${o.zIndex}
   opacity:        ${o.opacity}
   visibility:     ${o.visibility}
   pointer-events: ${o.pointerEvents}
   rect:           L=${o.rect.left}, T=${o.rect.top}, W=${o.rect.width}, H=${o.rect.height}`).join('\n\n') || 'No fullscreen overlays found.'}

--------------------------------------------------
8. ELEMENTS FROM POINT STACKS
--------------------------------------------------
=== CENTER (${window.innerWidth / 2}, ${window.innerHeight / 2}) ===
${formatStackPrint(stackCenter)}

=== TOP CENTER (${window.innerWidth / 2}, ${Math.round(window.innerHeight * 0.1)}) ===
${formatStackPrint(formatElementStack(document.elementsFromPoint(window.innerWidth / 2, window.innerHeight * 0.1)))}

=== BOTTOM CENTER (${window.innerWidth / 2}, ${Math.round(window.innerHeight * 0.9)}) ===
${formatStackPrint(formatElementStack(document.elementsFromPoint(window.innerWidth / 2, window.innerHeight * 0.9)))}

=== LEFT CENTER (${Math.round(window.innerWidth * 0.1)}, ${window.innerHeight / 2}) ===
${formatStackPrint(formatElementStack(document.elementsFromPoint(window.innerWidth * 0.1, window.innerHeight / 2)))}

=== RIGHT CENTER (${Math.round(window.innerWidth * 0.9)}, ${window.innerHeight / 2}) ===
${formatStackPrint(formatElementStack(document.elementsFromPoint(window.innerWidth * 0.9, window.innerHeight / 2)))}
`;

    copyToClipboard(report, "Full Forensics Report");
  };

  const copyFilteredDOM = () => {
    const tree = generateFilteredDOMTree();
    copyToClipboard(tree, "Filtered DOM Snapshot");
  };

  const forceRemoveAllFullscreenOverlays = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const removed: string[] = [];
    document.querySelectorAll('*').forEach(el => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.id === 'livex-emergency-overlay-root' || htmlEl.closest('#livex-emergency-overlay-root')) {
        return;
      }
      try {
        const style = window.getComputedStyle(htmlEl);
        if (style.position === 'fixed' || style.position === 'absolute') {
          const rect = htmlEl.getBoundingClientRect();
          if (rect.width >= w * 0.9 && rect.height >= h * 0.9) {
            const desc = `${htmlEl.tagName.toLowerCase()}${htmlEl.id ? '#' + htmlEl.id : ''}${htmlEl.className ? '.' + htmlEl.className.trim().split(/\s+/).join('.') : ''}`;
            console.warn(`[Recovery] Removing fullscreen overlay element: ${desc}`);
            removed.push(desc);
            htmlEl.remove();
          }
        }
      } catch (_) {}
    });
    setToastMsg(`Removed ${removed.length} overlays:\n${removed.join(', ')}`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const renderForensicsTab = () => {
    const obstruction = detectVisualObstruction();
    const webViewDiag = getWebViewDiagnostics();
    const paintDiag = getPaintDiagnostics();
    const reactAudit = auditReactRender();
    const overlays = scanFullscreenOverlays();

    const w = window.innerWidth;
    const h = window.innerHeight;
    const centerStack = formatElementStack(document.elementsFromPoint(w / 2, h / 2));
    const topStack = formatElementStack(document.elementsFromPoint(w / 2, h * 0.1));
    const bottomStack = formatElementStack(document.elementsFromPoint(w / 2, h * 0.9));
    const leftStack = formatElementStack(document.elementsFromPoint(w * 0.1, h / 2));
    const rightStack = formatElementStack(document.elementsFromPoint(w * 0.9, h / 2));

    const cardStyle: React.CSSProperties = {
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '10px',
      padding: '12px 14px',
      marginBottom: '10px',
    };

    const cardTitleStyle: React.CSSProperties = {
      fontSize: '11px',
      fontWeight: 'bold',
      color: 'rgb(168, 85, 247)',
      marginBottom: '8px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      paddingBottom: '4px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    };

    const rowStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '4px',
      fontSize: '10.5px'
    };

    const labelStyle: React.CSSProperties = {
      color: 'rgba(255, 255, 255, 0.5)'
    };

    const valStyle = (bool?: boolean, colorOverride?: string): React.CSSProperties => ({
      fontWeight: 'bold',
      color: colorOverride ? colorOverride : (bool === undefined ? '#ffffff' : (bool ? '#10b981' : '#f43f5e'))
    });

    const formatStackList = (stack: any[]) => {
      if (stack.length === 0) return <div style={{ color: 'rgba(255,255,255,0.4)', paddingLeft: '8px' }}>Empty stack</div>;
      return stack.map((el, idx) => (
        <div key={idx} style={{ paddingLeft: '8px', borderLeft: '2px solid rgba(168, 85, 247, 0.3)', marginBottom: '6px', fontSize: '10px' }}>
          <strong>[{idx}] {el.tag}{el.id ? '#' + el.id : ''}{el.className ? '.' + el.className.split(' ').join('.') : ''}</strong>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', marginTop: '2px' }}>
            pos: {el.position} | z: {el.zIndex} | op: {el.opacity} | vis: {el.visibility} | disp: {el.display} | pe: {el.pointerEvents}
          </div>
        </div>
      ));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button onClick={copyFullForensicsReport} style={{ flex: 1, padding: '8px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgb(168, 85, 247)', color: '#fff', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
            📋 COPY FULL REPORT
          </button>
          <button onClick={copyFilteredDOM} style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
            🌳 FILTERED DOM
          </button>
        </div>

        {/* 1. VISUAL OBSTRUCTION DETECTOR */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Visual Obstruction Detector</div>
          <div style={rowStyle}>
            <span style={labelStyle}>Topmost Element (Center):</span>
            <span style={valStyle(undefined, '#38bdf8')}>{obstruction.topmostElement}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Hub Exists in DOM:</span>
            <span style={valStyle(obstruction.hubExistsInDOM)}>{String(obstruction.hubExistsInDOM)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Hub Under Center Stack:</span>
            <span style={valStyle(obstruction.hubExistsUnderCenter)}>{String(obstruction.hubExistsUnderCenter)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Hub Is Covered:</span>
            <span style={valStyle(!obstruction.hubIsCovered)}>{String(obstruction.hubIsCovered)}</span>
          </div>
          {obstruction.hubIsCovered && (
            <div style={{ ...rowStyle, flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
              <span style={labelStyle}>Covered by elements (highest first):</span>
              <span style={{ color: '#f43f5e', fontWeight: 'bold', fontSize: '10px', wordBreak: 'break-all' }}>
                {obstruction.coveredBy.join(' -> ')}
              </span>
            </div>
          )}
          <div style={rowStyle}>
            <span style={labelStyle}>Hub Zero Paint Area:</span>
            <span style={valStyle(!obstruction.hasZeroPaintArea)}>{String(obstruction.hasZeroPaintArea)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Hub Zero Bounds:</span>
            <span style={valStyle(!obstruction.hasZeroBounds)}>{String(obstruction.hasZeroBounds)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Hub Bounds:</span>
            <span style={valStyle()}>{obstruction.hubBounds.width}x{obstruction.hubBounds.height}</span>
          </div>
        </div>

        {/* 2. WEBVIEW DIAGNOSTICS */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>WebView Diagnostics</div>
          <div style={rowStyle}>
            <span style={labelStyle}>viewportSize:</span>
            <span style={valStyle()}>{webViewDiag.viewportSize}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Device Pixel Ratio (DPR):</span>
            <span style={valStyle()}>{webViewDiag.dpr}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Orientation:</span>
            <span style={valStyle(undefined, '#fb7185')}>{webViewDiag.orientation}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>document.visibilityState:</span>
            <span style={valStyle(undefined, '#fbbf24')}>{webViewDiag.documentVisibilityState}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>document.hasFocus():</span>
            <span style={valStyle(webViewDiag.hasFocus)}>{String(webViewDiag.hasFocus)}</span>
          </div>
          {webViewDiag.visualViewport && (
            <div style={{ ...rowStyle, flexDirection: 'column', gap: '2px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '4px', marginTop: '4px' }}>
              <span style={labelStyle}>visualViewport details:</span>
              <pre style={{ margin: 0, fontSize: '9px', color: 'rgba(255,255,255,0.7)', overflowX: 'auto', background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '4px' }}>
{`size:  ${webViewDiag.visualViewport.width}x${webViewDiag.visualViewport.height}
scale: ${webViewDiag.visualViewport.scale}
page:  (${webViewDiag.visualViewport.pageLeft}, ${webViewDiag.visualViewport.pageTop})`}
              </pre>
            </div>
          )}
        </div>

        {/* 3. PAINT DIAGNOSTICS */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Paint Diagnostics</div>
          <div style={rowStyle}>
            <span style={labelStyle}>html background:</span>
            <span style={valStyle()}>{paintDiag.htmlBackground}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>body background:</span>
            <span style={valStyle()}>{paintDiag.bodyBackground}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>#root background:</span>
            <span style={valStyle()}>{paintDiag.rootBackground}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>All-Black Fullscreen Overlay:</span>
            <span style={valStyle(!paintDiag.allBlackFullscreenElementExists)}>
              {paintDiag.allBlackFullscreenElementExists ? `DETECTED (${paintDiag.blackOverlaySelector})` : 'none'}
            </span>
          </div>
        </div>

        {/* 4. REACT RENDER AUDIT */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>React Render Audit</div>
          <div style={rowStyle}>
            <span style={labelStyle}>App root (#root) children:</span>
            <span style={valStyle(reactAudit.rootMounted)}>{reactAudit.rootMounted ? 'mounted' : 'empty'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Hub Mounted:</span>
            <span style={valStyle(reactAudit.hubMounted)}>{String(reactAudit.hubMounted)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Chordex Mounted:</span>
            <span style={valStyle(reactAudit.chordexMounted)}>{String(reactAudit.chordexMounted)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Suspense Active (Loader):</span>
            <span style={valStyle(!reactAudit.suspenseActive)}>{String(reactAudit.suspenseActive)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>ErrorBoundary Active:</span>
            <span style={valStyle(!reactAudit.errorBoundaryActive)}>{String(reactAudit.errorBoundaryActive)}</span>
          </div>
          <div style={{ ...rowStyle, flexDirection: 'column', gap: '2px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '4px', marginTop: '4px' }}>
            <span style={labelStyle}>Active React tree component names:</span>
            <div style={{ maxHeight: '100px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', padding: '6px', borderRadius: '4px', width: '100%', boxSizing: 'border-box' }}>
              {reactAudit.reactComponentNames.length > 0 ? (
                reactAudit.reactComponentNames.map((name, i) => (
                  <div key={i} style={{ color: '#c084fc', fontSize: '9px', fontFamily: 'monospace' }}>
                    &lt;{name} /&gt;
                  </div>
                ))
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>No React components resolved from fiber root.</div>
              )}
            </div>
          </div>
        </div>

        {/* 5. FULLSCREEN OVERLAY SCANNER */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Fullscreen Overlay Scanner</div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {overlays.length > 0 ? (
              overlays.map((o, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.02)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '9.5px' }}>
                  <strong style={{ color: '#fb7185' }}>{o.selector}</strong>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8.5px', marginTop: '2px' }}>
                    z: {o.zIndex} | op: {o.opacity} | vis: {o.visibility} | pe: {o.pointerEvents}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '8px' }}>
                    rect: L={o.rect.left}, T={o.rect.top}, W={o.rect.width}, H={o.rect.height}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: '10px' }}>No overlays covering &gt;= 90% of screen found.</div>
            )}
          </div>
        </div>

        {/* 6. ELEMENTS FROM POINT STACKS */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>ElementsFromPoint Stacks (Full)</div>
          
          <details style={{ marginBottom: '8px' }}>
            <summary style={{ cursor: 'pointer', color: '#c084fc', fontWeight: 'bold', fontSize: '10.5px' }}>
              Center Stack ({Math.round(w/2)}, {Math.round(h/2)}) ({centerStack.length})
            </summary>
            <div style={{ marginTop: '6px' }}>{formatStackList(centerStack)}</div>
          </details>

          <details style={{ marginBottom: '8px' }}>
            <summary style={{ cursor: 'pointer', color: '#c084fc', fontWeight: 'bold', fontSize: '10.5px' }}>
              Top Center Stack ({Math.round(w/2)}, {Math.round(h*0.1)}) ({topStack.length})
            </summary>
            <div style={{ marginTop: '6px' }}>{formatStackList(topStack)}</div>
          </details>

          <details style={{ marginBottom: '8px' }}>
            <summary style={{ cursor: 'pointer', color: '#c084fc', fontWeight: 'bold', fontSize: '10.5px' }}>
              Bottom Center Stack ({Math.round(w/2)}, {Math.round(h*0.9)}) ({bottomStack.length})
            </summary>
            <div style={{ marginTop: '6px' }}>{formatStackList(bottomStack)}</div>
          </details>

          <details style={{ marginBottom: '8px' }}>
            <summary style={{ cursor: 'pointer', color: '#c084fc', fontWeight: 'bold', fontSize: '10.5px' }}>
              Left Center Stack ({Math.round(w*0.1)}, {Math.round(h/2)}) ({leftStack.length})
            </summary>
            <div style={{ marginTop: '6px' }}>{formatStackList(leftStack)}</div>
          </details>

          <details style={{ marginBottom: '8px' }}>
            <summary style={{ cursor: 'pointer', color: '#c084fc', fontWeight: 'bold', fontSize: '10.5px' }}>
              Right Center Stack ({Math.round(w*0.9)}, {Math.round(h/2)}) ({rightStack.length})
            </summary>
            <div style={{ marginTop: '6px' }}>{formatStackList(rightStack)}</div>
          </details>
        </div>
      </div>
    );
  };

  // ── AUTO CAPTURE WATCHDOG ───────────────────────────────────────────────
  const hasAutoOpenedRef = useRef(false);
  const lastCaptureTimeRef = useRef(0);
  useEffect(() => {
    const checkAndAutoCapture = () => {
      const currentAppMode = settings.appMode || 'hub';
      if (currentAppMode !== 'hub') return;

      const diagnostics = getDiagnosticsPayload();
      
      const hubRootMissing = !diagnostics.hubRootFound;
      const centerEl = diagnostics.blockers.center;
      const isScreenBlank = centerEl.tag === 'body' || centerEl.tag === 'html' || 
                           (diagnostics.hub.mounted && !diagnostics.hub.visible) ||
                           parseFloat(diagnostics.hub.opacity) === 0;

      if (hubRootMissing || isScreenBlank) {
        if (!hasAutoOpenedRef.current) {
          setIsOpen(true);
          hasAutoOpenedRef.current = true;
        }

        const now = Date.now();
        if (now - lastCaptureTimeRef.current < 5000) return;
        lastCaptureTimeRef.current = now;

        const domTree = generateSimplifiedDOMTree();
        const path = diagnostics.navigationTrace.map((t: any) => `${t.fromApp}->${t.toApp}`).join(' | ');
        const blockerStr = `Center: ${centerEl.tag}${centerEl.id ? '#' + centerEl.id : ''}${centerEl.className ? '.' + centerEl.className.split(' ')[0] : ''} (zIndex: ${centerEl.zIndex}, opacity: ${centerEl.opacity})`;

        const newEntry: AutoCaptureEntry = {
          timestamp: now,
          navigationPath: path || 'none -> hub',
          appMode: currentAppMode,
          activeSubApp: 'none',
          blockerDetectionResult: blockerStr,
          domSummary: domTree.split('\n').slice(0, 10).join('\n') + (domTree.split('\n').length > 10 ? '\n... (truncated)' : ''),
          fullPayload: { diagnostics, domTree }
        };

        setAutoCaptures(prev => {
          const updated = [newEntry, ...prev].slice(0, 20);
          try {
            localStorage.setItem('studio_auto_captures', JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });

        console.warn('[Watchdog] Black screen auto-captured!', newEntry);
      } else {
        hasAutoOpenedRef.current = false;
      }
    };

    const interval = setInterval(checkAndAutoCapture, 1500);
    return () => clearInterval(interval);
  }, [settings.appMode]);

  // ── FORCE RECOVERY ACTIONS ──────────────────────────────────────────────
  const runRecoveryAction = (actionName: string, actionFn: () => void) => {
    try {
      actionFn();
      setToastMsg(`Action Success`);
      setTimeout(() => setToastMsg(null), 2000);
      setTick(t => t + 1);
    } catch (e) {
      setToastMsg(`Failed: ${e}`);
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const forceHubRemount = () => {
    (window as any).studioTransitionActive = false;
    updateSettings({ appMode: 'hub' });
    if (typeof (window as any).__forceRemountHub === 'function') {
      (window as any).__forceRemountHub();
    }
    document.querySelectorAll('.sc-subapp-wrapper, .app-sub-app-container').forEach(el => {
      el.remove();
    });
  };

  const forceTransitionUnlock = () => {
    (window as any).studioTransitionActive = false;
    window.dispatchEvent(new CustomEvent('studio:reset-hub-zooming'));
  };

  const forceClearNavigationLocks = () => {
    (window as any).studioTransitionActive = false;
  };

  const forceClearMotionWrappers = () => {
    document.querySelectorAll('.sc-subapp-wrapper').forEach(el => {
      el.remove();
    });
  };

  const forceRerenderHub = () => {
    if (typeof (window as any).__forceRemountHub === 'function') {
      (window as any).__forceRemountHub();
    } else {
      throw new Error('__forceRemountHub hook is not registered in App.tsx');
    }
  };

  const forceRerenderEntireApp = () => {
    if (typeof (window as any).__forceRerenderApp === 'function') {
      (window as any).__forceRerenderApp();
    } else {
      throw new Error('__forceRerenderApp hook is not registered in main.tsx');
    }
  };

  const forceHubVisibility = () => {
    const selector = '.app-main-layout, #hub-root, .hub-shell, [data-livex-hub-content="true"]';
    document.querySelectorAll(selector).forEach(el => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.setProperty('opacity', '1', 'important');
      htmlEl.style.setProperty('visibility', 'visible', 'important');
      htmlEl.style.setProperty('display', 'block', 'important');
    });
  };

  // Status Cards renderer (Part E)
  const renderStatusCards = () => {
    const diag = getDiagnosticsPayload();
    const classification = classifyBlackScreen(diag);
    const health = getOverlayHealth();
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    let topmostCenterEl: any = null;
    let topmostStyle: any = {};
    try {
      const el = document.elementFromPoint(w / 2, h / 2);
      if (el) {
        const style = window.getComputedStyle(el);
        topmostCenterEl = {
          tag: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className
        };
        topmostStyle = {
          zIndex: style.zIndex,
          opacity: style.opacity,
          pointerEvents: style.pointerEvents,
          visibility: style.visibility,
          backgroundColor: style.backgroundColor
        };
      }
    } catch (_) {}

    const lastNav = diag.lastNavigationAction;

    const cardStyle: React.CSSProperties = {
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '10px',
      padding: '12px 14px',
      marginBottom: '10px',
    };

    const cardTitleStyle: React.CSSProperties = {
      fontSize: '11px',
      fontWeight: 'bold',
      color: 'rgb(168, 85, 247)',
      marginBottom: '8px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      paddingBottom: '4px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    };

    const rowStyle: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '4px',
      fontSize: '10.5px'
    };

    const rowValWrapStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      maxWidth: '65%'
    };

    const labelStyle: React.CSSProperties = {
      color: 'rgba(255, 255, 255, 0.5)'
    };

    const valStyle = (bool?: boolean, colorOverride?: string): React.CSSProperties => ({
      fontWeight: 'bold',
      color: colorOverride ? colorOverride : (bool === undefined ? '#ffffff' : (bool ? '#10b981' : '#f43f5e'))
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* CARD 1: CURRENT STATE */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>1. Current State</div>
          <div style={rowStyle}>
            <span style={labelStyle}>appMode:</span>
            <span style={valStyle(undefined, '#c084fc')}>{diag.appMode}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>activeSubApp:</span>
            <span style={valStyle(undefined, '#f472b6')}>{diag.activeSubApp}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>stableKey:</span>
            <span style={valStyle(undefined, '#60a5fa')}>{diag.stableKey || 'none'}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>transitionActive:</span>
            <span style={valStyle(!diag.transitionActive)}>{String(diag.transitionActive)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>hubRenderKey:</span>
            <span style={valStyle(undefined, '#f59e0b')}>{String(useChordStore.getState().settings.appMode === 'hub' ? 'N/A' : 'derived')}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>appVersion:</span>
            <span style={valStyle(undefined, '#9ca3af')}>3.6.62</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>versionCode:</span>
            <span style={valStyle(undefined, '#9ca3af')}>89</span>
          </div>
        </div>

        {/* CARD 2: HUB PAINT STATE */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>2. Hub Paint State</div>
          <div style={rowStyle}>
            <span style={labelStyle}>hubShellFound:</span>
            <span style={valStyle(diag.hubShellFound)}>{String(diag.hubShellFound)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>hubRootFound:</span>
            <span style={valStyle(diag.hub.rootFound)}>{String(diag.hub.rootFound)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>hubContentFound:</span>
            <span style={valStyle(diag.hubContentFound)}>{String(diag.hubContentFound)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>hubNavFound:</span>
            <span style={valStyle(diag.hubNavFound)}>{String(diag.hubNavFound)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>hubActuallyPainted:</span>
            <span style={valStyle(diag.hubActuallyPainted)}>{String(diag.hubActuallyPainted)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Classification:</span>
            <span style={valStyle(undefined, classification === 'DIAGNOSTIC_SELECTOR_FALSE_POSITIVE' || classification === 'SIMULATED_BLACK_LAYER_ACTIVE' ? '#fb923c' : (classification === 'UNKNOWN_BLACK_SCREEN' ? '#9ca3af' : '#f43f5e'))}>
              {classification}
            </span>
          </div>
        </div>

        {/* CARD 3: TOPMOST BLOCKER */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>3. Topmost Blocker (Center)</div>
          {topmostCenterEl ? (
            <>
              <div style={rowStyle}>
                <span style={labelStyle}>element:</span>
                <span style={valStyle(undefined, '#38bdf8')}>
                  {topmostCenterEl.tag}{topmostCenterEl.id ? '#' + topmostCenterEl.id : ''}
                </span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>class:</span>
                <div style={rowValWrapStyle}>
                  <span style={{ ...valStyle(undefined), wordBreak: 'break-all', textAlign: 'right' }}>
                    {topmostCenterEl.className || 'none'}
                  </span>
                </div>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>z-index:</span>
                <span style={valStyle()}>{topmostStyle.zIndex}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>opacity:</span>
                <span style={valStyle()}>{topmostStyle.opacity}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>pointer-events:</span>
                <span style={valStyle()}>{topmostStyle.pointerEvents}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>visibility:</span>
                <span style={valStyle()}>{topmostStyle.visibility}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>bg color:</span>
                <span style={valStyle()}>{topmostStyle.backgroundColor}</span>
              </div>
            </>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>No element detected.</div>
          )}
        </div>

        {/* CARD 4: OVERLAY HEALTH */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>4. Overlay Health</div>
          <div style={rowStyle}>
            <span style={labelStyle}>DBG visible:</span>
            <span style={valStyle(health.dbgButtonVisible)}>{String(health.dbgButtonVisible)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>DBG topmost:</span>
            <span style={valStyle(health.dbgButtonTopmost)}>{String(health.dbgButtonTopmost)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>panel topmost:</span>
            <span style={valStyle(health.panelTopmost)}>{String(health.panelTopmost)}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>overlay children count:</span>
            <span style={valStyle()}>{health.overlayChildrenCount}</span>
          </div>
        </div>

        {/* CARD 5: RECENT TRANSITION */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>5. Recent Transition</div>
          {lastNav ? (
            <>
              <div style={rowStyle}>
                <span style={labelStyle}>fromApp:</span>
                <span style={valStyle()}>{lastNav.fromApp}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>toApp:</span>
                <span style={valStyle()}>{lastNav.toApp}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>duration:</span>
                <span style={valStyle()}>{lastNav.transitionDuration !== undefined ? `${lastNav.transitionDuration}ms` : 'unknown'}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>lock state:</span>
                <span style={valStyle(!lastNav.transitionLockState)}>{String(lastNav.transitionLockState)}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>recoveredViaFailsafe:</span>
                <span style={valStyle(undefined, lastNav.recoveredViaFailsafe ? '#f59e0b' : '#10b981')}>{String(!!lastNav.recoveredViaFailsafe)}</span>
              </div>
            </>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>No transitions logged.</div>
          )}
        </div>
      </div>
    );
  };

  const renderDiffRow = (label: string, beforeVal: any, afterVal: any, keyVal?: string) => {
    const isDiff = String(beforeVal) !== String(afterVal);
    const rowBg = isDiff ? 'rgba(245, 158, 11, 0.06)' : 'transparent';
    return (
      <tr key={keyVal || label} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: rowBg }}>
        <td style={{ padding: '4px 8px', color: isDiff ? '#f59e0b' : 'rgba(255,255,255,0.7)', fontWeight: isDiff ? 'bold' : 'normal' }}>{label}</td>
        <td style={{ padding: '4px 8px', color: '#fff', wordBreak: 'break-all' }}>{String(beforeVal)}</td>
        <td style={{ padding: '4px 8px', color: isDiff ? '#34d399' : '#fff', fontWeight: isDiff ? 'bold' : 'normal', wordBreak: 'break-all' }}>
          {String(afterVal)}
          {isDiff && (
            <span style={{ marginLeft: '4px', fontSize: '7px', background: '#34d399', color: '#000', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold' }}>
              DIFF
            </span>
          )}
        </td>
      </tr>
    );
  };

  const renderFailedTimelineTab = () => {
    if (!lastFailedTimeline) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'rgba(255,255,255,0.4)', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>Timeline Clean</span>
          <span>No failed navigation timeline recorded in localStorage.</span>
        </div>
      );
    }

    const { id, timestamp, snapshots, result, reason } = lastFailedTimeline;
    const checkpointKeys = ['T+0ms', 'T+50ms', 'T+100ms', 'T+250ms', 'T+500ms', 'T+1000ms', 'T+2000ms'];

    let verdictLabel = 'FAILED (COMPOSITOR FREEZE OR CRASH)';
    if (snapshots) {
      const failingCheckpoints = ['T+0ms', 'T+50ms', 'T+100ms', 'T+250ms', 'T+500ms', 'T+1000ms', 'T+2000ms'];
      for (const key of failingCheckpoints) {
        const snap = snapshots[key];
        if (snap) {
          const statusObj = getWebViewPipelineStatus(snap);
          if (statusObj.status === 'ROOT_APP_TREE_MISSING') {
            verdictLabel = 'FAILED (ROOT APP TREE MISSING)';
            break;
          } else if (statusObj.status === 'HUB_DOM_NOT_MOUNTED') {
            verdictLabel = 'FAILED (HUB DOM NOT MOUNTED)';
            break;
          }
        }
      }
    }

    const copyFullReport = () => {
      let timeline: any = null;
      try {
        const timelineStr = localStorage.getItem('studio_last_failed_navigation_timeline');
        if (timelineStr) timeline = JSON.parse(timelineStr);
      } catch (_) {}

      let recoveryLog = [];
      try {
        const recStr = localStorage.getItem('studio_hub_mount_recovery_log') || '[]';
        recoveryLog = JSON.parse(recStr);
      } catch (_) {}

      let diagnostics: any = null;
      try {
        const diagStr = localStorage.getItem('studio_black_screen_diagnostics');
        if (diagStr) diagnostics = JSON.parse(diagStr);
      } catch (_) {}

      let rootLifecycleLog = [];
      try {
        const lifecycleStr = localStorage.getItem('studio_root_lifecycle_logs') || '[]';
        rootLifecycleLog = JSON.parse(lifecycleStr);
      } catch (_) {}

      let rootAppErrorBoundaryLog = [];
      try {
        const errorLogStr = localStorage.getItem('studio_rootapp_error_boundary_log') || '[]';
        rootAppErrorBoundaryLog = JSON.parse(errorLogStr);
      } catch (_) {}

      const rootNode = document.getElementById('root');
      const rootDiagnostics = {
        innerHTML_length: rootNode ? rootNode.innerHTML.length : 0,
        childElementCount: rootNode ? rootNode.childElementCount : 0,
        firstElementChildSelector: rootNode && rootNode.firstElementChild 
          ? `${rootNode.firstElementChild.tagName.toLowerCase()}${rootNode.firstElementChild.id ? '#' + rootNode.firstElementChild.id : ''}${rootNode.firstElementChild.className ? '.' + rootNode.firstElementChild.className.split(' ').join('.') : ''}`
          : 'none',
        appContainerExists: !!document.querySelector('.app-container'),
        appMainLayoutExists: !!document.querySelector('.app-main-layout'),
        appReturnedNull: rootNode ? rootNode.innerHTML.trim() === '' : true
      };

      let firstFailingCheckpoint = 'unknown';
      let failureType = 'unknown';
      let missingNodes: string[] = [];

      if (timeline && timeline.snapshots) {
        const checkpointKeys = ['T+0ms', 'T+50ms', 'T+100ms', 'T+250ms', 'T+500ms', 'T+1000ms', 'T+2000ms'];
        for (const key of checkpointKeys) {
          const snap = timeline.snapshots[key];
          if (snap) {
            const statusObj = getWebViewPipelineStatus(snap);
            if (statusObj.status === 'ROOT_APP_TREE_MISSING' || statusObj.status === 'HUB_DOM_NOT_MOUNTED' || statusObj.status === 'COMPOSITOR_FREEZE') {
              firstFailingCheckpoint = key;
              failureType = statusObj.status;
              
              const elementsToCheck = ['app-container', 'app-main-layout', 'hub-root', 'hub-content', 'subapp-wrapper', 'subapp-container'];
              elementsToCheck.forEach(node => {
                if (!snap.elements?.[node]?.exists) {
                  missingNodes.push(node);
                }
              });
              break;
            }
          }
        }
      }

      const report = {
        verdictSummary: {
          firstFailingCheckpoint,
          failureType,
          missingNodes
        },
        appMetadata: {
          appVersion: NATIVE_VERSION,
          nativeApkVersion: NATIVE_VERSION,
          versionCode: 97,
          packageName: 'com.chordex.app',
          platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          timestamp: new Date().toISOString()
        },
        rootDOM: rootDiagnostics,
        navigationMetadata: {
          id: timeline?.id,
          timestamp: timeline?.timestamp,
          result: timeline?.result,
          reason: timeline?.reason,
          activeSubApp: timeline?.snapshots?.['T+0ms']?.activeSubApp,
          stableKey: timeline?.snapshots?.['T+0ms']?.stableKey,
          transitionActive: timeline?.snapshots?.['T+0ms']?.transitionActive,
          hubRenderKey: timeline?.snapshots?.['T+0ms']?.hubRenderKey,
          lastNavigationAction: timeline?.lastNavigationAction
        },
        checkpoints: timeline?.snapshots || {},
        recoveryLog,
        rootLifecycleLog,
        rootAppErrorBoundaryLog,
        diagnostics
      };

      copyToClipboard(JSON.stringify(report, null, 2), 'Full Failed Timeline Report');
    };

    const copyTimelineJson = () => {
      const timelineStr = localStorage.getItem('studio_last_failed_navigation_timeline') || '{}';
      copyToClipboard(timelineStr, 'Failed Timeline JSON');
    };

    const copyTimelineSummary = () => {
      let timeline: any = null;
      try {
        const timelineStr = localStorage.getItem('studio_last_failed_navigation_timeline');
        if (timelineStr) timeline = JSON.parse(timelineStr);
      } catch (_) {}

      let firstFailingCheckpoint = 'unknown';
      let failureType = 'unknown';
      if (timeline && timeline.snapshots) {
        const checkpointKeys = ['T+0ms', 'T+50ms', 'T+100ms', 'T+250ms', 'T+500ms', 'T+1000ms', 'T+2000ms'];
        for (const key of checkpointKeys) {
          const snap = timeline.snapshots[key];
          if (snap) {
            const statusObj = getWebViewPipelineStatus(snap);
            if (statusObj.status !== 'PIPELINE_OK') {
              firstFailingCheckpoint = key;
              failureType = statusObj.status;
              break;
            }
          }
        }
      }

      const summaryStr = `Verdict: FAILED
Timestamp: ${timeline ? new Date(timeline.timestamp).toISOString() : 'unknown'}
Reason: ${timeline?.reason || 'COMPOSITOR FREEZE OR CRASH'}
App Version: ${timeline?.appVersion || NATIVE_VERSION} (Code ${timeline?.versionCode || 96})
First Failing Checkpoint: ${firstFailingCheckpoint}
Failure Type: ${failureType}
Total Checkpoints: ${timeline?.snapshots ? Object.keys(timeline.snapshots).length : 0}`;

      copyToClipboard(summaryStr, 'Failed Timeline Summary');
    };

    const copyCheckpointsOnly = () => {
      let timeline: any = null;
      try {
        const timelineStr = localStorage.getItem('studio_last_failed_navigation_timeline');
        if (timelineStr) timeline = JSON.parse(timelineStr);
      } catch (_) {}
      const checkpoints = timeline?.snapshots || {};
      copyToClipboard(JSON.stringify(checkpoints, null, 2), 'Checkpoints Only');
    };

    const copyRecoveryLog = () => {
      const recStr = localStorage.getItem('studio_hub_mount_recovery_log') || '[]';
      copyToClipboard(recStr, 'Recovery Log');
    };

    const copyRootLifecycleLog = () => {
      const logsStr = localStorage.getItem('studio_root_lifecycle_logs') || '[]';
      copyToClipboard(logsStr, 'Root Lifecycle Log');
    };

    const copyMountUnmountStackReport = () => {
      let logs = [];
      try {
        logs = JSON.parse(localStorage.getItem('studio_root_lifecycle_logs') || '[]');
      } catch (_) {}

      let report = '=== MOUNT/UNMOUNT STACK REPORT ===\n\n';
      logs.forEach((log: any) => {
        if (log.name) {
          report += `[${new Date(log.timestamp).toISOString()}] ${log.name} ${log.event.toUpperCase()}\n`;
          report += `appMode: ${log.appMode} | subApp: ${log.activeSubApp} | transition: ${log.transitionActive}\n`;
          report += `Stack Trace:\n${log.stack}\n`;
          report += '--------------------------------------------------\n\n';
        } else if (log.type === 'SUSPENSE_FALLBACK_RENDERED') {
          report += `[${new Date(log.timestamp).toISOString()}] SUSPENSE_FALLBACK_RENDERED\n`;
          report += `Stack Trace:\n${log.stack}\n`;
          report += '--------------------------------------------------\n\n';
        }
      });

      copyToClipboard(report, 'Mount/Unmount Stack Report');
    };

    const copyRootAppErrorLog = () => {
      const logsStr = localStorage.getItem('studio_rootapp_error_boundary_log') || '[]';
      copyToClipboard(logsStr, 'RootApp Error Log');
    };

    const copyLastRecoverableRootAppError = () => {
      const errorStr = localStorage.getItem('studio_rootapp_last_recoverable_error') || 'null';
      copyToClipboard(errorStr, 'Last Recoverable RootApp Error');
    };

    const copySymbolicatedReactErrorReport = () => {
      const report = localStorage.getItem('studio_rootapp_last_symbolicated_report') || 'No symbolicated React error report found.';
      copyToClipboard(report, 'Symbolicated React Error Report');
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header Summary */}
        <div style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ color: '#f43f5e', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              VERDICT: {verdictLabel}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '2px' }}>
              Attempted: {new Date(timestamp).toLocaleDateString()} {new Date(timestamp).toLocaleTimeString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              background: '#f43f5e',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 'bold',
              padding: '3px 8px',
              borderRadius: '12px',
              textTransform: 'uppercase'
            }}>
              {reason || 'FAILED'}
            </span>
          </div>
        </div>

        {/* RootApp ErrorBoundary Telemetry Panel */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '8px',
          padding: '12px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>RootApp Error Count</span>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#60a5fa', marginTop: '2px' }}>
              {localStorage.getItem('studio_rootapp_error_boundary_count') || '0'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Last Error Recovery</span>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: localStorage.getItem('studio_rootapp_last_error_suppressed') === 'true' ? '#34d399' : '#f87171', marginTop: '4px' }}>
              {localStorage.getItem('studio_rootapp_last_error_suppressed') === 'true' ? 'RECOVERED SILENTLY' : 'NOT SUPPRESSED / FAIL'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gridColumn: 'span 2', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px', marginTop: '4px' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Last Recovery Duration</span>
            <span style={{ fontSize: '11px', fontWeight: 'semibold', color: '#fff', marginTop: '2px' }}>
              {localStorage.getItem('studio_rootapp_last_error_duration') ? `${localStorage.getItem('studio_rootapp_last_error_duration')}ms` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Copy Operations */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '12px'
        }}>
          <button
            onClick={copyFullReport}
            style={{
              background: 'linear-gradient(135deg, rgb(168, 85, 247) 0%, rgb(147, 51, 234) 100%)',
              border: 'none',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)',
              transition: 'transform 0.1s ease'
            }}
          >
            COPY FULL FAILED TIMELINE REPORT
          </button>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            marginTop: '4px'
          }}>
            <button
              onClick={copyTimelineJson}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              COPY TIMELINE JSON
            </button>
            <button
              onClick={copyTimelineSummary}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              COPY TIMELINE SUMMARY
            </button>
            <button
              onClick={copyCheckpointsOnly}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              COPY CHECKPOINTS ONLY
            </button>
            <button
              onClick={copyRecoveryLog}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              COPY RECOVERY LOG
            </button>
            <button
              onClick={copyRootLifecycleLog}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              COPY ROOT LIFECYCLE LOG
            </button>
            <button
              onClick={copyMountUnmountStackReport}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              COPY MOUNT/UNMOUNT STACKS
            </button>
            <button
              onClick={copyRootAppErrorLog}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              COPY ROOTAPP ERROR LOG
            </button>
            <button
              onClick={copyLastRecoverableRootAppError}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              COPY LAST RECOVERABLE ERROR
            </button>
            <button
              onClick={copySymbolicatedReactErrorReport}
              style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              COPY SYMBOLICATED REACT ERROR REPORT
            </button>
          </div>
        </div>

        {/* Timeline Track */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '20px', borderLeft: '2px solid rgba(255,255,255,0.06)' }}>
          {checkpointKeys.map((key, idx) => {
            const snap = snapshots?.[key] || null;
            if (!snap) {
              return (
                <div key={key} style={{ display: 'flex', gap: '12px', opacity: 0.5, position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-26px',
                    top: '2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    border: '2px solid rgb(24,24,27)'
                  }} />
                  <div>
                    <span style={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.4)' }}>{key}</span>
                    <span style={{ marginLeft: '10px', color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>No snapshot recorded</span>
                  </div>
                </div>
              );
            }

            const paint = snap.paintVerification || null;
            const thumbnailSrc = paint?.thumbnail || snap.thumbnail || '';
            const isBlack = paint?.paintState === 'visually_black';
            const statusColor = isBlack ? '#f43f5e' : (paint?.paintState === 'painted' ? '#10b981' : '#f59e0b');

            return (
              <div key={key} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                {/* Connector Node */}
                <div style={{
                  position: 'absolute',
                  left: '-27px',
                  top: '4px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: statusColor,
                  border: '2px solid rgb(24,24,27)',
                  boxShadow: `0 0 8px ${statusColor}`
                }} />

                {/* Content Container */}
                <div style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start'
                }}>
                  {/* Thumbnail */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                    <div style={{
                      width: '60px',
                      height: '100px',
                      background: '#000',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
                      {thumbnailSrc ? (
                        <img src={thumbnailSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={key} />
                      ) : (
                        <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>No Image</span>
                      )}
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
                      {key}
                    </span>
                  </div>

                  {/* Telemetry Detail Grid */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Upper row: Core stats */}
                    <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>App Mode:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '10.5px' }}>{snap.appMode}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>Active SubApp:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '10.5px' }}>{snap.activeSubApp}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>Transition:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '10.5px', color: snap.transitionActive ? '#f59e0b' : '#10b981' }}>
                          {snap.transitionActive ? 'Active' : 'Idle'}
                        </div>
                      </div>
                      <div style={{ flex: 1.5 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>Hub DOM:</span>
                        <div style={{ fontWeight: 'bold', fontSize: '10.5px', color: snap.hubDomState?.mounted ? '#10b981' : '#f43f5e' }}>
                          {snap.hubDomState?.mounted ? `Mounted (${snap.hubDomState.elementCount} nodes)` : 'Not Mounted'}
                        </div>
                      </div>
                    </div>

                    {/* Middle row: Paint and layers */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <div>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>Paint State:</span>
                        <div style={{ fontWeight: 'bold', color: statusColor }}>
                          {paint ? String(paint.paintState).toUpperCase() : 'UNKNOWN'} {paint ? `(${paint.blackPercent}% black)` : ''}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>WebView Layers:</span>
                        <div>{snap.webViewMetrics ? `${snap.webViewMetrics.layerCount} estimated layers` : 'N/A'}</div>
                      </div>
                    </div>

                    {/* Collapsible stack trace */}
                    {snap.topmostElementsStack && snap.topmostElementsStack.length > 0 && (
                      <details style={{ marginTop: '2px' }}>
                        <summary style={{ cursor: 'pointer', color: 'rgb(168, 85, 247)', fontSize: '9.5px', outline: 'none' }}>
                          Topmost Element Stack ({snap.topmostElementsStack.length})
                        </summary>
                        <div style={{
                          marginTop: '4px',
                          background: 'rgba(0,0,0,0.2)',
                          padding: '6px',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '9px',
                          maxHeight: '80px',
                          overflowY: 'auto'
                        }}>
                          {snap.topmostElementsStack.map((el: any, sidx: number) => (
                            <div key={sidx} style={{ color: sidx === 0 ? '#f43f5e' : 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.03)', padding: '2px 0' }}>
                              #{sidx}: &lt;{el.tag}
                              {el.id ? ` id="${el.id}"` : ''}
                              {el.className ? ` class="${el.className.split(' ').slice(0, 2).join(' ')}"` : ''}
                              &gt; (z-index: {el.zIndex}, opacity: {el.opacity})
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderNavForensicsTab = () => {
    const activeCapture = forensicCaptures[selectedForensicIdx] || null;

    const statsCardStyle: React.CSSProperties = {
      display: 'flex',
      gap: '10px',
      marginBottom: '14px',
    };

    const halfCardStyle: React.CSSProperties = {
      flex: 1,
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '8px',
      padding: '10px 12px',
    };

    const actionCardStyle: React.CSSProperties = {
      background: 'rgba(168, 85, 247, 0.05)',
      border: '1px solid rgba(168, 85, 247, 0.25)',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    };

    // Helper to format timestamps nicely
    const formatTime = (ts?: number) => {
      if (!ts) return 'N/A';
      return new Date(ts).toLocaleTimeString() + ' (' + new Date(ts).toLocaleDateString() + ')';
    };

    const getBeforeSnap = (cap: any) => {
      if (!cap) return null;
      return cap.snapshots?.['LEAVING_CHORDEX'] || cap.snapshots?.['T+0ms'] || cap.before || null;
    };

    const getAfterSnap = (cap: any) => {
      if (!cap) return null;
      if (cap.after) return cap.after;
      if (cap.snapshots) {
        if (cap.snapshots['T+2000ms']) return cap.snapshots['T+2000ms'];
        if (cap.snapshots['T+500ms']) return cap.snapshots['T+500ms'];
        if (cap.snapshots['ENTERING_HUB']) return cap.snapshots['ENTERING_HUB'];
        const keys = Object.keys(cap.snapshots);
        const sorted = keys.sort((a, b) => {
          const getMs = (k: string) => parseInt(k.replace('T+', '').replace('ms', '')) || 0;
          return getMs(b) - getMs(a);
        });
        return cap.snapshots[sorted[0]] || null;
      }
      return null;
    };


    // Live paint verification handler
    const handleVerifyPaintLive = async () => {
      if (typeof (window as any).runPaintVerification === 'function') {
        setVerifyingPaint(true);
        try {
          const result = await (window as any).runPaintVerification();
          setLivePaintVerify(result);
          setToastMsg('Paint verification complete.');
          setTimeout(() => setToastMsg(null), 2500);
        } catch (err) {
          setToastMsg(`Paint verification failed: ${err}`);
          setTimeout(() => setToastMsg(null), 2500);
        } finally {
          setVerifyingPaint(false);
        }
      } else {
        setToastMsg('runPaintVerification is not registered.');
        setTimeout(() => setToastMsg(null), 2500);
      }
    };

    // Trigger force webview repaint
    const handleForceWebViewRepaint = () => {
      if (typeof (window as any).runForceWebViewRepaint === 'function') {
        (window as any).runForceWebViewRepaint();
        setToastMsg('Triggered Force WebView Repaint...');
        setTimeout(() => setToastMsg(null), 2500);
      } else {
        setToastMsg('Error: runForceWebViewRepaint is not registered.');
        setTimeout(() => setToastMsg(null), 2500);
      }
    };

    // Trigger force full hub rebuild
    const handleForceFullHubRebuild = () => {
      if (typeof (window as any).runForceFullHubRebuild === 'function') {
        (window as any).runForceFullHubRebuild();
        setToastMsg('Triggered Force Full Hub Rebuild...');
        setTimeout(() => setToastMsg(null), 2500);
      } else {
        setToastMsg('Error: runForceFullHubRebuild is not registered.');
        setTimeout(() => setToastMsg(null), 2500);
      }
    };

    // Trigger force webview refresh layer
    const handleForceWebViewRefreshLayer = () => {
      if (typeof (window as any).runForceWebViewRefreshLayer === 'function') {
        (window as any).runForceWebViewRefreshLayer();
        setToastMsg('Triggered Force WebView Refresh Layer...');
        setTimeout(() => setToastMsg(null), 2500);
      } else {
        setToastMsg('Error: runForceWebViewRefreshLayer is not registered.');
        setTimeout(() => setToastMsg(null), 2500);
      }
    };

    const beforeSnapSuccess = getBeforeSnap(lastSuccessfulForensic);
    const afterSnapSuccess = getAfterSnap(lastSuccessfulForensic);
    const beforeSnapFailed = getBeforeSnap(lastFailedForensic);
    const afterSnapFailed = getAfterSnap(lastFailedForensic);

    // Timeline snap setup
    const availableSnaps = activeCapture && activeCapture.snapshots ? Object.keys(activeCapture.snapshots).sort((a, b) => {
      const getMs = (k: string) => {
        if (k === 'LEAVING_CHORDEX') return 0;
        if (k === 'ENTERING_HUB') return 100;
        return parseInt(k.replace('T+', '').replace('ms', '')) || 0;
      };
      return getMs(a) - getMs(b);
    }) : [];

    const currentLeftKey = availableSnaps.includes(leftSnapKey) ? leftSnapKey : (availableSnaps[0] || 'LEAVING_CHORDEX');
    const currentRightKey = availableSnaps.includes(rightSnapKey) ? rightSnapKey : (availableSnaps[availableSnaps.length - 1] || 'T+2000ms');

    let leftSnapshot: any = null;
    let rightSnapshot: any = null;

    if (activeCapture) {
      if (activeCapture.snapshots) {
        leftSnapshot = activeCapture.snapshots[currentLeftKey] || null;
        rightSnapshot = activeCapture.snapshots[currentRightKey] || null;
      } else {
        leftSnapshot = activeCapture.before || null;
        rightSnapshot = activeCapture.after || null;
      }
    }

    const pipelineStatus = getWebViewPipelineStatus(rightSnapshot);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        
        {/* STATS SECTION */}
        <div style={statsCardStyle}>
          <div style={{ ...halfCardStyle, borderLeft: '3px solid #10b981' }}>
            <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>Last Successful Return</div>
            {lastSuccessfulForensic ? (
              <div>
                <div style={{ fontWeight: 'bold' }}>{formatTime(lastSuccessfulForensic.timestamp)}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', marginTop: '2px' }}>
                  App Mode: {beforeSnapSuccess?.appMode || 'chords'} → {afterSnapSuccess?.appMode || 'hub'}
                </div>
              </div>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>No successful return captured yet</div>
            )}
          </div>
          
          <div style={{ ...halfCardStyle, borderLeft: '3px solid #ef4444' }}>
            <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>Last Failed Return</div>
            {lastFailedForensic ? (
              <div>
                <div style={{ fontWeight: 'bold', color: '#ff8a8a' }}>{formatTime(lastFailedForensic.timestamp)}</div>
                <div style={{ color: '#f43f5e', fontSize: '9px', fontWeight: 'bold', marginTop: '2px' }}>Reason: {lastFailedForensic.reason || 'Blocked'}</div>
              </div>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>No failed return captured yet</div>
            )}
          </div>
        </div>

        {/* PAINT VERIFICATION SECTION */}
        <div style={{ ...actionCardStyle, background: 'rgba(56, 189, 248, 0.05)', borderColor: 'rgba(56, 189, 248, 0.25)' }}>
          <strong style={{ color: '#38bdf8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Paint Verification (html2canvas)
          </strong>
          
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={handleVerifyPaintLive}
              disabled={verifyingPaint}
              style={{
                flex: 1,
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgb(56, 189, 248)',
                color: '#fff',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 'bold',
                cursor: 'pointer',
                opacity: verifyingPaint ? 0.6 : 1
              }}
            >
              {verifyingPaint ? 'Capturing & Verifying Paint...' : '🔎 Run Paint Verification'}
            </button>
          </div>

          {livePaintVerify ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '6px', marginTop: '4px', fontSize: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>DOM State:</span>
                <span style={{ fontWeight: 'bold', color: livePaintVerify.domExists ? '#10b981' : '#f43f5e' }}>
                  {livePaintVerify.domExists ? 'Exists' : 'Missing'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Paint State:</span>
                <span style={{ fontWeight: 'bold', color: livePaintVerify.paintState === 'painted' ? '#10b981' : '#f43f5e' }}>
                  {String(livePaintVerify.paintState).toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Black Pixels:</span>
                <span style={{ fontWeight: 'bold', color: livePaintVerify.blackPercent > 98 ? '#f43f5e' : '#10b981' }}>
                  {livePaintVerify.blackPercent}%
                </span>
              </div>
              {livePaintVerify.histogram && (
                <div style={{ marginTop: '2px', fontSize: '9px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 'bold', marginBottom: '2px' }}>Pixel Histogram:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
                    <div>Black (RGB&lt;15): {livePaintVerify.histogram.black}</div>
                    <div>Dark (gray&lt;=64): {livePaintVerify.histogram.dark}</div>
                    <div>Mid (gray&lt;=180): {livePaintVerify.histogram.mid}</div>
                    <div>Bright (gray&gt;180): {livePaintVerify.histogram.bright}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', textAlign: 'center' }}>
              No paint verification run yet. Click above to analyze offscreen canvas.
            </div>
          )}
        </div>

        {/* RECOVERY SECTION */}
        <div style={actionCardStyle}>
          <strong style={{ color: 'rgb(216, 180, 254)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Hub Recovery Controls
          </strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleForceWebViewRepaint}
                style={{
                  flex: 1,
                  background: 'rgba(168, 85, 247, 0.25)',
                  border: '1px solid rgb(168, 85, 247)',
                  color: '#fff',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '9.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Force WebView Repaint
              </button>
              <button
                onClick={handleForceFullHubRebuild}
                style={{
                  flex: 1,
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid rgb(239, 68, 68)',
                  color: '#fff',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '9.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Force Full Hub Rebuild
              </button>
            </div>
            
            <button
              onClick={handleForceWebViewRefreshLayer}
              style={{
                width: '100%',
                background: 'rgba(56, 189, 248, 0.25)',
                border: '1px solid rgb(56, 189, 248)',
                color: '#fff',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '9.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Force WebView Refresh Layer
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '6px', marginTop: '4px', fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
            <div>
              Repaint Log: {visualRepaintsLog.length > 0 ? (
                (() => {
                  const entry = visualRepaintsLog[visualRepaintsLog.length - 1];
                  return (
                    <>
                      {formatTime(entry.timestamp)} [{entry.action}] |{' '}
                      <span style={{ color: entry.success ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                        {entry.success ? 'SUCCESS' : 'FAILED'} ({entry.paintData?.paintState || 'Unknown'}, {entry.paintData?.blackPercent !== undefined ? `${entry.paintData.blackPercent}% black` : ''})
                      </span>
                    </>
                  );
                })()
              ) : 'No repaint run logged'}
            </div>
            <div>
              Nuclear Log: {nuclearRecoveriesLog.length > 0 ? (
                (() => {
                  const entry = nuclearRecoveriesLog[nuclearRecoveriesLog.length - 1];
                  return (
                    <>
                      {formatTime(entry.timestamp)} |{' '}
                      <span style={{ color: entry.success ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                        {entry.success ? 'SUCCESS' : 'FAILED'} ({entry.paintData?.paintState || 'Unknown'}, {entry.paintData?.blackPercent !== undefined ? `${entry.paintData.blackPercent}% black` : ''})
                      </span>
                    </>
                  );
                })()
              ) : 'No nuclear recovery run logged'}
            </div>
          </div>
        </div>

        {/* COMPARISON/DIFF SECTION */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, color: 'rgb(168, 85, 247)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Forensic Snapshots ({forensicCaptures.length}/20)
            </h3>
            {forensicCaptures.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  value={selectedForensicIdx}
                  onChange={(e) => setSelectedForensicIdx(parseInt(e.target.value))}
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '4px',
                    padding: '3px 6px',
                    fontSize: '10px',
                    outline: 'none'
                  }}
                >
                  {forensicCaptures.map((cap, idx) => (
                    <option key={cap.id} value={idx}>
                      [{cap.result?.toUpperCase()}] {new Date(cap.timestamp).toLocaleTimeString()}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    try {
                      localStorage.removeItem('studio_forensic_captures');
                      setForensicCaptures([]);
                      setSelectedForensicIdx(0);
                      setToastMsg('Forensic captures cleared.');
                      setTimeout(() => setToastMsg(null), 2000);
                    } catch (_) {}
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ff8a8a',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {!activeCapture ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.3)' }}>
              No returns from Chordex to Hub have been captured yet.
            </div>
          ) : (
            <div>
              {/* WebView Pipeline Status Label */}
              <div style={{ marginBottom: '10px', padding: '10px', borderRadius: '8px', border: `1px solid ${pipelineStatus.color}`, background: `${pipelineStatus.color}15` }}>
                <div style={{ fontWeight: 'bold', color: pipelineStatus.color, fontSize: '11px', textTransform: 'uppercase' }}>
                  Compositor Status: {pipelineStatus.status}
                </div>
                <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.85)', marginTop: '4px', lineHeight: '1.4' }}>
                  {pipelineStatus.desc}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px', background: 'rgba(0,0,0,0.15)', padding: '6px 8px', borderRadius: '4px', alignItems: 'center' }}>
                <div>
                  Result:{' '}
                  <span style={{ color: activeCapture.result === 'success' ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                    {activeCapture.result?.toUpperCase()}
                  </span>
                  {activeCapture.reason && <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: '6px' }}>({activeCapture.reason})</span>}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)' }}>
                  ID: {activeCapture.id}
                </div>
              </div>

              {/* TIMELINE COMPARISON SELECTORS */}
              {activeCapture.snapshots && availableSnaps.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px' }}>
                  <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.6)' }}>Compare snapshots:</span>
                  <select
                    value={currentLeftKey}
                    onChange={(e) => setLeftSnapKey(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      fontSize: '9.5px',
                      outline: 'none'
                    }}
                  >
                    {availableSnaps.map(key => (
                      <option key={`left-${key}`} value={key}>{key}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)' }}>vs</span>
                  <select
                    value={currentRightKey}
                    onChange={(e) => setRightSnapKey(e.target.value)}
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      fontSize: '9.5px',
                      outline: 'none'
                    }}
                  >
                    {availableSnaps.map(key => (
                      <option key={`right-${key}`} value={key}>{key}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Side-by-side diff table */}
              <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', textAlign: 'left', minWidth: '450px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.6)' }}>Selector / Property</th>
                      <th style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.6)' }}>LEFT ({activeCapture.snapshots ? currentLeftKey : 'BEFORE'})</th>
                      <th style={{ padding: '6px 8px', color: 'rgba(255,255,255,0.6)' }}>RIGHT ({activeCapture.snapshots ? currentRightKey : 'AFTER'})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* App state variables */}
                    {renderDiffRow('App Mode', leftSnapshot?.appMode, rightSnapshot?.appMode)}
                    {renderDiffRow('Active SubApp', leftSnapshot?.activeSubApp, rightSnapshot?.activeSubApp)}
                    {renderDiffRow('Stable Key', leftSnapshot?.stableKey, rightSnapshot?.stableKey)}
                    {renderDiffRow('Transition Active', leftSnapshot?.transitionActive, rightSnapshot?.transitionActive)}

                    {/* Viewport audit variables */}
                    <tr style={{ background: 'rgba(168, 85, 247, 0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 'bold', color: 'rgb(216, 180, 254)' }}>VIEWPORT AUDIT</td>
                    </tr>
                    {renderDiffRow('Viewport Size', `${leftSnapshot?.viewport?.innerWidth}x${leftSnapshot?.viewport?.innerHeight}`, `${rightSnapshot?.viewport?.innerWidth}x${rightSnapshot?.viewport?.innerHeight}`)}
                    {renderDiffRow('Visual Viewport', leftSnapshot?.viewport?.visualViewport ? `${leftSnapshot.viewport.visualViewport.width}x${leftSnapshot.viewport.visualViewport.height} (scale: ${leftSnapshot.viewport.visualViewport.scale})` : 'N/A', rightSnapshot?.viewport?.visualViewport ? `${rightSnapshot.viewport.visualViewport.width}x${rightSnapshot.viewport.visualViewport.height} (scale: ${rightSnapshot.viewport.visualViewport.scale})` : 'N/A')}
                    {renderDiffRow('Device Pixel Ratio', leftSnapshot?.viewport?.dpr, rightSnapshot?.viewport?.dpr)}
                    {renderDiffRow('Orientation', leftSnapshot?.viewport?.orientation?.type, rightSnapshot?.viewport?.orientation?.type)}

                    {/* Render Audit */}
                    <tr style={{ background: 'rgba(168, 85, 247, 0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 'bold', color: 'rgb(216, 180, 254)' }}>WEBVIEW RENDER AUDIT</td>
                    </tr>
                    {renderDiffRow('GPU Compositor Layer Count', leftSnapshot?.renderAudit?.layerCount, rightSnapshot?.renderAudit?.layerCount)}
                    
                    <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td colSpan={3} style={{ padding: '4px 8px', fontWeight: 'bold', color: '#38bdf8' }}>Root Container (#root)</td>
                    </tr>
                    {renderDiffRow('  ↳ Rect Bounds', 
                      leftSnapshot?.renderAudit?.root?.rect ? `l:${leftSnapshot.renderAudit.root.rect.left} t:${leftSnapshot.renderAudit.root.rect.top} w:${leftSnapshot.renderAudit.root.rect.width} h:${leftSnapshot.renderAudit.root.rect.height}` : 'N/A', 
                      rightSnapshot?.renderAudit?.root?.rect ? `l:${rightSnapshot.renderAudit.root.rect.left} t:${rightSnapshot.renderAudit.root.rect.top} w:${rightSnapshot.renderAudit.root.rect.width} h:${rightSnapshot.renderAudit.root.rect.height}` : 'N/A'
                    )}
                    {renderDiffRow('  ↳ display', leftSnapshot?.renderAudit?.root?.display, rightSnapshot?.renderAudit?.root?.display)}
                    {renderDiffRow('  ↳ visibility', leftSnapshot?.renderAudit?.root?.visibility, rightSnapshot?.renderAudit?.root?.visibility)}
                    {renderDiffRow('  ↳ opacity', leftSnapshot?.renderAudit?.root?.opacity, rightSnapshot?.renderAudit?.root?.opacity)}
                    {renderDiffRow('  ↳ transform', leftSnapshot?.renderAudit?.root?.transform, rightSnapshot?.renderAudit?.root?.transform)}
                    {renderDiffRow('  ↳ filter', leftSnapshot?.renderAudit?.root?.filter, rightSnapshot?.renderAudit?.root?.filter)}
                    {renderDiffRow('  ↳ contain', leftSnapshot?.renderAudit?.root?.contain, rightSnapshot?.renderAudit?.root?.contain)}
                    {renderDiffRow('  ↳ isolation', leftSnapshot?.renderAudit?.root?.isolation, rightSnapshot?.renderAudit?.root?.isolation)}
                    {renderDiffRow('  ↳ overflow', leftSnapshot?.renderAudit?.root?.overflow, rightSnapshot?.renderAudit?.root?.overflow)}

                    <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td colSpan={3} style={{ padding: '4px 8px', fontWeight: 'bold', color: '#38bdf8' }}>Hub Container ([data-livex-hub-root])</td>
                    </tr>
                    {renderDiffRow('  ↳ Rect Bounds', 
                      leftSnapshot?.renderAudit?.hub?.rect ? `l:${leftSnapshot.renderAudit.hub.rect.left} t:${leftSnapshot.renderAudit.hub.rect.top} w:${leftSnapshot.renderAudit.hub.rect.width} h:${leftSnapshot.renderAudit.hub.rect.height}` : 'N/A', 
                      rightSnapshot?.renderAudit?.hub?.rect ? `l:${rightSnapshot.renderAudit.hub.rect.left} t:${rightSnapshot.renderAudit.hub.rect.top} w:${rightSnapshot.renderAudit.hub.rect.width} h:${rightSnapshot.renderAudit.hub.rect.height}` : 'N/A'
                    )}
                    {renderDiffRow('  ↳ display', leftSnapshot?.renderAudit?.hub?.display, rightSnapshot?.renderAudit?.hub?.display)}
                    {renderDiffRow('  ↳ visibility', leftSnapshot?.renderAudit?.hub?.visibility, rightSnapshot?.renderAudit?.hub?.visibility)}
                    {renderDiffRow('  ↳ opacity', leftSnapshot?.renderAudit?.hub?.opacity, rightSnapshot?.renderAudit?.hub?.opacity)}
                    {renderDiffRow('  ↳ transform', leftSnapshot?.renderAudit?.hub?.transform, rightSnapshot?.renderAudit?.hub?.transform)}
                    {renderDiffRow('  ↳ filter', leftSnapshot?.renderAudit?.hub?.filter, rightSnapshot?.renderAudit?.hub?.filter)}
                    {renderDiffRow('  ↳ contain', leftSnapshot?.renderAudit?.hub?.contain, rightSnapshot?.renderAudit?.hub?.contain)}
                    {renderDiffRow('  ↳ isolation', leftSnapshot?.renderAudit?.hub?.isolation, rightSnapshot?.renderAudit?.hub?.isolation)}
                    {renderDiffRow('  ↳ overflow', leftSnapshot?.renderAudit?.hub?.overflow, rightSnapshot?.renderAudit?.hub?.overflow)}

                    {/* Pixel Probe */}
                    <tr style={{ background: 'rgba(168, 85, 247, 0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 'bold', color: 'rgb(216, 180, 254)' }}>PIXEL VISIBILITY PROBES</td>
                    </tr>
                    {renderDiffRow('Screen Visually Empty (All Points)', String(!!leftSnapshot?.visualProbe?.allEmpty), String(!!rightSnapshot?.visualProbe?.allEmpty))}
                    
                    {['center', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'].map(pt => {
                      const leftPt = leftSnapshot?.visualProbe?.results?.[pt];
                      const rightPt = rightSnapshot?.visualProbe?.results?.[pt];
                      
                      const leftVal = leftPt ? `status:${leftPt.status} color:${leftPt.color} el:${leftPt.element} hasTxt:${leftPt.hasContent}` : 'N/A';
                      const rightVal = rightPt ? `status:${rightPt.status} color:${rightPt.color} el:${rightPt.element} hasTxt:${rightPt.hasContent}` : 'N/A';
                      
                      return renderDiffRow(`Point: ${pt} (${leftPt?.point || '?'})`, leftVal, rightVal, `probe-${pt}`);
                    })}

                    {/* Paint Verification */}
                    <tr style={{ background: 'rgba(168, 85, 247, 0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 'bold', color: 'rgb(216, 180, 254)' }}>PAINT VERIFICATION (html2canvas)</td>
                    </tr>
                    {renderDiffRow('DOM State', leftSnapshot?.paintVerification?.domExists !== undefined ? (leftSnapshot.paintVerification.domExists ? 'Exists' : 'Missing') : 'N/A', rightSnapshot?.paintVerification?.domExists !== undefined ? (rightSnapshot.paintVerification.domExists ? 'Exists' : 'Missing') : 'N/A')}
                    {renderDiffRow('Paint State', leftSnapshot?.paintVerification?.paintState || 'N/A', rightSnapshot?.paintVerification?.paintState || 'N/A')}
                    {renderDiffRow('Black Pixels %', leftSnapshot?.paintVerification?.blackPercent !== undefined ? `${leftSnapshot.paintVerification.blackPercent}%` : 'N/A', rightSnapshot?.paintVerification?.blackPercent !== undefined ? `${rightSnapshot.paintVerification.blackPercent}%` : 'N/A')}
                    {renderDiffRow('Pixel Histogram', 
                      leftSnapshot?.paintVerification?.histogram ? `B:${leftSnapshot.paintVerification.histogram.black} D:${leftSnapshot.paintVerification.histogram.dark} M:${leftSnapshot.paintVerification.histogram.mid} Br:${leftSnapshot.paintVerification.histogram.bright}` : 'N/A', 
                      rightSnapshot?.paintVerification?.histogram ? `B:${rightSnapshot.paintVerification.histogram.black} D:${rightSnapshot.paintVerification.histogram.dark} M:${rightSnapshot.paintVerification.histogram.mid} Br:${rightSnapshot.paintVerification.histogram.bright}` : 'N/A'
                    )}
                    {renderDiffRow('Visually Black & DOM Exists', 
                      leftSnapshot?.paintVerification ? String(leftSnapshot.paintVerification.paintState === 'visually_black' && leftSnapshot.paintVerification.domExists) : 'N/A',
                      rightSnapshot?.paintVerification ? String(rightSnapshot.paintVerification.paintState === 'visually_black' && rightSnapshot.paintVerification.domExists) : 'N/A'
                    )}

                    {/* DOM Bounds audit */}
                    <tr style={{ background: 'rgba(168, 85, 247, 0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 'bold', color: 'rgb(216, 180, 254)' }}>DOM BOUNDS AUDIT (getBoundingClientRect)</td>
                    </tr>
                    {Object.keys(leftSnapshot?.bounds || rightSnapshot?.bounds || {}).map(selector => {
                      const beforeBounds = leftSnapshot?.bounds?.[selector];
                      const afterBounds = rightSnapshot?.bounds?.[selector];
                      const beforeVal = beforeBounds?.exists ? `l:${beforeBounds.left} t:${beforeBounds.top} w:${beforeBounds.width} h:${beforeBounds.height}` : 'Not Found';
                      const afterVal = afterBounds?.exists ? `l:${afterBounds.left} t:${afterBounds.top} w:${afterBounds.width} h:${afterBounds.height}` : 'Not Found';
                      return renderDiffRow(selector, beforeVal, afterVal);
                    })}

                    {/* Element visual state audit */}
                    <tr style={{ background: 'rgba(168, 85, 247, 0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td colSpan={3} style={{ padding: '6px 8px', fontWeight: 'bold', color: 'rgb(216, 180, 254)' }}>ELEMENT VISUAL STATES</td>
                    </tr>
                    {Object.keys(leftSnapshot?.elements || rightSnapshot?.elements || {}).map(elKey => {
                      const beforeEl = leftSnapshot?.elements?.[elKey];
                      const afterEl = rightSnapshot?.elements?.[elKey];
                      
                      if (!beforeEl && !afterEl) return null;
                      
                      const rows: React.ReactNode[] = [];
                      rows.push(
                        <tr key={`${elKey}-header`} style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td colSpan={3} style={{ padding: '4px 8px', fontWeight: 'bold', color: '#38bdf8' }}>Element: {elKey}</td>
                        </tr>
                      );

                      const keysToCompare = ['exists', 'visibility', 'opacity', 'display', 'pointerEvents', 'transform', 'filter', 'backdropFilter', 'zIndex'];
                      keysToCompare.forEach(prop => {
                        const beforeVal = beforeEl ? beforeEl[prop] : undefined;
                        const afterVal = afterEl ? afterEl[prop] : undefined;
                        rows.push(renderDiffRow(`  ↳ ${prop}`, beforeVal, afterVal, `${elKey}-${prop}`));
                      });
                      
                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!overlayRoot) return null;

  const panicMenuItemStyle: React.CSSProperties = {
    background: '#1f2937',
    color: '#ffffff',
    border: '1px solid #374151',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '11px',
    textAlign: 'center',
    cursor: 'pointer',
    fontWeight: 'bold',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return createPortal(
    <div
      key={portalKey}
      id="emergency-debug-overlay-container"
      style={{
        position: 'fixed',
        inset: '0',
        zIndex: 2147483647,
        isolation: 'isolate',
        pointerEvents: 'none',
        transform: 'translateZ(0)',
        contain: 'none',
        background: 'transparent',
      }}
    >
      {/* Toast Notification for copies */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '72px',
            right: '12px',
            background: '#10b981',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 2147483647,
            pointerEvents: 'none'
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Always-visible Panic Button */}
      <button
        id="livex-panic-dbg-button"
        onClick={() => setIsPanicMenuOpen(prev => !prev)}
        style={{
          position: 'fixed',
          bottom: '12px',
          right: '12px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#ef4444',
          color: '#ffffff',
          border: '3px solid #ffffff',
          boxShadow: '0 0 10px rgba(0,0,0,0.8), 0 0 20px #ef4444',
          fontSize: '14px',
          fontWeight: '900',
          fontFamily: 'monospace',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2147483647,
          pointerEvents: 'auto',
          cursor: 'pointer'
        }}
      >
        DBG
      </button>

      {/* Panic Context Menu (expanded per Part D) */}
      {isPanicMenuOpen && (
        <div
          id="livex-panic-menu"
          style={{
            position: 'fixed',
            bottom: '68px',
            right: '12px',
            width: '260px',
            background: '#111827',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
            zIndex: 2147483647,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            color: '#ffffff',
            fontFamily: 'monospace'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ef4444', borderBottom: '1px solid #374151', paddingBottom: '6px', textAlign: 'center', marginBottom: '8px' }}>
            DBG PANIC DIAGNOSTICS
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
            <button onClick={copyFullForensicsReport} style={{ ...panicMenuItemStyle, gridColumn: 'span 2', background: 'rgba(168, 85, 247, 0.25)', borderColor: 'rgb(168, 85, 247)' }}>📋 Copy Full Forensics</button>
            <button onClick={copyFilteredDOM} style={{ ...panicMenuItemStyle, gridColumn: 'span 2' }}>🌳 Copy Filtered DOM</button>
            <button onClick={copyEverything} style={panicMenuItemStyle}>📋 All</button>
            <button onClick={copyShortSummary} style={panicMenuItemStyle}>📝 Brief</button>
            <button onClick={copyDOMSnapshot} style={panicMenuItemStyle}>🌳 DOM</button>
            <button onClick={copyTopmostElements} style={panicMenuItemStyle}>🔝 Top</button>
            <button onClick={copyNavigationTimeline} style={panicMenuItemStyle}>🕒 Nav</button>
            <button onClick={copyLogsWarnings} style={panicMenuItemStyle}>🗂️ Logs</button>
            <button onClick={copyLastCapture} style={panicMenuItemStyle}>📸 Capture</button>
            <button onClick={copyOverlayHealth} style={panicMenuItemStyle}>❤️ Health</button>
          </div>

          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#9ca3af', marginTop: '6px', marginBottom: '4px', textAlign: 'center', borderTop: '1px solid #374151', paddingTop: '6px' }}>
            RECOVERY & TOOLS
          </div>
          
          <button
            onClick={() => runRecoveryAction('Force Hub Remount', forceHubRemount)}
            style={{ ...panicMenuItemStyle, background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgb(168, 85, 247)', marginBottom: '4px' }}
          >
            🔄 Force Hub Remount
          </button>
          
          <button
            onClick={() => runRecoveryAction('Force Remove Overlays', forceRemoveAllFullscreenOverlays)}
            style={{ ...panicMenuItemStyle, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '4px' }}
          >
            🚫 Force Remove Overlays
          </button>

          <button
            onClick={() => runRecoveryAction('Force Hub Visibility', forceHubVisibility)}
            style={{ ...panicMenuItemStyle, background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', marginBottom: '4px' }}
          >
            👁️ Force Hub Visibility
          </button>

          <button
            onClick={() => runRecoveryAction('Force App Re-render', forceRerenderEntireApp)}
            style={{ ...panicMenuItemStyle, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgb(239, 68, 68)', marginBottom: '4px' }}
          >
            ⚡ Force App Re-render
          </button>
          
          <button
            onClick={() => {
              setIsOpen(prev => !prev);
              setIsPanicMenuOpen(false);
            }}
            style={{ ...panicMenuItemStyle, background: '#374151', border: '1px solid #4b5563', marginBottom: '4px' }}
          >
            {isOpen ? '❌ Hide Console' : '📺 Show Console'}
          </button>
          
          <button
            onClick={toggleSimulateBlackScreen}
            style={{
              ...panicMenuItemStyle,
              background: isBlackScreenSimulated ? '#9d174d' : '#831843',
              border: isBlackScreenSimulated ? '1px solid #db2777' : '1px solid #9d174d'
            }}
          >
            {isBlackScreenSimulated ? '🔴 Remove Black' : '🖤 Sim. Black'}
          </button>
        </div>
      )}

      {/* Main Debug Panel Modal */}
      {isOpen && (
        <div
          id="livex-emergency-panel"
          style={{
            position: 'fixed',
            inset: '16px',
            bottom: '80px',
            background: 'rgba(10, 10, 14, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '2px solid rgba(168, 85, 247, 0.4)',
            borderRadius: '16px',
            zIndex: 2147483647,
            boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            color: '#fff',
            fontFamily: 'monospace',
            overflow: 'hidden',
            pointerEvents: 'auto'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(147, 51, 234, 0.08)'
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: 'rgb(168, 85, 247)' }}>
                EMERGENCY BLACK SCREEN TELEMETRY
              </h2>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                <span>{`Current App Version: ${NATIVE_VERSION} (Code 95)`}</span>
                {lastFailedTimeline && lastFailedTimeline.appVersion && lastFailedTimeline.appVersion !== NATIVE_VERSION && (
                  <span style={{ color: '#f59e0b' }}>
                    {`Timeline Capture Version: ${lastFailedTimeline.appVersion} (Code ${lastFailedTimeline.versionCode || 'unknown'})`}
                  </span>
                )}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              DISMISS
            </button>
          </div>

          {/* Navigation Tab Bar */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.20)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              overflowX: 'auto'
            }}
          >
            {(['status', 'forensics', 'nav_forensics', 'failed_timeline', 'blockers', 'recovery', 'captures', 'dom'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setActiveCaptureIdx(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px 6px',
                  background: activeTab === tab ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid rgb(168, 85, 247)' : '2px solid transparent',
                  color: activeTab === tab ? 'rgb(168, 85, 247)' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab ? 'bold' : 'normal',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  minWidth: '80px'
                }}
              >
                {tab === 'nav_forensics' ? 'nav forensics' : tab === 'failed_timeline' ? 'failed timeline' : tab}
              </button>
            ))}
          </div>

          {/* Section Body View */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', fontSize: '11px', lineHeight: '1.4' }}>
            
            {/* TAB: STATUS */}
            {activeTab === 'status' && renderStatusCards()}

            {/* TAB: FORENSICS */}
            {activeTab === 'forensics' && renderForensicsTab()}

            {/* TAB: NAVIGATION FORENSICS */}
            {activeTab === 'nav_forensics' && renderNavForensicsTab()}

            {/* TAB: FAILED TIMELINE */}
            {activeTab === 'failed_timeline' && renderFailedTimelineTab()}

            {/* TAB: BLOCKERS */}
            {activeTab === 'blockers' && (
              <div>
                <h3 style={{ margin: '0 0 10px 0', color: 'rgb(168, 85, 247)', fontSize: '12px' }}>ELEMENT HIT-TEST AT 5 KEY COORDINATES</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(getVisualBlockers()).map(([pos, info]) => (
                    <div key={pos} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: 'rgb(168, 85, 247)', textTransform: 'uppercase' }}>{pos} coordinate:</span>
                      <pre style={{ margin: '4px 0 0 0', background: 'rgba(255,255,255,0.01)', padding: '8px', borderRadius: '6px', fontSize: '10px' }}>
{`element:        ${info.tag}${info.id ? '#' + info.id : ''}${info.className ? '.' + info.className.split(' ').join('.') : ''}
isHubContent:   ${info.isHub}
zIndex:         ${info.zIndex}
opacity:        ${info.opacity}
pointerEvents:  ${info.pointerEvents}
visibility:     ${info.visibility}
display:        ${info.display}
`}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: RECOVERY TOOLS */}
            {activeTab === 'recovery' && (
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: 'rgb(168, 85, 247)', fontSize: '12px' }}>FORCE RECOVERY ACTIONS</h3>
                <p style={{ margin: '0 0 14px 0', color: 'rgba(255,255,255,0.45)', fontSize: '10px' }}>
                  Run these synchronous tools if the screen hangs or returns a black view.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  <button
                    onClick={() => runRecoveryAction('Force Hub Remount', forceHubRemount)}
                    style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgb(168, 85, 247)', borderRadius: '8px', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <strong>Force Hub Remount</strong>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Resets appMode to hub, unlinks transitions, and increments render key</div>
                  </button>

                  <button
                    onClick={() => runRecoveryAction('Force Transition Unlock', forceTransitionUnlock)}
                    style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <strong>Force Transition Unlock</strong>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Unlocks transition lock boolean and fires zoom reset event</div>
                  </button>

                  <button
                    onClick={() => runRecoveryAction('Force Clear Navigation Locks', forceClearNavigationLocks)}
                    style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <strong>Force Clear Navigation Locks</strong>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Clears Capacitor and store transition variables</div>
                  </button>

                  <button
                    onClick={() => runRecoveryAction('Force Clear Motion Wrappers', forceClearMotionWrappers)}
                    style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <strong>Force Clear Motion Wrappers</strong>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Locates and removes .sc-subapp-wrapper nodes directly from DOM</div>
                  </button>

                  <button
                    onClick={() => runRecoveryAction('Force Re-render Hub', forceRerenderHub)}
                    style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <strong>Force Re-render Hub Component</strong>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Triggers increment on StudioHub key directly</div>
                  </button>

                   <button
                    onClick={() => runRecoveryAction('Force Re-render Entire App', forceRerenderEntireApp)}
                    style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgb(239, 68, 68)', borderRadius: '8px', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <strong>Force Re-render Entire App</strong>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Remounts root App layout (simulates fresh restart without page reload)</div>
                  </button>

                  <button
                    onClick={() => runRecoveryAction('Force Remove Overlays', forceRemoveAllFullscreenOverlays)}
                    style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <strong>Force Remove All Fullscreen Overlays</strong>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Finds and deletes fixed/absolute overlays &gt;= 90% size directly from DOM</div>
                  </button>

                  <button
                    onClick={() => runRecoveryAction('Force Hub Visibility', forceHubVisibility)}
                    style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '8px', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <strong>Force Hub Visibility</strong>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>Sets opacity=1, visibility=visible, display=block on all Hub containers</div>
                  </button>

                  <button
                    onClick={() => {
                      toggleSimulateBlackScreen();
                      setTick(t => t + 1);
                    }}
                    style={{
                      padding: '12px',
                      background: isBlackScreenSimulated ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.04)',
                      border: isBlackScreenSimulated ? '1px solid rgb(239, 68, 68)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <strong>Simulate Black Screen Layer</strong>
                    <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>
                      {isBlackScreenSimulated ? '🔴 Active (Tap to remove)' : '🖤 Inactive (Tap to simulate)'}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* TAB: AUTO CAPTURES */}
            {activeTab === 'captures' && (
              <div>
                {/* HUB_ROOT_MISSING_CAPTURE Section */}
                {hubRootMissingCapture && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ color: '#ff8a8a', fontSize: '10px' }}>⚠️ HUB_ROOT_MISSING CAPTURE</strong>
                      <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>
                        {new Date(hubRootMissingCapture.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre style={{ margin: '0 0 8px 0', background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '4px', fontSize: '9px', overflowX: 'auto' }}>
{`previousApp:     ${hubRootMissingCapture.previousApp}
stableKey:       ${hubRootMissingCapture.stableKey}
transitionState: ${hubRootMissingCapture.transitionState}
activeSubApp:    ${hubRootMissingCapture.activeSubApp}`}
                    </pre>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(hubRootMissingCapture, null, 2), 'HUB_ROOT_MISSING_CAPTURE')}
                        style={{ flex: 1, padding: '6px', background: 'rgba(239, 68, 68, 0.2)', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '9px', cursor: 'pointer' }}
                      >
                        Copy Capture
                      </button>
                      <button
                        onClick={() => {
                          try {
                            localStorage.removeItem('HUB_ROOT_MISSING_CAPTURE');
                            setHubRootMissingCapture(null);
                            setToastMsg('Capture Cleared');
                            setTimeout(() => setToastMsg(null), 2000);
                          } catch (_) {}
                        }}
                        style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)', borderRadius: '4px', fontSize: '9px', cursor: 'pointer' }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, color: 'rgb(168, 85, 247)', fontSize: '12px' }}>BLACK SCREEN AUTO CAPTURES ({autoCaptures.length}/20)</h3>
                  <button
                    onClick={() => {
                      try {
                        localStorage.removeItem('studio_auto_captures');
                        setAutoCaptures([]);
                        setToastMsg('Captures Cleared');
                        setTimeout(() => setToastMsg(null), 2000);
                      } catch (_) {}
                    }}
                    style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ff8a8a', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', cursor: 'pointer' }}
                  >
                    CLEAR ALL
                  </button>
                </div>

                {autoCaptures.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>
                    No auto-captures logged yet. Watchdog is monitoring...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {autoCaptures.map((entry, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div
                          onClick={() => setActiveCaptureIdx(activeCaptureIdx === idx ? null : idx)}
                          style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}
                        >
                          <div>
                            <strong>{new Date(entry.timestamp).toLocaleTimeString()}</strong>
                            <span style={{ marginLeft: '10px', color: 'rgba(255,255,255,0.45)', fontSize: '9px' }}>{entry.navigationPath}</span>
                          </div>
                          <span style={{ fontSize: '10px' }}>{activeCaptureIdx === idx ? '▲' : '▼'}</span>
                        </div>

                        {activeCaptureIdx === idx && (
                          <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                              <span style={{ color: 'rgb(168, 85, 247)' }}>Blocker Detected:</span>
                              <pre style={{ margin: '4px 0 0 0', background: 'rgba(0,0,0,0.20)', padding: '6px', borderRadius: '4px', fontSize: '10px' }}>
                                {entry.blockerDetectionResult}
                              </pre>
                            </div>

                            <div>
                              <span style={{ color: 'rgb(168, 85, 247)' }}>DOM Tree Snapshot Summary:</span>
                              <pre style={{ margin: '4px 0 0 0', background: 'rgba(0,0,0,0.20)', padding: '6px', borderRadius: '4px', fontSize: '9px', overflowX: 'auto' }}>
                                {entry.domSummary}
                              </pre>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <button
                                onClick={() => copyToClipboard(JSON.stringify(entry.fullPayload.diagnostics, null, 2), 'Diagnostics Data')}
                                style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                              >
                                Copy State
                              </button>
                              <button
                                onClick={() => copyToClipboard(entry.fullPayload.domTree, 'DOM Tree')}
                                style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                              >
                                Copy DOM Tree
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: DOM TREE DUMP */}
            {activeTab === 'dom' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, color: 'rgb(168, 85, 247)', fontSize: '12px' }}>SIMPLIFIED DOM TREE</h3>
                  <button
                    onClick={() => {
                      const tree = generateSimplifiedDOMTree();
                      copyToClipboard(tree, 'DOM Tree');
                    }}
                    style={{ background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgb(168, 85, 247)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                  >
                    DUMP DOM TREE
                  </button>
                </div>
                <p style={{ margin: '0 0 10px 0', color: 'rgba(255,255,255,0.45)', fontSize: '10px' }}>
                  This lists all currently visible nodes in the DOM, including z-index, opacity, and dimensions.
                </p>
                <pre style={{ margin: 0, background: 'rgba(0,0,0,0.30)', padding: '12px', borderRadius: '8px', fontSize: '9px', maxHeight: '320px', overflow: 'auto', border: '1px solid rgba(255,255,255,0.04)' }}>
                  {generateSimplifiedDOMTree()}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    overlayRoot
  );
}

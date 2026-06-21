import React, { useState, useEffect, useRef } from 'react';
import { useChordStore } from '@workspace/studio-core';

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

export default function EmergencyDebugOverlay() {
  const { settings, updateSettings } = useChordStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'blockers' | 'recovery' | 'captures' | 'dom'>('status');
  
  // Local state for live state updates
  const [tick, setTick] = useState(0);
  const [autoCaptures, setAutoCaptures] = useState<AutoCaptureEntry[]>([]);
  const [activeCaptureIdx, setActiveCaptureIdx] = useState<number | null>(null);

  // ── GESTURE AND TRIGGER LOGIC ──────────────────────────────────────────
  useEffect(() => {
    // 1. Triple tap gesture on window
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

    // 2. Long press gesture on window (1.5 seconds)
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    const handlePointerDown = (e: PointerEvent) => {
      if (pressTimer) clearTimeout(pressTimer);
      // Only trigger if long press happens on empty area or general container,
      // avoiding blocking interactive controls
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
    window.addEventListener('pointermove', handlePointerUp); // cancel long press on drag

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

  // Load Auto Captures from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('studio_auto_captures');
      if (stored) {
        setAutoCaptures(JSON.parse(stored));
      }
    } catch (_) {}
  }, []);

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

    const hubRoot = document.querySelector('[data-livex-hub-root="true"]');
    const hubRootFound = !!hubRoot;

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
    const lastAction = trace.length > 0 ? trace[trace.length - 1] : null;

    const blockers = getVisualBlockers();

    return {
      timestamp: Date.now(),
      appMode: currentAppMode,
      activeSubApp: currentAppMode !== 'hub' ? currentAppMode : 'none',
      transitionActive: (window as any).studioTransitionActive || false,
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
      // Ignore this debug overlay container
      if (el.id === 'emergency-debug-overlay-container' || el.closest('#emergency-debug-overlay-container')) {
        return;
      }

      const style = window.getComputedStyle(el);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0.01;
      if (!isVisible) return;

      const rect = el.getBoundingClientRect();
      const hasDimensions = rect.width > 0 && rect.height > 0;
      if (!hasDimensions) return;

      const indent = '  '.repeat(depth);
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = el.className ? `.${Array.from(el.classList).join('.')}` : '';
      const zIndex = style.zIndex !== 'auto' ? ` [z:${style.zIndex}]` : '';
      const opacity = style.opacity !== '1' ? ` [o:${style.opacity}]` : '';
      const pointerEvents = style.pointerEvents !== 'auto' ? ` [pe:${style.pointerEvents}]` : '';
      const dimensions = ` (${Math.round(rect.width)}x${Math.round(rect.height)})`;

      output += `${indent}${tag}${id}${classes}${dimensions}${zIndex}${opacity}${pointerEvents}\n`;

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
        alert(`Success: ${label} copied to clipboard!`);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert(`Success: ${label} copied to clipboard (fallback)!`);
      }
    } catch (e) {
      alert(`Error: Failed to copy: ${e}`);
    }
  };

  // ── AUTO CAPTURE WATCHDOG ───────────────────────────────────────────────
  const lastCaptureTimeRef = useRef(0);
  useEffect(() => {
    const checkAndAutoCapture = () => {
      const currentAppMode = settings.appMode || 'hub';
      if (currentAppMode !== 'hub') return;

      // Throttle captures to once every 5 seconds
      const now = Date.now();
      if (now - lastCaptureTimeRef.current < 5000) return;

      const diagnostics = getDiagnosticsPayload();
      
      const hubRootMissing = !diagnostics.hub.rootFound;
      const centerEl = diagnostics.blockers.center;
      const isScreenBlank = centerEl.tag === 'body' || centerEl.tag === 'html' || 
                           (diagnostics.hub.mounted && !diagnostics.hub.visible) ||
                           parseFloat(diagnostics.hub.opacity) === 0;

      if (hubRootMissing || isScreenBlank) {
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
      }
    };

    const interval = setInterval(checkAndAutoCapture, 1500);
    return () => clearInterval(interval);
  }, [settings.appMode]);

  // ── FORCE RECOVERY ACTIONS ──────────────────────────────────────────────
  const runRecoveryAction = (actionName: string, actionFn: () => void) => {
    try {
      actionFn();
      alert(`Success: Action "${actionName}" completed successfully.`);
      setTick(t => t + 1);
    } catch (e) {
      alert(`Error: Action "${actionName}" failed: ${e}`);
    }
  };

  const forceHubRemount = () => {
    (window as any).studioTransitionActive = false;
    updateSettings({ appMode: 'hub' });
    if (typeof (window as any).__forceRemountHub === 'function') {
      (window as any).__forceRemountHub();
    }
    // Remove stuck DOM nodes representing subapps
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

  // Gather live diagnostics
  const data = getDiagnosticsPayload();

  return (
    <div id="emergency-debug-overlay-container">
      {/* Draggable Pinned Floating Pill Trigger */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          padding: '6px 12px',
          background: isOpen ? 'rgba(239, 68, 68, 0.85)' : 'rgba(147, 51, 234, 0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '12px',
          fontSize: '11px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          color: '#fff',
          zIndex: 999999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          cursor: 'pointer'
        }}
      >
        {isOpen ? '[CLOSE DEBUG]' : '⚡ LIVE DIAGNOSTICS'}
      </button>

      {/* Main Debug Panel Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: '16px',
            background: 'rgba(10, 10, 14, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            zIndex: 999998,
            boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
            display: 'flex',
            flexDirection: 'column',
            color: '#fff',
            fontFamily: 'monospace',
            overflow: 'hidden'
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
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
                Livex Android v3.6.58 (Code 85)
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
            {(['status', 'blockers', 'recovery', 'captures', 'dom'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setActiveCaptureIdx(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px 6px',
                  background: activeTab === tab ? 'rgba(147, 51, 234, 0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid rgb(168, 85, 247)' : '2px solid transparent',
                  color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.5)',
                  fontSize: '11px',
                  fontWeight: activeTab === tab ? 'bold' : 'normal',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  minWidth: '80px'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Section Body View */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', fontSize: '11px', lineHeight: '1.4' }}>
            
            {/* TAB: STATUS */}
            {activeTab === 'status' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: 'rgb(168, 85, 247)', fontSize: '12px' }}>NAVIGATION STATE</h3>
                  <pre style={{ margin: 0, background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
{`appMode:           ${data.appMode}
activeSubApp:      ${data.activeSubApp}
transitionActive:  ${data.transitionActive}
hubRenderKey:      ${useChordStore.getState().settings.appMode === 'hub' ? 'N/A' : 'derived'}
`}
                  </pre>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: 'rgb(168, 85, 247)', fontSize: '12px' }}>HUB CONTAINER DETAILS</h3>
                  <pre style={{ margin: 0, background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
{`mounted:           ${data.hub.mounted}
visible:           ${data.hub.visible}
opacity:           ${data.hub.opacity}
transform:         ${data.hub.transform}
rootFound:         ${data.hub.rootFound}
`}
                  </pre>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: 'rgb(168, 85, 247)', fontSize: '12px' }}>SUB-APP WRAPPER DETAILS</h3>
                  <pre style={{ margin: 0, background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
{`mounted:           ${data.subappWrapper.mounted}
opacity:           ${data.subappWrapper.opacity}
zIndex:            ${data.subappWrapper.zIndex}
pointerEvents:     ${data.subappWrapper.pointerEvents}
`}
                  </pre>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: 'rgb(168, 85, 247)', fontSize: '12px' }}>REACT LIFECYCLE</h3>
                  <pre style={{ margin: 0, background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
{`suspenseFallbackActive: ${data.reactState.suspenseFallbackActive}
errorBoundaryActive:    ${data.reactState.errorBoundaryActive}
`}
                  </pre>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px 0', color: 'rgb(168, 85, 247)', fontSize: '12px' }}>LAST TRANSITION EVENT</h3>
                  <pre style={{ margin: 0, background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
                    {data.lastNavigationAction ? JSON.stringify(data.lastNavigationAction, null, 2) : 'No transitions logged.'}
                  </pre>
                </div>
              </div>
            )}

            {/* TAB: BLOCKERS */}
            {activeTab === 'blockers' && (
              <div>
                <h3 style={{ margin: '0 0 10px 0', color: 'rgb(168, 85, 247)', fontSize: '12px' }}>ELEMENT HIT-TEST AT 5 KEY COORDINATES</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(data.blockers).map(([pos, info]) => (
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
                </div>
              </div>
            )}

            {/* TAB: AUTO CAPTURES */}
            {activeTab === 'captures' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, color: 'rgb(168, 85, 247)', fontSize: '12px' }}>BLACK SCREEN AUTO CAPTURES ({autoCaptures.length}/20)</h3>
                  <button
                    onClick={() => {
                      try {
                        localStorage.removeItem('studio_auto_captures');
                        setAutoCaptures([]);
                        alert('Auto-captures cleared.');
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
    </div>
  );
}

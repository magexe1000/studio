import { type AppKey } from '@workspace/studio-core';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  useChordStore,
  ACCENT_COLORS,
  useIsWebDesktop,
  useStudioPreferences,
  logActivity,
  resetNav,
  setNavHidden,
  setNavLocked
} from '@workspace/studio-core';

import {
  SmartLoading,
  StudioHubSkeleton,
  VocalexTakesSkeleton,
  GroovexAppSkeleton,
  StagexPanelSkeleton,
  DrumEditorSkeleton,
  ChordexPanelSkeleton,
  ChordexLogo,
  DrumexLogo,
  StagexLogoIcon,
  GroovexLogo,
  VocalexLogo,
  AppEntryTransition,
  LibraryPanel,
  ChordPanel,
  SettingsPanel,
  SongsPanel,
  DrumEditor,
  GroovexApp,
  VocalexApp,
  StageCorePanel,
  ErrorBoundary
} from '@workspace/ui-shared';

import {
  WebSidebarLayout,
  SidebarProvider,
  SidebarInset,
  useSidebar,
  WebAppSectionDock,
  StudioLandingPage
} from '@workspace/ui-web';

import "./index.css";

const StudioHub = lazy(() => import('@workspace/ui-shared').then(m => ({ default: m.StudioHub })));

function SidebarHoverSync({ hoverShowSidebar }: { hoverShowSidebar: boolean }) {
  const { setOpen } = useSidebar();
  useEffect(() => {
    setOpen(hoverShowSidebar);
  }, [hoverShowSidebar, setOpen]);
  return null;
}

type AccountState =
  | { phase: 'unknown' }
  | { phase: 'signedOut' }
  | { phase: 'active'; user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } }
  | { phase: 'pending'; user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }; scheduledAtMs: number }
  | { phase: 'disabled'; user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null } };

const NAV_ORDER = ['songs', 'library', 'chord', 'settings'] as const;
const ALL_PANELS = ['library', 'chord', 'songs', 'settings'] as const;

export default function App() {
  const { activePanel, settings, setActivePanel, activePresetId, updateSettings } = useChordStore();
  const { preferences } = useStudioPreferences();

  const returnToStudioHub = useCallback((isSwipeSuccess = false) => {
    // 1. Close active modals/sheets/overlays
    window.dispatchEvent(new CustomEvent('studio:close-all-sheets'));
    window.dispatchEvent(new CustomEvent('studio:close-all-modals'));
    document.querySelectorAll('.modal-backdrop, .overlay').forEach(el => {
      if (el.id !== 'update-fade-overlay') {
        el.remove();
      }
    });
    document.documentElement.classList.remove('has-modal-open');

    // 2. Set transition active lock
    (window as any).studioTransitionActive = true;

    // Reset Hub's zoom/opacity animation state immediately so it starts fading in as the sub-app exits
    window.dispatchEvent(new CustomEvent('studio:reset-hub-zooming'));

    // 3. Clear selected/active app state, reset animation locks & return to Hub after transition
    updateSettings({ appMode: 'hub' });
    
    // Reset nested views to defaults if rememberLastAppSection is disabled
    if (!preferences.rememberLastAppSection) {
      const storeState = useChordStore.getState();
      storeState.setActivePanel(storeState.settings.defaultTab ?? 'library');
      storeState.setLastSession({
        vocalexTab: 'practice',
        drumexTab: storeState.settings.defaultDrumTab ?? 'songs',
        stagexView: storeState.settings.defaultStageView ?? 'Editor',
      });

      import('@workspace/ui-shared')
        .then(({ useGroovexStore }) => {
          useGroovexStore.getState().setView('library');
        })
        .catch(() => {});
    }

    setTimeout(() => {
      (window as any).studioTransitionActive = false;
    }, 370);
  }, [updateSettings, preferences.rememberLastAppSection]);

  const returnToStudioHubRef = useRef(returnToStudioHub);
  useEffect(() => {
    returnToStudioHubRef.current = returnToStudioHub;
  }, [returnToStudioHub]);

  // Export to window object so external sub-apps can call it directly
  useEffect(() => {
    (window as any).returnToStudioHub = returnToStudioHub;
    return () => {
      delete (window as any).returnToStudioHub;
    };
  }, [returnToStudioHub]);

  // Backward compatibility listener for studio-hub-return CustomEvent
  useEffect(() => {
    const handler = () => {
      returnToStudioHubRef.current();
    };
    window.addEventListener('studio-hub-return', handler);
    return () => window.removeEventListener('studio-hub-return', handler);
  }, []);

  const [route, setRoute] = useState(() => {
    if (typeof window === 'undefined') return '/';
    const path = window.location.pathname;
    if (path === '/app' || path.startsWith('/app/')) return '/app';
    return '/';
  });

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setRoute(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/app' || path.startsWith('/app/')) {
        setRoute('/app');
      } else {
        setRoute('/');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (route === '/') {
      document.documentElement.classList.add('landing-route');
      document.documentElement.classList.remove('app-route');
    } else {
      document.documentElement.classList.add('app-route');
      document.documentElement.classList.remove('landing-route');
      
      const intro = document.getElementById('intro');
      if (intro && (window as any).__introReturnedEarly) {
        intro.style.transition = 'opacity 500ms ease-out';
        intro.style.opacity = '0';
        setTimeout(() => {
          intro.classList.add('dismissed');
          if (intro.parentNode) intro.parentNode.removeChild(intro);
        }, 550);
        (window as any).__introDone = true;
        window.dispatchEvent(new Event('studio-intro-done'));
      }
    }
  }, [route]);

  const isWebDesktop = useIsWebDesktop();
  const { preferences } = useStudioPreferences();
  const [isLargeDesktop, setIsLargeDesktop] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  });

  useEffect(() => {
    if (!isWebDesktop) return;
    const handleResize = () => {
      setIsLargeDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isWebDesktop]);

  const [hoverShowSidebar, setHoverShowSidebar] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);

  const handleSidebarMouseEnter = useCallback(() => {
    if (!isWebDesktop) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverShowSidebar(true);
  }, [isWebDesktop]);

  const handleSidebarMouseLeave = useCallback(() => {
    if (!isWebDesktop) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setHoverShowSidebar(false);
    }, 180);
  }, [isWebDesktop]);

  const handleLeftEdgeMouseEnter = useCallback(() => {
    if (!isWebDesktop) return;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverShowSidebar(true);
  }, [isWebDesktop]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const shouldHideSidebar = isWebDesktop && !hoverShowSidebar;

  const [accountState, setAccountState] = useState<AccountState>({ phase: 'unknown' });
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    let active = true;
    const initAuth = async () => {
      try {
        const { supabase } = await import('@workspace/studio-core');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!active) return;
        setSession(currentSession);
        
        if (currentSession?.user) {
          const { getAccountDoc } = await import('@workspace/studio-core');
          const doc = await getAccountDoc(currentSession.user.id);
          if (!active) return;
          const status = doc || { status: 'active', scheduledAtMs: null };
          if (status.status === 'pending_deletion') {
            setAccountState({
              phase: 'pending',
              user: currentSession.user as any,
              scheduledAtMs: status.scheduledAtMs || Date.now()
            });
          } else if (status.status === 'disabled') {
            setAccountState({ phase: 'disabled', user: currentSession.user as any });
          } else {
            setAccountState({ phase: 'active', user: currentSession.user as any });
          }
        } else {
          setAccountState({ phase: 'signedOut' });
        }
      } catch (err) {
        console.error('Failed to init auth:', err);
        if (active) setAccountState({ phase: 'signedOut' });
      }
    };

    initAuth();
    return () => { active = false; };
  }, []);

  const appMode = settings.appMode || 'hub';
  const isSubAppActive = appMode !== 'hub';

  if (route === '/') {
    return <StudioLandingPage navigateTo={navigateTo} />;
  }

  const activeAppToRender = isSubAppActive ? appMode : null;

  return (
    <SidebarProvider>
      <SidebarHoverSync hoverShowSidebar={hoverShowSidebar} />
      <div style={{ display: 'flex', width: '100vw', height: '100dvh', overflow: 'hidden', background: 'var(--app-bg)' }}>
        {isWebDesktop && (
          <div
            onMouseEnter={handleSidebarMouseEnter}
            onMouseLeave={handleSidebarMouseLeave}
            style={{ display: 'flex', height: '100%' }}
          >
            <WebSidebarLayout shouldHideSidebar={shouldHideSidebar} />
          </div>
        )}
        
        <SidebarInset>
          {isWebDesktop && !hoverShowSidebar && (
            <div
              onMouseEnter={handleLeftEdgeMouseEnter}
              onMouseLeave={handleSidebarMouseLeave}
              style={{
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                width: '12px',
                zIndex: 9999,
                background: 'transparent',
              }}
            />
          )}

          <div
            className="app-main-layout"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              height: '100dvh',
              overflow: 'hidden',
              pointerEvents: isSubAppActive ? 'none' : 'auto',
            }}
          >
            <Suspense fallback={<SmartLoading fallbackSkeleton={<StudioHubSkeleton />} />}>
              <StudioHub />
            </Suspense>
          </div>

          <AnimatePresence mode="popLayout">
            {isSubAppActive && (
              <motion.div
                key={activeAppToRender || 'none'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  background: 'var(--app-bg)',
                  pointerEvents: activeAppToRender === null ? 'none' : 'auto',
                }}
              >
                {activeAppToRender === 'groovex' && (
                  <div className="app-sub-app-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                    <ErrorBoundary moduleName="Groovex">
                      <Suspense fallback={<SmartLoading fallbackSkeleton={<GroovexAppSkeleton />} />}><AppEntryTransition><GroovexApp /></AppEntryTransition></Suspense>
                    </ErrorBoundary>
                  </div>
                )}

                {activeAppToRender === 'vocalex' && (
                  <div className="app-sub-app-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                    <ErrorBoundary moduleName="Vocalex">
                      <Suspense fallback={<SmartLoading fallbackSkeleton={<VocalexTakesSkeleton />} />}><AppEntryTransition><VocalexApp /></AppEntryTransition></Suspense>
                    </ErrorBoundary>
                  </div>
                )}

                {activeAppToRender === 'stage' && (
                  <div className="app-sub-app-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                    <ErrorBoundary moduleName="Stagex">
                      <Suspense fallback={<SmartLoading fallbackSkeleton={<StagexPanelSkeleton />} />}><AppEntryTransition><StageCorePanel /></AppEntryTransition></Suspense>
                    </ErrorBoundary>
                  </div>
                )}

                {activeAppToRender === 'drums' && (
                  <div className="app-sub-app-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                    <ErrorBoundary moduleName="Drumex"><Suspense fallback={<SmartLoading fallbackSkeleton={<DrumEditorSkeleton />} />}><AppEntryTransition><DrumEditor /></AppEntryTransition></Suspense></ErrorBoundary>
                  </div>
                )}

                {activeAppToRender === 'chords' && (
                  <div className="app-sub-app-container" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', userSelect: 'none', background: 'var(--app-bg)' }}>
                    <AppEntryTransition
                      className="flex flex-col w-full overflow-hidden select-none app-bg"
                      style={{
                        position: 'relative',
                        height: '100%',
                      } as React.CSSProperties}
                    >
                      <div 
                        style={{ 
                          display: 'flex', 
                          flexDirection: (isWebDesktop && isLargeDesktop) ? 'row' : 'column', 
                          flex: 1, 
                          width: '100%', 
                          height: '100%', 
                          overflow: 'hidden' 
                        }}
                      >
                        {isWebDesktop && (
                          <WebAppSectionDock 
                            app="chords" 
                            activeSection={activePanel} 
                            onChangeSection={setActivePanel} 
                          />
                        )}
                        <div className="flex-1 overflow-hidden relative" style={{ contain: 'strict' }}>
                          {ALL_PANELS.map(panel => {
                            const isVisible = activePanel === panel;
                            if (!isVisible) return null;

                            return (
                              <div
                                key={panel}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  pointerEvents: 'auto',
                                }}
                              >
                                <ErrorBoundary moduleName="Chordex">
                                  <Suspense fallback={<SmartLoading fallbackSkeleton={<ChordexPanelSkeleton />} />}>
                                    {panel === 'library'  && <LibraryPanel />}
                                    {panel === 'chord'    && <ChordPanel />}
                                    {panel === 'songs'    && <SongsPanel />}
                                    {panel === 'settings' && <SettingsPanel />}
                                  </Suspense>
                                </ErrorBoundary>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </AppEntryTransition>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

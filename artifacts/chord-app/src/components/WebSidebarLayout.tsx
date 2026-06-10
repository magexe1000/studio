import React, { useState, useEffect, useRef } from 'react';
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarRail } from './StudioSidebar';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { useT } from '../lib/useT';
import { subscribeAuth, signOut, type AuthUser } from '../lib/auth';
import { useOtaUpdate } from '../lib/otaUpdate';
import { APP_VERSION_LABEL } from '../lib/appVersion';
import { SHORTCUT_REGISTRY, ShortcutRegistryItem } from '../lib/studioShortcutRegistry';
import { useStudioShortcuts } from '../hooks/useStudioShortcuts';

export default function WebSidebarLayout({ shouldHideSidebar }: { shouldHideSidebar: boolean }) {
  const { settings, updateSettings, activePanel, setActivePanel } = useChordStore();
  const { open, toggleSidebar } = useSidebar();
  const t = useT();
  const ota = useOtaUpdate();
  const { shortcuts, addShortcut, removeShortcut } = useStudioShortcuts();

  const handleToggleSidebar = () => {
    if (settings.appMode !== 'hub' && settings.autoHideSidebarInApps) {
      window.dispatchEvent(new CustomEvent('studio:hide-sidebar-temp'));
    } else {
      toggleSidebar();
    }
  };

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  const [activeHubTab, setActiveHubTab] = useState<'home' | 'settings' | 'profile'>('home');
  const [activeSettingsPage, setActiveSettingsPage] = useState<string>('main');

  // Listen for Hub tab active state and settings page active state
  useEffect(() => {
    const onHubTabActive = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) {
        setActiveHubTab(detail as any);
      }
    };
    const onSettingsPageActive = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) {
        setActiveSettingsPage(detail);
      }
    };
    window.addEventListener('studio:hub-tab-active', onHubTabActive);
    window.addEventListener('studio:settings-page-active', onSettingsPageActive);
    
    // Also read initial routing/page if set in session
    const savedPage = sessionStorage.getItem('studio:routeToSettingsPage');
    if (savedPage) {
      setActiveSettingsPage(savedPage);
    }
    
    return () => {
      window.removeEventListener('studio:hub-tab-active', onHubTabActive);
      window.removeEventListener('studio:settings-page-active', onSettingsPageActive);
    };
  }, []);

  // Subscribe to Authentication state
  useEffect(() => {
    return subscribeAuth((user) => {
      setAuthUser(user);
    });
  }, []);

  // Subscribe to Profile Photo updates
  useEffect(() => {
    if (!authUser?.uid) {
      setCustomPhoto(null);
      return;
    }
    try {
      const stored = localStorage.getItem(`chordex_cp_${authUser.uid}`);
      setCustomPhoto(stored || null);
    } catch {
      setCustomPhoto(null);
    }

    const onCoverChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ uid: string; cover: string | null }>).detail;
      if (detail && detail.uid === authUser.uid) {
        setCustomPhoto(detail.cover);
      }
    };
    window.addEventListener('chordex:user-cover-changed', onCoverChanged);
    return () => {
      window.removeEventListener('chordex:user-cover-changed', onCoverChanged);
    };
  }, [authUser?.uid]);

  // Click outside to close shortcut add menu
  useEffect(() => {
    if (!showAddMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAddMenu]);

  // Determine active accent color
  const activeVis = settings.perApp?.[settings.appMode ?? 'hub'] ?? {
    theme: settings.theme ?? 'dark',
    accentColor: settings.accentColor ?? 'blue',
    amoledMode: settings.amoledMode ?? false,
  };
  const accent = ACCENT_COLORS[activeVis.accentColor] ?? ACCENT_COLORS.blue;

  // Navigation handlers
  const handleGoToHub = (tab: 'home' | 'settings' | 'profile') => {
    updateSettings({ appMode: 'hub' });
    window.dispatchEvent(new CustomEvent('studio:set-hub-tab', { detail: tab }));
    if (tab === 'settings') {
      sessionStorage.setItem('studio:routeToSettingsPage', 'main');
      window.dispatchEvent(new CustomEvent('studio:update-settings-page', { detail: 'main' }));
    }
  };

  const handleGoToSettingsPage = (page: string) => {
    updateSettings({ appMode: 'hub' });
    window.dispatchEvent(new CustomEvent('studio:set-hub-tab', { detail: 'settings' }));
    sessionStorage.setItem('studio:routeToSettingsPage', page);
    window.dispatchEvent(new CustomEvent('studio:update-settings-page', { detail: page }));
  };

  const handleLaunchApp = (app: 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex') => {
    updateSettings({ appMode: app });
  };

  const handleSetChordexPanel = (panel: 'songs' | 'library' | 'chord') => {
    if (settings.appMode !== 'chords') {
      updateSettings({ appMode: 'chords' });
    }
    setActivePanel(panel);
  };

  const handleExecuteShortcut = (target: ShortcutRegistryItem) => {
    switch (target.type) {
      case 'hub':
        handleGoToHub(target.payload as 'home' | 'settings' | 'profile');
        break;
      case 'app':
        handleLaunchApp(target.payload as 'chords' | 'drums' | 'stage' | 'groovex' | 'vocalex');
        break;
      case 'settings':
        handleGoToSettingsPage(target.payload);
        break;
      case 'chordex-panel':
        handleSetChordexPanel(target.payload as 'songs' | 'library' | 'chord');
        break;
    }
  };

  const isShortcutActive = (target: ShortcutRegistryItem) => {
    if (target.type === 'app') {
      return settings.appMode === target.payload;
    }
    if (target.type === 'chordex-panel') {
      return settings.appMode === 'chords' && activePanel === target.payload;
    }
    if (target.type === 'hub') {
      return settings.appMode === 'hub' && activeHubTab === target.payload;
    }
    if (target.type === 'settings') {
      return settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === target.payload;
    }
    return false;
  };

  // Render icons (SVG custom or fallback Material symbol)
  const renderShortcutIcon = (iconName: string) => {
    switch (iconName) {
      case 'chordex':
        return <ChordexLogo size={20} />;
      case 'drumex':
        return <DrumexLogo size={20} />;
      case 'stagex':
        return <StagexLogoIcon size={20} />;
      case 'groovex':
        return <GroovexLogo size={20} />;
      case 'vocalex':
        return <VocalexLogo size={20} />;
      default:
        return (
          <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>
            {iconName}
          </span>
        );
    }
  };

  // User details
  const name = authUser?.displayName || authUser?.email || '';
  const email = authUser?.email || '';
  const photo = customPhoto || authUser?.photoURL;
  const initial = (name[0] ?? 'S').toUpperCase();

  // Helper variables to pass accent color styling dynamically
  const accentVars = {
    '--studio-accent-from': accent.from,
    '--studio-accent-to': accent.to,
  } as React.CSSProperties;

  // Filter available targets for add menu (exclude current, filter developer settings)
  const availableTargets = SHORTCUT_REGISTRY.filter(target => {
    if (shortcuts.includes(target.id)) return false;
    if (target.id === 'settings_developer' && !settings.developerMode) return false;
    return true;
  });

  return (
    <Sidebar shouldHideSidebar={shouldHideSidebar} style={accentVars}>
      {/* Header */}
      <SidebarHeader>
        {open ? (
          <>
            <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => handleGoToHub('home')}>
              <div className="flex-shrink-0">
                <StudioLogo size={28} />
              </div>
              <span
                className="font-extrabold text-base tracking-tight text-[var(--c-text-primary)]"
                style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}
              >
                Studio
              </span>
            </div>
            <button
              onClick={handleToggleSidebar}
              className="p-1.5 rounded-lg bg-transparent text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)] hover:bg-[rgba(255,255,255,0.06)] border-none cursor-pointer flex items-center justify-center outline-none"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                menu_open
              </span>
            </button>
          </>
        ) : (
          <button
            onClick={handleToggleSidebar}
            className="p-2 rounded-xl bg-transparent text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)] hover:bg-[rgba(255,255,255,0.06)] border-none cursor-pointer flex items-center justify-center outline-none"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              menu
            </span>
          </button>
        )}
      </SidebarHeader>

      {/* Main content scroll */}
      <SidebarContent>
        {/* Studio Apps Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Studio Apps</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'hub'}
                onClick={() => handleGoToHub('home')}
                tooltip="Hub Home"
              >
                <div className="flex-shrink-0" style={{ opacity: settings.appMode === 'hub' ? 1 : 0.65 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>home</span>
                </div>
                {open && <span className="truncate">Studio Hub</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'chords'}
                onClick={() => handleLaunchApp('chords')}
                tooltip="Chordex"
              >
                <div className="flex-shrink-0">
                  <ChordexLogo size={20} />
                </div>
                {open && <span className="truncate">Chordex</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'drums'}
                onClick={() => handleLaunchApp('drums')}
                tooltip="Drumex"
              >
                <div className="flex-shrink-0">
                  <DrumexLogo size={20} />
                </div>
                {open && <span className="truncate">Drumex</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'stage'}
                onClick={() => handleLaunchApp('stage')}
                tooltip="Stagex"
              >
                <div className="flex-shrink-0">
                  <StagexLogoIcon size={20} />
                </div>
                {open && <span className="truncate">Stagex</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'groovex'}
                onClick={() => handleLaunchApp('groovex')}
                tooltip="Groovex"
              >
                <div className="flex-shrink-0">
                  <GroovexLogo size={20} />
                </div>
                {open && <span className="truncate">Groovex</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'vocalex'}
                onClick={() => handleLaunchApp('vocalex')}
                tooltip="Vocalex"
              >
                <div className="flex-shrink-0">
                  <VocalexLogo size={20} />
                </div>
                {open && <span className="truncate">Vocalex</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Shortcuts Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Shortcuts</SidebarGroupLabel>
          <SidebarMenu>
            {/* Active shortcuts */}
            {shortcuts.map(id => {
              const target = SHORTCUT_REGISTRY.find(item => item.id === id);
              if (!target) return null;
              const isActive = isShortcutActive(target);

              return (
                <SidebarMenuItem key={target.id} className="relative group">
                  <SidebarMenuButton
                    active={isActive}
                    onClick={() => handleExecuteShortcut(target)}
                    tooltip={target.label}
                  >
                    <div className="flex-shrink-0">
                      {renderShortcutIcon(target.icon)}
                    </div>
                    {open && <span className="truncate pr-6">{target.label}</span>}
                  </SidebarMenuButton>
                  {open && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        removeShortcut(target.id);
                      }}
                      title="Remove Shortcut"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md bg-transparent border-none text-[var(--c-text-secondary)] hover:text-rose-500 hover:bg-[rgba(255,255,255,0.06)] cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity outline-none z-10"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        close
                      </span>
                    </button>
                  )}
                </SidebarMenuItem>
              );
            })}

            {/* Empty State */}
            {!shortcuts.length && open && (
              <div
                className="px-3 py-2.5 text-xs text-[var(--c-text-muted)] italic leading-snug"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                No shortcuts yet. Add shortcuts to jump into Studio faster.
              </div>
            )}

            {/* Add shortcut action */}
            <SidebarMenuItem className="relative">
              <div ref={addMenuRef}>
                <SidebarMenuButton
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  tooltip="Add Shortcut"
                >
                  <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>add_circle</span>
                  </div>
                  {open && <span className="truncate text-[var(--c-text-secondary)]">Add Shortcut...</span>}
                </SidebarMenuButton>

                {/* Popover list */}
                {showAddMenu && (
                  <div
                    className="absolute left-full top-0 ml-2 w-56 rounded-xl border border-[rgba(128,128,128,0.15)] shadow-2xl p-2 z-[60]"
                    style={{
                      background: 'var(--app-surface)',
                      backdropFilter: 'blur(30px)',
                      WebkitBackdropFilter: 'blur(30px)',
                    }}
                  >
                    <div
                      className="text-[10px] font-extrabold tracking-wider uppercase opacity-45 px-2.5 py-1.5 border-b border-[rgba(128,128,128,0.06)] mb-1"
                      style={{ letterSpacing: '0.12em', fontFamily: 'Manrope, sans-serif' }}
                    >
                      Choose Target
                    </div>
                    <div className="max-h-60 overflow-y-auto no-scrollbar space-y-0.5">
                      {availableTargets.length === 0 ? (
                        <div className="text-xs text-[var(--c-text-muted)] text-center py-3">
                          All shortcuts added
                        </div>
                      ) : (
                        availableTargets.map(target => (
                          <button
                            key={target.id}
                            onClick={() => {
                              addShortcut(target.id);
                              setShowAddMenu(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border-none text-left cursor-pointer hover:bg-[rgba(255,255,255,0.06)] text-[var(--c-text-primary)] bg-transparent outline-none transition-colors"
                          >
                            <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                              {renderShortcutIcon(target.icon)}
                            </div>
                            <span
                              className="text-xs font-semibold truncate"
                              style={{ fontFamily: 'Manrope, sans-serif' }}
                            >
                              {target.label}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Preferences Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Preferences</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'main'}
                onClick={() => handleGoToHub('settings')}
                tooltip="General Preferences"
              >
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>settings</span>
                </div>
                {open && <span className="truncate">General Preferences</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'appearance'}
                onClick={() => handleGoToSettingsPage('appearance')}
                tooltip="Appearance"
              >
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>palette</span>
                </div>
                {open && <span className="truncate">Appearance</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'language'}
                onClick={() => handleGoToSettingsPage('language')}
                tooltip="Language"
              >
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>language</span>
                </div>
                {open && <span className="truncate">Language</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'updater'}
                onClick={() => handleGoToSettingsPage('updater')}
                tooltip="App Updates"
              >
                <div className="flex-shrink-0 relative">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>download</span>
                  {ota.updateAvailable && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border border-black" />
                  )}
                </div>
                {open && (
                  <span className="truncate flex items-center gap-2">
                    App Updates
                    {ota.updateAvailable && (
                      <span className="bg-rose-500/20 text-rose-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">New</span>
                    )}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {settings.developerMode && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'developer'}
                  onClick={() => handleGoToSettingsPage('developer')}
                  tooltip="Developer Options"
                >
                  <div className="flex-shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>terminal</span>
                  </div>
                  {open && <span className="truncate">Developer Options</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'help'}
                onClick={() => handleGoToSettingsPage('help')}
                tooltip="Help & FAQ"
              >
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>help</span>
                </div>
                {open && <span className="truncate">Help & FAQ</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarMenu>
          {/* User Profile */}
          <SidebarMenuItem>
            <div className={`flex items-center ${open ? 'gap-2.5 p-1.5' : 'justify-center p-0'} overflow-hidden`}>
              <div
                onClick={() => handleGoToHub('profile')}
                className="flex-shrink-0 cursor-pointer"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: photo ? 'transparent' : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#fff',
                  overflow: 'hidden',
                  boxShadow: `0 0 0 2px ${accent.from}22`,
                }}
              >
                {photo ? (
                  <img src={photo} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : authUser ? (
                  <span>{initial}</span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fff' }}>account_circle</span>
                )}
              </div>

              {open && (
                <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    onClick={() => handleGoToHub('profile')}
                    className="truncate font-bold text-xs text-[var(--c-text-primary)] cursor-pointer hover:underline"
                    style={{ fontFamily: 'Manrope, sans-serif' }}
                  >
                    {authUser ? (authUser.displayName || 'Studio User') : 'Guest User'}
                  </span>
                  <span className="truncate text-[10px] text-[var(--c-text-secondary)] font-medium">
                    {authUser ? email : 'Not signed in'}
                  </span>
                </div>
              )}

              {authUser && open && (
                <button
                  onClick={() => signOut()}
                  title="Sign Out"
                  className="p-1 rounded-lg bg-transparent text-[var(--c-text-secondary)] hover:text-rose-500 border-none cursor-pointer flex items-center justify-center outline-none ml-auto"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                </button>
              )}
            </div>
          </SidebarMenuItem>

          {/* Version Info */}
          {open && (
            <SidebarMenuItem>
              <div
                className="px-1.5 py-1 text-[9px] text-[var(--c-text-muted)] font-bold opacity-75"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                {APP_VERSION_LABEL}
              </div>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

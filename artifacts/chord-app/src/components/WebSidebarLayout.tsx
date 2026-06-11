import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [popoverMenuPage, setPopoverMenuPage] = useState<'main' | 'help'>('main');
  const [helpExpanded, setHelpExpanded] = useState(false);

  useEffect(() => {
    if (!showProfileMenu) {
      setPopoverMenuPage('main');
    }
  }, [showProfileMenu]);

  const profileMenuBtnStyle = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    background: 'transparent',
    border: 'none',
    color: 'var(--c-text-primary)',
    fontSize: '12.5px',
    fontWeight: 600,
    fontFamily: 'Manrope, sans-serif',
    cursor: 'pointer',
    textAlign: 'left',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'background-color 150ms ease',
  } as React.CSSProperties;

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

  // Click outside to close profile popover menu
  useEffect(() => {
    if (!showProfileMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

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
        {open && (
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md bg-transparent border-none text-[var(--c-text-secondary)] hover:text-rose-500 hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))] cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity outline-none z-10"
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
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border-none text-left cursor-pointer hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))] text-[var(--c-text-primary)] bg-transparent outline-none transition-colors"
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
        {open && (
          <SidebarGroup>
            <SidebarGroupLabel>Preferences</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'general'}
                  onClick={() => handleGoToSettingsPage('general')}
                  tooltip="General Preferences"
                >
                  <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>settings</span>
                  </div>
                  {open && <span className="truncate">General Settings</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'appearance'}
                  onClick={() => handleGoToSettingsPage('appearance')}
                  tooltip="Appearance"
                >
                  <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
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
                  <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>language</span>
                  </div>
                  {open && <span className="truncate">Language</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'profile'}
                  onClick={() => handleGoToSettingsPage('profile')}
                  tooltip="Profile & Account"
                >
                  <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>account_circle</span>
                  </div>
                  {open && <span className="truncate">Profile & Account</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        {/* Help & Support Collapsible Group */}
        {open && (
          <SidebarGroup>
            <div 
              onClick={() => setHelpExpanded(!helpExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <SidebarGroupLabel style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Help & Support
              </SidebarGroupLabel>
              <span className="material-symbols-outlined" style={{ 
                fontSize: 16, 
                color: 'var(--c-text-secondary)', 
                opacity: 0.5,
                transform: helpExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms ease',
                marginRight: '8px'
              }}>
                expand_more
              </span>
            </div>
            <AnimatePresence initial={false}>
              {helpExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <SidebarMenu style={{ paddingLeft: '8px', borderLeft: '1px solid rgba(128,128,128,0.08)', marginLeft: '12px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', opacity: 0.4, padding: '6px 8px 2px', letterSpacing: '0.08em', fontFamily: 'Manrope' }}>
                      Support
                    </div>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'help-center'}
                        onClick={() => handleGoToSettingsPage('help-center')}
                        tooltip="Help Center"
                      >
                        <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>help</span>
                        </div>
                        <span className="truncate">Help Center</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'faq'}
                        onClick={() => handleGoToSettingsPage('faq')}
                        tooltip="FAQ & Support"
                      >
                        <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>contact_support</span>
                        </div>
                        <span className="truncate">FAQ</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'release-notes'}
                        onClick={() => handleGoToSettingsPage('release-notes')}
                        tooltip="Release Notes"
                      >
                        <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>article</span>
                        </div>
                        <span className="truncate">Release Notes</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'download-apps'}
                        onClick={() => handleGoToSettingsPage('download-apps')}
                        tooltip="Download Apps"
                      >
                        <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>install_desktop</span>
                        </div>
                        <span className="truncate">Download Apps</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'keyboard-shortcuts'}
                        onClick={() => handleGoToSettingsPage('keyboard-shortcuts')}
                        tooltip="Keyboard Shortcuts"
                      >
                        <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>keyboard</span>
                        </div>
                        <span className="truncate">Keyboard Shortcuts</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', opacity: 0.4, padding: '8px 8px 2px', letterSpacing: '0.08em', fontFamily: 'Manrope' }}>
                      Legal
                    </div>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'terms'}
                        onClick={() => handleGoToSettingsPage('terms')}
                        tooltip="Terms of Service"
                      >
                        <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>gavel</span>
                        </div>
                        <span className="truncate">Terms of Service</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'privacy-policy'}
                        onClick={() => handleGoToSettingsPage('privacy-policy')}
                        tooltip="Privacy Policy"
                      >
                        <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>policy</span>
                        </div>
                        <span className="truncate">Privacy Policy</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    <div style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', opacity: 0.4, padding: '8px 8px 2px', letterSpacing: '0.08em', fontFamily: 'Manrope' }}>
                      Feedback
                    </div>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        active={settings.appMode === 'hub' && activeHubTab === 'settings' && activeSettingsPage === 'bug-report'}
                        onClick={() => handleGoToSettingsPage('bug-report')}
                        tooltip="Report a Bug"
                      >
                        <div className="flex-shrink-0" style={{ color: 'var(--c-text-secondary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18, display: 'block' }}>bug_report</span>
                        </div>
                        <span className="truncate">Report a Bug</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </motion.div>
              )}
            </AnimatePresence>
          </SidebarGroup>
        )}

        {/* Developer Group */}
        {settings.developerMode && (
          <SidebarGroup>
            <SidebarGroupLabel>Developer</SidebarGroupLabel>
            <SidebarMenu>
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
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <SidebarMenu style={{ position: 'relative' }}>
          {/* User Profile */}
          <SidebarMenuItem className="relative">
            <div ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`w-full flex items-center ${open ? 'gap-2.5 p-1.5' : 'justify-center p-0'} overflow-hidden rounded-xl border-none text-left cursor-pointer transition-colors bg-transparent hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))] outline-none`}
                style={{ outline: 'none' }}
              >
                <div
                  className="flex-shrink-0"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: photo ? 'transparent' : 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#ffffff',
                    overflow: 'hidden',
                    boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.12)',
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
                      className="truncate font-bold text-xs text-[var(--c-text-primary)]"
                      style={{ fontFamily: 'Manrope, sans-serif' }}
                    >
                      {authUser ? (authUser.displayName || 'Studio User') : 'Guest User'}
                    </span>
                    <span className="truncate text-[10px] text-[var(--c-text-secondary)] font-medium">
                      {authUser ? email : 'Not signed in'}
                    </span>
                  </div>
                )}

                {open && (
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--c-text-secondary)', marginLeft: 'auto', opacity: 0.7 }}>
                    more_vert
                  </span>
                )}
              </button>

              {/* Profile Popover Menu */}
              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: open ? '0px' : '50%',
                      transform: open ? 'none' : 'translateX(-50%)',
                      marginBottom: '8px',
                      width: '216px',
                      background: 'rgba(18, 18, 18, 0.75)',
                      backdropFilter: 'blur(30px)',
                      WebkitBackdropFilter: 'blur(30px)',
                      border: '1px solid rgba(128, 128, 128, 0.15)',
                      borderRadius: '16px',
                      padding: '8px',
                      zIndex: 100,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* User info header */}
                    <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid rgba(128,128,128,0.08)', marginBottom: '6px' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)', fontFamily: 'Manrope' }} className="truncate">
                        {authUser ? (authUser.displayName || 'Studio User') : 'Guest User'}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--c-text-secondary)', fontFamily: 'Inter' }} className="truncate">
                        {authUser ? email : 'Not signed in'}
                      </p>
                    </div>

                    <AnimatePresence mode="wait" initial={false}>
                      {popoverMenuPage === 'main' ? (
                        <motion.div
                          key="main"
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: 20, opacity: 0 }}
                          transition={{ duration: 0.18, ease: 'easeInOut' }}
                          style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                        >
                          {/* Account Group */}
                          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', opacity: 0.5, padding: '2px 10px', letterSpacing: '0.08em', fontFamily: 'Manrope' }}>
                            Account
                          </div>
                          <button
                            onClick={() => { handleGoToSettingsPage('profile'); setShowProfileMenu(false); }}
                            style={profileMenuBtnStyle}
                            className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
                            <span>Profile</span>
                          </button>

                          <button
                            onClick={() => { handleGoToSettingsPage('general'); setShowProfileMenu(false); }}
                            style={profileMenuBtnStyle}
                            className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>settings</span>
                            <span>Settings</span>
                          </button>

                          <button
                            onClick={() => { handleGoToSettingsPage('appearance'); setShowProfileMenu(false); }}
                            style={profileMenuBtnStyle}
                            className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>palette</span>
                            <span>Appearance</span>
                          </button>

                          <button
                            onClick={() => { handleGoToSettingsPage('language'); setShowProfileMenu(false); }}
                            style={profileMenuBtnStyle}
                            className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>language</span>
                            <span>Language</span>
                          </button>

                          <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '4px 0' }} />

                          {/* Studio Group */}
                          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', opacity: 0.5, padding: '2px 10px', letterSpacing: '0.08em', fontFamily: 'Manrope' }}>
                            Studio
                          </div>
                          <button
                            onClick={() => { handleGoToSettingsPage('updater'); setShowProfileMenu(false); }}
                            style={profileMenuBtnStyle}
                            className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                              App Updates
                              {ota.updateAvailable && (
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                              )}
                            </span>
                          </button>

                          <button
                            onClick={() => { handleGoToSettingsPage('download-apps'); setShowProfileMenu(false); }}
                            style={profileMenuBtnStyle}
                            className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>install_desktop</span>
                            <span>Download Apps</span>
                          </button>

                          <button
                            onClick={() => { handleGoToSettingsPage('release-notes'); setShowProfileMenu(false); }}
                            style={profileMenuBtnStyle}
                            className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>article</span>
                            <span>Release Notes</span>
                          </button>

                          <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '4px 0' }} />

                          {/* Help & Support Button */}
                          <button
                            onClick={() => setPopoverMenuPage('help')}
                            style={profileMenuBtnStyle}
                            className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>help</span>
                            <span style={{ display: 'flex', alignItems: 'center', width: '100%', flex: 1 }}>
                              Help & Support
                              <span className="material-symbols-outlined" style={{ fontSize: 16, marginLeft: 'auto', opacity: 0.6 }}>chevron_right</span>
                            </span>
                          </button>

                          {settings.developerMode && (
                            <>
                              <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '4px 0' }} />
                              <button
                                onClick={() => { handleGoToSettingsPage('developer'); setShowProfileMenu(false); }}
                                style={profileMenuBtnStyle}
                                className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
                                <span>Developer Options</span>
                              </button>
                            </>
                          )}

                          {authUser && (
                            <>
                              <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '4px 0' }} />
                              <button
                                onClick={() => { signOut(); setShowProfileMenu(false); }}
                                style={{ ...profileMenuBtnStyle, color: '#ef4444' }}
                                className="btn-smooth hover:bg-[rgba(239,68,68,0.08)]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ef4444' }}>logout</span>
                                <span>Log out</span>
                              </button>
                            </>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="help"
                          initial={{ x: 20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: -20, opacity: 0 }}
                          transition={{ duration: 0.18, ease: 'easeInOut' }}
                          style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                        >
                          <button
                            onClick={() => setPopoverMenuPage('main')}
                            style={{ ...profileMenuBtnStyle, color: 'var(--c-text-primary)' }}
                            className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                            <span style={{ fontWeight: 700 }}>Back to Main Menu</span>
                          </button>

                          <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '4px 0' }} />

                          {/* Support section */}
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', opacity: 0.5, padding: '2px 10px', letterSpacing: '0.08em', fontFamily: 'Manrope' }}>
                              Support
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                              <button
                                onClick={() => { handleGoToSettingsPage('help-center'); setShowProfileMenu(false); }}
                                style={profileMenuBtnStyle}
                                className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>help</span>
                                <span>Help Center</span>
                              </button>
                              <button
                                onClick={() => { handleGoToSettingsPage('faq'); setShowProfileMenu(false); }}
                                style={profileMenuBtnStyle}
                                className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>contact_support</span>
                                <span>FAQ</span>
                              </button>
                              <button
                                onClick={() => { handleGoToSettingsPage('release-notes'); setShowProfileMenu(false); }}
                                style={profileMenuBtnStyle}
                                className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>article</span>
                                <span>Release Notes</span>
                              </button>
                              <button
                                onClick={() => { handleGoToSettingsPage('download-apps'); setShowProfileMenu(false); }}
                                style={profileMenuBtnStyle}
                                className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>install_desktop</span>
                                <span>Download Apps</span>
                              </button>
                              <button
                                onClick={() => { handleGoToSettingsPage('keyboard-shortcuts'); setShowProfileMenu(false); }}
                                style={profileMenuBtnStyle}
                                className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>keyboard</span>
                                <span>Keyboard Shortcuts</span>
                              </button>
                            </div>
                          </div>

                          <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '4px 0' }} />

                          {/* Legal section */}
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', opacity: 0.5, padding: '2px 10px', letterSpacing: '0.08em', fontFamily: 'Manrope' }}>
                              Legal
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                              <button
                                onClick={() => { handleGoToSettingsPage('terms'); setShowProfileMenu(false); }}
                                style={profileMenuBtnStyle}
                                className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>gavel</span>
                                <span>Terms of Service</span>
                              </button>
                              <button
                                onClick={() => { handleGoToSettingsPage('privacy-policy'); setShowProfileMenu(false); }}
                                style={profileMenuBtnStyle}
                                className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>policy</span>
                                <span>Privacy Policy</span>
                              </button>
                            </div>
                          </div>

                          <div style={{ height: 1, background: 'rgba(128,128,128,0.08)', margin: '4px 0' }} />

                          {/* Feedback section */}
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--c-text-secondary)', opacity: 0.5, padding: '2px 10px', letterSpacing: '0.08em', fontFamily: 'Manrope' }}>
                              Feedback
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                              <button
                                onClick={() => { handleGoToSettingsPage('bug-report'); setShowProfileMenu(false); }}
                                style={profileMenuBtnStyle}
                                className="btn-smooth hover:bg-[var(--sidebar-hover-bg,rgba(255,255,255,0.04))]"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bug_report</span>
                                <span>Report a Bug</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

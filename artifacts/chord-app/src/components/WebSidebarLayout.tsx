import React, { useState, useEffect } from 'react';
import { useSidebar, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarRail } from './StudioSidebar';
import { StudioLogo, ChordexLogo, DrumexLogo, StagexLogoIcon, GroovexLogo, VocalexLogo } from './ChordexLogo';
import { IconSongs, IconLibrary, IconChords } from './BottomNav';
import { useChordStore, ACCENT_COLORS } from '../store/useChordStore';
import { useT } from '../lib/useT';
import { subscribeAuth, signOut, type AuthUser } from '../lib/auth';
import { subscribeSyncStatus, type SyncStatus } from '../lib/sync';
import { useOtaUpdate } from '../lib/otaUpdate';
import { APP_VERSION_LABEL } from '../lib/appVersion';

export default function WebSidebarLayout() {
  const { settings, updateSettings, activePanel, setActivePanel } = useChordStore();
  const { open, toggleSidebar } = useSidebar();
  const t = useT();
  const ota = useOtaUpdate();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);

  // Subscribe to Authentication state
  useEffect(() => {
    return subscribeAuth((user) => {
      setAuthUser(user);
    });
  }, []);

  // Subscribe to Sync state
  useEffect(() => {
    return subscribeSyncStatus((s) => {
      setSyncStatus(s);
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

  return (
    <Sidebar style={accentVars}>
      {/* Header */}
      <SidebarHeader>
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => handleGoToHub('home')}>
          <div className="flex-shrink-0">
            <StudioLogo size={28} />
          </div>
          {open && (
            <span
              className="font-extrabold text-base tracking-tight text-[var(--c-text-primary)]"
              style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}
            >
              Studio
            </span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg bg-transparent text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)] hover:bg-[rgba(255,255,255,0.06)] border-none cursor-pointer flex items-center justify-center outline-none"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {open ? 'menu_open' : 'menu'}
          </span>
        </button>
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

        {/* Chordex Panels (Workspace) Group - Only visible/expanded if open or active */}
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'chords' && activePanel === 'songs'}
                onClick={() => handleSetChordexPanel('songs')}
                tooltip="Songs"
              >
                <div className="flex-shrink-0" style={{ color: settings.appMode === 'chords' && activePanel === 'songs' ? 'inherit' : 'var(--c-text-secondary)' }}>
                  <IconSongs active={settings.appMode === 'chords' && activePanel === 'songs'} />
                </div>
                {open && <span className="truncate">{t.nav.songs}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'chords' && activePanel === 'library'}
                onClick={() => handleSetChordexPanel('library')}
                tooltip="Library"
              >
                <div className="flex-shrink-0" style={{ color: settings.appMode === 'chords' && activePanel === 'library' ? 'inherit' : 'var(--c-text-secondary)' }}>
                  <IconLibrary active={settings.appMode === 'chords' && activePanel === 'library'} />
                </div>
                {open && <span className="truncate">{t.nav.library}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                active={settings.appMode === 'chords' && activePanel === 'chord'}
                onClick={() => handleSetChordexPanel('chord')}
                tooltip="Chords"
              >
                <div className="flex-shrink-0" style={{ color: settings.appMode === 'chords' && activePanel === 'chord' ? 'inherit' : 'var(--c-text-secondary)' }}>
                  <IconChords active={settings.appMode === 'chords' && activePanel === 'chord'} />
                </div>
                {open && <span className="truncate">{t.nav.chords}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Settings Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => handleGoToSettingsPage('appearance')} tooltip="Theme & Accent">
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>palette</span>
                </div>
                {open && <span className="truncate">Theme & Appearance</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => handleGoToSettingsPage('language')} tooltip="Language">
                <div className="flex-shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>language</span>
                </div>
                {open && <span className="truncate">Language</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => handleGoToSettingsPage('updater')} tooltip="Updater Settings">
                <div className="flex-shrink-0 relative">
                  <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>download</span>
                  {ota.updateAvailable && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border border-black" />
                  )}
                </div>
                {open && (
                  <span className="truncate flex items-center gap-2">
                    App Updater
                    {ota.updateAvailable && (
                      <span className="bg-rose-500/20 text-rose-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">New</span>
                    )}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {settings.developerMode && (
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleGoToSettingsPage('developer')} tooltip="Developer Panel">
                  <div className="flex-shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: 20, display: 'block' }}>terminal</span>
                  </div>
                  {open && <span className="truncate">Developer Options</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => handleGoToSettingsPage('help')} tooltip="FAQ & Support">
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
            <div className="flex items-center gap-2.5 p-1.5 overflow-hidden">
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

          {/* Sync Status / Version Info */}
          {open && (
            <SidebarMenuItem>
              <div className="px-1.5 py-1 text-[10px] text-[var(--c-text-muted)] font-bold flex flex-col gap-0.5" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      syncStatus?.syncing ? 'bg-amber-500 animate-pulse' : syncStatus?.signedIn ? 'bg-emerald-500' : 'bg-zinc-600'
                    }`}
                  />
                  <span>
                    {syncStatus?.syncing
                      ? 'Syncing changes...'
                      : syncStatus?.signedIn
                      ? 'Cloud Sync active'
                      : 'Sync offline'}
                  </span>
                </div>
                <div className="text-[9px] opacity-75 mt-0.5">
                  {APP_VERSION_LABEL}
                </div>
              </div>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

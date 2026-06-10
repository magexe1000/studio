import { useState, useEffect } from 'react';

export interface StudioPreferences {
  autoHideSidebarInApps: boolean;
  hoverRevealSidebar: boolean;
  autoCloseHoverSidebar: boolean;
  showWebAppToolbar: boolean;
  rememberLastAppSection: boolean;
  reduceMotion: boolean;
  compactDesktopSpacing: boolean;
}

const PREF_DEFAULTS: StudioPreferences = {
  autoHideSidebarInApps: true,
  hoverRevealSidebar: true,
  autoCloseHoverSidebar: true,
  showWebAppToolbar: true,
  rememberLastAppSection: true,
  reduceMotion: false,
  compactDesktopSpacing: false,
};

const PREF_KEYS: Record<keyof StudioPreferences, string> = {
  autoHideSidebarInApps: 'studio:pref:autoHideSidebarInApps',
  hoverRevealSidebar: 'studio:pref:hoverRevealSidebar',
  autoCloseHoverSidebar: 'studio:pref:autoCloseHoverSidebar',
  showWebAppToolbar: 'studio:pref:showWebAppToolbar',
  rememberLastAppSection: 'studio:pref:rememberLastAppSection',
  reduceMotion: 'studio:pref:reduceMotion',
  compactDesktopSpacing: 'studio:pref:compactDesktopSpacing',
};

function getPreference<K extends keyof StudioPreferences>(key: K): StudioPreferences[K] {
  if (typeof window === 'undefined') return PREF_DEFAULTS[key];
  try {
    const raw = localStorage.getItem(PREF_KEYS[key]);
    if (raw === null) return PREF_DEFAULTS[key];
    return JSON.parse(raw) as StudioPreferences[K];
  } catch {
    return PREF_DEFAULTS[key];
  }
}

function getAllPreferences(): StudioPreferences {
  const prefs = {} as StudioPreferences;
  for (const k of Object.keys(PREF_DEFAULTS) as Array<keyof StudioPreferences>) {
    prefs[k] = getPreference(k);
  }
  return prefs;
}

export function useStudioPreferences() {
  const [preferences, setPreferences] = useState<StudioPreferences>(getAllPreferences);

  useEffect(() => {
    const handleChanged = () => {
      setPreferences(getAllPreferences());
    };
    window.addEventListener('studio:preferences-changed', handleChanged);
    return () => {
      window.removeEventListener('studio:preferences-changed', handleChanged);
    };
  }, []);

  const setPreference = <K extends keyof StudioPreferences>(key: K, value: StudioPreferences[K]) => {
    try {
      localStorage.setItem(PREF_KEYS[key], JSON.stringify(value));
      window.dispatchEvent(new CustomEvent('studio:preferences-changed', { detail: { key, value } }));
    } catch (e) {
      console.error('Failed to save preference', key, value, e);
    }
  };

  return {
    preferences,
    setPreference,
  };
}

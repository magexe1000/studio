export interface ShortcutRegistryItem {
  id: string;
  label: string;
  icon: string;
  type: 'hub' | 'app' | 'settings' | 'chordex-panel';
  payload: string;
}

export const SHORTCUT_REGISTRY: ShortcutRegistryItem[] = [
  { id: 'hub_home', label: 'Studio Hub', icon: 'home', type: 'hub', payload: 'home' },
  { id: 'chordex', label: 'Chordex', icon: 'chordex', type: 'app', payload: 'chords' },
  { id: 'drumex', label: 'Drumex', icon: 'drumex', type: 'app', payload: 'drums' },
  { id: 'stagex', label: 'Stagex', icon: 'stagex', type: 'app', payload: 'stage' },
  { id: 'groovex', label: 'Groovex', icon: 'groovex', type: 'app', payload: 'groovex' },
  { id: 'vocalex', label: 'Vocalex', icon: 'vocalex', type: 'app', payload: 'vocalex' },
  
  { id: 'chordex_songs', label: 'Songs', icon: 'music_note', type: 'chordex-panel', payload: 'songs' },
  { id: 'chordex_library', label: 'Library', icon: 'folder_open', type: 'chordex-panel', payload: 'library' },
  { id: 'chordex_chords', label: 'Chords', icon: 'grid_view', type: 'chordex-panel', payload: 'chord' },

  { id: 'settings_appearance', label: 'Theme & Appearance', icon: 'palette', type: 'settings', payload: 'appearance' },
  { id: 'settings_language', label: 'Language', icon: 'language', type: 'settings', payload: 'language' },
  { id: 'settings_updater', label: 'App Updater', icon: 'download', type: 'settings', payload: 'updater' },
  { id: 'settings_developer', label: 'Developer Options', icon: 'terminal', type: 'settings', payload: 'developer' },
  { id: 'settings_help', label: 'Help & FAQ', icon: 'help', type: 'settings', payload: 'help' },
];

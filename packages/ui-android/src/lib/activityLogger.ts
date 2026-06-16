import { useChordStore } from '../store/useChordStore';

export type ActivityType =
  | 'app_launch'
  | 'project_open'
  | 'project_create'
  | 'export'
  | 'import'
  | 'cloud_sync'
  | 'backup'
  | 'ota_install'
  | 'apk_install'
  | 'login'
  | 'logout';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  subtitle?: string;
  timestamp: number;
}

export function logActivity(type: ActivityType, title: string, subtitle?: string) {
  const store = useChordStore.getState();
  const enabled = store.settings.activityHistoryEnabled !== false;
  if (!enabled) return;

  const newEvent: ActivityEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type,
    title,
    subtitle,
    timestamp: Date.now(),
  };

  const currentLog = store.activityLog || [];
  const updatedLog = [newEvent, ...currentLog].slice(0, 25);

  useChordStore.setState({ activityLog: updatedLog });
}

export function getActivityEmoji(type: ActivityType, subtitle?: string): string {
  switch (type) {
    case 'app_launch':
      if (subtitle?.includes('Chordex')) return '🎵';
      if (subtitle?.includes('Drumex')) return '🥁';
      if (subtitle?.includes('Stagex')) return '🗂';
      if (subtitle?.includes('Groovex')) return '🎛';
      if (subtitle?.includes('Vocalex')) return '🎙';
      return '🚀';
    case 'project_open':
      if (subtitle?.includes('Chordex')) return '🎵';
      if (subtitle?.includes('Drumex')) return '🥁';
      if (subtitle?.includes('Stagex')) return '🗂';
      if (subtitle?.includes('Groovex')) return '🎛';
      if (subtitle?.includes('Vocalex')) return '🎙';
      return '🗂';
    case 'project_create': return '🆕';
    case 'export': return '📤';
    case 'import': return '📥';
    case 'cloud_sync': return '☁';
    case 'backup': return '💾';
    case 'ota_install': return '⬇';
    case 'apk_install': return '🤖';
    case 'login': return '🔑';
    case 'logout': return '🔒';
    default: return '📝';
  }
}

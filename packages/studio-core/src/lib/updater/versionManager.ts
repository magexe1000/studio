import { APP_VERSION, compareSemver, normalizeSemver } from '../appVersion';

const LAST_SEEN_KEY = 'studio:lastSeenVersion';

export function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

export function writeLastSeen(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    /* ignore */
  }
}

export function detectJustUpdated(): { justUpdated: boolean; from: string | null } {
  const last = readLastSeen();
  if (last === null) return { justUpdated: false, from: null };
  if (normalizeSemver(last) === null) {
    writeLastSeen(APP_VERSION);
    return { justUpdated: false, from: null };
  }
  return {
    justUpdated: compareSemver(APP_VERSION, last) > 0,
    from: last,
  };
}

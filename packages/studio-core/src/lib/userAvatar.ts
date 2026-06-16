/**
 * User avatar selection — lets the user pick a Material Symbols
 * "person" icon as their profile picture instead of (or as a fallback
 * for) the Google account photo. The selection is per-account, stored
 * in localStorage keyed by uid so multiple accounts on the same device
 * don't clobber each other.
 *
 * The avatar choice is intentionally local-only: it doesn't sync to
 * Firestore, doesn't update Firebase Auth's photoURL, and isn't part
 * of the cloud sync engine's payload. Profile-picture preference is a
 * per-device cosmetic — syncing it would force one device's choice
 * onto every other signed-in device, which is the opposite of what
 * users expect from "let me pick an icon on this phone".
 */

const STORAGE_KEY = 'chordex_user_avatar_v1';

/**
 * The Material Symbols icon names users can pick from. Every entry
 * MUST be a valid Material Symbols outlined glyph, otherwise the
 * preview would render an empty box. Curated to "person-ish" icons.
 */
export const AVATAR_ICONS = [
  'person',
  'face',
  'face_2',
  'face_3',
  'face_4',
  'face_5',
  'face_6',
  'mood',
  'sentiment_very_satisfied',
  'self_improvement',
  'music_note',
  'headphones',
] as const;

export type AvatarIcon = (typeof AVATAR_ICONS)[number];

type AvatarMap = Record<string, AvatarIcon>;

function readMap(): AvatarMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AvatarMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(m: AvatarMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    /* quota exceeded / private mode — silent ok */
  }
}

/** Returns the user's chosen icon, or `null` if they haven't picked one. */
export function getUserAvatar(uid: string | null | undefined): AvatarIcon | null {
  if (!uid) return null;
  const v = readMap()[uid];
  return v && (AVATAR_ICONS as readonly string[]).includes(v) ? v : null;
}

/** Persist a new icon choice. Pass `null` to revert to "use Google photo". */
export function setUserAvatar(uid: string, icon: AvatarIcon | null): void {
  const map = readMap();
  if (icon === null) delete map[uid];
  else map[uid] = icon;
  writeMap(map);
  try {
    window.dispatchEvent(
      new CustomEvent('chordex:user-avatar-changed', { detail: { uid, icon } }),
    );
  } catch {
    /* CustomEvent unavailable in some test envs */
  }
}

/**
 * React-friendly subscription. Returns an unsubscribe. Fires whenever
 * `setUserAvatar` is called from anywhere in the app, so the bubble
 * picker and the avatar pill stay in sync without prop-drilling.
 */
export function subscribeUserAvatar(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener('chordex:user-avatar-changed', handler);
  return () => window.removeEventListener('chordex:user-avatar-changed', handler);
}

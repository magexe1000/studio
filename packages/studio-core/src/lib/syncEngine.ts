import { isNative } from './capgoUpdater';

// ── Cached Device ID ──
let cachedDeviceId: string | null = null;

// ── Device ID ──
export function getStableDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;

  // Search legacy keys
  const legacyKeys = ['studioDeviceId', 'chordex_device_id', 'chordexDeviceId', 'appDeviceId', 'deviceId', 'previousDeviceId'];
  for (const k of legacyKeys) {
    try {
      const val = localStorage.getItem(k);
      if (val && val.trim()) {
        cachedDeviceId = val.trim();
        localStorage.setItem('studioDeviceId', cachedDeviceId);
        return cachedDeviceId;
      }
    } catch {}
  }

  // Generate new stable ID
  const platform = isNative() ? 'android' : 'web';
  const randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `gen-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  
  cachedDeviceId = `${platform}-${randomUUID}`;
  try {
    localStorage.setItem('studioDeviceId', cachedDeviceId);
  } catch {}

  if (isNative()) {
    import('@capacitor/preferences').then(({ Preferences }) => {
      Preferences.set({ key: 'studioDeviceId', value: cachedDeviceId! }).catch(() => {});
    }).catch(() => {});
  }

  return cachedDeviceId;
}

export async function initializeDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'studioDeviceId' });
      if (value && value.trim()) {
        cachedDeviceId = value.trim();
        try {
          localStorage.setItem('studioDeviceId', cachedDeviceId);
          localStorage.setItem('chordex_device_id', cachedDeviceId);
        } catch {}
        return cachedDeviceId;
      }
    } catch {}
  }

  return getStableDeviceId();
}

// ── Device details extraction ──
export function getDeviceDetails() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let os = 'Unknown OS';
  let model = 'Browser';
  let manufacturer = 'N/A';

  if (/windows/i.test(ua)) {
    os = 'Windows';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/android/i.test(ua)) {
    os = 'Android';
    const match = ua.match(/\(Linux; Android[^;]*; ([^)]*)\)/);
    if (match && match[1]) {
      model = match[1].trim();
      const modelLower = model.toLowerCase();
      if (modelLower.startsWith('sm-') || modelLower.startsWith('gt-')) manufacturer = 'Samsung';
      else if (modelLower.startsWith('pixel')) manufacturer = 'Google';
      else if (modelLower.startsWith('moto')) manufacturer = 'Motorola';
      else if (modelLower.startsWith('lg-')) manufacturer = 'LG';
      else if (modelLower.startsWith('oneplus')) manufacturer = 'OnePlus';
      else if (modelLower.startsWith('sony') || modelLower.startsWith('so-')) manufacturer = 'Sony';
    }
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
    model = /ipad/i.test(ua) ? 'iPad' : 'iPhone';
    manufacturer = 'Apple';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Web Browser';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';

  const isNativeApp = isNative();
  let modelClean = model;
  if (os === 'Android') {
    const buildIdx = modelClean.indexOf(' Build/');
    if (buildIdx !== -1) modelClean = modelClean.substring(0, buildIdx);
    const semiIdx = modelClean.indexOf(';');
    if (semiIdx !== -1) modelClean = modelClean.substring(0, semiIdx);
    modelClean = modelClean.trim();
  }

  const modelFriendlyMap: Record<string, string> = {
    'sm-s921b': 'Samsung Galaxy S24',
    'sm-s921u': 'Samsung Galaxy S24',
    'sm-s926b': 'Samsung Galaxy S24+',
    'sm-s926u': 'Samsung Galaxy S24+',
    'sm-s928b': 'Samsung Galaxy S24 Ultra',
    'sm-s928u': 'Samsung Galaxy S24 Ultra',
  };

  const friendlyName = modelFriendlyMap[modelClean.toLowerCase()];

  let shortName = 'Web Client';
  let displayName = 'Web Client';
  let technicalName = 'Web Client';

  if (isNativeApp) {
    technicalName = `Studio Android / ${manufacturer !== 'N/A' ? manufacturer + ' ' : ''}${modelClean}`;
    shortName = friendlyName || (manufacturer !== 'N/A' ? `${manufacturer} ${modelClean}` : modelClean);
    displayName = `${shortName}`;
  } else {
    technicalName = `Studio Web / ${browser} on ${os}`;
    shortName = `${browser} on ${os}`;
    displayName = `${browser} on ${os}`;
  }

  return { shortName, displayName, technicalName, browser, os, model: modelClean, manufacturer, userAgent: ua };
}

// Helper to scan for undefined properties recursively in development/diagnostics
function scanForUndefined(val: any, path = '') {
  if (val === undefined) {
    console.warn(`[syncEngine] Undefined value found at path: ${path || 'root'}`);
    return;
  }
  if (val === null || typeof val !== 'object') return;
  if (val instanceof Date) return;
  if (typeof val.toMillis === 'function') return;
  if (val.constructor?.name === 'Timestamp' || val.constructor?.name === 'FieldValue') return;
  if (typeof Blob !== 'undefined' && val instanceof Blob) return;
  if (typeof File !== 'undefined' && val instanceof File) return;
  
  if (Array.isArray(val)) {
    val.forEach((item, index) => {
      scanForUndefined(item, `${path}[${index}]`);
    });
  } else {
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        scanForUndefined(val[key], path ? `${path}.${key}` : key);
      }
    }
  }
}

// Helper to sanitize payload for firestore
export function sanitizeForFirestore(val: any): any {
  try {
    scanForUndefined(val);
  } catch (e) {
    // Ignore diagnostic scanner errors
  }
  return sanitizeValue(val);
}

function sanitizeValue(val: any): any {
  if (val === undefined) {
    return null;
  }
  if (val === null) {
    return null;
  }
  if (typeof val !== 'object') {
    return val;
  }
  if (val instanceof Date) {
    return val;
  }
  if (typeof val.toMillis === 'function') {
    return val;
  }
  if (val.constructor?.name === 'Timestamp' || val.constructor?.name === 'FieldValue') {
    return val;
  }
  if (typeof Blob !== 'undefined' && val instanceof Blob) {
    return val;
  }
  if (typeof File !== 'undefined' && val instanceof File) {
    return val;
  }
  
  // Array: convert undefined array elements to null
  if (Array.isArray(val)) {
    return val.map(item => item === undefined ? null : sanitizeValue(item));
  }
  
  // Plain object: remove undefined fields from objects, and sanitize values
  const res: any = {};
  for (const key in val) {
    if (Object.prototype.hasOwnProperty.call(val, key)) {
      const v = val[key];
      if (v !== undefined) {
        res[key] = sanitizeValue(v);
      }
    }
  }
  return res;
}

// ── Session Classification ──
export function classifyDeviceSession(data: any, currentDeviceId: string): { classification: string; reason: string } {
  if (!data) return { classification: 'unknown', reason: 'No document data available' };
  const docId = data.deviceId || data.id || 'Unknown';

  // 1. current
  if (docId === currentDeviceId || data.id === currentDeviceId) {
    return { classification: 'current', reason: 'Current active session' };
  }

  // Calculate active diff
  const lastActive = data.lastActiveAt ? (typeof data.lastActiveAt.toMillis === 'function' ? data.lastActiveAt.toMillis() : data.lastActiveAt) : 0;
  const now = Date.now();
  const diffMinutes = (now - lastActive) / 60000;
  const isCurrentlyActive = (diffMinutes <= 2 && data.syncStatus === 'active');
  const isRecentlyActive = (diffMinutes <= 1440); // 24 hours

  // 2. activeRemote
  if (isCurrentlyActive && data.signedIn !== false && data.syncStatus !== 'signedOut' && data.syncStatus !== 'revoked') {
    return { classification: 'activeRemote', reason: 'Active remote device' };
  }

  // 3. recentRemote
  if (isRecentlyActive && data.signedIn !== false && data.syncStatus !== 'signedOut' && data.syncStatus !== 'revoked' && lastActive > 0) {
    return { classification: 'recentRemote', reason: 'Recently active remote device' };
  }

  // 4. signedOut
  if (data.signedIn === false || data.currentSession === false || data.syncStatus === 'signedOut') {
    return { classification: 'signedOut', reason: 'Signed out session' };
  }

  // 5. revoked
  if (data.revokedAt != null || data.syncStatus === 'revoked') {
    return { classification: 'revoked', reason: 'Session revoked by owner' };
  }

  // 6. legacy
  if (data.isLegacy || data.legacy === true || data.replaced === true) {
    return { classification: 'legacy', reason: 'Marked as legacy or replaced session' };
  }

  // 7. unknown (stale remote session or missing metadata)
  return { classification: 'unknown', reason: 'Stale remote session (inactive > 24 hours)' };
}

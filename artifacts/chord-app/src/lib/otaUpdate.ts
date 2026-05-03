/**
 * Over-the-air update checker.
 *
 * Compares the bundle version (from `lib/appVersion`) against a
 * remote `version.json` file shipped alongside the app. The remote
 * file is the single source of "what's the latest released version".
 *
 * Behaviour:
 *  - On app boot, fetch `<base>version.json` once with a short timeout.
 *  - If `remote.version > local APP_VERSION`, expose `updateAvailable`
 *    state to the UI (a tiny indicator surfaces this in the Hub).
 *  - On every launch we compare the bundled `APP_VERSION` against a
 *    `lastSeenVersion` stored in localStorage. If the bundle has
 *    advanced since last launch, the user just received an update —
 *    show the changelog modal, then write the new version back.
 *  - Every failure path (offline, malformed JSON, missing file,
 *    parse error) is swallowed silently. Updates are best-effort.
 *
 * Single source of truth: the bundle's `APP_VERSION` is the *current*
 * version (what the user has installed). The remote `version.json` is
 * the *latest* version the team has shipped. The OTA system never
 * accepts a version from any other source.
 */

import { useEffect, useRef, useState } from 'react';
import { APP_VERSION, compareSemver, normalizeSemver } from './appVersion';
import { isNative, notifyOtaAvailable } from './capgoUpdater';
import { nativeSet, NATIVE_PREFS } from './nativePrefs';

const LAST_SEEN_KEY = 'studio:lastSeenVersion';
const FETCH_TIMEOUT_MS = 6000;
/** How often to re-check for updates while the app is open and visible.
 *  60 s — short enough that a release is detected the first time the
 *  user touches the phone after publishing, long enough to be invisible
 *  on battery. The native WorkManager worker (`OtaCheckWorker.java`)
 *  handles the background path. */
const FOREGROUND_POLL_MS = 60 * 1000;

export interface RemoteVersionInfo {
  version: string;
  changelog?: string;
  mandatory?: boolean;
  /**
   * Absolute URL to a Capgo-compatible zip of the new bundle. Only
   * present in releases published with `scripts/publish-bundle.mjs`.
   * Used by the Capgo updater on native (Android APK). Web ignores it
   * — service-worker reload handles bundle swaps in the browser.
   */
  downloadUrl?: string;
}

export interface OtaState {
  /** True when remote > local. */
  updateAvailable: boolean;
  /** Latest version reported by the server, if we successfully fetched. */
  remoteVersion: string | null;
  /** Server-provided release notes for the new version. */
  changelog: string | null;
  /** Server-provided "users must update" flag. */
  mandatory: boolean;
  /** Absolute URL to the Capgo bundle zip, if the server published one. */
  downloadUrl: string | null;
  /** True until the first fetch resolves (used to gate UI shimmer). */
  loading: boolean;
}

const INITIAL_STATE: OtaState = {
  updateAvailable: false,
  remoteVersion: null,
  changelog: null,
  mandatory: false,
  downloadUrl: null,
  loading: true,
};

/**
 * Resolve every URL we should try in order to discover the latest
 * `version.json`. We return a LIST so a slow/stale CDN can be raced
 * against a fast/fresh origin — `fetchRemoteVersion` takes the first
 * one that responds successfully.
 *
 * Sources in priority order:
 *
 *   1. `VITE_OTA_VERSION_URL` (explicit override) — if set, it's the
 *      ONLY source we try. Lets ops point at any custom endpoint
 *      (e.g. a small Cloudflare worker).
 *   2. raw.githubusercontent.com (DERIVED, fast path) — when
 *      `VITE_OTA_BASE_URL` looks like `https://USER.github.io/REPO`,
 *      the source files live in the same repo's `docs/` folder. The
 *      raw.githubusercontent.com endpoint serves them within seconds
 *      of a push, vs. GitHub Pages' Fastly which can take 2–3 minutes
 *      to flush. This is the difference between "instant" and
 *      "user reloads four times before the banner shows".
 *   3. `<VITE_OTA_BASE_URL>/version.json` (fallback) — the actual
 *      Pages URL, in case the repo is private or the raw endpoint is
 *      blocked.
 *   4. `<BASE_URL>version.json` on web — same-origin, no auth needed.
 *
 * Every URL is cache-busted with a unique `?t=` query and fetched with
 * `cache: 'no-store'` so neither the browser nor Fastly can hand us a
 * stale entry.
 */
function versionJsonUrls(): string[] {
  const t = Date.now();
  const override = (import.meta.env.VITE_OTA_VERSION_URL as string | undefined)?.trim();
  if (override) {
    const sep = override.includes('?') ? '&' : '?';
    return [`${override}${sep}t=${t}`];
  }

  const remoteBase = (import.meta.env.VITE_OTA_BASE_URL as string | undefined)?.replace(/\/$/, '');
  const urls: string[] = [];

  if (remoteBase) {
    // GitHub Pages → derive a sibling raw.githubusercontent URL.
    // Match both `https://USER.github.io/REPO` and `https://USER.github.io`
    // (user/organization site). The repo for a project site IS the path
    // segment; for a user site it's `USER.github.io`.
    const m = remoteBase.match(/^https:\/\/([^.]+)\.github\.io(?:\/([^/?#]+))?$/i);
    if (m) {
      const user = m[1];
      const repo = m[2] ?? `${user}.github.io`;
      // The publish script writes to `docs/`, served by Pages from the
      // repo root. So the source file is at `docs/version.json` on the
      // default branch. We try `main` first, fall back to `master`.
      urls.push(
        `https://raw.githubusercontent.com/${user}/${repo}/main/docs/version.json?t=${t}`,
        `https://raw.githubusercontent.com/${user}/${repo}/master/docs/version.json?t=${t}`,
      );
    }
    urls.push(`${remoteBase}/version.json?t=${t}`);
  }

  // Web / PWA / dev preview / iframe — same-origin always works.
  if (!isNative()) {
    const localBase = import.meta.env.BASE_URL || '/';
    urls.push(`${localBase}version.json?t=${t}`);
  }

  if (urls.length === 0 && isNative()) {
    console.error(
      '[ota] VITE_OTA_BASE_URL is not set — OTA update checks are disabled on native. ' +
        'Rebuild with VITE_OTA_BASE_URL=https://your-deployment.example.com.',
    );
  }

  return urls;
}

/**
 * Try one specific URL. Returns the parsed manifest, or `null` for any
 * failure (HTTP error, abort, malformed JSON, missing required field).
 * Never throws.
 */
async function fetchOne(
  url: string,
  signal: AbortSignal,
): Promise<RemoteVersionInfo | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal,
      // NOTE: do NOT add Cache-Control / Pragma headers here. They are
      // NOT in the CORS-safelisted request-header list, so they would
      // upgrade this simple GET to a preflighted OPTIONS request —
      // raw.githubusercontent.com does not respond to OPTIONS for
      // arbitrary paths, and the fetch silently fails with a CORS
      // error. The `?t=Date.now()` cache buster on the URL is enough
      // to defeat browser/CDN caching without triggering preflight.
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== 'object') return null;
    const obj = json as Record<string, unknown>;
    if (typeof obj.version !== 'string' || !obj.version.trim()) return null;
    return {
      version: obj.version,
      changelog: typeof obj.changelog === 'string' ? obj.changelog : undefined,
      mandatory: obj.mandatory === true,
      downloadUrl:
        typeof obj.downloadUrl === 'string' && /^https?:\/\//.test(obj.downloadUrl)
          ? obj.downloadUrl
          : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the remote version manifest. Tries every URL returned by
 * `versionJsonUrls()` IN PARALLEL and returns whichever response
 * reports the HIGHEST semver. Racing in parallel (vs. sequentially)
 * means the slow GH-Pages CDN can never be the bottleneck — the
 * faster raw.githubusercontent endpoint will almost always win, and
 * if the repo is private and that 404s, the Pages fallback still
 * resolves on its own clock.
 *
 * Resolves to `null` only when EVERY source failed. Never throws.
 */
export async function fetchRemoteVersion(
  signal?: AbortSignal,
): Promise<RemoteVersionInfo | null> {
  const urls = versionJsonUrls();
  if (urls.length === 0) return null;

  const ctrl = signal ? null : new AbortController();
  const sig = signal ?? ctrl!.signal;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : null;

  try {
    const results = await Promise.all(urls.map((u) => fetchOne(u, sig)));
    let best: RemoteVersionInfo | null = null;
    for (const r of results) {
      if (!r) continue;
      if (!best || compareSemver(r.version, best.version) > 0) best = r;
    }
    return best;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Best-effort: compare the remote version against the bundle's version
 * and return whether an update is available. All errors swallowed.
 */
export async function checkForUpdate(): Promise<OtaState> {
  const remote = await fetchRemoteVersion();
  if (!remote) {
    return { ...INITIAL_STATE, loading: false };
  }
  const cmp = compareSemver(remote.version, APP_VERSION);
  return {
    updateAvailable: cmp > 0,
    remoteVersion: remote.version,
    changelog: remote.changelog ?? null,
    mandatory: remote.mandatory === true,
    downloadUrl: remote.downloadUrl ?? null,
    loading: false,
  };
}

/**
 * React hook: returns OTA state and aggressively refreshes it.
 *
 * Originally we only fetched ONCE on mount, which meant a user who left
 * the app open all day never saw a release shipped during that day, and
 * a user who background/foregrounded only saw a fresh check on cold
 * start. This version checks:
 *
 *  1. Immediately on mount.
 *  2. Every time the app comes back to the foreground:
 *      - Capacitor `App.appStateChange` (`isActive: true`) on native.
 *      - `document.visibilitychange` → `document.visibilityState ===
 *        'visible'` on web/PWA.
 *  3. On a 5-minute interval while the app is visible. The interval is
 *     paused when the document goes hidden (no point burning battery
 *     polling in the background — the native WorkManager worker handles
 *     "while truly closed" coverage).
 *
 * All listeners are torn down on unmount. Concurrent fetches are
 * collapsed via the `inFlight` ref so a quick visibility flap doesn't
 * stack three identical requests.
 */
export function useOtaUpdate(): OtaState {
  const [state, setState] = useState<OtaState>(INITIAL_STATE);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const ctrl = new AbortController();

    const runCheck = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const remote = await fetchRemoteVersion(ctrl.signal);
        if (!mounted.current) return;
        if (!remote) {
          setState((prev) =>
            prev.loading ? { ...INITIAL_STATE, loading: false } : prev,
          );
          return;
        }
        const cmp = compareSemver(remote.version, APP_VERSION);
        setState({
          updateAvailable: cmp > 0,
          remoteVersion: remote.version,
          changelog: remote.changelog ?? null,
          mandatory: remote.mandatory === true,
          downloadUrl: remote.downloadUrl ?? null,
          loading: false,
        });
        // Fire an OS-level notification with the version number. This is
        // intentionally fire-and-forget: it dedups internally per version,
        // and a failure to surface a notification must never block the
        // in-app update banner from showing.
        if (cmp > 0) {
          void notifyOtaAvailable(remote.version);
        }
      } finally {
        inFlight.current = false;
      }
    };

    // Mark our currently running bundle so the native background worker
    // has a baseline even before the user has dismissed any banner.
    void nativeSet(NATIVE_PREFS.OTA_INSTALLED, APP_VERSION);

    // 1. Initial check on mount.
    void runCheck();

    // 2a. Web: visibility transitions → re-check on becoming visible.
    //     Also listen for `focus` and `pageshow` (back/forward cache),
    //     because some Android WebViews fire neither visibilitychange
    //     nor appStateChange when the user swipes away the keyboard or
    //     dismisses a system dialog. The runCheck dedup means stacking
    //     these listeners costs nothing.
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void runCheck();
      }
    };
    const onFocus = () => { void runCheck(); };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      window.addEventListener('pageshow', onFocus);
      window.addEventListener('online', onFocus);
    }

    // 2b. Native (Capacitor): listen for the app coming back to the
    //     foreground. This fires even when visibilitychange does not.
    let nativeListener: { remove: () => Promise<void> } | undefined;
    if (isNative()) {
      void (async () => {
        try {
          const { App } = await import('@capacitor/app');
          nativeListener = await App.addListener('appStateChange', (s) => {
            if (s.isActive) void runCheck();
          });
        } catch {
          /* plugin unavailable — visibilitychange path still works */
        }
      })();
    }

    // 3. Periodic foreground poll. Uses a self-rescheduling timeout so
    //    the next tick is always exactly POLL_MS after the previous
    //    completion (no thundering herd if a fetch is slow).
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePoll = () => {
      pollTimer = setTimeout(async () => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          await runCheck();
        }
        if (mounted.current) schedulePoll();
      }, FOREGROUND_POLL_MS);
    };
    schedulePoll();

    return () => {
      mounted.current = false;
      ctrl.abort();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('pageshow', onFocus);
        window.removeEventListener('online', onFocus);
      }
      if (pollTimer) clearTimeout(pollTimer);
      if (nativeListener) void nativeListener.remove().catch(() => {});
    };
  }, []);

  return state;
}

/* ──────────────────────────────────────────────────────────────────── *
 * Post-update changelog detection.                                     *
 * ──────────────────────────────────────────────────────────────────── */

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}

/**
 * Determines whether THIS launch is the first one after an update.
 * Pure function — call once on mount; gating UI state lives in the
 * `usePostUpdateChangelog` hook below.
 *
 * Logic:
 *  - No prior record → first install ever, don't show a changelog.
 *  - Recorded version < APP_VERSION → user just upgraded, show it.
 *  - Recorded version >= APP_VERSION → already seen this version.
 */
export function detectJustUpdated(): { justUpdated: boolean; from: string | null } {
  const last = readLastSeen();
  if (last === null) return { justUpdated: false, from: null };
  // Defensive: if some past write corrupted the entry (foreign code,
  // a manual edit, schema change), treat it as a fresh baseline so
  // change detection can't get permanently wedged returning 0/equal.
  if (normalizeSemver(last) === null) {
    writeLastSeen(APP_VERSION);
    return { justUpdated: false, from: null };
  }
  return {
    justUpdated: compareSemver(APP_VERSION, last) > 0,
    from: last,
  };
}

/**
 * React hook for the post-update changelog modal.
 *
 *  - On first ever launch: silently records APP_VERSION and shows nothing.
 *  - On a launch where the bundle has advanced: returns `show: true`
 *    so the modal renders. Caller must invoke `dismiss()` to close it
 *    AND write the new version to localStorage so it doesn't re-show.
 *  - Calling `dismiss()` is what persists the new version. If the
 *    user reloads before dismissing, the modal will appear again —
 *    that's intentional, we want them to see it at least once.
 */
export function usePostUpdateChangelog(): {
  show: boolean;
  fromVersion: string | null;
  toVersion: string;
  dismiss: () => void;
} {
  const [show, setShow] = useState(false);
  const [fromVersion, setFromVersion] = useState<string | null>(null);

  useEffect(() => {
    const { justUpdated, from } = detectJustUpdated();
    if (justUpdated) {
      setFromVersion(from);
      setShow(true);
    } else if (from === null) {
      // First install — record current version so future updates
      // produce a clean diff against this baseline.
      writeLastSeen(APP_VERSION);
    }
    // If `from >= APP_VERSION`, do nothing — already up to date.
  }, []);

  const dismiss = () => {
    writeLastSeen(APP_VERSION);
    setShow(false);
  };

  return { show, fromVersion, toVersion: APP_VERSION, dismiss };
}

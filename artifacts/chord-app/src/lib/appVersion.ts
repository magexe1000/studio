/**
 * Single source of truth for the Studio app version.
 *
 * Every consumer (Settings UI, OTA checker, debug tools, analytics)
 * MUST import from this module. Never hardcode a version string
 * elsewhere — duplication leads to settings showing one version while
 * the OTA system compares against another, which silently breaks
 * update notifications.
 *
 * The `public/version.json` file shipped alongside the bundle is
 * generated from `APP_VERSION` at build time by
 * `scripts/sync-version.mjs` (wired in via the `prebuild` npm hook),
 * so the freshly-deployed bundle and its companion manifest are
 * always in lockstep.
 *
 * Bump `APP_VERSION` on every release. Bump `APP_CHANGELOG` to describe
 * what the user just received — that's the text shown in the
 * post-update modal on the first launch after the bundle is updated.
 *
 * Version format: strict semver (`MAJOR.MINOR.PATCH[-PRERELEASE]`).
 * The "Beta" label is presentation only — `APP_VERSION` itself stays
 * pure semver so comparisons are unambiguous.
 */

import { useMemo } from 'react';

/** Canonical semver string used by the OTA comparator. */
export const APP_VERSION = '3.3.4'; // Fixed manual APK recovery download stuck issues

/** Optional pre-release tag rendered in the UI (e.g. "Beta", "RC"). */
export const APP_VERSION_TAG = 'Beta';

/** Human-readable label rendered in Settings → About. */
export const APP_VERSION_LABEL = `${APP_VERSION_TAG} ${APP_VERSION}`;

/** Release date for the CURRENT bundle, shown alongside the version pill
 *  in the changelog sheet. ISO-8601 (`YYYY-MM-DD`). */
export const APP_VERSION_DATE = '2026-06-03'; // 3.3.4
// Note: keep ISO-8601. Bump together with APP_VERSION on each release.

/**
 * Changelog for the CURRENT release — shown to the user the first
 * time they launch the app after pulling this bundle, and from the
 * Settings → About → Changelog row at any time. Each section is a
 * heading + bullet list rendered Metrolist-style in `ChangelogSheet`.
 */
export interface ChangelogSection {
  /** Short uppercase header (e.g. "What's new", "Fixes"). */
  heading: string;
  /** Plain user-facing bullets. Keep each line short. */
  items: string[];
}

export const APP_CHANGELOG_SECTIONS: ChangelogSection[] = [
  {
    heading: "Manual Recovery Fixes",
    items: [
      'Fixed manual APK recovery downloads getting stuck at 100%.',
      'Added Firebase-hosted direct APK mirror for reliable recovery installs.',
      'Added Copy Link and GitHub Fallback options to the manual update flow.',
      'Improved APK download headers for better Android downloader compatibility.',
      'Prevented broken GitHub mobile download screen from blocking recovery.',
    ],
  },
  {
    heading: "Update Improvements",
    items: [
      'Manual recovery now uses Firebase Hosting as the primary APK source.',
      'GitHub Releases remain available as fallback and archive.',
      'Update metadata now includes manual and fallback APK URLs.',
    ],
  },
];

/** Spanish version of the current changelog — picked at render time
 *  by `ChangelogSheet` based on `settings.language`. */
export const APP_CHANGELOG_SECTIONS_ES: ChangelogSection[] = [
  {
    heading: "Correcciones de Recuperación",
    items: [
      'Corregidas descargas manuales de APK que quedaban atascadas en 100%.',
      'Añadido servidor alternativo directo en Firebase para descargas seguras.',
      'Añadidas opciones de Copiar Enlace y GitHub Alternativo en el diálogo.',
      'Mejoradas cabeceras de descarga de APK para compatibilidad con Android.',
      'Evitado que el gestor de descargas móviles de GitHub bloquee la actualización.',
    ],
  },
  {
    heading: "Mejoras de Actualización",
    items: [
      'La recuperación manual usa Firebase Hosting como origen principal del APK.',
      'GitHub Releases sigue disponible como archivo y servidor de respaldo.',
      'Metadatos de actualización ahora incluyen URL manual y alternativa.',
    ],
  },
];

/** German version of the current changelog. */
export const APP_CHANGELOG_SECTIONS_DE: ChangelogSection[] = [
  {
    heading: "Wiederherstellungs-Fixes",
    items: [
      'Manuelle APK-Downloads bleiben nicht mehr bei 100% hängen.',
      'Direkter Firebase-APK-Spiegel für zuverlässige Installationen hinzugefügt.',
      'Optionen zum Kopieren des Links und GitHub-Fallback hinzugefügt.',
      'MIME-Typ- und Cache-Header für APK-Dateien auf Android optimiert.',
      'Verhindert, dass fehlerhafte GitHub-Download-UIs die Installation blockieren.',
    ],
  },
  {
    heading: "Update-Verbesserungen",
    items: [
      'Die manuelle Wiederherstellung nutzt nun Firebase Hosting als primäre Quelle.',
      'GitHub Releases bleibt als Fallback und Archiv verfügbar.',
      'Update-Metadaten enthalten nun explizite manuelle und Fallback-URLs.',
    ],
  },
];

/** Returns the changelog sections for the requested language, falling
 *  back to English when no localized version is available. */
export function getChangelogSections(lang: string | undefined | null): ChangelogSection[] {
  if (lang === 'es') return APP_CHANGELOG_SECTIONS_ES;
  if (lang === 'de') return APP_CHANGELOG_SECTIONS_DE;
  return APP_CHANGELOG_SECTIONS;
}

/** Backwards-compatible flat bullet list (kept so any old caller still
 *  works). New UI should use `APP_CHANGELOG_SECTIONS`. */
export const APP_CHANGELOG = APP_CHANGELOG_SECTIONS.flatMap((s) => s.items);

/**
 * Parsed semver shape. Build metadata (everything after `+`) is
 * discarded — semver §10 says it has no precedence — but pre-release
 * identifiers are preserved so they can be compared per §11.
 */
interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  /** `null` for a release, e.g. "3.0.0". String for a prerelease, e.g. "beta.2". */
  prerelease: string | null;
}

/**
 * STRICT semver parser. Rejects leading zeros, missing parts, and
 * malformed input. Accepts a leading `v` (common in tag names) and
 * strips any `+build` metadata. Returns `null` on any parse failure
 * so callers can treat un-parseable input as "no comparison possible".
 *
 * Examples:
 *   "3.0.0"      → { 3, 0, 0, null }
 *   "v3.0.0"     → { 3, 0, 0, null }
 *   "3.0.0-beta" → { 3, 0, 0, "beta" }
 *   "3.0.0+abc"  → { 3, 0, 0, null }   (build metadata stripped)
 *   "01.2.3"     → null                 (leading zero)
 *   "3"          → null                 (incomplete)
 *   "3.0"        → null                 (incomplete)
 *   "garbage"    → null
 */
export function parseSemver(raw: string | null | undefined): ParsedSemver | null {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (s.startsWith('v') || s.startsWith('V')) s = s.slice(1);
  // Per semver.org: numeric identifiers must NOT have leading zeros.
  // Pre-release: dot-separated identifiers, each [0-9A-Za-z-]+.
  const m = s.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
  );
  if (!m) return null;
  // Per semver §9: a pre-release numeric identifier MUST NOT include
  // leading zeros. Reject e.g. "1.2.3-01" or "1.2.3-alpha.001".
  if (m[4]) {
    for (const id of m[4].split('.')) {
      if (/^\d+$/.test(id) && id.length > 1 && id.startsWith('0')) return null;
    }
  }
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
  };
}

/**
 * Convenience: returns just the [major, minor, patch] tuple, or `null`.
 * Pre-release info is dropped — callers that care about prerelease
 * precedence should use `parseSemver` + `compareSemver` directly.
 */
export function normalizeSemver(raw: string | null | undefined): [number, number, number] | null {
  const p = parseSemver(raw);
  return p ? [p.major, p.minor, p.patch] : null;
}

/**
 * Compare two semver strings. Returns -1 / 0 / +1 like Array.sort.
 * Returns 0 if either side fails to parse — i.e. an un-parseable
 * remote version is treated as "no update", never as a downgrade.
 *
 * Pre-release precedence per semver §11:
 *   - A version WITHOUT prerelease has HIGHER precedence than one WITH.
 *     ("3.0.0" > "3.0.0-beta" — the release supersedes the beta.)
 *   - Two prereleases compare identifier-by-identifier:
 *     numeric vs numeric → numeric;
 *     numeric vs alphanumeric → numeric is lower;
 *     alphanumeric vs alphanumeric → ASCII;
 *     fewer fields → lower precedence (when all prior fields equal).
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  // Same M.m.p — pre-release rules apply.
  if (pa.prerelease === null && pb.prerelease === null) return 0;
  if (pa.prerelease === null) return 1; // release > prerelease
  if (pb.prerelease === null) return -1;
  return comparePrerelease(pa.prerelease, pb.prerelease);
}

function comparePrerelease(a: string, b: string): -1 | 0 | 1 {
  const ai = a.split('.');
  const bi = b.split('.');
  const len = Math.max(ai.length, bi.length);
  for (let i = 0; i < len; i++) {
    const xa = ai[i];
    const xb = bi[i];
    // Fewer fields = lower precedence (semver §11.4.4).
    if (xa === undefined) return -1;
    if (xb === undefined) return 1;
    const na = /^\d+$/.test(xa) ? Number(xa) : null;
    const nb = /^\d+$/.test(xb) ? Number(xb) : null;
    if (na !== null && nb !== null) {
      if (na !== nb) return na > nb ? 1 : -1;
    } else if (na !== null) {
      return -1; // numeric identifier always < alphanumeric
    } else if (nb !== null) {
      return 1;
    } else {
      if (xa !== xb) return xa > xb ? 1 : -1;
    }
  }
  return 0;
}

/**
 * React hook returning the current app version. Memoised because the
 * version is constant for the lifetime of the page — we never want a
 * re-render to look like "the version changed".
 */
export function useAppVersion(): {
  version: string;
  label: string;
  tag: string;
  date: string;
  changelog: string[];
  sections: ChangelogSection[];
} {
  return useMemo(
    () => ({
      version: APP_VERSION,
      label: APP_VERSION_LABEL,
      tag: APP_VERSION_TAG,
      date: APP_VERSION_DATE,
      changelog: APP_CHANGELOG,
      sections: APP_CHANGELOG_SECTIONS,
    }),
    [],
  );
}

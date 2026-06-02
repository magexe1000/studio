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
export const APP_VERSION = '3.1.75';

/** Optional pre-release tag rendered in the UI (e.g. "Beta", "RC"). */
export const APP_VERSION_TAG = 'Beta';

/** Human-readable label rendered in Settings → About. */
export const APP_VERSION_LABEL = `${APP_VERSION_TAG} ${APP_VERSION}`;

/** Release date for the CURRENT bundle, shown alongside the version pill
 *  in the changelog sheet. ISO-8601 (`YYYY-MM-DD`). */
export const APP_VERSION_DATE = '2026-06-02'; // 3.1.75
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
    heading: "Device Permissions",
    items: [
      'Startup Permissions Prompt: Beautiful glassmorphic modal asking for Microphone and Notifications permission on startup if they aren\'t already granted, ensuring smooth integration with modern browser User Gesture security policies.',
    ],
  },
  {
    heading: "Subscription & Security",
    items: [
      'UID-Based Access Control: Absolute administration bypass granted strictly via static Firebase UID lists.',
      'Real-Time Profile Listeners: Installed a real-time onSnapshot listener synced with Google servers to prevent client manipulation.',
      'Developer Details Card: Check your active UID, provider, dynamic badge, and copy your UID instantly with a success toast.',
      'Interactive Pricing Tier: Choose between Free, Core, and Pro levels with dynamic billing tier highlighting and Coming Soon checkouts.',
    ],
  },
  {
    heading: "Visual Updates & FAQ",
    items: [
      'FAQ Symbol Fix: Resolved the text-fallback bug where the Help & FAQ accordion icon rendered the raw word "HELP".',
      'Auto-Update Startup Checker: Forced OTA updates check to run immediately on startup, bypassing toggles on launch so updates are always detected automatically.',
      'Full Material Symbols Load: Swapped out the fragile, extremely long subsetted font URL with the full robust CDN reference, permanently fixing plain-text overlapping icon bugs across the entire app.',
    ],
  },
];

/** Spanish version of the current changelog — picked at render time
 *  by `ChangelogSheet` based on `settings.language`. */
export const APP_CHANGELOG_SECTIONS_ES: ChangelogSection[] = [
  {
    heading: "Permisos de Dispositivo",
    items: [
      'Solicitud de Permisos al Inicio: Hermosa ventana modal que solicita permisos de Micrófono y Notificaciones al abrir la app si aún no se han concedido, asegurando un inicio sin bloqueos en navegadores modernos.',
    ],
  },
  {
    heading: "Suscripción y Seguridad",
    items: [
      'Control de Acceso UID: Omisión total de límites de facturación mediante listas estáticas de UID de Firebase.',
      'Sincronización en Tiempo Real: Se agregó un oyente Firestore onSnapshot directo para evitar alteración local.',
      'Detalles de Desarrollador: Visualiza tu UID activo, rol y proveedor con copiado rápido y toast de confirmación.',
      'Tarifas Interactivas: Elige entre planes Gratis, Core y Pro con resaltado de plan activo y alertas interactivas.',
    ],
  },
  {
    heading: "Diseño y FAQ",
    items: [
      'Icono de FAQ Reparado: Se corrigió el error visual donde el icono de Ayuda y FAQ se dibujaba como la palabra "HELP".',
      'Detector de Actualizaciones al Inicio: Se forzó el chequeo de actualizaciones al abrir la app para que siempre se busquen de forma automática.',
      'Carga Completa de Material Symbols: Se reemplazó la URL de fuentes optimizada por la referencia completa de la CDN para solucionar de forma permanente los textos superpuestos en todos los iconos.',
    ],
  },
];

/** German version of the current changelog. */
export const APP_CHANGELOG_SECTIONS_DE: ChangelogSection[] = [
  {
    heading: "Geräteberechtigungen",
    items: [
      'Berechtigungsabfrage beim Start: Elegantes Berechtigungs-Modal für Mikrofon und Benachrichtigungen, das beim App-Start angezeigt wird, falls diese noch nicht erteilt wurden, um Blockierungen durch Sicherheitsrichtlinien moderner Browser zu verhindern.',
    ],
  },
  {
    heading: "Abonnements & Sicherheit",
    items: [
      'UID-Zugriffskontrolle: Vollständiger Administrator-Bypass basierend auf statischen Firebase-UID-Listen.',
      'Echtzeit-Profil-Listener: Firestore onSnapshot-Verbindung zur direkten Validierung der Benutzerberechtigungen.',
      'Entwickler-Details: UID, E-Mail-Adresse und Berechtigungsrolle einsehen sowie UID direkt per Fingertipp kopieren.',
      'Interaktive Tarife: Wahlweise Free, Core und Pro Pläne mit Live-Highlighting und Benachrichtigung bei Upgrades.',
    ],
  },
  {
    heading: "FAQ & Design-Korrekturen",
    items: [
      'FAQ-Symbol Behoben: Render-Bug gelöst, bei dem das Akkordeon-Symbol fälschlicherweise als Text "HELP" gezeichnet wurde.',
      'Auto-Update beim Start: Das Suchen nach OTA-Updates wird nun sofort beim App-Start erzwungen, damit Updates immer direkt erkannt werden.',
      'Vollständiger Material Symbols-Import: Fragile, überlange optimierte Font-URL durch die vollständige, robuste CDN-Referenz ersetzt, um fehlerhafte Textdarstellungen bei allen Icons dauerhaft zu beheben.',
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

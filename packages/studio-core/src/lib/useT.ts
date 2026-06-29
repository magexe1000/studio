import { useMemo } from 'react';
import { useChordStore } from '../store/useChordStore';
import i18n from './i18nSetup';
import type { Translations } from './i18n';

function deepMerge<T>(base: T, override: unknown): T {
  if (override == null) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return (override as T) ?? base;
  }
  if (typeof override !== 'object' || Array.isArray(override)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(override as object)) {
    const ov = (override as Record<string, unknown>)[k];
    if (ov === undefined) continue;
    const bv = out[k];
    if (
      bv !== null && typeof bv === 'object' && !Array.isArray(bv) &&
      ov !== null && typeof ov === 'object' && !Array.isArray(ov)
    ) {
      out[k] = deepMerge(bv, ov);
    } else {
      out[k] = ov;
    }
  }
  return out as T;
}

function buildTranslations(lang: string): Translations {
  const enBundle =
    (i18n.getResourceBundle('en', 'translation') as Record<string, unknown>) ?? {};
  const langBundle =
    lang !== 'en'
      ? ((i18n.getResourceBundle(lang, 'translation') as Record<string, unknown>) ?? {})
      : {};
  const merged: Record<string, unknown> =
    lang !== 'en' ? (deepMerge(enBundle, langBundle) as Record<string, unknown>) : enBundle;

  const tr = (key: string, opts?: Record<string, unknown>): string =>
    i18n.t(key, { lng: lang, ...opts }) as string;

  const hub = (merged.hub as Record<string, unknown>) ?? {};
  const acct = (hub.accountSection as Record<string, unknown>) ?? {};
  const studioSets = (hub.studioSettings as Record<string, unknown>) ?? {};
  const settings = (merged.settings as Record<string, unknown>) ?? {};
  const sections = (settings.sections as Record<string, unknown>) ?? {};
  const rows = (settings.rows as Record<string, unknown>) ?? {};
  const colors = (settings.colors as Record<string, unknown>) ?? {};
  const langOpts = (settings.language as Record<string, unknown>) ?? {};
  const about = (settings.about as Record<string, unknown>) ?? {};

  return {
    ...merged,
    settings: {
      ...settings,
      sections: { ...sections },
      rows: { ...rows },
      colors: { ...colors },
      language: { ...langOpts },
      about: { ...about },
    },
    library: {
      ...((merged.library as Record<string, unknown>) ?? {}),
      results: (n: number) => tr('library.results', { count: n }),
      noResults: (q: string) => tr('library.noResults', { query: q }),
      chordCount: (n: number) => tr('library.chordCount', { count: n }),
      songCount: (shown: number, total: number) =>
        tr('library.songCount', { shown, total, count: total }),
      keyOf: (k: string) => tr('library.keyOf', { key: k }),
      bpmShort: (n: number) => tr('library.bpmShort', { bpm: n }),
      loadMore: (n: number) => tr('library.loadMore', { count: n }),
    },
    songs: {
      ...((merged.songs as Record<string, unknown>) ?? {}),
      bpmLabel: (bpm: number) => tr('songs.bpmLabel', { bpm }),
      keyLabel: (key: string) => tr('songs.keyLabel', { key }),
      chordsLabel: (n: number) => tr('songs.chordsLabel', { count: n }),
      selectedCount: (n: number) => tr('songs.selectedCount', { count: n }),
      semitones: (n: number) =>
        tr('songs.semitones', { n: Math.abs(n), sign: n > 0 ? '+' : '', count: Math.abs(n) }),
      sectionOf: (n: number) => tr('songs.sectionOf', { count: n }),
      unrecognizedCount: (n: number) => tr('songs.unrecognizedCount', { count: n }),
      unrecognizedWarning: (n: number) => tr('songs.unrecognizedWarning', { count: n }),
      songAlreadyExistsMsg: (name: string) => tr('songs.songAlreadyExistsMsg', { name }),
      importAs: (name: string) => tr('songs.importAs', { name }),
      replaceExistingWarning: (name: string) => tr('songs.replaceExistingWarning', { name }),
      songImportedDesc: (name: string) => tr('songs.songImportedDesc', { name }),
    },
    customBuilder: {
      ...((merged.customBuilder as Record<string, unknown>) ?? {}),
      detected: (name: string) => tr('customBuilder.detected', { name }),
      detectedHint: (name: string) => tr('customBuilder.detectedHint', { name }),
      fretsRange: (from: number, to: number) => tr('customBuilder.fretsRange', { from, to }),
    },
    hub: {
      ...hub,
      accountSection: {
        ...acct,
        pendingBody: (email: string) =>
          tr('hub.accountSection.pendingBody', { emailPart: email ? `(${email}) ` : '' }),
        pendingFooter: (days: number) =>
          tr('hub.accountSection.pendingFooter', { count: days }),
      },
      studioSettings: {
        ...studioSets,
        dynamicHelper: (lightStart: string, lightEnd: string) =>
          tr('hub.studioSettings.dynamicHelper', { lightStart, lightEnd }),
      },
    },
    vocalex: {
      ...((merged.vocalex as Record<string, unknown>) ?? {}),
      daysAgo: (n: number) => tr('vocalex.daysAgo', { count: n }),
      sessionName: (n: number) => tr('vocalex.sessionName', { n }),
      trackCount: (n: number) => tr('vocalex.trackCount', { count: n }),
      tipsCount: (n: number) => tr('vocalex.tipsCount', { count: n }),
    },
    groovex: {
      ...((merged.groovex as Record<string, unknown>) ?? {}),
      sessionsAvailable: (n: number) => tr('groovex.sessionsAvailable', { count: n }),
      tracksWillBeDownloaded: (n: number) =>
        tr('groovex.tracksWillBeDownloaded', { count: n }),
      stemsFailed: (n: number) => tr('groovex.stemsFailed', { count: n }),
      mixerTracks: (n: number) => tr('groovex.mixerTracks', { count: n }),
      songUnit: (n: number) => tr('groovex.songUnit', { count: n }),
    },
  } as unknown as Translations;
}

export function useT(): Translations {
  const language = useChordStore(s => s.settings.language);
  return useMemo(() => buildTranslations(language), [language]);
}

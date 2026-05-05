import { useMemo } from 'react';
import { useChordStore } from '../store/useChordStore';
import translations, { partialOverrides, type Translations } from './i18n';

/**
 * Deep-merge a partial override on top of a base object. Plain objects
 * recurse; arrays and primitives in `override` win as-is. Used so that
 * partial v3.0.57 language packs (de, fr, zh, pt, it, ja, ko) only need
 * to translate the strings they actually want to override — every key
 * they leave out transparently falls back to the English base.
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (override == null) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return (override as T) ?? base;
  }
  if (typeof override !== 'object' || Array.isArray(override)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(override)) {
    const ov = (override as Record<string, unknown>)[k];
    if (ov === undefined) continue;
    const bv = out[k];
    if (
      bv && typeof bv === 'object' && !Array.isArray(bv) &&
      ov && typeof ov === 'object' && !Array.isArray(ov)
    ) {
      out[k] = deepMerge(bv, ov);
    } else {
      out[k] = ov;
    }
  }
  return out as T;
}

export function useT(): Translations {
  const language = useChordStore(s => s.settings.language);
  return useMemo<Translations>(() => {
    if (language === 'en') return translations.en;
    if (language === 'es') return translations.es as unknown as Translations;
    const overlay = partialOverrides[language];
    if (!overlay) return translations.en;
    return deepMerge(translations.en, overlay);
  }, [language]);
}

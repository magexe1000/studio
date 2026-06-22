import en from '../i18n/en.json';
import es from '../i18n/es.json';
import de from '../i18n/de.json';
import fr from '../i18n/fr.json';
import zh from '../i18n/zh.json';
import pt from '../i18n/pt.json';
import it from '../i18n/it.json';
import ja from '../i18n/ja.json';
import ko from '../i18n/ko.json';

export type Language = 'en' | 'es' | 'de' | 'fr' | 'zh' | 'pt' | 'it' | 'ja' | 'ko';

export function detectDeviceLanguage(): Language {
  try {
    const raw = (typeof navigator !== 'undefined' && navigator.language)
      ? navigator.language.toLowerCase()
      : 'en';
    if (raw.startsWith('es')) return 'es';
    if (raw.startsWith('de')) return 'de';
    if (raw.startsWith('fr')) return 'fr';
    if (raw.startsWith('zh')) return 'zh';
    if (raw.startsWith('pt')) return 'pt';
    if (raw.startsWith('it')) return 'it';
    if (raw.startsWith('ja')) return 'ja';
    if (raw.startsWith('ko')) return 'ko';
  } catch { /* noop */ }
  return 'en';
}

export const translations = { en, es, de, fr, zh, pt, it, ja, ko } as const;

export type Translations = Omit<typeof en, 'library' | 'songs' | 'customBuilder' | 'hub' | 'vocalex' | 'groovex'> & {
  library: Omit<typeof en.library, 'results' | 'noResults' | 'chordCount' | 'songCount' | 'keyOf' | 'bpmShort' | 'loadMore'> & {
    results: (n: number) => string;
    noResults: (q: string) => string;
    chordCount: (n: number) => string;
    songCount: (shown: number, total: number) => string;
    keyOf: (k: string) => string;
    bpmShort: (n: number) => string;
    loadMore: (n: number) => string;
  };
  songs: Omit<typeof en.songs, 'bpmLabel' | 'keyLabel' | 'chordsLabel' | 'selectedCount' | 'semitones' | 'sectionOf' | 'unrecognizedCount' | 'unrecognizedWarning' | 'songAlreadyExistsMsg' | 'importAs' | 'replaceExistingWarning' | 'songImportedDesc'> & {
    bpmLabel: (bpm: number) => string;
    keyLabel: (key: string) => string;
    chordsLabel: (n: number) => string;
    selectedCount: (n: number) => string;
    semitones: (n: number) => string;
    sectionOf: (n: number) => string;
    unrecognizedCount: (n: number) => string;
    unrecognizedWarning: (n: number) => string;
    songAlreadyExistsMsg: (name: string) => string;
    importAs: (name: string) => string;
    replaceExistingWarning: (name: string) => string;
    songImportedDesc: (name: string) => string;
  };
  customBuilder: Omit<typeof en.customBuilder, 'detected' | 'detectedHint' | 'fretsRange'> & {
    detected: (name: string) => string;
    detectedHint: (name: string) => string;
    fretsRange: (from: number, to: number) => string;
  };
  hub: Omit<typeof en.hub, 'accountSection' | 'studioSettings'> & {
    accountSection: Omit<typeof en.hub.accountSection, 'pendingBody' | 'pendingFooter'> & {
      pendingBody: (email: string) => string;
      pendingFooter: (days: number) => string;
    };
    studioSettings: Omit<typeof en.hub.studioSettings, 'dynamicHelper'> & {
      dynamicHelper: (lightStart: string, lightEnd: string) => string;
    };
  };
  vocalex: Omit<typeof en.vocalex, 'daysAgo' | 'sessionName' | 'trackCount' | 'tipsCount'> & {
    daysAgo: (n: number) => string;
    sessionName: (n: number) => string;
    trackCount: (n: number) => string;
    tipsCount: (n: number) => string;
  };
  groovex: Omit<typeof en.groovex, 'sessionsAvailable' | 'tracksWillBeDownloaded' | 'stemsFailed' | 'mixerTracks' | 'songUnit'> & {
    sessionsAvailable: (n: number) => string;
    tracksWillBeDownloaded: (n: number) => string;
    stemsFailed: (n: number) => string;
    mixerTracks: (n: number) => string;
    songUnit: (n: number) => string;
  };
};

type WidenStrings<T> =
  T extends string ? string :
  T extends number ? number :
  T extends boolean ? boolean :
  T extends (...args: infer A) => infer R ? (...args: A) => R :
  T extends object ? { -readonly [K in keyof T]: WidenStrings<T[K]> } :
  T;
type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export const partialOverrides: { [K in Language]?: DeepPartial<WidenStrings<Translations>> } = translations;

export default translations;

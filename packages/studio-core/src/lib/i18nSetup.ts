import i18n from 'i18next';
import { Tolgee, DevTools, FormatSimple } from '@tolgee/react';

import en from '../i18n/en.json';
import es from '../i18n/es.json';
import de from '../i18n/de.json';
import fr from '../i18n/fr.json';
import zh from '../i18n/zh.json';
import pt from '../i18n/pt.json';
import it from '../i18n/it.json';
import ja from '../i18n/ja.json';
import ko from '../i18n/ko.json';

void i18n.init({
  initImmediate: false,
  resources: {
    en: { translation: en },
    es: { translation: es },
    de: { translation: de },
    fr: { translation: fr },
    zh: { translation: zh },
    pt: { translation: pt },
    it: { translation: it },
    ja: { translation: ja },
    ko: { translation: ko },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
} as any);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const staticData = { en, es, de, fr, zh, pt, it, ja, ko } as any;

const tolgeeConfig: Parameters<ReturnType<typeof Tolgee>['init']>[0] = {
  staticData,
  defaultLanguage: 'en',
  availableLanguages: ['en', 'es', 'de', 'fr', 'zh', 'pt', 'it', 'ja', 'ko'],
};

const apiKey = import.meta.env.VITE_APP_TOLGEE_API_KEY as string | undefined;
if (apiKey) {
  tolgeeConfig.apiKey = apiKey;
  tolgeeConfig.apiUrl =
    (import.meta.env.VITE_APP_TOLGEE_API_URL as string | undefined) ??
    'https://app.tolgee.io';
}

export const tolgee = Tolgee()
  .use(DevTools())
  .use(FormatSimple())
  .init(tolgeeConfig);

export default i18n;

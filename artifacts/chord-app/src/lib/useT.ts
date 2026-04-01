import { useChordStore } from '../store/useChordStore';
import translations from './i18n';

export function useT() {
  const language = useChordStore(s => s.settings.language);
  return translations[language] ?? translations.en;
}

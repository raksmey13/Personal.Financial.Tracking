import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import km from './locales/km.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      km: { translation: km },
    },
    lng: 'en', // default language until settings load from backend
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React handles escaping by default
    },
  });

export default i18n;
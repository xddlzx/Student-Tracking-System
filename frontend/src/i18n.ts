import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import tr from './locales/tr-TR.json'
import en from './locales/en-US.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'tr-TR': { translation: tr },
      'en-US': { translation: en }
    },
    lng: 'tr-TR',
    fallbackLng: 'tr-TR',
    interpolation: { escapeValue: false }
  })

export default i18n

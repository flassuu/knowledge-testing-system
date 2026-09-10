import { createI18n } from 'vue-i18n'
import en from './locales/en'
import uk from './locales/uk'

// Extending the locale list is a one-place change: add the `import` above
// and one entry in the `messages` map below.
const messages = {
  en,
  uk,
} as const

export type Locale = keyof typeof messages

export const supportedLocales: Locale[] = ['en', 'uk']

export const fallbackLocale: Locale = 'en'

function detectLocale(): Locale {
  const stored = localStorage.getItem('locale') as Locale | null
  if (stored && supportedLocales.includes(stored)) return stored
  for (const locale of supportedLocales) {
    if (navigator.language.toLowerCase().startsWith(locale)) return locale
  }
  return fallbackLocale
}

const i18n = createI18n<[typeof messages.en, typeof messages.uk], Locale>({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale,
  messages,
})

export default i18n
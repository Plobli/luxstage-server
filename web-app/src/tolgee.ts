/**
 * Zentrale Tolgee-Instanz.
 * Dev: lädt live vom Tolgee-Server (VITE_APP_TOLGEE_API_URL) inkl.
 * In-Context-Editor (DevTools).
 * Prod: kein Server-Zugriff, kein DevTools-UI — nur die zur Build-Zeit
 * exportierten de.json/en.json aus shared/locales/ als staticData.
 */
import { Tolgee, DevTools, FormatSimple } from '@tolgee/vue'
import de from '../../shared/locales/de.json'
import en from '../../shared/locales/en.json'

let tolgeeBuilder = Tolgee().use(FormatSimple())

if (import.meta.env.DEV) {
  tolgeeBuilder = tolgeeBuilder.use(DevTools())
}

export const tolgee = tolgeeBuilder.init({
  language: localStorage.getItem('locale') || 'de',
  fallbackLanguage: 'de',

  ...(import.meta.env.DEV
    ? {
        apiUrl: import.meta.env.VITE_APP_TOLGEE_API_URL,
        apiKey: import.meta.env.VITE_APP_TOLGEE_API_KEY,
      }
    : {}),

  staticData: {
    de: () => Promise.resolve(de),
    en: () => Promise.resolve(en),
  },
})

tolgee.on('language', ({ value }) => {
  localStorage.setItem('locale', value)
})

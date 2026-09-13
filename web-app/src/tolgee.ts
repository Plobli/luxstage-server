/**
 * Zentrale Tolgee-Instanz.
 * Übersetzungen werden ausschließlich aus shared/locales/de.json und
 * en.json geladen (manuell gepflegt, kein Tolgee-Server/Sync mehr).
 */
import { Tolgee, FormatSimple } from '@tolgee/vue'
import de from '../../shared/locales/de.json'
import en from '../../shared/locales/en.json'

export const tolgee = Tolgee()
  .use(FormatSimple())
  .init({
    language: localStorage.getItem('locale') || 'de',
    fallbackLanguage: 'de',

    staticData: {
      de: () => Promise.resolve(de),
      en: () => Promise.resolve(en),
    },
  })

tolgee.on('language', ({ value }) => {
  localStorage.setItem('locale', value)
})

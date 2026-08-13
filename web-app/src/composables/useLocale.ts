/**
 * useLocale — Kompatibilitäts-Bridge auf @tolgee/vue
 * Bestehende t(key, params)-Aufrufe bleiben unverändert, laufen aber
 * jetzt durch Tolgee (inkl. In-Context-Editor). de.json/en.json dienen
 * als staticData-Fallback, siehe tolgee.ts.
 */
import { computed, type ComputedRef } from 'vue'
import { useTranslate, useTolgee } from '@tolgee/vue'

export interface UseLocaleReturn {
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: ComputedRef<string>;
  setLocale: (lang: string) => void;
}

export function useLocale(): UseLocaleReturn {
  const { t: tolgeeT } = useTranslate()
  const tolgee = useTolgee(['language'])

  function t(key: string, params?: Record<string, string | number>): string {
    return tolgeeT.value(key, params as Record<string, string> | undefined)
  }

  function setLocale(lang: string): void {
    tolgee.value.changeLanguage(lang)
  }

  return { t, locale: computed(() => tolgee.value.getLanguage() ?? 'de'), setLocale }
}


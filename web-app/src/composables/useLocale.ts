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
  ready: () => Promise<void>;
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

  // Wartet, bis Übersetzungen geladen sind — nötig für t()-Aufrufe, deren
  // Ergebnis dauerhaft gespeichert wird (z.B. in Notizfeldern), da t() sonst
  // vor Abschluss des initialen Ladevorgangs den rohen Key zurückgibt.
  async function ready(): Promise<void> {
    if (tolgee.value.isLoaded()) return
    await tolgee.value.run()
  }

  return { t, locale: computed(() => tolgee.value.getLanguage() ?? 'de'), setLocale, ready }
}


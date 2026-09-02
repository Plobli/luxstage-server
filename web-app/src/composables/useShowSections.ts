import { ref, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchShowSections, saveShowSections, fetchShowSectionDefs, saveShowSectionDefs } from '../api/sections'
import { updateMeta } from '../api/shows'
import { ApiError } from '../api/client'

export interface SectionDef {
  id: string;
  label?: string;
  [key: string]: any;
}

export interface SectionContent {
  id: string;
  content: string;
}

export function useShowSections(showId: string, meta: Ref<any>, onLockConflict?: (body: { lockedBy?: string, since?: number }) => void) {
  const sectionDefs = ref<SectionDef[]>([])
  const sectionContents = ref<Map<string, string>>(new Map())
  const sectionsSaving = ref(false)

  // 800ms Pause seit letzter Änderung bevor gespeichert wird — verhindert, dass
  // jeder einzelne Tastendruck in einem Freitextfeld einen eigenen Undo-Eintrag
  // erzeugt und den Undo-Stack (max. 50 Einträge) nach einem einzigen getippten
  // Satz aufbraucht. maxWait sorgt dafür, dass bei ununterbrochenem Tippen trotzdem
  // spätestens alle 4s gespeichert wird (Schutz gegen Datenverlust bei Absturz/
  // Tab-Schließen während langer Eingabe).
  const SAVE_DEBOUNCE_MS = 800
  const SAVE_MAX_WAIT_MS = 4000

  const persistSectionsDebounced = useDebounceFn(async () => {
    await doPersistSections()
  }, SAVE_DEBOUNCE_MS, { maxWait: SAVE_MAX_WAIT_MS })

  async function persistSections(): Promise<void> {
    await doPersistSections()
  }

  // Erzwingt ein sofortiges Speichern, ohne auf die Debounce-Pause zu warten —
  // an @blur eines Textfelds hängen, damit ein Verlassen des Felds nie auf die
  // nächste Pause wartet und die Änderung bei einem Wechsel zu einem anderen
  // Bereich sicher übernommen ist.
  async function flushSectionsSave(): Promise<void> {
    if (!sectionsSaving.value) return
    await doPersistSections()
  }

  async function doPersistSections(): Promise<void> {
    sectionsSaving.value = true
    try {
      const sections: SectionContent[] = [...sectionContents.value.entries()].map(([id, content]) => ({ id, content }))
      await saveShowSections(showId, sections)
      if (meta.value) {
        meta.value.datum = new Date().toISOString().split('T')[0]
        await updateMeta(showId, { ...meta.value })
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        onLockConflict?.(e.body)
        return
      }
      throw e
    } finally {
      sectionsSaving.value = false
    }
  }

  async function loadSections(): Promise<void> {
    const [sections, defs] = await Promise.all([
      fetchShowSections(showId),
      fetchShowSectionDefs(showId)
    ])
    sectionContents.value = new Map((Array.isArray(sections) ? sections : []).map(s => [s.id, s.content]))
    sectionDefs.value = Array.isArray(defs) ? defs : []
  }

  async function persistSectionDefs(): Promise<void> {
    try {
      await saveShowSectionDefs(showId, sectionDefs.value)
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        onLockConflict?.(e.body)
        return
      }
      throw e
    }
  }

  return {
    sectionDefs,
    sectionContents,
    sectionsSaving,
    persistSectionsDebounced,
    persistSections,
    flushSectionsSave,
    persistSectionDefs,
    loadSections,
  }
}

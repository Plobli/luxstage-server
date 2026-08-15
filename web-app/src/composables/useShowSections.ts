import { ref, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchShowSections, saveShowSections, fetchShowSectionDefs, saveShowSectionDefs } from '../api/sections'
import { invalidate } from '../api/cache'
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

export function useShowSections(showId: string, meta: Ref<any>) {
  const sectionDefs = ref<SectionDef[]>([])
  const sectionContents = ref<Map<string, string>>(new Map())
  const sectionsSaving = ref(false)
  let ignoreSectionsSseCount = 0

  // Serverstand, auf dem die aktuelle Kopie basiert — analog zu channelsVersion
  // in useShowChannels.ts. Inhalte und Definitionen haben getrennte Versionen,
  // da sie über unterschiedliche Endpunkte unabhängig gespeichert werden.
  const sectionContentsVersion = ref<string | null>(null)
  const sectionDefsVersion = ref<string | null>(null)
  const sectionsConflict = ref<{ kind: 'contents' | 'defs', serverVersion: string, serverSections: any[] } | null>(null)

  const persistSectionsDebounced = useDebounceFn(async () => {
    await doPersistSections()
  }, 50)

  async function persistSections(): Promise<void> {
    await doPersistSections()
  }

  async function doPersistSections(): Promise<void> {
    sectionsSaving.value = true
    ignoreSectionsSseCount++
    try {
      const sections: SectionContent[] = [...sectionContents.value.entries()].map(([id, content]) => ({ id, content }))
      const { version } = await saveShowSections(showId, sections, sectionContentsVersion.value)
      sectionContentsVersion.value = version
      if (meta.value) {
        meta.value.datum = new Date().toISOString().split('T')[0]
        await updateMeta(showId, { ...meta.value })
      }
      invalidate('shows')
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        ignoreSectionsSseCount = Math.max(0, ignoreSectionsSseCount - 1)
        sectionsConflict.value = { kind: 'contents', serverVersion: e.body.serverVersion, serverSections: e.body.serverSections }
        return
      }
      throw e
    } finally {
      sectionsSaving.value = false
    }
  }

  async function loadSections(): Promise<void> {
    const [sectionsRes, defsRes] = await Promise.all([
      fetchShowSections(showId),
      fetchShowSectionDefs(showId)
    ])
    sectionContents.value = new Map((Array.isArray(sectionsRes.sections) ? sectionsRes.sections : []).map(s => [s.id, s.content]))
    sectionContentsVersion.value = sectionsRes.version
    sectionDefs.value = Array.isArray(defsRes.defs) ? defsRes.defs : []
    sectionDefsVersion.value = defsRes.version
  }

  async function handleSectionsSse(): Promise<void> {
    if (ignoreSectionsSseCount > 0) { ignoreSectionsSseCount--; return }
    const [sectionsRes, defsRes] = await Promise.all([
      fetchShowSections(showId),
      fetchShowSectionDefs(showId),
    ])
    sectionContents.value = new Map((Array.isArray(sectionsRes.sections) ? sectionsRes.sections : []).map(section => [section.id, section.content]))
    sectionContentsVersion.value = sectionsRes.version
    sectionDefs.value = Array.isArray(defsRes.defs) ? defsRes.defs : []
    sectionDefsVersion.value = defsRes.version
  }

  async function persistSectionDefs(): Promise<void> {
    try {
      const { version } = await saveShowSectionDefs(showId, sectionDefs.value, sectionDefsVersion.value)
      sectionDefsVersion.value = version
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        sectionsConflict.value = { kind: 'defs', serverVersion: e.body.serverVersion, serverSections: e.body.serverSections }
        return
      }
      throw e
    }
  }

  /** Konfliktauflösung: eigene Änderung verwerfen, Serverstand übernehmen. */
  function resolveSectionsConflictReload(): void {
    const conflict = sectionsConflict.value
    if (!conflict) return
    if (conflict.kind === 'contents') {
      sectionContents.value = new Map(conflict.serverSections.map((s: SectionContent) => [s.id, s.content]))
      sectionContentsVersion.value = conflict.serverVersion
    } else {
      sectionDefs.value = conflict.serverSections
      sectionDefsVersion.value = conflict.serverVersion
    }
    sectionsConflict.value = null
  }

  /** Konfliktauflösung: eigene Änderung trotzdem erzwingen. */
  async function resolveSectionsConflictForce(): Promise<void> {
    const conflict = sectionsConflict.value
    if (!conflict) return
    sectionsConflict.value = null
    if (conflict.kind === 'contents') {
      sectionContentsVersion.value = conflict.serverVersion
      await doPersistSections()
    } else {
      sectionDefsVersion.value = conflict.serverVersion
      await persistSectionDefs()
    }
  }

  return {
    sectionDefs,
    sectionContents,
    sectionsSaving,
    persistSectionsDebounced,
    persistSections,
    persistSectionDefs,
    loadSections,
    handleSectionsSse,
    sectionsConflict,
    resolveSectionsConflictReload,
    resolveSectionsConflictForce
  }
}

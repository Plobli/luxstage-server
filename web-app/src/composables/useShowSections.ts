import { ref, type Ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchShowSections, saveShowSections, fetchShowSectionDefs, saveShowSectionDefs } from '../api/sections'
import { invalidate } from '../api/cache'
import { updateMeta } from '../api/shows'

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
      await saveShowSections(showId, sections)
      if (meta.value) {
        meta.value.datum = new Date().toISOString().split('T')[0]
        await updateMeta(showId, { ...meta.value })
      }
      invalidate('shows')
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

  async function handleSectionsSse(): Promise<void> {
    if (ignoreSectionsSseCount > 0) { ignoreSectionsSseCount--; return }
    const [sections, defs] = await Promise.all([
      fetchShowSections(showId),
      fetchShowSectionDefs(showId),
    ])
    sectionContents.value = new Map((Array.isArray(sections) ? sections : []).map(section => [section.id, section.content]))
    sectionDefs.value = Array.isArray(defs) ? defs : []
  }

  async function persistSectionDefs(): Promise<void> {
    await saveShowSectionDefs(showId, sectionDefs.value)
  }

  return {
    sectionDefs,
    sectionContents,
    sectionsSaving,
    persistSectionsDebounced,
    persistSections,
    persistSectionDefs,
    loadSections,
    handleSectionsSse
  }
}


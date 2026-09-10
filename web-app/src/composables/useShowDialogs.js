import { ref } from 'vue'
import { uuid } from '../utils/uuid.js'
import { sectionTypeHasRows } from '@shared/constants.js'

// Bündelt den Zustand für ShowDetailDialogs.vue in ShowDetailView.vue: den "Neuer
// Abschnitt"-Dialog (bisher lokal in ShowDetailView.vue, ohne eigenes Composable) plus
// eine Fassade über die bereits vorhandenen Dialog-Zustände aus useTemplateInsertion/
// useShowChannels (eosMergePreview), damit ShowDetailDialogs.vue ein einziges Objekt
// konsumiert statt ~15 einzelner Props/v-models. Bewusst NICHT hier: die fachliche
// Logik von useTemplateInsertion/useShowChannels selbst — nur die Zusammenführung ihrer
// bereits fertigen Refs/Funktionen für die Dialog-Komponente.

export function useShowDialogs({
  sectionDefs, aufbauTab, aufbauSubTabs, aufbauSectionId,
  persistSectionDefs, confirm, t,
  templateInsertion, eosMergePreview, resolveEosMergePreview,
}) {
  const newSectionDialog = ref(false)
  const newSectionName = ref('')
  const newSectionType = ref('markdown')

  function addSectionFromSubtab() {
    newSectionName.value = ''
    newSectionType.value = 'markdown'
    newSectionDialog.value = true
  }

  async function confirmNewSection() {
    const title = newSectionName.value.trim()
    if (!title) return
    newSectionDialog.value = false
    const id = uuid()
    const newDefs = [...sectionDefs.value, { id, title, type: newSectionType.value, order: sectionDefs.value.length, rows: sectionTypeHasRows(newSectionType.value) ? [] : undefined }]
    sectionDefs.value = newDefs
    await persistSectionDefs()
    aufbauTab.value = `section:${id}`
  }

  async function deleteSection(sectionId) {
    if (sectionId === aufbauSectionId.value) return
    const ok = await confirm({ t, titleKey: 'action.delete', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
    if (!ok) return
    const newDefs = sectionDefs.value
      .filter(s => s.id !== sectionId)
      .map((s, i) => ({ ...s, order: i }))
    sectionDefs.value = newDefs
    await persistSectionDefs()
    if (aufbauTab.value === `section:${sectionId}`) {
      aufbauTab.value = aufbauSubTabs.value[0]?.key ?? aufbauTab.value
    }
  }

  async function renameSection(sectionId, title) {
    const trimmed = title.trim()
    if (!trimmed) return
    const sec = sectionDefs.value.find(s => s.id === sectionId)
    if (!sec || sec.title === trimmed) return
    sec.title = trimmed
    await persistSectionDefs()
  }

  return {
    newSectionDialog, newSectionName, newSectionType,
    addSectionFromSubtab, confirmNewSection, deleteSection, renameSection,
    eosMergePreview,
    resolveEosMergePreview,
    ...templateInsertion,
  }
}

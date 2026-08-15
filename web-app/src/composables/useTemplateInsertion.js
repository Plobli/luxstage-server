import { ref } from 'vue'
import { api } from '../api/client.js'
import { applyTemplateToShow, saveShowItemsToTemplate } from '../api/shows.js'
import { fetchTemplateBars } from '../api/templateBars.js'
import { fetchTemplateTowers } from '../api/templateTowers.js'

export function useTemplateInsertion(showId, meta, { loadBars, loadTowers }) {
  const fromTemplateDialogOpen = ref(false)
  const fromTemplateScope = ref('bars')
  const fromTemplateWithChannels = ref(false)
  const fromTemplateLoading = ref(false)
  const fromTemplateItemsLoading = ref(false)
  const fromTemplateItems = ref([])
  const fromTemplateSelectedIds = ref(new Set())

  function fromTemplateToggleId(id) {
    const selected = new Set(fromTemplateSelectedIds.value)
    if (selected.has(id)) selected.delete(id)
    else selected.add(id)
    fromTemplateSelectedIds.value = selected
  }

  function fromTemplateSelectAll() {
    fromTemplateSelectedIds.value = new Set(fromTemplateItems.value.map(item => item.id))
  }

  function fromTemplateSelectNone() {
    fromTemplateSelectedIds.value = new Set()
  }

  async function openFromTemplateDialog(scope) {
    const templateName = meta.value.template
    if (!templateName) return
    fromTemplateScope.value = scope
    fromTemplateWithChannels.value = false
    fromTemplateItems.value = []
    fromTemplateSelectedIds.value = new Set()
    fromTemplateDialogOpen.value = true
    fromTemplateItemsLoading.value = true
    try {
      if (scope === 'bars') {
        const items = await fetchTemplateBars(templateName)
        fromTemplateItems.value = await Promise.all(items.map(async bar => {
          try {
            const fixtures = await api.get(`/api/templates/${encodeURIComponent(templateName)}/bars/${bar.id}/fixtures`)
            return { ...bar, _fixtureCount: fixtures.length }
          } catch {
            return { ...bar, _fixtureCount: 0 }
          }
        }))
      } else {
        fromTemplateItems.value = await fetchTemplateTowers(templateName)
      }
      fromTemplateSelectAll()
    } finally {
      fromTemplateItemsLoading.value = false
    }
  }

  async function saveTowerToTemplate(tower, fields, overrideName) {
    if (!meta.value.template) return
    await saveShowItemsToTemplate(showId, meta.value.template, 'towers', [tower.id], fields, overrideName)
  }

  async function saveBarToTemplate(bar, fields, overrideName) {
    if (!meta.value.template) return
    await saveShowItemsToTemplate(showId, meta.value.template, 'bars', [bar.id], fields, overrideName)
  }

  async function fetchTowerTemplateNames() {
    if (!meta.value.template) return []
    const items = await fetchTemplateTowers(meta.value.template)
    return items.map(tower => tower.name)
  }

  async function fetchBarTemplateNames() {
    if (!meta.value.template) return []
    const items = await fetchTemplateBars(meta.value.template)
    return items.map(bar => bar.name)
  }

  async function confirmFromTemplate() {
    if (!meta.value.template) return
    fromTemplateLoading.value = true
    try {
      await applyTemplateToShow(
        showId,
        meta.value.template,
        fromTemplateScope.value,
        fromTemplateWithChannels.value,
        [...fromTemplateSelectedIds.value]
      )
      if (fromTemplateScope.value === 'bars') await loadBars()
      else await loadTowers()
      fromTemplateDialogOpen.value = false
    } finally {
      fromTemplateLoading.value = false
    }
  }

  return {
    fromTemplateDialogOpen,
    fromTemplateScope,
    fromTemplateWithChannels,
    fromTemplateLoading,
    fromTemplateItemsLoading,
    fromTemplateItems,
    fromTemplateSelectedIds,
    fromTemplateToggleId,
    fromTemplateSelectAll,
    fromTemplateSelectNone,
    openFromTemplateDialog,
    saveTowerToTemplate,
    saveBarToTemplate,
    fetchTowerTemplateNames,
    fetchBarTemplateNames,
    confirmFromTemplate,
  }
}
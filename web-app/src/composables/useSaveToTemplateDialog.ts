import { ref, watch } from 'vue'

// Kapselt das "Als Vorlage speichern"-Dialog-Pattern, das GassenturmView (Towers)
// und ZugstangenView (Bars) identisch implementieren: Dialog öffnen, Namenskonflikt
// gegen bestehende Templates prüfen, auf Bestätigung speichern.
//
// defaultFields: Startzustand der Checkbox-Auswahl (unterscheidet sich je Domäne,
// z.B. Towers ohne 'position'/'notes', Bars mit).
export function useSaveToTemplateDialog<TItem extends { id: string; name: string }, TFields extends Record<string, boolean>>(
  saveToTemplateFn: ((item: TItem, fields: TFields, name: string) => Promise<void>) | null | undefined,
  fetchTemplateNamesFn: (() => Promise<string[]>) | null | undefined,
  defaultFields: TFields,
) {
  const saveDialogOpen = ref(false)
  const savingId = ref<string | null>(null)
  const saveDialogItem = ref<TItem | null>(null)
  const saveFields = ref<TFields>({ ...defaultFields })
  const saveName = ref('')
  const existingTemplateNames = ref<Set<string>>(new Set())
  const saveNameConflict = ref(false)
  const saveConfirmOverwrite = ref(false)

  async function openSaveDialog(item: TItem) {
    saveDialogItem.value = item
    saveFields.value = { ...defaultFields }
    saveName.value = item.name
    saveNameConflict.value = false
    saveConfirmOverwrite.value = false
    saveDialogOpen.value = true
    if (fetchTemplateNamesFn) {
      const names = await fetchTemplateNamesFn()
      existingTemplateNames.value = new Set(names)
    }
  }

  watch(saveName, () => {
    saveNameConflict.value = false
    saveConfirmOverwrite.value = false
  })

  async function confirmSaveDialog() {
    const item = saveDialogItem.value
    if (!item || !saveName.value.trim() || !saveToTemplateFn) return
    const name = saveName.value.trim()
    if (!saveConfirmOverwrite.value && existingTemplateNames.value.has(name)) {
      saveNameConflict.value = true
      return
    }
    savingId.value = item.id
    try {
      await saveToTemplateFn(item, { ...saveFields.value }, name)
      saveDialogOpen.value = false
      saveNameConflict.value = false
      saveConfirmOverwrite.value = false
    } finally {
      savingId.value = null
    }
  }

  return {
    saveDialogOpen, savingId, saveDialogItem, saveFields, saveName,
    saveNameConflict, saveConfirmOverwrite,
    openSaveDialog, confirmSaveDialog,
  }
}

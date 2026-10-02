import { ref, watch } from 'vue'
import { createShow, applyTemplateToShow } from '../api/shows.js'
import { fetchTemplateChannels } from '../api/templates.js'
import { fetchTemplateSections } from '../api/sections.js'
import { fetchTemplateBattens } from '../api/templateBattens.js'
import { fetchTemplateTowers } from '../api/templateTowers.js'
import { saveChannels } from '../api/channels.js'
import { currentSpielzeit, generateShowId as generateId } from '../utils/index.ts'

function emptyForm() {
  return {
    name: '',
    datum: new Date().toISOString().slice(0, 10),
    template: '__none__',
    spielzeit: currentSpielzeit(),
    use_battens: true,
    use_towers: true,
    importChannels: true,
  }
}

/**
 * Datenzugriff für den "Show anlegen"-Assistenten: Vorlagendetails laden
 * sobald eine Vorlage gewählt wird, Show samt gewählter Vorlagenbestandteile
 * anlegen. Liegt hier statt in ShowWizardDialog.vue, damit die Komponente
 * ohne laufenden Server darstellbar bleibt (F-04).
 */
export function useShowWizard() {
  const form = ref(emptyForm())
  const templateSections = ref([])
  const templateBattens = ref([])
  const templateTowers = ref([])
  const selectedSectionIds = ref(new Set())
  const selectedBattenIds = ref(new Set())
  const selectedTowerIds = ref(new Set())
  const creating = ref(false)

  // Nimmt den Namen der Auswahl-Ref statt der Ref selbst entgegen: im Template
  // entpackt $setup Refs automatisch (Auto-Unwrap), sodass eine übergebene Ref
  // dort bereits das rohe Set wäre und toggleSelection() beim Zugriff auf
  // .value crashen würde.
  const selectionRefs = { sections: selectedSectionIds, battens: selectedBattenIds, towers: selectedTowerIds }
  function toggleSelection(key, id) {
    const setRef = selectionRefs[key]
    const next = new Set(setRef.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setRef.value = next
  }

  function reset() {
    form.value = emptyForm()
    templateSections.value = []
    templateBattens.value = []
    templateTowers.value = []
    selectedSectionIds.value = new Set()
    selectedBattenIds.value = new Set()
    selectedTowerIds.value = new Set()
  }

  watch(() => form.value.template, async (name) => {
    if (name === '__none__') {
      templateSections.value = []
      templateBattens.value = []
      templateTowers.value = []
      return
    }
    try {
      const [sections, battens, towers] = await Promise.all([
        fetchTemplateSections(name),
        fetchTemplateBattens(name),
        fetchTemplateTowers(name),
      ])
      templateSections.value = Array.isArray(sections) ? sections : (sections?.sections ?? [])
      templateBattens.value = battens
      templateTowers.value = towers
      selectedSectionIds.value = new Set(templateSections.value.map(s => s.id))
      selectedBattenIds.value = new Set(templateBattens.value.map(b => b.id))
      selectedTowerIds.value = new Set(templateTowers.value.map(t => t.id))
    } catch (e) {
      console.error('Failed to load template details:', e)
      templateSections.value = []
      templateBattens.value = []
      templateTowers.value = []
    }
  })

  // Legt die Show an und wendet die gewählten Vorlagenbestandteile an. Jeder
  // Anwendungsschritt fängt seinen eigenen Fehler ab, damit z.B. ein
  // fehlgeschlagener Kreis-Import die bereits angelegte Show nicht verwaist
  // zurücklässt — nur ein Fehlschlag von createShow() selbst bricht ab
  // (Rückgabewert null, Dialog bleibt offen).
  async function createShowFromWizard() {
    creating.value = true
    const id = generateId(form.value.name, form.value.datum)
    try {
      const tplCreate = form.value.template === '__none__' ? '' : form.value.template
      const datum = form.value.datum || new Date().toISOString().slice(0, 10)
      const content = `---\nid: ${id}\nname: ${form.value.name || id}\ndatum: ${datum}\n${tplCreate ? `template: ${tplCreate}\n` : ''}---\n\n`
      await createShow({
        id,
        name: form.value.name || id,
        datum,
        content,
        template: tplCreate || undefined,
        spielzeit: form.value.spielzeit || undefined,
        use_battens: form.value.use_battens,
        use_towers: form.value.use_towers,
        importSections: false,
      })

      if (tplCreate && form.value.use_towers && selectedTowerIds.value.size) {
        try {
          await applyTemplateToShow(id, tplCreate, 'towers', false, [...selectedTowerIds.value])
        } catch (e) {
          console.error('Failed to apply template (towers):', e)
        }
      }
      if (tplCreate && form.value.use_battens && selectedBattenIds.value.size) {
        try {
          await applyTemplateToShow(id, tplCreate, 'battens', false, [...selectedBattenIds.value])
        } catch (e) {
          console.error('Failed to apply template (battens):', e)
        }
      }
      if (tplCreate && selectedSectionIds.value.size) {
        try {
          await applyTemplateToShow(id, tplCreate, 'sections', false, [...selectedSectionIds.value])
        } catch (e) {
          console.error('Failed to apply template (sections):', e)
        }
      }
      if (tplCreate && form.value.importChannels) {
        try {
          const channels = await fetchTemplateChannels(tplCreate)
          if (channels.length) await saveChannels(id, channels)
        } catch (e) {
          console.error('Failed to apply template channels:', e)
        }
      }

      return { id, name: form.value.name || id, datum, template: tplCreate }
    } catch (e) {
      console.error('Failed to create show:', e)
      return null
    } finally {
      creating.value = false
    }
  }

  return {
    form, templateSections, templateBattens, templateTowers,
    selectedSectionIds, selectedBattenIds, selectedTowerIds,
    creating, toggleSelection, reset, createShowFromWizard,
  }
}

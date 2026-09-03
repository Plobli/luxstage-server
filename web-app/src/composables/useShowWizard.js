import { ref, watch } from 'vue'
import { createShow, applyTemplateToShow } from '../api/shows.js'
import { fetchTemplateChannels } from '../api/templates.js'
import { fetchTemplateSections } from '../api/sections.js'
import { fetchTemplateBars } from '../api/templateBars.js'
import { fetchTemplateTowers } from '../api/templateTowers.js'
import { saveChannels } from '../api/channels.js'

function currentSpielzeit() {
  const now = new Date()
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${String(startYear).slice(-2)}/${String(startYear + 1).slice(-2)}`
}

function emptyForm() {
  return {
    name: '',
    datum: new Date().toISOString().slice(0, 10),
    template: '__none__',
    spielzeit: currentSpielzeit(),
    use_bars: true,
    use_towers: true,
    importChannels: true,
  }
}

function generateId(name, datum) {
  const slug = name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const year = datum ? datum.slice(0, 4) : new Date().getFullYear()
  return slug ? `${slug}-${year}` : ''
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
  const templateBars = ref([])
  const templateTowers = ref([])
  const selectedSectionIds = ref(new Set())
  const selectedBarIds = ref(new Set())
  const selectedTowerIds = ref(new Set())
  const creating = ref(false)

  function toggleSelection(set, id) {
    const next = new Set(set.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set.value = next
  }

  function reset() {
    form.value = emptyForm()
    templateSections.value = []
    templateBars.value = []
    templateTowers.value = []
    selectedSectionIds.value = new Set()
    selectedBarIds.value = new Set()
    selectedTowerIds.value = new Set()
  }

  watch(() => form.value.template, async (name) => {
    if (name === '__none__') {
      templateSections.value = []
      templateBars.value = []
      templateTowers.value = []
      return
    }
    try {
      const [sections, bars, towers] = await Promise.all([
        fetchTemplateSections(name),
        fetchTemplateBars(name),
        fetchTemplateTowers(name),
      ])
      templateSections.value = Array.isArray(sections) ? sections : (sections?.sections ?? [])
      templateBars.value = bars
      templateTowers.value = towers
      selectedSectionIds.value = new Set(templateSections.value.map(s => s.id))
      selectedBarIds.value = new Set(templateBars.value.map(b => b.id))
      selectedTowerIds.value = new Set(templateTowers.value.map(t => t.id))
    } catch (e) {
      console.error('Failed to load template details:', e)
      templateSections.value = []
      templateBars.value = []
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
        use_bars: form.value.use_bars,
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
      if (tplCreate && form.value.use_bars && selectedBarIds.value.size) {
        try {
          await applyTemplateToShow(id, tplCreate, 'bars', false, [...selectedBarIds.value])
        } catch (e) {
          console.error('Failed to apply template (bars):', e)
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
    form, templateSections, templateBars, templateTowers,
    selectedSectionIds, selectedBarIds, selectedTowerIds,
    creating, toggleSelection, reset, createShowFromWizard,
  }
}

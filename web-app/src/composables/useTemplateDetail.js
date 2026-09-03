import { ref } from 'vue'
import { fetchTemplateChannels, saveTemplate, saveTemplateOscHost, renameTemplate, applyTemplateToAllShows, fetchTemplatePdfUrl } from '../api/templates.js'
import { fetchTemplateSections, saveTemplateSections } from '../api/sections.js'
import { fetchShows } from '../api/shows.js'
import { fetchTemplateFloorplan, saveTemplateFloorplan, uploadTemplateFloorplanImage, deleteTemplateFloorplanImage } from '../api/floorplan.js'
import { api } from '../api/client.js'
import { uuid } from '../utils/uuid.js'
import { isSectionTableType, sectionTypeHasRows } from '@shared/constants.js'

/**
 * Datenzugriff für den Vorlagen-Detailbereich: Kanäle, Abschnitte, Grundriss,
 * Umbenennen, OSC-Host, PDF-Vordruck und die "auf alle Shows anwenden"-Aktion.
 * Liegt hier statt in TemplateDetailPanel.vue, damit die Komponente ohne
 * laufenden Server darstellbar bleibt (F-04). `templateName` ist ein Ref, weil
 * das Panel beim Wechsel der Vorlage weiter gemountet bleibt.
 */
export function useTemplateDetail(templateName) {
  const detailChannels = ref([])
  const detailLoading = ref(false)
  const detailSaving = ref(false)

  const templateSections = ref([])
  const sectionsSaving = ref(false)

  const floorplanImageUrl = ref(null)
  const floorplanCanvasData = ref(null)
  const floorplanUploading = ref(false)
  const floorplanError = ref('')

  async function loadChannelsAndSections() {
    detailLoading.value = true
    const [channels, sections] = await Promise.all([
      fetchTemplateChannels(templateName.value),
      fetchTemplateSections(templateName.value),
    ])
    detailChannels.value = channels
    templateSections.value = Array.isArray(sections) ? sections : (sections?.sections ?? [])
    detailLoading.value = false
  }

  async function persistChannels() {
    detailSaving.value = true
    await saveTemplate(templateName.value, detailChannels.value)
    detailSaving.value = false
  }

  async function deleteChannel(ch) {
    detailChannels.value = detailChannels.value.filter(c => c.channel !== ch.channel)
    await persistChannels()
  }

  async function clearChannel(ch) {
    ch.notes = ''
    ch.color = ''
    await persistChannels()
  }

  async function persistSections() {
    sectionsSaving.value = true
    await saveTemplateSections(templateName.value, templateSections.value)
    sectionsSaving.value = false
  }

  function addSection() {
    templateSections.value.push({ id: uuid(), title: '', type: 'markdown', order: templateSections.value.length, rows: [] })
    persistSections()
  }

  function deleteSection(idx) {
    templateSections.value.splice(idx, 1)
    templateSections.value.forEach((s, i) => s.order = i)
    persistSections()
  }

  function moveSection(idx, dir) {
    const arr = templateSections.value
    const swap = idx + dir
    if (swap < 0 || swap >= arr.length) return
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    arr.forEach((s, i) => s.order = i)
    persistSections()
  }

  function addField(section) {
    if (!section.rows) section.rows = []
    section.rows.push({ key: uuid().slice(0, 8), label: '', value: '' })
    persistSections()
  }

  function deleteField(section, idx) {
    const arr = section.rows ?? section.fields
    arr?.splice(idx, 1)
    persistSections()
  }

  function hasKvTableType() {
    return templateSections.value.some(s => isSectionTableType(s.type))
  }

  function onTypeChange(section, newType) {
    if (isSectionTableType(newType) && hasKvTableType() && !isSectionTableType(section.type)) return
    section.type = newType
    if (sectionTypeHasRows(newType) && !section.rows) section.rows = []
    persistSections()
  }

  async function loadFloorplan() {
    if (!templateName.value) return
    const data = await fetchTemplateFloorplan(templateName.value).catch(() => null)
    floorplanImageUrl.value = data?.image_url ? (await api.url(data.image_url)) + '&t=' + Date.now() : null
    floorplanCanvasData.value = data?.canvas_data ?? null
  }

  function onFloorplanChange(canvasData) {
    floorplanCanvasData.value = canvasData
    saveTemplateFloorplan(templateName.value, canvasData).catch(() => {})
  }

  async function onFloorplanImageUpload(file) {
    if (!file || floorplanUploading.value) return
    floorplanUploading.value = true
    floorplanError.value = ''
    try {
      const result = await uploadTemplateFloorplanImage(templateName.value, file)
      floorplanImageUrl.value = result.image_url ? await api.url(result.image_url) : null
    } catch (err) {
      floorplanError.value = err?.message || 'Upload fehlgeschlagen'
    } finally {
      floorplanUploading.value = false
    }
  }

  async function removeFloorplanImage() {
    floorplanError.value = ''
    try {
      await deleteTemplateFloorplanImage(templateName.value)
      floorplanImageUrl.value = null
    } catch (err) {
      floorplanError.value = err?.message || 'Löschen fehlgeschlagen'
    }
  }

  async function saveOscHost(host) {
    await saveTemplateOscHost(templateName.value, host)
  }

  async function renameTo(newName) {
    await renameTemplate(templateName.value, newName)
  }

  async function fetchPdfUrl() {
    return fetchTemplatePdfUrl(templateName.value)
  }

  // Betroffene Shows für die Vorschau vor "auf alle Shows anwenden": deckt
  // sich mit der Server-Bedingung beim Übertragen (template = ? AND archived
  // = 0) — /api/shows liefert ohnehin nur unarchivierte.
  async function loadShowsUsingTemplate() {
    const shows = await fetchShows()
    return shows.filter(s => s.template === templateName.value)
  }

  async function applyToShows(scope) {
    return applyTemplateToAllShows(templateName.value, scope)
  }

  return {
    detailChannels, detailLoading, detailSaving,
    templateSections, sectionsSaving,
    floorplanImageUrl, floorplanCanvasData, floorplanUploading, floorplanError,
    loadChannelsAndSections, persistChannels, deleteChannel, clearChannel,
    persistSections, addSection, deleteSection, moveSection, addField, deleteField,
    hasKvTableType, onTypeChange,
    loadFloorplan, onFloorplanChange, onFloorplanImageUpload, removeFloorplanImage,
    saveOscHost, renameTo, fetchPdfUrl,
    loadShowsUsingTemplate, applyToShows,
  }
}

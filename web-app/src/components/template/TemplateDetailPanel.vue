<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-x-4 mb-8">
      <Button variant="ghost" size="icon" class="text-muted-foreground" @click="emit('close')">
        <ArrowLeft class="size-5" />
      </Button>
      <template v-if="renamingName">
        <input
          ref="renameInput"
          v-model="renameValue"
          class="text-2xl font-semibold bg-transparent border-b border-primary outline-none text-foreground w-64"
          autofocus
          type="text"
          inputmode="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          spellcheck="false"
          @keydown.enter.prevent="commitRename"
          @keydown.escape="renamingName = false"
          @blur="commitRename"
          @input="fixCapitalization"
        />
        <span v-if="renameSaving" class="text-xs text-muted-foreground">…</span>
        <span v-if="renameError" class="text-xs text-destructive">{{ renameError }}</span>
      </template>
      <template v-else>
        <h1 class="text-2xl font-semibold text-foreground">{{ templateDisplayName(templateName) || templateName }}</h1>
        <Button variant="ghost" size="icon" class="text-muted-foreground" :title="t('template.rename')" @click="startRename">
          <Pencil class="size-4" />
        </Button>
      </template>
      <span v-if="detailSaving || sectionsSaving" class="text-xs text-muted-foreground">…</span>
    </div>

    <div v-if="detailLoading" class="text-sm text-muted-foreground">…</div>

    <template v-else>
      <div class="flex items-center gap-x-3 mb-6 max-w-sm">
        <Label for="oscHostInput" class="shrink-0 text-sm text-muted-foreground">OSC-IP</Label>
        <Input
          id="oscHostInput"
          v-model="editingOscHost"
          :placeholder="t('template.osc_host.placeholder')"
          class="font-mono text-sm"
          @blur="persistOscHost"
          @keydown.enter.prevent="persistOscHost"
        />
        <span v-if="oscSaving" class="text-xs text-muted-foreground shrink-0">…</span>
      </div>

      <Tabs v-model="activeTab" class="w-full">
        <div class="flex items-center border-b border-border mb-6">
        <TabsList class="flex-1 justify-start bg-transparent p-0 h-auto rounded-none border-none">
          <TabsTrigger value="channels" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
            {{ t('show.channels') }}
          </TabsTrigger>
          <TabsTrigger value="sections" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
            {{ t('sections.btn') }}
          </TabsTrigger>
          <TabsTrigger value="floorplan" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
            {{ t('tab.floorplan') }}
          </TabsTrigger>
          <TabsTrigger value="bars" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
            {{ t('tab.bars') }}
          </TabsTrigger>
          <TabsTrigger value="towers" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground rounded-none px-4 py-2 border-b-2 border-transparent">
            {{ t('tab.towers') }}
          </TabsTrigger>
        </TabsList>
        </div>

        <!-- Kanaltabelle -->
        <TabsContent value="channels" class="mt-0 outline-none">
          <div class="flex justify-end mb-3">
            <Button variant="outline" size="sm" @click="downloadPdfVordruck">
              {{ t('template.pdf_blank') }}
            </Button>
          </div>
          <div class="h-[calc(100vh-16rem)] overflow-hidden rounded-lg border border-border">
            <ChannelTable
              :channels="detailChannels"
              :groupedChannels="groupedChannels"
              :dupChannelNrs="emptySet"
              :channelStatusFn="() => 'default'"
              :toggleChannelStatusFn="() => {}"
              :allShowPhotos="[]"
              :labels="{
                channel: t('field.channel'),
                dmx: t('field.dmx_address'),
                color: t('field.color'),
                device: t('field.device'),
                quantity: t('field.quantity'),
                notes: t('field.notes'),
                editPosition: t('channel.position.edit'),
                noPosition: t('channel.no_position'),
                add: t('channel.add'),
                addAction: t('action.add'),
                cancel: t('action.cancel'),
                delete: t('action.delete'),
                empty: t('channel.list.empty'),
                channelNr: t('show.channel.nr'),
                addressExample: t('show.channel.address.example'),
                addPosition: t('channel.position.add'),
                positionNamePlaceholder: t('channel.position.name.placeholder'),
              }"
              class="h-full"
              @change="persist()"
              @deleteChannel="deleteChannel($event)"
              @clearChannel="clearChannel($event)"
              @reorder="detailChannels.splice(0, detailChannels.length, ...$event)"
            />
          </div>
        </TabsContent>

        <!-- Sections-Editor -->
        <TabsContent value="sections" class="mt-0 outline-none space-y-4">
        <div class="flex justify-end">
          <Button variant="outline" size="sm" :disabled="applyingToShows === 'sections'" @click="handleApplyToAllShows('sections')">
            {{ applyingToShows === 'sections' ? '…' : t('template.apply_to_shows') }}
          </Button>
        </div>
        <div v-for="(sec, idx) in templateSections" :key="sec.id" class="border border-border rounded-lg p-4 space-y-3 bg-card">
          <div class="flex items-center gap-2">
            <div class="flex flex-col gap-0.5">
              <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground disabled:opacity-30" :disabled="idx === 0" @click="moveSection(idx, -1)">▲</Button>
              <Button variant="ghost" size="icon" class="h-6 w-6 text-muted-foreground disabled:opacity-30" :disabled="idx === templateSections.length - 1" @click="moveSection(idx, 1)">▼</Button>
            </div>
            <Input
              :model-value="sec.title"
              :placeholder="t('sections.title.placeholder')"
              @update:model-value="sec.title = $event"
              @change="persistSections"
              class="flex-1"
            />
            <Select :model-value="sec.type" @update:model-value="(value) => onTypeChange(sec, value)">
              <SelectTrigger class="w-45">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="markdown">{{ t('sections.type.markdown') }}</SelectItem>
                  <SelectItem value="kv-table" :disabled="hasKvTableType() && sec.type !== 'kv-table'">{{ t('sections.type.fields') }}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" class="shrink-0 text-muted-foreground" @click="deleteSection(idx)">✕</Button>
          </div>
          <div v-if="sec.type === 'kv-table' || sec.type === 'fields'" class="space-y-2 pl-6">
            <div v-for="(row, fidx) in (sec.rows ?? sec.fields ?? [])" :key="row.key" class="flex items-center gap-2">
              <Input
                :model-value="row.label"
                :placeholder="t('sections.field.label')"
                @update:model-value="row.label = $event"
                @change="persistSections"
                class="flex-1"
              />
              <Button variant="ghost" size="icon" class="shrink-0 text-muted-foreground" @click="deleteField(sec, fidx)">✕</Button>
            </div>
            <Button variant="outline" size="sm" @click="addField(sec)">+ {{ t('sections.field.add') }}</Button>
          </div>
        </div>
        <Button variant="outline" size="sm" @click="addSection">+ {{ t('sections.add') }}</Button>
        </TabsContent>

        <!-- Zugstangen -->
        <TabsContent value="bars" class="mt-0 outline-none">
          <TemplateBarsPanel ref="barsPanel" :templateName="templateName" />
        </TabsContent>

        <!-- Beleuchtungsgestelle -->
        <TabsContent value="towers" class="mt-0 outline-none">
          <TemplateTowersPanel
            ref="towersPanel"
            :templateName="templateName"
            :applying="applyingToShows"
            @applyToShows="handleApplyToAllShows"
          />
        </TabsContent>

        <!-- Grundriss-Editor -->
        <TabsContent value="floorplan" class="mt-0 outline-none">
          <div class="h-[calc(100vh-16rem)] rounded-lg border border-border overflow-hidden">
          <FloorplanEditor
            :image-url="floorplanImageUrl"
            :initial-canvas-data="floorplanCanvasData"
            :channels="[]"
            :towers="[]"
            :bars="floorplanBars"
            @change="onFloorplanChange"
            @upload-image="(f) => onFloorplanImageUpload({ target: { files: [f] } })"
            @delete-image="removeFloorplanImage"
          />
          </div>
          <Alert v-if="floorplanError" variant="destructive" class="mt-2">
            <AlertDescription>{{ floorplanError }}</AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </template>

    <!-- Auf alle Shows anwenden: Vorschau der betroffenen Shows -->
    <Dialog :open="applyDialogOpen" @update:open="applyDialogOpen = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ applyDialogTitle }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p v-if="applyShowsLoading" class="text-sm text-muted-foreground">{{ t('template.apply_to_shows.dialog.loading') }}</p>
          <template v-else>
            <div v-if="applyShows.length">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                {{ t('template.apply_to_shows.dialog.shows', { count: applyShows.length }) }}
              </p>
              <ul class="max-h-48 overflow-y-auto flex flex-col divide-y divide-border/50">
                <li v-for="show in applyShows" :key="show.id" class="py-1.5 text-sm text-foreground truncate">{{ show.name }}</li>
              </ul>
            </div>
            <p v-else class="text-sm text-muted-foreground">{{ t('template.apply_to_shows.dialog.none') }}</p>
            <p class="text-xs text-muted-foreground/70 pt-1">{{ t('template.apply_to_shows.dialog.safe') }}</p>
          </template>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="applyDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button :disabled="applyShowsLoading || applyShows.length === 0 || !!applyingToShows" @click="confirmApplyToAllShows">
            {{ applyingToShows ? '…' : t('action.apply') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Ergebnis der Übertragung -->
    <Dialog :open="applyResultOpen" @update:open="applyResultOpen = $event">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ t('template.apply_to_shows.result.title') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p class="text-sm text-muted-foreground">{{ applyResultText }}</p>
        </DialogBody>
        <DialogFooter>
          <Button @click="applyResultOpen = false">{{ t('action.close') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ArrowLeft, Pencil } from 'lucide-vue-next'
import { useLocale } from '../../composables/useLocale.js'
import { fetchTemplateChannels, saveTemplate, saveTemplateOscHost, renameTemplate, applyTemplateToAllShows, fetchTemplatePdfUrl } from '../../api/templates.js'
import { fetchTemplateSections, saveTemplateSections } from '../../api/sections.js'
import { fetchShows } from '../../api/shows.js'
import { templateDisplayName } from '../../utils/templateName.js'
import { uuid } from '../../utils/uuid.js'
import ChannelTable from '../channel/ChannelTable.vue'
import { fetchTemplateFloorplan, saveTemplateFloorplan, uploadTemplateFloorplanImage, deleteTemplateFloorplanImage } from '../../api/floorplan.js'
import FloorplanEditor from '../FloorplanEditor.vue'
import TemplateBarsPanel from './TemplateBarsPanel.vue'
import TemplateTowersPanel from './TemplateTowersPanel.vue'
import { api } from '../../api/client.js'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { isSectionTableType, sectionTypeHasRows } from '@shared/constants.js'

const { t } = useLocale()

const props = defineProps({
  templateName: { type: String, required: true },
  oscHost: { type: String, default: '' },
})
const emit = defineEmits(['close', 'renamed', 'oscHostChanged'])

const editingOscHost = ref(props.oscHost)
const oscSaving = ref(false)
const renamingName = ref(false)
const renameValue = ref('')
const renameError = ref('')
const renameSaving = ref(false)
const renameInput = ref(null)

const detailChannels = ref([])
const detailLoading = ref(false)
const detailSaving = ref(false)
const activeTab = ref('channels')
const templateSections = ref([])
const sectionsSaving = ref(false)
const floorplanImageUrl = ref(null)
const floorplanCanvasData = ref(null)
const floorplanUploading = ref(false)
const floorplanError = ref('')

const barsPanel = ref(null)
const towersPanel = ref(null)

const emptySet = new Set()
const applyingToShows = ref('')
// Vorschau vor der Massenoperation: welche Shows hängen an dieser Vorlage?
const applyDialogOpen = ref(false)
const applyScope = ref('')
const applyShows = ref([])
const applyShowsLoading = ref(false)
const applyResultOpen = ref(false)
const applyResultText = ref('')
const applyDialogTitle = computed(() =>
  applyScope.value ? t(`template.apply_to_shows.${applyScope.value}.confirm`, { name: props.templateName }) : ''
)

const groupedChannels = computed(() => {
  const sorted = [...detailChannels.value].sort((a, b) => Number(a.channel) - Number(b.channel))
  const map = new Map()
  for (const ch of sorted) {
    const pos = ch.position || ''
    if (!map.has(pos)) map.set(pos, [])
    map.get(pos).push(ch)
  }
  return [...map.entries()].map(([position, channels]) => ({ position, channels }))
})

const floorplanBars = computed(() => barsPanel.value?.bars ?? [])

async function loadDetail() {
  detailLoading.value = true
  activeTab.value = 'channels'
  editingOscHost.value = props.oscHost
  const [channels, sections] = await Promise.all([
    fetchTemplateChannels(props.templateName),
    fetchTemplateSections(props.templateName),
  ])
  detailChannels.value = channels
  templateSections.value = Array.isArray(sections) ? sections : (sections?.sections ?? [])
  detailLoading.value = false
  await nextTick()
  await Promise.all([barsPanel.value?.loadBars(), towersPanel.value?.loadTowers()])
}

watch(() => props.templateName, () => {
  loadDetail()
  loadFloorplan()
}, { immediate: true })

async function persistOscHost() {
  oscSaving.value = true
  await saveTemplateOscHost(props.templateName, editingOscHost.value)
  emit('oscHostChanged', editingOscHost.value)
  oscSaving.value = false
}

function fixCapitalization(e) {
  const el = e.target
  const pos = el.selectionStart
  const val = el.value
  // WebKit kapitalisiert nach Umlauten/ß — wir vergleichen mit renameValue
  // und korrigieren falls der neue Buchstabe unerwartet groß ist
  if (val === renameValue.value) return
  const prev = renameValue.value
  if (pos > 0 && pos <= val.length) {
    const newChar = val[pos - 1]
    const prevChar = prev[pos - 2] ?? ''
    const umlautOrSz = /[äöüßÄÖÜ]/.test(prevChar)
    if (umlautOrSz && newChar !== newChar.toLowerCase()) {
      const fixed = val.slice(0, pos - 1) + newChar.toLowerCase() + val.slice(pos)
      renameValue.value = fixed
      nextTick(() => {
        el.setSelectionRange(pos, pos)
      })
    }
  }
}

function startRename() {
  renameValue.value = props.templateName
  renameError.value = ''
  renamingName.value = true
}

async function commitRename() {
  const newName = renameValue.value.trim()
  if (!newName || newName === props.templateName) { renamingName.value = false; return }
  renameSaving.value = true
  renameError.value = ''
  try {
    await renameTemplate(props.templateName, newName)
    renamingName.value = false
    emit('renamed', newName)
  } catch (e) {
    renameError.value = e?.message?.includes('409') || e?.status === 409
      ? t('template.rename.error')
      : (e?.message || t('template.rename.error'))
  } finally {
    renameSaving.value = false
  }
}

async function persist() {
  detailSaving.value = true
  await saveTemplate(props.templateName, detailChannels.value)
  detailSaving.value = false
}

async function downloadPdfVordruck() {
  const url = await fetchTemplatePdfUrl(props.templateName)
  window.open(url, '_blank')
}

async function loadFloorplan() {
  if (!props.templateName) return
  const data = await fetchTemplateFloorplan(props.templateName).catch(() => null)
  floorplanImageUrl.value = data?.image_url ? (await api.url(data.image_url)) + '&t=' + Date.now() : null
  floorplanCanvasData.value = data?.canvas_data ?? null
}

function onFloorplanChange(canvasData) {
  floorplanCanvasData.value = canvasData
  saveTemplateFloorplan(props.templateName, canvasData).catch(() => {})
}

async function onFloorplanImageUpload(e) {
  const file = e.target.files[0]
  if (!file || floorplanUploading.value) return
  floorplanUploading.value = true
  floorplanError.value = ''
  try {
    const result = await uploadTemplateFloorplanImage(props.templateName, file)
    floorplanImageUrl.value = result.image_url ? await api.url(result.image_url) : null
    e.target.value = ''
  } catch (err) {
    floorplanError.value = err?.message || 'Upload fehlgeschlagen'
  } finally {
    floorplanUploading.value = false
  }
}

async function removeFloorplanImage() {
  floorplanError.value = ''
  try {
    await deleteTemplateFloorplanImage(props.templateName)
    floorplanImageUrl.value = null
  } catch (err) {
    floorplanError.value = err?.message || 'Löschen fehlgeschlagen'
  }
}

async function persistSections() {
  sectionsSaving.value = true
  await saveTemplateSections(props.templateName, templateSections.value)
  sectionsSaving.value = false
}

async function deleteChannel(ch) {
  detailChannels.value = detailChannels.value.filter(c => c.channel !== ch.channel)
  await persist()
}

async function clearChannel(ch) {
  ch.notes = ''
  ch.color = ''
  await persist()
}

// ── Sections ────────────────────────────────────────────────────────────────

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

// ── Auf alle Shows anwenden ─────────────────────────────────────────────────

// Öffnet die Vorschau. Die betroffenen Shows sind die, deren template-Feld auf
// diese Vorlage zeigt. Deckt sich mit der Server-Bedingung beim Übertragen
// (template = ? AND archived = 0) — /api/shows liefert ohnehin nur unarchivierte.
async function handleApplyToAllShows(scope) {
  applyScope.value = scope
  applyShows.value = []
  applyShowsLoading.value = true
  applyDialogOpen.value = true
  try {
    const shows = await fetchShows()
    applyShows.value = shows.filter(s => s.template === props.templateName)
  } catch {
    applyShows.value = []
  } finally {
    applyShowsLoading.value = false
  }
}

async function confirmApplyToAllShows() {
  const scope = applyScope.value
  applyingToShows.value = scope
  try {
    const result = await applyTemplateToAllShows(props.templateName, scope)
    applyResultText.value = t(`template.apply_to_shows.${scope}.result`, {
      shows: result.shows,
      bars: result.barsAdded,
      towers: result.towersAdded,
      sections: result.sectionsAdded,
    })
    applyDialogOpen.value = false
    applyResultOpen.value = true
  } finally {
    applyingToShows.value = ''
  }
}
</script>

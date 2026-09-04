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
      <span v-if="templateLockedByOther" class="text-xs text-orange-500" role="status">
        {{ t('lock.lockedBy', { user: templateLock?.user }) }}
      </span>
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
              @change="persistChannels()"
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
            @upload-image="onFloorplanImageUpload"
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { ArrowLeft, Pencil } from 'lucide-vue-next'
import { useLocale } from '../../composables/useLocale.js'
import { useTemplateDetail } from '../../composables/useTemplateDetail.js'
import { useResourceLock } from '../../composables/useResourceLock'
import { acquireTemplateLock, releaseTemplateLock, touchTemplateLock } from '../../api/templates.ts'
import { templateDisplayName } from '../../utils/templateName.js'
import ChannelTable from '../channel/ChannelTable.vue'
import FloorplanEditor from '../FloorplanEditor.vue'
import TemplateBarsPanel from './TemplateBarsPanel.vue'
import TemplateTowersPanel from './TemplateTowersPanel.vue'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'

const { t } = useLocale()

const props = defineProps({
  templateName: { type: String, required: true },
  oscHost: { type: String, default: '' },
})
const emit = defineEmits(['close', 'renamed', 'oscHostChanged'])

// Reine Darstellung: Kanäle, Abschnitte, Grundriss usw. laufen über
// useTemplateDetail.js, damit die Komponente ohne laufenden Server
// darstellbar bleibt (F-04).
const {
  detailChannels, detailLoading, detailSaving,
  templateSections, sectionsSaving,
  floorplanImageUrl, floorplanCanvasData, floorplanError,
  loadChannelsAndSections, persistChannels, deleteChannel, clearChannel,
  persistSections, addSection, deleteSection, moveSection, addField, deleteField,
  hasKvTableType, onTypeChange,
  loadFloorplan, onFloorplanChange, onFloorplanImageUpload, removeFloorplanImage,
  saveOscHost, renameTo, fetchPdfUrl,
  loadShowsUsingTemplate, applyToShows,
} = useTemplateDetail(computed(() => props.templateName))

const editingOscHost = ref(props.oscHost)
const oscSaving = ref(false)
const renamingName = ref(false)
const renameValue = ref('')
const renameError = ref('')
const renameSaving = ref(false)
const renameInput = ref(null)

const activeTab = ref('channels')

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
  activeTab.value = 'channels'
  editingOscHost.value = props.oscHost
  await loadChannelsAndSections()
  await nextTick()
  await Promise.all([barsPanel.value?.loadBars(), towersPanel.value?.loadTowers()])
}

watch(() => props.templateName, () => {
  loadDetail()
  loadFloorplan()
}, { immediate: true })

// Schreib-Lock: verhindert, dass zwei Personen dasselbe Template gleichzeitig
// bearbeiten. props.templateName ist für die Lebensdauer dieser Instanz fest
// (der Parent setzt :key="editingName", ein Rename/Wechsel remountet also
// statt die Prop live zu ändern) — die Lock-Aufrufe können sie daher einfach
// einmalig einfangen statt auf Änderungen zu reagieren.
const { lock: templateLock, isLockedByOther: templateLockedByOther, acquireOnOpen: acquireTemplateLockOnOpen, releaseOnClose: releaseTemplateLockOnClose } = useResourceLock({
  acquire: () => acquireTemplateLock(props.templateName),
  release: () => releaseTemplateLock(props.templateName),
  touch: () => touchTemplateLock(props.templateName),
})
onMounted(() => { acquireTemplateLockOnOpen().catch(() => {}) })
onUnmounted(() => { releaseTemplateLockOnClose() })

async function persistOscHost() {
  oscSaving.value = true
  await saveOscHost(editingOscHost.value)
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
    await renameTo(newName)
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

async function downloadPdfVordruck() {
  const url = await fetchPdfUrl()
  window.open(url, '_blank')
}

// ── Auf alle Shows anwenden ─────────────────────────────────────────────────

// Öffnet die Vorschau. Die betroffenen Shows sind die, deren template-Feld auf
// diese Vorlage zeigt.
async function handleApplyToAllShows(scope) {
  applyScope.value = scope
  applyShows.value = []
  applyShowsLoading.value = true
  applyDialogOpen.value = true
  try {
    applyShows.value = await loadShowsUsingTemplate()
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
    const result = await applyToShows(scope)
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

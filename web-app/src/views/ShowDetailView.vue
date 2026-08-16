<template>
  <div class="flex flex-col h-dvh overflow-hidden bg-surface-deep">

    <!-- ── Header (volle Breite) ──────────────────────────────────────────── -->
    <!-- Titelzeile: volle Breite -->
    <div v-if="loading" class="shrink-0 flex h-12 items-center gap-x-4 px-4 sm:px-6 lg:px-8 border-b border-border bg-surface-raised">
      <div class="h-6 w-48 rounded bg-muted animate-pulse" />
      <div class="h-4 w-24 rounded bg-muted animate-pulse" />
    </div>
    <ShowHeader
      v-else
      :showName="meta.name"
      :showDate="showDateFormatted"
      :showMeta="meta"
      :labels="{
        history: t('history.btn'),
        import: t('nav.import'),
        export: t('nav.export'),
        eosImport: t('eos.import.button'),
        csvImport: t('channel.import'),
        pdf: t('show.pdf'),
        csvExport: t('channel.export'),
      }"
      @update:showName="onRenameShow($event)"
      @update:meta="onUpdateMeta($event)"
      @openHistory="openHistory()"
      @openPdf="openPdf()"
      @downloadCsv="downloadChannelsCsv(props.id, channels)"
      @eosFileSelected="onEosFileSelected($event)"
      @csvFileSelected="onCsvImportSelected($event)"
    />

    <!-- ── Unterer Bereich: Content ──────────────────────────────────────── -->
    <div class="flex flex-1 min-h-0 overflow-hidden">


    <!-- ── Content ────────────────────────────────────────────────────────── -->
    <div
      :inert="!isOnline || undefined"
      :class="{ 'opacity-40 pointer-events-none select-none': !isOnline }"
      class="flex flex-1 min-w-0 flex-col overflow-hidden"
    >

      <!-- ── Aktionszeile ──────────────────────────────────────────────── -->
      <div v-if="loading" class="shrink-0 flex h-10 border-b border-border bg-surface-raised" />
      <ShowActionBar
        v-else
        :activeTab="mobileTab"
        v-model:search="search"
        :canUndo="canUndo"
        :canRedo="canRedo"
        :saving="channelsSaving || sectionsSaving || setupSaving"
        :presence="presence"
        :dupAddressWarning="dupWarning"
        :dupChannelWarning="dupChannelWarning"
        :healthStats="healthStats"
        :healthLabels="healthLabels"
        :activeHealthFilter="healthFilter"
        :labels="{
          undo: t('action.undo'),
          redo: t('action.redo'),
          dupAddress: t('channel.dup_address'),
          dupChannel: t('channel.dup_channel'),
          search: t('channel.search'),
          legendTitle: t('channel.legend.title'),
          legendDefault: t('channel.legend.default'),
          legendActive: t('channel.legend.active'),
          legendEos: t('channel.legend.eos'),
        }"
        @undo="undo()"
        @redo="redo()"
        @healthFilter="onHealthFilter($event)"
      />

      <!-- ── Loading ──────────────────────────────────────────────────── -->
      <div v-if="loading" class="flex flex-1 items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <Loader2 class="size-8 animate-spin text-accent" />
          <span class="text-sm text-muted-foreground">{{ t('error.loading') }}</span>
        </div>
      </div>
      <div v-else class="flex flex-1 min-h-0 overflow-hidden pb-14 md:pb-0">

        <!-- Channels View -->
        <div
          v-show="mobileTab === 'channels'"
          class="flex flex-col flex-1 min-h-0 overflow-hidden"
        >

          <!-- Channel Table -->
          <div class="flex-1 min-h-0 overflow-hidden">
            <ChannelTable
              :channels="channels"
              :groupedChannels="groupedChannels"
              :dupChannelNrs="dupChannelNrs"
              :channelStatusFn="channelStatus"
              :toggleChannelStatusFn="toggleChannelStatus"
              :onKeydownFn="onKeydown"
              :allShowPhotos="photos"
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
                channelHelp: t('channel.help.status'),
                colorHelp: t('channel.help.color'),
                quantityHelp: t('channel.help.quantity'),
                deviceHelp: t('channel.help.device'),
                notesHelp: t('channel.help.notes'),
                assign: t('channel.row.assign'),
                assignHelp: t('channel.help.assign'),
                addPosition: t('channel.position.add'),
                positionNamePlaceholder: t('channel.position.name.placeholder'),
              }"
              @change="scheduleChannelsSave()"
              @recordFocus="recordFocus()"
              @commitFocus="commitFocus()"
              @pushSnapshot="pushSnapshot()"
              @deleteChannel="deleteChannel($event)"
              @clearChannel="clearChannel($event)"
              @reorder="channels.splice(0, channels.length, ...$event)"
              @placeInFloorplan="onPlaceInFloorplan($event)"
              @assignTower="onAssignTower($event)"
              @assignBar="onAssignBar($event)"
            />
          </div>
        </div>

        <!-- Photos View -->
        <div
          v-if="tabMounted('photos')"
          v-show="mobileTab === 'photos'"
          class="relative flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div class="flex-1 min-h-0 overflow-y-auto p-4">
            <PhotoGallery
              ref="photoGalleryRef"
              :showId="props.id"
              :photos="photos"
              :channels="channels"
              :labels="{
                add: t('photo.add'),
                empty: t('photo.empty'),
                emptyDesc: t('photo.empty.desc'),
                delete: t('action.delete'),
                captionPlaceholder: t('photo.caption.placeholder'),
                channelLabel: t('photo.channel_label'),
                channelInputPlaceholder: t('photo.channel_input_placeholder'),
                channelUnknown: t('photo.channel_unknown'),
                channelPick: t('photo.channel_pick'),
                channelSearchPlaceholder: t('photo.channel_search_placeholder'),
                channelNone: t('gassenturm.channel.none'),
              }"
              @update:photos="photos = $event"
            />
          </div>
          <label v-if="photos.length > 0" class="absolute bottom-20 right-6 md:bottom-6 h-11 px-5 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-accent-foreground flex items-center gap-2 cursor-pointer text-sm font-medium">
            <Plus class="size-4" /> {{ t('photo.add') }}
            <input type="file" accept="image/*" multiple class="sr-only" @change="photoGalleryRef?.onFileInput($event)" />
          </label>
        </div>

        <!-- Floorplan View -->
        <div
          v-if="tabMounted('floorplan')"
          v-show="mobileTab === 'floorplan'"
          class="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div class="flex-1 min-h-0">
            <FloorplanEditor
              :image-url="floorplanImageUrl"
              :initial-canvas-data="floorplan.canvas_data"
              :channels="channels"
              :towers="towers"
              :bars="bars"
              :pending-channel="pendingFloorplanChannel"
              @change="onFloorplanChange"
              @snapshot="(snap) => saveShowFloorplanSnapshot(props.id, snap, 120).catch(() => {})"
              @upload-image="onFloorplanImageUpload"
              @delete-image="onFloorplanImageDelete"
              @jump-to-channel="jumpToChannel"
              @open-tower="openTowerFromFloorplan"
              @open-bar="onOpenBarFromFloorplan"
            />
          </div>
        </div>

        <!-- Aufbauplan View -->
        <div
          v-if="tabMounted('gassenturm')"
          v-show="mobileTab === 'gassenturm'"
          class="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <!-- Sub-Tab-Leiste (Mobile/Tablet) -->
          <div class="md:hidden shrink-0 flex overflow-x-auto border-b border-border bg-surface-raised">
            <button
              v-for="sub in aufbauSubTabs"
              :key="sub.key"
              :class="[
                'shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                aufbauTab === sub.key
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-muted-foreground hover:text-foreground'
              ]"
              @click="aufbauTab = sub.key"
            >{{ sub.label }}</button>
          </div>

          <!-- Section-Subtabs -->
          <template v-for="sub in aufbauSubTabs" :key="sub.key">
            <div
              v-if="sub.sectionId"
              v-show="aufbauTab === sub.key"
              class="flex-1 min-h-0 overflow-y-auto pb-14 md:pb-0"
            >
              <SectionEditor
                :showId="props.id"
                :sectionDefs="sectionDefs"
                :sectionContents="sectionContents"
                :setupMarkdown="setupMarkdown"
                :singleSectionId="sub.sectionId"
                :saveSectionDefsFn="persistSectionDefs"
                :labels="{
                  titlePlaceholder: t('sections.title.placeholder'),
                  fieldLabel: t('sections.field.label'),
                  fieldValue: t('sections.field.value'),
                  fieldAdd: t('sections.field.add'),
                  addMarkdown: t('sections.add.markdown'),
                  addFields: t('sections.add.fields'),
                  addHelp: t('section.add.help'),
                }"
                @update:sectionDefs="sectionDefs = $event"
                @update:sectionContents="sectionContents = $event"
                @update:setupMarkdown="onSetupChange($event)"
                @pushSnapshot="pushSnapshot"
                @recordFocus="recordFocus"
                @commitFocus="commitFocus"
                @sectionChange="persistSectionsDebounced"
              />
              <!-- Generierte Texte aus Bühne + Obermaschinerie — nur in der Aufbau-Section -->
              <GeneratedTextAccordion
                v-if="sub.sectionId === aufbauSectionId && (gassenturmGenerated.length || hangerei.length)"
                :gassenturmEntries="gassenturmGenerated"
                :hangereiEntries="hangerei"
              />
            </div>
          </template>

          <div v-if="meta.use_towers !== false && aufbauTab === 'gassenturm'" class="flex-1 min-h-0 overflow-hidden">
            <GassenturmView
              :towers="towers"
              :channels="channels"
              :preselectedChannelId="aufbauTab === 'gassenturm' ? activeChannelForAssign?.id : null"
              :addTowerFn="addTower"
              :saveTowerFn="saveTower"
              :deleteTowerFn="removeTower"
              :assignSlotFn="assignSlot"
              :pushSnapshotFn="pushSnapshot"
              :saveToTemplateFn="meta.template ? saveTowerToTemplate : null"
              :templateName="meta.template"
              :fetchTemplateNamesFn="meta.template ? fetchTowerTemplateNames : null"
              :fromTemplateFn="meta.template ? () => openFromTemplateDialog('towers') : null"
              @assigned="activeChannelForAssign = null"
            />
          </div>

          <div v-if="meta.use_bars !== false && aufbauTab === 'zugstangen'" class="flex-1 min-h-0 overflow-hidden">
            <ZugstangenView
              :bars="bars"
              :channels="channels"
              :preselectedChannelId="aufbauTab === 'zugstangen' ? activeChannelForAssign?.id : null"
              :addBarFn="addBar"
              :saveBarFn="saveBar"
              :deleteBarFn="removeBar"
              :assignFixtureFn="assignFixture"
              :updateFixtureNotesFn="updateFixtureNotes"
              :unassignFixtureFn="unassignFixture"
              :reorderBarsFn="reorderBars"
              :saveToTemplateFn="meta.template ? saveBarToTemplate : null"
              :templateName="meta.template"
              :fetchTemplateNamesFn="meta.template ? fetchBarTemplateNames : null"
              :fromTemplateFn="meta.template ? () => openFromTemplateDialog('bars') : null"
              @assigned="activeChannelForAssign = null"
            />
          </div>
        </div>

      </div>

      <!-- ── Bottom-Nav-Bar (Mobile) ──────────────────────────────── -->
      <nav class="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch border-t border-border bg-background">
        <button
          v-for="item in bottomNavItems"
          :key="item.key"
          :class="[
            'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
            item.active
              ? 'text-accent'
              : 'text-muted-foreground hover:text-foreground'
          ]"
          @click="item.action()"
        >
          <component :is="item.icon" class="size-5" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
      </div>
    </div> <!-- /Sidebar+Content wrapper -->

      <!-- ── Overlays ───────────────────────────────────────────────────────── -->
    <HistorySlideOver
      :open="historyOpen"
      :showId="props.id"
      :labels="{
        title: t('history.title'),
        back: t('history.back'),
        empty: t('history.empty'),
        restore: t('history.restore'),
        cancel: t('action.cancel'),
        channelCount: (n) => t('history.channel_count', { n }),
        limit: t('history.limit'),
        scope: t('history.scope'),
        confirmTitle: t('history.confirm.title'),
        confirmMessage: t('history.confirm.message'),
      }"
      @close="historyOpen = false"
      @restore="doRestoreHistory($event)"
    />

    <ShowDetailDialogs
      :channelsConflict="channelsConflict"
      :sectionsConflict="sectionsConflict"
      v-model:newSectionDialog="newSectionDialog"
      v-model:newSectionName="newSectionName"
      v-model:newSectionType="newSectionType"
      :eosMergePreview="eosMergePreview"
      v-model:fromTemplateDialogOpen="fromTemplateDialogOpen"
      :fromTemplateScope="fromTemplateScope"
      :fromTemplateItemsLoading="fromTemplateItemsLoading"
      :fromTemplateItems="fromTemplateItems"
      :fromTemplateSelectedIds="fromTemplateSelectedIds"
      v-model:fromTemplateWithChannels="fromTemplateWithChannels"
      :fromTemplateLoading="fromTemplateLoading"
      :formatLength="formatLength"
      @resolveConflictReload="resolveConflictReload"
      @resolveConflictForce="resolveConflictForce"
      @resolveSectionsConflictReload="resolveSectionsConflictReload"
      @resolveSectionsConflictForce="resolveSectionsConflictForce"
      @confirmNewSection="confirmNewSection"
      @resolveEosMergePreview="(...args) => resolveEosMergePreview(...args)"
      @fromTemplateSelectAll="fromTemplateSelectAll"
      @fromTemplateSelectNone="fromTemplateSelectNone"
      @fromTemplateToggleId="fromTemplateToggleId"
      @confirmFromTemplate="confirmFromTemplate"
    />

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { Loader2, Radio, Layers, Images, Map as MapIcon, Construction, Plus } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { useLocale } from '../composables/useLocale.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useKeyboardNav } from '../composables/useKeyboardNav.js'

import { useShowPhotos } from '../composables/useShowPhotos.js'
import { useShowSections } from '../composables/useShowSections.js'
import { useShowPresence } from '../composables/useShowPresence.js'
import { useShowChannels } from '../composables/useShowChannels.js'
import { useShowFloorplan } from '../composables/useShowFloorplan.js'
import { saveShowFloorplanSnapshot } from '../api/floorplan.js'
import { useShowTowers } from '../composables/useShowTowers.js'
import { restoreTowersSnapshot } from '../api/towers.js'
import { useShowBars } from '../composables/useShowBars.js'
import { useShowHistory } from '../composables/useShowHistory.js'
import { useMeasureUnit } from '../composables/useMeasureUnit'
import { useShowTabs } from '../composables/useShowTabs.js'
import { useTemplateInsertion } from '../composables/useTemplateInsertion.js'

import ShowHeader from '../components/show/ShowHeader.vue'
const ShowActionBar = defineAsyncComponent(() => import('../components/show/ShowActionBar.vue'))
import { useShowSidebarNav } from '../composables/useShowSidebarNav.js'
import { Button } from '@/components/ui/button'
import { fetchShow, updateMeta, createSnapshot } from '../api/shows.js'
import { invalidate } from '../api/cache.js'
import { uuid } from '../utils/uuid.js'
import { downloadChannelsCsv } from '../api/channels.js'
import { generateHangereiEntries, generateGassenturmEntries } from '../utils/generateHangerei'
const PhotoGallery = defineAsyncComponent(() => import('../components/show/PhotoGallery.vue'))
const HistorySlideOver = defineAsyncComponent(() => import('../components/show/HistorySlideOver.vue'))
const ShowDetailDialogs = defineAsyncComponent(() => import('../components/show/ShowDetailDialogs.vue'))
import { isOnline, api } from '../api/client.js'

const ChannelTable = defineAsyncComponent(() => import('../components/channel/ChannelTable.vue'))
const SectionEditor = defineAsyncComponent(() => import('../components/show/SectionEditor.vue'))
const FloorplanEditor = defineAsyncComponent(() => import('../components/FloorplanEditor.vue'))
const GassenturmView = defineAsyncComponent(() => import('../components/show/GassenturmView.vue'))
const ZugstangenView = defineAsyncComponent(() => import('../components/show/ZugstangenView.vue'))
const GeneratedTextAccordion = defineAsyncComponent(() => import('../components/show/GeneratedTextAccordion.vue'))

const props = defineProps({ id: { type: String, required: true } })
const { t, locale, ready: localeReady } = useLocale()
const { confirm } = useConfirm()
const { onKeydown } = useKeyboardNav()

// ── Globals ────────────────────────────────────────────────────────────────
const loading = ref(true)
const meta = ref({})

const showDateFormatted = computed(() => {
  if (!meta.value.datum) return ''
  const d = new Date(meta.value.datum)
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
})
const setupMarkdown = ref('')
const setupSaving = ref(false)

// ── Composables ────────────────────────────────────────────────────────────
const photoGalleryRef = ref(null)
const { photos, loadPhotos } = useShowPhotos(props.id)
const { floorplan, loadFloorplan, onFloorplanChange, onFloorplanImageUpload, onFloorplanImageDelete } = useShowFloorplan(props.id)

// api.url() ist async (kurzlebiges Token muss ggf. nachgeladen werden) —
// floorplanImageUrl hält den zuletzt aufgelösten String für :image-url.
const floorplanImageUrl = ref(null)
watch(() => floorplan.value.image_url, async (path) => {
  floorplanImageUrl.value = path ? await api.url(path) : null
}, { immediate: true })

const {
  sectionDefs, sectionContents, sectionsSaving,
  persistSectionsDebounced, persistSections, persistSectionDefs,
  loadSections, handleSectionsSse,
  sectionsConflict, resolveSectionsConflictReload, resolveSectionsConflictForce
} = useShowSections(props.id, meta)

const aufbauFixedTabs = computed(() => [
  ...(meta.value.use_towers !== false ? [{ key: 'gassenturm', label: t('tab.towers') }] : []),
  ...(meta.value.use_bars !== false ? [{ key: 'zugstangen', label: t('tab.obermaschinerie') }] : []),
])
const aufbauSubTabs = computed(() => {
  const sectionTabs = [...sectionDefs.value]
    .sort((a, b) => a.order - b.order)
    .map(s => ({ key: `section:${s.id}`, label: s.title || '(kein Titel)', sectionId: s.id }))
  return [...sectionTabs, ...aufbauFixedTabs.value]
})

let pendingSetupMd = null
const persistSetupDebounced = useDebounceFn(async () => {
  setupSaving.value = true
  try {
    await updateMeta(props.id, { ...meta.value, setupMarkdown: pendingSetupMd })
    invalidate('shows')
  } finally {
    setupSaving.value = false
  }
}, 50)

const towers = ref([])

const {
  channels, channelsSaving, search, healthFilter, activateHealthFilter, eosActiveChannels, eosExcludedChannels, eosMergePreview,
  dupWarning, dupChannelWarning, dupChannelNrs, groupedChannels,
  scheduleChannelsSave, persistChannels, deleteChannel, clearChannel,
  onCsvImportSelected, onEosFileSelected, resolveEosMergePreview,
  channelStatus, toggleChannelStatus,
  initSnapshot, recordFocus, commitFocus, pushSnapshot,
  undo, redo, canUndo, canRedo, onUndoRedoKeydown,
  loadChannels, handleChannelsSse,
  channelsConflict, resolveConflictReload, resolveConflictForce
} = useShowChannels({
  showId: props.id,
  meta,
  setupMarkdown,
  sectionContents,
  sectionDefs,
  persistSetupDebounced,
  persistSectionsDebounced,
  persistSections,
  persistSectionDefs,
  towers,
  saveTowersSnapshot: (snapshot) => restoreTowersSnapshot(props.id, snapshot),
  t,
  localeReady,
  confirm
})

const { loadTowers, addTower, saveTower, removeTower, assignSlot } = useShowTowers(props.id, channels, towers)
const { bars, loadBars, addBar, saveBar, removeBar, assignFixture, updateFixtureNotes, unassignFixture, reorderBars } = useShowBars(props.id, channels)

const {
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
} = useTemplateInsertion(props.id, meta, { loadBars, loadTowers })

const { historyOpen, openHistory, restore: doRestoreHistory } = useShowHistory(props.id, {
  pushSnapshot,
  loadChannels,
  loadSections,
})

const { mobileTab, aufbauTab, tabMounted } = useShowTabs(props.id, aufbauSubTabs, {
  onLeaveChannels: () => {
    search.value = ''
    activateHealthFilter(null)
  },
})

const { unit, cmToDisplay, formatLength } = useMeasureUnit()
const channelByIdForHangerei = computed(() => new Map(channels.value.map(c => [c.id, c])))
const hangerei = computed(() => generateHangereiEntries(bars.value, channelByIdForHangerei.value, unit.value, cmToDisplay, locale.value))
const gassenturmGenerated = computed(() => generateGassenturmEntries(towers.value, channelByIdForHangerei.value, locale.value))

// Über icon, nicht über den Titel: benennt der Nutzer den Abschnitt um, soll der
// generierte Text (Beleuchtungsgestelle/Obermaschinerie) weiter dort erscheinen.
const aufbauSectionId = computed(() => sectionDefs.value.find(s => s.icon === 'setup')?.id ?? null)

function debounce(fn, ms) {
  let timer = null
  return (...args) => { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; fn(...args) }, ms) }
}
const loadBarsDebounced = debounce(loadBars, 120)

const { presence, initPresence, cleanupPresence } = useShowPresence(props.id, {
  onChannels: handleChannelsSse,
  onSections: handleSectionsSse,
  onTowers: () => loadTowers(),
  onBars: () => loadBarsDebounced(),
})

// ── Health Stats ───────────────────────────────────────────────────────────
const healthStats = computed(() => {
  const chs = channels.value
  return {
    noNotes:    chs.filter(c => !(c.notes ?? '').trim()).length,
    noDevice:   chs.filter(c => !(c.device ?? '').trim()).length,
    noPosition: chs.filter(c => !(c.position ?? '').trim()).length,
    noAddress:  chs.filter(c => !(c.address ?? '').trim()).length,
    // Kanäle mit mindestens einer Lücke — keine Summe der Einzelwerte,
    // sonst würde ein Kanal mit mehreren fehlenden Angaben mehrfach zählen.
    incomplete: chs.filter(c =>
      !(c.device ?? '').trim() || !(c.position ?? '').trim() || !(c.address ?? '').trim()
    ).length,
  }
})

const healthLabels = computed(() => ({
  title:      t('health.title'),
  complete:   t('health.complete'),
  incomplete: t('health.incomplete'),
  noNotes:    t('health.noNotes'),
  noDevice:   t('health.noDevice'),
  noPosition: t('health.noPosition'),
  noAddress:  t('health.noAddress'),
}))

function onHealthFilter(type) {
  if (!type) { activateHealthFilter(null); return }
  mobileTab.value = 'channels'
  search.value = ''
  activateHealthFilter(healthFilter.value === type ? null : type)
}

// ── Editor ─────────────────────────────────────────────────────────────────
function onSetupChange(md) {
  recordFocus()
  pendingSetupMd = md
  setupSaving.value = true
  persistSetupDebounced()
  nextTick(() => commitFocus())
}

// ── History ─────────────────────────────────────────────────────────────────
async function onRenameShow(name) {
  meta.value.name = name
  await updateMeta(props.id, { ...meta.value })
  invalidate('shows')
}

async function onUpdateMeta(fields) {
  meta.value = { ...meta.value, ...fields }
  await updateMeta(props.id, { ...meta.value })
  invalidate('shows')
}

// ── PDF ────────────────────────────────────────────────────────────────────
async function openPdf() {
  const url = await api.downloadUrl(`/api/shows/${props.id}/pdf`)
  window.open(url, '_blank')
}

function jumpToChannel(channelNum) {
  mobileTab.value = 'channels'
  nextTick(() => {
    const el = document.querySelector(`[data-ch-key="${channelNum}|"]`) ??
                document.querySelector(`[data-ch-key^="${channelNum}|"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el) {
      el.classList.add('ring-2', 'ring-accent', 'ring-inset')
      setTimeout(() => el.classList.remove('ring-2', 'ring-accent', 'ring-inset'), 1500)
    }
  })
}

function openTowerFromFloorplan(_towerId) {
  mobileTab.value = 'gassenturm'
  aufbauTab.value = 'gassenturm'
}

function onOpenBarFromFloorplan(_barId) {
  mobileTab.value = 'gassenturm'
  aufbauTab.value = 'zugstangen'
}

const activeChannelForAssign = ref(null)
const pendingFloorplanChannel = ref(null)

async function onAssignTower(ch) {
  if (!ch.id) await persistChannels()
  activeChannelForAssign.value = channels.value.find(c => c.channel === ch.channel) ?? ch
  mobileTab.value = 'gassenturm'
  aufbauTab.value = 'gassenturm'
}

async function onAssignBar(ch) {
  if (!ch.id) await persistChannels()
  activeChannelForAssign.value = channels.value.find(c => c.channel === ch.channel) ?? ch
  mobileTab.value = 'gassenturm'
  aufbauTab.value = 'zugstangen'
}

function onSidebarNavigate({ tab, subTab }) {
  mobileTab.value = tab
  if (subTab !== undefined) aufbauTab.value = subTab
}

// ── Haupt-Sidebar Nav-Items ────────────────────────────────────────────────
const { aufbauNavVisible } = useShowSidebarNav({
  t, meta, mobileTab, aufbauTab, sectionDefs,
  onSidebarNavigate,
  addSectionFromSubtab: () => addSectionFromSubtab(),
})

const bottomNavItems = computed(() => [
  {
    key: 'channels',
    label: t('tab.channels'),
    icon: Radio,
    active: mobileTab.value === 'channels',
    action: () => { mobileTab.value = 'channels' },
  },
  ...(aufbauNavVisible.value ? [{
    key: 'gassenturm',
    label: t('tab.gassenturm'),
    icon: Construction,
    active: mobileTab.value === 'gassenturm',
    action: () => { mobileTab.value = 'gassenturm' },
  }] : []),
  {
    key: 'photos',
    label: t('tab.photos'),
    icon: Images,
    active: mobileTab.value === 'photos',
    action: () => { mobileTab.value = 'photos' },
  },
  {
    key: 'floorplan',
    label: t('tab.floorplan'),
    icon: MapIcon,
    active: mobileTab.value === 'floorplan',
    action: () => { mobileTab.value = 'floorplan' },
  },
])

function onPlaceInFloorplan(ch) {
  pendingFloorplanChannel.value = null
  nextTick(() => {
    pendingFloorplanChannel.value = channels.value.find(c => c.channel === ch.channel) ?? ch
    mobileTab.value = 'floorplan'
  })
}

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
  pushSnapshot()
  const id = uuid()
  const newDefs = [...sectionDefs.value, { id, title, type: newSectionType.value, order: sectionDefs.value.length, rows: newSectionType.value === 'kv-table' ? [] : undefined }]
  sectionDefs.value = newDefs
  await persistSectionDefs()
  aufbauTab.value = `section:${id}`
}

// ── Laden ──────────────────────────────────────────────────────────────────
let snapshotInterval = null

onMounted(async () => {
  try {
    const [showData] = await Promise.all([
      fetchShow(props.id),
      loadChannels(),
      loadSections()
    ])

    meta.value = { name: showData.name, datum: showData.datum, template: showData.template, spielzeit: showData.spielzeit, use_bars: showData.use_bars !== false, use_towers: showData.use_towers !== false }
    setupMarkdown.value = showData.setupMarkdown ?? ''
    eosActiveChannels.value = showData.eosActiveChannels ?? null
    eosExcludedChannels.value = showData.eosExcludedChannels ?? []

    // Aufbau-Section automatisch anlegen falls nicht vorhanden.
    // Erkennung über icon: beim Titelvergleich entstand bei jedem Öffnen ein
    // neuer Abschnitt, sobald der Nutzer den vorhandenen umbenannt hatte.
    if (!sectionDefs.value.some(s => s.icon === 'setup')) {
      const id = uuid()
      const newDefs = [...sectionDefs.value, { id, title: t('section.setup.default_title'), type: 'markdown', icon: 'setup', order: sectionDefs.value.length }]
      sectionDefs.value = newDefs
      await persistSectionDefs()
    }
  } catch (e) {
    console.error('Ladefehler:', e)
  } finally {
    loading.value = false
  }

  initSnapshot()
  createSnapshot(props.id).catch(() => {})
  snapshotInterval = setInterval(() => createSnapshot(props.id).catch(() => {}), 10 * 60 * 1000)

  loadPhotos().catch(() => {})
  loadFloorplan().catch(() => {})
  loadTowers().catch(() => {})
  loadBars().catch(() => {})
  initPresence()

  await nextTick()
  window.addEventListener('keydown', onUndoRedoKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onUndoRedoKeydown)
  cleanupPresence()
  clearInterval(snapshotInterval)
  persistSetupDebounced?.flush?.()
  persistChannels?.flush?.()
  persistSectionsDebounced?.flush?.()
})
</script>

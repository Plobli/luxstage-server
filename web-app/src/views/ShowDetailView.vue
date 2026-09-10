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
      @circuitScanFileSelected="onCircuitScanFileSelected($event)"
      :circuitScanUploading="circuitScanUploading"
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
        :saveError="channelsSaveError || sectionsSaveError || floorplanSaveError"
        :lockedByOther="showLock.isLockedByOther.value"
        :presentUsers="presentUsers"
        :dupAddressWarning="dupWarning"
        :dupChannelWarning="dupChannelWarning"
        :healthStats="healthStats"
        :healthLabels="healthLabels"
        :hasEosImport="!!eosActiveChannels"
        v-model:hideEosInactive="hideEosInactive"
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
          hideEosInactive: t('channel.hide_eos_inactive'),
          lockedBy: lock?.user ? t('lock.lockedBy', { user: lock.user }) : '',
        }"
        @undo="runUndo()"
        @redo="runRedo()"
        @filterDup="dupFilter = $event"
        @healthFilter="onHealthFilter($event)"
        @requestTakeover="showLock.requestTakeover()"
      />
      <div v-if="dupFilter" class="shrink-0 flex items-center justify-between gap-2 px-4 py-1.5 border-b border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-400">
        <span>{{ dupFilter === 'address' ? t('channel.dup_address') : t('channel.dup_channel') }}</span>
        <Button size="sm" variant="outline" class="h-6 px-2 text-xs" @click="dupFilter = null">{{ t('action.done') }}</Button>
      </div>
      <div v-if="healthFilter" class="shrink-0 flex items-center justify-between gap-2 px-4 py-1.5 border-b border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-400">
        <span>{{ healthLabels[healthFilter] }}</span>
        <Button size="sm" variant="outline" class="h-6 px-2 text-xs" @click="onHealthFilter(null)">{{ t('action.done') }}</Button>
      </div>

      <!-- ── Loading ──────────────────────────────────────────────────── -->
      <div v-if="loading" class="flex flex-1 items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <Loader2 class="size-8 animate-spin text-accent" />
          <span class="text-sm text-muted-foreground">{{ t('error.loading') }}</span>
        </div>
      </div>
      <!-- Schreib-Sperre: Content read-only solange ein anderer User hält.
           Kein inert hier — das würde browserbedingt auch Scroll-Events auf
           verschachtelten Kindern blockieren. Der Overlay fängt Klicks ab,
           reicht Mausrad/Trackpad-Scrollen aber gezielt an den darunterliegenden
           scrollbaren Container weiter (ein Overlay mit pointer-events:auto
           würde sonst auch wheel-Events auf sich selbst behalten statt
           "durchzuscrollen"). -->
      <div
        v-else
        :class="{ 'relative opacity-60 select-none': showLock.isLockedByOther.value }"
        class="flex flex-1 min-h-0 overflow-hidden pb-14 md:pb-0"
      >
        <div v-if="showLock.isLockedByOther.value" class="absolute inset-0 z-40" @wheel="onLockOverlayWheel" />

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
              :flushChannelsSave="flushChannelsSave"
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
          <div class="flex-1 min-h-0 overflow-y-auto p-4" data-scroll-container>
            <PhotoGallery
              ref="photoGalleryRef"
              :photos="photos"
              :channels="channels"
              :captions="photoCaptions"
              :photoChannelsMap="photoChannels"
              :uploadQueue="photoUploadQueue"
              :photoUrlFn="photoUrl"
              :saveCaptionFn="savePhotoCaption"
              :saveChannelsFn="savePhotoChannelsForPhoto"
              :uploadFilesFn="uploadPhotoFiles"
              :deletePhotoFn="removeShowPhoto"
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
                channelPickMultiHint: t('photo.channel_pick_multi_hint'),
              }"
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
          <ShowAufbauTab
            :showId="props.id"
            :aufbauSubTabs="aufbauSubTabs"
            :aufbauTab="aufbauTab"
            :aufbauSectionId="aufbauSectionId"
            :sectionDefs="sectionDefs"
            :sectionContents="sectionContents"
            :setupMarkdown="setupMarkdown"
            :persistSectionDefs="persistSectionDefs"
            :gassenturmGenerated="gassenturmGenerated"
            :hangerei="hangerei"
            :meta="meta"
            :towers="towers"
            :bars="bars"
            :channels="channels"
            :activeChannelForAssign="activeChannelForAssign"
            :saveTowerToTemplate="saveTowerToTemplate"
            :fetchTowerTemplateNames="fetchTowerTemplateNames"
            :saveBarToTemplate="saveBarToTemplate"
            :fetchBarTemplateNames="fetchBarTemplateNames"
            :openFromTemplateDialog="openFromTemplateDialog"
            @update:aufbauTab="aufbauTab = $event"
            @deleteSection="dialogs.deleteSection($event)"
            @update:sectionDefs="sectionDefs = $event"
            @update:sectionContents="sectionContents = $event"
            @setupChange="onSetupChange($event)"
            @sectionChange="persistSectionsDebounced"
            @update:activeChannelForAssign="activeChannelForAssign = $event"
          />
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
      :entries="historyEntries"
      :currentEntry="historyCurrentEntry"
      :loading="historyLoading"
      :error="historyError"
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
      @select="loadHistoryEntry($event)"
      @back="historyCurrentEntry = null"
    />

    <ShowDetailDialogs
      v-model:newSectionDialog="dialogs.newSectionDialog.value"
      v-model:newSectionName="dialogs.newSectionName.value"
      v-model:newSectionType="dialogs.newSectionType.value"
      :eosMergePreview="dialogs.eosMergePreview"
      v-model:fromTemplateDialogOpen="dialogs.fromTemplateDialogOpen.value"
      :fromTemplateScope="dialogs.fromTemplateScope.value"
      :fromTemplateItemsLoading="dialogs.fromTemplateItemsLoading.value"
      :fromTemplateItems="dialogs.fromTemplateItems.value"
      :fromTemplateSelectedIds="dialogs.fromTemplateSelectedIds.value"
      v-model:fromTemplateWithChannels="dialogs.fromTemplateWithChannels.value"
      :fromTemplateLoading="dialogs.fromTemplateLoading.value"
      :formatLength="formatLength"
      @confirmNewSection="dialogs.confirmNewSection"
      @resolveEosMergePreview="(...args) => dialogs.resolveEosMergePreview(...args)"
      @fromTemplateSelectAll="dialogs.fromTemplateSelectAll"
      @fromTemplateSelectNone="dialogs.fromTemplateSelectNone"
      @fromTemplateToggleId="dialogs.fromTemplateToggleId"
      @confirmFromTemplate="dialogs.confirmFromTemplate"
    />

    <!-- Statusanzeige Kreisliste-Scan -->
    <Transition enter-active-class="transition-all duration-200" enter-from-class="opacity-0 translate-y-2" leave-active-class="transition-all duration-150" leave-to-class="opacity-0">
      <div
        v-if="circuitScanUploading || circuitScanStatus"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg"
        :class="circuitScanStatus?.type === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-border bg-surface-raised text-foreground'"
      >
        <span v-if="circuitScanUploading" class="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span>{{ circuitScanUploading ? t('import.modal.scan.status.loading') : circuitScanStatus?.message }}</span>
      </div>
    </Transition>

    <CircuitScanPreviewDialog
      :open="circuitScanPreview.open"
      :updated="circuitScanPreview.updated"
      :added="circuitScanPreview.added"
      @resolve="(...args) => resolveCircuitScanPreview(...args)"
      @cancel="resolveCircuitScanPreview(false)"
    />

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, defineAsyncComponent, provide } from 'vue'
import { Loader2, Radio, Images, Map as MapIcon, Construction, Plus } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { useLocale } from '../composables/useLocale.js'
import { useConfirm } from '../composables/useConfirm.js'
import { useKeyboardNav } from '../composables/useKeyboardNav.js'

import { useShowPhotos } from '../composables/useShowPhotos.js'
import { useShowSections } from '../composables/useShowSections.js'
import { useShowLock } from '../composables/useShowLock.js'
import { useShowChannels } from '../composables/useShowChannels.js'
import { usePhotoGallery } from '../composables/usePhotoGallery'
import { useShowFloorplan } from '../composables/useShowFloorplan.js'
import { useShowTowers } from '../composables/useShowTowers.js'
import { useShowBars } from '../composables/useShowBars.js'
import { useShowHistory } from '../composables/useShowHistory'
import { useMeasureUnit } from '../composables/useMeasureUnit'
import { useShowTabs } from '../composables/useShowTabs.js'
import { useTemplateInsertion } from '../composables/useTemplateInsertion.js'
import { useShowDialogs } from '../composables/useShowDialogs.js'

import ShowHeader from '../components/show/ShowHeader.vue'
import CircuitScanPreviewDialog from '../components/show/CircuitScanPreviewDialog.vue'
const ShowActionBar = defineAsyncComponent(() => import('../components/show/ShowActionBar.vue'))
import { useShowSidebarNav } from '../composables/useShowSidebarNav.js'
import ShowAufbauTab from '../components/show/ShowAufbauTab.vue'
import { Button } from '@/components/ui/button'
import { fetchShow, updateMeta, createSnapshot } from '../api/shows.js'
import { uuid } from '../utils/uuid.js'
import { downloadChannelsCsv } from '../api/channels.js'
import { generateHangereiEntries, generateGassenturmEntries } from '../utils/generateHangerei'
const PhotoGallery = defineAsyncComponent(() => import('../components/show/PhotoGallery.vue'))
const HistorySlideOver = defineAsyncComponent(() => import('../components/show/HistorySlideOver.vue'))
const ShowDetailDialogs = defineAsyncComponent(() => import('../components/show/ShowDetailDialogs.vue'))
import { isOnline, api } from '../api/client.js'

const ChannelTable = defineAsyncComponent(() => import('../components/channel/ChannelTable.vue'))
const FloorplanEditor = defineAsyncComponent(() => import('../components/FloorplanEditor.vue'))

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
// showLock zuerst: useShowFloorplan/useShowSections/useShowChannels (unten)
// brauchen onLockConflict beim Erzeugen. useShowLock bündelt seit Kurzem auch
// die SSE-Lock-Events selbst (vorher zwei Composables, die sich zirkulär
// brauchten — siehe Kommentar in useShowLock.ts) — dadurch kann showLock hier
// ohne Forward-Reference ganz am Anfang stehen.
const showLock = useShowLock(props.id)
const { lock, presentUsers, initLockEvents, cleanupLockEvents } = showLock
function onLockConflict(body) {
  showLock.syncLockFromConflict(body)
}

const photoGalleryRef = ref(null)
const { photos, loadPhotos } = useShowPhotos(props.id)
const {
  photoCaptions, photoChannels, uploadQueue: photoUploadQueue,
  loadCaptionsAndChannels: loadPhotoCaptionsAndChannels,
  saveCaption: savePhotoCaption, saveChannelsForPhoto: savePhotoChannelsForPhoto,
  photoUrl, uploadFiles: uploadPhotoFiles, removePhoto: removeShowPhoto,
} = usePhotoGallery(props.id, photos)
const { floorplan, floorplanSaveError, loadFloorplan, onFloorplanChange, onFloorplanImageUpload, onFloorplanImageDelete } = useShowFloorplan(props.id, onLockConflict)

// api.url() ist async (kurzlebiges Token muss ggf. nachgeladen werden) —
// floorplanImageUrl hält den zuletzt aufgelösten String für :image-url.
const floorplanImageUrl = ref(null)
watch(() => floorplan.value.image_url, async (path) => {
  floorplanImageUrl.value = path ? await api.url(path) : null
}, { immediate: true })

const {
  sectionDefs, sectionContents, sectionsSaving, sectionsSaveError,
  persistSectionsDebounced, persistSectionDefs, flushSectionsSave,
  loadSections,
} = useShowSections(props.id, meta, onLockConflict)

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
let setupDirty = false
async function doPersistSetup() {
  setupSaving.value = true
  try {
    await updateMeta(props.id, { ...meta.value, setupMarkdown: pendingSetupMd })
    setupDirty = false
  } finally {
    setupSaving.value = false
  }
}
const persistSetupDebounced = useDebounceFn(doPersistSetup, 50)

const towers = ref([])

// useShowChannels() braucht den Reload-Callback schon beim Erzeugen, loadTowers/
// loadBars entstehen aber erst danach (sie hängen von `channels` ab). Der Callback
// wird daher über eine Closure verzögert aufgelöst — bei Ausführung (nur nach
// erfolgreichem Undo/Redo, also erst nach dem Setup) sind alle vier Loader gesetzt.
let afterUndoRedoImpl = null

const {
  channels, channelsSaving, channelsSaveError, search, healthFilter, activateHealthFilter, eosActiveChannels, eosExcludedChannels, eosMergePreview,
  dupWarning, dupChannelWarning, dupChannelNrs, dupFilter, hideEosInactive, groupedChannels,
  scheduleChannelsSave, persistChannels, deleteChannel, clearChannel, flushChannelsSave,
  onCsvImportSelected, onCircuitScanFileSelected, circuitScanUploading, circuitScanStatus, circuitScanPreview, resolveCircuitScanPreview, onEosFileSelected, resolveEosMergePreview,
  channelStatus, toggleChannelStatus,
  undo, redo, canUndo, canRedo,
  loadChannels,
} = useShowChannels({
  showId: props.id,
  meta,
  setupMarkdown,
  t,
  localeReady,
  onLockConflict,
  onAfterUndoRedo: () => afterUndoRedoImpl?.(),
})

// Kanal-/Setup-/Section-Änderungen werden debounced gespeichert (siehe
// scheduleChannelsSave/persistSectionsDebounced/persistSetupDebounced). Ein
// Undo/Redo direkt nach so einer Änderung, aber noch vor Ablauf der Debounce-
// Pause, lief sonst gegen den alten Serverstand — und wenn die verzögerte
// Speicherung danach nachträglich feuerte, leerte sie über withUndoSnapshot
// den Redo-Stack, den das Undo gerade erst gefüllt hatte (Redo schlug dann
// mit 400 fehl, obwohl gerade erst ein Undo funktioniert hatte). Vor jedem
// Undo/Redo müssen also alle ausstehenden Speicherungen zuerst durch.
async function flushAllPendingSaves() {
  if (setupDirty) await doPersistSetup()
  await Promise.all([flushChannelsSave(), flushSectionsSave()])
}

async function runUndo() {
  try {
    await flushAllPendingSaves()
    await undo()
  } catch {
    channelsSaveError.value = t('error.save_failed')
  }
}

async function runRedo() {
  try {
    await flushAllPendingSaves()
    await redo()
  } catch {
    channelsSaveError.value = t('error.save_failed')
  }
}

function onUndoRedoKeydownFlushed(e) {
  const isMac = navigator.userAgentData?.platform === 'macOS' || /Mac/.test(navigator.userAgent)
  const mod = isMac ? e.metaKey : e.ctrlKey
  if (!mod) return
  if (!e.shiftKey && e.key === 'z') {
    e.preventDefault()
    runUndo()
  } else if ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (!isMac && e.key === 'y')) {
    e.preventDefault()
    runRedo()
  }
}

const { loadTowers, addTower, saveTower, removeTower, assignSlot } = useShowTowers(props.id, channels, towers, onLockConflict, loadChannels)
const { bars, loadBars, addBar, saveBar, removeBar, assignFixture, updateFixtureNotes, unassignFixture, reorderBars } = useShowBars(props.id, channels, onLockConflict, loadChannels)

// GassenturmView/ZugstangenView holen sich CRUD per inject() statt über
// je 4-7 einzelne Function-Props — teilt dieselbe useShowTowers/useShowBars-
// Instanz (dieselben towers/bars-Refs wie z.B. die generierten Übersichten
// unten), statt sie im Kind ein zweites Mal zu erzeugen.
provide('showTowers', { addTower, saveTower, removeTower, assignSlot })
provide('showBars', { addBar, saveBar, removeBar, assignFixture, updateFixtureNotes, unassignFixture, reorderBars })

afterUndoRedoImpl = async () => {
  await Promise.all([loadChannels(), loadSections(), loadTowers(), loadBars(), loadFloorplan()])
}

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

const {
  historyOpen, openHistory, restore: doRestoreHistory,
  entries: historyEntries, currentEntry: historyCurrentEntry,
  loading: historyLoading, error: historyError, loadEntry: loadHistoryEntry,
} = useShowHistory(props.id, {
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

const dialogs = useShowDialogs({
  sectionDefs, aufbauTab, aufbauSubTabs, aufbauSectionId,
  persistSectionDefs, confirm, t,
  templateInsertion: {
    fromTemplateDialogOpen, fromTemplateScope, fromTemplateItemsLoading, fromTemplateItems,
    fromTemplateSelectedIds, fromTemplateWithChannels, fromTemplateLoading,
    fromTemplateSelectAll, fromTemplateSelectNone, fromTemplateToggleId,
    confirmFromTemplate,
  },
  eosMergePreview,
  resolveEosMergePreview,
})

showLock.initTakeoverConfirm(confirm, t)

// Overlay steht über dem Content und fängt Klicks/Eingaben ab (siehe Sperr-
// Wrapper oben) — Mausrad/Trackpad-Events werden hier manuell an den
// darunterliegenden scrollbaren Container weitergereicht, sonst bliebe die
// Show für den gesperrten User auch lesend nicht mehr scrollbar.
function onLockOverlayWheel(e) {
  const overlay = e.currentTarget
  overlay.style.pointerEvents = 'none'
  const below = document.elementFromPoint(e.clientX, e.clientY)
  overlay.style.pointerEvents = ''
  // [data-scroll-container]: explizit markierte Container in dieser Datei.
  // Der Klassen-Fallback bleibt bestehen für Scroll-Container, die tief in
  // Kind-Komponenten liegen (z.B. ChannelTable.vue's eigene Liste) und hier
  // nicht einzeln markiert werden.
  const scrollable = below?.closest('[data-scroll-container], [class*="overflow-y-auto"], [class*="overflow-auto"]')
  if (scrollable) scrollable.scrollBy({ top: e.deltaY, left: e.deltaX })
}

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
  pendingSetupMd = md
  setupDirty = true
  setupSaving.value = true
  persistSetupDebounced()
}

// ── History ─────────────────────────────────────────────────────────────────
async function onRenameShow(name) {
  meta.value.name = name
  await updateMeta(props.id, { ...meta.value })
}

async function onUpdateMeta(fields) {
  meta.value = { ...meta.value, ...fields }
  await updateMeta(props.id, { ...meta.value })
}

// ── PDF ────────────────────────────────────────────────────────────────────
async function openPdf() {
  const url = await api.downloadUrl(`/api/shows/${props.id}/pdf`)
  window.open(url, '_blank')
}

function jumpToChannel(channelNum) {
  mobileTab.value = 'channels'
  nextTick(() => {
    const el = document.querySelector(`[data-ch-nr="${channelNum}"]`)
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
  addSectionFromSubtab: () => dialogs.addSectionFromSubtab(),
  deleteSection: (sectionId) => dialogs.deleteSection(sectionId),
  renameSection: (sectionId, title) => dialogs.renameSection(sectionId, title),
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

  createSnapshot(props.id).catch(() => {})
  snapshotInterval = setInterval(() => createSnapshot(props.id).catch(() => {}), 10 * 60 * 1000)

  loadPhotos().catch(() => {})
  loadPhotoCaptionsAndChannels()
  loadFloorplan().catch(() => {})
  loadTowers().catch(() => {})
  loadBars().catch(() => {})
  initLockEvents()
  showLock.acquireOnOpen().catch(() => {})

  // Bereichs-Chunks im Hintergrund vorladen, damit der erste Klick auf einen
  // Sidebar-Tab nicht auf den Netzwerk-Download des Chunks warten muss.
  import('../components/show/GassenturmView.vue').catch(() => {})
  import('../components/show/ZugstangenView.vue').catch(() => {})
  import('../components/show/SectionEditor.vue').catch(() => {})
  import('../components/show/PhotoGallery.vue').catch(() => {})
  import('../components/FloorplanEditor.vue').catch(() => {})

  await nextTick()
  window.addEventListener('keydown', onUndoRedoKeydownFlushed)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onUndoRedoKeydownFlushed)
  cleanupLockEvents()
  showLock.releaseOnClose()
  clearInterval(snapshotInterval)
  // useDebounceFn() (vueuse) returns a plain function with no .flush()/.cancel() —
  // call the underlying immediate save so a pending debounced edit isn't lost on unmount.
  if (setupDirty) doPersistSetup()
  flushChannelsSave()
  flushSectionsSave()
})
</script>

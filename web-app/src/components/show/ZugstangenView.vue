<template>
  <div class="relative flex flex-col h-full overflow-hidden">
    <!-- Typ-Filter -->
    <div v-if="bars.length > 0" class="flex items-center gap-1.5 px-5 pt-3 pb-1 shrink-0 overflow-x-auto">
      <button
        v-for="opt in typeFilterOptions"
        :key="opt.value"
        class="shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors"
        :class="typeFilter === opt.value ? 'bg-accent/20 border-accent/50 text-accent' : 'border-border/40 text-muted-foreground hover:bg-white/5'"
        @click="typeFilter = opt.value"
      >{{ opt.label }}<span v-if="opt.value !== 'all'" class="ml-1 tabular-nums opacity-60">{{ opt.count }}</span></button>
    </div>

    <!-- Zugstangen-Liste -->
    <div class="flex-1 overflow-y-auto pb-14 md:pb-0">
      <div v-if="bars.length === 0" class="flex flex-col items-center justify-center gap-3 h-full text-center px-8 -mt-5">
        <AlignJustify class="size-8 text-muted-foreground/40" />
        <div class="max-w-150">
          <p class="text-base font-medium text-foreground/70">{{ t('zugstange.empty') }}</p>
          <p class="text-sm text-muted-foreground mt-1">{{ t('zugstange.empty.desc') }}</p>
        </div>
        <Button variant="accent" @click="openNewBarDialog" class="mt-1 h-11 px-5 rounded-full shadow-lg flex items-center gap-2">
          <Plus class="size-4" /> {{ t('zugstange.new') }}
        </Button>
      </div>
      <div v-else-if="filteredBars.length === 0" class="flex flex-col items-center justify-center gap-3 h-full text-center px-8 -mt-5">
        <AlignJustify class="size-8 text-muted-foreground/40" />
        <p class="text-sm text-muted-foreground">{{ t('zugstange.empty') }}</p>
      </div>

      <!-- Eine Zeile pro Element -->
      <div
        v-for="bar in filteredBars"
        :key="bar.id"
        draggable="true"
        class="group/row relative flex items-center gap-6 px-5 py-4 mx-3 my-2 rounded-xl border transition-colors"
        :class="dragOverId === bar.id ? 'bg-white/8 border-primary/50' : draggedId === bar.id ? 'opacity-40 border-border/40 bg-white/4' : 'bg-white/4 border-border/40 hover:bg-white/6'"
        @dragstart="onBarDragStart(bar.id)"
        @dragover="onBarDragOver($event, bar.id)"
        @drop="onBarDrop(bar.id)"
        @dragend="onBarDragEnd"
      >
        <!-- Linke Spalte: Name oben, Länge + Höhe unten (bündig zur Anmerkung) -->
        <div class="w-44 shrink-0 self-stretch flex flex-col" :class="isPunktzug(bar) ? 'justify-center' : 'justify-end'">
          <div class="flex items-center gap-1.5 mb-3">
            <span class="text-lg font-semibold text-foreground tracking-tight truncate leading-tight">{{ bar.name }}</span>
          </div>
          <span class="self-start -mt-2 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-white/8 text-muted-foreground/70" :class="isPunktzug(bar) ? '' : 'mb-2'">{{ typeLabel(bar.bar_type) }}</span>
          <div v-if="!isPunktzug(bar)" class="min-w-0">
            <!-- Länge -->
            <div class="relative w-32">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider pointer-events-none">{{ t('zugstange.field.length') }}</span>
              <input
                type="text"
                inputmode="decimal"
                :value="cmToDisplay(bar.length_cm)"
                class="w-full h-8 rounded-md border border-transparent bg-white/3 pl-13 pr-7 text-sm tabular-nums text-right text-foreground placeholder:text-muted-foreground/25 hover:bg-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/5 transition-colors"
                @change="saveInlineField(bar, 'length_cm', parseToCm(Number($event.target.value)))"
              />
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 pointer-events-none">{{ unit }}</span>
            </div>
            <!-- Höhe -->
            <div class="relative mt-1.5 w-32">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider pointer-events-none">{{ t('zugstange.field.height') }}</span>
              <input
                type="text"
                inputmode="decimal"
                :value="bar.height_cm != null ? cmToDisplay(bar.height_cm) : ''"
                placeholder="—"
                class="w-full h-8 rounded-md border border-transparent bg-white/3 pl-13 pr-7 text-sm tabular-nums text-right text-foreground placeholder:text-muted-foreground/25 hover:bg-white/5 focus:outline-none focus:border-accent/60 focus:bg-white/5 transition-colors"
                @change="saveInlineField(bar, 'height_cm', $event.target.value === '' ? null : parseToCm(Number($event.target.value)))"
              />
              <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/40 pointer-events-none">{{ unit }}</span>
            </div>
          </div>
        </div>

        <!-- Mittlere Spalte: Bar-Visualisierung (Punktzug-Kreis oder Stangen-/Traversen-Linie) -->
        <BarVisualization
          :bar="bar"
          :channels="channels"
          @editFixture="fx => openFixtureEditDialog(fx, bar)"
          @removeFixture="fx => confirmRemoveFixture(fx, bar)"
          @punktzugAddClick="onPunktzugAddClick(bar)"
          @savePunktzugPositionText="value => savePunktzugPositionText(bar, value)"
          @saveInlineField="(field, value) => saveInlineField(bar, field, value)"
          @lineClick="({ position, side }) => onBarPositionPick(bar, position, side)"
          @fixtureDragEnd="fx => onFixtureDragEnd(bar, fx)"
        />

        <!-- Rechte Spalte: Aktionen (gestapelt, nur bei Hover) -->
        <div class="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <!-- Als Vorlage speichern -->
          <Button
            v-if="props.saveToTemplateFn"
            variant="ghost" size="icon" class="size-7 text-muted-foreground/60"
            :title="savingBarId === bar.id ? '…' : t('zugstange.save_to_template')"
            @click.stop="openSaveDialog(bar)"
          >
            <Loader2 v-if="savingBarId === bar.id" class="size-3.5 animate-spin" />
            <BookmarkPlus v-else class="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/60" @click="openEditBarDialog(bar)">
            <Pencil class="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" class="size-7 text-muted-foreground/60" @click="confirmDeleteBar(bar)">
            <Trash2 class="size-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Neue Zugstange -->
    <Button v-if="bars.length > 0" variant="accent" @click="openNewBarDialog" class="absolute bottom-20 right-6 md:bottom-6 h-11 px-5 rounded-full shadow-lg flex items-center gap-2">
      <Plus class="size-4" /> {{ t('zugstange.new') }}
    </Button>
  </div>

  <!-- Bar Dialog -->
  <Dialog :open="barDialogOpen" @update:open="barDialogOpen = $event">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editingBar ? t('zugstange.dialog.edit') : t('zugstange.dialog.new') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('zugstange.field.type') }}</label>
          <div class="flex gap-1.5">
            <button
              v-for="opt in barTypeOptions"
              :key="opt.value"
              type="button"
              class="flex-1 h-9 rounded-md border text-sm font-medium transition-colors"
              :class="barForm.bar_type === opt.value ? 'bg-accent/20 border-accent/50 text-accent' : 'border-border/40 text-muted-foreground hover:bg-white/5'"
              @click="barForm.bar_type = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('zugstange.field.name') }}</label>
          <Input size="lg" v-model="barForm.name" :placeholder="t('zugstange.name.placeholder')" autofocus />
        </div>
        <div v-if="barForm.bar_type !== 'punktzug'" class="flex flex-col gap-1.5">
          <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
            {{ t('zugstange.field.length_unit', { unit }) }}
            <HelpIcon :text="t('zugstange.field.length.help')" side="right" />
          </label>
          <Input size="lg" :modelValue="barFormDisplay.length" type="number" :min="lengthMin" :max="lengthMax" :step="inputStep" @update:modelValue="barForm.length_cm = parseToCm(Number($event))" />
        </div>
        <button v-if="barForm.bar_type !== 'punktzug'" type="button" class="flex items-center justify-between w-full rounded-lg border border-border px-4 py-3 text-left transition-colors hover:bg-muted/40" @click="barForm.hide_scale = !barForm.hide_scale">
          <span class="flex items-center gap-1.5 text-sm text-foreground">
            {{ t('zugstange.scale.hide') }}
            <HelpIcon :text="t('zugstange.scale.help')" side="right" />
          </span>
          <div class="relative shrink-0 w-9 h-5 rounded-full transition-colors" :class="barForm.hide_scale ? 'bg-accent' : 'bg-muted'">
            <div class="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform" :class="barForm.hide_scale ? 'translate-x-4' : 'translate-x-0'" />
          </div>
        </button>
      </DialogBody>
      <DialogFooter>
        <Button v-if="!editingBar && props.fromTemplateFn" variant="ghost" class="mr-auto text-xs text-muted-foreground" @click="barDialogOpen = false; props.fromTemplateFn()">
          {{ t('zugstange.dialog.from_template') }}
        </Button>
        <Button variant="ghost" @click="barDialogOpen = false">{{ t('action.cancel') }}</Button>
        <Button @click="saveBarForm">{{ editingBar ? t('action.save') : t('zugstange.action.create') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Remove Confirm Dialog -->
  <Dialog :open="removeConfirmOpen" @update:open="removeConfirmOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t('zugstange.fixture.remove.title') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <p class="text-sm text-muted-foreground">{{ removeConfirmText }}</p>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="removeConfirmOpen = false">{{ t('action.cancel') }}</Button>
        <Button variant="destructive" @click="doRemoveFixture">{{ t('zugstange.fixture.remove.action') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Edit Dialog -->
  <Dialog :open="fixtureEditOpen" @update:open="fixtureEditOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Kanal {{ channelNr(fixtureEditFx?.channel_id) }}{{ channelDevice(fixtureEditFx?.channel_id) ? ' · ' + channelDevice(fixtureEditFx?.channel_id) : '' }} — {{ fixtureEditBar?.name }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground">{{ t('zugstange.fixture.notes.label') }}</label>
          <Input size="lg" v-model="fixtureEditNotes" :placeholder="t('zugstange.fixture.notes.placeholder')" autofocus @keydown.enter="saveFixtureEdit" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" class="mr-auto text-xs text-muted-foreground" @click="goToChannel(fixtureEditFx?.channel_id); fixtureEditOpen = false">{{ t('zugstange.fixture.channel_link') }}</Button>
        <Button variant="ghost" @click="fixtureEditOpen = false">{{ t('action.cancel') }}</Button>
        <Button @click="saveFixtureEdit">{{ t('action.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Fixture Picker -->
  <Dialog :open="fixturePickerOpen" @update:open="fixturePickerOpen = $event">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t('zugstange.fixture.add') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <ChannelPickerGrid
          v-if="!pickerChannel"
          :channels="channels"
          :model-value="[]"
          :search-placeholder="t('zugstange.fixture.search.placeholder')"
          @pick="ch => { pickerChannel = ch }"
          @enter="ch => { pickerChannel = ch; confirmAddFixture() }"
        />
        <div v-if="pickerChannel" class="flex flex-col gap-3">
          <button
            type="button"
            class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
            @click="pickerChannel = null"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            {{ t('zugstange.fixture.picker.back') }}
          </button>
          <div class="flex items-center gap-4 px-4 py-3 rounded-lg bg-accent/10 border border-accent/30">
            <span class="text-2xl font-bold tabular-nums w-10 shrink-0 text-accent">{{ pickerChannel.channel }}</span>
            <div class="flex flex-col min-w-0 flex-1">
              <span class="text-sm font-semibold text-foreground truncate">{{ pickerChannel.device }}</span>
              <span v-if="pickerChannel.address || pickerChannel.color" class="text-xs text-muted-foreground mt-0.5">
                <span v-if="pickerChannel.address">DMX {{ pickerChannel.address }}</span><span v-if="pickerChannel.address && pickerChannel.color"> · </span><span v-if="pickerChannel.color">{{ pickerChannel.color }}</span>
              </span>
            </div>
          </div>
          <div v-if="!isPunktzug(pickerBar)" class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground">{{ t('zugstange.fixture.position') }} {{ unitLabel }}</label>
            <Input size="lg" autofocus :modelValue="cmToDisplay(pickerPosition)" type="number" :min="cmToDisplay(-(pickerBar?.length_cm || 600)/2)" :max="cmToDisplay((pickerBar?.length_cm || 600)/2)" :step="inputStep" @update:modelValue="pickerPosition = parseToCm(Number($event))" @keydown.enter="confirmAddFixture" />
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="fixturePickerOpen = false">{{ t('action.cancel') }}</Button>
        <Button :disabled="!pickerChannel" @click="confirmAddFixture">{{ t('action.add') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Als Vorlage speichern Dialog -->
  <Dialog :open="saveDialogOpen" @update:open="saveDialogOpen = $event">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ t('zugstange.save_dialog.title') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <!-- Ziel + Item-Info -->
        <div class="rounded-lg bg-muted/40 px-3 py-2 space-y-0.5">
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-muted-foreground shrink-0">{{ t('zugstange.save_dialog.template_label') }}</span>
            <span class="text-sm font-medium text-foreground truncate">{{ props.templateName }}</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-xs text-muted-foreground shrink-0">{{ t('zugstange.save_dialog.length_label') }}</span>
            <span class="text-xs text-muted-foreground">{{ formatLength(saveDialogBar?.length_cm) }}</span>
          </div>
        </div>
        <div>
          <Label class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.name_label') }}</Label>
          <Input size="lg" v-model="saveName" autofocus />
        </div>
        <!-- Überschreiben-Warnung -->
        <div v-if="saveNameConflict" class="rounded-lg border border-destructive/50 bg-destructive/5 px-3.5 py-3 space-y-2">
          <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.conflict', { name: saveName }) }}</p>
          <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.conflict.hint') }}</p>
          <div class="flex gap-2 pt-1">
            <Button size="sm" variant="ghost" @click="saveNameConflict = false">{{ t('action.cancel') }}</Button>
            <Button size="sm" variant="destructive" @click="saveConfirmOverwrite = true; confirmSaveDialog()">{{ t('zugstange.save_dialog.overwrite') }}</Button>
          </div>
        </div>
        <!-- Was wird gespeichert -->
        <div class="space-y-1">
          <!-- Struktur — immer aktiv -->
          <div class="flex items-start gap-3 py-2 opacity-60">
            <Checkbox :model-value="true" disabled class="mt-0.5" />
            <div>
              <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.structure') }}</p>
              <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.structure.desc') }}</p>
            </div>
          </div>
          <!-- Scheinwerfer-Trennlinie -->
          <div v-if="saveDialogBar?.fixtures?.length" class="pt-1">
            <p class="text-xs font-semibold text-muted-foreground px-1 pb-1">
              {{ t('zugstange.save_dialog.fixtures_count', { count: saveDialogBar.fixtures.length }) }}
            </p>
            <div class="h-px bg-border/50 mx-1 mb-1" />
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.position" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.field.position') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.field.position.desc') }}</p>
              </div>
            </label>
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.channel" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.field.channel') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.field.channel.desc') }}</p>
              </div>
            </label>
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.device" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.field.device') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.field.device.desc') }}</p>
              </div>
            </label>
            <label class="flex items-start gap-3 py-2 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors">
              <Checkbox v-model="saveFields.notes" class="mt-0.5" />
              <div>
                <p class="text-sm font-medium text-foreground">{{ t('zugstange.save_dialog.field.notes') }}</p>
                <p class="text-xs text-muted-foreground">{{ t('zugstange.save_dialog.field.notes.desc') }}</p>
              </div>
            </label>
          </div>
          <p v-else class="text-xs text-muted-foreground px-1 pt-1">{{ t('zugstange.save_dialog.no_fixtures') }}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="saveDialogOpen = false">{{ t('action.cancel') }}</Button>
        <Button :disabled="!!savingBarId || !saveName.trim()" @click="confirmSaveDialog">{{ t('action.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
import { useMeasureUnit } from '@/composables/useMeasureUnit'
import { useConfirm } from '@/composables/useConfirm.js'
import { useSaveToTemplateDialog } from '@/composables/useSaveToTemplateDialog'
const { t } = useLocale()
const { confirm } = useConfirm()

const { unit, unitLabel, formatLength, cmToDisplay, parseToCm, inputStep, lengthMin, lengthMax } = useMeasureUnit()
import { Plus, Pencil, Trash2, BookmarkPlus, Loader2, AlignJustify } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import HelpIcon from '@/components/ui/HelpIcon.vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import BarVisualization from './BarVisualization.vue'
import ChannelPickerGrid from './ChannelPickerGrid.vue'

const props = defineProps({
  bars: { type: Array, required: true },
  channels: { type: Array, required: true },
  preselectedChannelId: { type: String, default: null },
  saveToTemplateFn: { type: Function, default: null },
  templateName: { type: String, default: null },
  fetchTemplateNamesFn: { type: Function, default: null },
  fromTemplateFn: { type: Function, default: null },
})

const emit = defineEmits(['assigned', 'navigate-to-channel', 'reordered'])

// CRUD kommt aus ShowDetailView.vue per provide/inject statt als einzelne
// Function-Props — das teilt eine Instanz von useShowBars() (dieselben
// bars/loading-Refs wie z.B. die generierte Obermaschinerie-Übersicht in
// ShowDetailView.vue) statt sie hier ein zweites Mal zu erzeugen.
const { addBar, saveBar, removeBar, assignFixture, updateFixtureNotes, unassignFixture, reorderBars } = inject('showBars')

// Typ (Zugstange / Traverse / Punktzug)
const BAR_TYPES = ['zugstange', 'traverse', 'punktzug']
function typeLabel(type) { return t(`zugstange.type.${type || 'zugstange'}`) }
const barTypeOptions = computed(() => BAR_TYPES.map(value => ({ value, label: typeLabel(value) })))

const typeFilter = ref('all')
const filteredBars = computed(() => typeFilter.value === 'all' ? props.bars : props.bars.filter(b => (b.bar_type || 'zugstange') === typeFilter.value))
const typeFilterOptions = computed(() => [
  { value: 'all', label: t('zugstange.type.filter.all') },
  ...BAR_TYPES.map(value => ({ value, label: typeLabel(value), count: props.bars.filter(b => (b.bar_type || 'zugstange') === value).length })),
].filter(opt => opt.value === 'all' || opt.count > 0))

// Als Vorlage speichern
const {
  saveDialogOpen, savingId: savingBarId, saveDialogItem: saveDialogBar,
  saveFields, saveName, saveNameConflict, saveConfirmOverwrite,
  openSaveDialog, confirmSaveDialog,
} = useSaveToTemplateDialog(props.saveToTemplateFn, props.fetchTemplateNamesFn, { position: true, channel: true, device: true, color: true, notes: false })

// Drag & Drop — arbeitet auf einer lokalen Kopie, Prop-Array bleibt readonly
const localBars = computed(() => props.bars)
const draggedId = ref(null)
const dragOverId = ref(null)

function onBarDragStart(id) { draggedId.value = id }
function onBarDragOver(e, id) { e.preventDefault(); dragOverId.value = id }
function onBarDrop(targetId) {
  const arr = [...localBars.value]
  const from = arr.findIndex(b => b.id === draggedId.value)
  const to = arr.findIndex(b => b.id === targetId)
  if (from === -1 || to === -1 || from === to) { draggedId.value = null; dragOverId.value = null; return }
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
  reorderBars(arr.map(b => b.id))
  emit('reordered', arr)
  draggedId.value = null; dragOverId.value = null
}
function onBarDragEnd() { draggedId.value = null; dragOverId.value = null }

const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})
function channelForId(id) { return channelById.value.get(id) ?? null }
function channelNr(id) { return channelForId(id)?.channel ?? '?' }
function channelDevice(id) { return channelForId(id)?.device ?? '' }

function isPunktzug(bar) { return bar?.bar_type === 'punktzug' }

function goToChannel(channelId) {
  emit('navigate-to-channel', channelId)
}

// Bar Dialog
const barDialogOpen = ref(false)
const editingBar = ref(null)
const barForm = ref({ name: '', zug_nr: '', length_cm: 1100, hide_scale: false, bar_type: 'zugstange' })
// Anzeige-Wert für length-Input (in gewählter Einheit)
const barFormDisplay = computed({
  get: () => ({ length: cmToDisplay(barForm.value.length_cm) }),
  set: (v) => { barForm.value.length_cm = parseToCm(v.length) },
})

function openNewBarDialog() {
  editingBar.value = null
  barForm.value = { name: '', zug_nr: '', length_cm: 1100, bar_type: typeFilter.value !== 'all' ? typeFilter.value : 'zugstange' }
  barDialogOpen.value = true
}
function openEditBarDialog(bar) {
  editingBar.value = bar
  barForm.value = { name: bar.name, zug_nr: bar.zug_nr, length_cm: bar.length_cm, hide_scale: bar.hide_scale ?? false, bar_type: bar.bar_type || 'zugstange' }
  barDialogOpen.value = true
}
async function saveBarForm() {
  if (!barForm.value.name) return
  if (editingBar.value) {
    await saveBar(editingBar.value.id, { ...barForm.value, height_cm: editingBar.value.height_cm ?? null, notes: editingBar.value.notes ?? '' })
    editingBar.value.hide_scale = barForm.value.hide_scale
    editingBar.value.bar_type = barForm.value.bar_type
  } else {
    await addBar({ ...barForm.value })
  }
  barDialogOpen.value = false
}
const removeConfirmOpen = ref(false)
const removeConfirmText = ref('')
const removePending = ref(null)

function confirmRemoveFixture(fx, bar) {
  const nr = channelNr(fx.channel_id)
  const dev = channelDevice(fx.channel_id)
  const fixture = nr !== '?' ? `Kanal ${nr}${dev ? ' · ' + dev : ''}` : fx.id
  removeConfirmText.value = t('zugstange.fixture.remove.confirm', { fixture, bar: bar.name })
  removePending.value = { barId: bar.id, fixtureId: fx.id }
  removeConfirmOpen.value = true
}

function doRemoveFixture() {
  if (!removePending.value) return
  unassignFixture(removePending.value.barId, removePending.value.fixtureId)
  removeConfirmOpen.value = false
  removePending.value = null
}

async function saveInlineField(bar, field, value) {
  await saveBar(bar.id, { name: bar.name, zug_nr: bar.zug_nr, length_cm: bar.length_cm, height_cm: bar.height_cm, notes: bar.notes, hide_scale: bar.hide_scale ?? false, bar_type: bar.bar_type || 'zugstange', [field]: value })
  bar[field] = value
}



async function confirmDeleteBar(bar) {
  const ok = await confirm({ t, titleKey: 'zugstange.delete.confirm', titleParams: { name: bar.name }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (ok) removeBar(bar.id)
}

// Fixture Edit Dialog
const fixtureEditOpen = ref(false)
const fixtureEditFx = ref(null)
const fixtureEditBar = ref(null)
const fixtureEditNotes = ref('')

function openFixtureEditDialog(fx, bar) {
  fixtureEditFx.value = fx
  fixtureEditBar.value = bar
  fixtureEditNotes.value = fx.notes ?? ''
  fixtureEditOpen.value = true
}

async function saveFixtureEdit() {
  if (!fixtureEditFx.value || !fixtureEditBar.value) return
  await updateFixtureNotes(fixtureEditBar.value.id, fixtureEditFx.value.id, fixtureEditNotes.value)
  fixtureEditFx.value.notes = fixtureEditNotes.value
  fixtureEditOpen.value = false
}

// Fixture Picker
const fixturePickerOpen = ref(false)
const pickerChannel = ref(null)
const pickerPosition = ref(0)
const pickerBar = ref(null)
const pickerSide = ref('out')

function onBarPositionPick(bar, position, side = 'out') {
  pickerBar.value = bar
  pickerChannel.value = null
  pickerPosition.value = position
  pickerSide.value = side
  fixturePickerOpen.value = true
}

function onPunktzugAddClick(bar) {
  pickerBar.value = bar
  pickerChannel.value = null
  pickerPosition.value = 0
  pickerSide.value = 'out'
  fixturePickerOpen.value = true
}

async function confirmAddFixture() {
  if (!pickerChannel.value || !pickerBar.value) return
  const qty = Math.max(1, pickerChannel.value.quantity ?? 1)
  const spacing = qty > 1 ? 30 : 0
  const startPos = pickerPosition.value - ((qty - 1) * spacing) / 2
  for (let i = 0; i < qty; i++) {
    const pos = Math.round((startPos + i * spacing) / 10) * 10
    const half = (pickerBar.value.length_cm ?? 600) / 2
    await assignFixture(pickerBar.value.id, pickerChannel.value.id, Math.max(-half, Math.min(half, pos)), undefined, pickerSide.value)
  }
  fixturePickerOpen.value = false
  pickerChannel.value = null
  emit('assigned')
}

async function savePunktzugPositionText(bar, value) {
  const fx = bar.fixtures[0]
  if (!fx) return
  await assignFixture(bar.id, fx.channel_id, 0, fx.id, fx.side || 'out', value)
  fx.position_text = value
}

async function onFixtureDragEnd(bar, fx) {
  await assignFixture(bar.id, fx.channel_id, fx.position, fx.id, fx.side || 'out', fx.position_text)
}
</script>

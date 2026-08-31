<template>
  <div ref="rootEl" class="h-full overflow-x-auto overflow-y-auto bg-card channel-list" style="scrollbar-width: thin;">
    <div class="min-w-230">
    <div class="sticky top-0 z-20 border-b border-border/90 bg-muted shadow-[0_1px_0_rgba(255,255,255,0.04),0_4px_8px_rgba(0,0,0,0.10)]">
      <div v-if="!isMobile" class="grid min-h-8 grid-cols-[2rem_6rem_5rem_7rem_6rem_minmax(14rem,22%)_1fr_7rem_2.5rem] items-center border-b border-border/60 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/90">
        <div></div>
        <div class="px-3 flex items-center gap-1">{{ labels.channel }}<HelpIcon v-if="labels.channelHelp" :text="labels.channelHelp" /></div>
        <div class="px-3 flex items-center gap-1">{{ labels.dmx }}</div>
        <div class="px-3 flex items-center gap-1">{{ labels.color }}<HelpIcon v-if="labels.colorHelp" :text="labels.colorHelp" /></div>
        <div class="px-3 flex items-center gap-1">{{ labels.quantity }}<HelpIcon v-if="labels.quantityHelp" :text="labels.quantityHelp" /></div>
        <div class="px-3 flex items-center gap-1">{{ labels.device }}<HelpIcon v-if="labels.deviceHelp" :text="labels.deviceHelp" /></div>
        <div class="px-3 flex items-center gap-1">{{ labels.notes }}<HelpIcon v-if="labels.notesHelp" :text="labels.notesHelp" /></div>
        <div class="px-3 flex items-center gap-1">{{ labels.assign }}<HelpIcon v-if="labels.assignHelp" :text="labels.assignHelp" /></div>
        <div></div>
      </div>
    </div>

    <div ref="sortableEl" class="bg-card">
      <template v-for="item of virtualItems" :key="item.id">
        <template v-if="item.type === 'header'">
          <!-- Header row (group position) -->
          <div
            class="bg-white/8"
            data-no-drag
            :data-pos="item.group.position"
          >
          <div v-if="isMobile" class="flex items-center gap-3 px-3 py-1">
            <template v-if="editingPosition === item.group.position">
              <Input
                v-model="editingPositionValue"
                autofocus
                @blur="savePosition"
                @keydown.enter="savePosition"
                @keydown.escape="editingPosition = null"
                class="mx-auto h-6 w-48 rounded-none border-0 border-b border-primary/30 bg-transparent px-0 text-center text-[13px] font-medium text-foreground shadow-none focus-visible:ring-0"
              />
            </template>
            <template v-else>
              <div class="h-px flex-1 bg-foreground/15"></div>
              <Button
                variant="ghost"
                size="sm"
                class="h-auto shrink-0 rounded-sm px-2 text-center text-[13px] font-medium normal-case tracking-normal text-foreground hover:bg-accent hover:text-accent-foreground"
                :title="labels.editPosition"
                @click="startEditPosition(item.group.position)"
              >{{ item.group.position || labels.noPosition }}</Button>
              <div class="h-px flex-1 bg-foreground/15"></div>
            </template>
          </div>
          <div v-else class="flex items-center gap-3 px-4 py-1">
            <template v-if="editingPosition === item.group.position">
              <Input
                v-model="editingPositionValue"
                autofocus
                @blur="savePosition"
                @keydown.enter="savePosition"
                @keydown.escape="editingPosition = null"
                class="mx-auto h-6 w-48 rounded-none border-0 border-b border-primary/30 bg-transparent px-0 text-center text-[13px] font-medium text-foreground shadow-none focus-visible:ring-0"
              />
            </template>
            <template v-else>
              <div class="h-px flex-1 bg-foreground/15"></div>
              <Button
                variant="ghost"
                size="sm"
                class="h-auto shrink-0 rounded-sm px-2 text-center text-[13px] font-medium normal-case tracking-normal text-foreground hover:bg-accent hover:text-accent-foreground"
                :title="labels.editPosition"
                @click="startEditPosition(item.group.position)"
              >{{ item.group.position || labels.noPosition }}</Button>
              <div class="h-px flex-1 bg-foreground/15"></div>
            </template>
          </div>
        </div>
        </template>

        <template v-else-if="item.type === 'channel'">
          <!-- Channel row -->
          <ChannelRow
            :ch="item.ch"
            :rowIndex="item.rowIndex"
            :dupChannelNrs="dupChannelNrs"
            :channelStatus="channelStatus(item.ch)"
            :colorPlaceholder="labels.color"
            :deleteTitle="labels.delete"
            :onKeydownFn="onKeydownFn"
            :flushChannelsSave="flushChannelsSave"
            :onAddRow="() => startAdd(item.group.position)"
            :isMobileProp="isMobile"
            @change="emit('change')"
            @toggleStatus="toggleChannelStatus(item.ch)"
            @delete="emit('deleteChannel', item.ch)"
            @clear="emit('clearChannel', item.ch)"
            @insertAfter="insertAfter(item.ch)"
            @placeInFloorplan="emit('placeInFloorplan', item.ch)"
            @assignTower="emit('assignTower', item.ch)"
            @assignBar="emit('assignBar', item.ch)"
          />
        </template>

        <template v-else-if="item.type === 'add-btn'">
          <!-- Add button row -->
          <div
            class="border-t border-border/60 bg-card px-3 py-1.5 flex items-center justify-between"
            data-no-drag
          >
            <Button
              variant="ghost"
              size="sm"
              class="h-7 rounded-sm px-2 text-[11px] text-muted-foreground hover:text-accent-foreground"
              data-testid="channel-add-btn"
              @click="startAdd(item.group.position)"
            >+ {{ labels.add }}</Button>
            <template v-if="item.isLast">
              <Button
                variant="ghost"
                size="sm"
                class="h-7 rounded-sm px-2 text-[11px] text-muted-foreground hover:text-accent-foreground"
                @click="startAddPosition"
              >+ {{ labels.addPosition }}</Button>
            </template>
          </div>
        </template>

        <template v-else-if="item.type === 'add-form'">
          <!-- Add form row -->
          <div
            class="border-t border-border/60 bg-card px-3 py-1.5"
            data-no-drag
            @keydown.escape="cancelAdd"
            @keydown.enter.prevent="saveAdd"
          >
          <!-- Mobile add form -->
          <div v-if="isMobile" class="flex flex-col gap-1.5">
            <div class="flex items-center gap-1.5">
              <Input
                data-channel-nr-input
                v-model="addForm.channel"
                :placeholder="labels.channelNr"
                class="h-8 w-[5.5ch] border-0 bg-transparent px-1 py-0 text-center font-mono text-base font-semibold leading-none text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/20 focus-visible:ring-0"
              />
              <span class="select-none font-mono text-sm text-muted-foreground/50">/</span>
              <Input
                v-model="addForm.address"
                :placeholder="labels.addressExample"
                class="h-8 w-[8ch] border-0 bg-transparent px-1 py-0 text-center text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/20 focus-visible:ring-0"
              />
              <div class="flex-1">
                <ColorAutocomplete v-model="addForm.color" @change="() => {}" :placeholder="labels.color" />
              </div>
            </div>
            <div class="flex gap-1.5">
              <Textarea
                v-model="addForm.device"
                rows="1"
                :placeholder="labels.device"
                class="h-8 min-h-8 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-none text-foreground shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/10 focus-visible:bg-muted/20 focus-visible:outline-none focus-visible:ring-0"
              />
              <Textarea
                v-model="addForm.notes"
                rows="1"
                :placeholder="labels.notes"
                class="h-8 min-h-8 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-none text-foreground shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/10 focus-visible:bg-muted/20 focus-visible:outline-none focus-visible:ring-0"
              />
            </div>
          </div>
          <!-- Desktop add form -->
          <div v-else class="grid grid-cols-[2rem_6rem_5rem_7rem_6rem_minmax(14rem,22%)_minmax(16rem,1fr)_4.5rem] items-center gap-0">
            <div></div>
            <div class="px-3">
              <Input
                data-channel-nr-input
                data-testid="channel-add-nr-input"
                v-model="addForm.channel"
                :placeholder="labels.channelNr"
                class="h-7 w-[5.5ch] border-0 bg-transparent px-1 py-0 text-center font-mono text-base font-semibold leading-none text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/20 focus-visible:ring-0"
              />
            </div>
            <div class="px-3">
              <Input
                v-model="addForm.address"
                :placeholder="labels.addressExample"
                class="h-7 w-[8ch] border-0 bg-transparent px-1 py-0 text-center text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:bg-muted/20 focus-visible:ring-0"
              />
            </div>
            <div class="px-2">
              <ColorAutocomplete v-model="addForm.color" @change="() => {}" :placeholder="labels.color" />
            </div>
            <div class="px-2">
              <input
                type="number"
                min="1"
                max="99"
                v-model.number="addForm.quantity"
                class="h-8 w-full rounded border border-border/40 bg-transparent px-2 py-0 text-center text-sm text-foreground shadow-none focus-visible:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div class="px-2">
              <Textarea
                v-model="addForm.device"
                rows="1"
                class="h-8 min-h-8 w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-none text-foreground shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/10 focus-visible:bg-muted/20 focus-visible:outline-none focus-visible:ring-0"
              />
            </div>
            <div class="px-2">
              <Textarea
                v-model="addForm.notes"
                rows="1"
                class="h-8 min-h-8 w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-none text-foreground shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/10 focus-visible:bg-muted/20 focus-visible:outline-none focus-visible:ring-0"
              />
            </div>
            <div class="flex items-center justify-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                class="size-8 rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                :title="labels.cancel"
                @click="cancelAdd"
              ><X class="size-4" /></Button>
              <Button
                size="icon"
                variant="ghost"
                data-testid="channel-add-save"
                class="size-8 rounded-sm text-green-500 hover:bg-green-500/10 hover:text-green-600"
                @click="saveAdd"
              ><Check class="size-4" /></Button>
            </div>
          </div>
          </div>
        </template>

        <template v-else-if="item.type === 'empty'">
          <!-- Empty state -->
          <div
            class="px-4 py-10"
            data-no-drag
          >
            <div class="flex flex-col items-center gap-3 rounded-md border border-dashed border-border/60 bg-muted/5 px-6 py-8">
              <p class="text-sm text-muted-foreground">{{ labels.empty }}</p>
              <Button
                variant="ghost"
                size="sm"
                class="h-8 rounded-sm border border-border/50 px-3 text-muted-foreground hover:text-accent-foreground"
                data-testid="channel-add-btn"
                @click="startAdd('')"
              >+ {{ labels.add }}</Button>
            </div>
          </div>
        </template>
      </template>
      </div>
    </div>

    <Dialog :open="addingNewPosition" @update:open="val => { if (!val) addingNewPosition = false }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ labels.addPosition }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Input
            ref="newPositionInput"
            v-model="newPositionName"
            :placeholder="labels.positionNamePlaceholder"
            @keydown.enter="saveNewPosition"
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="addingNewPosition = false">{{ labels.cancel }}</Button>
          <Button :disabled="!newPositionName.trim()" @click="saveNewPosition">{{ labels.addAction }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useContainerWidth } from '@/composables/useContainerWidth'
import { Check, X } from 'lucide-vue-next'
import HelpIcon from '@/components/ui/HelpIcon.vue'
import Sortable from 'sortablejs'
import ChannelRow from './ChannelRow.vue'
import ColorAutocomplete from '../ColorAutocomplete.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'

const props = defineProps({
  channels: { type: Array, required: true },
  groupedChannels: { type: Array, required: true },
  dupChannelNrs: { type: Set, default: () => new Set() },
  channelStatusFn: { type: Function, required: true },
  toggleChannelStatusFn: { type: Function, required: true },
  onKeydownFn: { type: Function, default: null },
  flushChannelsSave: { type: Function, default: null },
  labels: { type: Object, required: true },
})

const rootEl = ref(null)
const sortableEl = ref(null)
const isMobile = useContainerWidth(rootEl)

const emit = defineEmits([
  'change',
  'deleteChannel',
  'clearChannel',
  'reorder',
  'placeInFloorplan',
  'assignTower',
  'assignBar',
])

let channelRowUid = 0
// ch.id ist die stabile Server-ID — nach einem kompletten Refetch (z.B. Undo/
// Redo, SSE-Reload) sind es zwar neue JS-Objekte, aber mit derselben id. Die
// bevorzugen, sonst bekäme jede Zeile einen neuen Vue-Key und würde komplett
// neu gemountet statt gepatcht (bei 100+ Zeilen spürbar langsam). Nur neu
// angelegte, noch nicht gespeicherte Kanäle haben keine id — dafür bleibt der
// zufällige Fallback nötig, damit sie überhaupt einen Key bekommen.
function ensureStableChannelKey(ch) {
  if (!ch) return ''
  if (ch.id) return ch.id
  if (!Object.prototype.hasOwnProperty.call(ch, '__rowKey')) {
    Object.defineProperty(ch, '__rowKey', {
      value: `row-${channelRowUid++}`,
      enumerable: false,
      configurable: true,
      writable: false,
    })
  }
  return ch.__rowKey
}

// ── Add form ───────────────────────────────────────────────────────────────
const addingPosition = ref(null)
const addForm = ref({})

// ── Add position ───────────────────────────────────────────────────────────
// Nicht mit addingPosition oben verwechseln: das hält die Position, zu der
// gerade ein Kanal angelegt wird. Hier geht es um eine neue, noch leere Position.
const addingNewPosition = ref(false)
const newPositionName = ref('')
const newPositionInput = ref(null)

function startAddPosition() {
  addingNewPosition.value = true
  newPositionName.value = ''
  nextTick(() => newPositionInput.value?.$el?.querySelector('input')?.focus())
}

const emptyPositions = ref([])

function saveNewPosition() {
  const name = newPositionName.value.trim()
  if (name) {
    const alreadyExists = props.groupedChannels.some(g => g.position === name) || emptyPositions.value.includes(name)
    if (!alreadyExists) emptyPositions.value.push(name)
  }
  addingNewPosition.value = false
}

// ── Chunked rendering ──────────────────────────────────────────────────────
const INITIAL_BATCH = 20
const BATCH_SIZE = 30
const renderedCount = ref(INITIAL_BATCH)

function scheduleRemainingBatches(total) {
  if (renderedCount.value >= total) return
  requestAnimationFrame(() => {
    renderedCount.value = Math.min(renderedCount.value + BATCH_SIZE, total)
    scheduleRemainingBatches(total)
  })
}

onMounted(() => {
  const total = props.groupedChannels.reduce((n, g) => n + g.channels.length, 0)
  scheduleRemainingBatches(total)
  nextTick(initSortable)
})

watch(() => props.groupedChannels, (groups) => {
  const total = groups.reduce((n, g) => n + g.channels.length, 0)
  if (renderedCount.value < total) scheduleRemainingBatches(total)
}, { deep: false })

// ── Flat list for virtual scrolling ───────────────────────────────────────
const virtualItems = computed(() => {
  const items = []
  if (props.groupedChannels.length === 0) {
    if (addingPosition.value === '') {
      items.push({ id: 'add-form-empty', type: 'add-form', group: { position: '' } })
    } else {
      items.push({ id: 'empty', type: 'empty' })
    }
    return items
  }
  let channelsSeen = 0
  const limit = renderedCount.value
  const allGroups = [
    ...props.groupedChannels,
    ...emptyPositions.value
      .filter(p => !props.groupedChannels.some(g => g.position === p))
      .map(p => ({ position: p, channels: [] })),
  ]
  for (const group of allGroups) {
    items.push({ id: `header-${group.position}`, type: 'header', group })
    for (const ch of group.channels) {
      if (channelsSeen < limit) {
        items.push({ id: ensureStableChannelKey(ch), type: 'channel', ch, group, rowIndex: channelsSeen })
      }
      channelsSeen++
    }
    const isLast = group === allGroups[allGroups.length - 1]
    if (addingPosition.value === group.position) {
      items.push({ id: `add-form-${group.position}`, type: 'add-form', group })
    } else {
      items.push({ id: `add-btn-${group.position}`, type: 'add-btn', group, isLast })
    }
  }
  return items
})

function channelStatus(ch) {
  return props.channelStatusFn(ch)
}

function toggleChannelStatus(ch) {
  props.toggleChannelStatusFn(ch)
}

// ── Position editing ───────────────────────────────────────────────────────
const editingPosition = ref(null)
const editingPositionValue = ref('')

function startEditPosition(position) {
  editingPosition.value = position
  editingPositionValue.value = position ?? ''
}

function savePosition() {
  const oldPos = editingPosition.value
  const newPos = editingPositionValue.value.trim()
  if (newPos !== oldPos) {
    for (const ch of props.channels) {
      if (ch.position === oldPos) ch.position = newPos
    }
    emit('change')
  }
  editingPosition.value = null
}

// ── Add channel ────────────────────────────────────────────────────────────
function startAdd(position) {
  addingPosition.value = position
  addForm.value = { channel: '', address: '', device: '', position, color: '', notes: '', quantity: 1 }
  nextTick(() => {
    rootEl.value?.querySelector('[data-channel-nr-input]')?.focus()
  })
}

function cancelAdd() {
  addingPosition.value = null
}

function saveAdd() {
  if (!addForm.value.channel) return
  const newCh = { ...addForm.value, color: addForm.value.color.trim() || 'NC' }
  ensureStableChannelKey(newCh)
  const newNr = parseInt(newCh.channel)
  const idx = props.channels.findIndex(c => parseInt(c.channel) > newNr)
  if (idx === -1) props.channels.push(newCh)
  else props.channels.splice(idx, 0, newCh)
  const pos = addForm.value.position
  emptyPositions.value = emptyPositions.value.filter(p => p !== pos)
  addingPosition.value = null
  emit('change')
}

// ── Insert after (context menu) ────────────────────────────────────────────
function insertAfter(ch) {
  const idx = props.channels.findIndex(c => c === ch)
  const newCh = { channel: '', address: '', device: '', position: ch.position, color: '', notes: '' }
  ensureStableChannelKey(newCh)
  if (idx === -1) props.channels.push(newCh)
  else props.channels.splice(idx + 1, 0, newCh)
  emit('change')
}

// ── SortableJS ─────────────────────────────────────────────────────────────
let sortableInstance = null

function initSortable() {
  sortableInstance?.destroy()
  sortableInstance = null
  const el = sortableEl.value
  if (!el) return

  sortableInstance = Sortable.create(el, {
    handle: '.drag-handle',
    filter: '[data-no-drag]',
    preventOnFilter: false,
    animation: 150,
    onEnd() {
      const keyToChannel = new Map(props.channels.map(c => [ensureStableChannelKey(c), c]))
      const reordered = []
      let currentPos = ''
      for (const child of el.children) {
        if (child.hasAttribute('data-no-drag') && child.dataset.pos) {
          currentPos = child.dataset.pos
        }
        const key = child.dataset.chKey
        if (key && keyToChannel.has(key)) {
          const ch = keyToChannel.get(key)
          ch.position = currentPos
          reordered.push(ch)
          keyToChannel.delete(key)
        }
      }
      for (const ch of props.channels) {
        if (keyToChannel.has(ensureStableChannelKey(ch))) {
          reordered.push(ch)
        }
      }
      if (reordered.length === props.channels.length) {
        emit('reorder', reordered)
      }
      emit('change')
    },
  })
}

watch(() => props.channels.length, () => {
  nextTick(initSortable)
})

onBeforeUnmount(() => { sortableInstance?.destroy() })
</script>

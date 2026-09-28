<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-3 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-3 scale-95"
    >
      <div
        v-if="selectedKeys.size > 0"
        class="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 no-print"
      >
        <div class="flex items-center gap-1 rounded-full border border-border bg-popover px-2 py-1.5 text-popover-foreground shadow-[0_12px_36px_-6px_rgba(0,0,0,0.6)] ring-1 ring-black/10">
          <span class="shrink-0 whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            {{ t('channel.bulk.selected_count', { count: selectedKeys.size }) }}
          </span>

          <div class="mx-0.5 h-6 w-px shrink-0 bg-border/60"></div>

          <!-- Notiz -->
          <DropdownMenu v-model:open="notesOpen">
            <DropdownMenuTrigger as-child>
              <button type="button" :class="actionBtnClass" :title="t('channel.bulk.notes_action')">
                <NotebookPen class="size-4" />
                <span class="hidden sm:inline">{{ t('channel.bulk.notes_action') }}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" :sideOffset="14" :class="popoverClass + ' w-84'">
              <fieldset :class="notchFieldsetClass">
                <legend :class="notchLegendClass">{{ t('channel.bulk.notes_action') }}</legend>
                <textarea
                  v-model="bulkNotes"
                  rows="2"
                  :class="notchInputClass + ' resize-none'"
                  autofocus
                />
              </fieldset>
              <div class="mt-3 flex items-center justify-end gap-3">
                <button type="button" :class="linkBtnClass" :disabled="!bulkNotes" @click="submitNotes(true)">{{ t('channel.bulk.notes_append') }}</button>
                <button type="button" :class="primaryBtnClass" :disabled="!bulkNotes" @click="submitNotes(false)">{{ t('channel.bulk.notes_replace') }}</button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Gerät -->
          <DropdownMenu v-model:open="deviceOpen">
            <DropdownMenuTrigger as-child>
              <button type="button" :class="actionBtnClass" :title="t('channel.bulk.device_action')">
                <Lightbulb class="size-4" />
                <span class="hidden sm:inline">{{ t('channel.bulk.device_action') }}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" :sideOffset="10" :class="popoverClass + ' w-64 p-1.5'">
              <input
                v-model="bulkDevice"
                type="text"
                :placeholder="t('channel.bulk.device_action')"
                class="w-full rounded-lg border-0 bg-muted/50 px-2.5 py-1.5 text-sm text-foreground shadow-none placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                autocomplete="off"
                autofocus
                @keydown.enter="submitDevice"
              />
              <ul v-if="filteredDevices.length" class="mt-1 max-h-40 overflow-y-auto">
                <li
                  v-for="d in filteredDevices"
                  :key="d"
                  class="cursor-pointer truncate rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-muted"
                  @mousedown.prevent="() => { bulkDevice = d; submitDevice() }"
                >{{ d }}</li>
              </ul>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Bühnenposition -->
          <DropdownMenu v-model:open="positionOpen">
            <DropdownMenuTrigger as-child>
              <button type="button" :class="actionBtnClass" :title="t('channel.bulk.position_action')">
                <MapPin class="size-4" />
                <span class="hidden sm:inline">{{ t('channel.bulk.position_action') }}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" :sideOffset="10" :class="popoverClass + ' w-64 p-1.5'">
              <input
                v-model="bulkPosition"
                type="text"
                :placeholder="t('channel.bulk.position_action')"
                class="w-full rounded-lg border-0 bg-muted/50 px-2.5 py-1.5 text-sm text-foreground shadow-none placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                autocomplete="off"
                autofocus
                @keydown.enter="submitPosition"
              />
              <ul v-if="filteredPositions.length" class="mt-1 max-h-40 overflow-y-auto">
                <li
                  v-for="p in filteredPositions"
                  :key="p"
                  class="cursor-pointer truncate rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-muted"
                  @mousedown.prevent="() => { bulkPosition = p; submitPosition() }"
                >{{ p }}</li>
              </ul>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Farbe -->
          <DropdownMenu v-model:open="colorOpen">
            <DropdownMenuTrigger as-child>
              <button type="button" :class="actionBtnClass" :title="t('channel.bulk.color_action')">
                <Palette class="size-4" />
                <span class="hidden sm:inline">{{ t('channel.bulk.color_action') }}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" :sideOffset="10" :class="popoverClass + ' w-64 p-1.5'">
              <input
                v-model="bulkColor"
                type="text"
                :placeholder="t('channel.bulk.color_action')"
                class="w-full rounded-lg border-0 bg-muted/50 px-2.5 py-1.5 text-sm text-foreground shadow-none placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                autocomplete="off"
                autofocus
                @keydown.enter="submitColor(bulkColor)"
              />
              <ul v-if="filteredColors.length" class="mt-1 max-h-56 overflow-y-auto">
                <li
                  v-for="f in filteredColors"
                  :key="f.code"
                  class="flex cursor-pointer items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-sm hover:bg-muted"
                  @mousedown.prevent="submitColor(f.code)"
                >
                  <span class="size-3.5 shrink-0 rounded-full border border-border/50" :style="f.hex ? { backgroundColor: f.hex } : { backgroundColor: '#555' }" />
                  <span class="font-mono text-xs text-foreground">{{ f.displayCode }}</span>
                  <span class="truncate text-xs text-muted-foreground">{{ f.name }}</span>
                </li>
              </ul>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Prio -->
          <DropdownMenu v-model:open="prioOpen">
            <DropdownMenuTrigger as-child>
              <button type="button" :class="actionBtnClass" :title="t('channel.bulk.prio_action')">
                <ListOrdered class="size-4" />
                <span class="hidden sm:inline">{{ t('channel.bulk.prio_action') }}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" :sideOffset="10" :class="popoverClass + ' w-64 p-1.5'">
              <input
                v-model="bulkPrio"
                type="text"
                :placeholder="t('channel.bulk.prio_action')"
                class="w-full rounded-lg border-0 bg-muted/50 px-2.5 py-1.5 text-sm text-foreground shadow-none placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                autocomplete="off"
                autofocus
                @keydown.enter="submitPrio(bulkPrio)"
              />
              <ul v-if="filteredPrios.length" class="mt-1 max-h-40 overflow-y-auto">
                <li
                  v-for="p in filteredPrios"
                  :key="p"
                  class="cursor-pointer truncate rounded-md px-2.5 py-1.5 text-sm text-foreground hover:bg-muted"
                  @mousedown.prevent="submitPrio(p)"
                >{{ p }}</li>
              </ul>
            </DropdownMenuContent>
          </DropdownMenu>

          <div class="mx-0.5 h-6 w-px shrink-0 bg-border/60"></div>

          <button type="button" :class="actionBtnClass" :title="t('channel.row.clear')" @click="clearDialogOpen = true">
            <Eraser class="size-4" />
          </button>
          <button type="button" :class="dangerBtnClass" :title="t('channel.row.delete_row')" @click="deleteDialogOpen = true">
            <Trash2 class="size-4" />
          </button>

          <div class="mx-0.5 h-6 w-px shrink-0 bg-border/60"></div>

          <button
            type="button"
            class="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            :title="t('channel.bulk.clear_selection')"
            @click="$emit('update:selectedKeys', new Set())"
          >
            <X class="size-4" />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>

  <AlertDialog :open="clearDialogOpen" @update:open="val => { if (!val) clearDialogOpen = false }">
    <AlertDialogContent accent="warning">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('channel.bulk.clear_confirm_title') }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t('channel.bulk.clear_confirm_desc', { count: selectedKeys.size }) }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="flex-col sm:flex-row gap-2">
        <AlertDialogCancel @click="clearDialogOpen = false">{{ t('action.cancel') }}</AlertDialogCancel>
        <AlertDialogAction @click="() => { clearDialogOpen = false; submitClear() }">{{ t('channel.row.clear') }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AlertDialog :open="deleteDialogOpen" @update:open="val => { if (!val) deleteDialogOpen = false }">
    <AlertDialogContent accent="destructive">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('channel.bulk.delete_confirm_title') }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t('channel.bulk.delete_confirm_desc', { count: selectedKeys.size }) }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="flex-col sm:flex-row gap-2">
        <AlertDialogCancel @click="deleteDialogOpen = false">{{ t('action.cancel') }}</AlertDialogCancel>
        <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="() => { deleteDialogOpen = false; submitDelete() }">{{ t('channel.row.delete_row') }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
import { NotebookPen, Lightbulb, Palette, ListOrdered, MapPin, Eraser, Trash2, X } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { ALL_FILTERS } from '@/utils/filterColors'

const props = defineProps({
  channels: { type: Array, required: true },
  selectedKeys: { type: Set, required: true },
  keyFn: { type: Function, required: true },
  flushChannelsSave: { type: Function, default: null },
  groupedChannels: { type: Array, default: () => [] },
})

const emit = defineEmits(['change', 'deleteChannel', 'clearChannel', 'update:selectedKeys'])

const { t } = useLocale()

const actionBtnClass = 'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-foreground/90 transition-colors hover:bg-muted data-[state=open]:bg-muted'
const dangerBtnClass = 'flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive'

const popoverClass = 'rounded-2xl border border-border bg-popover p-4 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] ring-1 ring-black/10'

// Notched-Label-Feld (Rand bricht für die Beschriftung auf) — natives
// <fieldset>/<legend>-Verhalten, kein CSS-Hack nötig.
const notchFieldsetClass = 'rounded-lg border border-border px-3 pb-2.5 transition-colors focus-within:border-primary/50'
const notchLegendClass = 'flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground'
const notchInputClass = 'w-full border-0 bg-transparent p-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-0'

const primaryBtnClass = 'h-8 shrink-0 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40'
const linkBtnClass = 'h-8 shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40'

const notesOpen = ref(false)
const deviceOpen = ref(false)
const positionOpen = ref(false)
const colorOpen = ref(false)
const prioOpen = ref(false)
const clearDialogOpen = ref(false)
const deleteDialogOpen = ref(false)

const bulkNotes = ref('')
const bulkDevice = ref('')
const bulkColor = ref('')
const bulkPrio = ref('')
const bulkPosition = ref('')

const existingSequenceOrders = computed(() => {
  const values = props.channels.map(c => (c.sequence_order ?? '').toString().trim()).filter(Boolean)
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
})

const existingPositions = computed(() => props.groupedChannels.map(g => g.position).filter(Boolean))
const filteredPositions = computed(() => {
  const q = bulkPosition.value.trim().toLowerCase()
  const all = existingPositions.value
  return q ? all.filter(p => p.toLowerCase().includes(q) && p.toLowerCase() !== q) : all
})

const filteredColors = computed(() => {
  const q = bulkColor.value.trim().toUpperCase()
  if (!q) return ALL_FILTERS
  return ALL_FILTERS.filter(f =>
    f.code.includes(q) ||
    (f.altCode && f.altCode.includes(q)) ||
    f.name.toUpperCase().includes(q)
  )
})

const existingDevices = computed(() => {
  const values = props.channels.map(c => (c.device ?? '').trim()).filter(Boolean)
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
})
const filteredDevices = computed(() => {
  const q = bulkDevice.value.trim().toLowerCase()
  const all = existingDevices.value
  return q ? all.filter(d => d.toLowerCase().includes(q) && d.toLowerCase() !== q) : all
})

const filteredPrios = computed(() => {
  const q = bulkPrio.value.trim().toLowerCase()
  const all = existingSequenceOrders.value
  return q ? all.filter(p => p.toLowerCase().includes(q) && p.toLowerCase() !== q) : all
})

function selectedChannels() {
  return props.channels.filter(c => props.selectedKeys.has(props.keyFn(c)))
}

function submitNotes(append) {
  const text = bulkNotes.value.trim()
  if (!text) return
  for (const ch of selectedChannels()) {
    if (append) {
      const existing = (ch.notes ?? '').trim()
      ch.notes = existing ? `${existing} ${text}` : text
    } else {
      ch.notes = text
    }
  }
  bulkNotes.value = ''
  notesOpen.value = false
  emit('change')
  props.flushChannelsSave?.()
}

function submitDevice() {
  const text = bulkDevice.value.trim()
  for (const ch of selectedChannels()) ch.device = text
  bulkDevice.value = ''
  deviceOpen.value = false
  emit('change')
  props.flushChannelsSave?.()
}

function submitPosition() {
  const text = bulkPosition.value.trim()
  for (const ch of selectedChannels()) ch.position = text
  bulkPosition.value = ''
  positionOpen.value = false
  emit('change')
  props.flushChannelsSave?.()
}

function submitColor(value) {
  const color = (value ?? '').trim().toUpperCase()
  if (!color) return
  for (const ch of selectedChannels()) ch.color = color
  bulkColor.value = ''
  colorOpen.value = false
  emit('change')
  props.flushChannelsSave?.()
}

function submitPrio(value) {
  const prio = (value ?? '').trim()
  for (const ch of selectedChannels()) ch.sequence_order = prio
  bulkPrio.value = ''
  prioOpen.value = false
  emit('change')
  props.flushChannelsSave?.()
}

function submitClear() {
  for (const ch of selectedChannels()) emit('clearChannel', ch)
  emit('update:selectedKeys', new Set())
}

function submitDelete() {
  for (const ch of selectedChannels()) emit('deleteChannel', ch)
  emit('update:selectedKeys', new Set())
}
</script>

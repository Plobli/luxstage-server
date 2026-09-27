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
        <div class="flex items-center gap-1 rounded-full border border-border/60 bg-popover/95 px-2 py-1.5 text-popover-foreground shadow-2xl backdrop-blur-md">
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
            <DropdownMenuContent align="center" side="top" :sideOffset="14" :class="popoverClass + ' w-72'">
              <fieldset :class="notchFieldsetClass">
                <legend :class="notchLegendClass">{{ t('channel.bulk.device_action') }}</legend>
                <input
                  v-model="bulkDevice"
                  type="text"
                  :class="notchInputClass"
                  autofocus
                  @keydown.enter="submitDevice"
                />
              </fieldset>
              <div class="mt-3 flex justify-end">
                <button type="button" :class="primaryBtnClass" :disabled="!bulkDevice" @click="submitDevice">{{ t('channel.bulk.device_apply') }}</button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Farbe: direkt eingebettet, Klick öffnet sofort das Farb-Dropdown -->
          <div class="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 transition-colors hover:bg-muted" :title="t('channel.bulk.color_action')">
            <Palette class="size-4 shrink-0 text-foreground/90" />
            <div class="bulk-color-field flex h-8 w-24 shrink-0 items-center">
              <ColorAutocomplete v-model="bulkColor" :placeholder="t('channel.bulk.color_action')" @update:modelValue="submitColor" />
            </div>
          </div>

          <!-- Prio: direkt eingebettet, Klick öffnet sofort das Prio-Dropdown -->
          <div class="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 transition-colors hover:bg-muted" :title="t('channel.bulk.prio_action')">
            <ListOrdered class="size-4 shrink-0 text-foreground/90" />
            <div class="bulk-prio-field flex h-8 w-16 shrink-0 items-center">
              <PrioAutocomplete
                v-model="bulkPrio"
                :existingValues="existingSequenceOrders"
                :placeholder="t('channel.bulk.prio_action')"
                @update:modelValue="submitPrio"
              />
            </div>
          </div>

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
    <AlertDialogContent>
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
    <AlertDialogContent>
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
import { NotebookPen, Lightbulb, Palette, ListOrdered, Eraser, Trash2, X } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import ColorAutocomplete from '../ColorAutocomplete.vue'
import PrioAutocomplete from './PrioAutocomplete.vue'

const props = defineProps({
  channels: { type: Array, required: true },
  selectedKeys: { type: Set, required: true },
  keyFn: { type: Function, required: true },
  flushChannelsSave: { type: Function, default: null },
})

const emit = defineEmits(['change', 'deleteChannel', 'clearChannel', 'update:selectedKeys'])

const { t } = useLocale()

const actionBtnClass = 'flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-foreground/90 transition-colors hover:bg-muted data-[state=open]:bg-muted'
const dangerBtnClass = 'flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive'

const popoverClass = 'rounded-2xl border border-border/50 bg-popover/98 p-4 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.45)] backdrop-blur-xl'
const plainLabelClass = 'mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground'

// Notched-Label-Feld (Rand bricht für die Beschriftung auf) — natives
// <fieldset>/<legend>-Verhalten, kein CSS-Hack nötig.
const notchFieldsetClass = 'rounded-lg border border-border/50 px-3 pb-2.5 transition-colors focus-within:border-primary/50'
const notchLegendClass = 'flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground'
const notchInputClass = 'w-full border-0 bg-transparent p-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-0'

const primaryBtnClass = 'h-8 shrink-0 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40'
const linkBtnClass = 'h-8 shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40'

const notesOpen = ref(false)
const deviceOpen = ref(false)
const clearDialogOpen = ref(false)
const deleteDialogOpen = ref(false)

const bulkNotes = ref('')
const bulkDevice = ref('')
const bulkColor = ref('')
const bulkPrio = ref('')

const existingSequenceOrders = computed(() => {
  const values = props.channels.map(c => (c.sequence_order ?? '').toString().trim()).filter(Boolean)
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
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
  if (!text) return
  for (const ch of selectedChannels()) ch.device = text
  bulkDevice.value = ''
  deviceOpen.value = false
  emit('change')
  props.flushChannelsSave?.()
}

function submitColor(value) {
  const color = (value ?? '').trim()
  if (!color) return
  for (const ch of selectedChannels()) ch.color = color
  emit('change')
}

function submitPrio(value) {
  const prio = (value ?? '').trim()
  if (!prio) return
  for (const ch of selectedChannels()) ch.sequence_order = prio
  emit('change')
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

<style scoped>
/* Farb-/Prio-Feld auf die Button-Höhe der Bar bringen und die Schrift an
   die anderen Aktions-Labels (text-xs) angleichen — die Autocomplete-
   Komponenten sind für die volle Kreisliste dimensioniert, hier sitzen sie
   aber in einer kompakten Pille. */
.bulk-color-field :deep(> div),
.bulk-prio-field :deep(> div) {
  min-height: 0 !important;
  height: 100% !important;
}
.bulk-color-field :deep(input),
.bulk-prio-field :deep(input) {
  font-size: 0.75rem !important;
  line-height: 1rem !important;
}
</style>

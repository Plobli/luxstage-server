<template>
  <div
        :data-ch-key="stableRowKey"
        :data-ch-nr="ch.channel"
        :data-ch-pos="ch.position"
        :data-nav-row="rowIndex"
        :class="isMobile
          ? `border-t border-border/60 ${rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/40'}`
          : 'group/row grid border-t border-border/60 bg-card transition-colors'
              + ' grid-cols-[2rem_6rem_5rem_7rem_6rem_minmax(14rem,22%)_1fr_7rem_2.5rem] items-center'"
      >
        <!-- Desktop: Drag handle -->
        <div v-if="!isMobile" class="flex py-0 pl-1 pr-0 align-middle">
          <div class="drag-handle no-print flex size-6 cursor-grab items-center justify-center rounded-sm text-muted-foreground/70 opacity-0 transition-all active:cursor-grabbing group-hover/row:opacity-100 hover:bg-muted/40">
            <GripVertical class="size-3.5" />
          </div>
        </div>

        <!-- Desktop: Kanal -->
        <div v-if="!isMobile" class="py-0 pr-0 pl-0 align-middle border-l border-border/40 h-full flex items-center">
          <Input
            v-model="ch.channel"
            @input="emit('change')"
            @blur="onChannelBlur"
            :data-nav-row="rowIndex"
            data-nav-col="0"
            @keydown="onKeydownCol0"
            @click.stop="emit('toggleStatus', ch)"
            :title="ch.channel ? 'Status' : ''"
            :class="[dupChannelNrs.has(ch.channel) ? 'ring-1 ring-yellow-400/60' : '', channelStatusClass]"
            class="h-full min-h-14 w-full self-stretch cursor-text rounded-none border-0 bg-transparent px-1 py-0 text-center font-mono text-xl font-semibold shadow-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
        </div>

        <!-- Desktop: DMX-Adresse -->
        <div v-if="!isMobile" class="py-0 pr-0 pl-0 align-middle border-l border-border/40 h-full flex items-center">
          <Input
            v-model="ch.address"
            @input="emit('change')"
            @blur="onAddressBlur"
            @click.stop
            class="h-full min-h-14 w-full self-stretch rounded-none border-0 bg-transparent px-1 py-0 text-center text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
        </div>

        <!-- Desktop: Farbe -->
        <div v-if="!isMobile" class="px-0 py-0 align-middle border-l border-border/40 h-full flex items-center">
          <ColorAutocomplete
            :modelValue="ch.color"
            @update:modelValue="ch.color = $event; emit('change')"
            :placeholder="colorPlaceholder"
            :inputAttrs="{ 'data-nav-row': rowIndex, 'data-nav-col': 1 }"
            @keydown="onKeydownCol1"
          />
        </div>

        <!-- Desktop: Anzahl -->
        <div
          v-if="!isMobile"
          class="px-1 py-0 align-middle border-l border-border/40 h-full flex items-center justify-center transition-colors duration-300"
          :class="quantityFlash ? 'bg-green-500/20' : ''"
        >
          <QuantitySelect
            :modelValue="ch.quantity ?? 1"
            @update:modelValue="ch.quantity = $event; emit('change')"
          />
        </div>

        <!-- Desktop: Gerät -->
        <div v-if="!isMobile" class="px-0 py-0 align-middle border-l border-border/40 h-full flex items-center">
          <ChannelTextarea
            v-model="ch.device"
            :data-nav-row="rowIndex"
            data-nav-col="2"
            @input="emit('change')"
            @blur="onDeviceBlur"
            @keydown="onKeydownCol2"
          />
        </div>

        <!-- Desktop: Notizen -->
        <div v-if="!isMobile" class="px-0 py-0 align-middle border-l border-border/40 h-full flex flex-col items-start justify-center">
          <ChannelTextarea
            v-model="ch.notes"
            :data-nav-row="rowIndex"
            data-nav-col="3"
            @input="emit('change')"
            @keydown="onKeydownCol3"
          />
          <div v-if="mountRefLabel" class="px-2 pb-1 w-full">
            <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/10 text-accent/80 border border-accent/20 select-none">
              <Layers class="size-2.5 shrink-0" />{{ mountRefLabel }}
            </span>
          </div>
        </div>

        <!-- Desktop: Assign dropdown -->
        <div v-if="!isMobile" class="pl-1 pr-1 align-middle border-l border-border/40 flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="no-print h-7 rounded-sm px-2 text-[11px] text-muted-foreground hover:text-accent-foreground opacity-0 transition-all group-hover/row:opacity-100 data-[state=open]:opacity-100"
              >
                <MapPin class="size-3 mr-1" />{{ t('channel.row.assign') }}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuItem @click="emit('placeInFloorplan', ch)">
                <MapPin class="size-3.5 mr-2 shrink-0" />{{ t('channel.row.place_floorplan') }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('assignTower', ch)">
                <TowerControl class="size-3.5 mr-2 shrink-0" />{{ t('channel.row.assign_tower') }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('assignBar', ch)">
                <AlignJustify class="size-3.5 mr-2 shrink-0" />{{ t('channel.row.assign_bar') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <!-- Desktop: Delete -->
        <div v-if="!isMobile" class="w-10 pl-1 pr-1 align-middle text-center border-l border-border/40 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            class="no-print size-7 rounded-sm text-muted-foreground hover:text-accent-foreground opacity-0 transition-all group-hover/row:opacity-100"
            @click="deleteDialogOpen = true"
            :title="deleteTitle"
          >
            <X class="size-3.5" />
          </Button>
        </div>

        <!-- Delete confirm dialog -->
        <AlertDialog :open="deleteDialogOpen" @update:open="val => { if (!val) deleteDialogOpen = false }">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{{ t('channel.row.delete.title') }}</AlertDialogTitle>
              <AlertDialogDescription>{{ t('channel.row.delete.desc') }}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter class="flex-col sm:flex-row gap-2">
              <AlertDialogCancel @click="deleteDialogOpen = false">{{ t('action.cancel') }}</AlertDialogCancel>
              <Button variant="outline" @click="() => { deleteDialogOpen = false; emit('clear', ch) }">{{ t('channel.row.clear') }}</Button>
              <AlertDialogAction class="bg-destructive text-destructive-foreground hover:bg-destructive/90" @click="() => { deleteDialogOpen = false; emit('delete', ch) }">{{ t('channel.row.delete_row') }}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <!-- Mobile: Compact stacked layout -->
        <div v-if="isMobile" class="flex flex-col gap-0 py-0 px-0 w-full">
          <!-- Row 1: Channel / Address | Color -->
          <div class="flex gap-2 items-center px-3 py-1.5 border-l-2 border-l-border/40">
            <div class="flex items-center gap-0.5 flex-1">
              <Input
                v-model="ch.channel"
                @input="emit('change')"
                @blur="onChannelBlur"
                :data-nav-row="rowIndex"
                data-nav-col="0"
                @keydown="onKeydownCol0"
                @click.stop="emit('toggleStatus', ch)"
                :title="ch.channel ? 'Status umschalten' : ''"
                :class="[dupChannelNrs.has(ch.channel) ? 'ring-1 ring-yellow-400/60' : '', channelStatusClass]"
                class="w-12 h-8 cursor-pointer rounded border-0 bg-transparent px-1 py-0 text-center font-mono text-base font-semibold shadow-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-0"
              />
              <span class="text-xs text-muted-foreground/50">/</span>
              <Input
                v-model="ch.address"
                @input="emit('change')"
                @blur="onAddressBlur"
                @click.stop
                class="w-16 h-8 rounded border-0 bg-transparent px-1 py-0 text-center text-xs text-muted-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
              />
            </div>
            <div class="shrink-0 w-28">
              <ColorAutocomplete
                :modelValue="ch.color"
                @update:modelValue="ch.color = $event; emit('change')"
                :placeholder="colorPlaceholder"
                :inputAttrs="{ 'data-nav-row': rowIndex, 'data-nav-col': 1 }"
                @keydown="onKeydownCol1"
              />
            </div>
          </div>
          <!-- Row 2: Device -->
          <div class="text-xs px-3 py-1.5 border-t border-t-border/30 border-l-2 border-l-border/40 flex items-center">
            <ChannelTextarea
              v-model="ch.device"
              :data-nav-row="rowIndex"
              data-nav-col="2"
              @input="emit('change')"
              @keydown="onKeydownCol2"
            />
          </div>
          <!-- Row 3: Notes -->
          <div class="text-xs px-3 py-1.5 border-t border-t-border/30 border-l-2 border-l-border/40 flex items-center">
            <ChannelTextarea
              v-model="ch.notes"
              :data-nav-row="rowIndex"
              data-nav-col="3"
              @input="emit('change')"
              @keydown="onKeydownCol3"
            />
          </div>
        </div>
      </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
const { t } = useLocale()
import { GripVertical, X, Layers, MapPin, AlignJustify, TowerControl } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import ColorAutocomplete from '../ColorAutocomplete.vue'
import ChannelTextarea from './ChannelTextarea.vue'
import QuantitySelect from './QuantitySelect.vue'
import { useIsMobile } from '@/composables/useBreakpoint.js'
import { normalizeDmxAddress } from '@/utils/dmxAddress'

const props = defineProps({
  ch: { type: Object, required: true },
  rowIndex: { type: Number, required: true },
  dupChannelNrs: { type: Set, default: () => new Set() },
  channelStatus: { type: String, default: 'default' },
  colorPlaceholder: { type: String, default: '' },
  deleteTitle: { type: String, default: '' },
  onKeydownFn: { type: Function, default: null },
  onAddRow: { type: Function, default: null },
  isMobileProp: { type: Boolean, default: null },
})

const emit = defineEmits([
  'change',
  'toggleStatus', 'delete', 'clear',
  'placeInFloorplan', 'assignTower', 'assignBar',
])

const deleteDialogOpen = ref(false)
const quantityFlash = ref(false)

function onChannelBlur() {
  const ch = props.ch
  if ((ch.channel ?? '').trim() && !(ch.color ?? '').trim()) {
    ch.color = 'NC'
    emit('change')
  }
}

function onDeviceBlur() {
  const ch = props.ch
  const match = (ch.device ?? '').match(/^(\d+)\s*x\s*/i)
  if (match) {
    const n = Math.min(99, Math.max(1, parseInt(match[1])))
    ch.quantity = n
    ch.device = ch.device.slice(match[0].length)
    emit('change')
    quantityFlash.value = true
    setTimeout(() => { quantityFlash.value = false }, 600)
  }
}

function onAddressBlur() {
  const ch = props.ch
  const normalized = normalizeDmxAddress(ch.address ?? '')
  if (normalized !== ch.address) {
    ch.address = normalized
    emit('change')
  }
}

const _isMobileViewport = useIsMobile()
const isMobile = computed(() => props.isMobileProp !== null ? props.isMobileProp : _isMobileViewport.value)

function onKeydownCol0(e) { props.onKeydownFn?.(e, props.rowIndex, 0, 5, props.onAddRow) }
function onKeydownCol1(e) { props.onKeydownFn?.(e, props.rowIndex, 1, 5, null) }
function onKeydownCol2(e) { props.onKeydownFn?.(e, props.rowIndex, 2, 5, null) }
function onKeydownCol3(e) { props.onKeydownFn?.(e, props.rowIndex, 3, 5, props.onAddRow) }

const mountRefLabel = computed(() => {
  const raw = props.ch?.mount_ref
  if (!raw) return null
  try {
    const ref = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (ref?.type === 'tower') {
      const parts = [ref.towerName, ref.slotIndex != null ? `Slot ${ref.slotIndex}` : null].filter(Boolean)
      return parts.join(' · ') || 'Beleuchtungsgestell'
    }
    if (ref?.type === 'bar') return ref.barName ?? 'Zugstange'
    if (ref?.type === 'stage_object') return ref.objectName ?? 'Kulisse'
  } catch { return null }
  return null
})

const channelStatusClass = computed(() => {
  if (props.channelStatus === 'active') return 'text-green-600 dark:text-green-400'
  if (props.channelStatus === 'eos') return 'text-amber-400'
  return 'text-foreground'
})

const stableRowKey = computed(() => {
  if (props.ch?.id) return props.ch.id
  if (props.ch?.__rowKey) return props.ch.__rowKey
  return `${props.ch?.channel || ''}|${props.ch?.address || ''}`
})
</script>

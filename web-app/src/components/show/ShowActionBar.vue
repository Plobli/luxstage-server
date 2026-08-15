<template>
  <div class="shrink-0 flex min-h-10 items-center border-b border-border bg-surface-raised">
    <!-- Undo/Redo + Saving -->
    <div class="flex items-center gap-x-1 shrink-0 px-4 sm:px-6 lg:px-5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" :disabled="!canUndo" class="no-print h-11 w-11 md:h-8 md:w-8 text-muted-foreground" @click="emit('undo')">
              <Undo2 class="size-4" /><span class="sr-only">{{ labels.undo }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>{{ labels.undo }}</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" :disabled="!canRedo" class="no-print h-11 w-11 md:h-8 md:w-8 text-muted-foreground" @click="emit('redo')">
              <Redo2 class="size-4" /><span class="sr-only">{{ labels.redo }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>{{ labels.redo }}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span v-if="saving" class="text-xs text-muted-foreground">…</span>
    </div>
    <div v-if="activeTab === 'channels'" class="relative flex-1 self-stretch">
      <Input
        :value="search"
        @input="emit('update:search', $event.target.value)"
        @keydown.esc="emit('update:search', '')"
        type="search"
        :placeholder="labels.search"
        class="h-full w-full pl-8 text-xs border-0 border-l border-border rounded-none bg-transparent focus-visible:ring-0 focus-visible:bg-white/5"
      />
      <Search class="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" aria-hidden="true" />
    </div>

    <div class="flex items-center gap-x-3 shrink-0 pr-4 sm:pr-6 lg:pr-8">
      <!-- Presence -->
      <div v-if="presenceWithActivity.length > 1" class="hidden sm:flex items-center -space-x-1.5">
        <TooltipProvider>
          <Tooltip v-for="u in presenceWithActivity.slice(0, 4)" :key="u.username">
            <TooltipTrigger asChild>
              <div
                :style="{ backgroundColor: userColor(u.username) }"
                :class="{ 'ring-2 ring-green-400/80': u.isActive }"
                class="size-6 rounded-full ring-2 ring-background flex items-center justify-center text-[10px] font-semibold text-white uppercase relative transition-all"
              >
                {{ u.username[0] }}
                <div v-if="u.isActive" class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-green-400 ring-1 ring-background" />
                <span v-if="u.devices.includes('ios')" class="absolute -top-0.5 -right-0.5 text-xs">📱</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div class="text-sm">
                <p class="font-semibold">{{ u.username }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ u.devices.includes('ios') ? 'iOS' : 'Web' }}{{ u.devices.length > 1 ? ' + ' + (u.devices.length - 1) : '' }}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div v-if="presenceWithActivity.length > 4" class="size-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[9px] text-muted-foreground">+{{ presenceWithActivity.length - 4 }}</div>
      </div>

      <!-- Warnings -->
      <Badge v-if="dupAddressWarning" variant="outline" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs hidden sm:flex">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupAddress }}
      </Badge>
      <Badge v-if="dupChannelWarning" variant="outline" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs hidden sm:flex">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupChannel }}
      </Badge>

      <!-- Farb-Legende der Kanalnummer, hinter Klick-Popover statt dauerhaft sichtbar. -->
      <DropdownMenu v-if="activeTab === 'channels'">
        <DropdownMenuTrigger asChild>
          <button type="button" class="hidden lg:flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground/70 hover:bg-muted/60 transition-colors">
            <CircleHelp class="size-3.5" /><span>{{ labels.legendTitle }}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <div class="px-2 py-1.5 flex flex-col gap-1.5 text-xs">
            <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-current text-muted-foreground/70" /><span>{{ labels.legendDefault }}</span></span>
            <span class="flex items-center gap-1.5 text-green-600 dark:text-green-400"><span class="size-1.5 rounded-full bg-current" /><span>{{ labels.legendActive }}</span></span>
            <span class="flex items-center gap-1.5 text-amber-400"><span class="size-1.5 rounded-full bg-current" /><span>{{ labels.legendEos }}</span></span>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Health Badge -->
      <ShowHealthBadge
        v-if="healthLabels && activeTab === 'channels'"
        :noNotes="healthStats.noNotes"
        :noDevice="healthStats.noDevice"
        :noPosition="healthStats.noPosition"
        :noAddress="healthStats.noAddress"
        :incomplete="healthStats.incomplete"
        :activeFilter="activeHealthFilter"
        :labels="healthLabels"
        @filterNoNotes="emit('healthFilter', 'noNotes')"
        @filterNoDevice="emit('healthFilter', 'noDevice')"
        @filterNoPosition="emit('healthFilter', 'noPosition')"
        @filterNoAddress="emit('healthFilter', 'noAddress')"
        @clearFilter="emit('healthFilter', null)"
      />
    </div>

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Search, Undo2, Redo2, AlertTriangle, CircleHelp } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ShowHealthBadge from './ShowHealthBadge.vue'

const props = defineProps({
  activeTab: { type: String, default: 'gassenturm' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  presence: { type: Array, default: () => [] },
  dupAddressWarning: { type: Boolean, default: false },
  dupChannelWarning: { type: Boolean, default: false },
  search: { type: String, default: '' },
  healthStats: { type: Object, default: () => ({ noNotes: 0, noDevice: 0, noPosition: 0, noAddress: 0, incomplete: 0 }) },
  healthLabels: { type: Object, default: null },
  activeHealthFilter: { type: String, default: null },
  labels: { type: Object, required: true },
})

const emit = defineEmits(['update:search', 'undo', 'redo', 'healthFilter'])

const colorMap = ['#3b82f6', '#a855f7', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#06b6d4']
const currentTime = ref(Date.now())
let presenceTimer

onMounted(() => {
  presenceTimer = window.setInterval(() => { currentTime.value = Date.now() }, 10_000)
})

onBeforeUnmount(() => clearInterval(presenceTimer))

function userColor(username) {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash) + username.charCodeAt(i)
    hash |= 0
  }
  return colorMap[Math.abs(hash) % colorMap.length]
}

const presenceWithActivity = computed(() =>
  props.presence.map(u => ({
    ...u,
    isActive: u.lastActivityAt && currentTime.value - new Date(u.lastActivityAt).getTime() < 30000
  }))
)
</script>

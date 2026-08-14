<template>
  <div class="flex items-center gap-1">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          class="no-print flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/60"
          :class="[total === 0 ? 'text-green-500' : 'text-yellow-400', activeFilter ? 'bg-yellow-500/10 ring-1 ring-yellow-500/30' : '']"
          :title="total === 0 ? labels.complete : `${total} ${labels.incomplete}`"
        >
          <CheckCircle2 v-if="total === 0" class="size-3.5" />
          <AlertCircle v-else class="size-3.5" />
          <span class="tabular-nums hidden sm:inline">
            {{ total === 0 ? labels.complete : `${total} ${labels.incomplete}` }}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-64">
        <DropdownMenuLabel class="text-xs font-semibold">{{ labels.title }}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div v-if="total === 0" class="px-2 py-1.5 text-xs text-green-500 flex items-center gap-1.5">
          <CheckCircle2 class="size-3.5 shrink-0" />
          {{ labels.complete }}
        </div>
        <template v-else>
          <DropdownMenuItem
            v-if="noDevice > 0"
            :class="['cursor-pointer flex items-center justify-between gap-2 text-xs focus:bg-accent focus:[&>span]:!text-accent-foreground', activeFilter === 'noDevice' ? 'bg-yellow-500/10' : '']"
            @click="emit('filterNoDevice')"
          >
            <span :class="activeFilter === 'noDevice' ? 'text-yellow-400' : 'text-muted-foreground'">{{ labels.noDevice }}</span>
            <span class="tabular-nums font-semibold text-yellow-400 shrink-0">{{ noDevice }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="noPosition > 0"
            :class="['cursor-pointer flex items-center justify-between gap-2 text-xs focus:bg-accent focus:[&>span]:!text-accent-foreground', activeFilter === 'noPosition' ? 'bg-yellow-500/10' : '']"
            @click="emit('filterNoPosition')"
          >
            <span :class="activeFilter === 'noPosition' ? 'text-yellow-400' : 'text-muted-foreground'">{{ labels.noPosition }}</span>
            <span class="tabular-nums font-semibold text-yellow-400 shrink-0">{{ noPosition }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="noAddress > 0"
            :class="['cursor-pointer flex items-center justify-between gap-2 text-xs focus:bg-accent focus:[&>span]:!text-accent-foreground', activeFilter === 'noAddress' ? 'bg-yellow-500/10' : '']"
            @click="emit('filterNoAddress')"
          >
            <span :class="activeFilter === 'noAddress' ? 'text-yellow-400' : 'text-muted-foreground'">{{ labels.noAddress }}</span>
            <span class="tabular-nums font-semibold text-yellow-400 shrink-0">{{ noAddress }}</span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Aktiver Filter als Chip -->
    <div
      v-if="activeFilter && activeFilterLabel"
      class="flex items-center gap-1 rounded-md bg-yellow-500/10 px-2 py-1 text-xs text-yellow-400 ring-1 ring-yellow-500/30"
    >
      <span class="hidden sm:inline">{{ activeFilterLabel }}</span>
      <button class="flex items-center hover:text-yellow-200 transition-colors" @click="emit('clearFilter')">
        <X class="size-3" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertCircle, CheckCircle2, X } from 'lucide-vue-next'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const props = defineProps<{
  noNotes: number
  noDevice: number
  noPosition: number
  noAddress: number
  incomplete: number
  activeFilter?: string | null
  labels: {
    title: string
    complete: string
    incomplete: string
    noNotes: string
    noDevice: string
    noPosition: string
    noAddress: string
  }
}>()

const emit = defineEmits<{
  filterNoNotes: []
  filterNoDevice: []
  filterNoPosition: []
  filterNoAddress: []
  clearFilter: []
}>()

const total = computed(() => props.incomplete)

const activeFilterLabel = computed(() => {
  if (!props.activeFilter) return null
  const map: Record<string, string> = {
    noDevice:   props.labels.noDevice,
    noPosition: props.labels.noPosition,
    noAddress:  props.labels.noAddress,
  }
  return map[props.activeFilter] ?? null
})
</script>

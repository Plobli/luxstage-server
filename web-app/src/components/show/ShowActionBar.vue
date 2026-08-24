<template>
  <div class="shrink-0 flex min-h-10 items-center border-b border-border bg-surface-raised">
    <!-- Undo/Redo + Saving -->
    <div class="flex items-center gap-x-1 shrink-0 px-4 sm:px-6 lg:px-5">
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
      <!-- Schreib-Sperre: fremder Halter -->
      <Badge v-if="lockedByOther" variant="outline" role="button" tabindex="0" @click="emit('requestTakeover')" class="text-orange-400 border-orange-500/30 bg-orange-500/10 text-xs flex cursor-pointer hover:bg-orange-500/20">
        <Lock class="size-3 mr-1" />{{ labels.lockedBy }}
      </Badge>
      <!-- Warnings -->
      <Badge v-if="dupAddressWarning && activeTab === 'channels'" variant="outline" role="button" tabindex="0" @click="emit('filterDup', 'address')" @keydown.enter="emit('filterDup', 'address')" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs hidden sm:flex cursor-pointer hover:bg-yellow-500/20">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupAddress }}
      </Badge>
      <Badge v-if="dupChannelWarning && activeTab === 'channels'" variant="outline" role="button" tabindex="0" @click="emit('filterDup', 'channel')" @keydown.enter="emit('filterDup', 'channel')" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs hidden sm:flex cursor-pointer hover:bg-yellow-500/20">
        <AlertTriangle class="size-3 mr-1" />{{ labels.dupChannel }}
      </Badge>
      <DropdownMenu v-if="healthStats.incomplete > 0 && activeTab === 'channels'">
        <DropdownMenuTrigger asChild>
          <Badge variant="outline" role="button" tabindex="0" class="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 text-xs hidden sm:flex cursor-pointer hover:bg-yellow-500/20">
            <AlertTriangle class="size-3 mr-1" />{{ healthStats.incomplete }} {{ healthLabels?.incomplete }}
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-56">
          <DropdownMenuLabel class="text-xs font-semibold">{{ healthLabels?.title }}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem v-if="healthStats.noDevice > 0" class="cursor-pointer flex items-center justify-between gap-2 text-xs focus:bg-accent focus:[&>span]:!text-accent-foreground" @click="emit('healthFilter', 'noDevice')">
            <span class="text-muted-foreground">{{ healthLabels?.noDevice }}</span>
            <span class="tabular-nums font-semibold text-yellow-400 shrink-0">{{ healthStats.noDevice }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem v-if="healthStats.noPosition > 0" class="cursor-pointer flex items-center justify-between gap-2 text-xs focus:bg-accent focus:[&>span]:!text-accent-foreground" @click="emit('healthFilter', 'noPosition')">
            <span class="text-muted-foreground">{{ healthLabels?.noPosition }}</span>
            <span class="tabular-nums font-semibold text-yellow-400 shrink-0">{{ healthStats.noPosition }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem v-if="healthStats.noAddress > 0" class="cursor-pointer flex items-center justify-between gap-2 text-xs focus:bg-accent focus:[&>span]:!text-accent-foreground" @click="emit('healthFilter', 'noAddress')">
            <span class="text-muted-foreground">{{ healthLabels?.noAddress }}</span>
            <span class="tabular-nums font-semibold text-yellow-400 shrink-0">{{ healthStats.noAddress }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

      <!-- Nur weiße (nicht importierte) Kreise ausblenden -->
      <Tooltip v-if="activeTab === 'channels' && hasEosImport">
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            :class="{ 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20': hideEosInactive }"
            class="hidden lg:flex h-8 w-8 text-muted-foreground"
            @click="emit('update:hideEosInactive', !hideEosInactive)"
          >
            <component :is="hideEosInactive ? EyeOff : Eye" class="size-4" /><span class="sr-only">{{ labels.hideEosInactive }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom"><p>{{ labels.hideEosInactive }}</p></TooltipContent>
      </Tooltip>

    </div>

  </div>
</template>

<script setup>
import { Search, Undo2, Redo2, AlertTriangle, CircleHelp, Eye, EyeOff, Lock } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

defineProps({
  activeTab: { type: String, default: 'gassenturm' },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  lockedByOther: { type: Boolean, default: false },
  dupAddressWarning: { type: Boolean, default: false },
  dupChannelWarning: { type: Boolean, default: false },
  search: { type: String, default: '' },
  healthStats: { type: Object, default: () => ({ noNotes: 0, noDevice: 0, noPosition: 0, noAddress: 0, incomplete: 0 }) },
  healthLabels: { type: Object, default: null },
  hasEosImport: { type: Boolean, default: false },
  hideEosInactive: { type: Boolean, default: false },
  labels: { type: Object, required: true },
})

const emit = defineEmits(['update:search', 'update:hideEosInactive', 'undo', 'redo', 'healthFilter', 'filterDup', 'requestTakeover'])


</script>

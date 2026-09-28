<template>
  <Sheet :open="open" @update:open="val => { if (!val) emit('close') }">
    <SheetContent class="w-96 sm:max-w-md p-0 flex flex-col border-l border-border bg-background no-print [&>button]:hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div class="flex items-center gap-2">
          <Button
            v-if="currentEntry"
            variant="ghost"
            size="sm"
            class="h-auto px-2 py-1 text-xs text-muted-foreground"
            @click="emit('back')"
          >
            {{ labels.back }}
          </Button>
          <SheetTitle class="text-sm font-semibold text-foreground m-0 p-0">{{ labels.title }}</SheetTitle>
        </div>
        <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground" @click="emit('close')">
          <X class="size-4" />
        </Button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <Spinner />
      </div>

      <!-- Snapshot list -->
      <div v-else-if="!currentEntry" class="flex-1 overflow-y-auto px-2 py-2">
        <p v-if="error" class="px-2 py-6 text-sm text-destructive">{{ error }}</p>
        <p v-else-if="entries.length === 0" class="px-2 py-6 text-sm text-muted-foreground">{{ labels.empty }}</p>
        <button
          v-for="(entry, idx) in entries"
          :key="entry.id"
          type="button"
          class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-muted/50 transition-colors"
          @click="emit('select', entry.id)"
        >
          <span class="size-2 rounded-full shrink-0" :class="idx === 0 ? 'bg-accent' : 'bg-muted-foreground/30'" />
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-medium text-foreground truncate">{{ relativeTime(entry.created_at) }}</span>
            <span class="block text-[11px] text-muted-foreground/70">{{ new Date(entry.created_at).toLocaleString() }}</span>
          </span>
          <span class="shrink-0 text-[11px] font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {{ labels.channelCount(entry.channel_count ?? 0) }}
          </span>
        </button>
        <!-- Der Verlauf läuft automatisch und ist begrenzt — ohne diesen Hinweis
             wirkt das Verschwinden alter Einträge wie Datenverlust. -->
        <p class="px-2.5 py-3 text-xs text-muted-foreground/70">{{ labels.limit }}</p>
      </div>

      <!-- Snapshot detail -->
      <div v-else class="flex-1 flex flex-col overflow-hidden">
        <div class="px-4 py-2 border-b border-border/50 shrink-0">
          <p class="text-xs text-muted-foreground">{{ new Date(currentEntry.created_at).toLocaleString() }}</p>
          <p class="text-xs text-muted-foreground/70 mt-0.5">{{ labels.channelCount(currentEntry.channels?.length ?? 0) }}</p>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="ch in currentEntry.channels"
            :key="ch.id"
            class="flex items-baseline gap-3 px-4 py-2 border-b border-border/50 text-xs"
          >
            <span class="font-mono font-bold text-foreground w-8 shrink-0">{{ ch.channel }}</span>
            <span class="text-muted-foreground truncate">{{ ch.device }}</span>
            <span class="text-muted-foreground/70 truncate ml-auto">{{ ch.notes }}</span>
          </div>
        </div>
        <div class="px-4 py-3 border-t border-border shrink-0 space-y-2">
          <p class="text-xs text-muted-foreground/70">{{ labels.scope }}</p>
          <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
          <Button
            class="w-full"
            @click="confirmOpen = true"
          >
            {{ labels.restore }}
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>

  <!-- Wiederherstellen überschreibt Kanäle und Abschnitte ohne Undo,
       deshalb Rückfrage mit klarer Angabe, was unberührt bleibt. -->
  <ConfirmDialog
    :open="confirmOpen"
    :title="labels.confirmTitle"
    :message="labels.confirmMessage"
    :confirm-label="labels.restore"
    :cancel-label="labels.cancel"
    @cancel="confirmOpen = false"
    @confirm="doRestore"
  />
</template>

<script setup>
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import Spinner from '@/components/Spinner.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useLocale } from '@/composables/useLocale.js'

const { t } = useLocale()

// Reine Darstellung: Daten kommen über Props herein, Aktionen gehen als Events
// hinaus. Der Datenzugriff liegt in useShowHistory.js.
const props = defineProps({
  open: { type: Boolean, default: false },
  entries: { type: Array, default: () => [] },
  currentEntry: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  labels: { type: Object, required: true },
})

function relativeTime(timestamp) {
  const diffMs = Date.now() - timestamp
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return t('history.time.just_now')
  if (minutes < 60) return t('history.time.minutes_ago', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('history.time.hours_ago', { n: hours })
  const days = Math.floor(hours / 24)
  if (days === 1) return t('history.time.yesterday')
  return t('history.time.days_ago', { n: days })
}

const emit = defineEmits(['close', 'restore', 'select', 'back'])

const confirmOpen = ref(false)

function doRestore() {
  confirmOpen.value = false
  emit('restore', props.currentEntry)
}
</script>

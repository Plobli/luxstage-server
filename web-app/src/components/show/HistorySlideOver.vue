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
      <div v-else-if="!currentEntry" class="flex-1 overflow-y-auto">
        <p v-if="error" class="px-4 py-6 text-sm text-destructive">{{ error }}</p>
        <p v-else-if="entries.length === 0" class="px-4 py-6 text-sm text-muted-foreground">{{ labels.empty }}</p>
        <Button
          v-for="entry in entries"
          :key="entry.id"
          variant="ghost"
          class="w-full justify-start rounded-none px-4 py-6 border-b border-border/50 h-auto text-sm text-foreground font-normal hover:bg-muted/50"
          @click="emit('select', entry.id)"
        >
          {{ new Date(entry.created_at).toLocaleString() }}
        </Button>
        <!-- Der Verlauf läuft automatisch und ist begrenzt — ohne diesen Hinweis
             wirkt das Verschwinden alter Einträge wie Datenverlust. -->
        <p class="px-4 py-3 text-xs text-muted-foreground/70">{{ labels.limit }}</p>
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

const emit = defineEmits(['close', 'restore', 'select', 'back'])

const confirmOpen = ref(false)

function doRestore() {
  confirmOpen.value = false
  emit('restore', props.currentEntry)
}
</script>

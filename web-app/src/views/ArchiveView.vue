<template>
  <div class="px-4 py-8 sm:px-6 lg:px-8">
    <div class="sm:flex sm:items-center mb-8">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-foreground">{{ t('nav.archive') }}</h1>
      </div>
    </div>

    <!-- Bestätigungsdialog Löschen -->
    <Dialog :open="!!deleteTarget" @update:open="(val) => { if(!val) deleteTarget = null }">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ t('show.delete.confirm.title') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p class="text-sm text-muted-foreground">
            {{ deleteTarget ? t('show.delete.confirm.text', { name: deleteTarget.name || deleteTarget.id }) : '' }}
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" @click="deleteTarget = null">
            {{ t('action.cancel') }}
          </Button>
          <Button variant="destructive" @click="deletePermanent">
            {{ t('show.delete') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div v-if="loading" class="text-sm text-muted-foreground">…</div>

    <div v-else-if="shows.length === 0" class="flex flex-col items-center justify-center py-24 gap-2 text-center">
      <p class="text-muted-foreground text-sm">{{ t('show.archive.empty') }}</p>
      <p class="text-muted-foreground/60 text-xs">{{ t('show.archive.empty.hint') }}</p>
    </div>

    <template v-else>
      <!-- Spalten-Header -->
      <div class="grid grid-cols-[1fr_8rem_7rem_1fr_4.5rem] gap-0 px-4 mb-1 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider select-none">
        <span>{{ t('field.name') }}</span>
        <span class="hidden sm:block">{{ t('field.date') }}</span>
        <span class="hidden lg:block">{{ t('field.spielzeit') }}</span>
        <span class="hidden md:block">{{ t('field.last_edited') }}</span>
        <span></span>
      </div>

      <div class="rounded-xl overflow-hidden">
        <div
          v-for="(show, i) in shows"
          :key="show.id"
          class="group grid grid-cols-[1fr_8rem_7rem_1fr_4.5rem] gap-0 items-center px-4 py-3 transition-colors hover:bg-muted/50"
          :class="i > 0 ? 'border-t border-border/40' : ''"
        >
          <div class="min-w-0 pr-4">
            <span class="font-medium text-foreground text-sm truncate block">{{ show.name || show.id }}</span>
          </div>
          <span class="text-sm text-muted-foreground hidden sm:block">{{ formatDatum(show.datum) }}</span>
          <span class="text-sm text-muted-foreground hidden lg:block">{{ show.spielzeit || '—' }}</span>
          <span class="text-sm text-muted-foreground truncate hidden md:block">{{ show.last_edited_by }}</span>
          <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-foreground" @click="restore(show.id)" :title="t('show.restore')">
              <Undo class="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-destructive" @click="confirmDelete(show)" :title="t('show.delete')">
              <Trash2 class="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Undo, Trash2 } from 'lucide-vue-next'
import { fetchArchivedShows, restoreShow, deleteShowPermanent } from '../api/shows.js'
import { useLocale } from '../composables/useLocale.js'
import { formatDatum } from '../utils/index.ts'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'

const { t } = useLocale()

const shows = ref([])
const loading = ref(true)
const deleteTarget = ref(null)

onMounted(async () => {
  try {
    shows.value = await fetchArchivedShows()
  } finally {
    loading.value = false
  }
})

async function restore(id) {
  await restoreShow(id)
  shows.value = shows.value.filter(s => s.id !== id)
}

function confirmDelete(show) {
  deleteTarget.value = show
}

async function deletePermanent() {
  const id = deleteTarget.value.id
  deleteTarget.value = null
  await deleteShowPermanent(id)
  shows.value = shows.value.filter(s => s.id !== id)
}
</script>

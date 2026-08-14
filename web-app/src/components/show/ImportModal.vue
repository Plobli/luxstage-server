<template>
  <Dialog :open="open" @update:open="!$event && $emit('cancel')">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="mb-4">{{ t('import.modal.title') }}</DialogTitle>
      </DialogHeader>

      <DialogBody>
        <button
          type="button"
          class="flex flex-col gap-1 rounded-lg border border-border p-4 text-left transition-colors hover:border-accent hover:bg-accent/5"
          @click="$emit('chooseEos')"
        >
          <span class="font-medium text-foreground">{{ t('import.modal.eos.title') }}</span>
          <span class="text-sm text-muted-foreground">{{ t('import.modal.eos.description') }}</span>
          <span class="text-xs text-muted-foreground/70">{{ t('import.modal.eos.hint') }}</span>
        </button>

        <button
          type="button"
          class="flex flex-col gap-1 rounded-lg border border-border p-4 text-left transition-colors hover:border-accent hover:bg-accent/5"
          @click="$emit('chooseCsv')"
        >
          <span class="font-medium text-foreground">{{ t('import.modal.csv.title') }}</span>
          <span class="text-sm text-muted-foreground">{{ t('import.modal.csv.description') }}</span>
          <span class="text-xs text-muted-foreground/70">{{ t('import.modal.csv.hint') }}</span>
        </button>
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" class="w-full sm:w-auto" @click="$emit('cancel')">
          {{ t('action.cancel') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { useLocale } from '../../composables/useLocale.js'

const { t } = useLocale()

defineProps({
  open: { type: Boolean, required: true },
})

defineEmits(['chooseEos', 'chooseCsv', 'cancel'])
</script>

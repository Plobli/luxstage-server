<template>
  <AlertDialog :open="open">
    <AlertDialogContent class="sm:max-w-lg">
      <AlertDialogHeader>
        <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle class="size-4 text-red-400" aria-hidden="true" />
        </div>
        <div class="flex flex-col gap-0.5">
          <AlertDialogTitle>{{ title }}</AlertDialogTitle>
          <AlertDialogDescription>{{ message }}</AlertDialogDescription>
        </div>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="cancel">
          {{ cancelLabel }}
        </AlertDialogCancel>
        <AlertDialogAction
          data-testid="confirm-dialog-confirm"
          @click="confirm"
          :class="buttonVariants({ variant: 'destructive' })"
        >
          {{ confirmLabel }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup>
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Löschen' },
  cancelLabel: { type: String, default: 'Abbrechen' },
})

const emit = defineEmits(['confirm', 'cancel'])

function confirm() { emit('confirm') }
function cancel() { emit('cancel') }
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-5 right-5 z-100 flex flex-col gap-2 w-80 max-w-[calc(100vw-2.5rem)] no-print">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="flex items-start gap-2.5 rounded-lg border border-border/40 bg-popover p-3 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.4)]"
        >
          <span class="size-2 rounded-full shrink-0 mt-1.5" :class="dotClass(toast.variant)" />
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-foreground">{{ toast.title }}</p>
            <p v-if="toast.description" class="text-[11px] text-muted-foreground mt-0.5">{{ toast.description }}</p>
            <button
              v-if="toast.onRetry"
              type="button"
              class="text-[11px] font-semibold text-accent-foreground hover:underline mt-1.5"
              @click="runRetry(toast)"
            >
              {{ toast.retryLabel }}
            </button>
          </div>
          <button type="button" class="text-muted-foreground/60 hover:text-foreground shrink-0" @click="dismiss(toast.id)">
            <X class="size-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { X } from 'lucide-vue-next'
import { useToastStore, dismiss } from '@/composables/useToast.ts'

const { toasts } = useToastStore()

function dotClass(variant) {
  if (variant === 'error') return 'bg-destructive'
  if (variant === 'success') return 'bg-green-500'
  return 'bg-accent'
}

function runRetry(toast) {
  toast.onRetry?.()
  dismiss(toast.id)
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-active {
  position: absolute;
}
</style>

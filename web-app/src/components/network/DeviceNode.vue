<template>
  <div class="rounded-md border px-3 py-2 text-sm flex items-center gap-2 w-56" :class="bgClass">
    <Handle type="target" :position="Position.Left" />
    <component :is="data.icon" class="size-3.5 shrink-0 text-muted-foreground" />
    <span class="truncate font-medium">{{ data.label }}</span>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  data: { type: Object, required: true },
})

// Dose und Gerät sind sonst nur am Icon zu unterscheiden — ein dezenter
// Farbton je Typ macht das auch auf einen Blick über die ganze Topologie
// erkennbar.
const bgClass = computed(() => {
  if (props.data.elementType === 'dose') return 'border-sky-400/40 bg-sky-400/10'
  if (props.data.elementType === 'geraet') return 'border-amber-400/40 bg-amber-400/10'
  return 'border-border bg-background'
})
</script>

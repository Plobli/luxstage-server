<template>
  <div class="w-full h-full rounded-xl border border-border" :style="bgStyle">
    <div class="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-3 pt-2">
      {{ data.label }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Object, required: true },
})

// Dezenter Farbton je Raum — wenig gesättigt, nur zur Unterscheidung, kein
// grelles Akzentfeld.
const bgStyle = computed(() => ({
  backgroundColor: `color-mix(in srgb, hsl(${props.data.hue} 55% 45%) 14%, var(--color-surface-high))`,
}))
</script>

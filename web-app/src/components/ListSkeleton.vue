<template>
  <div class="rounded-xl overflow-hidden" aria-hidden="true">
    <div
      v-for="i in rows"
      :key="i"
      class="flex items-center gap-4 px-4 py-3"
      :class="i > 1 ? 'border-t border-border/40' : ''"
    >
      <div class="h-3.5 rounded bg-muted animate-pulse" :style="{ width: mainWidths[(i - 1) % mainWidths.length] }" />
      <div class="flex-1 flex justify-end gap-4">
        <div v-for="c in metaCols" :key="c" class="h-3 w-16 rounded bg-muted/60 animate-pulse hidden sm:block" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  rows: { type: Number, default: 5 },
  metaCols: { type: Number, default: 2 },
})

// Unterschiedliche Breiten pro Zeile, damit das Skeleton nicht wie ein
// starres Raster wirkt, sondern die natürliche Längenvarianz echter Namen andeutet.
const mainWidths = ['40%', '55%', '30%', '48%', '35%']
</script>

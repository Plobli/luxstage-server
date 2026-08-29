<template>
  <div class="rounded-md border border-border bg-background px-3 py-2 text-sm flex items-center gap-2 w-56">
    <Handle type="target" :position="Position.Left" />
    <component :is="data.icon" class="size-3.5 shrink-0 text-muted-foreground" />
    <span class="truncate font-medium">{{ data.label }}</span>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps({
  data: { type: Object, required: true },
})
</script>

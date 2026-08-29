<template>
  <div class="rounded-lg border-2 border-accent bg-accent/10 p-3 text-sm w-max" :class="{ 'ring-2 ring-accent ring-offset-2 ring-offset-background': data.isMain }">
    <div class="flex items-center gap-2 px-1 pb-3">
      <NetworkIcon class="size-5 shrink-0 text-accent" />
      <span class="truncate font-medium text-base">{{ data.label }}</span>
      <span v-if="data.isMain" class="text-[10px] font-semibold text-accent shrink-0 uppercase tracking-wide">{{ data.mainLabel }}</span>
      <span v-if="data.portCount" class="ml-auto text-xs text-muted-foreground shrink-0">{{ data.portCount }}P</span>
    </div>
    <div v-if="data.portCount" class="flex gap-1">
      <div
        v-for="p in ports" :key="p"
        class="relative size-9 flex items-center justify-center rounded-sm text-xs font-mono border"
        :class="data.isPortUsed(p) ? 'border-accent bg-accent/30 text-foreground' : 'border-border/60 text-muted-foreground/70'"
      >
        {{ p }}
        <Handle :id="String(p)" type="target" :position="Position.Top" class="!size-2" />
        <Handle :id="String(p)" type="source" :position="Position.Bottom" class="!size-2" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { Network as NetworkIcon } from 'lucide-vue-next'

const props = defineProps({
  data: { type: Object, required: true },
})

const ports = computed(() => Array.from({ length: props.data.portCount || 0 }, (_, i) => i + 1))
</script>

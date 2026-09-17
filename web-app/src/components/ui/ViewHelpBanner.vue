<template>
  <p v-if="text && !collapsed" class="shrink-0 border-b border-border/60 bg-accent/5 px-4 sm:px-6 lg:px-8 py-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{{ text }}</p>
</template>

<script setup>
import { watch } from 'vue'

const props = defineProps({
  storageKey: { type: String, required: true },
  text: { type: String, default: '' },
  collapsed: { type: Boolean, required: true },
})

const storageKey = `viewHelp.collapsed.${props.storageKey}`

watch(() => props.collapsed, (v) => {
  localStorage.setItem(storageKey, v ? '1' : '0')
})
</script>

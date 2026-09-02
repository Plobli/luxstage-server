<template>
  <div class="mt-6 mb-8">
    <div class="flex items-center gap-2 px-6 py-2 border-t border-border bg-muted/40">
      <Cpu class="size-3.5 text-muted-foreground shrink-0" />
      <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ t('generated.title') }}</p>
      <span class="ml-auto text-xs text-muted-foreground/60 italic">{{ t('generated.readonly') }}</span>
    </div>
    <div class="px-6 pt-4 flex flex-col gap-5">

    <div v-if="!gassenturmEntries.length && !hangereiEntries.length" class="flex flex-col items-center justify-center gap-3 py-20 text-center px-8">
      <Cpu class="size-7 text-muted-foreground/40" />
      <div>
        <p class="text-base font-medium text-foreground/70">{{ t('generated.empty') }}</p>
        <p class="text-sm text-muted-foreground mt-1">{{ t('generated.empty.desc') }}</p>
      </div>
    </div>

    <template v-if="gassenturmEntries.length">
      <div class="flex flex-col gap-1.5">
        <p class="text-base font-bold text-foreground mt-2 mb-1">{{ t('tab.towers') }}</p>
        <div
          v-for="entry in gassenturmEntries"
          :key="entry.name"
          class="text-sm text-foreground/80 leading-relaxed select-all"
        >
          <span class="font-semibold text-foreground">{{ entry.name }}:</span> {{ entry.text }}
        </div>
      </div>
    </template>

    <template v-if="hangereiEntries.length">
      <div class="flex flex-col gap-1.5">
        <p class="text-base font-bold text-foreground mt-2 mb-1">{{ t('tab.obermaschinerie') }}</p>
        <div
          v-for="entry in hangereiEntries"
          :key="entry.name"
          class="text-sm text-foreground/80 leading-relaxed select-all"
        >
          <span class="font-semibold text-foreground">{{ entry.name }}:</span> {{ entry.text }}
        </div>
      </div>
    </template>
    </div>
  </div>
</template>

<script setup>
import { Cpu } from 'lucide-vue-next'
import { useLocale } from '@/composables/useLocale.js'

const { t } = useLocale()

defineProps({
  gassenturmEntries: { type: Array, default: () => [] },
  hangereiEntries: { type: Array, default: () => [] },
})
</script>

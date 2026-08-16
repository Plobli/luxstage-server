<template>
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" class="inline-flex items-center text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors focus:outline-none shrink-0">
        <CircleHelp class="size-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent :side="side" class="max-w-72">
      <p class="text-sm leading-relaxed whitespace-pre-line">{{ text }}</p>
    </TooltipContent>
  </Tooltip>
</template>

<script setup>
import { CircleHelp } from 'lucide-vue-next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

defineProps({
  text: { type: String, required: true },
  side: { type: String, default: 'top' },
})
</script>

<template>
  <Tooltip v-if="showTooltip">
    <TooltipTrigger as-child>
      <button
        :disabled="disabled"
        :class="btnClass"
        @click="!disabled && $emit('click')"
      >
        <slot />
      </button>
    </TooltipTrigger>
    <TooltipContent :side="horizontal ? 'bottom' : 'right'">{{ title }}</TooltipContent>
  </Tooltip>
  <button
    v-else
    :disabled="disabled"
    :class="btnClass"
    @click="!disabled && $emit('click')"
  >
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps({
  active: Boolean,
  disabled: Boolean,
  variant: String,
  expanded: Boolean,
  horizontal: Boolean,
  iconOnly: Boolean,
  title: String,
})
defineEmits(['click'])

const showTooltip = computed(() => !!props.title && (props.horizontal || !props.expanded))

const btnClass = computed(() => [
  'select-none font-medium transition-colors rounded-md',
  props.horizontal && props.iconOnly && 'flex items-center justify-center w-9 h-9 shrink-0',
  props.horizontal && !props.iconOnly && 'flex flex-col items-center justify-center gap-0.5 w-34 h-16 shrink-0 text-[11px] leading-tight px-1 text-center',
  !props.horizontal && 'flex items-center gap-2 py-1.5 text-sm',
  !props.horizontal && (props.expanded ? 'w-[calc(100%-8px)] px-2 mx-1 justify-start' : 'w-8 h-8 mx-auto justify-center'),
  props.active
    ? 'bg-accent/85 text-accent-foreground'
    : props.variant === 'danger'
      ? 'text-destructive hover:bg-destructive/10'
      : 'text-foreground hover:bg-muted',
  props.disabled && 'opacity-40 pointer-events-none',
])
</script>

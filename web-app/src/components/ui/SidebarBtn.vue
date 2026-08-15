<template>
  <button
    :disabled="disabled"
    :title="horizontal || !expanded ? title : undefined"
    :class="[
      'select-none font-medium transition-colors rounded-md',
      horizontal && iconOnly && 'flex items-center justify-center w-9 h-9 shrink-0',
      horizontal && !iconOnly && 'flex flex-col items-center justify-center gap-0.5 w-34 h-16 shrink-0 text-[11px] leading-tight px-1 text-center',
      !horizontal && 'flex items-center gap-2 py-1.5 text-sm',
      !horizontal && (expanded ? 'w-[calc(100%-8px)] px-2 mx-1 justify-start' : 'w-8 h-8 mx-auto justify-center'),
      active
        ? 'bg-accent/85 text-accent-foreground'
        : variant === 'danger'
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-muted',
      disabled && 'opacity-40 pointer-events-none',
    ]"
    @click="!disabled && $emit('click')"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  active: Boolean,
  disabled: Boolean,
  variant: String,
  expanded: Boolean,
  horizontal: Boolean,
  iconOnly: Boolean,
  title: String,
})
defineEmits(['click'])
</script>

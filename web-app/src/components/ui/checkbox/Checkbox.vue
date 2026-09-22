<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="modelValue"
    :class="[
      'size-4 shrink-0 rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      modelValue
        ? 'bg-accent border-accent'
        : 'border-border bg-transparent',
      $attrs.class,
    ]"
    v-bind="{ ...$attrs, class: undefined }"
    @click.stop="$emit('update:modelValue', !modelValue)"
  >
    <svg v-if="modelValue" viewBox="0 0 12 12" fill="none" class="size-full p-0.5 text-accent-foreground">
      <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>

<script setup>
defineOptions({ inheritAttrs: false })
defineProps({ modelValue: { type: Boolean, default: false } })
defineEmits(['update:modelValue'])
</script>

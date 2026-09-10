<script setup>
import { cn } from '@/utils/index';

const props = defineProps({
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
</script>

<template>
  <div :class="cn('dialog-body flex flex-col gap-6 px-6 py-4 overflow-y-auto', props.class)">
    <slot />
  </div>
</template>

<style>
/* Abstand Label → Input innerhalb jeder Feldgruppe */
.dialog-body > div,
.dialog-body > label + * {
  display: flex;
  flex-direction: column;
  gap: 1.625rem; /* 10px */
}

/* Label-Stil */
.dialog-body label {
  font-size: 0.9375rem; /* 15px */
  font-weight: 600;
  color: white;
  line-height: 1;
}
</style>

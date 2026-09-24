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
  <div :class="cn('dialog-body flex flex-col gap-8 px-6 py-4 overflow-y-auto', props.class)">
    <slot />
  </div>
</template>

<style>
/* Abstand Label → Input innerhalb jeder Feldgruppe — kleiner als der Abstand
   zwischen Feldgruppen (dialog-body gap-8 = 2rem), sonst wirkt die Gruppierung
   invertiert (Label näher am Element der vorigen Gruppe als am eigenen Input). */
.dialog-body > div,
.dialog-body > label + * {
  display: flex;
  flex-direction: column;
  gap: 0.75rem; /* 12px */
}

/* Label-Stil */
.dialog-body label {
  font-size: 0.9375rem; /* 15px */
  font-weight: 600;
  color: white;
  line-height: 1;
}
</style>

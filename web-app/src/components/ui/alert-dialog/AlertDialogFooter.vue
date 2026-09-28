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
  <div
    :class="
      cn(
        'flex items-center justify-end gap-2 px-5 pb-5 pt-2',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>

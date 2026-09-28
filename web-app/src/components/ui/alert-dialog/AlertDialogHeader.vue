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
    :class="cn('flex flex-col gap-1 px-5 pt-5 pb-3', props.class)"
  >
    <slot />
  </div>
</template>

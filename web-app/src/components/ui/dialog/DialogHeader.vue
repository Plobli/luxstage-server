<script setup>
import { X } from "lucide-vue-next";
import { DialogClose } from "reka-ui";
import { cn } from '@/utils/index';

const props = defineProps({
  hideClose: { type: Boolean, default: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
</script>

<template>
  <div :class="cn('flex items-start justify-between gap-4 px-5 pt-5 pb-2', props.class)">
    <div class="flex flex-col gap-0.5 min-w-0 flex-1">
      <slot />
    </div>
    <div class="flex items-center gap-1 shrink-0">
      <slot name="actions" />
      <DialogClose
        v-if="!props.hideClose"
        class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <X class="w-4 h-4" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </div>
  </div>
</template>

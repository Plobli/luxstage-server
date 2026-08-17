<template>
  <div class="flex flex-col gap-2">
    <Input ref="inputRef" v-model="search" :placeholder="searchPlaceholder" autofocus @keydown.enter="onEnter" />
    <p v-if="multiple && hint" class="text-xs text-muted-foreground">{{ hint }}</p>
    <div class="w-full max-h-96 overflow-y-auto grid! gap-2 pt-1" style="grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));">
      <Tooltip v-for="ch in filtered" :key="ch.id">
        <TooltipTrigger asChild>
          <button
            type="button"
            class="aspect-square max-w-14 rounded-lg border flex items-center justify-center text-base font-bold tabular-nums transition-colors"
            :class="isSelected(ch) ? 'bg-accent/20 border-accent/60 text-accent' : 'border-border/40 text-foreground hover:bg-accent/15 hover:border-accent/50'"
            @click="toggle(ch)"
          >{{ ch.channel }}</button>
        </TooltipTrigger>
        <TooltipContent v-if="ch.device || ch.address || ch.color">
          <p class="text-sm">{{ [ch.device, ch.address ? `DMX ${ch.address}` : null, ch.color].filter(Boolean).join(' · ') }}</p>
        </TooltipContent>
      </Tooltip>
      <div v-if="filtered.length === 0" class="col-span-full text-xs text-muted-foreground px-2 py-4 text-center">
        {{ noneLabel }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps({
  channels: { type: Array, required: true },
  multiple: { type: Boolean, default: false },
  modelValue: { type: Array, default: () => [] },
  search: { type: String, default: undefined },
  searchPlaceholder: { type: String, default: '' },
  noneLabel: { type: String, default: '' },
  hint: { type: String, default: '' },
  limit: { type: Number, default: 200 },
})

const emit = defineEmits(['update:modelValue', 'pick', 'enter', 'update:search'])

const internalSearch = ref(props.search ?? '')
const search = computed({
  get: () => props.search !== undefined ? props.search : internalSearch.value,
  set: (v) => { internalSearch.value = v; emit('update:search', v) },
})
const inputRef = ref(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return props.channels.filter(ch => {
    if (!q) return true
    return (ch.channel ?? '').toLowerCase().includes(q) || (ch.device ?? '').toLowerCase().includes(q)
  }).slice(0, props.limit)
})

function isSelected(ch) {
  return props.modelValue.includes(ch.id)
}

function toggle(ch) {
  if (props.multiple) {
    const next = isSelected(ch) ? props.modelValue.filter(id => id !== ch.id) : [...props.modelValue, ch.id]
    emit('update:modelValue', next)
  } else {
    emit('update:modelValue', [ch.id])
    emit('pick', ch)
  }
}

function onEnter() {
  const first = filtered.value[0]
  if (!first) return
  if (!props.multiple) emit('update:modelValue', [first.id])
  emit('enter', first)
}

defineExpose({
  resetSearch: () => { search.value = '' },
  focus: () => inputRef.value?.$el?.querySelector('input')?.focus(),
})
</script>

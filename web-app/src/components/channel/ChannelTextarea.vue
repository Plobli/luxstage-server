<template>
  <Textarea
    ref="textareaEl"
    :model-value="modelValue"
    v-bind="$attrs"
    rows="1"
    @focus="handleFocus"
    @update:model-value="handleInput"
    @blur="handleBlur"
    :class="[
      'block min-h-10 w-full resize-none overflow-hidden rounded-none border-0 bg-transparent px-3 py-3 text-sm leading-4 text-foreground shadow-none transition-colors placeholder:text-muted-foreground/60 cursor-text focus-visible:outline-none focus-visible:ring-0',
      isFocused ? 'bg-primary/5' : '',
    ]"
  />
</template>

<script setup>
import { nextTick, onMounted, ref, onBeforeUnmount } from 'vue'
import { Textarea } from '@/components/ui/textarea'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'input', 'focus', 'blur'])
const textareaEl = ref(null)
const isFocused = ref(false)

function getNativeTextarea() {
  return textareaEl.value?.$el instanceof HTMLTextAreaElement
    ? textareaEl.value.$el
    : textareaEl.value
}

function autoResize() {
  const el = getNativeTextarea()
  if (!el) return
  // Beide Reads vor dem Write — kein Reflow-Thrashing. Höhe folgt nur dem
  // Inhalt (min-h-10); die vertikale Zentrierung übernimmt der Flex-Wrapper
  // (items-center) per CSS, wenn die Nachbarspalte höher ist.
  const minHeight = 40
  el.style.height = '0'
  const next = Math.max(minHeight, el.scrollHeight)
  el.style.height = `${next}px`
}

function handleInput(val) {
  emit('update:modelValue', val)
  emit('input', val)
  autoResize()
}

function handleFocus(event) {
  isFocused.value = true
  emit('focus', event)
  autoResize()
}

function handleBlur(event) {
  isFocused.value = false
  emit('blur', event)
}

let resizeObserver = null
let lastWidth = 0

onMounted(() => {
  const el = getNativeTextarea()
  if (!el) return

  // ResizeObserver nur bei Breiten-Änderung, nicht bei Höhen-Änderung (die wir selbst setzen)
  resizeObserver = new ResizeObserver(entries => {
    const w = entries[0]?.contentRect.width ?? 0
    if (w !== lastWidth) { lastWidth = w; autoResize() }
  })
  resizeObserver.observe(el)

  nextTick(autoResize)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div ref="rootEl" class="relative h-full min-h-(--channel-row-min-h) w-full flex items-center">
    <input
      ref="inputRef"
      type="text"
      :value="displayValue"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.down="open && options.length ? (moveDown(), $event.preventDefault()) : null"
      @keydown.up="open && options.length ? (moveUp(), $event.preventDefault()) : null"
      @keydown.enter.prevent="onEnter"
      @keydown.escape="open = false"
      @keydown="$emit('keydown', $event)"
      @click.stop
      :placeholder="placeholder"
      autocomplete="off"
      :style="badgeStyle"
      class="h-full w-full rounded border-0 px-1 py-0 text-center text-sm font-medium shadow-none placeholder:text-muted-foreground/40 focus-visible:outline-none"
    />
    <ul
      v-if="open && (options.length > 0 || canCreate)"
      class="absolute left-0 z-50 min-w-full w-max max-w-28 max-h-56 overflow-y-auto rounded-md bg-popover text-popover-foreground border border-border shadow-xl text-sm"
      :class="openUpward ? 'bottom-full mb-1' : 'top-full mt-1'"
    >
      <li
        v-for="(opt, idx) in options"
        :key="opt"
        @mousedown.prevent="select(opt)"
        :class="[
          'px-3 py-1.5 cursor-pointer text-center',
          idx === activeIdx ? 'bg-muted' : 'hover:bg-muted/50',
        ]"
      >{{ opt }}</li>
      <li
        v-if="canCreate"
        @mousedown.prevent="select(localInput.trim())"
        :class="[
          'px-3 py-1.5 cursor-pointer text-center text-muted-foreground border-t border-border/40',
          activeIdx === options.length ? 'bg-muted' : 'hover:bg-muted/50',
        ]"
      >+ „{{ localInput.trim() }}“</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { sequenceOrderColor, contrastColor } from '@shared/color.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  existingValues: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'change', 'keydown', 'blur'])

const open = ref(false)
const activeIdx = ref(0)
const isEditing = ref(false)
const rootEl = ref(null)
const inputRef = ref(null)
const openUpward = ref(false)
const DROPDOWN_MAX_HEIGHT = 224 // max-h-56

const localInput = ref('')

const displayValue = computed(() => isEditing.value ? localInput.value : (props.modelValue || ''))

const badgeStyle = computed(() => {
  if (isEditing.value) return {}
  const bg = sequenceOrderColor(props.modelValue)
  if (!bg) return {}
  return { backgroundColor: bg, color: contrastColor(bg) }
})

const options = computed(() => {
  const q = localInput.value.trim().toLowerCase()
  const all = [...new Set(props.existingValues.filter(v => v))]
  if (!q) return all
  return all.filter(v => v.toLowerCase().includes(q))
})

const canCreate = computed(() => {
  const q = localInput.value.trim()
  return !!q && !options.value.some(o => o.toLowerCase() === q.toLowerCase())
})

watch(() => props.modelValue, (val) => {
  // Auch während der Bearbeitung übernehmen, wenn der neue Wert von außen kommt
  // (z.B. Undo/Redo lädt die Kanäle neu) — sonst sendet ein späterer Blur noch
  // den alten, vor dem Undo eingegebenen Wert und überschreibt das Undo/Redo-
  // Ergebnis wieder (siehe flushAllPendingSaves-Kommentar in ShowDetailView.vue).
  localInput.value = val || ''
})

function onFocus() {
  isEditing.value = true
  localInput.value = props.modelValue || ''
  open.value = true
  activeIdx.value = 0
  const rect = rootEl.value?.getBoundingClientRect()
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    openUpward.value = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow
  }
}

function onInput(e) {
  localInput.value = e.target.value
  open.value = true
  activeIdx.value = 0
}

function onBlur() {
  setTimeout(() => {
    open.value = false
    isEditing.value = false
    localInput.value = props.modelValue || ''
  }, 150)
  if (localInput.value.trim() !== (props.modelValue || '')) {
    emit('update:modelValue', localInput.value.trim())
    emit('change')
  }
  emit('blur')
}

function select(value) {
  localInput.value = value
  emit('update:modelValue', value)
  emit('change')
  open.value = false
  inputRef.value?.blur()
}

function onEnter() {
  if (!open.value) return
  const total = options.value.length + (canCreate.value ? 1 : 0)
  if (!total) return
  if (activeIdx.value < options.value.length) select(options.value[activeIdx.value])
  else if (canCreate.value) select(localInput.value.trim())
}

function moveDown() {
  const total = options.value.length + (canCreate.value ? 1 : 0)
  activeIdx.value = Math.min(activeIdx.value + 1, total - 1)
}
function moveUp() {
  activeIdx.value = Math.max(activeIdx.value - 1, 0)
}

defineExpose({
  focus: () => inputRef.value?.focus(),
})
</script>

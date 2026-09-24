<template>
  <div class="relative flex items-center w-full h-full">
    <!-- Combobox-Wrapper: Input + Toggle-Button als eine Einheit -->
    <div
      role="combobox"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-owns="listboxId"
      class="flex w-full h-full items-center"
    >
      <input
        ref="inputRef"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        :id="inputId"
        :aria-controls="listboxId"
        :aria-autocomplete="'none'"
        :value="modelValue ?? ''"
        :placeholder="placeholder"
        @input="onInput"
        @blur="onBlur"
        @keydown="onKeydown"
        @focus="onFocus($event)"
        @click.stop
        autocomplete="off"
        class="h-full min-h-8 w-full rounded-none border-0 bg-transparent pl-1 pr-3 py-0 text-center text-sm text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
      />
      <button
        type="button"
        tabindex="-1"
        :aria-label="open ? 'Liste schließen' : 'Vorschläge anzeigen'"
        @mousedown.prevent="toggleDropdown"
        class="absolute right-0 top-0 h-full w-6 flex items-center justify-center leading-none pb-1 text-2xl text-muted-foreground/60 hover:text-muted-foreground/90 focus:outline-none"
      >▾</button>
    </div>

    <!-- Listbox -->
    <ul
      v-if="open"
      :id="listboxId"
      role="listbox"
      class="absolute top-full left-0 z-50 mt-0.5 max-h-56 w-full min-w-12 overflow-y-auto rounded border border-border bg-popover shadow-md py-0.5 list-none m-0 p-0"
    >
      <li
        v-for="(n, i) in options"
        :key="n"
        role="option"
        :aria-selected="n === modelValue"
        :data-index="i"
        @mousedown.prevent="select(n)"
        class="px-2 py-1 text-center text-sm cursor-default select-none"
        :class="[
          n === modelValue ? 'text-foreground font-semibold' : 'text-muted-foreground',
          activeIndex === i ? 'bg-muted/60' : 'hover:bg-muted/40',
        ]"
      >{{ n }}</li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: null },
  min: { type: Number, default: 1 },
  max: { type: Number, default: 99 },
  placeholder: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const uid = Math.random().toString(36).slice(2, 7)
const inputId = `num-input-${uid}`
const listboxId = `num-list-${uid}`

const inputRef = ref(null)
const open = ref(false)
const activeIndex = ref(-1)

const options = Array.from({ length: props.max - props.min + 1 }, (_, i) => props.min + i)

function clamp(v) {
  const n = parseInt(v)
  if (isNaN(n)) return null
  if (n < props.min) return props.min
  if (n > props.max) return props.max
  return n
}

function onFocus(e) {
  e.target.select()
  openList()
}

function openList() {
  open.value = true
  activeIndex.value = options.indexOf(props.modelValue)
}

function closeList() {
  open.value = false
  activeIndex.value = -1
}

function toggleDropdown() {
  open.value ? closeList() : openList()
  inputRef.value?.focus()
}

function select(n) {
  emit('update:modelValue', n)
  closeList()
  inputRef.value?.focus()
}

function onInput(e) {
  const raw = e.target.value.replace(/\D/g, '')
  e.target.value = raw
  emit('update:modelValue', raw === '' ? null : clamp(raw))
}

function onBlur(e) {
  const v = e.target.value === '' ? null : clamp(e.target.value)
  e.target.value = v ?? ''
  emit('update:modelValue', v)
  // Verzögerung damit mousedown auf Listbox-Optionen noch feuern kann
  setTimeout(closeList, 200)
}

function onKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!open.value) openList()
    activeIndex.value = Math.min(activeIndex.value + 1, options.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!open.value) openList()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter' && open.value && activeIndex.value >= 0) {
    e.preventDefault()
    select(options[activeIndex.value])
  } else if (e.key === 'Escape') {
    closeList()
  }
}
</script>

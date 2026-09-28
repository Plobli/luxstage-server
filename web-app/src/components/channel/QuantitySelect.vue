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
        :value="modelValue"
        @input="onInput"
        @blur="onBlur"
        @keydown="onKeydown"
        @focus="onFocus($event)"
        autocomplete="off"
        class="h-full min-h-(--channel-row-min-h) w-full rounded-none border-0 bg-transparent pl-1 pr-3 py-0 text-center text-sm text-foreground shadow-none focus-visible:ring-0"
      />
      <button
        type="button"
        tabindex="-1"
        :aria-label="open ? 'Liste schließen' : 'Vorschläge anzeigen'"
        @mousedown.prevent="toggleDropdown"
        class="absolute right-0 top-0 h-full w-8 flex items-center justify-center leading-none pb-1 text-3xl text-muted-foreground/60 hover:text-muted-foreground/90 focus:outline-none"
      >▾</button>
    </div>

    <!-- Listbox -->
    <ul
      v-if="open"
      :id="listboxId"
      role="listbox"
      :aria-label="'Anzahl wählen'"
      class="absolute top-full left-0 z-50 mt-0.5 w-full min-w-12 rounded border border-border bg-popover shadow-md py-0.5 list-none m-0 p-0"
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
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: Number, default: 1 },
})

const emit = defineEmits(['update:modelValue'])

const uid = Math.random().toString(36).slice(2, 7)
const inputId = `qty-input-${uid}`
const listboxId = `qty-list-${uid}`

const inputRef = ref(null)
const open = ref(false)
const activeIndex = ref(-1)

const options = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function clamp(v) {
  const n = parseInt(v)
  if (isNaN(n) || n < 1) return 1
  if (n > 99) return 99
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
  if (raw === '') return
  emit('update:modelValue', clamp(raw))
}

function onBlur(e) {
  const v = clamp(e.target.value || props.modelValue)
  e.target.value = v
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

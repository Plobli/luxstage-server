<template>
  <div ref="rootEl" class="relative h-full min-h-10 w-full flex items-center px-1.5">
    <Input
      :model-value="displayValue"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.down="open && filtered.length ? (moveDown(), $event.preventDefault()) : null"
      @keydown.up="open && filtered.length ? (moveUp(), $event.preventDefault()) : null"
      @keydown.enter.prevent="open && filtered.length ? selectActive() : null"
      @keydown.escape="open = false"
      @keydown="$emit('keydown', $event)"
      :placeholder="placeholder"
      :style="isNoColor ? { color: '#b5896a' } : (badgeStyle || {})"
      :class="inputClass"
      class="h-7 w-full rounded-full border border-border/30 px-2 py-0 text-center text-[11px] shadow-none focus-visible:bg-muted/60 focus-visible:border-border/50 focus-visible:ring-0"
      v-bind="inputAttrs"
    />
    <ul
      v-if="open && (showNcOption || filtered.length > 0)"
      class="absolute left-0 z-50 w-72 max-h-96 overflow-y-auto rounded-md bg-popover text-popover-foreground border border-border shadow-xl text-sm"
      :class="openUpward ? 'bottom-full mb-1' : 'top-full mt-1'"
    >
      <li
        v-if="showNcOption"
        @mousedown.prevent="selectNc"
        :class="[
          'flex items-center gap-2 px-3 py-1.5 cursor-pointer border-b border-border/40',
          activeIdx === -1 ? 'bg-muted' : 'hover:bg-muted/50'
        ]"
      >
        <span class="size-4 rounded-full shrink-0 border border-border/50 bg-muted" />
        <span class="font-mono text-xs font-semibold" style="color: #b5896a">NC</span>
        <span class="text-muted-foreground text-xs">{{ t('color.no_color') }}</span>
      </li>
      <li
        v-for="(f, idx) in filtered"
        :key="f.code"
        @mousedown.prevent="select(f)"
        :class="[
          'flex items-center gap-2 px-3 py-1.5 cursor-pointer',
          idx === activeIdx ? 'bg-muted' : 'hover:bg-muted/50'
        ]"
      >
        <span
          class="size-4 rounded-full shrink-0 border border-border/50"
          :style="f.hex ? { backgroundColor: f.hex } : { backgroundColor: '#555' }"
        />
        <span class="text-foreground font-mono text-xs">{{ f.displayCode }}</span>
        <span class="text-muted-foreground text-xs truncate">{{ f.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { ALL_FILTERS, filterBadgeStyle } from '../utils/filterColors.js'
import { useLocale } from '@/composables/useLocale.js'
import { useColorUsage } from '@/composables/useColorUsage.js'
const { t } = useLocale()
const { colorUsageRank } = useColorUsage()

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  inputAttrs: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'change', 'keydown'])

const open = ref(false)
const activeIdx = ref(0)
const isEditing = ref(false)
const hasTyped = ref(false)
const rootEl = ref(null)
const openUpward = ref(false)
const DROPDOWN_MAX_HEIGHT = 384 // max-h-96

// Lokaler Eingabe-Buffer: wird nur während der Eingabe verwendet
const localInput = ref('')

function resolveDisplayCode(value) {
  const raw = (value || '').trim().toUpperCase()
  if (!raw) return ''
  const exact = ALL_FILTERS.find(f => f.code === raw || f.altCode === raw)
  if (exact) return exact.displayCode
  if (/^\d+$/.test(raw)) {
    const normalizedLee = `L${raw.padStart(3, '0')}`
    const normalizedRosco = `R${raw.padStart(2, '0')}`
    const match = ALL_FILTERS.find(f => f.code === normalizedLee || f.altCode === normalizedLee || f.code === normalizedRosco || f.altCode === normalizedRosco)
    if (match) return match.displayCode
  }
  if (/^[LR]\d+$/.test(raw)) {
    const prefix = raw[0]
    const normalized = prefix === 'L' ? `L${raw.slice(1).padStart(3, '0')}` : `R${raw.slice(1).padStart(2, '0')}`
    const match = ALL_FILTERS.find(f => f.code === normalized || f.altCode === normalized)
    if (match) return match.displayCode
  }
  return value
}

// Während der Eingabe: roher Tipp-Wert; sonst: formatierter Display-Code
const displayValue = computed(() => {
  if (isEditing.value) return localInput.value
  return resolveDisplayCode(props.modelValue)
})

const isNoColor = computed(() => (props.modelValue || '').trim().toUpperCase() === 'NC')
const showNcOption = computed(() => {
  const q = (props.modelValue || '').trim().toUpperCase()
  return !q || 'NC'.startsWith(q)
})
const badgeStyle = computed(() => filterBadgeStyle(props.modelValue))
const inputClass = computed(() => {
  if (isNoColor.value) return 'font-semibold bg-muted/35'
  if (!badgeStyle.value) return 'text-muted-foreground placeholder:text-muted-foreground/60 bg-muted/35'
  return 'font-semibold text-current placeholder:text-current/55'
})

// Wenn modelValue von außen gesetzt wird (z.B. nach Select), localInput synchronisieren
watch(() => props.modelValue, (val) => {
  if (!isEditing.value) localInput.value = resolveDisplayCode(val)
})

// Niedrigster (bester) Nutzungsrang eines Filters über beide Codes (LEE/Rosco);
// Infinity, wenn der Filter noch nie verwendet wurde (landet hinten).
function usageRank(f) {
  const a = colorUsageRank.value.get(f.code.toUpperCase())
  const b = f.altCode ? colorUsageRank.value.get(f.altCode.toUpperCase()) : undefined
  const ranks = [a, b].filter(r => r !== undefined)
  return ranks.length ? Math.min(...ranks) : Infinity
}

const filtered = computed(() => {
  // Solange der Nutzer nicht tatsächlich tippt, zeigt das Dropdown die volle
  // Liste (nach Häufigkeit sortiert) statt gegen den evtl. schon gesetzten
  // Wert (z.B. "NC") zu filtern — sonst verschwinden beim Fokussieren eines
  // bereits befüllten Felds fast alle Farben aus der Trefferliste.
  const q = hasTyped.value ? (props.modelValue || '').toUpperCase() : ''
  if (!q) {
    return [...ALL_FILTERS].sort((a, b) => usageRank(a) - usageRank(b))
  }

  const results = ALL_FILTERS.filter(f =>
    f.code.includes(q) ||
    f.code.slice(1).includes(q) ||
    (f.altCode && (f.altCode.includes(q) || f.altCode.slice(1).includes(q))) ||
    f.name.toUpperCase().includes(q)
  )

  // Prefer Rosco order only when user explicitly types "R" prefix
  const preferRosco = q.startsWith('R')

  function matchScore(f) {
    // Exakter Code-Match (z.B. "L200" oder "200" → L200)
    if (f.code.toUpperCase() === q) return 0
    if (f.code.slice(1) === q) return 1
    if (f.altCode && f.altCode.toUpperCase() === q) return 0
    if (f.altCode && f.altCode.slice(1) === q) return 1
    // Code enthält Query am Anfang der Nummer (z.B. "20" → L200 vor L2001)
    if (f.code.slice(1).startsWith(q)) return 2
    if (f.altCode && f.altCode.slice(1).startsWith(q)) return 2
    // Sonstiger Partial-Match (Mitte des Codes oder Name)
    return 3
  }

  results.sort((a, b) => {
    const sa = matchScore(a)
    const sb = matchScore(b)
    if (sa !== sb) return sa - sb
    // Bei gleichem Score: häufiger verwendete Farbe zuerst
    const ua = usageRank(a)
    const ub = usageRank(b)
    if (ua !== ub) return ua - ub
    // Danach: LEE vor Rosco (außer explizit R-Prefix)
    const aIsLee = a.code.startsWith('L')
    const bIsLee = b.code.startsWith('L')
    if (!preferRosco) {
      if (aIsLee !== bIsLee) return aIsLee ? -1 : 1
    } else {
      if (aIsLee !== bIsLee) return aIsLee ? 1 : -1
    }
    return 0
  })

  return results
})

function onFocus() {
  isEditing.value = true
  hasTyped.value = false
  localInput.value = props.modelValue || ''
  open.value = true
  const rect = rootEl.value?.getBoundingClientRect()
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    openUpward.value = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow
  }
}

function onInput(e) {
  hasTyped.value = true
  localInput.value = e.target.value
  emit('update:modelValue', e.target.value)
  open.value = true
  activeIdx.value = 0
}

function onBlur() {
  setTimeout(() => {
    open.value = false
    isEditing.value = false
    hasTyped.value = false
    localInput.value = resolveDisplayCode(props.modelValue)
  }, 150)
  emit('change')
}

function select(f) {
  emit('update:modelValue', f.code)
  emit('change')
  open.value = false
}

function selectNc() {
  emit('update:modelValue', 'NC')
  emit('change')
  open.value = false
}

function moveDown() { activeIdx.value = Math.min(activeIdx.value + 1, filtered.value.length - 1) }
// -1 steht für die "NC"-Option, die (wenn showNcOption) oberhalb der Liste
// gerendert wird — ohne sie wäre sie per Pfeiltaste nie erreichbar.
function moveUp() { activeIdx.value = Math.max(activeIdx.value - 1, showNcOption.value ? -1 : 0) }
function selectActive() {
  if (activeIdx.value === -1 && showNcOption.value) { selectNc(); return }
  if (filtered.value[activeIdx.value]) select(filtered.value[activeIdx.value])
}
</script>

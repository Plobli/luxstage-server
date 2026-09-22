<template>
  <Dialog :open="open" @update:open="!$event && $emit('cancel')">
    <DialogContent class="sm:max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="mb-4">{{ title }}</DialogTitle>
      </DialogHeader>

      <DialogBody class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
        <div v-if="updated.length > 0 || added.length > 0" class="flex flex-col gap-2">
          <div class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {{ t('import.modal.scan.preview.columns') }}
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1.5">
            <label
              v-for="col in COLUMN_KEYS"
              :key="col"
              class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none"
            >
              <Checkbox :model-value="includedColumns.has(col)" @update:model-value="toggleColumn(col)" />
              {{ fieldLabel(col) }}
            </label>
          </div>
        </div>

        <div v-if="updated.length > 0" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium text-accent uppercase tracking-wide">
              {{ t('import.modal.scan.preview.updated', { n: updated.length }) }}
            </div>
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              @click="toggleAll(updated)"
            >
              {{ t('import.modal.scan.preview.toggle_all') }}
            </button>
          </div>
          <div class="flex flex-col divide-y divide-border/50 rounded-lg border border-border overflow-hidden">
            <label
              v-for="row in updated"
              :key="row.channel"
              class="flex items-start gap-3 px-3 py-2 text-sm cursor-pointer select-none"
              :class="{ 'opacity-40': excluded.has(row.channel) }"
            >
              <Checkbox :model-value="!excluded.has(row.channel)" class="mt-0.5 shrink-0" @update:model-value="toggle(row.channel)" />
              <span class="font-mono font-semibold shrink-0 w-10">{{ row.channel }}</span>
              <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                <div
                  v-for="change in row.changes"
                  :key="change.key"
                  class="flex flex-wrap items-baseline gap-x-1.5 text-xs"
                  :class="{ 'opacity-40': !includedColumns.has(change.key) }"
                >
                  <span class="text-muted-foreground shrink-0">{{ fieldLabel(change.key) }}:</span>
                  <span v-if="change.oldValue" class="text-muted-foreground/60 line-through">{{ change.oldValue }}</span>
                  <span class="text-foreground font-medium" :class="{ 'line-through': !includedColumns.has(change.key) }">{{ change.newValue }}</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <div v-if="added.length > 0" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium text-green-400 uppercase tracking-wide">
              {{ t('import.modal.scan.preview.added', { n: added.length }) }}
            </div>
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              @click="toggleAll(added)"
            >
              {{ t('import.modal.scan.preview.toggle_all') }}
            </button>
          </div>
          <div class="flex flex-col divide-y divide-border/50 rounded-lg border border-border overflow-hidden">
            <label
              v-for="ch in added"
              :key="ch.channel"
              class="flex items-start gap-3 px-3 py-2 text-sm cursor-pointer select-none"
              :class="{ 'opacity-40': excluded.has(ch.channel) }"
            >
              <Checkbox :model-value="!excluded.has(ch.channel)" class="mt-0.5 shrink-0" @update:model-value="toggle(ch.channel)" />
              <span class="font-mono font-semibold shrink-0 w-10">{{ ch.channel }}</span>
              <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground min-w-0">
                <span v-if="ch.address" :class="{ 'opacity-40 line-through': !includedColumns.has('address') }">{{ t('field.dmx_address') }}: <span class="text-foreground">{{ ch.address }}</span></span>
                <span v-if="ch.device" :class="{ 'opacity-40 line-through': !includedColumns.has('device') }">{{ t('field.device') }}: <span class="text-foreground">{{ ch.device }}</span></span>
                <span v-if="ch.position" :class="{ 'opacity-40 line-through': !includedColumns.has('position') }">{{ t('field.position') }}: <span class="text-foreground">{{ ch.position }}</span></span>
                <span v-if="ch.color" :class="{ 'opacity-40 line-through': !includedColumns.has('color') }">{{ t('field.color') }}: <span class="text-foreground">{{ ch.color }}</span></span>
                <span v-if="ch.notes" :class="{ 'opacity-40 line-through': !includedColumns.has('notes') }">{{ t('field.notes') }}: <span class="text-foreground">{{ ch.notes }}</span></span>
              </div>
            </label>
          </div>
        </div>

        <div v-if="freitext" class="flex flex-col gap-2">
          <div class="text-xs font-medium text-accent uppercase tracking-wide">
            {{ t('import.modal.planScan.preview.freitextTitle') }}
          </div>
          <pre class="whitespace-pre-wrap rounded-lg border border-border p-3 text-xs text-foreground max-h-40 overflow-y-auto">{{ freitext }}</pre>
          <label class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" v-model="applyFreitext" class="accent-accent" />
            {{ applyFreitext && freitextMode === 'replace' ? t('import.modal.planScan.preview.freitextReplace') : t('import.modal.planScan.preview.freitextAppend') }}
          </label>
          <label v-if="applyFreitext" class="flex items-center gap-3 text-xs text-muted-foreground pl-6">
            <span class="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" value="append" v-model="freitextMode" class="accent-accent" />
              {{ t('import.modal.planScan.preview.freitextAppend') }}
            </span>
            <span class="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" value="replace" v-model="freitextMode" class="accent-accent" />
              {{ t('import.modal.planScan.preview.freitextReplace') }}
            </span>
          </label>
        </div>
      </DialogBody>

      <DialogFooter class="gap-3 flex-wrap">
        <Button variant="outline" class="w-full sm:w-auto" @click="$emit('resolve', false)">
          {{ t('action.cancel') }}
        </Button>
        <Button class="w-full sm:w-auto" :disabled="applyCount === 0 && !applyFreitext" @click="$emit('resolve', true, excluded, applyFreitext, freitextMode, includedColumns)">
          {{ t('import.modal.scan.preview.apply', { n: applyCount }) }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useLocale } from '../../composables/useLocale.js'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'

const { t } = useLocale()

const props = defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, required: true },
  updated: { type: Array, default: () => [] },
  added: { type: Array, default: () => [] },
  freitext: { type: String, default: '' },
  // Trennt die gemerkte Spaltenauswahl in localStorage zwischen Foto- und
  // PDF-Import — z.B. "Gerät" bei PDF-Scans dauerhaft abwählen, ohne den
  // Foto-Scan-Flow zu beeinflussen.
  scanType: { type: String, default: 'circuit' },
})

defineEmits(['resolve', 'cancel'])

const COLUMN_KEYS = ['address', 'device', 'position', 'color', 'notes']

function columnsStorageKey() {
  return `scanImport.columns.${props.scanType}`
}

function loadIncludedColumns() {
  try {
    const raw = localStorage.getItem(columnsStorageKey())
    if (!raw) return new Set(COLUMN_KEYS)
    const stored = JSON.parse(raw)
    return new Set(COLUMN_KEYS.filter(col => stored.includes(col)))
  } catch {
    return new Set(COLUMN_KEYS)
  }
}

const excluded = ref(new Set())
const applyFreitext = ref(false)
const freitextMode = ref('append')
const includedColumns = ref(loadIncludedColumns())

// Bei jedem neuen Scan (Dialog öffnet) die Zeilen-Auswahl zurücksetzen — alles
// per Default einbezogen, Nutzer wählt gezielt ab statt erst alles abwählen zu
// müssen. Die Spaltenauswahl bleibt bewusst bestehen (siehe scanType-Prop).
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    excluded.value = new Set()
    applyFreitext.value = false
    freitextMode.value = 'append'
    includedColumns.value = loadIncludedColumns()
  }
})

function toggleColumn(col) {
  const next = new Set(includedColumns.value)
  if (next.has(col)) next.delete(col)
  else next.add(col)
  includedColumns.value = next
  try {
    localStorage.setItem(columnsStorageKey(), JSON.stringify([...next]))
  } catch {
    // localStorage kann in Private-Browsing/mit vollem Speicher fehlschlagen —
    // Auswahl bleibt für diese Sitzung trotzdem im State erhalten.
  }
}

function toggle(channel) {
  const next = new Set(excluded.value)
  if (next.has(channel)) next.delete(channel)
  else next.add(channel)
  excluded.value = next
}

function toggleAll(rows) {
  const channels = rows.map(r => r.channel)
  const allExcluded = channels.every(ch => excluded.value.has(ch))
  const next = new Set(excluded.value)
  for (const ch of channels) {
    if (allExcluded) next.delete(ch)
    else next.add(ch)
  }
  excluded.value = next
}

const applyCount = computed(() =>
  props.updated.filter(r => !excluded.value.has(r.channel)).length +
  props.added.filter(r => !excluded.value.has(r.channel)).length
)

const FIELD_LABEL_KEYS = {
  address: 'field.dmx_address',
  device: 'field.device',
  position: 'field.position',
  color: 'field.color',
  notes: 'field.notes',
}

function fieldLabel(key) {
  return t(FIELD_LABEL_KEYS[key] ?? key)
}
</script>

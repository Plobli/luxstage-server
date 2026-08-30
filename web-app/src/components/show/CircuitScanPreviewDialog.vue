<template>
  <Dialog :open="open" @update:open="!$event && $emit('cancel')">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="mb-4">{{ t('import.modal.scan.preview.title') }}</DialogTitle>
      </DialogHeader>

      <DialogBody class="max-h-[60vh] overflow-y-auto flex flex-col gap-5">
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
                <div v-for="change in row.changes" :key="change.key" class="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                  <span class="text-muted-foreground shrink-0">{{ fieldLabel(change.key) }}:</span>
                  <span v-if="change.oldValue" class="text-muted-foreground/60 line-through">{{ change.oldValue }}</span>
                  <span class="text-foreground font-medium">{{ change.newValue }}</span>
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
                <span v-if="ch.address">{{ t('field.dmx_address') }}: <span class="text-foreground">{{ ch.address }}</span></span>
                <span v-if="ch.device">{{ t('field.device') }}: <span class="text-foreground">{{ ch.device }}</span></span>
                <span v-if="ch.position">{{ t('field.position') }}: <span class="text-foreground">{{ ch.position }}</span></span>
                <span v-if="ch.color">{{ t('field.color') }}: <span class="text-foreground">{{ ch.color }}</span></span>
                <span v-if="ch.notes">{{ t('field.notes') }}: <span class="text-foreground">{{ ch.notes }}</span></span>
              </div>
            </label>
          </div>
        </div>
      </DialogBody>

      <DialogFooter class="gap-3 flex-wrap">
        <Button variant="outline" class="w-full sm:w-auto" @click="$emit('resolve', false)">
          {{ t('action.cancel') }}
        </Button>
        <Button class="w-full sm:w-auto" :disabled="applyCount === 0" @click="$emit('resolve', true, excluded)">
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
  updated: { type: Array, default: () => [] },
  added: { type: Array, default: () => [] },
})

defineEmits(['resolve', 'cancel'])

const excluded = ref(new Set())

// Bei jedem neuen Scan (Dialog öffnet) die Auswahl zurücksetzen — alles per
// Default einbezogen, Nutzer wählt gezielt ab statt erst alles abwählen zu müssen.
watch(() => props.open, (isOpen) => {
  if (isOpen) excluded.value = new Set()
})

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

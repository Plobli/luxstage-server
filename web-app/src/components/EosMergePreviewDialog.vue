<template>
  <Dialog :open="open" @update:open="!$event && $emit('cancel')">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle class="mb-4">{{ t('eos.preview.title') }}</DialogTitle>
      </DialogHeader>

      <DialogBody class="max-h-[60vh] overflow-y-auto">
        <!-- Neu aktiv (gelb) -->
        <div v-if="newActive.length > 0" class="flex flex-col gap-1">
          <div class="text-xs font-medium text-yellow-400 uppercase tracking-wide">
            {{ t('eos.preview.new_active', { n: newActive.length }) }}
          </div>
          <div class="flex flex-wrap gap-1">
            <Badge
              v-for="ch in newActive"
              :key="ch.nr"
              variant="outline"
              class="bg-yellow-500/15 text-yellow-300 border-yellow-500/30 font-normal"
            >
              <span class="font-mono font-medium">{{ ch.nr }}</span>
              <span v-if="ch.label" class="ml-1 text-yellow-400/70">{{ ch.label }}</span>
            </Badge>
          </div>
        </div>

        <!-- Inaktiv geworden (grau) -->
        <div v-if="nowGone.length > 0" class="flex flex-col gap-1">
          <div class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {{ t('eos.preview.now_gone', { n: nowGone.length }) }}
          </div>
          <div class="flex flex-wrap gap-1">
            <Badge
              v-for="ch in nowGone"
              :key="ch.nr"
              variant="outline"
              class="bg-muted/40 text-muted-foreground border-border line-through font-normal"
            >
              <span class="font-mono font-medium">{{ ch.nr }}</span>
              <span v-if="ch.label" class="ml-1 opacity-70">{{ ch.label }}</span>
            </Badge>
          </div>
        </div>

        <!-- Unangetastet (grün, haben Beschreibung) -->
        <div v-if="untouched.length > 0" class="flex flex-col gap-1">
          <div class="text-xs font-medium text-emerald-400 uppercase tracking-wide">
            {{ t('eos.preview.untouched', { n: untouched.length }) }}
          </div>
          <div class="flex flex-wrap gap-1">
            <Badge
              v-for="ch in untouched"
              :key="ch.nr"
              variant="outline"
              class="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-normal"
            >
              <span class="font-mono font-medium">{{ ch.nr }}</span>
              <span v-if="ch.label" class="ml-1 text-emerald-400/70">{{ ch.label }}</span>
            </Badge>
          </div>
        </div>

        <!-- Adresse weicht ab (orange) — Nutzer entscheidet per Toggle, ob übernommen wird.
             Standardmäßig nichts ausgewählt: ein Klick auf "Importieren" ohne bewusste
             Entscheidung darf keine bestehenden Adressen stillschweigend überschreiben.
             flex-col + gap ersetzt bewusst mb-*, weil .dialog-body > div per CSS einen
             eigenen 1.625rem-Gap zwischen den Kindern dieses Divs erzwingt. -->
        <div v-if="addressMismatch.length > 0" class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium text-orange-400 uppercase tracking-wide">
              {{ t('eos.preview.address_mismatch', { n: addressMismatch.length }) }}
            </div>
            <div class="flex items-center gap-4">
              <button
                type="button"
                class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                @click="selectAllAddresses"
              >
                {{ t('eos.preview.apply_all') }}
              </button>
              <button
                type="button"
                class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                @click="selectNoAddresses"
              >
                {{ t('eos.preview.apply_none') }}
              </button>
            </div>
          </div>
          <p class="text-xs text-muted-foreground/70">{{ t('eos.preview.address_hint') }}</p>
          <div class="grid gap-y-1.5 gap-x-3" style="grid-template-columns: auto 1fr auto auto auto;">
            <!-- Spaltenüberschriften — eigene Zeile mit identischem Grid, damit sie garantiert über den Datenzellen sitzen -->
            <span />
            <span />
            <span class="text-[0.65rem] text-muted-foreground/50 uppercase tracking-wide text-right pb-0.5">{{ t('eos.preview.old_address') }}</span>
            <span />
            <span class="text-[0.65rem] text-muted-foreground/50 uppercase tracking-wide pb-0.5">{{ t('eos.preview.new_address') }}</span>

            <template v-for="ch in addressMismatch" :key="ch.nr">
              <span class="font-mono font-medium text-xs self-center pr-2">{{ ch.nr }}</span>
              <span class="text-muted-foreground text-xs self-center pr-2">{{ ch.label }}</span>
              <span class="text-muted-foreground/70 text-xs self-center text-right">{{ ch.oldAddress }}</span>
              <Toggle
                :modelValue="applyAddresses.has(ch.nr)"
                @update:modelValue="v => setApplyAddress(ch.nr, v)"
                size="sm"
                :title="applyAddresses.has(ch.nr) ? t('eos.preview.apply_address') : t('eos.preview.keep_address')"
                class="justify-self-center data-[state=on]:bg-orange-500/20 data-[state=on]:text-orange-300 data-[state=off]:text-muted-foreground/50"
              >
                <ArrowRight v-if="applyAddresses.has(ch.nr)" class="size-3.5" />
                <ArrowLeft v-else class="size-3.5" />
              </Toggle>
              <span class="text-muted-foreground/70 text-xs self-center">{{ ch.newAddress }}</span>
            </template>
          </div>
        </div>

        <!-- Keine Änderungen -->
        <p v-if="newActive.length === 0 && nowGone.length === 0 && untouched.length === 0 && addressMismatch.length === 0" class="text-sm text-muted-foreground">
          {{ t('eos.preview.empty') }}
        </p>

        <!-- Folge des Imports benennen: der Dialog zeigte bisher nur, welche
             Kanäle betroffen sind, nicht was mit ihren Daten passiert. -->
        <p v-else class="text-xs text-muted-foreground/70 border-t border-border/50 pt-3">
          {{ t('eos.preview.consequence') }}
        </p>
      </DialogBody>

      <DialogFooter class="gap-3 flex-wrap">
        <Button variant="outline" class="w-full sm:w-auto" @click="$emit('cancel')">
          {{ t('action.cancel') }}
        </Button>
        <Button class="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground" @click="$emit('confirm', applyAddresses)">
          {{ t('eos.preview.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ArrowRight, ArrowLeft } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { useLocale } from '../composables/useLocale.js'

const { t } = useLocale()

const props = defineProps({
  open: { type: Boolean, required: true },
  // Array of { nr: string, label?: string }
  newActive: { type: Array, default: () => [] },
  nowGone:   { type: Array, default: () => [] },
  untouched: { type: Array, default: () => [] },
  // Array of { nr: string, label?: string, oldAddress: string, newAddress: string }
  addressMismatch: { type: Array, default: () => [] },
})

defineEmits(['confirm', 'cancel'])

// Standardmäßig ist nichts ausgewählt: ein Klick auf "Importieren" ohne
// bewusste Entscheidung darf keine bestehenden Adressen überschreiben.
// Der Nutzer wählt pro Kanal einzeln oder per "Alle übernehmen" aus.
// Setzt sich bei jedem neuen Import zurück.
const applyAddresses = ref(new Set())
watch(() => props.addressMismatch, () => {
  applyAddresses.value = new Set()
}, { immediate: true })

function setApplyAddress(nr, apply) {
  const next = new Set(applyAddresses.value)
  if (apply) next.add(nr)
  else next.delete(nr)
  applyAddresses.value = next
}

function selectAllAddresses() {
  applyAddresses.value = new Set(props.addressMismatch.map(ch => ch.nr))
}

function selectNoAddresses() {
  applyAddresses.value = new Set()
}
</script>

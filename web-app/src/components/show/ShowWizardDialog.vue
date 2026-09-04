<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t('show.wizard.title') }}</DialogTitle>
      </DialogHeader>

      <div class="px-6 pt-1">
        <Progress :model-value="progress" :max="100" class="h-1.5" />
        <div class="mt-2 text-xs text-muted-foreground">{{ t('show.wizard.step', { current: stepPosition, total: steps.length }) }} · {{ t(currentStep.labelKey) }}</div>
      </div>

      <DialogBody class="min-h-72">
        <!-- Vorlage -->
        <div v-if="currentStep.id === 'template'" class="flex flex-col gap-2">
          <p class="text-sm text-muted-foreground mb-1">{{ t('show.wizard.template.hint') }}</p>
          <button
            type="button"
            class="flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
            :class="form.template === '__none__' ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'"
            @click="form.template = '__none__'"
          >
            <FileX class="size-4 shrink-0 text-muted-foreground" />
            <span class="text-sm font-medium">{{ t('show.template.none') }}</span>
          </button>
          <button
            v-for="tpl in templates"
            :key="tpl.name"
            type="button"
            class="flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
            :class="form.template === tpl.name ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'"
            @click="form.template = tpl.name"
          >
            <LayoutTemplate class="size-4 shrink-0 text-muted-foreground" />
            <span class="text-sm font-medium flex-1 min-w-0 truncate">{{ templateDisplayName(tpl.name) }}</span>
            <span class="text-xs text-muted-foreground shrink-0">{{ t('show.wizard.template.channelCount', { count: tpl.channelCount ?? 0 }) }}</span>
          </button>
        </div>

        <!-- Name/Datum -->
        <div v-else-if="currentStep.id === 'info'" class="flex flex-col gap-4">
          <div>
            <Label for="wizName">{{ t('show.name') }}</Label>
            <Input size="lg" id="wizName" v-model="form.name" type="text" required autofocus />
          </div>
          <div>
            <Label for="wizDate">{{ t('show.date') }}</Label>
            <Input size="lg" id="wizDate" v-model="form.datum" type="date" />
          </div>
          <div>
            <Label for="wizSpielzeit">{{ t('field.spielzeit') }}</Label>
            <Input size="lg" id="wizSpielzeit" v-model="form.spielzeit" type="text" :placeholder="t('show.meta.spielzeit.placeholder')" />
          </div>
        </div>

        <!-- Bereiche aktivieren + Kreise -->
        <div v-else-if="currentStep.id === 'areas'" class="flex flex-col gap-2">
          <Label class="mb-1">{{ t('show.meta.areas') }}</Label>
          <label class="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer select-none hover:bg-muted/50">
            <Checkbox v-model="form.use_towers" />
            <Layers class="size-4 text-muted-foreground" />
            <span class="text-sm flex-1">{{ t('tab.towers') }}</span>
          </label>
          <label class="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer select-none hover:bg-muted/50">
            <Checkbox v-model="form.use_bars" />
            <AlignJustify class="size-4 text-muted-foreground" />
            <span class="text-sm flex-1">{{ t('tab.bars') }}</span>
          </label>

          <template v-if="form.template !== '__none__'">
            <Label class="mt-3 mb-1">{{ t('show.wizard.templateImport') }}</Label>
            <label class="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer select-none hover:bg-muted/50">
              <Checkbox v-model="form.importChannels" />
              <Radio class="size-4 text-muted-foreground" />
              <span class="text-sm flex-1">{{ t('show.channels') }}</span>
            </label>
          </template>
        </div>

        <!-- Bereiche/Sections einzeln auswählen -->
        <div v-else-if="currentStep.id === 'sections'" class="flex flex-col gap-2">
          <p class="text-sm text-muted-foreground mb-1">{{ t('show.wizard.sections.hint') }}</p>
          <label
            v-for="sec in templateSections"
            :key="sec.id"
            class="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer select-none hover:bg-muted/50"
          >
            <Checkbox :model-value="selectedSectionIds.has(sec.id)" @update:model-value="toggleSelection(selectedSectionIds, sec.id)" />
            <LayoutList class="size-4 text-muted-foreground" />
            <span class="text-sm flex-1 truncate">{{ sec.title || t('show.wizard.sections.untitled') }}</span>
          </label>
        </div>

        <!-- Obermaschinerie einzeln auswählen -->
        <div v-else-if="currentStep.id === 'bars'" class="flex flex-col gap-2">
          <p class="text-sm text-muted-foreground mb-1">{{ t('show.wizard.bars.hint') }}</p>
          <label
            v-for="bar in templateBars"
            :key="bar.id"
            class="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer select-none hover:bg-muted/50"
          >
            <Checkbox :model-value="selectedBarIds.has(bar.id)" @update:model-value="toggleSelection(selectedBarIds, bar.id)" />
            <AlignJustify class="size-4 text-muted-foreground" />
            <span class="text-sm flex-1 truncate">{{ bar.name }}</span>
          </label>
        </div>

        <!-- Beleuchtungsgestelle einzeln auswählen -->
        <div v-else-if="currentStep.id === 'towers'" class="flex flex-col gap-2">
          <p class="text-sm text-muted-foreground mb-1">{{ t('show.wizard.towers.hint') }}</p>
          <label
            v-for="tower in templateTowers"
            :key="tower.id"
            class="flex items-center gap-3 rounded-lg border border-border px-4 py-3 cursor-pointer select-none hover:bg-muted/50"
          >
            <Checkbox :model-value="selectedTowerIds.has(tower.id)" @update:model-value="toggleSelection(selectedTowerIds, tower.id)" />
            <Layers class="size-4 text-muted-foreground" />
            <span class="text-sm flex-1 truncate">{{ tower.name }}</span>
          </label>
        </div>

        <!-- Zusammenfassung -->
        <div v-else-if="currentStep.id === 'summary'" class="flex flex-col gap-3">
          <div class="rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
            <div class="grid grid-cols-[9rem_1fr] gap-x-3 px-4 py-2.5 text-sm">
              <span class="text-muted-foreground">{{ t('show.name') }}</span>
              <span class="font-medium text-right">{{ form.name || '—' }}</span>
            </div>
            <div class="grid grid-cols-[9rem_1fr] gap-x-3 px-4 py-2.5 text-sm">
              <span class="text-muted-foreground">{{ t('show.date') }}</span>
              <span class="font-medium text-right">{{ formatDatum(form.datum, '—') }}</span>
            </div>
            <div class="grid grid-cols-[9rem_1fr] gap-x-3 px-4 py-2.5 text-sm">
              <span class="text-muted-foreground">{{ t('field.spielzeit') }}</span>
              <span class="font-medium text-right">{{ form.spielzeit || '—' }}</span>
            </div>
            <div class="grid grid-cols-[9rem_1fr] gap-x-3 px-4 py-2.5 text-sm">
              <span class="text-muted-foreground">{{ t('show.template') }}</span>
              <span class="font-medium text-right">{{ form.template === '__none__' ? t('show.template.none') : templateDisplayName(form.template) }}</span>
            </div>
            <div class="grid grid-cols-[9rem_1fr] gap-x-3 px-4 py-2.5 text-sm">
              <span class="text-muted-foreground">{{ t('show.meta.areas') }}</span>
              <span class="font-medium text-right">{{ areasSummary }}</span>
            </div>
            <div v-if="form.template !== '__none__'" class="grid grid-cols-[9rem_1fr] gap-x-3 px-4 py-2.5 text-sm">
              <span class="text-muted-foreground">{{ t('show.wizard.templateImport') }}</span>
              <span class="font-medium text-right">{{ importSummary }}</span>
            </div>
          </div>
        </div>
      </DialogBody>

      <DialogFooter class="flex items-center justify-between sm:justify-between">
        <Button variant="outline" type="button" @click="back">
          {{ stepIndex === 0 ? t('action.cancel') : t('action.back') }}
        </Button>
        <Button type="button" :disabled="!canProceed || creating" @click="next">
          <Loader2 v-if="creating" class="mr-2 size-4 animate-spin" />
          {{ nextLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Loader2, FileX, LayoutTemplate, Layers, AlignJustify, Radio, LayoutList } from 'lucide-vue-next'
import { useLocale } from '../../composables/useLocale.js'
import { useShowWizard } from '../../composables/useShowWizard.js'
import { templateDisplayName } from '../../utils/templateName.js'
import { formatDatum } from '../../utils/index.ts'

import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

const props = defineProps({
  open: { type: Boolean, default: false },
  templates: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:open', 'created'])

const { t } = useLocale()

// Reine Darstellung + Schrittnavigation: Formularstate, Vorlagendetails und
// das Anlegen der Show laufen über useShowWizard.js, damit die Komponente
// ohne laufenden Server darstellbar bleibt (F-04).
const {
  form, templateSections, templateBars, templateTowers,
  selectedSectionIds, selectedBarIds, selectedTowerIds,
  creating, toggleSelection, reset: resetWizard, createShowFromWizard,
} = useShowWizard()

const stepIndex = ref(0)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    stepIndex.value = 0
    resetWizard()
  }
})

// Dynamische Schrittliste: Auswahl-Schritte erscheinen nur, wenn eine Vorlage
// gewählt ist, der jeweilige Bereich aktiviert ist (bars/towers) und die
// Vorlage überhaupt Einträge dafür hat.
const steps = computed(() => {
  const hasTemplate = form.value.template !== '__none__'
  const list = [
    { id: 'template', labelKey: 'show.wizard.step.template' },
    { id: 'info', labelKey: 'show.wizard.step.info' },
    { id: 'areas', labelKey: 'show.wizard.step.areas' },
  ]
  if (hasTemplate && templateSections.value.length) {
    list.push({ id: 'sections', labelKey: 'show.wizard.step.sections' })
  }
  if (hasTemplate && form.value.use_bars && templateBars.value.length) {
    list.push({ id: 'bars', labelKey: 'show.wizard.step.bars' })
  }
  if (hasTemplate && form.value.use_towers && templateTowers.value.length) {
    list.push({ id: 'towers', labelKey: 'show.wizard.step.towers' })
  }
  list.push({ id: 'summary', labelKey: 'show.wizard.step.summary' })
  return list
})

const currentStep = computed(() => steps.value[Math.min(stepIndex.value, steps.value.length - 1)])
const stepPosition = computed(() => Math.min(stepIndex.value, steps.value.length - 1) + 1)
const progress = computed(() => (stepPosition.value / steps.value.length) * 100)

const canProceed = computed(() => {
  if (currentStep.value.id === 'info') return !!form.value.name.trim()
  return true
})

const nextLabel = computed(() => {
  if (currentStep.value.id === 'summary') return creating.value ? t('show.creating') : t('show.create')
  return t('action.next')
})

const areasSummary = computed(() => {
  const parts = []
  if (form.value.use_towers) parts.push(t('tab.towers'))
  if (form.value.use_bars) parts.push(t('tab.bars'))
  return parts.length ? parts.join(', ') : t('show.wizard.areas.none')
})

const importSummary = computed(() => {
  const parts = []
  if (form.value.importChannels) parts.push(t('show.channels'))
  if (form.value.use_towers && selectedTowerIds.value.size) parts.push(t('show.wizard.templateImport.towers.count', { count: selectedTowerIds.value.size }))
  if (form.value.use_bars && selectedBarIds.value.size) parts.push(t('show.wizard.templateImport.bars.count', { count: selectedBarIds.value.size }))
  if (selectedSectionIds.value.size) parts.push(t('show.wizard.templateImport.sections.count', { count: selectedSectionIds.value.size }))
  return parts.length ? parts.join(', ') : t('show.wizard.areas.none')
})

function onOpenChange(value) {
  if (!value) emit('update:open', false)
}

function back() {
  if (stepIndex.value === 0) {
    emit('update:open', false)
  } else {
    stepIndex.value -= 1
  }
}

async function next() {
  if (stepIndex.value < steps.value.length - 1) {
    stepIndex.value += 1
    return
  }
  await handleCreate()
}

async function handleCreate() {
  const result = await createShowFromWizard()
  if (result) emit('created', result)
}
</script>

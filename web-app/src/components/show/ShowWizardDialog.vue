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
              <span class="font-medium text-right">{{ formatDatum(form.datum) }}</span>
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
import { ref, computed, watch } from 'vue'
import { Loader2, FileX, LayoutTemplate, Layers, AlignJustify, Radio, LayoutList } from 'lucide-vue-next'
import { useLocale } from '../../composables/useLocale.js'
import { createShow, applyTemplateToShow } from '../../api/shows.js'
import { fetchTemplateChannels } from '../../api/templates.js'
import { fetchTemplateSections } from '../../api/sections.js'
import { fetchTemplateBars } from '../../api/templateBars.js'
import { fetchTemplateTowers } from '../../api/templateTowers.js'
import { saveChannels } from '../../api/channels.js'
import { templateDisplayName } from '../../utils/templateName.js'

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

const stepIndex = ref(0)
const creating = ref(false)

function currentSpielzeit() {
  const now = new Date()
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${String(startYear).slice(-2)}/${String(startYear + 1).slice(-2)}`
}

function emptyForm() {
  return {
    name: '',
    datum: new Date().toISOString().slice(0, 10),
    template: '__none__',
    spielzeit: currentSpielzeit(),
    use_bars: true,
    use_towers: true,
    importChannels: true,
  }
}

const form = ref(emptyForm())
const templateSections = ref([])
const templateBars = ref([])
const templateTowers = ref([])
const selectedSectionIds = ref(new Set())
const selectedBarIds = ref(new Set())
const selectedTowerIds = ref(new Set())

function toggleSelection(set, id) {
  const next = new Set(set.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  set.value = next
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    stepIndex.value = 0
    form.value = emptyForm()
    templateSections.value = []
    templateBars.value = []
    templateTowers.value = []
    selectedSectionIds.value = new Set()
    selectedBarIds.value = new Set()
    selectedTowerIds.value = new Set()
  }
})

watch(() => form.value.template, async (name) => {
  if (name === '__none__') {
    templateSections.value = []
    templateBars.value = []
    templateTowers.value = []
    return
  }
  try {
    const [sections, bars, towers] = await Promise.all([
      fetchTemplateSections(name),
      fetchTemplateBars(name),
      fetchTemplateTowers(name),
    ])
    templateSections.value = Array.isArray(sections) ? sections : (sections?.sections ?? [])
    templateBars.value = bars
    templateTowers.value = towers
    selectedSectionIds.value = new Set(templateSections.value.map(s => s.id))
    selectedBarIds.value = new Set(templateBars.value.map(b => b.id))
    selectedTowerIds.value = new Set(templateTowers.value.map(t => t.id))
  } catch (e) {
    console.error('Failed to load template details:', e)
    templateSections.value = []
    templateBars.value = []
    templateTowers.value = []
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

function formatDatum(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function generateId(name, datum) {
  const slug = name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const year = datum ? datum.slice(0, 4) : new Date().getFullYear()
  return slug ? `${slug}-${year}` : ''
}

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
  creating.value = true
  const id = generateId(form.value.name, form.value.datum)
  try {
    const tplCreate = form.value.template === '__none__' ? '' : form.value.template
    const content = `---\nid: ${id}\nname: ${form.value.name || id}\ndatum: ${form.value.datum || new Date().toISOString().slice(0, 10)}\n${tplCreate ? `template: ${tplCreate}\n` : ''}---\n\n`
    await createShow({
      id,
      name: form.value.name || id,
      datum: form.value.datum || new Date().toISOString().slice(0, 10),
      content,
      template: tplCreate || undefined,
      spielzeit: form.value.spielzeit || undefined,
      use_bars: form.value.use_bars,
      use_towers: form.value.use_towers,
      importSections: false,
    })

    if (tplCreate && form.value.use_towers && selectedTowerIds.value.size) {
      try {
        await applyTemplateToShow(id, tplCreate, 'towers', false, [...selectedTowerIds.value])
      } catch (e) {
        console.error('Failed to apply template (towers):', e)
      }
    }
    if (tplCreate && form.value.use_bars && selectedBarIds.value.size) {
      try {
        await applyTemplateToShow(id, tplCreate, 'bars', false, [...selectedBarIds.value])
      } catch (e) {
        console.error('Failed to apply template (bars):', e)
      }
    }
    if (tplCreate && selectedSectionIds.value.size) {
      try {
        await applyTemplateToShow(id, tplCreate, 'sections', false, [...selectedSectionIds.value])
      } catch (e) {
        console.error('Failed to apply template (sections):', e)
      }
    }
    if (tplCreate && form.value.importChannels) {
      try {
        const channels = await fetchTemplateChannels(tplCreate)
        if (channels.length) await saveChannels(id, channels)
      } catch (e) {
        console.error('Failed to apply template channels:', e)
      }
    }

    emit('created', { id, name: form.value.name || id, datum: form.value.datum || new Date().toISOString().slice(0, 10), template: tplCreate })
  } catch (e) {
    console.error('Failed to create show:', e)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="text-sm text-muted-foreground whitespace-pre-line">
      {{ t('zugstange.hint') }}
    </div>
    <div v-if="bars.length === 0" class="flex flex-col items-center justify-center gap-3 border border-dashed border-border rounded-lg px-4 py-8 text-center">
      <AlignJustify class="size-8 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">{{ t('zugstange.empty') }}</p>
      <Button variant="accent" size="sm" class="mt-1 rounded-full shadow-lg" @click="openNew">
        <Plus class="size-3.5" /> {{ t('zugstange.add') }}
      </Button>
    </div>
    <div
      v-for="(bar, idx) in bars" :key="bar.id"
      class="rounded-md border bg-card transition-colors"
      :class="dragOverId === bar.id ? 'border-primary bg-primary/5' : draggedId === bar.id ? 'opacity-40 border-border' : 'border-border'"
    >
      <!-- Bar-Header Zeile -->
      <div
        draggable="true"
        class="flex items-center gap-3 px-4 py-2.5 cursor-grab"
        @dragstart="onDragStart(bar.id)"
        @dragover="onDragOver($event, bar.id)"
        @drop="onDrop(bar.id)"
        @dragend="onDragEnd"
      >
        <svg class="size-4 text-muted-foreground shrink-0 cursor-grab" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg>
        <span class="text-sm font-medium text-foreground flex-1 truncate">{{ bar.name }}</span>
        <span v-if="bar.zug_nr" class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{{ bar.zug_nr }}</span>
        <span class="text-xs text-muted-foreground shrink-0">{{ formatLength(bar.length_cm) }}</span>
        <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="openEdit(bar)">
          <Pencil class="size-3" />
        </Button>
        <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="remove(bar.id, idx)">
          <X class="size-3" />
        </Button>
      </div>

      <!-- Fixture-Panel -->
      <div class="border-t border-border px-4 py-3 space-y-2">
        <div v-for="fx in (fixtures[bar.id] ?? [])" :key="fx.id" class="flex items-center gap-2">
          <span class="text-xs font-mono text-muted-foreground w-16 shrink-0 tabular-nums">{{ cmToDisplay(fx.position) }} {{ unit }}</span>
          <span class="text-xs text-foreground flex-1 truncate">
            <span v-if="fx.channel" class="font-semibold mr-1">{{ fx.channel }}</span>
            <span v-if="fx.device">{{ fx.device }}</span>
            <span v-if="fx.color" class="ml-1 text-muted-foreground">· {{ fx.color }}</span>
          </span>
          <span v-if="fx.notes" class="text-xs text-muted-foreground truncate max-w-24">{{ fx.notes }}</span>
          <Button variant="ghost" size="icon" class="size-5 text-muted-foreground shrink-0" @click="openEditFixture(bar, fx)">
            <Pencil class="size-2.5" />
          </Button>
          <Button variant="ghost" size="icon" class="size-5 text-muted-foreground shrink-0" @click="removeFixture(bar, fx.id)">
            <X class="size-2.5" />
          </Button>
        </div>
        <Button variant="outline" size="sm" class="border-dashed text-xs" @click="openNewFixture(bar)">
          <Plus class="size-2.5 mr-1" /> {{ t('template.bar.fixture.add_optional') }}
        </Button>
      </div>
    </div>
    <Button v-if="bars.length > 0" variant="outline" size="sm" class="w-full border-dashed" @click="openNew">
      <Plus class="size-3 mr-1.5" /> {{ t('zugstange.add') }}
    </Button>

    <!-- Template-Bar Dialog -->
    <Dialog :open="dialogOpen" @update:open="dialogOpen = $event">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editing ? t('zugstange.dialog.edit') : t('zugstange.dialog.new') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('zugstange.field.name') }}</Label>
            <Input size="lg" v-model="form.name" :placeholder="t('zugstange.name.placeholder')" autofocus />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label>{{ t('zugstange.field.zug_nr') }}</Label>
              <Input size="lg" v-model="form.zug_nr" :placeholder="t('zugstange.field.zug_nr.placeholder')" />
            </div>
            <div>
              <Label>{{ t('zugstange.field.length') }} ({{ unit }})</Label>
              <Input size="lg" :modelValue="formDisplay.length" type="number" :min="lengthMin" :max="lengthMax" :step="inputStep" @update:modelValue="form.length_cm = parseToCm(Number($event))" />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="dialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button @click="save">{{ editing ? t('action.save') : t('zugstange.action.create') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Bar-Fixture Dialog -->
    <Dialog :open="fixtureDialogOpen" @update:open="fixtureDialogOpen = $event">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ editingFixture ? t('template.bar.fixtures') : t('template.bar.fixture.add') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('template.bar.fixture.position') }}</Label>
            <Input size="lg" :modelValue="cmToDisplay(fixtureForm.position)" type="number" :step="inputStep" @update:modelValue="fixtureForm.position = parseToCm(Number($event))" />
          </div>
          <div>
            <Label>{{ t('template.bar.fixture.channel') }}</Label>
            <Input size="lg" v-model="fixtureForm.channel" :placeholder="t('template.fixture.channel.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.bar.fixture.device') }}</Label>
            <Input size="lg" v-model="fixtureForm.device" :placeholder="t('template.fixture.device.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.bar.fixture.color') }}</Label>
            <Input size="lg" v-model="fixtureForm.color" :placeholder="t('template.fixture.color.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.bar.fixture.notes') }}</Label>
            <Input size="lg" v-model="fixtureForm.notes" placeholder="" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="fixtureDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button @click="saveFixture">{{ t('action.save') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, toRef } from 'vue'
import { Pencil, Plus, X, AlignJustify } from 'lucide-vue-next'
import { useLocale } from '../../composables/useLocale.js'
import { useMeasureUnit } from '../../composables/useMeasureUnit'
import { useTemplateBars } from '../../composables/useTemplateBars'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'

const props = defineProps<{ templateName: string | null }>()
const { t } = useLocale()
const { unit, formatLength, cmToDisplay, parseToCm, inputStep, lengthMin, lengthMax } = useMeasureUnit()

const templateNameRef = toRef(props, 'templateName')
const {
  bars, fixtures, loadBars,
  draggedId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd,
  dialogOpen, editing, form, openNew, openEdit, save, remove,
  fixtureDialogOpen, editingFixture, fixtureForm, openNewFixture, openEditFixture, saveFixture, removeFixture,
} = useTemplateBars(templateNameRef)

const formDisplay = computed({
  get: () => ({ length: cmToDisplay(form.value.length_cm) }),
  set: (v) => { form.value.length_cm = parseToCm(v.length) },
})

// TabsContent mountet dieses Panel erst beim Aktivieren des Tabs (unmountOnHide) —
// hier selbst laden statt auf einen externen loadBars()-Aufruf zu vertrauen.
onMounted(loadBars)

defineExpose({ loadBars, bars })
</script>

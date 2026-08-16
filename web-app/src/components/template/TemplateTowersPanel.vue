<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <Button variant="outline" size="sm" :disabled="applying === 'towers'" @click="$emit('applyToShows', 'towers')">
        {{ applying === 'towers' ? '…' : t('template.apply_to_shows.towers') }}
      </Button>
    </div>
    <div class="text-sm text-muted-foreground">{{ t('template.tower.hint') }}</div>
    <div v-if="towers.length === 0" class="flex flex-col items-center justify-center gap-3 border border-dashed border-border rounded-lg px-4 py-8 text-center">
      <Layers class="size-8 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">{{ t('template.tower.empty') }}</p>
      <Button variant="accent" size="sm" class="mt-1 rounded-full shadow-lg" @click="openNew">
        <Plus class="size-3.5" /> {{ t('template.tower.add') }}
      </Button>
    </div>
    <div
      v-for="(tower, idx) in towers" :key="tower.id"
      class="rounded-md border bg-card transition-colors"
      :class="dragOverId === tower.id ? 'border-primary bg-primary/5' : draggedId === tower.id ? 'opacity-40 border-border' : 'border-border'"
    >
      <!-- Tower-Header -->
      <div
        draggable="true"
        class="flex items-center gap-3 px-4 py-2.5 cursor-grab"
        @dragstart="onDragStart(tower.id)"
        @dragover="onDragOver($event, tower.id)"
        @drop="onDrop(tower.id)"
        @dragend="onDragEnd"
      >
        <svg class="size-4 text-muted-foreground shrink-0 cursor-grab" viewBox="0 0 16 16" fill="currentColor"><circle cx="5.5" cy="4" r="1.2"/><circle cx="10.5" cy="4" r="1.2"/><circle cx="5.5" cy="8" r="1.2"/><circle cx="10.5" cy="8" r="1.2"/><circle cx="5.5" cy="12" r="1.2"/><circle cx="10.5" cy="12" r="1.2"/></svg>
        <span class="text-sm font-medium text-foreground flex-1 truncate">{{ tower.name }}</span>
        <span v-if="tower.side" class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{{ tower.side }}</span>
        <span class="text-xs text-muted-foreground shrink-0">{{ tower.slot_count }} Slots</span>
        <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="toggleSlots(tower.id)">
          <ChevronDown class="size-3 transition-transform" :class="expandedTowerId === tower.id ? 'rotate-180' : ''" />
        </Button>
        <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="openEdit(tower)">
          <Pencil class="size-3" />
        </Button>
        <Button variant="ghost" size="icon" class="size-6 text-muted-foreground shrink-0" @click.stop="remove(tower.id, idx)">
          <X class="size-3" />
        </Button>
      </div>

      <!-- Slot-Panel (aufklappbar) -->
      <div v-if="expandedTowerId === tower.id" class="border-t border-border divide-y divide-border/60">
        <div v-for="slot in sortedSlots(tower)" :key="slot.slot_index" class="flex items-center gap-3 px-4 py-2">
          <span class="w-6 text-xs font-mono text-muted-foreground text-right shrink-0">{{ slot.slot_index }}</span>
          <span class="text-xs text-foreground flex-1">
            <span v-if="slot.channel" class="font-semibold mr-1">{{ slot.channel }}</span>
            <span v-if="slot.device">{{ slot.device }}</span>
            <span v-if="slot.color" class="ml-1 text-muted-foreground">· {{ slot.color }}</span>
            <span v-if="!slot.channel && !slot.device" class="text-muted-foreground/60">—</span>
          </span>
          <Button variant="ghost" size="icon" class="size-5 text-muted-foreground shrink-0" @click="openEditSlot(tower, slot)">
            <Pencil class="size-2.5" />
          </Button>
          <Button v-if="slot.channel || slot.device" variant="ghost" size="icon" class="size-5 text-muted-foreground shrink-0" @click="clearSlot(tower, slot.slot_index)">
            <X class="size-2.5" />
          </Button>
        </div>
      </div>
    </div>
    <Button v-if="towers.length > 0" variant="outline" size="sm" class="w-full border-dashed" @click="openNew">
      <Plus class="size-3 mr-1.5" /> {{ t('template.tower.add') }}
    </Button>

    <!-- Template-Tower Dialog -->
    <Dialog :open="dialogOpen" @update:open="dialogOpen = $event">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editing ? t('template.tower.edit') : t('template.tower.new') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('gassenturm.field.name') }}</Label>
            <Input size="lg" v-model="form.name" :placeholder="t('gassenturm.field.name.placeholder')" autofocus />
          </div>
          <div class="grid grid-cols-1 gap-3">
            <div>
              <Label>{{ t('gassenturm.field.side') }}</Label>
              <Input size="lg" v-model="form.side" placeholder="L / R" />
            </div>
          </div>
          <div>
            <Label>{{ t('gassenturm.field.slot_count') }}</Label>
            <Input size="lg" v-model.number="form.slot_count" type="number" min="1" max="20" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="dialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button @click="save">{{ editing ? t('action.save') : t('template.tower.action.create') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Tower-Slot-Edit-Dialog -->
    <Dialog :open="slotDialogOpen" @update:open="slotDialogOpen = $event">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Slot {{ editingSlot?.slot_index }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('template.tower.slot.channel_label') }}</Label>
            <Input size="lg" v-model="slotForm.channel" :placeholder="t('template.fixture.channel.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.tower.slot.device_label') }}</Label>
            <Input size="lg" v-model="slotForm.device" :placeholder="t('template.fixture.device.placeholder')" />
          </div>
          <div>
            <Label>{{ t('template.tower.slot.color_label') }}</Label>
            <Input size="lg" v-model="slotForm.color" :placeholder="t('template.fixture.color.placeholder')" />
          </div>
          <p class="text-xs text-muted-foreground">{{ t('template.tower.slot.hint') }}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="slotDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button @click="saveSlot">{{ t('action.save') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { Pencil, Plus, X, ChevronDown, Layers } from 'lucide-vue-next'
import { useLocale } from '../../composables/useLocale.js'
import { useTemplateTowers } from '../../composables/useTemplateTowers'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'

const props = defineProps<{ templateName: string | null; applying: string }>()
defineEmits<{ applyToShows: [scope: string] }>()
const { t } = useLocale()

const templateNameRef = toRef(props, 'templateName')
const {
  towers, expandedTowerId, loadTowers, sortedSlots, toggleSlots,
  draggedId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd,
  dialogOpen, editing, form, openNew, openEdit, save, remove,
  slotDialogOpen, editingSlot, slotForm, openEditSlot, saveSlot, clearSlot,
} = useTemplateTowers(templateNameRef)

defineExpose({ loadTowers })
</script>

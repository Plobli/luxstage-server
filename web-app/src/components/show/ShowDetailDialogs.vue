<template>
  <!-- Neuer Abschnitt Dialog -->
  <Dialog :open="newSectionDialog" @update:open="val => emit('update:newSectionDialog', val)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t('section.dialog.title') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div>
          <Label for="newSectionName">{{ t('field.name') }}</Label>
          <Input
            size="lg"
            id="newSectionName"
            :model-value="newSectionName"
            :placeholder="t('section.dialog.name.placeholder')"
            @update:model-value="emit('update:newSectionName', $event)"
            @keydown.enter.prevent="emit('confirmNewSection')"
            @keydown.esc.prevent="emit('update:newSectionDialog', false)"
          />
        </div>
        <div>
          <Label>{{ t('section.dialog.type') }}</Label>
          <div class="flex flex-col gap-2">
            <button
              :class="['flex items-center gap-4 rounded-xl border p-4 text-left transition-colors', newSectionType === 'markdown' ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50']"
              @click="emit('update:newSectionType', 'markdown')"
            >
              <div :class="['size-4 shrink-0 rounded-full border-2 transition-colors', newSectionType === 'markdown' ? 'border-white bg-white' : 'border-white/30']" />
              <div>
                <div class="text-sm font-semibold text-foreground">{{ t('section.type.markdown.title') }}</div>
                <div class="text-xs text-muted-foreground mt-1">{{ t('section.type.markdown.desc') }}</div>
              </div>
            </button>
            <button
              :class="['flex items-center gap-4 rounded-xl border p-4 text-left transition-colors', newSectionType === 'kv-table' ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50']"
              @click="emit('update:newSectionType', 'kv-table')"
            >
              <div :class="['size-4 shrink-0 rounded-full border-2 transition-colors', newSectionType === 'kv-table' ? 'border-white bg-white' : 'border-white/30']" />
              <div>
                <div class="text-sm font-semibold text-foreground">{{ t('section.type.fields.title') }}</div>
                <div class="text-xs text-muted-foreground mt-1">{{ t('section.type.fields.desc') }}</div>
              </div>
            </button>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:newSectionDialog', false)">{{ t('action.cancel') }}</Button>
        <Button :disabled="!newSectionName.trim()" @click="emit('confirmNewSection')">{{ t('action.create') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <EosMergePreviewDialog
    :open="eosMergePreview.open"
    :newActive="eosMergePreview.newActive"
    :nowGone="eosMergePreview.nowGone"
    :untouched="eosMergePreview.untouched"
    :addressMismatch="eosMergePreview.addressMismatch"
    :deviceMismatch="eosMergePreview.deviceMismatch"
    :previouslyExcluded="eosMergePreview.previouslyExcluded"
    @confirm="(applyAddresses, excludedChannels, applyDevices) => emit('resolveEosMergePreview', true, applyAddresses, excludedChannels, applyDevices)"
    @cancel="emit('resolveEosMergePreview', false)"
  />

  <!-- Vorlage einfügen Dialog -->
  <Dialog :open="fromTemplateDialogOpen" @update:open="val => emit('update:fromTemplateDialogOpen', val)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ fromTemplateScope === 'bars' ? t('from_template.bars.title') : t('from_template.towers.title') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div v-if="fromTemplateItemsLoading" class="text-sm text-muted-foreground">…</div>
        <template v-else>
          <!-- Auswahl-Kopfzeile -->
          <div class="flex items-center justify-between pb-1 border-b border-border">
            <span class="text-xs text-muted-foreground">{{ t('from_template.selected', { selected: fromTemplateSelectedIds.size, total: fromTemplateItems.length }) }}</span>
            <div class="flex gap-2">
              <button class="text-xs text-accent hover:underline" @click="emit('fromTemplateSelectAll')">{{ t('from_template.select_all') }}</button>
              <button class="text-xs text-muted-foreground hover:underline" @click="emit('fromTemplateSelectNone')">{{ t('from_template.select_none') }}</button>
            </div>
          </div>

          <!-- Item-Liste -->
          <div class="max-h-64 overflow-y-auto flex flex-col divide-y divide-border/50">
            <label
              v-for="item in fromTemplateItems"
              :key="item.id"
              class="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors px-1 rounded"
              :class="fromTemplateSelectedIds.has(item.id) ? '' : 'opacity-50'"
            >
              <Checkbox
                :model-value="fromTemplateSelectedIds.has(item.id)"
                @update:model-value="emit('fromTemplateToggleId', item.id)"
              />
              <span class="flex-1 min-w-0">
                <span class="text-sm font-medium text-foreground">{{ item.name }}</span>
                <span v-if="fromTemplateScope === 'bars'" class="text-xs text-muted-foreground ml-2">
                  <span v-if="item.zug_nr">{{ t('from_template.bar.zug', { nr: item.zug_nr }) }} · </span>{{ formatLength(item.length_cm) }}
                  <span v-if="item._fixtureCount" class="ml-1">· {{ t('from_template.bar.fixtures', { count: item._fixtureCount }) }}</span>
                </span>
                <span v-else class="text-xs text-muted-foreground ml-2">
                  <span v-if="item.side">{{ item.side }} · </span>
                  {{ t('from_template.tower.slots', { count: item.slot_count }) }}
                </span>
              </span>
            </label>
          </div>

          <!-- Mit Kanalzuordnung -->
          <div class="flex items-start gap-3 rounded-lg border border-border p-3 mt-1">
            <Checkbox
              :model-value="fromTemplateWithChannels"
              @update:model-value="emit('update:fromTemplateWithChannels', $event)"
              class="mt-0.5"
            />
            <label for="withChannelsCb" class="flex flex-col gap-0.5 cursor-pointer">
              <span class="text-sm font-medium text-foreground">{{ t('from_template.with_channels') }}</span>
              <span class="text-xs text-muted-foreground">
                {{ fromTemplateScope === 'bars'
                  ? t('from_template.with_channels.bars.desc')
                  : t('from_template.with_channels.towers.desc') }}
              </span>
            </label>
          </div>
        </template>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="emit('update:fromTemplateDialogOpen', false)">{{ t('action.cancel') }}</Button>
        <Button :disabled="fromTemplateLoading || fromTemplateSelectedIds.size === 0" @click="emit('confirmFromTemplate')">
          {{ fromTemplateLoading ? '…' : `${fromTemplateSelectedIds.size} einfügen` }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'
import { useLocale } from '../../composables/useLocale.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const EosMergePreviewDialog = defineAsyncComponent(() => import('../EosMergePreviewDialog.vue'))

const { t } = useLocale()

defineProps({
  newSectionDialog: { type: Boolean, default: false },
  newSectionName: { type: String, default: '' },
  newSectionType: { type: String, default: 'markdown' },
  eosMergePreview: { type: Object, required: true },
  fromTemplateDialogOpen: { type: Boolean, default: false },
  fromTemplateScope: { type: String, default: '' },
  fromTemplateItemsLoading: { type: Boolean, default: false },
  fromTemplateItems: { type: Array, default: () => [] },
  fromTemplateSelectedIds: { type: Object, required: true },
  fromTemplateWithChannels: { type: Boolean, default: false },
  fromTemplateLoading: { type: Boolean, default: false },
  formatLength: { type: Function, required: true },
})

const emit = defineEmits([
  'update:newSectionDialog',
  'update:newSectionName',
  'update:newSectionType',
  'confirmNewSection',
  'resolveEosMergePreview',
  'update:fromTemplateDialogOpen',
  'fromTemplateSelectAll',
  'fromTemplateSelectNone',
  'fromTemplateToggleId',
  'update:fromTemplateWithChannels',
  'confirmFromTemplate',
])
</script>

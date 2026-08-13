<template>
  <div class="shrink-0 border-b border-border bg-surface-raised">
    <div class="flex min-h-12 shrink-0 items-center gap-x-3 px-4 sm:px-6 lg:px-7 py-2">
      <div class="flex flex-col sm:flex-row sm:items-baseline gap-x-3 gap-y-0.5 min-w-0 flex-1">
        <h1
          v-if="!editingName"
          class="text-2xl font-semibold text-foreground truncate cursor-text hover:text-foreground/70 transition-colors"
          @click="startEditName"
        >{{ showName }}</h1>
        <input
          v-else
          ref="nameInput"
          :value="editName"
          @input="editName = $event.target.value"
          @blur="commitName"
          @keydown.enter.prevent="commitName"
          @keydown.esc.prevent="cancelName"
          class="text-2xl font-semibold text-foreground bg-transparent border-b border-accent outline-none min-w-20 flex-1"
        />
        <button
          v-if="showDate"
          class="text-sm text-muted-foreground shrink-0 hover:text-foreground transition-colors flex items-center gap-1 min-h-11 sm:min-h-0"
          @click="openMetaDialog"
        >{{ showDate }}<Pencil class="size-3 opacity-40" /></button>
        <button
          v-else
          class="text-sm text-muted-foreground/50 shrink-0 hover:text-muted-foreground transition-colors flex items-center gap-1 min-h-11 sm:min-h-0"
          @click="openMetaDialog"
        ><Pencil class="size-3" /> Info</button>
      </div>

      <!-- Verlauf + Import + Export (Desktop) -->
      <div class="no-print hidden md:flex items-center gap-x-2 shrink-0">
        <Button variant="ghost" size="sm" class="text-muted-foreground gap-1.5" @click="emit('openHistory')">
          <History class="size-3.5" />
          {{ labels.history }}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" class="text-muted-foreground hover:text-foreground flex items-center gap-1">
              {{ labels.import }}<ChevronDown class="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem class="cursor-pointer" @click="eosFileInput?.click()">{{ labels.eosImport }}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="csvImportInput?.click()">{{ labels.csvImport }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" class="text-muted-foreground hover:text-foreground flex items-center gap-1">
              {{ labels.export }}<ChevronDown class="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem class="cursor-pointer" @click="emit('openPdf')">{{ labels.pdf }}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="emit('downloadCsv')">{{ labels.csvExport }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <!-- Mobile Menu -->
      <div class="md:hidden flex items-center shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" class="text-muted-foreground">
              <MoreVertical class="size-5" />
              <span class="sr-only">{{ t('show.header.menu_open') }}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-48">
            <DropdownMenuItem class="cursor-pointer" @click="emit('openHistory')">{{ labels.history }}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer" @click="eosFileInput?.click()">{{ labels.eosImport }}</DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="csvImportInput?.click()">{{ labels.csvImport }}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="cursor-pointer" @click="emit('openPdf')">{{ labels.pdf }}</DropdownMenuItem>
            <DropdownMenuItem class="cursor-pointer text-muted-foreground" @click="emit('downloadCsv')">{{ labels.csvExport }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input ref="eosFileInput" type="file" accept=".csv" class="hidden" @change="emit('eosFileSelected', $event)" />
      <input ref="csvImportInput" type="file" accept=".csv" class="hidden" @change="emit('csvFileSelected', $event)" />
    </div>
  </div>

  <!-- Meta-Dialog -->
  <Dialog :open="metaDialogOpen" @update:open="metaDialogOpen = $event">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('show.meta.title') }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div>
          <Label for="meta-datum">{{ t('field.date') }}</Label>
          <Input id="meta-datum" v-model="editMeta.datum" type="date" size="lg" />
        </div>
        <div>
          <Label for="meta-spielzeit">{{ t('field.spielzeit') }}</Label>
          <Input id="meta-spielzeit" v-model="editMeta.spielzeit" type="text" size="lg" :placeholder="t('show.meta.spielzeit.placeholder')" />
        </div>
        <div class="flex flex-col gap-2 pt-1">
          <Label>{{ t('show.meta.areas') }}</Label>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox v-model="editMeta.use_towers" />
            <span class="text-sm">{{ t('tab.towers') }}</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox v-model="editMeta.use_bars" />
            <span class="text-sm">{{ t('tab.bars') }}</span>
          </label>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" @click="metaDialogOpen = false">{{ t('action.cancel') }}</Button>
        <Button @click="commitMeta">{{ t('action.save') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useLocale } from '@/composables/useLocale.js'
import { History, ChevronDown, MoreVertical, Pencil } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

const { t } = useLocale()

const props = defineProps({
  showName: { type: String, default: '' },
  showDate: { type: String, default: '' },
  showMeta: { type: Object, default: () => ({}) },
  labels: { type: Object, required: true },
})

const emit = defineEmits([
  'update:showName',
  'update:meta',
  'openHistory', 'openPdf', 'downloadCsv',
  'eosFileSelected', 'csvFileSelected',
])

const eosFileInput = ref(null)
const csvImportInput = ref(null)
const editingName = ref(false)
const editName = ref('')
const nameInput = ref(null)
const metaDialogOpen = ref(false)
const editMeta = ref({ datum: '', spielzeit: '', use_bars: true, use_towers: true })

function openMetaDialog() {
  editMeta.value = {
    datum: props.showMeta.datum ?? '',
    spielzeit: props.showMeta.spielzeit ?? '',
    use_bars: props.showMeta.use_bars !== false,
    use_towers: props.showMeta.use_towers !== false,
  }
  metaDialogOpen.value = true
}

function commitMeta() {
  emit('update:meta', { ...editMeta.value })
  metaDialogOpen.value = false
}

async function startEditName() {
  editName.value = props.showName
  editingName.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function commitName() {
  const trimmed = editName.value.trim()
  if (trimmed && trimmed !== props.showName) emit('update:showName', trimmed)
  editingName.value = false
}

function cancelName() {
  editingName.value = false
}
</script>

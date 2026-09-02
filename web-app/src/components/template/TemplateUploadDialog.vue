<template>
  <Dialog :open="open" @update:open="val => { if (!val) close() }">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ t('template.upload') }}</DialogTitle>
      </DialogHeader>

      <div v-if="step === 'select'" class="border-2 border-dashed border-border rounded-lg p-8 text-center mt-4" @dragover.prevent @drop.prevent="onDrop">
        <input ref="fileInput" type="file" accept=".csv,.txt" hidden @change="onFileChange" />
        <p class="text-sm text-muted-foreground mb-4">{{ t('template.upload.hint') }}</p>
        <Button @click="fileInput?.click()">{{ t('template.csv.choose') }}</Button>
      </div>

      <div v-else-if="step === 'preview'" class="pt-4 space-y-4">
        <div>
          <Label for="importName" class="text-xs">{{ t('template.name') }}</Label>
          <Input size="lg" id="importName" v-model="importName" type="text" required class="mt-1" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" />
        </div>
        <div class="text-sm text-muted-foreground">
          <span>{{ t('csv.preview.channels', { count: previewChannels.length }) }}</span>
        </div>
        <div class="overflow-x-auto max-h-96 border border-border rounded-md">
          <Table class="min-w-full text-sm">
            <TableHeader class="sticky top-0 bg-card shadow-sm">
              <TableRow>
                <TableHead class="w-16">{{ t('field.channel') }}</TableHead>
                <TableHead class="w-24">{{ t('field.address') }}</TableHead>
                <TableHead class="w-[30ch]">{{ t('field.device') }}</TableHead>
                <TableHead class="w-[30ch]">{{ t('field.position') }}</TableHead>
                <TableHead class="w-24">{{ t('field.color') }}</TableHead>
                <TableHead>{{ t('field.notes') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="ch in previewChannels.slice(0, 20)" :key="ch.channel">
                <TableCell>{{ ch.channel }}</TableCell>
                <TableCell>{{ ch.address }}</TableCell>
                <TableCell>{{ ch.device }}</TableCell>
                <TableCell>{{ ch.position }}</TableCell>
                <TableCell>{{ ch.color }}</TableCell>
                <TableCell>{{ ch.notes }}</TableCell>
              </TableRow>
              <TableRow v-if="previewChannels.length > 20">
                <TableCell colspan="6" class="text-center text-muted-foreground">{{ t('template.more_channels', { count: previewChannels.length - 20 }) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <Alert v-if="importError" variant="destructive" class="mt-2">
          <AlertDescription>{{ importError }}</AlertDescription>
        </Alert>
        <DialogFooter class="flex justify-end gap-3 mt-4 sm:justify-end">
          <Button variant="outline" @click="step = 'select'">{{ t('action.back') }}</Button>
          <Button :disabled="importing || !importName.trim()" @click="handleImport">
            {{ importing ? '…' : t('template.upload.confirm') }}
          </Button>
        </DialogFooter>
      </div>

      <div v-else-if="step === 'done'" class="py-8 text-center">
        <p class="text-foreground mb-4">✓ {{ t('template.upload.success') }}</p>
        <Button @click="close">{{ t('action.close') }}</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useLocale } from '../../composables/useLocale.js'
import { uploadTemplate } from '../../api/templates.js'
import { parseTemplateCsv, templateNameFromFile } from '../../utils/template-csv'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'

const { t } = useLocale()

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['update:open', 'uploaded'])

const fileInput = ref(null)
const step = ref('select')
const csvText = ref('')
const importName = ref('')
const previewChannels = ref([])
const importing = ref(false)
const importError = ref('')

watch(() => props.open, (val) => {
  if (val) {
    step.value = 'select'
    csvText.value = ''
    importName.value = ''
    previewChannels.value = []
    importError.value = ''
  }
})

function close() {
  emit('update:open', false)
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) processFile(file)
}

function onDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file) processFile(file)
}

function processFile(file) {
  importName.value = templateNameFromFile(file.name)
  const reader = new FileReader()
  reader.onload = (e) => {
    csvText.value = e.target.result
    previewChannels.value = parseTemplateCsv(csvText.value)
    step.value = 'preview'
  }
  reader.readAsText(file, 'utf-8')
}

async function handleImport() {
  importing.value = true
  importError.value = ''
  try {
    const name = templateNameFromFile(importName.value)
    await uploadTemplate({ name, text: csvText.value })
    step.value = 'done'
    emit('uploaded')
  } catch (e) {
    importError.value = e?.message || t('template.upload.error')
  } finally {
    importing.value = false
  }
}
</script>

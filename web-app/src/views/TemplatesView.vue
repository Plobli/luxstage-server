<template>
  <div class="px-4 py-8 sm:px-6 lg:px-8">

    <!-- Detail-Ansicht (wenn eine Vorlage ausgewählt) -->
    <TemplateDetailPanel
      v-if="editingName"
      :templateName="editingName"
      :oscHost="editingOscHostInitial"
      @close="editingName = null"
      @renamed="onTemplateRenamed"
      @oscHostChanged="onOscHostChanged"
    />

    <!-- Vorlagen-Liste -->
    <template v-else>
      <div class="sm:flex sm:items-center mb-8">
        <div class="sm:flex-auto">
          <h1 class="text-2xl font-semibold text-foreground">{{ t('nav.templates') }}</h1>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-2">
          <Button @click="openUpload">
            {{ t('template.upload') }}
          </Button>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-muted-foreground">…</div>
      <div v-else-if="templates.length === 0" class="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p class="text-muted-foreground text-sm">{{ t('template.list.empty') }}</p>
        <Button variant="accent" @click="openUpload" class="flex items-center gap-2">
          <Upload class="size-4" />
          {{ t('template.upload') }}
        </Button>
      </div>

      <ul v-else role="list" class="divide-y divide-border">
        <li v-for="tpl in templates" :key="tpl.name" class="flex items-center justify-between gap-x-6 py-5 cursor-pointer hover:bg-muted/50 -mx-4 px-4 rounded-lg transition-colors" @click="openDetail(tpl.name)">
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-foreground">{{ templateDisplayName(tpl.name) || tpl.name }}</p>
            <div class="flex flex-wrap gap-x-4 mt-1 text-xs text-muted-foreground">
              <span>{{ tpl.channelCount }} {{ tpl.channelCount === 1 ? t('template.channel.singular') : t('template.channel.plural') }}</span>
              <span v-if="tpl.oscHost">OSC: {{ tpl.oscHost }}</span>
              <span v-if="tpl.updatedAt">{{ t('template.updated_at', { date: formatDate(tpl.updatedAt) }) }}</span>
            </div>
          </div>
          <div class="flex flex-none items-center gap-x-4" @click.stop>
            <Button variant="outline" size="sm" @click="openDetail(tpl.name)">
              {{ t('action.edit') }}
            </Button>
            <Button variant="destructive" size="sm" @click="handleDelete(tpl.name)">
              {{ t('action.delete') }}
            </Button>
          </div>
        </li>
      </ul>
    </template>

    <!-- Neu-anlegen-Dialog -->
    <Dialog :open="newDialogOpen" @update:open="val => { if (!val) newDialogOpen = false }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t('template.new') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label>{{ t('template.name') }}</Label>
            <Input
              v-model="newTemplateName"
              :placeholder="t('template.new.name.placeholder')"
              autofocus
              autocomplete="off"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              @keydown.enter.prevent="handleCreateTemplate"
            />
            <p v-if="newTemplateError" class="text-xs text-destructive mt-1">{{ newTemplateError }}</p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" @click="newDialogOpen = false">{{ t('action.cancel') }}</Button>
          <Button :disabled="newTemplateCreating || !newTemplateName.trim()" @click="handleCreateTemplate">
            {{ newTemplateCreating ? '…' : t('template.new.create') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <TemplateUploadDialog
      v-model:open="uploadOpen"
      @uploaded="onUploaded"
    />

  <!-- FAB -->
  <Button v-if="!editingName" variant="accent" @click="openNewDialog" class="fixed bottom-6 right-6 h-11 px-5 shadow-lg border-0 flex items-center gap-2">
    <Plus class="size-4" /> {{ t('template.new') }}
  </Button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Upload, Plus } from 'lucide-vue-next'
import { useLocale } from '../composables/useLocale.js'
import { useConfirm } from '../composables/useConfirm.js'
import { fetchTemplates, saveTemplate, deleteTemplate } from '../api/templates.js'
import { templateDisplayName } from '../utils/templateName.js'
import TemplateDetailPanel from '../components/template/TemplateDetailPanel.vue'
import TemplateUploadDialog from '../components/template/TemplateUploadDialog.vue'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const { t } = useLocale()
const { confirm } = useConfirm()

const templates = ref([])
const loading = ref(true)

// Neu anlegen
const newDialogOpen = ref(false)
const newTemplateName = ref('')
const newTemplateCreating = ref(false)
const newTemplateError = ref('')

// Upload
const uploadOpen = ref(false)

// Detail (inline)
const editingName = ref(null)
const editingOscHostInitial = ref('')

onMounted(async () => {
  templates.value = await fetchTemplates()
  loading.value = false
})

// ── Neu anlegen ─────────────────────────────────────────────────────────────

function openNewDialog() {
  newTemplateName.value = ''
  newTemplateError.value = ''
  newDialogOpen.value = true
}

async function handleCreateTemplate() {
  const name = newTemplateName.value.trim()
  if (!name) return
  if (templates.value.some(tpl => tpl.name === name)) {
    newTemplateError.value = t('template.new.error.duplicate')
    return
  }
  newTemplateCreating.value = true
  newTemplateError.value = ''
  try {
    await saveTemplate(name, [])
    templates.value = await fetchTemplates()
    newDialogOpen.value = false
    openDetail(name)
  } catch (e) {
    newTemplateError.value = e?.message || t('template.upload.error')
  } finally {
    newTemplateCreating.value = false
  }
}

// ── Upload ──────────────────────────────────────────────────────────────────

function openUpload() {
  uploadOpen.value = true
}

async function onUploaded() {
  templates.value = await fetchTemplates()
}

// ── Detail ──────────────────────────────────────────────────────────────────

function openDetail(name) {
  const tpl = templates.value.find(t => t.name === name)
  editingOscHostInitial.value = tpl?.oscHost ?? ''
  editingName.value = name
}

function onTemplateRenamed(newName) {
  const tpl = templates.value.find(t => t.name === editingName.value)
  if (tpl) tpl.name = newName
  editingName.value = newName
}

function onOscHostChanged(newHost) {
  const tpl = templates.value.find(t => t.name === editingName.value)
  if (tpl) tpl.oscHost = newHost
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return ''
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts))
}

// ── Löschen ─────────────────────────────────────────────────────────────────

async function handleDelete(name) {
  const ok = await confirm({ t, titleKey: 'template.delete.confirm', titleParams: { name }, confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  await deleteTemplate(name)
  templates.value = templates.value.filter(t => t.name !== name)
}
</script>

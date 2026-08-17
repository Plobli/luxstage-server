<template>
  <div class="px-4 py-8 sm:px-6 lg:px-8">
    <!-- Page Header -->
    <div class="sm:flex sm:items-center mb-8">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-semibold text-foreground">{{ t('nav.shows') }}</h1>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-sm text-muted-foreground">…</div>

    <!-- Leerer Zustand -->
    <div v-else-if="shows.length === 0" class="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <p class="text-muted-foreground text-sm">{{ t('show.list.empty') }}</p>
      <div class="flex items-center gap-2">
        <Button variant="accent" @click="openCreate" class="flex items-center gap-2">
          <Plus class="size-4" />
          {{ t('show.create') }}
        </Button>
        <Button variant="outline" @click="wizardOpen = true" class="flex items-center gap-2">
          <Sparkles class="size-4" />
          {{ t('show.wizard.open') }}
        </Button>
      </div>
    </div>

    <!-- Sortier-Header -->
    <template v-else>
      <div class="grid grid-cols-[1fr_2rem] sm:grid-cols-[1fr_10rem_0.5fr_2rem] lg:grid-cols-[1fr_10rem_10rem_0.5fr_2rem] gap-0 px-4 mb-1 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider select-none">
        <button class="flex items-center gap-1 hover:text-muted-foreground transition-colors text-left" @click="setSort('name')">
          {{ t('field.name') }} <span class="opacity-60">{{ sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span>
        </button>
        <button class="hidden sm:flex items-center gap-1 hover:text-muted-foreground transition-colors" @click="setSort('datum')">
          {{ t('field.date') }} <span class="opacity-60">{{ sortKey === 'datum' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span>
        </button>
        <button class="hidden lg:flex items-center gap-1 hover:text-muted-foreground transition-colors" @click="setSort('spielzeit')">
          {{ t('field.spielzeit') }} <span class="opacity-60">{{ sortKey === 'spielzeit' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span>
        </button>
        <button class="hidden sm:flex items-center gap-1 hover:text-muted-foreground transition-colors" @click="setSort('last_edited_by')">
          {{ t('field.last_edited') }} <span class="opacity-60">{{ sortKey === 'last_edited_by' ? (sortDir === 'asc' ? '↑' : '↓') : '' }}</span>
        </button>
        <div></div>
      </div>

      <div v-for="group in groupedShows" :key="group.template" class="mb-8">
        <!-- Spielort-Trennlinie -->
        <div class="flex items-center gap-3 mb-1 mt-4">
          <span class="text-xs font-semibold text-muted-foreground/50 uppercase tracking-widest">{{ templateDisplayName(group.template) || '—' }}</span>
          <div class="flex-1 h-px bg-border/50"></div>
        </div>

        <!-- Show-Zeilen -->
        <div class="rounded-xl overflow-hidden">
          <div
            v-for="(show, i) in group.shows"
            :key="show.id"
            class="group grid grid-cols-[1fr_2rem] sm:grid-cols-[1fr_10rem_0.5fr_2rem] lg:grid-cols-[1fr_10rem_10rem_0.5fr_2rem] gap-0 items-center px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50"
            :class="i > 0 ? 'border-t border-border/40' : ''"
            @click="router.push(`/shows/${show.id}`)"
          >
            <div class="min-w-0 pr-4">
              <span class="font-medium text-foreground text-sm truncate block">{{ show.name || show.id }}</span>
            </div>
            <span class="text-sm text-muted-foreground hidden sm:block">{{ formatDatum(show.datum) }}</span>
            <span class="text-sm text-muted-foreground hidden lg:block">{{ show.spielzeit || '—' }}</span>
            <span class="text-sm text-muted-foreground truncate hidden sm:block">{{ show.last_edited_by }}</span>
            <div class="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
              <Button variant="ghost" size="icon" class="size-7 text-muted-foreground hover:text-foreground" @click="archive(show.id)" :title="t('show.archive')">
                <Archive class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Neue Show: Dialog -->
    <Dialog :open="drawerOpen" @update:open="drawerOpen = $event">
      <DialogContent class="sm:max-w-lg min-h-140">
        <DialogHeader>
          <DialogTitle>{{ t('show.new') }}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <Label for="showName">{{ t('show.name') }}</Label>
            <Input size="lg" id="showName" v-model="form.name" type="text" required />
          </div>
          <div>
            <Label for="showDate">{{ t('show.date') }}</Label>
            <Input size="lg" id="showDate" v-model="form.datum" type="date" />
          </div>
          <div>
            <Label for="showSpielzeit">{{ t('field.spielzeit') }}</Label>
            <Input size="lg" id="showSpielzeit" v-model="form.spielzeit" type="text" :placeholder="t('show.meta.spielzeit.placeholder')" />
          </div>
          <div>
            <Label for="showTemplate">{{ t('show.template') }}</Label>
            <Select id="showTemplate" v-model="form.template">
              <SelectTrigger size="lg" class="w-full">
                <SelectValue :placeholder="t('show.template.none')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{{ t('show.template.none') }}</SelectItem>
                <SelectItem v-for="tpl in templates" :key="tpl.name" :value="tpl.name">
                  {{ templateDisplayName(tpl.name) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-2 pt-1">
            <Label>{{ t('show.meta.areas') }}</Label>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox v-model="form.use_towers" />
              <span class="text-sm">{{ t('tab.towers') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox v-model="form.use_bars" />
              <span class="text-sm">{{ t('tab.bars') }}</span>
            </label>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" type="button" @click="drawerOpen = false">
            {{ t('action.cancel') }}
          </Button>
          <Button type="button" :disabled="creating" @click="handleCreate">
            <Loader2 v-if="creating" class="mr-2 size-4 animate-spin" />
            {{ creating ? t('show.creating') : t('show.create') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  <!-- Neue Show: Assistent -->
  <ShowWizardDialog v-model:open="wizardOpen" :templates="templates" @created="onWizardCreated" />

  <!-- FAB -->
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="accent" class="fixed bottom-6 right-6 h-11 px-5 shadow-lg border-0 flex items-center gap-2">
        <Plus class="size-4" /> {{ t('show.new') }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuItem class="cursor-pointer" @click="openCreate">
        <Plus class="size-4 mr-2" /> {{ t('show.create.quick') }}
      </DropdownMenuItem>
      <DropdownMenuItem class="cursor-pointer" @click="wizardOpen = true">
        <Sparkles class="size-4 mr-2" /> {{ t('show.wizard.open') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Archive, Loader2, Plus, Sparkles } from 'lucide-vue-next'
import { useLocale } from '../composables/useLocale.js'
import { fetchShows, createShow, archiveShow } from '../api/shows.js'
import { fetchTemplates, fetchTemplateChannels } from '../api/templates.js'
import { cached, invalidate } from '../api/cache.js'
import { saveChannels } from '../api/channels.js'
import { templateDisplayName } from '../utils/templateName.js'

import { useConfirm } from '../composables/useConfirm.js'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import ShowWizardDialog from '@/components/show/ShowWizardDialog.vue'

const router = useRouter()
const { t } = useLocale()
const { confirm } = useConfirm()

const shows = ref([])
const templates = ref([])
const loading = ref(true)
const sortKey = ref('datum')
const sortDir = ref('desc')

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'name' ? 'asc' : 'desc'
  }
}
const creating = ref(false)
const drawerOpen = ref(false)
const wizardOpen = ref(false)

function currentSpielzeit() {
  const now = new Date()
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${String(startYear).slice(-2)}/${String(startYear + 1).slice(-2)}`
}

const form = ref({ name: '', datum: new Date().toISOString().slice(0, 10), template: '__none__', spielzeit: currentSpielzeit(), use_bars: true, use_towers: true })

function formatDatum(d) {
  if (!d) return ''
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

const groupedShows = computed(() => {
  const groups = []
  const seen = new Map()
  for (const show of shows.value) {
    const tpl = show.template || ''
    if (seen.has(tpl)) {
      groups[seen.get(tpl)].shows.push(show)
    } else {
      seen.set(tpl, groups.length)
      groups.push({ template: tpl, shows: [show] })
    }
  }
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  for (const group of groups) {
    group.shows.sort((a, b) => {
      const va = (a[key] || '').toLowerCase()
      const vb = (b[key] || '').toLowerCase()
      return va < vb ? -dir : va > vb ? dir : 0
    })
  }
  groups.sort((a, b) => (a.template || '').localeCompare(b.template || ''))
  return groups
})

onMounted(async () => {
  const [s, tpls] = await Promise.all([
    cached('shows', fetchShows),
    cached('templates', fetchTemplates),
  ])
  shows.value = s
  templates.value = tpls
  loading.value = false
})

async function handleCreate() {
  creating.value = true
  const id = generateId(form.value.name, form.value.datum)
  try {
    const tplCreate = form.value.template === '__none__' ? '' : form.value.template
    const content = `---\nid: ${id}\nname: ${form.value.name || id}\ndatum: ${form.value.datum || new Date().toISOString().slice(0, 10)}\n${tplCreate ? `template: ${tplCreate}\n` : ''}---\n\n`
    await createShow({ id, name: form.value.name || id, datum: form.value.datum || new Date().toISOString().slice(0, 10), content, template: tplCreate || undefined, spielzeit: form.value.spielzeit || undefined, use_bars: form.value.use_bars, use_towers: form.value.use_towers })
    invalidate('shows')
    const newShow = { id, name: form.value.name || id, datum: form.value.datum || new Date().toISOString().slice(0, 10), template: tplCreate }
    shows.value.push(newShow)
    if (tplCreate) {
      try {
        const channels = await fetchTemplateChannels(tplCreate)
        if (channels.length) await saveChannels(id, channels)
      } catch (e) {
        console.error('Failed to apply template channels:', e)
      }
    }
    drawerOpen.value = false
    router.push(`/shows/${id}`)
  } catch (e) {
    console.error('Failed to create show:', e)
  } finally {
    creating.value = false
  }
}

function onWizardCreated(newShow) {
  invalidate('shows')
  shows.value.push(newShow)
  wizardOpen.value = false
  router.push(`/shows/${newShow.id}`)
}

function openCreate() {
  form.value = { name: '', datum: new Date().toISOString().slice(0, 10), template: '__none__', spielzeit: currentSpielzeit(), use_bars: true, use_towers: true }
  drawerOpen.value = true
}

async function archive(showId) {
  const show = shows.value.find(s => s.id === showId)
  const ok = await confirm({ t, titleKey: 'show.archive.confirm.title', messageKey: 'show.archive.confirm.text', messageParams: { name: show?.name || showId }, confirmKey: 'show.archive', cancelKey: 'action.cancel' })
  if (!ok) return
  const idx = shows.value.findIndex(s => s.id === showId)
  const removed = shows.value.splice(idx, 1)[0]
  try {
    await archiveShow(showId)
    invalidate('shows')
  } catch (e) {
    console.error('Failed to archive show:', e)
    shows.value.splice(idx, 0, removed)
  }
}
</script>

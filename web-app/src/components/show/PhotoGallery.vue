<template>
  <section class="space-y-4">
    <slot name="heading" />

    <!-- Upload progress -->
    <div v-if="uploadQueue.length > 0" class="mb-3 space-y-1">
      <div v-for="item in uploadQueue" :key="item.name" class="flex items-center gap-2">
        <Progress
          :value="item.progress"
          class="flex-1 h-1"
          :class="item.error ? '[&>div]:bg-red-500' : item.done ? '[&>div]:bg-green-500' : ''"
        />
        <span class="text-xs text-muted-foreground w-8 text-right">{{ item.done ? '✓' : item.error ? '✗' : item.progress + '%' }}</span>
      </div>
    </div>

    <!-- Drop zone + grid -->
    <div
      :class="{ 'ring-2 ring-accent ring-inset rounded-lg': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div v-if="photos.length === 0 && !dragging" class="flex flex-col items-center justify-center gap-3 text-center px-8 py-16">
        <ImageIcon class="size-8 text-muted-foreground/40" />
        <div class="max-w-150">
          <p class="text-base font-medium text-foreground/70">{{ labels.empty }}</p>
          <p class="text-sm text-muted-foreground mt-1">{{ labels.emptyDesc }}</p>
        </div>
        <label class="mt-1 h-11 px-5 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-accent-foreground flex items-center gap-2 cursor-pointer text-sm font-medium">
          <Plus class="size-4" /> {{ labels.add }}
          <input type="file" accept="image/*" multiple class="sr-only" @change="onFileInput" />
        </label>
      </div>
      <ul role="list" class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        <li v-for="filename in photos" :key="filename" class="relative group flex flex-col gap-2 rounded-xl border border-border bg-card p-2">
          <div class="aspect-[4/3] block w-full overflow-hidden rounded-lg bg-muted cursor-pointer" @click="openLightbox(filename)">
            <img :src="photoUrl(filename, { thumb: true })" :alt="filename" loading="lazy" class="pointer-events-none h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-80" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="absolute top-3 right-3 size-7 rounded-sm opacity-0 group-hover:opacity-100 transition-all bg-background/80 text-muted-foreground hover:text-destructive"
            @click="onDeletePhoto(filename)"
            :title="labels.delete"
          ><X class="size-4" /></Button>
          <div class="mt-1 flex flex-col divide-y divide-border rounded-xl border border-input bg-background overflow-hidden">
            <input
              type="text"
              :value="photoCaptions[filename]?.caption ?? ''"
              :placeholder="labels.captionPlaceholder"
              @blur="onCaptionBlur(filename, $event)"
              @keydown.enter="$event.target.blur()"
              class="h-9 w-full bg-transparent px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:bg-muted/40"
            />
            <div class="relative flex items-center">
              <input
                type="text"
                :value="channelInputValue(filename)"
                :placeholder="labels.channelInputPlaceholder"
                :class="channelInputInvalid[filename] ? 'text-destructive' : ''"
                @focus="beginChannelInput(filename, $event)"
                @input="onChannelInputTyping(filename, $event)"
                @blur="commitChannelInput(filename, $event)"
                @keydown.enter="$event.target.blur()"
                class="h-9 w-full bg-transparent px-3 pr-8 text-xs font-mono placeholder:text-muted-foreground placeholder:font-sans focus-visible:outline-none focus-visible:bg-muted/40"
              />
              <button
                type="button"
                class="absolute right-2 text-muted-foreground/50 hover:text-muted-foreground shrink-0"
                :title="labels.channelPick"
                @click="openChannelPicker(filename)"
              ><Search class="size-3.5" /></button>
            </div>
          </div>
          <p v-if="channelInputInvalid[filename]" class="text-[10px] text-destructive mt-1">
            {{ labels.channelUnknown }}: {{ channelInputInvalid[filename].join(', ') }}
          </p>
        </li>
      </ul>
    </div>
  </section>

  <!-- Kreis-Zuordnung Picker -->
  <Dialog :open="channelPickerOpen" @update:open="channelPickerOpen = $event">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ labels.channelPick }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <ChannelPickerGrid
          :channels="channels"
          multiple
          v-model="pickerSelectedIds"
          :search-placeholder="labels.channelSearchPlaceholder"
          :none-label="labels.channelNone"
          :hint="labels.channelPickMultiHint"
        />
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" @click="channelPickerOpen = false">{{ t('action.cancel') }}</Button>
        <Button @click="confirmChannelPicker">{{ t('action.done') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Print pages (only visible when printing) -->
  <div v-if="photos.length > 0" class="photo-print-pages">
    <div v-for="(page, pageIdx) in photoPages" :key="pageIdx" class="photo-print-page">
      <div class="photo-print-grid" :data-cols="photoCols">
        <div v-for="filename in page" :key="filename" class="photo-print-item">
          <img :src="photoUrl(filename)" :alt="photoCaptions[filename]?.caption || filename" />
          <p v-if="photoCaptions[filename]?.caption" class="photo-print-caption">{{ photoCaptions[filename].caption }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Lightbox -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="lightboxPhoto"
      class="fixed inset-0 z-50 flex flex-col items-center justify-center"
      @click="lightboxPhoto = null"
    >
      <div class="absolute inset-0 backdrop-blur-xl bg-black/70" />
      <Button
        v-if="lightboxIndex > 0"
        variant="ghost"
        size="icon"
        class="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full h-10 w-10 transition-colors"
        @click.stop="lightboxStep(-1)"
        aria-label="Vorheriges Foto"
      >
        <ChevronLeft class="size-6" />
      </Button>
      <img :src="photoUrl(lightboxPhoto)" class="relative max-h-[85vh] max-w-[90vw] object-contain drop-shadow-2xl" @click.stop />
      <p
        v-if="photoCaptions[lightboxPhoto]?.caption"
        class="relative mt-3 text-sm text-muted-foreground max-w-lg text-center px-4"
        @click.stop
      >{{ photoCaptions[lightboxPhoto].caption }}</p>
      <Button
        v-if="lightboxIndex < photos.length - 1"
        variant="ghost"
        size="icon"
        class="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full h-10 w-10 transition-colors"
        @click.stop="lightboxStep(1)"
        aria-label="Nächstes Foto"
      >
        <ChevronRight class="size-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="absolute top-3 right-3 z-10 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full h-8 w-8 transition-colors"
        @click.stop="lightboxPhoto = null"
        aria-label="Schließen"
      >
        <X class="size-5" />
      </Button>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { ChevronLeft, ChevronRight, X, Plus, Search, Image as ImageIcon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import ChannelPickerGrid from './ChannelPickerGrid.vue'
import { useConfirm } from '../../composables/useConfirm.js'
import { useLocale } from '../../composables/useLocale.js'
import { usePhotoSettings } from '../../composables/usePhotoSettings.js'
import { uploadPhoto, deletePhoto, fetchPhotos, fetchPhotoCaptions, savePhotoCaption, fetchAllPhotoChannels, savePhotoChannels } from '../../api/photos.js'
import { getPhotoUrl } from '../../api/photos.js'

const props = defineProps({
  showId: { type: String, required: true },
  photos: { type: Array, required: true },
  channels: { type: Array, required: true },
  labels: { type: Object, required: true },
})

const emit = defineEmits(['update:photos'])

const { confirm } = useConfirm()
const { t } = useLocale()
const { photosPerPage } = usePhotoSettings()

const dragging = ref(false)
const lightboxPhoto = ref(null)
const uploadQueue = ref([])
const photoCaptions = ref({})
const photoChannels = ref({})

const channelById = computed(() => {
  const map = new Map()
  for (const ch of props.channels) map.set(ch.id, ch)
  return map
})

function channelsForPhoto(filename) {
  return (photoChannels.value[filename] ?? []).map(id => channelById.value.get(id)).filter(Boolean)
}

const channelIdByNumber = computed(() => {
  const map = new Map()
  for (const ch of props.channels) {
    const key = (ch.channel ?? '').trim().toLowerCase()
    if (key) map.set(key, ch.id)
  }
  return map
})

// Freitext-Eingabe der Kreisnummern direkt unters Foto: solange das Feld
// fokussiert ist, zeigt es den zuletzt getippten Rohtext (channelInputDrafts);
// erst beim Verlassen wird gegen die Kreisliste gematcht und gespeichert.
const channelInputDrafts = ref({})
const channelInputInvalid = ref({})

function channelInputValue(filename) {
  if (filename in channelInputDrafts.value) return channelInputDrafts.value[filename]
  return channelsForPhoto(filename).map(ch => ch.channel).join(', ')
}

function beginChannelInput(filename, event) {
  channelInputDrafts.value[filename] = channelInputValue(filename)
  event.target.value = channelInputDrafts.value[filename]
}

function setInvalidTokens(filename, unknown) {
  if (unknown.length) channelInputInvalid.value = { ...channelInputInvalid.value, [filename]: unknown }
  else { const { [filename]: _, ...rest } = channelInputInvalid.value; channelInputInvalid.value = rest }
}

// Live-Validierung während des Tippens: nur abgeschlossene Tokens (gefolgt von
// Trennzeichen) werden geprüft, das zuletzt getippte, noch offene Token bleibt
// neutral — sonst würde z.B. "1" schon als ungültig markiert, bevor "12" fertig ist.
function onChannelInputTyping(filename, event) {
  const raw = event.target.value
  channelInputDrafts.value[filename] = raw
  const endsOpen = raw.length > 0 && !/[,\s]$/.test(raw)
  const tokens = raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
  const checkTokens = endsOpen ? tokens.slice(0, -1) : tokens
  const unknown = checkTokens.filter(token => !channelIdByNumber.value.has(token.toLowerCase()))
  setInvalidTokens(filename, unknown)
}

async function commitChannelInput(filename, event) {
  const raw = event.target.value
  delete channelInputDrafts.value[filename]
  const tokens = raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
  const channelIds = []
  const unknown = []
  const seen = new Set()
  for (const token of tokens) {
    const id = channelIdByNumber.value.get(token.toLowerCase())
    if (id) { if (!seen.has(id)) { seen.add(id); channelIds.push(id) } }
    else unknown.push(token)
  }
  setInvalidTokens(filename, unknown)
  photoChannels.value[filename] = channelIds
  await savePhotoChannels(props.showId, filename, channelIds)
}

const photoPages = computed(() => {
  const n = photosPerPage.value
  const pages = []
  for (let i = 0; i < props.photos.length; i += n) {
    pages.push(props.photos.slice(i, i + n))
  }
  return pages
})

const photoCols = computed(() => {
  const n = photosPerPage.value
  if (n === 1) return 1
  if (n === 2) return 2
  if (n <= 4) return 2
  if (n <= 6) return 3
  return 3
})

// getPhotoUrl() ist async (kurzlebiges Token muss ggf. vom Server geholt
// werden), <img :src> braucht aber einen synchronen Wert — resolvedUrls hält
// pro "showId:filename:thumb"-Schlüssel den zuletzt aufgelösten String, den
// photoUrl() synchron zurückgibt. Nur beim ersten Zugriff je Schlüssel wird
// nachgeladen, danach bleibt der Wert bis zum nächsten showId/photos-Wechsel
// stehen (das darunterliegende Token erneuert sich unabhängig im Client).
const resolvedUrls = ref({})
const pendingUrls = new Set()

function photoUrl(filename, { thumb = false } = {}) {
  const key = `${props.showId}:${filename}:${thumb ? 1 : 0}`
  if (!(key in resolvedUrls.value) && !pendingUrls.has(key)) {
    pendingUrls.add(key)
    getPhotoUrl(props.showId, filename, { thumb })
      .then(url => { resolvedUrls.value[key] = url })
      .finally(() => pendingUrls.delete(key))
  }
  return resolvedUrls.value[key] ?? ''
}

watch(() => [props.showId, ...props.photos], () => {
  if (lightboxPhoto.value && !props.photos.includes(lightboxPhoto.value)) {
    lightboxPhoto.value = null
  }
})

onMounted(async () => {
  try {
    const caps = await fetchPhotoCaptions(props.showId)
    const map = {}
    if (Array.isArray(caps)) {
      for (const c of caps) map[c.filename] = c
    } else if (caps && typeof caps === 'object') {
      // Fallback falls das Backend ein Objekt statt eines Arrays liefert
      Object.assign(map, caps)
    }
    photoCaptions.value = map
  } catch (e) {
    console.error('Fehler beim Laden der Fotobeschriftungen:', e)
  }
  try {
    photoChannels.value = await fetchAllPhotoChannels(props.showId)
  } catch (e) {
    console.error('Fehler beim Laden der Foto-Kreiszuordnungen:', e)
  }
})

async function onCaptionBlur(filename, event) {
  const caption = event.target.value
  photoCaptions.value[filename] = { ...(photoCaptions.value[filename] ?? {}), caption }
  await savePhotoCaption(props.showId, filename, caption)
}

// Kreis-Zuordnung
const channelPickerOpen = ref(false)
const channelPickerFilename = ref(null)
const pickerSelectedIds = ref([])

function openChannelPicker(filename) {
  channelPickerFilename.value = filename
  pickerSelectedIds.value = [...(photoChannels.value[filename] ?? [])]
  channelPickerOpen.value = true
}

async function confirmChannelPicker() {
  const filename = channelPickerFilename.value
  const channelIds = [...pickerSelectedIds.value]
  photoChannels.value[filename] = channelIds
  channelPickerOpen.value = false
  await savePhotoChannels(props.showId, filename, channelIds)
}

async function uploadFiles(files) {
  uploadQueue.value = files.map(f => ({ name: f.name, progress: 0, done: false, error: false }))
  for (let i = 0; i < files.length; i++) {
    try {
      await uploadPhoto(props.showId, files[i], (p) => {
        uploadQueue.value[i].progress = p
      })
      uploadQueue.value[i].done = true
      emit('update:photos', await fetchPhotos(props.showId))
    } catch {
      uploadQueue.value[i].error = true
    }
  }
  setTimeout(() => { uploadQueue.value = [] }, 2000)
}

function onFileInput(e) { uploadFiles([...e.target.files]); e.target.value = '' }
function onDrop(e) {
  dragging.value = false
  const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))
  if (files.length) uploadFiles(files)
}

async function onDeletePhoto(filename) {
  const ok = await confirm({ t, titleKey: 'show.photo.delete.confirm', confirmKey: 'action.delete', cancelKey: 'action.cancel' })
  if (!ok) return
  await deletePhoto(props.showId, filename)
  emit('update:photos', props.photos.filter(f => f !== filename))
  delete photoCaptions.value[filename]
  delete photoChannels.value[filename]
}

const lightboxIndex = computed(() => props.photos.indexOf(lightboxPhoto.value))
function openLightbox(filename) { lightboxPhoto.value = filename }
function lightboxStep(dir) {
  const idx = lightboxIndex.value + dir
  if (idx >= 0 && idx < props.photos.length) lightboxPhoto.value = props.photos[idx]
}

function onLightboxKey(e) {
  if (!lightboxPhoto.value) return
  if (e.key === 'ArrowRight') lightboxStep(1)
  else if (e.key === 'ArrowLeft') lightboxStep(-1)
  else if (e.key === 'Escape') lightboxPhoto.value = null
}

onMounted(() => window.addEventListener('keydown', onLightboxKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onLightboxKey))

defineExpose({ onFileInput })
</script>

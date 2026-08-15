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
      <p v-if="photos.length === 0 && !dragging" class="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-8 text-sm text-muted-foreground text-center">{{ labels.empty }}</p>
      <ul role="list" class="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:grid-cols-3">
        <li v-for="filename in photos" :key="filename" class="relative group flex flex-col gap-2 rounded-xl border border-border bg-card p-2">
          <div class="aspect-[4/3] block w-full overflow-hidden rounded-lg bg-muted cursor-pointer" @click="openLightbox(filename)">
            <img :src="photoUrl(filename, { thumb: true })" :alt="filename" loading="lazy" class="pointer-events-none h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-80" />
          </div>
          <Button
            variant="destructive"
            size="icon"
            class="absolute top-3 right-3 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-red-500/90 text-white"
            @click="onDeletePhoto(filename)"
            :title="labels.delete"
          >✕</Button>
          <Input
            type="text"
            :value="photoCaptions[filename]?.caption ?? ''"
            :placeholder="labels.captionPlaceholder"
            @blur="onCaptionBlur(filename, $event)"
            @keydown.enter="$event.target.blur()"
            class="mt-2 text-xs"
          />
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-muted-foreground shrink-0">{{ labels.channelLabel }}</span>
            <Input
              type="text"
              :value="photoCaptions[filename]?.channelNumber ?? ''"
              :placeholder="labels.channelPlaceholder"
              @blur="onChannelNumberBlur(filename, $event)"
              @keydown.enter="$event.target.blur()"
              class="text-xs"
            />
          </div>
        </li>
      </ul>
    </div>
  </section>

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
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useConfirm } from '../../composables/useConfirm.js'
import { useLocale } from '../../composables/useLocale.js'
import { usePhotoSettings } from '../../composables/usePhotoSettings.js'
import { uploadPhoto, deletePhoto, fetchPhotos, fetchPhotoCaptions, savePhotoCaption } from '../../api/photos.js'
import { getPhotoUrl } from '../../api/photos.js'

const props = defineProps({
  showId: { type: String, required: true },
  photos: { type: Array, required: true },
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
})

async function onCaptionBlur(filename, event) {
  const caption = event.target.value
  photoCaptions.value[filename] = { ...(photoCaptions.value[filename] ?? {}), caption }
  await savePhotoCaption(props.showId, filename, caption, photoCaptions.value[filename]?.channelNumber ?? '')
}

async function onChannelNumberBlur(filename, event) {
  const channelNumber = event.target.value
  photoCaptions.value[filename] = { ...(photoCaptions.value[filename] ?? {}), channelNumber }
  await savePhotoCaption(props.showId, filename, photoCaptions.value[filename]?.caption ?? '', channelNumber)
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

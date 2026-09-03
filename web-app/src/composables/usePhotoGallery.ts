import { ref, type Ref } from 'vue'
import {
  uploadPhoto, deletePhoto, fetchPhotos, fetchPhotoCaptions, savePhotoCaption,
  fetchAllPhotoChannels, savePhotoChannels, getPhotoUrl,
} from '../api/photos'

interface UploadItem { name: string; progress: number; done: boolean; error: boolean }

/**
 * Datenzugriff für den Fotobereich einer Show: Beschriftungen, Kreiszuordnung,
 * Upload und URL-Auflösung. Liegt hier statt in PhotoGallery.vue, damit die
 * Komponente ohne laufenden Server darstellbar bleibt (F-04).
 */
export function usePhotoGallery(showId: string, photos: Ref<string[]>) {
  const photoCaptions = ref<Record<string, { caption?: string }>>({})
  const photoChannels = ref<Record<string, string[]>>({})
  const uploadQueue = ref<UploadItem[]>([])

  async function loadCaptionsAndChannels() {
    try {
      const caps = await fetchPhotoCaptions(showId)
      const map: Record<string, any> = {}
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
      photoChannels.value = await fetchAllPhotoChannels(showId)
    } catch (e) {
      console.error('Fehler beim Laden der Foto-Kreiszuordnungen:', e)
    }
  }

  async function saveCaption(filename: string, caption: string) {
    photoCaptions.value[filename] = { ...(photoCaptions.value[filename] ?? {}), caption }
    await savePhotoCaption(showId, filename, caption)
  }

  async function saveChannelsForPhoto(filename: string, channelIds: string[]) {
    photoChannels.value[filename] = channelIds
    await savePhotoChannels(showId, filename, channelIds)
  }

  // getPhotoUrl() ist async (kurzlebiges Token muss ggf. vom Server geholt
  // werden), <img :src> braucht aber einen synchronen Wert — resolvedUrls hält
  // pro "filename:thumb"-Schlüssel den zuletzt aufgelösten String, den
  // photoUrl() synchron zurückgibt. Nur beim ersten Zugriff je Schlüssel wird
  // nachgeladen.
  const resolvedUrls = ref<Record<string, string>>({})
  const pendingUrls = new Set<string>()

  function photoUrl(filename: string, { thumb = false } = {}): string {
    const key = `${filename}:${thumb ? 1 : 0}`
    if (!(key in resolvedUrls.value) && !pendingUrls.has(key)) {
      pendingUrls.add(key)
      getPhotoUrl(showId, filename, { thumb })
        .then(url => { resolvedUrls.value[key] = url })
        .finally(() => pendingUrls.delete(key))
    }
    return resolvedUrls.value[key] ?? ''
  }

  async function uploadFiles(files: File[]) {
    uploadQueue.value = files.map(f => ({ name: f.name, progress: 0, done: false, error: false }))
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadPhoto(showId, files[i], (p) => { uploadQueue.value[i].progress = p })
        uploadQueue.value[i].done = true
        photos.value = await fetchPhotos(showId)
      } catch {
        uploadQueue.value[i].error = true
      }
    }
    setTimeout(() => { uploadQueue.value = [] }, 2000)
  }

  async function removePhoto(filename: string) {
    await deletePhoto(showId, filename)
    photos.value = photos.value.filter(f => f !== filename)
    delete photoCaptions.value[filename]
    delete photoChannels.value[filename]
  }

  return {
    photoCaptions, photoChannels, uploadQueue,
    loadCaptionsAndChannels, saveCaption, saveChannelsForPhoto,
    photoUrl, uploadFiles, removePhoto,
  }
}

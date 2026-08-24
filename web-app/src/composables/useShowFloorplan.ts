import { ref } from 'vue'
import { fetchShowFloorplan, saveShowFloorplan, saveShowFloorplanSnapshot, uploadShowFloorplanImage, deleteShowFloorplanImage } from '../api/floorplan'

export interface FloorplanData {
  image_url: string | null;
  canvas_data: any | null;
}

export function useShowFloorplan(showId: string) {
  const floorplan = ref<FloorplanData>({ image_url: null, canvas_data: null })
  let snapshotTimer: ReturnType<typeof setTimeout> | null = null

  async function loadFloorplan(): Promise<void> {
    const data = await fetchShowFloorplan(showId).catch(() => null)
    if (data) floorplan.value = data
  }

  // Schnelles Hintereinander-Platzieren von Elementen (z.B. mehrere Kreise) löst
  // sonst pro Element einen eigenen Snapshot-PUT aus, die sich serverseitig
  // überholen können — hier gedebounced, damit nur der letzte Stand gesendet wird.
  function onFloorplanChange(canvasData: any, snapshotDataUrl?: string): void {
    floorplan.value = { ...floorplan.value, canvas_data: canvasData }
    saveShowFloorplan(showId, canvasData).catch(() => {})
    if (snapshotDataUrl) {
      if (snapshotTimer) clearTimeout(snapshotTimer)
      snapshotTimer = setTimeout(() => {
        snapshotTimer = null
        saveShowFloorplanSnapshot(showId, snapshotDataUrl, 120).catch(() => {})
      }, 500)
    }
  }

  async function onFloorplanImageUpload(file: File): Promise<void> {
    const result = await uploadShowFloorplanImage(showId, file)
    if (result?.image_url) {
      floorplan.value = { ...floorplan.value, image_url: null }
      await new Promise(r => setTimeout(r, 0))
      floorplan.value = { ...floorplan.value, image_url: result.image_url + '?t=' + Date.now() }
    }
  }

  async function onFloorplanImageDelete(): Promise<void> {
    await deleteShowFloorplanImage(showId)
    floorplan.value = { ...floorplan.value, image_url: null }
  }

  return {
    floorplan,
    loadFloorplan,
    onFloorplanChange,
    onFloorplanImageUpload,
    onFloorplanImageDelete
  }
}


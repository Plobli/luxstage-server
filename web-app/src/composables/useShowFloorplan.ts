import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchShowFloorplan, saveShowFloorplan, uploadShowFloorplanImage, deleteShowFloorplanImage } from '../api/floorplan'

export interface FloorplanData {
  image_url: string | null;
  canvas_data: any | null;
}

// Wie useShowChannels.ts: Pause seit der letzten Änderung, bevor gespeichert wird —
// sonst würde jede Mausbewegung beim Verschieben einer Form einen eigenen
// Undo-Eintrag erzeugen (canvas_data ist jetzt Teil des serverseitigen
// Show-Undo-Stacks, server/db/full-state.js) und den Verlauf (max. 50 Einträge)
// für Kanäle/Sections/Türme/Stangen verdrängen. maxWait schützt bei
// ununterbrochenem Zeichnen trotzdem vor Datenverlust.
const SAVE_DEBOUNCE_MS = 800
const SAVE_MAX_WAIT_MS = 4000

export function useShowFloorplan(showId: string) {
  const floorplan = ref<FloorplanData>({ image_url: null, canvas_data: null })

  async function loadFloorplan(): Promise<void> {
    const data = await fetchShowFloorplan(showId).catch(() => null)
    if (data) floorplan.value = data
  }

  const persistFloorplan = useDebounceFn(
    (canvasData: any) => saveShowFloorplan(showId, canvasData).catch(() => {}),
    SAVE_DEBOUNCE_MS, { maxWait: SAVE_MAX_WAIT_MS }
  )

  function onFloorplanChange(canvasData: any): void {
    floorplan.value = { ...floorplan.value, canvas_data: canvasData }
    persistFloorplan(canvasData)
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


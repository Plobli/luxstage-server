import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchShowFloorplan, saveShowFloorplan, uploadShowFloorplanImage, deleteShowFloorplanImage } from '../api/floorplan'
import { ApiError } from '../api/client'
import { useLocale } from './useLocale'

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

export function useShowFloorplan(showId: string, onLockConflict?: (body: { lockedBy?: string, since?: number }) => void) {
  const { t } = useLocale()
  const floorplan = ref<FloorplanData>({ image_url: null, canvas_data: null })
  const floorplanSaveError = ref<string | null>(null)

  async function loadFloorplan(): Promise<void> {
    const data = await fetchShowFloorplan(showId).catch(() => null)
    if (data) floorplan.value = data
  }

  async function doPersistFloorplan(canvasData: any): Promise<void> {
    try {
      await saveShowFloorplan(showId, canvasData)
      floorplanSaveError.value = null
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        onLockConflict?.(e.body)
        return
      }
      // onFloorplanChange() ruft persistFloorplan() fire-and-forget auf (kein
      // await, kein .catch()) — ein erneutes throw hier würde eine unhandled
      // promise rejection erzeugen und der Nutzer würde nie erfahren, dass
      // der Grundriss nicht gespeichert wurde (siehe useShowChannels.ts
      // doPersistChannels — vorher wurde hier jeder Fehler still verschluckt,
      // auch 423, sodass ein gesperrter Grundriss unbemerkt Änderungen verlor).
      floorplanSaveError.value = e instanceof ApiError ? e.message : t('error.save_failed')
      console.error('[useShowFloorplan] Autosave fehlgeschlagen:', e)
    }
  }

  const persistFloorplan = useDebounceFn(doPersistFloorplan, SAVE_DEBOUNCE_MS, { maxWait: SAVE_MAX_WAIT_MS })

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
    floorplanSaveError,
    loadFloorplan,
    onFloorplanChange,
    onFloorplanImageUpload,
    onFloorplanImageDelete
  }
}


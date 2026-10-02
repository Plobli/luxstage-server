import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { fetchShowDrawingPlan, saveShowDrawingPlan, uploadShowDrawingPlanImage, deleteShowDrawingPlanImage } from '../api/drawingPlan'
import { ApiError } from '../api/client'
import { useLocale } from './useLocale'

export interface DrawingPlanData {
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

export function useShowDrawingPlan(showId: string, onLockConflict?: (body: { lockedBy?: string, since?: number }) => void) {
  const { t } = useLocale()
  const drawingPlan = ref<DrawingPlanData>({ image_url: null, canvas_data: null })
  const drawingPlanSaveError = ref<string | null>(null)

  async function loadDrawingPlan(): Promise<void> {
    const data = await fetchShowDrawingPlan(showId).catch(() => null)
    if (data) drawingPlan.value = data
  }

  async function doPersistDrawingPlan(canvasData: any): Promise<void> {
    try {
      await saveShowDrawingPlan(showId, canvasData)
      drawingPlanSaveError.value = null
    } catch (e) {
      if (e instanceof ApiError && e.status === 423) {
        onLockConflict?.(e.body ?? {})
        return
      }
      // onDrawingPlanChange() ruft persistDrawingPlan() fire-and-forget auf (kein
      // await, kein .catch()) — ein erneutes throw hier würde eine unhandled
      // promise rejection erzeugen und der Nutzer würde nie erfahren, dass
      // der Grundriss nicht gespeichert wurde (siehe useShowChannels.ts
      // doPersistChannels — vorher wurde hier jeder Fehler still verschluckt,
      // auch 423, sodass ein gesperrter Grundriss unbemerkt Änderungen verlor).
      drawingPlanSaveError.value = e instanceof ApiError ? e.message : t('error.save_failed')
      console.error('[useShowDrawingPlan] Autosave fehlgeschlagen:', e)
    }
  }

  const persistDrawingPlan = useDebounceFn(doPersistDrawingPlan, SAVE_DEBOUNCE_MS, { maxWait: SAVE_MAX_WAIT_MS })

  function onDrawingPlanChange(canvasData: any): void {
    drawingPlan.value = { ...drawingPlan.value, canvas_data: canvasData }
    persistDrawingPlan(canvasData)
  }

  async function onDrawingPlanImageUpload(file: File): Promise<void> {
    const result = await uploadShowDrawingPlanImage(showId, file)
    if (result?.image_url) {
      drawingPlan.value = { ...drawingPlan.value, image_url: null }
      await new Promise(r => setTimeout(r, 0))
      drawingPlan.value = { ...drawingPlan.value, image_url: result.image_url + '?t=' + Date.now() }
    }
  }

  async function onDrawingPlanImageDelete(): Promise<void> {
    await deleteShowDrawingPlanImage(showId)
    drawingPlan.value = { ...drawingPlan.value, image_url: null }
  }

  return {
    drawingPlan,
    drawingPlanSaveError,
    loadDrawingPlan,
    onDrawingPlanChange,
    onDrawingPlanImageUpload,
    onDrawingPlanImageDelete
  }
}


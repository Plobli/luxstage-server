import { ref, watch, nextTick, type Ref } from 'vue'
import { getToken } from '@/api/client'
import { PDF_PRINT_AREA_RATIO } from '@shared/constants.js'

// Laden/Anzeigen des Hintergrundbilds (Grundriss-Bild) in FloorplanEditor.vue: SVG- vs.
// Raster-Zweig, Blob-URL-Verwaltung inkl. Freigabe der jeweils vorherigen, sowie das feste
// Fixieren der Stage-Größe auf den PDF-Druckbereich. Bewusst NICHT hier: alles was elements/
// selectedIds betrifft — dieser Composable rührt nur an stageSize/fitToContainer aus
// useCanvasViewport, sonst an nichts, das mit dem Zeichen-/Auswahl-State geteilt wird.

export interface Size { width: number; height: number }

export function useBackgroundImage(
  getImageUrl: () => string | null,
  stageSize: Ref<Size>,
  fitToContainer: () => void,
) {
  const bgImage = ref<HTMLImageElement | null>(null)
  const bgImageSrc = ref('')
  const backgroundLoadError = ref(false)
  // Objekt-URL des aktuell angezeigten Hintergrundbilds — nicht reaktiv, dient nur der
  // Buchführung, damit loadBackground() sie vor dem nächsten Laden/beim Unmount freigeben kann.
  let activeBlobUrl: string | null = null
  function revokeActiveBlobUrl() {
    if (activeBlobUrl) { URL.revokeObjectURL(activeBlobUrl); activeBlobUrl = null }
  }

  // Zählt jeden loadBackground()-Aufruf durch — bei schnell wechselndem imageUrl
  // (Upload, Undo/Redo) kann eine ältere fetch/Image-Decode-Kette erst nach
  // einer neueren auflösen; ohne diesen Abgleich würde die ältere Antwort das
  // schon korrekt angezeigte neuere Bild überschreiben und dessen Blob-URL
  // unter ihm wegrevoken.
  let backgroundLoadToken = 0

  async function loadBackground(url: string | null) {
    const token = ++backgroundLoadToken
    backgroundLoadError.value = false
    if (!url) { revokeActiveBlobUrl(); bgImage.value = null; bgImageSrc.value = ''; return }

    const isSvg = url.split('?')[0].toLowerCase().endsWith('.svg')
      || url.startsWith('data:image/svg')

    if (isSvg) {
      revokeActiveBlobUrl()
      // Stage ist immer fest auf den PDF-Druckbereich (A4 quer) fixiert (siehe unten).
      const REF_W = 2000
      stageSize.value = { width: REF_W, height: Math.round(REF_W / PDF_PRINT_AREA_RATIO) }
      bgImage.value = null
      bgImageSrc.value = url
      nextTick(() => fitToContainer())
      return
    }

    let blobUrl: string
    try {
      const blob = await fetch(url, { cache: 'reload', headers: { Authorization: 'Bearer ' + (getToken() || '') } }).then(r => r.blob())
      blobUrl = URL.createObjectURL(blob)
    } catch (err) {
      if (token !== backgroundLoadToken) return // überholt durch einen neueren Aufruf
      console.error('Hintergrundbild konnte nicht geladen werden:', err)
      backgroundLoadError.value = true
      return
    }

    const img = new Image()
    img.onload = () => {
      if (token !== backgroundLoadToken) { URL.revokeObjectURL(blobUrl); return } // überholt — verwerfen, nicht anzeigen
      // Stage ist immer fest auf den PDF-Druckbereich (A4 quer) fixiert, unabhängig
      // vom Bildseitenverhältnis; das Bild wird unverzerrt eingepasst (siehe
      // bg-image preserveAspectRatio). So bleibt die Darstellung nach jedem Laden
      // (Upload wie Seiten-Reload) konsistent.
      const REF_W = 2000
      stageSize.value = { width: REF_W, height: Math.round(REF_W / PDF_PRINT_AREA_RATIO) }
      revokeActiveBlobUrl()
      activeBlobUrl = blobUrl
      bgImage.value = img
      bgImageSrc.value = blobUrl
      nextTick(() => fitToContainer())
    }
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl)
      if (token !== backgroundLoadToken) return // überholt durch einen neueren Aufruf
      console.error('Hintergrundbild konnte nicht dekodiert werden')
      backgroundLoadError.value = true
    }
    img.src = blobUrl
  }

  watch(getImageUrl, loadBackground, { immediate: true })

  return {
    bgImage, bgImageSrc, backgroundLoadError,
    revokeActiveBlobUrl,
  }
}

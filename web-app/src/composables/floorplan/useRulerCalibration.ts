import { ref, computed } from 'vue'

// Lineal-Kalibrierung (Maßstab in Pixel/Meter) und der daraus abgeleitete Maßstabsbalken
// in FloorplanEditor.vue. Bewusst NICHT hier: das Nachziehen bereits platzierter Bar-Elemente
// auf den neuen Maßstab — das mischt Bar-Geometrie mit Kalibrierung und bleibt in
// FloorplanEditor.vue (siehe commitRuler dort), analog zu towerAlreadyPlaced/barAlreadyPlaced,
// die aus demselben Grund in useElementPicker.ts nicht enthalten sind. Ebenso NICHT hier: das
// Setzen von activeTool nach commit/cancel, gleiches Muster wie placeTowerNode/placeBarNode.

export interface RulerPoint { x: number; y: number }

const SCALE_CANDIDATES = [0.25, 0.5, 1, 2, 5, 10, 20, 50]

function nearestCandidate(target: number): number {
  return SCALE_CANDIDATES.reduce((a, b) => Math.abs(a - target) < Math.abs(b - target) ? a : b)
}

export function useRulerCalibration() {
  const rulerPoints = ref<RulerPoint[]>([])
  const scalePixelsPerMeter = ref(0)
  const showRulerDialog = ref(false)
  const rulerDistanceInput = ref('')

  const scaleBarWidth = computed(() => {
    if (scalePixelsPerMeter.value <= 0) return 0
    return nearestCandidate(80 / scalePixelsPerMeter.value) * scalePixelsPerMeter.value
  })
  const scaleBarLabel = computed(() => {
    if (scalePixelsPerMeter.value <= 0) return ''
    const m = nearestCandidate(80 / scalePixelsPerMeter.value)
    return m >= 1 ? `${m} m` : `${Math.round(m * 100)} cm`
  })

  function addRulerPoint(pos: RulerPoint) {
    rulerPoints.value = [...rulerPoints.value, pos]
    if (rulerPoints.value.length === 2) {
      rulerDistanceInput.value = ''
      showRulerDialog.value = true
    }
  }

  /** Setzt scalePixelsPerMeter aus rulerDistanceInput + den beiden gesetzten Punkten.
   *  Liefert true bei gültiger Eingabe — der Aufrufer muss dann platzierte Bar-Elemente
   *  selbst auf den neuen Maßstab nachziehen (siehe FloorplanEditor.vue: commitRuler). */
  function commitCalibration(): boolean {
    const meters = parseFloat(rulerDistanceInput.value.replace(',', '.'))
    let calibrated = false
    if (!isNaN(meters) && meters > 0 && rulerPoints.value.length === 2) {
      const dx = rulerPoints.value[1].x - rulerPoints.value[0].x
      const dy = rulerPoints.value[1].y - rulerPoints.value[0].y
      scalePixelsPerMeter.value = Math.sqrt(dx * dx + dy * dy) / meters
      calibrated = true
    }
    rulerPoints.value = []
    showRulerDialog.value = false
    return calibrated
  }

  function cancelCalibration() {
    rulerPoints.value = []
    showRulerDialog.value = false
  }

  return {
    rulerPoints, scalePixelsPerMeter, showRulerDialog, rulerDistanceInput,
    scaleBarWidth, scaleBarLabel,
    addRulerPoint, commitCalibration, cancelCalibration,
  }
}

import { ref, computed } from 'vue'
import { loadDisplaySettingsOnce, saveDisplaySettings } from '../api/settings'

export type MeasureUnit = 'm' | 'cm' | 'mm'

const STORAGE_KEY = 'measureUnit'
const unit = ref<MeasureUnit>((localStorage.getItem(STORAGE_KEY) as MeasureUnit) || 'm')

// Beim Start vom Server laden
if (typeof window !== 'undefined') {
  loadDisplaySettingsOnce().then(data => {
    if (data?.measure_unit && ['m', 'cm', 'mm'].includes(data.measure_unit)) {
      unit.value = data.measure_unit
      localStorage.setItem(STORAGE_KEY, data.measure_unit)
    }
  }).catch(() => {})

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue && ['m', 'cm', 'mm'].includes(e.newValue)) {
      unit.value = e.newValue as MeasureUnit
    }
  })
}

function setUnit(u: MeasureUnit) {
  unit.value = u
  localStorage.setItem(STORAGE_KEY, u)
  saveDisplaySettings({ measure_unit: u }).catch(() => {})
}

/** cm → Anzeige-Wert (gerundet) */
function cmToDisplay(cm: number): number {
  if (unit.value === 'm') return Math.round(cm / 100 * 100) / 100
  if (unit.value === 'mm') return Math.round(cm * 10)
  return Math.round(cm)
}

/** Eingabe in gewählter Einheit → cm */
function parseToCm(val: number): number {
  if (unit.value === 'm') return Math.round(val * 100)
  if (unit.value === 'mm') return Math.round(val / 10)
  return Math.round(val)
}

function formatLength(cm: number | null | undefined): string {
  if (cm == null) return '—'
  return `${cmToDisplay(cm)} ${unit.value}`
}

/** Schrittweite für number-Input */
const inputStep = computed(() => {
  if (unit.value === 'm') return 0.01
  if (unit.value === 'mm') return 10
  return 1
})

/** Min-Wert für Länge in der aktuellen Einheit */
const lengthMin = computed(() => {
  if (unit.value === 'm') return 0.5
  if (unit.value === 'mm') return 500
  return 50
})

/** Max-Wert für Länge in der aktuellen Einheit */
const lengthMax = computed(() => {
  if (unit.value === 'm') return 30
  if (unit.value === 'mm') return 30000
  return 3000
})

/** Langform der Einheit für Labels */
const unitLabel = computed(() => {
  if (unit.value === 'm') return 'in Metern'
  if (unit.value === 'mm') return 'in Millimetern'
  return 'in Zentimetern'
})

export function useMeasureUnit() {
  return {
    unit: computed(() => unit.value),
    unitLabel,
    setUnit,
    formatLength,
    cmToDisplay,
    parseToCm,
    inputStep,
    lengthMin,
    lengthMax,
  }
}

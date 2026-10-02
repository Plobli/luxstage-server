import { ref, computed } from 'vue'

// Zustand der drei Platzierungs-Picker in DrawingPlanEditor.vue (Kanal/Turm/Stange): Dialog-
// Sichtbarkeit, Suchfilter, gefilterte Listen, Ghost-Preview-Position beim Ziehen zur Bühne.
// Bewusst NICHT hier: das eigentliche Platzieren beim MouseUp (addElement/emitChange) bleibt
// in DrawingPlanEditor.vue, da es Teil der zentralen Maus-Dispatch-Kette ist; ebenso
// towerAlreadyPlaced/battenAlreadyPlaced, die auf dem elements-Array prüfen (domänenspezifische
// Eindeutigkeitsregel, kein Picker-eigener Zustand — siehe drawingPlanElementTypes.ts).

export interface Tower { id: string; name?: string; side?: string }
export interface Batten { id: string; name?: string; length_cm?: number }
export interface Point { x: number; y: number }

export function useElementPicker(towers: () => Tower[], battens: () => Batten[]) {
  const showChannelPicker = ref(false)
  const channelPickerPos = ref<Point>({ x: 0, y: 0 })
  const channelSearch = ref('')

  const showTowerPicker = ref(false)
  const towerPickerPos = ref<Point>({ x: 0, y: 0 })
  const towerSearch = ref('')

  const showBattenPicker = ref(false)
  const battenPickerPos = ref<Point>({ x: 0, y: 0 })
  const battenSearch = ref('')

  const pendingChannelForPlacement = ref<any>(null)
  const pendingTowerForPlacement = ref<Tower | null>(null)
  const pendingBattenForPlacement = ref<Batten | null>(null)
  const ghostPos = ref<Point | null>(null)

  const filteredTowers = computed(() => {
    const q = towerSearch.value.trim().toLowerCase()
    if (!q) return towers()
    return towers().filter(tower => (tower.name ?? '').toLowerCase().includes(q) || (tower.side ?? '').toLowerCase().includes(q))
  })
  const filteredBattens = computed(() => {
    const q = battenSearch.value.trim().toLowerCase()
    if (!q) return battens()
    return battens().filter(batten => (batten.name ?? '').toLowerCase().includes(q))
  })

  function openChannelPlacer(pos: Point) {
    channelPickerPos.value = pos
    channelSearch.value = ''
    showChannelPicker.value = true
  }
  function openTowerPlacer(pos: Point) {
    towerPickerPos.value = pos
    towerSearch.value = ''
    showTowerPicker.value = true
  }
  function openBattenPlacer(pos: Point) {
    battenPickerPos.value = pos
    battenSearch.value = ''
    showBattenPicker.value = true
  }

  function placeTowerNode(tower: Tower) {
    showTowerPicker.value = false
    pendingTowerForPlacement.value = tower
    ghostPos.value = null
  }
  function placeBattenNode(batten: Batten) {
    showBattenPicker.value = false
    pendingBattenForPlacement.value = batten
    ghostPos.value = null
  }

  function clearPending() {
    pendingChannelForPlacement.value = null
    pendingTowerForPlacement.value = null
    pendingBattenForPlacement.value = null
    ghostPos.value = null
  }

  return {
    showChannelPicker, channelPickerPos, channelSearch,
    showTowerPicker, towerPickerPos, towerSearch,
    showBattenPicker, battenPickerPos, battenSearch,
    pendingChannelForPlacement, pendingTowerForPlacement, pendingBattenForPlacement, ghostPos,
    filteredTowers, filteredBattens,
    openChannelPlacer, openTowerPlacer, openBattenPlacer,
    placeTowerNode, placeBattenNode,
    clearPending,
  }
}

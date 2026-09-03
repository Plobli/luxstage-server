import { ref, computed } from 'vue'

// Zustand der drei Platzierungs-Picker in FloorplanEditor.vue (Kanal/Turm/Stange): Dialog-
// Sichtbarkeit, Suchfilter, gefilterte Listen, Ghost-Preview-Position beim Ziehen zur Bühne.
// Bewusst NICHT hier: das eigentliche Platzieren beim MouseUp (addElement/emitChange) bleibt
// in FloorplanEditor.vue, da es Teil der zentralen Maus-Dispatch-Kette ist; ebenso
// towerAlreadyPlaced/barAlreadyPlaced, die auf dem elements-Array prüfen (domänenspezifische
// Eindeutigkeitsregel, kein Picker-eigener Zustand — siehe floorplanElementTypes.ts).

export interface Tower { id: string; name?: string; side?: string }
export interface Bar { id: string; name?: string; length_cm?: number }
export interface Point { x: number; y: number }

export function useElementPicker(towers: () => Tower[], bars: () => Bar[]) {
  const showChannelPicker = ref(false)
  const channelPickerPos = ref<Point>({ x: 0, y: 0 })
  const channelSearch = ref('')

  const showTowerPicker = ref(false)
  const towerPickerPos = ref<Point>({ x: 0, y: 0 })
  const towerSearch = ref('')

  const showBarPicker = ref(false)
  const barPickerPos = ref<Point>({ x: 0, y: 0 })
  const barSearch = ref('')

  const pendingChannelForPlacement = ref<any>(null)
  const pendingTowerForPlacement = ref<Tower | null>(null)
  const pendingBarForPlacement = ref<Bar | null>(null)
  const ghostPos = ref<Point | null>(null)

  const filteredTowers = computed(() => {
    const q = towerSearch.value.trim().toLowerCase()
    if (!q) return towers()
    return towers().filter(tower => (tower.name ?? '').toLowerCase().includes(q) || (tower.side ?? '').toLowerCase().includes(q))
  })
  const filteredBars = computed(() => {
    const q = barSearch.value.trim().toLowerCase()
    if (!q) return bars()
    return bars().filter(bar => (bar.name ?? '').toLowerCase().includes(q))
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
  function openBarPlacer(pos: Point) {
    barPickerPos.value = pos
    barSearch.value = ''
    showBarPicker.value = true
  }

  function placeTowerNode(tower: Tower) {
    showTowerPicker.value = false
    pendingTowerForPlacement.value = tower
    ghostPos.value = null
  }
  function placeBarNode(bar: Bar) {
    showBarPicker.value = false
    pendingBarForPlacement.value = bar
    ghostPos.value = null
  }

  function clearPending() {
    pendingChannelForPlacement.value = null
    pendingTowerForPlacement.value = null
    pendingBarForPlacement.value = null
    ghostPos.value = null
  }

  return {
    showChannelPicker, channelPickerPos, channelSearch,
    showTowerPicker, towerPickerPos, towerSearch,
    showBarPicker, barPickerPos, barSearch,
    pendingChannelForPlacement, pendingTowerForPlacement, pendingBarForPlacement, ghostPos,
    filteredTowers, filteredBars,
    openChannelPlacer, openTowerPlacer, openBarPlacer,
    placeTowerNode, placeBarNode,
    clearPending,
  }
}

import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

// Zoom/Pan/Grid-Zustand von FloorplanEditor.vue — Stage-Skalierung, Rasteranzeige/-fang,
// Container-Größenmessung (ResizeObserver) und das Verschieben per Leertaste/Pan-Werkzeug.
// Bewusst NICHT hier: das zentrale Maus-Dispatching (onContainerMouseDown/Move/Up) bleibt
// in FloorplanEditor.vue, da es Zeichnen/Draggen/Resizen/Panning in einer Entscheidungskette
// behandelt — eine Aufspaltung nur der Pan-Zweige würde diese Kette auf zwei Dateien verteilen,
// ohne echte Kopplung zu lösen. Dieser Composable stellt startPan/updatePan/endPan als benannte
// Funktionen bereit, die von dieser Kette aufgerufen werden.

export interface Size { width: number; height: number }
export interface PanOffset { x: number; y: number }

const GRID_SIZE = 30

export function useCanvasViewport(containerEl: Ref<HTMLElement | null>) {
  const containerSize = ref<Size>({ width: 1200, height: 800 })
  const stageSize = ref<Size>({ width: 1200, height: 800 })

  const stageScale = computed(() => {
    const sx = containerSize.value.width / stageSize.value.width
    const sy = containerSize.value.height / stageSize.value.height
    return Math.min(sx, sy, 1)
  })
  const containerOffsetX = computed(() => Math.round((containerSize.value.width - stageSize.value.width * stageScale.value) / 2))
  const containerOffsetY = computed(() => Math.round((containerSize.value.height - stageSize.value.height * stageScale.value) / 2))

  const showGrid = ref(false)
  const snapToGrid = ref(false)
  const panOffset = ref<PanOffset>({ x: 0, y: 0 })
  const isPanning = ref(false)
  const panStart = ref<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const spaceHeld = ref(false)

  const gridLeft = computed(() => -panOffset.value.x)
  const gridTop = computed(() => -panOffset.value.y)
  const gridRight = computed(() => gridLeft.value + stageSize.value.width / stageScale.value)
  const gridBottom = computed(() => gridTop.value + stageSize.value.height / stageScale.value)
  const gridVerticalLines = computed(() => {
    const lines = [] as number[]
    const start = Math.floor(gridLeft.value / GRID_SIZE) * GRID_SIZE
    for (let x = start; x <= gridRight.value; x += GRID_SIZE) lines.push(x)
    return lines
  })
  const gridHorizontalLines = computed(() => {
    const lines = [] as number[]
    const start = Math.floor(gridTop.value / GRID_SIZE) * GRID_SIZE
    for (let y = start; y <= gridBottom.value; y += GRID_SIZE) lines.push(y)
    return lines
  })

  function snap(val: number): number {
    return snapToGrid.value ? Math.round(val / GRID_SIZE) * GRID_SIZE : val
  }

  function fitToContainer() {
    panOffset.value = { x: 0, y: 0 }
  }

  function resetView(hasBackground: boolean) {
    if (hasBackground) fitToContainer()
    else panOffset.value = { x: 0, y: 0 }
  }

  function startPan(e: MouseEvent) {
    isPanning.value = true
    panStart.value = { mx: e.clientX, my: e.clientY, ox: panOffset.value.x, oy: panOffset.value.y }
  }

  function updatePan(e: MouseEvent) {
    if (!isPanning.value || !panStart.value) return
    const s = stageScale.value
    panOffset.value = {
      x: panStart.value.ox + (e.clientX - panStart.value.mx) / s,
      y: panStart.value.oy + (e.clientY - panStart.value.my) / s,
    }
  }

  function endPan() {
    isPanning.value = false
    panStart.value = null
  }

  let resizeObserver: ResizeObserver | null = null
  onMounted(() => {
    if (containerEl.value) {
      resizeObserver = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect
        if (width > 0 && height > 0) containerSize.value = { width, height }
      })
      resizeObserver.observe(containerEl.value)
    }
  })
  onUnmounted(() => {
    resizeObserver?.disconnect()
  })

  return {
    containerSize,
    stageSize,
    stageScale,
    containerOffsetX,
    containerOffsetY,
    showGrid,
    snapToGrid,
    panOffset,
    isPanning,
    spaceHeld,
    gridLeft,
    gridTop,
    gridRight,
    gridBottom,
    gridVerticalLines,
    gridHorizontalLines,
    snap,
    fitToContainer,
    resetView,
    startPan,
    updatePan,
    endPan,
  }
}

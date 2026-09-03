import { ref, type Ref } from 'vue'
import { ELEMENT_TYPES, elementHasEndpoints } from '../../utils/floorplanElementTypes'

// Drag/Resize/Rotate-Zustand und -Mausbehandlung für ausgewählte Elemente in
// FloorplanEditor.vue. Bewusst NICHT hier: das zentrale Maus-Dispatching selbst
// (onContainerMouseDown/Move/onNodeMouseDown bleiben in FloorplanEditor.vue) — aus demselben
// Grund, aus dem useCanvasViewport das Pan-Dispatching nicht übernimmt: eine Aufspaltung der
// Entscheidungskette (Resize vs. Drag vs. Zeichnen vs. Lasso) auf zwei Dateien würde die
// Kopplung nur verstecken, nicht auflösen. Dieser Composable stellt die aufgerufenen Funktionen
// bereit (beginElementDrag/startResizeLine/.../finishDrag), die Kette selbst bleibt dort.

export interface DragResizeElement {
  id: string
  type: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  rotation?: number
  [key: string]: any
}
export interface Point { x: number; y: number }

export function useElementDragResize(
  elements: Ref<DragResizeElement[]>,
  selectedIds: Ref<Set<string>>,
  snap: (n: number) => number,
  emitChange: () => void,
  getPointerPos: (e: MouseEvent) => Point,
) {
  const isElementDragging = ref(false)
  const elementWasDragged = ref(false)
  const isResizing = ref(false)
  const isArrowRotating = ref(false)
  const dragStartSnapshot = ref<DragResizeElement[] | null>(null)
  let resizeObj: { id: string; point?: number; initX?: number; initY?: number } | null = null

  function beginElementDrag() {
    isElementDragging.value = true
    elementWasDragged.value = false
    dragStartSnapshot.value = [...selectedIds.value].map(sid => JSON.parse(JSON.stringify(elements.value.find(x => x.id === sid))))
  }

  function startResizeLine(id: string, point: number, e: MouseEvent) {
    e.stopPropagation()
    isResizing.value = true
    resizeObj = { id, point }
  }
  function startResizeRectEllipse(id: string, e: MouseEvent) {
    e.stopPropagation()
    isResizing.value = true
    const el = elements.value.find(x => x.id === id)
    resizeObj = { id, initX: el?.x, initY: el?.y }
  }

  function applyResizeMove(pos: Point) {
    if (!resizeObj) return
    const el = elements.value.find(x => x.id === resizeObj!.id)
    if (el) ELEMENT_TYPES[el.type as keyof typeof ELEMENT_TYPES]?.applyResize?.(el, resizeObj, pos)
  }

  function applyDragMove(pos: Point, dragStart: Point) {
    if (!dragStartSnapshot.value) return
    const dx = pos.x - dragStart.x
    const dy = pos.y - dragStart.y
    if (Math.hypot(dx, dy) > 3) elementWasDragged.value = true
    dragStartSnapshot.value.forEach(init => {
      const el = elements.value.find(x => x.id === init.id)
      if (!el) return
      if (elementHasEndpoints(el.type as any)) { el.x1 = (init.x1 ?? 0) + dx; el.y1 = (init.y1 ?? 0) + dy; el.x2 = (init.x2 ?? 0) + dx; el.y2 = (init.y2 ?? 0) + dy }
      else { el.x = (init.x ?? 0) + dx; el.y = (init.y ?? 0) + dy }
    })
  }

  function finishResize() {
    isResizing.value = false
    resizeObj = null
    elements.value.forEach(el => { ELEMENT_TYPES[el.type as keyof typeof ELEMENT_TYPES]?.snapAfterResize?.(el, snap) })
    emitChange()
  }

  /** Räumt Drag-Zustand auf und meldet, ob das Properties-Panel geöffnet werden soll
   *  (Einzelauswahl ohne tatsächliche Bewegung — dann war es ein Klick, kein Drag). */
  function finishDrag(): boolean {
    const wasDragged = elementWasDragged.value
    isElementDragging.value = false
    elementWasDragged.value = false
    elements.value.forEach(el => {
      if (!selectedIds.value.has(el.id)) return
      if (elementHasEndpoints(el.type as any)) { ELEMENT_TYPES.line.snapAfterResize!(el, snap) }
      else { el.x = snap(el.x ?? 0); el.y = snap(el.y ?? 0) }
    })
    emitChange()
    return !wasDragged && selectedIds.value.size === 1
  }

  function updateRotation(id: string, deg: number) {
    const el = elements.value.find(e => e.id === id)
    if (el) { el.rotation = deg; emitChange() }
  }

  function startRotationDrag(el: DragResizeElement, event: PointerEvent) {
    event.preventDefault()
    event.stopPropagation()
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    function onMove(e: PointerEvent) {
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90
      updateRotation(el.id, Math.round(angle))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startArrowRotateDrag(el: DragResizeElement, event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    isArrowRotating.value = true
    function onMove(e: MouseEvent) {
      const pos = getPointerPos(e)
      const angle = Math.atan2(pos.y - (el.y ?? 0), pos.x - (el.x ?? 0)) * 180 / Math.PI
      updateRotation(el.id, Math.round(angle))
    }
    function onUp() {
      isArrowRotating.value = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return {
    isElementDragging, elementWasDragged, isResizing, isArrowRotating, dragStartSnapshot,
    beginElementDrag, startResizeLine, startResizeRectEllipse,
    applyResizeMove, applyDragMove, finishResize, finishDrag,
    updateRotation, startRotationDrag, startArrowRotateDrag,
  }
}

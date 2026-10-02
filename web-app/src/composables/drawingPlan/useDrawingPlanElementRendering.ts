import { computed, type Ref } from 'vue'
import { getElementBounds, getElementLabel, getNoteAnchor, ELEMENT_TYPES, type DrawingPlanElementType } from '../../utils/drawingPlanElementTypes'

// Reine Lookup-/Geometrie-Helfer für das Rendern platzierter Elemente in DrawingPlanEditor.vue:
// Tower/Batten-Auflösung aus Props, Label-Texte, Kanal-Pillen-Geometrie (inkl. Richtungspfeil)
// und Notiz-Anker. Bewusst NICHT hier: alles was elements/selectedIds mutiert oder auf
// Maus-/Tastatur-Events reagiert — das bleibt in DrawingPlanEditor.vue (siehe dortige
// Mouse-Dispatch-Kette), da diese Funktionen rein lesend sind und keine eigene
// Entscheidungskette bilden.

export interface DrawingPlanElement {
  id: string
  type: string
  [key: string]: any
}

export interface Tower { id: string; name?: string; side?: string; slot_count?: number; slots?: Array<{ id: string; slot_index: number; channel_id?: string | null }> }
export interface Batten { id: string; name?: string; length_cm?: number; batten_nr?: number; fixtures?: Array<{ id: string; channel_id?: string; position: number }> }
export interface Channel { id: string; channel: string; device?: string; position?: string }

// Radius der Kanal-Pille (Node + Ghost-Cursor-Vorschau) — auch für getArrowPoints()
// maßgeblich, wo entlang des Pillenrands der Richtungspfeil ansetzt.
export const CHANNEL_PILL_RADIUS = 18
const NOTE_LABEL_GAP = 22

export function useDrawingPlanElementRendering(
  elements: Ref<DrawingPlanElement[]>,
  getChannels: () => Channel[],
  getTowers: () => Tower[],
  getBattens: () => Batten[],
) {
  function towerForEl(el: DrawingPlanElement): Tower | null {
    return getTowers().find(t => t.id === el.towerId) ?? null
  }
  function filledSlotsLabel(el: DrawingPlanElement): string {
    const t = towerForEl(el)
    if (!t) return ''
    const filled = (t.slots ?? []).filter(s => s.channel_id).length
    return `${filled}/${t.slot_count} Slots`
  }
  function battenForEl(el: DrawingPlanElement): Batten | null {
    return getBattens().find(b => b.id === el.battenId) ?? null
  }
  function fixturesLabel(el: DrawingPlanElement): string {
    const b = battenForEl(el)
    if (!b) return ''
    return `${(b.fixtures ?? []).length} Scheinwerfer`
  }
  function fixtureXOffset(positionCm: number, lengthCm: number | undefined, widthPx: number): number {
    const len = lengthCm || 600
    return ((positionCm + len / 2) / len) * widthPx
  }
  function channelNrById(channelId: string | undefined, fallback: string | null = '?'): string | null {
    return getChannels().find(c => c.id === channelId)?.channel ?? fallback
  }
  function pillW(_channel: string): number { return 62 }
  function noteTextWidth(text: string | undefined): number { return Math.max(40, (text?.length ?? 0) * 6.2 + 20) }
  function typeLabel(type: string): string { return getElementLabel(type) }

  function towerChannels(tower: Tower): string[] {
    return (tower.slots ?? [])
      .filter(slot => slot.channel_id)
      .sort((a, b) => a.slot_index - b.slot_index)
      .map(slot => channelNrById(slot.channel_id ?? undefined, null))
      .filter((v): v is string => !!v)
  }
  function battenChannels(batten: Batten): string[] {
    return (batten.fixtures ?? [])
      .filter(fx => fx.channel_id)
      .map(fx => channelNrById(fx.channel_id, null))
      .filter((v): v is string => !!v)
  }

  function getArrowPoints(channel: string, rot: number) {
    const rad = (rot || 0) * Math.PI / 180
    const w = pillW(channel)
    const r = CHANNEL_PILL_RADIUS
    const flatW = w / 2 - r

    const dx = Math.cos(rad)
    const dy = Math.sin(rad)

    let bx = 0, by = 0
    if (Math.abs(dy) > 0.001) {
      const yEdge = dy > 0 ? r : -r
      const xIntersect = yEdge * dx / dy
      if (xIntersect >= -flatW && xIntersect <= flatW) {
        bx = xIntersect
        by = yEdge
      }
    }

    if (bx === 0 && by === 0) {
      const cx = dx > 0 ? flatW : -flatW
      const B = -2 * dx * cx
      const C = cx * cx - r * r
      const disc = B * B - 4 * C
      if (disc >= 0) {
        const t = (-B + Math.sqrt(disc)) / 2
        bx = t * dx
        by = t * dy
      }
    }

    const len = 40
    return { x1: bx, y1: by, x2: bx + dx * len, y2: by + dy * len }
  }

  function getBounds(el: DrawingPlanElement) { return getElementBounds(el) }

  function getTransform(el: DrawingPlanElement): string {
    const rot = el.rotation || 0
    // channel positioniert sich immer über translate() statt x/y-Attribute —
    // strukturell keine Rotation, unabhängig von rot bleibt es dabei.
    if (el.type === 'channel') return `translate(${el.x}, ${el.y})`
    if (!rot) return ''
    // Nur Typen mit eigenem Rotationszentrum (line/rect/ellipse/text) rotieren
    // um ihre Mitte; alles andere (aktuell nur tower/batten, die in der UI ohnehin
    // keinen Rotationsgriff haben) fällt auf (0,0) zurück, wie im Original.
    const getCenter = ELEMENT_TYPES[el.type as DrawingPlanElementType]?.getCenter
    const { x: cx, y: cy } = getCenter ? getCenter(el) : { x: 0, y: 0 }
    return `rotate(${rot} ${cx} ${cy})`
  }

  const elementsWithNotes = computed(() => {
    return elements.value.filter(el => el.type !== 'text' && el.notes && el.notes.trim()).map(el => {
      // _anchorX/Y: point on the element border where the line starts
      // _noteX/Y: center of the pill label
      const { x: ax, y: ay } = getNoteAnchor(el)
      return { ...el, _anchorX: ax, _anchorY: ay, _noteX: ax, _noteY: ay + NOTE_LABEL_GAP }
    })
  })

  return {
    towerForEl, filledSlotsLabel, battenForEl, fixturesLabel, fixtureXOffset,
    channelNrById, pillW, noteTextWidth, typeLabel,
    towerChannels, battenChannels,
    getArrowPoints, getBounds, getTransform,
    elementsWithNotes,
  }
}

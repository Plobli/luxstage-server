import { ref, type Ref } from 'vue'
import type { DrawingPlanElement, Tower, Batten, Channel } from './useDrawingPlanElementRendering'

// Hover-Tooltip über platzierten Elementen in DrawingPlanEditor.vue: Positionierung relativ zum
// Canvas-Container und Zusammenstellung von Titel/Untertitel/Kanalliste je Elementtyp.
// Bewusst NICHT hier: Unterdrückung während Drag/Resize wird über isDragging/isResizing von
// außen injiziert statt hier neu zu entscheiden — der Drag/Resize-Zustand lebt in
// useElementDragResize.ts und soll keine zweite Quelle der Wahrheit bekommen.

export interface Tooltip {
  visible: boolean
  x: number
  y: number
  title: string
  sub: string
  channels: string[]
}

export function useDrawingPlanTooltip(
  containerEl: Ref<HTMLElement | null>,
  isDragging: Ref<boolean>,
  isResizing: Ref<boolean>,
  lookups: {
    towerForEl: (el: DrawingPlanElement) => Tower | null
    battenForEl: (el: DrawingPlanElement) => Batten | null
    filledSlotsLabel: (el: DrawingPlanElement) => string
    fixturesLabel: (el: DrawingPlanElement) => string
    channelNrById: (channelId: string | undefined, fallback?: string | null) => string | null
  },
  getChannels: () => Channel[],
  formatLength: (cm: number | null | undefined) => string,
) {
  const hoveredId = ref<string | null>(null)
  const tooltip = ref<Tooltip>({ visible: false, x: 0, y: 0, title: '', sub: '', channels: [] })

  function showTooltip(el: DrawingPlanElement, e: MouseEvent) {
    if (isDragging.value || isResizing.value) return
    const rect = containerEl.value?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    let title = '', sub = '', channels: string[] = []
    if (el.type === 'tower') {
      const t = lookups.towerForEl(el)
      title = t?.name || el.towerName || 'Turm'
      sub = t ? `${lookups.filledSlotsLabel(el)}${t.side ? ' · ' + t.side : ''}` : ''
      channels = (t?.slots ?? []).filter(s => s.channel_id).map(s => getChannels().find(c => c.id === s.channel_id)?.channel ?? '?')
    } else if (el.type === 'batten') {
      const b = lookups.battenForEl(el)
      title = b?.name || el.battenName || 'Stange'
      sub = b ? `${lookups.fixturesLabel(el)}${b.batten_nr ? ' · Zug ' + b.batten_nr : ''}${b.length_cm ? ' · ' + formatLength(b.length_cm) : ''}` : ''
      channels = (b?.fixtures ?? []).map(f => lookups.channelNrById(f.channel_id) ?? '?')
    } else if (el.type === 'channel') {
      title = `Kanal ${el.channel}`
      const info = getChannels().find(ch => ch.channel === el.channel)
      sub = [info?.device, info?.position].filter(Boolean).join(' · ')
    }
    if (!title) return
    tooltip.value = { visible: true, x, y, title, sub, channels }
  }
  function hideTooltip() {
    tooltip.value = { ...tooltip.value, visible: false }
  }

  return { hoveredId, tooltip, showTooltip, hideTooltip }
}

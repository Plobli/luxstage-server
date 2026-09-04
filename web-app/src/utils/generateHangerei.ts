import type { Bar } from '../api/bars'
import type { Channel } from '../api/channels'
import type { Tower } from '../api/towers'
import type { MeasureUnit } from '../composables/useMeasureUnit'

export function formatHangPosition(cm: number, unit: MeasureUnit, cmToDisplay: (n: number) => number, locale = 'de'): string {
  const isEn = locale === 'en'
  if (cm === 0) return isEn ? 'Centre' : 'Mitte'
  const val = cmToDisplay(Math.abs(cm))
  const side = isEn ? (cm < 0 ? 'Left' : 'Right') : (cm < 0 ? 'Links' : 'Rechts')
  return `${val}${unit} ${side}`
}

function formatColor(color: string | undefined): string | undefined {
  if (!color) return undefined
  const s = color.trim()
  if (/^[LRlr]\d/.test(s)) return s.toUpperCase()
  if (/^\d/.test(s)) return `L${s}`
  return s
}

function channelPrefix(locale: string): string {
  return locale === 'en' ? 'Ch.' : 'V.'
}

/** Baut den Zeileninhalt eines Zugbalkens OHNE Namens-Präfix — Basis für generateBarLine
 * und generateHangereiEntries, damit letzteres den Präfix nicht wieder abtrennen muss. */
function buildBarLineBody(
  bar: Bar,
  channelById: Map<string, Channel>,
  unit: MeasureUnit,
  cmToDisplay: (n: number) => number,
  locale = 'de'
): string {
  const hasFixtures = bar.fixtures?.length > 0
  const hasNotes = !!bar.notes

  if (!hasFixtures && !hasNotes) return ''
  if (!hasFixtures) return bar.notes ?? ''

  const isPunktzug = bar.bar_type === 'punktzug'
  const isTraverse = bar.bar_type === 'traverse'
  const sideLabel = (side?: string) => side === 'in' ? (locale === 'en' ? 'Inside' : 'Innen') : (locale === 'en' ? 'Outside' : 'Außen')
  const prefix = channelPrefix(locale)

  const sorted = [...bar.fixtures].sort((a, b) => a.position - b.position)
  const parts = sorted.map(fx => {
    const ch = channelById.get(fx.channel_id)
    const tokens = [
      `${prefix}${ch?.channel ?? '?'}`,
      ch?.device || undefined,
      ch?.address ? `#${ch.address}` : undefined,
      formatColor(ch?.color),
      isPunktzug ? (fx.position_text || undefined) : isTraverse ? `${sideLabel(fx.side)} ${formatHangPosition(fx.position, unit, cmToDisplay, locale)}` : formatHangPosition(fx.position, unit, cmToDisplay, locale),
      fx.notes || undefined,
    ].filter(Boolean)
    return tokens.join(' ')
  })
  const body = parts.join(' • ')
  return bar.notes ? `${body} • ${bar.notes}` : body
}

export function generateBarLine(
  bar: Bar,
  channelById: Map<string, Channel>,
  unit: MeasureUnit,
  cmToDisplay: (n: number) => number,
  locale = 'de'
): string {
  const body = buildBarLineBody(bar, channelById, unit, cmToDisplay, locale)
  return body ? `${bar.name}: ${body}` : ''
}

export interface HangereiEntry {
  name: string
  text: string
}

export function generateHangereiEntries(
  bars: Bar[],
  channelById: Map<string, Channel>,
  unit: MeasureUnit,
  cmToDisplay: (n: number) => number,
  locale = 'de'
): HangereiEntry[] {
  return [...bars]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap(bar => {
      const text = buildBarLineBody(bar, channelById, unit, cmToDisplay, locale)
      if (!text) return []
      return [{ name: bar.name, text }]
    })
}

export interface GassenturmEntry {
  name: string
  text: string
}

export function generateGassenturmEntries(
  towers: Tower[],
  channelById: Map<string, Channel>,
  locale = 'de'
): GassenturmEntry[] {
  const prefix = locale === 'en' ? 'Ch.' : 'V.'
  return [...towers]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap(tower => {
      const filled = [...(tower.slots ?? [])]
        .sort((a, b) => a.slot_index - b.slot_index)
        .filter(s => s.channel_id)
      if (!filled.length) return []

      const header = [tower.name, tower.stage_area, tower.side].filter(Boolean).join(' ')
      const parts = filled.map(slot => {
        const ch = channelById.get(slot.channel_id!)
        return [
          `${prefix}${ch?.channel ?? '?'}`,
          ch?.device || undefined,
          formatColor(ch?.color),
        ].filter(Boolean).join(' ')
      })
      return [{ name: header, text: parts.join(', ') }]
    })
}

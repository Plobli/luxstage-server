import type { Batten } from '../api/battens'
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

/** Baut den Zeileninhalt eines Zugbalkens OHNE Namens-Präfix — Basis für generateBattenLine
 * und generateFlySystemEntries, damit letzteres den Präfix nicht wieder abtrennen muss. */
function buildBattenLineBody(
  batten: Batten,
  channelById: Map<string, Channel>,
  unit: MeasureUnit,
  cmToDisplay: (n: number) => number,
  locale = 'de'
): string {
  const hasFixtures = batten.fixtures?.length > 0
  const hasNotes = !!batten.notes

  if (!hasFixtures && !hasNotes) return ''
  if (!hasFixtures) return batten.notes ?? ''

  const isPointBatten = batten.batten_type === 'point_batten'
  const isTraverse = batten.batten_type === 'traverse'
  const sideLabel = (side?: string) => side === 'in' ? (locale === 'en' ? 'Inside' : 'Innen') : (locale === 'en' ? 'Outside' : 'Außen')
  const prefix = channelPrefix(locale)

  const sorted = [...batten.fixtures].sort((a, b) => a.position - b.position)
  const parts = sorted.map(fx => {
    const ch = fx.channel_id ? channelById.get(fx.channel_id) : undefined
    const tokens = [
      `${prefix}${ch?.channel ?? '?'}`,
      ch?.device || undefined,
      ch?.address ? `#${ch.address}` : undefined,
      formatColor(ch?.color),
      isPointBatten ? (fx.position_text || undefined) : isTraverse ? `${sideLabel(fx.side)} ${formatHangPosition(fx.position, unit, cmToDisplay, locale)}` : formatHangPosition(fx.position, unit, cmToDisplay, locale),
      fx.notes || undefined,
    ].filter(Boolean)
    return tokens.join(' ')
  })
  const body = parts.join(' • ')
  return batten.notes ? `${body} • ${batten.notes}` : body
}

export function generateBattenLine(
  batten: Batten,
  channelById: Map<string, Channel>,
  unit: MeasureUnit,
  cmToDisplay: (n: number) => number,
  locale = 'de'
): string {
  const body = buildBattenLineBody(batten, channelById, unit, cmToDisplay, locale)
  return body ? `${batten.name}: ${body}` : ''
}

export interface FlySystemEntry {
  name: string
  text: string
}

export function generateFlySystemEntries(
  battens: Batten[],
  channelById: Map<string, Channel>,
  unit: MeasureUnit,
  cmToDisplay: (n: number) => number,
  locale = 'de'
): FlySystemEntry[] {
  return [...battens]
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap(batten => {
      const text = buildBattenLineBody(batten, channelById, unit, cmToDisplay, locale)
      if (!text) return []
      return [{ name: batten.name, text }]
    })
}

export interface LightingTowerEntry {
  name: string
  text: string
}

export function generateLightingTowerEntries(
  towers: Tower[],
  channelById: Map<string, Channel>,
  locale = 'de'
): LightingTowerEntry[] {
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

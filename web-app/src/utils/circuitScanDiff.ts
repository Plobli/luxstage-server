// Diff-Berechnung für den Circuit-Scan-Import (useShowChannels.ts). Reine Funktion ohne
// Vue-Bezug, unabhängig von einer gemounteten Komponente testbar.

import type { Channel } from '../api/channels'

export interface CircuitScanFieldChange {
  key: 'address' | 'device' | 'position' | 'color' | 'notes'
  oldValue: string
  newValue: string
}
export interface CircuitScanUpdatedRow {
  channel: string
  changes: CircuitScanFieldChange[]
}

const CIRCUIT_SCAN_DIFF_FIELDS = ['address', 'device', 'position', 'color', 'notes'] as const

export function buildCircuitScanDiff(existing: Channel[], rows: Channel[]): { updated: CircuitScanUpdatedRow[], added: Channel[] } {
  const byChannel = new Map(existing.map(ch => [ch.channel, ch]))
  const updated: CircuitScanUpdatedRow[] = []
  const added: Channel[] = []
  for (const row of rows) {
    const match = byChannel.get(row.channel)
    if (!match) { added.push(row); continue }
    const changes: CircuitScanFieldChange[] = []
    for (const key of CIRCUIT_SCAN_DIFF_FIELDS) {
      const newValue = row[key]
      if (newValue === undefined || newValue === '') continue
      const oldValue = match[key] ?? ''
      if (newValue !== oldValue) changes.push({ key, oldValue, newValue })
    }
    if (changes.length > 0) updated.push({ channel: row.channel, changes })
  }
  return { updated, added }
}

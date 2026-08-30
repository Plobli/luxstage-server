// server/db/full-state.js
// Liest/schreibt den kompletten Show-Zustand als eine atomare Einheit —
// Grundlage für Undo/Redo, das nie nur einen Ressourcentyp isoliert
// wiederherstellen darf (sonst können Aktionen, die mehrere Ressourcentypen
// in einem Schritt ändern, in einen inkonsistenten Zwischenzustand laufen).
import { createHash } from 'node:crypto'
import { getDb } from '../db-context.js'
import { readChannels, writeChannels } from './channels.js'
import { readShowSectionDefs, writeShowSectionDefs, readShowSections, writeShowSections } from './sections.js'
import { readTowers, restoreTowers } from './towers.js'
import { readBars, restoreBars } from './bars.js'

export function readFullShowState(slug) {
  const sections = readShowSections(slug)
  return {
    channels: readChannels(slug).map(({ show_id: _showId, sort_order: _sortOrder, id: _id, ...ch }) => {
      const normalized = {
        channel: ch.channel,
        address: ch.address,
        device: ch.device,
        position: ch.position,
        color: ch.color,
        notes: ch.notes,
      }
      // Nur mount_ref/quantity einschließen, wenn sie non-default sind
      if (ch.mount_ref !== null) normalized.mount_ref = ch.mount_ref
      if (ch.quantity !== 1) normalized.quantity = ch.quantity
      return normalized
    }),
    sectionDefs: readShowSectionDefs(slug),
    sections: [...sections.entries()].map(([id, content]) => ({ id, content })),
    towers: readTowers(slug),
    bars: readBars(slug),
  }
}

export function writeFullShowState(slug, state, username) {
  const tx = getDb().transaction(() => {
    writeChannels(slug, state.channels, username)
    writeShowSectionDefs(slug, state.sectionDefs, username)
    writeShowSections(slug, new Map(state.sections.map(s => [s.id, s.content])), username)
    restoreTowers(slug, state.towers)
    restoreBars(slug, state.bars)
  })
  tx()
}

// Deterministisch: Objekt-Keys werden nicht sortiert, da alle vier Read-Funktionen
// bereits stabil nach sort_order/slot_index/position sortieren.
export function computeStateHash(state) {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex')
}

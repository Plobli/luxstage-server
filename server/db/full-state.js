// server/db/full-state.js
// Liest/schreibt den kompletten Show-Zustand als eine atomare Einheit —
// Grundlage für Undo/Redo, das nie nur einen Ressourcentyp isoliert
// wiederherstellen darf (sonst können Aktionen, die mehrere Ressourcentypen
// in einem Schritt ändern, in einen inkonsistenten Zwischenzustand laufen).
import { createHash } from 'node:crypto'
import { getDb } from '../db-context.js'
import { readChannels, restoreChannels } from './channels.js'
import { readShowSectionDefs, writeShowSectionDefs, readShowSections, writeShowSections } from './sections.js'
import { readTowers, restoreTowers } from './towers.js'
import { readBattens, restoreBattens } from './battens.js'
import { readDrawingPlanForState, restoreDrawingPlan } from './drawing-plan.js'
import { upgradeLegacyNames } from './legacy-names.js'

export function readFullShowState(slug) {
  const sections = readShowSections(slug)
  return {
    channels: readChannels(slug).map(({ show_id: _showId, sort_order: _sortOrder, ...ch }) => {
      const normalized = {
        // id bewusst mitgeschnitten (anders als bei anderen Feldern hier
        // kein reiner Anzeigewert): restoreChannels() braucht die exakte
        // Snapshot-id, damit Tower-/Batten-Slots, die per channel_id auf diesen
        // Kanal verweisen, nach einem Restore nicht auf eine inzwischen
        // durch Löschen+Neuanlage vergebene andere id zeigen.
        id: ch.id,
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
    battens: readBattens(slug),
    drawingPlan: readDrawingPlanForState(slug),
  }
}

// Snapshots aus der Zeit vor der Umbenennung (bars/floorplan) tragen noch alte Namen.
function upgradeLegacyState(state) {
  if (state.bars === undefined && state.floorplan === undefined) return state
  const { bars, floorplan, ...rest } = state
  return {
    ...rest,
    channels: upgradeLegacyNames(rest.channels),
    battens: upgradeLegacyNames(bars),
    drawingPlan: upgradeLegacyNames(floorplan),
  }
}

export function writeFullShowState(slug, legacyState, username) {
  const state = upgradeLegacyState(legacyState)
  const tx = getDb().transaction(() => {
    restoreChannels(slug, state.channels, username)
    writeShowSectionDefs(slug, state.sectionDefs, username)
    writeShowSections(slug, new Map(state.sections.map(s => [s.id, s.content])), username)
    restoreTowers(slug, state.towers)
    restoreBattens(slug, state.battens)
    restoreDrawingPlan(slug, state.drawingPlan)
  })
  tx()
}

// Deterministisch: Objekt-Keys werden nicht sortiert, da alle vier Read-Funktionen
// bereits stabil nach sort_order/slot_index/position sortieren.
export function computeStateHash(state) {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex')
}

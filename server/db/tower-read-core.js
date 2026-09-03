import { getDb } from '../db-context.js'

// Gemeinsamer Lesepfad für Türme + ihre Slots, genutzt von towers.js (Show-Scope:
// towers/tower_slots) und template-towers.js (Template-Scope: template_towers/
// template_tower_slots) — identische Zuordnungslogik (Eltern-Zeilen nach sort_order,
// dann Kind-Zeilen je Eltern-Zeile nach slot_index anhängen), nur Tabellennamen
// unterscheiden sich. Der Schreibpfad wird bewusst NICHT hier zusammengelegt:
// writeTower hat einen Current-Value-Fallback (data.x ?? current.x ?? default) und eine
// notes-Spalte, die template_towers nicht kennt; template_tower_slots trägt zusätzlich
// denormalisierte channel/device/color-Strings statt einer channel_id-Fremdschlüssel-
// Referenz. Diese Divergenz ist inhaltlich begründet, kein Versehen — siehe writeTower
// vs. writeTemplateTower.
export function readTowersWithSlotsCore(towersTable, slotsTable, scopeColumn, scopeId) {
  const towers = getDb().prepare(`SELECT * FROM ${towersTable} WHERE ${scopeColumn} = ? ORDER BY sort_order`).all(scopeId)
  for (const tower of towers) {
    tower.slots = getDb().prepare(`SELECT * FROM ${slotsTable} WHERE tower_id = ? ORDER BY slot_index`).all(tower.id)
  }
  return towers
}

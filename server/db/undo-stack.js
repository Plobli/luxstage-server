// Gemeinsame Mechanik für die Undo/Redo-Stacks (Memento-Muster).
//
// Show- und Netzwerk-Stack sind bis auf eine Scope-Spalte identisch: `operations`
// hat `show_id`, `network_operations` ist ein einziger globaler Stack. Vorher
// standen beide Varianten als zwei parallel gepflegte Kopien nebeneinander.
//
// Tabellennamen stammen ausschließlich aus den beiden Konfigurationen in
// operations.js und network-operations.js, nie aus Eingaben — die Interpolation
// in die SQL-Strings ist damit unbedenklich.
import { randomUUID } from 'node:crypto'
import { getDb } from '../db-context.js'

const MAX_HISTORY = 50

// Sortiert wird durchgehend nach `created_at DESC, rowid DESC`: zwei Einträge
// derselben Millisekunde wären allein über created_at nicht eindeutig geordnet,
// und Undo/Redo könnte bei schnell aufeinanderfolgenden Aktionen den falschen
// Eintrag ziehen.
const NEWEST_FIRST = 'ORDER BY created_at DESC, rowid DESC'

/**
 * @param opTable      Tabelle der Undo-Einträge (mit `performed_by`)
 * @param redoTable    Tabelle des Redo-Stacks (ohne `performed_by`)
 * @param scopeColumn  Spaltenname des Scopes, oder null für einen globalen Stack
 * @param readState    () => Zustand — liest den vollständigen Zustand
 * @param hashState    (state) => string — Integritätsprüfsumme des Zustands
 */
export function makeUndoStack({ opTable, redoTable, scopeColumn, readState, hashState }) {
  const scoped = Boolean(scopeColumn)
  const where = scoped ? `WHERE ${scopeColumn} = ?` : ''
  const args = id => (scoped ? [id] : [])

  // Ältere Einträge über MAX_HISTORY hinaus verwerfen — je Scope, nicht global.
  function prune(table, scopeId) {
    const keep = `SELECT id FROM ${table} ${where} ${NEWEST_FIRST} LIMIT ?`
    getDb().prepare(
      `DELETE FROM ${table} ${scoped ? `WHERE ${scopeColumn} = ? AND` : 'WHERE'} id NOT IN (${keep})`
    ).run(...args(scopeId), ...args(scopeId), MAX_HISTORY)
  }

  function record(scopeId, username, stateBefore) {
    const cols = scoped
      ? `id, ${scopeColumn}, created_at, performed_by, snapshot, hash`
      : 'id, created_at, performed_by, snapshot, hash'
    const placeholders = scoped ? '?, ?, ?, ?, ?, ?' : '?, ?, ?, ?, ?'
    getDb().prepare(`INSERT INTO ${opTable} (${cols}) VALUES (${placeholders})`)
      .run(randomUUID(), ...args(scopeId), Date.now(), username,
           JSON.stringify(stateBefore), hashState(stateBefore))
    prune(opTable, scopeId)
  }

  function getLast(scopeId) {
    return getDb().prepare(
      `SELECT * FROM ${opTable} ${where} ${NEWEST_FIRST} LIMIT 1`
    ).get(...args(scopeId)) ?? null
  }

  function deleteEntry(id) {
    getDb().prepare(`DELETE FROM ${opTable} WHERE id = ?`).run(id)
  }

  function pushRedo(scopeId, state) {
    const cols = scoped ? `id, ${scopeColumn}, created_at, snapshot, hash` : 'id, created_at, snapshot, hash'
    const placeholders = scoped ? '?, ?, ?, ?, ?' : '?, ?, ?, ?'
    getDb().prepare(`INSERT INTO ${redoTable} (${cols}) VALUES (${placeholders})`)
      .run(randomUUID(), ...args(scopeId), Date.now(), JSON.stringify(state), hashState(state))
    prune(redoTable, scopeId)
  }

  function popRedo(scopeId) {
    const entry = getDb().prepare(
      `SELECT * FROM ${redoTable} ${where} ${NEWEST_FIRST} LIMIT 1`
    ).get(...args(scopeId))
    if (!entry) return null
    getDb().prepare(`DELETE FROM ${redoTable} WHERE id = ?`).run(entry.id)
    return entry
  }

  function clearRedo(scopeId) {
    getDb().prepare(`DELETE FROM ${redoTable} ${where}`).run(...args(scopeId))
  }

  // Führt mutate() aus und zeichnet den Zustand VOR der Änderung als Undo-Punkt
  // auf — beides in einer gemeinsamen Transaktion, damit ein Fehler in mutate()
  // nie eine Historie ohne zugehörige Datenänderung hinterlässt (und umgekehrt).
  // stateKey: was readState() braucht (Show-Slug bzw. nichts beim Netzwerk).
  function withSnapshot(scopeId, stateKey, username, mutate) {
    const tx = getDb().transaction(() => {
      const stateBefore = readState(stateKey)
      mutate()
      record(scopeId, username, stateBefore)
      clearRedo(scopeId)
    })
    tx()
  }

  return { record, getLast, deleteEntry, pushRedo, popRedo, clearRedo, withSnapshot }
}

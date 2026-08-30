import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'
import { readFullShowState, computeStateHash } from './full-state.js'

const MAX_HISTORY = 50

export function recordSnapshot(showId, username, stateBefore) {
  const id = randomUUID()
  const hash = computeStateHash(stateBefore)
  getDb().prepare(`
    INSERT INTO operations (id, show_id, created_at, performed_by, snapshot, hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, showId, Date.now(), username, JSON.stringify(stateBefore), hash)

  getDb().prepare(`
    DELETE FROM operations WHERE show_id = ? AND id NOT IN (
      SELECT id FROM operations WHERE show_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `).run(showId, showId, MAX_HISTORY)
}

export function getLastOperation(showId) {
  return getDb().prepare(
    'SELECT * FROM operations WHERE show_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(showId) ?? null
}

export function deleteOperation(id) {
  getDb().prepare('DELETE FROM operations WHERE id = ?').run(id)
}

export function pushRedo(showId, state) {
  const id = randomUUID()
  const hash = computeStateHash(state)
  getDb().prepare(`
    INSERT INTO redo_stack (id, show_id, created_at, snapshot, hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, showId, Date.now(), JSON.stringify(state), hash)

  getDb().prepare(`
    DELETE FROM redo_stack WHERE show_id = ? AND id NOT IN (
      SELECT id FROM redo_stack WHERE show_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `).run(showId, showId, MAX_HISTORY)
}

export function popRedo(showId) {
  const entry = getDb().prepare(
    'SELECT * FROM redo_stack WHERE show_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(showId)
  if (!entry) return null
  getDb().prepare('DELETE FROM redo_stack WHERE id = ?').run(entry.id)
  return entry
}

export function clearRedo(showId) {
  getDb().prepare('DELETE FROM redo_stack WHERE show_id = ?').run(showId)
}

// Führt mutate() aus und zeichnet den Zustand VOR der Änderung als Undo-Punkt
// auf — beides in einer gemeinsamen Transaktion, damit ein Fehler in mutate()
// nie eine Historie ohne zugehörige Datenänderung hinterlässt (und umgekehrt).
export function withUndoSnapshot(slug, showId, username, mutate) {
  const tx = getDb().transaction(() => {
    const stateBefore = readFullShowState(slug)
    mutate()
    recordSnapshot(showId, username, stateBefore)
    clearRedo(showId)
  })
  tx()
}

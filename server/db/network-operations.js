// server/db/network-operations.js
// Serverseitiges Undo/Redo fürs Netzwerk — analog zu operations.js für Shows,
// aber als einziger globaler Stack (kein show_id).
import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'
import { readFullNetworkState, computeNetworkStateHash } from './network-state.js'

const MAX_HISTORY = 50

export function recordNetworkSnapshot(username, stateBefore) {
  const id = randomUUID()
  const hash = computeNetworkStateHash(stateBefore)
  getDb().prepare(`
    INSERT INTO network_operations (id, created_at, performed_by, snapshot, hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, Date.now(), username, JSON.stringify(stateBefore), hash)

  getDb().prepare(`
    DELETE FROM network_operations WHERE id NOT IN (
      SELECT id FROM network_operations ORDER BY created_at DESC LIMIT ?
    )
  `).run(MAX_HISTORY)
}

export function getLastNetworkOperation() {
  return getDb().prepare(
    'SELECT * FROM network_operations ORDER BY created_at DESC LIMIT 1'
  ).get() ?? null
}

export function deleteNetworkOperation(id) {
  getDb().prepare('DELETE FROM network_operations WHERE id = ?').run(id)
}

export function pushNetworkRedo(state) {
  const id = randomUUID()
  const hash = computeNetworkStateHash(state)
  getDb().prepare(`
    INSERT INTO network_redo_stack (id, created_at, snapshot, hash)
    VALUES (?, ?, ?, ?)
  `).run(id, Date.now(), JSON.stringify(state), hash)

  getDb().prepare(`
    DELETE FROM network_redo_stack WHERE id NOT IN (
      SELECT id FROM network_redo_stack ORDER BY created_at DESC LIMIT ?
    )
  `).run(MAX_HISTORY)
}

export function popNetworkRedo() {
  const entry = getDb().prepare(
    'SELECT * FROM network_redo_stack ORDER BY created_at DESC LIMIT 1'
  ).get()
  if (!entry) return null
  getDb().prepare('DELETE FROM network_redo_stack WHERE id = ?').run(entry.id)
  return entry
}

export function clearNetworkRedo() {
  getDb().prepare('DELETE FROM network_redo_stack').run()
}

// Führt mutate() aus und zeichnet den Zustand VOR der Änderung als Undo-Punkt
// auf — beides in einer gemeinsamen Transaktion (siehe operations.js).
export function withNetworkUndoSnapshot(username, mutate) {
  const tx = getDb().transaction(() => {
    const stateBefore = readFullNetworkState()
    mutate()
    recordNetworkSnapshot(username, stateBefore)
    clearNetworkRedo()
  })
  tx()
}

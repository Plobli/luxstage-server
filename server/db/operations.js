import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'

const MAX_HISTORY = 50

// Redo ist bewusst nicht persistent: es ergibt nur bis zum nächsten aktiven
// Schreibvorgang Sinn und wird davon ohnehin sofort verworfen (siehe clearRedo).
// Map<show_id, entry[]> — pro Tenant-Prozess im Speicher, wie snapshotHashes in history.js.
const redoStacks = new Map()

export function recordOperation(showId, username, resourceType, oldValue, newValue) {
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO operations (id, show_id, created_at, performed_by, resource_type, payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, showId, Date.now(), username, resourceType, JSON.stringify({ old: oldValue, new: newValue }))

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

export function pushRedo(showId, entry) {
  if (!redoStacks.has(showId)) redoStacks.set(showId, [])
  const stack = redoStacks.get(showId)
  stack.push(entry)
  if (stack.length > MAX_HISTORY) stack.shift()
}

export function popRedo(showId) {
  return redoStacks.get(showId)?.pop() ?? null
}

export function clearRedo(showId) {
  redoStacks.delete(showId)
}

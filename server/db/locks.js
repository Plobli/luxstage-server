import { getDb } from '../db-context.js'
import { config } from '../config.js'

// show_id + bestehender Lock in einer Query statt readShow() + separatem Lock-Query
// (gleiches Muster wie getLock() unten). LEFT JOIN, da eine Show ohne Lock ein
// gültiger Fall ist (existing-Felder sind dann null).
function findShowWithLock(slug) {
  return getDb().prepare(`
    SELECT s.id AS show_id, l.username AS lock_username, l.since AS lock_since
      FROM shows s
      LEFT JOIN locks l ON l.show_id = s.id
     WHERE s.slug = ?
  `).get(slug) ?? null
}

export function acquireLock(slug, username) {
  const row = findShowWithLock(slug)
  if (!row) return { ok: false }
  if (row.lock_username != null) {
    const age = Date.now() - row.lock_since
    if (age < config.lockTimeout && row.lock_username !== username) {
      return { ok: false, lockedBy: row.lock_username, since: row.lock_since }
    }
  }
  getDb().prepare('INSERT OR REPLACE INTO locks (show_id, username, since) VALUES (?, ?, ?)')
    .run(row.show_id, username, Date.now())
  return { ok: true }
}

export function releaseLock(slug, username) {
  const row = findShowWithLock(slug)
  if (!row) return
  if (row.lock_username === username) {
    getDb().prepare('DELETE FROM locks WHERE show_id = ?').run(row.show_id)
  }
}

/** Übergibt den Lock direkt an einen anderen User (Übernahme-Freigabe) — atomar,
 *  kein Zeitfenster in dem der Lock frei wäre und ein Dritter zugreifen könnte. */
export function transferLock(slug, fromUsername, toUsername) {
  const row = findShowWithLock(slug)
  if (!row || row.lock_username !== fromUsername) return false
  getDb().prepare('INSERT OR REPLACE INTO locks (show_id, username, since) VALUES (?, ?, ?)')
    .run(row.show_id, toUsername, Date.now())
  return true
}

export function touchLock(slug, username) {
  const row = findShowWithLock(slug)
  if (!row) return
  getDb().prepare('UPDATE locks SET since = ? WHERE show_id = ? AND username = ?')
    .run(Date.now(), row.show_id, username)
}

// Läuft vor jedem Schreibzugriff auf eine Show (router.js) — daher ein Join
// statt readShow() + separatem Lock-Query. shows.slug ist UNIQUE und damit indiziert.
export function getLock(slug) {
  const row = getDb().prepare(`
    SELECT l.show_id, l.username, l.since
      FROM locks l
      JOIN shows s ON s.id = l.show_id
     WHERE s.slug = ?
  `).get(slug)
  if (!row) return null
  if (Date.now() - row.since >= config.lockTimeout) {
    getDb().prepare('DELETE FROM locks WHERE show_id = ?').run(row.show_id)
    return null
  }
  return { user: row.username, since: row.since }
}

/** Alle aktiven Locks als Map<show_id, {user, since}> — für die Show-Liste,
 *  ein Query statt getLock() pro Show. Abgelaufene Locks werden übersprungen,
 *  aber (anders als getLock) nicht gelöscht — das nächste getLock()/acquireLock()
 *  auf genau diese Show räumt sie bei Bedarf auf. */
export function listLocks() {
  const rows = getDb().prepare('SELECT * FROM locks').all()
  const now = Date.now()
  const result = new Map()
  for (const row of rows) {
    if (now - row.since >= config.lockTimeout) continue
    result.set(row.show_id, { user: row.username, since: row.since })
  }
  return result
}

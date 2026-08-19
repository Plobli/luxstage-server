import { getDb } from '../db-context.js'
import { config } from '../config.js'
import { readShow } from './shows.js'

export function acquireLock(slug, username) {
  const show = readShow(slug)
  if (!show) return { ok: false }
  const existing = getDb().prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (existing) {
    const age = Date.now() - existing.since
    if (age < config.lockTimeout && existing.username !== username) {
      return { ok: false, lockedBy: existing.username, since: existing.since }
    }
  }
  getDb().prepare('INSERT OR REPLACE INTO locks (show_id, username, since) VALUES (?, ?, ?)')
    .run(show.id, username, Date.now())
  return { ok: true }
}

export function releaseLock(slug, username) {
  const show = readShow(slug)
  if (!show) return
  const lock = getDb().prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (lock?.username === username) {
    getDb().prepare('DELETE FROM locks WHERE show_id = ?').run(show.id)
  }
}

/** Übergibt den Lock direkt an einen anderen User (Übernahme-Freigabe) — atomar,
 *  kein Zeitfenster in dem der Lock frei wäre und ein Dritter zugreifen könnte. */
export function transferLock(slug, fromUsername, toUsername) {
  const show = readShow(slug)
  if (!show) return false
  const lock = getDb().prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (lock?.username !== fromUsername) return false
  getDb().prepare('INSERT OR REPLACE INTO locks (show_id, username, since) VALUES (?, ?, ?)')
    .run(show.id, toUsername, Date.now())
  return true
}

export function touchLock(slug, username) {
  const show = readShow(slug)
  if (!show) return
  getDb().prepare('UPDATE locks SET since = ? WHERE show_id = ? AND username = ?')
    .run(Date.now(), show.id, username)
}

export function getLock(slug) {
  const show = readShow(slug)
  if (!show) return null
  const lock = getDb().prepare('SELECT * FROM locks WHERE show_id = ?').get(show.id)
  if (!lock) return null
  if (Date.now() - lock.since >= config.lockTimeout) {
    getDb().prepare('DELETE FROM locks WHERE show_id = ?').run(show.id)
    return null
  }
  return { user: lock.username, since: lock.since }
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

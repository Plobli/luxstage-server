// server/db/resource-locks.js
// Generischer Single-Editor-Lock für Ressourcen ohne eigene shows-Zeile
// (Netzwerk, Templates) — gleiche Semantik wie db/locks.js (Timeout, atomare
// Übernahme), aber über einen freien String-Schlüssel statt show_id.
// db/locks.js bleibt unverändert bestehen (shows behalten ihren eigenen,
// bereits ausführlich getesteten Mechanismus) — dieses Modul deckt die
// Ressourcen ab, die keine Zeile in `shows` haben.
import { getDb } from '../db-context.js'
import { config } from '../config.js'

export function acquireResourceLock(lockKey, username) {
  const row = getDb().prepare('SELECT * FROM resource_locks WHERE lock_key = ?').get(lockKey)
  if (row) {
    const age = Date.now() - row.since
    if (age < config.lockTimeout && row.username !== username) {
      return { ok: false, lockedBy: row.username, since: row.since }
    }
  }
  getDb().prepare('INSERT OR REPLACE INTO resource_locks (lock_key, username, since) VALUES (?, ?, ?)')
    .run(lockKey, username, Date.now())
  return { ok: true }
}

export function releaseResourceLock(lockKey, username) {
  getDb().prepare('DELETE FROM resource_locks WHERE lock_key = ? AND username = ?').run(lockKey, username)
}

/** Übergibt den Lock direkt an einen anderen User (Übernahme-Freigabe) — atomar,
 *  kein Zeitfenster in dem der Lock frei wäre und ein Dritter zugreifen könnte. */
export function transferResourceLock(lockKey, fromUsername, toUsername) {
  const row = getDb().prepare('SELECT * FROM resource_locks WHERE lock_key = ?').get(lockKey)
  if (!row || row.username !== fromUsername) return false
  getDb().prepare('INSERT OR REPLACE INTO resource_locks (lock_key, username, since) VALUES (?, ?, ?)')
    .run(lockKey, toUsername, Date.now())
  return true
}

export function touchResourceLock(lockKey, username) {
  getDb().prepare('UPDATE resource_locks SET since = ? WHERE lock_key = ? AND username = ?')
    .run(Date.now(), lockKey, username)
}

export function getResourceLock(lockKey) {
  const row = getDb().prepare('SELECT * FROM resource_locks WHERE lock_key = ?').get(lockKey)
  if (!row) return null
  if (Date.now() - row.since >= config.lockTimeout) {
    getDb().prepare('DELETE FROM resource_locks WHERE lock_key = ?').run(lockKey)
    return null
  }
  return { user: row.username, since: row.since }
}

import { getDb } from '../db-context.js'

const upsertStmt = "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"

export function getSetting(key) {
  return getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value
}

export function setSetting(key, value) {
  getDb().prepare(upsertStmt).run(key, value)
}

export function getSettingsByPrefix(prefix) {
  return getDb().prepare('SELECT key, value FROM settings WHERE key LIKE ?').all(`${prefix}%`)
}

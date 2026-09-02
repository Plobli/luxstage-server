import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto'
import { getDb } from '../db-context.js'
import { config } from '../config.js'

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

// Eigener Zweck-Schlüssel, damit derselbe JWT_SECRET nicht doppelt genutzt wird.
const SECRET_KEY = Buffer.from(hkdfSync('sha256', config.jwtSecret, 'luxstage-settings', 'aes-256-gcm', 32))

// Verschlüsselte Ablage für Secrets at rest (z. B. SMTP-Passwort), die in Backups landen können.
export function setSecretSetting(key, plain) {
  if (!plain) return setSetting(key, '')
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', SECRET_KEY, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  setSetting(key, `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`)
}

export function getSecretSetting(key) {
  const raw = getSetting(key)
  if (!raw) return ''
  if (!raw.startsWith('v1:')) return raw
  const [, iv, tag, data] = raw.split(':')
  const d = createDecipheriv('aes-256-gcm', SECRET_KEY, Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8')
}

import { getDb } from '../db-context.js'
import { hashPassword } from '../auth.js'

export function getDbPassword(username) {
  const row = getDb().prepare('SELECT password FROM users WHERE username = ?').get(username)
  return row?.password ?? null
}

export async function changePassword(username, newPassword, requiresChange = 0) {
  const hash = await hashPassword(newPassword)
  getDb().prepare(`
    INSERT INTO users (username, password, requires_password_change)
    VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      requires_password_change = excluded.requires_password_change
  `).run(username, hash, requiresChange ? 1 : 0)
}

export function listUsers() {
  return getDb().prepare('SELECT username, email FROM users').all()
    .map(u => ({ username: u.username, email: u.email || '', source: 'db' }))
}

export function getUserEmail(username) {
  const row = getDb().prepare('SELECT email FROM users WHERE username = ?').get(username)
  return row?.email || null
}

// Findet den Nutzernamen zu einer E-Mail (für Self-Service-Reset).
export function findUserByEmail(email) {
  const row = getDb().prepare('SELECT username FROM users WHERE email = ? COLLATE NOCASE').get(email)
  return row?.username ?? null
}

// ── Passwort-Reset-Token (Self-Service) ──────────────────────────────────────
export function createResetToken(token, username, ttlMs) {
  const now = Date.now()
  getDb().prepare(
    'INSERT INTO password_resets (token, username, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, username, now, now + ttlMs)
}

// Löst den Token ein (einmalig): gibt username zurück oder null.
export function takeResetToken(token) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM password_resets WHERE token = ?').get(token)
  if (!row) return null
  db.prepare('DELETE FROM password_resets WHERE token = ?').run(token)
  if (row.expires_at < Date.now()) return null
  return row.username
}

// Offene Reset-Token eines Nutzers verwerfen (bei neuem Request / nach Erfolg).
export function clearResetTokens(username) {
  getDb().prepare('DELETE FROM password_resets WHERE username = ?').run(username)
}

export async function createUser(username, password, email = '') {
  const hash = await hashPassword(password)
  getDb().prepare('INSERT INTO users (username, password, email, requires_password_change) VALUES (?, ?, ?, 1) ON CONFLICT(username) DO UPDATE SET password = excluded.password, email = excluded.email, requires_password_change = 1')
    .run(username, hash, email)
}

export function deleteUser(username) {
  getDb().prepare('DELETE FROM users WHERE username = ?').run(username)
}

export function getUserPreferences(username) {
  const row = getDb().prepare('SELECT sidebar_pinned FROM users WHERE username = ?').get(username)
  return { sidebarPinned: row?.sidebar_pinned === 1 }
}

export function setUserPreferences(username, { sidebarPinned }) {
  getDb().prepare('UPDATE users SET sidebar_pinned = ? WHERE username = ?')
    .run(sidebarPinned ? 1 : 0, username)
}

export function getGridDeckConfig(username) {
  const row = getDb().prepare('SELECT griddeck_config FROM users WHERE username = ?').get(username)
  if (!row?.griddeck_config) return null
  try { return JSON.parse(row.griddeck_config) } catch { return null }
}

export function setGridDeckConfig(username, config) {
  const json = JSON.stringify(config)
  getDb().prepare('UPDATE users SET griddeck_config = ? WHERE username = ?').run(json, username)
}

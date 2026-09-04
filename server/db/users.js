import { createHash } from 'node:crypto'
import { getDb } from '../db-context.js'

const hashToken = t => createHash('sha256').update(t).digest('hex')

export function getDbPassword(username) {
  const row = getDb().prepare('SELECT password FROM users WHERE username = ?').get(username)
  return row?.password ?? null
}

// Nimmt bewusst einen bereits gehashten Wert entgegen statt selbst zu hashen —
// die Persistenzschicht soll nicht von auth.js (Hashing-Algorithmus/-Kosten)
// abhängen. Aufrufer hashen mit hashPassword() aus auth.js und übergeben den Hash.
export function setPasswordHash(username, passwordHash, requiresChange = 0) {
  getDb().prepare(`
    INSERT INTO users (username, password, requires_password_change)
    VALUES (?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      requires_password_change = excluded.requires_password_change
  `).run(username, passwordHash, requiresChange ? 1 : 0)
}

export function listUsers() {
  return getDb().prepare('SELECT username, email, pending FROM users').all()
    .map(u => ({ username: u.username, email: u.email || '', pending: u.pending === 1, source: 'db' }))
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
  ).run(hashToken(token), username, now, now + ttlMs)
}

// Löst den Token ein (einmalig): gibt username zurück oder null.
export function takeResetToken(token) {
  const db = getDb()
  const key = hashToken(token)
  const row = db.prepare('SELECT * FROM password_resets WHERE token = ?').get(key)
  if (!row) return null
  db.prepare('DELETE FROM password_resets WHERE token = ?').run(key)
  if (row.expires_at < Date.now()) return null
  return row.username
}

// Offene Reset-Token eines Nutzers verwerfen (bei neuem Request / nach Erfolg).
export function clearResetTokens(username) {
  getDb().prepare('DELETE FROM password_resets WHERE username = ?').run(username)
}

// Admin-Einladung: neuer Nutzer muss das Passwort beim ersten Login ändern.
export function createUserWithHash(username, passwordHash, email = '') {
  getDb().prepare('INSERT INTO users (username, password, email, requires_password_change) VALUES (?, ?, ?, 1) ON CONFLICT(username) DO UPDATE SET password = excluded.password, email = excluded.email, requires_password_change = 1')
    .run(username, passwordHash, email)
}

// Reiner INSERT ohne ON CONFLICT-Klausel: der öffentliche Self-Register-Endpoint
// darf niemals bestehende Zugangsdaten überschreiben (kein UPSERT-Pfad).
// SQLite wirft bei Username-Konflikt — der Aufrufer fängt das als 409 ab.
// username wird klein geschrieben gespeichert: findUserByEmail() vergleicht per
// COLLATE NOCASE, aber username selbst hat keine case-insensitive UNIQUE-Regel —
// ohne Normalisierung könnten "Foo@Bar.com" und "foo@bar.com" zwei Accounts anlegen.
export function createSelfRegisteredUserWithHash(username, passwordHash, email) {
  getDb().prepare('INSERT INTO users (username, password, email, requires_password_change, pending) VALUES (?, ?, ?, 1, 1)')
    .run(username.toLowerCase(), passwordHash, email)
}

// Erster Nutzer eines frisch angelegten SaaS-Mandanten (E-Mail-Bestätigungs-
// Flow, siehe routes/register.js): Passwort wurde beim Registrieren selbst
// gewählt (kein erzwungener Wechsel) und braucht keine Freischaltung.
export function createConfirmedUser(username, passwordHash, email) {
  getDb().prepare(
    'INSERT INTO users (username, password, email, requires_password_change) VALUES (?, ?, ?, 0)'
  ).run(username, passwordHash, email)
}

export function deleteUser(username) {
  getDb().prepare('DELETE FROM users WHERE username = ?').run(username)
}

// Schaltet einen selbst-registrierten Nutzer frei (jeder bestehende Nutzer darf das).
export function approveUser(username) {
  getDb().prepare('UPDATE users SET pending = 0 WHERE username = ?').run(username)
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

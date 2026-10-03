// LuxStage/server/registry.js
// Zentrale Registry-DB (data/registry.db) — mandantenübergreifend.
// Hält, was NICHT in eine Mandanten-DB gehört, weil es über Mandanten hinweg
// eindeutig sein muss oder existiert, bevor die Mandanten-DB angelegt wird:
//  - pending_registrations: Doppel-Opt-In vor Mandanten-Anlage
//  - tenants: Verzeichnis bestätigter Mandanten
import Database from 'better-sqlite3'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { config } from './config.js'
import { TRIAL_DAYS } from './team-status.js'

const hashToken = t => createHash('sha256').update(t).digest('hex')

let db = null

export function getRegistry() {
  if (db) return db
  db = new Database(path.join(config.dataPath, 'registry.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_registrations (
      token              TEXT PRIMARY KEY,
      tenant_id          TEXT NOT NULL,
      email              TEXT NOT NULL,
      password_hash      TEXT NOT NULL,
      created_at         INTEGER NOT NULL,
      expires_at         INTEGER NOT NULL,
      newsletter_consent INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_pending_tenant ON pending_registrations(tenant_id);

    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id          TEXT PRIMARY KEY,
      email              TEXT NOT NULL,
      created_at         INTEGER NOT NULL,
      suspended          INTEGER NOT NULL DEFAULT 0,
      newsletter_consent INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);

    CREATE TABLE IF NOT EXISTS feedback (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id   TEXT NOT NULL,
      username    TEXT NOT NULL,
      text        TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      imported_at INTEGER
    );
  `)
  // Migration: suspended-/newsletter_consent-Spalten für bestehende Registry-DBs.
  const cols = db.pragma('table_info(tenants)').map(c => c.name)
  if (!cols.includes('suspended')) {
    db.exec('ALTER TABLE tenants ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0')
  }
  if (!cols.includes('newsletter_consent')) {
    db.exec('ALTER TABLE tenants ADD COLUMN newsletter_consent INTEGER NOT NULL DEFAULT 0')
  }
  // Testzeitraum/Bezahlung je Team. Bestehende Teams bleiben ohne Eintrag (kein Ablauf).
  if (!cols.includes('trial_ends_at')) db.exec('ALTER TABLE tenants ADD COLUMN trial_ends_at INTEGER')
  if (!cols.includes('paid_until')) db.exec('ALTER TABLE tenants ADD COLUMN paid_until INTEGER')
  // Inhaber (Nutzername im Team). NULL = aus Registrierungs-E-Mail ableiten, siehe team-owner.js.
  if (!cols.includes('owner_username')) db.exec('ALTER TABLE tenants ADD COLUMN owner_username TEXT')
  const pendingCols = db.pragma('table_info(pending_registrations)').map(c => c.name)
  if (!pendingCols.includes('newsletter_consent')) {
    db.exec('ALTER TABLE pending_registrations ADD COLUMN newsletter_consent INTEGER NOT NULL DEFAULT 0')
  }
  return db
}

const now = () => Date.now()

// ── Mandanten-Verzeichnis ────────────────────────────────────────────────────
export function tenantIdTaken(tenantId) {
  return !!getRegistry().prepare('SELECT 1 FROM tenants WHERE tenant_id = ?').get(tenantId)
}

export function emailTaken(email) {
  return !!getRegistry().prepare('SELECT 1 FROM tenants WHERE email = ?').get(email.toLowerCase())
}

// Alle bestätigten Mandanten — für mandantenübergreifende Jobs (z. B. History).
export function listTenantIds() {
  return getRegistry().prepare('SELECT tenant_id FROM tenants').all().map(r => r.tenant_id)
}

// ── Betreiber-Panel: Mandanten-Verwaltung ────────────────────────────────────
export function listTenants() {
  return getRegistry().prepare(
    'SELECT tenant_id, email, created_at, suspended, trial_ends_at, paid_until, owner_username FROM tenants ORDER BY created_at DESC'
  ).all()
}

export function getTenant(tenantId) {
  return getRegistry().prepare(
    'SELECT tenant_id, email, created_at, suspended, trial_ends_at, paid_until, owner_username FROM tenants WHERE tenant_id = ?'
  ).get(tenantId) || null
}

export function isSuspended(tenantId) {
  const row = getRegistry().prepare('SELECT suspended FROM tenants WHERE tenant_id = ?').get(tenantId)
  return row?.suspended === 1
}

export function setOwnerUsername(tenantId, username) {
  return getRegistry().prepare('UPDATE tenants SET owner_username = ? WHERE tenant_id = ?')
    .run(username, tenantId).changes
}

export function setPaidUntil(tenantId, paidUntilMs) {
  return getRegistry().prepare('UPDATE tenants SET paid_until = ? WHERE tenant_id = ?')
    .run(paidUntilMs, tenantId).changes
}

export function setSuspended(tenantId, suspended) {
  return getRegistry().prepare('UPDATE tenants SET suspended = ? WHERE tenant_id = ?')
    .run(suspended ? 1 : 0, tenantId).changes
}

// Mandant aus dem Verzeichnis entfernen (die DB-Dateien löscht deleteTenant separat).
export function removeTenant(tenantId) {
  return getRegistry().prepare('DELETE FROM tenants WHERE tenant_id = ?').run(tenantId).changes
}

// Offene (unbestätigte) Registrierungen — ohne Passwort-Hash.
export function listPending() {
  return getRegistry().prepare(
    'SELECT tenant_id, email, created_at, expires_at FROM pending_registrations ORDER BY created_at DESC'
  ).all()
}

// ── Feedback aus der WebApp ──────────────────────────────────────────────────
export function addFeedback({ tenantId, username, text }) {
  return Number(getRegistry().prepare(
    'INSERT INTO feedback (tenant_id, username, text, created_at) VALUES (?, ?, ?, ?)'
  ).run(tenantId, username, text, now()).lastInsertRowid)
}

// onlyNew: nur noch nicht ins Cockpit übernommene Einträge.
export function listFeedback({ onlyNew = false } = {}) {
  return getRegistry().prepare(
    `SELECT id, tenant_id, username, text, created_at, imported_at FROM feedback
     ${onlyNew ? 'WHERE imported_at IS NULL' : ''} ORDER BY id`
  ).all()
}

export function markFeedbackImported(id) {
  return getRegistry().prepare(
    'UPDATE feedback SET imported_at = ? WHERE id = ? AND imported_at IS NULL'
  ).run(now(), id).changes
}

// ── Pending Registrations (Doppel-Opt-In) ────────────────────────────────────
// token wird per SHA-256 gehasht gespeichert/nachgeschlagen — analog zu
// Passwort-Reset-Token in db/users.js — statt im Klartext, obwohl die
// Wirkung eines geleakten Tokens hier begrenzt ist (erstellt nur einen
// Tenant + Erstnutzer für eine vom Angreifer bereits kontrollierte
// Email/Passwort-Kombination).
export function addPending({ token, tenantId, email, passwordHash, ttlMs, newsletterConsent = false }) {
  const ts = now()
  getRegistry().prepare(`
    INSERT INTO pending_registrations (token, tenant_id, email, password_hash, created_at, expires_at, newsletter_consent)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(hashToken(token), tenantId, email.toLowerCase(), passwordHash, ts, ts + ttlMs, newsletterConsent ? 1 : 0)
}

// Ob für diese Subdomain/E-Mail bereits eine unbestätigte Anmeldung offen ist.
export function hasPendingForTenant(tenantId) {
  return !!getRegistry().prepare(
    'SELECT 1 FROM pending_registrations WHERE tenant_id = ? AND expires_at > ?'
  ).get(tenantId, now())
}

export function getPending(token) {
  const row = getRegistry().prepare('SELECT * FROM pending_registrations WHERE token = ?').get(hashToken(token))
  if (!row || row.expires_at < now()) return null
  return row
}

// Aktiviert einen vorbereiteten Mandanten und verbraucht den Bestätigungslink
// gemeinsam. Die Tenant-DB muss vorher vollständig angelegt worden sein.
export function confirmPending(token, tenantId, email) {
  const reg = getRegistry()
  const hashedToken = hashToken(token)
  return reg.transaction(() => {
    const row = reg.prepare('SELECT * FROM pending_registrations WHERE token = ?').get(hashedToken)
    if (!row || row.expires_at < now() || row.tenant_id !== tenantId || row.email !== email.toLowerCase()) {
      return false
    }
    reg.prepare(
      'INSERT INTO tenants (tenant_id, email, created_at, newsletter_consent, trial_ends_at) VALUES (?, ?, ?, ?, ?)'
    ).run(tenantId, email.toLowerCase(), now(), row.newsletter_consent, config.billingEnabled ? now() + TRIAL_DAYS * 24 * 60 * 60 * 1000 : null)
    reg.prepare('DELETE FROM pending_registrations WHERE token = ?').run(hashedToken)
    return true
  })()
}

// ── Betreiber-Panel: Pending-Verwaltung ──────────────────────────────────────
export function getPendingByTenant(tenantId) {
  return getRegistry().prepare(
    'SELECT * FROM pending_registrations WHERE tenant_id = ?'
  ).get(tenantId) || null
}

// Ablaufzeit beim erneuten Versand auffrischen, damit der Link nicht sofort abläuft.
export function refreshPendingExpiry(tenantId, ttlMs) {
  return getRegistry().prepare(
    'UPDATE pending_registrations SET expires_at = ? WHERE tenant_id = ?'
  ).run(now() + ttlMs, tenantId).changes
}

// Erzeugt beim erneuten Versand einen frischen Klartext-Token statt des alten
// (der token ist gehasht gespeichert — eine Einwegfunktion, der ursprüngliche
// Klartext ist nirgends mehr verfügbar, um ihn in eine neue Bestätigungsmail
// einzubetten). Gibt den neuen Klartext-Token zurück oder null, falls kein
// offener Pending-Eintrag existiert.
export function refreshPendingToken(tenantId, ttlMs) {
  const newToken = randomBytes(32).toString('hex')
  const changes = getRegistry().prepare(
    'UPDATE pending_registrations SET token = ?, expires_at = ? WHERE tenant_id = ?'
  ).run(hashToken(newToken), now() + ttlMs, tenantId).changes
  return changes > 0 ? newToken : null
}

export function removePendingByTenant(tenantId) {
  return getRegistry().prepare('DELETE FROM pending_registrations WHERE tenant_id = ?').run(tenantId).changes
}

// Abgelaufene Pending-Einträge aufräumen (periodisch aufrufen).
export function purgeExpiredPending() {
  return getRegistry().prepare('DELETE FROM pending_registrations WHERE expires_at < ?').run(now()).changes
}

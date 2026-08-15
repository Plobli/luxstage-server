// LuxStage/server/registry.js
// Zentrale Registry-DB (data/registry.db) — mandantenübergreifend.
// Hält, was NICHT in eine Mandanten-DB gehört, weil es über Mandanten hinweg
// eindeutig sein muss oder existiert, bevor die Mandanten-DB angelegt wird:
//  - pending_registrations: Doppel-Opt-In vor Mandanten-Anlage
//  - tenants: Verzeichnis bestätigter Mandanten
import Database from 'better-sqlite3'
import path from 'node:path'
import { config } from './config.js'

let db = null

export function getRegistry() {
  if (db) return db
  db = new Database(path.join(config.dataPath, 'registry.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_registrations (
      token         TEXT PRIMARY KEY,
      tenant_id     TEXT NOT NULL,
      email         TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      expires_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pending_tenant ON pending_registrations(tenant_id);

    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id   TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      suspended   INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
  `)
  // Migration: suspended-Spalte für bestehende Registry-DBs.
  const cols = db.pragma('table_info(tenants)').map(c => c.name)
  if (!cols.includes('suspended')) {
    db.exec('ALTER TABLE tenants ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0')
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
    'SELECT tenant_id, email, created_at, suspended FROM tenants ORDER BY created_at DESC'
  ).all()
}

export function getTenant(tenantId) {
  return getRegistry().prepare(
    'SELECT tenant_id, email, created_at, suspended FROM tenants WHERE tenant_id = ?'
  ).get(tenantId) || null
}

export function isSuspended(tenantId) {
  const row = getRegistry().prepare('SELECT suspended FROM tenants WHERE tenant_id = ?').get(tenantId)
  return row?.suspended === 1
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

// ── Pending Registrations (Doppel-Opt-In) ────────────────────────────────────
export function addPending({ token, tenantId, email, passwordHash, ttlMs }) {
  const ts = now()
  getRegistry().prepare(`
    INSERT INTO pending_registrations (token, tenant_id, email, password_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, tenantId, email.toLowerCase(), passwordHash, ts, ts + ttlMs)
}

// Ob für diese Subdomain/E-Mail bereits eine unbestätigte Anmeldung offen ist.
export function hasPendingForTenant(tenantId) {
  return !!getRegistry().prepare(
    'SELECT 1 FROM pending_registrations WHERE tenant_id = ? AND expires_at > ?'
  ).get(tenantId, now())
}

export function getPending(token) {
  const row = getRegistry().prepare('SELECT * FROM pending_registrations WHERE token = ?').get(token)
  if (!row || row.expires_at < now()) return null
  return row
}

// Aktiviert einen vorbereiteten Mandanten und verbraucht den Bestätigungslink
// gemeinsam. Die Tenant-DB muss vorher vollständig angelegt worden sein.
export function confirmPending(token, tenantId, email) {
  const reg = getRegistry()
  return reg.transaction(() => {
    const row = reg.prepare('SELECT * FROM pending_registrations WHERE token = ?').get(token)
    if (!row || row.expires_at < now() || row.tenant_id !== tenantId || row.email !== email.toLowerCase()) {
      return false
    }
    reg.prepare(
      'INSERT INTO tenants (tenant_id, email, created_at) VALUES (?, ?, ?)'
    ).run(tenantId, email.toLowerCase(), now())
    reg.prepare('DELETE FROM pending_registrations WHERE token = ?').run(token)
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

export function removePendingByTenant(tenantId) {
  return getRegistry().prepare('DELETE FROM pending_registrations WHERE tenant_id = ?').run(tenantId).changes
}

// Abgelaufene Pending-Einträge aufräumen (periodisch aufrufen).
export function purgeExpiredPending() {
  return getRegistry().prepare('DELETE FROM pending_registrations WHERE expires_at < ?').run(now()).changes
}

// LuxStage/server/tenant-health.js
// Integritätsüberwachung einzelner Mandanteninstanzen für das Betreiber-Panel.
import fs from 'node:fs'
import { openTenantDb, tenantDbPath, tenantExists } from './tenants.js'
import { listSnapshots } from './tenant-backup.js'

// Leichtgewichtige Health-Metadaten eines Mandanten — für das Listing aller
// Mandanten geeignet (kein Konsistenz-Check, siehe checkTenantConsistency()).
export function tenantHealth(tenantId) {
  if (!tenantExists(tenantId)) return { reachable: false, error: 'Mandant existiert nicht' }

  let db
  try {
    db = openTenantDb(tenantId)
  } catch (err) {
    return { reachable: false, error: err.message }
  }

  const migrations = db.prepare(
    'SELECT count(*) AS n, max(id) AS lastId FROM schema_migrations'
  ).get()

  const activity = db.prepare(`
    SELECT o.created_at AS createdAt, o.performed_by AS performedBy
    FROM operations o JOIN shows s ON s.id = o.show_id
    ORDER BY o.created_at DESC LIMIT 1
  `).get()

  const dbSizeBytes = fs.statSync(tenantDbPath(tenantId)).size

  const [lastSnapshot] = listSnapshots(tenantId)
  const lastSnapshotAt = lastSnapshot?.createdAt ?? null
  const lastSnapshotAgeMs = lastSnapshotAt !== null ? Date.now() - lastSnapshotAt : null

  return {
    reachable: true,
    schemaMigrations: migrations.n,
    lastMigrationId: migrations.lastId,
    lastActivityAt: activity?.createdAt ?? null,
    lastActivityBy: activity?.performedBy ?? null,
    dbSizeBytes,
    lastSnapshotAt,
    lastSnapshotAgeMs,
  }
}

// Konsistenz-Check on-demand (nicht Teil von tenantHealth(), da bei großen
// DBs spürbar langsamer). Läuft auf der aktiven Verbindung — quick_check und
// foreign_key_check sind read-only und blockieren parallele Schreiber im
// WAL-Modus nicht spürbar.
export function checkTenantConsistency(tenantId) {
  if (!tenantExists(tenantId)) throw new Error(`Mandant existiert nicht: ${tenantId}`)
  const db = openTenantDb(tenantId)

  const issues = []
  const quickCheck = db.pragma('quick_check')
  for (const row of quickCheck) {
    const value = typeof row === 'string' ? row : row.quick_check
    if (value !== 'ok') issues.push(value)
  }

  const fkIssues = db.pragma('foreign_key_check')
  for (const row of fkIssues) {
    issues.push(`Verwaister Datensatz: ${row.table} (rowid ${row.rowid})`)
  }

  return { ok: issues.length === 0, issues }
}

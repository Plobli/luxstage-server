import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { createTenant, openTenantDb, closeTenantDb } = await import('../tenants.js')
const { createSnapshot } = await import('../tenant-backup.js')
const { tenantHealth, checkTenantConsistency } = await import('../tenant-health.js')

const tenantId = 'health-team'

test('tenantHealth meldet nicht erreichbar für unbekannten Mandanten', () => {
  const h = tenantHealth('does-not-exist')
  assert.equal(h.reachable, false)
})

test('tenantHealth liefert Schema-Migrationen, DB-Größe und Snapshot-Alter für einen frischen Mandanten', async () => {
  createTenant(tenantId)
  const h = tenantHealth(tenantId)
  assert.equal(h.reachable, true)
  assert.ok(h.schemaMigrations > 0)
  assert.ok(h.lastMigrationId)
  assert.equal(h.lastActivityAt, null)
  assert.ok(h.dbSizeBytes > 0)
  assert.equal(h.lastSnapshotAt, null)
  assert.equal(h.lastSnapshotAgeMs, null)

  await createSnapshot(tenantId)
  const h2 = tenantHealth(tenantId)
  assert.ok(h2.lastSnapshotAt)
  // Toleranz für Dateisystem-mtime-Rundung (kann minimal nach "jetzt" liegen).
  assert.ok(h2.lastSnapshotAgeMs >= -1000)
})

test('tenantHealth liefert die global letzte Operation über mehrere Shows hinweg', () => {
  const db = openTenantDb(tenantId)
  db.prepare("INSERT INTO shows (id, slug, name, created_at, updated_at) VALUES ('show-a', 'show-a', 'A', 1, 1)").run()
  db.prepare("INSERT INTO shows (id, slug, name, created_at, updated_at) VALUES ('show-b', 'show-b', 'B', 1, 1)").run()
  db.prepare(`
    INSERT INTO operations (id, show_id, created_at, performed_by, snapshot, hash)
    VALUES ('op-old', 'show-a', 1000, 'alice@example.com', '{}', 'h1')
  `).run()
  db.prepare(`
    INSERT INTO operations (id, show_id, created_at, performed_by, snapshot, hash)
    VALUES ('op-new', 'show-b', 2000, 'bob@example.com', '{}', 'h2')
  `).run()

  const h = tenantHealth(tenantId)
  assert.equal(h.lastActivityAt, 2000)
  assert.equal(h.lastActivityBy, 'bob@example.com')
})

test('checkTenantConsistency meldet ok für eine gesunde DB', () => {
  const result = checkTenantConsistency(tenantId)
  assert.equal(result.ok, true)
  assert.deepEqual(result.issues, [])
})

after(() => {
  closeTenantDb(tenantId)
  cleanupDataPath()
})

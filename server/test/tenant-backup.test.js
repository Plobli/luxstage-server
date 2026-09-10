import assert from 'node:assert/strict'
import fs from 'node:fs'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { closeTenantDb, createTenant, openTenantDb, tenantDbPath } = await import('../tenants.js')
const { createSnapshot, listSnapshots, restoreSnapshot, verifySnapshot } = await import('../tenant-backup.js')

const tenantId = 'restore-team'

function setMarker(value) {
  openTenantDb(tenantId)
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('marker', ?)")
    .run(value)
}

function marker() {
  return openTenantDb(tenantId)
    .prepare("SELECT value FROM settings WHERE key = 'marker'")
    .get().value
}

test('Tenant-Restore aktiviert Snapshot und sichert den Ist-Zustand', async () => {
  createTenant(tenantId)
  setMarker('snapshot')
  const snapshot = await createSnapshot(tenantId)
  setMarker('current')
  const countBeforeRestore = listSnapshots(tenantId).length

  await restoreSnapshot(tenantId, snapshot)

  assert.equal(marker(), 'snapshot')
  assert.equal(listSnapshots(tenantId).length, countBeforeRestore + 1)
})

test('Tenant-Restore stellt bei fehlendem Aktivierungs-Rename den Ist-Zustand wieder her', async () => {
  setMarker('snapshot-for-failure')
  const snapshot = await createSnapshot(tenantId)
  setMarker('current-after-failure')
  const dbPath = tenantDbPath(tenantId)
  const renameSync = fs.renameSync

  fs.renameSync = (source, target) => {
    if (source.includes('.restore-') && target === dbPath) throw new Error('simulated rename failure')
    return renameSync(source, target)
  }
  try {
    await assert.rejects(restoreSnapshot(tenantId, snapshot), /Snapshot konnte nicht aktiviert werden/)
  } finally {
    fs.renameSync = renameSync
  }

  assert.equal(marker(), 'current-after-failure')
})

test('verifySnapshot meldet ok für einen intakten Snapshot', async () => {
  setMarker('verify-ok')
  const snapshot = await createSnapshot(tenantId)
  const result = verifySnapshot(tenantId, snapshot)
  assert.equal(result.ok, true)
})

test('verifySnapshot lehnt Pfad-Traversal im Namen ab', () => {
  const result = verifySnapshot(tenantId, '../../etc/passwd.db')
  assert.equal(result.ok, false)
  assert.equal(result.error, 'Ungültiger Snapshot-Name')
})

test('verifySnapshot meldet fehlenden Snapshot', () => {
  const result = verifySnapshot(tenantId, 'does-not-exist.db')
  assert.equal(result.ok, false)
  assert.equal(result.error, 'Snapshot nicht gefunden')
})

after(() => {
  closeTenantDb(tenantId)
  cleanupDataPath()
})
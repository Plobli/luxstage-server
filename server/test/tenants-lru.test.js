import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { createTenant, openTenantDb, MAX_OPEN_TENANT_DBS, openConnectionCount } = await import('../tenants.js')

const ids = Array.from({ length: MAX_OPEN_TENANT_DBS + 5 }, (_, i) => `lru-test-${i}`)

test('offene Mandanten-Verbindungen überschreiten die Obergrenze nicht', () => {
  for (const id of ids) createTenant(id)
  assert.ok(
    openConnectionCount() <= MAX_OPEN_TENANT_DBS,
    `offen: ${openConnectionCount()}, erlaubt: ${MAX_OPEN_TENANT_DBS}`
  )
})

test('ein verdrängter Mandant lässt sich wieder öffnen', () => {
  // ids[0] wurde als ältester längst verdrängt.
  const db = openTenantDb(ids[0])
  assert.ok(db.open)
  assert.ok(openConnectionCount() <= MAX_OPEN_TENANT_DBS)
})

test('ein erneuter Zugriff schützt vor sofortiger Verdrängung', () => {
  const survivor = ids[ids.length - 1]
  openTenantDb(survivor)
  // Genug neue Mandanten, um alles ausser dem zuletzt Genutzten zu verdrängen.
  for (let i = 0; i < MAX_OPEN_TENANT_DBS - 1; i++) createTenant(`lru-fresh-${i}`)
  assert.ok(openTenantDb(survivor).open)
})

after(cleanupDataPath)

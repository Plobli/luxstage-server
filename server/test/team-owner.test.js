import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

const { createTenant, closeTenantDb } = await import('../tenants.js')
const { getRegistry } = await import('../registry.js')
const { runWithDb } = await import('../db-context.js')
const { createConfirmedUser } = await import('../db/users.js')
const { resolveOwner, isOwner, transferOwnership } = await import('../team-owner.js')

const tenantId = 'owner-team'

function registerTenant(email) {
  getRegistry().prepare('INSERT INTO tenants (tenant_id, email, created_at) VALUES (?, ?, 0)').run(tenantId, email)
}

test('Bestand: Inhaber ist der Nutzer mit der Registrierungs-E-Mail und wird gespeichert', async () => {
  const tdb = createTenant(tenantId)
  registerTenant('chef@example.com')
  await runWithDb(tdb, async () => {
    await createConfirmedUser('kollege', 'hash', 'kollege@example.com')
    await createConfirmedUser('chef', 'hash', 'chef@example.com')
    assert.equal(resolveOwner(), 'chef')
    assert.equal(isOwner('chef'), true)
    assert.equal(isOwner('kollege'), false)
  }, tenantId)
  assert.equal(getRegistry().prepare('SELECT owner_username FROM tenants WHERE tenant_id = ?').get(tenantId).owner_username, 'chef')
})

test('Übertragung an bestehenden Nutzer klappt, unbekannter Nutzer wird abgelehnt', async () => {
  const tdb = createTenant('owner-team-2')
  getRegistry().prepare('INSERT INTO tenants (tenant_id, email, created_at) VALUES (?, ?, 0)').run('owner-team-2', 'a@example.com')
  await runWithDb(tdb, async () => {
    await createConfirmedUser('a', 'hash', 'a@example.com')
    await createConfirmedUser('b', 'hash', 'b@example.com')
    assert.equal(resolveOwner(), 'a')
    assert.equal(transferOwnership('niemand'), false)
    assert.equal(transferOwnership('b'), true)
    assert.equal(resolveOwner(), 'b')
  }, 'owner-team-2')
})

test('Ohne passenden Nutzer gibt es keinen Inhaber', async () => {
  const tdb = createTenant('owner-team-3')
  getRegistry().prepare('INSERT INTO tenants (tenant_id, email, created_at) VALUES (?, ?, 0)').run('owner-team-3', 'weg@example.com')
  await runWithDb(tdb, async () => {
    await createConfirmedUser('x', 'hash', 'x@example.com')
    assert.equal(resolveOwner(), null)
  }, 'owner-team-3')
})

after(async () => {
  for (const id of [tenantId, 'owner-team-2', 'owner-team-3']) closeTenantDb(id)
  await cleanupDataPath()
})

import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { addPending, getPending, getRegistry } = await import('../registry.js')
const { registerRoutes } = await import('../routes/register.js')
const { closeTenantDb, tenantExists } = await import('../tenants.js')

function confirmRequest(token) {
  return { method: 'GET', url: `/api/register/confirm?token=${token}` }
}

test('bestätigte Registrierung erzeugt Tenant und verbraucht den Link', async () => {
  const token = 'a'.repeat(64)
  addPending({
    token,
    tenantId: 'licht-team',
    email: 'admin@example.com',
    passwordHash: '$2b$12$test-password-hash',
    ttlMs: 60_000,
  })

  const response = createResponse()
  await registerRoutes(confirmRequest(token), response, '/api/register/confirm')

  assert.equal(response.status, 200)
  assert.equal(response.body.tenantId, 'licht-team')
  assert.equal(tenantExists('licht-team'), true)
  assert.equal(getPending(token), null)
  assert.ok(getRegistry().prepare('SELECT 1 FROM tenants WHERE tenant_id = ?').get('licht-team'))
})

test('fehlgeschlagener Registry-Commit entfernt vorbereiteten Tenant und behält Link', async () => {
  const token = 'b'.repeat(64)
  addPending({
    token,
    tenantId: 'zweites-team',
    email: 'admin@example.com',
    passwordHash: '$2b$12$test-password-hash',
    ttlMs: 60_000,
  })

  const response = createResponse()
  await registerRoutes(confirmRequest(token), response, '/api/register/confirm')

  assert.equal(response.status, 409)
  assert.equal(tenantExists('zweites-team'), false)
  assert.ok(getPending(token))
})

after(() => {
  closeTenantDb('licht-team')
  closeTenantDb('zweites-team')
  getRegistry().close()
  cleanupDataPath()
})
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { addPending, getPending, getRegistry } = await import('../registry.js')
const { registerRoutes } = await import('../routes/register.js')
const { closeTenantDb, tenantExists } = await import('../tenants.js')

import { Readable } from 'node:stream'

function confirmRequest(token) {
  return { method: 'GET', url: `/api/register/confirm?token=${token}` }
}

function postRequest(body, ip) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = 'POST'
  req.headers = { 'content-type': 'application/json' }
  req.socket = { remoteAddress: ip }
  return req
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

test('11. Registrierungsversuch derselben IP wird mit 429 geblockt', async () => {
  const ip = '30.0.0.1'
  for (let i = 0; i < 10; i++) {
    const res = createResponse()
    await registerRoutes(postRequest({ teamId: `team-${i}`, email: `t${i}@example.com`, password: 'sicheres-passwort-123' }, ip), res, '/api/register')
    assert.notEqual(res.status, 429)
  }
  const blocked = createResponse()
  await registerRoutes(postRequest({ teamId: 'team-blocked', email: 'blocked@example.com', password: 'sicheres-passwort-123' }, ip), blocked, '/api/register')
  assert.equal(blocked.status, 429)
})

after(() => {
  closeTenantDb('licht-team')
  closeTenantDb('zweites-team')
  getRegistry().close()
  cleanupDataPath()
})
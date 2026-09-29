import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { createTenant, tenantExists, closeTenantDb } = await import('../tenants.js')
const { runWithDb } = await import('../db-context.js')
const { createConfirmedUser } = await import('../db/users.js')
const { hashPassword } = await import('../auth.js')
const { tenantDeleteRoutes } = await import('../routes/tenant-delete.js')

const tenantId = 'delete-request-team'

function authedReq(body, username) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = 'POST'
  req.headers = { 'content-type': 'application/json' }
  req.socket = { remoteAddress: '127.0.0.1' }
  req.user = { username, tenantId }
  return req
}

test('delete-request mit falschem Passwort liefert 401, kein Löschvorgang', async () => {
  const tdb = createTenant(tenantId)
  await runWithDb(tdb, async () => {
    await createConfirmedUser('owner@example.com', await hashPassword('richtiges-passwort'), 'owner@example.com')
    const res = createResponse()
    await tenantDeleteRoutes(authedReq({ password: 'falsches-passwort' }, 'owner@example.com'), res, '/api/tenant/delete-request')
    assert.equal(res.status, 401)
  }, tenantId)
  assert.equal(tenantExists(tenantId), true, 'Mandant darf durch die Anfrage nicht gelöscht werden')
  closeTenantDb(tenantId)
})

test('delete-request mit korrektem Passwort liefert 202 (Anfrage), Mandant bleibt bestehen', async () => {
  const id = 'delete-request-team-2'
  const tdb = createTenant(id)
  await runWithDb(tdb, async () => {
    await createConfirmedUser('owner2@example.com', await hashPassword('richtiges-passwort'), 'owner2@example.com')
    const res = createResponse()
    await tenantDeleteRoutes(authedReq({ password: 'richtiges-passwort' }, 'owner2@example.com'), res, '/api/tenant/delete-request')
    assert.equal(res.status, 202)
  }, id)
  assert.equal(tenantExists(id), true, 'delete-request darf niemals selbst löschen — nur der Betreiber löscht manuell')
  closeTenantDb(id)
})

after(cleanupDataPath)

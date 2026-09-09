import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { addPending, getPending, getRegistry, refreshPendingToken } = await import('../registry.js')
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

test('Bestätigungs-Token wird gehasht in der Registry-DB gespeichert, nicht im Klartext', () => {
  const token = 'c'.repeat(64)
  addPending({
    token,
    tenantId: 'hash-check-team',
    email: 'hash@example.com',
    passwordHash: '$2b$12$test-password-hash',
    ttlMs: 60_000,
  })

  const stored = getRegistry().prepare('SELECT token FROM pending_registrations WHERE tenant_id = ?').get('hash-check-team')
  assert.notEqual(stored.token, token, 'Klartext-Token darf nicht in der DB stehen')
  assert.equal(stored.token.length, 64, 'SHA-256-Hex-Digest erwartet')

  assert.ok(getPending(token), 'getPending muss den Klartext-Token gegen den gehashten Wert auflösen')
})

test('refreshPendingToken erzeugt einen neuen Klartext-Token, alter Token verliert Gültigkeit', () => {
  const oldToken = 'd'.repeat(64)
  addPending({
    token: oldToken,
    tenantId: 'resend-team',
    email: 'resend@example.com',
    passwordHash: '$2b$12$test-password-hash',
    ttlMs: 60_000,
  })

  const newToken = refreshPendingToken('resend-team', 60_000)
  assert.ok(newToken)
  assert.notEqual(newToken, oldToken)

  assert.equal(getPending(oldToken), null, 'alter Token darf nach Refresh nicht mehr gelten')
  const refreshed = getPending(newToken)
  assert.ok(refreshed, 'neuer Token muss gültig sein')
  assert.equal(refreshed.tenant_id, 'resend-team')
})

test('Newsletter-Consent aus dem pending-Eintrag wird beim Bestätigen in tenants übernommen', async () => {
  const token = 'e'.repeat(64)
  addPending({
    token,
    tenantId: 'newsletter-team',
    email: 'newsletter@example.com',
    passwordHash: '$2b$12$test-password-hash',
    ttlMs: 60_000,
    newsletterConsent: true,
  })

  const response = createResponse()
  await registerRoutes(confirmRequest(token), response, '/api/register/confirm')

  assert.equal(response.status, 200)
  const row = getRegistry().prepare('SELECT newsletter_consent FROM tenants WHERE tenant_id = ?').get('newsletter-team')
  assert.equal(row.newsletter_consent, 1)
  closeTenantDb('newsletter-team')
})

test('POST /api/register ohne newsletterConsent speichert 0 (Opt-in per Default aus)', async () => {
  const res = createResponse()
  await registerRoutes(postRequest({ teamId: 'kein-consent-team', email: 'kein-consent@example.com', password: 'sicheres-passwort-123' }, '30.0.0.2'), res, '/api/register')
  assert.equal(res.status, 202)

  const row = getRegistry().prepare('SELECT newsletter_consent FROM pending_registrations WHERE tenant_id = ?').get('kein-consent-team')
  assert.equal(row.newsletter_consent, 0)
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
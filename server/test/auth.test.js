import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { createUser, createSelfRegisteredUser } = await import('../db/users.js')
const { authRoutes } = await import('../routes/auth.js')

function jsonRequest(method, body, { ip = '127.0.0.1' } = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = method
  req.headers = { 'content-type': 'application/json' }
  req.socket = { remoteAddress: ip }
  return req
}

test('Login mit korrektem Passwort liefert ein Token', async () => {
  await createUser('anna', 'korrektes-passwort')
  const res = createResponse()
  await authRoutes(jsonRequest('POST', { username: 'anna', password: 'korrektes-passwort' }, { ip: '10.0.0.1' }), res, '/api/auth/login')
  assert.equal(res.status, 200)
  assert.ok(res.body.token)
})

test('Login mit falschem Passwort liefert 401 mit generischer Meldung', async () => {
  await createUser('bob', 'richtiges-passwort')
  const res = createResponse()
  await authRoutes(jsonRequest('POST', { username: 'bob', password: 'falsch' }, { ip: '10.0.0.2' }), res, '/api/auth/login')
  assert.equal(res.status, 401)
  assert.equal(res.body.error, 'Ungültige Anmeldedaten')
})

test('Login mit unbekanntem Nutzernamen liefert dieselbe 401-Meldung (kein Enumeration-Leak)', async () => {
  const res = createResponse()
  await authRoutes(jsonRequest('POST', { username: 'gibt-es-nicht', password: 'egal' }, { ip: '10.0.0.3' }), res, '/api/auth/login')
  assert.equal(res.status, 401)
  assert.equal(res.body.error, 'Ungültige Anmeldedaten')
})

test('Login eines pending-Kontos liefert 403 mit "pending"-Marker', async () => {
  await createSelfRegisteredUser('pendinguser', 'irgendeinpasswort', 'pending@example.com')
  const res = createResponse()
  await authRoutes(jsonRequest('POST', { username: 'pendinguser', password: 'irgendeinpasswort' }, { ip: '10.0.0.4' }), res, '/api/auth/login')
  assert.equal(res.status, 403)
  assert.equal(res.body.error, 'pending')
})

test('11. Login-Fehlversuch derselben IP innerhalb 15 Minuten wird mit 429 geblockt', async () => {
  const ip = '10.0.0.5'
  for (let i = 0; i < 10; i++) {
    await authRoutes(jsonRequest('POST', { username: 'niemand', password: 'falsch' }, { ip }), createResponse(), '/api/auth/login')
  }
  const res = createResponse()
  await authRoutes(jsonRequest('POST', { username: 'niemand', password: 'falsch' }, { ip }), res, '/api/auth/login')
  assert.equal(res.status, 429)
})

test('Rate-Limit ist pro IP getrennt — andere IP bleibt unbeeinflusst', async () => {
  const blockedIp = '10.0.0.6'
  for (let i = 0; i < 10; i++) {
    await authRoutes(jsonRequest('POST', { username: 'niemand', password: 'falsch' }, { ip: blockedIp }), createResponse(), '/api/auth/login')
  }
  const blockedRes = createResponse()
  await authRoutes(jsonRequest('POST', { username: 'niemand', password: 'falsch' }, { ip: blockedIp }), blockedRes, '/api/auth/login')
  assert.equal(blockedRes.status, 429)

  await createUser('carla', 'ihrpasswort')
  const freshRes = createResponse()
  await authRoutes(jsonRequest('POST', { username: 'carla', password: 'ihrpasswort' }, { ip: '10.0.0.7' }), freshRes, '/api/auth/login')
  assert.equal(freshRes.status, 200)
})

test('forgot-password antwortet immer mit 200, unabhängig davon ob die E-Mail existiert', async () => {
  const knownRes = createResponse()
  await authRoutes(jsonRequest('POST', { email: 'unbekannt@example.com' }, { ip: '10.0.0.8' }), knownRes, '/api/auth/forgot-password')
  assert.equal(knownRes.status, 200)
  assert.equal(knownRes.body.ok, true)
})

test('reset-password/confirm mit ungültigem Token liefert 400', async () => {
  const res = createResponse()
  await authRoutes(jsonRequest('POST', { token: 'ungueltiger-token', newPassword: 'neuespasswort123' }, { ip: '10.0.0.9' }), res, '/api/auth/reset-password/confirm')
  assert.equal(res.status, 400)
})

test('reset-password/confirm lehnt zu kurzes Passwort ab', async () => {
  const res = createResponse()
  await authRoutes(jsonRequest('POST', { token: 'irgendein-token', newPassword: '123' }, { ip: '10.0.0.10' }), res, '/api/auth/reset-password/confirm')
  assert.equal(res.status, 400)
})

after(cleanupDataPath)

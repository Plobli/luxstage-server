import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { userRoutes } = await import('../routes/users.js')
const { listUsers } = await import('../db/users.js')

function request(method, user, body) {
  const req = Readable.from([Buffer.from(body !== undefined ? JSON.stringify(body) : '')])
  req.method = method
  req.user = user
  req.headers = { 'content-type': 'application/json' }
  return req
}

const admin = { username: 'admin' }

test('POST /api/users legt einen neuen Nutzer mit gültiger E-Mail an', async () => {
  const res = createResponse()
  await userRoutes(request('POST', admin, { username: 'neu@example.com' }), res, '/api/users')
  assert.equal(res.status, 201)
  assert.ok(listUsers().some(u => u.username === 'neu@example.com'))
})

test('POST /api/users lehnt ungültige E-Mail ab', async () => {
  const res = createResponse()
  await userRoutes(request('POST', admin, { username: 'keine-email' }), res, '/api/users')
  assert.equal(res.status, 400)
})

test('POST /api/self-register legt einen pending-Nutzer an', async () => {
  const res = createResponse()
  await userRoutes(request('POST', undefined, { email: 'selfreg@example.com', password: 'sicheres-passwort-123' }), res, '/api/self-register')
  assert.equal(res.status, 202)
  const user = listUsers().find(u => u.username === 'selfreg@example.com')
  assert.ok(user)
  assert.equal(user.pending, true)
})

test('POST /api/self-register mit bereits registrierter E-Mail liefert 409, kein Überschreiben', async () => {
  const res = createResponse()
  await userRoutes(request('POST', undefined, { email: 'selfreg@example.com', password: 'ein-anderes-passwort' }), res, '/api/self-register')
  assert.equal(res.status, 409)
})

test('POST /api/self-register lehnt zu kurzes Passwort ab', async () => {
  const res = createResponse()
  await userRoutes(request('POST', undefined, { email: 'kurzespasswort@example.com', password: '123' }), res, '/api/self-register')
  assert.equal(res.status, 400)
})

test('POST /api/users/:id/approve schaltet einen pending-Nutzer frei', async () => {
  const res = createResponse()
  await userRoutes(request('POST', admin, undefined), res, '/api/users/selfreg@example.com/approve')
  assert.equal(res.status, 200)
  const user = listUsers().find(u => u.username === 'selfreg@example.com')
  assert.equal(user.pending, false)
})

test('DELETE /api/users/:id lehnt Selbstlöschung ab', async () => {
  const res = createResponse()
  await userRoutes(request('DELETE', admin, undefined), res, '/api/users/admin')
  assert.equal(res.status, 400)
})

test('DELETE /api/users/:id löscht einen anderen Nutzer', async () => {
  const res = createResponse()
  await userRoutes(request('DELETE', admin, undefined), res, '/api/users/selfreg@example.com')
  assert.equal(res.status, 200)
  assert.ok(!listUsers().some(u => u.username === 'selfreg@example.com'))
})

after(cleanupDataPath)

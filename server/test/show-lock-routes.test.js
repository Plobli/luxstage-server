import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { createShow } = await import('../db/shows.js')
const { showRoutes } = await import('../routes/shows.js')

function request(method, user, body) {
  const req = Readable.from([Buffer.from(body ? JSON.stringify(body) : '')])
  req.method = method
  req.user = user
  req.headers = { 'content-type': 'application/json' }
  return req
}

createShow('lock-test-show', { name: 'Lock-Testshow', importSections: false })

test('Lock erwerben liefert 200 mit ok:true', async () => {
  const res = createResponse()
  await showRoutes(request('POST', { username: 'anna' }), res, '/api/shows/lock-test-show/lock')
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)
})

test('Zweiter Nutzer erhält 423 mit lockedBy/since — exakt das Shape, das useShowLock.ts konsumiert', async () => {
  const res = createResponse()
  await showRoutes(request('POST', { username: 'bea' }), res, '/api/shows/lock-test-show/lock')
  assert.equal(res.status, 423)
  assert.equal(res.body.lockedBy, 'anna')
  assert.equal(typeof res.body.since, 'number')
})

test('Derselbe Nutzer kann den Lock erneut erwerben (idempotent)', async () => {
  const res = createResponse()
  await showRoutes(request('POST', { username: 'anna' }), res, '/api/shows/lock-test-show/lock')
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)
})

test('Takeover-Request ohne aktiven Lock liefert 400', async () => {
  const res = createResponse()
  await showRoutes(request('POST', { username: 'bea' }), res, '/api/shows/lock-test-show-ohne-lock/lock/request-takeover')
  assert.equal(res.status, 400)
})

test('Takeover-Request durch den Lock-Halter selbst liefert 400', async () => {
  const res = createResponse()
  await showRoutes(request('POST', { username: 'anna' }), res, '/api/shows/lock-test-show/lock/request-takeover')
  assert.equal(res.status, 400)
})

test('Takeover-Request durch einen anderen Nutzer liefert 200 mit notified', async () => {
  const res = createResponse()
  await showRoutes(request('POST', { username: 'bea' }), res, '/api/shows/lock-test-show/lock/request-takeover')
  assert.equal(res.status, 200)
  assert.equal(res.body.notified, 'anna')
})

test('Lock freigeben (DELETE ohne transferTo) liefert 200, Lock ist danach frei', async () => {
  const releaseRes = createResponse()
  await showRoutes(request('DELETE', { username: 'anna' }, {}), releaseRes, '/api/shows/lock-test-show/lock')
  assert.equal(releaseRes.status, 200)

  const reacquireRes = createResponse()
  await showRoutes(request('POST', { username: 'bea' }), reacquireRes, '/api/shows/lock-test-show/lock')
  assert.equal(reacquireRes.status, 200)
  assert.equal(reacquireRes.body.ok, true)
})

test('Lock-Übernahme via DELETE mit transferTo übergibt den Lock direkt', async () => {
  const transferRes = createResponse()
  await showRoutes(request('DELETE', { username: 'bea' }, { transferTo: 'carla' }), transferRes, '/api/shows/lock-test-show/lock')
  assert.equal(transferRes.status, 200)

  const conflictRes = createResponse()
  await showRoutes(request('POST', { username: 'anna' }), conflictRes, '/api/shows/lock-test-show/lock')
  assert.equal(conflictRes.status, 423)
  assert.equal(conflictRes.body.lockedBy, 'carla')
})

test('touchLock (PUT) liefert 200', async () => {
  const res = createResponse()
  await showRoutes(request('PUT', { username: 'carla' }), res, '/api/shows/lock-test-show/lock')
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)
})

after(cleanupDataPath)

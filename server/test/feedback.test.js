import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

process.env.OPERATOR_USER = 'admin'
process.env.OPERATOR_PASSWORD = 'super-secret-operator-pw'
const { config } = await import('../config.js')
config.operator.user = 'admin'
config.operator.password = 'super-secret-operator-pw'

const { feedbackRoutes, FEEDBACK_MAX_LENGTH } = await import('../routes/feedback.js')
const { operatorRoutes } = await import('../routes/operator.js')
const { operatorLogin } = await import('../operator.js')
const { runWithDb } = await import('../db-context.js')
const { addFeedback } = await import('../registry.js')

after(cleanupDataPath)

function req(method, url, body, headers = {}) {
  const r = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  r.method = method
  r.url = url
  r.headers = { 'content-type': 'application/json', ...headers }
  r.socket = { remoteAddress: '30.0.0.1' }
  return r
}

async function post(text, user = 'anna') {
  const r = req('POST', '/api/feedback', { text })
  r.user = { username: user }
  const res = createResponse()
  await runWithDb({}, () => feedbackRoutes(r, res, '/api/feedback'), 'team-a')
  return res
}

test('Feedback ohne Login wird abgelehnt', async () => {
  const res = createResponse()
  await feedbackRoutes(req('POST', '/api/feedback', { text: 'x' }), res, '/api/feedback')
  assert.equal(res.status, 401)
})

test('Feedback: leer und zu lang werden abgelehnt', async () => {
  assert.equal((await post('   ')).status, 400)
  assert.equal((await post('a'.repeat(FEEDBACK_MAX_LENGTH + 1))).status, 400)
})

test('Feedback wird gespeichert, 6. Eintrag pro Stunde ist rate-limitiert', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await post(`Idee ${i}`, 'bert')).status, 201)
  assert.equal((await post('zu viel', 'bert')).status, 429)
})

test('Operator-Abruf nur mit Operator-Token; importiert-Markierung funktioniert einmal', async () => {
  const id = addFeedback({ tenantId: 'team-a', username: 'anna', text: 'Hallo' })

  const denied = createResponse()
  await operatorRoutes(req('GET', '/api/operator/feedback?neu=1'), denied, '/api/operator/feedback')
  assert.equal(denied.status, 401)

  const auth = { authorization: `Bearer ${operatorLogin('admin', 'super-secret-operator-pw').token}` }
  const list = createResponse()
  await operatorRoutes(req('GET', '/api/operator/feedback?neu=1', undefined, auth), list, '/api/operator/feedback')
  assert.equal(list.status, 200)
  assert.ok(list.body.feedback.some(f => f.id === id && f.tenantId === 'team-a'))

  const path = `/api/operator/feedback/${id}/importiert`
  const ok = createResponse()
  await operatorRoutes(req('POST', path, undefined, auth), ok, path)
  assert.equal(ok.status, 200)
  const again = createResponse()
  await operatorRoutes(req('POST', path, undefined, auth), again, path)
  assert.equal(again.status, 404)

  const after2 = createResponse()
  await operatorRoutes(req('GET', '/api/operator/feedback?neu=1', undefined, auth), after2, '/api/operator/feedback')
  assert.ok(!after2.body.feedback.some(f => f.id === id))
})

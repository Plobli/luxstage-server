import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

process.env.OPERATOR_USER = 'admin'
process.env.OPERATOR_PASSWORD = 'super-secret-operator-pw'
const { config } = await import('../config.js')
config.operator.user = 'admin'
config.operator.password = 'super-secret-operator-pw'

const { operatorRoutes } = await import('../routes/operator.js')

function loginReq(username, password, ip) {
  const req = Readable.from([Buffer.from(JSON.stringify({ username, password }))])
  req.method = 'POST'
  req.headers = { 'content-type': 'application/json' }
  req.socket = { remoteAddress: ip }
  return req
}

test('Operator-Login mit korrekten Credentials liefert ein Token', async () => {
  const res = createResponse()
  await operatorRoutes(loginReq('admin', 'super-secret-operator-pw', '20.0.0.1'), res, '/api/operator/login')
  assert.equal(res.status, 200)
  assert.ok(res.body.token)
})

test('Operator-Login mit falschem Passwort liefert 401', async () => {
  const res = createResponse()
  await operatorRoutes(loginReq('admin', 'falsch', '20.0.0.2'), res, '/api/operator/login')
  assert.equal(res.status, 401)
})

test('11. fehlgeschlagener Operator-Login-Versuch derselben IP wird mit 429 geblockt', async () => {
  const ip = '20.0.0.3'
  for (let i = 0; i < 10; i++) {
    const res = createResponse()
    await operatorRoutes(loginReq('admin', 'falsch', ip), res, '/api/operator/login')
    assert.equal(res.status, 401)
  }
  const blocked = createResponse()
  await operatorRoutes(loginReq('admin', 'falsch', ip), blocked, '/api/operator/login')
  assert.equal(blocked.status, 429)

  // Selbst mit korrektem Passwort bleibt die IP gesperrt, bis das Fenster abläuft
  const stillBlocked = createResponse()
  await operatorRoutes(loginReq('admin', 'super-secret-operator-pw', ip), stillBlocked, '/api/operator/login')
  assert.equal(stillBlocked.status, 429)
})

test('Operator-Rate-Limit ist unabhängig vom Tenant-Login-Rate-Limit (getrennter Zähler-Store)', async () => {
  const { authRoutes } = await import('../routes/auth.js')
  const ip = '20.0.0.4'

  // 10 fehlgeschlagene Tenant-Logins derselben IP ausschöpfen
  for (let i = 0; i < 10; i++) {
    const req = Readable.from([Buffer.from(JSON.stringify({ username: 'niemand', password: 'x' }))])
    req.method = 'POST'
    req.headers = { 'content-type': 'application/json' }
    req.socket = { remoteAddress: ip }
    const res = createResponse()
    await authRoutes(req, res, '/api/auth/login')
  }

  // Operator-Login derselben IP ist davon unberührt
  const res = createResponse()
  await operatorRoutes(loginReq('admin', 'super-secret-operator-pw', ip), res, '/api/operator/login')
  assert.equal(res.status, 200)
})

after(cleanupDataPath)

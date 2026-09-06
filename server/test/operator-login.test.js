import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, mock, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

process.env.OPERATOR_USER = 'admin'
process.env.OPERATOR_PASSWORD = 'super-secret-operator-pw'
const { config } = await import('../config.js')
config.operator.user = 'admin'
config.operator.password = 'super-secret-operator-pw'

const { operatorRoutes, safeContentDispositionFilename } = await import('../routes/operator.js')
const { requireOperator } = await import('../operator.js')

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

test('Betreiber-Login-Erfolg/-Fehlschlag wird geloggt (bisher: keine Spur)', async () => {
  const logSpy = mock.method(console, 'log', () => {})
  try {
    const ok = createResponse()
    await operatorRoutes(loginReq('admin', 'super-secret-operator-pw', '20.0.0.5'), ok, '/api/operator/login')
    const fail = createResponse()
    await operatorRoutes(loginReq('admin', 'falsch', '20.0.0.6'), fail, '/api/operator/login')

    const lines = logSpy.mock.calls.map(c => c.arguments[0])
    assert.ok(lines.some(l => l.includes('[operator]') && l.includes('erfolgreich') && l.includes('20.0.0.5')))
    assert.ok(lines.some(l => l.includes('[operator]') && l.includes('fehlgeschlagen') && l.includes('20.0.0.6')))
  } finally {
    logSpy.mock.restore()
  }
})

test('safeContentDispositionFilename entfernt Anführungszeichen und Zeilenumbrüche', () => {
  assert.equal(safeContentDispositionFilename('x".db'), 'x.db')
  assert.equal(safeContentDispositionFilename('x\r\nSet-Cookie: evil=1.db'), 'xSet-Cookie: evil=1.db')
  assert.equal(safeContentDispositionFilename('team-2026-09-06T10-00-00-000Z.db'), 'team-2026-09-06T10-00-00-000Z.db')
})

test('Snapshot-Download nutzt safeContentDispositionFilename für den Content-Disposition-Header', async () => {
  const { Writable } = await import('node:stream')
  const { createTenant } = await import('../tenants.js')
  const { createSnapshot } = await import('../tenant-backup.js')

  const tenantId = 'download-header-team'
  createTenant(tenantId)
  const name = await createSnapshot(tenantId)

  const loginRes = createResponse()
  await operatorRoutes(loginReq('admin', 'super-secret-operator-pw', '20.0.0.9'), loginRes, '/api/operator/login')
  const { token } = loginRes.body

  const res = new Writable({ write(chunk, enc, cb) { cb() } })
  res.headers = null
  res.writeHead = function (code, h) { this.status = code; this.headers = h }

  await operatorRoutes(
    { method: 'GET', headers: { authorization: `Bearer ${token}` }, socket: { remoteAddress: '20.0.0.9' } },
    res,
    `/api/operator/tenants/${tenantId}/backups/${encodeURIComponent(name)}/download`
  )
  await new Promise(resolve => res.on('finish', resolve))

  assert.equal(res.status, 200)
  assert.equal(res.headers['Content-Disposition'], `attachment; filename="${tenantId}-${name}"`)
})

test('requireOperator loggt eine Ablehnung (fehlendes/ungültiges Token)', () => {
  const logSpy = mock.method(console, 'log', () => {})
  try {
    const res = createResponse()
    requireOperator({ headers: {}, socket: { remoteAddress: '20.0.0.7' } }, res)
    assert.equal(res.status, 401)

    const lines = logSpy.mock.calls.map(c => c.arguments[0])
    assert.ok(lines.some(l => l.includes('[operator]') && l.includes('ohne Token')))
  } finally {
    logSpy.mock.restore()
  }
})

after(cleanupDataPath)

import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { createUserWithHash, createSelfRegisteredUserWithHash, setPasswordHash } = await import('../db/users.js')
const { authRoutes } = await import('../routes/auth.js')
const { hashPassword, authenticate, signToken, issueDownloadToken, issueInlineToken, login } = await import('../auth.js')

async function createUser(username, password) {
  createUserWithHash(username, await hashPassword(password))
}
async function createSelfRegisteredUser(username, password, email) {
  createSelfRegisteredUserWithHash(username, await hashPassword(password), email)
}

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

function reqWithUrl(url) {
  return { headers: {}, url }
}

test('authenticate() akzeptiert ein volles Session-JWT im Authorization-Header', () => {
  const token = signToken('anna')
  const req = { headers: { authorization: `Bearer ${token}` }, url: '/api/shows' }
  const user = authenticate(req)
  assert.equal(user.username, 'anna')
})

test('authenticate() lehnt ein volles Session-JWT als ?token=-Query-Parameter ab', () => {
  const token = signToken('anna')
  const req = reqWithUrl(`/api/shows?token=${encodeURIComponent(token)}`)
  assert.equal(authenticate(req), null)
})

test('authenticate() akzeptiert weiterhin einen gültigen zweckgebundenen Download-Token als Query-Parameter', () => {
  const token = issueDownloadToken('anna')
  const req = reqWithUrl(`/api/shows?token=${encodeURIComponent(token)}`)
  const user = authenticate(req)
  assert.equal(user.username, 'anna')
})

test('authenticate() akzeptiert weiterhin einen gültigen Inline-Token als Query-Parameter', () => {
  const { token } = issueInlineToken('anna')
  const req = reqWithUrl(`/api/shows?token=${encodeURIComponent(token)}`)
  const user = authenticate(req)
  assert.equal(user.username, 'anna')
})

test('Passwort-Änderung invalidiert zuvor ausgestellte Tokens sofort (token_version)', async () => {
  await createUser('dora', 'altes-passwort')
  const oldToken = signToken('dora')
  const oldReq = { headers: { authorization: `Bearer ${oldToken}` }, url: '/api/shows' }
  assert.equal(authenticate(oldReq).username, 'dora') // vor der Änderung gültig

  await setPasswordHash('dora', await hashPassword('neues-passwort'))

  assert.equal(authenticate(oldReq), null, 'altes Token muss nach Passwort-Änderung abgelehnt werden')

  const newToken = signToken('dora')
  const newReq = { headers: { authorization: `Bearer ${newToken}` }, url: '/api/shows' }
  assert.equal(authenticate(newReq).username, 'dora') // frisch ausgestelltes Token bleibt gültig
})

test('Login mit unbekanntem Nutzernamen liefert dieselbe 401-Meldung (kein Enumeration-Leak)', async () => {
  const res = createResponse()
  await authRoutes(jsonRequest('POST', { username: 'gibt-es-nicht', password: 'egal' }, { ip: '10.0.0.3' }), res, '/api/auth/login')
  assert.equal(res.status, 401)
  assert.equal(res.body.error, 'Ungültige Anmeldedaten')
})

test('login() vergleicht bei unbekanntem Username trotzdem per bcrypt (Timing-Enumeration-Schutz)', async () => {
  await createUser('eve', 'irrelevantes-passwort')

  const t0 = process.hrtime.bigint()
  await login('existiert-nicht-abc123', 'egal')
  const unknownMs = Number(process.hrtime.bigint() - t0) / 1e6

  const t1 = process.hrtime.bigint()
  await login('eve', 'falsches-passwort')
  const wrongPasswordMs = Number(process.hrtime.bigint() - t1) / 1e6

  // Beide Pfade müssen einen vollen bcrypt.compare durchlaufen — bei Cost 12
  // typischerweise >50ms. Ohne den Dummy-Compare wäre der unknown-Pfad
  // praktisch 0ms (sofortiger Return vor jedem bcrypt-Aufruf).
  assert.ok(unknownMs > 50, `unbekannter Username sollte einen bcrypt-Vergleich durchlaufen (war ${unknownMs}ms)`)
  // Großzügige Tolerenz statt exakter Gleichheit — Ziel ist "gleiche Größenordnung", nicht Millisekunden-Präzision.
  assert.ok(Math.abs(unknownMs - wrongPasswordMs) < wrongPasswordMs, 'Zeitunterschied darf nicht die Existenz eines Accounts verraten')
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

test('11. reset-password/confirm-Versuch mit ungültigem Token derselben IP wird mit 429 geblockt', async () => {
  const ip = '10.0.0.11'
  for (let i = 0; i < 10; i++) {
    const res = createResponse()
    await authRoutes(jsonRequest('POST', { token: 'ungueltiger-token', newPassword: 'neuespasswort123' }, { ip }), res, '/api/auth/reset-password/confirm')
    assert.equal(res.status, 400)
  }
  const blocked = createResponse()
  await authRoutes(jsonRequest('POST', { token: 'ungueltiger-token', newPassword: 'neuespasswort123' }, { ip }), blocked, '/api/auth/reset-password/confirm')
  assert.equal(blocked.status, 429)
})

after(cleanupDataPath)

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'

const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'luxstage-router-test-'))
process.env.DATA_PATH = dataPath
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'
process.env.BASE_DOMAIN = ''

const { router, dispatchRoute } = await import('../router.js')

class Response extends EventEmitter {
  constructor() {
    super()
    this.headersSent = false
    this.statusCode = 200
    this.body = null
  }

  writeHead(statusCode) {
    this.statusCode = statusCode
    this.headersSent = true
  }

  end(body) {
    this.body = body ? JSON.parse(body) : null
    this.emit('finish')
  }
}

async function request(method, url) {
  const response = new Response()
  await router({ method, url, headers: {}, socket: {} }, response)
  return response
}

test('Health-Check bleibt ausschließlich als GET öffentlich', async () => {
  const health = await request('GET', '/api/health')
  assert.equal(health.statusCode, 200)
  assert.deepEqual(health.body, { ok: true })

  const mutation = await request('POST', '/api/health')
  assert.equal(mutation.statusCode, 401)
})

test('geschützte API-Pfade verlangen einen Token', async () => {
  const response = await request('GET', '/api/users')
  assert.equal(response.statusCode, 401)
  assert.equal(response.body.error, 'Nicht angemeldet')
})

test('dispatchRoute liefert 404, wenn der Handler null zurückgibt', async () => {
  const res = new Response()
  await dispatchRoute(async () => null, { method: 'GET' }, res, '/api/irgendwas', {})
  assert.equal(res.statusCode, 404)
})

test('dispatchRoute antwortet mit 500 statt zu hängen, wenn ein Handler nichts sendet', async () => {
  const res = new Response()
  await dispatchRoute(async () => undefined, { method: 'GET' }, res, '/api/stumm', {})
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error, 'Interner Serverfehler')
})

test('dispatchRoute lässt eine bereits gesendete Antwort unangetastet', async () => {
  const res = new Response()
  await dispatchRoute(async (_req, r) => { r.writeHead(204); r.end() }, { method: 'GET' }, res, '/api/ok', {})
  assert.equal(res.statusCode, 204)
})

test('dispatchRoute wandelt eine Handler-Exception in 500', async () => {
  const res = new Response()
  await dispatchRoute(async () => { throw new Error('kaputt') }, { method: 'GET' }, res, '/api/fehler', {})
  assert.equal(res.statusCode, 500)
})

after(() => fs.rmSync(dataPath, { recursive: true, force: true }))
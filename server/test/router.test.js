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

const { router } = await import('../router.js')

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

after(() => fs.rmSync(dataPath, { recursive: true, force: true }))
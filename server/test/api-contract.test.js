// API-Vertrag: sichert die Antwortstruktur (Feldnamen + Datentypen) aller
// Endpunkte, die iOS- und Android-App nutzen. Ändert sich die Struktur, schlägt
// dieser Test fehl – bewusst: jede Änderung muss auf App-Auswirkung geprüft werden.
//
// Nach geprüfter, gewollter Änderung Snapshot aktualisieren:
//   npm run api-contract:update   (im Repo-Root)
//
// Werte (Namen, Zeitstempel, IDs) spielen keine Rolle, nur die Form.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const dataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'luxstage-contract-'))
process.env.DATA_PATH = dataPath
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'
process.env.BASE_DOMAIN = ''

const here = path.dirname(fileURLToPath(import.meta.url))
const CONTRACT_FILE = path.join(here, 'api-contract.json')
const SERVER_DIR = path.dirname(here)
const UPDATE = process.env.UPDATE_API_CONTRACT === '1'

const { initDb } = await import('../db-init.js')
initDb()
const { hashPassword } = await import('../auth.js')
const { createConfirmedUser } = await import('../db/users.js')
const { router } = await import('../router.js')

const server = http.createServer((req, res) => router(req, res))
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
after(() => {
  server.close()
  fs.rmSync(dataPath, { recursive: true, force: true })
})

let token = null
async function call(method, url, body) {
  const headers = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(base + url, { method, headers, body: body != null ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = '<nicht-JSON>' }
  return { status: res.status, body: json, type: (res.headers.get('content-type') || '').split(';')[0] }
}

// ── Formbeschreibung ─────────────────────────────────────────────────────────
function shape(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return v.length ? [v.map(shape).reduce(merge)] : ['leer']
  if (typeof v === 'object') {
    const o = {}
    for (const k of Object.keys(v).sort()) o[k] = shape(v[k])
    return o
  }
  return typeof v
}
function merge(a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) return a
  if (isObj(a) && isObj(b)) {
    const o = {}
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      o[k] = k in a && k in b ? merge(a[k], b[k]) : (k in a ? a[k] : b[k])
    }
    return o
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a[0] === 'leer') return b
    if (b[0] === 'leer') return a
    return [merge(a[0], b[0])]
  }
  const parts = new Set([...String(a).split('|'), ...String(b).split('|')])
  return [...parts].sort().join('|')
}
const isObj = x => x && typeof x === 'object' && !Array.isArray(x)

// SSE-Ereignisnamen statisch aus dem Quellcode (Apps reagieren darauf).
function sseEvents() {
  const names = new Set()
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'test') continue
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.js')) {
        const src = fs.readFileSync(p, 'utf8')
        for (const m of src.matchAll(/\b(?:broadcast|sendToUser)\(\s*[^,]+,\s*'([a-z0-9-]+)'/gi)) names.add(m[1])
        for (const m of src.matchAll(/withShowMutation\([^,]+,[^,]+,[^,]+,\s*'([a-z0-9-]+)'/g)) names.add(m[1])
      }
    }
  }
  walk(SERVER_DIR)
  return [...names].sort()
}

// ── Testdaten + Aufrufe ──────────────────────────────────────────────────────
// Endpunkte, die die Apps laut Quellcode verwenden (iOS + Android).
test('API-Vertrag für App-Endpunkte unverändert', async () => {
  const contract = {}
  const rec = (key, r) => { contract[key] = { status: r.status, shape: shape(r.body) } }

  createConfirmedUser('anna', await hashPassword('vertrag-passwort-123'), 'anna@example.test')

  rec('GET /api/health', await call('GET', '/api/health'))
  const login = await call('POST', '/api/auth/login', { username: 'anna', password: 'vertrag-passwort-123' })
  rec('POST /api/auth/login', login)
  assert.equal(login.status, 200, 'Login für Vertragstest fehlgeschlagen')
  token = login.body.token ?? login.body.accessToken
  assert.ok(token, 'Kein Token in Login-Antwort')
  if (login.body.refreshToken) {
    rec('POST /api/auth/refresh', await call('POST', '/api/auth/refresh', { refreshToken: login.body.refreshToken }))
  }

  const s = 'demo'
  assert.equal((await call('POST', '/api/shows', { id: s, name: 'Demo', datum: '2026-10-01', spielzeit: '2026/27' })).status, 201)
  rec('POST /api/shows/:id/lock', await call('POST', `/api/shows/${s}/lock`))
  await call('PUT', `/api/shows/${s}/channels`, [
    { channel: '1', address: '1/1', device: 'Source Four', position: 'FOH', color: 'L201', notes: 'Hinweis', quantity: 1, sequence_order: '1' },
    { channel: '2', address: '1/2', device: 'Fresnel', position: '1. Zug', color: '', notes: '', quantity: 2, sequence_order: '' },
  ])
  await call('POST', `/api/shows/${s}/bars`, { label: 'Zug 1', position: 0 })
  await call('POST', `/api/shows/${s}/towers`, { label: 'Turm 1', position: 0, slot_count: 2 })
  await call('PUT', `/api/shows/${s}/section-defs`, { sections: [
    { id: 'sec-kv', title: 'Technik', type: 'kv-table', rows: [{ id: 'r1', label: 'Pult', value: 'Eos' }] },
    { id: 'sec-txt', title: 'Notizen', type: 'text' },
  ] })
  await call('PUT', `/api/shows/${s}/sections`, [{ id: 'sec-txt', content: 'Text' }])
  const bars = await call('GET', `/api/shows/${s}/bars`)
  await call('POST', `/api/shows/${s}/to-template`, { scope: 'bars', selectedIds: [bars.body[0].id], overrideName: 'Vorlage' })

  for (const [key, url] of [
    ['GET /api/shows', '/api/shows'],
    ['GET /api/shows/:id', `/api/shows/${s}`],
    ['GET /api/shows/:id/channels', `/api/shows/${s}/channels`],
    ['GET /api/shows/:id/checks', `/api/shows/${s}/checks`],
    ['GET /api/shows/:id/sections', `/api/shows/${s}/sections`],
    ['GET /api/shows/:id/section-defs', `/api/shows/${s}/section-defs`],
    ['GET /api/shows/:id/photos', `/api/shows/${s}/photos`],
    ['GET /api/shows/:id/photo-captions', `/api/shows/${s}/photo-captions`],
    ['GET /api/shows/:id/bars', `/api/shows/${s}/bars`],
    ['GET /api/shows/:id/towers', `/api/shows/${s}/towers`],
    ['GET /api/shows/:id/floorplan', `/api/shows/${s}/floorplan`],
    ['GET /api/templates', '/api/templates'],
    ['GET /api/me/griddeck', '/api/me/griddeck'],
    ['GET /api/diagnostics', '/api/diagnostics'],
  ]) rec(key, await call('GET', url))

  const actual = { hinweis: 'Automatisch erzeugt von server/test/api-contract.test.js – nicht von Hand bearbeiten.', endpoints: contract, sseEvents: sseEvents() }

  if (UPDATE || !fs.existsSync(CONTRACT_FILE)) {
    fs.writeFileSync(CONTRACT_FILE, JSON.stringify(actual, null, 2) + '\n')
    return
  }
  const expected = JSON.parse(fs.readFileSync(CONTRACT_FILE, 'utf8'))
  try {
    assert.deepEqual(actual, expected)
  } catch (err) {
    err.message = 'API-Vertrag geändert! iOS- und Android-App auf Auswirkungen prüfen.\n' +
      'Wenn gewollt: `npm run api-contract:update` und Change-Record mit ios/android-Status anlegen.\n\n' + err.message
    throw err
  }
})

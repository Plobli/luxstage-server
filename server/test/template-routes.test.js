import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { templateRoutes } = await import('../routes/templates.js')
const { writeTemplate } = await import('../db/templates.js')

function req(method, body) {
  const r = Readable.from([Buffer.from(body != null ? JSON.stringify(body) : '')])
  r.method = method
  r.headers = { 'content-type': 'application/json' }
  r.user = { username: 'anna' }
  return r
}

async function call(method, pathname, body) {
  const res = createResponse()
  const result = await templateRoutes(req(method, body), res, pathname)
  return { res, result }
}

test('Sanity: writeTemplate legt ein Template mit einem Kanal an', () => {
  writeTemplate('tpl-a', [{ channel: 'Kanal 1', address: '1' }])
})

test('GET /api/templates listet Templates', async () => {
  const { res } = await call('GET', '/api/templates')
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(res.body))
  assert.ok(res.body.some(t => t.name === 'tpl-a'))
})

test('GET /api/templates/:name liefert die Kanäle', async () => {
  const { res } = await call('GET', '/api/templates/tpl-a')
  assert.equal(res.status, 200)
  assert.equal(res.body.length, 1)
  assert.equal(res.body[0].channel, 'Kanal 1')
})

test('Bars: POST/GET/PUT/DELETE laufen über den ausgelagerten templateBarRoutes-Sub-Handler', async () => {
  const created = await call('POST', '/api/templates/tpl-a/bars', { label: 'Bar 1', position: 0 })
  assert.equal(created.res.status, 201)
  const barId = created.res.body.id
  assert.ok(barId)

  const listed = await call('GET', '/api/templates/tpl-a/bars')
  assert.equal(listed.res.status, 200)
  assert.equal(listed.res.body.length, 1)

  const updated = await call('PUT', `/api/templates/tpl-a/bars/${barId}`, { label: 'Bar 1 neu', position: 0 })
  assert.equal(updated.res.status, 200)

  const deleted = await call('DELETE', `/api/templates/tpl-a/bars/${barId}`)
  assert.equal(deleted.res.status, 200)
})

test('Towers: POST/GET laufen über den ausgelagerten templateTowerRoutes-Sub-Handler', async () => {
  const created = await call('POST', '/api/templates/tpl-a/towers', { label: 'Turm 1', position: 0, slot_count: 4 })
  assert.equal(created.res.status, 201)
  assert.ok(created.res.body.id)

  const listed = await call('GET', '/api/templates/tpl-a/towers')
  assert.equal(listed.res.status, 200)
  assert.equal(listed.res.body.length, 1)
})

test('Sections: GET/PUT laufen über den ausgelagerten templateSectionRoutes-Sub-Handler', async () => {
  const put = await call('PUT', '/api/templates/tpl-a/sections', { sections: [{ id: 's1', content: 'Text' }] })
  assert.equal(put.res.status, 200)

  const get = await call('GET', '/api/templates/tpl-a/sections')
  assert.equal(get.res.status, 200)
  assert.equal(get.res.body.length, 1)
})

test('Floorplan: GET liefert leeren Zustand über den ausgelagerten templateFloorplanRoutes-Sub-Handler', async () => {
  const { res } = await call('GET', '/api/templates/tpl-a/floorplan')
  assert.equal(res.status, 200)
  assert.equal(res.body.image_url, null)
})

test('Floorplan auf unbekanntem Template liefert weiterhin 404 (notFound-Verhalten erhalten)', async () => {
  const { res } = await call('GET', '/api/templates/gibt-es-nicht/floorplan')
  assert.equal(res.status, 404)
})

test('Lock: POST/GET/DELETE laufen weiterhin über den Template-Kern-Handler', async () => {
  const acquired = await call('POST', '/api/templates/tpl-a/lock')
  assert.equal(acquired.res.status, 200)
  assert.equal(acquired.res.body.ok, true)

  const status = await call('GET', '/api/templates/tpl-a/lock')
  assert.equal(status.res.status, 200)
  assert.equal(status.res.body.lock.user, 'anna')

  const released = await call('DELETE', '/api/templates/tpl-a/lock')
  assert.equal(released.res.status, 200)
})

test('apply-to-shows auf unbekanntem Template liefert 404', async () => {
  const { res } = await call('POST', '/api/templates/gibt-es-nicht/apply-to-shows', { scope: 'bars' })
  assert.equal(res.status, 404)
})

test('Ein Template mit "bars" im Namen wird nicht fälschlich vom Bars-Sub-Handler verschluckt', async () => {
  writeTemplate('bars-2024', [])
  const { res } = await call('GET', '/api/templates/bars-2024')
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, [])
})

test('PATCH /api/templates/:name benennt um', async () => {
  writeTemplate('tpl-rename-me', [])
  const { res } = await call('PATCH', '/api/templates/tpl-rename-me', { name: 'tpl-renamed' })
  assert.equal(res.status, 200)
  assert.equal(res.body.name, 'tpl-renamed')
})

test('DELETE /api/templates/:name löscht', async () => {
  writeTemplate('tpl-delete-me', [])
  const { res } = await call('DELETE', '/api/templates/tpl-delete-me')
  assert.equal(res.status, 200)
})

after(cleanupDataPath)

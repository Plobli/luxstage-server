import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { createShow } = await import('../db/shows.js')
const { barRoutes } = await import('../routes/bars.js')
const { towerRoutes } = await import('../routes/towers.js')
const { readTowers } = await import('../db/towers.js')
const { readBars } = await import('../db/bars.js')

createShow('show-a', { name: 'Show A', use_bars: 1, use_towers: 1 })

function req(method, body) {
  const r = Readable.from([Buffer.from(body != null ? JSON.stringify(body) : '')])
  r.method = method
  r.headers = { 'content-type': 'application/json' }
  r.user = { username: 'anna' }
  return r
}

async function call(routes, method, pathname, body) {
  const res = createResponse()
  await routes(req(method, body), res, pathname)
  return res
}

test('withShowMutation via barRoutes: POST liefert 201 mit { id }', async () => {
  const res = await call(barRoutes, 'POST', '/api/shows/show-a/bars', { label: 'Bar 1', position: 0 })
  assert.equal(res.status, 201)
  assert.ok(res.body.id)
})

test('withShowMutation via barRoutes: PUT liefert 200 mit { ok: true }', async () => {
  const created = await call(barRoutes, 'POST', '/api/shows/show-a/bars', { label: 'Bar 2', position: 0 })
  const barId = created.body.id
  const res = await call(barRoutes, 'PUT', `/api/shows/show-a/bars/${barId}`, { label: 'Bar 2 neu', position: 0 })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { ok: true })
})

test('withShowMutation via barRoutes: DELETE auf unbekannte Show liefert 404, kein Broadcast/Undo', async () => {
  const res = await call(barRoutes, 'DELETE', '/api/shows/gibt-es-nicht/bars/xyz')
  assert.equal(res.status, 404)
})

test('withShowMutation via barRoutes: Fixture-POST liefert 200 mit { ok: true, id }', async () => {
  const barCreated = await call(barRoutes, 'POST', '/api/shows/show-a/bars', { label: 'Bar 3', position: 0 })
  const barId = barCreated.body.id
  // channelId muss existieren? writeBarFixture erwartet nur eine ID, kein FK-Constraint-Check hier nötig
  const res = await call(barRoutes, 'POST', `/api/shows/show-a/bars/${barId}/fixtures`, { channelId: 'ch-does-not-exist' })
  assert.equal(res.status, 200)
  assert.equal(res.body.ok, true)
  assert.ok(res.body.id)
})

test('withShowMutation via towerRoutes: POST liefert 201 mit { id }, ensureTowerSlots läuft im mutate()', async () => {
  const res = await call(towerRoutes, 'POST', '/api/shows/show-a/towers', { name: 'Turm 1', slot_count: 4 })
  assert.equal(res.status, 201)
  assert.ok(res.body.id)

  const listed = await call(towerRoutes, 'GET', '/api/shows/show-a/towers')
  assert.equal(listed.status, 200)
  assert.equal(listed.body.length, 1)
  assert.equal(listed.body[0].slots?.length, 4)
})

test('withShowMutation via towerRoutes: Slot-PATCH liefert { ok: true }', async () => {
  const created = await call(towerRoutes, 'POST', '/api/shows/show-a/towers', { name: 'Turm 2', slot_count: 2 })
  const towerId = created.body.id
  const res = await call(towerRoutes, 'PATCH', `/api/shows/show-a/towers/${towerId}/slots/1`, { channelId: null })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { ok: true })
})

test('slot_count=0 löscht nicht still alle Slots, sondern wird auf ein Minimum geklemmt', async () => {
  const created = await call(towerRoutes, 'POST', '/api/shows/show-a/towers', { name: 'Turm Zero', slot_count: 0 })
  assert.equal(created.status, 201)
  const towerId = created.body.id

  const towers = readTowers('show-a')
  const tower = towers.find(t => t.id === towerId)
  assert.ok(tower.slots.length >= 1, 'slot_count=0 darf nicht zu 0 Slots führen')
})

test('sehr großer slot_count wird auf ein sinnvolles Maximum geklemmt (kein unbegrenztes INSERT)', async () => {
  const created = await call(towerRoutes, 'POST', '/api/shows/show-a/towers', { name: 'Turm Riesig', slot_count: 1e8 })
  assert.equal(created.status, 201)
  const towerId = created.body.id

  const towers = readTowers('show-a')
  const tower = towers.find(t => t.id === towerId)
  assert.ok(tower.slots.length <= 200, 'slot_count muss auf ein Maximum geklemmt werden')
})

test('negativer slot_count auf bestehendem Tower löscht keine bestehenden Slot-Zuweisungen', async () => {
  const created = await call(towerRoutes, 'POST', '/api/shows/show-a/towers', { name: 'Turm Negativ', slot_count: 4 })
  const towerId = created.body.id

  const putRes = await call(towerRoutes, 'PUT', `/api/shows/show-a/towers/${towerId}`, { name: 'Turm Negativ', slot_count: -5 })
  assert.equal(putRes.status, 200)

  const towers = readTowers('show-a')
  const tower = towers.find(t => t.id === towerId)
  assert.ok(tower.slots.length >= 1, 'negativer slot_count darf nicht alle Slots via slot_index > n löschen')
})

test('length_cm=0 löscht nicht still alle Fixture-Positionen einer Bar', async () => {
  const created = await call(barRoutes, 'POST', '/api/shows/show-a/bars', { name: 'Bar Zero', length_cm: 600 })
  const barId = created.body.id
  const fixtureRes = await call(barRoutes, 'POST', `/api/shows/show-a/bars/${barId}/fixtures`, { channelId: 'ch-x', position: 42.5 })
  assert.equal(fixtureRes.status, 200)

  const putRes = await call(barRoutes, 'PUT', `/api/shows/show-a/bars/${barId}`, { name: 'Bar Zero', length_cm: 0 })
  assert.equal(putRes.status, 200)

  const bars = readBars('show-a')
  const bar = bars.find(b => b.id === barId)
  assert.notEqual(bar.length_cm, 0, 'length_cm=0 darf nicht übernommen werden')
  assert.equal(bar.fixtures[0].position, 42.5, 'Fixture-Position darf nicht still auf 0 gesetzt werden')
})

test('nicht-numerischer length_cm-String wirft nicht (fällt auf bisherigen Wert zurück)', async () => {
  const created = await call(barRoutes, 'POST', '/api/shows/show-a/bars', { name: 'Bar NaN', length_cm: 600 })
  const barId = created.body.id

  const putRes = await call(barRoutes, 'PUT', `/api/shows/show-a/bars/${barId}`, { name: 'Bar NaN', length_cm: 'abc' })
  assert.equal(putRes.status, 200)

  const bars = readBars('show-a')
  const bar = bars.find(b => b.id === barId)
  assert.equal(bar.length_cm, 600)
})

after(cleanupDataPath)

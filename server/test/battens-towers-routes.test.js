import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { createShow } = await import('../db/shows.js')
const { battenRoutes } = await import('../routes/battens.js')
const { towerRoutes } = await import('../routes/towers.js')
const { readTowers } = await import('../db/towers.js')
const { readBattens } = await import('../db/battens.js')

createShow('show-a', { name: 'Show A', use_battens: 1, use_towers: 1 })

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

test('withShowMutation via battenRoutes: POST liefert 201 mit { id }', async () => {
  const res = await call(battenRoutes, 'POST', '/api/shows/show-a/battens', { label: 'Batten 1', position: 0 })
  assert.equal(res.status, 201)
  assert.ok(res.body.id)
})

test('withShowMutation via battenRoutes: PUT liefert 200 mit { ok: true }', async () => {
  const created = await call(battenRoutes, 'POST', '/api/shows/show-a/battens', { label: 'Batten 2', position: 0 })
  const battenId = created.body.id
  const res = await call(battenRoutes, 'PUT', `/api/shows/show-a/battens/${battenId}`, { label: 'Batten 2 neu', position: 0 })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { ok: true })
})

test('withShowMutation via battenRoutes: DELETE auf unbekannte Show liefert 404, kein Broadcast/Undo', async () => {
  const res = await call(battenRoutes, 'DELETE', '/api/shows/gibt-es-nicht/battens/xyz')
  assert.equal(res.status, 404)
})

test('withShowMutation via battenRoutes: Fixture-POST liefert 200 mit { ok: true, id }', async () => {
  const battenCreated = await call(battenRoutes, 'POST', '/api/shows/show-a/battens', { label: 'Batten 3', position: 0 })
  const battenId = battenCreated.body.id
  // channelId muss existieren? writeBattenFixture erwartet nur eine ID, kein FK-Constraint-Check hier nötig
  const res = await call(battenRoutes, 'POST', `/api/shows/show-a/battens/${battenId}/fixtures`, { channelId: 'ch-does-not-exist' })
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

test('length_cm=0 löscht nicht still alle Fixture-Positionen einer Batten', async () => {
  const created = await call(battenRoutes, 'POST', '/api/shows/show-a/battens', { name: 'Batten Zero', length_cm: 600 })
  const battenId = created.body.id
  const fixtureRes = await call(battenRoutes, 'POST', `/api/shows/show-a/battens/${battenId}/fixtures`, { channelId: 'ch-x', position: 42.5 })
  assert.equal(fixtureRes.status, 200)

  const putRes = await call(battenRoutes, 'PUT', `/api/shows/show-a/battens/${battenId}`, { name: 'Batten Zero', length_cm: 0 })
  assert.equal(putRes.status, 200)

  const battens = readBattens('show-a')
  const batten = battens.find(b => b.id === battenId)
  assert.notEqual(batten.length_cm, 0, 'length_cm=0 darf nicht übernommen werden')
  assert.equal(batten.fixtures[0].position, 42.5, 'Fixture-Position darf nicht still auf 0 gesetzt werden')
})

test('nicht-numerischer length_cm-String wirft nicht (fällt auf bisherigen Wert zurück)', async () => {
  const created = await call(battenRoutes, 'POST', '/api/shows/show-a/battens', { name: 'Batten NaN', length_cm: 600 })
  const battenId = created.body.id

  const putRes = await call(battenRoutes, 'PUT', `/api/shows/show-a/battens/${battenId}`, { name: 'Batten NaN', length_cm: 'abc' })
  assert.equal(putRes.status, 200)

  const battens = readBattens('show-a')
  const batten = battens.find(b => b.id === battenId)
  assert.equal(batten.length_cm, 600)
})

after(cleanupDataPath)

test('DELETE auf Sammelroute löscht alle Battens/Türme in einem Schritt (ein Undo)', async () => {
  createShow('show-all', { name: 'Show All', use_battens: 1, use_towers: 1 })
  await call(battenRoutes, 'POST', '/api/shows/show-all/battens', { label: 'B1', position: 0 })
  await call(battenRoutes, 'POST', '/api/shows/show-all/battens', { label: 'B2', position: 1 })
  await call(towerRoutes, 'POST', '/api/shows/show-all/towers', { label: 'T1', position: 0, slot_count: 2 })
  assert.equal((await call(battenRoutes, 'DELETE', '/api/shows/show-all/battens')).status, 200)
  assert.equal((await call(towerRoutes, 'DELETE', '/api/shows/show-all/towers')).status, 200)
  assert.equal(readBattens('show-all').length, 0)
  assert.equal(readTowers('show-all').length, 0)
  assert.equal(readBattens('show-a').length > 0, true)
  assert.equal((await call(battenRoutes, 'DELETE', '/api/shows/gibt-es-nicht/battens')).status, 404)
})

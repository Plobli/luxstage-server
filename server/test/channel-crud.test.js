import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { createShow } = await import('../db/shows.js')
const { readChannels, writeChannels } = await import('../db/channels.js')
const { channelRoutes } = await import('../routes/channels.js')

createShow('crud-show', { name: 'Crud', importSections: false })
writeChannels('crud-show', [{ channel: '1' }, { channel: '2' }, { channel: '3' }])

async function call(method, path, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.headers = { 'content-type': 'application/json' }
  req.user = { username: 'anna' }
  const res = createResponse()
  await channelRoutes(req, res, `/api/shows/crud-show/channels${path}`)
  return res
}

test('POST legt Kanal am Ende an', async () => {
  const res = await call('POST', '', { channel: '4', device: 'Robe' })
  assert.equal(res.status, 201)
  const list = readChannels('crud-show')
  assert.equal(list.at(-1).channel, '4')
  assert.equal(list.at(-1).device, 'Robe')
})

test('POST lehnt Nicht-Strings ab', async () => {
  assert.equal((await call('POST', '', { channel: 5 })).status, 400)
})

test('PATCH ändert Kanalnummer und Prio, ID bleibt', async () => {
  const [first] = readChannels('crud-show')
  assert.equal((await call('PATCH', `/${first.id}`, { channel: '10', sequence_order: '2' })).status, 200)
  const after = readChannels('crud-show')[0]
  assert.equal(after.id, first.id)
  assert.equal(after.channel, '10')
  assert.equal(after.sequence_order, '2')
})

test('PUT order sortiert um', async () => {
  const ids = readChannels('crud-show').map(c => c.id).reverse()
  assert.equal((await call('PUT', '/order', { ids })).status, 200)
  assert.deepEqual(readChannels('crud-show').map(c => c.id), ids)
})

test('PUT order lehnt unvollständige Liste ab', async () => {
  const ids = readChannels('crud-show').map(c => c.id).slice(1)
  assert.equal((await call('PUT', '/order', { ids })).status, 400)
})

test('DELETE entfernt Kanal, 404 bei unbekanntem', async () => {
  const [c] = readChannels('crud-show')
  assert.equal((await call('DELETE', `/${c.id}`)).status, 200)
  assert.equal(readChannels('crud-show').some(x => x.id === c.id), false)
  assert.equal((await call('DELETE', '/gibt-es-nicht')).status, 404)
})

after(cleanupDataPath)

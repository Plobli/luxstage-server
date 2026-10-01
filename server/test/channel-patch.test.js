import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

const { createShow } = await import('../db/shows.js')
const { readChannels, writeChannels } = await import('../db/channels.js')
const { getLastOperation } = await import('../db/operations.js')
const { readShow } = await import('../db/shows.js')
const { channelRoutes } = await import('../routes/channels.js')

createShow('patch-show', { name: 'Patch', importSections: false })
createShow('other-show', { name: 'Other', importSections: false })
writeChannels('patch-show', [
  { channel: '1', address: '1.001', device: 'Robe', color: 'R02', notes: 'alt' },
  { channel: '2', address: '1.002', device: 'Aura', color: '', notes: '' },
])
writeChannels('other-show', [{ channel: '1', notes: 'fremd' }])

async function patch(slug, id, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = 'PATCH'
  req.headers = { 'content-type': 'application/json' }
  req.user = { username: 'anna' }
  const res = createResponse()
  await channelRoutes(req, res, `/api/shows/${slug}/channels/${id}`)
  return res
}

test('PATCH ändert nur die übergebenen Felder', async () => {
  const [ch1, ch2] = readChannels('patch-show')
  const res = await patch('patch-show', ch1.id, { notes: 'Spot Mitte' })
  assert.equal(res.status, 200)
  const after = readChannels('patch-show')
  assert.equal(after[0].notes, 'Spot Mitte')
  assert.equal(after[0].device, 'Robe')
  assert.equal(after[0].color, 'R02')
  assert.equal(after[1].notes, ch2.notes)
})

test('PATCH legt eine Undo-Operation an', async () => {
  const [ch1] = readChannels('patch-show')
  const showId = readShow('patch-show').id
  const before = getLastOperation(showId)?.id
  await patch('patch-show', ch1.id, { notes: 'zweite' })
  assert.notEqual(getLastOperation(showId)?.id, before)
})

test('PATCH auf unbekannten Kanal liefert 404, ohne Änderung', async () => {
  const res = await patch('patch-show', 'gibt-es-nicht', { notes: 'x' })
  assert.equal(res.status, 404)
})

test('PATCH auf Kanal einer anderen Show liefert 404', async () => {
  const [foreign] = readChannels('other-show')
  const res = await patch('patch-show', foreign.id, { notes: 'geklaut' })
  assert.equal(res.status, 404)
  assert.equal(readChannels('other-show')[0].notes, 'fremd')
})

test('PATCH lehnt Nicht-Strings ab, ignoriert unbekannte Felder', async () => {
  const [ch1] = readChannels('patch-show')
  assert.equal((await patch('patch-show', ch1.id, { notes: 5 })).status, 400)
  const res = await patch('patch-show', ch1.id, { id: 'x', show_id: 'y', notes: 'ok' })
  assert.equal(res.status, 200)
  assert.equal(readChannels('patch-show')[0].id, ch1.id)
})

test('PATCH auf unbekannte Show liefert 404', async () => {
  assert.equal((await patch('gibt-es-nicht', 'x', { notes: 'a' })).status, 404)
})

after(cleanupDataPath)

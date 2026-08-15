import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { createResponse, cleanupDataPath } from './helpers/test-env.js'

const { createShow } = await import('../db/shows.js')
const { channelRoutes } = await import('../routes/channels.js')

function getRequest(slug) {
  return { method: 'GET', url: `/api/shows/${slug}/channels` }
}

function putRequest(slug, channels, { ifMatch, username = 'tester' } = {}) {
  const req = Readable.from([Buffer.from(JSON.stringify(channels))])
  req.method = 'PUT'
  req.url = `/api/shows/${slug}/channels`
  req.headers = ifMatch ? { 'if-match': ifMatch } : {}
  req.user = { username }
  return req
}

async function put(slug, channels, opts) {
  const req = putRequest(slug, channels, opts)
  const res = createResponse()
  await channelRoutes(req, res, `/api/shows/${slug}/channels`)
  return res
}

test('Konflikterkennung: abweichende Version wird mit 409 statt stillem Überschreiben abgelehnt', async () => {
  createShow('conflict-show', { name: 'Konflikt-Show' })

  // Initial laden, Version merken
  const initial = createResponse()
  await channelRoutes(getRequest('conflict-show'), initial, '/api/shows/conflict-show/channels')
  assert.equal(initial.status, 200)
  const v1 = initial.headers['X-Show-Version']
  assert.ok(v1)

  // Erster Save mit korrekter Basisversion — muss durchgehen und eine neue Version liefern
  const res1 = await put('conflict-show', [{ channel: '1', device: 'PAR' }], { ifMatch: v1, username: 'alice' })
  assert.equal(res1.status, 200)
  const v2 = res1.headers['X-Show-Version']
  assert.ok(v2)

  // Zweiter Save von einer anderen "Session", die noch v1 kennt (stale) — muss 409 liefern
  const res2 = await put('conflict-show', [{ channel: '2', device: 'LED' }], { ifMatch: v1, username: 'bob' })
  assert.equal(res2.status, 409)
  assert.equal(res2.body.error, 'conflict')
  assert.equal(res2.body.serverVersion, v2)
  assert.deepEqual(res2.body.serverChannels.map(c => c.channel), ['1'])

  // Save mit der aktuellen Version (v2) geht durch
  const res3 = await put('conflict-show', [{ channel: '2', device: 'LED' }], { ifMatch: v2, username: 'bob' })
  assert.equal(res3.status, 200)
})

test('Save ohne If-Match-Header überschreibt weiterhin ohne Prüfung (Rückwärtskompatibilität)', async () => {
  createShow('no-version-show', { name: 'Ohne Version' })
  const res = await put('no-version-show', [{ channel: '9', device: 'Moving Head' }])
  assert.equal(res.status, 200)
})

after(() => cleanupDataPath())

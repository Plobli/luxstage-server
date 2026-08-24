import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { after, test } from 'node:test'
import { createResponse, cleanupDataPath } from './helpers/test-env.js'

const { createShow } = await import('../db/shows.js')
const { sectionRoutes } = await import('../routes/sections.js')

function getSectionsRequest(slug) {
  return { method: 'GET', url: `/api/shows/${slug}/sections` }
}
function getDefsRequest(slug) {
  return { method: 'GET', url: `/api/shows/${slug}/section-defs` }
}

function putRequest(slug, kind, body, { ifMatch, username = 'tester' } = {}) {
  const suffix = kind === 'contents' ? 'sections' : 'section-defs'
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = 'PUT'
  req.url = `/api/shows/${slug}/${suffix}`
  req.headers = ifMatch ? { 'if-match': ifMatch } : {}
  req.user = { username }
  return req
}

async function putSections(slug, sections, opts) {
  const req = putRequest(slug, 'contents', sections, opts)
  const res = createResponse()
  await sectionRoutes(req, res, `/api/shows/${slug}/sections`)
  return res
}

async function putDefs(slug, defs, opts) {
  const req = putRequest(slug, 'defs', { sections: defs }, opts)
  const res = createResponse()
  await sectionRoutes(req, res, `/api/shows/${slug}/section-defs`)
  return res
}

test('Section-Inhalte: abweichende Version wird mit 409 abgelehnt', async () => {
  createShow('sec-conflict-show', { name: 'Sections-Konflikt' })
  // section_contents.section_id referenziert section_defs.id — erst eine Def anlegen
  await putDefs('sec-conflict-show', [{ id: 'aufbau', title: 'Aufbau', type: 'markdown', order: 0 }])

  const initial = createResponse()
  await sectionRoutes(getSectionsRequest('sec-conflict-show'), initial, '/api/shows/sec-conflict-show/sections')
  assert.equal(initial.status, 200)
  const v1 = initial.headers['X-Show-Version']
  assert.ok(v1)

  const res1 = await putSections('sec-conflict-show', [{ id: 'aufbau', content: 'Erster Text' }], { ifMatch: v1 })
  assert.equal(res1.status, 200)
  const v2 = res1.headers['X-Show-Version']
  assert.ok(v2)
  assert.notEqual(v1, v2)

  const res2 = await putSections('sec-conflict-show', [{ id: 'aufbau', content: 'Konkurrierender Text' }], { ifMatch: v1 })
  assert.equal(res2.status, 409)
  assert.equal(res2.body.error, 'conflict')
  assert.equal(res2.body.serverVersion, v2)

  const res3 = await putSections('sec-conflict-show', [{ id: 'aufbau', content: 'Konkurrierender Text' }], { ifMatch: v2 })
  assert.equal(res3.status, 200)
})

test('Section-Definitionen: eigene Version getrennt von Section-Inhalten', async () => {
  createShow('sec-defs-show', { name: 'Defs-Konflikt' })
  await putDefs('sec-defs-show', [{ id: 'x', title: 'Aufbau', type: 'markdown', order: 0 }])

  const initialDefs = createResponse()
  await sectionRoutes(getDefsRequest('sec-defs-show'), initialDefs, '/api/shows/sec-defs-show/section-defs')
  const dv1 = initialDefs.headers['X-Show-Version']
  assert.ok(dv1)

  // Ein Save der Section-Inhalte darf die Defs-Version nicht verändern
  const contentsRes = await putSections('sec-defs-show', [{ id: 'x', content: 'text' }])
  assert.equal(contentsRes.status, 200)

  const defsRes = await putDefs('sec-defs-show', [{ id: 'x', title: 'Aufbau', type: 'markdown', order: 0 }], { ifMatch: dv1 })
  assert.equal(defsRes.status, 200, JSON.stringify(defsRes.body))

  // Stale Defs-Version (dv1) nach dem Save muss jetzt einen Konflikt geben
  const staleRes = await putDefs('sec-defs-show', [{ id: 'x', title: 'Umbenannt', type: 'markdown', order: 0 }], { ifMatch: dv1 })
  assert.equal(staleRes.status, 409)
})

after(() => cleanupDataPath())

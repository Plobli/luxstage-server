import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath, createResponse } from './helpers/test-env.js'

// DB-Initialisierung (globale Datenbank für Single-Tenant-Tests)
await import('../db-init.js')

const { getDb } = await import('../db-context.js')
const { createShow, readShow } = await import('../db.js')
const { showRoutes } = await import('../routes/shows.js')
const { recordSnapshot } = await import('../db/operations.js')
const { readFullShowState } = await import('../db/full-state.js')

function jsonRequest(method, user, body) {
  return {
    method,
    user: user || { username: 'tester' },
    headers: { 'content-type': 'application/json' },
    on: () => {},
    once: () => {},
  }
}

test('Undo lehnt einen manipulierten Snapshot ab statt ihn stillschweigend anzuwenden', async () => {
  createShow('test-show-hashcheck', { name: 'Hash-Test', importSections: false })
  const show = readShow('test-show-hashcheck')

  // Manipulierten Snapshot direkt in die DB schreiben (simuliert Datenkorruption)
  const fakeState = { channels: [{ channel: '999' }], sectionDefs: [], sections: [], towers: [], bars: [] }
  const conn = getDb()
  conn.prepare(`
    INSERT INTO operations (id, show_id, created_at, performed_by, snapshot, hash)
    VALUES ('fake-op', ?, ?, 'tester', ?, 'falscher-hash')
  `).run(show.id, Date.now(), JSON.stringify(fakeState))

  const undoReq = jsonRequest('POST', { username: 'tester' }, {})
  const undoRes = createResponse()
  await showRoutes(undoReq, undoRes, `/api/shows/test-show-hashcheck/undo`)

  assert.equal(undoRes.status, 409)
  // Zustand darf NICHT übernommen worden sein
  assert.equal(readFullShowState('test-show-hashcheck').channels.length, 0)
})

after(() => {
  cleanupDataPath()
})

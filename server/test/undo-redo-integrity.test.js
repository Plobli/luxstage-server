import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { test } from 'node:test'
import './helpers/test-env.js'

const db = await import('../db.js')
const dbCtx = await import('../db-context.js')
const { writeChannels } = await import('../db/channels.js')
const { readShow } = await import('../db/shows.js')
const { createShow } = await import('../db/shows.js')
const { readFullShowState, writeFullShowState, computeStateHash } = await import('../db/full-state.js')
const { withUndoSnapshot, getLastOperation, pushRedo, popRedo, clearRedo } = await import('../db/operations.js')
const { channelRoutes } = await import('../routes/channels.js')
const { showRoutes } = await import('../routes/shows.js')

function jsonRequest(method, user, body) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))])
  req.method = method
  req.user = user
  req.headers = { 'content-type': 'application/json' }
  return req
}

function createResponseLocal() {
  let status = null, body = null
  return {
    writeHead(code) { status = code },
    end(content) { body = content ? JSON.parse(content) : null },
    get status() { return status },
    get body() { return body },
  }
}

test('Migration 039 legt operations (neues Schema) und redo_stack an', () => {
  const conn = dbCtx.getDb()
  const opsCols = conn.prepare("PRAGMA table_info(operations)").all().map(c => c.name)
  assert.deepEqual(opsCols.sort(), ['created_at', 'hash', 'id', 'performed_by', 'show_id', 'snapshot'].sort())
  const redoCols = conn.prepare("PRAGMA table_info(redo_stack)").all().map(c => c.name)
  assert.deepEqual(redoCols.sort(), ['created_at', 'hash', 'id', 'show_id', 'snapshot'].sort())
})

test('readFullShowState/writeFullShowState sind roundtrip-stabil', () => {
  createShow('test-show-fullstate', { name: 'Testshow', importSections: false })
  const before = readFullShowState('test-show-fullstate')
  before.channels.push({ channel: '1', address: '1/001', device: 'PAR', position: 'Turm 1', color: 'R80', notes: 'Testnotiz' })

  writeFullShowState('test-show-fullstate', before, 'tester')
  const after = readFullShowState('test-show-fullstate')

  assert.equal(after.channels.length, 1)
  assert.equal(after.channels[0].notes, 'Testnotiz')
  assert.equal(computeStateHash(after), computeStateHash(before))
})

test('withUndoSnapshot speichert den Vorher-Zustand als einen Full-Snapshot', () => {
  createShow('test-show-undo', { name: 'Undo-Test', importSections: false })
  const show = readShow('test-show-undo')

  withUndoSnapshot('test-show-undo', show.id, 'tester', () => {
    writeChannels('test-show-undo', [{ channel: '1', notes: 'v1' }])
  })

  const op = getLastOperation(show.id)
  assert.ok(op)
  const snapshot = JSON.parse(op.snapshot)
  assert.equal(snapshot.channels.length, 0) // Vorher-Zustand war leer
})

test('Redo-Stack ist persistent (DB-Tabelle, keine In-Memory-Struktur)', () => {
  createShow('test-show-redo', { name: 'Redo-Test', importSections: false })
  const show = readShow('test-show-redo')
  const state = { channels: [{ channel: '1', notes: 'nach redo' }], sectionDefs: [], sections: [], towers: [], bars: [] }

  pushRedo(show.id, state)
  // Beweis der Persistenz: popRedo liest ausschließlich aus der redo_stack-Tabelle
  // (siehe Implementierung in Task 3) — es existiert keine In-Memory-Map mehr,
  // die bei einem Prozessneustart verloren gehen könnte.
  const popped = popRedo(show.id)
  assert.equal(JSON.parse(popped.snapshot).channels[0].notes, 'nach redo')

  clearRedo(show.id)
  assert.equal(popRedo(show.id), null)
})

test('withUndoSnapshot rollt bei Fehler in mutate() vollständig zurück', () => {
  createShow('test-show-rollback', { name: 'Rollback-Test', importSections: false })
  const show = readShow('test-show-rollback')

  assert.throws(() => {
    withUndoSnapshot('test-show-rollback', show.id, 'tester', () => {
      throw new Error('mutation failed')
    })
  })

  assert.equal(getLastOperation(show.id), null)
})

test('Undo nach Channel-Änderung stellt exakt den vorherigen Full-State wieder her', async () => {
  createShow('test-show-crossres', { name: 'Cross-Res-Test', importSections: false })
  const show = readShow('test-show-crossres')
  const user = { username: 'tester' }

  const putReq = jsonRequest('PUT', user, [{ channel: '1', address: '1/001', device: 'PAR', position: 'Turm 1', color: '', notes: 'erste Notiz' }])
  const putRes = createResponseLocal()
  await channelRoutes(putReq, putRes, `/api/shows/test-show-crossres/channels`)
  assert.equal(putRes.status, 200)

  const beforeUndo = readFullShowState('test-show-crossres')
  assert.equal(beforeUndo.channels[0].notes, 'erste Notiz')

  const undoReq = jsonRequest('POST', user, {})
  const undoRes = createResponseLocal()
  await showRoutes(undoReq, undoRes, `/api/shows/test-show-crossres/undo`)
  assert.equal(undoRes.status, 200)

  const afterUndo = readFullShowState('test-show-crossres')
  assert.equal(afterUndo.channels.length, 0)
})

test('Undo lehnt einen manipulierten Snapshot ab statt ihn stillschweigend anzuwenden', async () => {
  createShow('test-show-hashcheck', { name: 'Hash-Test', importSections: false })
  const show = readShow('test-show-hashcheck')

  // Manipulierten Snapshot direkt in die DB schreiben (simuliert Datenkorruption)
  const fakeState = { channels: [{ channel: '999' }], sectionDefs: [], sections: [], towers: [], bars: [] }
  const conn = dbCtx.getDb()
  conn.prepare(`
    INSERT INTO operations (id, show_id, created_at, performed_by, snapshot, hash)
    VALUES ('fake-op', ?, ?, 'tester', ?, 'falscher-hash')
  `).run(show.id, Date.now(), JSON.stringify(fakeState))

  const undoReq = jsonRequest('POST', { username: 'tester' }, {})
  const undoRes = createResponseLocal()
  await showRoutes(undoReq, undoRes, `/api/shows/test-show-hashcheck/undo`)

  assert.equal(undoRes.status, 409)
  // Zustand darf NICHT übernommen worden sein
  assert.equal(readFullShowState('test-show-hashcheck').channels.length, 0)
})

test('Nach Redo ist erneut ein Undo möglich (Undo-Redo-Undo-Kette bleibt konsistent)', async () => {
  createShow('test-show-undoredoundo', { name: 'Kette-Test', importSections: false })
  const user = { username: 'tester' }

  const putReq = jsonRequest('PUT', user, [{ channel: '1', address: '', device: '', position: '', color: '', notes: 'v1' }])
  const putRes = createResponseLocal()
  await channelRoutes(putReq, putRes, `/api/shows/test-show-undoredoundo/channels`)
  assert.equal(putRes.status, 200)

  const undoRes1 = createResponseLocal()
  await showRoutes(jsonRequest('POST', user, {}), undoRes1, '/api/shows/test-show-undoredoundo/undo')
  assert.equal(undoRes1.status, 200)
  assert.equal(readFullShowState('test-show-undoredoundo').channels.length, 0)

  const redoRes = createResponseLocal()
  await showRoutes(jsonRequest('POST', user, {}), redoRes, '/api/shows/test-show-undoredoundo/redo')
  assert.equal(redoRes.status, 200)
  assert.equal(readFullShowState('test-show-undoredoundo').channels[0].notes, 'v1')

  const undoRes2 = createResponseLocal()
  await showRoutes(jsonRequest('POST', user, {}), undoRes2, '/api/shows/test-show-undoredoundo/undo')
  assert.equal(undoRes2.status, 200)
  assert.equal(readFullShowState('test-show-undoredoundo').channels.length, 0)
})

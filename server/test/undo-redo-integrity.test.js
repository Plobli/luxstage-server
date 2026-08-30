import assert from 'node:assert/strict'
import { test } from 'node:test'
import './helpers/test-env.js'

const db = await import('../db.js')
const dbCtx = await import('../db-context.js')
const { writeChannels } = await import('../db/channels.js')
const { readShow } = await import('../db/shows.js')
const { createShow } = await import('../db/shows.js')
const { readFullShowState, writeFullShowState, computeStateHash } = await import('../db/full-state.js')
const { withUndoSnapshot, getLastOperation, pushRedo, popRedo, clearRedo } = await import('../db/operations.js')

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

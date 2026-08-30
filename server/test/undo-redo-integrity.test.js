import assert from 'node:assert/strict'
import { test } from 'node:test'
import './helpers/test-env.js'

const db = await import('../db.js')
const dbCtx = await import('../db-context.js')

test('Migration 039 legt operations (neues Schema) und redo_stack an', () => {
  const conn = dbCtx.getDb()
  const opsCols = conn.prepare("PRAGMA table_info(operations)").all().map(c => c.name)
  assert.deepEqual(opsCols.sort(), ['created_at', 'hash', 'id', 'performed_by', 'show_id', 'snapshot'].sort())
  const redoCols = conn.prepare("PRAGMA table_info(redo_stack)").all().map(c => c.name)
  assert.deepEqual(redoCols.sort(), ['created_at', 'hash', 'id', 'show_id', 'snapshot'].sort())
})

test('readFullShowState/writeFullShowState sind roundtrip-stabil', async () => {
  const { createShow } = await import('../db/shows.js')
  const { readFullShowState, writeFullShowState, computeStateHash } = await import('../db/full-state.js')

  createShow('test-show-fullstate', { name: 'Testshow', importSections: false })
  const before = readFullShowState('test-show-fullstate')
  before.channels.push({ channel: '1', address: '1/001', device: 'PAR', position: 'Turm 1', color: 'R80', notes: 'Testnotiz' })

  writeFullShowState('test-show-fullstate', before, 'tester')
  const after = readFullShowState('test-show-fullstate')

  assert.equal(after.channels.length, 1)
  assert.equal(after.channels[0].notes, 'Testnotiz')
  assert.equal(computeStateHash(after), computeStateHash(before))
})

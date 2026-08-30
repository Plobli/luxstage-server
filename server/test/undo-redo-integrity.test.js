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

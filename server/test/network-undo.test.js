import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { cleanupDataPath } from './helpers/test-env.js'

// Der globale (scope-lose) Undo-Stack war bisher nicht abgedeckt — die
// bestehenden Integritätstests prüfen nur die Show-Variante. Seit beide
// dieselbe Fabrik nutzen (db/undo-stack.js), sichert das hier den zweiten Zweig.
const {
  recordNetworkSnapshot, getLastNetworkOperation, deleteNetworkOperation,
  pushNetworkRedo, popNetworkRedo, clearNetworkRedo, withNetworkUndoSnapshot,
} = await import('../db/network-operations.js')
const { createNetworkNode, listNetworkNodes } = await import('../db/network.js')
const { readFullNetworkState, computeNetworkStateHash } = await import('../db/network-state.js')
const { getDb } = await import('../db-context.js')

test('withNetworkUndoSnapshot zeichnet den Zustand VOR der Änderung auf', () => {
  withNetworkUndoSnapshot('anna@test.de', () => {
    createNetworkNode({ type: 'switch', label: 'SW1', port_count: 8 })
  })

  const op = getLastNetworkOperation()
  assert.ok(op, 'kein Undo-Eintrag angelegt')
  assert.equal(op.performed_by, 'anna@test.de')
  const before = JSON.parse(op.snapshot)
  assert.equal(before.nodes.length, 0, 'Snapshot enthält den Zustand NACH der Änderung')
  assert.equal(listNetworkNodes().length, 1)
})

test('withNetworkUndoSnapshot rollt bei Fehler in mutate() vollständig zurück', () => {
  const opsBefore = getDb().prepare('SELECT COUNT(*) c FROM network_operations').get().c
  const nodesBefore = listNetworkNodes().length

  assert.throws(() => {
    withNetworkUndoSnapshot('anna@test.de', () => {
      createNetworkNode({ type: 'switch', label: 'SW-kaputt', port_count: 8 })
      throw new Error('absichtlicher Fehler')
    })
  }, /absichtlicher Fehler/)

  assert.equal(getDb().prepare('SELECT COUNT(*) c FROM network_operations').get().c, opsBefore,
    'Undo-Eintrag trotz fehlgeschlagener Mutation geschrieben')
  assert.equal(listNetworkNodes().length, nodesBefore, 'Datenänderung nicht zurückgerollt')
})

test('Redo-Stack ist persistent und liefert zuletzt abgelegten Eintrag zuerst', () => {
  clearNetworkRedo()
  pushNetworkRedo({ nodes: [{ label: 'A' }], connections: [] })
  pushNetworkRedo({ nodes: [{ label: 'B' }], connections: [] })

  const rows = getDb().prepare('SELECT COUNT(*) c FROM network_redo_stack').get().c
  assert.equal(rows, 2, 'Redo-Stack liegt nicht in der DB')

  assert.equal(JSON.parse(popNetworkRedo().snapshot).nodes[0].label, 'B')
  assert.equal(JSON.parse(popNetworkRedo().snapshot).nodes[0].label, 'A')
  assert.equal(popNetworkRedo(), null, 'leerer Stack liefert nicht null')
})

test('withNetworkUndoSnapshot leert den Redo-Stack', () => {
  pushNetworkRedo({ nodes: [], connections: [] })
  withNetworkUndoSnapshot('anna@test.de', () => {
    createNetworkNode({ type: 'device', label: 'Dose 1' })
  })
  assert.equal(popNetworkRedo(), null, 'Redo-Stack nach neuer Aktion nicht geleert')
})

test('Snapshot-Hash passt zum abgelegten Zustand', () => {
  const op = getLastNetworkOperation()
  assert.equal(op.hash, computeNetworkStateHash(JSON.parse(op.snapshot)))
})

test('deleteNetworkOperation entfernt genau einen Eintrag', () => {
  const before = getDb().prepare('SELECT COUNT(*) c FROM network_operations').get().c
  deleteNetworkOperation(getLastNetworkOperation().id)
  assert.equal(getDb().prepare('SELECT COUNT(*) c FROM network_operations').get().c, before - 1)
})

test('recordNetworkSnapshot begrenzt den Stack auf 50 Einträge', () => {
  getDb().prepare('DELETE FROM network_operations').run()
  for (let i = 0; i < 55; i++) recordNetworkSnapshot('anna@test.de', readFullNetworkState())
  const count = getDb().prepare('SELECT COUNT(*) c FROM network_operations').get().c
  assert.ok(count <= 50, `Stack nicht begrenzt: ${count} Einträge`)
})

after(cleanupDataPath)

import assert from 'node:assert/strict'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import './helpers/test-env.js'

const { initSchema } = await import('../db-init.js')
const { up } = await import('../db/migrations/051-rename-batten-drawing-plan.js')
const { upgradeLegacyNames } = await import('../db/legacy-names.js')

// Baut den Zustand vor Migration 051 nach: neue DB, Umbenennung rückwärts.
function legacyDb() {
  const db = initSchema(new Database(':memory:'))
  const tables = [['battens', 'bars'], ['batten_fixtures', 'bar_fixtures'], ['template_battens', 'template_bars'],
    ['template_batten_fixtures', 'template_bar_fixtures'], ['template_drawing_plans', 'template_floorplans'],
    ['show_drawing_plan_layers', 'show_floorplan_layers']]
  for (const [to, from] of tables) db.exec(`ALTER TABLE ${to} RENAME TO ${from}`)
  db.exec('ALTER TABLE shows RENAME COLUMN use_battens TO use_bars')
  for (const t of ['bars', 'template_bars']) {
    db.exec(`ALTER TABLE ${t} RENAME COLUMN batten_nr TO zug_nr`)
    db.exec(`ALTER TABLE ${t} RENAME COLUMN batten_type TO bar_type`)
  }
  db.exec('ALTER TABLE bar_fixtures RENAME COLUMN batten_id TO bar_id')
  db.exec('ALTER TABLE template_bar_fixtures RENAME COLUMN batten_id TO bar_id')
  db.prepare("DELETE FROM schema_migrations WHERE id = '051-rename-batten-drawing-plan'").run()
  return db
}

test('Migration 051 benennt Tabellen, Spalten, Typwerte und JSON um', () => {
  const db = legacyDb()
  db.prepare("INSERT INTO shows (id, slug, name, created_at, updated_at) VALUES ('s1', 's1', 'S', 1, 1)").run()
  db.prepare("INSERT INTO bars (id, show_id, name, zug_nr, bar_type, created_at) VALUES ('b1', 's1', 'Zug 1', '1', 'punktzug', 1)").run()
  db.prepare("INSERT INTO bars (id, show_id, name, zug_nr, bar_type, created_at) VALUES ('b2', 's1', 'Zug 2', '2', 'zugstange', 1)").run()
  db.prepare("INSERT INTO show_floorplan_layers (id, show_id, canvas_data, updated_at) VALUES ('l1', 's1', ?, 1)")
    .run(JSON.stringify({ objects: [{ type: 'bar', barId: 'b1', zugNr: '1' }, { type: 'rect' }] }))
  db.prepare("INSERT INTO channels (id, show_id, channel, mount_ref) VALUES ('c1', 's1', 1, ?)")
    .run(JSON.stringify({ type: 'bar', barId: 'b1', barType: 'punktzug' }))

  up(db)

  assert.deepEqual(db.prepare('SELECT batten_nr, batten_type FROM battens ORDER BY id').all(),
    [{ batten_nr: '1', batten_type: 'point_batten' }, { batten_nr: '2', batten_type: 'batten' }])
  const canvas = JSON.parse(db.prepare('SELECT canvas_data FROM show_drawing_plan_layers').get().canvas_data)
  assert.deepEqual(canvas.objects[0], { type: 'batten', battenId: 'b1', battenNr: '1' })
  assert.deepEqual(canvas.objects[1], { type: 'rect' })
  assert.deepEqual(JSON.parse(db.prepare('SELECT mount_ref FROM channels').get().mount_ref),
    { type: 'batten', battenId: 'b1', battenType: 'point_batten' })
  assert.equal(db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE name IN ('bars','bar_fixtures','template_floorplans')").get().c, 0)
})

test('upgradeLegacyNames übersetzt alte Snapshots und lässt neue Namen unberührt', () => {
  const old = { bars: [{ zug_nr: '3', bar_type: 'zugstange', fixtures: [{ bar_id: 'x' }] }], floorplan: { canvas_data: '{"a":[{"type":"bar"}]}' } }
  const up1 = upgradeLegacyNames(old)
  assert.deepEqual(up1.battens, [{ batten_nr: '3', batten_type: 'batten', fixtures: [{ batten_id: 'x' }] }])
  assert.equal(up1.drawingPlan.canvas_data, '{"a":[{"type":"batten"}]}')
  assert.deepEqual(upgradeLegacyNames(up1), up1)
})

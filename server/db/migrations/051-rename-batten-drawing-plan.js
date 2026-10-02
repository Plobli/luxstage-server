import { hasColumn } from './helpers.js'
import { upgradeLegacyJsonText } from '../legacy-names.js'

// Umbenennung bars → battens, floorplan → drawing plan (Tabellen, Spalten, Werte,
// JSON in canvas_data/mount_ref). Index-Namen bleiben bewusst unverändert.
export const id = '051-rename-batten-drawing-plan'

const TABLES = [
  ['bars', 'battens'],
  ['bar_fixtures', 'batten_fixtures'],
  ['template_bars', 'template_battens'],
  ['template_bar_fixtures', 'template_batten_fixtures'],
  ['template_floorplans', 'template_drawing_plans'],
  ['show_floorplan_layers', 'show_drawing_plan_layers'],
]
const COLUMNS = [
  ['shows', 'use_bars', 'use_battens'],
  ['battens', 'zug_nr', 'batten_nr'],
  ['battens', 'bar_type', 'batten_type'],
  ['batten_fixtures', 'bar_id', 'batten_id'],
  ['template_battens', 'zug_nr', 'batten_nr'],
  ['template_battens', 'bar_type', 'batten_type'],
  ['template_batten_fixtures', 'bar_id', 'batten_id'],
]

const hasTable = (db, name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)

export function alreadyApplied(db) {
  return hasTable(db, 'battens')
}

function rewriteJsonColumn(db, table, idCol, col) {
  const rows = db.prepare(`SELECT ${idCol} AS rid, ${col} AS val FROM ${table} WHERE ${col} IS NOT NULL`).all()
  const update = db.prepare(`UPDATE ${table} SET ${col} = ? WHERE ${idCol} = ?`)
  for (const { rid, val } of rows) {
    const next = typeof val === 'string' ? upgradeLegacyJsonText(val) : val
    if (next !== val) update.run(next, rid)
  }
}

export function up(db) {
  for (const [from, to] of TABLES) {
    if (!hasTable(db, from)) continue
    // Eine zu früh angelegte, leere Ziel-Tabelle (Basis-Schema neuer Namen) wird ersetzt.
    if (hasTable(db, to) && db.prepare(`SELECT COUNT(*) AS c FROM ${to}`).get().c === 0) db.exec(`DROP TABLE ${to}`)
    if (!hasTable(db, to)) db.exec(`ALTER TABLE ${from} RENAME TO ${to}`)
  }
  for (const [table, from, to] of COLUMNS) {
    if (hasTable(db, table) && hasColumn(db, table, from)) db.exec(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`)
  }
  for (const table of ['battens', 'template_battens']) {
    db.exec(`UPDATE ${table} SET batten_type = 'batten' WHERE batten_type = 'zugstange'`)
    db.exec(`UPDATE ${table} SET batten_type = 'point_batten' WHERE batten_type = 'punktzug'`)
  }
  rewriteJsonColumn(db, 'channels', 'id', 'mount_ref')
  rewriteJsonColumn(db, 'template_drawing_plans', 'id', 'canvas_data')
  rewriteJsonColumn(db, 'show_drawing_plan_layers', 'id', 'canvas_data')
}

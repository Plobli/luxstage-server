import { hasColumn, addColumnIfMissing } from './helpers.js'

// show_floorplan_layers: image_path + canvas_data nachträglich hinzugefügt.
// canvas_data erfordert einen Table-Rebuild (SQLite ADD COLUMN reicht für
// einfache Fälle, hier historisch als Rebuild gelöst — beibehalten, um exakt
// gleiches Verhalten wie vor der Migrations-Aufteilung zu garantieren).
export const id = '009-show-floorplan-layers-columns'

export function alreadyApplied(db) {
  return hasColumn(db, 'show_floorplan_layers', 'image_path') && hasColumn(db, 'show_floorplan_layers', 'canvas_data')
}

export function up(db) {
  addColumnIfMissing(db, 'show_floorplan_layers', 'image_path', 'TEXT')
  if (!hasColumn(db, 'show_floorplan_layers', 'canvas_data')) {
    db.exec(`
      CREATE TABLE show_floorplan_layers_new (
        id         TEXT PRIMARY KEY,
        show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        canvas_data TEXT,
        image_path TEXT,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO show_floorplan_layers_new (id, show_id, image_path, updated_at)
        SELECT id, show_id, image_path, updated_at FROM show_floorplan_layers;
      DROP TABLE show_floorplan_layers;
      ALTER TABLE show_floorplan_layers_new RENAME TO show_floorplan_layers;
    `)
  }
}

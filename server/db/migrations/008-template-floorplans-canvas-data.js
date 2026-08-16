// template_floorplans: canvas_data nachträglich hinzugefügt
export const id = '008-template-floorplans-canvas-data'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(template_floorplans)").all().map(c => c.name)
  return cols.includes('canvas_data')
}

export function up(db) {
  db.exec('ALTER TABLE template_floorplans ADD COLUMN canvas_data TEXT')
}

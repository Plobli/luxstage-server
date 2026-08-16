// height_cm + notes auf bars
export const id = '013-bars-height-notes'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(bars)").all().map(c => c.name)
  return cols.includes('height_cm') && cols.includes('notes')
}

export function up(db) {
  const cols = db.prepare("PRAGMA table_info(bars)").all().map(c => c.name)
  if (!cols.includes('height_cm')) db.exec('ALTER TABLE bars ADD COLUMN height_cm REAL')
  if (!cols.includes('notes')) db.exec("ALTER TABLE bars ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
}

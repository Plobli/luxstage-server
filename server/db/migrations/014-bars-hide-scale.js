// hide_scale auf bars
export const id = '014-bars-hide-scale'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(bars)").all().map(c => c.name)
  return cols.includes('hide_scale')
}

export function up(db) {
  db.exec('ALTER TABLE bars ADD COLUMN hide_scale INTEGER NOT NULL DEFAULT 0')
}

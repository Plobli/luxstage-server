// side auf bar_fixtures — innen/außen bei Traversen
export const id = '019-bar-fixtures-side'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(bar_fixtures)").all().map(c => c.name)
  return cols.includes('side')
}

export function up(db) {
  db.exec("ALTER TABLE bar_fixtures ADD COLUMN side TEXT NOT NULL DEFAULT 'out'")
}

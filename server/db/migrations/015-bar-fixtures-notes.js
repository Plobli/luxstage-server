// notes auf bar_fixtures
export const id = '015-bar-fixtures-notes'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(bar_fixtures)").all().map(c => c.name)
  return cols.includes('notes')
}

export function up(db) {
  db.exec("ALTER TABLE bar_fixtures ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
}

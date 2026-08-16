// position_text auf bar_fixtures — Freitext-Position bei Punktzug
export const id = '020-bar-fixtures-position-text'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(bar_fixtures)").all().map(c => c.name)
  return cols.includes('position_text')
}

export function up(db) {
  db.exec("ALTER TABLE bar_fixtures ADD COLUMN position_text TEXT NOT NULL DEFAULT ''")
}

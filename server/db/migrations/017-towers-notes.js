// notes auf towers
export const id = '017-towers-notes'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(towers)").all().map(c => c.name)
  return cols.includes('notes')
}

export function up(db) {
  db.exec("ALTER TABLE towers ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
}

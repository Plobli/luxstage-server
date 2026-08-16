// bar_type auf bars — unterscheidet Zugstange/Traverse/Punktzug
export const id = '018-bars-bar-type'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(bars)").all().map(c => c.name)
  return cols.includes('bar_type')
}

export function up(db) {
  db.exec("ALTER TABLE bars ADD COLUMN bar_type TEXT NOT NULL DEFAULT 'zugstange'")
}

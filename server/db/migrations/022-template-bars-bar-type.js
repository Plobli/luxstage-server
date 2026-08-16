// bar_type auf template_bars. Redundant mit CREATE TABLE in Migration 021
// (die legt bar_type bereits an) — Check bleibt trotzdem für DBs, deren
// template_bars vor Einführung von bar_type in Migration 021 entstand.
export const id = '022-template-bars-bar-type'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(template_bars)").all().map(c => c.name)
  return cols.includes('bar_type')
}

export function up(db) {
  db.exec("ALTER TABLE template_bars ADD COLUMN bar_type TEXT NOT NULL DEFAULT 'zugstange'")
}

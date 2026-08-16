// position_text auf template_bar_fixtures — Freitext-Position bei Punktzug
export const id = '028-template-bar-fixtures-position-text'

export function alreadyApplied(db) {
  const cols = db.prepare("PRAGMA table_info(template_bar_fixtures)").all().map(c => c.name)
  return cols.includes('position_text')
}

export function up(db) {
  db.exec("ALTER TABLE template_bar_fixtures ADD COLUMN position_text TEXT NOT NULL DEFAULT ''")
}

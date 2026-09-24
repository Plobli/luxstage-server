import { hasColumn, addColumnIfMissing } from './helpers.js'

// label auf bar_fixtures: freier Kurztext für generische Elemente ohne
// Kanalbezug (channel_id bleibt dann NULL) — z.B. "Nebelmaschine", "Anker".
export const id = '049-bar-fixtures-label'

export function alreadyApplied(db) {
  return hasColumn(db, 'bar_fixtures', 'label')
}

export function up(db) {
  addColumnIfMissing(db, 'bar_fixtures', 'label', "TEXT NOT NULL DEFAULT ''")
}

import { hasColumn, addColumnIfMissing } from './helpers.js'

// position_text auf bar_fixtures — Freitext-Position bei Punktzug
export const id = '020-bar-fixtures-position-text'

export function alreadyApplied(db) {
  return hasColumn(db, 'bar_fixtures', 'position_text')
}

export function up(db) {
  addColumnIfMissing(db, 'bar_fixtures', 'position_text', "TEXT NOT NULL DEFAULT ''")
}

import { hasColumn, addColumnIfMissing } from './helpers.js'

// notes auf bar_fixtures
export const id = '015-bar-fixtures-notes'

export function alreadyApplied(db) {
  return hasColumn(db, 'bar_fixtures', 'notes')
}

export function up(db) {
  addColumnIfMissing(db, 'bar_fixtures', 'notes', "TEXT NOT NULL DEFAULT ''")
}

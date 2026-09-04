import { hasColumn, addColumnIfMissing } from './helpers.js'

// height_cm + notes auf bars
export const id = '013-bars-height-notes'

export function alreadyApplied(db) {
  return hasColumn(db, 'bars', 'height_cm') && hasColumn(db, 'bars', 'notes')
}

export function up(db) {
  addColumnIfMissing(db, 'bars', 'height_cm', 'REAL')
  addColumnIfMissing(db, 'bars', 'notes', "TEXT NOT NULL DEFAULT ''")
}

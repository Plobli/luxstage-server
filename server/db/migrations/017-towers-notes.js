import { hasColumn, addColumnIfMissing } from './helpers.js'

// notes auf towers
export const id = '017-towers-notes'

export function alreadyApplied(db) {
  return hasColumn(db, 'towers', 'notes')
}

export function up(db) {
  addColumnIfMissing(db, 'towers', 'notes', "TEXT NOT NULL DEFAULT ''")
}

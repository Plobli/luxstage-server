import { hasColumn, addColumnIfMissing } from './helpers.js'

// hide_scale auf bars
export const id = '014-bars-hide-scale'

export function alreadyApplied(db) {
  return hasColumn(db, 'bars', 'hide_scale')
}

export function up(db) {
  addColumnIfMissing(db, 'bars', 'hide_scale', 'INTEGER NOT NULL DEFAULT 0')
}

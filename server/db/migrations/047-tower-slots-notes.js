import { hasColumn, addColumnIfMissing } from './helpers.js'

// notes auf tower_slots
export const id = '047-tower-slots-notes'

export function alreadyApplied(db) {
  return hasColumn(db, 'tower_slots', 'notes')
}

export function up(db) {
  addColumnIfMissing(db, 'tower_slots', 'notes', "TEXT NOT NULL DEFAULT ''")
}

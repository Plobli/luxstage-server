import { hasColumn, addColumnIfMissing } from './helpers.js'

// bar_type auf bars — unterscheidet Zugstange/Traverse/Punktzug
export const id = '018-bars-bar-type'

export function alreadyApplied(db) {
  return hasColumn(db, 'bars', 'bar_type')
}

export function up(db) {
  addColumnIfMissing(db, 'bars', 'bar_type', "TEXT NOT NULL DEFAULT 'zugstange'")
}

import { hasColumn, addColumnIfMissing } from './helpers.js'

// side auf bar_fixtures — innen/außen bei Traversen
export const id = '019-bar-fixtures-side'

export function alreadyApplied(db) {
  return hasColumn(db, 'bar_fixtures', 'side')
}

export function up(db) {
  addColumnIfMissing(db, 'bar_fixtures', 'side', "TEXT NOT NULL DEFAULT 'out'")
}

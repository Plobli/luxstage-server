import { hasColumn, addColumnIfMissing } from './helpers.js'

// side auf template_bar_fixtures — innen/außen bei Traversen
export const id = '027-template-bar-fixtures-side'

export function alreadyApplied(db) {
  return hasColumn(db, 'template_bar_fixtures', 'side')
}

export function up(db) {
  addColumnIfMissing(db, 'template_bar_fixtures', 'side', "TEXT NOT NULL DEFAULT 'out'")
}

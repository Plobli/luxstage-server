import { hasColumn, addColumnIfMissing } from './helpers.js'

// position_text auf template_bar_fixtures — Freitext-Position bei Punktzug
export const id = '028-template-bar-fixtures-position-text'

export function alreadyApplied(db) {
  return hasColumn(db, 'template_bar_fixtures', 'position_text')
}

export function up(db) {
  addColumnIfMissing(db, 'template_bar_fixtures', 'position_text', "TEXT NOT NULL DEFAULT ''")
}

import { hasColumn, addColumnIfMissing } from './helpers.js'

export const id = '045-generated-height'

export function alreadyApplied(db) {
  return hasColumn(db, 'users', 'generated_height')
}

export function up(db) {
  addColumnIfMissing(db, 'users', 'generated_height', 'INTEGER')
}

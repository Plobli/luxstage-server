import { hasColumn, addColumnIfMissing } from './helpers.js'

export const id = '044-sidebar-width'

export function alreadyApplied(db) {
  return hasColumn(db, 'users', 'sidebar_width')
}

export function up(db) {
  addColumnIfMissing(db, 'users', 'sidebar_width', 'INTEGER')
}

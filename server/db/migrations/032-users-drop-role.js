import { hasColumn } from './helpers.js'

// Benutzerrollen entfernt: keine Unterscheidung mehr zwischen admin/techniker.
export const id = '032-users-drop-role'

export function alreadyApplied(db) {
  return !hasColumn(db, 'users', 'role')
}

export function up(db) {
  db.exec('ALTER TABLE users DROP COLUMN role')
}

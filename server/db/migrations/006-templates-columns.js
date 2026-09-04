import { hasColumn, addColumnIfMissing } from './helpers.js'

export const id = '006-templates-columns'

export function alreadyApplied(db) {
  return hasColumn(db, 'templates', 'osc_host') && hasColumn(db, 'templates', 'updated_at')
}

export function up(db) {
  addColumnIfMissing(db, 'templates', 'osc_host', "TEXT NOT NULL DEFAULT ''")
  addColumnIfMissing(db, 'templates', 'updated_at', 'INTEGER NOT NULL DEFAULT 0')
}

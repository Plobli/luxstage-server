import { hasColumn, addColumnIfMissing } from './helpers.js'

// sidebar_pinned/griddeck_config: User-Preferences, nachträglich hinzugefügt
export const id = '002-users-preferences'

export function alreadyApplied(db) {
  return hasColumn(db, 'users', 'sidebar_pinned') && hasColumn(db, 'users', 'griddeck_config')
}

export function up(db) {
  addColumnIfMissing(db, 'users', 'sidebar_pinned', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'users', 'griddeck_config', 'TEXT')
}

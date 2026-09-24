import { hasColumn, addColumnIfMissing } from './helpers.js'

// sequence_order in channels: optionale Zahl, z.B. Einleuchtreihenfolge
export const id = '050-channels-sequence-order'

export function alreadyApplied(db) {
  return hasColumn(db, 'channels', 'sequence_order')
}

export function up(db) {
  addColumnIfMissing(db, 'channels', 'sequence_order', 'INTEGER')
}

import { hasColumn, addColumnIfMissing } from './helpers.js'

// mount_ref in channels: JSON-Feld { type, towerId, slotIndex } oder null
export const id = '011-channels-mount-ref-quantity'

export function alreadyApplied(db) {
  return hasColumn(db, 'channels', 'mount_ref') && hasColumn(db, 'channels', 'quantity')
}

export function up(db) {
  addColumnIfMissing(db, 'channels', 'mount_ref', 'TEXT')
  addColumnIfMissing(db, 'channels', 'quantity', 'INTEGER NOT NULL DEFAULT 1')
}

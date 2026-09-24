import { hasColumn, addColumnIfMissing } from './helpers.js'

// scale_origin auf bars: 'center' (Standard), 'left' oder 'right'
export const id = '048-bars-scale-origin'

export function alreadyApplied(db) {
  return hasColumn(db, 'bars', 'scale_origin')
}

export function up(db) {
  addColumnIfMissing(db, 'bars', 'scale_origin', "TEXT NOT NULL DEFAULT 'center'")
}

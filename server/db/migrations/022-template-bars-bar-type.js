import { hasColumn, addColumnIfMissing } from './helpers.js'

// bar_type auf template_bars. Redundant mit CREATE TABLE in Migration 021
// (die legt bar_type bereits an) — Check bleibt trotzdem für DBs, deren
// template_bars vor Einführung von bar_type in Migration 021 entstand.
export const id = '022-template-bars-bar-type'

export function alreadyApplied(db) {
  return hasColumn(db, 'template_bars', 'bar_type')
}

export function up(db) {
  addColumnIfMissing(db, 'template_bars', 'bar_type', "TEXT NOT NULL DEFAULT 'zugstange'")
}

import { hasColumn, addColumnIfMissing } from './helpers.js'

// last_edited_by/at, use_bars/towers, eos_excluded_channels, Versionszähler:
// nachträglich hinzugefügt, fehlen in älteren DBs. untertitel: entfernt.
//
// channels_version: eigener Versionszähler nur für Channel-Writes, getrennt
// von updated_at (das auch von Meta-Updates, Archivieren etc. verändert wird
// und deshalb für Channels-Konflikterkennung ungeeignet ist).
// section_contents_version / section_defs_version: gleiches Prinzip, für die
// beiden unabhängigen Sections-PUT-Endpunkte (Inhalte vs. Struktur/Definitionen).
export const id = '003-shows-columns'

const ADDED = ['last_edited_by', 'last_edited_at', 'use_bars', 'use_towers', 'eos_excluded_channels', 'channels_version', 'section_contents_version', 'section_defs_version']

export function alreadyApplied(db) {
  return ADDED.every(c => hasColumn(db, 'shows', c)) && !hasColumn(db, 'shows', 'untertitel')
}

export function up(db) {
  addColumnIfMissing(db, 'shows', 'last_edited_by', 'TEXT')
  addColumnIfMissing(db, 'shows', 'last_edited_at', 'INTEGER')
  addColumnIfMissing(db, 'shows', 'use_bars', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(db, 'shows', 'use_towers', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(db, 'shows', 'eos_excluded_channels', 'TEXT')
  addColumnIfMissing(db, 'shows', 'channels_version', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'shows', 'section_contents_version', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'shows', 'section_defs_version', 'INTEGER NOT NULL DEFAULT 0')
  if (hasColumn(db, 'shows', 'untertitel')) db.exec('ALTER TABLE shows DROP COLUMN untertitel')
}

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
  const cols = db.pragma('table_info(shows)').map(c => c.name)
  return ADDED.every(c => cols.includes(c)) && !cols.includes('untertitel')
}

export function up(db) {
  const cols = db.pragma('table_info(shows)').map(c => c.name)
  if (!cols.includes('last_edited_by')) db.exec('ALTER TABLE shows ADD COLUMN last_edited_by TEXT')
  if (!cols.includes('last_edited_at')) db.exec('ALTER TABLE shows ADD COLUMN last_edited_at INTEGER')
  if (!cols.includes('use_bars')) db.exec('ALTER TABLE shows ADD COLUMN use_bars INTEGER NOT NULL DEFAULT 1')
  if (!cols.includes('use_towers')) db.exec('ALTER TABLE shows ADD COLUMN use_towers INTEGER NOT NULL DEFAULT 1')
  if (!cols.includes('eos_excluded_channels')) db.exec('ALTER TABLE shows ADD COLUMN eos_excluded_channels TEXT')
  if (!cols.includes('channels_version')) db.exec('ALTER TABLE shows ADD COLUMN channels_version INTEGER NOT NULL DEFAULT 0')
  if (!cols.includes('section_contents_version')) db.exec('ALTER TABLE shows ADD COLUMN section_contents_version INTEGER NOT NULL DEFAULT 0')
  if (!cols.includes('section_defs_version')) db.exec('ALTER TABLE shows ADD COLUMN section_defs_version INTEGER NOT NULL DEFAULT 0')
  if (cols.includes('untertitel')) db.exec('ALTER TABLE shows DROP COLUMN untertitel')
}

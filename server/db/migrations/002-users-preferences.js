// sidebar_pinned/griddeck_config: User-Preferences, nachträglich hinzugefügt
export const id = '002-users-preferences'

export function alreadyApplied(db) {
  const cols = db.pragma('table_info(users)').map(c => c.name)
  return cols.includes('sidebar_pinned') && cols.includes('griddeck_config')
}

export function up(db) {
  const cols = db.pragma('table_info(users)').map(c => c.name)
  if (!cols.includes('sidebar_pinned')) db.exec('ALTER TABLE users ADD COLUMN sidebar_pinned INTEGER NOT NULL DEFAULT 0')
  if (!cols.includes('griddeck_config')) db.exec('ALTER TABLE users ADD COLUMN griddeck_config TEXT')
}

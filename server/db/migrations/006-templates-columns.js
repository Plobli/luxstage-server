export const id = '006-templates-columns'

export function alreadyApplied(db) {
  const cols = db.pragma('table_info(templates)').map(c => c.name)
  return cols.includes('osc_host') && cols.includes('updated_at')
}

export function up(db) {
  const cols = db.pragma('table_info(templates)').map(c => c.name)
  if (!cols.includes('osc_host')) db.exec("ALTER TABLE templates ADD COLUMN osc_host TEXT NOT NULL DEFAULT ''")
  if (!cols.includes('updated_at')) db.exec('ALTER TABLE templates ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0')
}

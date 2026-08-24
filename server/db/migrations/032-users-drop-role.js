// Benutzerrollen entfernt: keine Unterscheidung mehr zwischen admin/techniker.
export const id = '032-users-drop-role'

export function alreadyApplied(db) {
  const cols = db.pragma('table_info(users)').map(c => c.name)
  return !cols.includes('role')
}

export function up(db) {
  db.exec('ALTER TABLE users DROP COLUMN role')
}

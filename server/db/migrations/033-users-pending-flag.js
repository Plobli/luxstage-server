// Selbst-registrierte Nutzer starten inaktiv, bis ein bestehender Nutzer sie freischaltet.
export const id = '033-users-pending-flag'

export function alreadyApplied(db) {
  const cols = db.pragma('table_info(users)').map(c => c.name)
  return cols.includes('pending')
}

export function up(db) {
  db.exec('ALTER TABLE users ADD COLUMN pending INTEGER NOT NULL DEFAULT 0')
}

import { hasColumn, addColumnIfMissing } from './helpers.js'

// Selbst-registrierte Nutzer starten inaktiv, bis ein bestehender Nutzer sie freischaltet.
export const id = '033-users-pending-flag'

export function alreadyApplied(db) {
  return hasColumn(db, 'users', 'pending')
}

export function up(db) {
  addColumnIfMissing(db, 'users', 'pending', 'INTEGER NOT NULL DEFAULT 0')
}

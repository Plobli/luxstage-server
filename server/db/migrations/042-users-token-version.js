import { addColumnIfMissing, hasColumn } from './helpers.js'

// Erlaubt sofortigen Session-Entzug bei Passwort-Änderung/-Reset: das JWT
// trägt ab jetzt token_version im Payload, authenticate() vergleicht sie
// gegen den aktuellen DB-Wert und lehnt bei Abweichung ab. Ohne das blieb ein
// gestohlenes Token bis zu 12h gültig, selbst nachdem der legitime Nutzer das
// Passwort geändert hat, um einen Angreifer auszusperren.
export const id = '042-users-token-version'

export function alreadyApplied(db) {
  return hasColumn(db, 'users', 'token_version')
}

export function up(db) {
  addColumnIfMissing(db, 'users', 'token_version', 'INTEGER NOT NULL DEFAULT 0')
}

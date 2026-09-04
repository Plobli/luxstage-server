import { hasColumn, addColumnIfMissing } from './helpers.js'

// Hauptswitch-Kennzeichnung: bei "Automatisch anordnen" werden Räume mit
// einem Hauptswitch immer ganz oben platziert.
export const id = '038-network-nodes-is-main'

export function alreadyApplied(db) {
  return hasColumn(db, 'network_nodes', 'is_main')
}

export function up(db) {
  addColumnIfMissing(db, 'network_nodes', 'is_main', 'INTEGER NOT NULL DEFAULT 0')
}

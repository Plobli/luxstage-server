// Hauptswitch-Kennzeichnung: bei "Automatisch anordnen" werden Räume mit
// einem Hauptswitch immer ganz oben platziert.
export const id = '038-network-nodes-is-main'

export function alreadyApplied(db) {
  const cols = db.prepare(`PRAGMA table_info(network_nodes)`).all()
  return cols.some(c => c.name === 'is_main')
}

export function up(db) {
  db.exec(`ALTER TABLE network_nodes ADD COLUMN is_main INTEGER NOT NULL DEFAULT 0`)
}

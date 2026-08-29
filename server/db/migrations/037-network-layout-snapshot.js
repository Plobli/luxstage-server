// "Ansicht speichern": ein einzelner gespeicherter Positions-Snapshot für die
// Netzwerk-Topologie, den Nutzer jederzeit wiederherstellen können.
export const id = '037-network-layout-snapshot'

export function alreadyApplied(db) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'network_layout_snapshot'
  `).get()
  return row.n > 0
}

export function up(db) {
  db.exec(`
    CREATE TABLE network_layout_snapshot (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}

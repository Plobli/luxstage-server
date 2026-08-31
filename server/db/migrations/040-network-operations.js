// Serverseitiges Undo/Redo fürs Netzwerk — analog zu operations/redo_stack,
// aber ohne show_id: das Netzwerk ist gebäudeweit und keiner Show zugeordnet,
// deshalb ein einziger globaler Stack statt einer pro Show.
export const id = '040-network-operations'

export function alreadyApplied(db) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'network_operations'
  `).get()
  return row.n > 0
}

export function up(db) {
  db.exec(`
    CREATE TABLE network_operations (
      id           TEXT PRIMARY KEY,
      created_at   INTEGER NOT NULL,
      performed_by TEXT NOT NULL,
      snapshot     TEXT NOT NULL,
      hash         TEXT NOT NULL
    );
    CREATE INDEX idx_network_operations_created ON network_operations(created_at DESC);

    CREATE TABLE network_redo_stack (
      id         TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      snapshot   TEXT NOT NULL,
      hash       TEXT NOT NULL
    );
    CREATE INDEX idx_network_redo_stack_created ON network_redo_stack(created_at DESC);
  `)
}

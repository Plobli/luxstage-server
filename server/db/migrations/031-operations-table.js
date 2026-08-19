// Serverseitiges Undo/Redo: ein Eintrag pro Save mit altem/neuem Zustand
// der jeweiligen Ressource (Snapshot-Diff, keine Einzelfeld-Operationen).
export const id = '031-operations-table'

export function alreadyApplied(db) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'operations'
  `).get()
  return row.n > 0
}

export function up(db) {
  db.exec(`
    CREATE TABLE operations (
      id            TEXT PRIMARY KEY,
      show_id       TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      created_at    INTEGER NOT NULL,
      performed_by  TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      payload       TEXT NOT NULL
    );
    CREATE INDEX idx_operations_show_created ON operations(show_id, created_at DESC);
  `)
}

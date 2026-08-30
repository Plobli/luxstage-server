// Ersetzt das alte Teil-Payload-Modell (ein Eintrag pro Ressourcentyp) durch
// vollständige Show-Zustands-Snapshots — Undo/Redo kann sonst bei Aktionen,
// die mehrere Ressourcentypen ändern, in einen inkonsistenten Zwischenzustand
// laufen. redo_stack wird persistent (vorher In-Memory-Map), damit ein
// Serverneustart mitten in einer Undo-Session den Redo-Stack nicht verliert.
export const id = '039-operations-full-snapshot'

export function alreadyApplied(db) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'redo_stack'
  `).get()
  return row.n > 0
}

export function up(db) {
  db.exec(`
    DROP TABLE IF EXISTS operations;

    CREATE TABLE operations (
      id           TEXT PRIMARY KEY,
      show_id      TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      created_at   INTEGER NOT NULL,
      performed_by TEXT NOT NULL,
      snapshot     TEXT NOT NULL,
      hash         TEXT NOT NULL
    );
    CREATE INDEX idx_operations_show_created ON operations(show_id, created_at DESC);

    CREATE TABLE redo_stack (
      id         TEXT PRIMARY KEY,
      show_id    TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      snapshot   TEXT NOT NULL,
      hash       TEXT NOT NULL
    );
    CREATE INDEX idx_redo_stack_show_created ON redo_stack(show_id, created_at DESC);
  `)
}

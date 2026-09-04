// Generischer Lock-Mechanismus für Ressourcen ohne eigene shows-Zeile
// (Netzwerk, Templates) — die bestehende locks-Tabelle ist über show_id fest
// an shows gebunden. lock_key ist ein freier String ('network', 'template:<name>').
export const id = '041-resource-locks'

export function alreadyApplied(db) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'resource_locks'
  `).get()
  return row.n > 0
}

export function up(db) {
  db.exec(`
    CREATE TABLE resource_locks (
      lock_key TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      since    INTEGER NOT NULL
    );
  `)
}

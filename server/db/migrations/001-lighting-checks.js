// lighting_checks: Einleucht-Status pro Show (TTL 6h, kein FK-Constraint damit alte Shows sauber bleiben)
export const id = '001-lighting-checks'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lighting_checks'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE lighting_checks (
      show_id    TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      checked_by TEXT NOT NULL,
      checked_at INTEGER NOT NULL,
      PRIMARY KEY (show_id, channel_id)
    );
    CREATE INDEX idx_lighting_checks_show ON lighting_checks(show_id);
  `)
}

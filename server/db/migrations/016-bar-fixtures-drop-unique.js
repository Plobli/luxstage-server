// UNIQUE(bar_id, channel_id) entfernen → mehrfache Kanäle auf einer Stange erlauben.
// Table-Rebuild, weil SQLite UNIQUE-Constraints nicht per ALTER TABLE entfernt.
export const id = '016-bar-fixtures-drop-unique'

// Alte Bestands-DBs markierten das über settings['migration_bar_fixtures_no_unique_2026'].
export function alreadyApplied(db) {
  return !!db.prepare("SELECT value FROM settings WHERE key = 'migration_bar_fixtures_no_unique_2026'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE bar_fixtures_new (
      id         TEXT PRIMARY KEY,
      bar_id     TEXT NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
      channel_id TEXT,
      position   REAL NOT NULL DEFAULT 0,
      notes      TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO bar_fixtures_new (id, bar_id, channel_id, position, notes)
      SELECT id, bar_id, channel_id, position, notes FROM bar_fixtures;
    DROP TABLE bar_fixtures;
    ALTER TABLE bar_fixtures_new RENAME TO bar_fixtures;
    CREATE INDEX IF NOT EXISTS idx_bar_fixtures_bar ON bar_fixtures(bar_id);
    INSERT INTO settings (key, value) VALUES ('migration_bar_fixtures_no_unique_2026', '1');
  `)
}

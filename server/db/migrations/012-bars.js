// bars: Zugstangen pro Show
export const id = '012-bars'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bars'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE bars (
      id           TEXT PRIMARY KEY,
      show_id      TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      name         TEXT NOT NULL DEFAULT '',
      zug_nr       TEXT NOT NULL DEFAULT '',
      length_cm    INTEGER NOT NULL DEFAULT 600,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX idx_bars_show ON bars(show_id);

    CREATE TABLE bar_fixtures (
      id         TEXT PRIMARY KEY,
      bar_id     TEXT NOT NULL REFERENCES bars(id) ON DELETE CASCADE,
      channel_id TEXT,
      position   REAL NOT NULL DEFAULT 0,
      UNIQUE(bar_id, channel_id)
    );
    CREATE INDEX idx_bar_fixtures_bar ON bar_fixtures(bar_id);
  `)
}

// template_bar_fixtures: Scheinwerfer-Positionen auf Template-Bars
export const id = '026-template-bar-fixtures'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='template_bar_fixtures'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE template_bar_fixtures (
      id         TEXT PRIMARY KEY,
      bar_id     TEXT NOT NULL REFERENCES template_bars(id) ON DELETE CASCADE,
      position   REAL NOT NULL DEFAULT 0,
      channel    TEXT,
      device     TEXT,
      color      TEXT,
      notes      TEXT NOT NULL DEFAULT '',
      UNIQUE(bar_id, position)
    );
    CREATE INDEX idx_template_bar_fixtures_bar ON template_bar_fixtures(bar_id);
  `)
}

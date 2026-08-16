// template_bars: Zugstangen-Definitionen pro Bühnen-Template
export const id = '021-template-bars'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='template_bars'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE template_bars (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT '',
      zug_nr      TEXT NOT NULL DEFAULT '',
      length_cm   INTEGER NOT NULL DEFAULT 600,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      bar_type    TEXT NOT NULL DEFAULT 'zugstange'
    );
    CREATE INDEX idx_template_bars_tpl ON template_bars(template_id);
  `)
}

// template_towers: Gassenturm-Definitionen pro Bühnen-Template
export const id = '025-template-towers'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='template_towers'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE template_towers (
      id          TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      name        TEXT NOT NULL DEFAULT '',
      side        TEXT NOT NULL DEFAULT '',
      stage_area  TEXT NOT NULL DEFAULT '',
      slot_count  INTEGER NOT NULL DEFAULT 4,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_template_towers_tpl ON template_towers(template_id);

    CREATE TABLE template_tower_slots (
      id         TEXT PRIMARY KEY,
      tower_id   TEXT NOT NULL REFERENCES template_towers(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL,
      channel    TEXT,
      device     TEXT,
      color      TEXT,
      UNIQUE(tower_id, slot_index)
    );
    CREATE INDEX idx_template_tower_slots_tower ON template_tower_slots(tower_id);
  `)
}

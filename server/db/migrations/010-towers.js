// towers: Gassenturm-Instanzen pro Show
export const id = '010-towers'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='towers'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE towers (
      id           TEXT PRIMARY KEY,
      show_id      TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      name         TEXT NOT NULL DEFAULT '',
      side         TEXT NOT NULL DEFAULT '',
      stage_area   TEXT NOT NULL DEFAULT '',
      slot_count   INTEGER NOT NULL DEFAULT 4,
      sort_order   INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX idx_towers_show ON towers(show_id);

    CREATE TABLE tower_slots (
      id         TEXT PRIMARY KEY,
      tower_id   TEXT NOT NULL REFERENCES towers(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL,
      channel_id TEXT,
      UNIQUE(tower_id, slot_index)
    );
    CREATE INDEX idx_tower_slots_tower ON tower_slots(tower_id);
  `)
}

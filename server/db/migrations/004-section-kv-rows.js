// section_kv_rows: Zeilen für kv-table Sections
export const id = '004-section-kv-rows'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='section_kv_rows'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE section_kv_rows (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES section_defs(id) ON DELETE CASCADE,
      label      TEXT NOT NULL DEFAULT '',
      value      TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_section_kv_rows_section ON section_kv_rows(section_id);
  `)
}

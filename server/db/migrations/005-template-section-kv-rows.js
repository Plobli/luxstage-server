// template_section_kv_rows: wie section_kv_rows, aber für Templates
export const id = '005-template-section-kv-rows'

export function alreadyApplied(db) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='template_section_kv_rows'").get()
}

export function up(db) {
  db.exec(`
    CREATE TABLE template_section_kv_rows (
      id         TEXT PRIMARY KEY,
      section_id TEXT NOT NULL REFERENCES template_section_defs(id) ON DELETE CASCADE,
      label      TEXT NOT NULL DEFAULT '',
      value      TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_tpl_section_kv_rows_section ON template_section_kv_rows(section_id);
  `)
}

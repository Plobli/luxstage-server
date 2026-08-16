// section_defs Umbenennung (Stände→Raum, Besonderheiten→Hinweise)
export const id = '023-section-defs-rename'

// Alte Bestands-DBs markierten das über settings['migration_section_rename_2026'].
export function alreadyApplied(db) {
  return !!db.prepare("SELECT value FROM settings WHERE key = 'migration_section_rename_2026'").get()
}

export function up(db) {
  db.exec(`
    UPDATE section_defs SET title = 'Raum'     WHERE title = 'Stände';
    UPDATE section_defs SET title = 'Hinweise' WHERE title = 'Besonderheiten';
    UPDATE template_section_defs SET title = 'Raum'     WHERE title = 'Stände';
    UPDATE template_section_defs SET title = 'Hinweise' WHERE title = 'Besonderheiten';
    INSERT INTO settings (key, value) VALUES ('migration_section_rename_2026', '1');
  `)
}

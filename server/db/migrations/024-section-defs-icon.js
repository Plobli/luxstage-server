// icon: stabiler Bezeichner für das Sidebar-Symbol. Vorher wurde es aus dem
// deutschen Titel abgeleitet — beim Umbenennen oder auf Englisch war es weg.
// Muss nach 023-section-defs-rename laufen, weil aus den Titeln abgeleitet wird.
export const id = '024-section-defs-icon'

const TABLES = ['section_defs', 'template_section_defs']

export function alreadyApplied(db) {
  return TABLES.every(table => db.pragma(`table_info(${table})`).map(c => c.name).includes('icon'))
}

export function up(db) {
  for (const table of TABLES) {
    const cols = db.pragma(`table_info(${table})`).map(c => c.name)
    if (!cols.includes('icon')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN icon TEXT NOT NULL DEFAULT ''`)
      // Einmalige Zuordnung nach dem heutigen Stand. Danach bleibt icon stabil,
      // auch wenn der Nutzer den Abschnitt umbenennt.
      // 'setup' ist mehr als ein Symbol: daran hängt auch der generierte Text
      // (Beleuchtungsgestelle/Obermaschinerie) und die Erkennung, ob der
      // Aufbau-Abschnitt schon existiert.
      db.exec(`
        UPDATE ${table} SET icon = 'warning' WHERE title = 'Hinweise';
        UPDATE ${table} SET icon = 'room'    WHERE title = 'Raum';
        UPDATE ${table} SET icon = 'setup'   WHERE title = 'Aufbau';
      `)
    }
  }
}

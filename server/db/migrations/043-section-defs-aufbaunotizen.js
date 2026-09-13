// Benennt bestehende "Aufbau"-Abschnitte in "Aufbaunotizen" um. Betrifft nur
// Abschnitte, deren Titel noch beim Default steht (icon 'setup' UND title
// 'Aufbau') — von Nutzern umbenannte Abschnitte bleiben unangetastet.
export const id = '043-section-defs-aufbaunotizen'

const TABLES = ['section_defs', 'template_section_defs']

export function alreadyApplied(db) {
  return TABLES.every(table =>
    db.prepare(`SELECT 1 FROM ${table} WHERE icon = 'setup' AND title = 'Aufbau' LIMIT 1`).get() === undefined
  )
}

export function up(db) {
  for (const table of TABLES) {
    db.exec(`UPDATE ${table} SET title = 'Aufbaunotizen' WHERE icon = 'setup' AND title = 'Aufbau'`)
  }
}

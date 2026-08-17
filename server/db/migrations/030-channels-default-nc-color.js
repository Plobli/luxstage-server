// Bestehende Kanäle ohne Farbe bekommen "NC" (No Color) als Default.
export const id = '030-channels-default-nc-color'

export function alreadyApplied(db) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM channels WHERE TRIM(COALESCE(color, '')) = ''
  `).get()
  return row.n === 0
}

export function up(db) {
  db.prepare(`
    UPDATE channels SET color = 'NC' WHERE TRIM(COALESCE(color, '')) = ''
  `).run()
}

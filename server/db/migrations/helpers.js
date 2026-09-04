// Gemeinsame Helfer für das "Spalte hinzufügen, falls sie fehlt"-Muster, das
// sich durch viele Migrationen zieht — vermeidet doppeltes table_info()-Lesen
// zwischen alreadyApplied() und up() und die wiederholte cols.includes()-Prüfung.

export function hasColumn(db, table, col) {
  return db.pragma(`table_info(${table})`).some(c => c.name === col)
}

export function addColumnIfMissing(db, table, col, typeDef) {
  if (!hasColumn(db, table, col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${typeDef}`)
}

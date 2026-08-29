// Interaktive Graph-Ansicht: Nutzer verschiebt Elemente frei, Position wird
// pro Knoten gespeichert. NULL = noch nicht platziert, Frontend layoutet dann
// automatisch (dagre).
export const id = '036-network-nodes-position'

export function alreadyApplied(db) {
  const cols = db.prepare(`PRAGMA table_info(network_nodes)`).all()
  return cols.some(c => c.name === 'position_x')
}

export function up(db) {
  db.exec(`
    ALTER TABLE network_nodes ADD COLUMN position_x REAL;
    ALTER TABLE network_nodes ADD COLUMN position_y REAL;
  `)
}

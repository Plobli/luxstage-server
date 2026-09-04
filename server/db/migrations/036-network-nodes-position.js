import { hasColumn, addColumnIfMissing } from './helpers.js'

// Interaktive Graph-Ansicht: Nutzer verschiebt Elemente frei, Position wird
// pro Knoten gespeichert. NULL = noch nicht platziert, Frontend layoutet dann
// automatisch (dagre).
export const id = '036-network-nodes-position'

export function alreadyApplied(db) {
  return hasColumn(db, 'network_nodes', 'position_x')
}

export function up(db) {
  addColumnIfMissing(db, 'network_nodes', 'position_x', 'REAL')
  addColumnIfMissing(db, 'network_nodes', 'position_y', 'REAL')
}

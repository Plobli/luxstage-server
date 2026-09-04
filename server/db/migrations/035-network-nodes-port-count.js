import { hasColumn, addColumnIfMissing } from './helpers.js'

// Switches sind der Ausgangspunkt der Netzwerk-Topologie und haben eine feste
// Portanzahl — Verbindungen an einem Switch wählen den Port aus dieser Liste
// statt Freitext.
export const id = '035-network-nodes-port-count'

export function alreadyApplied(db) {
  return hasColumn(db, 'network_nodes', 'port_count')
}

export function up(db) {
  addColumnIfMissing(db, 'network_nodes', 'port_count', 'INTEGER')
}

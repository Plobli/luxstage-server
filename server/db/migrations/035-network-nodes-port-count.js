// Switches sind der Ausgangspunkt der Netzwerk-Topologie und haben eine feste
// Portanzahl — Verbindungen an einem Switch wählen den Port aus dieser Liste
// statt Freitext.
export const id = '035-network-nodes-port-count'

export function alreadyApplied(db) {
  const cols = db.prepare(`PRAGMA table_info(network_nodes)`).all()
  return cols.some(c => c.name === 'port_count')
}

export function up(db) {
  db.exec(`ALTER TABLE network_nodes ADD COLUMN port_count INTEGER`)
}

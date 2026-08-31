// server/db/network-state.js
// Liest/schreibt den kompletten Netzwerk-Zustand als eine atomare Einheit —
// Grundlage für Undo/Redo, analog zu full-state.js für Shows, aber ohne
// Show-Bezug (das Netzwerk ist gebäudeweit, nicht show-spezifisch).
import { createHash } from 'node:crypto'
import { getDb } from '../db-context.js'
import { listNetworkNodes, listNetworkConnections } from './network.js'

export function readFullNetworkState() {
  return {
    nodes: listNetworkNodes(),
    connections: listNetworkConnections(),
  }
}

export function writeFullNetworkState(state) {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM network_connections').run()
    db.prepare('DELETE FROM network_nodes').run()
    for (const n of state.nodes) {
      db.prepare(
        'INSERT INTO network_nodes (id, type, label, room, port_count, position_x, position_y, is_main, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(n.id, n.type, n.label, n.room ?? '', n.port_count ?? null, n.position_x ?? null, n.position_y ?? null, n.is_main ? 1 : 0, n.created_at)
    }
    for (const c of state.connections) {
      db.prepare(
        'INSERT INTO network_connections (id, from_node_id, from_port, to_node_id, to_port, cable_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(c.id, c.from_node_id, c.from_port ?? '', c.to_node_id, c.to_port ?? '', c.cable_type ?? '', c.created_at)
    }
  })
  tx()
}

// Deterministisch: beide Listen sind bereits stabil nach created_at sortiert.
export function computeNetworkStateHash(state) {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex')
}

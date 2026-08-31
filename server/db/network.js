import { getDb } from '../db-context.js'
import { randomUUID } from 'node:crypto'

function now() { return Date.now() }

export function listNetworkNodes() {
  return getDb().prepare('SELECT * FROM network_nodes ORDER BY created_at ASC').all()
}

export function getNetworkNode(id) {
  return getDb().prepare('SELECT * FROM network_nodes WHERE id = ?').get(id)
}

export function createNetworkNode({ type, label, room, port_count, position_x, position_y, is_main }) {
  const id = randomUUID()
  getDb().prepare(
    'INSERT INTO network_nodes (id, type, label, room, port_count, position_x, position_y, is_main, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, type, label, room ?? '', port_count ?? null, position_x ?? null, position_y ?? null, is_main ? 1 : 0, now())
  return getDb().prepare('SELECT * FROM network_nodes WHERE id = ?').get(id)
}

export function updateNetworkNode(id, { type, label, room, port_count, position_x, position_y, is_main }) {
  getDb().prepare(
    'UPDATE network_nodes SET type = ?, label = ?, room = ?, port_count = ?, position_x = ?, position_y = ?, is_main = ? WHERE id = ?'
  ).run(type, label, room ?? '', port_count ?? null, position_x ?? null, position_y ?? null, is_main ? 1 : 0, id)
  return getDb().prepare('SELECT * FROM network_nodes WHERE id = ?').get(id)
}

export function deleteNetworkNode(id) {
  getDb().prepare('DELETE FROM network_nodes WHERE id = ?').run(id)
}

export function listNetworkConnections() {
  return getDb().prepare('SELECT * FROM network_connections ORDER BY created_at ASC').all()
}

export function createNetworkConnection({ from_node_id, from_port, to_node_id, to_port, cable_type }) {
  const id = randomUUID()
  getDb().prepare(
    'INSERT INTO network_connections (id, from_node_id, from_port, to_node_id, to_port, cable_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, from_node_id, from_port ?? '', to_node_id, to_port ?? '', cable_type ?? '', now())
  return getDb().prepare('SELECT * FROM network_connections WHERE id = ?').get(id)
}

export function updateNetworkConnection(id, { from_node_id, from_port, to_node_id, to_port, cable_type }) {
  getDb().prepare(
    'UPDATE network_connections SET from_node_id = ?, from_port = ?, to_node_id = ?, to_port = ?, cable_type = ? WHERE id = ?'
  ).run(from_node_id, from_port ?? '', to_node_id, to_port ?? '', cable_type ?? '', id)
  return getDb().prepare('SELECT * FROM network_connections WHERE id = ?').get(id)
}

export function deleteNetworkConnection(id) {
  getDb().prepare('DELETE FROM network_connections WHERE id = ?').run(id)
}

const LAYOUT_SNAPSHOT_ID = 'default'

export function getNetworkLayoutSnapshot() {
  const row = getDb().prepare('SELECT * FROM network_layout_snapshot WHERE id = ?').get(LAYOUT_SNAPSHOT_ID)
  if (!row) return null
  return { data: JSON.parse(row.data), updated_at: row.updated_at }
}

export function saveNetworkLayoutSnapshot(data) {
  const updated_at = now()
  getDb().prepare(
    'INSERT INTO network_layout_snapshot (id, data, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
  ).run(LAYOUT_SNAPSHOT_ID, JSON.stringify(data), updated_at)
  return { data, updated_at }
}

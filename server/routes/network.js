import * as db from '../db.js'
import { requireAuth } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { generateNetworkPDF } from '../pdf/network.js'
import { withNetworkUndoSnapshot, getLastNetworkOperation, deleteNetworkOperation, pushNetworkRedo, popNetworkRedo, recordNetworkSnapshot } from '../db/network-operations.js'
import { readFullNetworkState, writeFullNetworkState, computeNetworkStateHash } from '../db/network-state.js'

const NETWORK_NODES         = /^\/api\/network\/nodes$/
const NETWORK_NODE          = /^\/api\/network\/nodes\/([^/]+)$/
const NETWORK_CONNECTIONS   = /^\/api\/network\/connections$/
const NETWORK_CONNECTION    = /^\/api\/network\/connections\/([^/]+)$/
const NETWORK_LAYOUT_SNAPSHOT = /^\/api\/network\/layout-snapshot$/
const NETWORK_PDF           = /^\/api\/network\/pdf$/
const NETWORK_UNDO          = /^\/api\/network\/undo$/
const NETWORK_REDO          = /^\/api\/network\/redo$/

// Physikalisch sinnlos: zwei Netzwerkdosen oder zwei Geräte direkt
// miteinander verkabelt (ein Switch darf mit allem verbunden werden, auch
// mit einem zweiten Switch). Serverseitige Absicherung — das Frontend
// filtert das bereits in der Auswahl, aber die API muss unabhängig davon
// gültig bleiben.
function isValidConnectionPair(typeA, typeB) {
  if (!typeA || !typeB) return true
  return !(typeA === typeB && (typeA === 'dose' || typeA === 'geraet'))
}

// Dose = Durchschleifung (rein/raus), also bis zu zwei Kabel; Gerät hat nur
// eines; Switch ist unbegrenzt (ein Port = eine Verbindung, separat geprüft).
// Das Frontend löst einen Konflikt per Rückfrage (älteste Verbindung löschen,
// dann neu anlegen); die API lehnt ein bereits ausgeschöpftes Limit ab.
function maxConnectionsForType(type) {
  if (type === 'dose') return 2
  if (type === 'geraet') return 1
  return Infinity
}
function isNodeSlotFree(nodeType, nodeId, excludeConnId) {
  if (nodeType === 'switch') return true
  const max = maxConnectionsForType(nodeType)
  const count = db.listNetworkConnections().filter(c => c.id !== excludeConnId && (c.from_node_id === nodeId || c.to_node_id === nodeId)).length
  return count < max
}

export async function networkRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = NETWORK_NODES.exec(pathname)) {
    if (method === 'GET') {
      const user = requireAuth(req, res); if (!user) return
      return json(res, 200, db.listNetworkNodes())
    }
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      let created
      withNetworkUndoSnapshot(user.username, () => { created = db.createNetworkNode(body) })
      return json(res, 201, created)
    }
  }

  if (m = NETWORK_NODE.exec(pathname)) {
    const id = m[1]
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      let updated
      withNetworkUndoSnapshot(user.username, () => { updated = db.updateNetworkNode(id, body) })
      return json(res, 200, updated)
    }
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      withNetworkUndoSnapshot(user.username, () => { db.deleteNetworkNode(id) })
      return json(res, 200, { ok: true })
    }
  }

  if (m = NETWORK_CONNECTIONS.exec(pathname)) {
    if (method === 'GET') {
      const user = requireAuth(req, res); if (!user) return
      return json(res, 200, db.listNetworkConnections())
    }
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const fromType = db.getNetworkNode(body.from_node_id)?.type
      const toType = db.getNetworkNode(body.to_node_id)?.type
      if (!isValidConnectionPair(fromType, toType)) {
        return json(res, 400, { error: 'Netzwerkdosen können nicht mit Netzwerkdosen, Geräte nicht mit Geräten verbunden werden' })
      }
      if (!isNodeSlotFree(fromType, body.from_node_id, null) || !isNodeSlotFree(toType, body.to_node_id, null)) {
        return json(res, 400, { error: 'Element ist bereits verbunden' })
      }
      let created
      withNetworkUndoSnapshot(user.username, () => { created = db.createNetworkConnection(body) })
      return json(res, 201, created)
    }
  }

  if (m = NETWORK_CONNECTION.exec(pathname)) {
    const id = m[1]
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const fromType = db.getNetworkNode(body.from_node_id)?.type
      const toType = db.getNetworkNode(body.to_node_id)?.type
      if (!isValidConnectionPair(fromType, toType)) {
        return json(res, 400, { error: 'Netzwerkdosen können nicht mit Netzwerkdosen, Geräte nicht mit Geräten verbunden werden' })
      }
      if (!isNodeSlotFree(fromType, body.from_node_id, id) || !isNodeSlotFree(toType, body.to_node_id, id)) {
        return json(res, 400, { error: 'Element ist bereits verbunden' })
      }
      let updated
      withNetworkUndoSnapshot(user.username, () => { updated = db.updateNetworkConnection(id, body) })
      return json(res, 200, updated)
    }
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      withNetworkUndoSnapshot(user.username, () => { db.deleteNetworkConnection(id) })
      return json(res, 200, { ok: true })
    }
  }

  if (NETWORK_PDF.test(pathname)) {
    if (method === 'GET') {
      const user = requireAuth(req, res); if (!user) return
      generateNetworkPDF(db.listNetworkNodes(), db.listNetworkConnections(), res)
      return
    }
  }

  if (NETWORK_UNDO.test(pathname)) {
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const op = getLastNetworkOperation()
      if (!op) return json(res, 400, { error: 'Nichts zum Rückgängigmachen' })
      const targetState = JSON.parse(op.snapshot)
      if (computeNetworkStateHash(targetState) !== op.hash) {
        return json(res, 409, { error: 'Snapshot-Hash stimmt nicht überein — Undo abgebrochen' })
      }
      const currentState = readFullNetworkState()
      writeFullNetworkState(targetState)
      deleteNetworkOperation(op.id)
      pushNetworkRedo(currentState)
      return json(res, 200, { ok: true })
    }
  }

  if (NETWORK_REDO.test(pathname)) {
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const entry = popNetworkRedo()
      if (!entry) return json(res, 400, { error: 'Nichts zum Wiederholen' })
      const targetState = JSON.parse(entry.snapshot)
      if (computeNetworkStateHash(targetState) !== entry.hash) {
        return json(res, 409, { error: 'Snapshot-Hash stimmt nicht überein — Redo abgebrochen' })
      }
      const currentState = readFullNetworkState()
      writeFullNetworkState(targetState)
      recordNetworkSnapshot(user.username, currentState)
      return json(res, 200, { ok: true })
    }
  }

  if (m = NETWORK_LAYOUT_SNAPSHOT.exec(pathname)) {
    if (method === 'GET') {
      const user = requireAuth(req, res); if (!user) return
      return json(res, 200, db.getNetworkLayoutSnapshot())
    }
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      return json(res, 200, db.saveNetworkLayoutSnapshot(body))
    }
  }

  return null
}

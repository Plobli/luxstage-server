import { createNetworkConnection, createNetworkNode, deleteNetworkConnection, deleteNetworkNode, getNetworkLayoutSnapshot, getNetworkNode, listNetworkConnections, listNetworkNodes, saveNetworkLayoutSnapshot, updateNetworkConnection, updateNetworkNode } from '../db/network.js'
import { readJsonBody, json } from '../helpers.js'
import { generateNetworkPDF } from '../pdf/network.js'
import { withNetworkUndoSnapshot, getLastNetworkOperation, deleteNetworkOperation, pushNetworkRedo, popNetworkRedo, recordNetworkSnapshot } from '../db/network-operations.js'
import { handleUndoRedo } from './undo-redo.js'
import { readFullNetworkState, writeFullNetworkState, computeNetworkStateHash } from '../db/network-state.js'
import { acquireResourceLock, releaseResourceLock, touchResourceLock, getResourceLock } from '../db/resource-locks.js'
import { isValidConnectionPair, maxConnectionsForType } from '../../shared/constants.js'

const NETWORK_NODES         = /^\/api\/network\/nodes$/
const NETWORK_NODE          = /^\/api\/network\/nodes\/([^/]+)$/
const NETWORK_CONNECTIONS   = /^\/api\/network\/connections$/
const NETWORK_CONNECTION    = /^\/api\/network\/connections\/([^/]+)$/
const NETWORK_LAYOUT_SNAPSHOT = /^\/api\/network\/layout-snapshot$/
const NETWORK_PDF           = /^\/api\/network\/pdf$/
const NETWORK_UNDO          = /^\/api\/network\/undo$/
const NETWORK_REDO          = /^\/api\/network\/redo$/
const NETWORK_LOCK          = /^\/api\/network\/lock$/

// Netzwerk-Lock: gebäudeweite Ressource ohne eigene shows-Zeile, daher über
// den generischen db/resource-locks.js-Mechanismus statt db/locks.js.
// Kein Takeover-Request/SSE-Broadcast wie bei Shows — das Netzwerk hat
// (noch) keine eigene SSE-Subscription; der 423 aus router.js allein
// verhindert aber bereits das stille gegenseitige Überschreiben.
const NETWORK_LOCK_KEY = 'network'

function isNodeSlotFree(nodeType, nodeId, excludeConnId) {
  if (nodeType === 'switch') return true
  const max = maxConnectionsForType(nodeType)
  const count = listNetworkConnections().filter(c => c.id !== excludeConnId && (c.from_node_id === nodeId || c.to_node_id === nodeId)).length
  return count < max
}

export async function networkRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = NETWORK_NODES.exec(pathname)) {
    if (method === 'GET') {
      const user = req.user
      return json(res, 200, listNetworkNodes())
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      let created
      withNetworkUndoSnapshot(user.username, () => { created = createNetworkNode(body) })
      return json(res, 201, created)
    }
  }

  if (m = NETWORK_NODE.exec(pathname)) {
    const id = m[1]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      let updated
      withNetworkUndoSnapshot(user.username, () => { updated = updateNetworkNode(id, body) })
      return json(res, 200, updated)
    }
    if (method === 'DELETE') {
      const user = req.user
      withNetworkUndoSnapshot(user.username, () => { deleteNetworkNode(id) })
      return json(res, 200, { ok: true })
    }
  }

  if (m = NETWORK_CONNECTIONS.exec(pathname)) {
    if (method === 'GET') {
      const user = req.user
      return json(res, 200, listNetworkConnections())
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const fromType = getNetworkNode(body.from_node_id)?.type
      const toType = getNetworkNode(body.to_node_id)?.type
      if (!isValidConnectionPair(fromType, toType)) {
        return json(res, 400, { error: 'Netzwerkdosen können nicht mit Netzwerkdosen, Geräte nicht mit Geräten verbunden werden' })
      }
      if (!isNodeSlotFree(fromType, body.from_node_id, null) || !isNodeSlotFree(toType, body.to_node_id, null)) {
        return json(res, 400, { error: 'Element ist bereits verbunden' })
      }
      let created
      withNetworkUndoSnapshot(user.username, () => { created = createNetworkConnection(body) })
      return json(res, 201, created)
    }
  }

  if (m = NETWORK_CONNECTION.exec(pathname)) {
    const id = m[1]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const fromType = getNetworkNode(body.from_node_id)?.type
      const toType = getNetworkNode(body.to_node_id)?.type
      if (!isValidConnectionPair(fromType, toType)) {
        return json(res, 400, { error: 'Netzwerkdosen können nicht mit Netzwerkdosen, Geräte nicht mit Geräten verbunden werden' })
      }
      if (!isNodeSlotFree(fromType, body.from_node_id, id) || !isNodeSlotFree(toType, body.to_node_id, id)) {
        return json(res, 400, { error: 'Element ist bereits verbunden' })
      }
      let updated
      withNetworkUndoSnapshot(user.username, () => { updated = updateNetworkConnection(id, body) })
      return json(res, 200, updated)
    }
    if (method === 'DELETE') {
      const user = req.user
      withNetworkUndoSnapshot(user.username, () => { deleteNetworkConnection(id) })
      return json(res, 200, { ok: true })
    }
  }

  if (NETWORK_PDF.test(pathname)) {
    if (method === 'GET') {
      const user = req.user
      generateNetworkPDF(listNetworkNodes(), listNetworkConnections(), res)
      return
    }
  }

  if (NETWORK_UNDO.test(pathname)) {
    if (method === 'POST') {
      return handleUndoRedo(res, 'undo', {
        getEntry: getLastNetworkOperation,
        computeHash: computeNetworkStateHash,
        readState: readFullNetworkState,
        writeState: writeFullNetworkState,
        consumeEntry: (op) => deleteNetworkOperation(op.id),
        pushOpposite: pushNetworkRedo,
      })
    }
  }

  if (NETWORK_REDO.test(pathname)) {
    if (method === 'POST') {
      const user = req.user
      return handleUndoRedo(res, 'redo', {
        getEntry: popNetworkRedo,
        computeHash: computeNetworkStateHash,
        readState: readFullNetworkState,
        writeState: writeFullNetworkState,
        consumeEntry: () => {}, // popNetworkRedo() hat den Eintrag beim Holen bereits entfernt
        pushOpposite: (currentState) => recordNetworkSnapshot(user.username, currentState),
      })
    }
  }

  if (NETWORK_LOCK.test(pathname)) {
    const user = req.user
    if (method === 'GET') {
      return json(res, 200, { lock: getResourceLock(NETWORK_LOCK_KEY) })
    }
    if (method === 'POST') {
      const result = acquireResourceLock(NETWORK_LOCK_KEY, user.username)
      return json(res, result.ok ? 200 : 423, result)
    }
    if (method === 'PUT') {
      touchResourceLock(NETWORK_LOCK_KEY, user.username)
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      releaseResourceLock(NETWORK_LOCK_KEY, user.username)
      return json(res, 200, { ok: true })
    }
  }

  if (m = NETWORK_LAYOUT_SNAPSHOT.exec(pathname)) {
    if (method === 'GET') {
      const user = req.user
      return json(res, 200, getNetworkLayoutSnapshot())
    }
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      return json(res, 200, saveNetworkLayoutSnapshot(body))
    }
  }

  return null
}

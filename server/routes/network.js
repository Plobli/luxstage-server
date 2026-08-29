import * as db from '../db.js'
import { requireAuth } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'

const NETWORK_NODES         = /^\/api\/network\/nodes$/
const NETWORK_NODE          = /^\/api\/network\/nodes\/([^/]+)$/
const NETWORK_CONNECTIONS   = /^\/api\/network\/connections$/
const NETWORK_CONNECTION    = /^\/api\/network\/connections\/([^/]+)$/
const NETWORK_LAYOUT_SNAPSHOT = /^\/api\/network\/layout-snapshot$/

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
      return json(res, 201, db.createNetworkNode(body))
    }
  }

  if (m = NETWORK_NODE.exec(pathname)) {
    const id = m[1]
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      return json(res, 200, db.updateNetworkNode(id, body))
    }
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      db.deleteNetworkNode(id)
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
      return json(res, 201, db.createNetworkConnection(body))
    }
  }

  if (m = NETWORK_CONNECTION.exec(pathname)) {
    const id = m[1]
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      return json(res, 200, db.updateNetworkConnection(id, body))
    }
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      db.deleteNetworkConnection(id)
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

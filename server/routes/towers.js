import * as db from '../db.js'
import { restoreTowers } from '../db/towers.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'
import { withUndoSnapshot } from '../db/operations.js'

const SHOW_TOWERS         = /^\/api\/shows\/([^/]+)\/towers$/
const SHOW_TOWERS_RESTORE = /^\/api\/shows\/([^/]+)\/towers\/restore$/
const SHOW_TOWER          = /^\/api\/shows\/([^/]+)\/towers\/([^/]+)$/
const SHOW_TOWER_SLOT     = /^\/api\/shows\/([^/]+)\/towers\/([^/]+)\/slots\/(\d+)$/

export async function towerRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (m = SHOW_TOWERS_RESTORE.exec(pathname)) {
    const slug = m[1]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = db.readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        restoreTowers(slug, body.towers ?? [])
      })
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_TOWERS.exec(pathname)) {
    const slug = m[1]
    if (method === 'GET') {
      const towers = db.readTowers(slug)
      for (const tower of towers) db.ensureTowerSlots(tower.id, tower.slot_count)
      return json(res, 200, db.readTowers(slug))
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = db.readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      let towerId
      withUndoSnapshot(slug, show.id, user.username, () => {
        towerId = db.writeTower(slug, body)
        db.ensureTowerSlots(towerId, body.slot_count ?? 4)
      })
      broadcast(slug, 'towers-updated', {})
      return json(res, 201, { id: towerId })
    }
  }

  if (m = SHOW_TOWER.exec(pathname)) {
    const slug = m[1]
    const towerId = m[2]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = db.readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        db.writeTower(slug, { ...body, id: towerId })
        if (body.slot_count != null) db.ensureTowerSlots(towerId, body.slot_count)
      })
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      const show = db.readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        db.deleteTower(towerId)
      })
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  if (m = SHOW_TOWER_SLOT.exec(pathname)) {
    const slug = m[1]
    const towerId = m[2]
    const slotIndex = parseInt(m[3])
    if (method === 'PATCH') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelId } = body
      const show = db.readShow(slug)
      if (!show) return json(res, 404, { error: 'Show nicht gefunden' })

      withUndoSnapshot(slug, show.id, user.username, () => {
        if (channelId) {
          db.writeTowerSlot(towerId, slotIndex, channelId)
        } else {
          db.clearTowerSlot(towerId, slotIndex)
        }
      })
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  return null
}

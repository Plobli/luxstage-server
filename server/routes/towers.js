import { requireShow } from '../db/shows.js'
import { clearTowerSlot, deleteTower, ensureTowerSlots, readTowers, restoreTowers, writeTower, writeTowerSlot } from '../db/towers.js'
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
      const show = requireShow(slug, res)
      if (!show) return

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
      const towers = readTowers(slug)
      for (const tower of towers) ensureTowerSlots(tower.id, tower.slot_count)
      return json(res, 200, readTowers(slug))
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const show = requireShow(slug, res)
      if (!show) return

      let towerId
      withUndoSnapshot(slug, show.id, user.username, () => {
        towerId = writeTower(slug, body)
        ensureTowerSlots(towerId, body.slot_count ?? 4)
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
      const show = requireShow(slug, res)
      if (!show) return

      withUndoSnapshot(slug, show.id, user.username, () => {
        writeTower(slug, { ...body, id: towerId })
        if (body.slot_count != null) ensureTowerSlots(towerId, body.slot_count)
      })
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      const show = requireShow(slug, res)
      if (!show) return

      withUndoSnapshot(slug, show.id, user.username, () => {
        deleteTower(show.id, towerId)
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
      const show = requireShow(slug, res)
      if (!show) return

      withUndoSnapshot(slug, show.id, user.username, () => {
        if (channelId) {
          writeTowerSlot(show.id, towerId, slotIndex, channelId)
        } else {
          clearTowerSlot(show.id, towerId, slotIndex)
        }
      })
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  return null
}

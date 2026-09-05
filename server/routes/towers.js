import { clearTowerSlot, deleteTower, ensureTowerSlots, readTowers, restoreTowers, writeTower, writeTowerSlot } from '../db/towers.js'
import { readJsonBody, json, withShowMutation } from '../helpers.js'

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
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'towers-updated', () => {
        restoreTowers(slug, body.towers ?? [])
      })
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
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'towers-updated', () => {
        const towerId = writeTower(slug, body)
        ensureTowerSlots(towerId, body.slot_count ?? 4)
        return towerId
      }, {
        status: 201,
        responseBody: towerId => ({ id: towerId }),
      })
    }
  }

  if (m = SHOW_TOWER.exec(pathname)) {
    const slug = m[1]
    const towerId = m[2]
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      return withShowMutation(req, res, slug, 'towers-updated', () => {
        writeTower(slug, { ...body, id: towerId })
        if (body.slot_count != null) ensureTowerSlots(towerId, body.slot_count)
      })
    }
    if (method === 'DELETE') {
      return withShowMutation(req, res, slug, 'towers-updated', (show) => {
        deleteTower(show.id, towerId)
      })
    }
  }

  if (m = SHOW_TOWER_SLOT.exec(pathname)) {
    const slug = m[1]
    const towerId = m[2]
    const slotIndex = parseInt(m[3])
    if (method === 'PATCH') {
      const body = await readJsonBody(req, res); if (body === null) return
      const { channelId } = body
      return withShowMutation(req, res, slug, 'towers-updated', (show) => {
        if (channelId) {
          writeTowerSlot(show.id, towerId, slotIndex, channelId)
        } else {
          clearTowerSlot(show.id, towerId, slotIndex)
        }
      })
    }
  }

  return null
}

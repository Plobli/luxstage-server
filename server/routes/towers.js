import * as db from '../db.js'
import { restoreTowers } from '../db/towers.js'
import { readJsonBody, json } from '../helpers.js'
import { broadcast } from '../sse.js'
import { recordOperation, clearRedo } from '../db/operations.js'

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
      const oldTowers = db.readTowers(slug)
      restoreTowers(slug, body.towers ?? [])
      recordTowersOperation(show, user, oldTowers, body.towers ?? [])
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
      const oldTowers = db.readTowers(slug)
      const towerId = db.writeTower(slug, body)
      db.ensureTowerSlots(towerId, body.slot_count ?? 4)
      recordTowersOperation(show, user, oldTowers, db.readTowers(slug))
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
      const oldTowers = db.readTowers(slug)
      db.writeTower(slug, { ...body, id: towerId })
      if (body.slot_count != null) db.ensureTowerSlots(towerId, body.slot_count)
      recordTowersOperation(show, user, oldTowers, db.readTowers(slug))
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      const show = db.readShow(slug)
      const oldTowers = db.readTowers(slug)
      db.deleteTower(towerId)
      recordTowersOperation(show, user, oldTowers, db.readTowers(slug))
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
      const oldTowers = db.readTowers(slug)
      if (channelId) {
        db.writeTowerSlot(towerId, slotIndex, channelId)
      } else {
        db.clearTowerSlot(towerId, slotIndex)
      }
      recordTowersOperation(show, user, oldTowers, db.readTowers(slug))
      broadcast(slug, 'towers-updated', {})
      return json(res, 200, { ok: true })
    }
  }

  return null
}

// Jede Tower-Aktion (anlegen, ändern, löschen, Slot zuweisen) zeichnet den
// kompletten Towers-Zustand der Show auf — konsistent mit dem "ein Eintrag
// pro Save"-Modell der übrigen Ressourcen, kein Sonderfall für Einzel-Towers
// nötig beim Undo/Redo-Anwenden (siehe applyOperationValue in shows.js).
function recordTowersOperation(show, user, oldTowers, newTowers) {
  if (!show || !user) return
  recordOperation(show.id, user.username, 'towers', oldTowers, newTowers)
  clearRedo(show.id)
}

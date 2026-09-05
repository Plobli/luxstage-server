import { readJsonBody, json, notFound } from '../helpers.js'
import { getTemplateByName } from '../db/templates.js'
import {
  readTemplateTowers, writeTemplateTower, deleteTemplateTower, reorderTemplateTowers,
  writeTemplateTowerSlot, clearTemplateTowerSlot, ensureTemplateTowerSlots,
} from '../db/template-towers.js'

const TPL_TOWERS           = /^\/api\/templates\/([^/]+)\/towers$/
const TPL_TOWERS_REORDER   = /^\/api\/templates\/([^/]+)\/towers\/reorder$/
const TPL_TOWER            = /^\/api\/templates\/([^/]+)\/towers\/([^/]+)$/
const TPL_TOWER_SLOT       = /^\/api\/templates\/([^/]+)\/towers\/([^/]+)\/slots\/([^/]+)$/

export async function templateTowerRoutes(req, res, pathname) {
  const { method } = req
  let m

  // ── Tower-Slot ─────────────────────────────────────────────────────────────
  if (m = TPL_TOWER_SLOT.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const towerId = m[2]
    const slotIndex = parseInt(m[3], 10)
    if (method === 'PATCH') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      if (body.channel === null && body.device === null && body.color === null) {
        clearTemplateTowerSlot(templateName, towerId, slotIndex)
      } else {
        writeTemplateTowerSlot(templateName, towerId, slotIndex, body)
      }
      return json(res, 200, { ok: true })
    }
  }

  // ── Tower ──────────────────────────────────────────────────────────────────
  if (m = TPL_TOWERS_REORDER.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = getTemplateByName(templateName)
    if (!tpl) return notFound(res)
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      if (body.order !== undefined && !Array.isArray(body.order)) return json(res, 400, { error: 'order muss ein Array sein' })
      reorderTemplateTowers(tpl.id, body.order ?? [])
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_TOWER.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const towerId = m[2]
    if (method === 'PUT') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      writeTemplateTower(templateName, { ...body, id: towerId })
      ensureTemplateTowerSlots(towerId, body.slot_count ?? 4)
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = req.user
      deleteTemplateTower(templateName, towerId)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_TOWERS.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'GET') {
      return json(res, 200, readTemplateTowers(templateName))
    }
    if (method === 'POST') {
      const user = req.user
      const body = await readJsonBody(req, res); if (body === null) return
      const towerId = writeTemplateTower(templateName, body)
      ensureTemplateTowerSlots(towerId, body.slot_count ?? 4)
      return json(res, 201, { id: towerId })
    }
  }

  return null
}

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import * as db from '../db.js'
import * as floorplan from '../floorplan.js'
import * as photosLib from '../photos.js'
import { requireAuth } from '../auth.js'
import { readJsonBody, json, notFound } from '../helpers.js'

const TPL_LIST             = /^\/api\/templates$/
const TPL_CHANNELS         = /^\/api\/templates\/([^/]+)\/channels$/
const TPL_SECTIONS         = /^\/api\/templates\/([^/]+)\/sections$/
const TPL_BARS             = /^\/api\/templates\/([^/]+)\/bars$/
const TPL_BARS_REORDER     = /^\/api\/templates\/([^/]+)\/bars\/reorder$/
const TPL_BAR              = /^\/api\/templates\/([^/]+)\/bars\/([^/]+)$/
const TPL_BAR_FIXTURES     = /^\/api\/templates\/([^/]+)\/bars\/([^/]+)\/fixtures$/
const TPL_BAR_FIXTURE      = /^\/api\/templates\/([^/]+)\/bars\/([^/]+)\/fixtures\/([^/]+)$/
const TPL_TOWERS           = /^\/api\/templates\/([^/]+)\/towers$/
const TPL_TOWERS_REORDER   = /^\/api\/templates\/([^/]+)\/towers\/reorder$/
const TPL_TOWER            = /^\/api\/templates\/([^/]+)\/towers\/([^/]+)$/
const TPL_TOWER_SLOT       = /^\/api\/templates\/([^/]+)\/towers\/([^/]+)\/slots\/([^/]+)$/
const TPL_FP               = /^\/api\/templates\/([^/]+)\/floorplan$/
const TPL_FP_IMAGE         = /^\/api\/templates\/([^/]+)\/floorplan\/image$/
const TPL_APPLY            = /^\/api\/templates\/([^/]+)\/apply-to-shows$/
const TPL_ID               = /^\/api\/templates\/(.+)$/

function mimeFromFilename(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext]
    || 'application/octet-stream'
}

export async function templateRoutes(req, res, pathname) {
  const { method } = req
  let m

  if (method === 'GET' && TPL_LIST.test(pathname)) {
    return json(res, 200, db.listTemplates())
  }

  if (method === 'PUT' && TPL_LIST.test(pathname)) {
    const user = requireAuth(req, res); if (!user) return
    const body = await readJsonBody(req, res); if (body === null) return
    const { name, oscHost } = body
    if (!name || typeof name !== 'string') return json(res, 400, { error: 'Name fehlt' })
    const tpl = db.getTemplateByName(name)
    if (!tpl) return json(res, 404, { error: 'Bühnen-Template nicht gefunden' })
    const host = typeof oscHost === 'string' ? oscHost.trim() : ''
    if (host.length > 253) return json(res, 400, { error: 'OSC-Host zu lang' })
    db.updateTemplateOscHost(name, host)
    return json(res, 200, { ok: true })
  }

  if (m = TPL_BARS_REORDER.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = db.getTemplateByName(templateName)
    if (!tpl) return notFound(res)
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      db.reorderTemplateBars(tpl.id, body.order ?? [])
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_BAR.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const barId = m[2]
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      db.writeTemplateBar(templateName, { ...body, id: barId })
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      db.deleteTemplateBar(barId)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_BARS.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'GET') {
      return json(res, 200, db.readTemplateBars(templateName))
    }
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const barId = db.writeTemplateBar(templateName, body)
      return json(res, 201, { id: barId })
    }
  }

  // ── Tower-Slot ─────────────────────────────────────────────────────────────
  if (m = TPL_TOWER_SLOT.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const towerId = m[2]
    const slotIndex = parseInt(m[3], 10)
    if (method === 'PATCH') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      if (body.channel === null && body.device === null && body.color === null) {
        db.clearTemplateTowerSlot(towerId, slotIndex)
      } else {
        db.writeTemplateTowerSlot(towerId, slotIndex, body)
      }
      return json(res, 200, { ok: true })
    }
  }

  // ── Tower ──────────────────────────────────────────────────────────────────
  if (m = TPL_TOWERS_REORDER.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = db.getTemplateByName(templateName)
    if (!tpl) return notFound(res)
    if (method === 'PUT') {
      const body = await readJsonBody(req, res); if (body === null) return
      db.reorderTemplateTowers(tpl.id, body.order ?? [])
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_TOWER.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const towerId = m[2]
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      db.writeTemplateTower(templateName, { ...body, id: towerId })
      db.ensureTemplateTowerSlots(towerId, body.slot_count ?? 4)
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      db.deleteTemplateTower(towerId)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_TOWERS.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'GET') {
      return json(res, 200, db.readTemplateTowers(templateName))
    }
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const towerId = db.writeTemplateTower(templateName, body)
      db.ensureTemplateTowerSlots(towerId, body.slot_count ?? 4)
      return json(res, 201, { id: towerId })
    }
  }

  // ── Bar-Fixtures ───────────────────────────────────────────────────────────
  if (m = TPL_BAR_FIXTURE.exec(pathname)) {
    const fixtureId = m[3]
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      db.writeTemplateBarFixture(m[2], { ...body, id: fixtureId })
      return json(res, 200, { ok: true })
    }
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      db.deleteTemplateBarFixture(fixtureId)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_BAR_FIXTURES.exec(pathname)) {
    const barId = m[2]
    if (method === 'GET') {
      return json(res, 200, db.readTemplateBarFixtures(barId))
    }
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const fixtureId = db.writeTemplateBarFixture(barId, body)
      return json(res, 201, { id: fixtureId })
    }
  }

  if (m = TPL_APPLY.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    if (method === 'POST') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const validScopes = ['bars', 'towers', 'sections']
      const scope = validScopes.includes(body.scope) ? body.scope : 'bars'
      try {
        const stats = db.applyTemplateToAllShows(templateName, scope)
        return json(res, 200, { ok: true, ...stats })
      } catch (e) {
        return json(res, 404, { error: e.message })
      }
    }
  }

  if (m = TPL_FP_IMAGE.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = db.getTemplateByName(templateName)
    if (!tpl) return notFound(res)

    if (method === 'POST') {
      const ct = req.headers['content-type'] || ''
      if (!ct.startsWith('multipart/form-data')) return json(res, 400, { error: 'Ungültiger Upload' })
      let upload
      try {
        upload = await photosLib.parseMultipart(req)
        const file = upload.files[0]
        if (!file) return json(res, 400, { error: 'Kein Bild gefunden' })
        const mimeType = mimeFromFilename(file.filename)
        const buffer = await fs.promises.readFile(file.path)
        const imgPath = await floorplan.saveFloorplanImage(tpl.id, file.filename, buffer, mimeType)
        db.upsertTemplateFloorplan(tpl.id, imgPath)
        return json(res, 200, { image_url: floorplan.floorplanUrl(imgPath) })
      } catch (e) {
        const status = /zu groß|zu viele/i.test(e.message) ? 413 : 400
        return json(res, status, { error: e.message || 'Bild-Upload fehlgeschlagen' })
      } finally {
        await upload?.cleanup()
      }
    }

    if (method === 'DELETE') {
      const fp = db.getTemplateFloorplan(tpl.id)
      if (fp?.image_path) await floorplan.deleteFloorplanImage(fp.image_path)
      db.upsertTemplateFloorplan(tpl.id, null)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_FP.exec(pathname)) {
    const templateName = decodeURIComponent(m[1])
    const tpl = db.getTemplateByName(templateName)
    if (!tpl) return notFound(res)

    if (method === 'GET') {
      const fp = db.getTemplateFloorplan(tpl.id)
      return json(res, 200, {
        image_url: fp?.image_path ? floorplan.floorplanUrl(fp.image_path) : null,
        canvas_data: fp?.canvas_data ?? null
      })
    }

    if (method === 'PUT') {
      const body = await readJsonBody(req, res)
      if (body === null) return
      const raw = typeof body.canvas_data === 'string' ? body.canvas_data : JSON.stringify(body.canvas_data ?? null)
      db.upsertTemplateFloorplanData(tpl.id, raw)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_CHANNELS.exec(pathname)) {
    const name = decodeURIComponent(m[1])
    if (method === 'GET') {
      const channels = db.readTemplate(name).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }
  }

  if (m = TPL_SECTIONS.exec(pathname)) {
    const name = decodeURIComponent(m[1])
    if (method === 'GET') {
      return json(res, 200, db.readTemplateSections(name))
    }
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      db.writeTemplateSections(name, body.sections)
      return json(res, 200, { ok: true })
    }
  }

  if (m = TPL_ID.exec(pathname)) {
    const name = decodeURIComponent(m[1])
    if (!name || name.length > 100 || /[\x00-\x1F]/.test(name)) return json(res, 400, { error: 'Ungültiger Bühnen-Template-Name' })

    if (method === 'GET') {
      const channels = db.readTemplate(name).map(({ template_id: _, sort_order: __, ...ch }) => ch)
      return json(res, 200, channels)
    }
    if (method === 'PUT') {
      const user = requireAuth(req, res); if (!user) return
      const channels = await readJsonBody(req, res); if (channels === null) return
      db.writeTemplate(name, channels)
      const existing = db.readTemplateSections(name)
      if (!existing.length) {
        db.writeTemplateSections(name, [
          { id: randomUUID(), title: 'Aufbau', type: 'markdown', order: 0, fields: [] },
          { id: randomUUID(), title: 'Besonderheiten', type: 'markdown', order: 1, fields: [] },
        ])
      }
      return json(res, 200, { ok: true })
    }
    if (method === 'PATCH') {
      const user = requireAuth(req, res); if (!user) return
      const body = await readJsonBody(req, res); if (body === null) return
      const newName = typeof body.name === 'string' ? body.name.trim() : ''
      if (!newName || newName.length > 100 || /[\x00-\x1F]/.test(newName)) return json(res, 400, { error: 'Ungültiger Bühnen-Template-Name' })
      const existing = db.getTemplateByName(newName)
      if (existing) return json(res, 409, { error: 'Name bereits vergeben' })
      db.renameTemplate(name, newName)
      return json(res, 200, { ok: true, name: newName })
    }
    if (method === 'DELETE') {
      const user = requireAuth(req, res); if (!user) return
      db.deleteTemplate(name)
      db.deleteTemplateSections(name)
      return json(res, 200, { ok: true })
    }
  }

  return null
}
